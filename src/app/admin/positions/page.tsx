"use client";

import { useState } from "react";
import {
  Button,
  Container,
  Title,
  Text,
  Group,
  Paper,
  Stack,
  Code,
} from "@mantine/core";
import { api } from "~/trpc/react";
import { notifications } from "@mantine/notifications";

export default function PositionsAdminPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    createdPositions?: number;
    matchedOrders?: number;
    totalOrders?: number;
  } | null>(null);

  const createPositionsMutation =
    api.pairs.createPositionsFromExistingOrders.useMutation();

  const runPositionCreation = async (dryRun = false) => {
    setIsRunning(true);
    setResult(null);

    try {
      const result = await createPositionsMutation.mutateAsync({
        dryRun,
        maxOrders: 1000,
      });

      setResult(result);

      if (result.success) {
        notifications.show({
          title: "Success",
          message: result.message,
          color: "green",
        });
      }
    } catch (error) {
      console.error("Error creating positions:", error);
      notifications.show({
        title: "Error",
        message: "Failed to create positions",
        color: "red",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="lg">
        Position Creation Admin
      </Title>

      <Text mb="xl">
        This tool creates positions from existing orders that don&apos;t have
        positions assigned yet.
      </Text>

      <Paper p="md" mb="xl">
        <Stack>
          <Title order={3}>Actions</Title>
          <Group>
            <Button
              onClick={() => runPositionCreation(true)}
              loading={isRunning}
              variant="outline"
            >
              Dry Run (Preview)
            </Button>
            <Button
              onClick={() => runPositionCreation(false)}
              loading={isRunning}
              color="blue"
            >
              Create Positions
            </Button>
          </Group>
        </Stack>
      </Paper>

      {result && (
        <Paper p="md">
          <Title order={3} mb="md">
            Result
          </Title>
          <Code block>{JSON.stringify(result, null, 2)}</Code>
        </Paper>
      )}
    </Container>
  );
}
