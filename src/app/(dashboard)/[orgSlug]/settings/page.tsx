"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Users, Bell, Plug, Building2, ChevronRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const settingsItems = [
  {
    title: "Members",
    description: "Manage team members and invitations",
    href: "members",
    icon: Users,
  },
  {
    title: "Notifications",
    description: "Configure notification preferences",
    href: "notifications",
    icon: Bell,
  },
  {
    title: "Integrations",
    description: "Connect external tools like Jira, Slack, and more",
    href: "integrations",
    icon: Plug,
  },
];

export default function SettingsPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization settings and preferences
        </p>
      </div>

      <div className="grid gap-4">
        {settingsItems.map((item) => (
          <Link key={item.href} href={`/${orgSlug}/settings/${item.href}`}>
            <Card className="cursor-pointer transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-muted p-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Organization Details</CardTitle>
              <CardDescription>
                View and update your organization information
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Organization management features coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
