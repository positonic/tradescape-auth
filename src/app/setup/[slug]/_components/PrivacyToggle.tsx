'use client';

import { Switch, Group, Text } from '@mantine/core';
import { api } from "~/trpc/react";
import { notifications } from '@mantine/notifications';
import { IconLock, IconWorld } from '@tabler/icons-react';
import { useState } from 'react';

interface PrivacyToggleProps {
  setupId: string;
  initialPrivacy: string;
}

export function PrivacyToggle({ setupId, initialPrivacy }: PrivacyToggleProps) {
  const [isPublic, setIsPublic] = useState(initialPrivacy === 'public');
  const utils = api.useUtils();

  const updatePrivacy = api.setups.updatePrivacy.useMutation({
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Privacy setting updated',
        color: 'green'
      });
      // Invalidate both the individual setup and the lists
      void utils.setups.getById.invalidate({ id: setupId });
      void utils.setups.getPublic.invalidate();
      void utils.setups.getPrivate.invalidate();
    },
    onError: ({ message }) => {
      // Revert the toggle on error
      setIsPublic(!isPublic);
      notifications.show({
        title: 'Error',
        message,
        color: 'red'
      });
    }
  });

  return (
    <Group>
      <Switch
        checked={isPublic}
        onChange={(event) => {
          const newValue = event.currentTarget.checked;
          setIsPublic(newValue); // Update local state immediately
          void updatePrivacy.mutate({
            id: setupId,
            privacy: newValue ? 'public' : 'private'
          });
        }}
        color="green"
        size="md"
        thumbIcon={
          isPublic 
            ? <IconWorld size={12} stroke={2.5} />
            : <IconLock size={12} stroke={2.5} />
        }
        label={
          <Text size="sm" c="dimmed" className="cursor-pointer">
            {isPublic ? 'Public' : 'Private'}
          </Text>
        }
      />
    </Group>
  );
} 