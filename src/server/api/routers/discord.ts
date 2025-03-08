import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export const discordRouter = createTRPCRouter({
  checkHavenMembership: protectedProcedure
    .query(async ({ ctx }) => {
      const token = ctx.session?.token?.accessToken;
      
      // console.log("checkHavenMembership: session", ctx.session);
      // console.log("checkHavenMembership: token", token);
      
      if (!token) {
        return { isHavenMember: false };
      }

      try {
        const response = await fetch('https://discord.com/api/users/@me/guilds', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Discord API responded with status ${response.status}`);
        }

        const guilds = (await response.json()) as DiscordGuild[];
        
        const HAVEN_GUILD_ID = process.env.HAVEN_GUILD_ID;
        const isHavenMember = guilds.some((guild) => guild.id === HAVEN_GUILD_ID);

        return { isHavenMember };
      } catch (error) {
        console.error('Error fetching guilds:', error);
        return { isHavenMember: false };
      }
    })
}); 