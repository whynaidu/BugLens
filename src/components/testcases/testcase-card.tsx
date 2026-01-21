"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { User, Image, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";
import type { TestCaseStatus, Severity, Priority } from "@/lib/validations/testcase";

interface TestCaseCardProps {
  id: string;
  referenceId?: string | null;
  title: string;
  status: TestCaseStatus;
  severity: Severity;
  priority: Priority;
  creator: {
    name: string | null;
    avatarUrl: string | null;
  };
  assignee?: {
    name: string | null;
    avatarUrl: string | null;
  } | null;
  screenshotCount?: number;
  commentCount?: number;
  createdAt: Date;
  href: string;
}

const severityColors: Record<Severity, string> = {
  LOW: "bg-blue-100 text-blue-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

const priorityColors: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-800",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
};

export function TestCaseCard({
  id,
  referenceId,
  title,
  status,
  severity,
  priority,
  creator,
  assignee,
  screenshotCount = 0,
  commentCount = 0,
  createdAt,
  href,
}: TestCaseCardProps) {
  return (
    <Link href={href}>
      <Card className="group transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              {referenceId && (
                <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {referenceId}
                </Badge>
              )}
              <CardTitle className="line-clamp-2 text-base font-medium group-hover:text-primary">
                {title}
              </CardTitle>
            </div>
            <StatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Severity and Priority */}
          <div className="flex gap-2">
            <Badge variant="outline" className={cn("text-xs", severityColors[severity])}>
              Sev: {severity}
            </Badge>
            <Badge variant="outline" className={cn("text-xs", priorityColors[priority])}>
              Pri: {priority}
            </Badge>
          </div>

          {/* Metadata row */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              {screenshotCount > 0 && (
                <div className="flex items-center gap-1">
                  <Image className="h-4 w-4" />
                  <span>{screenshotCount}</span>
                </div>
              )}
              {commentCount > 0 && (
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  <span>{commentCount}</span>
                </div>
              )}
            </div>
            <span>{formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
          </div>

          {/* Assignee / Creator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={creator.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs">
                  {creator.name?.charAt(0) ?? "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {creator.name ?? "Unknown"}
              </span>
            </div>
            {assignee && (
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <Avatar className="h-5 w-5">
                  <AvatarImage src={assignee.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {assignee.name?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
