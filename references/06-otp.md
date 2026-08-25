# Onboarding a user who starts on a screen

The subscription APIs in [04-subscription.md](04-subscription.md) all take a `subscriberId`.
That is easy when the user texted your shortcode or dialled your USSD code — the carrier hands
you the address. It is the whole problem when the user arrives on a website or opens your app:
you have a browser session and no idea who is behind it.

bdapps offers two ways to close that gap, and they are not interchangeable.

| | **OTP** | **Subscription Charging SDK** |
|---|---|---|
| What the user does | Types their number, then types a PIN | Clicks a button, lands on a bdapps page, confirms |
| Who renders the consent screen | You | bdapps (`user.bdapps.com`) |
| What you get back | A masked `subscriberId`, from a JSON response | The outcome, at your `redirectUrl` |
| Shape | Two JSON POSTs | A signed browser redirect |
| Credential | `applicationId` + `password` | A separate **API Key** + **API Secret** |
| Provisioning | Enable the OTP API | Email support@bdapps.com to switch on **Enable Charging SDK** |
| Reach for it when | You want to own the whole flow and the wording | You want subscription **and** charging consent handled for you |

**Pick one per surface, not both.** Two consent paths to the same subscription is two things to
keep in step, and users who opted in through one and try to opt out through the other.

---

## OTP — you collect the number, the platform SMSes a PIN

When the user starts on a screen rather than on the network (a website form, an app sign-up),
you cannot get their MSISDN from the carrier. OTP solves that: the user types their number,
the platform SMSes a PIN, and on successful verification you receive the **masked
`subscriberId`** to use with every other API.

Both endpoints are on the same host as every other bdapps API: `https://developer.bdapps.com`.

### Flow

1. Collect the mobile number in your UI.
2. `POST /otp/request` → platform SMSes a PIN.
3. Store the returned `referenceNo` server-side against the user's session.
4. Collect the PIN in your UI.
5. `POST /otp/verify` with `referenceNo` + `otp`.
6. Store the returned `subscriberId` — this is what you use for SMS, Subscription and Charging.

**Always call these from a backend with a static IP**, never from the browser or the app.

### OTP Request

```
POST /otp/request
```

```json
{
  "applicationId": "APP_000375",
  "password": "…",
  "subscriberId": "tel:8801812345678",
  "applicationHash": "abcdefgh",
  "applicationMetaData": {
    "client": "MOBILEAPP",
    "device": "Samsung S10",
    "os": "android8",
    "appCode": "https://play.google.com/store/apps/details?id=lk.example.app"
  }
}
```

| Field | What to put in it |
|---|---|
| `applicationHash` | The hash identifying your app, so the platform sends the verification SMS in the form your app can read automatically (the Android SMS Retriever app hash). A per-application constant, **not** a per-request id. |
| `client` | `MOBILEAPP`, `WebSite`, or `DESKTOP` |
| `device`, `os` | Real device details — derive from the User-Agent for web |
| `appCode` | Mobile app: package name or store URL. Website: the page URL. Desktop: download URL. |

Success:

```json
{
  "statusCode": "S1000",
  "statusDetail": "Success",
  "referenceNo": "3b84346f63899a32ec742a676532ec74dffe4f5",
  "version": "1.0"
}
```

Already registered:

```json
{ "statusDetail": "user already registered", "version": "1.0", "statusCode": "E1351" }
```

### OTP Verify

```
POST /otp/verify
```

```json
{
  "applicationId": "APP_000375",
  "password": "…",
  "referenceNo": "3b84346f63899a32ec742a676532ec74dffe4f5",
  "otp": "123564"
}
```

Success:

```json
{
  "statusCode": "S1000",
  "statusDetail": "Success",
  "subscriptionStatus": "REGISTERED",
  "version": "1.0",
  "subscriberId": "tel:hu3b84346f63899a32ec742a666503a02a4dffe4f5"
}
```

Errors:

| Code | Meaning |
|---|---|
| `E1850` | Invalid OTP |
| `E1851` | OTP expired |
| `E1852` | Maximum attempts reached |

### OTP rules

