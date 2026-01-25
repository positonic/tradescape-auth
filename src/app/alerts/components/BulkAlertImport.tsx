"use client";

import * as React from "react";
import {
  Button,
  Textarea,
  Stack,
  Group,
  Table,
  Select,
  TextInput,
  Badge,
  ActionIcon,
  Text,
  Alert,
  LoadingOverlay,
  Paper,
  Box,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconUpload,
  IconTrash,
  IconCheck,
  IconX,
  IconAlertCircle,
} from "@tabler/icons-react";
import { api } from "~/trpc/react";
import { AlertType, Direction } from "@prisma/client";
import type { ParsedAlert } from "~/types/alertImport";

const intervalOptions = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1d" },
  { value: "1w", label: "1w" },
];

interface BulkAlertImportProps {
  onSuccess?: () => void;
}

export function BulkAlertImport({ onSuccess }: BulkAlertImportProps) {
  const [inputText, setInputText] = React.useState("");
  const [parsedAlerts, setParsedAlerts] = React.useState<ParsedAlert[]>([]);
  const [unparseable, setUnparseable] = React.useState<string[]>([]);

  const utils = api.useUtils();

  const parseAlertsMutation = api.alerts.parseAlerts.useMutation({
    onSuccess: (data) => {
      setParsedAlerts(data.alerts);
      setUnparseable(data.unparseable);
      if (data.alerts.length === 0) {
        notifications.show({
          title: "No Alerts Found",
          message: "Could not extract any alerts from the provided text.",
          color: "yellow",
          icon: <IconAlertCircle size="1rem" />,
        });
      } else {
        notifications.show({
          title: "Parsing Complete",
          message: `Found ${data.alerts.length} alert(s). Review and create below.`,
          color: "blue",
          icon: <IconCheck size="1rem" />,
        });
      }
    },
    onError: (error) => {
      notifications.show({
        title: "Parsing Failed",
        message: error.message,
        color: "red",
        icon: <IconX size="1rem" />,
      });
    },
  });

  const bulkCreateMutation = api.alerts.bulkCreate.useMutation({
    onSuccess: (result) => {
      void utils.alerts.getAllForUser.invalidate();
      notifications.show({
        title: "Alerts Created",
        message: `Successfully created ${result.created} alert(s).${result.failed > 0 ? ` ${result.failed} failed.` : ""}`,
        color: result.failed > 0 ? "yellow" : "green",
        icon: <IconCheck size="1rem" />,
      });
      if (result.created > 0) {
        setParsedAlerts([]);
        setInputText("");
        onSuccess?.();
      }
    },
    onError: (error) => {
      notifications.show({
        title: "Creation Failed",
        message: error.message,
        color: "red",
        icon: <IconX size="1rem" />,
      });
    },
  });

  const { data: pairsData } = api.pairs.getAll.useQuery();

  const pairOptions = React.useMemo(
    () =>
      pairsData?.map((pair) => ({
        value: pair.id.toString(),
        label: pair.symbol,
      })) ?? [],
    [pairsData]
  );

  const handleParse = () => {
    if (!inputText.trim()) {
      notifications.show({
        title: "Empty Input",
        message: "Please paste some alert text first.",
        color: "orange",
      });
      return;
    }
    parseAlertsMutation.mutate({ text: inputText });
  };

  const handleUpdateAlert = (id: string, updates: Partial<ParsedAlert>) => {
    setParsedAlerts((prev) =>
      prev.map((alert) => {
        if (alert.id !== id) return alert;

        const updated = { ...alert, ...updates };

        // Update pairSymbol if pairId changed
        if (updates.pairId !== undefined) {
          const pair = pairsData?.find((p) => p.id === updates.pairId);
          updated.pairSymbol = pair?.symbol;
          updated.validationError = updates.pairId
            ? undefined
            : "No matching pair found";
        }

        // Revalidate
        updated.isValid =
          updated.pairId !== null &&
          !isNaN(parseFloat(updated.threshold)) &&
          parseFloat(updated.threshold) > 0;

        return updated;
      })
    );
  };

  const handleRemoveAlert = (id: string) => {
    setParsedAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  const handleCreateAll = () => {
    const validAlerts = parsedAlerts.filter(
      (a) => a.isValid && a.pairId !== null
    );

    if (validAlerts.length === 0) {
      notifications.show({
        title: "No Valid Alerts",
        message: "Please fix invalid alerts before creating.",
        color: "orange",
      });
      return;
    }

    bulkCreateMutation.mutate({
      alerts: validAlerts.map((a) => ({
        pairId: a.pairId!,
        type: a.type as AlertType,
        threshold: a.threshold,
        direction: a.direction as Direction,
        interval: a.interval,
      })),
    });
  };

  const validCount = parsedAlerts.filter((a) => a.isValid).length;
  const invalidCount = parsedAlerts.length - validCount;

  return (
    <Stack gap="lg">
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Textarea
            label="Paste Alert Text"
            placeholder={`Paste your trading alert checklist here...

Example:
- BTC 4H close ABOVE 100k - Confirms resistance reclaim
- BTC 4H close BELOW 94.2k - Invalidates higher low
- ETHBTC daily close above 0.0351 - Confirms breakout
- BNB price touches ~918 - Ideal long entry zone`}
            minRows={8}
            maxRows={15}
            autosize
            value={inputText}
            onChange={(e) => setInputText(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={handleParse}
              loading={parseAlertsMutation.isPending}
            >
              Parse Alerts
            </Button>
          </Group>
        </Stack>
      </Paper>

      {unparseable.length > 0 && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Some content could not be parsed"
          color="yellow"
        >
          <Text size="sm">{unparseable.join(", ")}</Text>
        </Alert>
      )}

      {parsedAlerts.length > 0 && (
        <Paper p="md" withBorder>
          <Box pos="relative">
            <LoadingOverlay
              visible={bulkCreateMutation.isPending}
              overlayProps={{ radius: "sm", blur: 2 }}
            />

            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={500}>
                  Parsed Alerts ({parsedAlerts.length})
                  {invalidCount > 0 && (
                    <Text component="span" c="red" ml="xs">
                      ({invalidCount} need attention)
                    </Text>
                  )}
                </Text>
                <Button
                  leftSection={<IconCheck size={16} />}
                  onClick={handleCreateAll}
                  disabled={validCount === 0}
                >
                  Create {validCount} Alert{validCount !== 1 ? "s" : ""}
                </Button>
              </Group>

              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Pair</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Direction</Table.Th>
                    <Table.Th>Threshold</Table.Th>
                    <Table.Th>Interval</Table.Th>
                    <Table.Th>Notes</Table.Th>
                    <Table.Th w={50}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {parsedAlerts.map((alert) => (
                    <Table.Tr
                      key={alert.id}
                      style={{
                        backgroundColor: alert.isValid
                          ? undefined
                          : "var(--mantine-color-red-light)",
                      }}
                    >
                      <Table.Td>
                        <Select
                          size="xs"
                          placeholder="Select pair"
                          data={pairOptions}
                          value={alert.pairId?.toString() ?? null}
                          onChange={(value) =>
                            handleUpdateAlert(alert.id, {
                              pairId: value ? parseInt(value, 10) : null,
                            })
                          }
                          searchable
                          error={!alert.pairId}
                          styles={{
                            input: {
                              minWidth: 140,
                              borderColor: alert.pairId
                                ? undefined
                                : "var(--mantine-color-red-6)",
                            },
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          data={[
                            { value: "PRICE", label: "PRICE" },
                            { value: "CANDLE", label: "CANDLE" },
                          ]}
                          value={alert.type}
                          onChange={(value) =>
                            handleUpdateAlert(alert.id, {
                              type: value as "PRICE" | "CANDLE",
                              interval:
                                value === "PRICE" ? null : alert.interval,
                            })
                          }
                          styles={{ input: { minWidth: 90 } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={alert.direction === "ABOVE" ? "green" : "red"}
                          variant="light"
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            handleUpdateAlert(alert.id, {
                              direction:
                                alert.direction === "ABOVE" ? "BELOW" : "ABOVE",
                            })
                          }
                        >
                          {alert.direction}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={alert.threshold}
                          onChange={(e) =>
                            handleUpdateAlert(alert.id, {
                              threshold: e.currentTarget.value,
                            })
                          }
                          error={
                            isNaN(parseFloat(alert.threshold)) ||
                            parseFloat(alert.threshold) <= 0
                          }
                          styles={{ input: { width: 100 } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        {alert.type === "CANDLE" ? (
                          <Select
                            size="xs"
                            placeholder="Interval"
                            data={intervalOptions}
                            value={alert.interval}
                            onChange={(value) =>
                              handleUpdateAlert(alert.id, { interval: value })
                            }
                            styles={{ input: { minWidth: 70 } }}
                          />
                        ) : (
                          <Text size="xs" c="dimmed">
                            -
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" lineClamp={1} maw={200} title={alert.notes}>
                          {alert.notes || alert.originalText}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => handleRemoveAlert(alert.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Box>
        </Paper>
      )}
    </Stack>
  );
}
