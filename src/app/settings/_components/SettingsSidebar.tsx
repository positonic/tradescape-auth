"use client";

import { NavLink, Stack, Title } from "@mantine/core";
import { usePathname, useRouter } from "next/navigation";
import {
  IconUser,
  IconPalette,
  IconKey,
  IconLock,
} from "@tabler/icons-react";

const settingsNav = [
  { label: "Profile", href: "/settings/profile", icon: IconUser },
  { label: "Appearance", href: "/settings/appearance", icon: IconPalette },
  { label: "Exchange Keys", href: "/settings/exchange-keys", icon: IconKey },
  { label: "API Keys", href: "/settings/api-keys", icon: IconLock },
];

export default function SettingsSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="w-60 shrink-0 border-r border-gray-200 pr-4 dark:border-[var(--mantine-color-dark-4)]">
      <Title order={4} mb="md">
        Settings
      </Title>
      <Stack gap={4}>
        {settingsNav.map((item) => (
          <NavLink
            key={item.href}
            label={item.label}
            leftSection={<item.icon size={18} />}
            active={pathname === item.href}
            onClick={() => router.push(item.href)}
            variant="light"
          />
        ))}
      </Stack>
    </div>
  );
}
