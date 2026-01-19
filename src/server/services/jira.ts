/**
 * Jira Cloud Integration Service
 * Implements OAuth 2.0 (3LO) flow and Jira REST API methods
 */

import crypto from "crypto";

// Environment variables
const JIRA_CLIENT_ID = process.env.JIRA_CLIENT_ID || "";
const JIRA_CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Jira OAuth endpoints
const JIRA_AUTH_URL = "https://auth.atlassian.com/authorize";
const JIRA_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const JIRA_API_BASE = "https://api.atlassian.com";

// Types
export interface JiraTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  cloudId?: string;
  siteUrl?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrls?: {
    "48x48"?: string;
    "24x24"?: string;
    "16x16"?: string;
    "32x32"?: string;
  };
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  subtask: boolean;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      id: string;
      name: string;
    };
    priority?: {
      id: string;
      name: string;
    };
    issuetype: {
      id: string;
      name: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    reporter?: {
      accountId: string;
      displayName: string;
    };
    created: string;
    updated: string;
  };
}

export interface JiraComment {
  id: string;
  body: string;
  author: {
    accountId: string;
    displayName: string;
  };
  created: string;
  updated: string;
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl?: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    id: number;
    key: string;
    name: string;
  };
}

export interface JiraFieldMapping {
  severityToPriority: Record<string, string>;
  statusToStatus: Record<string, string>;
  priorityToSeverity: Record<string, string>;
  statusFromJira: Record<string, string>;
}

/**
 * Generate OAuth URL for Jira authentication
 */
export function getJiraOAuthUrl(orgSlug: string): string {
  const state = orgSlug;
  const redirectUri = `${APP_URL}/api/integrations/jira/callback`;

  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: JIRA_CLIENT_ID,
    scope: [
      "read:jira-user",
      "read:jira-work",
      "write:jira-work",
      "manage:jira-project",
      "manage:jira-configuration",
      "offline_access",
    ].join(" "),
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    prompt: "consent",
  });

  return `${JIRA_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange OAuth code for tokens
 */
export async function exchangeJiraCode(code: string): Promise<JiraTokens> {
  const redirectUri = `${APP_URL}/api/integrations/jira/callback`;

  const response = await fetch(JIRA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: JIRA_CLIENT_ID,
      client_secret: JIRA_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange Jira code: ${error}`);
  }

  const data = await response.json();

  // Calculate token expiration
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Get cloud ID for the accessible resource
  const cloudInfo = await getAccessibleResources(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    cloudId: cloudInfo.cloudId,
    siteUrl: cloudInfo.siteUrl,
  };
}

/**
 * Refresh access token
 */
export async function refreshJiraToken(refreshToken: string): Promise<JiraTokens> {
  const response = await fetch(JIRA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: JIRA_CLIENT_ID,
      client_secret: JIRA_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Jira token: ${error}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt,
  };
}

/**
 * Get accessible Jira resources (cloud sites)
 */
async function getAccessibleResources(accessToken: string): Promise<{
  cloudId: string;
  siteUrl: string;
}> {
  const response = await fetch(`${JIRA_API_BASE}/oauth/token/accessible-resources`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get accessible Jira resources");
  }

  const resources = await response.json();

  if (!resources || resources.length === 0) {
    throw new Error("No accessible Jira sites found");
  }

  // Return the first accessible resource
  return {
    cloudId: resources[0].id,
    siteUrl: resources[0].url,
  };
}

/**
 * Get Jira API client with auto token refresh
 */
