import { useEffect, useRef } from "react";
import { useSocket } from "@/providers/SocketProvider";
import { useToast } from "@/hooks/use-toast";

/**
 * Turns live WebSocket notifications into transient toasts. Mounted once at the
 * app root so every real-time event (viral video, AI completed, security alert,
 * billing, …) surfaces to the user no matter which page they're on.
 */
export function useRealtimeToasts() {
  const { lastNotification, consumeNotification } = useSocket();
  const { toast } = useToast();
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!lastNotification) return;
    // Guard against duplicate toasts for the same transient event.
    if (seen.current === lastNotification.id) return;
    seen.current = lastNotification.id;

    toast({
      title: lastNotification.title,
      description: lastNotification.body || undefined,
      variant: lastNotification.severity === "critical" ? "destructive" : "default",
    });
    consumeNotification();
  }, [lastNotification, toast, consumeNotification]);

  return null;
}
