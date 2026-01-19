"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Bug,
  FolderOpen,
  Search,
  ImageOff,
  Users,
  FileQuestion,
  Plus,
} from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick}>
          <Plus className="mr-2 h-4 w-4" />
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function EmptyProjects({ onCreateProject }: { onCreateProject?: () => void }) {
  return (
    <EmptyState
      icon={<FolderOpen className="h-8 w-8 text-muted-foreground" />}
      title="No projects yet"
      description="Create your first project to start tracking bugs and collaborating with your team."
      action={onCreateProject ? { label: "Create Project", onClick: onCreateProject } : undefined}
    />
  );
}

export function EmptyBugs({ onCreateBug }: { onCreateBug?: () => void }) {
  return (
    <EmptyState
      icon={<Bug className="h-8 w-8 text-muted-foreground" />}
      title="No bugs found"
      description="Great news! There are no bugs to show. Create one when you find an issue."
      action={onCreateBug ? { label: "Report Bug", onClick: onCreateBug } : undefined}
    />
  );
}

export function EmptySearchResults({ query }: { query?: string }) {
  return (
    <EmptyState
      icon={<Search className="h-8 w-8 text-muted-foreground" />}
      title="No results found"
      description={
        query
          ? `No matches found for "${query}". Try adjusting your search or filters.`
          : "Try adjusting your search terms or filters."
      }
    />
  );
}

export function EmptyScreenshots({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      icon={<ImageOff className="h-8 w-8 text-muted-foreground" />}
      title="No screenshots"
      description="Upload screenshots to annotate and track visual issues."
      action={onUpload ? { label: "Upload Screenshot", onClick: onUpload } : undefined}
    />
  );
}

export function EmptyMembers({ onInvite }: { onInvite?: () => void }) {
  return (
    <EmptyState
      icon={<Users className="h-8 w-8 text-muted-foreground" />}
      title="No team members"
      description="Invite team members to collaborate on bug tracking and testing."
      action={onInvite ? { label: "Invite Member", onClick: onInvite } : undefined}
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      icon={<FileQuestion className="h-8 w-8 text-muted-foreground" />}
      title="No notifications"
      description="You're all caught up! Notifications will appear here when there's activity."
    />
  );
}

export function EmptyComments({ onAddComment }: { onAddComment?: () => void }) {
  return (
    <EmptyState
      icon={<FileQuestion className="h-8 w-8 text-muted-foreground" />}
      title="No comments yet"
      description="Be the first to leave a comment on this bug."
      action={onAddComment ? { label: "Add Comment", onClick: onAddComment } : undefined}
      className="py-6"
    />
  );
}

export function EmptyFlows({ onCreateFlow }: { onCreateFlow?: () => void }) {
  return (
    <EmptyState
      icon={<FolderOpen className="h-8 w-8 text-muted-foreground" />}
      title="No flows yet"
      description="Create flows to organize your screenshots and testing sessions."
      action={onCreateFlow ? { label: "Create Flow", onClick: onCreateFlow } : undefined}
    />
  );
}
