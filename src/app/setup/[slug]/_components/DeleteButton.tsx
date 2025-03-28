'use client';

import { Button } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { api } from "~/trpc/react";
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface DeleteButtonProps {
  setupId: string;
}

export function DeleteButton({ setupId }: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const utils = api.useUtils();

  const deleteSetup = api.setups.deleteSetup.useMutation({
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Setup deleted successfully',
        color: 'green'
      });
      // Invalidate queries and redirect to the main page
      void utils.setups.getAll.invalidate();
      void utils.setups.getPublic.invalidate();
      void utils.setups.getPrivate.invalidate();
      router.push('/setups');
    },
    onError: (error) => {
      setIsDeleting(false);
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red'
      });
    }
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this setup? This action cannot be undone.')) {
      setIsDeleting(true);
      void deleteSetup.mutate({ id: setupId });
    }
  };

  return (
    <Button
      color="red"
      variant="outline"
      leftSection={<IconTrash size={16} />}
      onClick={handleDelete}
      loading={isDeleting}
      fullWidth
    >
      Delete Setup
    </Button>
  );
} 