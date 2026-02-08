import { type ReactNode } from "react";
import Navbar from "./Navbar";
import TopMenu from "./TopMenu";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-[var(--mantine-color-body)]">
      {/* Left Navbar */}
      <Navbar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Menu */}
        <TopMenu />
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
} 