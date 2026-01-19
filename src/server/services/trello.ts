/**
 * Trello Integration Service
 * Uses Trello Power-Up authorization flow (simpler than OAuth 1.0a)
 */

import crypto from "crypto";

// Environment variables
const TRELLO_API_KEY = process.env.TRELLO_API_KEY || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Trello API base URL
const TRELLO_API_BASE = "https://api.trello.com/1";

// Types
export interface TrelloBoard {
  id: string;
  name: string;
  desc?: string;
  url: string;
  closed: boolean;
  prefs?: {
    backgroundColor?: string;
  };
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  idBoard: string;
  pos: number;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  url: string;
  shortUrl: string;
  idList: string;
  idBoard: string;
  closed: boolean;
  labels: TrelloLabel[];
  due?: string;
  pos: number;
}

export interface TrelloLabel {
  id: string;
  idBoard: string;
  name: string;
  color: string;
}

export interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
}

export interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  bytes?: number;
  mimeType?: string;
}

/**
 * Generate Trello authorization URL
 * Uses the Power-Up authorization flow
 */
export function getTrelloAuthUrl(orgSlug: string): string {
  const returnUrl = `${APP_URL}/api/integrations/trello/callback`;
  const params = new URLSearchParams({
    expiration: "never",
    name: "BugLens",
    scope: "read,write",
    response_type: "token",
    key: TRELLO_API_KEY,
    return_url: returnUrl,
    callback_method: "fragment",
  });

  // Store org slug in session storage via callback page
  return `https://trello.com/1/authorize?${params.toString()}&state=${orgSlug}`;
}

/**
 * Validate Trello token
 */
export async function validateTrelloToken(token: string): Promise<{
  valid: boolean;
  member?: TrelloMember;
}> {
  try {
    const response = await fetch(
      `${TRELLO_API_BASE}/members/me?key=${TRELLO_API_KEY}&token=${token}`
    );

    if (!response.ok) {
      return { valid: false };
    }

    const member = await response.json();
    return { valid: true, member };
  } catch {
    return { valid: false };
  }
}

/**
 * Helper to make Trello API requests
 */
async function trelloFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${TRELLO_API_BASE}${endpoint}${separator}key=${TRELLO_API_KEY}&token=${token}`;

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/**
 * Get all boards for the authenticated user
 */
export async function getTrelloBoards(token: string): Promise<TrelloBoard[]> {
  const response = await trelloFetch(
    "/members/me/boards?filter=open&fields=name,desc,url,closed,prefs",
    token
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Trello boards");
  }

  return response.json();
}

/**
 * Get lists for a board
 */
export async function getTrelloLists(
  token: string,
  boardId: string
): Promise<TrelloList[]> {
  const response = await trelloFetch(
    `/boards/${boardId}/lists?filter=open`,
    token
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Trello lists");
  }

  return response.json();
}

/**
 * Get cards for a board
 */
export async function getTrelloCards(
  token: string,
  boardId: string,
  listId?: string
): Promise<TrelloCard[]> {
  const endpoint = listId
    ? `/lists/${listId}/cards`
    : `/boards/${boardId}/cards`;

  const response = await trelloFetch(endpoint, token);

  if (!response.ok) {
    throw new Error("Failed to fetch Trello cards");
  }

  return response.json();
}

/**
 * Get a single card
 */
export async function getTrelloCard(
  token: string,
  cardId: string
): Promise<TrelloCard> {
  const response = await trelloFetch(
    `/cards/${cardId}?fields=all&attachments=true&labels=true`,
    token
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Trello card ${cardId}`);
  }

  return response.json();
}

/**
 * Create a new card
 */
export async function createTrelloCard(
  token: string,
  data: {
    name: string;
    desc?: string;
    idList: string;
    pos?: "top" | "bottom" | number;
    due?: string;
    idLabels?: string[];
  }
): Promise<TrelloCard> {
  const response = await trelloFetch("/cards", token, {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Trello card: ${error}`);
  }

  return response.json();
}

/**
 * Update a card
 */
export async function updateTrelloCard(
  token: string,
  cardId: string,
  data: {
    name?: string;
    desc?: string;
    idList?: string;
    closed?: boolean;
    due?: string | null;
    idLabels?: string[];
  }
): Promise<TrelloCard> {
  const response = await trelloFetch(`/cards/${cardId}`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update Trello card: ${error}`);
  }

  return response.json();
}

