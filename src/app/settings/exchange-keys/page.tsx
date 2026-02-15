"use client";

import { Title, Text, Stack } from "@mantine/core";
import KeyManager from "~/app/_components/KeyManager";

export default function ExchangeKeysPage() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={2} size="h3">
          Exchange Keys
        </Title>
        <Text c="dimmed" size="sm">
          Manage your exchange API credentials for live trading data and trade
          synchronization
        </Text>
      </div>
      <KeyManager />
    </Stack>
  );
}
