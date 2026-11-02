# Shore extensions for Spoke: requirements and design

The design for a separate, open-source project: Spoke extensions that let a campaign load
Shore segments into Spoke campaigns and keep opt-outs in step between the two systems, in
both directions. This file lives in the Shore repo because it also defines the contract
Shore implements. The extensions themselves are built in the fork, never in Shore
(data-rules 10).

Status: draft for the founder's review, 2026-11-01. Nothing here is built yet.

## Why

- **Loading contacts.** Spoke's contacts come from a contact loader picked in the campaign
  editor. Today that means a CSV that someone downloads from Shore and uploads to Spoke, and
  staff aren't allowed bulk exports (tech.md). A Shore loader lists the campaign's segments
  in Spoke and pulls in only the people Shore allows to be texted, checked when the list is
  loaded (data-rules 4: "filter at push time").
- **Opt-outs from Shore into Spoke.** Shore records text opt-outs and suppressions that
  Spoke never sees: manual "stop texting me" requests, STOP replies on other channels. The
  rules say they must reach Spoke within 5 minutes. Spoke's API can only opt out a contact
  that's already in a Spoke campaign, and writing to Spoke's tables directly bypasses its
  Redis cache (it can serve a stale opt-out list for up to 12 hours). The extension records
  the opt-out through Spoke's own code, the same path a STOP reply takes.
- **Opt-outs from Spoke into Shore.** STOP replies reach Shore within minutes through Shore's
  read of Spoke's database. The extension tells Shore at once, so Shore doesn't email or
  load someone who has just opted out.

With these, Spoke can run with Redis. Without Redis, Spoke turns off its initial-text guard,
which keeps a contact from getting the first message twice, and runs slower.

## Scope

**In scope (v1):**

1. A contact loader, `shore`: pick a Shore segment in the campaign editor, then load its
   textable contacts with Shore's person ID as `external_id`.
2. A server endpoint in Spoke, `POST /integrations/shore/:organizationId/opt-outs`: Shore
   calls it to opt a number out in Spoke.
3. A service manager, `shore`: on every opt-out recorded in Spoke, tell Shore.

**Not in scope:**

- **Messages, survey answers, and tags into Shore.** Shore reads these from Spoke's
  database on a schedule, with a read-only login (agreed separately). The extensions neither
  provide nor depend on that read.
- **Reversing opt-outs.** Shore never removes an opt-out in Spoke. Under data-rules 4 only
  the person can reverse an opt-out, and Spoke has no clean path for a START from another
  system. Revisit when Shore handles START (legal L11).
- **Signing in.** Spoke already supports token sign-in through Shore (`PASSPORT_STRATEGY=token`),
  and it needs no extension.
- **Action handlers and message handlers.** Not needed while Shore reads Spoke's database.
  They'd be the route if real-time activity were ever needed.
- **One Spoke for several Shore campaigns.** v1 assumes one Spoke organization per Shore
  campaign. The design keeps the Spoke organization ID in every URL and config key, so this
  can be added later.

## Where the code lives

