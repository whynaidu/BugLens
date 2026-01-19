"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useAuth() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";
  const user = session?.user ?? null;

  const login = useCallback(
    async (
      provider: "google" | "microsoft-entra-id" | "credentials",
      credentials?: { email: string; password: string }
    ) => {
      if (provider === "credentials" && credentials) {
        const result = await signIn("credentials", {
          email: credentials.email,
          password: credentials.password,
          redirect: false,
        });

        if (result?.error) {
          throw new Error("Invalid email or password");
        }

        return result;
      }

      return signIn(provider, { callbackUrl: "/dashboard" });
    },
    []
  );

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/login" });
  }, []);

  const updateSession = useCallback(
    async (data: { name?: string; image?: string }) => {
      await update(data);
    },
    [update]
  );

  const requireAuth = useCallback(
    (redirectUrl = "/login") => {
      if (!isLoading && !isAuthenticated) {
        router.push(redirectUrl);
        return false;
      }
      return isAuthenticated;
    },
    [isLoading, isAuthenticated, router]
  );

  return {
    session,
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    updateSession,
    requireAuth,
  };
}
