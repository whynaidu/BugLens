"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Plus, RefreshCw, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ModuleTree } from "@/components/modules/module-tree";
import { ModuleFormDialog } from "@/components/modules/module-form";
import { TestCaseList } from "@/components/testcases/testcase-list";
import { ImportDialog } from "@/components/testcases/import-dialog";
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

export default function ModulesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = params.orgSlug as string;
  const projectId = params.projectId as string;

  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Auto-open create dialog if ?create=true is in URL
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setCreateDialogOpen(true);
      // Remove the query param from URL
      router.replace(`/${orgSlug}/projects/${projectId}/modules`);
    }
  }, [searchParams, router, orgSlug, projectId]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parentIdForCreate, setParentIdForCreate] = useState<string | null>(null);
  const [moduleToEdit, setModuleToEdit] = useState<{
    id: string;
    name: string;
    description: string | null;
  } | null>(null);
  const [moduleToDelete, setModuleToDelete] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: modulesData, isLoading: isLoadingModules } =
    trpc.modules.getByProject.useQuery({ projectId });

  const { data: selectedModule, isLoading: isLoadingSelected } =
    trpc.modules.getById.useQuery(
      { moduleId: selectedModuleId! },
      { enabled: !!selectedModuleId }
    );

  const createModuleMutation = trpc.modules.create.useMutation({
    onSuccess: (module) => {
      toast.success("Module created");
      setCreateDialogOpen(false);
      utils.modules.getByProject.invalidate({ projectId });
      setSelectedModuleId(module.id);
      // Expand parent if creating sub-module
      if (parentIdForCreate) {
        setExpandedIds((prev) => new Set([...prev, parentIdForCreate]));
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateModuleMutation = trpc.modules.update.useMutation({
    onSuccess: () => {
      toast.success("Module updated");
      setEditDialogOpen(false);
      utils.modules.getByProject.invalidate({ projectId });
      if (selectedModuleId) {
        utils.modules.getById.invalidate({ moduleId: selectedModuleId });
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteModuleMutation = trpc.modules.delete.useMutation({
    onSuccess: () => {
      toast.success("Module deleted");
      setDeleteDialogOpen(false);
      utils.modules.getByProject.invalidate({ projectId });
      if (selectedModuleId === moduleToDelete) {
        setSelectedModuleId(null);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreateModule = (parentId: string | null) => {
    setParentIdForCreate(parentId);
    setCreateDialogOpen(true);
  };

  const handleEditModule = (moduleId: string) => {
    const module = modulesData?.modules.find((m) => m.id === moduleId);
    if (module) {
      setModuleToEdit({
        id: module.id,
        name: module.name,
        description: module.description,
      });
      setEditDialogOpen(true);
    }
  };

  const handleDeleteModule = (moduleId: string) => {
    setModuleToDelete(moduleId);
    setDeleteDialogOpen(true);
  };

  const handleToggleExpand = (moduleId: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  const parentModuleName = parentIdForCreate
    ? modulesData?.modules.find((m) => m.id === parentIdForCreate)?.name
    : undefined;

  return (
    <div className="container py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modules</h1>
          <p className="text-muted-foreground">
            Organize test cases into hierarchical modules
          </p>
        </div>
        <Button onClick={() => handleCreateModule(null)}>
          <Plus className="mr-2 h-4 w-4" />
          New Module
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Module Tree Sidebar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Module Structure</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingModules ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <ModuleTree
                modules={modulesData?.tree ?? []}
                selectedModuleId={selectedModuleId}
                onSelectModule={setSelectedModuleId}
                onCreateModule={handleCreateModule}
                onEditModule={handleEditModule}
                onDeleteModule={handleDeleteModule}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
              />
            )}
          </CardContent>
        </Card>

        {/* Module Details / Test Cases */}
        <div>
          {selectedModuleId ? (
            isLoadingSelected ? (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                </CardContent>
              </Card>
            ) : selectedModule ? (
              <div className="space-y-6">
                {/* Module Header */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{selectedModule.name}</CardTitle>
                        {selectedModule.description && (
                          <p className="mt-1 text-muted-foreground">
                            {selectedModule.description}
                          </p>
                        )}
                        {/* Breadcrumb */}
                        {selectedModule.breadcrumb.length > 1 && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {selectedModule.breadcrumb
                              .map((b) => b.name)
                              .join(" / ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setImportDialogOpen(true)}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Import
                        </Button>
                        <Button
                          onClick={() =>
                            router.push(
                              `/${orgSlug}/projects/${projectId}/modules/${selectedModuleId}/testcases/new`
                            )
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          New Test Case
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>{selectedModule._count.testCases} test cases</span>
                      <span>{selectedModule._count.children} sub-modules</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Sub-modules */}
                {selectedModule.children.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Sub-modules</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 md:grid-cols-2">
                        {selectedModule.children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => {
                              setSelectedModuleId(child.id);
                              setExpandedIds(
                                (prev) =>
                                  new Set([...prev, selectedModule.id])
                              );
                            }}
                            className="flex items-center justify-between rounded-lg border p-3 text-left hover:bg-accent"
                          >
                            <span className="font-medium">{child.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {child._count.testCases} tests
                            </span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Test Cases */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Test Cases</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TestCaseList
                      testCases={selectedModule.testCases}
                      orgSlug={orgSlug}
                      projectId={projectId}
                      moduleId={selectedModuleId}
                      emptyMessage="No test cases in this module yet"
                    />
                  </CardContent>
                </Card>
              </div>
            ) : null
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">Select a module</p>
                <p className="text-muted-foreground">
                  Choose a module from the tree to view its test cases
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Module Dialog */}
      <ModuleFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        parentModuleName={parentModuleName}
        isLoading={createModuleMutation.isPending}
        onSubmit={(values) => {
          createModuleMutation.mutate({
            projectId,
            parentId: parentIdForCreate,
            name: values.name,
            description: values.description,
          });
        }}
      />

      {/* Edit Module Dialog */}
      {moduleToEdit && (
        <ModuleFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          mode="edit"
          initialValues={{
            name: moduleToEdit.name,
            description: moduleToEdit.description,
          }}
          isLoading={updateModuleMutation.isPending}
          onSubmit={(values) => {
            updateModuleMutation.mutate({
              moduleId: moduleToEdit.id,
              name: values.name,
              description: values.description,
            });
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Module</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this module? This will also delete
              all sub-modules and test cases within it. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (moduleToDelete) {
                  deleteModuleMutation.mutate({ moduleId: moduleToDelete });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Test Cases Dialog */}
      {selectedModuleId && selectedModule && (
        <ImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          moduleId={selectedModuleId}
          moduleName={selectedModule.name}
          onSuccess={() => {
            utils.modules.getById.invalidate({ moduleId: selectedModuleId });
          }}
        />
      )}
    </div>
  );
}
