'use client';

import { type ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { SocketProvider } from './SocketProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <SocketProvider>
        {children}
      </SocketProvider>
    </SessionProvider>
  );
} 