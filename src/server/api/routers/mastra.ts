import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import OpenAI from "openai";
import { TRPCError } from "@trpc/server";

import jwt from "jsonwebtoken";
import crypto from "crypto";

// OpenAI client for embeddings
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Get Mastra API URL from environment variable
const MASTRA_API_URL = process.env.MASTRA_API_URL;

if (!MASTRA_API_URL) {
  throw new Error("MASTRA_API_URL environment variable is not set");
}

type MastraAgentRecord = {
  name?: string;
  instructions: string;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonParseResult =
  | { ok: true; value: JsonValue }
  | { ok: false; error: Error };

const parseJsonSafely = (input: string): JsonParseResult => {
  try {
    return { ok: true, value: JSON.parse(input) as JsonValue };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
};

// Utility to cache agent instruction embeddings
let agentEmbeddingsCache: { id: string; vector: number[] }[] | null = null;
/**
 * Load and cache embeddings for each agent's instructions.
 * Always returns an array (never null).
 */
async function loadAgentEmbeddings(): Promise<
  { id: string; vector: number[] }[]
> {
  if (agentEmbeddingsCache) return agentEmbeddingsCache;

  // Use direct fetch instead of mastraClient
  let data: Record<string, MastraAgentRecord>;
  try {
    const response = await fetch(`${MASTRA_API_URL}/api/agents`);
    if (!response.ok) {
      throw new Error(`Mastra API returned status ${response.status}`);
    }
    const rawData: unknown = await response.json();
    const parsed = MastraAgentsMapSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new Error("Mastra agent response did not match expected schema");
    }
    data = parsed.data;
  } catch (error) {
    console.error("Failed to fetch Mastra agents using direct fetch:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to fetch Mastra agents for embedding",
    });
  }

  if (!data || Object.keys(data).length === 0) {
    // Handle case where no agents are returned
    console.warn("No agents returned from Mastra API");
    agentEmbeddingsCache = [];
    return agentEmbeddingsCache;
  }

  const agentIds = Object.keys(data);
  // Extract instructions
  const instructions = agentIds.map((id) => data[id]!.instructions);
  const embedRes = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: instructions,
  });
  // Build embeddings array, asserting agentIds[i] is defined
  agentEmbeddingsCache = embedRes.data.map((e, i) => ({
    id: agentIds[i]!,
    vector: e.embedding,
  }));
  return agentEmbeddingsCache;
}

// Define the expected structure of an agent from the Mastra API
// Adjust properties if the actual API response differs
const MastraAgentSchema = z.object({
  id: z.string(), // Assuming agent ID is a string
  name: z.string(),
  instructions: z.string(),
  // Add other relevant properties if needed, e.g.:
  // description: z.string().optional(),
  // capabilities: z.array(z.string()).optional(),
});

const MastraAgentRecordSchema = z.object({
  name: z.string().optional(),
  instructions: z.string(),
});

const MastraAgentsMapSchema = z.record(MastraAgentRecordSchema);

// Define the expected response array
const MastraAgentsResponseSchema = z.array(MastraAgentSchema);

// Helper function to parse expiration strings (e.g., "24h", "7d", "30d")
function parseExpiration(expiresIn: string): number {
  const timeValue = parseInt(expiresIn.slice(0, -1));
  const timeUnit = expiresIn.slice(-1);

  switch (timeUnit) {
    case "h":
      return timeValue * 60 * 60 * 1000; // hours
    case "d":
      return timeValue * 24 * 60 * 60 * 1000; // days
    case "w":
      return timeValue * 7 * 24 * 60 * 60 * 1000; // weeks
    case "m":
      return timeValue * 30 * 24 * 60 * 60 * 1000; // months (approx)
    default:
      return 24 * 60 * 60 * 1000; // default to 24 hours
  }
}

