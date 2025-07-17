import Chat from "~/app/_components/Chat";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { LandingPage } from "~/app/_components/LandingPage";
import { Suspense } from "react";
import { type Message } from "~/types";
const initialMessages: Message[] = [
  {
    type: 'system',
    content: `You are a personal assistant who helps manage tasks in our Task Management System. 
              You never give IDs to the user since those are just for you to keep track of. 
              When a user asks to create a task and you don't know the project to add it to for sure, clarify with the user.
              The current date is: ${new Date().toISOString().split('T')[0]}`
  },
  {
    type: 'ai',
    content: 'Hello! I\'m your AI assistant. How can I help you manage your tasks today?'
  }
]

export default async function Home() {
  return (
    <HydrateClient>
      <Suspense fallback={<div>Loading...</div>}>
        <HomeContent />
      </Suspense>
    </HydrateClient>
  );
}

async function HomeContent() {
  const session = await auth();
  return session?.user ? <Chat initialMessages={initialMessages}  /> : <LandingPage />;
  
}

