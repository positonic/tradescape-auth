'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { notifications } from '@mantine/notifications';

interface Alert {
  asset: string;
  threshold: number | string; // Assuming threshold can be a number or string
  direction: 'above' | 'below'; // Assuming these are the only possible values
}

export function useSocketConnection() {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Only connect if user is authenticated
    if (!session?.user?.id) return;

    // Close any existing connection
    if (socket) socket.close();

    console.log('socket: Connecting to socket server...', process.env.NEXT_PUBLIC_SOCKET_SERVER_URL);
    console.log('socket: userId: session.user.id ', session.user.id);
    // Create new socket connection with userId in query params
    const alertsSocket = io(`${process.env.NEXT_PUBLIC_SOCKET_SERVER_URL}/alerts`, {
      //query: { userId: session.user.id },
      withCredentials: false, // Send cookies for additional auth if needed
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 60000,
      //transports: ['websocket'], // Try forcing WebSockets only
    });

   // const alertsSocket = io("/alerts");
    // Add this to check transport
    alertsSocket.on('connect', () => {
      console.log('Transport used:', alertsSocket.io.engine.transport.name);
    });
    // Connection event handlers
    alertsSocket.on('connect', () => {
      console.log('Socket connected!', new Date().toISOString());
      setConnected(true);

       // Tell server we're ready for notifications
       alertsSocket.emit('ready_for_notifications', true);
    });

    alertsSocket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${reason}`, new Date().toISOString());
      setConnected(false);
    });

    // Listen for notifications
    alertsSocket.on('test', (message) => {
      console.log('socket: Alert message received: ', message);
      // Display user notification using Mantine notifications
      notifications.show({
        title: 'Alert Triggered',
        message: `${message}`,
        color: 'green'
      });
    });

    // Listen for notifications
    alertsSocket.on('notification', (alert: Alert) => {
      console.log('socket [notification]: Alert notification received:', alert);
      // Display user notification using Mantine notifications
      notifications.show({
        title: 'Alert Triggered',
        message: `Alert triggered for ${alert.asset} at ${alert.threshold}`,
        color: alert.direction === 'above' ? 'blue' : 'red',
      });
    });

    setSocket(alertsSocket);

    // Cleanup on unmount
    return () => {
      alertsSocket.disconnect();
    };
  }, [session?.user?.id]);

  return { socket, connected };
} 