/**
 * Move card to a different list
 */
export async function moveTrelloCard(
  token: string,
  cardId: string,
  listId: string
): Promise<TrelloCard> {
  return updateTrelloCard(token, cardId, { idList: listId });
}

/**
 * Add attachment to a card
 */
export async function addTrelloAttachment(
  token: string,
  cardId: string,
  data: {
    url?: string;
    name?: string;
    file?: Blob;
    mimeType?: string;
  }
): Promise<TrelloAttachment> {
  if (data.file) {
    // Upload file
    const formData = new FormData();
    formData.append("file", data.file);
    if (data.name) formData.append("name", data.name);

    const response = await fetch(
      `${TRELLO_API_BASE}/cards/${cardId}/attachments?key=${TRELLO_API_KEY}&token=${token}`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Failed to upload attachment");
    }

    return response.json();
  } else if (data.url) {
    // Attach URL
    const response = await trelloFetch(
      `/cards/${cardId}/attachments`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          url: data.url,
          name: data.name,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to add attachment");
    }

    return response.json();
  }

  throw new Error("Either url or file must be provided");
}

/**
 * Add comment to a card
 */
export async function addTrelloComment(
  token: string,
  cardId: string,
  text: string
): Promise<{ id: string; text: string }> {
  const response = await trelloFetch(
    `/cards/${cardId}/actions/comments`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ text }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to add comment");
  }

  return response.json();
}

/**
 * Get board labels
 */
export async function getTrelloLabels(
  token: string,
  boardId: string
): Promise<TrelloLabel[]> {
  const response = await trelloFetch(`/boards/${boardId}/labels`, token);

  if (!response.ok) {
    throw new Error("Failed to fetch labels");
  }

  return response.json();
}

/**
 * Create a webhook for a board
 */
export async function createTrelloWebhook(
  token: string,
  boardId: string,
  callbackUrl: string,
  description: string
): Promise<{ id: string }> {
  const response = await trelloFetch("/webhooks", token, {
    method: "POST",
    body: JSON.stringify({
      idModel: boardId,
      callbackURL: callbackUrl,
      description,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create webhook: ${error}`);
  }

  return response.json();
}

/**
 * Delete a webhook
 */
export async function deleteTrelloWebhook(
  token: string,
  webhookId: string
): Promise<void> {
  const response = await trelloFetch(`/webhooks/${webhookId}`, token, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete webhook");
  }
}

/**
 * Verify Trello webhook signature
 */
export function verifyTrelloWebhook(
  payload: string,
  signature: string,
  callbackUrl: string
): boolean {
  const secret = TRELLO_API_KEY;

  const base64Digest = crypto
    .createHmac("sha1", secret)
    .update(payload + callbackUrl)
    .digest("base64");

  return signature === base64Digest;
}

/**
 * Test Trello connection
 */
export async function testTrelloConnection(token: string): Promise<{
  ok: boolean;
  user?: string;
  error?: string;
}> {
  try {
    const result = await validateTrelloToken(token);

    if (!result.valid) {
      return { ok: false, error: "Invalid or expired token" };
    }

    return {
      ok: true,
      user: result.member?.fullName || result.member?.username,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse Trello webhook payload
 */
export interface TrelloWebhookPayload {
  action: {
    id: string;
    idMemberCreator: string;
    type: string;
    date: string;
    data: {
      card?: { id: string; name: string };
      list?: { id: string; name: string };
      listBefore?: { id: string; name: string };
      listAfter?: { id: string; name: string };
      board: { id: string; name: string };
      text?: string;
    };
    memberCreator: {
      id: string;
      username: string;
      fullName: string;
    };
  };
  model: {
    id: string;
    name: string;
  };
}

export function parseTrelloWebhook(body: unknown): TrelloWebhookPayload {
  return body as TrelloWebhookPayload;
}
