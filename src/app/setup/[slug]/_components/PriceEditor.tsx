'use client';

import { NumberInput, SimpleGrid, Text } from '@mantine/core';
import { api } from "~/trpc/react";
import { notifications } from '@mantine/notifications';
import type { Setup } from '@prisma/client';
import { useState, useEffect } from 'react';
import { Decimal } from '@prisma/client/runtime/library';

interface PriceEditorProps {
  setup: Setup;
  riskReward: string | null;
}

export function PriceEditor({ setup, riskReward }: PriceEditorProps) {
  // Convert Decimal to string for initial state to match zod schema
  const [prices, setPrices] = useState({
    entryPrice: setup.entryPrice?.toString() ?? null,
    takeProfitPrice: setup.takeProfitPrice?.toString() ?? null,
    stopPrice: setup.stopPrice?.toString() ?? null
  });

  useEffect(() => {
    setPrices({
      entryPrice: setup.entryPrice?.toString() ?? null,
      takeProfitPrice: setup.takeProfitPrice?.toString() ?? null,
      stopPrice: setup.stopPrice?.toString() ?? null
    });
  }, [setup]);

  const utils = api.useUtils();
  const updateSetup = api.setups.update.useMutation({
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Setup updated successfully',
        color: 'green'
      });
      utils.setups.getById.invalidate({ id: setup.id });
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red'
      });
      setPrices({
        entryPrice: setup.entryPrice?.toString() ?? null,
        takeProfitPrice: setup.takeProfitPrice?.toString() ?? null,
        stopPrice: setup.stopPrice?.toString() ?? null
      });
    }
  });

  const handlePriceChange = (field: 'entryPrice' | 'takeProfitPrice' | 'stopPrice', rawValue: string | number | null) => {
    const stringValue = rawValue?.toString() ?? null;
    
    setPrices(prev => ({
      ...prev,
      [field]: stringValue
    }));

    const timeoutId = setTimeout(() => {
      updateSetup.mutate({
        id: setup.id,
        entryPrice: field === 'entryPrice' ? stringValue : prices.entryPrice,
        takeProfitPrice: field === 'takeProfitPrice' ? stringValue : prices.takeProfitPrice,
        stopPrice: field === 'stopPrice' ? stringValue : prices.stopPrice,
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
      <div>
        <Text size="sm" c="dimmed">Entry Price</Text>
        <NumberInput
          value={prices.entryPrice ?? undefined}
          onChange={(val) => handlePriceChange('entryPrice', val)}
          prefix="$"
          decimalScale={8}
          size="lg"
          w={150}
          allowNegative={false}
          placeholder="Enter price"
          hideControls
          thousandSeparator=","
          
        />
      </div>
      <div>
        <Text size="sm" c="dimmed">Take Profit</Text>
        <NumberInput
          value={prices.takeProfitPrice ?? undefined}
          onChange={(val) => handlePriceChange('takeProfitPrice', val)}
          prefix="$"
          decimalScale={8}
          size="lg"
          w={150}
          allowNegative={false}
          placeholder="Enter price"
          hideControls
          thousandSeparator=","
        />
      </div>
      <div>
        <Text size="sm" c="dimmed">Stop Loss</Text>
        <NumberInput
          value={prices.stopPrice ?? undefined}
          onChange={(val) => handlePriceChange('stopPrice', val)}
          prefix="$"
          decimalScale={8}
          size="lg"
          w={150}
          allowNegative={false}
          placeholder="Enter price"
          hideControls
          thousandSeparator=","
        />
      </div>
      <div>
        <Text className="pb-6 mt-6" size="sm" c="dimmed">Risk/Reward</Text>
        <Text style={{ marginTop: '8px' }} size="xl" fw={700} c={riskReward && Number(riskReward) >= 2 ? 'green' : 'yellow'}>
          {riskReward ? `${riskReward} / 1` : 'N/A'}
        </Text>
      </div>
    </SimpleGrid>
  );
} 