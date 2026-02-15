"use client";

import { Badge, Table, Tabs, Text, Title } from "@mantine/core";
import { formatCurrency, formatDateTime } from "~/lib/tradeUtils";

interface PositionRecord {
  id: number;
  pair: string;
  direction: string;
  status: string;
  amount: { toString(): string };
  averageEntryPrice: { toString(): string };
  averageExitPrice: { toString(): string };
  profitLoss: { toString(): string };
  duration: string;
  time: bigint;
}

interface PositionActivityProps {
  positions: {
    opened: PositionRecord[];
    closed: PositionRecord[];
  };
}

export function PositionActivity({ positions }: PositionActivityProps) {
  const totalPositions = positions.opened.length + positions.closed.length;
  if (totalPositions === 0) return null;

  return (
    <>
      <Title order={4} mb="sm">
        Position Activity
      </Title>
      <Tabs defaultValue="closed" mb="lg">
        <Tabs.List mb="sm">
          <Tabs.Tab value="closed">Closed ({positions.closed.length})</Tabs.Tab>
          <Tabs.Tab value="opened">Opened ({positions.opened.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="closed">
          {positions.closed.length === 0 ? (
            <Text c="dimmed" ta="center" py="md">
              No positions closed this day.
            </Text>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Pair</Table.Th>
                  <Table.Th>Direction</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Entry Price</Table.Th>
                  <Table.Th>Exit Price</Table.Th>
                  <Table.Th>P&L</Table.Th>
                  <Table.Th>Duration</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {positions.closed.map((pos) => {
                  const pnl = Number(pos.profitLoss.toString());
                  const pnlColor = pnl > 0 ? "green" : pnl < 0 ? "red" : "gray";
                  return (
                    <Table.Tr key={pos.id}>
                      <Table.Td>
                        <Text size="sm">{formatDateTime(pos.time)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {pos.pair}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={pos.direction === "long" ? "green" : "red"}
                          variant="light"
                          size="sm"
                        >
                          {pos.direction}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {Number(pos.amount.toString()).toFixed(4)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {formatCurrency(
                            Number(pos.averageEntryPrice.toString()),
                          )}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {formatCurrency(
                            Number(pos.averageExitPrice.toString()),
                          )}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={pnlColor} variant="light" size="sm">
                          {formatCurrency(pnl)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {pos.duration}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="opened">
          {positions.opened.length === 0 ? (
            <Text c="dimmed" ta="center" py="md">
              No positions opened this day.
            </Text>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Pair</Table.Th>
                  <Table.Th>Direction</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Entry Price</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {positions.opened.map((pos) => (
                  <Table.Tr key={pos.id}>
                    <Table.Td>
                      <Text size="sm">{formatDateTime(pos.time)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {pos.pair}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={pos.direction === "long" ? "green" : "red"}
                        variant="light"
                        size="sm"
                      >
                        {pos.direction}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={pos.status === "open" ? "blue" : "gray"}
                        variant="light"
                        size="sm"
                      >
                        {pos.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {Number(pos.amount.toString()).toFixed(4)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {formatCurrency(
                          Number(pos.averageEntryPrice.toString()),
                        )}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
