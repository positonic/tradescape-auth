import { auth } from "~/server/auth";
import { LandingPage } from "~/app/_components/LandingPage";
import HavenMemberBadge from "../videos/components/HavenMemberBadge";
import { Title, Paper, Text, Stack, Group, Badge } from '@mantine/core';

export default async function DocsPage() {
  const session = await auth();

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        {!session && <LandingPage />}
        {session?.user && (
          <div className="w-full">
            <HavenMemberBadge />
            <Paper p="md" radius="sm">
              <Title order={1} mb="lg">What&apos;s the difference between Quick Sync and Full Sync?</Title>
              
              <Stack gap="xl">
                <div>
                  <Group gap="md" mb="md">
                    <Badge color="yellow" size="lg">⚡</Badge>
                    <Title order={2}>Quick Sync (Incremental)</Title>
                  </Group>
                  
                  <Stack gap="sm" mb="md">
                    <Text><strong>Fast:</strong> Uses existing known pairs from database</Text>
                    <Text><strong>Smart:</strong> Only rediscovers pairs if you have fewer than 5 pairs</Text>
                    <Text><strong>Efficient:</strong> Syncs trades from known pairs instantly</Text>
                    <Text><strong>Use case:</strong> Daily/frequent syncing after initial setup</Text>
                  </Stack>
                  
                  <div>
                    <Text fw={600} mb="sm">What it does:</Text>
                    <Stack gap="xs">
                      <Text>📋 Using existing pairs (use Full Sync to rediscover)</Text>
                      <Text>📈 Fetching recent trades for known pairs...</Text>
                      <Text>⚡ QUICK SYNC SUCCESS</Text>
                      <Text>💡 Used existing pairs - use Full Sync to rediscover all pairs</Text>
                    </Stack>
                  </div>
                </div>

                <div>
                  <Group gap="md" mb="md">
                    <Badge color="blue" size="lg">🔄</Badge>
                    <Title order={2}>Full Sync (Complete)</Title>
                  </Group>
                  
                  <Stack gap="sm">
                    <Text><strong>Comprehensive:</strong> Always rediscovers ALL trading pairs</Text>
                    <Text><strong>Thorough:</strong> Checks every symbol on every exchange</Text>
                    <Text><strong>Complete:</strong> Finds new pairs you might have started trading</Text>
                    <Text><strong>Use case:</strong> First-time setup or when you&apos;ve added new trading pairs</Text>
                  </Stack>
                </div>
              </Stack>
            </Paper>
          </div>
        )}
      </div>
    </div>
  );
}