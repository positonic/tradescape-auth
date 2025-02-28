import { auth } from "~/server/auth";
import {
  Title,
  Text,
  Container,
  Stack,
  Group,
} from "@mantine/core";
import "@mantine/core/styles.css";
import Link from "next/link";
import SignInButton from "~/app/_components/SignInButton";

export async function LandingPage() {
  const session = await auth();
  return (
    <Container size="xl" className="py-16">
      {/* Hero Section */}
      <Stack align="center" className="mb-16 text-center">
        <Title order={1} className="mb-6 text-5xl font-bold leading-tight">
          Greetings dear Haven member!
        </Title>
        <Text size="xl" c="dimmed" className="mb-8">
          Only members of the Haven Discord server can access this app.
        </Text>
        <Group gap="md" justify="center" wrap="wrap">
          {!session?.user ?  <SignInButton /> : <></>}
          {/* <Button size="lg" variant="outline">
            Watch Demo
          </Button> */}
        </Group>
      </Stack>
    </Container>
  );
}
