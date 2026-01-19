/**
 * Azure DevOps Integration Service
 * Implements OAuth 2.0 flow and Azure DevOps REST API
 */

// Environment variables
const AZURE_DEVOPS_CLIENT_ID = process.env.AZURE_DEVOPS_CLIENT_ID || "";
const AZURE_DEVOPS_CLIENT_SECRET = process.env.AZURE_DEVOPS_CLIENT_SECRET || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Azure DevOps OAuth endpoints
const AZURE_AUTH_URL = "https://app.vssps.visualstudio.com/oauth2/authorize";
const AZURE_TOKEN_URL = "https://app.vssps.visualstudio.com/oauth2/token";

// Types
export interface AzureDevOpsTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface AzureDevOpsOrganization {
  accountId: string;
  accountName: string;
  accountUri: string;
}

export interface AzureDevOpsProject {
  id: string;
  name: string;
  description?: string;
  url: string;
  state: string;
}

export interface AzureDevOpsWorkItemType {
  name: string;
  referenceName: string;
  description?: string;
  color?: string;
  icon?: {
    url: string;
  };
}

export interface AzureDevOpsWorkItem {
  id: number;
  url: string;
  rev: number;
  fields: {
    "System.Title": string;
    "System.Description"?: string;
    "System.State": string;
    "System.WorkItemType": string;
    "Microsoft.VSTS.Common.Priority"?: number;
    "Microsoft.VSTS.Common.Severity"?: string;
    "System.AssignedTo"?: {
      displayName: string;
      uniqueName: string;
    };
    "System.CreatedDate": string;
    "System.ChangedDate": string;
  };
  _links?: {
    html?: { href: string };
  };
}

export interface AzureDevOpsArea {
  id: number;
  name: string;
  path: string;
  hasChildren: boolean;
}

export interface AzureDevOpsIteration {
  id: string;
  name: string;
  path: string;
  attributes?: {
    startDate?: string;
    finishDate?: string;
  };
}

/**
 * Generate OAuth URL for Azure DevOps authentication
 */
export function getAzureDevOpsOAuthUrl(orgSlug: string): string {
  const redirectUri = `${APP_URL}/api/integrations/azure-devops/callback`;
  const state = orgSlug;

  const params = new URLSearchParams({
    client_id: AZURE_DEVOPS_CLIENT_ID,
    response_type: "Assertion",
    state,
    scope: "vso.work_write vso.project",
    redirect_uri: redirectUri,
  });

  return `${AZURE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange OAuth code for tokens
 */
export async function exchangeAzureDevOpsCode(code: string): Promise<AzureDevOpsTokens> {
  const redirectUri = `${APP_URL}/api/integrations/azure-devops/callback`;

  const body = new URLSearchParams({
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: AZURE_DEVOPS_CLIENT_SECRET,
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(AZURE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange Azure DevOps code: ${error}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

/**
 * Refresh access token
 */
export async function refreshAzureDevOpsToken(
  refreshToken: string
): Promise<AzureDevOpsTokens> {
  const redirectUri = `${APP_URL}/api/integrations/azure-devops/callback`;

  const body = new URLSearchParams({
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: AZURE_DEVOPS_CLIENT_SECRET,
    grant_type: "refresh_token",
    assertion: refreshToken,
    redirect_uri: redirectUri,
  });

  const response = await fetch(AZURE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Azure DevOps token: ${error}`);
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
 * Get user's Azure DevOps organizations
 */
export async function getAzureDevOpsOrganizations(
  accessToken: string
): Promise<AzureDevOpsOrganization[]> {
  // First get the user's profile to get memberId
  const profileResponse = await fetch(
    "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=6.0",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!profileResponse.ok) {
    throw new Error("Failed to fetch user profile");
  }

  const profile = await profileResponse.json();
  const memberId = profile.id;

  // Get organizations
  const orgsResponse = await fetch(
    `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${memberId}&api-version=6.0`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!orgsResponse.ok) {
    throw new Error("Failed to fetch organizations");
  }

  const data = await orgsResponse.json();
  return data.value || [];
}

