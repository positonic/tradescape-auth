import { auth } from "~/server/auth";
import { IconSearch, IconBell } from "@tabler/icons-react";
import { TextInput, Avatar } from "@mantine/core";

export default async function TopMenu() {
    const session = await auth();
  return (
    <div className="h-16 bg-white border-b px-4 flex items-center justify-between">
      <div className="flex items-center flex-1">
        {/* <TextInput
          placeholder="Search..."
          leftSection={<IconSearch size={16} />}
          className="w-64"
        /> */}
      </div>
      
      <div className="flex items-center space-x-4">
        
        <button className="p-2 hover:bg-gray-100 rounded-full">
          <IconBell size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Avatar size="sm" radius="xl" />
        </div>
        <p className="text-center text-2xl text-white">
            {session && <span className="flex items-center gap-2 text-gray-700">
            {session && (
              <>
                <span>{session.user?.name}</span>
              </>
            )}
        </span>}
        </p>
       
      </div>
    </div>
  );
} 