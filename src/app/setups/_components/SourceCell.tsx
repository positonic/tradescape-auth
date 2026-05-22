"use client";

import { useMemo, useState } from "react";
import {
  Combobox,
  InputBase,
  Loader,
  Text,
  useCombobox,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "~/trpc/react";

interface SourceCellProps {
  setupId: string;
  currentSource: { id: number; name: string } | null;
  editable: boolean;
}

const CLEAR_VALUE = "__clear__";
const CREATE_VALUE = "__create__";

export function SourceCell({
  setupId,
  currentSource,
  editable,
}: SourceCellProps) {
  if (!editable) {
    return currentSource ? (
      <Text size="sm">{currentSource.name}</Text>
    ) : (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  return (
    <EditableSourceCell setupId={setupId} currentSource={currentSource} />
  );
}

function EditableSourceCell({
  setupId,
  currentSource,
}: Omit<SourceCellProps, "editable">) {
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setSearch("");
    },
    onDropdownOpen: () => combobox.focusSearchInput(),
  });

  const [search, setSearch] = useState("");

  const utils = api.useUtils();
  const { data: sources, isLoading: sourcesLoading } =
    api.sources.getAll.useQuery();

  const invalidateAll = async () => {
    await Promise.all([
      utils.setups.getPrivate.invalidate(),
      utils.setups.getPublic.invalidate(),
      utils.sources.getAll.invalidate(),
    ]);
  };

  const updateSource = api.setups.updateSource.useMutation({
    onSuccess: async () => {
      await invalidateAll();
    },
    onError: (error) => {
      notifications.show({
        title: "Error",
        message: error.message || "Failed to update source",
        color: "red",
      });
    },
  });

  const createSource = api.sources.create.useMutation({
    onError: (error) => {
      notifications.show({
        title: "Error",
        message: error.message || "Failed to create source",
        color: "red",
      });
    },
  });

  const trimmed = search.trim();
  const trimmedLower = trimmed.toLowerCase();

  const filtered = useMemo(() => {
    if (!sources) return [];
    if (!trimmedLower) return sources;
    return sources.filter((s) =>
      s.name.toLowerCase().includes(trimmedLower),
    );
  }, [sources, trimmedLower]);

  const exactMatch = useMemo(
    () =>
      sources?.some((s) => s.name.toLowerCase() === trimmedLower) ?? false,
    [sources, trimmedLower],
  );

  const showCreate = trimmed.length > 0 && !exactMatch;

  const handleSelect = async (value: string) => {
    combobox.closeDropdown();

    if (value === CLEAR_VALUE) {
      await updateSource.mutateAsync({ id: setupId, sourceId: null });
      return;
    }

    if (value === CREATE_VALUE) {
      const created = await createSource.mutateAsync({ name: trimmed });
      await updateSource.mutateAsync({ id: setupId, sourceId: created.id });
      return;
    }

    await updateSource.mutateAsync({
      id: setupId,
      sourceId: Number(value),
    });
  };

  const pending = updateSource.isPending || createSource.isPending;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Combobox
        store={combobox}
        withinPortal
        onOptionSubmit={(value) => void handleSelect(value)}
      >
        <Combobox.Target>
          <InputBase
            component="button"
            type="button"
            pointer
            rightSection={
              pending ? <Loader size="xs" /> : <Combobox.Chevron />
            }
            rightSectionPointerEvents="none"
            onClick={() => combobox.toggleDropdown()}
            disabled={pending}
            size="xs"
          >
            {currentSource ? (
              currentSource.name
            ) : (
              <Text size="sm" c="dimmed" component="span">
                —
              </Text>
            )}
          </InputBase>
        </Combobox.Target>

        <Combobox.Dropdown>
          <Combobox.Search
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search or create…"
          />
          <Combobox.Options>
            {sourcesLoading && (
              <Combobox.Empty>Loading…</Combobox.Empty>
            )}

            {!sourcesLoading && currentSource && (
              <Combobox.Option value={CLEAR_VALUE}>
                <Text size="sm" c="dimmed">
                  Clear source
                </Text>
              </Combobox.Option>
            )}

            {filtered.map((source) => (
              <Combobox.Option key={source.id} value={source.id.toString()}>
                {source.name}
              </Combobox.Option>
            ))}

            {showCreate && (
              <Combobox.Option value={CREATE_VALUE}>
                + Create &quot;{trimmed}&quot;
              </Combobox.Option>
            )}

            {!sourcesLoading &&
              filtered.length === 0 &&
              !showCreate &&
              !currentSource && (
                <Combobox.Empty>No sources yet</Combobox.Empty>
              )}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
    </div>
  );
}
