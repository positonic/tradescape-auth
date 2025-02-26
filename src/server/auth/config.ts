import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
    token?: {
      accessToken?: string;
    };
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    DiscordProvider({
      clientId: process.env.AUTH_DISCORD_ID!,
      clientSecret: process.env.AUTH_DISCORD_SECRET!,
      authorization: {
        url: "https://discord.com/api/oauth2/authorize",
        params: {
          scope: "identify email guilds",
        },
      },
    }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt: ({ token, account, user }) => {
      console.log("jwt: jwt callback token", token);
      console.log("jwt: jwt callback account", account);
      console.log("jwt: jwt callback user", user);
      // On initial sign-in, account is available.
      if (account) {
        token.accessToken = account.access_token; // Save Discord's access token.
      }
      return token;
    },
    session: async ({ session, token }) => {
      return {
        ...session,
        token,
      };
    },
    // session: ({ session, user, token }) => {
    //   console.log("jwt: session callback session", session);
    //   console.log("jwt: session callback user", user);
    //   console.log("jwt: session callback token", token);
    //   return ({
    //   ...session,
    //   user: {
    //     ...session.user,
    //     id: user?.id ?? token.sub,
    //   },
    // })},
    // session: async ({ session, user, token }) => {
    //   console.log("jwt: session", session);
    //   console.log("jwt: user", user);
    //   console.log("jwt: token", token);
    //   console.log("jwt: token.accessToken", token.accessToken);
    //   if (!token.accessToken) {
    //     return {
    //       ...session,
    //       user: {
    //         ...session.user,
    //         id: user.id,
    //         isHavenMember: false,
    //       },
    //     };
    //   }

    //   try {
    //     const response = await fetch('https://discord.com/api/users/@me/guilds', {
    //       headers: {
    //         Authorization: `Bearer ${token.accessToken as string}`,
    //       },
    //     });
    //     console.log("jwt: response", response);
    //     if (!response.ok) {
    //       throw new Error(`Discord API responded with status ${response.status}`);
    //     }
        
    //     const guilds = await response.json();
    //     console.log("jwt: guilds", guilds);
    //     const HAVEN_GUILD_ID = process.env.HAVEN_GUILD_ID;
    //     const isHavenMember = guilds.some((guild: { id: string }) => guild.id === HAVEN_GUILD_ID);
    //     console.log("jwt: isHavenMember is ", isHavenMember)
    //     return {
    //       ...session,
    //       user: {
    //             ...session.user,
    //             id: user?.id ?? token.sub,
    //             isHavenMember
    //           },
    //     };
    //   } catch (error) {
    //     console.error('Error fetching guilds:', error);
    //     return {
    //       ...session,
    //       user: {
    //         ...session.user,
    //         id: user.id,
    //         isHavenMember: false,
    //       },
    //     };
    //   }
    // },
  },
} satisfies NextAuthConfig;
