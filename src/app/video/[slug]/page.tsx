import { Paper, Badge, Button } from '@mantine/core';
import { api } from "~/trpc/server";
import Link from "next/link";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { getVideoBySlug } from "~/server/api/routers/video";
import { parseVTT } from '~/utils/vttParser';
import { Innertube } from 'youtubei.js/web';
import { TranscriptionAccordion } from '~/components/TranscriptionAccordion';
export default async function VideoDetailPage({
  params: { slug },
}: {
  params: { slug: string };
}) {
  const session = await auth();
  const video = await getVideoBySlug(slug);

  // Add video info logging
  const innertube = await Innertube.create();
  const videoInfo = await innertube.getInfo('9Yf7asDPBaE');
  console.log('YouTube Video Info:', videoInfo);
  
  console.log('video?.transcription', video?.transcription);
  const captions = video?.transcription ? parseVTT(video.transcription) : [];
  const transcription = captions.map(caption => caption.text).join(' ');

  console.log('captions', captions);
  
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
    <HydrateClient>
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          {!session && <Link href={session ? "/api/auth/signout" : "/api/auth/signin"}
                className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
                >
                Sign in
            </Link>}
            {session?.user ? (
            <Paper className="p-6 bg-gray-800 w-full">
              {!video && <div>Video not found</div>}
              
              {video && (
                <div className="space-y-4">
                  <h1 className="text-2xl font-bold mb-4">{video.title}</h1>
                  <div>
                    <h2 className="text-lg font-semibold">Video URL</h2>
                    <p>{video.videoUrl}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Status</h2>
                    <Badge color={getStatusColor(video.status)} variant="light">
                      {video.status}
                    </Badge>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Created At</h2>
                    <p>{new Date(video.createdAt!).toLocaleString()}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Last Updated</h2>
                    <p>{new Date(video.updatedAt!).toLocaleString()}</p>
                  </div>
                  
                  {captions.length > 0 && (
                    <TranscriptionAccordion transcription={transcription}/>    
                  )}
                  <Button>
                    Summarize transcription
                  </Button>
                </div>
              )}
            </Paper>
          ) : (
            <div className="text-center">
              <p>Please sign in to view video details</p>
            </div>
          )}
        
        </div>
      </div>
      
    </HydrateClient>
  );
}
