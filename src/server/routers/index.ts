import { createTRPCRouter } from "../trpc";
import { organizationsRouter } from "./organizations";
import { projectsRouter } from "./projects";
import { modulesRouter } from "./modules";
import { testcasesRouter } from "./testcases";
import { screenshotsRouter } from "./screenshots";
import { annotationsRouter } from "./annotations";
import { commentsRouter } from "./comments";
import { membersRouter } from "./members";
import { notificationsRouter } from "./notifications";
import { integrationsRouter } from "./integrations";
import { auditLogsRouter } from "./auditLogs";
import { joinRequestsRouter } from "./joinRequests";

export const appRouter = createTRPCRouter({
  organizations: organizationsRouter,
  projects: projectsRouter,
  modules: modulesRouter,
  testcases: testcasesRouter,
  screenshots: screenshotsRouter,
  annotations: annotationsRouter,
  comments: commentsRouter,
  members: membersRouter,
  notifications: notificationsRouter,
  integrations: integrationsRouter,
  auditLogs: auditLogsRouter,
  joinRequests: joinRequestsRouter,
});

export type AppRouter = typeof appRouter;
