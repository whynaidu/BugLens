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
  RefreshCw,
  ArrowRightLeft,
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

interface JiraSettingsProps {
  organizationId: string;
  orgSlug: string;
}

export function JiraSettings({ organizationId, orgSlug }: JiraSettingsProps) {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedIssueType, setSelectedIssueType] = useState<string>("");
  const [syncDirection, setSyncDirection] = useState<"push" | "pull" | "both">("push");
  const [severityMapping, setSeverityMapping] = useState<Record<string, string>>({});
  const [statusMapping, setStatusMapping] = useState<Record<string, string>>({});
  const [reverseStatusMapping, setReverseStatusMapping] = useState<Record<string, string>>({});
  const [reversePriorityMapping, setReversePriorityMapping] = useState<Record<string, string>>({});

  const utils = trpc.useUtils();

  // Queries
  const { data: config, isLoading: configLoading } = trpc.integrations.getJiraConfig.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );

  const { data: projects } = trpc.integrations.getJiraProjects.useQuery(
    { organizationId },
    { enabled: !!organizationId && !!config?.isConnected }
  );

  const { data: issueTypes } = trpc.integrations.getJiraIssueTypes.useQuery(
    { organizationId, projectKey: selectedProject },
    { enabled: !!organizationId && !!selectedProject }
  );

  const { data: priorities } = trpc.integrations.getJiraPriorities.useQuery(
    { organizationId },
    { enabled: !!organizationId && !!config?.isConnected }
  );

  const { data: statuses } = trpc.integrations.getJiraStatuses.useQuery(
    { organizationId },
    { enabled: !!organizationId && !!config?.isConnected }
  );

  // Mutations
  const getJiraOAuthUrl = trpc.integrations.getJiraOAuthUrl.useMutation();
  const testConnection = trpc.integrations.testJiraConnection.useMutation();
  const disconnectJira = trpc.integrations.disconnectJira.useMutation({
    onSuccess: () => {
      utils.integrations.getAll.invalidate();
      utils.integrations.getJiraConfig.invalidate();
      toast.success("Jira disconnected");
    },
    onError: (error) => {
      toast.error("Failed to disconnect Jira", { description: error.message });
    },
  });

  const updateMapping = trpc.integrations.updateJiraMapping.useMutation({
    onSuccess: () => {
      utils.integrations.getJiraConfig.invalidate();
      toast.success("Jira configuration saved");
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
        setSelectedProject(config.projectKey || "");
        setSelectedIssueType(config.issueType || "");
        setSyncDirection(config.syncDirection || "push");
        if (config.fieldMapping) {
          setSeverityMapping(config.fieldMapping.severityToPriority || {});
          setStatusMapping(config.fieldMapping.statusToStatus || {});
          setReverseStatusMapping(config.fieldMapping.statusFromJira || {});
          setReversePriorityMapping(config.fieldMapping.priorityToSeverity || {});
        }
      });
    }
  }, [config]);

  const handleConnect = async () => {
    try {
      const { url } = await getJiraOAuthUrl.mutateAsync({ orgSlug });
      window.location.href = url;
    } catch {
      toast.error("Failed to start Jira connection");
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
    if (!selectedProject || !selectedIssueType) {
      toast.error("Please select a project and issue type");
      return;
    }

    await updateMapping.mutateAsync({
      organizationId,
      projectKey: selectedProject,
      issueType: selectedIssueType,
      fieldMapping: {
        severityToPriority: severityMapping,
        statusToStatus: statusMapping,
        statusFromJira: reverseStatusMapping,
        priorityToSeverity: reversePriorityMapping,
      },
      syncDirection,
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
            <div className="p-2 rounded-lg bg-[#0052CC]/10">
              <svg className="h-6 w-6 text-[#0052CC]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.004-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.004 1.004 0 0 0 23.013 0z"/>
              </svg>
            </div>
            <div>
              <CardTitle className="text-lg">Jira</CardTitle>
              <CardDescription>
                Sync bugs with Jira issues
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
            {config.siteUrl && (
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                <span>Connected to <strong>{config.siteUrl}</strong></span>
                <a
                  href={config.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <Separator />

            {/* Project Selection */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Project Configuration
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Jira Project</Label>
                  <Select
                    value={selectedProject}
                    onValueChange={setSelectedProject}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.key}>
                          {project.name} ({project.key})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Issue Type</Label>
                  <Select
                    value={selectedIssueType}
                    onValueChange={setSelectedIssueType}
                    disabled={!selectedProject}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select issue type" />
                    </SelectTrigger>
                    <SelectContent>
                      {issueTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sync Direction</Label>
                <Select
                  value={syncDirection}
                  onValueChange={(v) => setSyncDirection(v as typeof syncDirection)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="push">
                      <span className="flex items-center gap-2">
                        Push to Jira
                      </span>
                    </SelectItem>
                    <SelectItem value="pull">
                      <span className="flex items-center gap-2">
                        Pull from Jira
                      </span>
                    </SelectItem>
                    <SelectItem value="both">
                      <span className="flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4" />
                        Two-way sync
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                      Map BugLens severity levels to Jira priorities
                    </p>
                    <div className="grid gap-3">
                      {bugSeverities.map((severity) => (
                        <div key={severity} className="flex items-center gap-4">
                          <Label className="w-24">{severity}</Label>
                          <Select
                            value={severityMapping[severity] || ""}
                            onValueChange={(value) =>
                              setSeverityMapping((prev) => ({
                                ...prev,
                                [severity]: value,
                              }))
                            }
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent>
                              {priorities?.map((priority) => (
                                <SelectItem key={priority.id} value={priority.id}>
                                  {priority.name}
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
                  Status Mapping (Push)
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    <p className="text-sm text-muted-foreground">
                      Map BugLens statuses to Jira statuses for push sync
                    </p>
                    <div className="grid gap-3">
                      {bugStatuses.map((status) => (
                        <div key={status} className="flex items-center gap-4">
                          <Label className="w-24 text-xs">{status.replace("_", " ")}</Label>
                          <Select
                            value={statusMapping[status] || ""}
                            onValueChange={(value) =>
                              setStatusMapping((prev) => ({
                                ...prev,
                                [status]: value,
                              }))
                            }
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {statuses?.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
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

              {(syncDirection === "pull" || syncDirection === "both") && (
                <>
                  <AccordionItem value="reverse-priority-mapping">
                    <AccordionTrigger>
                      Priority to Severity Mapping (Pull)
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        <p className="text-sm text-muted-foreground">
                          Map Jira priorities to BugLens severity levels for pull sync
                        </p>
                        <div className="grid gap-3">
                          {priorities?.map((priority) => (
                            <div key={priority.id} className="flex items-center gap-4">
                              <Label className="w-24">{priority.name}</Label>
                              <Select
                                value={reversePriorityMapping[priority.id] || ""}
                                onValueChange={(value) =>
                                  setReversePriorityMapping((prev) => ({
                                    ...prev,
                                    [priority.id]: value,
                                  }))
                                }
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue placeholder="Select severity" />
                                </SelectTrigger>
                                <SelectContent>
                                  {bugSeverities.map((severity) => (
                                    <SelectItem key={severity} value={severity}>
                                      {severity}
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

                  <AccordionItem value="reverse-status-mapping">
                    <AccordionTrigger>
                      Status Mapping (Pull)
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        <p className="text-sm text-muted-foreground">
                          Map Jira statuses to BugLens statuses for pull sync
                        </p>
                        <div className="grid gap-3 max-h-[300px] overflow-y-auto">
                          {statuses?.map((status) => (
                            <div key={status.id} className="flex items-center gap-4">
                              <Label className="w-32 truncate text-xs">{status.name}</Label>
                              <Select
                                value={reverseStatusMapping[status.id] || ""}
                                onValueChange={(value) =>
                                  setReverseStatusMapping((prev) => ({
                                    ...prev,
                                    [status.id]: value,
                                  }))
                                }
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {bugStatuses.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {s.replace("_", " ")}
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
                </>
              )}
            </Accordion>

            <Button
              onClick={handleSaveMapping}
              disabled={updateMapping.isPending || !selectedProject || !selectedIssueType}
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
              Connect your Jira Cloud workspace to sync bugs with Jira issues.
            </p>
            <a
              href="https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary flex items-center gap-1 hover:underline"
            >
              Learn about Jira OAuth setup
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={getJiraOAuthUrl.isPending}
            >
              {getJiraOAuthUrl.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Reconnect
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
                  <AlertDialogTitle>Disconnect Jira?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will stop all Jira sync for this organization.
                    Existing linked bugs will keep their Jira references.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => disconnectJira.mutate({ organizationId })}
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={getJiraOAuthUrl.isPending}>
            {getJiraOAuthUrl.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.004-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.004 1.004 0 0 0 23.013 0z"/>
              </svg>
            )}
            Connect Jira
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
