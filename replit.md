# V9 INFORMÁTICA - ExtratoAI

## Overview
Full-stack Portuguese-language web app for parsing PDF bank statements (Bradesco, Sicoob, Asaas) using OpenAI. Displays transactions in sortable/filterable/editable tables with separate Crédito/Débito columns, running balance, balance evolution chart, and statement history organized by bank account.

## Architecture
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI (gpt-5.1) via Replit AI integrations
- **Auth**: Passport.js local strategy with express-session + connect-pg-simple

## Key Files
- `shared/schema.ts` - Database schema (users, bankAccounts, statements)
- `server/routes.ts` - API routes + PDF parsing + OpenAI integration
- `server/auth.ts` - Authentication setup (passport, sessions)
- `server/storage.ts` - Database storage interface
- `client/src/App.tsx` - Main app with protected routes
- `client/src/pages/dashboard.tsx` - Upload page
- `client/src/pages/history.tsx` - Statement history
- `client/src/pages/statement-detail.tsx` - Statement detail view
- `client/src/pages/login.tsx` - Login page
- `client/src/components/data-table.tsx` - Transaction table with chart
- `client/src/components/layout.tsx` - Sidebar layout with user info + logout
- `client/src/hooks/use-auth.tsx` - Auth context/provider

## Authentication
- Default user: `master` / `master` (seeded on first run)
- Session-based auth with PostgreSQL session store
- Protected routes redirect to /login when not authenticated
- Layout sidebar shows logged-in user and logout button

## Features
- PDF upload with AI-powered transaction extraction
- Support for Bradesco, Sicoob, Asaas bank statements
- Sortable, filterable, editable transaction table
- Separate Crédito (green) / Débito (red) columns
- Running balance per row
- Balance evolution chart (Recharts AreaChart)
- Individual row deletion
- Print-friendly report with V9 logo
- Bank account auto-detection and organization
- Statement history with per-account grouping

## Environment
- `DATABASE_URL` - PostgreSQL connection
- `SESSION_SECRET` - Express session secret
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL

## Logo
- Asset path: `@assets/v92026_1772051277435.png`
