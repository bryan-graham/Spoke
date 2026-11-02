# Building Shore's side of the Spoke integration

For the team building Shore's half. The interface is fixed in
[shore-contract.md](shore-contract.md) (and
[shore-contract.openapi.json](shore-contract.openapi.json)); this guide covers what to build
around it, what's required, and what we suggest. Spoke's half is built and tested.

**Required** items are needed for the integration to be correct or safe. **Suggested** items
are our recommendation; deviate if you have a reason, and tell the Spoke side if it affects
them.

## 1. What to build

| # | Piece | Done when |
|---|---|---|
| 1 | Key settings | An admin can create, view once, and replace a key per campaign, and enter the Spoke URL and organization ID. |
| 2 | Signing | Shore signs its requests and checks Spoke's, and passes the test vectors in contract §8. |
| 3 | `GET /segments` | Spoke's picker lists the campaign's segments with counts. |
| 4 | `POST /segments/{id}/loads` + `GET /loads/{id}/contacts` | A Spoke admin can load a segment; only textable people arrive, each once. |
| 5 | Opt-out push | A text opt-out or suppression recorded in Shore is opted out in Spoke within seconds, and within 5 minutes even across short outages, with an alert otherwise. |
| 6 | Poller | Messages, survey answers, tags and opt-outs from Spoke reach Shore within about a minute, and current state is reconciled hourly. |
| 7 | Mapping | Spoke activity shows on each person's timeline, and Spoke opt-outs land in `consents`. |
| 8 | Monitoring | The alerts in §10 exist. |

Build order we suggest: 1 → 2 → 3–4 (lets campaigns load lists) → 5 (compliance) → 6–7 → 8.
Items 5 and 8 must be live before the first real campaign texts.

## 2. Keys

**Required:**

- One key per (Shore campaign, Spoke organization) pair.
- At least 32 characters. Suggested: 32 random bytes from a CSPRNG, base64url-encoded (43
  characters).
- **Store the key itself, encrypted** (KMS or a secret manager), **not a hash**. Shore needs
  the plaintext to sign its requests to Spoke and to check Spoke's. (An earlier draft said
  "store only a hash"; that can't work with HMAC.)
- Show it once at creation, for the admin to paste into Spoke's configuration
  (`SHORE_INTEGRATION_KEY`). Never show it again or log it.
- Don't reuse the key elsewhere (for example, not as `TOKEN_AUTH_SHARED_SECRET` for sign-in).

**Rotation (v1 has one key at a time):**

1. Create the new key in Shore, but keep using the old one.
2. Set the new key in Spoke.
3. Switch Shore to the new key.

Between steps 2 and 3, requests fail with 401 in both directions. That's safe: opt-out pushes
retry (§5), polls resume from their cursors, and a contact load in progress fails and can be
re-run. Keep the gap short. A future version could let both sides accept two keys during
rotation (§12).

## 3. Signing

Follow contract §3 exactly. Things that commonly go wrong:

- **Raw body.** Verify against the exact bytes received, before your framework parses JSON.
  Re-serializing parsed JSON changes whitespace and key order and breaks the signature.
- **Raw request target.** Sign and verify the path and query exactly as sent on the wire,
  still percent-encoded. Don't rebuild it from parsed route parameters or a URL object that
  normalizes encoding.
- **Path prefixes.** Spoke signs the full path, including any prefix in `SHORE_URL`. If a
  proxy or load balancer strips or adds a prefix before Shore's app sees the request,
  verify against the path the client sent (for example from a forwarded header) or
  configure `SHORE_URL` to match what the app sees.
- **Clocks.** ±300 seconds. Run NTP (managed platforms already do).
- **Constant-time comparison** (for example `crypto.timingSafeEqual`), after checking the
  lengths match.
- **Content type.** Shore's POST to Spoke must use `Content-Type: application/vnd.shore+json`,
  or Spoke answers 415.
- **Redirects.** Spoke won't follow them. Serve the endpoints at their exact URLs.

**Test with** the vectors in contract §8, plus: a wrong key, a changed body byte, a changed
query parameter, and timestamps 299 and 301 seconds off.

## 4. Serving loads

### Segment list (`GET /segments`)

- Answer within Spoke's 10-second timeout. **Suggested:** cache `textableCount` per segment
  for a minute or two, or compute it from the same query as a load with a `count(*)`.
- Only this campaign's segments, under row-level security for the campaign (resolve the
  campaign from the URL slug *and* the key, and refuse if they don't match).

### Starting a load

**Required:**

- **Who's included** is Shore's decision (contract §4.2): mobile numbers only; no text
  opt-out on the number; no text suppression on the person; never a known landline; not
  marked bad or wrong; one row per person under the best number to text. **No opt-in
  required.**
