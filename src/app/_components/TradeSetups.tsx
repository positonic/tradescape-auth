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

      {setups.coins?.map((coin, coinIndex) => (
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
              {coin.tradeSetups?.map((setup, setupIndex) => {
                const globalIndex = coinIndex * 1000 + setupIndex; // Create unique index for each setup
                return (
                  <Table.Tr
                    key={`${coin.coinSymbol}-${setup.position}-${setupIndex}`}
                    bg={
                      selectedSetups.includes(globalIndex)
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
                        checked={selectedSetups.includes(globalIndex)}
                        onChange={(event) => {
                          const isChecked = event.currentTarget.checked;
                          console.log('--- Checkbox Change Debug ---');
                          console.log('Checkbox checked:', isChecked);
                          console.log('Current globalIndex:', globalIndex);
                          console.log('Current selectedSetups:', selectedSetups);
                          console.log('Parent coin symbol:', coin.coinSymbol);
                          console.log('Setup index within coin:', setupIndex);
                          
                          const newSelectedSetups = isChecked
                            ? Array.from(new Set([...selectedSetups, globalIndex]))
                            : selectedSetups.filter((id) => id !== globalIndex);
                          
                          console.log('New selectedSetups:', newSelectedSetups);
                          console.log('------------------------');
                          
                          onSetupSelectionChange(newSelectedSetups);
                        }}
                      />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      ))}
    </Paper>
  );
} 