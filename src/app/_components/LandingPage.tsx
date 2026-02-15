import { auth } from "~/server/auth";
import { Container } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/charts/styles.css";
import SignInButton from "~/app/_components/SignInButton";
import { Dashboard } from "~/app/_components/Dashboard";

export async function LandingPage() {
  const session = await auth();
  return (
    <>
      {!session?.user ? (
        <Container size="xl" className="py-16">
          <div className="flex justify-center">
            <SignInButton />
          </div>
        </Container>
      ) : (
        <Dashboard userName={session.user.name ?? "Trader"} />
      )}
    </>
  );
}
