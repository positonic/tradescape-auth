'use client';

import { api } from "~/trpc/react";
import { ContentEditor } from './ContentEditor';

interface SetupContentEditorProps {
  setupId: string;
  initialContent: string;
}

export function SetupContentEditor({ setupId, initialContent }: SetupContentEditorProps) {
  const utils = api.useUtils();
  const updateContent = api.setups.updateContent.useMutation();

  const handleSave = async (id: string, content: string) => {
    await updateContent.mutateAsync({ id, content });
    await utils.setups.getById.invalidate({ id });
  };

  return (
    <ContentEditor
      id={setupId}
      initialContent={initialContent}
      onSave={handleSave}
      label="Setup Content"
    />
  );
} 