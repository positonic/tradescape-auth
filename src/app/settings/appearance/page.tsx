"use client";

import {
  Title,
  Text,
  Stack,
  Paper,
  SegmentedControl,
  Group,
  useMantineColorScheme,
} from "@mantine/core";
import { IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react";

export default function AppearancePage() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <Stack gap="lg">
      <div>
        <Title order={2} size="h3">
          Appearance
        </Title>
        <Text c="dimmed" size="sm">
          Customize the look and feel of the application
        </Text>
      </div>

      <Paper withBorder p="lg">
        <Stack gap="md">
          <div>
            <Text fw={500} mb={4}>
              Color Scheme
            </Text>
            <Text size="sm" c="dimmed" mb="sm">
              Choose between light, dark, or system-based theme
            </Text>
          </div>
          <SegmentedControl
            value={colorScheme}
            onChange={(value) =>
              setColorScheme(value as "light" | "dark" | "auto")
            }
            data={[
              {
                value: "light",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconSun size={16} />
                    <span>Light</span>
                  </Group>
                ),
              },
              {
                value: "dark",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconMoon size={16} />
                    <span>Dark</span>
                  </Group>
                ),
              },
              {
                value: "auto",
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconDeviceDesktop size={16} />
                    <span>System</span>
                  </Group>
                ),
              },
            ]}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
