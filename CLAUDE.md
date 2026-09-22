# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands

- `bun dev` - Start development server with Next.js Turbo
- `bun run build` - Build the application for production
- `bun run check` - Run linting and type checking
- `bun run typecheck` - Run TypeScript type checking only
- `bun run lint` - Run ESLint
- `bun run lint:fix` - Run ESLint with automatic fixes

### Database Commands

- `bun run db:generate` - Generate Prisma client and run migrations
- `bun run db:migrate` - Deploy migrations to database
- `bun run db:push` - Push schema changes to database
- `bun run db:studio` - Open Prisma Studio for database management
- `bun prisma/seed.ts` - Seed the database

### Code Quality

- `bun run format:check` - Check code formatting with Prettier
- `bun run format:write` - Format code with Prettier

### Docker Setup

- `./start-database.sh` - Start PostgreSQL database with Docker

## Architecture Overview

This is a **video transcription and trading analysis platform** built with the T3 Stack (Next.js, tRPC, Prisma, TypeScript).

### Core Technology Stack

- **Frontend**: Next.js 15 App Router, React 18, Mantine UI v7, TailwindCSS
- **Backend**: tRPC for type-safe APIs, NextAuth v5 for authentication
- **Database**: PostgreSQL with Prisma ORM and pgvector extension for embeddings
- **AI/ML**: LangChain with OpenAI integration for transcription and analysis
- **Real-time**: Socket.io for live notifications and alerts
- **Exchange Integration**: CCXT library for unified exchange API access

### Key Architecture Patterns

#### tRPC Router Structure

- `src/server/api/root.ts` - Main API router combining all sub-routers
- `src/server/api/routers/` - Individual feature routers (video, alerts, setups, etc.)
- Type-safe client-server communication with full TypeScript inference

#### Authentication & Authorization

- NextAuth v5 with Discord OAuth provider
- JWT session strategy with custom callbacks
- User session extended with custom fields (user ID, access tokens)

#### Database Schema Highlights

- **Video Management**: YouTube URL processing, transcription storage, semantic search
- **Trading Features**: Setups, alerts, pairs, exchanges with price tracking
- **User Management**: Multi-user support with personalized data isolation
- **Real-time Alerts**: WebSocket-based notifications for price/candle alerts

#### AI Tool Integration

- LangChain-based tool system in `src/server/tools/`
- Video search, content analysis, and trading analysis tools
- Context-aware tools that access user data and preferences

#### Real-time Features

- Socket.io client in `src/lib/socketService.ts`
- Alert notifications with Mantine UI integration
- User-specific notification channels

#### Exchange Integration

- **CCXT Library**: Unified interface for cryptocurrency exchange APIs
- **Documentation**: https://docs.ccxt.com/
- **Usage**: Primary exchange abstraction layer in `src/app/tradeSync/exchange/Exchange.ts`
- **Supported Exchanges**: Binance, Kraken, Bybit, Hyperliquid
- **Features**: Trade fetching, balance retrieval, order management, position tracking

### Development Notes

#### Environment Configuration

- Uses `@t3-oss/env-nextjs` for validated environment variables
- Required: `DATABASE_URL`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`
- Client-side: `NEXT_PUBLIC_SOCKET_SERVER_URL` for WebSocket connections

#### UI Components

- Mantine v7 as primary UI library with custom theming
- TailwindCSS for additional styling
- Geist Sans font family throughout the application

#### Code Quality Rules

- Strict TypeScript configuration
- ESLint with Next.js rules
- Prettier for code formatting
- Follows Next.js App Router patterns
- Uses double quotes consistently

## Code Quality and Build Requirements

### TypeScript Strict Mode Compliance

- **ALWAYS use proper TypeScript types** - never use `any` or `unknown` without explicit type assertions
- **Use nullish coalescing (`??`) instead of logical OR (`||`)** for default values
- **Add proper null checks** for potentially undefined values using optional chaining (`?.`)
- **Import types with `import type`** when only using them as types, not runtime values

### Import Path Standards

- **Use relative imports** (`../interfaces/Trade`) instead of absolute path aliases (`@/interfaces/Trade`)
- **Always verify import paths exist** before using them
- **Create missing interface files** when referenced by imports

### Required Code Patterns

```typescript
// ✅ Good - Proper typing and null safety
interface TimeBasedObject {
  time: number | bigint;
}

const result = data?.property ?? "default";
const payload = JSON.parse(text) as ExpectedType;

// ❌ Bad - Will break build
const result = data.property || "default";
const payload = JSON.parse(text);
```

### ESLint-Specific Patterns (Build-Breaking)

These patterns are enforced by `@typescript-eslint/stylistic-type-checked` and will fail builds:

```typescript
// ✅ Good - Use RegExp.exec() instead of String.match()
const match = /pattern/.exec(text);
if (match?.[1]) {
  console.log(match[1]);
}

// ❌ Bad - Will break build with @typescript-eslint/prefer-regexp-exec
const match = text.match(/pattern/);

// ✅ Good - Wrap functions in useCallback when used in effect dependencies
const connectToData = useCallback(() => {
  // connection logic
}, [dependency1, dependency2]);

useEffect(() => {
  connectToData();
}, [connectToData]);

// ❌ Bad - Function reference changes on every render
const connectToData = () => {
  // connection logic
};

useEffect(() => {
  connectToData(); // Warning: react-hooks/exhaustive-deps
}, [connectToData]);

// ✅ Good - Remove unused imports
import { useState } from "react";

