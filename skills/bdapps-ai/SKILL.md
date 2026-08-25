---
name: bdapps-ai
description: Build against bdappsAI, bdapps's AI gateway — chat completions across Claude, Gemini and GPT models, and image generation, on an OpenAI-shaped API billed from a bdapps token balance. Use whenever the user mentions bdappsAI, developer.bdapps.com/bdappsai, `developer.bdapps.com/bdappsai`, a bdapps AI or LLM feature, chat completions, model routing, or generating images through bdapps — and whenever an AI answer has to reach a subscriber over SMS or USSD.
---

# bdappsAI — the bdapps AI gateway

One OpenAI-shaped API in front of several model providers, authenticated once against bdapps
and billed from a bdapps token balance.

```bash
node tools/bdapps.mjs bdappsai                 # auth, endpoints, models, rules
node tools/bdapps.mjs bdappsai models          # what each model is for
node tools/bdapps.mjs bdappsai errors          # every failure and its fix
node tools/bdapps.mjs show bdappsai-chat-completions
node tools/bdapps.mjs curl bdappsai-chat-completions model=claude-sonnet-4-6
node tools/bdapps.mjs validate bdappsai-chat-completions '<json>'
node tools/bdapps.mjs code TOKEN_QUOTA_EXCEEDED
```

Full contract: **`references/14-bdapps-ai.md`**. Every endpoint as a runnable curl with each
parameter defined: **`references/13-curl-reference.md`**, section *The AI gateway — bdappsAI*.

## Read this before writing a line

**bdappsAI is not the telco platform.** It shares the brand, the portal login and the
`developer.bdapps.com` host, and nothing else. Every convention the rest of this skill teaches is
inverted here:

| | Telco APIs | bdappsAI |
|---|---|---|
| Credential | `applicationId` + `password` in the **body** | one key in the `Authorization` **header** |
| Key source | bdapps Pro provisioning | the bdappsAI portal — a **different** key |
| Failures | HTTP 200 always; branch on `statusCode` | real HTTP status codes; branch on the status, then `error.code` |
| Success | `statusCode: "S1000"` | HTTP 2xx. There is no `statusCode` field |
| Subject | a subscriber, `tel:88018…` | no subscriber, no MSISDN, no operator |
| Inbound | four callbacks you host | none. bdappsAI never calls you |
| Timeout | 15s | 60–120s |

**So keep two clients.** A single shared HTTP helper applies exactly one of these conventions
and is wrong for half the calls. The classic bug is a bdappsAI client that checks `res.ok`, then
looks for `statusCode`, finds nothing, and reports a good answer as a failure.

## Auth

```
Authorization: app_<keyId>.<keyValue>
```

Verbatim, including `app_`. **Not** an OAuth bearer token — no `Bearer` prefix, no base64. Not
your bdapps application password. From `BDAPPSAI_API_KEY`, backend only.

It is a **spend key** against a prepaid balance, and unlike the telco APIs it is **not
IP-whitelisted** — a leak works from anywhere in the world until you rotate it at
<https://developer.bdapps.com/bdappsai>.

## Endpoints

| Endpoint | Purpose | Variable |
|---|---|---|
| `POST /bdappsai/api/v1/chat/completions` | chat, on `claude-sonnet-4-6`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite`, `gpt-5-nano`, `gpt-4o-mini` | `BDAPPSAI_CHAT_COMPLETIONS_URL` |
| `POST /bdappsai/api/v1/images/generations` | images, on `gpt-image-1.5` | `BDAPPSAI_IMAGE_GENERATIONS_URL` |

Base: `https://developer.bdapps.com/bdappsai/api`.

## Six rules that are never negotiable

1. **Cap every call.** `max_completion_tokens` on every chat request, `n` at 1, image `quality`
   at `low` unless the image is the product. Without a ceiling one loop empties the balance and
   takes every AI feature down with a `402`.
2. **Redact before the prompt.** No MSISDN, no `subscriberId` (a masked hash is still a stable
   identifier), no OTP, no credential, no `externalTrxId` — not in `messages`, not in `prompt`,
   not in `user`, `safety_identifier` or `prompt_cache_key`. Prompts leave your trust boundary
   and reach a third-party provider. Keep `store` false.
3. **Check `finish_reason` before using the content.** `length` means the answer is cut off
   mid-sentence; the request succeeded, the answer did not.
4. **Branch on `error.code`, not the message.** The two `429`s differ:
   `RATE_LIMIT_EXCEEDED` clears within the minute, `TOKEN_QUOTA_EXCEEDED` never will —
   retrying it burns your attempts and delays the alert that would fix it.
5. **Never call a model inside a callback response path.** bdapps wants `S1000` immediately
   and USSD sessions die in seconds. Acknowledge first, generate out of band, deliver by MT SMS
   or on the next USSD screen.
6. **Treat model output as untrusted input.** Never execute it, never interpolate it into SQL or
   a shell, and never send it to a subscriber unchecked — 160 GSM-7 characters per SMS part, 70
   for Bengali, and every part is billed.

## Retry policy

Retry with capped exponential backoff and jitter: `429` + `RATE_LIMIT_EXCEEDED` (honour
`Retry-After`), `500`, `502`, `503`, and transport errors. Never retry `400`, `401`, `403`,
`404`, `402`, or `429` + `TOKEN_QUOTA_EXCEEDED` — alert on those instead. Chat completions have
no idempotency key, so a timed-out call may already have been billed: cap retries at two.

`INVALID_LLM_CONFIG` is the bdappsAI `E1309` — provisioning, not payload. No reformatting fixes it.

## Build it in the project's own stack

Same as everywhere else in this skill: two HTTPS POSTs, no privileged runtime, no SDK required.
Translate the curl in `references/13-curl-reference.md` into the host project's HTTP client.
`references/11-any-stack.md` specifies the surrounding components; `references/14-bdapps-ai.md`
lists the four that behave differently for bdappsAI, and closes with a pre-ship checklist.

Related skills: `bdapps` (the telco platform), `bdapps-callbacks` (what an AI flow must not
block), `bdapps-review`, `bdapps-debug`.
