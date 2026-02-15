"use client";

import { Card, Title, Text, Skeleton } from "@mantine/core";
import { DonutChart } from "@mantine/charts";
import "@mantine/charts/styles.css";
import { cryptoColors } from "~/lib/tradeUtils";

interface Position {
  pair: string;
  status: string;
  totalCostBuy: unknown; // Prisma Decimal
}

interface AssetAllocationChartProps {
  positions: Position[] | undefined;
  isLoading: boolean;
}

const DEFAULT_COLOR = "gray.5";
const MANTINE_COLOR_MAP: Record<string, string> = {
  BTC: "orange",
  ETH: "violet",
  SOL: "teal",
  AVAX: "red",
  DOT: "pink",
  ADA: "blue",
  NEAR: "red.7",
  ARB: "cyan",
  SUI: "pink.4",
};

export function AssetAllocationChart({
  positions,
  isLoading,
}: AssetAllocationChartProps) {
  if (isLoading) {
    return (
      <Card withBorder radius="md" p="lg" className="h-full">
        <Skeleton height={20} width="50%" mb={8} />
        <Skeleton height={14} width="40%" mb="lg" />
        <Skeleton height={180} circle mx="auto" mb="lg" />
        <Skeleton height={14} mb={8} />
        <Skeleton height={14} mb={8} />
        <Skeleton height={14} />
      </Card>
    );
  }

  const openPositions = positions?.filter((p) => p.status === "open") ?? [];

  if (openPositions.length === 0) {
    return (
      <Card withBorder radius="md" p="lg" className="h-full">
        <Title order={4} fw={600} mb={4}>
          Asset Allocation
        </Title>
        <Text size="sm" c="dimmed" mb="lg">
          Current portfolio distribution
        </Text>
        <Text ta="center" c="dimmed" py="xl">
          No open positions
        </Text>
      </Card>
    );
  }

  // Group by base coin
  const allocationMap = new Map<string, number>();
  for (const position of openPositions) {
    const baseCoin = position.pair.split("/")[0] ?? position.pair;
    const currentValue = allocationMap.get(baseCoin) ?? 0;
    allocationMap.set(
      baseCoin,
      currentValue + Math.abs(Number(position.totalCostBuy)),
    );
  }

  const totalAllocation = Array.from(allocationMap.values()).reduce(
    (sum, v) => sum + v,
    0,
  );
  const allocationData = Array.from(allocationMap.entries())
    .map(([coin, value]) => ({
      name: coin,
      value:
        totalAllocation > 0 ? Math.round((value / totalAllocation) * 100) : 0,
      color: MANTINE_COLOR_MAP[coin] ?? DEFAULT_COLOR,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <Card withBorder radius="md" p="lg" className="h-full">
      <Title order={4} fw={600} mb={4}>
        Asset Allocation
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        Current portfolio distribution
      </Text>
      <div className="flex justify-center">
        <DonutChart
          data={allocationData}
          size={180}
          thickness={28}
          paddingAngle={2}
          tooltipDataSource="segment"
          chartLabel=""
        />
      </div>
      <div className="mt-6 space-y-3">
        {allocationData.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    cryptoColors[item.name] ?? "rgb(156, 163, 175)",
                }}
              />
              <Text size="sm">{item.name}</Text>
            </div>
            <Text size="sm" fw={600}>
              {item.value}%
            </Text>
          </div>
        ))}
      </div>
    </Card>
  );
}