- **One OTP is valid for 60 minutes.**
- **Maximum 3 verification attempts per OTP.** After that, the user must request a new one.
- **`referenceNo` lives server-side, in the session.** Never send it to the client, never put
  it in a URL, never let the client choose it — that would let an attacker verify against
  someone else's OTP request.
- **Rate-limit OTP requests yourself**, per number and per IP. Without it your app becomes an
  SMS-bombing tool aimed at arbitrary Bangladeshi phone numbers, at your expense.
- **The `subscriberId` you get back is the masked identifier.** Store it as the user's
  identity for all later bdapps calls. Do not store the raw MSISDN the user typed unless you
  genuinely need it, and if you do, protect it as PII.
- Never log the OTP.

---

## Subscription Charging SDK — bdapps renders the consent page

The SDK is not a library you install. It is a **signed browser redirect** to a bdapps-hosted
page that captures the subscriber's number, shows them what they are agreeing to, takes the
consent, and activates the subscription and its charging — then sends the browser back to a URL
you nominate.

Official walkthrough: <https://dev.bdapps.com/consent.php>

Reach for it when you want the consent screen to be the operator's rather than yours: the
wording, the amount, the frequency and the record of consent all sit with bdapps, which is
exactly the evidence an approver asks for. Reach for OTP instead when the flow has to stay
inside your own UI.

### Enabling it

1. Sign in at <https://user.bdapps.com> (register first if you have no account).
2. Create a **bdapps Pro** application in the provisioning module, choosing the APIs you need —
   **SMS and Subscription are both required** for the SDK flow.
3. In the application's **General → Advanced** section you will find **Enable Charging SDK**,
   which is **off by default and cannot be switched on from the portal**.
4. Email <support@bdapps.com> asking for it to be enabled on that application.
5. Once support confirms, the same **Advanced** section shows an **API Key** and an
   **API Secret**. These are the SDK's credentials.

The API Key and API Secret are **not** your `applicationId` and `password`, and they are not
interchangeable with them. The telco APIs will reject the SDK pair, and the SDK will reject the
telco pair.

### The authorize redirect

```
GET https://user.bdapps.com/sdk/subscription/authorize
      ?apiKey=<apiKey>
      &requestId=<your unique id>
      &requestTime=<UTC ISO-8601 with microseconds>
      &signature=<sha512 of apiKey|requestTime|apiSecret>
      &redirectUrl=<your return URL>
```

| Parameter | Required | What it is |
|---|---|---|
| `apiKey` | yes | The API Key from **General → Advanced**. It travels in a URL; the secret never does. |
| `requestId` | yes | Your own unique identifier for this consent attempt. Generate it, persist it against the user's session *before* redirecting, and use it to match the return. |
| `requestTime` | yes | Current UTC time, ISO-8601 with microseconds and a `Z` suffix — `2026-08-25T09:41:22.481903Z`. It is part of the signature, so it must be the same string in both places. |
| `signature` | yes | SHA-512 of `apiKey`, `requestTime` and `apiSecret` joined by pipes, lower-case hex. |
| `redirectUrl` | yes | Where bdapps sends the browser afterwards. Must be a URL you control and can serve over HTTPS. |

The signature is built from three fields joined by literal pipe characters, hashed with
**SHA-512**, and sent as hex:

```
signature = sha512( apiKey + "|" + requestTime + "|" + apiSecret )
```

`apiSecret` is in the hash and **never in the URL**. That is the whole design: anyone can read
the query string, and nobody without the secret can forge one.

### Building the redirect

The reference implementation bdapps publishes is PHP, and every stack does the same four steps.
Read it for the shape, then write it in whatever the host project uses.

```php
<?php
// Server-side only. Both values come from the environment, never from source.
$apiKey    = getenv('BDAPPS_SDK_API_KEY');
$apiSecret = getenv('BDAPPS_SDK_API_SECRET');

$requestTime = gmdate("Y-m-d\TH:i:s.u\Z");          // UTC, microseconds, Z
$requestId   = bin2hex(random_bytes(16));            // yours; persist it first
$redirectUrl = 'https://your-app.example/subscription/return';

$signature = hash('sha512', $apiKey . '|' . $requestTime . '|' . $apiSecret);

$url = 'https://user.bdapps.com/sdk/subscription/authorize'
     . '?apiKey='      . urlencode($apiKey)
     . '&requestId='   . urlencode($requestId)
     . '&requestTime=' . urlencode($requestTime)
     . '&signature='   . urlencode($signature)
     . '&redirectUrl=' . urlencode($redirectUrl);

header('Location: ' . $url);
```

