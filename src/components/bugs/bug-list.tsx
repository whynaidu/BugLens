"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  Trash2,
  MessageSquare,
  Image,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BugStatus, BugSeverity, BugPriority } from "@/lib/validations/bug";
import { StatusBadge } from "./status-badge";
import { SeverityBadge } from "./severity-badge";
import { PriorityBadge } from "./priority-badge";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface Bug {
  id: string;
  title: string;
  status: BugStatus;
  severity: BugSeverity;
  priority: BugPriority;
  createdAt: Date;
  updatedAt: Date;
  creator: User;
  assignee: User | null;
  _count: {
    annotations: number;
    comments: number;
  };
}

interface BugListProps {
  bugs: Bug[];
  isLoading?: boolean;
  orgSlug: string;
  projectId: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSortChange: (column: string) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onDelete?: (bugId: string) => void;
}

type SortableColumn = "title" | "status" | "severity" | "priority" | "createdAt" | "updatedAt";

// SortHeader component moved outside to prevent recreation during render
function SortHeader({
  column,
  sortBy,
  sortOrder,
  onSortChange,
  children,
}: {
  column: SortableColumn;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSortChange: (column: string) => void;
  children: React.ReactNode;
}) {
  const isActive = sortBy === column;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=active]:bg-accent"
      onClick={() => onSortChange(column)}
    >
      {children}
      {isActive && (
        sortOrder === "asc" ? (
          <ChevronUp className="ml-1 h-4 w-4" />
        ) : (
          <ChevronDown className="ml-1 h-4 w-4" />
        )
      )}
    </Button>
  );
}

export function BugList({
  bugs,
  isLoading = false,
  orgSlug,
  projectId,
  sortBy,
  sortOrder,
  onSortChange,
  selectedIds,
  onSelectionChange,
  onDelete,
}: BugListProps) {
  const router = useRouter();

  const handleRowClick = (bugId: string) => {
    router.push(`/${orgSlug}/projects/${projectId}/bugs/${bugId}`);
  };

  const toggleSelection = (bugId: string) => {
    if (selectedIds.includes(bugId)) {
      onSelectionChange(selectedIds.filter((id) => id !== bugId));
    } else {
      onSelectionChange([...selectedIds, bugId]);
    }
  };

  const toggleAllSelection = () => {
    if (selectedIds.length === bugs.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(bugs.map((bug) => bug.id));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (bugs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">No bugs found</h3>
        <p className="text-sm text-muted-foreground mt-1">
          No bugs match your current filters. Try adjusting your search criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={selectedIds.length === bugs.length && bugs.length > 0}
                onCheckedChange={toggleAllSelection}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="min-w-[300px]">
              <SortHeader column="title" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange}>Title</SortHeader>
            </TableHead>
            <TableHead className="w-[120px]">
              <SortHeader column="status" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange}>Status</SortHeader>
            </TableHead>
            <TableHead className="w-[100px]">
              <SortHeader column="severity" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange}>Severity</SortHeader>
            </TableHead>
            <TableHead className="w-[100px]">
              <SortHeader column="priority" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange}>Priority</SortHeader>
            </TableHead>
            <TableHead className="w-[140px]">Assignee</TableHead>
            <TableHead className="w-[140px]">
              <SortHeader column="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange}>Created</SortHeader>
            </TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {bugs.map((bug) => (
            <TableRow
              key={bug.id}
              className={cn(
                "cursor-pointer",
                selectedIds.includes(bug.id) && "bg-muted/50"
              )}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.includes(bug.id)}
                  onCheckedChange={() => toggleSelection(bug.id)}
                  aria-label={`Select ${bug.title}`}
                />
              </TableCell>
              <TableCell onClick={() => handleRowClick(bug.id)}>
                <div className="space-y-1">
                  <div className="font-medium hover:underline">{bug.title}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {bug._count.annotations > 0 && (
                      <span className="flex items-center gap-1">
                        <Image className="h-3 w-3" />
                        {bug._count.annotations}
                      </span>
                    )}
                    {bug._count.comments > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {bug._count.comments}
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell onClick={() => handleRowClick(bug.id)}>
                <StatusBadge status={bug.status} />
              </TableCell>
              <TableCell onClick={() => handleRowClick(bug.id)}>
                <SeverityBadge severity={bug.severity} />
              </TableCell>
              <TableCell onClick={() => handleRowClick(bug.id)}>
                <PriorityBadge priority={bug.priority} />
              </TableCell>
              <TableCell onClick={() => handleRowClick(bug.id)}>
                {bug.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={bug.assignee.image ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {bug.assignee.name?.charAt(0) ?? bug.assignee.email?.charAt(0) ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate max-w-[80px]">
                      {bug.assignee.name ?? bug.assignee.email}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
              <TableCell onClick={() => handleRowClick(bug.id)}>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(bug.createdAt), { addSuffix: true })}
                </span>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/${orgSlug}/projects/${projectId}/bugs/${bug.id}`}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/${orgSlug}/projects/${projectId}/bugs/${bug.id}?edit=true`}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    {onDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete(bug.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Bulk actions component
interface BulkActionsProps {
  selectedCount: number;
  onStatusChange: (status: BugStatus) => void;
  onAssign: (assigneeId: string | null) => void;
  onClearSelection: () => void;
  members?: Array<{ id: string; name: string | null; email: string | null; image: string | null }>;
}

export function BugBulkActions({
  selectedCount,
  onStatusChange,
  onAssign,
  onClearSelection,
  members = [],
}: BulkActionsProps) {
  if (selectedCount === 0) return null;

  const statuses: BugStatus[] = ["OPEN", "IN_PROGRESS", "IN_REVIEW", "RESOLVED", "CLOSED"];

  return (
    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
      <span className="text-sm font-medium">
        {selectedCount} selected
      </span>
      <div className="h-4 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Change Status
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {statuses.map((status) => (
            <DropdownMenuItem key={status} onClick={() => onStatusChange(status)}>
              <StatusBadge status={status} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {members.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Assign
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onAssign(null)}>
              <span className="text-muted-foreground">Unassign</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {members.map((member) => (
              <DropdownMenuItem key={member.id} onClick={() => onAssign(member.id)}>
                <Avatar className="h-5 w-5 mr-2">
                  <AvatarImage src={member.image ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {member.name?.charAt(0) ?? member.email?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                {member.name ?? member.email}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button variant="ghost" size="sm" onClick={onClearSelection}>
        Clear selection
      </Button>
    </div>
  );
}
