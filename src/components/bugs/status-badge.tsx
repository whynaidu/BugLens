"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BugStatus } from "@/lib/validations/bug";

interface StatusBadgeProps {
  status: BugStatus;
  className?: string;
}

const STATUS_CONFIG: Record<BugStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  OPEN: {
    label: "Open",
    variant: "secondary",
    className: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300",
  },
  IN_PROGRESS: {
    label: "In Progress",
    variant: "default",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300",
  },
  IN_REVIEW: {
    label: "In Review",
    variant: "default",
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300",
  },
  RESOLVED: {
    label: "Resolved",
    variant: "default",
    className: "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300",
  },
  CLOSED: {
    label: "Closed",
    variant: "outline",
    className: "bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-400",
  },
  REOPENED: {
    label: "Reopened",
    variant: "destructive",
    className: "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300",
  },
  WONT_FIX: {
    label: "Won't Fix",
    variant: "outline",
    className: "bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}

// Utility function to get status label
export function getStatusLabel(status: BugStatus): string {
  return STATUS_CONFIG[status].label;
}

// All statuses for dropdowns
export const ALL_STATUSES: BugStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "IN_REVIEW",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "WONT_FIX",
];
