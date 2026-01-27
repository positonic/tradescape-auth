"use client";

import { useState, useEffect } from "react";
import {
  Drawer,
  Button,
  Textarea,
  Select,
  NumberInput,
  Stack,
  Group,
  Title,
  Radio,
  Text,
  Loader,
  Image,
  CloseButton,
  Box,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { api } from "~/trpc/react";

interface SetupDrawerProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface SetupFormValues {
  pairId: string;
  direction: "long" | "short";
  content: string;
  entryPrice: number | null;
  takeProfitPrice: number | null;
  stopPrice: number | null;
  timeframe: string | null;
  privacy: "private" | "public";
}

export function SetupDrawer({ opened, onClose, onSuccess }: SetupDrawerProps) {
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const utils = api.useUtils();
  const { data: pairs, isLoading: pairsLoading } = api.pairs.getAll.useQuery();
  const createSetupMutation = api.setups.create.useMutation({
    onSuccess: () => {
      notifications.show({
        title: "Success",
        message: "Setup created successfully",
        color: "green",
      });
      form.reset();
      setPastedImage(null);
      void utils.setups.getPrivate.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      notifications.show({
        title: "Error",
        message: error.message || "Failed to create setup",
        color: "red",
      });
    },
  });

  const form = useForm<SetupFormValues>({
    initialValues: {
      pairId: "",
      direction: "long",
      content: "",
      entryPrice: null,
      takeProfitPrice: null,
      stopPrice: null,
      timeframe: null,
      privacy: "private",
    },
    validate: {
      pairId: (value) => (!value ? "Pair is required" : null),
      content: (value) => (!value ? "Description is required" : null),
    },
  });

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!opened) return;

      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));

      if (imageItem) {
        e.preventDefault();
        const blob = imageItem.getAsFile();
        if (blob) {
          setIsUploadingImage(true);
          try {
            // Convert blob to base64
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              setPastedImage(base64);

              // Add image reference to content
              const currentContent = form.values.content;
              const imageMarkdown = "\n\n[Screenshot]";
              form.setFieldValue("content", currentContent + imageMarkdown);

              notifications.show({
                title: "Image pasted",
                message: "Screenshot added to setup",
                color: "green",
              });
            };
            reader.readAsDataURL(blob);
          } catch {
            notifications.show({
              title: "Error",
              message: "Failed to process pasted image",
              color: "red",
            });
          } finally {
            setIsUploadingImage(false);
          }
        }
      }
    };

    const pasteHandler = (e: ClipboardEvent) => void handlePaste(e);
    document.addEventListener("paste", pasteHandler);
    return () => document.removeEventListener("paste", pasteHandler);
  }, [opened, form]);

  const handleSubmit = async (values: SetupFormValues) => {
    try {
      // Create the setup
      await createSetupMutation.mutateAsync({
        content:
          values.content +
          (pastedImage ? `\n\n![Screenshot](${pastedImage})` : ""),
        direction: values.direction,
        pairId: Number(values.pairId),
        entryPrice: values.entryPrice,
        takeProfitPrice: values.takeProfitPrice,
        stopPrice: values.stopPrice,
        timeframe: values.timeframe,
        privacy: values.privacy,
      });
    } catch {
      // Error handling is done in the mutation callbacks
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<Title order={3}>Create New Setup</Title>}
      position="right"
      size="md"
      padding="lg"
    >
      <form onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
        <Stack gap="md">
          <Select
            label="Pair"
            placeholder="Select a trading pair"
            required
            searchable
            data={
              pairs?.map((pair) => ({
                value: pair.id.toString(),
                label: pair.symbol,
              })) ?? []
            }
            disabled={pairsLoading}
            {...form.getInputProps("pairId")}
          />

          <Radio.Group
            label="Direction"
            required
            {...form.getInputProps("direction")}
          >
            <Group mt="xs">
              <Radio value="long" label="Long" />
              <Radio value="short" label="Short" />
            </Group>
          </Radio.Group>

          <Textarea
            label="Description"
            placeholder="Describe your setup... (you can paste screenshots here)"
            minRows={4}
            required
            {...form.getInputProps("content")}
          />

          {isUploadingImage && (
            <Group justify="center">
              <Loader size="sm" />
              <Text size="sm">Processing image...</Text>
            </Group>
          )}

          {pastedImage && (
            <Box>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>
                  Pasted Screenshot
                </Text>
                <CloseButton
                  onClick={() => {
                    setPastedImage(null);
                    // Remove image markdown from content
                    const content = form.values.content;
                    form.setFieldValue(
                      "content",
                      content.replace(/\n\n\[Screenshot\]/, ""),
                    );
                  }}
                />
              </Group>
              <Image
                src={pastedImage}
                alt="Pasted screenshot"
                radius="sm"
                style={{ maxHeight: 200, objectFit: "contain" }}
              />
            </Box>
          )}

          <NumberInput
            label="Entry Price"
            placeholder="0.00"
            decimalScale={8}
            {...form.getInputProps("entryPrice")}
          />

          <NumberInput
            label="Take Profit Price"
            placeholder="0.00"
            decimalScale={8}
            {...form.getInputProps("takeProfitPrice")}
          />

          <NumberInput
            label="Stop Loss Price"
            placeholder="0.00"
            decimalScale={8}
            {...form.getInputProps("stopPrice")}
          />

          <Select
            label="Timeframe"
            placeholder="Select timeframe"
            data={[
              { value: "1m", label: "1 Minute" },
              { value: "5m", label: "5 Minutes" },
              { value: "15m", label: "15 Minutes" },
              { value: "30m", label: "30 Minutes" },
              { value: "1h", label: "1 Hour" },
              { value: "4h", label: "4 Hours" },
              { value: "1d", label: "1 Day" },
              { value: "1w", label: "1 Week" },
            ]}
            {...form.getInputProps("timeframe")}
          />

          <Radio.Group label="Privacy" {...form.getInputProps("privacy")}>
            <Group mt="xs">
              <Radio value="private" label="Private" />
              <Radio value="public" label="Public" />
            </Group>
          </Radio.Group>

          <Group justify="flex-end" mt="xl">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createSetupMutation.isPending}>
              Create Setup
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
