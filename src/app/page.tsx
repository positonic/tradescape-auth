import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import Chat from "./_components/Chat";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    void api.video.getLatest.prefetch();
  }

  return (
    <HydrateClient>
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          {!session && <Link href={session ? "/api/auth/signout" : "/api/auth/signin"}
                className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
                >
                Sign in
            </Link>}
            {session?.user && <Chat />}
        
        </div>
      </div>
    </HydrateClient>
  );
}
