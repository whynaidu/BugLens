/**
 * Export Service
 * Generates PDF and Excel exports for bug reports
 */

import puppeteer from "puppeteer";
import ExcelJS from "exceljs";
import { db } from "@/server/db";
import { format } from "date-fns";
import { BugStatus, BugSeverity, BugPriority } from "@prisma/client";

// Types
export interface ExportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  status?: BugStatus[];
  severity?: BugSeverity[];
  priority?: BugPriority[];
  includeScreenshots?: boolean;
}

interface AnnotationWithScreenshot {
  id: string;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  stroke: string;
  screenshot?: {
    id: string;
    originalUrl: string;
    thumbnailUrl: string | null;
    title: string | null;
  } | null;
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
 * Get bugs for export with filters
 */
async function getBugsForExport(projectId: string, filters: ExportFilters) {
  const where: Record<string, unknown> = {
    projectId,
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

  return db.bug.findMany({
    where,
    include: {
      creator: {
        select: { id: true, name: true, email: true },
      },
      assignee: {
        select: { id: true, name: true, email: true },
      },
      annotations: filters.includeScreenshots
        ? {
            include: {
              screenshot: {
                select: {
                  id: true,
                  originalUrl: true,
                  thumbnailUrl: true,
                  title: true,
                },
              },
            },
          }
        : false,
      _count: {
        select: { comments: true, attachments: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get project with stats
 */
async function getProjectWithStats(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      organization: {
        select: { name: true, slug: true },
      },
      _count: {
        select: { bugs: true, flows: true },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Get bug stats
  const stats = await db.bug.groupBy({
    by: ["status"],
    where: { projectId },
    _count: { _all: true },
  });

  const severityStats = await db.bug.groupBy({
    by: ["severity"],
    where: { projectId },
    _count: { _all: true },
  });

  return {
    ...project,
    stats: {
      byStatus: Object.fromEntries(
        stats.map((s) => [s.status, s._count._all])
      ),
      bySeverity: Object.fromEntries(
        severityStats.map((s) => [s.severity, s._count._all])
      ),
    },
  };
}

// Brand colors
const BRAND_COLORS = {
  primary: "#6366f1",
  secondary: "#8b5cf6",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
};

// Status colors
const STATUS_COLORS: Record<string, string> = {
  OPEN: "#ef4444",
  IN_PROGRESS: "#f59e0b",
  IN_REVIEW: "#3b82f6",
  RESOLVED: "#22c55e",
  CLOSED: "#6b7280",
  REOPENED: "#f97316",
  WONT_FIX: "#9ca3af",
};

// Severity colors
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

/**
 * Generate HTML template for PDF
 */
function generatePDFHTML(
  project: Awaited<ReturnType<typeof getProjectWithStats>>,
  bugs: Awaited<ReturnType<typeof getBugsForExport>>,
  filters: ExportFilters
): string {
  const statusStats = project.stats.byStatus;
  const severityStats = project.stats.bySeverity;

  const bugRows = bugs
    .map(
      (bug, index) => `
    <div class="bug-card ${index > 0 ? "page-break" : ""}">
      <div class="bug-header">
        <div class="bug-id">#${bug.id.slice(-6).toUpperCase()}</div>
        <div class="bug-status" style="background: ${STATUS_COLORS[bug.status] || "#6b7280"}">
          ${bug.status.replace("_", " ")}
        </div>
        <div class="bug-severity" style="background: ${SEVERITY_COLORS[bug.severity] || "#6b7280"}">
          ${bug.severity}
        </div>
      </div>

      <h3 class="bug-title">${escapeHtml(bug.title)}</h3>

      <div class="bug-meta">
        <div class="meta-item">
          <span class="meta-label">Created:</span>
          <span>${format(bug.createdAt, "MMM d, yyyy HH:mm")}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Creator:</span>
          <span>${escapeHtml(bug.creator.name || bug.creator.email)}</span>
        </div>
        ${
          bug.assignee
            ? `
        <div class="meta-item">
          <span class="meta-label">Assignee:</span>
          <span>${escapeHtml(bug.assignee.name || bug.assignee.email)}</span>
        </div>
        `
            : ""
        }
        <div class="meta-item">
          <span class="meta-label">Priority:</span>
          <span>${bug.priority}</span>
        </div>
        ${
          bug.url
            ? `
        <div class="meta-item">
          <span class="meta-label">URL:</span>
          <span class="bug-url">${escapeHtml(bug.url)}</span>
        </div>
        `
            : ""
        }
      </div>

      <div class="bug-description">
        <h4>Description</h4>
        <p>${escapeHtml(bug.description).replace(/\n/g, "<br>")}</p>
      </div>

      ${
        filters.includeScreenshots && bug.annotations && bug.annotations.length > 0
          ? `
      <div class="bug-screenshots">
        <h4>Screenshots & Annotations</h4>
        <div class="screenshot-grid">
          ${(bug.annotations as AnnotationWithScreenshot[])
            .filter((ann) => ann.screenshot)
            .map(
              (ann) => `
            <div class="screenshot-item">
              <img src="${ann.screenshot?.originalUrl || ann.screenshot?.thumbnailUrl}"
                   alt="${escapeHtml(ann.screenshot?.title || "Screenshot")}" />
              <div class="annotation-marker"
                   style="left: ${ann.x * 100}%; top: ${ann.y * 100}%;
                          ${ann.width ? `width: ${ann.width * 100}%; height: ${ann.height ? ann.height * 100 : 0}%;` : ""}
                          border-color: ${ann.stroke};">
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
      `
          : ""
      }

      <div class="bug-footer">
        <span>${bug._count.comments} comments</span>
        <span>${bug._count.attachments} attachments</span>
      </div>
    </div>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(project.name)} - Bug Report</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      padding: 40px;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid ${BRAND_COLORS.primary};
    }

    .logo {
      font-size: 24px;
      font-weight: bold;
      color: ${BRAND_COLORS.primary};
      margin-bottom: 8px;
    }

    .project-name {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .org-name {
      color: #6b7280;
      font-size: 14px;
    }

    .generated-at {
      color: #9ca3af;
      font-size: 11px;
      margin-top: 8px;
    }

    .stats-section {
      display: flex;
      gap: 20px;
      margin-bottom: 40px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
    }

    .stats-group {
      flex: 1;
    }

    .stats-title {
      font-weight: 600;
      margin-bottom: 12px;
      color: #374151;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .stat-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stat-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }

    .bug-card {
      margin-bottom: 30px;
      padding: 20px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: white;
    }

    .page-break {
      page-break-before: always;
    }

    .bug-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .bug-id {
      font-family: monospace;
      font-size: 11px;
      color: #6b7280;
    }

    .bug-status, .bug-severity {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
      color: white;
      text-transform: uppercase;
    }

    .bug-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #111827;
    }

    .bug-meta {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 16px;
      padding: 12px;
      background: #f9fafb;
      border-radius: 6px;
    }

    .meta-item {
      display: flex;
      gap: 8px;
    }

    .meta-label {
      font-weight: 500;
      color: #6b7280;
    }

    .bug-url {
      color: ${BRAND_COLORS.primary};
      word-break: break-all;
    }

    .bug-description {
      margin-bottom: 16px;
    }

    .bug-description h4 {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #374151;
    }

    .bug-description p {
      color: #4b5563;
    }

    .bug-screenshots h4 {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #374151;
    }

    .screenshot-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .screenshot-item {
      position: relative;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      overflow: hidden;
    }

    .screenshot-item img {
      width: 100%;
      height: auto;
      display: block;
    }

    .annotation-marker {
      position: absolute;
      border: 2px solid;
      border-radius: 4px;
      pointer-events: none;
    }

    .bug-footer {
      display: flex;
      gap: 16px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 11px;
    }

    .filters-section {
      margin-bottom: 20px;
      padding: 12px;
      background: #fef3c7;
      border-radius: 6px;
      font-size: 11px;
    }

    .filters-section strong {
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🔍 BugLens</div>
    <div class="project-name">${escapeHtml(project.name)}</div>
    <div class="org-name">${escapeHtml(project.organization.name)}</div>
    <div class="generated-at">Generated on ${format(new Date(), "MMMM d, yyyy 'at' HH:mm")}</div>
  </div>

  ${
    filters.dateFrom || filters.dateTo || filters.status || filters.severity
      ? `
  <div class="filters-section">
    <strong>Filters Applied:</strong>
    ${filters.dateFrom ? `From: ${format(filters.dateFrom, "MMM d, yyyy")}` : ""}
    ${filters.dateTo ? `To: ${format(filters.dateTo, "MMM d, yyyy")}` : ""}
    ${filters.status?.length ? `Status: ${filters.status.join(", ")}` : ""}
    ${filters.severity?.length ? `Severity: ${filters.severity.join(", ")}` : ""}
  </div>
  `
      : ""
  }

  <div class="stats-section">
    <div class="stats-group">
      <div class="stats-title">By Status</div>
      ${Object.entries(statusStats)
        .map(
          ([status, count]) => `
        <div class="stat-item">
          <div class="stat-label">
            <div class="stat-color" style="background: ${STATUS_COLORS[status] || "#6b7280"}"></div>
            <span>${status.replace("_", " ")}</span>
          </div>
          <span>${count}</span>
        </div>
      `
        )
        .join("")}
    </div>

    <div class="stats-group">
      <div class="stats-title">By Severity</div>
      ${Object.entries(severityStats)
        .map(
          ([severity, count]) => `
        <div class="stat-item">
          <div class="stat-label">
            <div class="stat-color" style="background: ${SEVERITY_COLORS[severity] || "#6b7280"}"></div>
            <span>${severity}</span>
          </div>
          <span>${count}</span>
        </div>
      `
        )
        .join("")}
    </div>

    <div class="stats-group">
      <div class="stats-title">Summary</div>
      <div class="stat-item">
        <span>Total Bugs</span>
        <span>${bugs.length}</span>
      </div>
      <div class="stat-item">
        <span>Total Flows</span>
        <span>${project._count.flows}</span>
      </div>
    </div>
  </div>

  <div class="bugs-section">
    ${bugRows || '<p style="text-align: center; color: #6b7280;">No bugs found matching the filters.</p>'}
  </div>
</body>
</html>
  `;
}

/**
 * Helper to escape HTML
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Generate PDF export
 */
export async function generatePDF(
  projectId: string,
  filters: ExportFilters = {}
): Promise<Buffer> {
  const [project, bugs] = await Promise.all([
    getProjectWithStats(projectId),
    getBugsForExport(projectId, filters),
  ]);

  const html = generatePDFHTML(project, bugs, filters);

  // Launch headless browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: {
        top: "20mm",
        right: "15mm",
        bottom: "20mm",
        left: "15mm",
      },
      printBackground: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Generate Excel export
 */
export async function generateExcel(
  projectId: string,
  filters: ExportFilters = {}
): Promise<Buffer> {
  const [project, bugs] = await Promise.all([
    getProjectWithStats(projectId),
    getBugsForExport(projectId, filters),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BugLens";
  workbook.created = new Date();

  // Main bug list worksheet
  const bugSheet = workbook.addWorksheet("Bugs", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  });

  // Set columns
  bugSheet.columns = [
    { header: "ID", key: "id", width: 12 },
    { header: "Title", key: "title", width: 40 },
    { header: "Status", key: "status", width: 14 },
    { header: "Severity", key: "severity", width: 12 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Assignee", key: "assignee", width: 20 },
    { header: "Creator", key: "creator", width: 20 },
    { header: "Created", key: "createdAt", width: 18 },
    { header: "Updated", key: "updatedAt", width: 18 },
    { header: "URL", key: "url", width: 30 },
    { header: "Description", key: "description", width: 50 },
    { header: "Comments", key: "comments", width: 10 },
    { header: "Attachments", key: "attachments", width: 12 },
  ];

  // Style header row
  const headerRow = bugSheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF6366F1" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 24;

  // Add data rows
  bugs.forEach((bug) => {
    const row = bugSheet.addRow({
      id: `#${bug.id.slice(-6).toUpperCase()}`,
      title: bug.title,
      status: bug.status.replace("_", " "),
      severity: bug.severity,
      priority: bug.priority,
      assignee: bug.assignee?.name || bug.assignee?.email || "Unassigned",
      creator: bug.creator.name || bug.creator.email,
      createdAt: format(bug.createdAt, "yyyy-MM-dd HH:mm"),
      updatedAt: format(bug.updatedAt, "yyyy-MM-dd HH:mm"),
      url: bug.url || "",
      description: bug.description,
      comments: bug._count.comments,
      attachments: bug._count.attachments,
    });

    // Conditional formatting for severity
    const severityCell = row.getCell("severity");
    const severityColor = {
      CRITICAL: "FFDC2626",
      HIGH: "FFF97316",
      MEDIUM: "FFEAB308",
      LOW: "FF22C55E",
    }[bug.severity];
    if (severityColor) {
      severityCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: severityColor },
      };
      severityCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    }

    // Conditional formatting for status
    const statusCell = row.getCell("status");
    const statusColor = {
      OPEN: "FFEF4444",
      IN_PROGRESS: "FFF59E0B",
      IN_REVIEW: "FF3B82F6",
      RESOLVED: "FF22C55E",
      CLOSED: "FF6B7280",
      REOPENED: "FFF97316",
      WONT_FIX: "FF9CA3AF",
    }[bug.status];
    if (statusColor) {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: statusColor },
      };
      statusCell.font = { color: { argb: "FFFFFFFF" } };
    }
  });

  // Add borders to all cells
  bugSheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  // Stats by Status worksheet
  const statusSheet = workbook.addWorksheet("By Status");
  statusSheet.columns = [
    { header: "Status", key: "status", width: 20 },
    { header: "Count", key: "count", width: 12 },
    { header: "Percentage", key: "percentage", width: 12 },
  ];

  const statusHeader = statusSheet.getRow(1);
  statusHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  statusHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF6366F1" },
  };

  const totalBugs = bugs.length;
  Object.entries(project.stats.byStatus).forEach(([status, count]) => {
    statusSheet.addRow({
      status: status.replace("_", " "),
      count,
      percentage: totalBugs > 0 ? `${((count as number / totalBugs) * 100).toFixed(1)}%` : "0%",
    });
  });

  // Stats by Severity worksheet
  const severitySheet = workbook.addWorksheet("By Severity");
  severitySheet.columns = [
    { header: "Severity", key: "severity", width: 20 },
    { header: "Count", key: "count", width: 12 },
    { header: "Percentage", key: "percentage", width: 12 },
  ];

  const severityHeader = severitySheet.getRow(1);
  severityHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  severityHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF6366F1" },
  };

  Object.entries(project.stats.bySeverity).forEach(([severity, count]) => {
    severitySheet.addRow({
      severity,
      count,
      percentage: totalBugs > 0 ? `${((count as number / totalBugs) * 100).toFixed(1)}%` : "0%",
    });
  });

  // Summary worksheet
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.addRow(["Project", project.name]);
  summarySheet.addRow(["Organization", project.organization.name]);
  summarySheet.addRow(["Generated", format(new Date(), "MMMM d, yyyy HH:mm")]);
  summarySheet.addRow([]);
  summarySheet.addRow(["Total Bugs", bugs.length]);
  summarySheet.addRow(["Total Flows", project._count.flows]);
  summarySheet.addRow([]);

  if (filters.dateFrom || filters.dateTo) {
    summarySheet.addRow(["Filters Applied"]);
    if (filters.dateFrom) {
      summarySheet.addRow(["From Date", format(filters.dateFrom, "yyyy-MM-dd")]);
    }
    if (filters.dateTo) {
      summarySheet.addRow(["To Date", format(filters.dateTo, "yyyy-MM-dd")]);
    }
  }

  summarySheet.getColumn(1).width = 20;
  summarySheet.getColumn(2).width = 30;
  summarySheet.getColumn(1).font = { bold: true };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Process export job
 */
export async function processExportJob(
  jobId: string,
  projectId: string,
  format: "pdf" | "excel",
  filters: ExportFilters = {}
): Promise<void> {
  updateExportJob(jobId, { status: "processing", progress: 10 });

  try {
    let buffer: Buffer;
    let fileName: string;
    let contentType: string;

    updateExportJob(jobId, { progress: 30 });

    if (format === "pdf") {
      buffer = await generatePDF(projectId, filters);
      fileName = `buglens-export-${Date.now()}.pdf`;
      contentType = "application/pdf";
    } else {
      buffer = await generateExcel(projectId, filters);
      fileName = `buglens-export-${Date.now()}.xlsx`;
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    updateExportJob(jobId, { progress: 70 });

    // In production, upload to S3 with 24-hour expiry
    // For now, store in memory and provide base64 data URL
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    updateExportJob(jobId, {
      status: "completed",
      progress: 100,
      fileUrl: dataUrl,
      s3Key: fileName,
      completedAt: new Date(),
    });
  } catch (error) {
    updateExportJob(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
