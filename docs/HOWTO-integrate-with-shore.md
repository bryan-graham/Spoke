# How to integrate with Shore

The `shore` contact loader connects a Spoke organization to a campaign in Shore. Once it's
set up:

- Campaign admins can pick a **Shore segment** as a campaign's contacts. Shore sends only
  the people it allows to be texted.
- Shore can **send opt-outs** it receives through other channels (email, phone calls,
  forms) to Spoke. They take effect within a second.
- Shore can **read** messages, survey answers, tags and opt-outs from Spoke.

The design, including every endpoint's request and response, is in
[spoke-plugins.md](spoke-plugins.md).

## Before you start

- A Shore admin creates a **Spoke extension key** for the campaign in Shore. Shore shows the
  key once; copy it somewhere safe.
- Note the campaign's **slug** in Shore and Shore's **URL** (for example
  `https://app.shore.vote`).
- Spoke should run with Redis (`REDIS_URL`). The extension works without it, but Spoke turns
  off some protections and runs slower.
- Both servers' clocks must be correct to within 5 minutes, because every request is signed
  with a timestamp. Most hosts (Heroku, Cloud Run, AWS) keep clocks in sync already;
  otherwise run NTP.

## 1. Enable the loader

Add `shore` to the `CONTACT_LOADERS` **environment variable** and restart Spoke:

```bash
CONTACT_LOADERS=shore,csv-upload
```

This one must be an environment variable. Spoke reads it once at startup, both to offer the
loader and to mount the endpoints Shore calls; setting it in an organization's features has
no effect.

## 2. Configure the organization

Set these either as environment variables (for a Spoke with one organization) or in the
organization's `features` JSON (which takes precedence):

| Key | Required | Example | Meaning |
|---|---|---|---|
| `SHORE_URL` | yes | `https://app.shore.vote` | Shore's address. Must be HTTPS (plain HTTP is allowed only for `localhost`). |
| `SHORE_CAMPAIGN` | yes | `gotv-2026` | The campaign's slug in Shore. Letters, digits, `-` and `_`. |
| `SHORE_INTEGRATION_KEY` | yes | (from Shore) | The Spoke extension key. At least 32 characters. Keep it secret. |
| `SHORE_CACHE_SECONDS` | no | `60` | How long the segment list is cached in the campaign editor. |
| `SHORE_TIMEOUT_MS` | no | `10000` | Timeout for each request to Shore. |
| `SHORE_SETTLE_SECONDS` | no | `15` | How long new rows are held back from Shore's read feeds. Leave the default. |

The loader only appears in the campaign editor, and the endpoints only answer, when all
three required keys are set and valid.

## 3. Tell Shore where Spoke is

In Shore's Spoke settings, enter:

- Spoke's base URL (for example `https://spoke.example.org`)
- the Spoke **organization ID** (the number in Spoke admin URLs: `/admin/<id>/...`)

Shore then calls:

| Endpoint | Purpose |
|---|---|
| `POST /integrations/shore/<id>/opt-outs` | Send opt-outs to Spoke |
| `GET /integrations/shore/<id>/messages` | Messages sent and received |
| `GET /integrations/shore/<id>/question-responses` | Survey answers |
| `GET /integrations/shore/<id>/tags` | Tags on contacts |
| `GET /integrations/shore/<id>/opt-outs` | Opt-outs recorded in Spoke |
| `GET /integrations/shore/<id>/campaigns` | Campaigns and their survey questions |
| `GET /integrations/shore/<id>/campaigns/<campaignId>/contact-state` | Current answers and tags per contact |

Every request must be signed with the key. Unsigned or wrongly signed requests get 401, and
an organization without the configuration gets 404.

If Spoke sits behind a proxy or firewall, allow Shore's servers to reach these paths, and
allow Spoke to reach `SHORE_URL`.

## 4. Load a campaign's contacts

1. In the campaign editor's **Contacts** section, choose **Shore segment**.
2. Pick a segment. The list shows each segment's description and how many people Shore can
   text right now.
3. Save. Spoke replaces the campaign's contacts with the segment's textable people.

The contact count after loading can be a little lower than the segment's count: Spoke also
removes numbers already opted out in Spoke, duplicates, and invalid numbers.

Each contact comes with custom fields scripts can use:

| Field | Notes |
|---|---|
| `{preferredName}` | What the person likes to be called; falls back to first name. |
| `{city}` | |
| `{pollingPlaceName}` | Empty until Shore has the data. |
| `{pollingPlaceAddress}` | Empty until Shore has the data. |
| `{precinct}` | Empty until Shore has the data. |

`{firstName}`, `{lastName}` and `{zip}` work as in any Spoke campaign. Only use the voting
fields in campaigns whose segments Shore fills them for; otherwise the message will have a
blank where the field goes.

## Troubleshooting

| What you see | What to check |
|---|---|
| "Shore segment" isn't offered | `shore` is in the `CONTACT_LOADERS` environment variable and Spoke was restarted; all three required keys are set and valid. |
| "Couldn't reach Shore" | `SHORE_URL` is right and reachable from Spoke's servers. |
| "Shore rejected the request" | `SHORE_CAMPAIGN` and `SHORE_INTEGRATION_KEY` match what Shore has, and the key hasn't been replaced in Shore. |
| "The load expired before it finished" | Shore keeps a load for an hour. Save again to retry. |
| Shore reports 401s from Spoke | The key matches on both sides; both clocks are correct; no proxy in front of Spoke rewrites the path or query string (the signature covers them). |
| Shore reports 404s from Spoke | The organization ID is right and the organization has the configuration. |

Spoke's logs mention the extension as `shore: ...`. They contain Spoke IDs, counts and error
codes only, never phone numbers, names or message text.

## Security notes

- The key lets Shore read message text and contact details for the organization, and opt
  numbers out. Treat it like a database password, and replace it (in Shore, then in Spoke)
  if it may have leaked.
- The endpoints don't use Spoke's sign-in; the signature is the only check.
- Shore can't remove an opt-out. Spoke has no built-in way to reverse one either (it
  doesn't act on START replies), so an opt-out recorded in Spoke stays.
