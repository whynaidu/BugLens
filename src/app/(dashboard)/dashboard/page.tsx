import { requireAuth, getDefaultOrganization } from "@/lib/auth-utils";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await requireAuth();
  const defaultOrg = await getDefaultOrganization();

  // If user has an organization, redirect to it
  if (defaultOrg) {
    redirect(`/${defaultOrg.slug}`);
  }

  // Otherwise, redirect to organization selection/creation page
  redirect("/select-organization");
}
