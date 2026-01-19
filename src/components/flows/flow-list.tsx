"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Layers } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { FlowCard } from "./flow-card";
import { FlowForm } from "./flow-form";

interface Flow {
  id: string;
  name: string;
  description: string | null;
  order: number;
  _count?: {
    screenshots: number;
  };
  bugCount?: number;
}

interface FlowListProps {
  projectId: string;
  orgSlug: string;
}

export function FlowList({ projectId, orgSlug }: FlowListProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [deletingFlow, setDeletingFlow] = useState<Flow | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: flows = [], isLoading } = trpc.flows.getByProject.useQuery({
    projectId,
  });

  const createMutation = trpc.flows.create.useMutation({
    onSuccess: () => {
      toast.success("Flow created successfully");
      setIsCreateOpen(false);
      utils.flows.getByProject.invalidate({ projectId });
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.flows.update.useMutation({
    onSuccess: () => {
      toast.success("Flow updated successfully");
      setEditingFlow(null);
      utils.flows.getByProject.invalidate({ projectId });
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.flows.delete.useMutation({
    onSuccess: () => {
      toast.success("Flow deleted successfully");
      setDeletingFlow(null);
      utils.flows.getByProject.invalidate({ projectId });
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  const reorderMutation = trpc.flows.reorder.useMutation({
    onError: (error: { message: string }) => {
      toast.error(error.message);
      utils.flows.getByProject.invalidate({ projectId });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = flows.findIndex((f: Flow) => f.id === active.id);
      const newIndex = flows.findIndex((f: Flow) => f.id === over.id);

      const newOrder = arrayMove(flows, oldIndex, newIndex);
      const flowIds = newOrder.map((f: Flow) => f.id);

      // Optimistic update
      utils.flows.getByProject.setData({ projectId }, newOrder);

      reorderMutation.mutate({ projectId, flowIds });
    }
  };

  const activeFlow = activeId ? flows.find((f: Flow) => f.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-lg border bg-muted/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Flows</h2>
          <p className="text-sm text-muted-foreground">
            Organize screenshots by user flows. Drag to reorder.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Flow
        </Button>
      </div>

      {flows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/20">
          <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No flows yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Create flows to organize your screenshots by user journeys or features.
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create First Flow
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={flows.map((f: Flow) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {flows.map((flow: Flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  onEdit={setEditingFlow}
                  onDelete={setDeletingFlow}
                  onClick={() =>
                    router.push(
                      `/${orgSlug}/projects/${projectId}/flows/${flow.id}`
                    )
                  }
                  isDragging={activeId === flow.id}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeFlow ? (
              <FlowCard
                flow={activeFlow}
                onEdit={() => {}}
                onDelete={() => {}}
                onClick={() => {}}
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Flow</DialogTitle>
            <DialogDescription>
              Create a flow to group related screenshots together.
            </DialogDescription>
          </DialogHeader>
          <FlowForm
            mode="create"
            projectId={projectId}
            onSubmit={async (data) => {
              if ("flowId" in data) return;
              await createMutation.mutateAsync(data);
            }}
            onCancel={() => setIsCreateOpen(false)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingFlow} onOpenChange={() => setEditingFlow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Flow</DialogTitle>
            <DialogDescription>
              Update the flow name and description.
            </DialogDescription>
          </DialogHeader>
          {editingFlow && (
            <FlowForm
              mode="edit"
              projectId={projectId}
              defaultValues={editingFlow}
              onSubmit={async (data) => {
                if (!("flowId" in data)) return;
                await updateMutation.mutateAsync(data);
              }}
              onCancel={() => setEditingFlow(null)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingFlow}
        onOpenChange={() => setDeletingFlow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deletingFlow?.name}&quot; and
              all its screenshots and annotations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingFlow) {
                  deleteMutation.mutate({
                    projectId,
                    flowId: deletingFlow.id,
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
