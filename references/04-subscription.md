# Subscription API

The Subscription API manages the lifecycle that binds a user to your service, and — critically
— records their **consent**. bdapps treats consent as a compliance matter: registering users
without it can get your application suspended.

Five things live here:

| Operation | Endpoint |
|---|---|
| **Register** (opt-in) | `POST /subscription/send` with `action: "1"` |
| **Unregister** (opt-out / unsub) | `POST /subscription/send` with `action: "0"` |
| **Subscription Status** | `POST /subscription/getStatus` |
| **Query Base** (subscriber base size) | `POST /subscription/query-base` |
| **Subscription Notification** | Your callback URL (inbound) |

Plus **OTP**, the registration flow for web and app users — documented at the end of this file.

---

## Register / Unregister

```
POST /subscription/send
Content-Type: application/json
```

### Register (opt-in)

```json
{
  "applicationId": "APP_000375",
  "password": "…",
  "version": "1.0",
  "action": "1",
  "subscriberId": "tel:8801812345678"
}
```

```json
{
  "version": "1.0",
  "requestId": "1374746416574",
  "statusCode": "S1000",
  "statusDetail": "SUCCESS",
  "subscriptionStatus": "REGISTERED"
}
```

### Unregister (opt-out)

Identical, with `action: "0"`:

```json
{
  "applicationId": "APP_000375",
  "password": "…",
  "version": "1.0",
  "action": "0",
  "subscriberId": "tel:8801812345678"
}
```

```json
{
  "version": "1.0",
  "requestId": "1374746416574",
  "statusCode": "S1000",
  "statusDetail": "SUCCESS",
  "subscriptionStatus": "UNREGISTERED"
}
```

### Request parameters

| Parameter | Description | Type | Mandatory |
|---|---|---|---|
| `applicationId` | Application ID from provisioning | String | **Mandatory** |
| `password` | Password from provisioning | String | **Mandatory** |
| `version` | API version (`1.0`, `2.0`…) | String | Optional — defaults to latest |
| `action` | `1` = opt in, `0` = opt out | Enum | **Mandatory** |
| `subscriberId` | `tel:`-prefixed subscriber address; may be a hash key if masking is on | String | **Mandatory** |

> The official docs send `action` as a **string** (`"1"` / `"0"`). Numeric `1` / `0` is also
> accepted in practice. Use the string form — it matches the published contract.

### Response parameters

| Parameter | Description |
|---|---|
| `version` | API version |
| `requestId` | Uniquely identifies the request within the SDP |
| `statusCode` / `statusDetail` | Outcome |
| `subscriptionStatus` | `REGISTERED`, `UNREGISTERED`, or `PENDING`. `PENDING CHARGE` means the subscriber has not been charged yet. |

### Rules that matter

- **Consent before Register, always.** A user tapping "Subscribe", replying to a USSD prompt,
  or verifying an OTP is consent. Importing a list of numbers is not. Store *what* the user
  agreed to, *when*, and *through which channel* — you may be asked to produce it.
- **Disclose the charge before registering** — amount, currency, frequency. This is a
  provisioning-level obligation, not a nicety.
- **Unregister must be as easy as register.** Provide it in every channel the user can reach:
  an `UNSUB` / `STOP` keyword over MO SMS, a USSD menu option, and a button in-app. Honour it
  immediately.
- **`E1351` (already registered) on a Register is not an error in your flow** — it means the
  user is already on. Treat it as success and continue.
- **`E1356` (not registered) on an Unregister is likewise benign** — the desired end state
  already holds. Make both operations idempotent from the caller's point of view.
- **Registration may be `PENDING`, not `REGISTERED`.** If initial charging is involved the
  subscriber is not active yet. Do not start delivering the service on `PENDING`; wait for the
  subscription notification.
