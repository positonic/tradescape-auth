"use client";

import { Card, Title, Text, Badge, Skeleton, Button } from "@mantine/core";
import Link from "next/link";
import { formatCurrency } from "~/lib/tradeUtils";

interface Setup {
  id: string;
  content: string | null;
  direction: string | null;
  entryPrice: unknown;
  takeProfitPrice: unknown;
  stopPrice: unknown;
  status: string;
  timeframe: string | null;
  pair: { symbol: string } | null;
  coin: { symbol: string } | null;
}

interface ActiveSetupsProps {
  setups: Setup[] | undefined;
  isLoading: boolean;
}

export function ActiveSetups({ setups, isLoading }: ActiveSetupsProps) {
  if (isLoading) {
    return (
      <Card withBorder radius="md" p="lg" className="h-full">
        <Skeleton height={20} width="50%" mb={8} />
        <Skeleton height={14} width="40%" mb="lg" />
        <Skeleton height={100} mb={8} />
      </Card>
    );
  }

  const activeSetups =
    setups?.filter((s) => s.status === "active").slice(0, 3) ?? [];

  return (
    <Card withBorder radius="md" p="lg" className="h-full">
      <Title order={4} fw={600} mb={4}>
        Active Setups
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        Your current trade ideas
      </Text>

      {activeSetups.length === 0 ? (
        <div className="py-4 text-center">
          <Text c="dimmed" mb="sm">
            No active setups
          </Text>
          <Button component={Link} href="/setups" variant="subtle" size="xs">
            Create a setup
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {activeSetups.map((setup) => {
            const pairSymbol =
              setup.pair?.symbol ?? setup.coin?.symbol ?? "Unknown";
            const baseCoin = pairSymbol.split("/")[0] ?? pairSymbol;
            const isLong = setup.direction === "long";

            return (
              <div
                key={setup.id}
                className="rounded-lg border border-gray-200 p-4 dark:border-[var(--mantine-color-dark-4)]"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <Text size="sm" fw={600}>
                      {baseCoin}
                    </Text>
                    {setup.timeframe && (
                      <Text size="xs" c="dimmed">
                        {setup.timeframe}
                      </Text>
                    )}
                  </div>
                  <Badge
                    color={isLong ? "green" : "red"}
                    variant="light"
                    size="sm"
                  >
                    {setup.direction?.toUpperCase() ?? "N/A"}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  {setup.entryPrice != null ? (
                    <div>
                      <Text size="xs" c="dimmed">
                        Entry
                      </Text>
                      <Text size="xs" fw={500}>
                        {formatCurrency(Number(setup.entryPrice))}
                      </Text>
                    </div>
                  ) : null}
                  {setup.takeProfitPrice != null ? (
                    <div>
                      <Text size="xs" c="green">
                        TP
                      </Text>
                      <Text size="xs" fw={500} c="green">
                        {formatCurrency(Number(setup.takeProfitPrice))}
                      </Text>
                    </div>
                  ) : null}
                  {setup.stopPrice != null ? (
                    <div>
                      <Text size="xs" c="red">
                        SL
                      </Text>
                      <Text size="xs" fw={500} c="red">
                        {formatCurrency(Number(setup.stopPrice))}
                      </Text>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div className="pt-2 text-center">
            <Button component={Link} href="/setups" variant="subtle" size="xs">
              View all setups
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
