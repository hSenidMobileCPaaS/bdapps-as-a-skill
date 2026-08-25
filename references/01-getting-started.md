# Getting Started with bdapps

## What bdapps is

bdapps is Robi Axiata's self-service telco platform for **Bangladesh**. It lets an
independent developer or company ("service provider", SP) use carrier-grade capabilities —
sending SMS, running USSD menus, managing subscriptions, verifying a number by OTP, charging a
user's mobile account — through plain JSON-over-HTTPS APIs, without a direct operator
integration. The middleware behind those APIs is called **TAP**, and you will see the name in
parameter descriptions (`requestId` "uniquely identifies a request within TAP").

- **Portal (sign in / register / manage apps):** <https://user.bdapps.com>
- **Developer site and API docs:** <https://dev.bdapps.com>
- **API host:** `https://developer.bdapps.com`
- **App store:** <https://bdapps.com/appstore/>

### Operators

| Operator | Local prefixes | International form |
|---|---|---|
| Robi | 018, 016 | `88018…`, `88016…` |
| Airtel Bangladesh | 016 | `88016…` |

Both are Robi Axiata networks — Airtel Bangladesh merged into Robi in 2016 and the Airtel brand
was kept on the 016 series. bdapps reaches the Robi Axiata subscriber base; a subscriber on
Grameenphone (017/013), Banglalink (019/014) or Teletalk (015) is not reachable through this
platform.

You choose which operators to provision per API, and expect per-operator differences in
charging configuration.

There is no fee to use the platform. The commercial model is revenue share on what the service
earns — currently **50% to 90%** to the developer after monthly reconciliation — paid to the
bank account registered on your account. Charging bands are published at
<https://dev.bdapps.com/pricing.php>: SMS and USSD are Tk. 1–2 per message/menu, CaaS is
Tk. 1–50 per transaction.

## bdapps Pro vs bdapps Lite

| | bdapps Pro | bdapps Lite |
|---|---|---|
| Audience | Developers | Non-developers |
| You write the code | Yes | No |
| You host an endpoint | Yes — required | No |
| API access | Full | None (template services) |
| Customisation | Full | Template-bound |

**This skill is about bdapps Pro.** If a user wants Alert / Voting / Contact / Services style
functionality with no code, the bdapps Lite templates in the portal may be a better answer than
an integration — say so rather than building it.

## Before you provision

The portal asks for things that must already exist. Get these ready first:

1. **A hosted, publicly reachable HTTPS endpoint.** The platform pushes MO SMS, USSD requests,
   and subscription notifications *to you*. Without a live URL these
   flows cannot be configured. `localhost` will not work — use a tunnel (ngrok, Cloudflare
   Tunnel) for development only.
2. **The static egress IP of the server that will call bdapps.** Run, on that server:
   ```bash
   curl -4 https://api.ipify.org
   ```
   This is what goes in *Allowed Host Addresses*. A laptop IP, a CI runner IP, or a rotating
   serverless IP will fail with `E1303` in production.
3. **A decision on charging** — amount in BDT, frequency, and the reason. This must be
   disclosed to end users before they subscribe.
4. **A decision on which operators and which APIs** you need. You can only call what you
   provisioned.

## Provisioning walkthrough (bdapps Pro)

Portal → log in → **bdapps Pro** → **Create new App**.

### Basic details

| Field | What it means | Get this wrong and… |
|---|---|---|
| Application Name | Unique name for the app | Rejected as duplicate |
| Application Description | Read by a human approver | Approval delayed; be specific about the use case |
| **Allowed Host Addresses** | IPs permitted to call the APIs | Every call fails `E1303` |
| **Whitelisted Numbers** | The only numbers allowed to use the app in Limited Production | Your test number silently does nothing |
| Blacklisted Numbers | Numbers barred from the app | — |

### Advanced details

- **Automatic content governance** — screens outbound content for inappropriate wording.
- **Advertisements** — attaches ads to messages you send.
- **Mobile number masking** — replaces subscriber MSISDNs with hash keys. **This changes
  what your code receives**: `subscriberId` becomes `tel:hu3b84346f…` rather than
  `tel:88018…`. Design for it from the start; treat the value as opaque.
- **Application start time / expiration** — schedule availability.

### Services

Per operator, per API, you configure the settings the platform needs — most importantly the
**callback URLs**. See [07-callbacks.md](07-callbacks.md) for what each one receives.

