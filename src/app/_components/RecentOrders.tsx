"use client";

import { Card, Title, Text, Badge, Skeleton, Button } from "@mantine/core";
import { IconArrowUpRight, IconArrowDownLeft } from "@tabler/icons-react";
import Link from "next/link";
import { formatDateTime, formatCurrency } from "~/lib/tradeUtils";

interface Order {
  id: number;
  pair: string;
  type: string;
  direction: string | null;
  amount: unknown; // Prisma Decimal
  averagePrice: unknown; // Prisma Decimal
  totalCost: unknown; // Prisma Decimal
  time: bigint;
  closedPnL: unknown;
}

interface RecentOrdersProps {
  orders: Order[] | undefined;
  isLoading: boolean;
}

export function RecentOrders({ orders, isLoading }: RecentOrdersProps) {
  if (isLoading) {
    return (
      <Card withBorder radius="md" p="lg">
        <Skeleton height={20} width="50%" mb={8} />
        <Skeleton height={14} width="40%" mb="lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={48} mb={12} />
        ))}
      </Card>
    );
  }

  const displayOrders = orders ?? [];

  return (
    <Card withBorder radius="md" p="lg">
      <Title order={4} fw={600} mb={4}>
        Recent Transactions
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        Your latest trading activity
      </Text>

      {displayOrders.length === 0 ? (
        <div className="py-4 text-center">
          <Text c="dimmed" mb="sm">
            No recent orders
          </Text>
          <Button component={Link} href="/trades" variant="subtle" size="xs">
            Sync trades
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {displayOrders.map((order) => {
            const baseCoin = order.pair.split("/")[0] ?? order.pair;
            const isBuy = order.type === "buy";
            const pnl = order.closedPnL ? Number(order.closedPnL) : null;

            return (
              <div key={order.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      isBuy
                        ? "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400"
                        : "bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400"
                    }`}
                  >
                    {isBuy ? (
                      <IconArrowDownLeft size={20} />
                    ) : (
                      <IconArrowUpRight size={20} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Text size="sm" fw={600}>
                        {baseCoin}
                      </Text>
                      <Badge
                        variant="outline"
                        color={isBuy ? "green" : "red"}
                        size="xs"
                        radius="sm"
                      >
                        {order.type.toUpperCase()}
                      </Badge>
                      {order.direction && (
                        <Badge
                          variant="light"
                          color="gray"
                          size="xs"
                          radius="sm"
                        >
                          {order.direction}
                        </Badge>
                      )}
                    </div>
                    <Text size="xs" c="dimmed">
                      {Number(order.amount).toFixed(4)} @{" "}
                      {formatCurrency(Number(order.averagePrice))}
                    </Text>
                  </div>
                </div>
                <div className="text-right">
                  <Text size="sm" fw={600}>
                    {formatCurrency(Number(order.totalCost))}
                  </Text>
                  {pnl !== null && pnl !== 0 && (
                    <Text size="xs" c={pnl >= 0 ? "green" : "red"}>
                      {pnl >= 0 ? "+" : ""}
                      {formatCurrency(pnl)}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {formatDateTime(order.time)}
                  </Text>
                </div>
              </div>
            );
          })}
          <div className="pt-2 text-center">
            <Button component={Link} href="/trades" variant="subtle" size="xs">
              View all trades
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
