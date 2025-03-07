import { Paper, Title, Text, Group, Badge, Table, Checkbox } from "@mantine/core";
import type { TranscriptionSetups } from "~/types/transcription";

interface TradeSetupsProps {
  setups: TranscriptionSetups;
  selectedSetups: number[];
  onSetupSelectionChange: (selectedSetups: number[]) => void;
}

export function TradeSetups({
  setups,
  selectedSetups,
  onSetupSelectionChange,
}: TradeSetupsProps) {
  return (
    <Paper shadow="sm" p="md" radius="md" withBorder>
      <Title order={3} mb="md">
        Setups
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        {setups.coins?.length} coins analyzed
      </Text>
      <Text size="sm" mb="md">
        {setups.generalMarketContext}
      </Text>

      {setups.coins?.map((coin) => (
        <Paper
          key={coin.coinSymbol}
          shadow="xs"
          p="sm"
          radius="sm"
          withBorder
          mb="md"
        >
          <Title order={4} mb="xs">
            {coin.coinSymbol}
          </Title>
          <Group gap="xs" mb="xs">
            <Badge
              key={`${coin.coinSymbol}-${coin.sentiment}`}
              variant="light"
              color={
                coin.sentiment?.toLowerCase().includes("bullish")
                  ? "green"
                  : coin.sentiment?.toLowerCase().includes("bearish")
                    ? "red"
                    : "blue"
              }
            >
              {coin.sentiment}
            </Badge>
          </Group>
          <Text size="sm" mb="md">
            {coin.marketContext}
          </Text>

          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Position</Table.Th>
                <Table.Th>Entry Triggers</Table.Th>
                <Table.Th>Entry Price</Table.Th>
                <Table.Th>Take Profit</Table.Th>
                <Table.Th>Stop Loss</Table.Th>
                <Table.Th>Timeframe</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {coin.tradeSetups?.map((setup, index) => (
                <Table.Tr
                  key={`${coin.coinSymbol}-${setup.position}-${index}`}
                  bg={
                    selectedSetups.includes(index)
                      ? "var(--mantine-color-blue-light)"
                      : undefined
                  }
                >
                  <Table.Td>{setup.position}</Table.Td>
                  <Table.Td>{setup.entryTriggers}</Table.Td>
                  <Table.Td>{setup.entryPrice}</Table.Td>
                  <Table.Td>{setup.takeProfit}</Table.Td>
                  <Table.Td>{setup.stopLoss}</Table.Td>
                  <Table.Td>{setup.timeframe}</Table.Td>
                  <Table.Td>
                    <Checkbox
                      aria-label="Select setup"
                      checked={selectedSetups.includes(index)}
                      onChange={(event) =>
                        onSetupSelectionChange(
                          event.currentTarget.checked
                            ? [...selectedSetups, index]
                            : selectedSetups.filter(
                                (id) => id !== index
                              )
                        )
                      }
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      ))}
    </Paper>
  );
} 