import { auth } from "~/server/auth";
import { Title, Text, Container, Card, Badge } from "@mantine/core";
import { DonutChart } from "@mantine/charts";
import "@mantine/core/styles.css";
import "@mantine/charts/styles.css";
import SignInButton from "~/app/_components/SignInButton";
import { PortfolioChart } from "~/app/_components/PortfolioChart";
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconArrowDownLeft,
} from "@tabler/icons-react";

const statCards = [
  {
    label: "Total Portfolio Value",
    value: "$2,847,392.18",
    change: "+12.4%",
    subtitle: "vs. last month",
    positive: true,
  },
  {
    label: "Total Gain/Loss",
    value: "+$342,891.32",
    change: "+13.7%",
    subtitle: "all time",
    positive: true,
  },
  {
    label: "Cash Balance",
    value: "$184,293.00",
    change: "-2.1%",
    subtitle: "vs. last month",
    positive: false,
  },
  {
    label: "Monthly Returns",
    value: "+8.9%",
    change: "+2.3%",
    subtitle: "vs. average",
    positive: true,
  },
];

const allocationData = [
  { name: "Equities", value: 45, color: "gray.7" },
  { name: "Fixed Income", value: 25, color: "gray.5" },
  { name: "Real Estate", value: 15, color: "gray.4" },
  { name: "Commodities", value: 10, color: "gray.3" },
  { name: "Cash", value: 5, color: "gray.2" },
];

const transactions = [
  {
    company: "Apple Inc.",
    ticker: "AAPL",
    shares: 150,
    price: 178.42,
    total: 26763.0,
    date: "Dec 8, 2024",
    type: "buy" as const,
  },
  {
    company: "Microsoft Corp.",
    ticker: "MSFT",
    shares: 75,
    price: 374.58,
    total: 28093.5,
    date: "Dec 7, 2024",
    type: "sell" as const,
  },
];

function Dashboard() {
  return (
    <Container size="xl" className="py-6">
      {/* Welcome Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Title order={2} fw={700}>
            Welcome back, Michael
          </Title>
          <Text size="sm" c="dimmed">
            Here&apos;s your portfolio performance overview
          </Text>
        </div>
        <Text size="sm" c="dimmed">
          Last updated: Today, 2:45 PM
        </Text>
      </div>

      {/* Stat Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} withBorder radius="md" p="lg">
            <Text size="sm" c="dimmed" mb={8}>
              {card.label}
            </Text>
            <Title order={3} fw={700} mb={4}>
              {card.value}
            </Title>
            <div className="flex items-center gap-1">
              {card.positive ? (
                <IconArrowUpRight size={16} className="text-green-600" />
              ) : (
                <IconArrowDownRight size={16} className="text-red-500" />
              )}
              <Text
                size="sm"
                fw={500}
                c={card.positive ? "green" : "red"}
                span
              >
                {card.change}
              </Text>
              <Text size="sm" c="dimmed" span>
                {card.subtitle}
              </Text>
            </div>
          </Card>
        ))}
      </div>

      {/* Portfolio Performance + Asset Allocation */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PortfolioChart />
        </div>
        <div className="lg:col-span-2">
          <Card withBorder radius="md" p="lg" className="h-full">
            <Title order={4} fw={600} mb={4}>
              Asset Allocation
            </Title>
            <Text size="sm" c="dimmed" mb="lg">
              Current portfolio distribution
            </Text>
            <div className="flex justify-center">
              <DonutChart
                data={allocationData}
                size={180}
                thickness={28}
                paddingAngle={2}
                tooltipDataSource="segment"
                chartLabel=""
              />
            </div>
            <div className="mt-6 space-y-3">
              {allocationData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <Text size="sm">{item.name}</Text>
                  <Text size="sm" fw={600}>
                    {item.value}%
                  </Text>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Transactions + Investment Opportunities */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card withBorder radius="md" p="lg">
            <Title order={4} fw={600} mb={4}>
              Recent Transactions
            </Title>
            <Text size="sm" c="dimmed" mb="lg">
              Your latest trading activity
            </Text>
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.ticker}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        tx.type === "buy"
                          ? "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400"
                          : "bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400"
                      }`}
                    >
                      {tx.type === "buy" ? (
                        <IconArrowDownLeft size={20} />
                      ) : (
                        <IconArrowUpRight size={20} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Text size="sm" fw={600}>
                          {tx.company}
                        </Text>
                        <Badge
                          variant="outline"
                          color="gray"
                          size="xs"
                          radius="sm"
                        >
                          {tx.ticker}
                        </Badge>
                      </div>
                      <Text size="xs" c="dimmed">
                        {tx.shares} shares @ ${tx.price.toFixed(2)}
                      </Text>
                    </div>
                  </div>
                  <div className="text-right">
                    <Text size="sm" fw={600}>
                      ${tx.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {tx.date}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card withBorder radius="md" p="lg" className="h-full">
            <Title order={4} fw={600} mb={4}>
              Investment Opportunities
            </Title>
            <Text size="sm" c="dimmed" mb="lg">
              Curated picks for you
            </Text>
            <div className="rounded-lg border border-gray-200 dark:border-[var(--mantine-color-dark-4)] p-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <Text size="sm" fw={600}>
                    Tech Growth Fund
                  </Text>
                  <Text size="xs" c="dimmed">
                    Mutual Fund
                  </Text>
                </div>
                <Badge color="green" variant="light" size="sm">
                  +24.8%
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Text size="xs" c="dimmed">
                  Risk: Moderate
                </Text>
                <Text size="xs" c="dimmed">
                  Min: $10,000
                </Text>
              </div>
              <button className="mt-4 w-full rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-[var(--mantine-color-dark-4)] dark:text-gray-300 dark:hover:bg-[var(--mantine-color-dark-5)]">
                Learn More
              </button>
            </div>
          </Card>
        </div>
      </div>
    </Container>
  );
}

export async function LandingPage() {
  const session = await auth();
  return (
    <>
      {!session?.user ? (
        <Container size="xl" className="py-16">
          <div className="flex justify-center">
            <SignInButton />
          </div>
        </Container>
      ) : (
        <Dashboard />
      )}
    </>
  );
}
