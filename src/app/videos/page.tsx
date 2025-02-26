import { auth } from "~/server/auth";
import { VideosList } from "./components/VideosList";
import VideoSearch from "~/app/_components/VideoSearch";
import SignInButton from "./components/SignInButton";
import HavenMemberBadge from "./components/HavenMemberBadge";

export default async function VideosPage() {
  const session = await auth();

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        {!session && <SignInButton />}
        {session?.user && (
          <div className="w-full">
            <HavenMemberBadge />
            <h1 className="text-2xl font-bold mb-6">Videos</h1>
            <VideoSearch />
            <VideosList />
          </div>
        )}
      </div>
    </div>
  );
} 