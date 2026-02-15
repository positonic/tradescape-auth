"use client";

import { Paper, SimpleGrid, Text } from "@mantine/core";
import { formatCurrency } from "~/lib/tradeUtils";

interface DailyStatsProps {
  stats: {
    totalTrades: number;
    totalOrders: number;
    totalVolume: number;
    netPnL: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    uniquePairs: number;
    totalFees: number;
    largestWin: number;
    largestLoss: number;
  };
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Paper withBorder p="md" radius="sm">
      <Text c="dimmed" size="xs" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700} c={color}>
        {value}
      </Text>
    </Paper>
  );
}

export function DailyStats({ stats }: DailyStatsProps) {
  const pnlColor = stats.netPnL > 0 ? "green" : stats.netPnL < 0 ? "red" : undefined;

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} mb="lg">
      <StatCard label="Trades" value={String(stats.totalTrades)} />
      <StatCard label="Orders" value={String(stats.totalOrders)} />
      <StatCard label="Volume" value={formatCurrency(stats.totalVolume)} />
      <StatCard
        label="Net P&L"
        value={formatCurrency(stats.netPnL)}
        color={pnlColor}
      />
      <StatCard
        label="Win Rate"
        value={
          stats.winCount + stats.lossCount > 0
            ? `${stats.winRate.toFixed(1)}% (${stats.winCount}W / ${stats.lossCount}L)`
            : "N/A"
        }
      />
      <StatCard label="Pairs Traded" value={String(stats.uniquePairs)} />
      <StatCard label="Total Fees" value={formatCurrency(stats.totalFees)} />
      <StatCard
        label="Largest Win"
        value={stats.largestWin > 0 ? formatCurrency(stats.largestWin) : "N/A"}
        color={stats.largestWin > 0 ? "green" : undefined}
      />
      <StatCard
        label="Largest Loss"
        value={stats.largestLoss < 0 ? formatCurrency(stats.largestLoss) : "N/A"}
        color={stats.largestLoss < 0 ? "red" : undefined}
      />
    </SimpleGrid>
  );
}
