"use client";

import { forwardRef, useState } from "react";
import { Button, Modal, Text, Group } from "@mantine/core";
import { api } from "~/trpc/react";
import { notifications } from "@mantine/notifications";

export const DeletePositionsButton = forwardRef<HTMLDivElement>(function DeletePositionsButton(_props, ref) {
  const [isRunning, setIsRunning] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const deletePositionsMutation = api.pairs.deleteAllPositions.useMutation();
  const utils = api.useUtils();

  const handleDeletePositions = async () => {
    setIsRunning(true);
    setConfirmModalOpen(false);

    try {
      const result = await deletePositionsMutation.mutateAsync();

      console.log("Position deletion result:", result);

      if (result.success) {
        notifications.show({
          title: "Success",
          message: result.message,
          color: "green",
        });

        // Invalidate positions query to refresh the UI
        void utils.trades.getPositions.invalidate();
      } else {
        notifications.show({
          title: "Warning",
          message: result.message,
          color: "orange",
        });
      }
    } catch (error) {
      console.error("Position deletion error:", error);
      notifications.show({
        title: "Error",
        message:
          error instanceof Error ? error.message : "Failed to delete positions",
        color: "red",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div ref={ref} {..._props}>
      <Button
        onClick={() => setConfirmModalOpen(true)}
        loading={isRunning}
        size="sm"
        color="red"
        variant="outline"
      >
        🗑️ Delete Positions
      </Button>

      <Modal
        opened={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Delete All Positions"
        centered
      >
        <Text mb="md">
          Are you sure you want to delete <strong>all positions</strong>? This
          action cannot be undone.
        </Text>
        <Text size="sm" c="dimmed" mb="lg">
          This will unlink orders from positions and permanently delete all
          position records. You can recreate positions afterwards using the
          &quot;Create Positions&quot; button.
        </Text>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setConfirmModalOpen(false)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleDeletePositions}
            loading={isRunning}
          >
            Delete All Positions
          </Button>
        </Group>
      </Modal>
    </div>
  );
});
