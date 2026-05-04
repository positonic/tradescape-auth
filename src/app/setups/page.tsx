"use client";

import { useMemo, useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import {
  Paper,
  Title,
  Table,
  Badge,
  Text,
  Skeleton,
  Tabs,
  Group,
  Button,
  SegmentedControl,
  Checkbox,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { SetupDrawer } from "~/components/SetupDrawer";

type SetupListItem = RouterOutputs["setups"]["getPrivate"][number];
type StatusFilter = "all" | "active" | "inactive";

function SetupsTable({
  setups,
  canBulkEdit = false,
}: {
  setups: SetupListItem[] | undefined;
  canBulkEdit?: boolean;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastIndex, setLastIndex] = useState<number | null>(null);

  const setActiveStatus = api.setups.setActiveStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.setups.getPrivate.invalidate(),
        utils.setups.getPublic.invalidate(),
      ]);
      setSelectedIds(new Set());
      setLastIndex(null);
    },
  });

  const visibleSetups = useMemo(() => {
    if (!setups) return [];
    if (statusFilter === "all") return setups;
    return setups.filter((s) => s.status === statusFilter);
  }, [setups, statusFilter]);

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
    setLastIndex(null);
  };

  const handleToggle = (
    id: string,
    idx: number,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const shift = (event.nativeEvent as MouseEvent).shiftKey;
    const nextChecked = event.currentTarget.checked;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shift && lastIndex !== null && lastIndex !== idx) {
        const [start, end] =
          lastIndex < idx ? [lastIndex, idx] : [idx, lastIndex];
        for (let i = start; i <= end; i++) {
          const setupId = visibleSetups[i]?.id;
          if (!setupId) continue;
          if (nextChecked) next.add(setupId);
          else next.delete(setupId);
        }
      } else if (nextChecked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    setLastIndex(idx);
  };

  const allVisibleSelected =
    visibleSetups.length > 0 &&
    visibleSetups.every((s) => selectedIds.has(s.id));
  const someVisibleSelected =
    !allVisibleSelected && visibleSetups.some((s) => selectedIds.has(s.id));

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const s of visibleSetups) next.delete(s.id);
      } else {
        for (const s of visibleSetups) next.add(s.id);
      }
      return next;
    });
    setLastIndex(null);
  };

  const applyStatus = (status: "active" | "inactive") => {
    if (selectedIds.size === 0) return;
    setActiveStatus.mutate({ ids: Array.from(selectedIds), status });
  };

  const colSpan = bulkMode ? 9 : 8;

  return (
    <>
      <Group justify="space-between" mb="sm">
        <SegmentedControl
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          data={[
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
            { label: "All", value: "all" },
          ]}
        />
        {canBulkEdit && (
          <Group gap="xs">
            {bulkMode && selectedIds.size > 0 && (
              <>
                <Text size="sm" c="dimmed">
                  {selectedIds.size} selected
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  color="gray"
                  loading={setActiveStatus.isPending}
                  onClick={() => applyStatus("inactive")}
                >
                  Mark Inactive
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  loading={setActiveStatus.isPending}
                  onClick={() => applyStatus("active")}
                >
                  Mark Active
                </Button>
              </>
            )}
            <Button
              size="xs"
              variant={bulkMode ? "filled" : "default"}
              onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
            >
              {bulkMode ? "Done" : "Bulk Edit"}
            </Button>
          </Group>
        )}
      </Group>

      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {bulkMode && (
              <Table.Th style={{ width: 40 }}>
                <Checkbox
                  aria-label="Select all visible"
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected}
                  onChange={toggleAllVisible}
                />
              </Table.Th>
            )}
            <Table.Th>Pair</Table.Th>
            <Table.Th>Direction</Table.Th>
            <Table.Th>Entry</Table.Th>
            <Table.Th>Take Profit</Table.Th>
            <Table.Th>Stop Loss</Table.Th>
            <Table.Th>Timeframe</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Created</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {visibleSetups.map((setup, idx) => {
            const checked = selectedIds.has(setup.id);
            return (
              <Table.Tr
                key={setup.id}
                style={{ cursor: bulkMode ? "default" : "pointer" }}
                onMouseEnter={() => {
                  if (bulkMode) return;
                  void utils.setups.getById.prefetch(
                    { id: setup.id },
                    { staleTime: 60_000 },
                  );
                }}
                onClick={() => {
                  if (bulkMode) return;
                  router.push(`/setup/${setup.id}`);
                }}
              >
                {bulkMode && (
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select setup ${setup.id}`}
                      checked={checked}
                      onChange={(e) => handleToggle(setup.id, idx, e)}
                    />
                  </Table.Td>
                )}
                <Table.Td>{setup.pair.symbol}</Table.Td>
                <Table.Td>
                  <span
                    className={
                      setup.direction.toLowerCase() === "long"
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  >
                    {setup.direction}
                  </span>
                </Table.Td>
                <Table.Td>
                  {setup.entryPrice?.toString() ?? "Not specified"}
                </Table.Td>
                <Table.Td>
                  {setup.takeProfitPrice?.toString() ?? "Not specified"}
                </Table.Td>
                <Table.Td>{setup.stopPrice?.toString() ?? "-"}</Table.Td>
                <Table.Td>{setup.timeframe ?? "Not specified"}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Badge color={setup.status === "active" ? "blue" : "gray"}>
                      {setup.status}
                    </Badge>
                    <Badge
                      color={setup.privacy === "public" ? "green" : "yellow"}
                    >
                      {setup.privacy}
                    </Badge>
                  </Group>
                </Table.Td>
                <Table.Td>
                  {new Date(setup.createdAt).toLocaleDateString()}
                </Table.Td>
              </Table.Tr>
            );
          })}
          {!visibleSetups.length && (
            <Table.Tr>
              <Table.Td colSpan={colSpan}>
                <Text ta="center" c="dimmed">
                  No setups found
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </>
  );
}

export default function SetupsPage() {
  const [drawerOpened, setDrawerOpened] = useState(false);
  const { data: publicSetups, isLoading: publicLoading } =
    api.setups.getPublic.useQuery();
  const { data: privateSetups, isLoading: privateLoading } =
    api.setups.getPrivate.useQuery();

  if (publicLoading || privateLoading) {
    return <Skeleton height={400} />;
  }

  return (
    <>
      <Paper p="md" radius="sm">
        <Group justify="space-between" mb="lg">
          <Title order={2}>Trade Setups</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setDrawerOpened(true)}
          >
            Create Setup
          </Button>
        </Group>
        <Tabs defaultValue="private">
          <Tabs.List>
            <Tabs.Tab value="private">My Setups</Tabs.Tab>
            <Tabs.Tab value="public">Public Setups</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="private" pt="md">
            <SetupsTable setups={privateSetups} canBulkEdit />
          </Tabs.Panel>
          <Tabs.Panel value="public" pt="md">
            <SetupsTable setups={publicSetups} />
          </Tabs.Panel>
        </Tabs>
      </Paper>

      <SetupDrawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
      />
    </>
  );
}
