"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Paper,
  Title,
  Flex,
  Group,
  ActionIcon,
  Text,
  Badge,
  Alert,
  Button,
  LoadingOverlay,
  Card,
  SimpleGrid,
  Table,
  Skeleton,
} from "@mantine/core";
import { IconRefresh, IconKey, IconWifi, IconWifiOff, IconAlertTriangle } from "@tabler/icons-react";
import { api } from "~/trpc/react";
import { useSocket } from "~/lib/useSocket";
import { notifications } from "@mantine/notifications";
import { KeyStorage, encryptForTransmission } from "~/lib/keyEncryption";

interface LivePosition {
  pair: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  percentage: number;
  timestamp: number;
  stopLoss?: number;
  riskAmount: number;
  riskType?: string;
  leverage?: number;
  marginUsed?: number;
  positionValue?: number;
  liquidationPrice?: number;
  funding?: {
    allTime: number;
    sinceOpen: number;
  };
}

interface LiveBalance {
  asset: string;
  free: number;
  used: number;
  total: number;
  usdValue: number;
}

interface LiveOrder {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  type: string;
  amount: number;
  price: number;
  filled: number;
  remaining: number;
  status: string;
  timestamp: number;
  triggerPrice?: number;
  triggerCondition?: string;
  reduceOnly: boolean;
  timeInForce?: string;
  isStopOrder: boolean;
}

interface LiveData {
  positions: LivePosition[];
  balances: LiveBalance[];
  orders: LiveOrder[];
  totalUsdValue: number;
  timestamp: number;
}

