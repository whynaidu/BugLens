"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import {
  Plus,
  LayoutList,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Bug,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BugList, BugBulkActions } from "@/components/bugs/bug-list";
import { BugFilters, useBugFilters } from "@/components/bugs/bug-filters";
import { BugDialog } from "@/components/annotation/bug-dialog";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import type { BugStatus } from "@/lib/validations/bug";

const PAGE_SIZES = [10, 25, 50, 100];

export default function BugsPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const projectId = params.projectId as string;
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // URL state
  const [sortBy, setSortBy] = useQueryState("sortBy", parseAsString.withDefault("createdAt"));
  const [sortOrder, setSortOrder] = useQueryState("sortOrder", parseAsString.withDefault("desc"));
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState("limit", parseAsInteger.withDefault(25));
  const [viewMode, setViewMode] = useQueryState("view", parseAsString.withDefault("list"));

  // Component state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Get filters from URL
  const filters = useBugFilters();

  // Fetch bugs
  const { data, isLoading, error } = trpc.bugs.getByProject.useQuery({
    projectId,
    status: filters.status.length > 0 ? filters.status : undefined,
    severity: filters.severity.length > 0 ? filters.severity : undefined,
    priority: filters.priority.length > 0 ? filters.priority : undefined,
    assigneeId: filters.assigneeId ?? undefined,
    search: filters.search || undefined,
    sortBy: sortBy as "title" | "status" | "severity" | "priority" | "createdAt" | "updatedAt",
    sortOrder: sortOrder as "asc" | "desc",
    page,
    pageSize,
  });

  // Fetch project members for filters and bulk actions
  const { data: members } = trpc.bugs.getProjectMembers.useQuery({ projectId });

  // Bulk update mutations
  const bulkUpdateStatus = trpc.bugs.bulkUpdateStatus.useMutation({
    onSuccess: (result) => {
      toast({
        title: "Status updated",
        description: `Updated ${result.updated} bug(s)`,
      });
      utils.bugs.getByProject.invalidate({ projectId });
      setSelectedIds([]);
    },
    onError: (error) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkAssign = trpc.bugs.bulkAssign.useMutation({
    onSuccess: (result) => {
      toast({
        title: "Assignee updated",
        description: `Updated ${result.updated} bug(s)`,
      });
      utils.bugs.getByProject.invalidate({ projectId });
      setSelectedIds([]);
    },
    onError: (error) => {
      toast({
        title: "Failed to update assignee",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = trpc.bugs.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Bug deleted" });
      utils.bugs.getByProject.invalidate({ projectId });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete bug",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleSortChange = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const handleStatusChange = (status: BugStatus) => {
    bulkUpdateStatus.mutate({ bugIds: selectedIds, status });
  };

  const handleAssign = (assigneeId: string | null) => {
    bulkAssign.mutate({ bugIds: selectedIds, assigneeId });
  };

  const handleDelete = (bugId: string) => {
    deleteMutation.mutate({ bugId });
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value, 10));
    setPage(1);
  };

  // Pagination calculations
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;
  const startItem = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endItem = Math.min(page * pageSize, totalCount);

  // Transform bugs to match the BugList component interface
  const transformedBugs = data?.bugs.map((bug) => ({
    id: bug.id,
    title: bug.title,
    status: bug.status,
    severity: bug.severity,
    priority: bug.priority,
    createdAt: bug.createdAt,
    updatedAt: bug.updatedAt,
    creator: {
      id: bug.creator.id,
      name: bug.creator.name,
      email: bug.creator.email,
      image: bug.creator.avatarUrl,
    },
    assignee: bug.assignee ? {
      id: bug.assignee.id,
      name: bug.assignee.name,
      email: bug.assignee.email,
      image: bug.assignee.avatarUrl,
    } : null,
    _count: bug._count,
  })) ?? [];

  // Transform members for BugList
  const transformedMembers = members?.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    image: m.avatarUrl,
  })) ?? [];

  if (error) {
    return (
      <div className="container py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load bugs. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${orgSlug}`}>Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${orgSlug}/projects`}>Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${orgSlug}/projects/${projectId}`}>Project</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Bugs</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bug className="h-6 w-6" />
            Bugs
          </h1>
          <p className="text-muted-foreground">
            Track and manage bugs for this project
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode("kanban")}
              disabled
              title="Kanban view coming soon"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Bug
          </Button>
        </div>
      </div>

      {/* Filters */}
      <BugFilters members={transformedMembers} />

      {/* Bulk Actions */}
      <BugBulkActions
        selectedCount={selectedIds.length}
        onStatusChange={handleStatusChange}
        onAssign={handleAssign}
        onClearSelection={() => setSelectedIds([])}
        members={transformedMembers}
      />

      {/* Bug List */}
      <BugList
        bugs={transformedBugs}
        isLoading={isLoading}
        orgSlug={orgSlug}
        projectId={projectId}
        sortBy={sortBy}
        sortOrder={sortOrder as "asc" | "desc"}
        onSortChange={handleSortChange}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onDelete={handleDelete}
      />

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {startItem} to {endItem} of {totalCount} bugs
            </span>
            <span className="text-muted-foreground/50">|</span>
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <Select
                value={pageSize.toString()}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-1 text-sm">
              <span>Page</span>
              <span className="font-medium">{page}</span>
              <span>of</span>
              <span className="font-medium">{totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Bug Dialog */}
      <BugDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        projectId={projectId}
        onSuccess={() => {
          utils.bugs.getByProject.invalidate({ projectId });
        }}
      />
    </div>
  );
}
