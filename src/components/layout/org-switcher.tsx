"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Building2,
  ChevronsUpDown,
  Plus,
  Check,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateOrgDialog } from "@/components/organizations/create-org-dialog";
import { trpc } from "@/lib/trpc";

interface OrgSwitcherProps {
  className?: string;
}

export function OrgSwitcher({ className }: OrgSwitcherProps) {
  const params = useParams();
  const currentSlug = params.orgSlug as string | undefined;
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: organizations, isLoading } =
    trpc.organizations.getUserOrganizations.useQuery();

  const currentOrg = organizations?.find((org) => org.slug === currentSlug);

  if (isLoading) {
    return (
      <div className={className}>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={`justify-between ${className}`}
          >
            <div className="flex items-center gap-2 truncate">
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src={currentOrg?.logoUrl || undefined}
                  alt={currentOrg?.name}
                />
                <AvatarFallback className="text-xs">
                  <Building2 className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                {currentOrg?.name || "Select organization"}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px] sm:w-[240px]" align="start">
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {organizations?.map((org) => (
              <DropdownMenuItem key={org.id} asChild>
                <Link
                  href={`/${org.slug}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={org.logoUrl || undefined} alt={org.name} />
                    <AvatarFallback className="text-xs">
                      <Building2 className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{org.name}</span>
                  {org.slug === currentSlug && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          {organizations && organizations.length === 0 && (
            <DropdownMenuItem disabled>
              <span className="text-muted-foreground">No organizations</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {currentOrg && (
            <DropdownMenuItem asChild>
              <Link
                href={`/${currentSlug}/settings`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Settings className="h-4 w-4" />
                <span>Organization Settings</span>
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            <span>Create Organization</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrgDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
