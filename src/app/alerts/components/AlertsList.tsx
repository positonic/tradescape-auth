"use client";

import * as React from "react";
import { useEffect } from "react";
import { api } from "~/trpc/react";
import {
  Paper,
  Table,
  Badge,
  Text,
  LoadingOverlay,
  Title,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import { useSocketConnection } from "~/lib/socketService";

export function AlertsList() {
  const {
    data: alerts,
    isLoading,
    error,
    refetch,
  } = api.alerts.getAllForUser.useQuery();
  const { socket } = useSocketConnection();

  // Listen for alert notifications and auto-refresh the list
  useEffect(() => {
    if (!socket) return;

    const handleNotification = () => {
      console.log("[AlertsList] Alert triggered, refreshing list...");
      void refetch();
    };

    socket.on("notification", handleNotification);

    return () => {
      socket.off("notification", handleNotification);
    };
  }, [socket, refetch]);

  const deleteAlert = api.alerts.delete.useMutation({
    onSuccess: () => {
      void refetch();
      notifications.show({
        title: "Alert deleted",
        message: "Alert has been successfully deleted",
        color: "green",
      });
    },
    onError: (error) => {
      notifications.show({
        title: "Error",
        message: `Failed to delete alert: ${error.message}`,
        color: "red",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "blue";
      case "TRIGGERED":
        return "green";
      case "CANCELLED":
        return "gray";
      default:
        return "gray";
    }
  };

  const getDirectionColor = (direction: string) => {
    return direction === "ABOVE" ? "green" : "red";
  };

  const handleDelete = (id: string) => {
    deleteAlert.mutate({ id });
  };

  const safeAlerts = alerts ?? [];

  return (
    <Paper shadow="sm" p="md" radius="md" withBorder pos="relative">
      <LoadingOverlay
        visible={isLoading || deleteAlert.isPending}
        overlayProps={{ radius: "sm", blur: 2 }}
      />
      <Title order={3} mb="md">
        My Alerts
      </Title>

      {error && <Text c="red">Error loading alerts: {error.message}</Text>}

      {!isLoading && !error && safeAlerts.length === 0 && (
        <Text c="dimmed">You haven&apos;t created any alerts yet.</Text>
      )}

      {!isLoading && !error && safeAlerts.length > 0 && (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Pair</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Direction</Table.Th>
              <Table.Th>Threshold</Table.Th>
              <Table.Th>Interval</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {safeAlerts.map((alert) => (
              <Table.Tr key={alert.id}>
                <Table.Td>{alert.pair?.symbol ?? "N/A"}</Table.Td>
                <Table.Td>
                  <Badge variant="light">{alert.type}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={getDirectionColor(alert.direction)}
                    variant="light"
                  >
                    {alert.direction}
                  </Badge>
                </Table.Td>
                <Table.Td>{alert.threshold?.toString() ?? "N/A"}</Table.Td>
                <Table.Td>{alert.interval ?? "N/A"}</Table.Td>
                <Table.Td>
                  <Badge color={getStatusColor(alert.status)} variant="filled">
                    {alert.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {new Date(alert.createdAt).toLocaleDateString()}
                </Table.Td>
                <Table.Td>
                  <Tooltip label="Delete alert">
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      size="sm"
                      onClick={() => handleDelete(alert.id)}
                      disabled={deleteAlert.isPending}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