- **Repository:** a public fork of [ProgressiveCoders/Spoke](https://github.com/ProgressiveCoders/Spoke)
  (GPLv3, last release v14.1.2, Oct 2024), on a long-lived `shore` branch with upstream's
  `main` tracked for rebases. The fork stays GPLv3.
- **Files touched:** only new folders. Spoke loads extensions by folder name from its
  configuration settings, so no registry files change:
  - `src/extensions/contact-loaders/shore/` (`index.js`, `react-component.js`)
  - `src/extensions/service-managers/shore/` (`index.js`, plus `react-component.js` only if
    org settings get a UI; see "Configuration")
  - `src/extensions/shore-common/` for code both share: config, request signing, the HTTP
    client. Put it under the loader instead if Spoke's build doesn't pick up a new top-level
    extensions folder.
  - `__test__/extensions/shore/` for tests.
  - `docs/HOWTO-integrate-with-shore.md`
- **Upstreaming:** written so it could be offered upstream, as the CiviCRM loader was:
  nothing campaign-specific, everything set through configuration.

## Configuration

Read with Spoke's `getConfig(key, organization)`. A key in the organization's `features` JSON
wins over the environment variable, so one Spoke can serve several organizations later.

| Key | Required | Meaning |
|---|---|---|
| `CONTACT_LOADERS` | yes | Include `shore` (e.g. `shore,csv-upload`). |
| `SERVICE_MANAGERS` | yes | Include `shore`. |
| `SHORE_URL` | yes | Shore's origin, e.g. `https://app.shore.vote`. HTTPS only, except `http://localhost` in development. |
| `SHORE_CAMPAIGN` | yes | The campaign's slug in Shore. |
| `SHORE_INTEGRATION_KEY` | yes | The shared key both sides sign requests with (see "Security"). At least 32 random characters. Shore shows it once, when an admin creates it. Separate from `TOKEN_AUTH_SHARED_SECRET`. |
| `SHORE_CACHE_SECONDS` | no | How long the segment list is cached in the campaign editor. Default 60. |
| `SHORE_TIMEOUT_MS` | no | Timeout for each request to Shore. Default 10000. |

`available()` is true for both extensions only when the required keys are set and
`SHORE_URL` parses.

## Security

**Signing.** Every request in either direction is signed with HMAC-SHA256 under
`SHORE_INTEGRATION_KEY`:

- Headers: `X-Shore-Timestamp` (Unix seconds) and `X-Shore-Signature`, the hex HMAC of
  `${timestamp}.${method}.${path-with-query}.${body}` (body empty for GET).
- The receiver compares in constant time and rejects a timestamp more than 300 seconds
  from its own clock.
- There's no separate replay store. Each operation is idempotent, so a replay inside the
  window does nothing new.

**Personal data.**

- No cell numbers, names, or other personal data in Spoke's logs. Log counts, Spoke IDs,
  and Shore's request IDs only.
- Only the opt-out endpoint and the HTTP client handle cell numbers.
- Contacts arrive from Shore over HTTPS and go straight into `campaign_contact`. Nothing is
  written to disk or a temp file.

**Endpoint checks.** The Spoke endpoint takes no session cookie and isn't reachable through
Spoke's sign-in. It accepts only a valid signature for the organization in its path, and it
answers 404 for an unknown organization or one without the configuration.

**Shore's side.** Shore stores only a hash of the key. It resolves the campaign from
`SHORE_CAMPAIGN` and the signature, and sets row-level security for that campaign before
any read (data-rules 1), like its webhooks.

## Contract: Shore's endpoints (Spoke → Shore)

All under `${SHORE_URL}/api/spoke/v1/:campaign`, signed, JSON. The error body is
`{ "error": "<code>" }`.

### `GET /segments`

The campaign's segments, for the picker.

```json
{
  "segments": [
    {
      "id": "uuid",
      "name": "Pledged to vote, has a phone",
      "description": "…or null",
      "updatedAt": "2026-11-01T14:00:00Z",
      "textableCount": 412
    }
  ]
}
```

`textableCount` is how many contacts a load would return right now (it can change before
the load).

### `POST /segments/:segmentId/loads`

Starts a load. Shore works out who's in the segment, keeps only people it may text, and
saves that list as a snapshot so the pages below stay consistent.

**What Shore may text:** a mobile number that isn't marked bad or wrong, no text opt-out on
that number, and no text suppression on the person. This is Shore's consent check; the
extension never decides it. If legal L11 or L22 calls for a text opt-in, Shore adds that
here. Each person appears once, under the number Shore's "best number to text" rule picks
(roadmap P1-E10): never a known landline, and for an opted-in list only a number with a
current opt-in. That's not necessarily their preferred number.

**Request:**

```json
{ "spokeCampaignId": 12, "spokeCampaignTitle": "GOTV week 1", "spokeJobId": 345 }
```

**Response:**

```json
{ "loadId": "uuid", "count": 398 }
```

**Audit:** Shore records the load (who, segment, Spoke campaign, count) in its audit log.
Shore may also put "added to Spoke campaign …" on each person's timeline.

**Idempotent:** the same `spokeJobId` returns the same `loadId`.

### `GET /loads/:loadId/contacts?cursor=…&limit=1000`

One page of the snapshot. Pages expire an hour after the load starts.

```json
{
  "contacts": [
    {
      "externalId": "person uuid",
      "firstName": "Testy",
      "lastName": "Example",
      "cell": "+15555550123",
      "zip": "22031",
      "customFields": { "preferredName": "Testy", "city": "Fairfax" }
    }
  ],
  "nextCursor": "opaque string or null"
}
```

- **`cell`:** always E.164.
- **`zip`:** five digits or null.
- **`customFields`:** a short, documented list that Shore owns. Scripts use the fields as
  `{preferredName}` and the like. No voter-file fields in v1 (data-rules 12 keeps voter
  data in our own systems; Spoke is ours, but keep the first version minimal and decide this
  on purpose).
- **`limit`:** 5000 at most.

### `POST /opt-outs`

The service manager reports an opt-out recorded in Spoke.

**Request:**

```json
{
  "cell": "+15555550123",
  "reason": "stop",
  "spokeOrganizationId": 1,
  "spokeCampaignId": 12,
  "spokeCampaignContactId": 9876,
  "externalId": "person uuid or null",
  "occurredAt": "2026-11-01T14:05:00Z"
}
```

**Response:** `{ "recorded": true }`, or `{ "recorded": false, "reason": "already_opted_out" }`.

Shore records a text opt-out on that number in `consents` (source `spoke`), even when the
number matches no person (data-rules 4).

**Idempotent:** Shore keys the record on `spoke:${spokeOrganizationId}:${cell}:${occurredAt}`,
and a number that's already opted out is a no-op. Shore's database read of `opt_out` also
catches anything this call misses.

## Contract: the extension's endpoint (Shore → Spoke)

### `POST ${SPOKE_BASE_URL}/integrations/shore/:organizationId/opt-outs`

Signed, JSON. Shore calls it within 5 minutes of recording a text opt-out or suppression,
retrying with backoff until it gets a 2xx. A suppression applies to every mobile number
the person has.

**Request:**

```json
{ "cells": ["+15555550123"], "reason": "shore:manual", "shoreRequestId": "uuid" }
```

**Behavior:**

- **Validation:** check the signature, then the organization (it exists, and its config
  names this `SHORE_CAMPAIGN`).
- **For each cell (at most 500 per request):**
  1. Normalize it with Spoke's `getFormattedPhoneNumber`. Skip cells that don't parse, and
     count them.
  2. If it's already opted out in this organization (`cacheableData.optOut.query`), skip it
     and count it.
  3. Otherwise call `cacheableData.optOut.save` with these arguments:
     - `cell`
     - `campaign: { organization_id }`, so no real campaign is needed (the save only reads
       `organization_id`)
     - `assignmentId: null` (the `opt_out.assignment_id` column is nullable)
     - `reason`: `shore:` plus Shore's reason code
     - `noReply: false`

     This is Spoke's own path for a STOP reply. It updates the Redis cache, adds the
     `opt_out` row, and marks the number opted out on active campaigns' contacts.
- **Response:** `{ "optedOut": n, "alreadyOptedOut": n, "invalid": n }`.
- **Idempotent:** by checking existing state first. `shoreRequestId` is only for logs.

**No loop:** `save` triggers service managers' `onOptOut`, including ours. The service
manager must skip opt-outs whose `reason` starts with `shore:`, so they aren't sent back to
Shore.

## Design: the contact loader (`contact-loaders/shore`)

Modeled on `contact-loaders/civicrm`.

**`displayName()`** returns "Shore segment".

**`serverAdministratorInstructions()`** lists the required config keys and links to the
HOWTO.

**`available(organization, user)`** checks the config only, with no network call:

```js
{ result, expiresSeconds: 60 }
```

**`clientChoiceDataCacheKey(campaign)`** keys on the campaign's organization ID.

**`getClientChoiceData(organization, campaign, user)`** calls `GET /segments` and returns
`{ data: JSON.stringify({ segments }), expiresSeconds: SHORE_CACHE_SECONDS }`. If Shore is
unreachable it returns `{ data: JSON.stringify({ error: "shore_unreachable" }) }` so the
component can show it.

**`react-component.js` (`CampaignContactsForm`):**

- A segment picker showing name, description, and textable count, with a refresh button
  and the time the counts were taken.
- On save, it sends `{ segmentId, segmentName }` as the loader's payload.
- Same props and validation pattern as the CiviCRM component.

**`processContactLoad(job, maxContacts, organization)`:**

1. Parse `job.payload`, then delete the campaign's existing `campaign_contact` rows (a new
   choice replaces the old one, as every loader does).