For SMS you additionally configure:

- **Shortcode** — the short number users send SMS to, allocated to you during provisioning.
- **Keyword** — the unique word that routes an SMS to *your* app. A user texts
  `KEYWORD <anything>` to the shortcode.
- **MO enabled/disabled** — turn MO off if the service never receives user SMS.

For CaaS you configure whether **Enable Query Balance Requests** is on, whether **subscription
is required before charging**, and the operator-side **Enable Debit Requests** / **Mobile
Account for Operator** toggles (both must be `YES` for charging to work). Max TPS and TPD are
fixed per operator agreement. Currency is **BDT** and nothing else.

For OTP you configure nothing beyond enabling the API: `/otp/request` and `/otp/verify` are
plain request/response calls with no callback of their own. See [06-otp.md](06-otp.md).

## Approval states

1. **Draft** — you are still editing.
2. **Limited Production** — first approval. *Only whitelisted numbers can use the app.* This
   is your real integration-test environment.
3. **Production** — full subscriber base.

Budget for Limited Production being where you find every bug. Build with real credentials
against whitelisted test numbers.

## Credentials

Provisioning gives you two values:

```
applicationId   APP_000375       — identifies the app
password        a07118cda521…    — authenticates it
```

These are a symmetric shared secret with full authority over your app, including the ability
to charge your subscribers real money. Handle them accordingly —
[09-security-best-practices.md](09-security-best-practices.md) is not optional reading.

## Environments

bdapps does not publish a separate public sandbox host. Practical approach:

| Stage | Target | How |
|---|---|---|
| Local development | Your own mock | Run a local mock that speaks the same JSON contract; point the service URLs at it |
| Integration test | Real platform, Limited Production | Real credentials, whitelisted numbers only |
| Production | Real platform, Production | Same code, different env values |

The only thing that changes between them is environment variables.

### Configure one URL per provisioned service

Your application can only call the APIs it was provisioned for. So the configuration is not a
single base URL — it is **one endpoint variable per service you enabled**:

```bash
BDAPPS_APP_ID=APP_000375
BDAPPS_PASSWORD=…

# Only the services enabled on this application:
BDAPPS_SMS_SEND_URL=https://developer.bdapps.com/sms/send
BDAPPS_SUBSCRIPTION_SEND_URL=https://developer.bdapps.com/subscription/send
BDAPPS_SUBSCRIPTION_QUERY_BASE_URL=https://developer.bdapps.com/subscription/query-base
```

An unset endpoint is meaningful: it means that API is not enabled, and your client should
refuse to call it locally rather than send a request that fails `E1309` at the platform.
Pointing one of them at a mock is the whole local-development switch:

```bash
BDAPPS_SMS_SEND_URL=http://localhost:4010/sms/send
```

Never branch on an environment name (`NODE_ENV`, `APP_ENV`, `ASPNETCORE_ENVIRONMENT`, a Spring
profile) inside the client to pick a URL, and never inline one. Read them from config so the
same build runs everywhere. See [templates/.env.example](../templates/.env.example) — the
variable names are identical in every language — and the config module for your stack in
[templates/](../templates/README.md).

## Your first call

The cheapest way to prove credentials, whitelisting and connectivity all work is Query Base —
it needs no subscriber and charges nothing:

```bash
curl -X POST 'https://developer.bdapps.com/subscription/query-base' \
  --header 'Content-Type: application/json' \
  --data '{"applicationId":"'"$BDAPPS_APP_ID"'","password":"'"$BDAPPS_PASSWORD"'"}'
```

| Response | Meaning |
|---|---|
| `S1000` + `baseSize` | Everything works |
| `E1313` | Wrong `applicationId`/`password`, or the app is not active |
| `E1303` | This machine's IP is not in Allowed Host Addresses |
| `E1309` | Subscription API not provisioned for this app |
| Connection timeout | Network/firewall, or you are behind a proxy |

More smoke tests: [scripts/smoke-test.sh](../scripts/smoke-test.sh). Every other endpoint in the
same runnable form, with its parameters and response defined:
[13-curl-reference.md](13-curl-reference.md) — start there whatever language you will build in,
because a call proven by hand is one you cannot get wrong in code.

## Support

- Email: `support@bdapps.com`
- WhatsApp: +8801878977505

When you contact support, quote the `requestId`, `externalTrxId` or `sessionId` and the
`statusCode` — that is what they trace with.
