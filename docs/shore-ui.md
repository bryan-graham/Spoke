# Spoke's Shore interface

Spoke's interface is restyled to match Shore, following
[shore-design-guide.md](shore-design-guide.md), and shows Shore's shared sidebar menu so
moving between the two feels like one app.

Status: 2026-11-02. Light and dark mode.

## What's in this round

| Part | Where | Notes |
|---|---|---|
| Design tokens | `src/styles/shore-tokens.js` | Shore's exact palette from `web/src/theme.ts` (navy, dark, ocean, shallow, sand, seagrass, coral) and the light/dark values from `global.css`, published as CSS variables (`--shore-canvas`, `--shore-text`, ...) so static styles follow the scheme. |
| Material-UI theme | `src/styles/mui-theme.js` | Light and dark: navy primary (navy-7 light, navy-5 dark), Inter text, DM Sans headings, 8px controls, 16px cards and dialogs, Shore-style table headers, no all-caps buttons or tabs. Every page picks this up. |
| Colour scheme | `src/components/ColorScheme.js` | Which scheme to show (below); `render-index.js` applies it before the app loads so dark mode doesn't flash white. |
| Fonts | `src/client/index.jsx`, `webpack/config.js` | Inter and DM Sans, self-hosted with `@fontsource-variable` (replaces Poppins from Google Fonts). |
| Shell | `src/components/ShoreShell/` | Canvas, 256px sidebar, raised page panel; on phones a 56px top bar and a slide-in sidebar. Print hides the sidebar. |
| Page header | `src/components/TopNav.jsx` | Now the title (and back link) inside the panel. The account menu moved to the sidebar. |
| Account menu | `src/containers/UserMenu.jsx` | Same options as before, shown at the bottom of the sidebar (avatar, name, email). |
| Shared menu | `src/extensions/contact-loaders/shore/lib/menu.js` | Spoke's server fetches Shore's menu for the signed-in person. |

Spoke's texting screens (sending and replying) stay full screen, without the sidebar.

## The sidebar

- **Top:** the campaign's monogram tile and name. Shore's campaign logos need a Shore
  session, so Spoke shows the monogram, as the design guide says.
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
the texting screens, chips, the script editor, notes, and the archived-campaign banner. The
texting screens' dark grey toolbars stay as they are in both schemes.

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
- **Page patterns.** Pages restyle through the theme, but keep their own layouts. Next
  candidates for Shore's page header, cards, tables and empty states: Campaigns, Message
  Review, and the texter's assignment list.
- **Campaign switcher.** Shore's brand opens a campaign switcher when there are several;
  Spoke's organization switching stays in the account menu.
