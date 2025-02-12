import Link from "next/link";

import { LatestPost } from "~/app/_components/post";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const videos = await api.video.get();
  const session = await auth();

  if (session?.user) {
    void api.video.getLatest.prefetch();
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Videos
          </h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            {videos ? videos.map((video) => <div key={video.id}>{video.slug}</div>) : <div>No videos found</div>}
          </div>
          
          {session?.user && <LatestPost />}
        </div>
      </main>
    </HydrateClient>
  );
}
