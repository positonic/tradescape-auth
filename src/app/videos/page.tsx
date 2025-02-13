import { auth } from "~/server/auth";
import { VideosList } from "./components/VideosList";

export default async function VideosPage() {
  const session = await auth();

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Videos</h1>
      </div>
      {session?.user && <VideosList />}
    </div>
  );
} 