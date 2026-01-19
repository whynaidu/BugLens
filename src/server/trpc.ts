import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { Role } from "@prisma/client";
import { auth } from "./auth";
import { db } from "./db";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  return {
    db,
    session,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires valid session
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      user: ctx.session.user,
    },
  });
});

/**
 * Organization procedure - requires membership in the organization
 * Must include organizationId in input
 */
export const orgProcedure = protectedProcedure
  .input((val: unknown) => {
    if (
      typeof val === "object" &&
      val !== null &&
      "organizationId" in val &&
      typeof (val as { organizationId: unknown }).organizationId === "string"
    ) {
      return val as { organizationId: string };
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "organizationId is required",
    });
  })
  .use(async ({ ctx, input, next }) => {
    const member = await ctx.db.member.findUnique({
      where: {
        userId_organizationId: {
          userId: ctx.session.user.id,
          organizationId: input.organizationId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!member) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not a member of this organization",
      });
    }

    return next({
      ctx: {
        member,
        organization: member.organization,
      },
    });
  });

/**
 * Admin procedure - requires admin role in the organization
 */
export const adminProcedure = orgProcedure.use(async ({ ctx, next }) => {
  if (ctx.member.role !== Role.ADMIN) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only administrators can perform this action",
    });
  }

  return next({ ctx });
});

/**
 * Manager procedure - requires admin or project manager role
 */
export const managerProcedure = orgProcedure.use(async ({ ctx, next }) => {
  const allowedRoles: Role[] = [Role.ADMIN, Role.PROJECT_MANAGER];

  if (!allowedRoles.includes(ctx.member.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only administrators and project managers can perform this action",
    });
  }

  return next({ ctx });
});

/**
 * Helper to check if user has specific roles
 */
export function hasAnyRole(memberRole: Role, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(memberRole);
}

/**
 * Create a custom role-based procedure
 */
export function createRoleProcedure(allowedRoles: Role[]) {
  return orgProcedure.use(async ({ ctx, next }) => {
    if (!hasAnyRole(ctx.member.role, allowedRoles)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This action requires one of the following roles: ${allowedRoles.join(", ")}`,
      });
    }

    return next({ ctx });
  });
}
