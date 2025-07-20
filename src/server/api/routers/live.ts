import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { decryptFromTransmission } from "~/lib/keyEncryption";
import { HyperliquidWebSocketManager } from "~/server/hyperliquid/WebSocketManager";
import { TRPCError } from "@trpc/server";

export const liveRouter = createTRPCRouter({
  subscribeToLiveData: protectedProcedure
    .input(
      z.object({
        encryptedKeys: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Decrypt the API keys
        const decryptedKeys = decryptFromTransmission(input.encryptedKeys);
        if (!decryptedKeys) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Failed to decrypt API keys",
          });
        }
        const hyperliquidKeys = decryptedKeys[0]; // Get the first (and should be only) key

        // Hyperliquid only requires wallet address, not API key/secret
        if (!hyperliquidKeys?.walletAddress) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing required Hyperliquid wallet address",
          });
        }

        // Get or create WebSocket manager instance
        const wsManager = HyperliquidWebSocketManager.getInstance();
        
        // Subscribe user to live data
        await wsManager.subscribeUser(ctx.session.user.id, {
          apiKey: hyperliquidKeys.apiKey ?? "",
          apiSecret: hyperliquidKeys.apiSecret ?? "",
          walletAddress: hyperliquidKeys.walletAddress,
        });

        return { success: true };
      } catch (error) {
        console.error("Failed to subscribe to live data:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect to live data stream",
        });
      }
    }),

  unsubscribeFromLiveData: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        const wsManager = HyperliquidWebSocketManager.getInstance();
        await wsManager.unsubscribeUser(ctx.session.user.id);
        
        return { success: true };
      } catch (error) {
        console.error("Failed to unsubscribe from live data:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to disconnect from live data stream",
        });
      }
    }),

  getCurrentLiveData: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const wsManager = HyperliquidWebSocketManager.getInstance();
        const liveData = await wsManager.getCurrentData(ctx.session.user.id);
        
        if (!liveData) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No live data connection found. Please connect first.",
          });
        }

        return liveData;
      } catch (error) {
        console.error("Failed to get current live data:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch current live data",
        });
      }
    }),

  getConnectionStatus: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const wsManager = HyperliquidWebSocketManager.getInstance();
        const isConnected = wsManager.isUserConnected(ctx.session.user.id);
        
        return { connected: isConnected };
      } catch (error) {
        console.error("Failed to get connection status:", error);
        return { connected: false };
      }
    }),
});