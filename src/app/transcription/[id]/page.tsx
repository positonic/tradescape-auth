'use client';

import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { 
  Paper, 
  Title, 
  Text,
  Skeleton,
  Button,
  Group,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { use } from 'react';

export default function TranscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  // Use React.use to unwrap the params Promise in a client component
  const { id } = use(params);
  
  const { data: session, isLoading } = api.transcription.getById.useQuery({ 
    id: id 
  });
  
  const router = useRouter();

  const createSetupsMutation = api.transcription.createSetups.useMutation({
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Setups created successfully',
        color: 'green',
      });
      router.push('/setups');
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  if (isLoading) {
    return <Skeleton height={400} />;
  }

  if (!session) {
    return (
      <Paper p="md">
        <Text>Transcription session not found</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Transcription Details</Title>
        {session.transcription && (
          <Button
            loading={createSetupsMutation.isPending}
            onClick={() => createSetupsMutation.mutate({ transcriptionId: session.id })}
          >
            Create Setups
          </Button>
        )}
      </Group>
      
      <Text mb="xs"><strong>Session ID:</strong> {session.sessionId}</Text>
      <Text mb="xs"><strong>Created:</strong> {new Date(session.createdAt).toLocaleString()}</Text>
      <Text mb="xs"><strong>Updated:</strong> {new Date(session.updatedAt).toLocaleString()}</Text>
      
      <Title order={3} mt="xl" mb="md">Transcription</Title>
      {session.transcription ? (
        <Text style={{ whiteSpace: 'pre-wrap' }}>{session.transcription}</Text>
      ) : (
        <Text c="dimmed">No transcription available yet</Text>
      )}
    </Paper>
  );
} 