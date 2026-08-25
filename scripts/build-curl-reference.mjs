#!/usr/bin/env node
/**
 * Generate references/13-curl-reference.md from catalog/bdapps-api.json.
 *
 *   node scripts/build-curl-reference.mjs           write the document
 *   node scripts/build-curl-reference.mjs --check   fail if it is stale (used in CI)
 *
 * The curl reference is *the* way this skill hands over an implementation:
 * every endpoint, every parameter definition, a runnable request and the
 * response it returns. There is no code generator — a curl and the host
 * project's HTTP client cover every language equally.
 *
 * It is generated rather than hand-written for the same reason the agent rule
 * copies are: a parameter that drifts from the catalog becomes a wrong parameter
 * in someone's production integration.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  catalog,
  lookupBdappsAiError,
  lookupStatusCode,
  bdappsaiServices,
  repoRoot,
  urlFor,
} from "../tools/catalog.mjs";

const OUT = join(repoRoot, "references", "13-curl-reference.md");
const check = process.argv.includes("--check");

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const md = (s) => String(s).replace(/\|/g, "\\|");

/** Anchor for the in-page index, matching GitHub's slug rules. */
const anchor = (heading) =>
  heading
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-");

/**
 * The example body for a service: credentials as environment placeholders, then
 * every parameter the official sample carries, in the order the contract
 * declares them. Required parameters with no sample value get a named
 * placeholder so nothing runnable is silently missing.
 */
function exampleBody(service) {
  const body = {
    applicationId: "$BDAPPS_APP_ID",
    password: "$BDAPPS_PASSWORD",
  };
  for (const p of service.parameters || []) {
    if (p.name === "applicationId" || p.name === "password") continue;
    const sample = service.sampleRequest?.[p.name];
    if (sample !== undefined) body[p.name] = sample;
    else if (p.required) body[p.name] = `<${p.name}>`;
  }
  return body;
}

function parameterTable(spec, { label = "Parameter", required = "Required" } = {}) {
  const rows = spec.map((p) => {
    const type = p.enum ? `enum` : md(p.type);
    const values = p.enum ? ` One of \`${p.enum.join("\`, \`")}\`.` : "";
    const need = p.required ? `**${required}**` : "Optional";
    return `| \`${p.name}\` | ${type} | ${need} | ${md(p.description)}${md(values)} |`;
  });
  return [`| ${label} | Type | | Definition |`, `|---|---|---|---|`, ...rows].join("\n");
}

function responseTable(fields) {
  return [
    `| Field | Type | Meaning |`,
    `|---|---|---|`,
    ...fields.map((f) => `| \`${f.name}\` | ${f.type} | ${md(f.description)} |`),
  ].join("\n");
}

/**
 * Per-code rows carry only the fix specific to that code; the generic per-class
 * advice is stated once in the legend rather than repeated on every row.
 */
function statusTable(codes, entryId) {
  const rows = codes.map((code) => {
    const s = lookupStatusCode(code);
    const specificFix = catalog.statusCodes[s.code]?.fix;
    const benign = s.benignFor?.includes(entryId) ? " **Treat this as success.**" : "";
    const fix = specificFix ? ` → ${md(specificFix)}` : "";
    return `| \`${s.code}\` | ${s.class} | ${md(s.description)}${fix}${benign} |`;
  });
  return [`| Code | Class | Meaning |`, `|---|---|---|`, ...rows].join("\n");
}

const CLASS_LEGEND =
  "`configuration` fix the portal, not the code — the integration is down, not one request · " +
  "`client` fix the payload or the user's input · " +
  "`user-state` the user is not eligible right now; tell them, do not loop · " +
  "`transient` retry with capped exponential backoff. " +
  "Full table: [08-status-codes.md](08-status-codes.md).";

const json = (value) => "```json\n" + JSON.stringify(value, null, 2) + "\n```";

/** A runnable request. The heredoc is unquoted so the credential variables expand. */
function requestCurl(service) {
  const body = JSON.stringify(exampleBody(service), null, 2);
  return [
    "```bash",
    `curl -sS -X POST "$${service.envVar}" \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  --max-time 15 \\`,
    `  -d @- <<REQUEST`,
    body,
    "REQUEST",
    "```",
  ].join("\n");
}

/** A request that replays what bdapps sends, against your own handler. */
function callbackCurl(cb) {
  const body = JSON.stringify(cb.samplePayload, null, 2);
  return [
    "```bash",
    `curl -sS -X POST "http://localhost:3000${cb.suggestedPath}" \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d @- <<'PAYLOAD'`,
    body,
    "PAYLOAD",
    "```",
  ].join("\n");
}

