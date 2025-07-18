import { videoRouter } from "~/server/api/routers/video";
import { toolRouter } from "~/server/api/routers/tool";
import { discordRouter } from "./routers/discord";
import { setupsRouter } from "./routers/setups";
import { createTRPCRouter, createCallerFactory } from "./trpc";
import { transcriptionRouter } from "./routers/transcription";
import { alertsRouter } from "./routers/alerts";
import { pairsRouter } from "./routers/pairs";
import { tradesRouter } from "./routers/trades";
import { liveRouter } from "./routers/live";
import { mastraRouter } from "./routers/mastra";

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
  pairs: pairsRouter,
  trades: tradesRouter,
  live: liveRouter,
  mastra: mastraRouter,
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
