"use client";

import { useSession as useNextAuthSession } from "next-auth/react";
import { useEffect, useCallback } from "react";

export interface UseSessionOptions {
  required?: boolean;
  onUnauthenticated?: () => void;
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number;
}

export function useSession(options: UseSessionOptions = {}) {
  const {
    required = false,
    onUnauthenticated,
    refetchOnWindowFocus = true,
    refetchInterval,
  } = options;

  const { data: session, status, update } = useNextAuthSession({
    required,
    onUnauthenticated,
  });

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";
  const isUnauthenticated = status === "unauthenticated";

  const user = session?.user ?? null;

  // Refetch session on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      update();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchOnWindowFocus, update]);

  // Refetch session at interval
  useEffect(() => {
    if (!refetchInterval || refetchInterval <= 0) return;

    const interval = setInterval(() => {
      update();
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [refetchInterval, update]);

  // Manual refetch
  const refetch = useCallback(() => {
    return update();
  }, [update]);

  // Update session data
  const updateSession = useCallback(
    async (data: Partial<{ name: string; image: string }>) => {
      return update(data);
    },
    [update]
  );

  return {
    session,
    user,
    status,
    isLoading,
    isAuthenticated,
    isUnauthenticated,
    refetch,
    updateSession,
  };
}

/**
 * Hook that requires authentication
 * Will trigger onUnauthenticated callback if not authenticated
 */
export function useRequiredSession(onUnauthenticated?: () => void) {
  return useSession({
    required: true,
    onUnauthenticated,
    refetchOnWindowFocus: true,
  });
}
