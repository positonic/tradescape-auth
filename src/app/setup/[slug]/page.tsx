import { Title, Text, Group, Badge, Card, Image, Stack, Divider, SimpleGrid, Button, ScrollArea } from '@mantine/core';
import Link from "next/link";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";
import { IconCalendar, IconChartCandle, IconArrowUp, IconArrowDown, IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';
import { PriceEditor } from './_components/PriceEditor';
import { PrivacyToggle } from './_components/PrivacyToggle';
import { SetupContentEditor } from '~/app/_components/SetupContentEditor';
import { DeleteButton } from './_components/DeleteButton';

export default async function SetupPage({ params }: {
  params: Promise<{ slug: string }>
}) {
  const slug = (await params).slug;
  const session = await auth();

  let setup: Awaited<ReturnType<typeof api.setups.getById>> | null = null;
  if (session?.user) {
    try {
      setup = await api.setups.getById.call({}, { id: slug });
    } catch (error) {
      console.error("Failed to fetch setup:", error);
    }
  }

  const getDirectionColor = (direction: string) => {
    switch (direction.toLowerCase()) {
      case 'long':
        return 'green';
      case 'short':
        return 'red';
      default:
        return 'blue';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {!session && (
        <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
          <Title order={3} mb="md">Access Denied</Title>
          <Text mb="lg">Please sign in to view setup details.</Text>
          <Link
            href="/api/auth/signin"
            className="rounded-md bg-blue-500 px-6 py-2 font-semibold text-white no-underline shadow-sm transition hover:bg-blue-600"
          >
            Sign In
          </Link>
        </div>
      )}
      {session?.user && (
        <div className="container mx-auto py-8 px-4">
          {!setup && (
            <Card shadow="sm" p="lg" radius="md" withBorder className="text-center">
              <Title order={4}>Setup Not Found</Title>
              <Text c="dimmed">The requested setup could not be found or you may not have permission to view it.</Text>
              <Button component={Link} href="/dashboard" mt="md">
                Back to Dashboard
              </Button>
            </Card>
          )}
          {setup && (
            <Stack gap="xl">
              {/* Header Section */}
              <Card shadow="sm" p="lg" radius="md" withBorder>
                <Group justify="space-between" align="flex-start">
                  <Group>
                    {setup.coin?.imageUrl && (
                      <Image
                        src={setup.coin.imageUrl}
                        alt={setup.coin.name}
                        width={48}
                        height={48}
                      />
                    )}
                    <div>
                      <Title order={2}>{setup.coin?.name} {setup.pair.symbol}</Title>
                      <Group gap="xs">
                        <Badge
                          size="lg"
                          variant="filled"
                          color={getDirectionColor(setup.direction)}
                          leftSection={setup.direction.toLowerCase() === 'long' ? 
                            <IconArrowUp size={14} /> : 
                            <IconArrowDown size={14} />}
                        >
                          {setup.direction.toUpperCase()}
                        </Badge>
                        <Badge
                          size="lg"
                          variant="light"
                          leftSection={<IconChartCandle size={14} />}
                        >
                          {setup.timeframe?.toUpperCase() ?? 'No Timeframe'}
                        </Badge>
                        <Badge
                          size="lg"
                          variant="outline"
                          leftSection={<IconCalendar size={14} />}
                        >
                          {formatDate(setup.createdAt)}
                        </Badge>
                      </Group>
                    </div>
                  </Group>
                </Group>
              </Card>

              {/* Details Section */}
              <SimpleGrid cols={{ base: 1, md: 12 }} spacing="md">
                <div style={{ gridColumn: 'span 8' }}>
                  <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Group justify="space-between" mb="md">
                      <Title order={3}>Setup Details</Title>
                    </Group>
                    <SetupContentEditor setupId={setup.id} initialContent={setup.content ?? ''} />
                    <Divider my="md" />
                    <PriceEditor setup={setup} />
                  </Card>
                </div>

                <div style={{ gridColumn: 'span 4' }}>
                  <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Title order={3} mb="md">Status</Title>
                    <Stack gap="md">
                      <div>
                        <Badge size="xl" variant="light" color={setup.status === 'active' ? 'blue' : 'gray'}>
                          {setup.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div>
                        <Text size="sm" c="dimmed">Privacy</Text>
                        <PrivacyToggle setupId={setup.id} initialPrivacy={setup.privacy} />
                      </div>
                      {setup.video && (
                        <div>
                          <Text size="sm" c="dimmed">Source Video</Text>
                          <Link 
                            href={`/video/${setup.video.id}`}
                            className="text-blue-500 hover:text-blue-700 underline"
                          >
                            View Source Video
                          </Link>
                        </div>
                      )}
                      
                      <Divider my="sm" />
                      <DeleteButton setupId={setup.id} />
                    </Stack>
                  </Card>
                </div>
              </SimpleGrid>

              {/* Positions Section */}
              {setup.positions && setup.positions.length > 0 && (
                <Card shadow="sm" p="lg" radius="md" withBorder>
                  <Title order={3} mb="md">Positions ({setup.pair.symbol})</Title>
                  <ScrollArea>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Date</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Status</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Type</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Amount</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Entry</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Exit</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>P&L</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Duration</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Orders</th>
                        </tr>
                      </thead>
                      <tbody>
                        {setup.positions.map((position) => (
                          <tr key={position.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                            <td style={{ padding: '8px' }}>
                              {new Date(Number(position.time)).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td style={{ padding: '8px' }}>
                              <Badge 
                                size="sm" 
                                variant="light" 
                                color={position.status === 'open' ? 'blue' : position.status === 'closed' ? 'green' : 'gray'}
                              >
                                {position.status.toUpperCase()}
                              </Badge>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <Badge 
                                size="sm" 
                                variant="light" 
                                color={position.direction === 'long' ? 'green' : 'red'}
                                leftSection={position.direction === 'long' ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                              >
                                {position.direction.toUpperCase()}
                              </Badge>
                            </td>
                            <td style={{ padding: '8px' }}>{position.amount}</td>
                            <td style={{ padding: '8px' }}>{position.averageEntryPrice.toFixed(8)}</td>
                            <td style={{ padding: '8px' }}>{position.averageExitPrice.toFixed(8)}</td>
                            <td style={{ padding: '8px' }}>
                              <span style={{ color: position.profitLoss >= 0 ? 'green' : 'red' }}>
                                ${position.profitLoss.toFixed(2)}
                              </span>
                            </td>
                            <td style={{ padding: '8px' }}>{position.duration}</td>
                            <td style={{ padding: '8px' }}>
                              <Badge size="sm" variant="outline">
                                {position.orderCount}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </Card>
              )}

              {/* Orders Section */}
              {setup.orders && setup.orders.length > 0 && (
                <Card shadow="sm" p="lg" radius="md" withBorder>
                  <Title order={3} mb="md">Recent Orders ({setup.pair.symbol})</Title>
                  <ScrollArea>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Date</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Type</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Amount</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Avg Price</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Total Cost</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Fees</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Trades</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Exchange</th>
                        </tr>
                      </thead>
                      <tbody>
                        {setup.orders.map((order) => (
                          <tr key={order.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                            <td style={{ padding: '8px' }}>
                              {new Date(Number(order.time)).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td style={{ padding: '8px' }}>
                              <Badge 
                                size="sm" 
                                variant="light" 
                                color={order.type === 'buy' ? 'green' : 'red'}
                                leftSection={order.type === 'buy' ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                              >
                                {order.type.toUpperCase()}
                              </Badge>
                            </td>
                            <td style={{ padding: '8px' }}>{order.amount}</td>
                            <td style={{ padding: '8px' }}>{order.averagePrice.toFixed(8)}</td>
                            <td style={{ padding: '8px' }}>${order.totalCost.toFixed(2)}</td>
                            <td style={{ padding: '8px' }}>${order.fee.toFixed(2)}</td>
                            <td style={{ padding: '8px' }}>
                              <Badge size="sm" variant="outline">
                                {order.tradeCount}
                              </Badge>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <Badge size="sm" variant="outline">
                                {order.exchange}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </Card>
              )}

              {/* Trades Section */}
              {setup.trades && setup.trades.length > 0 && (
                <Card shadow="sm" p="lg" radius="md" withBorder>
                  <Title order={3} mb="md">Recent Trades ({setup.pair.symbol})</Title>
                  <ScrollArea>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Date</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Type</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Price</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Volume</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Cost</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Fee</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Exchange</th>
                        </tr>
                      </thead>
                      <tbody>
                        {setup.trades.map((trade) => (
                          <tr key={trade.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                            <td style={{ padding: '8px' }}>
                              {new Date(Number(trade.time)).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td style={{ padding: '8px' }}>
                              <Badge 
                                size="sm" 
                                variant="light" 
                                color={trade.type === 'buy' ? 'green' : 'red'}
                                leftSection={trade.type === 'buy' ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                              >
                                {trade.type.toUpperCase()}
                              </Badge>
                            </td>
                            <td style={{ padding: '8px' }}>{parseFloat(trade.price).toFixed(8)}</td>
                            <td style={{ padding: '8px' }}>{trade.vol}</td>
                            <td style={{ padding: '8px' }}>${parseFloat(trade.cost).toFixed(2)}</td>
                            <td style={{ padding: '8px' }}>${parseFloat(trade.fee).toFixed(2)}</td>
                            <td style={{ padding: '8px' }}>
                              <Badge size="sm" variant="outline">
                                {trade.exchange}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </Card>
              )}
            </Stack>
          )}
        </div>
      )}
    </div>
  );
}
