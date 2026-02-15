import { auth } from "~/server/auth";
import { LandingPage } from "~/app/_components/LandingPage";
import HavenMemberBadge from "../videos/components/HavenMemberBadge";
import { DailyWall } from "./_components/DailyWall";

export default async function DailyPage() {
  const session = await auth();

  return (
    <div className="container mx-auto">
      <div className="mb-6 flex items-center justify-between">
        {!session && <LandingPage />}
        {session?.user && (
          <div className="w-full">
            <HavenMemberBadge />
            <DailyWall />
          </div>
        )}
      </div>
    </div>
  );
}