async function jiraFetch(
  accessToken: string,
  cloudId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${JIRA_API_BASE}/ex/jira/${cloudId}/rest/api/3${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  return response;
}

/**
 * Get all projects
 */
export async function getJiraProjects(
  accessToken: string,
  cloudId: string
): Promise<JiraProject[]> {
  const response = await jiraFetch(accessToken, cloudId, "/project");

  if (!response.ok) {
    throw new Error("Failed to fetch Jira projects");
  }

  return response.json();
}

/**
 * Get issue types for a project
 */
export async function getJiraIssueTypes(
  accessToken: string,
  cloudId: string,
  projectKey: string
): Promise<JiraIssueType[]> {
  const response = await jiraFetch(
    accessToken,
    cloudId,
    `/project/${projectKey}/statuses`
  );

  if (!response.ok) {
    // Fall back to global issue types
    const globalResponse = await jiraFetch(accessToken, cloudId, "/issuetype");
    if (!globalResponse.ok) {
      throw new Error("Failed to fetch Jira issue types");
    }
    const types = await globalResponse.json();
    return types.filter((t: JiraIssueType) => !t.subtask);
  }

  const data = await response.json();
  // Extract unique issue types from project statuses
  const issueTypes: JiraIssueType[] = data.map((item: { id: string; name: string; subtask: boolean }) => ({
    id: item.id,
    name: item.name,
    subtask: item.subtask || false,
  }));

  return issueTypes;
}

/**
 * Get available priorities
 */
export async function getJiraPriorities(
  accessToken: string,
  cloudId: string
): Promise<JiraPriority[]> {
  const response = await jiraFetch(accessToken, cloudId, "/priority");

  if (!response.ok) {
    throw new Error("Failed to fetch Jira priorities");
  }

  return response.json();
}

/**
 * Get available statuses
 */
export async function getJiraStatuses(
  accessToken: string,
  cloudId: string
): Promise<JiraStatus[]> {
  const response = await jiraFetch(accessToken, cloudId, "/status");

  if (!response.ok) {
    throw new Error("Failed to fetch Jira statuses");
  }

  return response.json();
}

/**
 * Create a Jira issue
 */
export async function createJiraIssue(
  accessToken: string,
  cloudId: string,
  data: {
    projectKey: string;
    issueType: string;
    summary: string;
    description?: string;
    priority?: string;
    labels?: string[];
    customFields?: Record<string, unknown>;
  }
): Promise<JiraIssue> {
  // Build Atlassian Document Format for description
  const descriptionAdf = data.description
    ? {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: data.description,
              },
            ],
          },
        ],
      }
    : undefined;

  const issueData: Record<string, unknown> = {
    fields: {
      project: { key: data.projectKey },
      issuetype: { id: data.issueType },
      summary: data.summary,
      ...(descriptionAdf && { description: descriptionAdf }),
      ...(data.priority && { priority: { id: data.priority } }),
      ...(data.labels && { labels: data.labels }),
      ...data.customFields,
    },
  };

  const response = await jiraFetch(accessToken, cloudId, "/issue", {
    method: "POST",
    body: JSON.stringify(issueData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create Jira issue: ${JSON.stringify(error)}`);
  }

  const created = await response.json();

  // Fetch the full issue details
  return getJiraIssue(accessToken, cloudId, created.key);
}

/**
 * Update a Jira issue
 */
export async function updateJiraIssue(
  accessToken: string,
  cloudId: string,
  issueKey: string,
  data: {
    summary?: string;
    description?: string;
    priority?: string;
    status?: string;
    customFields?: Record<string, unknown>;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {
    fields: {},
  };

  if (data.summary) {
    (updateData.fields as Record<string, unknown>).summary = data.summary;
  }

  if (data.description) {
    (updateData.fields as Record<string, unknown>).description = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: data.description }],
        },
      ],
    };
  }

  if (data.priority) {
    (updateData.fields as Record<string, unknown>).priority = { id: data.priority };
  }

  if (data.customFields) {
    Object.assign(updateData.fields as Record<string, unknown>, data.customFields);
  }

  const response = await jiraFetch(accessToken, cloudId, `/issue/${issueKey}`, {
    method: "PUT",
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to update Jira issue: ${JSON.stringify(error)}`);
  }

  // Handle status transition separately
  if (data.status) {
    await transitionJiraIssue(accessToken, cloudId, issueKey, data.status);
  }
}

