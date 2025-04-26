"use client";

import { useState } from 'react';
import { Button, Group } from '@mantine/core';
import { IconBell, IconPlus } from '@tabler/icons-react';
import { AlertModal } from './AlertModal';
import { AlertsList } from './AlertsList';

export function AlertsPageWrapper() {
  const [modalOpened, setModalOpened] = useState(false);

  const openModal = () => setModalOpened(true);
  const closeModal = () => setModalOpened(false);

  return (
    <div className="space-y-6">
      <Group justify="space-between" align="center" mb="xl">
        <h1 className="text-2xl font-bold">Alerts</h1>
        <Button 
          leftSection={<IconPlus size={16} />}
          onClick={openModal}
          radius="md"
        >
          Create Alert
        </Button>
      </Group>

      <AlertsList />
      <AlertModal opened={modalOpened} onClose={closeModal} />
    </div>
  );
} 