# AGENTS.md - Coding Agent Guidelines

## Build & Test Commands

- `bun run check` - Run linting and type checking (ALWAYS run before commits)
- `bun run typecheck` - TypeScript type checking only
- `bun run lint` - ESLint checking
- `bun run lint:fix` - Auto-fix ESLint issues
- `bun run build` - Production build
- `bun dev` - Start development server
- `bun run db:generate` - Generate Prisma client and run migrations

## Code Style & Standards

- **TypeScript**: Strict mode enabled, never use `any`, prefer interfaces over types
- **Imports**: Use `~/` path alias, prefer `import type` for type-only imports
- **Formatting**: Double quotes, 2-space indentation, trailing commas
- **Naming**: camelCase for variables/functions, PascalCase for components, kebab-case for directories
- **Error Handling**: Use nullish coalescing (`??`) over logical OR (`||`), optional chaining (`?.`)

## Framework Patterns

- **Next.js 15**: App Router, Server Components by default, minimize 'use client'
- **tRPC**: Type-safe APIs in `src/server/api/routers/`, use protectedProcedure for auth
- **Mantine v7**: Primary UI library with TailwindCSS for additional styling
- **NextAuth v5**: Authentication with Discord OAuth, check existing config
- **Prisma**: PostgreSQL ORM with pgvector extension for embeddings

## Required Practices

- Run `bun run typecheck` before any major changes
- Follow ESLint rules strictly (no unused vars, proper async patterns)
- Use relative imports for local files, absolute for external packages
- Implement proper null checks and type safety
- Never commit without passing lint/typecheck
