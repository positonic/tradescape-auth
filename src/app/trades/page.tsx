"use client";

import { useState, useEffect } from "react";
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
  Tabs,
  Flex,
  ActionIcon,
  Select,
  Anchor,
} from "@mantine/core";
import { IconKey } from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import SignInButton from "~/app/_components/SignInButton";
import KeyManager from "~/app/_components/KeyManager";
import { formatCurrency, formatDateTime } from "~/lib/tradeUtils";
import { useSyncTrades } from "~/hooks/useSyncTrades";
import {
  getEncryptedKeysForTransmission,
  hasStoredKeys as checkHasStoredKeys,
} from "~/lib/keyUtils";
import { CreatePositionsButton } from "~/app/setup/[slug]/_components/CreatePositionsButton";
import { PositionValidationButton } from "./_components/PositionValidationButton";
import { DeletePositionsButton } from "./_components/DeletePositionsButton";

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

// Simplified position interface for state management
interface PositionState {
  id: number;
  pair: string;
  direction: string;
  status: string;
}

export default function TradesPage() {
  const { data: clientSession, status: sessionStatus } = useSession();
  const [since] = useState<number | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"trades" | "orders" | "positions">(
    "trades",
  );
  const [selectedPosition, setSelectedPosition] =
    useState<PositionState | null>(null);
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(
    null,
  );
  const [bottomBlockContent, setBottomBlockContent] = useState<
    "orders" | "position-details" | null
  >(null);
  const pageSize = 20;

  const { data: tradesData, isLoading: isLoadingTrades } =
    api.trades.getTrades.useQuery(
      {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        pairFilter: selectedPair ?? undefined,
      },
      {
        enabled: !!clientSession?.user && activeTab === "trades",
      },
    );

  const { data: ordersData, isLoading: isLoadingOrders } =
    api.trades.getOrders.useQuery(
      {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        pairFilter: selectedPair ?? undefined,
      },
      {
        enabled: !!clientSession?.user && activeTab === "orders",
      },
    );

  const { data: positionsData, isLoading: isLoadingPositions } =
    api.trades.getPositions.useQuery(
      {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        pairFilter: selectedPair ?? undefined,
      },
      {
        enabled: !!clientSession?.user && activeTab === "positions",
      },
    );

  const { data: positionOrdersData, isLoading: isLoadingPositionOrders } =
    api.trades.getOrdersForPosition.useQuery(
      {
        positionId: selectedPosition?.id ?? 0,
      },
      {
        enabled: !!selectedPosition,
      },
    );

  const { data: selectedPositionData, isLoading: isLoadingSelectedPosition } =
    api.trades.getPositionById.useQuery(
      {
        positionId: selectedPositionId ?? 0,
      },
      {
        enabled: !!selectedPositionId,
      },
    );

  const { data: pairsData } = api.pairs.getAll.useQuery(undefined, {
    enabled: !!clientSession?.user,
  });

  const syncTradesMutation = useSyncTrades();

  const handleKeysReady = (encryptedKeys: string) => {
    syncTradesMutation.mutate({
      encryptedKeys,
      since,
    });
  };

  const handleQuickSync = () => {
    console.log("⚡ Quick Sync button clicked");
    const encryptedKeys = getEncryptedKeysForTransmission();

    if (encryptedKeys) {
      console.log("📤 Sending quick sync request...");
      syncTradesMutation.mutate({ encryptedKeys, mode: "incremental" });
    }
  };

  const handleFullSync = () => {
    console.log("🔄 Full Sync button clicked");
    const encryptedKeys = getEncryptedKeysForTransmission();

    if (encryptedKeys) {
      console.log("📤 Sending full sync request...");
      syncTradesMutation.mutate({ encryptedKeys, mode: "full" });
    }
  };

  const handlePositionClick = (position: {
    id: number;
    pair: string;
    direction: string;
    status: string;
  }) => {
    setSelectedPosition({
      id: position.id,
      pair: position.pair,
      direction: position.direction,
      status: position.status,
    });
    setBottomBlockContent("orders");
  };

  const handlePositionLinkClick = (positionId: number) => {
    setSelectedPositionId(positionId);
    setBottomBlockContent("position-details");
  };

  const [hasStoredKeys, setHasStoredKeys] = useState(false);
  const [showKeyManager, setShowKeyManager] = useState(true);

  useEffect(() => {
    // Check for stored keys on client-side only
    const keys = checkHasStoredKeys();
    setHasStoredKeys(keys);
    setShowKeyManager(!keys);
  }, []);

  if (sessionStatus === "loading") {
    return <Skeleton height={400} />;
  }

  if (!clientSession?.user) {
    return (
      <Paper p="md" radius="sm">
        <Title order={2} mb="lg">
          Trades
        </Title>
        <Group gap="md" justify="center" wrap="wrap">
          <SignInButton />
        </Group>
      </Paper>
    );
  }

  const isLoading =
    activeTab === "trades"
      ? isLoadingTrades
      : activeTab === "orders"
        ? isLoadingOrders
        : isLoadingPositions;
  const currentData =
    activeTab === "trades"
      ? tradesData
      : activeTab === "orders"
        ? ordersData
        : positionsData;
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
                gradient={{ from: "#23dd7a", to: "#1b9b57" }}
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
              <DeletePositionsButton />
              <PositionValidationButton />
            </Group>
          )}
        </Group>
      </Flex>

      {/* Key Management Section - Hidden by default, shown if no keys or when key icon clicked */}
      {(!hasStoredKeys || showKeyManager) && (
        <Paper p="md" withBorder mb="xl">
          <Title order={4} mb="md">
            Exchange API Keys
          </Title>
          <KeyManager
            onKeysReady={handleKeysReady}
            isLoading={syncTradesMutation.isPending}
          />
        </Paper>
      )}

      {/* Pair Filter */}
      <Group mb="md">
        <Select
          placeholder="All pairs"
          data={[
            { value: "", label: "All pairs" },
            ...(pairsData?.map((pair) => ({
              value: pair.symbol,
              label: pair.symbol,
            })) ?? []),
          ]}
          value={selectedPair}
          onChange={(value) => {
            setSelectedPair(value);
            setCurrentPage(1);
          }}
          clearable
          searchable
          style={{ minWidth: 200 }}
        />
      </Group>

      {/* Tabs for Trades, Orders, and Positions */}
      <Tabs
        value={activeTab}
        onChange={(value) => {
          setActiveTab(value as "trades" | "orders" | "positions");
          setCurrentPage(1);
        }}
      >
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
                        <Badge color={trade.type === "buy" ? "green" : "red"}>
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
                    <Table.Th>Direction</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Avg Price</Table.Th>
                    <Table.Th>Total Cost</Table.Th>
                    <Table.Th>Exchange</Table.Th>
                    <Table.Th>Position</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ordersData?.orders.map((order) => (
                    <Table.Tr key={order.id}>
                      <Table.Td>{formatDateTime(order.time)}</Table.Td>
                      <Table.Td>{order.pair}</Table.Td>
                      <Table.Td>
                        <Badge color={order.type === "buy" ? "green" : "red"}>
                          {order.type}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {order.direction ? (
                          <Badge
                            color={
                              order.direction === "long" ? "blue" : "orange"
                            }
                            variant="light"
                          >
                            {order.direction}
                          </Badge>
                        ) : (
                          <Text c="dimmed" size="sm">
                            -
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>{String(order.amount)}</Table.Td>
                      <Table.Td>
                        {formatCurrency(String(order.averagePrice))}
                      </Table.Td>
                      <Table.Td>
                        {formatCurrency(String(order.totalCost))}
                      </Table.Td>
                      <Table.Td>{order.exchange}</Table.Td>
                      <Table.Td>
                        {order.positionId ? (
                          <Anchor
                            onClick={() =>
                              handlePositionLinkClick(order.positionId!)
                            }
                            style={{ cursor: "pointer" }}
                          >
                            Position #{order.positionId}
                          </Anchor>
                        ) : (
                          <Text c="dimmed" size="sm">
                            No position
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {!ordersData?.orders.length && (
                    <Table.Tr>
                      <Table.Td colSpan={10}>
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
                  {positionsData?.positions.map((position) => (
                    <Table.Tr
                      key={position.id}
                      onClick={() => handlePositionClick(position)}
                      style={{ cursor: "pointer" }}
                      className="hover:bg-gray-50"
                    >
                      <Table.Td>{formatDateTime(position.time)}</Table.Td>
                      <Table.Td>{position.pair}</Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            position.direction === "long" ? "green" : "red"
                          }
                        >
                          {position.direction}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            position.status === "closed"
                              ? "blue"
                              : position.status === "open"
                                ? "yellow"
                                : "gray"
                          }
                        >
                          {position.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{String(position.amount)}</Table.Td>
                      <Table.Td>
                        {formatCurrency(String(position.averageEntryPrice))}
                      </Table.Td>
                      <Table.Td>
                        {formatCurrency(String(position.averageExitPrice))}
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            Number(position.profitLoss) >= 0 ? "green" : "red"
                          }
                        >
                          {formatCurrency(String(position.profitLoss))}
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

      {/* Permanent Bottom Block - Sticky to bottom of viewport */}
      <Paper
        p="md"
        mt="lg"
        withBorder
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 800,
          maxHeight: "300px",
          overflowY: "auto",
          backgroundColor: "var(--mantine-color-body)",
          borderTop: "1px solid var(--mantine-color-gray-3)",
          borderRadius: "8px 8px 0 0",
        }}
      >
        {bottomBlockContent === "orders" && selectedPosition && (
          <>
            <Group mb="md" justify="space-between">
              <Text size="lg" fw={500}>
                Orders for Position {selectedPosition.pair} -{" "}
                {selectedPosition.direction}
              </Text>
              <Button
                size="xs"
                variant="subtle"
                onClick={() => setBottomBlockContent(null)}
              >
                Clear
              </Button>
            </Group>

            <Group mb="md">
              <Text size="sm" c="dimmed">
                Position: {selectedPosition.pair} | Direction:{" "}
                {selectedPosition.direction} | Status: {selectedPosition.status}
              </Text>
            </Group>

            {isLoadingPositionOrders ? (
              <Skeleton height={300} />
            ) : (
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Time</Table.Th>
                    <Table.Th>Pair</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Direction</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Avg Price</Table.Th>
                    <Table.Th>Total Cost</Table.Th>
                    <Table.Th>Exchange</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {positionOrdersData?.orders.map((order) => (
                    <Table.Tr key={order.id}>
                      <Table.Td>{formatDateTime(order.time)}</Table.Td>
                      <Table.Td>{order.pair}</Table.Td>
                      <Table.Td>
                        <Badge color={order.type === "buy" ? "green" : "red"}>
                          {order.type}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {order.direction ? (
                          <Badge
                            color={
                              order.direction === "long" ? "blue" : "orange"
                            }
                            variant="light"
                          >
                            {order.direction}
                          </Badge>
                        ) : (
                          <Text c="dimmed" size="sm">
                            -
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>{String(order.amount)}</Table.Td>
                      <Table.Td>
                        {formatCurrency(String(order.averagePrice))}
                      </Table.Td>
                      <Table.Td>
                        {formatCurrency(String(order.totalCost))}
                      </Table.Td>
                      <Table.Td>{order.exchange}</Table.Td>
                    </Table.Tr>
                  ))}
                  {!positionOrdersData?.orders.length && (
                    <Table.Tr>
                      <Table.Td colSpan={8}>
                        <Text ta="center" c="dimmed">
                          No orders found for this position
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            )}
          </>
        )}

        {bottomBlockContent === "position-details" && selectedPositionData && (
          <>
            <Group mb="md" justify="space-between">
              <Text size="lg" fw={500}>
                Position Details - {selectedPositionData.pair}
              </Text>
              <Button
                size="xs"
                variant="subtle"
                onClick={() => setBottomBlockContent(null)}
              >
                Clear
              </Button>
            </Group>

            <Flex direction="row" gap="xl" wrap="wrap">
              <Group>
                <Text size="lg" fw={500}>
                  Position #{selectedPositionData.id}
                </Text>
                <Badge
                  color={
                    selectedPositionData.status === "closed"
                      ? "blue"
                      : selectedPositionData.status === "open"
                        ? "yellow"
                        : "gray"
                  }
                >
                  {selectedPositionData.status}
                </Badge>
              </Group>

              <Group>
                <Text size="sm" c="dimmed">
                  Pair:
                </Text>
                <Text size="sm" fw={500}>
                  {selectedPositionData.pair}
                </Text>
              </Group>

              <Group>
                <Text size="sm" c="dimmed">
                  Direction:
                </Text>
                <Badge
                  color={
                    selectedPositionData.direction === "long" ? "green" : "red"
                  }
                >
                  {selectedPositionData.direction}
                </Badge>
              </Group>

              <Group>
                <Text size="sm" c="dimmed">
                  Amount:
                </Text>
                <Text size="sm" fw={500}>
                  {selectedPositionData.amount.toString()}
                </Text>
              </Group>

              <Group>
                <Text size="sm" c="dimmed">
                  Entry Price:
                </Text>
                <Text size="sm" fw={500}>
                  {formatCurrency(
                    selectedPositionData.averageEntryPrice.toString(),
                  )}
                </Text>
              </Group>

              <Group>
                <Text size="sm" c="dimmed">
                  Exit Price:
                </Text>
                <Text size="sm" fw={500}>
                  {formatCurrency(
                    selectedPositionData.averageExitPrice.toString(),
                  )}
                </Text>
              </Group>

              <Group>
                <Text size="sm" c="dimmed">
                  P&L:
                </Text>
                <Badge
                  color={
                    Number(selectedPositionData.profitLoss.toString()) >= 0
                      ? "green"
                      : "red"
                  }
                >
                  {formatCurrency(selectedPositionData.profitLoss.toString())}
                </Badge>
              </Group>

              <Group>
                <Text size="sm" c="dimmed">
                  Duration:
                </Text>
                <Text size="sm" fw={500}>
                  {selectedPositionData.duration}
                </Text>
              </Group>

              <Group>
                <Text size="sm" c="dimmed">
                  Created:
                </Text>
                <Text size="sm" fw={500}>
                  {formatDateTime(selectedPositionData.time)}
                </Text>
              </Group>
            </Flex>
          </>
        )}

        {isLoadingSelectedPosition &&
          bottomBlockContent === "position-details" && (
            <Skeleton height={200} />
          )}

        {!bottomBlockContent && (
          <Text ta="center" c="dimmed" size="sm">
            Click on a position to view its orders, or click on a position link
            in the orders table to view position details.
          </Text>
        )}
      </Paper>
    </Paper>
  );
}
