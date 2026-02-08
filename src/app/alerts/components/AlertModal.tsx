"use client";

import * as React from 'react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { Modal, Button, Select, TextInput, Group, Stack, LoadingOverlay } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { api } from '~/trpc/react';
import { AlertType, Direction } from '@prisma/client'; // Import enums

interface AlertFormValues {
  pairId: string | null; // Store as string for Select compatibility
  type: AlertType | null;
  direction: Direction | null;
  threshold: string;
  interval: string | null;
}

interface AlertModalProps {
  opened: boolean;
  onClose: () => void;
}

const alertTypeOptions = Object.values(AlertType).map(val => ({ value: val, label: val }));
const directionOptions = Object.values(Direction).map(val => ({ value: val, label: val }));
// Define common intervals or fetch from a source if needed
const intervalOptions = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
];

export function AlertModal({ opened, onClose }: AlertModalProps) {
  const utils = api.useUtils();
  const { data: pairsData, isLoading: isLoadingPairs } = api.pairs.getAll.useQuery();
  const createAlertMutation = api.alerts.create.useMutation({
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Alert created successfully!',
        color: 'green',
        icon: <IconCheck size="1rem" />,
      });
      void utils.alerts.getAllForUser.invalidate(); // Invalidate query to refresh list
      onClose(); // Close modal on success
      form.reset(); // Reset form
    },
    onError: (error) => {
      notifications.show({
        title: 'Error creating alert',
        message: error.message,
        color: 'red',
        icon: <IconX size="1rem" />,
      });
    },
  });

  const form = useForm<AlertFormValues>({
    initialValues: {
      pairId: null,
      type: AlertType.PRICE,
      direction: Direction.BELOW,
      threshold: '',
      interval: null,
    },
    validate: {
      pairId: (value) => (value ? null : 'Trading pair is required'),
      type: (value) => (value ? null : 'Alert type is required'),
      direction: (value) => (value ? null : 'Direction is required'),
      threshold: (value) => {
        if (!value) return 'Threshold is required';
        if (isNaN(parseFloat(value))) return 'Threshold must be a valid number';
        return null;
      },
      interval: (value, values) => 
        values.type === AlertType.CANDLE && !value ? 'Interval is required for CANDLE alerts' : null,
    },
  });

  const pairOptions = React.useMemo(() => 
    pairsData?.map(pair => ({ value: pair.id.toString(), label: pair.symbol })) ?? [],
    [pairsData]
  );

  const handleSubmit = (values: AlertFormValues) => {
    // Ensure required fields are not null before submitting
    if (!values.pairId || !values.type || !values.direction) {
        notifications.show({
            title: 'Validation Error',
            message: 'Please fill in all required fields.',
            color: 'orange',
        });
        return;
    }
    
    createAlertMutation.mutate({
      pairId: parseInt(values.pairId, 10), // Convert back to number
      type: values.type,
      direction: values.direction,
      threshold: values.threshold, // Already validated as numeric string
      interval: values.interval,
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Create New Alert" centered>
      <LoadingOverlay visible={isLoadingPairs || createAlertMutation.isPending} overlayProps={{ radius: "sm", blur: 2 }} />
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Select
            label="Trading Pair"
            placeholder="Select a pair"
            data={pairOptions}
            searchable
            required
            value="BTC/USDT"
            disabled={isLoadingPairs}
            {...form.getInputProps('pairId')}
          />
          <Select
            label="Alert Type"
            placeholder="Select type"
            data={alertTypeOptions}
            required
            {...form.getInputProps('type')}
          />
          {/* Conditionally show Interval based on Type */}
          {form.values.type === AlertType.CANDLE && (
            <Select
              label="Interval"
              placeholder="Select interval"
              data={intervalOptions}
              required
              {...form.getInputProps('interval')}
            />
          )}
          <Select
            label="Direction"
            placeholder="Select direction"
            data={directionOptions}
            required
            {...form.getInputProps('direction')}
          />
          <TextInput
            label="Threshold Price"
            placeholder="Enter price level"
            required
            {...form.getInputProps('threshold')}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={createAlertMutation.isPending}>Create Alert</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
} 