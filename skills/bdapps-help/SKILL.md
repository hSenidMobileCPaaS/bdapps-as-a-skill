---
name: bdapps-help
description: Quick reference for the bdapps skill — available commands, services (telco and bdappsAI), and which reference document covers what. Use when the user asks what the bdapps skill can do.
---

# bdapps skill — quick reference

## Tooling

```bash
node tools/bdapps.mjs help        # every command
node tools/bdapps.mjs list        # every service and callback
node tools/bdapps.mjs platform    # base URLs, operators, conventions
node tools/bdapps.mjs bdappsai    # the bdappsAI AI gateway: auth, models, errors
node tools/bdapps.mjs sdk         # the Subscription Charging SDK consent redirect
```

Offline, zero-dependency, read-only, and it never sees your credentials. Add `--json` to any
command for machine-readable output.

| Command | Answers |
|---|---|
| `list [category]` | What services exist? |
| `show <id>` | What exactly does this call take and return? |
| `search "<query>"` | Which service does the thing I want? |
| `curl <id> [k=v]` | Give me a runnable request, with the parameters and response defined. |
| `validate <id> '<json>'` | Is this payload correct? |
| `code <statusCode>` | What does this error mean and what do I do? |
| `diagnose "<symptom>"` | Why is this not working? |
| `practices [severity]` | What must I not get wrong? |
| `checklist` | Am I ready for production? |
| `reference <doc>` | Show me the full guide. |
| `bdappsai [models\|errors]` | How do I call the AI gateway, and what can go wrong? |
| `sdk` | How does the hosted consent page work, and what signs the redirect? |

## Skills

| Skill | Use it for |
|---|---|
| `bdapps` | General bdapps work; the rules and the service map |
| `bdapps-scaffold` | Starting a new integration |
| `bdapps-callbacks` | Inbound webhooks |
| `bdapps-review` | Auditing existing code |
| `bdapps-debug` | A failing call or callback |
| `bdapps-golive` | The pre-production checklist |
| `bdapps-ai` | The bdappsAI AI gateway — chat completions and image generation |

## Services covered

**SMS** — send (MT), broadcast, receive (MO), delivery reports
**USSD** — send screens, receive input, session handling
**Subscription** — register, unregister, status, query base size, notifications
**OTP** — request, verify
**Subscription Charging SDK** — the signed consent redirect to a bdapps-hosted page
**CaaS** — direct debit, balance query, reconciling an ambiguous charge

bdapps publishes **no LBS/location API, no voice/IVR API and no charging-notification
callback**. Say so rather than inventing an endpoint.

**bdappsAI** — chat completions (`claude-sonnet-4-6`, `gemini-3.1-pro-preview`,
`gemini-3.1-flash-lite`, `gpt-5-nano`, `gpt-4o-mini`) and image generation (`gpt-image-1.5`). A **separate product**: its key goes in an
`Authorization` header, it returns real HTTP status codes rather than `S1000`, it has no
subscriber and no callbacks, and it needs its own client. `references/14-bdapps-ai.md`.

## References

`01-getting-started` · `02-sms` · `03-ussd` · `04-subscription` · `05-caas` · `06-otp` ·
`07-callbacks` · `08-status-codes` · `09-security-best-practices` · `10-production-checklist` ·
`11-any-stack` · `12-implementation-playbook` · `13-curl-reference` · `14-bdapps-ai`

## Writing the call

**`references/13-curl-reference.md`** is where every call comes from: each endpoint at the wire
— a runnable curl, every parameter defined, the response, every response field explained, that
endpoint's status codes — plus all four callbacks with a replay command and both bdappsAI
endpoints with their own auth and error tables. Translate the request into the project's own
HTTP client; that is the integration.

```bash
node tools/bdapps.mjs curl subscription-query-base            # the cheapest call to prove setup
node tools/bdapps.mjs curl sms-send message="Hi" \
  destinationAddresses='["tel:8801812345678"]'                    # filled in and validated
node tools/bdapps.mjs reference 13-curl-reference             # the whole page
```

There is no code generator: an emitter would cover a few languages and age with their idioms,
where a curl is the same call in all of them and stays true.

## Languages

The integration can be written in **any** language — bdapps is JSON over HTTPS. The curl
reference covers every endpoint with no tooling at all; worked implementations ship for
TypeScript/Node, Python, Java, Go, PHP and C# (`templates/README.md`) to read for shape; and
`references/11-any-stack.md` specifies the same seven components language-neutrally for
anything else. The CLI above needs Node, but it is only a documentation reader.

## The things to remember

1. **HTTP 200 does not mean success** — branch on `statusCode`.
2. **Credentials live in environment variables**, and bdapps is called from the backend only.
3. **Charging is idempotent on `externalTrxId`**, or you double-charge a real person.
4. **bdappsAI follows none of the above** — header auth, real HTTP status codes, its own key and
   its own balance. Keep it in a separate client.

Support: `support@bdapps.com` · WhatsApp +8801878977505 · <https://dev.bdapps.com>
