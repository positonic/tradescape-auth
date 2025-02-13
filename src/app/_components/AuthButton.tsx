'use client';

import { signIn, signOut } from "~/server/auth";

interface AuthButtonProps {
  sessionExists: boolean;
}

export default function AuthButton({ sessionExists }: AuthButtonProps) {
  return (
    <button
      className="rounded-full bg-white/10 px-10 py-3 font-semibold text-white no-underline transition hover:bg-white/20"
      onClick={() => sessionExists ? signOut() : signIn("discord")}
    >
      {sessionExists ? "Sign out" : "Sign in with Discord"}
    </button>
  );
} 