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
  Grid,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState, useEffect } from 'react';
import Chat from "~/app/_components/Chat";
import type { Message } from '~/types';
import { TranscriptionContentEditor } from '~/app/_components/TranscriptionContentEditor';
import { useSession } from "next-auth/react";

interface SessionDetailProps {
  sessionId: string;
  showFullDetails?: boolean;
  onClose?: () => void;
}

export default function SessionDetail({ sessionId, showFullDetails = true, onClose }: SessionDetailProps) {
  const { data: session, isLoading } = api.transcription.getById.useQuery({ 
    id: sessionId 
  });
  
  const router = useRouter();
  const { data: clientSession } = useSession();
  const [transcriptionContent, setTranscriptionContent] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState<string>('');
  const utils = api.useUtils();

  const updateTitleMutation = api.transcription.updateTitle.useMutation({
    onSuccess: () => {
      void utils.transcription.getById.invalidate({ id: sessionId });
      void utils.transcription.getSessions.invalidate();
      setIsEditingTitle(false);
    },
  });

  // Update the state when session data is loaded
  useEffect(() => {
    if (session?.transcription) {
      setTranscriptionContent(session.transcription);
    }
    if (session?.title) {
      setTitleValue(session.title);
    }
  }, [session?.transcription, session?.title]);

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
  ];

  if (session.setups?.length === 0) {
    initialMessages.push({
      type: 'ai',
      content: `Click create setups at the top right corner of the page to create setups for this transcription.`  
    });
  }

  return (
    <Paper p="md" style={{ height: '100%', overflow: 'auto' }}>
      <Group justify="space-between" mb="lg">
        <Group>
          {isEditingTitle ? (
            <Group gap="xs">
              <TextInput
                value={titleValue}
                onChange={(e) => setTitleValue(e.currentTarget.value)}
                size="sm"
                autoFocus
                placeholder="Enter title"
                w={200}
              />
              <Button
                size="xs"
                loading={updateTitleMutation.isPending}
                onClick={() => {
                  updateTitleMutation.mutate({ id: sessionId, title: titleValue });
                }}
              >
                Save
              </Button>
              <Button
                size="xs"
                variant="subtle"
                onClick={() => {
                  setIsEditingTitle(false);
                  setTitleValue(session.title ?? '');
                }}
              >
                Cancel
              </Button>
            </Group>
          ) : (
            <Group>
              <Title order={2}>
                {session.title ?? 'Transcription Details'}
              </Title>
              {clientSession?.user && (
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => setIsEditingTitle(true)}
                >
                  Edit Title
                </Button>
              )}
            </Group>
          )}
        </Group>
        <Group>
          {session.transcription && (
            <Button
              loading={createSetupsMutation.isPending}
              onClick={() => createSetupsMutation.mutate({ transcriptionId: session.id })}
            >
              Create Setups
            </Button>
          )}
          {onClose && (
            <Button variant="subtle" onClick={onClose}>
              Close
            </Button>
          )}
        </Group>
      </Group>
      
      <Text mb="xs"><strong>Session ID:</strong> {session.sessionId}</Text>
      <Text mb="xs"><strong>Created:</strong> {new Date(session.createdAt).toLocaleString()}</Text>
      <Text mb="xs"><strong>Updated:</strong> {new Date(session.updatedAt).toLocaleString()}</Text>
      
      <Title order={3} mt="xl" mb="md">Transcription</Title>
      {session?.transcription !== undefined ? (
        <TranscriptionContentEditor
          transcriptionId={session.id}
          initialContent={session.transcription ?? ''}
          onSave={(content) => setTranscriptionContent(content)}
        />
      ) : (
        <Text c="dimmed">No transcription available yet</Text>
      )}

      {showFullDetails && (
        <>
          <Title order={3} mt="xl" mb="md">The Plan</Title>
          {transcriptionContent && session?.screenshots?.length > 0 ? (
            <Paper p="md" withBorder>
              {(() => {
                // Sort screenshots by timestamp (most recent first)
                const screenshots = session.screenshots || [];
                const sortedScreenshots = [...screenshots].sort(
                  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                
                // Split transcription by [SCREENSHOT] placeholder
                const segments = transcriptionContent.split('[SCREENSHOT]');
                
                return (
                  <>
                    {segments.map((segment, index) => (
                      <div key={index}>
                        {/* If this is the first segment, render it as text first */}
                        {index === 0 && segment && (
                          <Text mb="md">{segment}</Text>
                        )}
                        
                        {/* Render screenshot with corresponding text to the right */}
                        {index < segments.length - 1 && index < sortedScreenshots.length && sortedScreenshots[index] && (
                          <Grid mb="md">
                            <Grid.Col span={6}>
                              <Image
                                src={sortedScreenshots[index]?.url}
                                alt={`Screenshot ${index + 1}`}
                                radius="md"
                                onClick={() => window.open(sortedScreenshots[index]?.url, '_blank')}
                                style={{ cursor: 'pointer' }}
                              />
                            </Grid.Col>
                            <Grid.Col span={6}>
                              {/* Show the text that follows this screenshot */}
                              {index + 1 < segments.length && segments[index + 1] && (
                                <Text>{segments[index + 1]}</Text>
                              )}
                            </Grid.Col>
                          </Grid>
                        )}
                      </div>
                    ))}
                  </>
                );
              })()}
            </Paper>
          ) : (
            <Text c="dimmed">No plan with screenshots available yet</Text>
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
                {session.setups?.map((setup) => (
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
              {session.screenshots
                .slice()
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((screenshot) => (
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
        </>
      )}
    </Paper>
  );
}