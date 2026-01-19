import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

/**
 * Get the current user from the session (server component only)
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Require authentication - redirects to login if not authenticated
 * Use in server components/pages that require auth
 */
export async function requireAuth(
  redirectUrl = "/login"
): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(redirectUrl);
  }

  return user;
}

/**
 * Get the current user's membership in an organization
 */
export async function getUserMembership(organizationId: string) {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return db.member.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId,
      },
    },
    include: {
      organization: true,
    },
  });
}

/**
 * Require membership in an organization - redirects if not a member
 */
export async function requireMembership(
  organizationId: string,
  redirectUrl = "/dashboard"
) {
  const membership = await getUserMembership(organizationId);

  if (!membership) {
    redirect(redirectUrl);
  }

  return membership;
}

/**
 * Check if user has a specific role in an organization
 */
export async function hasRole(
  organizationId: string,
  ...allowedRoles: Role[]
): Promise<boolean> {
  const membership = await getUserMembership(organizationId);

  if (!membership) {
    return false;
  }

  return allowedRoles.includes(membership.role);
}

/**
 * Require a specific role in an organization - redirects if not authorized
 */
export async function requireRole(
  organizationId: string,
  allowedRoles: Role[],
  redirectUrl = "/dashboard"
) {
  const membership = await getUserMembership(organizationId);

  if (!membership || !allowedRoles.includes(membership.role)) {
    redirect(redirectUrl);
  }

  return membership;
}

/**
 * Check if user is an admin of an organization
 */
export async function isOrgAdmin(organizationId: string): Promise<boolean> {
  return hasRole(organizationId, Role.ADMIN);
}

/**
 * Check if user can manage projects (admin or project manager)
 */
export async function canManageProjects(
  organizationId: string
): Promise<boolean> {
  return hasRole(organizationId, Role.ADMIN, Role.PROJECT_MANAGER);
}

/**
 * Check if user can create bugs (all roles except viewer if we had one)
 */
export async function canCreateBugs(organizationId: string): Promise<boolean> {
  return hasRole(
    organizationId,
    Role.ADMIN,
    Role.PROJECT_MANAGER,
    Role.DEVELOPER,
    Role.TESTER
  );
}

/**
 * Get all organizations for the current user
 */
export async function getUserOrganizations() {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  const memberships = await db.member.findMany({
    where: { userId: user.id },
    include: {
      organization: true,
    },
    orderBy: {
      joinedAt: "desc",
    },
  });

  return memberships.map((m) => ({
    ...m.organization,
    role: m.role,
    joinedAt: m.joinedAt,
  }));
}

/**
 * Get the first organization for the current user (for default redirect)
 */
export async function getDefaultOrganization() {
  const organizations = await getUserOrganizations();
  return organizations[0] ?? null;
}
