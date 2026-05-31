# Contributing

Thanks for working on NXBook. This guide captures the conventions that keep the
codebase consistent and safe.

---

## Golden rules

1. **Read `CLAUDE.md` first.** It's the single source of truth for architecture,
   multi-tenancy, i18n, security, and the build order.
2. **English code, i18n'd UI.** All code/comments/identifiers in English; all
   user-facing text via next-intl. Keep `messages/en.json` and `messages/ar.json`
   at **strict key parity**.
3. **Tenant isolation is non-negotiable.** Scope every data access by
   `businessId` from the session (dashboard) or resolved slug/domain (public).
   Never trust a client-supplied `businessId`.
4. **Validate inputs with Zod** before any logic, in every Server Action and
   route.

---

## Workflow

- Build in **vertical slices** — a change should work end-to-end (backend wired
  to UI), not "infra now, UI later."
- Before committing:
  ```bash
  npx tsc --noEmit      # no type errors
  npm run build         # production build passes
  npm run lint
  ```
- Verify i18n parity (see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)).
- For service-layer changes, run a throwaway `tsx` script against a `*-test`
  business and clean it up (leave the DB at seed-only state).

---

## Commit messages

Imperative, scoped, concise:

```
feat(waitlist): auto-offer freed slot to next in line
fix(i18n): restore missing ar.json reports keys
docs: add ARCHITECTURE and DEPLOYMENT
```

---

## Adding things

- **A new agent:** create `src/agents/<name>-agent.ts` extending `AgentPlugin`,
  register it in `src/agents/registry.ts`. No core changes needed.
- **A new dashboard section:** add a page under `src/app/dashboard/<section>`,
  a server action file (scoped via `requireBusiness()`), and i18n keys in both
  message files. Add the nav entry in `src/components/dashboard/sidebar.tsx`.
- **A schema change:** edit `prisma/schema.prisma`, run `npm run db:migrate`,
  regenerate the client. Index every FK and any column used in WHERE/ORDER BY.
- **A new dependency:** confirm it's warranted (CLAUDE.md pins the stack);
  prefer building small primitives over adding libraries.

---

## Security checklist (for any networked change)

- [ ] Input validated with Zod.
- [ ] AuthZ: session + role + tenant ownership checked.
- [ ] Query scoped by `businessId`.
- [ ] Secrets from env only; nothing logged in plaintext.
- [ ] Webhooks verify signatures.
- [ ] Sensitive actions call `recordAudit(...)`.
