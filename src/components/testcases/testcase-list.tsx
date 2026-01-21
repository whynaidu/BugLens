"use client";

import { TestCaseCard } from "./testcase-card";
import type { TestCaseStatus, Severity, Priority } from "@/lib/validations/testcase";

interface TestCase {
  id: string;
  referenceId?: string | null;
  title: string;
  status: TestCaseStatus;
  severity: Severity;
  priority: Priority;
  createdAt: Date;
  creator: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  assignee?: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  module?: {
    id: string;
    name: string;
    project?: {
      id: string;
      name: string;
      slug: string;
    };
  };
  _count?: {
    screenshots: number;
    comments: number;
  };
}

interface TestCaseListProps {
  testCases: TestCase[];
  orgSlug: string;
  projectId?: string;
  moduleId?: string;
  emptyMessage?: string;
}

export function TestCaseList({
  testCases,
  orgSlug,
  projectId,
  moduleId,
  emptyMessage = "No test cases found",
}: TestCaseListProps) {
  if (testCases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {testCases.map((testCase) => {
        // Build href based on available context
        let href: string;
        if (moduleId && projectId) {
          href = `/${orgSlug}/projects/${projectId}/modules/${moduleId}/testcases/${testCase.id}`;
        } else if (testCase.module?.project) {
          href = `/${orgSlug}/projects/${testCase.module.project.id}/modules/${testCase.module.id}/testcases/${testCase.id}`;
        } else {
          href = `/${orgSlug}/testcases/${testCase.id}`;
        }

        return (
          <TestCaseCard
            key={testCase.id}
            id={testCase.id}
            referenceId={testCase.referenceId}
            title={testCase.title}
            status={testCase.status as TestCaseStatus}
            severity={testCase.severity as Severity}
            priority={testCase.priority as Priority}
            creator={{
              name: testCase.creator.name,
              avatarUrl: testCase.creator.avatarUrl,
            }}
            assignee={
              testCase.assignee
                ? {
                    name: testCase.assignee.name,
                    avatarUrl: testCase.assignee.avatarUrl,
                  }
                : null
            }
            screenshotCount={testCase._count?.screenshots ?? 0}
            commentCount={testCase._count?.comments ?? 0}
            createdAt={testCase.createdAt}
            href={href}
          />
        );
      })}
    </div>
  );
}
