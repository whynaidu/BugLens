"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Hook to track online status using useSyncExternalStore
function useOnlineStatus() {
  const subscribe = (callback: () => void) => {
    window.addEventListener("online", callback);
    window.addEventListener("offline", callback);
    return () => {
      window.removeEventListener("online", callback);
      window.removeEventListener("offline", callback);
    };
  };

  const getSnapshot = () => navigator.onLine;
  const getServerSnapshot = () => true; // Assume online during SSR

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <Alert
      variant="destructive"
      className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-auto md:max-w-sm animate-in slide-in-from-bottom-2"
    >
      <WifiOff className="h-4 w-4" />
      <AlertDescription>
        You&apos;re offline. Some features may not be available.
      </AlertDescription>
    </Alert>
  );
}