- **Mirror subscription state in your own database**, with the time each row was last
  confirmed and what confirmed it. Do not call `getStatus` on every request — it is slow, it
  takes one subscriberId per call, and it is unnecessary if you consume notifications. The
  mirror is also what answers "may this user in?" for a returning user, so that a sign-in makes
  no bdapps call at all — see
  [Identity and sessions](#identity-and-sessions--subscribe-once-then-trust-your-own-session).

---

## Subscription Status

Checks the current state of one subscriber.

```
POST /subscription/getStatus
Content-Type: application/json
```

```json
{
  "applicationId": "APP_000375",
  "password": "…",
  "subscriberId": "tel:8801812345678"
}
```

```json
{
  "version": "1.0",
  "subscriptionStatus": "REGISTERED",
  "statusCode": "S1000",
  "statusDetail": "SUCCESS"
}
```

| Request parameter | Description | Mandatory |
|---|---|---|
| `applicationId` | Application ID | **Mandatory** |
| `password` | Password | **Mandatory** |
| `subscriberId` | Subscriber address, `tel:` prefixed, possibly masked | **Mandatory** |

| Response parameter | Description | Mandatory |
|---|---|---|
| `version` | API version | Mandatory |
| `subscriptionStatus` | `REGISTERED` / `UNREGISTERED` / `PENDING` / `CHARGE` | Optional |
| `statusCode` / `statusDetail` | Outcome | Mandatory |

**One `subscriberId` per call** — the contract accepts a single value per request, so there is
no batch form and no cheap way to check many users at once. Use it for reconciliation (a
scheduled sweep, or when a user disputes their state) and at **sign-in**, when your local mirror
is missing or you doubt it. Never as a per-request gate — see
[Identity and sessions](#identity-and-sessions--subscribe-once-then-trust-your-own-session).

---

## Query Base — subscriber base size

Returns how many subscribers are currently registered to the application. Needs no subscriber
and costs nothing, which also makes it the ideal connectivity smoke test.

```
POST /subscription/query-base
Content-Type: application/json
```

```json
{
  "applicationId": "APP_000375",
  "password": "…"
}
```

```json
{
  "version": "1.0",
  "baseSize": "10",
  "statusCode": "S1000",
  "statusDetail": "SUCCESS"
}
```

| Request parameter | Description | Mandatory |
|---|---|---|
| `applicationId` | Application ID | **Mandatory** |
| `password` | Password | **Mandatory** |

| Response parameter | Description | Mandatory |
|---|---|---|
| `version` | API version | Mandatory |
| `baseSize` | Current subscriber base size — **a string, parse it** | Optional |
| `statusCode` / `statusDetail` | Outcome | Mandatory |

Notes:

- `baseSize` comes back as a **string**. Coerce before arithmetic or charting.
- It is a point-in-time count for the whole app, not a per-operator or per-segment figure.
- Poll it on a schedule (hourly/daily) into your own metrics store rather than calling it per
  page load. Use it to sanity-check a broadcast before sending to `tel:all` — if `baseSize` is
  far larger than you expect, stop.

---

## Subscription Notification (inbound)

The platform `POST`s to the **Subscription Notification URL** configured during provisioning
whenever a subscription changes — including changes you did not initiate (a user texting
`STOP`, an operator-side removal, a billing failure).

```json
{
  "applicationId": "APP_000375",
  "password": "…",
  "frequency": "monthly",
  "status": "REGISTERED",
  "subscriberId": "tel:8801812345678",
  "version": "1.0",
  "timeStamp": "20120113082110"
}
```

| Field | Meaning |
|---|---|
| `applicationId` | Your application ID |
| `password` | **Your application password, echoed back by the platform.** Redact it before the payload reaches a log, an error tracker or a queue. Comparing it in constant time is reasonable defence in depth; it is not authentication on its own, because the request is unauthenticated JSON from the public internet. |
| `status` | `REGISTERED` / `UNREGISTERED` |
| `subscriberId` | Subscriber address, possibly masked |
| `frequency` | Charging frequency for the subscription — `daily` / `weekly` / `monthly` / `yearly` |
| `timeStamp` | When it happened |
| `version` | API version |

Respond `{"statusCode":"S1000","statusDetail":"Success"}`.

**This callback is the authoritative source of subscription state.** Consuming it is what lets
you keep a local mirror instead of polling `getStatus`. Handle it idempotently — duplicates
happen. Full contract: [07-callbacks.md](07-callbacks.md).

---

## Identity and sessions — subscribe once, then trust your own session

**This is the flow most integrations get wrong.** Register, OTP and the Subscription Charging
SDK all end with proof that a user controls a mobile number, so they look like authentication.
They are not authentication APIs — each one is a **subscription transaction**. Register can
trigger the initial charge, `/otp/request` sends a real SMS that costs money, and the SDK sets
up charging. Calling one of them to answer "who is this?" or "may this user in?" bills the
subscriber, sends them PINs they did not ask for, burns the application's TPS/TPD allowance,
and puts your sign-in path at the mercy of the platform's latency.

What the subscription flow gives you is a **one-time verified binding**: this account owns this
`subscriberId`, and this user consented, at this moment, to this charge. Establish it once.
Everything after that is answered locally.

### Two questions, two different sources

| Question | Where the answer comes from | Never |
|---|---|---|
| **Who is this user?** | Your own session and auth — a cookie session, a JWT, Django sessions, Spring Security, a Laravel guard, whatever the project already has | A fresh `/otp/request` + `/otp/verify` on every sign-in |
| **May they use the service right now?** | Your local subscription mirror, keyed by `subscriberId` | `POST /subscription/getStatus` on the request path |
| **Has their state changed?** | The subscription notification callback, plus a scheduled reconciliation sweep | Polling per request or per page load |
| **May I take this payment?** | A fresh CaaS debit, authorised per payment | Treating a live session — or an earlier OTP — as authorisation |

### The flow

```
FIRST TIME ONLY — the binding
  user opts in  (SMS keyword, USSD menu, OTP request + verify, or the Charging SDK page)
    → record consent: who, when, channel, wording shown, amount and frequency disclosed
    → subscriberId comes back (opaque — with masking it is a hash; store exactly as given)
    → create or link the local account and store subscriberId on it
    → mirror subscriptionStatus on that row, with the time it was confirmed
    → ISSUE YOUR OWN SESSION. From here the user is logged in, by your system.

EVERY REQUEST AFTER THAT — the entitlement check, zero bdapps calls
  session → account → the mirrored subscriptionStatus
    REGISTERED           → serve the service
    PENDING / CHARGE     → "activation in progress"; wait for the notification,
                           do not re-register and do not send another OTP
    UNREGISTERED         → the re-subscribe screen, with a fresh opt-in and disclosure

STATE CHANGES — out of band, never in the request path
  subscription notification callback → update the mirror; this is the authority
  scheduled sweep of getStatus (one subscriberId per call) → reconcile rows that
                                   have gone stale, in a job, not in a handler
```

### Rules

- **Nothing on the sign-in or page-load path calls bdapps.** If a user signing in causes an
  outbound request to `developer.bdapps.com`, the design is wrong. Sign-in reads your session
  store; entitlement reads your own database.
- **Re-verify only on a genuine re-verification event** — a new device, a changed number, a
  long-dormant account, or a step-up before something sensitive. That is what a fresh OTP is
  for. Not every sign-in, and never every request.
- **You need a `subscriberId` before you can ask anything.** With masking on, it is a hash you
  can only receive from an OTP verify or a callback — a number the user has just typed is not
  one. So for a masked application, "is this user already subscribed?" means "does this account
  already have a stored `subscriberId` that the mirror says is `REGISTERED`?". An account with
  no stored id goes through the opt-in flow.
- **`E1351` on Register or OTP Request means the user is already subscribed**, not that
  something failed. Treat it as success, repair the mirror, and let them in — do not send them
  round the opt-in loop again.
- **A live session is not permission to charge.** Authentication and authorisation of money are
  separate: every payment is its own CaaS debit with its own `externalTrxId`, whatever the
  user's session says. See [05-caas.md](05-caas.md).
- **Store when the mirror was last confirmed, and by what** — the notification or a sweep. That
  timestamp is what makes reconciliation targetable and support answerable.
- **When the mirror is stale or a lookup fails, serve the last known good state** and reconcile
  in the background. Never block a request on a live bdapps call, and never sign a user out
  because a lookup failed.
- **`subscriberId` is a join key, not a session token.** Keep it on the account row. Do not put
  it in a cookie or a JWT claim the client can set — anyone who could set it would then be able
  to act as that subscriber.
- **Count the calls before you design a per-request check.** `getStatus` takes one subscriberId
  per request, and one OTP per sign-in is one paid SMS per sign-in. Either one hits the
  application's TPS and TPD limits long before your traffic does.

Recipe E in [12-implementation-playbook.md](12-implementation-playbook.md#4-flow-recipes) writes
this out as a sequence, and [07-callbacks.md](07-callbacks.md) is the contract for the
notification that keeps the mirror honest.

---

## Registering a user who starts on a screen

A user who arrives on a website or in an app has not sent you an SMS, so the carrier has told
you nothing about them. Two bdapps features close that gap — **OTP** (you collect the number,
the platform SMSes a PIN) and the **Subscription Charging SDK** (you redirect the browser to a
bdapps-hosted consent page, and the platform handles number capture, consent and charging).

Both are in [06-otp.md](06-otp.md).

---

Register, unregister, status and query base as runnable curls — every parameter, response and
response field defined: [13-curl-reference.md](13-curl-reference.md).
