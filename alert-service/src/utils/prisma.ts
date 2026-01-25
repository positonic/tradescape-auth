import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { config } from "../config.js";

// Singleton Prisma client
let prisma: PrismaClient | null = null;
let pool: pg.Pool | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // Create connection pool
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
    });

    // Create Prisma adapter
    const adapter = new PrismaPg(pool);

    prisma = new PrismaClient({
      adapter,
      log: ["warn", "error"],
    });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
}
