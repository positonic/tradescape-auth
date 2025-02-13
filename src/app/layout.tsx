import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import Layout from "./_components/Layout";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Admin dashboard for managing products and more",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <MantineProvider>
          <TRPCReactProvider>
            <Layout>{children}</Layout>
          </TRPCReactProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
