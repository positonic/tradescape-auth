'use client';

import { useState } from 'react';
import { api } from "~/trpc/react";
import { 
  Paper, 
  Title, 
  Button,
  Group,
  Text,
  Skeleton,
  Table,
  Badge,
  Pagination,
} from '@mantine/core';
import { useSession } from "next-auth/react";
import SignInButton from "~/app/_components/SignInButton";
import KeyManager from "~/app/_components/KeyManager";
import { formatCurrency, formatDateTime } from '~/lib/tradeUtils';
import { useSyncTrades } from '~/hooks/useSyncTrades';

export default function TradesPage() {
  const { data: clientSession, status: sessionStatus } = useSession();
  const [since] = useState<number | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'trades' | 'orders'>('trades');
  const pageSize = 20;

  const { data: tradesData, isLoading: isLoadingTrades } = api.trades.getTrades.useQuery({
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  }, {
    enabled: !!clientSession?.user && activeTab === 'trades',
  });

  const { data: ordersData, isLoading: isLoadingOrders } = api.trades.getOrders.useQuery({
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  }, {
    enabled: !!clientSession?.user && activeTab === 'orders',
  });

  const syncTradesMutation = useSyncTrades();

  const handleKeysReady = (encryptedKeys: string) => {
    syncTradesMutation.mutate({
      encryptedKeys,
      since,
    });
  };

  if (sessionStatus === "loading") {
    return <Skeleton height={400} />;
  }

  if (!clientSession?.user) {
    return (
      <Paper p="md" radius="sm">
        <Title order={2} mb="lg">Trades</Title>
        <Group gap="md" justify="center" wrap="wrap">
          <SignInButton />
        </Group>
      </Paper>
    );
  }

  const isLoading = activeTab === 'trades' ? isLoadingTrades : isLoadingOrders;
  const currentData = activeTab === 'trades' ? tradesData : ordersData;
  const totalPages = Math.ceil((currentData?.totalCount ?? 0) / pageSize);

  return (
    <Paper p="md" radius="sm">
      <Title order={2} mb="lg">Trades Management</Title>
      
      {/* Key Management and Sync Section */}
      <KeyManager 
        onKeysReady={handleKeysReady} 
        isLoading={syncTradesMutation.isPending}
      />
      
      {/* Optional: Since timestamp input */}
      {/* <Paper p="md" withBorder mb="xl">
        <TextInput
          label="Since (timestamp)"
          placeholder="Optional: Only sync trades after this timestamp"
          value={since?.toString() || ''}
          onChange={(e) => setSince(e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined)}
          type="number"
        />
      </Paper> */}

      {/* Tab Navigation */}
      <Group mb="lg">
        <Button
          variant={activeTab === 'trades' ? 'filled' : 'outline'}
          onClick={() => {
            setActiveTab('trades');
            setCurrentPage(1);
          }}
        >
          Trades ({tradesData?.totalCount ?? 0})
        </Button>
        <Button
          variant={activeTab === 'orders' ? 'filled' : 'outline'}
          onClick={() => {
            setActiveTab('orders');
            setCurrentPage(1);
          }}
        >
          Orders ({ordersData?.totalCount ?? 0})
        </Button>
      </Group>

      {/* Content */}
      {isLoading ? (
        <Skeleton height={400} />
      ) : (
        <>
          {activeTab === 'trades' && (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Pair</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Volume</Table.Th>
                  <Table.Th>Price</Table.Th>
                  <Table.Th>Cost</Table.Th>
                  <Table.Th>Fee</Table.Th>
                  <Table.Th>Exchange</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tradesData?.trades.map((trade: any) => (
                  <Table.Tr key={trade.tradeId}>
                    <Table.Td>{formatDateTime(trade.time)}</Table.Td>
                    <Table.Td>{trade.pair}</Table.Td>
                    <Table.Td>
                      <Badge color={trade.type === 'buy' ? 'green' : 'red'}>
                        {trade.type}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{trade.vol}</Table.Td>
                    <Table.Td>{formatCurrency(trade.price)}</Table.Td>
                    <Table.Td>{formatCurrency(trade.cost)}</Table.Td>
                    <Table.Td>{formatCurrency(trade.fee)}</Table.Td>
                    <Table.Td>{trade.exchange}</Table.Td>
                  </Table.Tr>
                ))}
                {!tradesData?.trades.length && (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Text ta="center" c="dimmed">
                        No trades found
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}

          {activeTab === 'orders' && (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Pair</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Volume</Table.Th>
                  <Table.Th>Price</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Exchange</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {ordersData?.orders.map((order: any) => (
                  <Table.Tr key={order.id}>
                    <Table.Td>{formatDateTime(order.time)}</Table.Td>
                    <Table.Td>{order.pair}</Table.Td>
                    <Table.Td>
                      <Badge color={order.type === 'buy' ? 'green' : 'red'}>
                        {order.type}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{order.vol}</Table.Td>
                    <Table.Td>{formatCurrency(order.price)}</Table.Td>
                    <Table.Td>
                      <Badge color={order.status === 'closed' ? 'blue' : 'yellow'}>
                        {order.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{order.exchange}</Table.Td>
                  </Table.Tr>
                ))}
                {!ordersData?.orders.length && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text ta="center" c="dimmed">
                        No orders found
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Group justify="center" mt="lg">
              <Pagination
                value={currentPage}
                onChange={setCurrentPage}
                total={totalPages}
                size="sm"
              />
            </Group>
          )}
        </>
      )}
    </Paper>
  );
}