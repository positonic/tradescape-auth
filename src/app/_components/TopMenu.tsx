import { IconSearch, IconBell } from "@tabler/icons-react";
import { TextInput, Button, Avatar } from "@mantine/core";

export default function TopMenu() {
  return (
    <div className="h-16 bg-white border-b px-4 flex items-center justify-between">
      <div className="flex items-center flex-1">
        <TextInput
          placeholder="Search..."
          leftSection={<IconSearch size={16} />}
          className="w-64"
        />
      </div>
      
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm">
          Export
        </Button>
        <Button size="sm">
          Add Product
        </Button>
        <button className="p-2 hover:bg-gray-100 rounded-full">
          <IconBell size={20} />
        </button>
        <Avatar size="sm" radius="xl" />
      </div>
    </div>
  );
} 