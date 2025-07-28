"use client";

import { Title, Text, Card } from "@mantine/core";
import { LineChart } from "@mantine/charts";
import "@mantine/charts/styles.css";

// Hardcoded PNL data for the chart
const pnlData = [
  { date: "2023-12-15", pnl: 0 },
  { date: "2024-01-15", pnl: 50000 },
  { date: "2024-02-15", pnl: 120000 },
  { date: "2024-03-15", pnl: 180000 },
  { date: "2024-04-15", pnl: 250000 },
  { date: "2024-05-15", pnl: 320000 },
  { date: "2024-06-15", pnl: 420000 },
  { date: "2024-07-15", pnl: 520000 },
  { date: "2024-08-15", pnl: 580000 },
  { date: "2024-09-15", pnl: 620000 },
  { date: "2024-10-15", pnl: 680000 },
  { date: "2024-11-15", pnl: 720000 },
  { date: "2024-12-15", pnl: 750000 },
  { date: "2025-01-15", pnl: 780000 },
  { date: "2025-02-15", pnl: 820000 },
  { date: "2025-03-15", pnl: 850000 },
  { date: "2025-04-15", pnl: 880000 },
  { date: "2025-05-15", pnl: 920000 },
  { date: "2025-06-15", pnl: 950000 },
  { date: "2025-07-16", pnl: 980000 },
];

export function LifetimePNLChart() {
  return (
    <Card className="mb-6 border-gray-700 bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <Title order={3} className="text-white">
          Lifetime PNL
        </Title>
        <Text size="sm" c="dimmed">
          Dec 15, 2023 - Jul 16, 2025
        </Text>
      </div>

      <div className="relative">
        <LineChart
          h={300}
          data={pnlData}
          dataKey="date"
          series={[
            {
              name: "pnl",
              color: "teal",
            },
          ]}
          yAxisProps={{
            domain: [0, 1000000],
            tickFormatter: (value) => `+$${(value / 1000).toFixed(0)}k`,
          }}
          xAxisProps={{
            tickFormatter: (value) => {
              const date = new Date(value as string | number | Date);
              return date.toLocaleDateString("en-US", {
                month: "short",
                year: "2-digit",
              });
            },
          }}
          gridAxis="x"
          tickLine="y"
          withDots={false}
        />

        {/* TradeStream Logo Overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 opacity-20">
            <img
              src="/tradescape-logo-trans.png"
              alt="TradeScape Logo"
              className="h-8 w-auto"
            />
            <Text size="lg" c="dimmed" fw={600}>
              Tradescape.ai
            </Text>
          </div>
        </div>
      </div>
    </Card>
  );
}
