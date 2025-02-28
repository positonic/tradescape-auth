import { Paper, Badge } from '@mantine/core';
import Link from "next/link";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { getVideoBySlug } from "~/server/api/routers/video";
import { parseVTT } from '~/utils/vttParser';
import { VideoDetails } from '~/app/_components/VideoDetails';

export default async function VideoPage({ params }: {
  params: Promise<{ slug: string }>
}) {
  const slug = (await params).slug
  const session = await auth();
  const video = await getVideoBySlug(slug);

  const captions = video?.transcription ? parseVTT(video.transcription) : [];
  const transcription = captions.map(caption => caption.text).join(' ');
  
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'yellow';
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <div className="h-screen">
      {!session && (
        <div className="p-4">
          <Link
            href={session ? "/api/auth/signout" : "/api/auth/signin"}
            className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
          >
            Sign in
          </Link>
        </div>
      )}
      {session?.user ? (
        <Paper className="min-h-screen p-6 rounded-none">
          {!video && <div>Video not found</div>}
          
          {video && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold mb-4">
                {video.status.toLowerCase() === 'completed' ? (
                  <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {video.title}
                  </a>
                ) : (
                  <span className="text-gray-400">Processing {video.videoUrl}...</span>
                )}
              </h1>
             
              <div>
                <Badge color={getStatusColor(video.status)} variant="light">
                  {video.status}
                </Badge>
              </div>
              
              
              
              {(transcription && video.status.toLowerCase() === 'completed') && (
                <HydrateClient>
                  <VideoDetails 
                    transcription={transcription}
                    captions={captions}
                    isCompleted={video.status.toLowerCase() === 'completed'}
                    videoUrl={video.videoUrl}
                    video={video}
                  />
                </HydrateClient>
              )}
            </div>
          )}
        </Paper>
      ) : (
        <div className="text-center p-4">
          <p>Please sign in to view video details</p>
        </div>
      )}
    </div>
  );
}
