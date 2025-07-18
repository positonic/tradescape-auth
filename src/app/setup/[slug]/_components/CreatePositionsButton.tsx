"use client";

import { useState } from "react";
import { Button } from "@mantine/core";
import { api } from "~/trpc/react";
import { notifications } from "@mantine/notifications";

export function CreatePositionsButton() {
  const [isRunning, setIsRunning] = useState(false);
  const createPositionsMutation = api.pairs.createPositionsFromExistingOrders.useMutation();

  const runPositionCreation = async (dryRun = false) => {
    setIsRunning(true);

    try {
      const result = await createPositionsMutation.mutateAsync({
        dryRun,
        maxOrders: 1000,
      });

      console.log("Position creation result:", result);
      
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
    <Button
      onClick={() => runPositionCreation(false)}
      loading={isRunning}
      size="sm"
      variant="outline"
    >
      Create Positions
    </Button>
  );
}