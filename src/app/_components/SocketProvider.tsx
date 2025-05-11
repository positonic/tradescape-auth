'use client';

import { ReactNode } from 'react';
import { useSocketConnection } from '~/lib/socketService';

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  // Initialize socket connection
  useSocketConnection();
  
  return <>{children}</>;
} 