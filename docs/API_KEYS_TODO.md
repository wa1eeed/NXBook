# API Keys to Paste — NXBook dev

All local infra (Postgres, Redis, auth secrets, encryption key) is already filled in
`.env.development` with working local values. The app boots and runs without the keys
below — each one only unlocks the feature it belongs to. Replace the matching
`TODO_PASTE_*` placeholder in `.env.development`, then restart `npm run dev`.

| Env var(s) | Feature it unlocks | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI agents (primary model) | https://console.anthropic.com → Settings → API Keys |
| `OPENAI_API_KEY` | AI agents (fallback model) | https://platform.openai.com/api-keys |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | File/logo uploads (Cloudflare R2) | Cloudflare dashboard → R2 → "Manage R2 API Tokens"; account ID is on the R2 overview |
| `MOYASAR_SECRET_KEY`, `MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_WEBHOOK_SECRET` | Subscriptions + credit top-up (use **test** keys in dev) | Moyasar dashboard → Settings → API keys; webhook secret under Settings → Webhooks |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` | WhatsApp + SMS reminders | https://console.twilio.com (SID/token on the dashboard; buy a number for `SMS_FROM`). `TWILIO_WHATSAPP_FROM` is preset to the Twilio sandbox number. |
| `RESEND_API_KEY` | Transactional email | https://resend.com/api-keys |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring | Sentry → Project → Settings → Client Keys (DSN). Paste the same DSN into both. |

Optional (only for CI source-map upload, leave blank locally):
`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

> The 32-char `JWT_ENCRYPTION_KEY` and `NEXTAUTH_SECRET` are randomly generated dev
> values — regenerate fresh ones for staging/production, never reuse these.
