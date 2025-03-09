'use client';

import { api } from "~/trpc/react";
import { 
  Paper, 
  Title, 
  Table, 
  Badge,
  Text,
  Skeleton 
} from '@mantine/core';
import Link from "next/link";

export default function SetupsPage() {
  const { data: setups, isLoading } = api.setups.getAll.useQuery();

  if (isLoading) {
    return <Skeleton height={400} />;
  }

  return (
    <Paper p="md" radius="sm">
      <Title order={2} mb="lg">Trade Setups</Title>
      
      <Table>
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
            <Table.Tr key={setup.id}>
              <Table.Td>{setup.pair.symbol}</Table.Td>
              <Table.Td>
                <Link href={`/setup/${setup.id}`}>{setup.direction}</Link>
              </Table.Td>
              <Table.Td>{setup.entryPrice?.toString() ?? 'Not specified'}</Table.Td>
              <Table.Td>{setup.takeProfitPrice?.toString() ?? 'Not specified'}</Table.Td>
              <Table.Td>{setup.stopPrice?.toString() ?? '-'}</Table.Td>
              <Table.Td>{setup.timeframe ?? 'Not specified'}</Table.Td>
              <Table.Td>
                <Badge 
                  color={setup.status === 'active' ? 'blue' : 'gray'}
                >
                  {setup.status}
                </Badge>
              </Table.Td>
              <Table.Td>
                {new Date(setup.createdAt).toLocaleDateString()}
              </Table.Td>
             
            </Table.Tr>
          ))}
          {!setups?.length && (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text ta="center" c="dimmed">
                  No setups found
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
} 