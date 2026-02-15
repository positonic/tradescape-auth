"use client";

import { useMemo, useState } from "react";
import { Container, Text, Card, Button, Title } from "@mantine/core";
import Link from "next/link";
import { api } from "~/trpc/react";
import { getTodayDateString } from "~/lib/tradeUtils";
import { DashboardStatCards } from "~/app/_components/DashboardStatCards";
import { PortfolioChart } from "~/app/_components/PortfolioChart";
import { AssetAllocationChart } from "~/app/_components/AssetAllocationChart";
import { RecentOrders } from "~/app/_components/RecentOrders";
import { ActiveSetups } from "~/app/_components/ActiveSetups";

interface DashboardProps {
  userName: string;
}

function getChartStartDate(period: string): Date | undefined {
  const now = new Date();
  switch (period) {
    case "1M":
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case "3M":
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case "6M":
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case "1Y":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case "All":
      return undefined;
    default:
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  }
}

export function Dashboard({ userName }: DashboardProps) {
  const [chartPeriod, setChartPeriod] = useState("1Y");
  const todayDate = useMemo(() => getTodayDateString(), []);

  const chartStartDate = useMemo(
    () => getChartStartDate(chartPeriod),
    [chartPeriod],
  );

  // Data queries
  const { data: dashboardStats, isLoading: statsLoading } =
    api.portfolioSnapshot.getDashboardStats.useQuery();

  const { data: dailyData, isLoading: dailyLoading } =
    api.daily.getSummary.useQuery({ date: todayDate });

  const { data: snapshotHistory, isLoading: chartLoading } =
    api.portfolioSnapshot.list.useQuery({
      startDate: chartStartDate,
      endDate: new Date(),
      limit: 100,
      offset: 0,
    });

  const { data: positionsData, isLoading: positionsLoading } =
    api.trades.getPositions.useQuery({
      limit: 100,
      offset: 0,
      statusFilter: "open",
    });

  const { data: ordersData, isLoading: ordersLoading } =
    api.trades.getOrders.useQuery({ limit: 5, offset: 0 });

  const { data: setupsData, isLoading: setupsLoading } =
    api.setups.getPrivate.useQuery();

  // Transform snapshot history for chart
  const chartData = useMemo(() => {
    if (!snapshotHistory?.snapshots) return [];
    return [...snapshotHistory.snapshots]
      .reverse()
      .map((s) => ({
        date: new Date(s.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: s.totalUsdValue,
      }));
  }, [snapshotHistory]);

  // Latest snapshot timestamp for "last updated"
  const lastUpdated = dashboardStats?.currentTimestamp
    ? new Date(dashboardStats.currentTimestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const dailyStats = dailyData?.stats ?? null;
  const hasAnyData =
    dashboardStats?.hasData ??
    (ordersData?.orders?.length ?? 0) > 0;

  return (
    <Container size="xl" className="py-6">
      {/* Welcome Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Title order={2} fw={700}>
            Welcome back, {userName}
          </Title>
          <Text size="sm" c="dimmed">
            Here&apos;s your portfolio performance overview
          </Text>
        </div>
        {lastUpdated && (
          <Text size="sm" c="dimmed">
            Last updated: {lastUpdated}
          </Text>
        )}
      </div>

      {/* New user onboarding */}
      {!statsLoading &&
        !dailyLoading &&
        !ordersLoading &&
        !hasAnyData && (
          <Card withBorder radius="md" p="xl" className="mb-6 text-center">
            <Title order={3} mb="md">
              Welcome to Tradescape
            </Title>
            <Text c="dimmed" mb="lg">
              Get started by connecting your exchange on the Live page to begin
              tracking your portfolio.
            </Text>
            <Button component={Link} href="/live">
              Go to Live Dashboard
            </Button>
          </Card>
        )}

      {/* Stat Cards */}
      <DashboardStatCards
        dashboardStats={dashboardStats ?? null}
        dailyStats={dailyStats}
        isLoading={statsLoading || dailyLoading}
      />

      {/* Portfolio Performance + Asset Allocation */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PortfolioChart
            data={chartData}
            isLoading={chartLoading}
            activePeriod={chartPeriod}
            onPeriodChange={setChartPeriod}
          />
        </div>
        <div className="lg:col-span-2">
          <AssetAllocationChart
            positions={positionsData?.positions}
            isLoading={positionsLoading}
          />
        </div>
      </div>

      {/* Recent Orders + Active Setups */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RecentOrders
            orders={ordersData?.orders}
            isLoading={ordersLoading}
          />
        </div>
        <div className="lg:col-span-2">
          <ActiveSetups
            setups={setupsData}
            isLoading={setupsLoading}
          />
        </div>
      </div>
    </Container>
  );
}
