'use client';

import { useState, useEffect } from 'react';
import { api } from "~/trpc/react";
import type { Decimal } from '@prisma/client/runtime/library';
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
  Tabs,
  Flex,
  ActionIcon,
  Drawer,
} from '@mantine/core';
import { IconKey } from '@tabler/icons-react';
import { useSession } from "next-auth/react";
import SignInButton from "~/app/_components/SignInButton";
import KeyManager from "~/app/_components/KeyManager";
import { formatCurrency, formatDateTime } from '~/lib/tradeUtils';
import { useSyncTrades } from '~/hooks/useSyncTrades';
import { KeyStorage, encryptForTransmission } from '~/lib/keyEncryption';
import { CreatePositionsButton } from '~/app/setup/[slug]/_components/CreatePositionsButton';
import { PositionValidationButton } from './_components/PositionValidationButton';

interface Trade {
  tradeId: string;
  time: number | bigint;
  pair: string;
  type: string;
  vol: number;
  price: string;
  cost: string;
  fee: string;
  exchange: string;
}

interface Order {
  id: number;
  time: number | bigint;
  pair: string;
  type: string;
  amount: Decimal;
  averagePrice: Decimal;
  totalCost: Decimal;
  exchange: string;
}

interface Position {
  id: number;
  time: number | bigint;
  pair: string;
  direction: string;
  status: string;
  amount: Decimal;
  averageEntryPrice: Decimal;
  averageExitPrice: Decimal;
  profitLoss: Decimal;
  duration: string;
}

