'use client';

import * as React from 'react';
import { api } from "~/trpc/react";
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { TextInput, Button, Box, Paper } from '@mantine/core';

interface VideoFormValues {
  videoUrl: string;
}

export default function VideosPage() {
  const { data: videos, isLoading } = api.video.get.useQuery();
  const addVideoMutation = api.video.create.useMutation({
    onSuccess: () => {
      // Invalidate the videos query to refresh the list
      utils.video.get.invalidate();
    },
  });
  const utils = api.useUtils();

  const form = useForm<VideoFormValues>({
    initialValues: {
      videoUrl: '',
    },
    validate: {
      videoUrl: (value) => {
        if (!value) return 'Video URL is required';
        try {
          new URL(value);
          return null;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
  });

  const handleSubmit = async (values: VideoFormValues) => {
    const notificationId = notifications.show({
      id: 'adding-video',
      title: 'Adding Video',
      message: 'Please wait while we process the video...',
      loading: true,
      autoClose: false,
      withCloseButton: false,
    });

    try {
      await addVideoMutation.mutateAsync({ url: values.videoUrl });
      notifications.update({
        id: notificationId,
        title: 'Success',
        message: 'Video added successfully',
        color: 'green',
        icon: <IconCheck size="1rem" />,
        autoClose: 2000,
      });
      form.reset();
    } catch (error) {
      notifications.update({
        id: notificationId,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to add video',
        color: 'red',
        icon: <IconX size="1rem" />,
        autoClose: 2000,
      });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
          Videos
        </h1>
        
        <Paper className="p-6 mb-8 bg-gray-800">
          <h2 className="text-2xl font-bold mb-4">Add New Video</h2>
          <Box className="max-w-2xl">
            <form onSubmit={form.onSubmit(handleSubmit)}>
              <TextInput
                label="Video URL"
                placeholder="Enter YouTube or other video URL"
                className="mb-4"
                {...form.getInputProps('videoUrl')}
              />
              <Button type="submit">Add Video</Button>
            </form>
          </Box>
        </Paper>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
          {videos?.map((video) => (
            <Paper 
              key={video.id} 
              className="p-4 bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <p className="text-sm mb-2">URL: {video.videoUrl}</p>
              <p className="text-sm mb-2">Slug: {video.slug}</p>
              {video.createdAt && (
                <p className="text-sm">
                  Added: {new Date(video.createdAt).toLocaleString()}
                </p>
              )}
            </Paper>
          ))}
        </div>
      </div>
    </main>
  );
} 