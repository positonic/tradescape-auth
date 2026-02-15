"use client";

import { useState } from "react";
import { LoadingOverlay, Paper, Text, Title } from "@mantine/core";
import { api } from "~/trpc/react";
import { getTodayDateString } from "~/lib/tradeUtils";
import { DateNavigator } from "./DateNavigator";
import { DailyStats } from "./DailyStats";
import { PairBreakdownGrid } from "./PairBreakdownGrid";
import { TradeTimeline } from "./TradeTimeline";
import { PositionActivity } from "./PositionActivity";

export function DailyWall() {
  const [date, setDate] = useState(getTodayDateString());

  const { data, isLoading } = api.daily.getSummary.useQuery({ date });

  const hasActivity = data && data.stats.totalOrders > 0;

  return (
    <Paper p="md" radius="sm" pos="relative">
      <LoadingOverlay visible={isLoading} />

      <Title order={2} mb="md">
        Daily Summary
      </Title>

      <DateNavigator
        date={date}
        onDateChange={setDate}
        hasPreviousDay={data?.hasPreviousDay ?? false}
        hasNextDay={data?.hasNextDay ?? false}
      />

      {data && !hasActivity && (
        <Text c="dimmed" ta="center" py="xl" size="lg">
          No trading activity on this day.
        </Text>
      )}

      {data && hasActivity && (
        <>
          <DailyStats stats={data.stats} />
          <PairBreakdownGrid pairBreakdowns={data.pairBreakdowns} />
          <TradeTimeline orders={data.timeline} />
          <PositionActivity positions={data.positions} />
        </>
      )}
    </Paper>
  );
}
