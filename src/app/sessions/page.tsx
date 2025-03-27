'use client';

import { api } from "~/trpc/react";
import { 
  Paper, 
  Title, 
  Table, 
  Badge,
  Text,
  Skeleton,
  Button,
  Group,
} from '@mantine/core';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';

export default function ScansPage() {
  const { data: sessions, isLoading } = api.transcription.getSessions.useQuery();
  // const createSetupsMutation = api.setups.createFromTranscription.useMutation({
  //   onSuccess: () => {
  //     notifications.show({
  //       title: 'Success',
  //       message: 'Setups created successfully',
  //       color: 'green',
  //     });
  //   },
  //   onError: (error) => {
  //     notifications.show({
  //       title: 'Error',
  //       message: error.message,
  //       color: 'red',
  //     });
  //   },
  // });
  const router = useRouter();

  if (isLoading) {
    return <Skeleton height={400} />;
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <Paper p="md" radius="sm">
      <Title order={2} mb="lg">Transcription Sessions</Title>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Session ID</Table.Th>
            <Table.Th>Created</Table.Th>
            <Table.Th>Updated</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sessions?.map((session) => (
            <Table.Tr 
              key={session.id}
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/session/${session.id}`)}
            >
              <Table.Td>{session.setupId}</Table.Td>
              <Table.Td>{formatDate(session.createdAt)}</Table.Td>
              <Table.Td>{formatDate(session.updatedAt)}</Table.Td>
              <Table.Td>
                <Badge color={session.transcription ? 'green' : 'yellow'}>
                  {session.transcription ? 'Completed' : 'In Progress'}
                </Badge>
              </Table.Td>
              <Table.Td onClick={(e) => e.stopPropagation()}>
                <Group gap="xs">
                  <Button 
                    size="xs"
                    variant="light"
                    onClick={() => router.push(`/session/${session.id}`)}
                  >
                    View
                  </Button>
                  {/* {session.transcription && (
                    <Button
                      size="xs"
                      variant="light"
                      loading={createSetupsMutation.isPending}
                      onClick={() => createSetupsMutation.mutate({ transcriptionId: session.id })}
                    >
                      Create Setups
                    </Button>
                  )} */}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {!sessions?.length && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text ta="center" c="dimmed">
                  No transcription sessions found
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
} 