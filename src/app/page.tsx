import { LatestPost } from "~/app/_components/post";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import VideoSearch from "~/app/_components/VideoSearch";
import Chat from "./_components/Chat";
export default async function Home() {
  const session = await auth();

  if (session?.user) {
    void api.video.getLatest.prefetch();
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <Chat />
          {session?.user && <LatestPost />}
        </div>
      </main>
    </HydrateClient>
  );
}
