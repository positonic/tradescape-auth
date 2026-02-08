"use client";

import { useState } from "react";
import { Card, Text, Title, Button, Group } from "@mantine/core";
import { AreaChart } from "@mantine/charts";
import "@mantine/charts/styles.css";

const portfolioData = [
  { month: "Jan", value: 800000 },
  { month: "Feb", value: 1200000 },
  { month: "Mar", value: 1400000 },
  { month: "Apr", value: 1600000 },
  { month: "May", value: 1800000 },
  { month: "Jun", value: 2000000 },
  { month: "Jul", value: 2100000 },
  { month: "Aug", value: 2200000 },
  { month: "Sep", value: 2400000 },
  { month: "Oct", value: 2500000 },
  { month: "Nov", value: 2600000 },
  { month: "Dec", value: 2847392 },
];

const periods = ["1M", "3M", "6M", "1Y", "All"] as const;

export function PortfolioChart() {
  const [activePeriod, setActivePeriod] = useState<string>("1Y");

  return (
    <Card withBorder radius="md" p="lg" className="flex-1">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Title order={4} fw={600}>
            Portfolio Performance
          </Title>
          <Text size="sm" c="dimmed">
            Year-to-date growth trajectory
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
              onClick={() => setActivePeriod(period)}
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
        data={portfolioData}
        dataKey="month"
        series={[{ name: "value", color: "gray.6" }]}
        curveType="monotone"
        yAxisProps={{
          domain: [0, 3000000],
          tickFormatter: (value: number) => `$${(value / 1000000).toFixed(1)}M`,
        }}
        gridAxis="y"
        withDots={false}
        fillOpacity={0.15}
        strokeWidth={2}
      />
    </Card>
  );
}
