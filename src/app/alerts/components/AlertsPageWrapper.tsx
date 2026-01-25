"use client";

import { useState } from "react";
import { Button, Group, Tabs } from "@mantine/core";
import { IconPlus, IconList, IconUpload } from "@tabler/icons-react";
import { AlertModal } from "./AlertModal";
import { AlertsList } from "./AlertsList";
import { BulkAlertImport } from "./BulkAlertImport";

export function AlertsPageWrapper() {
  const [modalOpened, setModalOpened] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>("list");

  const openModal = () => setModalOpened(true);
  const closeModal = () => setModalOpened(false);

  return (
    <div className="space-y-6">
      <Group justify="space-between" align="center" mb="xl">
        <h1 className="text-2xl font-bold">Alerts</h1>
        {activeTab === "list" && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={openModal}
            radius="md"
          >
            Create Alert
          </Button>
        )}
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="list" leftSection={<IconList size={14} />}>
            My Alerts
          </Tabs.Tab>
          <Tabs.Tab value="bulk" leftSection={<IconUpload size={14} />}>
            Bulk Import
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="list">
          <AlertsList />
        </Tabs.Panel>

        <Tabs.Panel value="bulk">
          <BulkAlertImport onSuccess={() => setActiveTab("list")} />
        </Tabs.Panel>
      </Tabs>

      <AlertModal opened={modalOpened} onClose={closeModal} />
    </div>
  );
} 