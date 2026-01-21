"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ExternalLink,
  Loader2,
  MessageSquare,
  PlayCircle,
  Slack,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { trpc } from "@/lib/trpc";

export default function IntegrationsPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [isConnectingSlack, setIsConnectingSlack] = useState(false);
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState("");
  const [isConnectingTeams, setIsConnectingTeams] = useState(false);

  const utils = trpc.useUtils();

  // Get organization to get its ID
  const { data: org } = trpc.organizations.getBySlug.useQuery({ slug: orgSlug });
  const organizationId = org?.id;

  // Get integrations
  const { data: integrations, isLoading } = trpc.integrations.getAll.useQuery(
    { organizationId: organizationId! },
    { enabled: !!organizationId }
  );

  // Mutations
  const connectSlack = trpc.integrations.connectSlack.useMutation({
    onSuccess: () => {
      utils.integrations.getAll.invalidate();
      setSlackWebhookUrl("");
      setIsConnectingSlack(false);
      toast.success("Slack connected successfully");
    },
    onError: (error) => {
      toast.error("Failed to connect Slack", {
        description: error.message,
      });
    },
  });
  const testSlackConnection = trpc.integrations.testSlackConnection.useMutation();
  const disconnectSlack = trpc.integrations.disconnectSlack.useMutation({
    onSuccess: () => {
      utils.integrations.getAll.invalidate();
      toast.success("Slack disconnected");
    },
  });

  const connectTeams = trpc.integrations.connectTeams.useMutation({
    onSuccess: () => {
      utils.integrations.getAll.invalidate();
      setTeamsWebhookUrl("");
      setIsConnectingTeams(false);
      toast.success("Teams connected successfully");
    },
    onError: (error) => {
      toast.error("Failed to connect Teams", {
        description: error.message,
      });
    },
  });
  const testTeamsConnection = trpc.integrations.testTeamsConnection.useMutation();
  const disconnectTeams = trpc.integrations.disconnectTeams.useMutation({
    onSuccess: () => {
      utils.integrations.getAll.invalidate();
      toast.success("Teams disconnected");
    },
  });

  const toggleActive = trpc.integrations.toggleActive.useMutation({
    onSuccess: () => {
      utils.integrations.getAll.invalidate();
    },
  });

  // Get integration by type
  const slackIntegration = integrations?.find((i) => i.type === "SLACK");
  const teamsIntegration = integrations?.find((i) => i.type === "TEAMS");

  const handleConnectSlack = async () => {
    if (!organizationId || !slackWebhookUrl) return;
    await connectSlack.mutateAsync({
      organizationId,
      webhookUrl: slackWebhookUrl,
    });
  };

  const handleTestSlack = async () => {
    if (!organizationId) return;
    const result = await testSlackConnection.mutateAsync({ organizationId });
    if (result.ok) {
      toast.success("Slack connection successful");
    } else {
      toast.error("Connection test failed", {
        description: result.error,
      });
    }
  };

  const handleConnectTeams = async () => {
    if (!organizationId || !teamsWebhookUrl) return;
    await connectTeams.mutateAsync({
      organizationId,
      webhookUrl: teamsWebhookUrl,
    });
  };

  const handleTestTeams = async () => {
    if (!organizationId) return;
    const result = await testTeamsConnection.mutateAsync({ organizationId });
    if (result.ok) {
      toast.success("Teams connection successful");
    } else {
      toast.error("Connection test failed", {
        description: result.error,
      });
    }
  };

  if (isLoading || !organizationId) {
    return (
      <div className="container max-w-4xl px-4 py-4 sm:py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full sm:w-96" />
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl px-4 py-4 sm:py-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Integrations</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Connect BugLens with your team&apos;s communication tools
        </p>
      </div>

      <div className="space-y-6">
        {/* Slack Integration */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#4A154B]/10 flex-shrink-0">
                  <Slack className="h-5 w-5 sm:h-6 sm:w-6 text-[#4A154B]" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">Slack</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Post notifications to Slack channels
                  </CardDescription>
                </div>
              </div>
              {slackIntegration && (
                <Badge variant={slackIntegration.isActive ? "default" : "secondary"} className="w-fit">
                  {slackIntegration.isActive ? "Connected" : "Disabled"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {slackIntegration ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Webhook configured</span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="slack-active">Active</Label>
                    <Switch
                      id="slack-active"
                      checked={slackIntegration.isActive}
                      onCheckedChange={(checked) => {
                        toggleActive.mutate({
                          organizationId,
                          type: "SLACK",
                          isActive: checked,
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : isConnectingSlack ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slack-webhook">Webhook URL</Label>
                  <Input
                    id="slack-webhook"
                    placeholder="https://hooks.slack.com/services/..."
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Create an Incoming Webhook in your Slack workspace
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleConnectSlack}
                    disabled={!slackWebhookUrl || connectSlack.isPending}
                  >
                    {connectSlack.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsConnectingSlack(false);
                      setSlackWebhookUrl("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connect your Slack workspace to receive bug notifications in your channels.
                </p>
                <a
                  href="https://api.slack.com/messaging/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                >
                  Learn how to create a webhook
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t pt-4">
            {slackIntegration ? (
              <div className="flex flex-wrap gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestSlack}
                  disabled={testSlackConnection.isPending}
                  className="text-xs sm:text-sm"
                >
                  {testSlackConnection.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  <span className="hidden sm:inline">Test Connection</span>
                  <span className="sm:hidden">Test</span>
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
                      <AlertDialogTitle>Disconnect Slack?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will stop all Slack notifications for this organization.
                        You can reconnect at any time.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => disconnectSlack.mutate({ organizationId })}
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : !isConnectingSlack ? (
              <Button onClick={() => setIsConnectingSlack(true)}>
                <Slack className="h-4 w-4 mr-2" />
                Connect Slack
              </Button>
            ) : null}
          </CardFooter>
        </Card>

        {/* Teams Integration */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#5558AF]/10 flex-shrink-0">
                  <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-[#5558AF]" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">Microsoft Teams</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Post notifications via incoming webhook
                  </CardDescription>
                </div>
              </div>
              {teamsIntegration && (
                <Badge variant={teamsIntegration.isActive ? "default" : "secondary"} className="w-fit">
                  {teamsIntegration.isActive ? "Connected" : "Disabled"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {teamsIntegration ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Webhook configured</span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="teams-active">Active</Label>
                    <Switch
                      id="teams-active"
                      checked={teamsIntegration.isActive}
                      onCheckedChange={(checked) => {
                        toggleActive.mutate({
                          organizationId,
                          type: "TEAMS",
                          isActive: checked,
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : isConnectingTeams ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teams-webhook">Webhook URL</Label>
                  <Input
                    id="teams-webhook"
                    placeholder="https://outlook.office.com/webhook/..."
                    value={teamsWebhookUrl}
                    onChange={(e) => setTeamsWebhookUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Create an Incoming Webhook connector in your Teams channel
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleConnectTeams}
                    disabled={!teamsWebhookUrl || connectTeams.isPending}
                  >
                    {connectTeams.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsConnectingTeams(false);
                      setTeamsWebhookUrl("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connect Microsoft Teams to receive bug notifications in your channels.
                </p>
                <a
                  href="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                >
                  Learn how to create a webhook
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t pt-4">
            {teamsIntegration ? (
              <div className="flex flex-wrap gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestTeams}
                  disabled={testTeamsConnection.isPending}
                  className="text-xs sm:text-sm"
                >
                  {testTeamsConnection.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  <span className="hidden sm:inline">Test Connection</span>
                  <span className="sm:hidden">Test</span>
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
                      <AlertDialogTitle>Disconnect Teams?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will stop all Teams notifications for this organization.
                        You can reconnect at any time.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => disconnectTeams.mutate({ organizationId })}
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : !isConnectingTeams ? (
              <Button onClick={() => setIsConnectingTeams(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Connect Teams
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
