import { type ReactNode } from "react";
import SettingsSidebar from "./_components/SettingsSidebar";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full">
      <SettingsSidebar />
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
