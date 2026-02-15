"use client";

import { useCallback } from "react";
import { Card, Text, Title, Button, Group, Skeleton } from "@mantine/core";
import { AreaChart } from "@mantine/charts";
import "@mantine/charts/styles.css";

interface ChartDataPoint {
  date: string;
  value: number;
}

interface PortfolioChartProps {
  data: ChartDataPoint[];
  isLoading: boolean;
  activePeriod: string;
  onPeriodChange: (period: string) => void;
}

const periods = ["1M", "3M", "6M", "1Y", "All"] as const;

export function PortfolioChart({
  data,
  isLoading,
  activePeriod,
  onPeriodChange,
}: PortfolioChartProps) {
  const handlePeriodClick = useCallback(
    (period: string) => {
      onPeriodChange(period);
    },
    [onPeriodChange],
  );

  if (isLoading) {
    return (
      <Card withBorder radius="md" p="lg" className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Skeleton height={20} width={180} mb={4} />
            <Skeleton height={14} width={220} />
          </div>
          <Group gap={4}>
            {periods.map((period) => (
              <Skeleton key={period} height={28} width={36} radius="sm" />
            ))}
          </Group>
        </div>
        <Skeleton height={300} />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card withBorder radius="md" p="lg" className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Title order={4} fw={600}>
              Portfolio Performance
            </Title>
            <Text size="sm" c="dimmed">
              Historical portfolio value
            </Text>
          </div>
        </div>
        <div className="flex h-[300px] items-center justify-center">
          <Text ta="center" c="dimmed">
            No portfolio history yet. Take snapshots from the Live page to build
            your chart.
          </Text>
        </div>
      </Card>
    );
  }

  const values = data.map((d) => d.value);
  const maxValue = Math.max(...values);
  const yMax = maxValue * 1.1;

  return (
    <Card withBorder radius="md" p="lg" className="flex-1">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Title order={4} fw={600}>
            Portfolio Performance
          </Title>
          <Text size="sm" c="dimmed">
            Historical portfolio value
          </Text>
        </div>
        <Group gap={4}>
          {periods.map((period) => (
            <Button
              key={period}
              size="xs"
              variant={activePeriod === period ? "filled" : "subtle"}
              color={activePeriod === period ? "dark" : "gray"}
              radius="sm"
              onClick={() => handlePeriodClick(period)}
              styles={{
                root: {
                  fontWeight: 500,
                  paddingInline: 12,
                },
              }}
            >
              {period}
            </Button>
          ))}
        </Group>
      </div>

      <AreaChart
        h={300}
        data={data}
        dataKey="date"
        series={[{ name: "value", color: "gray.6" }]}
        curveType="monotone"
        yAxisProps={{
          domain: [0, yMax],
          tickFormatter: (value: number) =>
            value >= 1000000
              ? `$${(value / 1000000).toFixed(1)}M`
              : value >= 1000
                ? `$${(value / 1000).toFixed(0)}K`
                : `$${value.toFixed(0)}`,
        }}
        gridAxis="y"
        withDots={false}
        fillOpacity={0.15}
        strokeWidth={2}
      />
    </Card>
  );
}