export const mastraRouter = createTRPCRouter({
  getMastraAgents: publicProcedure
    .output(MastraAgentsResponseSchema) // Output is still the validated array
    .query(async () => {
      const mastraApiUrl = `${MASTRA_API_URL}/api/agents`; // Use environment variable
      try {
        // Use mastraClient to fetch agents
        // const agentsData = await mastraClient.getAgents();
        // // console.log("Mastra API data from client:", agentsData);

        // console.log("Mastra API data from client:", agentsData);
        // Use direct fetch instead of mastraClient
        console.log("Mastra API URL:", mastraApiUrl);
        const response = await fetch(mastraApiUrl);

        if (!response.ok) {
          console.error(`Mastra API returned status ${response.status}`);
          return [];
        }

        const agentsData: unknown = await response.json();
        console.log("Mastra API data from direct fetch:", agentsData);

        // Check if the response is an object and not empty
        const parsedAgents = MastraAgentsMapSchema.safeParse(agentsData);
        if (
          !parsedAgents.success ||
          Object.keys(parsedAgents.data).length === 0
        ) {
          console.error(
            "Mastra API response structure unexpected or empty. Expected a non-empty object.",
            agentsData,
          );
          return [];
        }

        // Transform the object into an array of { id, name, instructions }
        // The structure from the API is Record<string, AgentResponse>
        const transformedAgents = Object.entries(parsedAgents.data).map(
          ([agentId, agentDetails]) => ({
            id: agentId,
            name: agentDetails.name ?? agentId,
            instructions: agentDetails.instructions,
          }),
        );

        // Validate the TRANSFORMED array against the Zod schema
        const validationResult =
          MastraAgentsResponseSchema.safeParse(transformedAgents);
        if (!validationResult.success) {
          console.error(
            "Transformed Mastra agent data validation failed:",
            validationResult.error,
          );
          return []; // Return empty on validation failure
        }

        return validationResult.data; // Return the validated transformed array
      } catch (error) {
        console.error("Failed to fetch or parse from Mastra API:", error);
        // Return empty array if fetch itself fails (e.g., server not running)
        return [];
      }
    }),

  chooseAgent: publicProcedure
    .input(z.object({ message: z.string() }))
    .mutation(async ({ input }) => {
      // 1. load agent embeddings and ensure non-empty
      const embeddings = await loadAgentEmbeddings();
      if (embeddings.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No agent embeddings available",
        });
      }
      const first = embeddings[0]!;
      // 2. embed the user message
      const msgEmbRes = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: [input.message],
      });
      if (!msgEmbRes.data || msgEmbRes.data.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to embed user message",
        });
      }
      const msgVec: number[] = msgEmbRes.data[0]!.embedding;
      // 3. cosine similarity
      let best = { id: first.id, score: -Infinity };
      const magMsg = Math.sqrt(msgVec.reduce((sum, v) => sum + v * v, 0));
      for (const agentVec of embeddings) {
        const vec = agentVec.vector;
        // Compute dot product with safe indexing
        const dot = vec.reduce(
          (sum, v, idx) => sum + v * (msgVec[idx] ?? 0),
          0,
        );
        const magA = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
        const score = magA > 0 && magMsg > 0 ? dot / (magA * magMsg) : 0;
        if (score > best.score) {
          best = { id: agentVec.id, score };
        }
      }
      return { agentId: best.id };
    }),

  callAgent: publicProcedure
    .input(
      z.object({
        agentId: z.string(),
        messages: z
          .array(
            z.object({
              role: z.string(), // e.g. 'user' or 'assistant'
              content: z.string(),
            }),
          )
          .nonempty(),
        threadId: z.string().optional(),
        resourceId: z.string().optional(),
        runId: z.string().optional(),
        output: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { agentId, messages } = input;
      console.log(
        `[mastraRouter] JSON.stringify({ messages }):`,
        JSON.stringify({ messages }),
      );
      const res = await fetch(
        `${MASTRA_API_URL}/api/agents/${agentId}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
        },
      );
      console.log(`[mastraRouter] Mastra generate response:`, res);
      const text = await res.text();
      console.log(`[mastraRouter] Mastra generate response text:`, text);
      if (!res.ok) {
        console.error(
          `[mastraRouter] Mastra generate failed with status ${res.status}: ${text}`,
        );
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Mastra generate failed (${res.status}): ${text}`,
        });
      }
      const parsed = parseJsonSafely(text);
      if (parsed.ok && typeof parsed.value === "object" && parsed.value) {
        const textValue = parsed.value as { text?: JsonValue };
        if (typeof textValue.text === "string") {
          return { response: textValue.text, agentName: agentId };
        }
      }

      return { response: text, agentName: agentId };
    }),

  // API Token Generation for Mastra Agents (NextAuth-aligned)
  generateApiToken: protectedProcedure
    .input(
      z.object({
        name: z.string().optional().default("Mastra Agent Token"),
        expiresIn: z.string().optional().default("24h"), // 24h, 7d, 30d, etc.
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!process.env.AUTH_SECRET) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AUTH_SECRET not configured",
        });
      }

      // Calculate expiration based on input
      const now = new Date();
      const expirationMs = parseExpiration(input.expiresIn);
      const expiresAt = new Date(now.getTime() + expirationMs);

      try {
        // Create a token that works with existing JWT validation
        const tokenPayload = {
          userId: ctx.session.user.id, // Legacy format for compatibility
          sub: ctx.session.user.id, // Standard JWT subject
          email: ctx.session.user.email,
          name: ctx.session.user.name,
          iat: Math.floor(now.getTime() / 1000),
          exp: Math.floor(expiresAt.getTime() / 1000),
          jti: crypto.randomUUID(), // Unique token ID
          tokenType: "api-token", // Identifies as API token
          tokenName: input.name,
          picture: ctx.session.user.image,
        };

        jwt.sign(tokenPayload, process.env.AUTH_SECRET, {
          algorithm: "HS256", // Same as NextAuth default
          issuer: "todo-app",
          audience: "mastra-agents",
        } as jwt.SignOptions);

        // Store token metadata in VerificationToken table
        await ctx.db.verificationToken.create({
          data: {
            identifier: `api-token:${input.name}`,
            token: tokenPayload.jti, // Store token ID, not the actual token
            expires: expiresAt,
            userId: ctx.session.user.id,
          },
        });

        return {
          token: tokenPayload.jti, // Return the UUID instead of the JWT
          tokenId: tokenPayload.jti,
          expiresAt: expiresAt.toISOString(),
          expiresIn: input.expiresIn,
          name: input.name,
          userId: ctx.session.user.id,
        };
      } catch (error) {
        console.error("API token generation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate API token",
        });
      }
    }),

  // List API tokens for the current user
  listApiTokens: protectedProcedure
    .output(
      z.array(
        z.object({
          tokenId: z.string(),
          name: z.string(),
          expiresAt: z.string(),
          expiresIn: z.string(),
          userId: z.string(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      // Query VerificationToken table for API tokens
      const tokens = await ctx.db.verificationToken.findMany({
        where: {
          userId: ctx.session.user.id,
          identifier: {
            startsWith: "api-token:",
          },
        },
        orderBy: {
          expires: "desc",
        },
      });

      // Transform the data to match the expected output format
      return tokens.map((token) => {
        const name = token.identifier.replace("api-token:", "");
        const now = new Date();
        const expiresAt = token.expires;
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();

        // Calculate approximate expiresIn value
        let expiresIn: string;
        if (timeUntilExpiry <= 0) {
          expiresIn = "expired";
        } else if (timeUntilExpiry < 24 * 60 * 60 * 1000) {
          expiresIn = `${Math.ceil(timeUntilExpiry / (60 * 60 * 1000))}h`;
        } else if (timeUntilExpiry < 7 * 24 * 60 * 60 * 1000) {
          expiresIn = `${Math.ceil(timeUntilExpiry / (24 * 60 * 60 * 1000))}d`;
        } else {
          expiresIn = `${Math.ceil(timeUntilExpiry / (7 * 24 * 60 * 60 * 1000))}w`;
        }

        return {
          tokenId: token.token, // This is the JWT ID (jti)
          name: name,
          expiresAt: token.expires.toISOString(),
          expiresIn: expiresIn,
          userId: token.userId,
        };
      });
    }),

  // Revoke API token
  revokeApiToken: protectedProcedure
    .input(
      z.object({
        tokenId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Delete the token from VerificationToken table
      const deleted = await ctx.db.verificationToken.deleteMany({
        where: {
          token: input.tokenId,
          userId: ctx.session.user.id, // Ensure user can only delete their own tokens
          identifier: {
            startsWith: "api-token:",
          },
        },
      });

      if (deleted.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Token not found or access denied",
        });
      }

      return { success: true };
    }),
});
