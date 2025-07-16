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

#### Database Development
- PostgreSQL with pgvector extension for semantic search
- Prisma migrations in `prisma/migrations/`
- Seeding functionality available for development data

### Current Feature Set
- **Video Processing**: YouTube URL ingestion, transcription, chunk-based indexing
- **Trading Analysis**: Setup tracking, alert management, pair monitoring
- **User Management**: Discord authentication, personalized dashboards
- **Real-time Notifications**: WebSocket-based alert system
- **AI Chat Interface**: LangChain-powered assistant with tool integration