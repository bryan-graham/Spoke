# Spoke's Shore interface

Spoke's interface is restyled to match Shore, following
[shore-design-guide.md](shore-design-guide.md), and shows Shore's shared sidebar menu so
moving between the two feels like one app.

Status: 2026-11-03. Light and dark mode.

## What's in this round

| Part | Where | Notes |
|---|---|---|
| Design tokens | `src/styles/shore-tokens.js` | Shore's exact palette from `web/src/theme.ts` (navy, dark, ocean, shallow, sand, seagrass, coral) and the light/dark values from `global.css`, published as CSS variables (`--shore-canvas`, `--shore-text`, ...) so static styles follow the scheme. |
| Material-UI theme | `src/styles/mui-theme.js` | Light and dark: navy primary (navy-7 light, navy-5 dark), Inter text, DM Sans headings, 8px controls, 16px cards and dialogs, Shore-style table headers, no all-caps buttons or tabs. Every page picks this up. |
| Colour scheme | `src/components/ColorScheme.js` | Which scheme to show (below); `render-index.js` applies it before the app loads so dark mode doesn't flash white. |
| Fonts | `src/client/index.jsx`, `webpack/config.js` | Inter and DM Sans, self-hosted with `@fontsource-variable` (replaces Poppins from Google Fonts). |
| Shell | `src/components/ShoreShell/` | Canvas, 256px sidebar, raised page panel; on phones a 56px top bar and a slide-in sidebar; tapping anywhere on the top bar (menu icon, logo or name) opens and closes it. Print hides the sidebar. |
| Page header | `src/components/TopNav.jsx` | Now the title (and back link) inside the panel. The account menu moved to the sidebar. |
| Account menu | `src/containers/UserMenu.jsx` | Same options as before, shown at the bottom of the sidebar (avatar, name, email). |
| Shared menu | `src/extensions/contact-loaders/shore/lib/menu.js` | Spoke's server fetches Shore's menu for the signed-in person. |

