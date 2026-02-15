"use client";

import {
  Title,
  Text,
  Stack,
  Paper,
  Avatar,
  Group,
  Badge,
} from "@mantine/core";
import { IconBrandDiscord } from "@tabler/icons-react";
import { useSession } from "next-auth/react";

export default function ProfilePage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <Text>Loading...</Text>;
  }

  if (!session?.user) {
    return (
      <Stack gap="lg">
        <Title order={2} size="h3">
          Profile
        </Title>
        <Text c="dimmed">Sign in to view your profile.</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={2} size="h3">
          Profile
        </Title>
        <Text c="dimmed" size="sm">
          Your account information
        </Text>
      </div>

      <Paper withBorder p="lg">
        <Group gap="lg">
          <Avatar src={session.user.image} size={80} radius="xl" />
          <Stack gap={4}>
            <Text size="xl" fw={600}>
              {session.user.name}
            </Text>
            {session.user.email && (
              <Text size="sm" c="dimmed">
                {session.user.email}
              </Text>
            )}
            <Badge
              leftSection={<IconBrandDiscord size={14} />}
              variant="light"
              color="indigo"
              size="sm"
            >
              Discord Connected
            </Badge>
          </Stack>
        </Group>
      </Paper>
    </Stack>
  );
}
