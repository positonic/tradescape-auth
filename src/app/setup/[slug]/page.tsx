import { Paper } from '@mantine/core';
import Link from "next/link";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

export default async function SetupPage({ params }: {
  params: Promise<{ slug: string }>
}) {
  const slug = (await params).slug
  const session = await auth();
  const setup = await api.setups.getById.call({}, { id: slug });

  // const getStatusColor = (status: string) => {
  //   switch (status.toLowerCase()) {
  //     case 'pending':
  //       return 'yellow';
  //     case 'completed':
  //       return 'green';
  //     case 'failed':
  //       return 'red';
  //     default:
  //       return 'gray';
  //   }
  // };

  return (
    <div className="h-screen">
      {!session && (
        <div className="p-4">
          <Link
            href={session ? "/api/auth/signout" : "/api/auth/signin"}
            className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
          >
            Sign in
          </Link>
        </div>
      )}
      {session?.user ? (
        <Paper className="min-h-screen p-6 rounded-none">
          {!setup && <div>Setup not found</div>}
          
          {setup && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold mb-4">
                {setup.direction}
              </h1>
              <p>
                {setup.content}
                {setup?.entryPrice?.toString()}
              </p>
            </div>
          )}
        </Paper>
      ) : (
        <div className="text-center p-4">
          <p>Please sign in to view video details</p>
        </div>
      )}
    </div>
  );
}
