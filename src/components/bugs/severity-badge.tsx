"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BugSeverity } from "@/lib/validations/bug";

interface SeverityBadgeProps {
  severity: BugSeverity;
  className?: string;
}

const SEVERITY_CONFIG: Record<BugSeverity, { label: string; className: string }> = {
  LOW: {
    label: "Low",
    className: "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300",
  },
  MEDIUM: {
    label: "Medium",
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300",
  },
  HIGH: {
    label: "High",
    className: "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300",
  },
  CRITICAL: {
    label: "Critical",
    className: "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300",
  },
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity];

  return (
    <Badge
      variant="secondary"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}

// Utility function to get severity label
export function getSeverityLabel(severity: BugSeverity): string {
  return SEVERITY_CONFIG[severity].label;
}

// All severities for dropdowns
export const ALL_SEVERITIES: BugSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
