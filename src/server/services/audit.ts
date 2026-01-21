import { db } from "@/server/db";
import type { AuditAction, Prisma } from "@prisma/client";

type AuditLogDetails = Prisma.InputJsonValue;

/**
 * Log an audit action for a test case
 */
export async function logAuditAction(
  testCaseId: string,
  userId: string,
  action: AuditAction,
  details: AuditLogDetails = {}
) {
  return db.auditLog.create({
    data: {
      testCaseId,
      userId,
      action,
      details,
    },
  });
}

/**
 * Log test case creation
 */
export async function logTestCaseCreated(
  testCaseId: string,
  userId: string,
  testCaseData: { title: string; status: string; severity: string; priority: string }
) {
  return logAuditAction(testCaseId, userId, "CREATED", {
    title: testCaseData.title,
    status: testCaseData.status,
    severity: testCaseData.severity,
    priority: testCaseData.priority,
  });
}

/**
 * Log status change
 */
export async function logStatusChange(
  testCaseId: string,
  userId: string,
  fromStatus: string,
  toStatus: string
) {
  return logAuditAction(testCaseId, userId, "STATUS_CHANGED", {
    field: "status",
    from: fromStatus,
    to: toStatus,
  });
}

/**
 * Log assignment change
 */
export async function logAssignment(
  testCaseId: string,
  userId: string,
  assigneeId: string | null,
  assigneeName: string | null,
  previousAssigneeId: string | null = null,
  previousAssigneeName: string | null = null
) {
  if (assigneeId) {
    return logAuditAction(testCaseId, userId, "ASSIGNED", {
      assigneeId,
      assigneeName,
      previousAssigneeId,
      previousAssigneeName,
    });
  } else {
    return logAuditAction(testCaseId, userId, "UNASSIGNED", {
      previousAssigneeId,
      previousAssigneeName,
    });
  }
}

/**
 * Log field update
 */
export async function logFieldUpdate(
  testCaseId: string,
  userId: string,
  field: string,
  from: string | null | undefined,
  to: string | null | undefined
) {
  return logAuditAction(testCaseId, userId, "UPDATED", {
    field,
    from: from ?? null,
    to: to ?? null,
  });
}

/**
 * Log comment added
 */
export async function logCommentAdded(testCaseId: string, userId: string, commentId: string) {
  return logAuditAction(testCaseId, userId, "COMMENTED", {
    commentId,
  });
}

/**
 * Log annotation added
 */
export async function logAnnotationAdded(testCaseId: string, userId: string, annotationId: string) {
  return logAuditAction(testCaseId, userId, "ANNOTATION_ADDED", {
    annotationId,
  });
}

/**
 * Log annotation updated
 */
export async function logAnnotationUpdated(testCaseId: string, userId: string, annotationId: string) {
  return logAuditAction(testCaseId, userId, "ANNOTATION_UPDATED", {
    annotationId,
  });
}

/**
 * Log annotation deleted
 */
export async function logAnnotationDeleted(testCaseId: string, userId: string, annotationId: string) {
  return logAuditAction(testCaseId, userId, "ANNOTATION_DELETED", {
    annotationId,
  });
}

/**
 * Log attachment added
 */
export async function logAttachmentAdded(
  testCaseId: string,
  userId: string,
  attachmentId: string,
  fileName: string
) {
  return logAuditAction(testCaseId, userId, "ATTACHMENT_ADDED", {
    attachmentId,
    fileName,
  });
}

/**
 * Log sync to external tool
 */
export async function logSyncedToExternal(
  testCaseId: string,
  userId: string,
  integrationType: string,
  externalId: string
) {
  return logAuditAction(testCaseId, userId, "SYNCED_TO_EXTERNAL", {
    integrationType,
    externalId,
  });
}

/**
 * Helper to compare and log changes
 */
export async function logTestCaseChanges(
  testCaseId: string,
  userId: string,
  oldTestCase: Record<string, string | null | undefined>,
  newTestCase: Record<string, string | null | undefined>
) {
  const auditPromises: Promise<unknown>[] = [];

  // Check status change
  if (oldTestCase.status !== newTestCase.status) {
    auditPromises.push(
      logStatusChange(testCaseId, userId, oldTestCase.status as string, newTestCase.status as string)
    );
  }

  // Check assignment change
  if (oldTestCase.assigneeId !== newTestCase.assigneeId) {
    auditPromises.push(
      logAssignment(
        testCaseId,
        userId,
        newTestCase.assigneeId ?? null,
        newTestCase.assigneeName ?? null,
        oldTestCase.assigneeId ?? null,
        oldTestCase.assigneeName ?? null
      )
    );
  }

  // Check other field changes
  const fieldsToTrack = ["title", "description", "severity", "priority"] as const;
  for (const field of fieldsToTrack) {
    if (oldTestCase[field] !== newTestCase[field]) {
      auditPromises.push(logFieldUpdate(testCaseId, userId, field, oldTestCase[field], newTestCase[field]));
    }
  }

  return Promise.all(auditPromises);
}
