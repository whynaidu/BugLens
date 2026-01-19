import { createTRPCRouter } from "../trpc";
import { organizationsRouter } from "./organizations";
import { projectsRouter } from "./projects";
import { flowsRouter } from "./flows";
import { screenshotsRouter } from "./screenshots";
import { annotationsRouter } from "./annotations";
import { bugsRouter } from "./bugs";
import { commentsRouter } from "./comments";
import { membersRouter } from "./members";
import { notificationsRouter } from "./notifications";
import { integrationsRouter } from "./integrations";
import { auditLogsRouter } from "./auditLogs";

export const appRouter = createTRPCRouter({
  organizations: organizationsRouter,
  projects: projectsRouter,
  flows: flowsRouter,
  screenshots: screenshotsRouter,
  annotations: annotationsRouter,
  bugs: bugsRouter,
  comments: commentsRouter,
  members: membersRouter,
  notifications: notificationsRouter,
  integrations: integrationsRouter,
  auditLogs: auditLogsRouter,
});

export type AppRouter = typeof appRouter;
