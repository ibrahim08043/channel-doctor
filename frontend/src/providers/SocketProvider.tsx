import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  useGetNotificationUnreadCount,
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useScanForAlerts,
} from "@workspace/api-client-react";
import type { Notification as ApiNotification } from "@workspace/api-client-react";
import { connectSocket, disconnectSocket } from "@/lib/socket";

export type RealtimeNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
};

type ConnectionState = "connecting" | "connected" | "disconnected" | "unauthorized";

interface SocketContextValue {
  /** Live push notification arriving over the socket (kept for the bell/toasts). */
  lastNotification: RealtimeNotification | null;
  /** The bell's unread badge count (sourced from the REST unread endpoint). */
  unread: number;
  /** Full notification history shown in the notification center. */
  notifications: ApiNotification[];
  isHistoryLoading: boolean;
  connection: ConnectionState;
  /** Manually trigger a channel alert scan → creates notifications server-side. */
  runAlertScan: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
  /** Ack a live notification as seen locally (clears the transient toast). */
  consumeNotification: () => void;
  refreshUnread: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const [lastNotification, setLastNotification] = useState<RealtimeNotification | null>(null);

  const unreadQuery = useGetNotificationUnreadCount({ query: { enabled: !!isSignedIn } as any });
  const listQuery = useListNotifications(undefined, { query: { enabled: !!isSignedIn } as any });
  const markReadMut = useMarkNotificationRead();
  const markAllReadMut = useMarkAllNotificationsRead();
  const deleteMut = useDeleteNotification();
  const scanMut = useScanForAlerts();

  // ── Socket lifecycle: connect when signed in, disconnect when signed out ──
  useEffect(() => {
    if (!isSignedIn) {
      disconnectSocket();
      setConnection("disconnected");
      return;
    }

    const s = connectSocket();
    setConnection("connecting");

    const onConnect = () => setConnection("connected");
    const onDisconnect = () => setConnection("disconnected");
    const onConnectError = (err: Error) => {
      setConnection(err.message === "unauthorized" ? "unauthorized" : "disconnected");
    };
    const onNotification = (n: RealtimeNotification) => {
      setLastNotification(n);
      // Bump the unread badge immediately without a refetch.
      unreadQuery.refetch().catch(() => {});
      listQuery.refetch().catch(() => {});
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);
    s.on("notification", onNotification);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onConnectError);
      s.off("notification", onNotification);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  const refreshUnread = useCallback(() => {
    unreadQuery.refetch().catch(() => {});
  }, [unreadQuery]);

  const runAlertScan = useCallback(async () => {
    await scanMut.mutateAsync(undefined);
    refreshUnread();
    listQuery.refetch().catch(() => {});
  }, [scanMut, refreshUnread, listQuery]);

  const markRead = useCallback(
    (id: string) => {
      markReadMut.mutate(
        { id },
        {
          onSuccess: () => {
            refreshUnread();
            listQuery.refetch().catch(() => {});
          },
        },
      );
    },
    [markReadMut, refreshUnread, listQuery],
  );

  const markAllRead = useCallback(() => {
    markAllReadMut.mutate(undefined, {
      onSuccess: () => {
        refreshUnread();
        listQuery.refetch().catch(() => {});
      },
    });
  }, [markAllReadMut, refreshUnread, listQuery]);

  const removeNotification = useCallback(
    (id: string) => {
      deleteMut.mutate(
        { id },
        {
          onSuccess: () => {
            refreshUnread();
            listQuery.refetch().catch(() => {});
          },
        },
      );
    },
    [deleteMut, refreshUnread, listQuery],
  );

  const consumeNotification = useCallback(() => setLastNotification(null), []);

  const value: SocketContextValue = {
    lastNotification,
    unread: unreadQuery.data?.count ?? 0,
    notifications: listQuery.data?.items ?? [],
    isHistoryLoading: listQuery.isLoading,
    connection,
    runAlertScan,
    markRead,
    markAllRead,
    removeNotification,
    consumeNotification,
    refreshUnread,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used within <SocketProvider>");
  }
  return ctx;
}
