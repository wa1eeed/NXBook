# How to Start NXBook

You don't run the setup manually — Claude Code does it for you.

## Steps

1. Open this folder in Claude Code.
2. Paste the contents of `docs/KICKOFF_PROMPT.md` as your first message.
3. Claude Code will scaffold the app, install dependencies, set up the database, configure i18n, and boot the project — running every command itself.
4. The only thing it will ask YOU for: pasting your real third-party API keys into `.env.development`. It will give you an exact checklist of which keys and where to get them.

## API keys you'll need (have these ready)

| Service | Used for | Where |
|---------|----------|-------|
| Anthropic | AI agents (primary model) | console.anthropic.com |
| OpenAI | AI fallback model | platform.openai.com |
| Cloudflare R2 | File/image storage | dash.cloudflare.com → R2 |
| Moyasar | Payments + credit top-up | dashboard.moyasar.com (test mode first) |
| Twilio | WhatsApp + SMS | console.twilio.com (WhatsApp sandbox to start) |
| Resend | Email | resend.com |
| Sentry | Error monitoring | sentry.io |

The app boots without all of them — each feature just needs its key to actually function.

## After Foundation

Once Claude Code confirms the Foundation slice runs, continue through the build order in `CLAUDE.md` section 15, one slice at a time.
