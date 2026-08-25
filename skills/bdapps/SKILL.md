---
name: bdapps
description: Build and integrate bdapps (Robi Axiata's Bangladeshi telco platform) services — SMS, USSD, Subscription (register, unregister, status, query base size), OTP, the Subscription Charging SDK, and CaaS charging (direct debit, balance query) — plus bdappsAI, the bdapps AI gateway. Use whenever the user mentions bdapps, bdapps Pro, bdapps Lite, developer.bdapps.com, user.bdapps.com, TAP, MSISDN/`tel:` addressing, shortcode/keyword, USSD menus, subscriber base size, direct carrier billing, mobile-account charging, telco SMS/USSD in Bangladesh or on Robi/Airtel, or bdappsAI.
---

# bdapps

bdapps is Robi Axiata's telco platform for Bangladesh — Robi (018, 016) and Airtel Bangladesh
(016). It exposes SMS, USSD, subscription lifecycle, OTP verification and mobile-account
charging as JSON-over-HTTPS APIs on one host, `https://developer.bdapps.com`.

It publishes **no LBS/location API, no voice/IVR API and no charging-notification callback**.
If a requirement needs one, say so rather than inventing a path.

It also runs **bdappsAI**, an AI gateway (chat completions on Claude, Gemini and GPT models, plus
image generation). It shares the host and nothing else — header credentials, real HTTP status
codes, no subscriber, no callbacks. For anything AI-shaped go to the `bdapps-ai` skill or
`references/14-bdapps-ai.md`, and do **not** apply the rules below to it.

## Do this first — do not recall parameter names, query them

```bash
node tools/bdapps.mjs list                          # what exists
node tools/bdapps.mjs show <id>                     # exact contract
node tools/bdapps.mjs curl <id> [key=value ...]     # runnable request + param/response defs
node tools/bdapps.mjs validate <id> '<json>'
node tools/bdapps.mjs code <statusCode>
node tools/bdapps.mjs bdappsai                      # the AI gateway, which follows none of this
node tools/bdapps.mjs sdk                           # the Subscription Charging SDK redirect
```

**`references/13-curl-reference.md` is where every call comes from** — every endpoint as a
runnable curl, every parameter defined, the response and every response field, the status codes
that endpoint returns, and all four callbacks with a command that replays each against your
handler. Translate the request into the host project's HTTP client and idiom; that is the call,
in any language. It is also the first thing to run by hand when a call fails.

There is no code generator in this skill by design: an emitter would cover a handful of
languages and age with their idioms, while the contract and the curl above stay true for all of
them. Write the code in the project's own conventions.

Full command list: `node tools/bdapps.mjs help`. Add `--json` for machine-readable output.
If you cannot run commands, or Node is not installed, read `catalog/bdapps-api.json` — same
data, plain JSON. The CLI is a documentation reader; the integration itself can be in **any
language**.

## Five rules that are never negotiable

1. **Credentials come from environment variables.** Never hardcoded, never in a client
   bundle, never logged, never committed. Never a browser-exposed prefix
   (`NEXT_PUBLIC_`/`VITE_`/`REACT_APP_`/`PUBLIC_`/`EXPO_PUBLIC_`).
2. **bdapps is called from the backend only.** IP whitelisting is enforced; a client cannot
   satisfy it, and the credentials are a shared secret.
3. **Explicit, recorded consent before any Register or charge**, with the amount and
   frequency disclosed first.
4. **`subscriberId` is opaque** — with masking it is a hash, not a phone number.
5. **Charging is idempotent** on `externalTrxId`, persisted before the call, reused on retry.

## The one thing agents get wrong

**bdapps returns HTTP 200 for application-level failures.** Branch on `statusCode`;
`S1000` is the only success. `E1351` on Register, `E1356` on Unregister and `E1379` on a
debit retry all mean *the desired state already holds* — treat them as success.

## Build it in the project's own stack

bdapps is JSON over HTTPS: no runtime is privileged, and a Node sidecar for a Python, Java,
Go, PHP or .NET project is the wrong answer. Every call is one HTTPS POST with a JSON body —
`references/13-curl-reference.md` has all of them, so Ruby, Rust, Kotlin, Elixir or anything
else is a first-class target. Working implementations for six languages ship in `templates/`
(see `templates/README.md`); `references/11-any-stack.md` specifies the same seven components
language-neutrally, with an acceptance checklist for stacks with no template.

## Where the detail lives

`references/01-getting-started.md` through `14-bdapps-ai.md`, and the per-language
implementations in `templates/`. Read the reference for the service you are building before
writing code.

Taking a project from nothing to production — or adding bdapps to an app that already has
users — is `references/12-implementation-playbook.md`.

Related skills: `bdapps-scaffold`, `bdapps-callbacks`, `bdapps-review`,
`bdapps-debug`, `bdapps-golive`, `bdapps-ai`.