/**
 * Transition issue status
 */
async function transitionJiraIssue(
  accessToken: string,
  cloudId: string,
  issueKey: string,
  statusId: string
): Promise<void> {
  // Get available transitions
  const transitionsResponse = await jiraFetch(
    accessToken,
    cloudId,
    `/issue/${issueKey}/transitions`
  );

  if (!transitionsResponse.ok) {
    throw new Error("Failed to get issue transitions");
  }

  const { transitions } = await transitionsResponse.json();
  const transition = transitions.find(
    (t: { to: { id: string } }) => t.to.id === statusId
  );

  if (!transition) {
    console.warn(`No valid transition found to status ${statusId}`);
    return;
  }

  const response = await jiraFetch(
    accessToken,
    cloudId,
    `/issue/${issueKey}/transitions`,
    {
      method: "POST",
      body: JSON.stringify({ transition: { id: transition.id } }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to transition issue: ${JSON.stringify(error)}`);
  }
}

/**
 * Get a single Jira issue
 */
export async function getJiraIssue(
  accessToken: string,
  cloudId: string,
  issueKey: string
): Promise<JiraIssue> {
  const response = await jiraFetch(
    accessToken,
    cloudId,
    `/issue/${issueKey}?expand=transitions`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Jira issue ${issueKey}`);
  }

  return response.json();
}

/**
 * Add a comment to an issue
 */
export async function addJiraComment(
  accessToken: string,
  cloudId: string,
  issueKey: string,
  body: string
): Promise<JiraComment> {
  const commentData = {
    body: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: body }],
        },
      ],
    },
  };

  const response = await jiraFetch(
    accessToken,
    cloudId,
    `/issue/${issueKey}/comment`,
    {
      method: "POST",
      body: JSON.stringify(commentData),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to add comment: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Get comments for an issue
 */
export async function getJiraComments(
  accessToken: string,
  cloudId: string,
  issueKey: string
): Promise<JiraComment[]> {
  const response = await jiraFetch(
    accessToken,
    cloudId,
    `/issue/${issueKey}/comment`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch comments");
  }

  const data = await response.json();
  return data.comments || [];
}

/**
 * Search for issues using JQL
 */
export async function searchJiraIssues(
  accessToken: string,
  cloudId: string,
  jql: string,
  options: {
    startAt?: number;
    maxResults?: number;
    fields?: string[];
  } = {}
): Promise<{ issues: JiraIssue[]; total: number }> {
  const params = new URLSearchParams({
    jql,
    startAt: String(options.startAt || 0),
    maxResults: String(options.maxResults || 50),
    ...(options.fields && { fields: options.fields.join(",") }),
  });

  const response = await jiraFetch(
    accessToken,
    cloudId,
    `/search?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to search Jira issues");
  }

  const data = await response.json();
  return {
    issues: data.issues || [],
    total: data.total || 0,
  };
}

/**
 * Test Jira connection
 */
export async function testJiraConnection(
  accessToken: string,
  cloudId: string
): Promise<{ ok: boolean; user?: string; error?: string }> {
  try {
    const response = await jiraFetch(accessToken, cloudId, "/myself");

    if (!response.ok) {
      return { ok: false, error: "Connection test failed" };
    }

    const user = await response.json();
    return { ok: true, user: user.displayName };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Verify Jira webhook signature
 */
export function verifyJiraWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Parse Jira webhook payload
 */
export interface JiraWebhookPayload {
  webhookEvent: string;
  issue?: JiraIssue;
  comment?: JiraComment;
  changelog?: {
    items: Array<{
      field: string;
      fromString: string;
      toString: string;
    }>;
  };
  user: {
    accountId: string;
    displayName: string;
  };
}

export function parseJiraWebhook(body: unknown): JiraWebhookPayload {
  return body as JiraWebhookPayload;
}
