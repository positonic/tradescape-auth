"use client";

import { useState } from "react";
import { Button } from "@mantine/core";
import { IconBell } from "@tabler/icons-react";
import { AlertImport } from "~/app/alerts/components/AlertImport";

interface CreateAlertsButtonProps {
  content: string;
}

export function CreateAlertsButton({ content }: CreateAlertsButtonProps) {
  const [opened, setOpened] = useState(false);

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
          onSuccess={() => setOpened(false)}
        />
      )}
    </>
  );
}
