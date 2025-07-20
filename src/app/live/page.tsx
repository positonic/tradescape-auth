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
}

interface LiveBalance {
  asset: string;
  free: number;
  used: number;
  total: number;
  usdValue: number;
}

interface LiveData {
  positions: LivePosition[];
  balances: LiveBalance[];
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
              <Title order={3} mb="md">Account Balance</Title>
              <SimpleGrid cols={5} spacing="md">
                <div>
                  <Text size="sm" c="dimmed">Total USD Value</Text>
                  <Text size="xl" fw={700}>
                    ${liveData.totalUsdValue.toLocaleString()}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Free Balance</Text>
                  <Text size="lg" fw={600}>
                    ${liveData.balances.reduce((sum, b) => sum + b.free * (b.usdValue / b.total), 0).toLocaleString()}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Used Balance</Text>
                  <Text size="lg" fw={600}>
                    ${liveData.balances.reduce((sum, b) => sum + b.used * (b.usdValue / b.total), 0).toLocaleString()}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Open Positions</Text>
                  <Text size="lg" fw={600}>
                    {liveData.positions.length}
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
                      <Table.Th>Mark Price</Table.Th>
                      <Table.Th>Unrealized PnL</Table.Th>
                      <Table.Th>%</Table.Th>
                      <Table.Th>Risk</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {liveData.positions.map((position, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>{position.pair}</Table.Td>
                        <Table.Td>
                          <Badge color={position.side === "long" ? "green" : "red"} variant="light">
                            {position.side.toUpperCase()}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{position.size.toFixed(4)}</Table.Td>
                        <Table.Td>${position.entryPrice.toFixed(2)}</Table.Td>
                        <Table.Td>${position.markPrice.toFixed(2)}</Table.Td>
                        <Table.Td>
                          <Text c={position.unrealizedPnl >= 0 ? "green" : "red"}>
                            ${position.unrealizedPnl.toFixed(2)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text c={position.percentage >= 0 ? "green" : "red"}>
                            {position.percentage.toFixed(2)}%
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <Text size="sm" c="red">
                              ${position.riskAmount.toFixed(2)}
                            </Text>
                            {!position.stopLoss && (
                              <Group gap={4}>
                                <IconAlertTriangle size={12} color="red" />
                                <Text size="xs" c="red">
                                  no stop
                                </Text>
                              </Group>
                            )}
                          </Group>
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