"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  IconHome,
  IconRobot,
  IconMicrophone,
  IconSettings,
  IconLogout,
  IconLogin,
  IconTargetArrow,
  IconChartLine,
  IconCalculator,
  IconActivity,
} from "@tabler/icons-react";
import { Drawer } from "@mantine/core";
import ManyChat from "./ManyChat";

interface NavbarWithDrawerProps {
  session: {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  } | null;
}

export default function NavbarWithDrawer({ session }: NavbarWithDrawerProps) {
  const [chatDrawerOpened, setChatDrawerOpened] = useState(false);

  return (
    <>
      <nav className="flex w-20 flex-col items-center space-y-4 border-r bg-white py-4">
        <div className="p-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg">
            <Image
              src="/tradescape-logo-trans.png"
              alt="TradeScape Logo"
              width={128}
              height={32}
              className="h-8 w-auto"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col space-y-2">
          <NavItem href="/" icon={<IconHome size={24} />} />
          <button
            onClick={() => setChatDrawerOpened(!chatDrawerOpened)}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100"
          >
            <IconRobot size={24} />
          </button>
          <NavItem href="/sessions" icon={<IconMicrophone size={24} />} />
          <NavItem href="/setups" icon={<IconTargetArrow size={24} />} />
          <NavItem href="/trades" icon={<IconChartLine size={24} />} />
          <NavItem href="/live" icon={<IconActivity size={24} />} />
          <NavItem href="/calculator" icon={<IconCalculator size={24} />} />
        </div>

        {session ? (
          <>
            <NavItem href="/api/auth/signout" icon={<IconLogout size={24} />} />
          </>
        ) : (
          <NavItem href="/api/auth/signin" icon={<IconLogin size={24} />} />
        )}
        <NavItem href="/settings" icon={<IconSettings size={24} />} />
      </nav>

      <Drawer.Root
        opened={chatDrawerOpened}
        onClose={() => setChatDrawerOpened(false)}
        position="right"
        size="lg"
        trapFocus={false}
        lockScroll={false}
      >
        <Drawer.Content style={{ height: "100vh", zIndex: 900 }}>
          <Drawer.Header>
            <Drawer.Title>Agent Chat</Drawer.Title>
            <Drawer.CloseButton />
          </Drawer.Header>
          <Drawer.Body style={{ height: "calc(100vh - 60px)", padding: 0 }}>
            <div className="flex h-full flex-col">
              <ManyChat />
            </div>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
    </>
  );
}

function NavItem({ href, icon }: { href: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg p-2 transition-colors hover:bg-gray-100"
    >
      {icon}
    </Link>
  );
}
