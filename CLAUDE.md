# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

This is a Turborepo monorepo named **kodex** using Bun as the package manager and runtime.

- `apps/web` — Bun + React 19 frontend/fullstack app (no Vite, no Next.js)
- `apps/chat-service` — Express-based backend service
- `packages/ui` — Shared React component library
- `packages/eslint-config` — Shared ESLint configurations
- `packages/typescript-config` — Shared TypeScript configs (`base.json`, `bun.json`, `react-library.json`)

## Commands

All commands use Bun. Run from the repo root to operate across all apps, or `cd` into an app directory to target it specifically.

```bash
# Root (all workspaces via Turbo)
bun run dev          # Start all apps in dev mode
bun run build        # Build all apps
bun run lint         # Lint all apps
bun run check-types  # Type-check all apps
bun run format       # Prettier format all TS/TSX/MD files

# apps/web
bun --hot src/index.ts        # Dev server with HMR
bun start                      # Production server

# apps/chat-service
bun --watch src/index.ts      # Dev with file watching

# Testing (within any app)
bun test
bun test <file>                # Run a single test file
```

## Bun APIs — Use Instead Of

- `Bun.serve()` for HTTP servers — not `express` (preferred in new code)
- `bun:sqlite` — not `better-sqlite3`
- `Bun.redis` — not `ioredis`
- `Bun.sql` — not `pg` or `postgres.js`
- `WebSocket` built-in — not `ws`
- `Bun.file` — not `fs.readFile`/`fs.writeFile`
- `Bun.$\`cmd\`` — not `execa`
- Bun auto-loads `.env` — don't use `dotenv`

## apps/web Architecture

The web app uses Bun's native server with HTML imports — no bundler config needed:

- `src/index.ts` — `Bun.serve()` entry: defines API routes and serves `index.html` for all other paths
- `src/index.html` — HTML shell that imports `src/frontend.tsx` as a module script
- `src/frontend.tsx` — React DOM root setup with HMR support via `import.meta.hot`
- `src/App.tsx` — Root React component
- Path alias `@/*` maps to `./src/*`

Adding new API routes: add them to the `routes` object in `src/index.ts`. Bun's bundler handles TSX/CSS imports from HTML automatically.

## apps/chat-service Architecture

Express 5 server with Zod for validation. Entry point is `src/index.ts`. The service exposes a `/status` health check endpoint. Port is read from `process.env.NODE_ENV` (likely a bug — intended to be a `PORT` env var).
