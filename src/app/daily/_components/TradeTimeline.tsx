"use client";

import { Badge, Table, Text, Title } from "@mantine/core";
import { formatCurrency, formatDateTime } from "~/lib/tradeUtils";

interface TimelineOrder {
  id: number;
  time: bigint;
  pair: string;
  type: string;
  direction: string | null;
  amount: { toString(): string };
  averagePrice: { toString(): string };
  totalCost: { toString(): string };
  fee: { toString(): string };
  exchange: string;
  closedPnL: { toString(): string } | null;
}

interface TradeTimelineProps {
  orders: TimelineOrder[];
}

export function TradeTimeline({ orders }: TradeTimelineProps) {
  if (orders.length === 0) return null;

  return (
    <>
      <Title order={4} mb="sm">
        Order Timeline
      </Title>
      <Table highlightOnHover mb="lg">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Time</Table.Th>
            <Table.Th>Pair</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Direction</Table.Th>
            <Table.Th>Amount</Table.Th>
            <Table.Th>Avg Price</Table.Th>
            <Table.Th>Cost</Table.Th>
            <Table.Th>Fee</Table.Th>
            <Table.Th>P&L</Table.Th>
            <Table.Th>Exchange</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {orders.map((order) => {
            const pnl = order.closedPnL
              ? Number(order.closedPnL.toString())
              : null;
            const pnlColor =
              pnl !== null && pnl > 0
                ? "green"
                : pnl !== null && pnl < 0
                  ? "red"
                  : "gray";

            return (
              <Table.Tr key={order.id}>
                <Table.Td>
                  <Text size="sm">{formatDateTime(order.time)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {order.pair}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={order.type === "buy" ? "green" : "red"}
                    variant="light"
                    size="sm"
                  >
                    {order.type}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {order.direction && (
                    <Badge color="blue" variant="light" size="sm">
                      {order.direction}
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {Number(order.amount.toString()).toFixed(4)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {formatCurrency(Number(order.averagePrice.toString()))}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {formatCurrency(Number(order.totalCost.toString()))}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {formatCurrency(Number(order.fee.toString()))}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {pnl !== null && pnl !== 0 ? (
                    <Badge color={pnlColor} variant="light" size="sm">
                      {formatCurrency(pnl)}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {order.exchange}
                  </Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </>
  );
}
