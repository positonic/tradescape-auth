import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import Layout from "./_components/Layout";
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import { Providers } from "./_components/Providers";

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
          <Notifications />
          <TRPCReactProvider>
            <Providers>
              <Layout>{children}</Layout>
            </Providers>
          </TRPCReactProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
