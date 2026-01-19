import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { Bug } from "lucide-react";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center space-x-2">
            <Bug className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">BugLens</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Visual bug tracking and annotation platform
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
