"use client";

import { toast } from "sonner";
import {
  Bell,
  Mail,
  MessageSquare,
  Settings2,
  Slack,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

// Event type configuration
const eventTypes = [
  {
    id: "bug_assigned",
    label: "Bug assigned",
    description: "When a bug is assigned to you",
  },
  {
    id: "bug_commented",
    label: "New comments",
    description: "When someone comments on a bug you're watching",
  },
  {
    id: "status_changed",
    label: "Status changes",
    description: "When a bug's status changes",
  },
  {
    id: "mentioned",
    label: "Mentions",
    description: "When someone mentions you in a comment",
  },
  {
    id: "bug_created",
    label: "Bug created",
    description: "When a new bug is created in your projects",
  },
  {
    id: "bug_resolved",
    label: "Bug resolved",
    description: "When a bug is marked as resolved",
  },
] as const;

// Channel configuration
const channels = [
  {
    id: "IN_APP",
    label: "In-app",
    description: "Show in notification center",
    icon: Bell,
  },
  {
    id: "EMAIL",
    label: "Email",
    description: "Send email notifications",
    icon: Mail,
  },
  {
    id: "SLACK",
    label: "Slack",
    description: "Post to Slack channel",
    icon: Slack,
  },
  {
    id: "TEAMS",
    label: "Teams",
    description: "Post to Teams channel",
    icon: MessageSquare,
  },
] as const;

type EventType = typeof eventTypes[number]["id"];
type Channel = typeof channels[number]["id"];

export default function NotificationSettingsPage() {
  const utils = trpc.useUtils();

  const { data: preferences, isLoading } = trpc.notifications.getPreferences.useQuery({});

  const updatePreference = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => {
      utils.notifications.getPreferences.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to update preference", {
        description: error.message,
      });
    },
  });

  const resetPreferences = trpc.notifications.resetPreferences.useMutation({
    onSuccess: () => {
      utils.notifications.getPreferences.invalidate();
      toast.success("Preferences reset to defaults");
    },
    onError: (error) => {
      toast.error("Failed to reset preferences", {
        description: error.message,
      });
    },
  });

  const handleToggle = (eventType: EventType, channel: Channel, enabled: boolean) => {
    updatePreference.mutate({
      eventType,
      channel,
      isEnabled: enabled,
    });
  };

  const isEnabled = (eventType: EventType, channel: Channel): boolean => {
    if (!preferences) return channel === "IN_APP" || channel === "EMAIL";
    return preferences[eventType]?.[channel] ?? (channel === "IN_APP" || channel === "EMAIL");
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            Notification Settings
          </h1>
          <p className="text-muted-foreground">
            Choose how and when you want to be notified
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => resetPreferences.mutate({})}
          disabled={resetPreferences.isPending}
        >
          Reset to defaults
        </Button>
      </div>

      {/* Notification Channels Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Notification Channels</CardTitle>
          <CardDescription>
            Configure which channels you want to receive notifications on
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {channels.map((channel) => {
              const Icon = channel.icon;
              const isChannelConfigured = channel.id === "IN_APP" || channel.id === "EMAIL";

              return (
                <div
                  key={channel.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isChannelConfigured ? "bg-muted/30" : "opacity-60"
                  }`}
                >
                  <div className="p-2 rounded-full bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{channel.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {channel.description}
                    </p>
                  </div>
                  {!isChannelConfigured && (
                    <span className="text-xs text-muted-foreground">
                      Not configured
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Event Type Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event Preferences</CardTitle>
          <CardDescription>
            Toggle notifications for specific events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {eventTypes.map((event, eventIndex) => (
            <div key={event.id}>
              {eventIndex > 0 && <Separator className="my-4" />}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">{event.label}</h4>
                  <p className="text-sm text-muted-foreground">
                    {event.description}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  {channels.map((channel) => {
                    const Icon = channel.icon;
                    const enabled = isEnabled(event.id, channel.id);
                    const isConfigured = channel.id === "IN_APP" || channel.id === "EMAIL";

                    return (
                      <div
                        key={channel.id}
                        className="flex items-center justify-between"
                      >
                        <Label
                          htmlFor={`${event.id}-${channel.id}`}
                          className={`flex items-center gap-2 cursor-pointer ${
                            !isConfigured ? "opacity-50" : ""
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {channel.label}
                        </Label>
                        <Switch
                          id={`${event.id}-${channel.id}`}
                          checked={enabled}
                          onCheckedChange={(checked) =>
                            handleToggle(event.id, channel.id, checked)
                          }
                          disabled={
                            !isConfigured || updatePreference.isPending
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Email Digest Settings */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Email Digest</CardTitle>
          <CardDescription>
            Receive a summary of notifications instead of individual emails
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Weekly digest</p>
              <p className="text-sm text-muted-foreground">
                Get a weekly summary every Monday at 9 AM
              </p>
            </div>
            <Switch disabled />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Email digest feature coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
