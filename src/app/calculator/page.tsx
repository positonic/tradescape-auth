import { auth } from "~/server/auth";
import { LandingPage } from "~/app/_components/LandingPage";
import HavenMemberBadge from "../videos/components/HavenMemberBadge";
import { Container } from "@mantine/core";
import RiskCalculator from "./RiskCalculator";

export default async function CalculatorPage() {
  const session = await auth();

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        {!session && <LandingPage />}
        {session?.user && (
          <div className="w-full">
            <HavenMemberBadge />
            <Container size="lg">
              <RiskCalculator />
            </Container>
          </div>
        )}
      </div>
    </div>
  );
}