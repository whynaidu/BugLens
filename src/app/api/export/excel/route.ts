import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  createExportJob,
  processExportJob,
  type ExportFilters,
} from "@/server/services/export";
import { BugStatus, BugSeverity, BugPriority } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, filters = {} } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Verify user has access to the project
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { organization: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Check organization membership
    const membership = await db.member.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: project.organizationId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Parse and validate filters
    const exportFilters: ExportFilters = {
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
      status: filters.status as BugStatus[] | undefined,
      severity: filters.severity as BugSeverity[] | undefined,
      priority: filters.priority as BugPriority[] | undefined,
      includeScreenshots: filters.includeScreenshots ?? false,
    };

    // Create export job
    const job = createExportJob(projectId, "excel");

    // Process job asynchronously
    processExportJob(job.id, projectId, "excel", exportFilters).catch(
      console.error
    );

    return NextResponse.json({
      jobId: job.id,
      status: "pending",
      message: "Excel export started",
    });
  } catch (error) {
    console.error("Excel export error:", error);
    return NextResponse.json(
      { error: "Failed to start Excel export" },
      { status: 500 }
    );
  }
}
