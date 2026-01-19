import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const session = await auth();
  const { orgSlug } = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Find the organization by slug
  const organization = await db.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, slug: true },
  });

  if (!organization) {
    notFound();
  }

  // Verify user is a member of this organization
  const member = await db.member.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: organization.id,
      },
    },
    select: { id: true, role: true },
  });

  if (!member) {
    redirect("/select-organization");
  }

  // Get sidebar state from cookies
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarState !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <Header
          user={{
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image,
          }}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
