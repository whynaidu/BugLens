import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { validateSlackWebhookUrl, testSlackConnection } from "../services/slack";
import { validateTeamsWebhookUrl, testTeamsConnection } from "../services/teams";
import {
  getJiraOAuthUrl,
  refreshJiraToken,
  getJiraProjects,
  getJiraIssueTypes,
  getJiraPriorities,
  getJiraStatuses,
  createJiraIssue,
  updateJiraIssue,
  getJiraIssue,
  addJiraComment,
  testJiraConnection,
  searchJiraIssues,
  type JiraFieldMapping,
} from "../services/jira";
import {
  getTrelloAuthUrl,
  validateTrelloToken,
  getTrelloBoards,
  getTrelloLists,
  createTrelloCard,
  updateTrelloCard,
  getTrelloCard,
  testTrelloConnection,
} from "../services/trello";
import {
  getAzureDevOpsOAuthUrl,
  refreshAzureDevOpsToken,
  getAzureDevOpsOrganizations,
  getAzureDevOpsProjects,
  getAzureDevOpsWorkItemTypes,
  createAzureDevOpsWorkItem,
  updateAzureDevOpsWorkItem,
  getAzureDevOpsWorkItem,
  getAzureDevOpsStates,
  testAzureDevOpsConnection,
} from "../services/azure-devops";

// Helper to get valid Jira tokens (with auto-refresh)
async function getJiraTokens(
  db: typeof import("@/server/db").db,
  organizationId: string
): Promise<{ accessToken: string; cloudId: string; refreshToken: string | null } | null> {
  const integration = await db.integration.findUnique({
    where: {
      organizationId_type: {
        organizationId,
        type: "JIRA",
      },
    },
  });

  if (!integration?.accessToken) {
    return null;
  }

  const config = integration.config as { cloudId?: string } | null;
  if (!config?.cloudId) {
    return null;
  }

  // Check if token needs refresh (5 min buffer)
  const needsRefresh =
    integration.tokenExpiresAt &&
    new Date(integration.tokenExpiresAt).getTime() < Date.now() + 5 * 60 * 1000;

  if (needsRefresh && integration.refreshToken) {
    try {
      const tokens = await refreshJiraToken(integration.refreshToken);

      // Update tokens in database
      await db.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
        },
      });

      return {
        accessToken: tokens.accessToken,
        cloudId: config.cloudId,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      console.error("Failed to refresh Jira token:", error);
      return null;
    }
  }

  return {
    accessToken: integration.accessToken,
    cloudId: config.cloudId,
    refreshToken: integration.refreshToken,
  };
}

// Helper to get Trello token
async function getTrelloToken(
  db: typeof import("@/server/db").db,
  organizationId: string
): Promise<{ accessToken: string; boardId?: string; listMapping?: Record<string, string> } | null> {
  const integration = await db.integration.findUnique({
    where: {
      organizationId_type: {
        organizationId,
        type: "TRELLO",
      },
    },
  });

  if (!integration?.accessToken) {
    return null;
  }

  const config = integration.config as {
    boardId?: string;
    listMapping?: Record<string, string>;
  } | null;

  return {
    accessToken: integration.accessToken,
    boardId: config?.boardId,
    listMapping: config?.listMapping,
  };
}

// Helper to get Azure DevOps tokens (with auto-refresh)
async function getAzureDevOpsTokens(
  db: typeof import("@/server/db").db,
  organizationId: string
): Promise<{
  accessToken: string;
  organization?: string;
  project?: string;
  workItemType?: string;
} | null> {
  const integration = await db.integration.findUnique({
    where: {
      organizationId_type: {
        organizationId,
        type: "AZURE_DEVOPS",
      },
    },
  });

  if (!integration?.accessToken) {
    return null;
  }

  const config = integration.config as {
    organization?: string;
    project?: string;
    workItemType?: string;
  } | null;

  // Check if token needs refresh (5 min buffer)
  const needsRefresh =
    integration.tokenExpiresAt &&
    new Date(integration.tokenExpiresAt).getTime() < Date.now() + 5 * 60 * 1000;

  if (needsRefresh && integration.refreshToken) {
    try {
      const tokens = await refreshAzureDevOpsToken(integration.refreshToken);

      // Update tokens in database
      await db.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
        },
      });

      return {
        accessToken: tokens.accessToken,
        organization: config?.organization,
        project: config?.project,
        workItemType: config?.workItemType,
      };
    } catch (error) {
      console.error("Failed to refresh Azure DevOps token:", error);
      return null;
    }
  }

  return {
    accessToken: integration.accessToken,
    organization: config?.organization,
    project: config?.project,
    workItemType: config?.workItemType,
  };
}