export default function LivePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { socket, connected } = useSocket();
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showKeyManager, setShowKeyManager] = useState(false);

  // tRPC mutations
  const subscribeMutation = api.live.subscribeToLiveData.useMutation({
    onSuccess: async () => {
      setIsConnected(true);
      notifications.show({
        title: "Connected",
        message: "Live data stream connected successfully",
        color: "green",
      });
      
      // Immediately fetch initial data
      setTimeout(async () => {
        try {
          const data = await refetch();
          if (data.data) {
            setLiveData(data.data);
            setLastUpdate(new Date());
          }
        } catch (error) {
          console.error("Failed to fetch initial data:", error);
        }
      }, 1000);
    },
    onError: (error) => {
      notifications.show({
        title: "Connection Error",
        message: error.message,
        color: "red",
      });
    },
  });

  const unsubscribeMutation = api.live.unsubscribeFromLiveData.useMutation();

  const { refetch } = api.live.getCurrentLiveData.useQuery(
    undefined,
    {
      enabled: false, // Only fetch manually
    }
  );

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Handle WebSocket events
  useEffect(() => {
    if (!socket || !connected) return;

    const handleLiveUpdate = (data: LiveData) => {
      setLiveData(data);
      setLastUpdate(new Date());
    };

    const handleConnectionStatus = (status: { connected: boolean }) => {
      setIsConnected(status.connected);
    };

    socket.on("liveUpdate", handleLiveUpdate);
    socket.on("liveConnectionStatus", handleConnectionStatus);

    return () => {
      socket.off("liveUpdate", handleLiveUpdate);
      socket.off("liveConnectionStatus", handleConnectionStatus);
    };
  }, [socket, connected]);

  // Connect to live data stream
  const connectToLiveData = async () => {
    try {
      const keys = KeyStorage.load();
      if (!keys) {
        notifications.show({
          title: "Hyperliquid Credentials Required",
          message: "Please configure your Hyperliquid wallet address first",
          color: "orange",
        });
        setShowKeyManager(true);
        return;
      }

      const hyperliquidKey = keys.find(k => k.exchange === 'hyperliquid');
      if (!hyperliquidKey) {
        notifications.show({
          title: "Hyperliquid Wallet Address Required",
          message: "Please configure your Hyperliquid wallet address first",
          color: "orange",
        });
        setShowKeyManager(true);
        return;
      }

      await subscribeMutation.mutateAsync({
        encryptedKeys: encryptForTransmission([hyperliquidKey]),
      });
    } catch (error) {
      console.error("Failed to connect to live data:", error);
    }
  };

  // Disconnect from live data stream
  const disconnectFromLiveData = async () => {
    try {
      await unsubscribeMutation.mutateAsync();
      setIsConnected(false);
      setLiveData(null);
    } catch (error) {
      console.error("Failed to disconnect from live data:", error);
    }
  };

  // Manual refresh
  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const data = await refetch();
      if (data.data) {
        setLiveData(data.data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error("Failed to refresh data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-connect on mount and start polling
  useEffect(() => {
    if (status === "authenticated" && !isConnected) {
      connectToLiveData();
    }
  }, [status]);

  // Poll for data every 5 seconds when connected
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(async () => {
      try {
        const data = await refetch();
        if (data.data) {
          setLiveData(data.data);
          setLastUpdate(new Date());
        }
      } catch (error) {
        console.error("Failed to poll live data:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected, refetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        disconnectFromLiveData();
      }
    };
  }, []);

  if (status === "loading") {
    return <LoadingOverlay visible />;
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <Paper p="md" radius="sm">
        <Flex justify="space-between" align="center" mb="lg">
          <Title order={2}>Live Trading Data</Title>
          
          <Group gap="sm">
            {/* Connection Status */}
            <Badge
              color={isConnected ? "green" : "red"}
              variant="light"
              leftSection={isConnected ? <IconWifi size={12} /> : <IconWifiOff size={12} />}
            >
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>

            {/* Last Update */}
            {lastUpdate && (
              <Text size="sm" c="dimmed">
                Updated: {lastUpdate.toLocaleTimeString()}
              </Text>
            )}

            {/* Refresh Button */}
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={handleRefresh}
              loading={isLoading}
            >
              <IconRefresh size={18} />
            </ActionIcon>

            {/* Key Manager Button */}
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => setShowKeyManager(!showKeyManager)}
            >
              <IconKey size={18} />
            </ActionIcon>
          </Group>
        </Flex>

        {/* Connection Actions */}
        <Group mb="md">
          {!isConnected ? (
            <Button
              onClick={connectToLiveData}
              loading={subscribeMutation.isPending}
              leftSection={<IconWifi size={16} />}
            >
              Connect Live Data
            </Button>
          ) : (
            <Button
              onClick={disconnectFromLiveData}
              variant="outline"
              color="red"
              loading={unsubscribeMutation.isPending}
              leftSection={<IconWifiOff size={16} />}
            >
              Disconnect
            </Button>
          )}
        </Group>

        {/* Key Manager Alert */}
        {showKeyManager && (
          <Alert mb="md" color="blue" onClose={() => setShowKeyManager(false)} withCloseButton>
            <Text size="sm">
              Please configure your Hyperliquid wallet address in the key manager to enable live data streaming.
              <br />
              <strong>Note:</strong> Hyperliquid only requires a wallet address, not API keys.
            </Text>
          </Alert>
        )}

        {/* Content */}
        {!liveData ? (
          <Card p="xl">
            <Text ta="center" c="dimmed" size="lg">
              {isConnected ? "Waiting for live data..." : "Connect to view live trading data"}
            </Text>
          </Card>
        ) : (
          <>
            {/* Balance Overview */}
            <Card mb="md" p="md">
              <Title order={3} mb="md">Account Overview</Title>
              <SimpleGrid cols={7} spacing="md">
                <div>
                  <Text size="sm" c="dimmed">Total USD Value</Text>
                  <Text size="xl" fw={700}>
                    ${liveData.totalUsdValue.toLocaleString()}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Open Positions</Text>
                  <Text size="lg" fw={600}>
                    {liveData.positions.length}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ${liveData.positions.reduce((sum, p) => sum + (p.positionValue || 0), 0).toLocaleString()} total
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Open Orders</Text>
                  <Text size="lg" fw={600}>
                    {liveData.orders?.length || 0}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {liveData.orders?.filter(o => o.isStopOrder).length || 0} stops, {liveData.orders?.filter(o => !o.isStopOrder).length || 0} limit
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Total Risk</Text>
                  <Text size="lg" fw={600} c="red">
                    ${liveData.positions.reduce((sum, p) => sum + p.riskAmount, 0).toLocaleString()}
                  </Text>
                  {liveData.positions.some(p => !p.stopLoss) && (
                    <Group gap={4} mt={2}>
                      <IconAlertTriangle size={12} color="orange" />
                      <Text size="xs" c="orange">
                        {liveData.positions.filter(p => !p.stopLoss).length} without stops
                      </Text>
                    </Group>
                  )}
                </div>
                <div>
                  <Text size="sm" c="dimmed">Total Margin Used</Text>
                  <Text size="lg" fw={600}>
                    ${liveData.positions.reduce((sum, p) => sum + (p.marginUsed || 0), 0).toLocaleString()}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Unrealized PnL</Text>
                  <Text 
                    size="lg" 
                    fw={600} 
                    c={liveData.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0) >= 0 ? "green" : "red"}
                  >
                    ${liveData.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0).toFixed(2)}
                  </Text>
                  <Text 
                    size="xs" 
                    c={liveData.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0) >= 0 ? "green" : "red"}
                  >
                    {liveData.positions.length > 0 ? 
                      (liveData.positions.reduce((sum, p) => sum + p.percentage, 0) / liveData.positions.length).toFixed(2) 
                      : '0.00'}% avg
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Total Funding</Text>
                  <Text 
                    size="lg" 
                    fw={600}
                    c={liveData.positions.reduce((sum, p) => sum + (p.funding?.allTime || 0), 0) >= 0 ? "green" : "red"}
                  >
                    ${liveData.positions.reduce((sum, p) => sum + (p.funding?.allTime || 0), 0).toFixed(2)}
                  </Text>
                  <Text size="xs" c="dimmed">all time</Text>
                </div>
              </SimpleGrid>
            </Card>

            {/* Positions Table */}
            <Card mb="md" p="md">
              <Title order={3} mb="md">Open Positions</Title>
              {liveData.positions.length === 0 ? (
                <Text ta="center" c="dimmed">No open positions</Text>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Pair</Table.Th>
                      <Table.Th>Side</Table.Th>
                      <Table.Th>Size</Table.Th>
                      <Table.Th>Entry Price</Table.Th>
                      <Table.Th>Leverage</Table.Th>
                      <Table.Th>Unrealized PnL</Table.Th>
                      <Table.Th>Risk</Table.Th>
                      <Table.Th>Margin Used</Table.Th>
                      <Table.Th>Funding</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {liveData.positions.map((position, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>
                          <div>
                            <Text size="sm" fw={500}>
                              {position.pair?.split('/')[0] || position.pair}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {position.positionValue ? `$${position.positionValue.toFixed(2)}` : ''}
                            </Text>
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={position.side === "long" ? "green" : "red"} variant="light">
                            {position.side.toUpperCase()}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{position.size.toFixed(4)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">${position.entryPrice.toFixed(4)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="outline" size="sm">
                            {position.leverage ? `${position.leverage}x` : 'N/A'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text c={position.unrealizedPnl >= 0 ? "green" : "red"} size="sm" fw={500}>
                            ${position.unrealizedPnl.toFixed(2)}
                          </Text>
                          <Text c={position.percentage >= 0 ? "green" : "red"} size="xs">
                            {position.percentage.toFixed(2)}%
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <div>
                            <Text size="sm" c="red" fw={500}>
                              ${position.riskAmount.toFixed(2)}
                            </Text>
                            {position.stopLoss ? (
                              <Text size="xs" c="green">
                                Stop: ${position.stopLoss.toFixed(4)}
                              </Text>
                            ) : (
                              <div>
                                <Group gap={4} mt={2}>
                                  <IconAlertTriangle size={12} color="red" />
                                  <Text size="xs" c="red">
                                    no stop
                                  </Text>
                                </Group>
                                <Text size="xs" c="dimmed">
                                  {position.riskType === "margin-based" && "margin risk"}
                                  {position.riskType === "liquidation-based" && "to liquidation"}
                                  {position.riskType === "full-loss" && "full loss"}
                                </Text>
                              </div>
                            )}
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            ${position.marginUsed?.toFixed(2) || 'N/A'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {position.funding ? (
                            <div>
                              <Text size="xs" c="dimmed">
                                All: ${position.funding.allTime.toFixed(4)}
                              </Text>
                              <Text size="xs" c={position.funding.sinceOpen >= 0 ? "green" : "red"}>
                                Open: ${position.funding.sinceOpen.toFixed(4)}
                              </Text>
                            </div>
                          ) : (
                            <Text size="xs" c="dimmed">N/A</Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>

            {/* Open Orders Table */}
            <Card mb="md" p="md">
              <Title order={3} mb="md">Open Orders</Title>
              {!liveData.orders || liveData.orders.length === 0 ? (
                <Text ta="center" c="dimmed">No open orders</Text>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Pair</Table.Th>
                      <Table.Th>Side</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Amount</Table.Th>
                      <Table.Th>Price</Table.Th>
                      <Table.Th>Filled</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {liveData.orders.map((order, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {order.symbol?.split('/')[0] || order.symbol}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={order.side === "buy" ? "green" : "red"} variant="light" size="sm">
                            {order.side.toUpperCase()}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <div>
                            <Badge 
                              color={order.isStopOrder ? "orange" : "blue"} 
                              variant={order.isStopOrder ? "filled" : "outline"} 
                              size="sm"
                            >
                              {order.isStopOrder ? "STOP" : order.type?.toUpperCase()}
                            </Badge>
                            {order.reduceOnly && (
                              <Badge color="gray" variant="outline" size="xs" mt={2}>
                                Reduce Only
                              </Badge>
                            )}
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{order.amount.toFixed(4)}</Text>
                          {order.filled > 0 && (
                            <Text size="xs" c="dimmed">
                              {order.remaining.toFixed(4)} left
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <div>
                            <Text size="sm">${order.price.toFixed(4)}</Text>
                            {order.triggerPrice && (
                              <Text size="xs" c="orange">
                                Trigger: ${order.triggerPrice.toFixed(4)}
                              </Text>
                            )}
                            {order.triggerCondition && (
                              <Text size="xs" c="dimmed">
                                {order.triggerCondition}
                              </Text>
                            )}
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{order.filled.toFixed(4)}</Text>
                          {order.amount > 0 && (
                            <Text size="xs" c="dimmed">
                              {((order.filled / order.amount) * 100).toFixed(1)}%
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Badge 
                            color={
                              order.status === "open" ? "green" : 
                              order.status === "closed" ? "gray" : 
                              order.status === "canceled" ? "red" : "blue"
                            } 
                            variant="light" 
                            size="sm"
                          >
                            {order.status.toUpperCase()}
                          </Badge>
                          {order.timeInForce && (
                            <Text size="xs" c="dimmed" mt={2}>
                              {order.timeInForce}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {new Date(order.timestamp).toLocaleTimeString()}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>

            {/* Balances Table */}
            <Card p="md">
              <Title order={3} mb="md">Asset Balances</Title>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Asset</Table.Th>
                    <Table.Th>Free</Table.Th>
                    <Table.Th>Used</Table.Th>
                    <Table.Th>Total</Table.Th>
                    <Table.Th>USD Value</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {liveData.balances.map((balance, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>{balance.asset}</Table.Td>
                      <Table.Td>{balance.free.toFixed(4)}</Table.Td>
                      <Table.Td>{balance.used.toFixed(4)}</Table.Td>
                      <Table.Td>{balance.total.toFixed(4)}</Table.Td>
                      <Table.Td>${balance.usdValue.toFixed(2)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </>
        )}
      </Paper>
    </div>
  );
}