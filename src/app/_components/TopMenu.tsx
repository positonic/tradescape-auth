import { auth } from "~/server/auth";
import { IconBell } from "@tabler/icons-react";
import { Avatar } from "@mantine/core";

export default async function TopMenu() {
  const session = await auth();
  return (
    <div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-[var(--mantine-color-dark-4)] dark:bg-[var(--mantine-color-dark-7)] dark:text-gray-200">
      <div className="flex flex-1 items-center"></div>

      <div className="flex items-center space-x-4">
        <button className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-[var(--mantine-color-dark-5)]">
          <IconBell size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Avatar size="sm" radius="xl" />
        </div>
        <p className="text-center text-2xl text-white">
          {session && (
            <span className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
              {session && (
                <>
                  <span>{session.user?.name}</span>
                </>
              )}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
