import { auth } from "~/server/auth";

import VideoSearch from "~/app/_components/VideoSearch";
//import SignInButton from "../_components/SignInButton";
import { LandingPage } from "~/app/_components/LandingPage";
import HavenMemberBadge from "../videos/components/HavenMemberBadge";
import { AlertsList } from "./components/AlertsList";


export default async function VideosPage() {
  const session = await auth();

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        {!session && <LandingPage />}
        {session?.user && (
          <div className="w-full">
            <HavenMemberBadge />
            <h1 className="text-2xl font-bold mb-6">Alerts</h1>
            <AlertsList />
          </div>
        )}
      </div>
    </div>
  );
} 