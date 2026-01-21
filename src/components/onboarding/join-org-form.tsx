"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Users,
  Building2,
  Link2,
  Clock,
  X,
  Send,
} from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";

const inviteCodeSchema = z.object({
  code: z.string().min(1, "Invite code is required"),
});

const searchSchema = z.object({
  query: z.string().min(1, "Search term is required"),
});

const joinRequestSchema = z.object({
  organizationId: z.string().min(1, "Organization is required"),
  message: z.string().max(500, "Message must be less than 500 characters").optional(),
});

type InviteCodeFormData = z.infer<typeof inviteCodeSchema>;
type SearchFormData = z.infer<typeof searchSchema>;
type JoinRequestFormData = z.infer<typeof joinRequestSchema>;

export function JoinOrgForm() {
  const router = useRouter();
  const [selectedOrg, setSelectedOrg] = useState<{
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    _count: { members: number };
  } | null>(null);

  const utils = trpc.useUtils();

  // Invite code form
  const inviteCodeForm = useForm<InviteCodeFormData>({
    resolver: zodResolver(inviteCodeSchema),
    defaultValues: { code: "" },
  });

  // Search form
  const searchForm = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
    defaultValues: { query: "" },
  });

  // Join request form
  const joinRequestForm = useForm<JoinRequestFormData>({
    resolver: zodResolver(joinRequestSchema),
    defaultValues: { organizationId: "", message: "" },
  });

  // Get pending requests
  const { data: myRequests, isLoading: loadingRequests } =
    trpc.joinRequests.getMyRequests.useQuery();

  // Search organizations
  const searchQuery = searchForm.watch("query");
  const { data: searchResults, isLoading: searching } =
    trpc.organizations.searchPublic.useQuery(
      { query: searchQuery },
      { enabled: searchQuery.length >= 2 }
    );

  // Accept invite code mutation
  const acceptInviteCode = trpc.members.acceptInviteCode.useMutation({
    onSuccess: (data) => {
      toast.success(`Joined ${data.organization.name} successfully!`);
      utils.organizations.getUserOrganizations.invalidate();
      router.push(`/${data.organization.slug}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to accept invite");
    },
  });

  // Create join request mutation
  const createJoinRequest = trpc.joinRequests.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Request sent to ${data.organization.name}!`);
      utils.joinRequests.getMyRequests.invalidate();
      setSelectedOrg(null);
      joinRequestForm.reset();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send request");
    },
  });

  // Cancel join request mutation
  const cancelRequest = trpc.joinRequests.cancel.useMutation({
    onSuccess: () => {
      toast.success("Request cancelled");
      utils.joinRequests.getMyRequests.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to cancel request");
    },
  });

  function onSubmitInviteCode(data: InviteCodeFormData) {
    acceptInviteCode.mutate({ code: data.code });
  }

  function handleSelectOrg(org: typeof selectedOrg) {
    setSelectedOrg(org);
    if (org) {
      joinRequestForm.setValue("organizationId", org.id);
    }
  }

  function onSubmitJoinRequest(data: JoinRequestFormData) {
    createJoinRequest.mutate({
      organizationId: data.organizationId,
      message: data.message || undefined,
    });
  }

  const pendingRequests = myRequests?.filter((r) => r.status === "PENDING") || [];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Join Organization
        </CardTitle>
        <CardDescription>
          Join an existing organization with an invite or request access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="invite" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invite" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Have an Invite?
            </TabsTrigger>
            <TabsTrigger value="request" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Request Access
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invite" className="mt-6">
            <Form {...inviteCodeForm}>
              <form
                onSubmit={inviteCodeForm.handleSubmit(onSubmitInviteCode)}
                className="space-y-4"
              >
                <FormField
                  control={inviteCodeForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invite Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your invite code"
                          disabled={acceptInviteCode.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the invite code you received from your team.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={acceptInviteCode.isPending}
                >
                  {acceptInviteCode.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Join Organization
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="request" className="mt-6 space-y-6">
            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Pending Requests</h4>
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={request.organization.logoUrl || undefined}
                            alt={request.organization.name}
                          />
                          <AvatarFallback>
                            <Building2 className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {request.organization.name}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(request.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Pending</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            cancelRequest.mutate({ requestId: request.id })
                          }
                          disabled={cancelRequest.isPending}
                        >
                          {cancelRequest.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
              </div>
            )}

            {/* Search or Request Form */}
            {!selectedOrg ? (
              <div className="space-y-4">
                <Form {...searchForm}>
                  <FormField
                    control={searchForm.control}
                    name="query"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Search Organizations</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Search by name or URL..."
                              className="pl-9"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Form>

                {searching && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                {searchResults && searchResults.length > 0 && (
                  <div className="space-y-2">
                    {searchResults.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => handleSelectOrg(org)}
                        className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={org.logoUrl || undefined}
                            alt={org.name}
                          />
                          <AvatarFallback>
                            <Building2 className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{org.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {org.slug}.buglens.app
                          </p>
                        </div>
                        <Badge variant="outline">
                          <Users className="h-3 w-3 mr-1" />
                          {org._count.members}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 &&
                  !searching &&
                  searchResults?.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      No organizations found matching &quot;{searchQuery}&quot;
                    </p>
                  )}
              </div>
            ) : (
              <Form {...joinRequestForm}>
                <form
                  onSubmit={joinRequestForm.handleSubmit(onSubmitJoinRequest)}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={selectedOrg.logoUrl || undefined}
                        alt={selectedOrg.name}
                      />
                      <AvatarFallback>
                        <Building2 className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{selectedOrg.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedOrg.slug}.buglens.app
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedOrg(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <FormField
                    control={joinRequestForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Introduce yourself or explain why you'd like to join..."
                            disabled={createJoinRequest.isPending}
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This message will be sent to the organization admins.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createJoinRequest.isPending}
                  >
                    {createJoinRequest.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Send Request
                  </Button>
                </form>
              </Form>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
