'use client';

import { Button } from '@mantine/core';
import { signIn } from "next-auth/react";
import { IconBrandDiscord } from '@tabler/icons-react';

export default function SignInButton() {
  return (
    <Button
      onClick={() => signIn("discord", { callbackUrl: "/agent" }, 'scope=identify guilds')}
      leftSection={<IconBrandDiscord size={20} />}
      variant="filled"
      color="indigo"
      size="md"
    >
      Sign in with Discord
    </Button>
  );
} 