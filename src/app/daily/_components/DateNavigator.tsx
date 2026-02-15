"use client";

import { ActionIcon, Button, Group, Text } from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { formatDateLong, getTodayDateString } from "~/lib/tradeUtils";

interface DateNavigatorProps {
  date: string;
  onDateChange: (date: string) => void;
  hasPreviousDay: boolean;
  hasNextDay: boolean;
}

function shiftDate(dateString: string, days: number): string {
  const parts = dateString.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + days);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateNavigator({
  date,
  onDateChange,
  hasPreviousDay,
  hasNextDay,
}: DateNavigatorProps) {
  const isToday = date === getTodayDateString();

  return (
    <Group justify="space-between" align="center" mb="lg">
      <Group gap="sm">
        <ActionIcon
          variant="subtle"
          size="lg"
          onClick={() => onDateChange(shiftDate(date, -1))}
          disabled={!hasPreviousDay}
        >
          <IconChevronLeft size={20} />
        </ActionIcon>

        <Text size="xl" fw={600}>
          {formatDateLong(date)}
        </Text>

        <ActionIcon
          variant="subtle"
          size="lg"
          onClick={() => onDateChange(shiftDate(date, 1))}
          disabled={isToday || !hasNextDay}
        >
          <IconChevronRight size={20} />
        </ActionIcon>
      </Group>

      <Group gap="sm">
        {!isToday && (
          <Button
            variant="subtle"
            size="sm"
            onClick={() => onDateChange(getTodayDateString())}
          >
            Today
          </Button>
        )}
        <input
          type="date"
          value={date}
          max={getTodayDateString()}
          onChange={(e) => {
            if (e.target.value) {
              onDateChange(e.target.value);
            }
          }}
          style={{
            background: "transparent",
            border: "1px solid var(--mantine-color-dark-4)",
            borderRadius: "4px",
            padding: "4px 8px",
            color: "inherit",
            cursor: "pointer",
          }}
        />
      </Group>
    </Group>
  );
}
