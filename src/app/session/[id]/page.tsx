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
  Table,
  Badge,
  Image,
  SimpleGrid,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { use } from 'react';
import Chat from "~/app/_components/Chat";
import { Message } from '~/types';
import { ContentEditor } from '~/app/_components/ContentEditor'; 
import { TranscriptionContentEditor } from '~/app/_components/TranscriptionContentEditor';

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  // Use React.use to unwrap the params Promise in a client component
  const { id } = use(params);
  
  const { data: session, isLoading } = api.transcription.getById.useQuery({ 
    id: id 
  });
  
  const router = useRouter();

  const createSetupsMutation = api.setups.createFromTranscription.useMutation({
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
  const initialMessages: Message[] = [
    {
      type: 'system',
      content: `You are a personal assistant who helps manage tasks in our Task Management System. 
                You never give IDs to the user since those are just for you to keep track of. 
                When a user asks to create a task and you don't know the project to add it to for sure, clarify with the user.
                The current date is: ${new Date().toISOString().split('T')[0]}`
    }
  ]
  if (session.setups.length === 0) {
    initialMessages.push({
      type: 'ai',
      content: `Click create setups at the top right corner of the page to create setups for this transcription.`  
    })
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
      {session.transcription !== undefined ? (
        <TranscriptionContentEditor
          transcriptionId={session.id}
          initialContent={session.transcription ?? ''}
        />
      ) : (
        <Text c="dimmed">No transcription available yet</Text>
      )}

      <Title order={3} mt="xl" mb="md">Setups</Title>
      {session.setups?.length > 0 ? (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Pair</Table.Th>
              <Table.Th>Direction</Table.Th>
              <Table.Th>Entry</Table.Th>
              <Table.Th>Take Profit</Table.Th>
              <Table.Th>Stop Loss</Table.Th>
              <Table.Th>Timeframe</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {session.setups.map((setup) => (
              <Table.Tr 
                key={setup.id}
                style={{ cursor: 'pointer' }}
                onClick={() => router.push(`/setup/${setup.id}`)}
              >
                <Table.Td>{setup.pair.symbol}</Table.Td>
                <Table.Td>
                  <span className={setup.direction === 'long' ? 'text-green-500' : 'text-red-500'}>
                    {setup.direction}
                  </span>
                </Table.Td>
                <Table.Td>{setup.entryPrice?.toString() ?? 'Not specified'}</Table.Td>
                <Table.Td>{setup.takeProfitPrice?.toString() ?? 'Not specified'}</Table.Td>
                <Table.Td>{setup.stopPrice?.toString() ?? '-'}</Table.Td>
                <Table.Td>{setup.timeframe ?? 'Not specified'}</Table.Td>
                <Table.Td>
                  <Badge color={setup.status === 'active' ? 'blue' : 'gray'}>
                    {setup.status}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text c="dimmed">No setups for this session yet</Text>
      )}
      
      <Title order={3} mt="xl" mb="md">Screenshots</Title>
      {session.screenshots?.length > 0 ? (
        <SimpleGrid cols={3} spacing="md">
          {session.screenshots.map((screenshot) => (
            <div key={screenshot.id}>
              <Text size="sm" c="dimmed" mb="xs">{screenshot.timestamp}</Text>
              <Image
                src={screenshot.url}
                alt={`Screenshot from ${screenshot.timestamp}`}
                radius="md"
                onClick={() => window.open(screenshot.url, '_blank')}
                style={{ cursor: 'pointer' }}
              />
            </div>
          ))}
        </SimpleGrid>
      ) : (
        <Text c="dimmed">No screenshots for this session yet</Text>
      )}

      <Chat initialMessages={initialMessages} />
    </Paper>
  );
} 