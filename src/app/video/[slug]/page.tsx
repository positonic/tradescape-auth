import { Paper } from '@mantine/core';
import { api } from "~/trpc/server";
import Link from "next/link";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { getVideoBySlug } from "~/server/api/routers/video";

export default async function VideoDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const session = await auth();
  const video = await getVideoBySlug(params.slug);

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
                  <h1 className="text-2xl font-bold mb-4">Video Details</h1>
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
