<!-- Generated from catalog/bdapps-api.json by scripts/build-curl-reference.mjs. Do not edit directly. -->

# Every Endpoint as curl

The whole bdapps contract at the wire: each endpoint, each parameter defined, a request you
can run, and the response it returns. No SDK, no generated code, no tooling of any kind between
you and the platform.

**Write the integration from this page, in whatever language the project already uses.** There
is deliberately no code generator in this skill: a generator would privilege a handful of
languages and rot as their idioms move, while the request below is the same call in all of
them. The body, the headers and the branching are identical whether it goes out through
`requests` in Python, `HttpClient` in Java or .NET, `net/http` in Go, Guzzle in PHP,
`Net::HTTP` in Ruby, `reqwest` in Rust, `HTTPoison` in Elixir or `fetch` in Node. Translate the
curl into the project's own HTTP client and idiom; keep everything else exactly as specified.

Run these against a real application to confirm provisioning and credentials before writing a
line of code — a working curl removes half the possible causes when the integration then fails.

---

## The shape of every call

```
POST  https://developer.bdapps.com/<service-path>
Content-Type: application/json
```

- **Credentials travel in the JSON body**, as `applicationId` and `password`. There are no
  headers, no tokens, no signatures and no OAuth on this platform.
- **Every response is HTTP 200**, including failures. bdapps returns HTTP 200 for application-level failures. Branch on statusCode, never on the HTTP status alone. S1000 is success.
- Every response carries `statusCode` and `statusDetail`; most also carry
  `version` and `requestId`.
- Subscriber addresses are always `tel:<msisdn>` — no `+`, no spaces.
  A masked application receives a hash (`tel:hu3b84346f…`) instead of a number; it is opaque,
  so send back exactly what you received.
