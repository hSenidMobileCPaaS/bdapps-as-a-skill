---
name: bdapps
description: Build and integrate bdapps (Robi Axiata's Bangladeshi telco platform) services into any application — SMS, USSD, Subscription (register, unregister, status, query base size), OTP, the Subscription Charging SDK, and CaaS charging (direct debit, balance query). Use this whenever the user mentions bdapps, bdapps Pro, bdapps Lite, developer.bdapps.com, user.bdapps.com, TAP, MSISDN/`tel:` addressing, shortcode/keyword, USSD menus, subscriber base size, direct carrier billing, mobile-account charging, or telco SMS/USSD in Bangladesh or on Robi/Airtel. Also covers **bdappsAI**, the bdapps AI gateway — chat completions across Claude, Gemini and GPT models and image generation on an OpenAI-shaped API — so use this skill too whenever the user mentions bdappsAI, developer.bdapps.com/bdappsai, or a bdapps AI/LLM feature. Covers request/response contracts, callback (webhook) handlers, status codes, credential handling, and go-live requirements.
---

# bdapps Integration Skill

bdapps is Robi Axiata's telco service platform for **Bangladesh**, covering Robi (018, 016) and
Airtel Bangladesh (016). It exposes carrier capabilities — SMS, USSD, subscription lifecycle,
OTP verification, mobile-account charging — as JSON-over-HTTPS APIs that any application can
call, all on one host: `https://developer.bdapps.com`. The middleware behind them is called
**TAP**, which is why `requestId` is documented as "uniquely identifies a request within TAP".

The platform has two faces. **bdapps Pro** is the API product this skill is about. **bdapps
Lite** is a no-code template product (Alert / Voting / Contact / Services) with no API access —
if that is what the user actually needs, say so rather than building an integration.

It also runs **bdappsAI**, an AI gateway: one OpenAI-shaped API in front of Claude, Gemini and GPT
models plus image generation, billed from a bdapps token balance. It shares the brand and the
host and almost nothing else — header credentials instead of body credentials, real HTTP status
codes instead of the `S1000` envelope, no subscriber and no callbacks. It is covered here in
full, kept deliberately separate so its conventions never get applied to a telco call or the
other way round. See [references/14-bdapps-ai.md](references/14-bdapps-ai.md).

This skill makes you able to build a correct, production-shaped bdapps integration from
scratch, or add bdapps to an existing product, **in any language**. The platform is JSON over
HTTPS with a shared-secret credential pair; nothing about it privileges a particular runtime or
framework. Build in whatever the host project already uses.

**Every call comes from one place: [references/13-curl-reference.md](references/13-curl-reference.md).**
It writes out every endpoint as a runnable curl, with every parameter defined, the response it
returns and every response field explained — plus all four inbound callbacks and both bdappsAI
endpoints. Translate the
request into the host project's own HTTP client and idiom, and that is the call. There is no
code generator here on purpose: a generator would serve a handful of languages and go stale as
their idioms move, while a curl is the same call in every language and never expires.

[references/11-any-stack.md](references/11-any-stack.md) specifies what surrounds those calls —
the seven components — language-neutrally. [templates/](templates/README.md) shows the whole
thing already built in TypeScript/Node, Python, Java, Go, PHP and C#: worked examples to read
for shape when one matches the project, never a reason to introduce one of those runtimes.

---

## The rules you must never break

These are the mistakes that cost service providers their app approval, their subscribers,
or real money. Apply them without being asked. (Five for the telco platform, plus one for the
AI gateway.)

1. **Never hardcode `applicationId` or `password`.** They go in environment variables, read
   through one config module that validates at startup. Never in source, never in a client
   bundle, never in a committed file, never in a log line, never in a git history. See
   [references/09-security-best-practices.md](references/09-security-best-practices.md).

2. **Never call bdapps from client-side code.** Browser JS, mobile apps, and Flutter/React
   Native code must call *your* backend, which calls bdapps. The credentials are
   symmetric-secret; anything that ships to a device leaks them. The platform also enforces
   IP whitelisting, which a mobile client cannot satisfy.

3. **Never charge or subscribe a user without explicit consent, and never without telling
   them the amount and frequency first.** bdapps suspends applications for this. Consent
   must be captured and stored with a timestamp.

4. **Never assume the MSISDN is real.** Applications provisioned with number masking receive
   a hash (`tel:hu3b84346f...`) instead of `tel:8801812345678`. Treat `subscriberId` as an
   opaque string, store it as given, and send back exactly what you received.

5. **Always make charging idempotent.** Generate a unique `externalTrxId` per charge attempt,
   persist it *before* the call, and never retry with a fresh one — a retry with a new ID
   double-charges a real person.

6. **Never let subscriber identity reach a bdappsAI prompt.** Prompts leave your trust boundary
   and reach a third-party model provider. No MSISDN, no `subscriberId` (a masked hash is still
   a stable identifier), no OTP, no credential — and cap every AI call with
   `max_completion_tokens`, because an uncapped loop empties a shared prepaid balance. See
   [references/14-bdapps-ai.md](references/14-bdapps-ai.md).

---

## Query the contract, do not recall it

The complete bdapps contract ships as structured data
([`catalog/bdapps-api.json`](catalog/bdapps-api.json)) with a zero-dependency CLI over it.
Run it instead of reconstructing parameter names from memory — it is offline, read-only, needs
no install, and never sees credentials.

```bash
node tools/bdapps.mjs list [category]              # every service and callback
node tools/bdapps.mjs show <id>                    # full contract: params, response, rules
node tools/bdapps.mjs search "<query>"             # find by intent, e.g. "base size"
node tools/bdapps.mjs curl <id> [key=value ...]    # runnable request + param/response defs
node tools/bdapps.mjs validate <id> '<json>'       # check a payload against the spec
node tools/bdapps.mjs code <statusCode>            # decode a status code + the fix
node tools/bdapps.mjs diagnose "<symptom>"         # cause and fix from a symptom
node tools/bdapps.mjs practices [severity]         # security and reliability rules
node tools/bdapps.mjs checklist                    # go-live checklist
node tools/bdapps.mjs reference <doc>              # print a reference document
node tools/bdapps.mjs platform                     # base URLs, operators, conventions
node tools/bdapps.mjs bdappsai [models|errors]     # the bdappsAI gateway: auth, models, errors
node tools/bdapps.mjs sdk                          # the Subscription Charging SDK redirect
```

`--json` on any command for machine-readable output. If you cannot run commands — or Node is
not available — read `catalog/bdapps-api.json` directly; it is plain JSON and holds the same
data, and [references/13-curl-reference.md](references/13-curl-reference.md) is the same
contract in prose. The CLI is a documentation reader, not part of the integration: it makes no
network calls, never sees a credential, and puts no constraint on the stack you build in.

## Write the call, do not hand-roll it

**[references/13-curl-reference.md](references/13-curl-reference.md) is where every call comes
from.** Each endpoint is written out at the wire: the request as a runnable curl, every
parameter defined with its type and whether it is required, the exact response, every response
field explained, and that endpoint's status codes with their handling class — plus the same for
all four inbound callbacks, each with a command that replays it against your own handler, and
both bdappsAI endpoints with their own auth and error tables.

Translate the request into the host project's HTTP client and idiom. That is the whole job for
the call itself: the body, the headers and the branching are identical in every language, so
Ruby, Rust, Kotlin and Elixir are exactly as well served as TypeScript. What surrounds the call
differs by stack, and that is [references/11-any-stack.md](references/11-any-stack.md).

`node tools/bdapps.mjs curl <id> key=value …` prints the same thing for one service, filled
in with your values and validated as it builds.

Run the curl by hand before writing code, and again first thing when a call fails — it
separates "my payload is wrong" from "my code is wrong" in one step, and it is the fastest way
to prove credentials, provisioning and the egress IP at the same time.

**This skill deliberately has no code generator.** An emitter can only cover the languages
someone wrote emitters for, and it ages with each of those languages' idioms rather than with
the bdapps contract — which is why the contract, the curl reference and the templates are the
things kept current. Write the code in the project's own conventions, from the contract.

**Working order:** `search`/`list` to find the service → `show` for the exact contract → the
curl reference for the call → `validate` the payload → `code`/`diagnose` when something fails.

**Whole-integration order:** [references/12-implementation-playbook.md](references/12-implementation-playbook.md)
takes a project from nothing to production, and covers the three starting points — greenfield,
mid-build, and retrofitting bdapps into a live application.

## How to approach a bdapps task

**Step 1 — Establish what already exists.** Ask (or check the code for) which of these the
user has:

- A bdapps account and a provisioned app (`APP_00XXXX` + password)?
- Which operators and which APIs were provisioned? An app can only call services it was
  provisioned for — otherwise you get `E1309`.
- A publicly reachable HTTPS URL for callbacks? Required for MO SMS, USSD, subscription
  notifications. Without one, inbound flows cannot work at all.
- A static egress IP? Required — see rule below.

If they have none of this, they are pre-provisioning. Read
[references/01-getting-started.md](references/01-getting-started.md) and walk them through
it; you can still build and test the whole integration against the local mock first.

**Step 2 — Pick the services.** Map the product requirement to APIs using the table below.
Most real applications need *Subscription + SMS* at minimum; charging apps add *CaaS*;
feature-phone reach adds *USSD*; web or in-app sign-up adds *OTP* or the *Subscription Charging
SDK*; anything generating text or images adds *bdappsAI*, which needs its own key rather than
bdapps Pro provisioning.

**Step 3 — Pick the stack, then scaffold config before code.** The stack is the host project's,
not the template's: a Django codebase gets Python, a Spring service gets Java, a Laravel app
gets PHP. Create `.env` / `.env.example` and the config module first, so no credential ever has
a chance to land in a source file. Copy from [templates/.env.example](templates/.env.example)
— the variable names are identical in every language — and the config file from the matching
directory in [templates/](templates/README.md).

**Step 4 — Build the client, then the callbacks.** Outbound calls (`send`, `debit`) and
inbound callbacks (MO SMS, USSD, notifications) are two separate halves. Both are required
for most services. See [references/07-callbacks.md](references/07-callbacks.md) — the
callback contract has hard rules (respond `S1000` fast, be idempotent, never trust the body).

**Step 5 — Handle status codes properly.** bdapps returns HTTP 200 with an application-level
`statusCode` in the body. `S1000` is success; everything else is a failure you must branch on.
Checking only the HTTP status is a bug. See
[references/08-status-codes.md](references/08-status-codes.md).

**Step 6 — Run the go-live checklist** in
[references/10-production-checklist.md](references/10-production-checklist.md) before the
user requests production approval.

---

## Service map

| Need | Service | Endpoint | Reference |
|---|---|---|---|
| Send an SMS to a subscriber (MT) | SMS Send | `POST /sms/send` | [02-sms](references/02-sms.md) |
| Broadcast to the whole subscriber base | SMS Send with `tel:all` | `POST /sms/send` | [02-sms](references/02-sms.md) |
| Receive an SMS from a user (MO) | SMS Receive | *your callback URL* | [02-sms](references/02-sms.md) |
| Know whether an SMS was delivered | Delivery Status Report | *your callback URL* | [02-sms](references/02-sms.md) |
| Interactive menu on any phone | USSD Send | `POST /ussd/send` | [03-ussd](references/03-ussd.md) |
| React to a user dialling your code | USSD Receive | *your callback URL* | [03-ussd](references/03-ussd.md) |
| Opt a user in | Subscription Register | `POST /subscription/send` (`action:"1"`) | [04-subscription](references/04-subscription.md) |
| Opt a user out (**unsub**) | Subscription Unregister | `POST /subscription/send` (`action:"0"`) | [04-subscription](references/04-subscription.md) |
| Check if a user is subscribed | Subscription Status | `POST /subscription/getStatus` | [04-subscription](references/04-subscription.md) |
| **Subscriber base size** | Query Base | `POST /subscription/query-base` | [04-subscription](references/04-subscription.md) |
| Be told when a user subs/unsubs | Subscription Notification | *your callback URL* | [04-subscription](references/04-subscription.md), [07-callbacks](references/07-callbacks.md) |
| Register a user from a web/app form | OTP Request → Verify | `POST /otp/request`, `POST /otp/verify` | [06-otp](references/06-otp.md) |
| Take consent **and** set up charging on a hosted page | Subscription Charging SDK | `GET https://user.bdapps.com/sdk/subscription/authorize` (signed redirect) | [06-otp](references/06-otp.md) |
| Charge a user's mobile account | CaaS Direct Debit | `POST /caas/direct/debit` | [05-caas](references/05-caas.md) |
| Check a user can afford a charge | CaaS Query Balance | `POST /caas/get/balance` | [05-caas](references/05-caas.md) |
| **Ask a model / generate text** | bdappsAI Chat Completions | `POST https://developer.bdapps.com/bdappsai/api/v1/chat/completions` | [14-bdapps-ai](references/14-bdapps-ai.md) |
| **Generate an image** | bdappsAI Image Generation | `POST https://developer.bdapps.com/bdappsai/api/v1/images/generations` | [14-bdapps-ai](references/14-bdapps-ai.md) |

One production host for everything: `https://developer.bdapps.com`. The one exception is the
Subscription Charging SDK, which is a browser redirect to `https://user.bdapps.com` rather than
an API call. Every row above as a runnable request with its parameters and response defined:
[references/13-curl-reference.md](references/13-curl-reference.md).

**Configure one environment variable per provisioned service** — `BDAPPS_SMS_SEND_URL`,
`BDAPPS_USSD_SEND_URL`, and so on — never one shared base URL. An application can only call
the APIs it was provisioned for, so an unset endpoint means that service is not enabled and
the client should refuse to call it rather than fail with `E1309` at the platform. Never
inline a URL. See [templates/.env.example](templates/.env.example).

---

## The shape of every bdapps call

Every outbound API is the same shape. Learn it once:

```
POST https://developer.bdapps.com/<service-path>
Content-Type: application/json

{ "applicationId": "APP_000375", "password": "…", "version": "1.0", …service fields… }
```

Every response is HTTP 200 with:

```json
{ "statusCode": "S1000", "statusDetail": "Success", "version": "1.0", … }
```

So the correct client, in every language, is one `post(path, payload)` helper that injects
credentials from config, plus per-service wrappers. Do not write bespoke HTTP calls per
endpoint. [templates/](templates/README.md) has complete working implementations of exactly
this in six languages — read the closest one for shape rather than inventing a new structure —
and [references/11-any-stack.md](references/11-any-stack.md) specifies the same thing
language-neutrally when the project's stack is not among them.

Every endpoint filled in with real values — request, parameters, response and response fields —
is [references/13-curl-reference.md](references/13-curl-reference.md). That page plus the seven
components is a complete integration in a language this repo has never heard of.

**bdappsAI is the one exception to every sentence above.** Its credential is an `Authorization`
header (`app_<keyId>.<keyValue>`, verbatim, no `Bearer`), it returns real HTTP status codes with
an `error` object and no `statusCode` field, and it needs a client of its own: one shared HTTP
helper will apply exactly one of the two conventions and be wrong for half your calls.
[references/14-bdapps-ai.md](references/14-bdapps-ai.md) has the whole contract.

### Addressing

Subscriber addresses are **always** prefixed `tel:` with no `+` and no spaces:

```
tel:8801812345678          plain MSISDN (unmasked app)
tel:hu3b84346f63899a…    hash key (masked app) — opaque, use as-is
tel:all                  broadcast to the subscribed base (SMS send only)
```

Normalise once, in one function, at the boundary. Never string-concatenate `tel:` inline.

---

## Non-obvious things that will bite you

- **IP whitelisting is mandatory.** The platform rejects calls from any IP not in the app's
  *Allowed Host Addresses* list with `E1303`. Get the egress IP with
  `curl -4 https://api.ipify.org` **from the server that will make the calls** — not from
  a laptop. Serverless/autoscaling platforms with rotating egress IPs need a static NAT or a
  fixed-IP proxy; decide this before choosing a host.
- **Limited Production is the first approval state.** Only the numbers listed under
  *Whitelisted Numbers* can use the app. If a test number "does nothing", check that list
  before debugging code.
- **HTTP 200 ≠ success.** Branch on `statusCode`, always.
- **`E1309` means not provisioned, not a code bug.** Calling a service the app was not
  provisioned for fails no matter how correct the payload is.
- **Callback URLs are configured in the portal, not in code.** Changing your route path means
  updating the provisioning record too.
- **The Subscription Charging SDK has to be switched on by support.** `Enable Charging SDK` in
  **General → Advanced** is off by default and cannot be toggled from the portal — email
  <support@bdapps.com>. Its API Key and API Secret are a *second* credential pair, not the
  `applicationId` and `password`.
- **bdapps publishes no LBS/location API and no voice/IVR API**, and its published contract has
  no charging-notification callback. Do not invent endpoints for them; reconcile a charge by
  re-calling Direct Debit with the same `externalTrxId` instead.
- **Do not spoof `X-Forwarded-For`.** Reference/demo code sometimes sets it to fake a
  whitelisted origin through a proxy. That is a local-development crutch. In production the
  platform sees your real egress IP, and sending forged headers to a carrier is exactly the
  kind of thing that gets an app suspended.
- **bdappsAI's key is not IP-whitelisted.** Unlike every telco endpoint, a leaked bdappsAI key
  works from anywhere in the world until you rotate it — and it spends a prepaid balance. There
  is no network control standing between an exposed key and your money.
- **An AI answer cannot be generated inside a callback.** A completion takes tens of seconds; a
  USSD session dies in far less and bdapps wants `S1000` immediately. Acknowledge first,
  generate out of band, deliver by MT SMS or on the next screen.
- **TLS:** some bdapps hosts serve an incomplete certificate chain, which makes strict
  clients fail — Node, Python, Java, Go and .NET all reject it where a browser papers over it.
  Disabling verification (`rejectUnauthorized: false`, `verify=False`, `InsecureSkipVerify`,
  `CURLOPT_SSL_VERIFYPEER => false`, a trust-all `TrustManager`) is **not** an acceptable
  production fix in any of them — it opens you to interception of your own credentials. Supply
  the intermediate CA explicitly instead. See
  [references/09-security-best-practices.md](references/09-security-best-practices.md#3-tls-verification).

---

## Reference files

Read the one that matches the task. Do not guess parameter names — they are all here.

| File | Contents |
|---|---|
| [01-getting-started.md](references/01-getting-started.md) | Account, provisioning, credentials, environments, first call |
| [02-sms.md](references/02-sms.md) | Send / receive / delivery report, full parameter tables |
| [03-ussd.md](references/03-ussd.md) | Session model, `ussdOperation` state machine, menu building |
| [04-subscription.md](references/04-subscription.md) | Register, **unregister**, status, **query base size**, notifications |
| [05-caas.md](references/05-caas.md) | Direct debit, balance query, idempotency, reconciliation |
| [06-otp.md](references/06-otp.md) | **OTP** request/verify and the **Subscription Charging SDK** — onboarding a user who starts on a screen |
| [07-callbacks.md](references/07-callbacks.md) | All inbound webhooks, contract, security, idempotency |
| [08-status-codes.md](references/08-status-codes.md) | Complete official code list + how to handle each class |
| [09-security-best-practices.md](references/09-security-best-practices.md) | Secrets, TLS, PII, logging, consent, rate limits |
| [10-production-checklist.md](references/10-production-checklist.md) | Pre-go-live verification |
| [11-any-stack.md](references/11-any-stack.md) | The integration specified language-neutrally: the seven components, per-language notes, port acceptance checklist |
| [12-implementation-playbook.md](references/12-implementation-playbook.md) | A to Z: greenfield / mid-build / retrofit, the flow recipes, testing without an account, go-live |
| [13-curl-reference.md](references/13-curl-reference.md) | **Every endpoint as a runnable curl** — request, parameter definitions, response, response-field definitions, per-endpoint status codes, and the same for all four callbacks and both bdappsAI endpoints |
| [14-bdapps-ai.md](references/14-bdapps-ai.md) | **bdappsAI** — the AI gateway: auth, models, chat completions, image generation, the error table, and the rules for putting a model call inside a telco flow |

Templates in [templates/](templates/README.md) are working reference implementations of the
same integration — config, client, callback handlers and session store — in **TypeScript/Node,
Python, Java, Go, PHP and C#**, plus a shared `.env.example`. Scripts in [scripts/](scripts/)
are curl smoke tests, so they exercise a handler written in any language.

---

## When generating code

- **Write it in the host project's language and idiom.** Never introduce a new runtime, a
  Node sidecar, or a second service just to reach bdapps — a plain HTTPS POST is all it takes,
  and every stack can make one.
- Put every bdapps call behind a service module. No endpoint URLs or credentials scattered
  through controllers.
- Type or schema-validate both directions with whatever the stack uses (types, pydantic, Bean
  Validation, struct tags, data annotations). Inbound callback bodies come from outside your
  trust boundary.
- Log `requestId` / `externalTrxId` / `sessionId` on every operation — they are how bdapps
  support traces an issue. Log the `statusCode`. **Never** log `password`, and mask
  `subscriberId` in logs.
- Persist subscription state locally; do not call `getStatus` on every request.
- Make outbound calls retry-safe: retry only on transport errors and `E1603`/`E1601`, never
  on a definitive `E13xx`, and never retry a debit with a new `externalTrxId`.
- Match the host project's stack and conventions. These templates are a specification, not
  a framework to impose.
