'use client';

import { api } from "~/trpc/react";
import { 
  Paper, 
  Title, 
  Table, 
  Badge,
  Text,
  Skeleton,
  Tabs,
  Group
} from '@mantine/core';
import { useRouter } from 'next/navigation';

export default function SetupsPage() {
  const { data: publicSetups, isLoading: publicLoading } = api.setups.getPublic.useQuery();
  const { data: privateSetups, isLoading: privateLoading } = api.setups.getPrivate.useQuery();
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
            style={{ cursor: 'pointer' }}
            onClick={() => router.push(`/setup/${setup.id}`)}
          >
            <Table.Td>{setup.coin?.symbol}</Table.Td>
            <Table.Td>
              <span className="text-blue-500">
                {setup.direction}
              </span>
            </Table.Td>
            <Table.Td>{setup.entryPrice?.toString() ?? 'Not specified'}</Table.Td>
            <Table.Td>{setup.takeProfitPrice?.toString() ?? 'Not specified'}</Table.Td>
            <Table.Td>{setup.stopPrice?.toString() ?? '-'}</Table.Td>
            <Table.Td>{setup.timeframe ?? 'Not specified'}</Table.Td>
            <Table.Td>
              <Group gap="xs">
                <Badge color={setup.status === 'active' ? 'blue' : 'gray'}>
                  {setup.status}
                </Badge>
                <Badge color={setup.privacy === 'public' ? 'green' : 'yellow'}>
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

  return (
    <Paper p="md" radius="sm">
      <Title order={2} mb="lg">Trade Setups</Title>
      <Tabs defaultValue="private">
        <Tabs.List>
          <Tabs.Tab value="private">My Setups</Tabs.Tab>
          <Tabs.Tab value="public">Public Setups</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="private" pt="md">
          {renderSetupsTable(privateSetups)}
        </Tabs.Panel>
        <Tabs.Panel value="public" pt="md">
          {renderSetupsTable(publicSetups)}
        </Tabs.Panel>

        
      </Tabs>
    </Paper>
  );
} 