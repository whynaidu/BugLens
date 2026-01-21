"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TestCaseStatus } from "@/lib/validations/testcase";

const statusConfig: Record<
  TestCaseStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  DRAFT: {
    label: "Draft",
    variant: "secondary",
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  },
  PENDING: {
    label: "Pending",
    variant: "outline",
    className: "border-yellow-500 text-yellow-600",
  },
  PASSED: {
    label: "Passed",
    variant: "default",
    className: "bg-green-500 hover:bg-green-600 text-white",
  },
  FAILED: {
    label: "Failed",
    variant: "destructive",
    className: "bg-red-500 hover:bg-red-600 text-white",
  },
  BLOCKED: {
    label: "Blocked",
    variant: "secondary",
    className: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  },
  SKIPPED: {
    label: "Skipped",
    variant: "secondary",
    className: "bg-slate-200 text-slate-600 hover:bg-slate-200",
  },
};

interface StatusBadgeProps {
  status: TestCaseStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}

export function getStatusLabel(status: TestCaseStatus): string {
  return statusConfig[status].label;
}
