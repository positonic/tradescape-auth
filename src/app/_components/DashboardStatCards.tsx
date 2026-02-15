"use client";

import { Card, Title, Text, Skeleton } from "@mantine/core";
import { IconArrowUpRight, IconArrowDownRight } from "@tabler/icons-react";
import { formatCurrency } from "~/lib/tradeUtils";

interface StatCardData {
  label: string;
  value: string;
  change: string;
  subtitle: string;
  positive: boolean;
}

interface DashboardStatCardsProps {
  dashboardStats: {
    currentValue: number | null;
    previousValue: number | null;
    monthAgoValue: number | null;
    hasData: boolean;
  } | null;
  dailyStats: {
    netPnL: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    totalOrders: number;
  } | null;
  isLoading: boolean;
}

function computeStatCards(
  dashboardStats: DashboardStatCardsProps["dashboardStats"],
  dailyStats: DashboardStatCardsProps["dailyStats"],
): StatCardData[] {
  const currentValue = dashboardStats?.currentValue ?? 0;
  const previousValue = dashboardStats?.previousValue ?? 0;
  const monthAgoValue = dashboardStats?.monthAgoValue ?? 0;

  const snapshotChange =
    previousValue > 0
      ? ((currentValue - previousValue) / previousValue) * 100
      : 0;

  const monthlyChange =
    monthAgoValue > 0
      ? ((currentValue - monthAgoValue) / monthAgoValue) * 100
      : 0;
  const monthlyDelta = currentValue - monthAgoValue;

  return [
    {
      label: "Total Portfolio Value",
      value: dashboardStats?.hasData
        ? formatCurrency(currentValue)
        : "$0.00",
      change: `${snapshotChange >= 0 ? "+" : ""}${snapshotChange.toFixed(1)}%`,
      subtitle: "vs. previous snapshot",
      positive: snapshotChange >= 0,
    },
    {
      label: "Today's P&L",
      value: dailyStats
        ? formatCurrency(dailyStats.netPnL)
        : "$0.00",
      change: dailyStats
        ? `${dailyStats.winCount}W / ${dailyStats.lossCount}L`
        : "0W / 0L",
      subtitle: "today",
      positive: (dailyStats?.netPnL ?? 0) >= 0,
    },
    {
      label: "Monthly Change",
      value: dashboardStats?.hasData && monthAgoValue > 0
        ? `${monthlyChange >= 0 ? "+" : ""}${monthlyChange.toFixed(1)}%`
        : "N/A",
      change: dashboardStats?.hasData && monthAgoValue > 0
        ? formatCurrency(monthlyDelta)
        : "$0.00",
      subtitle: "30-day change",
      positive: monthlyDelta >= 0,
    },
    {
      label: "Win Rate",
      value: dailyStats
        ? `${dailyStats.winRate.toFixed(1)}%`
        : "N/A",
      change: dailyStats
        ? `${dailyStats.totalOrders} orders`
        : "0 orders",
      subtitle: "today",
      positive: (dailyStats?.winRate ?? 0) >= 50,
    },
  ];
}

export function DashboardStatCards({
  dashboardStats,
  dailyStats,
  isLoading,
}: DashboardStatCardsProps) {
  if (isLoading) {
    return (
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} withBorder radius="md" p="lg">
            <Skeleton height={14} width="60%" mb={12} />
            <Skeleton height={28} width="80%" mb={8} />
            <Skeleton height={14} width="50%" />
          </Card>
        ))}
      </div>
    );
  }

  const cards = computeStatCards(dashboardStats, dailyStats);

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} withBorder radius="md" p="lg">
          <Text size="sm" c="dimmed" mb={8}>
            {card.label}
          </Text>
          <Title order={3} fw={700} mb={4}>
            {card.value}
          </Title>
          <div className="flex items-center gap-1">
            {card.positive ? (
              <IconArrowUpRight size={16} className="text-green-600" />
            ) : (
              <IconArrowDownRight size={16} className="text-red-500" />
            )}
            <Text size="sm" fw={500} c={card.positive ? "green" : "red"} span>
              {card.change}
            </Text>
            <Text size="sm" c="dimmed" span>
              {card.subtitle}
            </Text>
          </div>
        </Card>
      ))}
    </div>
  );
}
