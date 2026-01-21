"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Search, Filter, User, FolderKanban, Layers, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { TestCaseList } from "@/components/testcases/testcase-list";
import type { TestCaseStatus, Severity, Priority } from "@/lib/validations/testcase";

const statusOptions: TestCaseStatus[] = [
  "DRAFT",
  "PENDING",
  "PASSED",
  "FAILED",
  "BLOCKED",
  "SKIPPED",
];

const severityOptions: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const priorityOptions: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

// Helper to flatten module tree with indentation
interface FlatModule {
  id: string;
  name: string;
  depth: number;
  fullPath: string;
}

function flattenModules(
  modules: Array<{
    id: string;
    name: string;
    children?: Array<{ id: string; name: string; children?: unknown[] }>;
  }>,
  depth = 0,
  parentPath = ""
): FlatModule[] {
  const result: FlatModule[] = [];
  for (const module of modules) {
    const fullPath = parentPath ? `${parentPath} / ${module.name}` : module.name;
    result.push({ id: module.id, name: module.name, depth, fullPath });
    if (module.children && module.children.length > 0) {
      result.push(...flattenModules(module.children as typeof modules, depth + 1, fullPath));
    }
  }
  return result;
}

export default function TestCasesPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const [search, setSearch] = useState("");
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [moduleId, setModuleId] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<TestCaseStatus[]>([]);
  const [severityFilter, setSeverityFilter] = useState<Severity[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([]);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "title">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // First get the organization to get its ID
  const { data: organization } = trpc.organizations.getBySlug.useQuery({ slug: orgSlug });

  // Fetch projects for the organization
  const { data: projects } = trpc.projects.getByOrganization.useQuery(
    { organizationId: organization?.id! },
    { enabled: !!organization?.id }
  );

  // Fetch modules for the selected project
  const { data: modulesData } = trpc.modules.getByProject.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  // Flatten modules for the dropdown
  const flatModules = useMemo(() => {
    if (!modulesData?.tree) return [];
    return flattenModules(modulesData.tree);
  }, [modulesData?.tree]);

  const { data, isLoading } = trpc.testcases.getByOrganization.useQuery({
    orgSlug,
    projectId,
    moduleId,
    search: search || undefined,
    assignedToMe,
    status: statusFilter.length > 0 ? statusFilter : undefined,
    severity: severityFilter.length > 0 ? severityFilter : undefined,
    priority: priorityFilter.length > 0 ? priorityFilter : undefined,
    page,
    pageSize: 20,
    sortBy,
    sortOrder,
  });

  const toggleStatus = (status: TestCaseStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
    setPage(1);
  };

  const toggleSeverity = (severity: Severity) => {
    setSeverityFilter((prev) =>
      prev.includes(severity)
        ? prev.filter((s) => s !== severity)
        : [...prev, severity]
    );
    setPage(1);
  };

  const togglePriority = (priority: Priority) => {
    setPriorityFilter((prev) =>
      prev.includes(priority)
        ? prev.filter((p) => p !== priority)
        : [...prev, priority]
    );
    setPage(1);
  };

  const clearFilters = () => {
    setStatusFilter([]);
    setSeverityFilter([]);
    setPriorityFilter([]);
    setAssignedToMe(false);
    setProjectId(undefined);
    setModuleId(undefined);
    setSearch("");
    setPage(1);
  };

  const hasFilters =
    statusFilter.length > 0 ||
    severityFilter.length > 0 ||
    priorityFilter.length > 0 ||
    assignedToMe ||
    projectId ||
    moduleId ||
    search;

  // Get selected project/module names for display
  const selectedProject = projects?.find((p) => p.id === projectId);
  const selectedModule = flatModules.find((m) => m.id === moduleId);

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Test Cases</h1>
        <p className="text-muted-foreground">
          View all test cases across your organization
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search test cases..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* Project Filter */}
            <Select
              value={projectId || "all"}
              onValueChange={(value) => {
                const newProjectId = value === "all" ? undefined : value;
                setProjectId(newProjectId);
                setModuleId(undefined); // Reset module when project changes
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <FolderKanban className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Module Filter (only visible when project is selected) */}
            {projectId && (
              <Select
                value={moduleId || "all"}
                onValueChange={(value) => {
                  setModuleId(value === "all" ? undefined : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <Layers className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {selectedModule ? selectedModule.name : "All Modules"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {flatModules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      <span style={{ paddingLeft: `${module.depth * 12}px` }}>
                        {module.depth > 0 ? "└ " : ""}{module.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Assigned to me toggle */}
            <Button
              variant={assignedToMe ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setAssignedToMe(!assignedToMe);
                setPage(1);
              }}
            >
              <User className="mr-2 h-4 w-4" />
              Assigned to me
            </Button>

            {/* Filter Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                  {hasFilters && (
                    <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      {statusFilter.length +
                        severityFilter.length +
                        priorityFilter.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  {/* Status */}
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {statusOptions.map((status) => (
                        <div
                          key={status}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`status-${status}`}
                            checked={statusFilter.includes(status)}
                            onCheckedChange={() => toggleStatus(status)}
                          />
                          <label
                            htmlFor={`status-${status}`}
                            className="text-sm"
                          >
                            {status}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Severity */}
                  <div>
                    <Label className="text-sm font-medium">Severity</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {severityOptions.map((severity) => (
                        <div
                          key={severity}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`severity-${severity}`}
                            checked={severityFilter.includes(severity)}
                            onCheckedChange={() => toggleSeverity(severity)}
                          />
                          <label
                            htmlFor={`severity-${severity}`}
                            className="text-sm"
                          >
                            {severity}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <Label className="text-sm font-medium">Priority</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {priorityOptions.map((priority) => (
                        <div
                          key={priority}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`priority-${priority}`}
                            checked={priorityFilter.includes(priority)}
                            onCheckedChange={() => togglePriority(priority)}
                          />
                          <label
                            htmlFor={`priority-${priority}`}
                            className="text-sm"
                          >
                            {priority}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {hasFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={clearFilters}
                    >
                      Clear all filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Sort */}
            <Select
              value={`${sortBy}-${sortOrder}`}
              onValueChange={(value) => {
                const [newSortBy, newSortOrder] = value.split("-") as [
                  "createdAt" | "updatedAt" | "title",
                  "asc" | "desc"
                ];
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">Newest first</SelectItem>
                <SelectItem value="createdAt-asc">Oldest first</SelectItem>
                <SelectItem value="updatedAt-desc">Recently updated</SelectItem>
                <SelectItem value="title-asc">Title A-Z</SelectItem>
                <SelectItem value="title-desc">Title Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data?.pagination.totalCount ?? 0} test cases found
            </p>
          </div>

          {/* Test Case List */}
          <TestCaseList
            testCases={data?.testCases ?? []}
            orgSlug={orgSlug}
            emptyMessage="No test cases match your filters"
          />

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.pagination.hasMore}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
