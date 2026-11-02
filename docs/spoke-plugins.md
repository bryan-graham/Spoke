# Shore extensions for Spoke: requirements and design

The design for Spoke extensions that connect Spoke to Shore, an external campaign
application. The extensions let Shore:

1. **Load lists.** Pick a Shore segment in the campaign editor and load its textable
   contacts into a Spoke campaign.
2. **Receive interactions.** Read what happened in Spoke: messages sent and received,
   survey (canvass) answers, tags, and opt-outs.
3. **Send opt-outs.** Tell Spoke, safely and within seconds, that someone has asked not to
   be texted through another channel (email, a phone call, a form).

Status: approved 2026-11-01. **The exact interface is in
[shore-contract.md](shore-contract.md), which wins where this document differs.** The Spoke extension is built (2026-11-02) in
`src/extensions/contact-loaders/shore/`; setup is in `docs/HOWTO-integrate-with-shore.md`.
Shore's side isn't built yet. This version replaces the
first draft after checking it against Spoke's code; "Changes from the first draft" at the end
lists what moved and why.

## Principles

- **No changes to Spoke's core files.** Everything lives in new extension folders that
  Spoke loads by name from its configuration settings. If a feature can't be built that way,
  we change the design, not core. This keeps the extension separate from Spoke's own
  code, so fixes from the original Spoke project can still be taken in later with few
  conflicts, if they're ever wanted.
- **APIs before shared databases.** Shore talks to Spoke through signed HTTP endpoints that
  the extension owns. Direct, read-only database access stays a fallback (see "Fallback:
  reading Spoke's database"), not the plan.
- **Spoke's own code paths for writes.** Opt-outs go through `cacheableData.optOut.save`,
  the path a STOP reply takes, so Redis, the `opt_out` table and contacts all stay in step.
- **Nothing slow in the texting path.** No hook that runs inside a texter's request or an
  incoming message makes a network call to Shore. Shore pulls instead.

## Why

- **Loading contacts.** Today someone downloads a CSV from Shore and uploads it to Spoke.
  A loader pulls in only the people Shore allows to be texted, checked when the list is
  loaded.
- **Interactions into Shore.** Shore needs messages and canvass results on each person's
  timeline. An API means Shore doesn't need a login to Spoke's database or knowledge of its
  schema.
- **Opt-outs into Spoke.** Spoke's GraphQL API can only opt out a contact that's already in a
  campaign, and writing to Spoke's tables directly bypasses its Redis cache (which can serve
  a stale opt-out list for up to 12 hours). The extension records the opt-out through Spoke's
  own code.

## Scope

**In scope (v1):** one extension, the contact loader `shore`, which provides:

1. The segment picker and contact load.
2. An **inbound** endpoint: Shore posts opt-outs to Spoke.
3. **Outbound** read endpoints: Shore polls for messages, survey answers, tags, opt-outs and
   campaign definitions.

Contact loaders are the one extension type whose `addServerEndpoints(app)` Spoke calls at
startup (`src/server/index.js`), so the loader is where all the endpoints live. No service
manager, message handler or action handler is needed.

**Not in scope:**

