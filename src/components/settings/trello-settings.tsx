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
import { Input } from "@/components/ui/input";
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
import { trpc } from "@/lib/trpc";

// BugLens status options
const bugStatuses = ["OPEN", "IN_PROGRESS", "IN_REVIEW", "RESOLVED", "CLOSED", "WONT_FIX"] as const;

interface TrelloSettingsProps {
  organizationId: string;
  orgSlug: string;
}

export function TrelloSettings({ organizationId, orgSlug }: TrelloSettingsProps) {
  const [tokenInput, setTokenInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<string>("");
  const [listMapping, setListMapping] = useState<Record<string, string>>({});

  const utils = trpc.useUtils();

  // Queries
  const { data: config, isLoading: configLoading } = trpc.integrations.getTrelloConfig.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );

  const { data: boards } = trpc.integrations.getTrelloBoards.useQuery(
    { organizationId },
    { enabled: !!organizationId && !!config?.isConnected }
  );

  const { data: lists } = trpc.integrations.getTrelloLists.useQuery(
    { organizationId, boardId: selectedBoard },
    { enabled: !!organizationId && !!selectedBoard }
  );

  // Mutations
  const getTrelloAuthUrl = trpc.integrations.getTrelloAuthUrl.useMutation();
  const connectTrello = trpc.integrations.connectTrello.useMutation({
    onSuccess: () => {
      utils.integrations.getAll.invalidate();
      utils.integrations.getTrelloConfig.invalidate();
      setTokenInput("");
      setIsConnecting(false);
      toast.success("Trello connected successfully");
    },
    onError: (error) => {
      toast.error("Failed to connect Trello", { description: error.message });
    },
  });

  const testConnection = trpc.integrations.testTrelloConnection.useMutation();
  const disconnectTrello = trpc.integrations.disconnectTrello.useMutation({
    onSuccess: () => {
      utils.integrations.getAll.invalidate();
      utils.integrations.getTrelloConfig.invalidate();
      toast.success("Trello disconnected");
    },
    onError: (error) => {
      toast.error("Failed to disconnect Trello", { description: error.message });
    },
  });

  const updateMapping = trpc.integrations.updateTrelloMapping.useMutation({
    onSuccess: () => {
      utils.integrations.getTrelloConfig.invalidate();
      toast.success("Trello configuration saved");
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
        setSelectedBoard(config.boardId || "");
        if (config.listMapping) {
          setListMapping(config.listMapping);
        }
      });
    }
  }, [config]);

  const handleStartAuth = async () => {
    try {
      const { url } = await getTrelloAuthUrl.mutateAsync({ orgSlug });
      // Open in a popup for the auth flow
      const popup = window.open(url, "trello-auth", "width=600,height=700");
      if (popup) {
        popup.focus();
      }
      setIsConnecting(true);
    } catch {
      toast.error("Failed to start Trello authentication");
    }
  };

  const handleConnectWithToken = async () => {
    if (!tokenInput.trim()) {
      toast.error("Please enter your Trello token");
      return;
    }

    await connectTrello.mutateAsync({
      organizationId,
      token: tokenInput.trim(),
    });
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
    if (!selectedBoard) {
      toast.error("Please select a Trello board");
      return;
    }

    await updateMapping.mutateAsync({
      organizationId,
      boardId: selectedBoard,
      listMapping,
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
            <div className="p-2 rounded-lg bg-[#0079BF]/10">
              <svg className="h-6 w-6 text-[#0079BF]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.5 2h-15A2.5 2.5 0 0 0 2 4.5v15A2.5 2.5 0 0 0 4.5 22h15a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 19.5 2zM10.5 17a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 17V6A1.5 1.5 0 0 1 6 4.5h3A1.5 1.5 0 0 1 10.5 6v11zm9 -5A1.5 1.5 0 0 1 18 13.5h-3a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 15 4.5h3A1.5 1.5 0 0 1 19.5 6v6z"/>
              </svg>
            </div>
            <div>
              <CardTitle className="text-lg">Trello</CardTitle>
              <CardDescription>
                Sync bugs with Trello cards
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
            {config.memberName && (
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                <span>Connected as <strong>@{config.memberUsername}</strong> ({config.memberName})</span>
              </div>
            )}

            <Separator />

            {/* Board Selection */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Board Configuration
              </h4>

              <div className="space-y-2">
                <Label>Trello Board</Label>
                <Select
                  value={selectedBoard}
                  onValueChange={setSelectedBoard}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a board" />
                  </SelectTrigger>
                  <SelectContent>
                    {boards?.map((board) => (
                      <SelectItem key={board.id} value={board.id}>
                        {board.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedBoard && (
              <>
                <Separator />

                {/* List Mapping */}
                <div className="space-y-4">
                  <h4 className="font-medium">Status to List Mapping</h4>
                  <p className="text-sm text-muted-foreground">
                    Map BugLens statuses to Trello lists
                  </p>

                  <div className="grid gap-3">
                    {bugStatuses.map((status) => (
                      <div key={status} className="flex items-center gap-4">
                        <Label className="w-28 text-xs">{status.replace("_", " ")}</Label>
                        <Select
                          value={listMapping[status] || ""}
                          onValueChange={(value) =>
                            setListMapping((prev) => ({
                              ...prev,
                              [status]: value,
                            }))
                          }
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select list" />
                          </SelectTrigger>
                          <SelectContent>
                            {lists?.map((list) => (
                              <SelectItem key={list.id} value={list.id}>
                                {list.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Button
              onClick={handleSaveMapping}
              disabled={updateMapping.isPending || !selectedBoard}
            >
              {updateMapping.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Configuration
            </Button>
          </div>
        ) : isConnecting ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              After authorizing in the popup, copy the token and paste it below:
            </p>
            <div className="space-y-2">
              <Label htmlFor="trello-token">Trello Token</Label>
              <Input
                id="trello-token"
                placeholder="Paste your Trello token here"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleConnectWithToken}
                disabled={!tokenInput.trim() || connectTrello.isPending}
              >
                {connectTrello.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Connect
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsConnecting(false);
                  setTokenInput("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your Trello account to sync bugs with Trello cards.
            </p>
            <a
              href="https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary flex items-center gap-1 hover:underline"
            >
              Learn about Trello authorization
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
                  <AlertDialogTitle>Disconnect Trello?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will stop all Trello sync for this organization.
                    Existing linked bugs will keep their Trello references.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => disconnectTrello.mutate({ organizationId })}
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : !isConnecting ? (
          <Button onClick={handleStartAuth} disabled={getTrelloAuthUrl.isPending}>
            {getTrelloAuthUrl.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.5 2h-15A2.5 2.5 0 0 0 2 4.5v15A2.5 2.5 0 0 0 4.5 22h15a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 19.5 2zM10.5 17a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 17V6A1.5 1.5 0 0 1 6 4.5h3A1.5 1.5 0 0 1 10.5 6v11zm9 -5A1.5 1.5 0 0 1 18 13.5h-3a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 15 4.5h3A1.5 1.5 0 0 1 19.5 6v6z"/>
              </svg>
            )}
            Connect Trello
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
