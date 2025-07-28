'use client';

import { useState } from 'react';
import { Button, Select, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '~/trpc/react';

interface PairEditorProps {
  setupId: string;
  currentPairId: number;
  currentPairSymbol: string;
}

export function PairEditor({ setupId, currentPairId, currentPairSymbol }: PairEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPairId, setSelectedPairId] = useState(currentPairId.toString());

  const utils = api.useUtils();
  const { data: pairs, isLoading: pairsLoading } = api.pairs.getAll.useQuery();
  
  const updatePairMutation = api.setups.updatePair.useMutation({
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Trading pair updated successfully',
        color: 'green'
      });
      setIsEditing(false);
      void utils.setups.getById.invalidate({ id: setupId });
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message ?? 'Failed to update trading pair',
        color: 'red'
      });
    }
  });

  const handleSave = () => {
    updatePairMutation.mutate({
      id: setupId,
      pairId: Number(selectedPairId)
    });
  };

  const handleCancel = () => {
    setSelectedPairId(currentPairId.toString());
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <Group justify="space-between">
        <span>{currentPairSymbol}</span>
        <Button
          variant="light"
          size="xs"
          onClick={() => setIsEditing(true)}
        >
          Edit
        </Button>
      </Group>
    );
  }

  return (
    <div>
      <Select
        value={selectedPairId}
        onChange={(value) => setSelectedPairId(value ?? currentPairId.toString())}
        data={pairs?.map(pair => ({
          value: pair.id.toString(),
          label: pair.symbol
        })) ?? []}
        searchable
        disabled={pairsLoading}
        mb="xs"
      />
      <Group justify="flex-end" gap="xs">
        <Button
          variant="light"
          size="xs"
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          size="xs"
          onClick={handleSave}
          loading={updatePairMutation.isPending}
        >
          Save
        </Button>
      </Group>
    </div>
  );
}