/**
 * The bdappsAI request. Two things differ from every telco command on this page,
 * and both matter: the credential is a header rather than a body field, and the
 * heredoc is quoted so that a `$` inside a prompt is not eaten by the shell.
 */
function bdappsaiCurl(service) {
  const auth = catalog.bdappsai.auth;
  const body = {};
  for (const p of service.parameters || []) {
    const sample = service.sampleRequest?.[p.name];
    if (sample !== undefined) body[p.name] = sample;
    else if (p.required) body[p.name] = `<${p.name}>`;
  }
  return [
    "```bash",
    `curl -sS -X POST "$${service.envVar}" \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H "${auth.header}: $${auth.envVar}" \\`,
    `  --max-time 120 \\`,
    `  -d @- <<'REQUEST'`,
    JSON.stringify(body, null, 2),
    "REQUEST",
    "```",
  ].join("\n");
}

/** bdappsAI failures: an HTTP status and a code, not an S1000 envelope. */
function bdappsaiErrorTable(codes) {
  const rows = codes.map((code) => {
    const e = lookupBdappsAiError(code);
    return `| \`${e.code}\` | ${e.http} | ${e.class} | ${md(e.description)} → ${md(e.action)} |`;
  });
  return [`| Code | HTTP | Class | Meaning and fix |`, `|---|---|---|---|`, ...rows].join("\n");
}

function bdappsaiSection(s) {
  const parts = [];
  parts.push(`---\n`);
  parts.push(`## ${s.name}\n`);
  parts.push(`${s.summary}\n`);

  parts.push(
    [
      `| | |`,
      `|---|---|`,
      `| **Endpoint** | \`POST ${urlFor(s)}\` |`,
      `| **Environment variable** | \`${s.envVar}\` |`,
      `| **Auth** | \`${catalog.bdappsai.auth.header}: ${catalog.bdappsai.auth.format}\` from \`${catalog.bdappsai.auth.envVar}\` — header, not body, and no \`Bearer\` prefix |`,
      `| **Content type** | \`application/json\` |`,
      `| **Full guide** | [14-bdapps-ai.md](14-bdapps-ai.md) |`,
    ].join("\n") + "\n"
  );

  parts.push(
    `> **This call spends real tokens** from your bdappsAI balance, and it fails with real HTTP\n` +
      `> status codes rather than an \`S1000\` envelope. Both rules are the opposite of every telco\n` +
      `> endpoint above.\n`
  );

  parts.push(`### Request parameters\n`);
  parts.push(parameterTable(s.parameters) + "\n");

  parts.push(`### Request\n`);
  parts.push(bdappsaiCurl(s) + "\n");

  parts.push(`### Response\n`);
  parts.push(`HTTP 200 with the body below. Any other status is a failure — see the table after it.\n`);
  parts.push(json(s.sampleResponse) + "\n");

  if (s.responseFields?.length) {
    parts.push(`### Response fields\n`);
    parts.push(responseTable(s.responseFields) + "\n");
  }

  if (s.errorCodes?.length) {
    parts.push(`### Errors for this endpoint\n`);
    parts.push(bdappsaiErrorTable(s.errorCodes) + "\n");
    parts.push(
      `The body of a failure is \`{ "error": { "message", "type", "param", "code" } }\`. ` +
        `**Branch on \`error.code\`**, not on the message. ${md(catalog.bdappsai.rateLimits.note)}\n`
    );
  }

  if (s.rules?.length) {
    parts.push(`### Rules\n`);
    parts.push(s.rules.map((r) => `- ${r}`).join("\n") + "\n");
  }

  return parts.join("\n");
}

/* ── Document ────────────────────────────────────────────────────────────── */

const services = catalog.services;
const callbacks = catalog.callbacks;
const aiServices = bdappsaiServices();