// ❌ Bad - Will break build with @typescript-eslint/no-unused-vars
import { useState, useCallback } from "react"; // useCallback not used
```

### Build Validation Process

**CRITICAL: Always validate code before considering work complete**

1. **After generating/modifying code, ALWAYS run:**

   ```bash
   bun run check  # Runs both linting and type checking
   ```

2. **If `bun run check` fails:**

   - Fix ESLint errors immediately (these break Vercel builds)
   - Fix TypeScript errors immediately
   - Address ESLint warnings if they indicate code quality issues

3. **Before major changes:**

   - Run `bun run typecheck` to catch type issues early
   - Test import paths by running typecheck after adding new files

4. **For React/Next.js code:**

   - Use the `react-best-practices` skill proactively
   - Follow hook dependency rules strictly
   - Wrap event handlers in `useCallback` when used in effects

5. **Use proper interface definitions** for all data structures

### ESLint Rule Compliance

- **Remove unused imports and variables** immediately
- **Use proper dependency arrays** in React hooks
- **Prefer const assertions** over type assertions where possible

#### Database Development

- PostgreSQL with pgvector extension for semantic search
- **ALWAYS use Prisma migrations for schema changes** - never modify schema.prisma without creating migrations
- Prisma migrations in `prisma/migrations/`
- Seeding functionality available for development data

**IMPORTANT**: Always create proper migration files when changing the schema:

1. First, modify the schema.prisma file
2. Run `bun prisma migrate dev --name descriptive_migration_name` to create a migration file
3. This will automatically apply the migration and regenerate the Prisma client

Do NOT use `db:push` as it bypasses the migration system. Migrations are essential for:

- Team collaboration and version control
- Production deployments
- Database schema history tracking
- Rollback capabilities

#### How migrations reach production

`.github/workflows/migrate.yml` runs `prisma migrate deploy` on every push to
`main` (and on demand via **Actions → Migrate Database → Run workflow**, which
has a dry-run option that only reports what is pending).

It reads `MIGRATION_DATABASE_URL`, falling back to `DATABASE_URL`, from the
`production` GitHub Environment. Set `MIGRATION_DATABASE_URL` to the **direct**
connection string if the app connects through a pooler — Supabase, Neon and
PgBouncer in transaction mode cannot run the advisory locks and DDL that Prisma
Migrate needs.

Vercel builds on the same push, so the migration and the deploy race. Migrations
finish in seconds and the Next build takes minutes, so the database is ready
first in practice — but do not rely on it. Ship schema changes expand/contract:
the additive migration plus code that tolerates both shapes first, the
destructive change in a later release.

`.github/workflows/ci.yml` has a `migrations` job that runs on every PR against
a throwaway pgvector database. It applies every migration from scratch, fails if
`schema.prisma` and `prisma/migrations` disagree (the "edited the schema, forgot
the migration" mistake), and fails if re-applying is not a no-op. A migration
that cannot reach production cleanly should not be mergeable.

### Current Feature Set

- **Video Processing**: YouTube URL ingestion, transcription, chunk-based indexing
- **Trading Analysis**: Setup tracking, alert management, pair monitoring
- **User Management**: Discord authentication, personalized dashboards
- **Real-time Notifications**: WebSocket-based alert system
- **AI Chat Interface**: LangChain-powered assistant with tool integration

## API Key Storage & Security

### Key Storage Mechanism

The application uses a sophisticated encrypted key storage system for exchange API credentials:

#### Client-Side Storage

- **Encryption**: AES encryption using `CLIENT_ENCRYPTION_KEY` environment variable
- **Storage**: Encrypted keys stored in browser's `localStorage`
- **Expiration**: Keys expire after 24 hours for security
- **Location**: `src/lib/keyEncryption.ts` - `KeyStorage` class

#### Transmission Security

- **Double Encryption**: Keys are re-encrypted for each server transmission
- **Timestamp Validation**: Server validates timestamp (5-minute window)
- **Client ID**: Each transmission includes a unique client identifier
- **Automatic Cleanup**: Invalid/expired keys are automatically removed

#### Usage Pattern

```typescript
// Check if keys exist
const hasKeys = KeyStorage.hasKeys();

// Load and decrypt keys
const keys = KeyStorage.load();

// Save keys with optional persistence
KeyStorage.save(keys, rememberMe);

// Encrypt for server transmission
const encrypted = encryptForTransmission(keys);
```

### Debugging Key Storage Issues

#### Common Issues

1. **No Keys Found**: Check if keys are stored with "Remember Keys" option
2. **Expired Keys**: Keys expire after 24 hours, need to re-add
3. **Encryption Errors**: Check `CLIENT_ENCRYPTION_KEY` environment variable

#### Debugging Commands

```bash
# Check browser localStorage for keys
localStorage.getItem('encrypted_exchange_keys')

# Enable detailed logging (already added)
# Check browser console for key-related logs with emojis:
# 🔍 🔑 🔐 ⚠️ ❌ ✅
```

#### Debug Environment Variables

```bash
# Client-side encryption (in .env.local)
NEXT_PUBLIC_CLIENT_ENCRYPTION_KEY=your-client-key

# Server-side encryption (in .env)
SERVER_ENCRYPTION_KEY=your-server-key
```

### Supported Exchanges

- **Binance**: API Key + Secret
- **Kraken**: API Key + Secret
- **Bybit**: API Key + Secret
- **Coinbase Pro**: API Key + Secret + Passphrase
- **KuCoin**: API Key + Secret + Passphrase
- **OKX**: API Key + Secret + Passphrase
- **Hyperliquid**: Wallet Address only