2. Start the load with `POST /segments/:id/loads`, passing `spokeCampaignId`,
   `spokeCampaignTitle` and `spokeJobId`.
3. Page through `GET /loads/:id/contacts` until `nextCursor` is null, stopping at
   `maxContacts` if it's set. For each contact:
   - Map it to a row:
     - `first_name`, `last_name`, `zip`, `external_id`
     - `cell`, run through `getFormattedPhoneNumber` (don't trust either side's
       formatting)
     - `custom_fields` as a JSON string
     - `message_status: "needsMessage"`
     - `campaign_id`
     - `timezone_offset` from `getTimezoneByZip(zip)`, when there's a ZIP
   - Keep the last row per cell, as Spoke does.
   - Insert in batches of 1000 with `r.knex.batchInsert`.
4. Call `completeContactLoad(job, null, String(segmentId), JSON.stringify({ finalCount, segmentName, loadId }))`.
   This also removes opted-out numbers and duplicates on Spoke's side, as a second check.
5. On any error, call Spoke's failed-load path (`failedContactLoad`, as the CiviCRM loader
   does) with a short code (`shore_unreachable`, `shore_rejected`, `load_expired`). The
   message never includes personal data.

**`addServerEndpoints(expressApp)`** mounts the opt-out endpoint above. Loaders are the
extension type with this hook. Spoke calls it at startup whether or not the loader is
available, so the handler itself checks the config and answers 404 when it isn't set.