The same two primitives elsewhere:

| Stack | UTC timestamp with microseconds | SHA-512 hex |
|---|---|---|
| Node / TypeScript | `toISOString()` gives milliseconds — pad it, e.g. `d.toISOString().replace("Z", "000Z")` | `crypto.createHash("sha512").update(sig).digest("hex")` |
| Python | `datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"` | `hashlib.sha512(sig.encode()).hexdigest()` |
| Java | `DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'").withZone(ZoneOffset.UTC)` | `MessageDigest.getInstance("SHA-512")`, then hex-encode |
| Go | `time.Now().UTC().Format("2006-01-02T15:04:05.000000Z")` | `sha512.Sum512([]byte(sig))` + `hex.EncodeToString` |
| C# | `DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.ffffffZ")` | `SHA512.HashData(...)` + `Convert.ToHexString(...).ToLowerInvariant()` |

**Build the URL on the server and redirect from the server.** The moment the signature is
computed in browser JavaScript, the API Secret is in the bundle and anyone can mint consent
requests against your application.

### Handling the return

bdapps sends the browser back to your `redirectUrl` when the user finishes — whether they
consented or not. Your handler must:

1. **Look the `requestId` up in your own store.** If you did not issue it, or it has already
   been consumed, stop. Anyone can navigate a browser to your return URL.
2. **Confirm the subscription against the platform.** `POST /subscription/getStatus` with the
   `subscriberId` is the authoritative answer — see [04-subscription.md](04-subscription.md).
   Treat the redirect as a hint that something happened, and the API as the fact.
3. **Mark the `requestId` consumed**, so a replayed return cannot activate anything twice.
4. **Record the consent** — the timestamp, the `requestId`, and what the user was shown. This is
   the evidence that gets asked for when a subscriber disputes a charge.

A user who consents on the SDK page also reaches your `/subscription/notify` handler when the
platform's notification fires. Both paths must converge on the same local state, which means the
handler must be idempotent — see [07-callbacks.md](07-callbacks.md).

### Rules

- **The API Secret is a credential with the authority to subscribe and charge people.** It goes
  in the environment, read through one config module, never in source, never in a client bundle,
  never in a log line, never in git history. Everything in
  [09-security-best-practices.md](09-security-best-practices.md) applies to it unchanged.
- **`requestTime` must be the exact string you hashed.** Generate it once into a variable and
  use that variable in both the signature and the query string. Formatting it twice is the most
  common way this fails, and the failure looks like a wrong secret.
- **URL-encode every parameter.** `requestTime` contains `:` characters and `redirectUrl`
  contains `://` — an unencoded `redirectUrl` will truncate at its own `&`.
- **`requestId` is yours and must be unique.** Persist it before the redirect, not after. A
  return you cannot match to a request is a return you cannot trust.
- **Never reuse a signature.** One per consent attempt; a fresh `requestTime` makes one.
- **`redirectUrl` must be HTTPS and must be a URL you control.** Never build it from anything
  the user supplied — an open redirect on a consent flow is a phishing tool.
- **The SDK does not replace the subscription APIs.** Unregister, status and base size are still
  the endpoints in [04-subscription.md](04-subscription.md), and users still expect to be able
  to opt out by SMS.

---

## Related

| | |
|---|---|
| Register, unregister, status, base size, notifications | [04-subscription.md](04-subscription.md) |
| OTP request and verify as runnable curls | [13-curl-reference.md](13-curl-reference.md) |
| Callback contract and idempotency | [07-callbacks.md](07-callbacks.md) |
| `E1850` / `E1851` / `E1852` and every other code | [08-status-codes.md](08-status-codes.md) |
| Credential handling, PII and consent records | [09-security-best-practices.md](09-security-best-practices.md) |
| Charging a subscriber directly instead | [05-caas.md](05-caas.md) |
