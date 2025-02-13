'use client';
import { Paper } from '@mantine/core';
import { useParams } from 'next/navigation';
import { api } from "~/trpc/react";

export default function VideoDetailPage() {
  const { slug } = useParams() as { slug: string };
  const { data: video, isLoading, error } = api.video.getBySlug.useQuery(slug);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!video) {
    return <div>Video not found</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Paper className="p-6 bg-gray-800">
        <h1 className="text-2xl font-bold mb-4">Video Details</h1>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Video URL</h2>
            <p>{video.videoUrl}</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Status</h2>
            <p>{video.status}</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Created At</h2>
            <p>{new Date(video.createdAt!).toLocaleString()}</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Last Updated</h2>
            <p>{new Date(video.updatedAt!).toLocaleString()}</p>
          </div>
          {video.transcription && (
            <div>
              <h2 className="text-lg font-semibold">Transcription</h2>
              <div className="mt-2 p-4 bg-gray-900 rounded-lg max-h-96 overflow-y-auto">
                <p className="whitespace-pre-wrap">
                  {JSON.parse(video.transcription).text}
                </p>
              </div>
            </div>
          )}
        </div>
      </Paper>
    </div>
  );
}
