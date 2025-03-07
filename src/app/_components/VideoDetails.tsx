"use client";

import {
  Button,
  Paper,
  Title,
  Text,
  Group,
  Badge,
  Table,
  Checkbox,
} from "@mantine/core";
import { useState } from "react";
import { api } from "~/trpc/react";
import type { TranscriptionSetups } from "~/types/transcription";
import type { Video } from "~/types/video";
import type { Caption } from "~/utils/vttParser";
import { getVideoIdFromYoutubeUrl } from "~/utils/youtube";
import { ContentAccordion } from "~/app/_components/ContentAccordion";
import { TradeSetups } from "./TradeSetups";

interface VideoDetailsProps {
  transcription: string;
  captions: Caption[];
  isCompleted: boolean;
  videoUrl: string;
  video: Video;
}

export function VideoDetails({
  transcription,
  captions,
  isCompleted,
  videoUrl,
  video,
}: VideoDetailsProps) {
  const [creatingSetups, setCreatingSetups] = useState(false);
  const [creatingDescription, setCreatingDescription] = useState(false);
  const [creatingSummary, setCreatingSummary] = useState(false);
  const [summary, setSummary] = useState<string | null>(video.summary ?? null);
  const [description, setDescription] = useState<string | null>(
    video.description ?? null,
  );
  const [setups, setSetups] = useState<TranscriptionSetups | null>(null);
  const [selectedSetups, setSelectedSetups] = useState<string[]>([]);
  
  const videoId = getVideoIdFromYoutubeUrl(videoUrl);
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  const handleGetSetups = () => {
    setCreatingSetups(true);
    setupsMutation.mutate({ transcription, summaryType: "trade-setups" });
  };

  const setupsMutation = api.video.getSetups.useMutation({
    onSuccess: (setups) => {
      console.log("createDescriptionMutation onSuccess", summary);
      setSetups(setups);
      setCreatingSetups(false);
    },
    onError: (error) => {
      console.error("Error generating summary:", error);
      setCreatingSetups(false);
    },
  });

  // Description:
  const createDescriptionMutation = api.video.describeTranscription.useMutation(
    {
      onSuccess: (newDescription) => {
        console.log("createDescriptionMutation onSuccess", newDescription);
        setDescription(newDescription);
        setCreatingDescription(false);
      },
      onError: (error) => {
        console.error("Error generating summary:", error);
        setCreatingDescription(false);
      },
    },
  );

  const handelCreateDescription = () => {
    setCreatingDescription(true);
    createDescriptionMutation.mutate({
      transcription,
      summaryType: "description",
      captions: captions.map((c) => ({
        text: c.text,
        startSeconds: c.startSeconds,
        endSeconds: c.endSeconds,
      })),
      videoUrl,
    });
  };

  // Summary:
  const createSummaryMutation = api.video.summarizeTranscription.useMutation({
    onSuccess: (newSummary) => {
      console.log("createSummaryMutation onSuccess", newSummary);
      setSummary(newSummary);
      setCreatingSummary(false);
    },
    onError: (error) => {
      console.error("Error generating summary:", error);
      setCreatingSummary(false);
    },
  });

  const handleCreateSummary = () => {
    setCreatingSummary(true);
    createSummaryMutation.mutate({
      videoId,
      transcription,
      summaryType: "basic",
    });
  };

  return (
    <div className="flex gap-6">
      {/* Left side - Video player */}
      <div className="flex-[2]">
        <div className="aspect-video w-full">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <br/>
        {setups && (
          <TradeSetups
            setups={setups}
            selectedSetups={selectedSetups}
            onSetupSelectionChange={setSelectedSetups}
          />
        )}
      </div>

      {/* Right side - Accordion content */}
      <div className="flex-1 overflow-y-auto">
        {summary && <ContentAccordion title="Summary" content={summary} />}

        {description && (
          <ContentAccordion title="Description" content={description} />
        )}
        {transcription && (
          <ContentAccordion title="Transcription" content={transcription} />
        )}

       

        {/* Buttons */}
        <Group gap="md" mt="xl">
          <Button
            loading={creatingSummary}
            disabled={!transcription || !isCompleted}
            onClick={handleCreateSummary}
          >
            Create Summary
          </Button>
          <Button
            loading={creatingDescription}
            disabled={!transcription || !isCompleted}
            onClick={handelCreateDescription}
          >
            Create Description
          </Button>
          <Button
            loading={creatingSetups}
            disabled={!transcription || !isCompleted}
            onClick={handleGetSetups}
          >
            Find setups
          </Button>
        </Group>
      </div>
    </div>
  );
}
