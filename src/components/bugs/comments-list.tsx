"use client";

import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { CommentInput } from "./comment-input";
import { CommentItem } from "./comment-item";

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface CommentsListProps {
  bugId: string;
  currentUserId: string;
  members?: Member[];
  className?: string;
}

export function CommentsList({
  bugId,
  currentUserId,
  members = [],
  className,
}: CommentsListProps) {
  const utils = trpc.useUtils();

  // Fetch comments
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = trpc.comments.getByBug.useInfiniteQuery(
    { bugId, limit: 50 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Create comment mutation
  const createMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      utils.comments.getByBug.invalidate({ bugId });
      utils.auditLogs.getByBug.invalidate({ bugId });
      toast.success("Comment added");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add comment");
    },
  });

  // Update comment mutation
  const updateMutation = trpc.comments.update.useMutation({
    onSuccess: () => {
      utils.comments.getByBug.invalidate({ bugId });
      toast.success("Comment updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update comment");
    },
  });

  // Delete comment mutation
  const deleteMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      utils.comments.getByBug.invalidate({ bugId });
      toast.success("Comment deleted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete comment");
    },
  });

  const handleCreate = async (content: string) => {
    await createMutation.mutateAsync({ bugId, content });
  };

  const handleEdit = async (commentId: string, content: string) => {
    await updateMutation.mutateAsync({ id: commentId, content });
  };

  const handleDelete = async (commentId: string) => {
    await deleteMutation.mutateAsync({ id: commentId });
  };

  const allComments = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Comments list */}
      {allComments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No comments yet. Be the first to comment!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {allComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={{
                ...comment,
                author: {
                  ...comment.author,
                  image: comment.author.avatarUrl,
                },
              }}
              currentUserId={currentUserId}
              members={members}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}

          {/* Load more */}
          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load more comments"
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* New comment input */}
      <div className="border-t pt-4">
        <CommentInput
          onSubmit={handleCreate}
          members={members}
          placeholder="Write a comment... Use @name to mention someone."
        />
      </div>
    </div>
  );
}
