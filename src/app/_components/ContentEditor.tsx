'use client';

import { Textarea, Button, Group } from '@mantine/core';
import { api } from "~/trpc/react";
import { notifications } from '@mantine/notifications';
import { useState } from 'react';

interface ContentEditorProps {
  setupId: string;
  initialContent: string;
}

export function ContentEditor({ setupId, initialContent }: ContentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);

  const utils = api.useUtils();
  const updateContent = api.setups.updateContent.useMutation({
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Content updated successfully',
        color: 'green'
      });
      setIsEditing(false);
      void utils.setups.getById.invalidate({ id: setupId });
    },
    onError: ({ message }) => {
      notifications.show({
        title: 'Error',
        message,
        color: 'red'
      });
    }
  });

  if (!isEditing) {
    return (
      <div>
        <Group justify="space-between" mb="md">
          <Button 
            onClick={() => setIsEditing(true)}
            variant="light"
            size="sm"
          >
            Edit Content
          </Button>
        </Group>
        <pre className="whitespace-pre-wrap">{content}</pre>
      </div>
    );
  }

  return (
    <div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        minRows={10}
        autosize
        mb="md"
      />
      <Group justify="flex-end" gap="sm">
        <Button 
          variant="light" 
          color="red"
          onClick={() => {
            setContent(initialContent);
            setIsEditing(false);
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            void updateContent.mutate({
              id: setupId,
              content
            });
          }}
          loading={updateContent.isLoading}
        >
          Save Changes
        </Button>
      </Group>
    </div>
  );
} 