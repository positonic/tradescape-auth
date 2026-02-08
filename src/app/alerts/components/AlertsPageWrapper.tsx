"use client";

import { useState } from "react";
import { Button, Group } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconFileImport } from "@tabler/icons-react";
import { AlertModal } from "./AlertModal";
import { AlertsList } from "./AlertsList";
import { AlertImport } from "./AlertImport";
import { AlertServiceStatus } from "./AlertServiceStatus";
import { api } from "~/trpc/react";

export function AlertsPageWrapper() {
  const [modalOpened, setModalOpened] = useState(false);
  const [importOpened, setImportOpened] = useState(false);

  const utils = api.useUtils();

  const openModal = () => setModalOpened(true);
  const closeModal = () => setModalOpened(false);

  const openImport = () => setImportOpened(true);
  const closeImport = () => setImportOpened(false);

  const handleImportSuccess = (result?: {
    created: number;
    failed: number;
  }) => {
    // Refresh alerts list
    void utils.alerts.getAllForUser.invalidate();
    closeImport();

    if (result) {
      const message =
        result.failed > 0
          ? `Created ${result.created} alert${result.created !== 1 ? "s" : ""}, ${result.failed} failed`
          : `Successfully created ${result.created} alert${result.created !== 1 ? "s" : ""}`;

      notifications.show({
        title:
          result.failed > 0 ? "Alerts Partially Created" : "Alerts Created",
        message,
        color: result.failed > 0 ? "yellow" : "green",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Group justify="space-between" align="center" mb="xl">
        <h1 className="text-2xl font-bold">Alerts</h1>
        <Group gap="sm">
          <Button
            leftSection={<IconFileImport size={16} />}
            onClick={openImport}
            radius="md"
            variant="outline"
          >
            Import from Text
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={openModal}
            radius="md"
          >
            Create Alert
          </Button>
        </Group>
      </Group>

      <AlertServiceStatus />

      <AlertsList />
      <AlertModal opened={modalOpened} onClose={closeModal} />
      {importOpened && (
        <AlertImport onClose={closeImport} onSuccess={handleImportSuccess} />
      )}
    </div>
  );
}
