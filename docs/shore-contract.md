# Spoke ↔ Shore integration contract, v1

The exact interface between Spoke's `shore` extension and Shore. Both sides build to this
document. [shore-contract.openapi.json](shore-contract.openapi.json) is the same contract in
machine-readable form (OpenAPI 3.1). Why it's shaped this way is in
[spoke-plugins.md](spoke-plugins.md); advice for building Shore's side is in
[shore-implementation-guide.md](shore-implementation-guide.md).

Status: v1, 2026-11-02. Spoke's side is built and tested against this document: Spoke's
tests check every response its endpoints give, every request it makes to Shore, and every
example and test vector below, against this contract.

The words **must**, **must not**, **should** and **may** are used as in RFC 2119.

## Contents

1. [Overview](#1-overview)
2. [Conventions](#2-conventions)
3. [Signing](#3-signing)
4. [Endpoints Shore implements](#4-endpoints-shore-implements-spoke-calls)
5. [Endpoints Spoke implements](#5-endpoints-spoke-implements-shore-calls)
6. [Error codes](#6-error-codes)
7. [Versioning and changes](#7-versioning-and-changes)
8. [Signing test vectors](#8-signing-test-vectors)

## 1. Overview

| Direction | What | Who calls |
|---|---|---|
| Lists into Spoke | Segment list, start a load, page through it | Spoke calls Shore |
| Opt-outs into Spoke | Post numbers to opt out | Shore calls Spoke |
| Interactions into Shore | Messages, survey answers, tags, opt-outs, campaigns, contact state | Shore polls Spoke |

There is no push from Spoke to Shore: Shore polls (section 5.3).

**Pairing.** One Shore campaign is paired with one Spoke organization. Both sides hold the
same secret key for the pair:

| | Spoke side | Shore side |
|---|---|---|
| Base URL | `SHORE_URL`, e.g. `https://app.shore.vote` | Spoke's base URL, e.g. `https://spoke.example.org` |
| Identifier | `SHORE_CAMPAIGN`, Shore's campaign slug | Spoke organization ID (an integer) |
| Key | `SHORE_INTEGRATION_KEY` | The "Spoke extension" key |

**Base paths.**

- Shore serves: `{SHORE_URL}/api/spoke/v1/{campaign}`
- Spoke serves: `{SPOKE_BASE_URL}/integrations/shore/v1/{organizationId}`

## 2. Conventions

- **Transport.** HTTPS only. (`http://localhost` is allowed for `SHORE_URL` in development.)
- **Redirects.** Spoke doesn't follow redirects. Shore's endpoints **must** answer at the
  exact URL, not with 301, 302, 307 or 308.
- **JSON.** UTF-8. Responses use `Content-Type: application/json`.
- **Request bodies.**
  - Spoke → Shore: `Content-Type: application/json`.
  - Shore → Spoke: `Content-Type: application/vnd.shore+json`. Spoke answers 415 to anything
    else (this is what lets Spoke check the signature over the exact bytes).
- **Unknown fields.** Receivers **must** ignore response and request fields they don't know.
  New optional fields may be added within v1 (section 7).
- **Times.** ISO 8601 in UTC with milliseconds, e.g. `2026-11-01T14:05:00.000Z`.
- **Phone numbers.** E.164, e.g. `+15555550123`. (Examples use `555-01xx` numbers, which
  are reserved as fictional and which Spoke rejects as invalid. Use other numbers in tests.)
- **IDs.** Spoke's IDs are integers. Shore's IDs (segment, load, person) are opaque strings
  of at most 128 characters; segment and load IDs **should** be URL-safe
  (`[A-Za-z0-9_-]`), and Spoke URL-encodes them either way. Cursors are opaque strings.
- **Errors.** Error responses carry `{ "error": "<code>" }` (section 6).
- **Timeouts.** Spoke waits `SHORE_TIMEOUT_MS` (default 10 seconds) for each request to
  Shore, including the response body.
- **No personal data in URLs.** Neither side puts phone numbers, names or message text in a
  path or query string.

## 3. Signing

Every request in both directions **must** carry two headers:

| Header | Value |
|---|---|
| `X-Shore-Timestamp` | Current Unix time in whole seconds, e.g. `1762000000` |
| `X-Shore-Signature` | Lowercase hex HMAC-SHA256 of the string below, keyed with the shared key (the key's UTF-8 bytes) |

The signed string is four parts joined with `.`:

```
{timestamp}.{METHOD}.{pathWithQuery}.{rawBody}
```

- `timestamp`: exactly the header's value.
- `METHOD`: uppercase, e.g. `GET`, `POST`.
- `pathWithQuery`: the request target exactly as sent on the wire: path plus `?` and query
  string if there is one, already percent-encoded, no scheme or host. It includes any path
  prefix in `SHORE_URL`. Example: `/api/spoke/v1/gotv-2026/loads/load-1/contacts?cursor=c2&limit=1000`.
- `rawBody`: the exact bytes of the body; empty for GET.

The receiver **must**:

1. Read the raw request target and raw body bytes *before* any parsing or normalizing (don't
   rebuild the path from a router's parsed parameters, re-encode the query, or re-serialize
   JSON).
2. Reject with 401 if either header is missing, the timestamp isn't an integer, or it's more
   than **300 seconds** from the receiver's clock in either direction.
3. Compute the HMAC and compare in **constant time**; reject with 401 on mismatch.
4. Only then parse the body.

There's no nonce or replay store: every write is idempotent and every read is safe to repeat,
so a replay within 300 seconds does nothing new. Section 8 has test vectors.

**Order of checks on Spoke's side** (Shore can rely on these statuses):

| Check | Status on failure |
|---|---|
| POST content type is `application/vnd.shore+json` | 415 |
| Organization exists and has a valid Shore configuration | 404 |
| Signature valid | 401 |
| Body or query valid | 400 |

## 4. Endpoints Shore implements (Spoke calls)

Base: `{SHORE_URL}/api/spoke/v1/{campaign}`. Every request is signed (section 3). Shore
**must** reject a request whose signature doesn't verify with the key for `{campaign}`.

How Spoke treats Shore's responses:

| Shore's response | What Spoke does |
|---|---|
| 2xx with a valid body | Proceeds |
| Network error, timeout, or 5xx | `shore_unreachable` |
| 404 on start load | `segment_not_found` |
| 404 or 410 on a contacts page | `load_expired` |
| Any other non-2xx (e.g. 401, 403, 400) | `shore_rejected` |
| 2xx but not JSON, or missing required fields | `shore_bad_response` |

### 4.1 `GET /segments`

The campaign's segments, for Spoke's segment picker. Spoke caches the result for
`SHORE_CACHE_SECONDS` (default 60).

**200:**

<!-- example: SegmentList -->
```json
{
  "segments": [
    {
      "id": "seg-1",
      "name": "Pledged to vote, has a phone",
      "description": "Pledge card signers with a mobile number",
      "updatedAt": "2026-11-01T14:00:00.000Z",
      "textableCount": 412
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Opaque segment ID. |
| `name` | yes | Shown to Spoke admins. |
| `description` | no | String or null. |
| `updatedAt` | no | When the segment's definition last changed. |
| `textableCount` | no | How many contacts a load would return right now; integer or null. |

Shore **must** answer within the timeout, so counts **should** be cached or cheap.

### 4.2 `POST /segments/{segmentId}/loads`

Starts a load. Shore resolves the segment, keeps only people it may text, and saves the
result as a **snapshot** that the pages in 4.3 read from.

**Request:**

<!-- example: StartLoadRequest -->
```json
{ "spokeCampaignId": 12, "spokeCampaignTitle": "GOTV week 1", "spokeJobId": 345 }
```

**200:**

<!-- example: StartLoadResponse -->
```json
{ "loadId": "load-1", "count": 398 }
```

- `loadId` is required. `count` is the snapshot size (integer or null); Spoke doesn't depend
  on it.
- **Idempotent:** the same `spokeJobId` for the same campaign pair **must** return the same
  `loadId` (Spoke may retry). Spoke job IDs are unique within one Spoke, not across Spokes.
- **Who's in a load (Shore's rules):** a mobile number not marked bad or wrong; no text
  opt-out on that number; no text suppression on the person; never a known landline. Each
  person at most once, under Shore's "best number to text". Opt-ins are **not** required
  (peer-to-peer texting).
- Respond within the timeout. If building the snapshot can take longer, return the
  `loadId` at once and finish it before serving the first page (4.3 has its own timeout).
- **404** if the segment doesn't exist in this campaign.

### 4.3 `GET /loads/{loadId}/contacts?cursor={cursor}&limit={limit}`

One page of the snapshot. Spoke omits `cursor` on the first page and passes back
`nextCursor` until it's null. `limit` is always sent, at most 5000 (Spoke asks for 1000 or
fewer).

**200:**

<!-- example: ContactPage -->
```json
{
  "contacts": [
    {
      "externalId": "7f3c2a10-9b1e-4d4a-8c55-1e2f3a4b5c6d",
      "firstName": "Testy",
      "lastName": "Example",
      "cell": "+15555550123",
      "zip": "22031",
      "customFields": {
        "preferredName": "Testy",
        "city": "Fairfax",
        "pollingPlaceName": "",
        "pollingPlaceAddress": "",
        "precinct": ""
      }
    }
  ],
  "nextCursor": "c2"
}
```

| Field | Required | Notes |
|---|---|---|
| `externalId` | yes | Shore's person ID. Spoke stores it and returns it in every read feed. |
| `firstName`, `lastName` | yes | String or null (null is stored as empty). |
| `cell` | yes | E.164. Spoke re-normalizes it and **skips** contacts whose number doesn't parse. |
| `zip` | yes | Five digits or null. Spoke uses it for the contact's time zone, which governs texting hours. |
| `customFields` | yes | Object; see below. |

**Rules:**

- Return at most `limit` contacts. Pages may be shorter than `limit` before the last.
- Order **must** be stable across retries of the same cursor.
- A person **should** appear once per load. If a cell repeats, Spoke keeps the last one.
- Pages **must** stay readable for at least **1 hour** after the load started. After that,
  404 or 410.
- **`customFields`:** every contact in every load **must** carry the same keys, because Spoke
  learns a campaign's fields from its first contact only. Use `""` for an unknown value.
  Values **should** be strings (numbers and booleans are converted; null becomes `""`).
  The v1 keys are:

  | Key | Meaning |
  |---|---|
  | `preferredName` | What the person likes to be called; fall back to first name. |
  | `city` | City of the person's address. |
  | `pollingPlaceName` | Election-day voting location; `""` until Shore has it. |
  | `pollingPlaceAddress` | Its street address; `""` until Shore has it. |
  | `precinct` | Precinct name or code; `""` until Shore has it. |

  Shore may add keys (section 7). Spoke's built-in fields are `firstName`, `lastName`,
  `zip`, `cell` and `external_id`, so custom keys **must not** use those names.

## 5. Endpoints Spoke implements (Shore calls)

Base: `{SPOKE_BASE_URL}/integrations/shore/v1/{organizationId}`. Every request is signed
(section 3). These endpoints ignore Spoke's sign-in and cookies.

### 5.1 `POST /opt-outs`

Opts numbers out in Spoke, through the same code path as a STOP reply. Takes effect in
Spoke's cache and database before the response is sent.

**Request** (`Content-Type: application/vnd.shore+json`, at most 256 KB):

<!-- example: OptOutRequest -->
```json
{
  "cells": ["+15555550123", "+15555550124"],
  "reason": "manual",
  "shoreRequestId": "7d6f0d8e-1111-4c2b-9a51-000000000001"
}
```

| Field | Required | Notes |
|---|---|---|
| `cells` | yes | 1 to 500 numbers. E.164 recommended; Spoke normalizes and counts unparseable ones as `invalid`. |
| `reason` | no | Default `optout`. Letters, digits and `_ . : -`, 1–64 characters. Stored in Spoke as `shore:{reason}`. |
| `shoreRequestId` | no | Up to 64 characters; appears in Spoke's logs. |

**Response:**

<!-- example: OptOutResponse -->
```json
{ "optedOut": 1, "alreadyOptedOut": 1, "invalid": 0, "failed": 0 }
```

| Status | Meaning | Shore should |
|---|---|---|
| 200 | Every cell handled (`failed` is 0). | Mark delivered. |
| 500 with this body, `failed` > 0 | Some cells couldn't be saved. The others are saved. | Retry the whole request. |
| 500 `internal_error` | Spoke failed. | Retry. |
| 400 | Bad request (section 6). | Don't retry; alert, it's a bug. |
| 401 | Signature rejected. | Alert (key or clock); keep retrying slowly. |
| 404 | Organization unknown or not configured. | Alert (configuration); keep retrying slowly. |
| 415 | Wrong content type. | Don't retry; it's a bug. |

**Semantics:**

- **Idempotent.** A number already opted out counts as `alreadyOptedOut`, and nothing is
  written. Retrying a whole request is always safe.
- A number repeated in one request counts once as `optedOut` and then as `alreadyOptedOut`.
- The opt-out applies to the whole organization (or the whole Spoke, if Spoke runs with
  `OPTOUTS_SHARE_ALL_ORGS`). Contacts with that number in active campaigns are marked opted
  out; numbers in no campaign are still recorded and will be left out of future loads.
- Spoke also tells its other extensions about the opt-out. Their failures don't fail the
  opt-out.
- There's no way to undo an opt-out through this contract.
- These opt-outs appear in `GET /opt-outs` (5.3.4) with `reasonCode` starting `shore:`.

### 5.2 Paging the read feeds

`GET /messages`, `/question-responses`, `/tags` and `/opt-outs` are **feeds**:

| Parameter | Default | Notes |
|---|---|---|
| `afterId` | 0 | Return rows with `id` greater than this. Non-negative integer. |
| `limit` | 500 | 1 or more; values above 2000 are treated as 2000. |

Response: `{ "<items>": [ ... ], "nextAfterId": <integer> }`. Rows are in ascending `id`,
limited to this organization.

**Settle window.** Rows created less than `SHORE_SETTLE_SECONDS` (default 15) ago are held
back, and a page stops at the first such row. So:

- A page shorter than `limit`, or empty, means "caught up for now". Poll again later.
- A full page means more rows may be ready now; fetch the next page at once.
- `nextAfterId` is the last returned row's `id`, or your `afterId` unchanged if the page is
  empty. Store it and pass it as the next `afterId`.

**Rows can change after you've read them.** A message's `sendStatus` changes as it's
delivered. Re-read a trailing window of each feed periodically and upsert by `id`
([guide](shore-implementation-guide.md#polling) has a recipe). IDs never change and are never
reused.

**Rows can disappear.** Spoke deletes survey answers when they're changed or cleared, and
tag rows when tags are removed. Feeds don't report deletions; use contact state (5.3.6).

### 5.3 Read endpoints

#### 5.3.1 `GET /messages`

<!-- example: MessagesPage -->
```json
{
  "messages": [
    {
      "id": 1001,
      "campaignId": 12,
      "campaignContactId": 9876,
      "externalId": "7f3c2a10-9b1e-4d4a-8c55-1e2f3a4b5c6d",
      "contactNumber": "+15555550123",
      "isFromContact": false,
      "text": "Hi Testy, it's Sam with the campaign. Can we count on your vote?",
      "sendStatus": "DELIVERED",
      "userId": 7,
      "createdAt": "2026-11-01T14:05:00.000Z"
    }
  ],
  "nextAfterId": 1001
}
```

| Field | Notes |
|---|---|
| `externalId` | The contact's `externalId` from the load, or null for contacts Shore didn't load. |
| `isFromContact` | `true`: the person wrote it (inbound). `false`: a texter sent it. |
| `sendStatus` | `QUEUED`, `SENDING`, `SENT`, `DELIVERED`, `ERROR`, `PAUSED` or `NOT_ATTEMPTED`. Inbound messages are typically `DELIVERED`. |
| `userId` | The Spoke user who sent it; null for inbound. |

#### 5.3.2 `GET /question-responses`

Survey (canvass) answers.

<!-- example: QuestionResponsesPage -->
```json
{
  "questionResponses": [
    {
      "id": 501,
      "campaignId": 12,
      "campaignContactId": 9876,
      "externalId": "7f3c2a10-9b1e-4d4a-8c55-1e2f3a4b5c6d",
      "interactionStepId": 31,
      "value": "Yes",
      "createdAt": "2026-11-01T14:07:00.000Z"
    }
  ],
  "nextAfterId": 501
}
```

- `interactionStepId` is the step whose **question** was answered; `value` is the chosen
  answer, which is the `answerOption` of one of that step's child steps (5.3.5).
- A changed answer arrives as a **new row** (new `id`) for the same contact and step. The
  newest row per (`campaignContactId`, `interactionStepId`) is current.
- A cleared answer doesn't appear; see contact state.

#### 5.3.3 `GET /tags`

<!-- example: TagsPage -->
```json
{
  "tags": [
    {
      "id": 77,
      "campaignId": 12,
      "campaignContactId": 9876,
      "externalId": "7f3c2a10-9b1e-4d4a-8c55-1e2f3a4b5c6d",
      "tagId": 4,
      "tagName": "Needs a ride",
      "value": null,
      "createdAt": "2026-11-01T14:08:00.000Z"
    }
  ],
  "nextAfterId": 77
}
```

Removed tags don't appear; see contact state.

#### 5.3.4 `GET /opt-outs`

Every opt-out recorded in Spoke for the organization, whatever recorded it: STOP replies,
texters, Shore.

<!-- example: OptOutsPage -->
```json
{
  "optOuts": [
    {
      "id": 88,
      "cell": "+15555550123",
      "reasonCode": "stop",
      "assignmentId": 3,
      "createdAt": "2026-11-01T14:09:00.000Z"
    }
  ],
  "nextAfterId": 88
}
```

- `reasonCode` is free text from Spoke (often empty). It starts with `shore:` when Shore
  sent the opt-out.
- With `OPTOUTS_SHARE_ALL_ORGS` on in Spoke, this includes opt-outs from every organization
  in that Spoke, since they all apply.

#### 5.3.5 `GET /campaigns`

All the organization's campaigns with their survey questions. Paged like a feed
(`afterId`, `limit`, `nextAfterId`) but **without** a settle window. Campaigns change in
place, so re-read the whole list on each poll.

<!-- example: CampaignsPage -->
```json
{
  "campaigns": [
    {
      "id": 12,
      "title": "GOTV week 1",
      "isStarted": true,
      "isArchived": false,
      "createdAt": "2026-10-28T09:00:00.000Z",
      "shoreLoad": { "segmentId": "seg-1", "segmentName": "Pledged", "loadId": "load-1" },
      "interactionSteps": [
        { "id": 30, "parentInteractionId": null, "answerOption": "", "question": "Can we count on your vote?", "isDeleted": false },
        { "id": 31, "parentInteractionId": 30, "answerOption": "Yes", "question": "Do you have a plan to vote?", "isDeleted": false },
        { "id": 32, "parentInteractionId": 30, "answerOption": "No", "question": "", "isDeleted": false }
      ]
    }
  ],
  "nextAfterId": 12
}
```

- `shoreLoad` is the campaign's last **successful** Shore load, or null (e.g. contacts
  uploaded as a CSV).
- **Reading the survey tree.** Steps form a tree through `parentInteractionId`. A step's
  `question` is what the texter asks; each child's `answerOption` is a possible answer to
  it. A question response with `interactionStepId: 30` and `value: "Yes"` means "answered
  *Can we count on your vote?* with *Yes*", which leads to step 31.
- Steps can be edited or deleted (`isDeleted`) after answers exist. Keep the question and
  answer text as it was when you saw the answer.

#### 5.3.6 `GET /campaigns/{campaignId}/contact-state?afterContactId={id}&limit={n}`

The **current** state of every contact in one campaign. Authoritative where it differs from
the feeds. Paged by contact ID with `afterContactId` and `limit` (same limits as 5.2); no
settle window.

<!-- example: ContactStatePage -->
```json
{
  "contacts": [
    {
      "campaignContactId": 9876,
      "externalId": "7f3c2a10-9b1e-4d4a-8c55-1e2f3a4b5c6d",
      "messageStatus": "convo",
      "isOptedOut": false,
      "questionResponses": [{ "interactionStepId": 30, "value": "Yes" }],
      "tags": [{ "tagId": 4, "tagName": "Needs a ride", "value": null }]
    }
  ],
  "nextAfterContactId": 9876
}
```

- `messageStatus` is Spoke's status for the conversation: `needsMessage` (not texted yet),
  `needsResponse` (they replied, awaiting the texter), `convo` (in conversation), `messaged`
  (texted, no reply), `closed` (skipped or ended), or briefly `UPDATING` while Spoke
  changes it.
- **404** `campaign_not_found` if the campaign isn't in this organization.

## 6. Error codes

**Spoke's responses** carry these in `{ "error": ... }`:

| Status | `error` | Endpoint |
|---|---|---|
| 400 | `invalid_json`, `cells_required`, `cells_count`, `invalid_reason` | POST /opt-outs |
| 400 | `invalid_paging`, `invalid_campaign` | read endpoints |
| 401 | `unauthorized` | all |
| 404 | `not_found` | all (unknown organization, Shore not configured for it, or unknown path) |
| 404 | `campaign_not_found` | contact-state |
| 415 | `unsupported_media_type` | POST |
| 500 | `internal_error` | all |

**Shore's responses:** Spoke reads only the status (section 4). Shore **should** still send
`{ "error": "<code>" }` so both sides' logs agree.

**Codes Spoke shows admins** for a failed load: `not_configured`, `segment_required`,
`segment_not_found`, `shore_unreachable`, `shore_rejected`, `shore_bad_response`,
`load_expired`, `load_error`.

## 7. Versioning and changes

- The `v1` in both base paths is this contract's major version.
- **Allowed within v1** (no coordination needed): adding optional response fields, adding new
  endpoints, adding `customFields` keys at the start of a new load, adding error codes for
  new situations, raising limits.
- **Needs v2** (both sides change together, old version kept until both have moved):
  removing or renaming fields, changing a field's type or meaning, changing signing, lowering
  limits, making an optional request field required.
- Changes to this document and to `shore-contract.openapi.json` go in the same commit, and
  Spoke's tests must pass.

## 8. Signing test vectors

Use these to check a signing implementation. Key (UTF-8):
`shore-test-vector-key-0123456789abcdef`. Bodies are the exact strings shown, with no
trailing newline.

<!-- signing-vectors -->
```json
[
  {
    "timestamp": "1762000000",
    "method": "GET",
    "pathWithQuery": "/integrations/shore/v1/1/messages?afterId=0&limit=500",
    "body": "",
    "signature": "3c5ce97d0df535160767a8d29ae733ecccb95b0aa28fd2e2e8ae54c87abbb21f"
  },
  {
    "timestamp": "1762000000",
    "method": "POST",
    "pathWithQuery": "/integrations/shore/v1/1/opt-outs",
    "body": "{\"cells\":[\"+15155559100\"],\"reason\":\"manual\",\"shoreRequestId\":\"7d6f0d8e-1111-4c2b-9a51-000000000001\"}",
    "signature": "b510d2b69121c5e73bcb55fef6016bd81930124435c965ab6d88f8f6a0b70ff9"
  },
  {
    "timestamp": "1762000000",
    "method": "POST",
    "pathWithQuery": "/api/spoke/v1/gotv-2026/segments/seg-1/loads",
    "body": "{\"spokeCampaignId\":12,\"spokeCampaignTitle\":\"GOTV week 1\",\"spokeJobId\":345}",
    "signature": "9e2c22641982ebb32db0b391be8747419732b2ec5216f26b3c30a30929362fa9"
  },
  {
    "timestamp": "1762000000",
    "method": "GET",
    "pathWithQuery": "/api/spoke/v1/gotv-2026/loads/load-1/contacts?cursor=c2&limit=1000",
    "body": "",
    "signature": "3b580342c9de629e311d13b8f58016dbacb123ec7491579c623d2ad0e27898c4"
  }
]
```

For the first vector, the signed string is:

```
1762000000.GET./integrations/shore/v1/1/messages?afterId=0&limit=500.
```
