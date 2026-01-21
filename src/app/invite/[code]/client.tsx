"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Building2, AlertCircle, Users, Check, X } from "lucide-react";
import { Role } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

interface InviteClientProps {
  invitation?: {
    id: string;
    code: string;
    role: Role;
    organization: {
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      _count: { members: number };
    };
  };
  error?: "invalid" | "expired" | "max-uses";
  message?: string;
}

export function InviteClient({ invitation, error, message }: InviteClientProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const acceptInvite = trpc.members.acceptInviteCode.useMutation({
    onSuccess: (data) => {
      toast.success(`Welcome to ${data.organization.name}!`);
      utils.organizations.getUserOrganizations.invalidate();
      router.push(`/${data.organization.slug}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to accept invite");
    },
  });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invite Link Error</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <Link href="/onboarding">Go to Onboarding</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  const org = invitation.organization;
  const roleLabel = invitation.role.replace("_", " ").toLowerCase();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={org.logoUrl || undefined} alt={org.name} />
              <AvatarFallback className="text-lg">
                <Building2 className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
          </div>
          <CardTitle>Join {org.name}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join this organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">{org.name}</p>
              <p className="text-sm text-muted-foreground">
                {org.slug}.buglens.app
              </p>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {org._count.members} members
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <span className="text-sm text-muted-foreground">Your role will be</span>
            <Badge className="capitalize">{roleLabel}</Badge>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            asChild
          >
            <Link href="/onboarding">
              <X className="mr-2 h-4 w-4" />
              Decline
            </Link>
          </Button>
          <Button
            className="flex-1"
            onClick={() => acceptInvite.mutate({ code: invitation.code })}
            disabled={acceptInvite.isPending}
          >
            {acceptInvite.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Accept & Join
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
