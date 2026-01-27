"use client";

import { useCallback } from "react";
import { useSocketConnection } from "./socketService";

export function useSocket() {
  const { socket: socketConnection, connected } = useSocketConnection();

  // Function to emit events to the socket server
  const emitEvent = useCallback(
    (eventName: string, payload: unknown) => {
      if (socketConnection && connected) {
        socketConnection.emit(eventName, payload);
        return true;
      }
      return false;
    },
    [socketConnection, connected],
  );

  // Function to subscribe to socket events
  const subscribeToEvent = useCallback(
    (eventName: string, callback: (data: unknown) => void) => {
      if (!socketConnection) {
        // Return a no-op function if socket is not available
        return () => {
          /* intentionally empty */
        };
      }

      socketConnection.on(eventName, callback);

      // Return unsubscribe function
      return () => {
        socketConnection.off(eventName, callback);
      };
    },
    [socketConnection],
  );

  return {
    socket: socketConnection,
    connected,
    emitEvent,
    subscribeToEvent,
  };
}