- **Snapshot.** Save the resulting list (person ID, chosen number, and the fields you'll
  send) in a load table at start time. Pages read the snapshot, so they stay consistent
  while Shore's data changes. Check consent at load start; Spoke filters again against its
  own opt-outs when the load completes.
- **Idempotency.** Key loads on (campaign pair, `spokeJobId`). A repeat returns the same
  `loadId` and doesn't create a second snapshot or audit entry.
- **Audit.** Record who/what/when: segment, Spoke campaign ID and title, count.
- **Timeout.** Respond within 10 seconds. For large segments, insert the snapshot with one
  `INSERT … SELECT`; if it can still be slow, return the `loadId` immediately and build the
  snapshot in the background, making the first page wait for it (also within 10 seconds) or
  fail with 5xx so Spoke reports `shore_unreachable` and the admin retries.

**Suggested:**

- Snapshot table: `(load_id, seq, person_id, cell, first_name, last_name, zip,
  custom_fields)` with `seq` 1..n. Use `seq` as the cursor (`nextCursor` = last `seq`
  returned, as a string). It's stable and cheap.
- Delete snapshots a day after creation; they hold personal data.
- Optionally note "Added to Spoke campaign *title*" on each person's timeline (a product
  decision for Shore).

### Contact pages

**Required:**

- Honor `limit` (Spoke asks for 1000 or fewer; allow up to 5000).
- Keep pages readable for at least an hour; then 410.
- `cell` in E.164; `zip` five digits or null.
- **`customFields` keys identical on every contact of every load**: `preferredName`, `city`,
  `pollingPlaceName`, `pollingPlaceAddress`, `precinct`, with `""` for unknowns. A key
  missing from the first contact is unusable in Spoke scripts for the whole campaign.
- `externalId` = Shore's person ID. It's how Spoke's activity is matched back to people.

## 5. Sending opt-outs to Spoke

This is the compliance-critical path. **Required:**

- **Trigger** on every new text opt-out (on a number) or text suppression (on a person) in
  the campaign, from any channel. For a suppression, send every mobile number the person
  has.
- **Outbox.** Write a pending row in the same transaction that records the opt-out, and
  deliver from the outbox. That way an opt-out can't be lost between Shore's database and
  Spoke.
- **Deliver immediately**, batching up to 500 numbers per request.
- **Retry** until 200. Suggested backoff: 2 s, 4 s, 8 s, … capped at 60 s, with jitter.
  Handle responses as in contract §5.1: 500 → retry; 401/404 → alert and keep retrying
  every few minutes (it's configuration and will be fixed); 400/415 → alert, stop (it's a
  bug).
- **Alert** if any opt-out isn't delivered within **5 minutes** of being recorded.
- `reason`: a short code such as `manual`, `email_reply`, `phone_call`, `suppression`. It
  shows in Spoke as `shore:<reason>`.
- Never send opt-outs for other campaigns' numbers, and never try to reverse one.

Until a push succeeds, Shore's next load still leaves the number out, so the risk is
limited to contacts already loaded into a running Spoke campaign. That's why the 5-minute
alert matters.

## 6. Polling Spoke

### The loop

For each feed (`messages`, `question-responses`, `tags`, `opt-outs`), per campaign pair:

```
cursor = stored cursor (0 at first)
loop:
  page = GET /{feed}?afterId={cursor}&limit=2000
  upsert page rows (by Spoke id)
  cursor = page.nextAfterId; store it (in the same transaction as the upserts)
  if page has fewer than 2000 rows: stop until the next poll
```

**Required:**

- Store cursors durably, in the same transaction as the rows, so a crash can't skip rows.
- **Upsert by (Spoke organization, Spoke id)**; never insert blindly. Rows are re-read.
- A short or empty page means "caught up for now" (contract §5.2). Don't treat it as an error.
- Poll every 30–60 seconds. One poller per campaign pair at a time (use a lock).

**Suggested:**

- **Trailing re-read** for message status. Every 10 minutes, re-read `messages` from the
  cursor you had about an hour ago up to the current one, and upsert. Keep a small table of
  (time, cursor) checkpoints per feed to know where "an hour ago" was. Do the same for
  `opt-outs` once a day as a safety net.
- **Backfill** a new pairing by starting cursors at 0. It pages through history at up to
  2000 rows per request.

### Campaigns

- Re-read `GET /campaigns` (all pages) every few minutes, and whenever a feed row mentions a
  `campaignId` you don't know.
- Store each interaction step's `question` and `answerOption` text as first seen, and
  update it, but keep the text an answer was given under (steps can be edited after answers
  exist).

### Contact-state reconciliation

- Hourly, for each campaign with `isStarted: true` and `isArchived: false`, page through
  `contact-state` and make Shore's current answers, tags and opt-out flag match. That's how
  cleared answers and removed tags reach Shore.
- Once more when a campaign becomes archived, then stop.

## 7. Mapping into Shore

### Matching people

