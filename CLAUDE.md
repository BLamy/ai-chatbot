# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI chatbot application built with Next.js 14 and the AI SDK. It provides a chat interface with AI models, document creation/editing, and various artifacts like code, text, images, and sheets.

## Development Commands

```bash
# Installation
pnpm install                # Install dependencies

# Development
pnpm dev                    # Start development server with turbo
vercel env pull             # Pull environment variables 

# Database
pnpm db:migrate             # Run database migrations
pnpm db:generate            # Generate migration files with drizzle-kit
pnpm db:studio              # Open Drizzle Studio for DB visualization
pnpm db:push                # Push schema changes to database
pnpm db:check               # Check schema for issues

# Testing
pnpm test                   # Run all Playwright tests
npx playwright test tests/e2e/chat.test.ts  # Run specific test file
npx playwright test --debug                 # Run tests in debug mode

# Linting & Formatting
pnpm lint                   # Run ESLint and Biome linting
pnpm lint:fix               # Fix linting issues
pnpm format                 # Format code with Biome

# Build & Production
pnpm build                  # Build for production (runs migrations first)
pnpm start                  # Start production server
```

## Docker Setup

A `docker-compose.yml` file is provided for local development with Postgres and Redis:

```bash
docker-compose up -d        # Start Postgres and Redis containers
```

## Architecture Overview

### Core Components

1. **Next.js App Router Structure**
   - `/app/(auth)` - Authentication routes and components
   - `/app/(chat)` - Chat interface, API routes, and pages
   
2. **Database (PostgreSQL + Drizzle ORM)**
   - Schema defined in `/lib/db/schema.ts`
   - Key tables: users, chats, messages, documents, suggestions
   - Migrations in `/lib/db/migrations`
   
3. **AI Integration**
   - Uses AI SDK (@ai-sdk/react, @ai-sdk/xai)
   - Default model is xAI Grok
   - Configurable model selection in `/lib/ai/models.ts` and `/lib/ai/providers.ts`

4. **Authentication**
   - Next-Auth for authentication (v5 beta)
   - Supports guest mode and registered users

5. **Artifacts System**
   - Text, Code, Image, Sheet artifact types
   - Each artifact has client and server implementations
   - Code artifacts support Python execution via Pyodide

### Key Files and Directories

- `/components` - React components for UI
- `/hooks` - Custom React hooks
- `/lib` - Core utilities, database, and AI functionality
- `/tests` - Playwright tests (e2e, routes)
- `/artifacts` - Artifact type definitions and handlers
- `/app` - Next.js App Router structure

## Testing

The project uses Playwright for end-to-end testing:

- Tests organized in `/tests` directory
- E2E tests in `/tests/e2e`
- API tests in `/tests/routes`
- Page objects in `/tests/pages`
- Tests run against a local development server

## Environment Setup

The project requires several environment variables which can be pulled from Vercel:

```bash
vercel link      # Link to Vercel project
vercel env pull  # Pull environment variables
```

Key environment variables:
- `POSTGRES_URL` - PostgreSQL connection string
- Auth provider credentials
- AI provider API keys

## Docker Services

- **PostgreSQL**: Database for chat history and user data
- **Redis**: Used for session management and caching