Spoke's texting screens (sending and replying) stay full screen, without the sidebar
([below](#the-texting-screens)).

## The sidebar

- **Top:** the campaign's logo from Shore's menu (`org.publicLogo`, which loads without a
  Shore sign-in), or, without Shore's menu, the organization's own logo from Settings
  ([below](#settings)): the dark version in dark mode and the light one in light mode,
  falling back to whichever exists. A wide wordmark stands alone; a square logo sits beside the
  campaign name. With no logo (or if it fails to load), the campaign's initials on a navy
  tile.
- **Page title:** while connected to Shore, "*Campaign* • Shore • Texting" ("Shore •
  Texting" before Shore's menu loads); otherwise "Spoke".
- **Navigation**, built in `src/components/ShoreShell/buildNav.js`:
  - Shore's groups and items, linking back into Shore (external items open in a new tab),
    with coral count badges.
  - Shore's **Texting** item is Spoke: always highlighted, linking to Spoke's home for this
    person.
  - **Admins** (Spoke role supervolunteer or above) see Spoke's pages as sub-items under
    Texting: My assignments, Campaigns, People, Message Review, Bulk Script Editor, Tags,
    Settings, and Phone Numbers when phone inventory is on. Each page shows only if the
    person's role allows it. The current page gets a light navy tint.
  - **Texters** see Texting alone.
- **Without Shore** (Spoke not connected to Shore, Shore unreachable, or the person isn't
  an active Shore member) there's no Texting parent: Spoke's pages are the top-level items,
  with no nesting. Texters see My assignments; admins see My assignments and the admin
  pages their role allows, with the current page highlighted.
- **Bottom:** the signed-in person, opening the account menu (account, switch
  organization, FAQs, superadmin tools, appearance, log out), and the Shore mark when the
  menu came from Shore.

## Settings

`src/containers/Settings/` uses Shore's page pattern: a description under the title, then
a card per area (icon, title, summary badge), the advanced ones collapsed.

| Card | Contents |
|---|---|
| Opt-outs | The default opt-out message. |
| Texting hours | The on/off switch, the hours (badge: "9 am – 9 pm" or "Off"), and "Change texting hours". |
| Branding | **Logo** (below) and **Colours** (the organization palette, in a grid). |
| Service management, *vendor* settings | Each service with a "Set up" / "Needs setup" badge (were coloured header bars). |
| Texting screen defaults, Overriding default settings, Troubleshooting | Collapsed to start. Troubleshooting (was "External configuration") clears the caches. |

### Logos without Shore

When Spoke isn't showing Shore's menu, owners can upload a **light** and a **dark** logo
(`src/components/OrganizationLogoSettings.jsx`). Each shows as it will look in the sidebar,
on that mode's background, with Upload / Replace / Remove (removing asks first, in a small
popover). With one version, it's used in both modes; with neither, the initials tile.
With Shore's menu, the card says the logos come from Shore and links to Shore's settings.

| Part | Where |
|---|---|
| Storage | Table `organization_logo` (migration `20261104120000_organization_logo.js`): one row per organization and scheme, the image base64-encoded. |
| Rules | `src/server/lib/organization-logo.js`: PNG, JPEG, GIF or WebP, up to 512 KB, checked by the file's bytes, not just its stated type. SVG isn't accepted, since served from Spoke's address it could run script. |
| GraphQL | `Organization.logo { light dark }` (addresses, for any member) and `updateOrganizationLogo(organizationId, scheme, image)` (owners; `image` is a data URL, null removes). |
| Serving | `GET /org-logo/:organizationId/:scheme?v=…`, public like Shore's `publicLogo`. The `?v=` changes with each upload, so each address is cached for good; served with `nosniff` and a sandboxing content policy. |

## Light and dark mode

| Situation | Spoke shows |
|---|---|
| Shore's menu is available | The person's Shore setting (`user.colorScheme`), so both apps match. The account menu says "(set in Shore)"; it's changed in Shore. |
| No Shore menu | The person's choice in Spoke's account menu (Match device, Light, Dark), kept in this browser. |
| `auto` / Match device (the default) | The device's light or dark setting, switching live when it changes. |

Both settings are remembered in the browser (`spoke.shoreColorScheme`, `spoke.colorScheme`)
so the next page load starts in the right scheme.

An organization's custom palette (Settings) may change the brand colours (primary,
secondary, error, warning, info, success) but not surfaces or text, so it can't make either
scheme unreadable. Organizations without a custom palette now get Shore's theme: the server
used to send Spoke's old green palette as if the organization had chosen it.

Pages with hard-coded light colours were converted to the scheme's CSS variables, including
the texting screens, chips, the script editor, notes, and the archived-campaign banner.

## The texting screens

Sending and replying (`src/components/AssignmentTexter/`) stay full screen, without the
sidebar, but now look like Shore in both schemes:

| Part | Was | Now |
|---|---|---|
| Top bar (`Toolbar.jsx`) | Dark grey bar, home icon, "Campaign ID: 12" | Canvas-coloured 56px bar like Shore's phone top bar: a back arrow ("Back to my assignments"), "Campaign 12" dimmed over the title in DM Sans. On phones, a side-panel button opens the campaign's side boxes. |
| Contact bar (`ContactToolbar.jsx`) | Grey bar, face icon, "11:04 AM - NY, Brooklyn" | Shore's people avatar (initials, colour picked from the name), the first name in DM Sans, "11:04 AM · Brooklyn, NY" dimmed, and bordered previous/next buttons around "3 of 20". With the contact list turned on, a button before the avatar shows and hides it. |
| Conversation (`MessageList.jsx`) | Contact's messages in blue, the texter's in white, on grey | On the page's panel colour: the contact's messages on the left in a quiet grey bubble, the texter's on the right in the primary navy (an organization's custom primary colour if it has one), 16px corners with a small tail corner, timestamps inside. An opt-out is a coral note under the conversation. |
| First message | "This is your first message to Pat" | Shore's empty state: "Your first message to Pat", "Read the message below, then send it." Opted out and paused-first-messages screens use it too. |
| Composer (`Controls.jsx`) | Underlined field, grey selected shortcuts, "↵ Send" | An outlined field under a divider; shortcut buttons (answers and short scripts) are small outlined buttons, the selected one tinted navy like Shore's current sub-page; "All responses" and a coral outlined "Opt out"; a full navy "Send" with a send icon beside "Skip"/"Reopen". |
| Opt-out (`Controls.jsx`) | "Opt out user", grey choices, "↵ Opt-Out" | A Shore card: "Opt out Pat", what it does, "Standard message"/"No message" as choices (selected tinted navy), an outlined "Last message" field, Cancel and a coral "Opt out". |
| Contact list (`AssignmentContactsList.jsx`) | Grey search strip, plain list | Like Shore's sidebar: canvas colour, a round search field, rows with 8px corners, the current contact in Shore's current-page row (solid navy in light mode, tinted in dark), a coral dot for contacts waiting for a reply. |
| Side boxes (`StyleControls.js`) | Grey header strip | Canvas colour with a border, no strip; side-box buttons get 8px corners. |

The avatar is `src/components/PersonAvatar.jsx`, reusable wherever people are listed.

## Setting up the shared menu

Spoke's server calls Shore's `GET /api/integrations/spoke/{campaign}/menu` with a
5-minute-or-less HS256 token (`sub` = the person's email, `aud` = `shore:menu`). It needs:

| Setting | Meaning |
|---|---|
| `CONTACT_LOADERS` includes `shore` | Mounts `GET /shore-menu/:organizationId`, which the sidebar calls. |
| `SHORE_URL`, `SHORE_CAMPAIGN` | As for the Shore integration ([HOWTO](HOWTO-integrate-with-shore.md)). |
| `TOKEN_AUTH_SHARED_SECRET` | The secret Shore signs Spoke sign-ins with (`PASSPORT_STRATEGY=token`). The menu token is signed with it too. |

`SHORE_INTEGRATION_KEY` isn't needed for the menu. A person sees Shore's menu only if their
Spoke email matches an active member of the campaign in Shore.

`GET /shore-menu/:organizationId` needs Spoke's sign-in session and membership of the
organization (or superadmin). It answers `no-store`, and passes on only the documented
fields, with links limited to `http`/`https`.

## Shore's favicon and wordmark

Put Shore's brand files in `src/extensions/contact-loaders/shore/assets/` (its README lists
them): `favicon.svg`/`.png`/`.ico`, `apple-touch-icon.png`, and `shore-logo.svg`.

When this Spoke is set up for Shore (`shore` in `CONTACT_LOADERS` and `SHORE_URL` set), the
page uses Shore's favicon and the sidebar's "powered by" mark uses `shore-logo.svg`, drawn in
the scheme's faint colour. Otherwise Spoke keeps its own favicon. Each file falls back on its
own when missing (the mark falls back to the word "Shore"). They're served at
`/shore-assets/<name>`.

## Known gaps and next steps

- **Brand files.** Add Shore's favicon, touch icon and wordmark to the assets folder above.
- **Sign-in page.** The login page is still Spoke's (Shore's has the beach background).
- **Dark mode review.** Every page restyles through the theme and the converted colours,
  but not every page has been looked at in dark mode in a real browser; expect a few spots
  to tune (charts use fixed colours).
- **Page patterns.** Campaigns, People, the campaign editor, Message Review, the texter's
  assignments and the texting screens use Shore's page header, cards, tables and empty
  states. Others (campaign stats, Settings, Tags, Phone Numbers) restyle through the theme
  but keep their own layouts.
- **Texting screens.** The survey's "All responses" popover, the script list and the
  individual side boxes (tags, feedback, ...) keep their own layouts inside the new frame.
- **Campaign switcher.** Shore's brand opens a campaign switcher when there are several;
  Spoke's organization switching stays in the account menu.