const preamble = `<!-- Generated from catalog/bdapps-api.json by scripts/build-curl-reference.mjs. Do not edit directly. -->

# Every Endpoint as curl

The whole bdapps contract at the wire: each endpoint, each parameter defined, a request you
can run, and the response it returns. No SDK, no generated code, no tooling of any kind between
you and the platform.

**Write the integration from this page, in whatever language the project already uses.** There
is deliberately no code generator in this skill: a generator would privilege a handful of
languages and rot as their idioms move, while the request below is the same call in all of
them. The body, the headers and the branching are identical whether it goes out through
\`requests\` in Python, \`HttpClient\` in Java or .NET, \`net/http\` in Go, Guzzle in PHP,
\`Net::HTTP\` in Ruby, \`reqwest\` in Rust, \`HTTPoison\` in Elixir or \`fetch\` in Node. Translate the
curl into the project's own HTTP client and idiom; keep everything else exactly as specified.

Run these against a real application to confirm provisioning and credentials before writing a
line of code — a working curl removes half the possible causes when the integration then fails.

---

## The shape of every call

\`\`\`
POST  ${catalog.baseUrls.primary}/<service-path>
Content-Type: application/json
\`\`\`

- **Credentials travel in the JSON body**, as \`applicationId\` and \`password\`. There are no
  headers, no tokens, no signatures and no OAuth on this platform.
- **Every response is HTTP 200**, including failures. ${catalog.conventions.responseEnvelope.criticalNote}
- Every response carries \`${catalog.conventions.responseEnvelope.always.join("\` and \`")}\`; most also carry
  \`${catalog.conventions.responseEnvelope.common.join("\` and \`")}\`.
- Subscriber addresses are always \`${catalog.conventions.addressing.format}\` — no \`+\`, no spaces.
  A masked application receives a hash (\`tel:hu3b84346f…\`) instead of a number; it is opaque,
  so send back exactly what you received.
- **bdappsAI is the one exception to all of the above.** The AI gateway
  (\`${catalog.bdappsai.baseUrl}\`) authenticates with an \`${catalog.bdappsai.auth.header}\` header,
  returns real HTTP status codes with an \`error\` object, and has no subscriber, no \`tel:\`
  address and no callbacks. It is at the [end of this page](#the-ai-gateway--bdappsai), kept
  separate so its conventions never get applied to a telco call or the other way round.

## Before you run anything

Export your credentials and the endpoints your application is provisioned for. Every command on
this page reads them from the environment, so nothing here contains a credential and nothing you
copy can commit one.

\`\`\`bash
export BDAPPS_APP_ID='APP_XXXXXX'
export BDAPPS_PASSWORD='…'                 # from the portal — never commit it
${[...new Map(services.map((s) => [s.envVar, `export ${s.envVar}='${urlFor(s)}'`])).values()].join("\n")}
\`\`\`

One variable per provisioned service, never one shared base URL: an application can only call
the APIs it was provisioned for, so an endpoint you have no variable for is one you must not
call. Everything on this page is served from ${catalog.baseUrls.primary}.

Windows PowerShell, where \`curl\` is an alias for \`Invoke-WebRequest\` and the syntax differs:

\`\`\`powershell
$body = @{ applicationId = $env:BDAPPS_APP_ID; password = $env:BDAPPS_PASSWORD } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri $env:BDAPPS_SUBSCRIPTION_QUERY_BASE_URL \`
  -ContentType 'application/json' -Body $body
\`\`\`

Three flags in every request below, all deliberate: \`-sS\` prints errors but not a progress bar,
\`--max-time 15\` stops a hung call holding a request thread, and \`-d @- <<REQUEST\` reads the body
from a heredoc so the credential variables expand and the JSON stays readable.

**Start with Query Base.** It needs no subscriber, costs nothing and touches no one, so it is
the safest way to prove that your credentials, your provisioning and your egress IP all work.

---

## Endpoint index

| Service | Endpoint | Environment variable |
|---|---|---|
${services
  .map(
    (s) =>
      `| [${s.name}](#${anchor(s.name)}) | \`POST ${urlFor(s)}\` | \`${s.envVar}\` |`
  )
  .join("\n")}

| Callback | bdapps calls | Configured in |
|---|---|---|
${callbacks
  .map(
    (c) =>
      `| [${c.name}](#${anchor(c.name)}) | \`POST <your-host>${c.suggestedPath}\` | ${c.configuredIn} |`
  )
  .join("\n")}

| AI gateway | Endpoint | Environment variable |
|---|---|---|
${aiServices
  .map((s) => `| [${s.name}](#${anchor(s.name)}) | \`POST ${urlFor(s)}\` | \`${s.envVar}\` |`)
  .join("\n")}

---

