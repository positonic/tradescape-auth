import { auth } from "~/server/auth";
import {
  Title,
  Text,
  Container,
  Stack,
  Group,
  Card,
  RingProgress,
  Progress,
  Badge,
} from "@mantine/core";
import "@mantine/core/styles.css";
import SignInButton from "~/app/_components/SignInButton";
import { LifetimePNLChart } from "~/app/_components/LifetimePNLChart";

// Hardcoded trading data
const tradingData = {
  portfolioValue: 21849.0,
  winRate: 63,
  wins: 707,
  losses: 424,
  breakeven: 0,
  totalTrades: 1131,
  totalVolume: 128.90,
  avgVolumePerTrade: 113965,
  longRatio: 48,
  shortRatio: 52,
};

function TradingDashboard() {
  return (
    <Container size="xl" className="">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Portfolio Value Card */}
        <Card className="bg-gray-800 border-gray-700">
          <Text size="sm" c="dimmed" className="mb-2">
            Portfolio Value
          </Text>
          <Title order={2} className="text-2xl font-bold text-white mb-2">
            ${tradingData.portfolioValue.toLocaleString()}
          </Title>
          <Text size="xs" c="dimmed">
            The total value of all assets in your accounts
          </Text>
        </Card>

        {/* Win Rate Card */}
        <Card className="bg-gray-800 border-gray-700">
          <Text size="sm" c="dimmed" className="mb-4">
            Total Win Rate
          </Text>
          <div className="flex items-center gap-4">
            <RingProgress
              size={80}
              thickness={8}
              sections={[
                { value: tradingData.winRate, color: 'teal' },
                { value: 100 - tradingData.winRate, color: 'red' }
              ]}
              label={
                <Text ta="center" size="lg" fw={700} c="white">
                  {tradingData.winRate}%
                </Text>
              }
            />
            <div className="flex flex-col gap-1">
              <Text size="sm" c="teal" fw={600}>
                {tradingData.wins} Wins
              </Text>
              <Text size="sm" c="red" fw={600}>
                {tradingData.losses} Losses
              </Text>
              <Text size="sm" c="dimmed">
                {tradingData.breakeven} Breakeven
              </Text>
            </div>
          </div>
          <Text size="xs" c="teal" className="mt-2 cursor-pointer hover:underline">
            Set Breakeven filter ↗
          </Text>
        </Card>

        {/* Total Trade Count Card */}
        <Card className="bg-gray-800 border-gray-700">
          <Text size="sm" c="dimmed" className="mb-2">
            Total Trade Count
          </Text>
          <Title order={2} className="text-2xl font-bold text-white mb-2">
            {tradingData.totalTrades.toLocaleString()}
          </Title>
          <Text size="xs" c="dimmed">
            Total volume of ${tradingData.totalVolume}m with an average of ${tradingData.avgVolumePerTrade.toLocaleString()} volume per trade
          </Text>
        </Card>

        {/* Long/Short Ratio Card */}
        <Card className="bg-gray-800 border-gray-700">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <Text size="sm" c="dimmed">Long Ratio</Text>
              <Text size="sm" c="teal" fw={600}>{tradingData.longRatio}%</Text>
            </div>
            <div className="flex justify-between items-center">
              <Text size="sm" c="dimmed">Short Ratio</Text>
              <Text size="sm" c="red" fw={600}>{tradingData.shortRatio}%</Text>
            </div>
          </div>
          <Progress
            size="md"
            value={tradingData.longRatio}
            color="teal"
            className="mb-2"
          />
          <Progress
            size="md"
            value={tradingData.shortRatio}
            color="red"
          />
        </Card>
      </div>
      <br/>
      {/* Lifetime PNL Chart */}
      <LifetimePNLChart />
    </Container>
  );
}

export async function LandingPage() {
  const session = await auth();
  return (
    <Container size="xl" className="py-16">
      {/* Hero Section */}
      <Stack align="center" className="mb-16 text-center">
        
        <Group gap="md" justify="center" wrap="wrap">
          {!session?.user ? <SignInButton /> : <></>}
        </Group>
      </Stack>

      {/* Trading Dashboard */}
      {session?.user && <TradingDashboard />}
    </Container>
  );
}