## Design: the service manager (`service-managers/shore`)

```js
export const name = "shore";
export const metadata = () => ({
  displayName: "Shore",
  description: "Tells Shore when someone opts out in Spoke.",
  canSpendMoney: false,
  moneySpendingOperations: [],
  supportsOrgConfig: false,
  supportsCampaignConfig: false
});
```

Implement only `onOptOut` (any other hook would add cost, as Spoke's own docs warn).

**`onOptOut({ organization, contact, campaign, reason })`:**

- Return straight away if `reason` starts with `shore:`, or the config isn't set.
- Otherwise `POST /opt-outs` with:
  - the contact's cell, `external_id`, and campaign contact ID;
  - the campaign ID and organization ID;
  - the reason;
  - the current time.
- It runs inside Spoke's request (a texter's or an incoming message's), so:
  - **Timeout:** `SHORE_TIMEOUT_MS`, at most 3 seconds here.
  - **Retries:** one retry, then give up.
  - **Errors:** never throw. Log a warning with the Spoke IDs only.
- Shore's database read is the backstop for anything this misses.

## Failure behavior

| Situation | What happens |
|---|---|
| Shore is down while a campaign is being built | The segment picker says so; the load fails with `shore_unreachable` and can be retried. Nothing half-loaded is left: rows are deleted before the load, and Spoke marks the job failed. |
| A load page expires mid-load | Fails with `load_expired`; retry starts a fresh load. |
| Shore can't reach Spoke for an opt-out | Shore retries with backoff and alerts its admins if it can't deliver within 5 minutes (the rule). Until then, Spoke's next contact load still filters the number out, because Shore wouldn't return it. |
| Spoke can't reach Shore for an opt-out | Logged and dropped. Shore's database read records it within minutes. |
| Clock skew over 300 seconds | Signed requests fail with 401 in both directions. HOWTO tells admins to run NTP (Cloud Run already does). |

## Tests (in the fork, Spoke's Jest setup)

- **Signing:** valid, wrong key, stale timestamp, a tampered body or path.
- **Loader:**
  - The segment list and its error state.
  - Paging, with the `maxContacts` cap.
  - Mapping, including the E.164 cell, timezone from ZIP, and `custom_fields`.
  - Last row wins for a repeated cell.
  - Existing contacts are replaced.
  - A failed load reports its code.
  - Shore is faked with nock or a stub server, using fake data only.
- **Opt-out endpoint:**
  - Records through `optOut.save`, with Redis and without (Spoke's tests can run both).
  - An already opted-out number is a no-op.
  - Bad cells are counted, not saved.
  - Unknown org, missing config, and bad signature return 404 or 401.
  - Contacts on archived campaigns are untouched, as with Spoke's own opt-outs.
- **Service manager:**
  - Posts on a STOP.
  - Skips `shore:` reasons.
  - Never throws when Shore times out or errors.

## Shore's side (this repo, roadmap P1-E10)

Built in Shore once this design is approved, with its own tests:

- **Settings:** a "Spoke extension" key in Settings → Connections, created and shown once,
  with only its hash stored, alongside the existing Spoke sign-in settings.
- **Endpoints:** the four Spoke-facing endpoints above (segment list, start load, contact
  pages, opt-out report), signed, scoped to the campaign, and audited.
- **Push job:** sends new text opt-outs and suppressions to Spoke within 5 minutes,
  retrying, and alerting when it can't.
- **Database read:** messages, survey answers, tags, and `opt_out` from Spoke's database,
  read-only, onto timelines and into `consents`. This is separate from the extensions.

## Decisions needed (founder)

1. **Approve the fork.** CLAUDE.md requires sign-off before any Spoke source is copied or
   modified. Also choose whose GitHub account hosts the fork.
2. **Shared-key signing** (HMAC, one key per campaign), rather than separate bearer tokens
   in each direction.
3. **Text consent rule for loads:** "opted out or suppressed means excluded" (today's rule),
   or also require a text opt-in? This depends on legal L11 and L22.
4. **Custom fields in v1:** preferred name and city only, or more (pledge status, volunteer
   roles)? No voter-file fields without a separate decision.
5. **Timeline entries:** should each person's timeline note "added to Spoke campaign …" when
   they're loaded?
