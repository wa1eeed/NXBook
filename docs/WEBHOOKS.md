# Webhooks

NXBook receives **inbound** webhooks from Moyasar (payments) and Twilio
(message delivery). Both are signature-verified before processing (CLAUDE.md
§7). **Outbound** webhooks (notifying tenant systems) are part of the planned
Public API and not yet implemented.

> Inbound webhook routes are **excluded from auth/locale middleware** (the
> matcher skips `/api`). They authenticate via signatures, not sessions.

---

## Moyasar — `POST /api/webhooks/moyasar`

Handles subscription/payment events and credit top-ups.

**Verification:** the raw request body is HMAC-SHA256'd with
`MOYASAR_WEBHOOK_SECRET` and compared to the `x-moyasar-signature` header.
Invalid/missing signatures are rejected with **401** before any processing.

**Events handled:**
| Event | Effect |
|-------|--------|
| `payment.paid` (metadata `credit_topup`) | Credits the tenant's `CreditAccount` + records a `CreditTx` (transactional). |
| `payment.paid` (metadata `subscription_payment`) | Marks the matching `Invoice` paid. |
| `payment.failed` (subscription) | Sets the `Subscription` to `PAST_DUE`. |
| `subscription.deactivated` | Sets the `Subscription` to `CANCELLED`. |

Metadata carries `businessId` (and `type`, `amountSar`) so the handler can scope
the effect to the right tenant.

**Configure in Moyasar:** point the webhook to
`https://<your-domain>/api/webhooks/moyasar` and set the signing secret to match
`MOYASAR_WEBHOOK_SECRET`.

---

## Twilio — `POST /api/webhooks/twilio`

Receives message **status callbacks** (delivered, failed, …) and updates the
matching `NotificationLog` row by its `externalId` (the Twilio message SID).

**Configure in Twilio:** set the status-callback URL on your messaging
service / number to `https://<your-domain>/api/webhooks/twilio`.

---

## Testing locally

Webhook senders need a public URL. Use a tunnel (e.g. `cloudflared` or `ngrok`)
to expose `http://localhost:3000`, then point the provider's webhook at the
tunnel URL. For Moyasar, compute the HMAC of the body with your dev secret to
craft a valid `x-moyasar-signature` when sending test payloads with `curl`.

---

## Roadmap: outbound webhooks

The Public API phase will add tenant-configurable outbound webhooks (e.g.
`booking.created`, `booking.cancelled`, `waitlist.confirmed`) signed with a
per-tenant secret, so external systems can react to events in NXBook.
