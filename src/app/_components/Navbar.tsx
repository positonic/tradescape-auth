import { auth } from "~/server/auth";
import Link from "next/link";
import { IconHome, IconRobot, IconScanEye, IconMicrophone,IconBell, IconSettings, IconLogout, IconLogin, IconTargetArrow, IconScan} from "@tabler/icons-react";

export default async function Navbar() {
  const session = await auth();
  return (
    <nav className="w-20 bg-white border-r flex flex-col items-center py-4 space-y-4">
      <div className="p-2">
        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
          <span className="text-white text-xl font-bold">H</span>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col space-y-2">
        <NavItem href="/" icon={<IconHome size={24} />} />
        <NavItem href="/agent" icon={<IconRobot size={24} />} />
        <NavItem href="/sessions" icon={<IconMicrophone size={24} />} />
        {/* <NavItem href="/videos" icon={<IconVideo size={24} />} /> */}
        <NavItem href="/setups" icon={<IconTargetArrow size={24} />} />
        {/* <NavItem href="/alerts" icon={<IconBell size={24} />} /> */}
      </div>
      
      
      {session ? (
              <>
                <NavItem href="/api/auth/signout" icon={<IconLogout size={24} />} />
              </>
            ) : <NavItem href="/api/auth/signin" icon={<IconLogin size={24} />} />}
      <NavItem href="/settings" icon={<IconSettings size={24} />} />
    </nav>
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