# Outbound services — you call bdapps
`;

function serviceSection(s) {
  const parts = [];
  parts.push(`---\n`);
  parts.push(`## ${s.name}\n`);
  parts.push(`${s.summary}\n`);

  const facts = [
    `| | |`,
    `|---|---|`,
    `| **Endpoint** | \`POST ${urlFor(s)}\` |`,
    `| **Environment variable** | \`${s.envVar}\` |`,
    `| **Content type** | \`application/json\` |`,
    `| **Full guide** | [${s.reference.replace("references/", "")}](${s.reference.replace("references/", "")}) |`,
  ];
  parts.push(facts.join("\n") + "\n");

  if (s.movesMoney) {
    parts.push(
      `> **This call moves real money.** \`${s.idempotencyKey}\` is the idempotency key: generate it,\n` +
        `> persist it *before* sending, and reuse it unchanged on every resolution attempt. A retry with\n` +
        `> a fresh one charges a real person twice.\n`
    );
  }
  if (s.requiresProvisioning) {
    parts.push(
      `> **Needs provisioning:** ${s.requiresProvisioning}. Without it the call fails no matter how\n` +
        `> correct the payload is.\n`
    );
  }

  parts.push(`### Request parameters\n`);
  parts.push(parameterTable(s.parameters) + "\n");

  parts.push(`### Request\n`);
  parts.push(requestCurl(s) + "\n");

  parts.push(`### Response\n`);
  parts.push(`HTTP 200. Success is \`statusCode: "S1000"\` — nothing else.\n`);
  parts.push(json(s.sampleResponse) + "\n");

  if (s.responseFields?.length) {
    parts.push(`### Response fields\n`);
    parts.push(responseTable(s.responseFields) + "\n");
  }

  if (s.statusCodes?.length) {
    parts.push(`### Status codes for this endpoint\n`);
    parts.push(statusTable(s.statusCodes, s.id) + "\n");
    parts.push(CLASS_LEGEND + "\n");
  }

  if (s.rules?.length) {
    parts.push(`### Rules\n`);
    parts.push(s.rules.map((r) => `- ${r}`).join("\n") + "\n");
  }

  return parts.join("\n");
}

function callbackSection(c) {
  const parts = [];
  parts.push(`---\n`);
  parts.push(`## ${c.name}\n`);
  parts.push(`${c.summary}\n`);

  parts.push(
    [
      `| | |`,
      `|---|---|`,
      `| **Direction** | bdapps → you. There is nothing to call. |`,
      `| **Your route** | \`POST <your-host>${c.suggestedPath}\` (the path is yours; register it in the portal) |`,
      `| **Configured in** | ${c.configuredIn} |`,
      `| **Deduplicate on** | \`${c.dedupeKey}\` |`,
      `| **Full guide** | [${c.reference.replace("references/", "")}](${c.reference.replace("references/", "")}) |`,
    ].join("\n") + "\n"
  );

  parts.push(`### Payload fields\n`);
  parts.push(parameterTable(c.fields, { label: "Field", required: "Always sent" }) + "\n");

  parts.push(`### What arrives\n`);
  parts.push(json(c.samplePayload) + "\n");

  parts.push(`### What you must respond\n`);
  parts.push(`HTTP 200, immediately, before doing any work:\n`);
  parts.push(json(catalog.conventions.callbackAck) + "\n");

  parts.push(`### Replay it against your own handler\n`);
  parts.push(callbackCurl(c) + "\n");

  if (c.rules?.length) {
    parts.push(`### Rules\n`);
    parts.push(c.rules.map((r) => `- ${r}`).join("\n") + "\n");
  }

  return parts.join("\n");
}

const epilogue = `---

## What a curl does not show

Every command above is one HTTPS POST, and that part ports to any language in a few lines. The
difference between a working call and a production integration is what surrounds it — none of
which is visible in a shell command:

| | Why the curl hides it |
|---|---|
| **Credentials from the environment, injected once** | A shell export becomes a config module that validates at startup and fails loudly. One place reads it; no call site passes credentials as arguments. |
| **\`statusCode\` branching** | You read the JSON yourself here. Code that checks \`res.ok\`, \`raise_for_status()\` or \`EnsureSuccessStatusCode()\` reports every bdapps failure as a success. |
| **Benign codes** | \`E1351\` on register, \`E1356\` on unregister and \`E1379\` on debit all mean the desired state already holds. They are successes, and only your code can know that. |
| **Idempotency** | \`externalTrxId\` has to be generated, persisted before the call, and reused unchanged on retry. A shell loop cannot do this; a ledger row can. |
| **Timeouts and retries** | \`--max-time 15\` becomes an explicit client timeout, with backoff on transient codes only and no automatic retry at all on a debit. |
| **\`tel:\` normalisation** | Typed by hand here; in code it is one function at the boundary, never a concatenation at a call site. |
| **Acknowledge-first callbacks** | The replay commands return instantly. A real handler must respond \`S1000\` and then work out of band — USSD sessions time out in seconds. |

Those seven, plus a shared USSD session store, are the whole specification. They are written out
language-neutrally in [11-any-stack.md](11-any-stack.md), with an acceptance checklist for a
port. [templates/](../templates/README.md) shows the same seven already built in TypeScript/Node,
Python, Java, Go, PHP and C# — worked examples to read for shape, not output to paste.

## Related

| | |
|---|---|
| Machine-readable form of this page | [\`catalog/bdapps-api.json\`](../catalog/bdapps-api.json) |
| Build a request with your own values | \`node tools/bdapps.mjs curl <id> key=value …\` |
| Check a payload before sending it | \`node tools/bdapps.mjs validate <id> '<json>'\` |
| Decode a status code you received | \`node tools/bdapps.mjs code <statusCode>\` |
| Smoke-test the outbound path | [\`scripts/smoke-test.sh\`](../scripts/smoke-test.sh) (or \`smoke-test.ps1\`) |
| Test all four callback handlers | [\`scripts/test-callbacks.sh\`](../scripts/test-callbacks.sh) |
| Every status code, classified | [08-status-codes.md](08-status-codes.md) |
`;

