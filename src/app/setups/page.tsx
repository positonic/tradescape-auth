"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import {
  Paper,
  Title,
  Table,
  Badge,
  Text,
  Skeleton,
  Tabs,
  Group,
  Button,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { SetupDrawer } from "~/components/SetupDrawer";

export default function SetupsPage() {
  const [drawerOpened, setDrawerOpened] = useState(false);
  const { data: publicSetups, isLoading: publicLoading } =
    api.setups.getPublic.useQuery();
  const { data: privateSetups, isLoading: privateLoading } =
    api.setups.getPrivate.useQuery();
  const router = useRouter();

  if (publicLoading || privateLoading) {
    return <Skeleton height={400} />;
  }

  const renderSetupsTable = (setups: typeof publicSetups) => (
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
          <Table.Th>Created</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {setups?.map((setup) => (
          <Table.Tr
            key={setup.id}
            style={{ cursor: "pointer" }}
            onClick={() => router.push(`/setup/${setup.id}`)}
          >
            <Table.Td>{setup.pair.symbol}</Table.Td>
            <Table.Td>
              <span
                className={
                  setup.direction.toLowerCase() === "long"
                    ? "text-green-500"
                    : "text-red-500"
                }
              >
                {setup.direction}
              </span>
            </Table.Td>
            <Table.Td>
              {setup.entryPrice?.toString() ?? "Not specified"}
            </Table.Td>
            <Table.Td>
              {setup.takeProfitPrice?.toString() ?? "Not specified"}
            </Table.Td>
            <Table.Td>{setup.stopPrice?.toString() ?? "-"}</Table.Td>
            <Table.Td>{setup.timeframe ?? "Not specified"}</Table.Td>
            <Table.Td>
              <Group gap="xs">
                <Badge color={setup.status === "active" ? "blue" : "gray"}>
                  {setup.status}
                </Badge>
                <Badge color={setup.privacy === "public" ? "green" : "yellow"}>
                  {setup.privacy}
                </Badge>
              </Group>
            </Table.Td>
            <Table.Td>
              {new Date(setup.createdAt).toLocaleDateString()}
            </Table.Td>
          </Table.Tr>
        ))}
        {!setups?.length && (
          <Table.Tr>
            <Table.Td colSpan={8}>
              <Text ta="center" c="dimmed">
                No setups found
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  );

  // const renderTranscriptionsTable = () => (
  //   <Table highlightOnHover>
  //     <Table.Thead>
  //       <Table.Tr>
  //         <Table.Th>Session ID</Table.Th>
  //         <Table.Th>Created</Table.Th>
  //         <Table.Th>Updated</Table.Th>
  //         <Table.Th>Actions</Table.Th>
  //       </Table.Tr>
  //     </Table.Thead>
  //     <Table.Tbody>
  //       {transcriptionSessions?.map((session) => (
  //         <Table.Tr
  //           key={session.id}
  //           style={{ cursor: 'pointer' }}
  //           onClick={() => router.push(`/transcription/${session.id}`)}
  //         >
  //           <Table.Td>{session.sessionId}</Table.Td>
  //           <Table.Td>{new Date(session.createdAt).toLocaleDateString()}</Table.Td>
  //           <Table.Td>{new Date(session.updatedAt).toLocaleDateString()}</Table.Td>
  //           <Table.Td onClick={(e) => e.stopPropagation()}>
  //             <Button
  //               size="xs"
  //               onClick={() => {
  //                 if (session.transcription) {
  //                   createSetupsMutation.mutate({
  //                     transcriptionId: session.id
  //                   });
  //                 }
  //               }}
  //               loading={createSetupsMutation.isPending}
  //               disabled={!session.transcription}
  //             >
  //               Create Setups
  //             </Button>
  //           </Table.Td>
  //         </Table.Tr>
  //       ))}
  //       {!transcriptionSessions?.length && (
  //         <Table.Tr>
  //           <Table.Td colSpan={4}>
  //             <Text ta="center" c="dimmed">
  //               No transcription sessions found
  //             </Text>
  //           </Table.Td>
  //         </Table.Tr>
  //       )}
  //     </Table.Tbody>
  //   </Table>
  // );

  return (
    <>
      <Paper p="md" radius="sm">
        <Group justify="space-between" mb="lg">
          <Title order={2}>Trade Setups</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setDrawerOpened(true)}
          >
            Create Setup
          </Button>
        </Group>
        <Tabs defaultValue="private">
          <Tabs.List>
            <Tabs.Tab value="private">My Setups</Tabs.Tab>
            <Tabs.Tab value="public">Public Setups</Tabs.Tab>
            {/* <Tabs.Tab value="transcriptions">Transcriptions</Tabs.Tab> */}
          </Tabs.List>

          <Tabs.Panel value="private" pt="md">
            {renderSetupsTable(privateSetups)}
          </Tabs.Panel>
          <Tabs.Panel value="public" pt="md">
            {renderSetupsTable(publicSetups)}
          </Tabs.Panel>
          {/* <Tabs.Panel value="transcriptions" pt="md">
            {renderTranscriptionsTable()}
          </Tabs.Panel> */}
        </Tabs>
      </Paper>

      <SetupDrawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
      />
    </>
  );
}
