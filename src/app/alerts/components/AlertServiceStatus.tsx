"use client";

import { useEffect, useState } from "react";
import { Badge, Group, Tooltip, Text } from "@mantine/core";
import {
  IconCircleCheck,
  IconCircleX,
  IconCircleDashed,
} from "@tabler/icons-react";
import { useSocket } from "~/app/_components/SocketProvider";

interface HealthStatus {
  status: "ok" | "error" | "checking";
  timestamp?: string;
  error?: string;
}

export function AlertServiceStatus() {
  const { connected: socketConnected } = useSocket();
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    status: "checking",
  });

  // Check health endpoint periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SOCKET_SERVER_URL}/health`,
          {
            method: "GET",
            signal: AbortSignal.timeout(5000), // 5 second timeout
          },
        );

        if (response.ok) {
          const data = (await response.json()) as {
            status: string;
            timestamp: string;
          };
          setHealthStatus({
            status: "ok",
            timestamp: data.timestamp,
          });
        } else {
          setHealthStatus({
            status: "error",
            error: `HTTP ${response.status}`,
          });
        }
      } catch (error) {
        setHealthStatus({
          status: "error",
          error: error instanceof Error ? error.message : "Connection failed",
        });
      }
    };

    // Check immediately on mount
    void checkHealth();

    // Then check every 30 seconds
    const interval = setInterval(() => {
      void checkHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getHealthBadge = () => {
    switch (healthStatus.status) {
      case "ok":
        return (
          <Tooltip label="Alert service is healthy">
            <Badge
              color="green"
              variant="light"
              leftSection={<IconCircleCheck size={14} />}
            >
              Service Online
            </Badge>
          </Tooltip>
        );
      case "error":
        return (
          <Tooltip label={`Service error: ${healthStatus.error ?? "Unknown"}`}>
            <Badge
              color="red"
              variant="light"
              leftSection={<IconCircleX size={14} />}
            >
              Service Offline
            </Badge>
          </Tooltip>
        );
      case "checking":
        return (
          <Badge
            color="gray"
            variant="light"
            leftSection={<IconCircleDashed size={14} />}
          >
            Checking...
          </Badge>
        );
    }
  };

  const getSocketBadge = () => {
    if (socketConnected) {
      return (
        <Tooltip label="WebSocket connected - you'll receive real-time notifications">
          <Badge
            color="blue"
            variant="light"
            leftSection={<IconCircleCheck size={14} />}
          >
            Notifications Active
          </Badge>
        </Tooltip>
      );
    } else {
      return (
        <Tooltip label="WebSocket disconnected - notifications may be delayed">
          <Badge
            color="orange"
            variant="light"
            leftSection={<IconCircleX size={14} />}
          >
            Notifications Offline
          </Badge>
        </Tooltip>
      );
    }
  };

  return (
    <Group gap="sm" align="center">
      {getHealthBadge()}
      {getSocketBadge()}
      {healthStatus.status === "ok" && healthStatus.timestamp && (
        <Text size="xs" c="dimmed">
          Last checked: {new Date(healthStatus.timestamp).toLocaleTimeString()}
        </Text>
      )}
    </Group>
  );
}
