import { db } from "@/server/db";
import type { AuditAction, Prisma } from "@prisma/client";

type AuditLogDetails = Prisma.InputJsonValue;

/**
 * Log an audit action for a bug
 */
export async function logAuditAction(
  bugId: string,
  userId: string,
  action: AuditAction,
  details: AuditLogDetails = {}
) {
  return db.auditLog.create({
    data: {
      bugId,
      userId,
      action,
      details,
    },
  });
}

/**
 * Log bug creation
 */
export async function logBugCreated(
  bugId: string,
  userId: string,
  bugData: { title: string; status: string; severity: string; priority: string }
) {
  return logAuditAction(bugId, userId, "CREATED", {
    title: bugData.title,
    status: bugData.status,
    severity: bugData.severity,
    priority: bugData.priority,
  });
}

/**
 * Log status change
 */
export async function logStatusChange(
  bugId: string,
  userId: string,
  fromStatus: string,
  toStatus: string
) {
  return logAuditAction(bugId, userId, "STATUS_CHANGED", {
    field: "status",
    from: fromStatus,
    to: toStatus,
  });
}

/**
 * Log assignment change
 */
export async function logAssignment(
  bugId: string,
  userId: string,
  assigneeId: string | null,
  assigneeName: string | null,
  previousAssigneeId: string | null = null,
  previousAssigneeName: string | null = null
) {
  if (assigneeId) {
    return logAuditAction(bugId, userId, "ASSIGNED", {
      assigneeId,
      assigneeName,
      previousAssigneeId,
      previousAssigneeName,
    });
  } else {
    return logAuditAction(bugId, userId, "UNASSIGNED", {
      previousAssigneeId,
      previousAssigneeName,
    });
  }
}

/**
 * Log field update
 */
export async function logFieldUpdate(
  bugId: string,
  userId: string,
  field: string,
  from: string | null | undefined,
  to: string | null | undefined
) {
  return logAuditAction(bugId, userId, "UPDATED", {
    field,
    from: from ?? null,
    to: to ?? null,
  });
}

/**
 * Log comment added
 */
export async function logCommentAdded(bugId: string, userId: string, commentId: string) {
  return logAuditAction(bugId, userId, "COMMENTED", {
    commentId,
  });
}

/**
 * Log annotation added
 */
export async function logAnnotationAdded(bugId: string, userId: string, annotationId: string) {
  return logAuditAction(bugId, userId, "ANNOTATION_ADDED", {
    annotationId,
  });
}

/**
 * Log annotation updated
 */
export async function logAnnotationUpdated(bugId: string, userId: string, annotationId: string) {
  return logAuditAction(bugId, userId, "ANNOTATION_UPDATED", {
    annotationId,
  });
}

/**
 * Log annotation deleted
 */
export async function logAnnotationDeleted(bugId: string, userId: string, annotationId: string) {
  return logAuditAction(bugId, userId, "ANNOTATION_DELETED", {
    annotationId,
  });
}

/**
 * Log attachment added
 */
export async function logAttachmentAdded(
  bugId: string,
  userId: string,
  attachmentId: string,
  fileName: string
) {
  return logAuditAction(bugId, userId, "ATTACHMENT_ADDED", {
    attachmentId,
    fileName,
  });
}

/**
 * Log sync to external tool
 */
export async function logSyncedToExternal(
  bugId: string,
  userId: string,
  integrationType: string,
  externalId: string
) {
  return logAuditAction(bugId, userId, "SYNCED_TO_EXTERNAL", {
    integrationType,
    externalId,
  });
}

/**
 * Helper to compare and log changes
 */
export async function logBugChanges(
  bugId: string,
  userId: string,
  oldBug: Record<string, string | null | undefined>,
  newBug: Record<string, string | null | undefined>
) {
  const auditPromises: Promise<unknown>[] = [];

  // Check status change
  if (oldBug.status !== newBug.status) {
    auditPromises.push(
      logStatusChange(bugId, userId, oldBug.status as string, newBug.status as string)
    );
  }

  // Check assignment change
  if (oldBug.assigneeId !== newBug.assigneeId) {
    auditPromises.push(
      logAssignment(
        bugId,
        userId,
        newBug.assigneeId ?? null,
        newBug.assigneeName ?? null,
        oldBug.assigneeId ?? null,
        oldBug.assigneeName ?? null
      )
    );
  }

  // Check other field changes
  const fieldsToTrack = ["title", "description", "severity", "priority"] as const;
  for (const field of fieldsToTrack) {
    if (oldBug[field] !== newBug[field]) {
      auditPromises.push(logFieldUpdate(bugId, userId, field, oldBug[field], newBug[field]));
    }
  }

  return Promise.all(auditPromises);
}