export default function TradesPage() {
  const { data: clientSession, status: sessionStatus } = useSession();
  const [since] = useState<number | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'trades' | 'orders' | 'positions'>('trades');
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
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

  const { data: positionsData, isLoading: isLoadingPositions } = api.trades.getPositions.useQuery({
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  }, {
    enabled: !!clientSession?.user && activeTab === 'positions',
  });

  const { data: positionTradesData, isLoading: isLoadingPositionTrades } = api.trades.getTradesForPosition.useQuery({
    positionId: selectedPosition?.id ?? 0,
  }, {
    enabled: !!selectedPosition,
  });

  const syncTradesMutation = useSyncTrades();

  const handleKeysReady = (encryptedKeys: string) => {
    syncTradesMutation.mutate({
      encryptedKeys,
      since,
    });
  };

  const handleQuickSync = () => {
    const keys = KeyStorage.load();
    if (keys && keys.length > 0) {
      const encrypted = encryptForTransmission(keys);
      syncTradesMutation.mutate({ encryptedKeys: encrypted, mode: 'incremental' });
    }
  };

  const handleFullSync = () => {
    const keys = KeyStorage.load();
    if (keys && keys.length > 0) {
      const encrypted = encryptForTransmission(keys);
      syncTradesMutation.mutate({ encryptedKeys: encrypted, mode: 'full' });
    }
  };

  const handlePositionClick = (position: Position) => {
    setSelectedPosition(position);
    setDrawerOpened(true);
  };

  const [hasStoredKeys, setHasStoredKeys] = useState(false);
  const [showKeyManager, setShowKeyManager] = useState(true);

  useEffect(() => {
    // Check for stored keys on client-side only
    const keys = KeyStorage.hasKeys();
    setHasStoredKeys(keys);
    setShowKeyManager(!keys);
  }, []);

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

  const isLoading = activeTab === 'trades' ? isLoadingTrades : activeTab === 'orders' ? isLoadingOrders : isLoadingPositions;
  const currentData = activeTab === 'trades' ? tradesData : activeTab === 'orders' ? ordersData : positionsData;
  const totalPages = Math.ceil((currentData?.totalCount ?? 0) / pageSize);

  return (
    <Paper p="md" radius="sm">
      <Flex justify="space-between" align="center" mb="lg">
        <Title order={2}>Trades Management</Title>
        
        <Group gap="sm">
          {/* Key icon to toggle key manager */}
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => setShowKeyManager(!showKeyManager)}
            title="Manage Exchange API Keys"
          >
            <IconKey size={20} />
          </ActionIcon>
          
          {/* Sync buttons - only show if we have keys */}
          {hasStoredKeys && (
            <Group gap="sm">
              <Button
                onClick={handleQuickSync}
                loading={syncTradesMutation.isPending}
                variant="gradient"
                gradient={{ from: '#23dd7a', to: '#1b9b57' }}
                size="sm"
              >
                ⚡ Quick Sync
              </Button>
              <Button
                onClick={handleFullSync}
                loading={syncTradesMutation.isPending}
                size="sm"
              >
                🔄 Full Sync
              </Button>
              <CreatePositionsButton />
              <PositionValidationButton />
            </Group>
          )}
        </Group>
      </Flex>
      
      {/* Key Management Section - Hidden by default, shown if no keys or when key icon clicked */}
      {(!hasStoredKeys || showKeyManager) && (
        <Paper p="md" withBorder mb="xl">
          <Title order={4} mb="md">Exchange API Keys</Title>
          <KeyManager 
            onKeysReady={handleKeysReady} 
            isLoading={syncTradesMutation.isPending}
          />
        </Paper>
      )}
      

      {/* Tabs for Trades, Orders, and Positions */}
      <Tabs value={activeTab} onChange={(value) => {
        setActiveTab(value as 'trades' | 'orders' | 'positions');
        setCurrentPage(1);
      }}>
        <Tabs.List>
          <Tabs.Tab value="trades">
            Trades ({tradesData?.totalCount ?? 0})
          </Tabs.Tab>
          <Tabs.Tab value="orders">
            Orders ({ordersData?.totalCount ?? 0})
          </Tabs.Tab>
          <Tabs.Tab value="positions">
            Positions ({positionsData?.totalCount ?? 0})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="trades">
          {isLoading ? (
            <Skeleton height={400} />
          ) : (
            <>
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
                {tradesData?.trades.map((trade: Trade) => (
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
              
              {/* Pagination for trades */}
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
        </Tabs.Panel>

        <Tabs.Panel value="orders">
          {isLoading ? (
            <Skeleton height={400} />
          ) : (
            <>
              <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Pair</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Avg Price</Table.Th>
                  <Table.Th>Total Cost</Table.Th>
                  <Table.Th>Exchange</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {ordersData?.orders.map((order: Order) => (
                  <Table.Tr key={order.id}>
                    <Table.Td>{formatDateTime(order.time)}</Table.Td>
                    <Table.Td>{order.pair}</Table.Td>
                    <Table.Td>
                      <Badge color={order.type === 'buy' ? 'green' : 'red'}>
                        {order.type}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{order.amount.toString()}</Table.Td>
                    <Table.Td>{formatCurrency(order.averagePrice.toString())}</Table.Td>
                    <Table.Td>{formatCurrency(order.totalCost.toString())}</Table.Td>
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
              
              {/* Pagination for orders */}
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
        </Tabs.Panel>

        <Tabs.Panel value="positions">
          {isLoading ? (
            <Skeleton height={400} />
          ) : (
            <>
              <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Pair</Table.Th>
                  <Table.Th>Direction</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Entry Price</Table.Th>
                  <Table.Th>Exit Price</Table.Th>
                  <Table.Th>P&L</Table.Th>
                  <Table.Th>Duration</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {positionsData?.positions.map((position: Position) => (
                  <Table.Tr 
                    key={position.id}
                    onClick={() => handlePositionClick(position)}
                    style={{ cursor: 'pointer' }}
                    className="hover:bg-gray-50"
                  >
                    <Table.Td>{formatDateTime(position.time)}</Table.Td>
                    <Table.Td>{position.pair}</Table.Td>
                    <Table.Td>
                      <Badge color={position.direction === 'long' ? 'green' : 'red'}>
                        {position.direction}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={position.status === 'closed' ? 'blue' : position.status === 'open' ? 'yellow' : 'gray'}>
                        {position.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{position.amount.toString()}</Table.Td>
                    <Table.Td>{formatCurrency(position.averageEntryPrice.toString())}</Table.Td>
                    <Table.Td>{formatCurrency(position.averageExitPrice.toString())}</Table.Td>
                    <Table.Td>
                      <Badge color={Number(position.profitLoss.toString()) >= 0 ? 'green' : 'red'}>
                        {formatCurrency(position.profitLoss.toString())}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{position.duration}</Table.Td>
                  </Table.Tr>
                ))}
                {!positionsData?.positions.length && (
                  <Table.Tr>
                    <Table.Td colSpan={9}>
                      <Text ta="center" c="dimmed">
                        No positions found
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
              </Table>
              
              {/* Pagination for positions */}
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
        </Tabs.Panel>
      </Tabs>

      {/* Drawer for Position Trades */}
      <Drawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        title={selectedPosition ? `Trades for Position ${selectedPosition.pair} - ${selectedPosition.direction}` : 'Position Trades'}
        position="bottom"
        size="25%"
        padding="lg"
        withOverlay={false}
      >
        {selectedPosition && (
          <>
            <Group mb="md">
              <Text size="sm" c="dimmed">
                Position: {selectedPosition.pair} | Direction: {selectedPosition.direction} | Status: {selectedPosition.status}
              </Text>
            </Group>
            
            {isLoadingPositionTrades ? (
              <Skeleton height={300} />
            ) : (
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
                  {positionTradesData?.trades.map((trade: Trade) => (
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
                  {!positionTradesData?.trades.length && (
                    <Table.Tr>
                      <Table.Td colSpan={8}>
                        <Text ta="center" c="dimmed">
                          No trades found for this position
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            )}
          </>
        )}
      </Drawer>
    </Paper>
  );
}