1. If `externalId` is set and is a person in this campaign, that's the person.
2. Otherwise match `contactNumber` / `cell` against the campaign's phone records.
3. Otherwise keep the activity as unmatched, linked to the number, so it can be matched
   later. Don't create people from Spoke data automatically.

`externalId` can be something other than a Shore ID when a Spoke admin uploaded a CSV, so
check it before trusting it.

### Timelines (suggested)

| Spoke data | Timeline entry |
|---|---|
| Message, `isFromContact: false` | "Texted by *texter*": the text, status, time. |
| Message, `isFromContact: true` | "Replied by text": the text, time. |
| Question response | "*question*: *answer*" (from the campaign's steps). Newest row per contact and step is current. |
| Tag | "Tagged *tagName*". |

Group by Spoke campaign so a conversation reads as one thread.

### Opt-outs into `consents`

**Required:** for every row from `GET /opt-outs`, record a text opt-out on that number in
`consents` (source `spoke`), even when the number matches no person.

- Skip rows whose `reasonCode` starts with `shore:`; Shore sent them.
- Keep the Spoke `reasonCode` (often empty, `stop`, or a texter's choice).
- These arrive within about a minute (one poll plus the 15-second settle window). If Shore
  must stop emails or calls faster than that, poll `opt-outs` more often than the other feeds
  (every 15 seconds is fine).

## 8. Data protection

**Required:**

- Message text, numbers and names are personal data. Don't log them; log Spoke IDs, counts,
  Shore request IDs and error codes (Spoke does the same).
- Everything Shore reads or serves for the integration runs under the campaign's row-level
  security.
- Load snapshots are deleted after a day (§4).

**Suggested:** decide a retention period for Spoke message text in Shore, and apply the same
rules to it as to other conversation records.

## 9. Configuration Shore needs per pairing

| Setting | Example |
|---|---|
| Spoke base URL | `https://spoke.example.org` |
| Spoke organization ID | `1` |
| Key | (created in Shore, stored encrypted) |
| Enabled | true/false: stops pushes and polls without deleting cursors |

And what the Spoke admin needs from Shore: `SHORE_URL`, `SHORE_CAMPAIGN` (the slug) and the
key. See [HOWTO-integrate-with-shore.md](HOWTO-integrate-with-shore.md).

## 10. Monitoring

Alert on:

| Condition | Why |
|---|---|
| Any opt-out undelivered to Spoke after 5 minutes | Compliance rule. |
| Any 401 from Spoke, or Spoke requests failing Shore's signature check | Key mismatch or clock skew. |
| Any 404 from Spoke | The pairing is misconfigured. |
| A feed's cursor not advancing for 15 minutes while Spoke is texting | Poller stuck. |
| Poll errors for more than 5 minutes | Spoke down or unreachable. |

Useful dashboards: opt-out push latency (record → 200), poll lag per feed, load counts and
durations.

## 11. Testing

**Required before go-live:**

- Signing passes the contract §8 vectors and the negative cases in §3.
- Validate Shore's responses in its own tests against `shore-contract.openapi.json` (any
  OpenAPI 3.1 or JSON Schema 2020-12 validator). Spoke's tests already hold Spoke to it.
- An end-to-end run against a real Spoke (local or staging) with
  `CONTACT_LOADERS=shore,csv-upload`:
  1. Load a segment of test people with fake numbers. Check counts and custom fields.
  2. Text one, reply STOP. Check the opt-out reaches Shore's `consents` and is skipped on
     the next load.
  3. Record an opt-out in Shore for a loaded contact. Check Spoke marks the contact opted
     out within seconds and won't send to it.
  4. Answer survey questions, change one, clear one. Check timelines after a poll and
     after reconciliation.
  5. Stop Spoke for 10 minutes while recording an opt-out in Shore. Check the 5-minute alert
     fires and the opt-out arrives when Spoke is back.

Running Spoke locally: see Spoke's
[HOWTO_DEVELOPMENT_LOCAL_SETUP.md](HOWTO_DEVELOPMENT_LOCAL_SETUP.md), then set the variables
in [HOWTO-integrate-with-shore.md](HOWTO-integrate-with-shore.md). Use real-format test
numbers: Spoke rejects `555-01xx` numbers as fictional.

## 12. Suggestions for later

Not needed for v1; raise them with the Spoke side if they become needed.

- **Two-key rotation:** Spoke accepts `SHORE_INTEGRATION_KEY` or `SHORE_INTEGRATION_KEY_NEXT`,
  so keys rotate with no 401 gap.
- **Push from Spoke:** a webhook on new messages and opt-outs to cut latency below the poll
  interval. Polling would remain the source of truth.
- **Several Shore campaigns per Spoke:** the paths and keys already allow it; the read feeds
  would need an ID window per request to stay fast (see the design's known limits).
- **START replies:** Spoke doesn't process START. If Shore ever needs to know someone opted
  back in, that's new work on both sides.