/**
 * Helper to make Azure DevOps API requests
 */
async function azureFetch(
  organization: string,
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = `https://dev.azure.com/${organization}`;
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${baseUrl}${endpoint}${separator}api-version=7.0`;

  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/**
 * Get projects in an organization
 */
export async function getAzureDevOpsProjects(
  accessToken: string,
  organization: string
): Promise<AzureDevOpsProject[]> {
  const response = await azureFetch(organization, "/_apis/projects", accessToken);

  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }

  const data = await response.json();
  return data.value || [];
}

/**
 * Get work item types for a project
 */
export async function getAzureDevOpsWorkItemTypes(
  accessToken: string,
  organization: string,
  project: string
): Promise<AzureDevOpsWorkItemType[]> {
  const response = await azureFetch(
    organization,
    `/${project}/_apis/wit/workitemtypes`,
    accessToken
  );

  if (!response.ok) {
    throw new Error("Failed to fetch work item types");
  }

  const data = await response.json();
  return data.value || [];
}

/**
 * Create a work item
 */
export async function createAzureDevOpsWorkItem(
  accessToken: string,
  organization: string,
  project: string,
  workItemType: string,
  data: {
    title: string;
    description?: string;
    priority?: number;
    severity?: string;
    areaPath?: string;
    iterationPath?: string;
  }
): Promise<AzureDevOpsWorkItem> {
  const operations: Array<{
    op: string;
    path: string;
    value: unknown;
  }> = [
    {
      op: "add",
      path: "/fields/System.Title",
      value: data.title,
    },
  ];

  if (data.description) {
    operations.push({
      op: "add",
      path: "/fields/System.Description",
      value: data.description,
    });
  }

  if (data.priority !== undefined) {
    operations.push({
      op: "add",
      path: "/fields/Microsoft.VSTS.Common.Priority",
      value: data.priority,
    });
  }

  if (data.severity) {
    operations.push({
      op: "add",
      path: "/fields/Microsoft.VSTS.Common.Severity",
      value: data.severity,
    });
  }

  if (data.areaPath) {
    operations.push({
      op: "add",
      path: "/fields/System.AreaPath",
      value: data.areaPath,
    });
  }

  if (data.iterationPath) {
    operations.push({
      op: "add",
      path: "/fields/System.IterationPath",
      value: data.iterationPath,
    });
  }

  const response = await fetch(
    `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems/$${workItemType}?api-version=7.0`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json-patch+json",
      },
      body: JSON.stringify(operations),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create work item: ${error}`);
  }

  return response.json();
}

/**
 * Update a work item
 */
export async function updateAzureDevOpsWorkItem(
  accessToken: string,
  organization: string,
  workItemId: number,
  data: {
    title?: string;
    description?: string;
    state?: string;
    priority?: number;
    severity?: string;
  }
): Promise<AzureDevOpsWorkItem> {
  const operations: Array<{
    op: string;
    path: string;
    value: unknown;
  }> = [];

  if (data.title) {
    operations.push({
      op: "replace",
      path: "/fields/System.Title",
      value: data.title,
    });
  }

  if (data.description !== undefined) {
    operations.push({
      op: "replace",
      path: "/fields/System.Description",
      value: data.description,
    });
  }

  if (data.state) {
    operations.push({
      op: "replace",
      path: "/fields/System.State",
      value: data.state,
    });
  }

  if (data.priority !== undefined) {
    operations.push({
      op: "replace",
      path: "/fields/Microsoft.VSTS.Common.Priority",
      value: data.priority,
    });
  }

  if (data.severity) {
    operations.push({
      op: "replace",
      path: "/fields/Microsoft.VSTS.Common.Severity",
      value: data.severity,
    });
  }

  if (operations.length === 0) {
    throw new Error("No fields to update");
  }

  const response = await fetch(
    `https://dev.azure.com/${organization}/_apis/wit/workitems/${workItemId}?api-version=7.0`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json-patch+json",
      },
      body: JSON.stringify(operations),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update work item: ${error}`);
  }

  return response.json();
}

/**
 * Get a work item by ID
 */
export async function getAzureDevOpsWorkItem(
  accessToken: string,
  organization: string,
  workItemId: number
): Promise<AzureDevOpsWorkItem> {
  const response = await azureFetch(
    organization,
    `/_apis/wit/workitems/${workItemId}?$expand=all`,
    accessToken
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch work item ${workItemId}`);
  }

  return response.json();
}

