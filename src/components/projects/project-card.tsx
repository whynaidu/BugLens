"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  MoreHorizontal,
  Archive,
  ArchiveRestore,
  Pencil,
  Trash2,
  FolderKanban,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    color: string;
    isArchived: boolean;
    updatedAt: Date;
    _count: {
      modules: number;
      testCases: number;
    };
    testCaseStats: {
      passed: number;
      failed: number;
      pending: number;
      total: number;
    };
  };
  organizationId: string;
  onEdit?: (project: ProjectCardProps["project"]) => void;
}

export function ProjectCard({ project, organizationId, onEdit }: ProjectCardProps) {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  const archiveMutation = trpc.projects.archive.useMutation({
    onSuccess: (data) => {
      toast.success(data.isArchived ? "Project archived" : "Project restored");
      utils.projects.getByOrganization.invalidate({ organizationId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update project");
    },
  });

  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted");
      utils.projects.getByOrganization.invalidate({ organizationId });
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete project");
    },
  });

  const handleArchive = () => {
    archiveMutation.mutate({
      organizationId,
      projectId: project.id,
      isArchived: !project.isArchived,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({
      organizationId,
      projectId: project.id,
    });
  };

  return (
    <>
      <Card
        className={`group hover:shadow-md transition-all ${
          project.isArchived ? "opacity-60" : ""
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <Link
              href={`/${orgSlug}/projects/${project.id}`}
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: project.color }}
              >
                <FolderKanban className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg truncate flex items-center gap-2">
                  {project.name}
                  {project.isArchived && (
                    <Badge variant="secondary" className="text-xs">
                      Archived
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="truncate">
                  {project._count.modules} modules &middot; {project._count.testCases} test cases
                </CardDescription>
              </div>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(project)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleArchive}>
                  {project.isArchived ? (
                    <>
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Restore
                    </>
                  ) : (
                    <>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <Link href={`/${orgSlug}/projects/${project.id}`}>
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {project.description}
              </p>
            )}

            {/* Test Case Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">
                  {project.testCaseStats.passed} passed
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-muted-foreground">
                  {project.testCaseStats.failed} failed
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">
                  {project.testCaseStats.pending} pending
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t text-xs text-muted-foreground">
              <span>
                Updated{" "}
                {formatDistanceToNow(new Date(project.updatedAt), {
                  addSuffix: true,
                })}
              </span>
              {project.testCaseStats.total > 0 && (
                <div className="flex items-center gap-1">
                  <CheckSquare className="h-3 w-3" />
                  <span>{project.testCaseStats.total} total</span>
                </div>
              )}
            </div>
          </Link>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{project.name}&quot;? This will
              permanently delete all modules, test cases, screenshots, and related data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
