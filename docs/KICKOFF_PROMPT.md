# NXBook — Kickoff Prompt for Claude Code

Copy-paste everything below as your FIRST message to Claude Code, with this folder open.

---

You are building NXBook. Read `CLAUDE.md` in full before doing anything — it is the single source of truth (architecture, multi-tenancy, i18n with English primary / Arabic secondary, security, custom domains, AI strategy, build order).

This folder already contains foundation files you must NOT rebuild from scratch. Treat them as the base and build around them:
- `prisma/schema.prisma` + `prisma/seed.ts`
- `src/lib/` (prisma, redis, auth, ai, notification, payment, storage)
- `src/middleware.ts`, `src/types/next-auth.d.ts`
- `src/app/api/` (webhooks, upload)
- `messages/en.json`, `messages/ar.json`
- `docker-compose.yml`, `Dockerfile`, `.env.development.example`

## Do ALL of the setup yourself — do not ask me to run commands

Run every step below yourself using your shell. Only pause for the ONE thing you cannot do: filling real API credentials (that's mine to provide). For everything else, execute, verify, and report.

1. Initialize a Next.js 15 app IN THIS FOLDER (TypeScript, Tailwind, App Router, src dir, import alias `@/*`) without overwriting the existing files listed above. If create-next-app needs an empty dir, scaffold in a temp dir and merge, preserving all existing foundation files.
2. Install all dependencies from CLAUDE.md section 3 (Prisma, next-auth@beta, @auth/prisma-adapter, bullmq, ioredis, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, @anthropic-ai/sdk, openai, @sentry/nextjs, resend, twilio, bcryptjs, zod, @tanstack/react-query, react-hot-toast, date-fns, cron, next-intl) plus dev deps (@types/bcryptjs, tsx). Initialize shadcn/ui.
3. Wire up the project scripts in package.json (db:push, db:migrate, db:seed, db:studio, workers).
4. Copy `.env.development.example` to `.env.development`. Fill every value you safely can with sensible local defaults (DB/Redis URLs, NODE_ENV, app URLs, secrets via generated random strings). Leave ONLY the third-party API keys as clearly-marked TODO placeholders, and at the end give me a short checklist of exactly which keys I need to paste and where to get them.
5. Start local Postgres + Redis via `docker compose up -d db redis`. Verify they're healthy.
6. Run `npx prisma generate`, then the first migration (`prisma migrate dev --name init`), then the seed.
7. Set up next-intl end to end: locale routing, `en` primary + `ar` secondary, automatic `dir="rtl"`/`dir="ltr"`, and language switching for the three contexts in CLAUDE.md section 2. Use logical CSS properties everywhere.
8. Apply the schema changes CLAUDE.md requires that aren't in the foundation yet: add `defaultLocale` to `Business`, add the `CustomDomain` model. Migrate again.
9. Initialize Sentry for all 3 environments.
10. Confirm the app boots (`npm run dev`) and a basic localized page renders correctly in BOTH English (LTR) and Arabic (RTL).

After completing the above, STOP. Give me:
- a summary of what now exists and runs,
- the exact list of API keys I must paste (and where each comes from),
- confirmation the Foundation slice (CLAUDE.md section 15, step 1) is complete.

Do NOT build past the Foundation slice until I confirm. Go step by step, run things yourself, verify each step, and fix errors before moving on. Ask before adding any dependency not in CLAUDE.md. Use Claude Opus 4.8.
