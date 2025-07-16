"use client";
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
  TextInput,
  Drawer,
} from '@mantine/core';
import SignInButton from "~/app/_components/SignInButton";
// import { auth } from "~/server/auth"; // Removed server-side auth import
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react"; // Added client-side session hook
import { useState } from 'react';
import SessionDetail from "~/app/_components/SessionDetail";


export default function ScansPage() { // Removed async
  const { data: sessions, isLoading: isLoadingSessions } = api.transcription.getSessions.useQuery(); // Renamed isLoading for clarity
  const { data: clientSession, status: sessionStatus } = useSession(); // Use client-side session
  const router = useRouter();
  const utils = api.useUtils();
  const updateTitleMutation = api.transcription.updateTitle.useMutation({
    onSuccess: () => utils.transcription.getSessions.invalidate(),
  });
  // const session = await auth(); // Removed server-side session fetching

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [drawerSessionId, setDrawerSessionId] = useState<string | null>(null);
  const [drawerOpened, setDrawerOpened] = useState(false);

  // Update loading state to consider both session and data fetching
  if (isLoadingSessions || sessionStatus === "loading") {
    return <Skeleton height={400} />;
  }

  const formatDuration = (startDate: Date, endDate: Date) => {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleRowClick = (sessionId: string) => {
    setDrawerSessionId(sessionId);
    setDrawerOpened(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpened(false);
    setDrawerSessionId(null);
  };

  return (
    <>
      <Drawer
        opened={drawerOpened}
        onClose={handleCloseDrawer}
        title="Session Details"
        size="80%"
        position="right"
        padding="md"
      >
        {drawerSessionId && (
          <SessionDetail 
            sessionId={drawerSessionId} 
            showFullDetails={false} 
            onClose={handleCloseDrawer}
          />
        )}
      </Drawer>
    <Paper p="md" radius="sm">
      <Title order={2} mb="lg">Transcription Sessions</Title>
      <Group gap="md" justify="center" wrap="wrap">
          {/* Use clientSession to determine auth state */}
          {!clientSession?.user ?  <SignInButton /> : <></>}
        </Group>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Duration</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sessions?.map((session) => {
            const isEditing = editingSessionId === session.id;
            return (
              <Table.Tr 
                key={session.id}
                style={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(session.id)}
              >
                <Table.Td>
                  {isEditing ? (
                    <Group gap="xs">
                      <TextInput
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.currentTarget.value)}
                        size="xs"
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                      <Button
                        size="xs"
                        loading={updateTitleMutation.isPending}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await updateTitleMutation.mutateAsync({ id: session.id, title: editingTitle });
                          setEditingSessionId(null);
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={e => {
                          e.stopPropagation();
                          setEditingSessionId(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </Group>
                  ) : (
                    <Group gap="xs">
                      <Text>{session.title ?? <span style={{ color: '#aaa' }}>No title</span>}</Text>
                      {clientSession?.user && (
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={e => {
                            e.stopPropagation();
                            setEditingSessionId(session.id);
                            setEditingTitle(session.title ?? '');
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </Group>
                  )}
                </Table.Td>
                <Table.Td>{formatDuration(session.createdAt, session.updatedAt)}</Table.Td>
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
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
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
    </>
  );
} 