"use client";

import {
  Badge,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  cryptoColors,
  formatCurrency,
  parseQuoteBaseFromPair,
} from "~/lib/tradeUtils";

interface PairBreakdown {
  pair: string;
  tradeCount: number;
  orderCount: number;
  buyVolume: number;
  sellVolume: number;
  netPnL: number;
  fees: number;
}

interface PairBreakdownGridProps {
  pairBreakdowns: PairBreakdown[];
}

function PairCard({ data }: { data: PairBreakdown }) {
  const { base } = parseQuoteBaseFromPair(data.pair);
  const accentColor = cryptoColors[base] ?? "var(--mantine-color-blue-6)";
  const pnlColor = data.netPnL > 0 ? "green" : data.netPnL < 0 ? "red" : "gray";

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" mb="xs">
        <Text fw={600} size="lg" style={{ color: accentColor }}>
          {data.pair}
        </Text>
        <Badge color={pnlColor} size="lg" variant="light">
          {formatCurrency(data.netPnL)}
        </Badge>
      </Group>

      <Divider mb="sm" />

      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Trades / Orders
          </Text>
          <Text size="sm" fw={500}>
            {data.tradeCount} / {data.orderCount}
          </Text>
        </Group>

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Buy Volume
          </Text>
          <Text size="sm" fw={500} c="green">
            {formatCurrency(data.buyVolume)}
          </Text>
        </Group>

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Sell Volume
          </Text>
          <Text size="sm" fw={500} c="red">
            {formatCurrency(data.sellVolume)}
          </Text>
        </Group>

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Fees
          </Text>
          <Text size="sm" fw={500}>
            {formatCurrency(data.fees)}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}

export function PairBreakdownGrid({ pairBreakdowns }: PairBreakdownGridProps) {
  if (pairBreakdowns.length === 0) return null;

  return (
    <>
      <Title order={4} mb="sm">
        Pair Breakdown
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="lg">
        {pairBreakdowns.map((pb) => (
          <PairCard key={pb.pair} data={pb} />
        ))}
      </SimpleGrid>
    </>
  );
}
