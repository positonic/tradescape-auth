import { Title, Text, Group, Badge, Card, Image, Stack, Divider, SimpleGrid, Button } from '@mantine/core';
import Link from "next/link";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";
import { IconCalendar, IconChartCandle, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { PriceEditor } from './_components/PriceEditor';
import { PrivacyToggle } from './_components/PrivacyToggle';
import { SetupContentEditor } from '~/app/_components/SetupContentEditor';
import { DeleteButton } from './_components/DeleteButton';

export default async function SetupPage({ params }: {
  params: Promise<{ slug: string }>
}) {
  const slug = (await params).slug;
  const session = await auth();

  let setup: Awaited<ReturnType<typeof api.setups.getById>> | null = null;
  if (session?.user) {
    try {
      setup = await api.setups.getById.call({}, { id: slug });
    } catch (error) {
      console.error("Failed to fetch setup:", error);
    }
  }

  const getDirectionColor = (direction: string) => {
    switch (direction.toLowerCase()) {
      case 'long':
        return 'green';
      case 'short':
        return 'red';
      default:
        return 'blue';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {!session && (
        <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
          <Title order={3} mb="md">Access Denied</Title>
          <Text mb="lg">Please sign in to view setup details.</Text>
          <Link
            href="/api/auth/signin"
            className="rounded-md bg-blue-500 px-6 py-2 font-semibold text-white no-underline shadow-sm transition hover:bg-blue-600"
          >
            Sign In
          </Link>
        </div>
      )}
      {session?.user && (
        <div className="container mx-auto py-8 px-4">
          {!setup && (
            <Card shadow="sm" p="lg" radius="md" withBorder className="text-center">
              <Title order={4}>Setup Not Found</Title>
              <Text c="dimmed">The requested setup could not be found or you may not have permission to view it.</Text>
              <Button component={Link} href="/dashboard" mt="md">
                Back to Dashboard
              </Button>
            </Card>
          )}
          {setup && (
            <Stack gap="xl">
              {/* Header Section */}
              <Card shadow="sm" p="lg" radius="md" withBorder>
                <Group justify="space-between" align="flex-start">
                  <Group>
                    {setup.coin?.imageUrl && (
                      <Image
                        src={setup.coin.imageUrl}
                        alt={setup.coin.name}
                        width={48}
                        height={48}
                      />
                    )}
                    <div>
                      <Title order={2}>{setup.coin?.name} {setup.pair.symbol}</Title>
                      <Group gap="xs">
                        <Badge
                          size="lg"
                          variant="filled"
                          color={getDirectionColor(setup.direction)}
                          leftSection={setup.direction.toLowerCase() === 'long' ? 
                            <IconArrowUp size={14} /> : 
                            <IconArrowDown size={14} />}
                        >
                          {setup.direction.toUpperCase()}
                        </Badge>
                        <Badge
                          size="lg"
                          variant="light"
                          leftSection={<IconChartCandle size={14} />}
                        >
                          {setup.timeframe?.toUpperCase() ?? 'No Timeframe'}
                        </Badge>
                        <Badge
                          size="lg"
                          variant="outline"
                          leftSection={<IconCalendar size={14} />}
                        >
                          {formatDate(setup.createdAt)}
                        </Badge>
                      </Group>
                    </div>
                  </Group>
                </Group>
              </Card>

              {/* Details Section */}
              <SimpleGrid cols={{ base: 1, md: 12 }} spacing="md">
                <div style={{ gridColumn: 'span 8' }}>
                  <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Group justify="space-between" mb="md">
                      <Title order={3}>Setup Details</Title>
                    </Group>
                    <SetupContentEditor setupId={setup.id} initialContent={setup.content ?? ''} />
                    <Divider my="md" />
                    <PriceEditor setup={setup} />
                  </Card>
                </div>

                <div style={{ gridColumn: 'span 4' }}>
                  <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Title order={3} mb="md">Status</Title>
                    <Stack gap="md">
                      <div>
                        <Badge size="xl" variant="light" color={setup.status === 'active' ? 'blue' : 'gray'}>
                          {setup.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div>
                        <Text size="sm" c="dimmed">Privacy</Text>
                        <PrivacyToggle setupId={setup.id} initialPrivacy={setup.privacy} />
                      </div>
                      {setup.video && (
                        <div>
                          <Text size="sm" c="dimmed">Source Video</Text>
                          <Link 
                            href={`/video/${setup.video.id}`}
                            className="text-blue-500 hover:text-blue-700 underline"
                          >
                            View Source Video
                          </Link>
                        </div>
                      )}
                      
                      <Divider my="sm" />
                      <DeleteButton setupId={setup.id} />
                    </Stack>
                  </Card>
                </div>
              </SimpleGrid>
            </Stack>
          )}
        </div>
      )}
    </div>
  );
}
