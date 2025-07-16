'use client';

import { use } from 'react';
import SessionDetail from '~/app/_components/SessionDetail';

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  // Use React.use to unwrap the params Promise in a client component
  const { id } = use(params);
  
  return <SessionDetail sessionId={id} showFullDetails={true} />;
} 