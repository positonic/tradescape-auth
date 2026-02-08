"use client";

import { useState } from "react";
import { Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBell } from "@tabler/icons-react";
import { AlertImport } from "~/app/alerts/components/AlertImport";

interface CreateAlertsButtonProps {
  content: string;
}

export function CreateAlertsButton({ content }: CreateAlertsButtonProps) {
  const [opened, setOpened] = useState(false);

  const handleSuccess = (result?: { created: number; failed: number }) => {
    setOpened(false);

    if (result) {
      const message =
        result.failed > 0
          ? `Created ${result.created} alert${result.created !== 1 ? "s" : ""}, ${result.failed} failed`
          : `Successfully created ${result.created} alert${result.created !== 1 ? "s" : ""}`;

      notifications.show({
        title: result.failed > 0 ? "Alerts Partially Created" : "Alerts Created",
        message,
        color: result.failed > 0 ? "yellow" : "green",
      });
    } else {
      notifications.show({
        title: "Alerts Created",
        message: "Your alerts have been successfully created and are now active.",
        color: "green",
      });
    }
  };

  return (
    <>
      <Button
        variant="light"
        size="xs"
        leftSection={<IconBell size={14} />}
        onClick={() => setOpened(true)}
      >
        Create Alerts from Content
      </Button>
      {opened && (
        <AlertImport
          initialText={content}
          onClose={() => setOpened(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
