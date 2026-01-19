"use client";

import { useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Link as LinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

interface ExternalIds {
  jira?: string;
  trello?: string;
  azureDevOps?: string | number;
}

interface ExternalSyncProps {
  bugId: string;
  organizationId: string;
  externalIds?: ExternalIds | null;
  onSync?: () => void;
}

// Icons for each service
const JiraIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z" />
  </svg>
);

const TrelloIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.5 2h-15A2.5 2.5 0 0 0 2 4.5v15A2.5 2.5 0 0 0 4.5 22h15a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 19.5 2zM10.5 17a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 17V6A1.5 1.5 0 0 1 6 4.5h3A1.5 1.5 0 0 1 10.5 6v11zm9 -5A1.5 1.5 0 0 1 18 13.5h-3a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 15 4.5h3A1.5 1.5 0 0 1 19.5 6v6z" />
  </svg>
);

const AzureDevOpsIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 8.877L2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v8.225L0 15.707V8.877zm24-4.45v14.651l-5.753 4.9-9.303-3.057v3.056l-5.978-7.416 15.057 1.798V5.415L24 4.427z" />
  </svg>
);

export function ExternalSync({
  bugId,
  organizationId,
  externalIds,
  onSync,
}: ExternalSyncProps) {
  const { toast } = useToast();
  const [syncingService, setSyncingService] = useState<string | null>(null);

  // Query available integrations
  const { data: integrations } = trpc.integrations.getAll.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );

  // Sync mutations
  const syncToJira = trpc.integrations.syncBugToJira.useMutation({
    onSuccess: (result) => {
      toast({
        title: "Synced to Jira",
        description: `Issue ${result.issueKey} created/updated`,
      });
      onSync?.();
    },
    onError: (error) => {
      toast({
        title: "Failed to sync to Jira",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setSyncingService(null),
  });

  const syncToTrello = trpc.integrations.syncBugToTrello.useMutation({
    onSuccess: () => {
      toast({
        title: "Synced to Trello",
        description: `Card created/updated`,
      });
      onSync?.();
    },
    onError: (error) => {
      toast({
        title: "Failed to sync to Trello",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setSyncingService(null),
  });

  const syncToAzureDevOps = trpc.integrations.syncBugToAzureDevOps.useMutation({
    onSuccess: (result) => {
      toast({
        title: "Synced to Azure DevOps",
        description: `Work item ${result.workItemId} created/updated`,
      });
      onSync?.();
    },
    onError: (error) => {
      toast({
        title: "Failed to sync to Azure DevOps",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setSyncingService(null),
  });

  const handleSync = (service: string) => {
    setSyncingService(service);

    switch (service) {
      case "JIRA":
        syncToJira.mutate({ bugId, organizationId });
        break;
      case "TRELLO":
        syncToTrello.mutate({ bugId, organizationId });
        break;
      case "AZURE_DEVOPS":
        syncToAzureDevOps.mutate({ bugId, organizationId });
        break;
    }
  };

  // Get connected integrations
  const connectedIntegrations = integrations?.filter((i) => i.isActive) ?? [];
  const hasJira = connectedIntegrations.some((i) => i.type === "JIRA");
  const hasTrello = connectedIntegrations.some((i) => i.type === "TRELLO");
  const hasAzureDevOps = connectedIntegrations.some((i) => i.type === "AZURE_DEVOPS");

  // Check if any integrations are available
  const hasIntegrations = hasJira || hasTrello || hasAzureDevOps;

  // Get linked services
  const linkedServices = [];
  if (externalIds?.jira) linkedServices.push({ type: "JIRA", id: externalIds.jira });
  if (externalIds?.trello) linkedServices.push({ type: "TRELLO", id: externalIds.trello });
  if (externalIds?.azureDevOps) linkedServices.push({ type: "AZURE_DEVOPS", id: String(externalIds.azureDevOps) });

  if (!hasIntegrations) {
    return null; // Don't show if no integrations are configured
  }

  const getServiceIcon = (type: string) => {
    switch (type) {
      case "JIRA":
        return <JiraIcon />;
      case "TRELLO":
        return <TrelloIcon />;
      case "AZURE_DEVOPS":
        return <AzureDevOpsIcon />;
      default:
        return <LinkIcon className="h-4 w-4" />;
    }
  };

  const getServiceLabel = (type: string) => {
    switch (type) {
      case "JIRA":
        return "Jira";
      case "TRELLO":
        return "Trello";
      case "AZURE_DEVOPS":
        return "Azure DevOps";
      default:
        return type;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">External Integrations</CardTitle>
        {linkedServices.length > 0 && (
          <CardDescription className="text-xs">
            Linked to {linkedServices.length} external service{linkedServices.length !== 1 ? "s" : ""}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Linked Services */}
        {linkedServices.length > 0 && (
          <>
            <div className="space-y-2">
              {linkedServices.map((service) => (
                <div
                  key={service.type}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {getServiceIcon(service.type)}
                    </span>
                    <span className="text-sm">{getServiceLabel(service.type)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {service.id.length > 12 ? `${service.id.substring(0, 12)}...` : service.id}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleSync(service.type)}
                      disabled={syncingService === service.type}
                    >
                      {syncingService === service.type ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Separator />
          </>
        )}

        {/* Sync Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={syncingService !== null}
            >
              {syncingService ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Sync to...
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {hasJira && (
              <DropdownMenuItem
                onClick={() => handleSync("JIRA")}
                disabled={syncingService !== null}
              >
                <JiraIcon />
                <span className="ml-2">
                  {externalIds?.jira ? "Update in Jira" : "Create in Jira"}
                </span>
              </DropdownMenuItem>
            )}
            {hasTrello && (
              <DropdownMenuItem
                onClick={() => handleSync("TRELLO")}
                disabled={syncingService !== null}
              >
                <TrelloIcon />
                <span className="ml-2">
                  {externalIds?.trello ? "Update in Trello" : "Create in Trello"}
                </span>
              </DropdownMenuItem>
            )}
            {hasAzureDevOps && (
              <DropdownMenuItem
                onClick={() => handleSync("AZURE_DEVOPS")}
                disabled={syncingService !== null}
              >
                <AzureDevOpsIcon />
                <span className="ml-2">
                  {externalIds?.azureDevOps ? "Update in Azure DevOps" : "Create in Azure DevOps"}
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
