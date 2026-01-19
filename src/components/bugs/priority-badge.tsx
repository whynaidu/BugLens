"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BugPriority } from "@/lib/validations/bug";

interface PriorityBadgeProps {
  priority: BugPriority;
  className?: string;
}

const PRIORITY_CONFIG: Record<BugPriority, { label: string; className: string }> = {
  LOW: {
    label: "Low",
    className: "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300",
  },
  MEDIUM: {
    label: "Medium",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300",
  },
  HIGH: {
    label: "High",
    className: "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300",
  },
  URGENT: {
    label: "Urgent",
    className: "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300",
  },
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}

// Utility function to get priority label
export function getPriorityLabel(priority: BugPriority): string {
  return PRIORITY_CONFIG[priority].label;
}

// All priorities for dropdowns
export const ALL_PRIORITIES: BugPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
