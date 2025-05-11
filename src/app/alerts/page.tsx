import { auth } from "~/server/auth";
import { LandingPage } from "~/app/_components/LandingPage";
import HavenMemberBadge from "../videos/components/HavenMemberBadge";
import { AlertsPageWrapper } from "./components/AlertsPageWrapper";

export default async function AlertsPage() {
  const session = await auth();

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        {!session && <LandingPage />}
        {session?.user && (
          <div className="w-full">
            <HavenMemberBadge />
            <AlertsPageWrapper />
          </div>
        )}
      </div>
    </div>
  );
} 