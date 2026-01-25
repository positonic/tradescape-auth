"use client";

import { useState } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  Button,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconX } from "@tabler/icons-react";
import { api } from "~/trpc/react";

interface PasteTranscriptModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: (sessionId: string) => void;
}

export function PasteTranscriptModal({
  opened,
  onClose,
  onSuccess,
}: PasteTranscriptModalProps) {
  const [title, setTitle] = useState("");
  const [transcription, setTranscription] = useState("");

  const utils = api.useUtils();

  const createMutation = api.transcription.createFromPaste.useMutation({
    onSuccess: (session) => {
      void utils.transcription.getSessions.invalidate();
      notifications.show({
        title: "Session Created",
        message: "Your transcript has been saved. Click into it to create setups.",
        color: "green",
        icon: <IconCheck size="1rem" />,
      });
      setTitle("");
      setTranscription("");
      onClose();
      onSuccess?.(session.id);
    },
    onError: (error) => {
      notifications.show({
        title: "Failed to Create Session",
        message: error.message,
        color: "red",
        icon: <IconX size="1rem" />,
      });
    },
  });

  const handleSubmit = () => {
    if (!transcription.trim()) {
      notifications.show({
        title: "Empty Transcript",
        message: "Please paste some transcript text first.",
        color: "orange",
      });
      return;
    }
    createMutation.mutate({
      title: title.trim() || undefined,
      transcription: transcription.trim(),
    });
  };

  const handleClose = () => {
    setTitle("");
    setTranscription("");
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Paste Transcript"
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Paste a stream transcript or trading notes. After creating, click into
          the session and use &quot;Create Setups&quot; to extract trading setups.
        </Text>

        <TextInput
          label="Title (optional)"
          placeholder="e.g., Morning Stream Jan 23"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />

        <Textarea
          label="Transcript"
          placeholder="Paste your transcript text here..."
          minRows={10}
          maxRows={20}
          autosize
          value={transcription}
          onChange={(e) => setTranscription(e.currentTarget.value)}
          required
        />

        <Text size="xs" c="dimmed">
          {transcription.length.toLocaleString()} characters
        </Text>

        <Button
          onClick={handleSubmit}
          loading={createMutation.isPending}
          fullWidth
        >
          Create Session
        </Button>
      </Stack>
    </Modal>
  );
}
