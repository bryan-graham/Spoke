# Spoke's Shore interface

Spoke's interface is restyled to match Shore, following
[shore-design-guide.md](shore-design-guide.md), and shows Shore's shared sidebar menu so
moving between the two feels like one app.

Status: first round, 2026-11-02. Light mode only.

## What's in this round

| Part | Where | Notes |
|---|---|---|
| Design tokens | `src/styles/shore-tokens.js` | Shore's palette (navy, ocean, shallow, sand, seagrass, coral), canvas/panel/border/text colours, fonts and layout sizes. |
| Material-UI theme | `src/styles/mui-theme.js` | Navy primary, Inter text, DM Sans headings, 8px controls, 16px cards and dialogs, Shore-style table headers, no all-caps buttons or tabs. Every page picks this up. |
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
  organization, FAQs, superadmin tools, log out), and the Shore mark when the menu came
  from Shore.

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

## Known gaps and next steps

- **Exact Shore values.** Only the shades named in the design guide are exact; the rest of
  each 10-step scale is approximated. Copy Shore's `web/src/theme.ts` values into
  `src/styles/shore-tokens.js`.
- **Shore wordmark.** The sidebar shows the word "Shore" in DM Sans as a placeholder.
  Replace `src/components/ShoreShell/ShoreWordmark.jsx` with the SVG from Shore's
  `Logo.tsx`.
- **App icons and sign-in page.** The favicon and the login page are still Spoke's.
- **Dark mode.** Not yet: many pages hard-code light colours. The tokens and shell are ready
  for a dark set.
- **Page patterns.** Pages restyle through the theme, but keep their own layouts. Next
  candidates for Shore's page header, cards, tables and empty states: Campaigns, Message
  Review, and the texter's assignment list.
- **Organization palettes.** An organization's custom colours (Settings) still replace the
  theme's palette; the shell itself always uses Shore's colours.
- **Campaign switcher.** Shore's brand opens a campaign switcher when there are several;
  Spoke's organization switching stays in the account menu.
