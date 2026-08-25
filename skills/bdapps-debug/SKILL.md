---
name: bdapps-debug
description: Diagnose a failing bdapps integration from a status code or a symptom — E1303, E1313, E1309, callbacks not arriving, USSD sessions dying, double charges, works-locally-fails-deployed. Use when a bdapps call or callback is not behaving.
---

# Debug a bdapps integration

Start with the tool, not with guesses:

```bash
node tools/bdapps.mjs code E1303
node tools/bdapps.mjs diagnose "callbacks never arrive"
node tools/bdapps.mjs validate <id> '<payload>'
node tools/bdapps.mjs curl <id> [key=value ...]   # reproduce the call outside your code
```

## Get the real error first

bdapps returns **HTTP 200 for failures**. If the code decides on the HTTP status — `res.ok`,
`raise_for_status()`, `EnsureSuccessStatusCode()`, Guzzle's `http_errors`, a `2xx` check — it is
swallowing the error. Log `statusCode` and `statusDetail` before investigating anything else —
most "mysterious" bdapps bugs are a clear error code that nothing was reading.

## Failure signatures

| Symptom | Almost always |
|---|---|
| Everything returns `E1303` | Calling from an IP that is not whitelisted — a laptop, a CI runner, or a serverless function with rotating egress. Run `curl -4 https://api.ipify.org` **on the calling server**. |
| Everything returns `E1313` | Wrong credentials, the wrong environment's credentials, or the app is not active. |
| One API returns `E1309`, others work | That API was not provisioned. A portal fix, not a code fix. |
| Test number gets nothing, no error | The number is not in *Whitelisted Numbers* while the app is in Limited Production (`E1343`). |
| Callbacks never arrive | URL not publicly reachable, wrong in the portal, a WAF challenge, auth middleware in front, or the handler is not returning 200 with `S1000`. |
| USSD dies mid-flow | Session store not shared across instances or workers (an in-process map, whatever the language), no `mt-fin`, or a handler too slow for the session timeout. |
| Duplicate charges | A debit retried with a fresh `externalTrxId` after a timeout. |
| Works locally, fails deployed | The egress IP changed, or secrets are not set in the host environment. |
| Certificate / TLS errors | Incomplete certificate chain — supply the intermediate CA, do **not** disable verification. |

## Narrowing it down

1. **Is it every call or one call?** Every call points at `E1303`/`E1313` — configuration.
   One call points at that service's provisioning or your payload.
2. **Is the payload even valid?** `node tools/bdapps.mjs validate <id> '<json>'`.
3. **Take the code out of it.** Run the endpoint by hand from
   `references/13-curl-reference.md` (or `node tools/bdapps.mjs curl <id> key=value …`) **from
   the same server**. A curl that works proves the payload, the credentials, the provisioning
   and the egress IP are all fine, and the bug is in your code; a curl that fails gives you the
   real `statusCode` with nothing swallowing it.
4. **Is it environment-specific?** Compare the egress IP and the loaded config between the
   working and failing environments.

## Escalating

bdapps support traces on identifiers, so quote them: `requestId`, `externalTrxId`,
`internalTrxId`, `sessionId`, and the `statusCode`.
Support: `support@bdapps.com` · WhatsApp +8801878977505.

Detail: `references/08-status-codes.md` and the failure table in
`references/10-production-checklist.md`.
