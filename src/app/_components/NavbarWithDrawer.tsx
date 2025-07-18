'use client';

import { useState } from 'react';
import Link from "next/link";
import { IconHome, IconRobot, IconMicrophone, IconSettings, IconLogout, IconLogin, IconTargetArrow, IconChartLine, IconCalculator, IconActivity} from "@tabler/icons-react";
import { Drawer } from '@mantine/core';
import ManyChat from './ManyChat';

interface NavbarWithDrawerProps {
  session: any;
}

export default function NavbarWithDrawer({ session }: NavbarWithDrawerProps) {
  const [chatDrawerOpened, setChatDrawerOpened] = useState(false);

  return (
    <>
      <nav className="w-20 bg-white border-r flex flex-col items-center py-4 space-y-4">
        <div className="p-2">
          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
            <span className="text-white text-xl font-bold">H</span>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col space-y-2">
          <NavItem href="/" icon={<IconHome size={24} />} />
          <button
            onClick={() => setChatDrawerOpened(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
        ) : <NavItem href="/api/auth/signin" icon={<IconLogin size={24} />} />}
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
      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
    >
      {icon}
    </Link>
  );
}