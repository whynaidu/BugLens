"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Check,
  ExternalLink,
  Loader2,
  PlayCircle,
  Settings2,
  Unplug,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { trpc } from "@/lib/trpc";

// BugLens severity and status options
const bugSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const bugStatuses = ["OPEN", "IN_PROGRESS", "IN_REVIEW", "RESOLVED", "CLOSED", "WONT_FIX"] as const;

// Azure DevOps priority mapping (1 = highest, 4 = lowest)
const azurePriorities = [1, 2, 3, 4] as const;

interface AzureDevOpsSettingsProps {
  organizationId: string;
  orgSlug: string;
}

export function AzureDevOpsSettings({ organizationId, orgSlug }: AzureDevOpsSettingsProps) {
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedWorkItemType, setSelectedWorkItemType] = useState<string>("");
  const [stateMapping, setStateMapping] = useState<Record<string, string>>({});
  const [severityMapping, setSeverityMapping] = useState<Record<string, number>>({});

  const utils = trpc.useUtils();

  // Queries
  const { data: config, isLoading: configLoading } = trpc.integrations.getAzureDevOpsConfig.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );

  const { data: organizations } = trpc.integrations.getAzureDevOpsOrganizations.useQuery(
    { organizationId },
    { enabled: !!organizationId && !!config?.isConnected }
  );

  const { data: projects } = trpc.integrations.getAzureDevOpsProjects.useQuery(
    { organizationId, azureOrganization: selectedOrg },
    { enabled: !!organizationId && !!selectedOrg }
  );

  const { data: workItemTypes } = trpc.integrations.getAzureDevOpsWorkItemTypes.useQuery(
    { organizationId, azureOrganization: selectedOrg, azureProject: selectedProject },
    { enabled: !!organizationId && !!selectedOrg && !!selectedProject }
  );

  const { data: states } = trpc.integrations.getAzureDevOpsStates.useQuery(
    {
      organizationId,
      azureOrganization: selectedOrg,
      azureProject: selectedProject,
      workItemType: selectedWorkItemType,
    },
    { enabled: !!organizationId && !!selectedOrg && !!selectedProject && !!selectedWorkItemType }
  );

  // Mutations
  const getOAuthUrl = trpc.integrations.getAzureDevOpsOAuthUrl.useMutation();
  const testConnection = trpc.integrations.testAzureDevOpsConnection.useMutation();
  const disconnectAzure = trpc.integrations.disconnectAzureDevOps.useMutation({
    onSuccess: () => {
      utils.integrations.getAll.invalidate();
      utils.integrations.getAzureDevOpsConfig.invalidate();
      toast.success("Azure DevOps disconnected");
    },
    onError: (error) => {
      toast.error("Failed to disconnect Azure DevOps", { description: error.message });
    },
  });

  const updateMapping = trpc.integrations.updateAzureDevOpsMapping.useMutation({
    onSuccess: () => {
      utils.integrations.getAzureDevOpsConfig.invalidate();
      toast.success("Azure DevOps configuration saved");
    },
    onError: (error) => {
      toast.error("Failed to save configuration", { description: error.message });
    },
  });

  // Track if we've initialized from config to avoid cascading renders
  const initializedRef = useRef(false);

  // Initialize state from config (only once when config first loads)
  useEffect(() => {
    if (config && !initializedRef.current) {
      initializedRef.current = true;
      // Batch state updates in a microtask to avoid synchronous cascading renders
      queueMicrotask(() => {
        setSelectedOrg(config.organization || "");
        setSelectedProject(config.project || "");
        setSelectedWorkItemType(config.workItemType || "");
        if (config.stateMapping) {
          setStateMapping(config.stateMapping);
        }
        if (config.severityMapping) {
          setSeverityMapping(config.severityMapping);
        }
      });
    }
  }, [config]);

  const handleConnect = async () => {
    try {
      const { url } = await getOAuthUrl.mutateAsync({ orgSlug });
      window.location.href = url;
    } catch {
      toast.error("Failed to start Azure DevOps connection");
    }
  };

  const handleTest = async () => {
    const result = await testConnection.mutateAsync({ organizationId });
    if (result.ok && "user" in result) {
      toast.success(`Connected as ${result.user}`);
    } else if (!result.ok) {
      toast.error("Connection test failed", { description: result.error });
    }
  };

  const handleSaveMapping = async () => {
    if (!selectedOrg || !selectedProject || !selectedWorkItemType) {
      toast.error("Please select organization, project, and work item type");
      return;
    }

    await updateMapping.mutateAsync({
      organizationId,
      azureOrganization: selectedOrg,
      azureProject: selectedProject,
      workItemType: selectedWorkItemType,
      stateMapping,
      severityMapping,
    });
  };

  if (configLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#0078D4]/10">
              <svg className="h-6 w-6 text-[#0078D4]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 8.877L2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v8.225L0 15.707V8.877zm24-4.45v14.651l-5.753 4.9-9.303-3.057v3.056l-5.978-7.416 15.057 1.798V5.415L24 4.427z"/>
              </svg>
            </div>
            <div>
              <CardTitle className="text-lg">Azure DevOps</CardTitle>
              <CardDescription>
                Sync bugs with Azure DevOps work items
              </CardDescription>
            </div>
          </div>
          {config?.isConnected && (
            <Badge variant={config.isActive ? "default" : "secondary"}>
              {config.isActive ? "Connected" : "Disabled"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {config?.isConnected ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              <span>Azure DevOps connected</span>
            </div>

            <Separator />

            {/* Organization/Project Selection */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Project Configuration
              </h4>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Select
                    value={selectedOrg}
                    onValueChange={(value) => {
                      setSelectedOrg(value);
                      setSelectedProject("");
                      setSelectedWorkItemType("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations?.map((org) => (
                        <SelectItem key={org.accountId} value={org.accountName}>
                          {org.accountName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select
                    value={selectedProject}
                    onValueChange={(value) => {
                      setSelectedProject(value);
                      setSelectedWorkItemType("");
                    }}
                    disabled={!selectedOrg}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.name}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Work Item Type</Label>
                  <Select
                    value={selectedWorkItemType}
                    onValueChange={setSelectedWorkItemType}
                    disabled={!selectedProject}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select work item type" />
                    </SelectTrigger>
                    <SelectContent>
                      {workItemTypes?.map((type) => (
                        <SelectItem key={type.referenceName} value={type.name}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {selectedWorkItemType && (
              <>
                <Separator />

                {/* Field Mapping */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="severity-mapping">
                    <AccordionTrigger>
                      Severity to Priority Mapping
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        <p className="text-sm text-muted-foreground">
                          Map BugLens severity to Azure DevOps priority (1=Highest, 4=Lowest)
                        </p>
                        <div className="grid gap-3">
                          {bugSeverities.map((severity) => (
                            <div key={severity} className="flex items-center gap-4">
                              <Label className="w-24">{severity}</Label>
                              <Select
                                value={String(severityMapping[severity] || "")}
                                onValueChange={(value) =>
                                  setSeverityMapping((prev) => ({
                                    ...prev,
                                    [severity]: parseInt(value),
                                  }))
                                }
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                  {azurePriorities.map((priority) => (
                                    <SelectItem key={priority} value={String(priority)}>
                                      Priority {priority}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="status-mapping">
                    <AccordionTrigger>
                      Status to State Mapping
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        <p className="text-sm text-muted-foreground">
                          Map BugLens statuses to Azure DevOps states
                        </p>
                        <div className="grid gap-3">
                          {bugStatuses.map((status) => (
                            <div key={status} className="flex items-center gap-4">
                              <Label className="w-28 text-xs">{status.replace("_", " ")}</Label>
                              <Select
                                value={stateMapping[status] || ""}
                                onValueChange={(value) =>
                                  setStateMapping((prev) => ({
                                    ...prev,
                                    [status]: value,
                                  }))
                                }
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                                <SelectContent>
                                  {states?.map((state) => (
                                    <SelectItem key={state.name} value={state.name}>
                                      {state.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            )}

            <Button
              onClick={handleSaveMapping}
              disabled={updateMapping.isPending || !selectedOrg || !selectedProject || !selectedWorkItemType}
            >
              {updateMapping.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Configuration
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your Azure DevOps organization to sync bugs with work items.
            </p>
            <a
              href="https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary flex items-center gap-1 hover:underline"
            >
              Learn about Azure DevOps OAuth setup
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t pt-4">
        {config?.isConnected ? (
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Unplug className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Azure DevOps?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will stop all Azure DevOps sync for this organization.
                    Existing linked bugs will keep their work item references.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => disconnectAzure.mutate({ organizationId })}
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={getOAuthUrl.isPending}>
            {getOAuthUrl.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 8.877L2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v8.225L0 15.707V8.877zm24-4.45v14.651l-5.753 4.9-9.303-3.057v3.056l-5.978-7.416 15.057 1.798V5.415L24 4.427z"/>
              </svg>
            )}
            Connect Azure DevOps
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