- **Reversing opt-outs.** Shore never removes an opt-out in Spoke. Spoke itself has no
  built-in way to reverse one (it doesn't act on START replies), so this needs a separate
  decision if it's ever wanted.
- **Signing in.** Spoke already supports token sign-in (`PASSPORT_STRATEGY=token`).
- **Push from Spoke to Shore.** Shore polls; see "Why polling" below. A push hook can be
  added later without changing the read API.
- **Message delivery receipts in real time.** The messages endpoint reports each message's
  `send_status` when it's read; Shore re-reads a trailing window to pick up later status
  changes (see "Cursors").
- **One Spoke organization for several Shore campaigns.** v1 assumes one Spoke organization
  per Shore campaign. The organization ID is in every URL and every config key is read per
  organization, so this can be added later.

## Where the code lives

[bryan-graham/Spoke](https://github.com/bryan-graham/Spoke), a standalone fork of
[ProgressiveCoders/Spoke](https://github.com/ProgressiveCoders/Spoke). It stays GPLv3.
Changes stay in this fork; they aren't sent back to the projects it came from. New files
only:

```
src/extensions/contact-loaders/shore/
  index.js              loader interface + addServerEndpoints
  react-component.js    segment picker (CampaignContactsForm)
  lib/config.js         reads and validates the config keys
  lib/signing.js        HMAC signing and verification
  lib/shore-client.js   HTTP client for Shore's endpoints
  lib/routes.js         mounts /integrations/shore/v1/:organizationId
  lib/auth.js           organization + signature check for every route
  lib/opt-outs.js       POST /opt-outs
  lib/read-api.js       the outbound read endpoints and their queries
__test__/extensions/contact-loaders/shore/
docs/HOWTO-integrate-with-shore.md
```

Keeping the shared code under the loader folder avoids relying on Spoke's build picking up
a new top-level extensions folder.

## Configuration

Read with Spoke's `getConfig(key, organization)`: a key in the organization's `features` JSON
wins over the environment variable.

| Key | Required | Where | Meaning |
|---|---|---|---|
| `CONTACT_LOADERS` | yes | **environment only** | Include `shore` (e.g. `shore,csv-upload`). Spoke reads this one key from the environment at startup to decide which loaders exist and which mount endpoints, and the browser reads it from `global.CONTACT_LOADERS`, so it can't be set per organization. |
| `SHORE_URL` | yes | env or org | Shore's origin, e.g. `https://app.shore.vote`. HTTPS only, except `http://localhost` in development. |
| `SHORE_CAMPAIGN` | yes | env or org | The campaign's slug in Shore. |
| `SHORE_INTEGRATION_KEY` | yes | env or org | The shared signing key (see "Security"). At least 32 random characters. Separate from `TOKEN_AUTH_SHARED_SECRET`. |
| `SHORE_CACHE_SECONDS` | no | env or org | How long the segment list is cached in the campaign editor. Default 60. |
| `SHORE_TIMEOUT_MS` | no | env or org | Timeout for each request to Shore. Default 10000. |
| `SHORE_SETTLE_SECONDS` | no | env or org | How long a new row is held back from the read feeds (see "Cursors"). Default 15. |

`available()` is true only when the required keys are set for the organization and
`SHORE_URL` parses. The endpoints run the same check and answer 404 when it fails.

## Security

**Signing.** Every request in either direction is signed with HMAC-SHA256 under
`SHORE_INTEGRATION_KEY`:

- Headers: `X-Shore-Timestamp` (Unix seconds) and `X-Shore-Signature`, the hex HMAC of
  `${timestamp}.${method}.${path-with-query}.${rawBody}` (body empty for GET).
- The receiver compares in constant time and rejects a timestamp more than 300 seconds from
  its own clock.
- No replay store: every write is idempotent and every read is safe to repeat.

**Getting the raw body without touching core.** Spoke parses JSON for the whole app
(`bodyParser.json()` in `src/server/index.js`) before loader routes are mounted, which would
throw away the bytes the signature covers. So Shore sends its POST bodies as
`Content-Type: application/vnd.shore+json`. Spoke's global parsers only match
`application/json` and form encoding, so they leave that body alone, and the extension's
route reads it with `bodyParser.raw({ type: "application/vnd.shore+json", limit: "256kb" })`,
verifies the signature over those bytes, then parses the JSON itself. A request with any
other content type gets 415. Tests must prove the global parser doesn't consume the body.

**Endpoint checks.** The endpoints ignore Spoke's session cookie and sign-in entirely. They
accept only a valid signature under the key configured for the organization in the path,
and answer 404 for an unknown organization or one without the configuration, before
checking the signature.

**Personal data.**

- No cell numbers, names or message text in Spoke's logs. Log counts, Spoke IDs and Shore's
  request IDs only.
- The read endpoints return personal data (cells, names, message text) only to a correctly
  signed request, over HTTPS.
- Contacts arrive from Shore over HTTPS and go straight into `campaign_contact`. Nothing is
  written to disk or a temp file.

**Shore's side.** Shore must keep the key itself, not a hash: the same key both signs
Shore's requests and checks Spoke's, so Shore stores it encrypted (for example with a
secret manager) and scopes every request to the campaign it belongs to.

## Part 1: loading lists

### Shore's endpoints (Spoke → Shore)

All under `${SHORE_URL}/api/spoke/v1/:campaign`, signed, JSON. Error body:
`{ "error": "<code>" }`.

#### `GET /segments`

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

`textableCount` is how many contacts a load would return right now.

#### `POST /segments/:segmentId/loads`

Starts a load. Shore works out who's in the segment, keeps only people it may text, and
saves a snapshot so the pages stay consistent.

**What Shore may text** is Shore's decision, never the extension's: a mobile number that
isn't marked bad, no text opt-out on that number, no text suppression on the person. Each
person appears once, under Shore's "best number to text."

Request: `{ "spokeCampaignId": 12, "spokeCampaignTitle": "GOTV week 1", "spokeJobId": 345 }`
Response: `{ "loadId": "uuid", "count": 398 }`

Idempotent: the same `spokeJobId` returns the same `loadId`. Shore audits each load.

#### `GET /loads/:loadId/contacts?cursor=…&limit=1000`

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

`cell` is E.164; `zip` is five digits or null; `limit` is at most 5000. Pages expire an
hour after the load starts.

**`customFields`** is a fixed list Shore owns and documents. Spoke learns a campaign's
custom field names from its **first** contact only (`dbCustomFields` in
`src/server/models/cacheable_queries/campaign.js`), so every contact in a load carries
**every key**, with `""` when Shore has no value. Otherwise a field missing from the first
contact can't be used in the script at all.

| Field | v1 | Meaning |
|---|---|---|
| `preferredName` | yes | What the person likes to be called; falls back to first name. |
| `city` | yes | City of the person's address. |
| `pollingPlaceName` | yes, often empty | Name of the person's election-day voting location. |
| `pollingPlaceAddress` | yes, often empty | Its street address. |
| `precinct` | yes, often empty | Precinct name or code. |
| `earlyVoteInfo` | later | Nearest early-vote site and hours. |
| `volunteerRoles` | later | Short, comma-separated list for volunteer recruitment scripts. |

The voting-location fields are in v1 even though Shore may not have the data yet, so the
contract and scripts don't change when it does; until then they're `""`. Script writers
should only use them in campaigns whose segments Shore fills them for. ZIP isn't a custom
field: it's the standard `zip` column, which sets the contact's timezone and is already
usable in scripts as `{zip}`. Because keys are
fixed per Shore release, adding a field later is a contract change on Shore's side only; the
extension passes `customFields` through as-is.

### The loader

Modeled on `contact-loaders/civicrm` (picker and choice data) and
`contact-loaders/redash` (failure handling).

- **`displayName()`**: "Shore segment".
- **`serverAdministratorInstructions()`**: the config keys and a link to the HOWTO.
- **`available(organization, user)`**: config check only, no network call;
  `{ result, expiresSeconds: 60 }`.
- **`clientChoiceDataCacheKey(campaign)`**: the organization ID.
- **`getClientChoiceData(organization, campaign, user)`**: calls `GET /segments`; returns
  `{ data: JSON.stringify({ segments }), expiresSeconds: SHORE_CACHE_SECONDS }`, or
  `{ data: JSON.stringify({ error: "shore_unreachable" }), expiresSeconds: 0 }` when Shore
  can't be reached.
- **`react-component.js`**: a segment picker with name, description and textable count, and
  the time the counts were taken. Saves `{ segmentId, segmentName }` as the payload. No
  refresh button: Spoke gives loader components no way to refetch their choice data, so the
  list refreshes when the page is reloaded after `SHORE_CACHE_SECONDS`.

**`processContactLoad(job, maxContacts, organization)`:**

1. Parse `job.payload` and delete the campaign's existing `campaign_contact` rows.
2. `POST /segments/:id/loads` with `spokeCampaignId`, `spokeCampaignTitle`, `spokeJobId`.
3. Page through `GET /loads/:id/contacts` until `nextCursor` is null, stopping at
   `maxContacts` if set. Map each contact to a row: `first_name`, `last_name`, `zip`,
   `external_id`, `cell` (through `getFormattedPhoneNumber`), `custom_fields` (JSON string),
   `message_status: "needsMessage"`, `campaign_id`, and `timezone_offset` from
   `getTimezoneByZip(zip)` when there's a ZIP. Last row wins for a repeated cell. Insert in
   batches of 1000 with `r.knex.batchInsert`.
   Rows are inserted in Shore's order, and `completeContactLoad` keeps the highest ID per
   cell, which is what makes the last row win.
4. `completeContactLoad(job, null, reference, result)`, where `reference` is
   `{ segmentId, segmentName, loadId }` and `result` is
   `{ finalCount, invalidCellCount, loadId }` (both JSON strings). This also removes
   opted-out numbers and duplicates on Spoke's side.
5. On any error, delete any rows already inserted (so a failed load never leaves a partial
   list), then `failedContactLoad(job, null, reference, JSON.stringify({ errors: [code] }))`.
   Codes: `not_configured`, `segment_required`, `segment_not_found`, `shore_unreachable`,
   `shore_rejected`, `shore_bad_response`, `load_expired`, `load_error`. No personal data in
   the message.

## Part 2: interactions into Shore (the read API)

### Why polling

A push from Spoke would have to run inside Spoke's hot paths (a texter's request, an
incoming message), and the hooks there don't get everything we need without core changes:
for example, service managers' `onOptOut` isn't given the cell number, and for STOP replies
the contact is often not loaded. Polling avoids all of that:

- Nothing in Spoke's texting path calls Shore, so Shore being slow or down never slows
  texting.
- Shore controls the pace (every 30–60 seconds is the target) and can catch up after an
  outage just by continuing from its cursor.
- Every change is captured, whichever code path made it, because the endpoints read the
  tables Spoke writes.

### Endpoints (Shore → Spoke)

All under `${SPOKE_BASE_URL}/integrations/shore/v1/:organizationId`, signed GETs, JSON, scoped
to that organization. Every list endpoint takes `afterId` (default 0) and `limit` (default
500, at most 2000), returns rows in ascending `id`, and returns `nextAfterId` (the last
`id` in the page, or the input when the page is empty).

#### `GET /campaigns?afterId=…`

Campaigns in the organization with their survey definitions, so Shore can turn interaction
step IDs into questions and answers.

```json
{
  "campaigns": [
    {
      "id": 12,
      "title": "GOTV week 1",
      "isStarted": true,
      "isArchived": false,
      "createdAt": "2026-11-01T14:00:00Z",
      "shoreLoad": { "segmentId": "uuid", "segmentName": "Pledged", "loadId": "uuid" },
      "interactionSteps": [
        {
          "id": 31,
          "parentInteractionId": null,
          "answerOption": "",
          "question": "Can we count on your vote?",
          "isDeleted": false
        }
      ]
    }
  ]
}
```

`shoreLoad` comes from the campaign's last successful Shore contact load, or null.
Campaigns have no update time to page on, so Shore re-reads the whole list (it's small)
on each poll.

#### `GET /messages?afterId=…`

```json
{
  "messages": [
    {
      "id": 1001,
      "campaignId": 12,
      "campaignContactId": 9876,
      "externalId": "person uuid",
      "contactNumber": "+15555550123",
      "isFromContact": false,
      "text": "Hi Testy, …",
      "sendStatus": "DELIVERED",
      "userId": 7,
      "createdAt": "2026-11-01T14:05:00Z"
    }
  ],
  "nextAfterId": 1001
}
```

Joined `message → campaign_contact → campaign`, filtered on `campaign.organization_id`.
`externalId` is the contact's `external_id` (Shore's person ID for contacts Shore loaded).

#### `GET /question-responses?afterId=…`

New survey answers: `{ id, campaignId, campaignContactId, externalId, interactionStepId, value, createdAt }`.

Spoke changes an answer by deleting and reinserting rows, so a changed answer shows up here
as a new row for the same contact and step; the newest row wins. A cleared answer (deleted
with nothing reinserted) doesn't show up here at all; the contact-state endpoint below
covers that.

#### `GET /tags?afterId=…`

New tags on contacts: `{ id, campaignId, campaignContactId, externalId, tagId, tagName, value, createdAt }`,
from `tag_campaign_contact` joined to `tag`.

#### `GET /opt-outs?afterId=…`

Every opt-out recorded in the organization, whatever recorded it:
`{ id, cell, reasonCode, assignmentId, createdAt }`. Rows whose `reasonCode` starts with
`shore:` are the ones Shore sent (Part 3); Shore can skip them.

#### `GET /campaigns/:campaignId/contact-state?afterContactId=…&limit=…`

The current state of each contact in a campaign, for reconciling and for anything the
append-only feeds miss (cleared answers, removed tags):

```json
{
  "contacts": [
    {
      "campaignContactId": 9876,
      "externalId": "person uuid",
      "messageStatus": "convo",
      "isOptedOut": false,
      "questionResponses": [{ "interactionStepId": 31, "value": "Yes" }],
      "tags": [{ "tagId": 4, "tagName": "Needs a ride", "value": null }]
    }
  ],
  "nextAfterContactId": 9876
}
```

Shore runs this per active campaign on a slow schedule (e.g. hourly) and after a campaign
is archived.

### Cursors

- **IDs, not timestamps.** Each feed pages on its table's primary key, which is indexed.
  None of these tables has an indexed update time we could page on without a migration.
- **Late commits.** Two inserts can commit out of ID order, so a fast reader could pass an
  ID that commits a moment later. Each feed only returns rows created more than 15 seconds
  ago, and Shore may also re-read a trailing window (for example, from the cursor it had
  five minutes ago). Shore stores by Spoke ID, so re-reading is harmless.
- **Message status.** Re-reading the trailing window also picks up later `send_status`
  changes (delivered, error), which update the row in place.

### Cost

Each request is one indexed range scan joined to `campaign_contact` and `campaign`. With
Shore polling four feeds once a minute this is a handful of small queries a minute, well
below what Spoke's own texter screens do. The queries go to the primary database through
Spoke's `r.knex`, not `r.knexReadOnly`: a read replica that lags by more than the settle
window could hide rows behind Shore's cursor.

**Known limit:** each feed walks its table's IDs and keeps only this organization's rows. On
a Spoke that hosts other busy organizations, a quiet organization's poll scans past their
rows. That's fine for v1 (one organization per Spoke); a multi-organization version would
add an ID window per request.

## Part 3: opt-outs into Spoke

### `POST ${SPOKE_BASE_URL}/integrations/shore/v1/:organizationId/opt-outs`

Signed, `Content-Type: application/vnd.shore+json`. Shore calls it as soon as it records a
text opt-out or suppression (a suppression covers every mobile number the person has),
retrying with backoff until it gets a 2xx and alerting its admins if it can't deliver within
5 minutes.

**Request:**

```json
{ "cells": ["+15555550123"], "reason": "manual", "shoreRequestId": "uuid" }
```

`reason` is optional (default `optout`) and limited to letters, digits and `_ . : -`, up to
64 characters. A request with any content type other than `application/vnd.shore+json`
gets 415, before anything else is checked.

**For each cell (at most 500 per request):**

1. Normalize with `getFormattedPhoneNumber`. Skip and count cells that don't parse.
2. If already opted out (`cacheableData.optOut.query({ cell, organizationId })`), skip and
   count it.
3. Find the most recent `campaign_contact` with that cell in the organization, if any, so
   other service managers get a real contact and campaign.
4. Call `cacheableData.optOut.save` with `cell`; `campaign` (that contact's campaign, or
   `{ organization_id }` when there's none); `contact` (that contact, or `{ cell }`);
   `campaignContactId`; `assignmentId: null`; `reason: "shore:" + reason`;
   `noReply: false`; `organization`.

   This is Spoke's STOP path: it updates Redis, inserts the `opt_out` row, and marks the
   number opted out on contacts in active campaigns.

5. `save` writes the opt-out **before** it runs service managers' `onOptOut`. Wrap the call
   in `try/catch`: if a service manager throws (for example `civicrm-donotsms` reads
   `contact.external_id` and calls CiviCRM), the opt-out is already recorded, so log a
   warning with Spoke IDs only and count it as opted out. If the row isn't there, count it
   as failed.

A cell repeated in the same request counts as already opted out.

**Response:** `{ "optedOut": n, "alreadyOptedOut": n, "invalid": n, "failed": n }`, with
status 200, or 500 when `failed` is more than 0 so Shore retries the request (the cells
already done are skipped next time).

**Idempotent:** state is checked first, so repeats do nothing. `shoreRequestId` is for logs.

**No loop:** these opt-outs come back out of `GET /opt-outs` with a `shore:` reason, and
Shore skips them.

**Speed:** with the request going straight through Spoke's own path, the number is opted out
in Redis and the database within the request, typically well under a second after Shore
sends it. If Spoke is unreachable, Shore keeps retrying, and in the meantime the next
contact load still leaves the number out, because Shore won't return it.

## Fallback: reading Spoke's database

If an API endpoint can't meet a need (for example, a bulk historical backfill), Shore may
read Spoke's database directly with a **read-only** role limited to `message`,
`question_response`, `interaction_step`, `tag`, `tag_campaign_contact`, `opt_out`,
`campaign` and `campaign_contact`. Rules:

- Reads only. Shore never writes to Spoke's tables; every write goes through an endpoint so
  Spoke's cache stays correct.
- Treat it as a schema dependency: anything Shore reads this way must be rechecked on every
  Spoke upgrade.
- Prefer adding an endpoint over widening this.

## Failure behavior

| Situation | What happens |
|---|---|
| Shore is down while a campaign is being built | The picker says so; the load fails with `shore_unreachable` and can be retried. Rows are deleted before the load and Spoke marks the job failed, so nothing half-loaded is left as a success. |
| A load page expires mid-load | Fails with `load_expired`; retrying starts a fresh load. |
| Shore can't reach Spoke to send an opt-out | Shore retries with backoff and alerts within 5 minutes. Spoke's next contact load still leaves the number out. |
| Spoke can't be polled | Shore resumes from its cursors when Spoke is back; nothing is lost. |
| Another service manager fails during a Shore opt-out | The opt-out is already saved; the extension logs and carries on. |
| Clock skew over 300 seconds | Signed requests fail with 401 in both directions. The HOWTO tells admins to run NTP. |

## Tests (Spoke's Jest setup)

- **Signing:** valid; wrong key; stale timestamp; tampered body, path or query.
- **Raw body:** a `application/vnd.shore+json` POST reaches the route with its bytes intact
  through Spoke's real app setup; `application/json` gets 415.
- **Loader:** segment list and its error state; paging and the `maxContacts` cap; mapping
  (E.164 cell, timezone from ZIP, `custom_fields`); last row wins; existing contacts
  replaced; failed load reports its code. Shore faked with nock, fake data only.
- **Opt-out endpoint:** records through `optOut.save` with and without Redis; already
  opted-out is a no-op; bad cells counted, not saved; unknown org, missing config and bad
  signature give 404 or 401; a throwing service manager doesn't fail the request; archived
  campaigns' contacts untouched, as with Spoke's own opt-outs.
- **Read endpoints:** each feed pages by ID, respects the organization (rows from another
  organization never appear), applies the 15-second settle window, and returns a changed
  answer as a new row; contact state reflects a cleared answer; `limit` capped.

## Shore's side

Built in Shore, with its own tests:

- **Settings:** a "Spoke extension" key, created and shown once, stored encrypted (not
  hashed; Shore needs it to sign requests).
- **Endpoints:** the three list-loading endpoints in Part 1, signed, campaign-scoped,
  audited.
- **Poller:** reads the Part 2 feeds every 30–60 seconds, stores cursors, re-reads a
  trailing window, runs contact-state reconciliation hourly per active campaign, and writes
  to timelines and `consents`.
- **Opt-out push:** sends new text opt-outs and suppressions to Part 3 within seconds,
  retrying, and alerting when it can't deliver within 5 minutes.

## Changes from the first draft

- **Versioned Spoke paths (2026-11-02):** Spoke's endpoints moved to
  `/integrations/shore/v1/...`, matching Shore's `/api/spoke/v1/...`, before anything was
  deployed.
- **Shore keeps the key, encrypted, not a hash (2026-11-02):** HMAC needs the secret on both
  sides.
- **Everything in the contact loader; no service manager.** Spoke's `onOptOut` hook isn't
  given the cell number, and for STOP replies the contact is usually not loaded, so the
  service manager couldn't reliably report opt-outs without a core change. Opt-outs now
  reach Shore through `GET /opt-outs`.
- **Interactions through an API, not a database login.** Messages, survey answers and tags
  were going to be read straight from Spoke's database; they now come from read endpoints
  the extension owns. Direct reads remain a documented fallback.
- **Raw body via a vendor content type.** Spoke parses JSON globally before loader routes,
  so signature checks over the body need a content type the global parser ignores.
- **Shore's opt-outs survive other service managers.** The save is wrapped and a real
  contact is passed where one exists, because `civicrm-donotsms` and others assume a
  contact.
- **`CONTACT_LOADERS` must be an environment variable**, not an organization setting.
- **Failure handling follows the `redash` loader**, which calls `failedContactLoad`; the
  CiviCRM loader doesn't.

## Decisions made

- **Signing (2026-11-01):** one shared HMAC key per Shore campaign, used in both directions.
  A Shore campaign maps to one Spoke organization, and the key is stored on that
  organization.
- **Text consent for loads (2026-11-01):** no opt-in required; this is peer-to-peer texting.
  A load excludes anyone opted out or suppressed, as Shore decides.
- **Custom fields (2026-11-01):** the v1 list in Part 1, including voting-location fields
  sent empty until Shore has the data.
- **Poll interval (2026-11-01):** Shore's setting, not part of Spoke's design. The
  endpoints are cheap, safe to repeat and independent of how often they're called; the
  15-second settle window and page limits don't depend on it. Start at 30–60 seconds.

- **Message content (2026-11-01):** Shore receives each message's full text, direction
  (`isFromContact`), send status and time, as in `GET /messages`.
