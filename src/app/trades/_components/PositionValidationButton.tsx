"use client";

import { useState } from "react";
import { Button, Modal, Title, Text, Group, Stack, Badge, Table, Progress } from "@mantine/core";
import { api } from "~/trpc/react";
import { notifications } from "@mantine/notifications";

export function PositionValidationButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [validationData, setValidationData] = useState<any>(null);
  
  const validateQuery = api.pairs.validatePositionCreation.useQuery(undefined, {
    enabled: false,
  });

  const runValidation = async () => {
    try {
      const result = await validateQuery.refetch();
      setValidationData(result.data);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error validating positions:", error);
      notifications.show({
        title: "Error",
        message: "Failed to validate position creation",
        color: "red",
      });
    }
  };

  return (
    <>
      <Button
        onClick={runValidation}
        loading={validateQuery.isLoading}
        variant="outline"
        size="sm"
      >
        📊 Validate Positions
      </Button>

      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Position Creation Analysis"
        size="xl"
      >
        {validationData && (
          <Stack>
            <Title order={3}>📈 Position Analysis Report</Title>
            
            <Group>
              <Badge size="lg" variant="filled">
                Total Positions: {validationData.totalPositions}
              </Badge>
              <Badge size="lg" variant="outline">
                Avg Orders/Position: {validationData.averageOrdersPerPosition.toFixed(2)}
              </Badge>
              <Badge size="lg" variant="outline" color={validationData.averageProfitLoss >= 0 ? 'green' : 'red'}>
                Avg P&L: ${validationData.averageProfitLoss.toFixed(2)}
              </Badge>
            </Group>

            <Stack>
              <Title order={4}>🎯 Position Completeness</Title>
              <Group>
                <Text>Complete Positions: {validationData.completePositions} ({((validationData.completePositions / validationData.totalPositions) * 100).toFixed(1)}%)</Text>
              </Group>
              <Progress 
                value={(validationData.completePositions / validationData.totalPositions) * 100} 
                color="green" 
                size="lg" 
                label={`${validationData.completePositions}/${validationData.totalPositions}`}
              />
              
              <Group>
                <Badge color="yellow">Partial: {validationData.partialPositions}</Badge>
                <Badge color="blue">Buy Only: {validationData.buyOnlyPositions}</Badge>
                <Badge color="orange">Sell Only: {validationData.sellOnlyPositions}</Badge>
              </Group>
            </Stack>

            <Stack>
              <Title order={4}>💰 Profitability</Title>
              <Group>
                <Badge color="green">Profitable: {validationData.positivePositions} ({((validationData.positivePositions / validationData.totalPositions) * 100).toFixed(1)}%)</Badge>
                <Badge color="red">Losing: {validationData.negativePositions} ({((validationData.negativePositions / validationData.totalPositions) * 100).toFixed(1)}%)</Badge>
                <Badge color="gray">Break-Even: {validationData.breakEvenPositions} ({((validationData.breakEvenPositions / validationData.totalPositions) * 100).toFixed(1)}%)</Badge>
              </Group>
            </Stack>

            <Stack>
              <Title order={4}>📋 Top Trading Pairs</Title>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Pair</Table.Th>
                    <Table.Th>Positions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {validationData.topTradingPairs.map((item: any, index: number) => (
                    <Table.Tr key={index}>
                      <Table.Td>{item.pair}</Table.Td>
                      <Table.Td>{item.count}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>

            <Stack>
              <Title order={4}>🎯 Effectiveness Scores</Title>
              <Group>
                <div>
                  <Text size="sm">Completeness Score</Text>
                  <Progress value={validationData.completenessScore} color="blue" size="lg" />
                  <Text size="xs" c="dimmed">{validationData.completenessScore.toFixed(1)}%</Text>
                </div>
                <div>
                  <Text size="sm">Profitability Score</Text>
                  <Progress value={validationData.profitabilityScore} color="green" size="lg" />
                  <Text size="xs" c="dimmed">{validationData.profitabilityScore.toFixed(1)}%</Text>
                </div>
              </Group>
            </Stack>

            <Stack>
              <Title order={4}>📝 Recommendations</Title>
              {validationData.completenessScore < 50 && (
                <Text c="yellow">⚠️ Low completeness ({validationData.completenessScore.toFixed(1)}%) - Consider improving position matching algorithm</Text>
              )}
              {(validationData.buyOnlyPositions + validationData.sellOnlyPositions) > validationData.completePositions && (
                <Text c="yellow">⚠️ Many partial positions - Review time-based grouping strategy</Text>
              )}
              {validationData.profitabilityScore < 30 && (
                <Text c="yellow">⚠️ Low profitability ratio - May indicate incorrect position calculations</Text>
              )}
              {validationData.completenessScore >= 70 && validationData.profitabilityScore >= 50 && (
                <Text c="green">✅ Position creation algorithm is performing well!</Text>
              )}
            </Stack>
          </Stack>
        )}
      </Modal>
    </>
  );
}