export const integrationsRouter = createTRPCRouter({
  /**
   * Get all integrations for an organization
   */
  getAll: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify user is member of organization
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this organization",
        });
      }

      const integrations = await ctx.db.integration.findMany({
        where: { organizationId: input.organizationId },
      });

      // Don't expose tokens
      return integrations.map((i) => ({
        id: i.id,
        type: i.type,
        isActive: i.isActive,
        config: i.config,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      }));
    }),

  /**
   * Connect Slack integration via webhook
   */
  connectSlack: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        webhookUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can configure integrations",
        });
      }

      // Validate webhook URL
      if (!validateSlackWebhookUrl(input.webhookUrl)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid Slack webhook URL. It should start with https://hooks.slack.com/services/",
        });
      }

      // Test the webhook
      const testResult = await testSlackConnection(input.webhookUrl);
      if (!testResult.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: testResult.error || "Failed to connect to Slack",
        });
      }

      // Upsert integration
      await ctx.db.integration.upsert({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "SLACK",
          },
        },
        update: {
          config: { webhookUrl: input.webhookUrl },
          isActive: true,
        },
        create: {
          organizationId: input.organizationId,
          type: "SLACK",
          config: { webhookUrl: input.webhookUrl },
          isActive: true,
        },
      });

      return { success: true };
    }),

  /**
   * Test Slack connection
   */
  testSlackConnection: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const integration = await ctx.db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "SLACK",
          },
        },
      });

      const config = integration?.config as { webhookUrl?: string } | null;

      if (!config?.webhookUrl) {
        return { ok: false, error: "Slack not connected" };
      }

      return await testSlackConnection(config.webhookUrl);
    }),

  /**
   * Disconnect Slack integration
   */
  disconnectSlack: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can configure integrations",
        });
      }

      await ctx.db.integration.deleteMany({
        where: {
          organizationId: input.organizationId,
          type: "SLACK",
        },
      });

      return { success: true };
    }),

  /**
   * Connect Teams integration
   */
  connectTeams: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        webhookUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can configure integrations",
        });
      }

      // Validate webhook URL
      if (!validateTeamsWebhookUrl(input.webhookUrl)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid Teams webhook URL",
        });
      }

      // Test the webhook
      const testResult = await testTeamsConnection(input.webhookUrl);
      if (!testResult.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: testResult.error || "Failed to connect to Teams",
        });
      }

      // Upsert integration
      await ctx.db.integration.upsert({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "TEAMS",
          },
        },
        update: {
          config: { webhookUrl: input.webhookUrl },
          isActive: true,
        },
        create: {
          organizationId: input.organizationId,
          type: "TEAMS",
          config: { webhookUrl: input.webhookUrl },
          isActive: true,
        },
      });

      return { success: true };
    }),

  /**
   * Test Teams connection
   */
  testTeamsConnection: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const integration = await ctx.db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "TEAMS",
          },
        },
      });

      const config = integration?.config as { webhookUrl?: string } | null;

      if (!config?.webhookUrl) {
        return { ok: false, error: "Teams not connected" };
      }

      return await testTeamsConnection(config.webhookUrl);
    }),

  /**
   * Disconnect Teams integration
   */
  disconnectTeams: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can configure integrations",
        });
      }

      await ctx.db.integration.deleteMany({
        where: {
          organizationId: input.organizationId,
          type: "TEAMS",
        },
      });

      return { success: true };
    }),

  /**
   * Toggle integration active status
   */
  toggleActive: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        type: z.enum(["SLACK", "TEAMS", "JIRA", "TRELLO", "AZURE_DEVOPS"]),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can configure integrations",
        });
      }

      await ctx.db.integration.updateMany({
        where: {
          organizationId: input.organizationId,
          type: input.type,
        },
        data: {
          isActive: input.isActive,
        },
      });

      return { success: true };
    }),

  // ===================================
  // JIRA INTEGRATION
  // ===================================

  /**
   * Get Jira OAuth URL
   */
  getJiraOAuthUrl: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const url = getJiraOAuthUrl(input.orgSlug);
      return { url };
    }),

  /**
   * Disconnect Jira integration
   */
  disconnectJira: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can configure integrations",
        });
      }

      await ctx.db.integration.deleteMany({
        where: {
          organizationId: input.organizationId,
          type: "JIRA",
        },
      });

      return { success: true };
    }),

  /**
   * Test Jira connection
   */
  testJiraConnection: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tokens = await getJiraTokens(ctx.db, input.organizationId);

      if (!tokens) {
        return { ok: false, error: "Jira not connected" };
      }

      return await testJiraConnection(tokens.accessToken, tokens.cloudId);
    }),

  /**
   * Get Jira configuration
   */
  getJiraConfig: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const integration = await ctx.db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "JIRA",
          },
        },
      });

      if (!integration) {
        return null;
      }

      const config = integration.config as {
        cloudId?: string;
        siteUrl?: string;
        projectKey?: string;
        issueType?: string;
        fieldMapping?: JiraFieldMapping;
        syncDirection?: "push" | "pull" | "both";
      } | null;

      return {
        isConnected: !!integration.accessToken,
        isActive: integration.isActive,
        siteUrl: config?.siteUrl,
        projectKey: config?.projectKey,
        issueType: config?.issueType,
        fieldMapping: config?.fieldMapping,
        syncDirection: config?.syncDirection || "push",
      };
    }),

  /**
   * Get Jira projects
   */
  getJiraProjects: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tokens = await getJiraTokens(ctx.db, input.organizationId);

      if (!tokens) {
        return [];
      }

      try {
        return await getJiraProjects(tokens.accessToken, tokens.cloudId);
      } catch (error) {
        console.error("Failed to fetch Jira projects:", error);
        return [];
      }
    }),

  /**
   * Get Jira issue types for a project
   */
  getJiraIssueTypes: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        projectKey: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tokens = await getJiraTokens(ctx.db, input.organizationId);

      if (!tokens) {
        return [];
      }

      try {
        return await getJiraIssueTypes(
          tokens.accessToken,
          tokens.cloudId,
          input.projectKey
        );
      } catch (error) {
        console.error("Failed to fetch Jira issue types:", error);
        return [];
      }
    }),

  /**
   * Get Jira priorities
   */
  getJiraPriorities: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tokens = await getJiraTokens(ctx.db, input.organizationId);

      if (!tokens) {
        return [];
      }

      try {
        return await getJiraPriorities(tokens.accessToken, tokens.cloudId);
      } catch (error) {
        console.error("Failed to fetch Jira priorities:", error);
        return [];
      }
    }),

  /**
   * Get Jira statuses
   */
  getJiraStatuses: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tokens = await getJiraTokens(ctx.db, input.organizationId);

      if (!tokens) {
        return [];
      }

      try {
        return await getJiraStatuses(tokens.accessToken, tokens.cloudId);
      } catch (error) {
        console.error("Failed to fetch Jira statuses:", error);
        return [];
      }
    }),

  /**
   * Update Jira mapping configuration
   */
  updateJiraMapping: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        projectKey: z.string(),
        issueType: z.string(),
        fieldMapping: z.object({
          severityToPriority: z.record(z.string(), z.string()),
          statusToStatus: z.record(z.string(), z.string()),
          priorityToSeverity: z.record(z.string(), z.string()),
          statusFromJira: z.record(z.string(), z.string()),
        }),
        syncDirection: z.enum(["push", "pull", "both"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can configure integrations",
        });
      }

      const integration = await ctx.db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "JIRA",
          },
        },
      });

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jira integration not found",
        });
      }

      const currentConfig = (integration.config as Record<string, unknown>) || {};

      await ctx.db.integration.update({
        where: { id: integration.id },
        data: {
          config: {
            ...currentConfig,
            projectKey: input.projectKey,
            issueType: input.issueType,
            fieldMapping: input.fieldMapping as Record<string, Record<string, string>>,
            syncDirection: input.syncDirection,
          } as Prisma.InputJsonValue,
        },
      });

      return { success: true };
    }),

  /**
   * Sync bug to Jira
   */
  syncBugToJira: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        bugId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tokens = await getJiraTokens(ctx.db, input.organizationId);

      if (!tokens) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jira integration not connected",
        });
      }

      // Get bug details
      const bug = await ctx.db.bug.findUnique({
        where: { id: input.bugId },
        include: {
          project: true,
          assignee: true,
          creator: true,
        },
      });

      if (!bug) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bug not found",
        });
      }

      // Get integration config
      const integration = await ctx.db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "JIRA",
          },
        },
      });

      const config = integration?.config as {
        projectKey?: string;
        issueType?: string;
        fieldMapping?: JiraFieldMapping;
      } | null;

      if (!config?.projectKey || !config?.issueType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Jira project and issue type must be configured",
        });
      }

      // Map severity to priority
      const priorityId = config.fieldMapping?.severityToPriority?.[bug.severity];

      // Check if bug already synced
      const externalId = (bug.externalIds as Record<string, string> | null)?.jira;

      if (externalId) {
        // Update existing issue
        const statusId = config.fieldMapping?.statusToStatus?.[bug.status];

        await updateJiraIssue(tokens.accessToken, tokens.cloudId, externalId, {
          summary: bug.title,
          description: bug.description || undefined,
          priority: priorityId,
          status: statusId,
        });

        return {
          success: true,
          action: "updated",
          issueKey: externalId,
        };
      } else {
        // Create new issue
        const issue = await createJiraIssue(
          tokens.accessToken,
          tokens.cloudId,
          {
            projectKey: config.projectKey,
            issueType: config.issueType,
            summary: bug.title,
            description: bug.description || undefined,
            priority: priorityId,
            labels: ["buglens"],
          }
        );

        // Store Jira issue key in bug
        const existingExternalIds = (bug.externalIds as Record<string, string>) || {};
        await ctx.db.bug.update({
          where: { id: bug.id },
          data: {
            externalIds: {
              ...existingExternalIds,
              jira: issue.key,
            },
          },
        });

        return {
          success: true,
          action: "created",
          issueKey: issue.key,
        };
      }
    }),

  /**
   * Import issue from Jira
   */
  importFromJira: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        projectId: z.string(),
        issueKey: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tokens = await getJiraTokens(ctx.db, input.organizationId);

      if (!tokens) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jira integration not connected",
        });
      }

      // Get integration config
      const integration = await ctx.db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "JIRA",
          },
        },
      });

      const config = integration?.config as {
        fieldMapping?: JiraFieldMapping;
      } | null;

      // Get Jira issue
      const issue = await getJiraIssue(
        tokens.accessToken,
        tokens.cloudId,
        input.issueKey
      );

      // Map priority to severity
      const severity =
        config?.fieldMapping?.priorityToSeverity?.[issue.fields.priority?.id || ""] ||
        "MEDIUM";

      // Map status
      const status =
        config?.fieldMapping?.statusFromJira?.[issue.fields.status.id] ||
        "OPEN";

      // Check if bug already exists
      const existingBug = await ctx.db.bug.findFirst({
        where: {
          externalIds: {
            path: ["jira"],
            equals: issue.key,
          },
        },
      });

      if (existingBug) {
        // Update existing bug
        await ctx.db.bug.update({
          where: { id: existingBug.id },
          data: {
            title: issue.fields.summary,
            description: issue.fields.description ?? "",
            severity: severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            status: status as "OPEN" | "IN_PROGRESS" | "IN_REVIEW" | "RESOLVED" | "CLOSED" | "REOPENED" | "WONT_FIX",
          },
        });

        return {
          success: true,
          action: "updated",
          bugId: existingBug.id,
        };
      } else {
        // Create new bug
        const bug = await ctx.db.bug.create({
          data: {
            projectId: input.projectId,
            title: issue.fields.summary,
            description: issue.fields.description ?? "",
            severity: severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            status: status as "OPEN" | "IN_PROGRESS" | "IN_REVIEW" | "RESOLVED" | "CLOSED" | "REOPENED" | "WONT_FIX",
            creatorId: ctx.session.user.id,
            externalIds: {
              jira: issue.key,
            },
          },
        });

        return {
          success: true,
          action: "created",
          bugId: bug.id,
        };
      }
    }),

  /**
   * Search Jira issues
   */
  searchJiraIssues: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        query: z.string().optional(),
        projectKey: z.string().optional(),
        maxResults: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const tokens = await getJiraTokens(ctx.db, input.organizationId);

      if (!tokens) {
        return { issues: [], total: 0 };
      }

      // Build JQL query
      const jqlParts: string[] = [];
      if (input.projectKey) {
        jqlParts.push(`project = "${input.projectKey}"`);
      }
      if (input.query) {
        jqlParts.push(`(summary ~ "${input.query}" OR description ~ "${input.query}")`);
      }

      const jql = jqlParts.length > 0 ? jqlParts.join(" AND ") : "order by created DESC";

      try {
        return await searchJiraIssues(tokens.accessToken, tokens.cloudId, jql, {
          maxResults: input.maxResults,
        });
      } catch (error) {
        console.error("Failed to search Jira issues:", error);
        return { issues: [], total: 0 };
      }
    }),

  /**
   * Add comment to Jira issue
   */
  addJiraComment: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        issueKey: z.string(),
        body: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tokens = await getJiraTokens(ctx.db, input.organizationId);

      if (!tokens) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jira integration not connected",
        });
      }

      const comment = await addJiraComment(
        tokens.accessToken,
        tokens.cloudId,
        input.issueKey,
        input.body
      );

      return { success: true, commentId: comment.id };
    }),

  // ===================================
  // TRELLO INTEGRATION
  // ===================================

  /**
   * Get Trello auth URL
   */
  getTrelloAuthUrl: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
      })
    )
    .mutation(({ input }) => {
      const url = getTrelloAuthUrl(input.orgSlug);
      return { url };
    }),

  /**
   * Connect Trello with token
   */
  connectTrello: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        token: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can configure integrations",
        });
      }

      // Validate token
      const validation = await validateTrelloToken(input.token);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid Trello token",
        });
      }

      // Upsert integration
      await ctx.db.integration.upsert({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "TRELLO",
          },
        },
        update: {
          accessToken: input.token,
          config: {
            memberName: validation.member?.fullName,
            memberUsername: validation.member?.username,
          },
          isActive: true,
        },
        create: {
          organizationId: input.organizationId,
          type: "TRELLO",
          accessToken: input.token,
          config: {
            memberName: validation.member?.fullName,
            memberUsername: validation.member?.username,
          },
          isActive: true,
        },
      });

      return { success: true, member: validation.member };
    }),

  /**
   * Disconnect Trello
   */
  disconnectTrello: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can configure integrations",
        });
      }

      await ctx.db.integration.deleteMany({
        where: {
          organizationId: input.organizationId,
          type: "TRELLO",
        },
      });

      return { success: true };
    }),

  /**
   * Test Trello connection
   */
  testTrelloConnection: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const trello = await getTrelloToken(ctx.db, input.organizationId);

      if (!trello) {
        return { ok: false, error: "Trello not connected" };
      }

      return await testTrelloConnection(trello.accessToken);
    }),

  /**
   * Get Trello config
   */
  getTrelloConfig: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const integration = await ctx.db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "TRELLO",
          },
        },
      });

      if (!integration) {
        return null;
      }

      const config = integration.config as {
        memberName?: string;
        memberUsername?: string;
        boardId?: string;
        listMapping?: Record<string, string>;
      } | null;

      return {
        isConnected: !!integration.accessToken,
        isActive: integration.isActive,
        memberName: config?.memberName,
        memberUsername: config?.memberUsername,
        boardId: config?.boardId,
        listMapping: config?.listMapping,
      };
    }),

  /**
   * Get Trello boards
   */
  getTrelloBoards: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const trello = await getTrelloToken(ctx.db, input.organizationId);

      if (!trello) {
        return [];
      }

      try {
        return await getTrelloBoards(trello.accessToken);
      } catch (error) {
        console.error("Failed to fetch Trello boards:", error);
        return [];
      }
    }),

  /**
   * Get Trello lists for a board
   */
  getTrelloLists: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        boardId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const trello = await getTrelloToken(ctx.db, input.organizationId);

      if (!trello) {
        return [];
      }

      try {
        return await getTrelloLists(trello.accessToken, input.boardId);
      } catch (error) {
        console.error("Failed to fetch Trello lists:", error);
        return [];
      }
    }),

  /**
   * Update Trello mapping
   */
  updateTrelloMapping: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        boardId: z.string(),
        listMapping: z.record(z.string(), z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can configure integrations",
        });
      }

      const integration = await ctx.db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "TRELLO",
          },
        },
      });

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trello integration not found",
        });
      }

      const currentConfig = (integration.config as Record<string, unknown>) || {};

      await ctx.db.integration.update({
        where: { id: integration.id },
        data: {
          config: {
            ...currentConfig,
            boardId: input.boardId,
            listMapping: input.listMapping as Record<string, string>,
          } as Prisma.InputJsonValue,
        },
      });

      return { success: true };
    }),

  /**
   * Sync bug to Trello
   */
  syncBugToTrello: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        bugId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const trello = await getTrelloToken(ctx.db, input.organizationId);

      if (!trello?.accessToken || !trello.boardId || !trello.listMapping) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trello integration not fully configured",
        });
      }

      // Get bug details
      const bug = await ctx.db.bug.findUnique({
        where: { id: input.bugId },
        include: {
          project: true,
        },
      });

      if (!bug) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bug not found",
        });
      }

      // Get target list ID based on bug status
      const listId = trello.listMapping[bug.status];
      if (!listId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No Trello list mapped for status: ${bug.status}`,
        });
      }

      // Check if bug already synced
      const externalId = (bug.externalIds as Record<string, string> | null)?.trello;

      if (externalId) {
        // Update existing card
        await updateTrelloCard(trello.accessToken, externalId, {
          name: bug.title,
          desc: bug.description || undefined,
          idList: listId,
        });

        return {
          success: true,
          action: "updated",
          cardId: externalId,
        };
      } else {
        // Create new card
        const card = await createTrelloCard(trello.accessToken, {
          name: bug.title,
          desc: bug.description || undefined,
          idList: listId,
        });

        // Store Trello card ID in bug
        const existingExternalIds = (bug.externalIds as Record<string, string>) || {};
        await ctx.db.bug.update({
          where: { id: bug.id },
          data: {
            externalIds: {
              ...existingExternalIds,
              trello: card.id,
            },
          },
        });

        return {
          success: true,
          action: "created",
          cardId: card.id,
          cardUrl: card.shortUrl,
        };
      }
    }),

  /**
   * Import card from Trello
   */
  importFromTrello: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        projectId: z.string(),
        cardId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const trello = await getTrelloToken(ctx.db, input.organizationId);

      if (!trello) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trello integration not connected",
        });
      }

      // Get Trello card
      const card = await getTrelloCard(trello.accessToken, input.cardId);

      // Determine status based on reverse list mapping
      const reverseMapping: Record<string, string> = {};
      if (trello.listMapping) {
        for (const [status, listId] of Object.entries(trello.listMapping)) {
          reverseMapping[listId] = status;
        }
      }
      const status = reverseMapping[card.idList] || "OPEN";

      // Check if bug already exists
      const existingBug = await ctx.db.bug.findFirst({
        where: {
          externalIds: {
            path: ["trello"],
            equals: card.id,
          },
        },
      });

      if (existingBug) {
        // Update existing bug
        await ctx.db.bug.update({
          where: { id: existingBug.id },
          data: {
            title: card.name,
            description: card.desc ?? "",
            status: status as "OPEN" | "IN_PROGRESS" | "IN_REVIEW" | "RESOLVED" | "CLOSED" | "REOPENED" | "WONT_FIX",
          },
        });

        return {
          success: true,
          action: "updated",
          bugId: existingBug.id,
        };
      } else {
        // Create new bug
        const bug = await ctx.db.bug.create({
          data: {
            projectId: input.projectId,
            title: card.name,
            description: card.desc ?? "",
            severity: "MEDIUM",
            status: status as "OPEN" | "IN_PROGRESS" | "IN_REVIEW" | "RESOLVED" | "CLOSED" | "REOPENED" | "WONT_FIX",
            creatorId: ctx.session.user.id,
            externalIds: {
              trello: card.id,
            },
          },
        });

        return {
          success: true,
          action: "created",
          bugId: bug.id,
        };
      }
    }),

  // ===================================
  // AZURE DEVOPS INTEGRATION
  // ===================================

  /**
   * Get Azure DevOps OAuth URL
   */
  getAzureDevOpsOAuthUrl: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
      })
    )
    .mutation(({ input }) => {
      const url = getAzureDevOpsOAuthUrl(input.orgSlug);
      return { url };
    }),

  /**
   * Disconnect Azure DevOps
   */
  disconnectAzureDevOps: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can configure integrations",
        });
      }

      await ctx.db.integration.deleteMany({
        where: {
          organizationId: input.organizationId,
          type: "AZURE_DEVOPS",
        },
      });

      return { success: true };
    }),

  /**
   * Test Azure DevOps connection
   */
  testAzureDevOpsConnection: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const azure = await getAzureDevOpsTokens(ctx.db, input.organizationId);

      if (!azure) {
        return { ok: false, error: "Azure DevOps not connected" };
      }

      return await testAzureDevOpsConnection(azure.accessToken);
    }),

  /**
   * Get Azure DevOps config
   */
  getAzureDevOpsConfig: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const integration = await ctx.db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "AZURE_DEVOPS",
          },
        },
      });

      if (!integration) {
        return null;
      }

      const config = integration.config as {
        organization?: string;
        project?: string;
        workItemType?: string;
        stateMapping?: Record<string, string>;
        severityMapping?: Record<string, number>;
      } | null;

      return {
        isConnected: !!integration.accessToken,
        isActive: integration.isActive,
        organization: config?.organization,
        project: config?.project,
        workItemType: config?.workItemType,
        stateMapping: config?.stateMapping,
        severityMapping: config?.severityMapping,
      };
    }),

  /**
   * Get Azure DevOps organizations
   */
  getAzureDevOpsOrganizations: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const azure = await getAzureDevOpsTokens(ctx.db, input.organizationId);

      if (!azure) {
        return [];
      }

      try {
        return await getAzureDevOpsOrganizations(azure.accessToken);
      } catch (error) {
        console.error("Failed to fetch Azure DevOps organizations:", error);
        return [];
      }
    }),

  /**
   * Get Azure DevOps projects
   */
  getAzureDevOpsProjects: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        azureOrganization: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const azure = await getAzureDevOpsTokens(ctx.db, input.organizationId);

      if (!azure) {
        return [];
      }

      try {
        return await getAzureDevOpsProjects(azure.accessToken, input.azureOrganization);
      } catch (error) {
        console.error("Failed to fetch Azure DevOps projects:", error);
        return [];
      }
    }),

  /**
   * Get Azure DevOps work item types
   */
  getAzureDevOpsWorkItemTypes: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        azureOrganization: z.string(),
        azureProject: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const azure = await getAzureDevOpsTokens(ctx.db, input.organizationId);

      if (!azure) {
        return [];
      }

      try {
        return await getAzureDevOpsWorkItemTypes(
          azure.accessToken,
          input.azureOrganization,
          input.azureProject
        );
      } catch (error) {
        console.error("Failed to fetch Azure DevOps work item types:", error);
        return [];
      }
    }),

  /**
   * Get Azure DevOps states for a work item type
   */
  getAzureDevOpsStates: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        azureOrganization: z.string(),
        azureProject: z.string(),
        workItemType: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const azure = await getAzureDevOpsTokens(ctx.db, input.organizationId);

      if (!azure) {
        return [];
      }

      try {
        return await getAzureDevOpsStates(
          azure.accessToken,
          input.azureOrganization,
          input.azureProject,
          input.workItemType
        );
      } catch (error) {
        console.error("Failed to fetch Azure DevOps states:", error);
        return [];
      }
    }),

  /**
   * Update Azure DevOps mapping
   */
  updateAzureDevOpsMapping: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        azureOrganization: z.string(),
        azureProject: z.string(),
        workItemType: z.string(),
        stateMapping: z.record(z.string(), z.string()),
        severityMapping: z.record(z.string(), z.number()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const member = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can configure integrations",
        });
      }

      const integration = await ctx.db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "AZURE_DEVOPS",
          },
        },
      });

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Azure DevOps integration not found",
        });
      }

      const currentConfig = (integration.config as Record<string, unknown>) || {};

      await ctx.db.integration.update({
        where: { id: integration.id },
        data: {
          config: {
            ...currentConfig,
            organization: input.azureOrganization,
            project: input.azureProject,
            workItemType: input.workItemType,
            stateMapping: input.stateMapping as Record<string, string>,
            severityMapping: input.severityMapping as Record<string, number>,
          } as Prisma.InputJsonValue,
        },
      });

      return { success: true };
    }),

  /**
   * Sync bug to Azure DevOps
   */
  syncBugToAzureDevOps: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        bugId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const azure = await getAzureDevOpsTokens(ctx.db, input.organizationId);

      if (!azure?.accessToken || !azure.organization || !azure.project || !azure.workItemType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Azure DevOps integration not fully configured",
        });
      }

      // Get integration config for mappings
      const integration = await ctx.db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "AZURE_DEVOPS",
          },
        },
      });

      const config = integration?.config as {
        stateMapping?: Record<string, string>;
        severityMapping?: Record<string, number>;
      } | null;

      // Get bug details
      const bug = await ctx.db.bug.findUnique({
        where: { id: input.bugId },
        include: {
          project: true,
        },
      });

      if (!bug) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bug not found",
        });
      }

      // Map severity to priority (1-4 in Azure DevOps)
      const priority = config?.severityMapping?.[bug.severity] || 2;

      // Check if bug already synced
      const externalId = (bug.externalIds as Record<string, string> | null)?.azureDevOps;

      if (externalId) {
        // Update existing work item
        const state = config?.stateMapping?.[bug.status];

        await updateAzureDevOpsWorkItem(
          azure.accessToken,
          azure.organization,
          parseInt(externalId),
          {
            title: bug.title,
            description: bug.description || undefined,
            priority,
            state,
          }
        );

        return {
          success: true,
          action: "updated",
          workItemId: parseInt(externalId),
        };
      } else {
        // Create new work item
        const workItem = await createAzureDevOpsWorkItem(
          azure.accessToken,
          azure.organization,
          azure.project,
          azure.workItemType,
          {
            title: bug.title,
            description: bug.description || undefined,
            priority,
          }
        );

        // Store Azure DevOps work item ID in bug
        const existingExternalIds = (bug.externalIds as Record<string, string>) || {};
        await ctx.db.bug.update({
          where: { id: bug.id },
          data: {
            externalIds: {
              ...existingExternalIds,
              azureDevOps: String(workItem.id),
            },
          },
        });

        return {
          success: true,
          action: "created",
          workItemId: workItem.id,
          workItemUrl: workItem._links?.html?.href,
        };
      }
    }),

  /**
   * Import work item from Azure DevOps
   */
  importFromAzureDevOps: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        projectId: z.string(),
        workItemId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const azure = await getAzureDevOpsTokens(ctx.db, input.organizationId);

      if (!azure?.accessToken || !azure.organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Azure DevOps integration not connected",
        });
      }

      // Get integration config for reverse mappings
      const integration = await ctx.db.integration.findUnique({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: "AZURE_DEVOPS",
          },
        },
      });

      const config = integration?.config as {
        stateMapping?: Record<string, string>;
        severityMapping?: Record<string, number>;
      } | null;

      // Get work item
      const workItem = await getAzureDevOpsWorkItem(
        azure.accessToken,
        azure.organization,
        input.workItemId
      );

      // Reverse map state to status
      const reverseStateMapping: Record<string, string> = {};
      if (config?.stateMapping) {
        for (const [status, state] of Object.entries(config.stateMapping)) {
          reverseStateMapping[state] = status;
        }
      }
      const status = reverseStateMapping[workItem.fields["System.State"]] || "OPEN";

      // Reverse map priority to severity
      const reverseSeverityMapping: Record<number, string> = {};
      if (config?.severityMapping) {
        for (const [sev, pri] of Object.entries(config.severityMapping)) {
          reverseSeverityMapping[pri] = sev;
        }
      }
      const priority = workItem.fields["Microsoft.VSTS.Common.Priority"] || 2;
      const severity = reverseSeverityMapping[priority] || "MEDIUM";

      // Check if bug already exists
      const existingBug = await ctx.db.bug.findFirst({
        where: {
          externalIds: {
            path: ["azureDevOps"],
            equals: String(workItem.id),
          },
        },
      });

      if (existingBug) {
        // Update existing bug
        await ctx.db.bug.update({
          where: { id: existingBug.id },
          data: {
            title: workItem.fields["System.Title"],
            description: (workItem.fields["System.Description"] as string | undefined) ?? "",
            severity: severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            status: status as "OPEN" | "IN_PROGRESS" | "IN_REVIEW" | "RESOLVED" | "CLOSED" | "REOPENED" | "WONT_FIX",
          },
        });

        return {
          success: true,
          action: "updated",
          bugId: existingBug.id,
        };
      } else {
        // Create new bug
        const bug = await ctx.db.bug.create({
          data: {
            projectId: input.projectId,
            title: workItem.fields["System.Title"],
            description: (workItem.fields["System.Description"] as string | undefined) ?? "",
            severity: severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            status: status as "OPEN" | "IN_PROGRESS" | "IN_REVIEW" | "RESOLVED" | "CLOSED" | "REOPENED" | "WONT_FIX",
            creatorId: ctx.session.user.id,
            externalIds: {
              azureDevOps: String(workItem.id),
            },
          },
        });

        return {
          success: true,
          action: "created",
          bugId: bug.id,
        };
      }
    }),
});
