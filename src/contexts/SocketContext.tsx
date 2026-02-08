"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { notifications } from "@mantine/notifications";

interface Alert {
  asset: string;
  threshold: number | string;
  direction: "above" | "below";
  type: "PRICE" | "CANDLE";
  triggeredPrice: number;
  interval?: string | null;
}

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const connectionAttempted = useRef(false);

  useEffect(() => {
    // Only connect if user is authenticated
    if (!session?.user?.id) {
      // Cleanup any existing socket if user logs out
      if (socketRef.current) {
        console.log("User logged out, disconnecting socket");
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
        connectionAttempted.current = false;
      }
      return;
    }

    // Prevent duplicate connections
    if (connectionAttempted.current && socketRef.current?.connected) {
      console.log("Socket already connected, skipping duplicate");
      return;
    }

    connectionAttempted.current = true;

    console.log(
      "🔌 [SocketProvider] Connecting to socket server...",
      process.env.NEXT_PUBLIC_SOCKET_SERVER_URL,
    );
    console.log("👤 [SocketProvider] User ID:", session.user.id);

    // Create new socket connection with userId in query params
    const alertsSocket = io(
      `${process.env.NEXT_PUBLIC_SOCKET_SERVER_URL}/alerts`,
      {
        query: { userId: session.user.id },
        withCredentials: false,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 60000,
      },
    );

    // Connection event handlers
    alertsSocket.on("connect", () => {
      console.log("✅ [SocketProvider] Connected!", new Date().toISOString());
      console.log("🚀 Transport:", alertsSocket.io.engine.transport.name);
      setConnected(true);
      alertsSocket.emit("ready_for_notifications", true);
    });

    alertsSocket.on("disconnect", (reason) => {
      console.log(
        `❌ [SocketProvider] Disconnected: ${reason}`,
        new Date().toISOString(),
      );
      setConnected(false);
    });

    // Test event handler
    alertsSocket.on("test", (message) => {
      console.log("🧪 [SocketProvider] Test message:", message);
      notifications.show({
        title: "Alert Triggered",
        message: `${message}`,
        color: "green",
      });
    });

    // Notification deduplication
    const recentNotifications = new Set<string>();

    // Listen for alert notifications
    alertsSocket.on("notification", (alert: Alert) => {
      console.log("🔔 [SocketProvider] Alert received:", alert);

      // Create unique key for deduplication
      const notificationKey = `${alert.asset}-${alert.threshold}-${alert.direction}`;

      // Check if we recently showed this notification
      if (recentNotifications.has(notificationKey)) {
        console.log("🚫 Duplicate notification suppressed:", notificationKey);
        return;
      }

      // Add to recent notifications and auto-remove after 10 seconds
      recentNotifications.add(notificationKey);
      setTimeout(() => {
        recentNotifications.delete(notificationKey);
      }, 10000);

      // Display browser notification
      notifications.show({
        title: "Alert Triggered",
        message: `Alert triggered for ${alert.asset} at ${alert.threshold}`,
        color: alert.direction === "above" ? "blue" : "red",
      });
    });

    // Store socket in ref and state
    socketRef.current = alertsSocket;
    setSocket(alertsSocket);

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log("🧹 [SocketProvider] Cleaning up socket connection");
        socketRef.current.disconnect();
        socketRef.current = null;
        connectionAttempted.current = false;
        setConnected(false);
      }
    };
  }, [session?.user?.id]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