const aiPreamble = `---

# The AI gateway — bdappsAI

${catalog.bdappsai.summary}

It is a separate product from everything above, and the differences are the kind that break an
integration quietly rather than loudly:

${catalog.bdappsai.differsFromTelco.map((x) => `- ${x}`).join("\n")}

Get a key at ${catalog.bdappsai.portal}, then export it alongside the endpoints:

\`\`\`bash
export ${catalog.bdappsai.auth.envVar}='app_XXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'   # never commit it
${aiServices.map((s) => `export ${s.envVar}='${urlFor(s)}'`).join("\n")}
\`\`\`

\`--max-time 120\` rather than 15 on these: a large completion or a high-quality image
legitimately takes tens of seconds, and a 15-second timeout will cancel a call you have already
been billed for. The heredoc is quoted (\`<<'REQUEST'\`) because nothing in the body needs to
expand and a \`$\` inside a prompt must survive the shell.

**Models:** ${catalog.bdappsai.models.map((m) => `\`${m.id}\` (${m.provider})`).join(", ")}.
`;

/**
 * The Subscription Charging SDK.
 *
 * It gets a section of its own rather than a serviceSection() because it is the
 * one bdapps surface that is not a POST: a signed browser redirect, with its own
 * credential pair. Rendering it as an endpoint would invite someone to curl it.
 */
const sdkSection = () => {
  const sdk = catalog.chargingSdk;
  const B = "`";
  const params = sdk.parameters
    .map((p) => `| ${B}${p.name}${B} | ${p.required ? "**Required**" : "Optional"} | ${md(p.description)} |`)
    .join("\n");
  const query = sdk.parameters
    .map((p, i) => `      ${i === 0 ? "?" : "&"}${p.name}=<${p.name}>`)
    .join("\n");
  return `---

# The hosted consent page — Subscription Charging SDK

${sdk.summary}

**It is not a POST, so there is no curl for it.** You build a signed URL on your server and
redirect the browser to it; bdapps takes the consent and returns the browser to your
${B}redirectUrl${B}. The full contract, including how to handle that return safely, is
[06-otp.md](06-otp.md) · ${B}node tools/bdapps.mjs sdk${B}.

\`\`\`
GET ${sdk.authorizeUrl}
${query}
\`\`\`

| Parameter | | Definition |
|---|---|---|
${params}

**Signature** — ${B}${sdk.auth.signature}${B}

The secret goes into the hash and never into the URL. ${sdk.auth.note}

**Credentials** — ${B}${sdk.auth.envVars.join(`${B} and ${B}`)}${B}, a second pair issued once
support enables **Enable Charging SDK** under **General → Advanced**.

### Rules

${sdk.rules.map((r) => `- ${r}`).join("\n")}
`;
};

const document = [
  preamble,
  ...services.map(serviceSection),
  `---\n\n# Inbound callbacks — bdapps calls you\n`,
  ...callbacks.map(callbackSection),
  sdkSection(),
  aiPreamble,
  ...aiServices.map(bdappsaiSection),
  epilogue,
].join("\n");

/* ── Write or check ──────────────────────────────────────────────────────── */

const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;

if (current === document) {
  console.log("references/13-curl-reference.md is in sync with the catalog.");
} else if (check) {
  console.error(
    "stale: references/13-curl-reference.md\n\n" +
      "The curl reference no longer matches catalog/bdapps-api.json. Run\n" +
      "`node scripts/build-curl-reference.mjs` and commit the result."
  );
  process.exit(1);
} else {
  writeFileSync(OUT, document);
  console.log(
    `wrote references/13-curl-reference.md — ${services.length} endpoints, ${callbacks.length} callbacks, ` +
      `${aiServices.length} bdappsAI endpoints.`
  );
}
