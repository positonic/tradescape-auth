import { videoRouter } from "~/server/api/routers/video";
import { toolRouter } from "~/server/api/routers/tool";
import { discordRouter } from "./routers/discord";
import { setupsRouter } from "./routers/setups";
import { createTRPCRouter, createCallerFactory } from "./trpc";
import { transcriptionRouter } from "./routers/transcription";
import { alertsRouter } from "./routers/alerts";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  video: videoRouter,
  tools: toolRouter,
  discord: discordRouter,
  setups: setupsRouter,
  transcription: transcriptionRouter,
  alerts: alertsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.video.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
