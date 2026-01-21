/**
 * Export Service
 * Generates PDF and Excel exports for test case reports
 *
 * NOTE: This service needs to be updated for the new Module/TestCase architecture.
 * The current implementation is a stub that will be completed in a future update.
 */

import { db } from "@/server/db";
import { TestCaseStatus, BugSeverity, BugPriority } from "@prisma/client";

// Types
export interface ExportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  status?: TestCaseStatus[];
  severity?: BugSeverity[];
  priority?: BugPriority[];
  includeScreenshots?: boolean;
}

export interface ExportJob {
  id: string;
  projectId: string;
  format: "pdf" | "excel";
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  fileUrl?: string;
  s3Key?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// In-memory job store (use Redis in production)
const exportJobs = new Map<string, ExportJob>();

/**
 * Create a new export job
 */
export function createExportJob(
  projectId: string,
  format: "pdf" | "excel"
): ExportJob {
  const job: ExportJob = {
    id: crypto.randomUUID(),
    projectId,
    format,
    status: "pending",
    progress: 0,
    createdAt: new Date(),
  };
  exportJobs.set(job.id, job);
  return job;
}

/**
 * Get export job by ID
 */
export function getExportJob(jobId: string): ExportJob | undefined {
  return exportJobs.get(jobId);
}

/**
 * Update export job
 */
export function updateExportJob(
  jobId: string,
  updates: Partial<ExportJob>
): void {
  const job = exportJobs.get(jobId);
  if (job) {
    exportJobs.set(jobId, { ...job, ...updates });
  }
}

/**
 * Get test cases for export with filters
 */
async function getTestCasesForExport(projectId: string, filters: ExportFilters) {
  // Query test cases through modules
  const where: Record<string, unknown> = {
    module: {
      projectId,
    },
  };

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      (where.createdAt as Record<string, Date>).gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      (where.createdAt as Record<string, Date>).lte = filters.dateTo;
    }
  }

  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status };
  }

  if (filters.severity && filters.severity.length > 0) {
    where.severity = { in: filters.severity };
  }

  if (filters.priority && filters.priority.length > 0) {
    where.priority = { in: filters.priority };
  }

  return db.testCase.findMany({
    where,
    include: {
      module: {
        include: {
          project: {
            select: { name: true, slug: true },
          },
        },
      },
      creator: {
        select: { name: true, email: true },
      },
      assignee: {
        select: { name: true, email: true },
      },
      screenshots: filters.includeScreenshots ? {
        include: {
          annotations: true,
        },
      } : false,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get project with statistics
 */
async function getProjectWithStats(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      organization: {
        select: { name: true, slug: true },
      },
      _count: {
        select: { modules: true },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Get test case stats through modules
  const stats = await db.testCase.groupBy({
    by: ["status"],
    where: { module: { projectId } },
    _count: { status: true },
  });

  const severityStats = await db.testCase.groupBy({
    by: ["severity"],
    where: { module: { projectId } },
    _count: { severity: true },
  });

  return {
    ...project,
    stats: {
      byStatus: Object.fromEntries(
        stats.map((s) => [s.status, s._count.status])
      ),
      bySeverity: Object.fromEntries(
        severityStats.map((s) => [s.severity, s._count.severity])
      ),
    },
  };
}

// Status color mapping for TestCaseStatus
const STATUS_COLORS: Record<TestCaseStatus, string> = {
  DRAFT: "#6b7280",      // gray
  PENDING: "#f59e0b",    // yellow
  PASSED: "#22c55e",     // green
  FAILED: "#ef4444",     // red
  BLOCKED: "#f97316",    // orange
  SKIPPED: "#94a3b8",    // slate
};

// Severity color mapping
const SEVERITY_COLORS: Record<BugSeverity, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

/**
 * Process export job
 * Currently a stub implementation - full export functionality coming soon
 */
export async function processExportJob(
  jobId: string,
  projectId: string,
  format: "pdf" | "excel",
  filters: ExportFilters
): Promise<void> {
  try {
    updateExportJob(jobId, { status: "processing", progress: 10 });

    // Get project info
    const project = await getProjectWithStats(projectId);
    updateExportJob(jobId, { progress: 20 });

    // Get test cases
    const testCases = await getTestCasesForExport(projectId, filters);
    updateExportJob(jobId, { progress: 40 });

    if (testCases.length === 0) {
      updateExportJob(jobId, {
        status: "failed",
        error: "No test cases found matching the specified filters",
      });
      return;
    }

    // For now, mark as failed with a "coming soon" message
    // Full implementation will be added in a future update
    updateExportJob(jobId, {
      status: "failed",
      error: "Export functionality is being updated. Please try again later.",
      completedAt: new Date(),
    });
  } catch (error) {
    console.error(`Export job ${jobId} failed:`, error);
    updateExportJob(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export { STATUS_COLORS, SEVERITY_COLORS };
