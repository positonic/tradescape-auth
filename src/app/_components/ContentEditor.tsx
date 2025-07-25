'use client';

import { Textarea, Button, Group, Image } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';

interface ContentEditorProps {
  id: string;
  initialContent: string;
  onSave: (id: string, content: string) => Promise<void>;
  label?: string;
}

export function ContentEditor({ id, initialContent, onSave, label = 'Content' }: ContentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(id, content);
      notifications.show({
        title: 'Success',
        message: `${label} updated successfully`,
        color: 'green'
      });
      setIsEditing(false);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update content',
        color: 'red'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderContent = (text: string) => {
    // Split content by markdown images
    const parts = text.split(/!\[([^\]]*)\]\(([^)]+)\)/g);
    const elements = [];
    
    for (let i = 0; i < parts.length; i += 3) {
      // Regular text
      if (parts[i]?.trim()) {
        elements.push(
          <pre key={`text-${i}`} className="whitespace-pre-wrap">
            {parts[i]}
          </pre>
        );
      }
      
      // Image (alt text is parts[i+1], src is parts[i+2])
      if (parts[i + 1] !== undefined && parts[i + 2]) {
        elements.push(
          <Image
            key={`img-${i}`}
            src={parts[i + 2]}
            alt={parts[i + 1]}
            radius="sm"
            style={{ maxHeight: 400, objectFit: "contain" }}
            my="md"
          />
        );
      }
    }
    
    return elements.length > 0 ? elements : <pre className="whitespace-pre-wrap">{text}</pre>;
  };

  if (!isEditing) {
    return (
      <div>
        <Group justify="space-between" mb="md">
          <Button 
            onClick={() => setIsEditing(true)}
            variant="light"
            size="sm"
          >
            Edit {label}
          </Button>
        </Group>
        {renderContent(content)}
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
          onClick={() => void handleSave()}
          loading={isSaving}
        >
          Save Changes
        </Button>
      </Group>
    </div>
  );
} 