/**
 * Query work items using WIQL
 */
export async function queryAzureDevOpsWorkItems(
  accessToken: string,
  organization: string,
  project: string,
  wiql: string
): Promise<AzureDevOpsWorkItem[]> {
  // First run the query to get IDs
  const queryResponse = await fetch(
    `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql?api-version=7.0`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: wiql }),
    }
  );

  if (!queryResponse.ok) {
    throw new Error("Failed to query work items");
  }

  const queryResult = await queryResponse.json();
  const workItemIds = queryResult.workItems?.map((wi: { id: number }) => wi.id) || [];

  if (workItemIds.length === 0) {
    return [];
  }

  // Fetch the actual work items
  const ids = workItemIds.slice(0, 200).join(",");
  const itemsResponse = await azureFetch(
    organization,
    `/_apis/wit/workitems?ids=${ids}&$expand=all`,
    accessToken
  );

  if (!itemsResponse.ok) {
    throw new Error("Failed to fetch work items");
  }

  const itemsResult = await itemsResponse.json();
  return itemsResult.value || [];
}

/**
 * Add comment to a work item
 */
export async function addAzureDevOpsComment(
  accessToken: string,
  organization: string,
  project: string,
  workItemId: number,
  text: string
): Promise<{ id: number; text: string }> {
  const response = await fetch(
    `https://dev.azure.com/${organization}/${project}/_apis/wit/workItems/${workItemId}/comments?api-version=7.0-preview.3`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to add comment");
  }

  return response.json();
}

/**
 * Get available states for a work item type
 */
export async function getAzureDevOpsStates(
  accessToken: string,
  organization: string,
  project: string,
  workItemType: string
): Promise<Array<{ name: string; color?: string }>> {
  const response = await azureFetch(
    organization,
    `/${project}/_apis/wit/workitemtypes/${workItemType}/states`,
    accessToken
  );

  if (!response.ok) {
    throw new Error("Failed to fetch states");
  }

  const data = await response.json();
  return data.value || [];
}

/**
 * Test Azure DevOps connection
 */
export async function testAzureDevOpsConnection(
  accessToken: string
): Promise<{ ok: boolean; user?: string; error?: string }> {
  try {
    const response = await fetch(
      "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=6.0",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return { ok: false, error: "Connection test failed" };
    }

    const profile = await response.json();
    return { ok: true, user: profile.displayName };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Verify Azure DevOps webhook signature
 * Azure DevOps uses Basic auth for service hooks
 */
export function verifyAzureDevOpsWebhook(
  username: string,
  password: string,
  expectedUsername: string,
  expectedPassword: string
): boolean {
  return username === expectedUsername && password === expectedPassword;
}

/**
 * Parse Azure DevOps webhook payload
 */
export interface AzureDevOpsWebhookPayload {
  subscriptionId: string;
  notificationId: number;
  eventType: string;
  publisherId: string;
  resource: {
    id: number;
    workItemId?: number;
    rev?: number;
    fields?: Record<string, unknown>;
    revision?: {
      fields: Record<string, unknown>;
    };
  };
  resourceVersion: string;
  detailedMessage?: {
    text: string;
  };
}

export function parseAzureDevOpsWebhook(body: unknown): AzureDevOpsWebhookPayload {
  return body as AzureDevOpsWebhookPayload;
}