- **bdappsAI is the one exception to all of the above.** The AI gateway
  (`https://developer.bdapps.com/bdappsai/api`) authenticates with an `Authorization` header,
  returns real HTTP status codes with an `error` object, and has no subscriber, no `tel:`
  address and no callbacks. It is at the [end of this page](#the-ai-gateway--bdappsai), kept
  separate so its conventions never get applied to a telco call or the other way round.

## Before you run anything

Export your credentials and the endpoints your application is provisioned for. Every command on
this page reads them from the environment, so nothing here contains a credential and nothing you
copy can commit one.

```bash
export BDAPPS_APP_ID='APP_XXXXXX'
export BDAPPS_PASSWORD='…'                 # from the portal — never commit it
export BDAPPS_SMS_SEND_URL='https://developer.bdapps.com/sms/send'
export BDAPPS_USSD_SEND_URL='https://developer.bdapps.com/ussd/send'
export BDAPPS_SUBSCRIPTION_SEND_URL='https://developer.bdapps.com/subscription/send'
export BDAPPS_SUBSCRIPTION_STATUS_URL='https://developer.bdapps.com/subscription/getStatus'
export BDAPPS_SUBSCRIPTION_QUERY_BASE_URL='https://developer.bdapps.com/subscription/query-base'
export BDAPPS_OTP_REQUEST_URL='https://developer.bdapps.com/otp/request'
export BDAPPS_OTP_VERIFY_URL='https://developer.bdapps.com/otp/verify'
export BDAPPS_CAAS_DEBIT_URL='https://developer.bdapps.com/caas/direct/debit'
export BDAPPS_CAAS_GET_BALANCE_URL='https://developer.bdapps.com/caas/get/balance'
```

One variable per provisioned service, never one shared base URL: an application can only call
the APIs it was provisioned for, so an endpoint you have no variable for is one you must not
call. Everything on this page is served from https://developer.bdapps.com.

Windows PowerShell, where `curl` is an alias for `Invoke-WebRequest` and the syntax differs:

```powershell
$body = @{ applicationId = $env:BDAPPS_APP_ID; password = $env:BDAPPS_PASSWORD } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri $env:BDAPPS_SUBSCRIPTION_QUERY_BASE_URL `
  -ContentType 'application/json' -Body $body
```

Three flags in every request below, all deliberate: `-sS` prints errors but not a progress bar,
`--max-time 15` stops a hung call holding a request thread, and `-d @- <<REQUEST` reads the body
from a heredoc so the credential variables expand and the JSON stays readable.

**Start with Query Base.** It needs no subscriber, costs nothing and touches no one, so it is
the safest way to prove that your credentials, your provisioning and your egress IP all work.

---

## Endpoint index

| Service | Endpoint | Environment variable |
|---|---|---|
| [SMS Send](#sms-send) | `POST https://developer.bdapps.com/sms/send` | `BDAPPS_SMS_SEND_URL` |
| [USSD Send](#ussd-send) | `POST https://developer.bdapps.com/ussd/send` | `BDAPPS_USSD_SEND_URL` |
| [Subscription Register](#subscription-register) | `POST https://developer.bdapps.com/subscription/send` | `BDAPPS_SUBSCRIPTION_SEND_URL` |
| [Subscription Unregister](#subscription-unregister) | `POST https://developer.bdapps.com/subscription/send` | `BDAPPS_SUBSCRIPTION_SEND_URL` |
| [Subscription Status](#subscription-status) | `POST https://developer.bdapps.com/subscription/getStatus` | `BDAPPS_SUBSCRIPTION_STATUS_URL` |
| [Query Base (subscriber base size)](#query-base-subscriber-base-size) | `POST https://developer.bdapps.com/subscription/query-base` | `BDAPPS_SUBSCRIPTION_QUERY_BASE_URL` |
| [OTP Request](#otp-request) | `POST https://developer.bdapps.com/otp/request` | `BDAPPS_OTP_REQUEST_URL` |
| [OTP Verify](#otp-verify) | `POST https://developer.bdapps.com/otp/verify` | `BDAPPS_OTP_VERIFY_URL` |
| [CaaS Direct Debit](#caas-direct-debit) | `POST https://developer.bdapps.com/caas/direct/debit` | `BDAPPS_CAAS_DEBIT_URL` |
| [CaaS Query Balance](#caas-query-balance) | `POST https://developer.bdapps.com/caas/get/balance` | `BDAPPS_CAAS_GET_BALANCE_URL` |

| Callback | bdapps calls | Configured in |
|---|---|---|
| [MO SMS Receive](#mo-sms-receive) | `POST <your-host>/api/bdapps/sms/mo` | SMS API settings |
| [SMS Delivery Status Report](#sms-delivery-status-report) | `POST <your-host>/api/bdapps/sms/dlr` | SMS API settings |
| [USSD Receive](#ussd-receive) | `POST <your-host>/api/bdapps/ussd` | USSD API settings |
| [Subscription Notification](#subscription-notification) | `POST <your-host>/api/bdapps/subscription/notification` | Subscription API settings |

| AI gateway | Endpoint | Environment variable |
|---|---|---|
| [bdappsAI Chat Completions](#bdappsai-chat-completions) | `POST https://developer.bdapps.com/bdappsai/api/v1/chat/completions` | `BDAPPSAI_CHAT_COMPLETIONS_URL` |
| [bdappsAI Image Generation](#bdappsai-image-generation) | `POST https://developer.bdapps.com/bdappsai/api/v1/images/generations` | `BDAPPSAI_IMAGE_GENERATIONS_URL` |

---

# Outbound services — you call bdapps

---

## SMS Send

Send an MT (Mobile Terminated) SMS to one or more subscribers.

| | |
|---|---|
| **Endpoint** | `POST https://developer.bdapps.com/sms/send` |
| **Environment variable** | `BDAPPS_SMS_SEND_URL` |
| **Content type** | `application/json` |
| **Full guide** | [02-sms.md](02-sms.md) |

### Request parameters

| Parameter | Type | | Definition |
|---|---|---|---|
| `applicationId` | string | **Required** | Application ID as given when provisioned. |
| `password` | string | **Required** | Password given when provisioned. |
| `version` | string | Optional | API version (1.0, 2.0). Defaults to latest. |
| `destinationAddresses` | string[] | **Required** | Array of tel:-prefixed addresses. Always an array, even for one recipient. tel:all targets the whole subscribed base. |
| `message` | string | **Required** | Message body. Over-length messages are split by the platform and charged per part. |
| `sourceAddress` | string | Optional | Sender address shown to the user — your allocated shortcode (e.g. "77000") or a provisioned tel: alias. Must be provisioned or the send fails with E1331. |
| `deliveryStatusRequest` | enum | Optional | 0 = no delivery report, 1 = request one. Defaults to 0. One of `0`, `1`. |
| `encoding` | enum | Optional | 0 = Text, 240 = Flash SMS, 245 = Binary (message hex-encoded). Defaults to Text. One of `0`, `240`, `245`. |
| `binaryHeader` | string | Optional | Hex-encoded UDH for advanced binary messages. Only meaningful with encoding 245. |

### Request

```bash
curl -sS -X POST "$BDAPPS_SMS_SEND_URL" \
  -H 'Content-Type: application/json' \
  --max-time 15 \
  -d @- <<REQUEST
{
  "applicationId": "$BDAPPS_APP_ID",
  "password": "$BDAPPS_PASSWORD",
  "destinationAddresses": [
    "tel:8801812345678"
  ],
  "message": "Hello"
}
REQUEST
```

### Response

HTTP 200. Success is `statusCode: "S1000"` — nothing else.

```json
{
  "statusCode": "S1000",
  "statusDetail": "Success",
  "messageId": "MSG_000111",
  "version": "1.0"
}
```

### Response fields

| Field | Type | Meaning |
|---|---|---|
| `statusCode` | string | S1000 on success. |
| `statusDetail` | string | Human-readable outcome. |
| `messageId` | string | Platform message identifier. |
| `version` | string | API version. |
| `destinationResponses` | object[] | Per-recipient results. A multi-recipient send can partially succeed, so branch on each entry's statusCode, not only the top-level one. |

### Status codes for this endpoint

| Code | Class | Meaning |
|---|---|---|
| `S1000` | success | Success |
| `E1303` | configuration | IP address, which the request originates from, is not listed within the allowed-host-address list → Run curl -4 https://api.ipify.org on the calling server and add that IP to Allowed Host Addresses. |
| `E1313` | configuration | Authentication failure. There is no active application, or no active service provider, or the given password in the request is invalid. → Check BDAPPS_APP_ID and BDAPPS_PASSWORD, and that the app is active. |
| `E1309` | configuration | Requested service is not allowed for this Application → That API was not provisioned for this app. |
| `E1311` | configuration | MT flow is not allowed for this Application |
| `E1322` | configuration | Requested sender is not allowed |
| `E1323` | configuration | Requested recipients not allowed |
| `E1325` | client | Format of the address is invalid → Missing tel: prefix, or a + / space slipped in. |
| `E1331` | configuration | Sorry, invalid/unauthorized source address. Please check the availability of default sender address or aliases for SMS-MT in {0} application. → sourceAddress must be a provisioned alias. |
| `E1332` | transient | Delivery failed |
| `E1333` | user-state | Message contains suspected abusive content, or subscriber base is larger than the limit; will be stored for admin approval |
| `E1334` | client | Message length is too long. Maximum message length is {0} |
| `E1335` | client | Message length is too long. Maximum message length for advertisement messages is {0} |
| `E1341` | transient | Delivery failed. Errors occurred while sending the request for the intended destinations |
| `E1384` | configuration | International SMS sending is disabled |

`configuration` fix the portal, not the code — the integration is down, not one request · `client` fix the payload or the user's input · `user-state` the user is not eligible right now; tell them, do not loop · `transient` retry with capped exponential backoff. Full table: [08-status-codes.md](08-status-codes.md).

### Rules

- destinationAddresses is always an array.
- Guard tel:all behind a deliberate, separately-authorised code path.
- Keep under 160 GSM-7 characters for one part; Bengali is UCS-2, so budget 70. Every part is billed.
- Only set deliveryStatusRequest to 1 if you consume the delivery-report callback.

---

## USSD Send

Send a USSD screen to a subscriber inside an active session.

| | |
|---|---|
| **Endpoint** | `POST https://developer.bdapps.com/ussd/send` |
| **Environment variable** | `BDAPPS_USSD_SEND_URL` |
| **Content type** | `application/json` |
| **Full guide** | [03-ussd.md](03-ussd.md) |

### Request parameters

| Parameter | Type | | Definition |
|---|---|---|---|
| `applicationId` | string | **Required** | Application ID as given when provisioned. |
| `password` | string | **Required** | Password given when provisioned. |
| `version` | string | **Required** | API version. Defaults to latest. |
| `message` | string | **Required** | Screen text sent to the handset. ~182 char limit; assume 160. |
| `sessionId` | string | **Required** | Session number assigned by the USSD gateway. Echo the one the platform sent you; never generate your own. |
| `ussdOperation` | enum | **Required** | mt-init starts an app-initiated session, mt-cont keeps it open, mt-fin closes it. One of `mt-init`, `mt-cont`, `mt-fin`. |
| `destinationAddress` | string | **Required** | tel:-prefixed subscriber address; may be a hash key. |
| `encoding` | enum | Optional | 440 = plain ASCII. One of `440`. |

### Request

```bash
curl -sS -X POST "$BDAPPS_USSD_SEND_URL" \
  -H 'Content-Type: application/json' \
  --max-time 15 \
  -d @- <<REQUEST
{
  "applicationId": "$BDAPPS_APP_ID",
  "password": "$BDAPPS_PASSWORD",
  "version": "1.0",
  "message": "1. Press One\n2. Press Two\n3. Exit",
  "sessionId": "1330929317043",
  "ussdOperation": "mt-cont",
  "destinationAddress": "tel:8801812345678",
  "encoding": "440"
}
REQUEST
```

### Response

HTTP 200. Success is `statusCode: "S1000"` — nothing else.

```json
{
  "statusCode": "S1000",
  "timeStamp": "1203051205",
  "statusDetail": "Success",
  "requestId": "1330929317059",
  "version": "1.0"
}
```

### Response fields

| Field | Type | Meaning |
|---|---|---|
| `statusCode` | string | S1000 on success. |
| `statusDetail` | string | Human-readable outcome. |
| `requestId` | string | Uniquely identifies the request within bdapps. |
| `timeStamp` | string | Processed timestamp. |
| `version` | string | API version. |

### Status codes for this endpoint

| Code | Class | Meaning |
|---|---|---|
| `S1000` | success | Success |
| `E1303` | configuration | IP address, which the request originates from, is not listed within the allowed-host-address list → Run curl -4 https://api.ipify.org on the calling server and add that IP to Allowed Host Addresses. |
| `E1313` | configuration | Authentication failure. There is no active application, or no active service provider, or the given password in the request is invalid. → Check BDAPPS_APP_ID and BDAPPS_PASSWORD, and that the app is active. |
| `E1309` | configuration | Requested service is not allowed for this Application → That API was not provisioned for this app. |
| `E1383` | configuration | USSD network initiated flow not allowed |

`configuration` fix the portal, not the code — the integration is down, not one request · `client` fix the payload or the user's input · `user-state` the user is not eligible right now; tell them, do not loop · `transient` retry with capped exponential backoff. Full table: [08-status-codes.md](08-status-codes.md).

### Rules

- Echo the platform's sessionId. A wrong one orphans the session.
- Terminal screens must use mt-fin, or the session hangs until the network times it out.
- Plain ASCII only (encoding 440) — no emoji, no Bengali script, no smart quotes.
- Reply fast: USSD sessions time out in seconds.

---

## Subscription Register

Opt a subscriber in to the application.

| | |
|---|---|
| **Endpoint** | `POST https://developer.bdapps.com/subscription/send` |
| **Environment variable** | `BDAPPS_SUBSCRIPTION_SEND_URL` |
| **Content type** | `application/json` |
| **Full guide** | [04-subscription.md](04-subscription.md) |

### Request parameters

| Parameter | Type | | Definition |
|---|---|---|---|
| `applicationId` | string | **Required** | Application ID as received when provisioned. |
| `password` | string | **Required** | Password as received when provisioned. |
| `version` | string | Optional | API version. Defaults to latest. |
| `action` | enum | **Required** | 1 = opt in. Send the string "1". One of `1`. |
| `subscriberId` | string | **Required** | tel:-prefixed subscriber address; may be masked. |

### Request

```bash
curl -sS -X POST "$BDAPPS_SUBSCRIPTION_SEND_URL" \
  -H 'Content-Type: application/json' \
  --max-time 15 \
  -d @- <<REQUEST
{
  "applicationId": "$BDAPPS_APP_ID",
  "password": "$BDAPPS_PASSWORD",
  "version": "1.0",
  "action": "1",
  "subscriberId": "tel:8801812345678"
}
REQUEST
```

### Response

HTTP 200. Success is `statusCode: "S1000"` — nothing else.

```json
{
  "version": "1.0",
  "requestId": "1374746416574",
  "statusCode": "S1000",
  "statusDetail": "SUCCESS",
  "subscriptionStatus": "REGISTERED"
}
```

### Response fields

| Field | Type | Meaning |
|---|---|---|
| `statusCode` | string | S1000 on success. |
| `statusDetail` | string | Human-readable outcome. |
| `requestId` | string | Uniquely identifies the request within the SDP. |
| `subscriptionStatus` | enum | REGISTERED, UNREGISTERED or PENDING. PENDING CHARGE means the subscriber has not been charged yet. |
| `version` | string | API version. |

### Status codes for this endpoint

| Code | Class | Meaning |
|---|---|---|
| `S1000` | success | Success |
| `E1303` | configuration | IP address, which the request originates from, is not listed within the allowed-host-address list → Run curl -4 https://api.ipify.org on the calling server and add that IP to Allowed Host Addresses. |
| `E1313` | configuration | Authentication failure. There is no active application, or no active service provider, or the given password in the request is invalid. → Check BDAPPS_APP_ID and BDAPPS_PASSWORD, and that the app is active. |
| `E1309` | configuration | Requested service is not allowed for this Application → That API was not provisioned for this app. |
| `E1317` | user-state | MSISDN in the request is in an invalid state (may be blocked, or have an invalid number of digits) |
| `E1324` | configuration | Subscription via HTTP is not allowed |
| `E1351` | user-state | User already registered **Treat this as success.** |
| `E1342` | user-state | Sorry, your phone number is blacklisted to use this application {0} |
| `E1343` | user-state | Non-whitelisted mobile number accessing services of application {0} → In Limited Production, only numbers in Whitelisted Numbers can use the app. |

`configuration` fix the portal, not the code — the integration is down, not one request · `client` fix the payload or the user's input · `user-state` the user is not eligible right now; tell them, do not loop · `transient` retry with capped exponential backoff. Full table: [08-status-codes.md](08-status-codes.md).

### Rules

- Only call with explicit, recorded consent. Disclose amount and frequency before registering.
- E1351 (already registered) is success — the desired state already holds.
- A PENDING result is not active yet; wait for the subscription notification before delivering the service.

---

## Subscription Unregister

Opt a subscriber out of the application.

| | |
|---|---|
| **Endpoint** | `POST https://developer.bdapps.com/subscription/send` |
| **Environment variable** | `BDAPPS_SUBSCRIPTION_SEND_URL` |
| **Content type** | `application/json` |
| **Full guide** | [04-subscription.md](04-subscription.md) |

### Request parameters

| Parameter | Type | | Definition |
|---|---|---|---|
| `applicationId` | string | **Required** | Application ID as received when provisioned. |
| `password` | string | **Required** | Password as received when provisioned. |
| `version` | string | Optional | API version. Defaults to latest. |
| `action` | enum | **Required** | 0 = opt out. One of `0`. |
| `subscriberId` | string | **Required** | tel:-prefixed subscriber address; may be masked. |

### Request

```bash
curl -sS -X POST "$BDAPPS_SUBSCRIPTION_SEND_URL" \
  -H 'Content-Type: application/json' \
  --max-time 15 \
  -d @- <<REQUEST
{
  "applicationId": "$BDAPPS_APP_ID",
  "password": "$BDAPPS_PASSWORD",
  "version": "1.0",
  "action": "0",
  "subscriberId": "tel:8801812345678"
}
REQUEST
```

### Response

HTTP 200. Success is `statusCode: "S1000"` — nothing else.

```json
{
  "version": "1.0",
  "requestId": "1374746416574",
  "statusCode": "S1000",
  "statusDetail": "SUCCESS",
  "subscriptionStatus": "UNREGISTERED"
}
```

### Response fields

| Field | Type | Meaning |
|---|---|---|
| `statusCode` | string | S1000 on success. |
| `statusDetail` | string | Human-readable outcome. |
| `requestId` | string | Uniquely identifies the request within the SDP. |
| `subscriptionStatus` | enum | UNREGISTERED on success. |
| `version` | string | API version. |

### Status codes for this endpoint

| Code | Class | Meaning |
|---|---|---|
| `S1000` | success | Success |
| `E1303` | configuration | IP address, which the request originates from, is not listed within the allowed-host-address list → Run curl -4 https://api.ipify.org on the calling server and add that IP to Allowed Host Addresses. |
| `E1313` | configuration | Authentication failure. There is no active application, or no active service provider, or the given password in the request is invalid. → Check BDAPPS_APP_ID and BDAPPS_PASSWORD, and that the app is active. |
| `E1309` | configuration | Requested service is not allowed for this Application → That API was not provisioned for this app. |
| `E1356` | user-state | User not registered **Treat this as success.** |

`configuration` fix the portal, not the code — the integration is down, not one request · `client` fix the payload or the user's input · `user-state` the user is not eligible right now; tell them, do not loop · `transient` retry with capped exponential backoff. Full table: [08-status-codes.md](08-status-codes.md).

### Rules

- Unregister must be as easy as register — offer it over MO SMS (STOP/UNSUB/OFF), USSD and in-app.
- E1356 (not registered) is success — the desired state already holds.
- Honour it immediately, including cancelling queued and scheduled messages.

---

## Subscription Status

Check the current subscription status of one subscriber.

| | |
|---|---|
| **Endpoint** | `POST https://developer.bdapps.com/subscription/getStatus` |
| **Environment variable** | `BDAPPS_SUBSCRIPTION_STATUS_URL` |
| **Content type** | `application/json` |
| **Full guide** | [04-subscription.md](04-subscription.md) |

### Request parameters

| Parameter | Type | | Definition |
|---|---|---|---|
| `applicationId` | string | **Required** | Application ID as received when provisioned. |
| `password` | string | **Required** | Password as received when provisioned. |
| `subscriberId` | string | **Required** | tel:-prefixed subscriber address; may be masked. |

### Request

```bash
curl -sS -X POST "$BDAPPS_SUBSCRIPTION_STATUS_URL" \
  -H 'Content-Type: application/json' \
  --max-time 15 \
  -d @- <<REQUEST
{
  "applicationId": "$BDAPPS_APP_ID",
  "password": "$BDAPPS_PASSWORD",
  "subscriberId": "tel:8801812345678"
}
REQUEST
```

### Response

HTTP 200. Success is `statusCode: "S1000"` — nothing else.

```json
{
  "version": "1.0",
  "subscriptionStatus": "REGISTERED",
  "statusCode": "S1000",
  "statusDetail": "SUCCESS"
}
```

### Response fields

| Field | Type | Meaning |
|---|---|---|
| `statusCode` | string | S1000 on success. |
| `statusDetail` | string | Human-readable outcome. |
| `subscriptionStatus` | enum | REGISTERED / UNREGISTERED / PENDING / CHARGE. |
| `version` | string | API version. |

### Status codes for this endpoint

| Code | Class | Meaning |
|---|---|---|
| `S1000` | success | Success |
| `E1303` | configuration | IP address, which the request originates from, is not listed within the allowed-host-address list → Run curl -4 https://api.ipify.org on the calling server and add that IP to Allowed Host Addresses. |
| `E1313` | configuration | Authentication failure. There is no active application, or no active service provider, or the given password in the request is invalid. → Check BDAPPS_APP_ID and BDAPPS_PASSWORD, and that the app is active. |
| `E1309` | configuration | Requested service is not allowed for this Application → That API was not provisioned for this app. |
| `E1356` | user-state | User not registered |

`configuration` fix the portal, not the code — the integration is down, not one request · `client` fix the payload or the user's input · `user-state` the user is not eligible right now; tell them, do not loop · `transient` retry with capped exponential backoff. Full table: [08-status-codes.md](08-status-codes.md).

### Rules

- Use for reconciliation, not as a per-request gate — mirror state locally from the subscription notification instead.

---

## Query Base (subscriber base size)

Return the number of subscribers currently registered to the application.

| | |
|---|---|
| **Endpoint** | `POST https://developer.bdapps.com/subscription/query-base` |
| **Environment variable** | `BDAPPS_SUBSCRIPTION_QUERY_BASE_URL` |
| **Content type** | `application/json` |
| **Full guide** | [04-subscription.md](04-subscription.md) |

### Request parameters

| Parameter | Type | | Definition |
|---|---|---|---|
| `applicationId` | string | **Required** | Application ID as received when provisioned. |
| `password` | string | **Required** | Password as received when provisioned. |

### Request

```bash
curl -sS -X POST "$BDAPPS_SUBSCRIPTION_QUERY_BASE_URL" \
  -H 'Content-Type: application/json' \
  --max-time 15 \
  -d @- <<REQUEST
{
  "applicationId": "$BDAPPS_APP_ID",
  "password": "$BDAPPS_PASSWORD"
}
REQUEST
```

### Response

HTTP 200. Success is `statusCode: "S1000"` — nothing else.

```json
{
  "version": "1.0",
  "baseSize": "10",
  "statusCode": "S1000",
  "statusDetail": "SUCCESS"
}
```

### Response fields

| Field | Type | Meaning |
|---|---|---|
| `statusCode` | string | S1000 on success. |
| `statusDetail` | string | Human-readable outcome. |
| `baseSize` | string | Current subscriber base size. Arrives as a string — coerce before arithmetic. |
| `version` | string | API version. |

### Status codes for this endpoint

| Code | Class | Meaning |
|---|---|---|
| `S1000` | success | Success |
| `E1303` | configuration | IP address, which the request originates from, is not listed within the allowed-host-address list → Run curl -4 https://api.ipify.org on the calling server and add that IP to Allowed Host Addresses. |
| `E1313` | configuration | Authentication failure. There is no active application, or no active service provider, or the given password in the request is invalid. → Check BDAPPS_APP_ID and BDAPPS_PASSWORD, and that the app is active. |
| `E1309` | configuration | Requested service is not allowed for this Application → That API was not provisioned for this app. |

`configuration` fix the portal, not the code — the integration is down, not one request · `client` fix the payload or the user's input · `user-state` the user is not eligible right now; tell them, do not loop · `transient` retry with capped exponential backoff. Full table: [08-status-codes.md](08-status-codes.md).

### Rules

- Needs no subscriber and costs nothing — the ideal connectivity and credential smoke test.
- baseSize is a string. Parse it.
- Poll on a schedule into your own metrics rather than per page load.
- Sanity-check it before any tel:all broadcast.

---

## OTP Request

Dispatch a one-time PIN by SMS so a web or app user can be registered from a plain mobile number.

| | |
|---|---|
| **Endpoint** | `POST https://developer.bdapps.com/otp/request` |
| **Environment variable** | `BDAPPS_OTP_REQUEST_URL` |
| **Content type** | `application/json` |
| **Full guide** | [04-subscription.md](04-subscription.md) |

### Request parameters

| Parameter | Type | | Definition |
|---|---|---|---|
| `applicationId` | string | **Required** | Application ID as received when provisioned. |
| `password` | string | **Required** | Password as received when provisioned. |
| `subscriberId` | string | **Required** | tel:-prefixed mobile number the user typed. |
| `applicationHash` | string | Optional | The hash string identifying your app, so bdapps sends the verification message in the form your app can read (the Android SMS Retriever app hash). It is a per-application constant, not a per-request id. |
| `applicationMetaData` | object | Optional | client (MOBILEAPP \| WebSite \| DESKTOP), device, os, appCode (package name / store URL / page URL / download URL). |

### Request

```bash
curl -sS -X POST "$BDAPPS_OTP_REQUEST_URL" \
  -H 'Content-Type: application/json' \
  --max-time 15 \
  -d @- <<REQUEST
{
  "applicationId": "$BDAPPS_APP_ID",
  "password": "$BDAPPS_PASSWORD",
  "subscriberId": "tel:8801812345678",
  "applicationHash": "abcdefgh",
  "applicationMetaData": {
    "client": "MOBILEAPP",
    "device": "Samsung S10",
    "os": "android8",
    "appCode": "https://play.google.com/store/apps/details?id=com.example.app"
  }
}
REQUEST
```

### Response

HTTP 200. Success is `statusCode: "S1000"` — nothing else.

```json
{
  "statusCode": "S1000",
  "statusDetail": "Success",
  "referenceNo": "3b84346f63899a32ec742a676532ec74dffe4f5",
  "version": "1.0"
}
```

### Response fields

| Field | Type | Meaning |
|---|---|---|
| `statusCode` | string | S1000 on success. |
| `statusDetail` | string | Human-readable outcome. |
| `referenceNo` | string | Pass to OTP Verify. Keep server-side, in the session — never send it to the client. |
| `version` | string | API version. |

### Status codes for this endpoint

| Code | Class | Meaning |
|---|---|---|
| `S1000` | success | Success |
| `E1303` | configuration | IP address, which the request originates from, is not listed within the allowed-host-address list → Run curl -4 https://api.ipify.org on the calling server and add that IP to Allowed Host Addresses. |
| `E1313` | configuration | Authentication failure. There is no active application, or no active service provider, or the given password in the request is invalid. → Check BDAPPS_APP_ID and BDAPPS_PASSWORD, and that the app is active. |
| `E1351` | user-state | User already registered |

`configuration` fix the portal, not the code — the integration is down, not one request · `client` fix the payload or the user's input · `user-state` the user is not eligible right now; tell them, do not loop · `transient` retry with capped exponential backoff. Full table: [08-status-codes.md](08-status-codes.md).

### Rules

- Rate-limit per number AND per IP, or the app becomes an SMS-bombing tool at your expense.
- One OTP is valid for 60 minutes.
- Always call from a backend with a static IP.

---

## OTP Verify

Verify a PIN and receive the masked subscriberId to use with every other API.

| | |
|---|---|
| **Endpoint** | `POST https://developer.bdapps.com/otp/verify` |
| **Environment variable** | `BDAPPS_OTP_VERIFY_URL` |
| **Content type** | `application/json` |
| **Full guide** | [04-subscription.md](04-subscription.md) |

### Request parameters

| Parameter | Type | | Definition |
|---|---|---|---|
| `applicationId` | string | **Required** | Application ID as received when provisioned. |
| `password` | string | **Required** | Password as received when provisioned. |
| `referenceNo` | string | **Required** | From the OTP Request response. Server-side only. |
| `otp` | string | **Required** | The PIN the user entered. |

### Request

```bash
curl -sS -X POST "$BDAPPS_OTP_VERIFY_URL" \
  -H 'Content-Type: application/json' \
  --max-time 15 \
  -d @- <<REQUEST
{
  "applicationId": "$BDAPPS_APP_ID",
  "password": "$BDAPPS_PASSWORD",
  "referenceNo": "3b84346f63899a32ec742a676532ec74dffe4f5",
  "otp": "123564"
}
REQUEST
```

### Response

HTTP 200. Success is `statusCode: "S1000"` — nothing else.

```json
{
  "statusCode": "S1000",
  "statusDetail": "Success",
  "subscriptionStatus": "REGISTERED",
  "version": "1.0",
  "subscriberId": "tel:hu3b84346f63899a32ec742a666503a02a4dffe4f5"
}
```

### Response fields

| Field | Type | Meaning |
|---|---|---|
| `statusCode` | string | S1000 on success. |
| `statusDetail` | string | Human-readable outcome. |
| `subscriberId` | string | Masked subscriber identifier. Use this for SMS, Subscription and Charging from now on. |
| `subscriptionStatus` | enum | REGISTERED on success. |
| `version` | string | API version. |

### Status codes for this endpoint

| Code | Class | Meaning |
|---|---|---|
| `S1000` | success | Success |
| `E1850` | client | Invalid OTP → Maximum 3 attempts per OTP. |
| `E1851` | client | OTP request has expired → OTPs are valid for 60 minutes. |
| `E1852` | client | Maximum number of OTP attempts reached |
| `E1853` | client | No active OTP request found for this reference number |

`configuration` fix the portal, not the code — the integration is down, not one request · `client` fix the payload or the user's input · `user-state` the user is not eligible right now; tell them, do not loop · `transient` retry with capped exponential backoff. Full table: [08-status-codes.md](08-status-codes.md).

### Rules

- Maximum 3 attempts per OTP — enforce it on your side too.
- Never log the OTP or the referenceNo.
- Store the returned masked subscriberId as the user's bdapps identity.

---

## CaaS Direct Debit

Charge a specific amount from a subscriber's mobile account. Moves real money.

| | |
|---|---|
| **Endpoint** | `POST https://developer.bdapps.com/caas/direct/debit` |
| **Environment variable** | `BDAPPS_CAAS_DEBIT_URL` |
| **Content type** | `application/json` |
| **Full guide** | [05-caas.md](05-caas.md) |

> **This call moves real money.** `externalTrxId` is the idempotency key: generate it,
> persist it *before* sending, and reuse it unchanged on every resolution attempt. A retry with
> a fresh one charges a real person twice.

### Request parameters

| Parameter | Type | | Definition |
|---|---|---|---|
| `applicationId` | string | **Required** | Application ID generated when provisioning. |
| `password` | string | **Required** | Password authenticating the application. |
| `externalTrxId` | string | **Required** | Your transaction ID, mapping request to response. Max 32 characters. Persist BEFORE calling — it is the idempotency key. |
| `subscriberId` | string | **Required** | MSISDN or hash key of the subscriber to charge. |
| `paymentInstrumentName` | enum | **Required** | The payment instrument to charge or read. MobileAccount is the only value bdapps accepts. Omitting it fails the call. One of `MobileAccount`. |
| `amount` | string | **Required** | Amount to charge, sent as a string. Hold as a decimal type in your own code. |
| `accountId` | string | Optional | The account of the payment instrument. Optional; a single value per request. |
| `currency` | string | Optional | Currency of the amount. Only BDT is allowed. |

### Request

```bash
curl -sS -X POST "$BDAPPS_CAAS_DEBIT_URL" \
  -H 'Content-Type: application/json' \
  --max-time 15 \
  -d @- <<REQUEST
{
  "applicationId": "$BDAPPS_APP_ID",
  "password": "$BDAPPS_PASSWORD",
  "externalTrxId": "12345678901234567890123456789012",
  "subscriberId": "tel:8801812345678",
  "paymentInstrumentName": "MobileAccount",
  "amount": "6.00",
  "currency": "BDT"
}
REQUEST
```

### Response

HTTP 200. Success is `statusCode: "S1000"` — nothing else.

```json
{
  "statusCode": "S1000",
  "timeStamp": "2012-07-30T12:48:10-0400",
  "statusDetail": "Success",
  "externalTrxId": "12345678901234567890123456789012",
  "internalTrxId": "321"
}
```

### Response fields

| Field | Type | Meaning |
|---|---|---|
| `statusCode` | string | S1000 on success. |
| `statusDetail` | string | Human-readable outcome. |
| `externalTrxId` | string | Echo of your ID. Assert it matches what you sent. |
| `internalTrxId` | string | Payment gateway transaction ID. Persist it — support and reconciliation use this. |
| `referenceId` | string | 8-digit number for the payment request, where an external charging menu is involved. |
| `timeStamp` | string | ISO-8601 date/time of the transaction. |

### Status codes for this endpoint

| Code | Class | Meaning |
|---|---|---|
| `S1000` | success | Success |
| `E1303` | configuration | IP address, which the request originates from, is not listed within the allowed-host-address list → Run curl -4 https://api.ipify.org on the calling server and add that IP to Allowed Host Addresses. |
| `E1313` | configuration | Authentication failure. There is no active application, or no active service provider, or the given password in the request is invalid. → Check BDAPPS_APP_ID and BDAPPS_PASSWORD, and that the app is active. |
| `E1308` | client | Error during the charging operation |
| `E1328` | configuration | Charging operation not allowed. Please check the NCS configuration. |
| `E1329` | configuration | Charging amount too high. Please check the NCS configuration. |
| `E1330` | configuration | Charging amount too low. Please check the NCS configuration. |
| `E1336` | configuration | No matching service code found for the charging amount |
| `E1337` | user-state | Subscriber authentication by charging gateway failed |
| `E1370` | client | Invalid reservation Id |
| `E1371` | configuration | App does not accept payments from the given Payment Instrument |
| `E1372` | user-state | Default payment instrument for the user not found |
| `E1373` | user-state | Invalid payer account |
| `E1376` | client | Unknown charging error → Escalate to support with the externalTrxId. |
| `E1378` | user-state | Insufficient balance → Tell the user; retry later, not immediately. |
| `E1379` | success | Transaction has already completed → Your idempotency key worked. Treat as success — do NOT charge again. **Treat this as success.** |
| `E1380` | client | Transaction currency not supported |
| `E1382` | user-state | Payment Instrument is not allowed to perform transactions |
| `E1404` | client | Charging Failed |
| `E1405` | user-state | Charging Authorization Timed out → The user did not confirm in time. |
| `E1406` | user-state | Charging Authorization Rejected → The user declined. Never retry. |
| `E1605` | client | Invalid charging request |
| `E1606` | client | Invalid charging amount |

`configuration` fix the portal, not the code — the integration is down, not one request · `client` fix the payload or the user's input · `user-state` the user is not eligible right now; tell them, do not loop · `transient` retry with capped exponential backoff. Full table: [08-status-codes.md](08-status-codes.md).

### Rules

- The amount must be pre-agreed and disclosed to the user before they subscribe.
- Persist externalTrxId before the HTTP call, then update the row from the response.
- Never retry with a fresh externalTrxId — a timeout does not mean the charge failed.
- E1379 (already completed) is success. E1406 (user rejected) must never be retried.
- Amount and currency come from server-side config, never from client input.

---

## CaaS Query Balance

Query a subscriber's remaining chargeable balance.

| | |
|---|---|
| **Endpoint** | `POST https://developer.bdapps.com/caas/get/balance` |
| **Environment variable** | `BDAPPS_CAAS_GET_BALANCE_URL` |
| **Content type** | `application/json` |
| **Full guide** | [05-caas.md](05-caas.md) |

> **Needs provisioning:** Enable Query Balance Requests. Without it the call fails no matter how
> correct the payload is.

### Request parameters

| Parameter | Type | | Definition |
|---|---|---|---|
| `applicationId` | string | **Required** | Application ID generated when provisioning. |
| `password` | string | **Required** | Password authenticating the application. |
| `subscriberId` | string | **Required** | MSISDN or username of the subscriber being queried. The official sample omits the tel: prefix here, unlike every other service; send it tel:-prefixed for consistency — that is what works in practice. |
| `paymentInstrumentName` | enum | **Required** | The payment instrument to charge or read. MobileAccount is the only value bdapps accepts. Omitting it fails the call. One of `MobileAccount`. |
| `accountId` | string | Optional | The account of the payment instrument. Optional; a single value per request. |
| `currency` | string | Optional | Currency of the amount. Only BDT is allowed. |

### Request

```bash
curl -sS -X POST "$BDAPPS_CAAS_GET_BALANCE_URL" \
  -H 'Content-Type: application/json' \
  --max-time 15 \
  -d @- <<REQUEST
{
  "applicationId": "$BDAPPS_APP_ID",
  "password": "$BDAPPS_PASSWORD",
  "subscriberId": "tel:8801812345678",
  "paymentInstrumentName": "MobileAccount",
  "accountId": "12345",
  "currency": "BDT"
}
REQUEST
```

### Response

HTTP 200. Success is `statusCode: "S1000"` — nothing else.

```json
{
  "chargeableBalance": "300.0",
  "statusCode": "S1000",
  "statusDetail": "Success",
  "accountStatus": "Active",
  "accountType": "Pre Paid"
}
```

### Response fields

| Field | Type | Meaning |
|---|---|---|
| `statusCode` | string | S1000 on success. |
| `statusDetail` | string | Human-readable outcome. |
| `chargeableBalance` | string | Remaining balance (prepaid) or credit limit minus outstanding bill (postpaid). A string — parse as decimal. |
| `accountType` | string | Pre Paid / Post Paid. |
| `accountStatus` | string | Account status. |

### Status codes for this endpoint

| Code | Class | Meaning |
|---|---|---|
| `S1000` | success | Success |
| `E1303` | configuration | IP address, which the request originates from, is not listed within the allowed-host-address list → Run curl -4 https://api.ipify.org on the calling server and add that IP to Allowed Host Addresses. |
| `E1313` | configuration | Authentication failure. There is no active application, or no active service provider, or the given password in the request is invalid. → Check BDAPPS_APP_ID and BDAPPS_PASSWORD, and that the app is active. |
| `E1309` | configuration | Requested service is not allowed for this Application → That API was not provisioned for this app. |

`configuration` fix the portal, not the code — the integration is down, not one request · `client` fix the payload or the user's input · `user-state` the user is not eligible right now; tell them, do not loop · `transient` retry with capped exponential backoff. Full table: [08-status-codes.md](08-status-codes.md).

### Rules

- Requires the Enable Query Balance Requests toggle in CaaS provisioning.
- Advisory only — the balance can change before the debit lands. Always handle E1378 on the debit anyway.
- chargeableBalance is a string — parse as decimal, never compare a float for equality.

---

# Inbound callbacks — bdapps calls you

---

## MO SMS Receive

Fires when a subscriber texts your shortcode with your keyword.

| | |
|---|---|
| **Direction** | bdapps → you. There is nothing to call. |
| **Your route** | `POST <your-host>/api/bdapps/sms/mo` (the path is yours; register it in the portal) |
| **Configured in** | SMS API settings |
| **Deduplicate on** | `requestId` |
| **Full guide** | [02-sms.md](02-sms.md) |

### Payload fields

| Field | Type | | Definition |
|---|---|---|---|
| `version` | string | **Always sent** | API version. |
| `applicationId` | string | **Always sent** | Your application ID — verify it matches. |
| `sourceAddress` | string | **Always sent** | Sender address, masked if masking is enabled. |
| `message` | string | **Always sent** | Message as sent by the user, including the keyword. |
| `requestId` | string | **Always sent** | Unique request identifier within bdapps. |
| `encoding` | enum | **Always sent** | 0 Text / 240 Flash / 245 Binary (hex-encoded). One of `0`, `240`, `245`. |

### What arrives

```json
{
  "message": "my testing message",
  "sourceAddress": "tel:8801812345678",
  "requestId": "22607072011552911",
  "encoding": "0",
  "applicationId": "APP_000029",
  "version": "1.0"
}
```

### What you must respond

HTTP 200, immediately, before doing any work:

```json
{
  "statusCode": "S1000",
  "statusDetail": "Success"
}
```

### Replay it against your own handler

```bash
curl -sS -X POST "http://localhost:3000/api/bdapps/sms/mo" \
  -H 'Content-Type: application/json' \
  -d @- <<'PAYLOAD'
{
  "message": "my testing message",
  "sourceAddress": "tel:8801812345678",
  "requestId": "22607072011552911",
  "encoding": "0",
  "applicationId": "APP_000029",
  "version": "1.0"
}
PAYLOAD
```

### Rules

- Recognise STOP / UNSUB / OFF and honour them by calling Unregister.
- Do not perform a destructive or chargeable action on the content of one MO SMS alone.

---

## SMS Delivery Status Report

Final delivery state of an MT SMS sent with deliveryStatusRequest 1.

| | |
|---|---|
| **Direction** | bdapps → you. There is nothing to call. |
| **Your route** | `POST <your-host>/api/bdapps/sms/dlr` (the path is yours; register it in the portal) |
| **Configured in** | SMS API settings |
| **Deduplicate on** | `requestId + deliveryStatus` |
| **Full guide** | [02-sms.md](02-sms.md) |

### Payload fields

| Field | Type | | Definition |
|---|---|---|---|
| `destinationAddress` | string | **Always sent** | Subscriber address. |
| `timeStamp` | string | **Always sent** | Time of the delivery event. Arrives as 10 digits (yyMMddHHmm) or 14 (yyyyMMddHHmmss) — parse on length. |
| `requestId` | string | **Always sent** | Ties the report to the original send. |
| `deliveryStatus` | enum | **Always sent** | bdapps uses the long forms; the SMPP gateway uses the abbreviated ones. Accept both. One of `DELIVERED`, `EXPIRED`, `DELETED`, `UNDELIVERABLE`, `ACCEPTED`, `UNKNOWN`, `REJECTED`, `DELIVRD`, `UNDELIV`, `ACCEPTD`, `REJECTD`. |

### What arrives

```json
{
  "destinationAddress": "tel:8801812345678",
  "timeStamp": "20120113082110",
  "requestId": "MSG_000111",
  "deliveryStatus": "DELIVERED"
}
```

### What you must respond

HTTP 200, immediately, before doing any work:

```json
{
  "statusCode": "S1000",
  "statusDetail": "Success"
}
```

### Replay it against your own handler

```bash
curl -sS -X POST "http://localhost:3000/api/bdapps/sms/dlr" \
  -H 'Content-Type: application/json' \
  -d @- <<'PAYLOAD'
{
  "destinationAddress": "tel:8801812345678",
  "timeStamp": "20120113082110",
  "requestId": "MSG_000111",
  "deliveryStatus": "DELIVERED"
}
PAYLOAD
```

### Rules

- ACCEPTED is not DELIVERED — it only means the network took the message.
- Reports can arrive out of order, late, twice, or never.

---

## USSD Receive

Fires when a subscriber dials your code or presses a key.

| | |
|---|---|
| **Direction** | bdapps → you. There is nothing to call. |
| **Your route** | `POST <your-host>/api/bdapps/ussd` (the path is yours; register it in the portal) |
| **Configured in** | USSD API settings |
| **Deduplicate on** | `requestId` |
| **Full guide** | [03-ussd.md](03-ussd.md) |

### Payload fields

| Field | Type | | Definition |
|---|---|---|---|
| `version` | string | **Always sent** | API version. |
| `applicationId` | string | **Always sent** | Your application ID. |
| `sessionId` | string | **Always sent** | Session identifier — echo this back on every send. |
| `ussdOperation` | enum | **Always sent** | mo-init starts a session, mo-cont is subsequent input. One of `mo-init`, `mo-cont`. |
| `sourceAddress` | string | **Always sent** | Sender address, possibly masked. |
| `vlrAddress` | string | Optional | VLR address of the sender. |
| `message` | string | **Always sent** | What the user dialled or typed. |
| `encoding` | string | **Always sent** | 440 = plain ASCII. |
| `requestId` | string | **Always sent** | Unique request identifier within bdapps. |

### What arrives

```json
{
  "message": "*141#",
  "ussdOperation": "mo-init",
  "requestId": "1330933229901",
  "sessionId": "1330929317043",
  "encoding": "440",
  "sourceAddress": "tel:8801812345678",
  "applicationId": "APP_000029",
  "version": "1.0"
}
```

### What you must respond

HTTP 200, immediately, before doing any work:

```json
{
  "statusCode": "S1000",
  "statusDetail": "Success"
}
```

### Replay it against your own handler

```bash
curl -sS -X POST "http://localhost:3000/api/bdapps/ussd" \
  -H 'Content-Type: application/json' \
  -d @- <<'PAYLOAD'
{
  "message": "*141#",
  "ussdOperation": "mo-init",
  "requestId": "1330933229901",
  "sessionId": "1330929317043",
  "encoding": "440",
  "sourceAddress": "tel:8801812345678",
  "applicationId": "APP_000029",
  "version": "1.0"
}
PAYLOAD
```

### Rules

- The response body is only an acknowledgement — the screen the user sees comes from a separate POST /ussd/send.
- Sessions time out in seconds. Acknowledge before doing any work.

---

## Subscription Notification

Fires whenever a subscription changes, including changes you did not initiate.

| | |
|---|---|
| **Direction** | bdapps → you. There is nothing to call. |
| **Your route** | `POST <your-host>/api/bdapps/subscription/notification` (the path is yours; register it in the portal) |
| **Configured in** | Subscription API settings |
| **Deduplicate on** | `subscriberId + status + timeStamp` |
| **Full guide** | [04-subscription.md](04-subscription.md) |

### Payload fields

| Field | Type | | Definition |
|---|---|---|---|
| `applicationId` | string | **Always sent** | Your application ID. |
| `password` | string | **Always sent** | Your application password, echoed back by the platform. You may compare it in constant time as defence in depth, but never log it and never treat it as sufficient authentication on its own — the request is unauthenticated JSON from the public internet. |
| `subscriberId` | string | **Always sent** | Subscriber address, possibly masked. |
| `status` | enum | **Always sent** | New subscription state. One of `REGISTERED`, `UNREGISTERED`. |
| `frequency` | enum | **Always sent** | Charging frequency for the subscription. One of `daily`, `weekly`, `monthly`, `yearly`. |
| `version` | string | **Always sent** | API version. |
| `timeStamp` | string | **Always sent** | When the change happened. |

### What arrives

```json
{
  "timeStamp": "20120113082110",
  "version": "1.0",
  "applicationId": "APP_999999",
  "password": "…",
  "subscriberId": "tel:8801812345678",
  "frequency": "monthly",
  "status": "REGISTERED"
}
```

### What you must respond

HTTP 200, immediately, before doing any work:

```json
{
  "statusCode": "S1000",
  "statusDetail": "Success"
}
```

### Replay it against your own handler

```bash
curl -sS -X POST "http://localhost:3000/api/bdapps/subscription/notification" \
  -H 'Content-Type: application/json' \
  -d @- <<'PAYLOAD'
{
  "timeStamp": "20120113082110",
  "version": "1.0",
  "applicationId": "APP_999999",
  "password": "…",
  "subscriberId": "tel:8801812345678",
  "frequency": "monthly",
  "status": "REGISTERED"
}
PAYLOAD
```

### Rules

- This is the authoritative source of subscription state — consume it and keep a local mirror instead of polling getStatus.
- The body carries your password. Redact it before the payload reaches a log, an error tracker or a queue.

---

# The hosted consent page — Subscription Charging SDK

A signed browser redirect to a bdapps-hosted consent page. bdapps captures the subscriber's number, shows the amount and frequency, records consent, and activates the subscription and its charging — then returns the browser to a URL you nominate. It is not a library you install.

**It is not a POST, so there is no curl for it.** You build a signed URL on your server and
redirect the browser to it; bdapps takes the consent and returns the browser to your
`redirectUrl`. The full contract, including how to handle that return safely, is
[06-otp.md](06-otp.md) · `node tools/bdapps.mjs sdk`.

```
GET https://user.bdapps.com/sdk/subscription/authorize
      ?apiKey=<apiKey>
      &requestId=<requestId>
      &requestTime=<requestTime>
      &signature=<signature>
      &redirectUrl=<redirectUrl>
```

| Parameter | | Definition |
|---|---|---|
| `apiKey` | **Required** | The API Key from General → Advanced. Travels in the query string; the secret never does. |
| `requestId` | **Required** | Your own unique id for this consent attempt. Persist it against the user's session BEFORE redirecting, and use it to match the return. |
| `requestTime` | **Required** | Current UTC time, ISO-8601 with microseconds and a Z suffix (2026-08-25T09:41:22.481903Z). Part of the signature, so it must be the identical string in both places. |
| `signature` | **Required** | sha512(apiKey\|requestTime\|apiSecret) as lower-case hex. |
| `redirectUrl` | **Required** | Where bdapps returns the browser. HTTPS, and a URL you control — never built from user input. |

**Signature** — `sha512(apiKey + '|' + requestTime + '|' + apiSecret), lower-case hex`

The secret goes into the hash and never into the URL. These are NOT the applicationId and password: the telco APIs reject the SDK pair, and the SDK rejects the telco pair.

**Credentials** — `BDAPPS_SDK_API_KEY` and `BDAPPS_SDK_API_SECRET`, a second pair issued once
support enables **Enable Charging SDK** under **General → Advanced**.

### Rules

- Build the URL and compute the signature on the server. A signature computed in browser JavaScript puts the API Secret in the bundle.
- Generate requestTime once into a variable and use that variable in both the signature and the query string. Formatting it twice looks like a wrong secret.
- URL-encode every parameter — requestTime contains ':' and redirectUrl contains '://'.
- On return, look requestId up in your own store, then confirm the subscription with POST /subscription/getStatus. Never trust the redirect alone.
- Mark requestId consumed so a replayed return cannot activate anything twice.
- Record the consent — timestamp, requestId and what the user was shown.
- The SDK does not replace the subscription APIs. Unregister, status and base size are still the JSON endpoints.

---

# The AI gateway — bdappsAI

bdapps's AI gateway. One OpenAI-shaped API in front of several model providers — chat completions across Claude, Gemini and GPT models, and image generation — billed against a bdapps token balance instead of a per-provider account.

It is a separate product from everything above, and the differences are the kind that break an
integration quietly rather than loudly:

- Credentials go in an Authorization HEADER, not in the JSON body. There is no applicationId and no password.
- Failures come back as real HTTP status codes with an error object. There is no statusCode/S1000 envelope, so the telco branching rule is inverted here: on bdappsAI you DO check the HTTP status.
- It is a separate product with a separate key and a separate balance. A bdapps application password will not authenticate a bdappsAI call, and a bdappsAI key will not authenticate an SMS send.
- Nothing about it is Bangladesh-specific: there is no MSISDN, no tel: addressing, no operator and no subscriber.
- Nothing about it is a callback. bdappsAI never calls you; there is no webhook to register.

Get a key at https://developer.bdapps.com/bdappsai, then export it alongside the endpoints:

```bash
export BDAPPSAI_API_KEY='app_XXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'   # never commit it
export BDAPPSAI_CHAT_COMPLETIONS_URL='https://developer.bdapps.com/bdappsai/api/v1/chat/completions'
export BDAPPSAI_IMAGE_GENERATIONS_URL='https://developer.bdapps.com/bdappsai/api/v1/images/generations'
```

`--max-time 120` rather than 15 on these: a large completion or a high-quality image
legitimately takes tens of seconds, and a 15-second timeout will cancel a call you have already
been billed for. The heredoc is quoted (`<<'REQUEST'`) because nothing in the body needs to
expand and a `$` inside a prompt must survive the shell.

**Models:** `claude-sonnet-4-6` (Anthropic), `gemini-3.1-pro-preview` (Google), `gemini-3.1-flash-lite` (Google), `gpt-5-nano` (OpenAI), `gpt-4o-mini` (OpenAI), `gpt-image-1.5` (OpenAI).

---

## bdappsAI Chat Completions

Generate a model response for a conversation. OpenAI Chat Completions shape, routed to Claude, Gemini or GPT by the model field.

| | |
|---|---|
| **Endpoint** | `POST https://developer.bdapps.com/bdappsai/api/v1/chat/completions` |
| **Environment variable** | `BDAPPSAI_CHAT_COMPLETIONS_URL` |
| **Auth** | `Authorization: app_<keyId>.<keyValue>` from `BDAPPSAI_API_KEY` — header, not body, and no `Bearer` prefix |
| **Content type** | `application/json` |
| **Full guide** | [14-bdapps-ai.md](14-bdapps-ai.md) |

> **This call spends real tokens** from your bdappsAI balance, and it fails with real HTTP
> status codes rather than an `S1000` envelope. Both rules are the opposite of every telco
> endpoint above.

### Request parameters

| Parameter | Type | | Definition |
|---|---|---|---|
| `model` | enum | **Required** | Which model answers. Each has different capabilities, performance characteristics and price points, and a model your project is not configured for fails with INVALID_LLM_CONFIG. One of `claude-sonnet-4-6`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite`, `gpt-5-nano`, `gpt-4o-mini`. |
| `messages` | object[] | **Required** | The conversation so far, oldest first. Each entry has a role (system, developer, user, assistant or tool) and content, which is either a string or an array of typed parts — text, image and audio parts are supported. |
| `temperature` | number | Optional | Sampling temperature between 0 and 2. Higher values like 0.8 will make the output more random; lower values make it more focused and deterministic. Defaults to 1. |
| `max_completion_tokens` | integer | Optional | An upper bound for the number of tokens that can be generated. Set it on every call: it is the only hard ceiling on what one request can cost you. |
| `tools` | object[] | Optional | A list of tools the model may call. The model replies with tool_calls instead of content, and you send the results back as messages with role tool. |
| `response_format` | object | Optional | The format in which the model output should be returned, such as { "type": "text" } or a JSON schema. Use it instead of asking for JSON in the prompt and parsing hopefully. |
| `service_tier` | string | Optional | Specifies the processing type used for serving the request. Defaults to auto. |
| `frequency_penalty` | number | Optional | Between -2.0 and 2.0. Positive values penalise new tokens based on their existing frequency in the text so far, reducing verbatim repetition. Defaults to 0. |
| `logprobs` | boolean | Optional | Whether to return log probabilities of the output tokens or not. Defaults to false. |
| `n` | integer | Optional | How many chat completion choices to generate for each input message. Every choice is billed, so leave it at the default of 1 unless you genuinely use the alternatives. |
| `presence_penalty` | number | Optional | Between -2.0 and 2.0. Positive values penalise new tokens based on whether they appear in the text so far, pushing the model towards new topics. Defaults to 0. |
| `prompt_cache_key` | string | Optional | Groups requests that share a long identical prefix so the provider can cache it. Use a stable value per prompt template, never per user. |
| `safety_identifier` | string | Optional | A stable identifier used to help detect users violating usage policies. Send a hash of your own user id — never an MSISDN and never a subscriberId. |
| `stop` | string\|string[] | Optional | Up to 4 sequences where the API will stop generating further tokens. Defaults to null. |
| `store` | boolean | Optional | Whether or not to store the output of this chat completion request. Defaults to false — leave it false for anything carrying subscriber data. |
| `top_logprobs` | integer | Optional | The number of most likely tokens to return at each token position, 0 to 20. Requires logprobs to be true. |
| `top_p` | number | Optional | An alternative to sampling with temperature, called nucleus sampling. Defaults to 1. Adjust this or temperature, not both. |

### Request

```bash
curl -sS -X POST "$BDAPPSAI_CHAT_COMPLETIONS_URL" \
  -H 'Content-Type: application/json' \
  -H "Authorization: $BDAPPSAI_API_KEY" \
  --max-time 120 \
  -d @- <<'REQUEST'
{
  "model": "gpt-5-nano",
  "messages": [
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "You are a concise assistant for a Bangladeshi mobile service. Answer in one short paragraph."
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Explain megapixels in a picture"
        }
      ]
    }
  ],
  "max_completion_tokens": 300,
  "response_format": {
    "type": "text"
  }
}
REQUEST
```

### Response

HTTP 200 with the body below. Any other status is a failure — see the table after it.

```json
{
  "id": "chatcmpl-B9MBs8CjcvOU2jLn4n570S5qMJKcT",
  "object": "chat.completion",
  "created": 1741569952,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Megapixels count the millions of pixels a photo contains…",
        "refusal": null,
        "annotations": []
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 19,
    "completion_tokens": 10,
    "total_tokens": 29,
    "prompt_tokens_details": {
      "cached_tokens": 0,
      "audio_tokens": 0
    },
    "completion_tokens_details": {
      "reasoning_tokens": 0,
      "audio_tokens": 0,
      "accepted_prediction_tokens": 0,
      "rejected_prediction_tokens": 0
    }
  },
  "service_tier": "default"
}
```

### Response fields

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Identifier for this completion. Log it — it is what bdappsAI support traces a bad response by. |
| `object` | string | Always chat.completion. |
| `created` | integer | Unix timestamp of when the completion was created. |
| `model` | string | The model that actually answered. Check it rather than assuming your requested model was used. |
| `choices` | object[] | The generated alternatives, one per n. Each carries index, message, logprobs and finish_reason. |
| `choices[].message` | object | The assistant turn: role, content, refusal, annotations, and tool_calls when the model asked for a tool. Append it to your message history verbatim before the next turn. |
| `choices[].finish_reason` | string | Why generation stopped: stop is a complete answer, length means it hit max_completion_tokens and the content is truncated, tool_calls means the model wants a tool run. Branch on this — a truncated answer is not a failed request. |
| `usage` | object | Token accounting for this call: prompt_tokens, completion_tokens and total_tokens, plus cached and reasoning breakdowns. This is what draws down your balance, so record total_tokens per call. |
| `service_tier` | string | The processing tier that served the request. |

### Errors for this endpoint

| Code | HTTP | Class | Meaning and fix |
|---|---|---|---|
| `400` | 400 | client | Bad request — invalid request format or a malformed payload. Common causes are invalid JSON, missing required fields and invalid parameter values. → Read error.param: it names the offending field. Validate the payload before sending rather than after failing. |
| `401` | 401 | configuration | Unauthorized. Your API key is either missing, invalid, or expired. → Send the key verbatim as Authorization: app_<keyId>.<keyValue>. Do not prepend Bearer, do not base64-encode it, and check the value actually reached the process rather than being an empty environment variable. |
| `402` | 402 | configuration | Payment required — insufficient token balance. → Top up the balance in the bdappsAI portal. Alert on this: it stops every AI call in the product, not one request. |
| `403` | 403 | configuration | Forbidden — insufficient permissions, or the model you asked for is restricted for your project. → Check the project is ACTIVE and the model is enabled for it in the bdappsAI portal. |
| `404` | 404 | configuration | Not found — no project matches the API key you sent. → Verify the key is a complete keyId.keyValue pair and belongs to the project you think it does. A truncated key looks exactly like a wrong one. |
| `429` | 429 | transient | Too many requests — rate limit exceeded, or the token quota is exhausted. Please wait before making additional requests. → Read the Retry-After header and back off exponentially with jitter. Check error.code: RATE_LIMIT_EXCEEDED clears on its own, TOKEN_QUOTA_EXCEEDED does not. |
| `500` | 500 | transient | Internal server error — an unexpected error on the bdappsAI side. Their team is automatically notified of server errors. → Retry with backoff, cap the attempts, then dead-letter and surface a degraded experience rather than hanging. |
| `502` | 502 | transient | Bad gateway — bdappsAI failed to forward the request to the upstream LLM provider, usually provider downtime or connectivity. → Retry with backoff, and consider failing over to another model: a 502 is usually one provider being down, not bdappsAI. |
| `503` | 503 | transient | Service unavailable — temporarily down for maintenance or under high load. → Retry with backoff. Check the provider status pages before escalating. |
| `PROJECT_NOT_FOUND` | 404 | configuration | Project not found with API key. The provided API key doesn't match any existing project. → Regenerate the key in the bdappsAI portal and confirm both halves of keyId.keyValue were copied. |
| `PROJECT_INACTIVE` | 403 | configuration | Project is not active. The project exists but its status is not ACTIVE. → Activate the project in the bdappsAI portal. No code change will help. |
| `INVALID_LLM_CONFIG` | 400 | configuration | Invalid LLM model. The specified model is not configured or allowed for your project. → Use a model enabled for the project. This is the bdappsAI equivalent of E1309 — provisioning, not payload. |
| `RATE_LIMIT_EXCEEDED` | 429 | transient | Rate limit exceeded. Your project has exceeded the allowed number of requests per time period. → Back off and retry; limits reset every minute. Queue bursts rather than firing them in parallel. |
| `TOKEN_QUOTA_EXCEEDED` | 429 | configuration | Token quota exceeded. Your project has used up its allocated token quota. → Retrying will not clear this. Raise the quota or top up in the portal, and alert rather than looping. |
| `INSUFFICIENT_BALANCE` | 402 | configuration | Insufficient token balance. Your current balance is too low to process the request. → Top up in the bdappsAI portal. Monitor the balance proactively so this never fires in production. |
| `FORWARDING_FAILED` | 502 | transient | Failed to forward the request. The call to the upstream LLM provider failed due to connectivity or provider issues. → Retry with backoff, or fail over to a model from a different provider. |

The body of a failure is `{ "error": { "message", "type", "param", "code" } }`. **Branch on `error.code`**, not on the message. Quota is enforced two ways — requests per minute and total token spend. They surface as different error codes (RATE_LIMIT_EXCEEDED and TOKEN_QUOTA_EXCEEDED) on the same 429, so read the code, not just the status.

### Rules

- Call it from your backend only. The key is a bearer-equivalent secret with a spendable balance behind it; a browser or mobile app that holds it can drain the balance.
- Always set max_completion_tokens. Without it a single runaway request can spend an unbounded share of your token balance.
- Branch on the HTTP status here, unlike every telco endpoint in this catalog. There is no statusCode field and no S1000.
- Check finish_reason before using the content. length means the answer is cut off mid-sentence.
- Never put a raw MSISDN, a subscriberId or a bdapps password into a prompt, a safety_identifier or a prompt_cache_key. Prompts leave your trust boundary and reach a third-party model provider.
- Retry only 429, 500, 502 and 503, with exponential backoff and jitter. A 400, 401, 402, 403 or 404 will fail identically forever.
- Set an explicit client timeout well above your telco one — a large completion legitimately takes tens of seconds — and never make an LLM call inside a USSD callback's response path.
- Treat model output as untrusted input: never execute it, never interpolate it into SQL or a shell, and never send it straight to a subscriber as an SMS without a length and content check.

---

## bdappsAI Image Generation

Create an image from a text prompt. GPT Image 1.5 only, and the image comes back as base64 in the response body rather than as a URL.

| | |
|---|---|
| **Endpoint** | `POST https://developer.bdapps.com/bdappsai/api/v1/images/generations` |
| **Environment variable** | `BDAPPSAI_IMAGE_GENERATIONS_URL` |
| **Auth** | `Authorization: app_<keyId>.<keyValue>` from `BDAPPSAI_API_KEY` — header, not body, and no `Bearer` prefix |
| **Content type** | `application/json` |
| **Full guide** | [14-bdapps-ai.md](14-bdapps-ai.md) |

> **This call spends real tokens** from your bdappsAI balance, and it fails with real HTTP
> status codes rather than an `S1000` envelope. Both rules are the opposite of every telco
> endpoint above.

### Request parameters

| Parameter | Type | | Definition |
|---|---|---|---|
| `prompt` | string | **Required** | A text description of the desired image(s). The maximum length is 32000 characters for GPT Image 1.5. |
| `model` | string | Optional | The image model to use. gpt-image-1.5 is the only one available and the default. |
| `background` | enum | Optional | Background treatment. transparent requires an output_format of png or webp — it is silently useless with jpeg. Defaults to auto. One of `transparent`, `opaque`, `auto`. |
| `moderation` | enum | Optional | Content-moderation strictness for the generated image. Defaults to auto. One of `low`, `auto`. |
| `n` | integer | Optional | How many images to generate, 1 to 10. Every image is billed separately. Defaults to 1. |
| `output_compression` | integer | Optional | Compression level from 0 to 100 for the webp and jpeg output formats. Ignored for png. Defaults to 100. |
| `output_format` | enum | Optional | The encoding of the returned image. Defaults to png. One of `png`, `jpeg`, `webp`. |
| `quality` | enum | Optional | Rendering quality. This is the main cost and latency lever — low is dramatically cheaper and faster than high. Defaults to auto. One of `auto`, `high`, `medium`, `low`. |
| `size` | enum | Optional | Dimensions of the generated image: square, landscape, portrait, or auto to let the model choose. Defaults to auto. One of `1024x1024`, `1536x1024`, `1024x1536`, `auto`. |
| `partial_images` | integer | Optional | Number of partial images, 0 to 3, to emit while generating. Only meaningful with stream set to true. Defaults to 0. |
| `stream` | boolean | Optional | Generate the image in streaming mode, emitting partial images as server-sent events. Defaults to false. |
| `style` | enum | Optional | Rendering style — vivid is more dramatic and saturated, natural is more literal. Defaults to vivid. One of `vivid`, `natural`. |
| `user` | string | Optional | A unique identifier representing your end-user, used for abuse monitoring. Send an opaque internal id, never an MSISDN. |

### Request

```bash
curl -sS -X POST "$BDAPPSAI_IMAGE_GENERATIONS_URL" \
  -H 'Content-Type: application/json' \
  -H "Authorization: $BDAPPSAI_API_KEY" \
  --max-time 120 \
  -d @- <<'REQUEST'
{
  "prompt": "a red apple on a plain background",
  "model": "gpt-image-1.5",
  "n": 1,
  "quality": "low",
  "size": "1024x1024"
}
REQUEST
```

### Response

HTTP 200 with the body below. Any other status is a failure — see the table after it.

```json
{
  "created": 1767763326,
  "background": "opaque",
  "data": [
    {
      "b64_json": "<base64-encoded image bytes>"
    }
  ],
  "output_format": "png",
  "quality": "low",
  "size": "1024x1024",
  "usage": {
    "input_tokens": 9,
    "input_tokens_details": {
      "image_tokens": 0,
      "text_tokens": 9
    },
    "output_tokens": 272,
    "total_tokens": 281
  }
}
```

### Response fields

| Field | Type | Meaning |
|---|---|---|
| `created` | integer | Unix timestamp of when the image was created. |
| `data` | object[] | One entry per generated image. Each carries b64_json — the image bytes, base64-encoded. GPT Image 1.5 always returns base64, never a URL, so decode and store it yourself. |
| `background` | string | The background treatment actually applied. |
| `output_format` | string | The encoding of the returned bytes — use it to pick the file extension and the Content-Type when you store or serve the image. |
| `quality` | string | The quality level actually used, which is the resolved value when you sent auto. |
| `size` | string | The dimensions actually produced, which is the resolved value when you sent auto. |
| `usage` | object | Token accounting: input_tokens with a text/image breakdown, output_tokens and total_tokens. Image output tokens dwarf the prompt, so quality and n drive the cost, not prompt length. |

### Errors for this endpoint

| Code | HTTP | Class | Meaning and fix |
|---|---|---|---|
| `400` | 400 | client | Bad request — invalid request format or a malformed payload. Common causes are invalid JSON, missing required fields and invalid parameter values. → Read error.param: it names the offending field. Validate the payload before sending rather than after failing. |
| `401` | 401 | configuration | Unauthorized. Your API key is either missing, invalid, or expired. → Send the key verbatim as Authorization: app_<keyId>.<keyValue>. Do not prepend Bearer, do not base64-encode it, and check the value actually reached the process rather than being an empty environment variable. |
| `402` | 402 | configuration | Payment required — insufficient token balance. → Top up the balance in the bdappsAI portal. Alert on this: it stops every AI call in the product, not one request. |
| `403` | 403 | configuration | Forbidden — insufficient permissions, or the model you asked for is restricted for your project. → Check the project is ACTIVE and the model is enabled for it in the bdappsAI portal. |
| `404` | 404 | configuration | Not found — no project matches the API key you sent. → Verify the key is a complete keyId.keyValue pair and belongs to the project you think it does. A truncated key looks exactly like a wrong one. |
| `429` | 429 | transient | Too many requests — rate limit exceeded, or the token quota is exhausted. Please wait before making additional requests. → Read the Retry-After header and back off exponentially with jitter. Check error.code: RATE_LIMIT_EXCEEDED clears on its own, TOKEN_QUOTA_EXCEEDED does not. |
| `500` | 500 | transient | Internal server error — an unexpected error on the bdappsAI side. Their team is automatically notified of server errors. → Retry with backoff, cap the attempts, then dead-letter and surface a degraded experience rather than hanging. |
| `502` | 502 | transient | Bad gateway — bdappsAI failed to forward the request to the upstream LLM provider, usually provider downtime or connectivity. → Retry with backoff, and consider failing over to another model: a 502 is usually one provider being down, not bdappsAI. |
| `503` | 503 | transient | Service unavailable — temporarily down for maintenance or under high load. → Retry with backoff. Check the provider status pages before escalating. |
| `PROJECT_NOT_FOUND` | 404 | configuration | Project not found with API key. The provided API key doesn't match any existing project. → Regenerate the key in the bdappsAI portal and confirm both halves of keyId.keyValue were copied. |
| `PROJECT_INACTIVE` | 403 | configuration | Project is not active. The project exists but its status is not ACTIVE. → Activate the project in the bdappsAI portal. No code change will help. |
| `RATE_LIMIT_EXCEEDED` | 429 | transient | Rate limit exceeded. Your project has exceeded the allowed number of requests per time period. → Back off and retry; limits reset every minute. Queue bursts rather than firing them in parallel. |
| `TOKEN_QUOTA_EXCEEDED` | 429 | configuration | Token quota exceeded. Your project has used up its allocated token quota. → Retrying will not clear this. Raise the quota or top up in the portal, and alert rather than looping. |
| `INSUFFICIENT_BALANCE` | 402 | configuration | Insufficient token balance. Your current balance is too low to process the request. → Top up in the bdappsAI portal. Monitor the balance proactively so this never fires in production. |
| `FORWARDING_FAILED` | 502 | transient | Failed to forward the request. The call to the upstream LLM provider failed due to connectivity or provider issues. → Retry with backoff, or fail over to a model from a different provider. |

The body of a failure is `{ "error": { "message", "type", "param", "code" } }`. **Branch on `error.code`**, not on the message. Quota is enforced two ways — requests per minute and total token spend. They surface as different error codes (RATE_LIMIT_EXCEEDED and TOKEN_QUOTA_EXCEEDED) on the same 429, so read the code, not just the status.

### Rules

- The response is base64, not a URL. Never log the body, never store it in a database text column, and never return it through a JSON API — decode it once and put the bytes in object storage.
- Generation is slow. Do it in a background job and hand the user a job id, never inside a request the user is waiting on and never inside a callback handler.
- quality and n set the price. Default to low for previews and thumbnails, and only spend high where the image is the product.
- Cache by a hash of the resolved prompt plus every parameter. The same prompt costs the same again every time you ask.
- transparent backgrounds need output_format png or webp; with jpeg the setting is quietly discarded.
- Never send subscriber-identifying text in a prompt or in user.

---

## What a curl does not show

Every command above is one HTTPS POST, and that part ports to any language in a few lines. The
difference between a working call and a production integration is what surrounds it — none of
which is visible in a shell command:

| | Why the curl hides it |
|---|---|
| **Credentials from the environment, injected once** | A shell export becomes a config module that validates at startup and fails loudly. One place reads it; no call site passes credentials as arguments. |
| **`statusCode` branching** | You read the JSON yourself here. Code that checks `res.ok`, `raise_for_status()` or `EnsureSuccessStatusCode()` reports every bdapps failure as a success. |
| **Benign codes** | `E1351` on register, `E1356` on unregister and `E1379` on debit all mean the desired state already holds. They are successes, and only your code can know that. |
| **Idempotency** | `externalTrxId` has to be generated, persisted before the call, and reused unchanged on retry. A shell loop cannot do this; a ledger row can. |
| **Timeouts and retries** | `--max-time 15` becomes an explicit client timeout, with backoff on transient codes only and no automatic retry at all on a debit. |
| **`tel:` normalisation** | Typed by hand here; in code it is one function at the boundary, never a concatenation at a call site. |
| **Acknowledge-first callbacks** | The replay commands return instantly. A real handler must respond `S1000` and then work out of band — USSD sessions time out in seconds. |

Those seven, plus a shared USSD session store, are the whole specification. They are written out
language-neutrally in [11-any-stack.md](11-any-stack.md), with an acceptance checklist for a
port. [templates/](../templates/README.md) shows the same seven already built in TypeScript/Node,
Python, Java, Go, PHP and C# — worked examples to read for shape, not output to paste.

## Related

| | |
|---|---|
| Machine-readable form of this page | [`catalog/bdapps-api.json`](../catalog/bdapps-api.json) |
| Build a request with your own values | `node tools/bdapps.mjs curl <id> key=value …` |
| Check a payload before sending it | `node tools/bdapps.mjs validate <id> '<json>'` |
| Decode a status code you received | `node tools/bdapps.mjs code <statusCode>` |
| Smoke-test the outbound path | [`scripts/smoke-test.sh`](../scripts/smoke-test.sh) (or `smoke-test.ps1`) |
| Test all four callback handlers | [`scripts/test-callbacks.sh`](../scripts/test-callbacks.sh) |
| Every status code, classified | [08-status-codes.md](08-status-codes.md) |
