# Shore design guide

> Copied from Shore on 2026-11-02 as the reference for retooling Spoke's interface to match
> Shore. Paths like `web/src/theme.ts` are in Shore's repository, not this one. Shore's copy
> is the source of truth; update this copy when it changes.

How Shore looks, written so another app (Spoke, a campaign tool, a new page) can be made to match. The code is the source of truth: `web/src/theme.ts` (palette and component defaults), `web/src/global.css` (layout and tokens), `web/src/pages/OrgLayout.tsx` (the shell), and `web/src/components/` (shared pieces).

## Stack

| Part | What | Version |
|---|---|---|
| UI framework | React | 19 |
| Component library | [Mantine](https://mantine.dev) (`@mantine/core`, `hooks`, `notifications`), with `postcss-preset-mantine` | 9.7 |
| Icons | [Tabler Icons](https://tabler.io/icons) (`@tabler/icons-react`), stroke 1.7 | 3.50 |
| Fonts | Inter Variable (text), DM Sans Variable (headings), self-hosted via `@fontsource-variable` | 5.3 |

An app on the same stack can copy `theme.ts`, `global.css`, and `components/` and get the look exactly. An app on another stack (Spoke's UI is Material-UI) maps the tokens below into its own theme.

## Layout

```
Desktop (≥ 768px)                                   Phone (< 768px)
┌──────────────┬──────────────────────────────┐     ┌──────────────────────────┐
│ [logo] Name  │ ╭──────────────────────────╮ │     │ ☰ [logo] Name            │ 56px top bar
│              │ │ Page title       [Action]│ │     ├──────────────────────────┤
│ ▣ Dashboard  │ │ Description              │ │     │ Page title               │
│ ▣ Supporters │ │                          │ │     │ Description   [Action]   │
│ ▣ Inbox   (3)│ │  cards, tables, ...      │ │     │                          │
│ ...          │ │                          │ │     │ content, full width      │
│ ADMIN        │ │                          │ │     │                          │
│ ▣ Settings   │ │                          │ │     └──────────────────────────┘
│              │ │                          │ │     The sidebar slides in over
│ (A) Name     │ │                          │ │     the page from ☰; it doesn't
│ Shore        │ ╰──────────────────────────╯ │     repeat the campaign logo.
└──────────────┴──────────────────────────────┘
  256px sidebar   raised panel, 8px from the edges
```

- **Canvas:** the sidebar and the area around the page share one background (`--shore-canvas`). There's no top bar on desktop.
- **Panel:** the page sits on a raised panel: 8px gap to the sidebar's right and the window's top, right, and bottom; radius 16px; 1px border (`--shore-panel-border`); a very soft shadow (`0 1px 2px` and `0 4px 16px`, navy at 4%). On phones the panel fills the screen with no border or radius.
- **Page:** content is centered, max width 1280px, padding 36px top, 44px sides, 48px bottom (phones: 20 / 16 / 32).
- **Sidebar, top:** the campaign's identity, not Shore's: its uploaded logo, or a monogram tile (46px, radius 10, gradient navy-6 → navy-9, white initials in DM Sans) beside the campaign name (DM Sans 17px bold). Square logos sit beside the name; wide wordmarks stand alone. With more than one campaign it opens a campaign switcher.
- **Sidebar, nav:** groups of links, an optional group label in small capitals (12px, 600, letter-spacing 0.06em, dimmed). Each link: 18px icon, label in 500 weight, radius 8px, optional count badge on the right (coral, light variant; a circle under 10). Sub-items indent 20px with 16px icons and 13px text.
- **Current page:** light mode, a solid navy row (navy-7, white text, a 1px shadow). Dark mode, a tinted row (indigo at 16%) with light-indigo text (navy-3), no shadow. Hover on other rows: navy at 6% (light) or white at 6% (dark).
- **Sidebar, bottom:** the signed-in user (34px navy avatar, name, email) opening a menu with dark/light mode and sign out; under it the Shore wordmark, 17px tall, in a faint color (`--shore-faint`), as a quiet "powered by".
- **Phone top bar:** 56px, canvas background, a menu button and the campaign brand at the small size (32px tile, 14px name).

## Color

The palette comes from shore.vote's beach art. Each color is a 10-step scale (0 lightest … 9 darkest) in `theme.ts`; the steps that matter:

| Name | Use | Key shades |
|---|---|---|
| navy | Primary: buttons, current page, avatars, icon tiles | 7 `#293169` (light-mode primary), 5 `#636CD6` (dark-mode primary), 3 `#959EE2` (dark-mode active text), 0 `#EEF0FB` (light tint) |
| ocean | Links, info, "new" | 7 `#2A7FB8` (link on light) |
| shallow | Links on dark | 3 `#8BD2F4` |
| sand | Tags and "waiting" states | 3 `#EAD0AD` (tag fill, with navy-9 text) |
| seagrass | Success | 6 `#5B8670` |
| coral | Danger, opt-outs, counts | 6 `#D9654B` |

Mantine's `red`, `green`, and `blue` are aliased to coral, seagrass, and ocean, so nothing falls back to stock colors.

| Token | Light | Dark |
|---|---|---|
| Canvas (sidebar, around the panel) | `#F3F4F8` | `#0A1122` |
| Page panel | `#FFFFFF` | `#050A17` |
| Cards, menus, modals | `#FFFFFF` | `#0F1729` |
| Inputs | white | `#162033` |
| Borders | `#E4E6EE` (panel), Mantine gray-3 | `#212C42` |
| Text / dimmed text | `#181818` / gray-6 | `#E2E8F0` / `#94A3B8` |
| Links | `#2A7FB8` | `#8BD2F4` |
| Faint (Shore mark) | `#C4C7D3` | `#2E3A54` |

Dark mode is deep navy, not gray (the full dark scale is in `theme.ts`). The app follows the system setting by default; the account menu switches it.

## Type

- **Text:** Inter, 14px for most UI, 16px for page descriptions.
- **Headings:** DM Sans, 700, letter-spacing −0.02em. Page titles 30px, line height 1.15.
- **Card titles:** DM Sans 15px 700, after a 28px icon tile (navy, light variant, radius 8).
- **Table headers:** 11px, 600, uppercase, letter-spacing 0.06em, dimmed, so rows carry the weight.
- **Badges:** sentence case (no all-caps).

## Shapes and spacing

- Radius: 8px for controls and nav rows (Mantine `md`), 16px for cards, panels, and tables (`lg`), round for search fields and avatars.
- Cards: 1px border, 16px radius, 20px padding; stacked 20px apart.
- Tables sit in a bordered 16px-radius box with hidden overflow; rows highlight on hover; cells 12px × 20px.

## Patterns

- **Page header:** title and one-line description on the left, the page's main actions on the right (wraps under on phones).
- **Empty state:** a 48px round light-ocean icon, a bold one-line title, a dimmed sentence about what will appear or what to do.
- **People:** a round initials avatar whose color is picked from the name (navy, ocean, seagrass, coral, sand); pale tints in light mode, solid in dark.
- **Buttons:** primary filled navy; secondary "default" (white with border); destructive coral. One primary action per area.
- **Confirming:** a small popover next to the button ("Remove this logo?" Cancel / Remove), never a browser dialog.
- **Feedback:** toasts at the top right: seagrass with a check for success, coral with a warning icon for errors. Errors say what to do.
- **Collapsed detail:** secondary sections (e.g. Opt-outs) collapse to a header with a chevron and a summary badge.
- **Printing:** print views hide the sidebar and top bar and drop the panel.

## Brand assets

- Shore wordmark: `web/src/components/Logo.tsx` (inline SVG in the current text color) and `web/assets/img/shore-logo-white.svg`.
- App icons: `web/public/` (32px favicon, 180px Apple touch icon, 192/512px manifest icons), made from `web/assets/img/favico.png`.
- Sign-in background: `web/assets/img/beach-login-bg-*.webp`.

## Matching another app

1. **Same stack (React + Mantine):** install the versions above; copy `theme.ts`, `global.css`, `components/`, the fonts, and the shell structure from `OrgLayout.tsx`.
2. **Other stack:** set its theme from the tables above: primary navy-7 / dark navy-5, the dark scale, Inter and DM Sans, 8px control radius and 16px card radius. Rebuild the shell (canvas, raised panel, sidebar) with its own layout components, use Tabler icons at stroke 1.7, and set the nav's current-page styles exactly as above; that row is what makes it read as Shore.
3. **The sidebar's contents** come from Shore, not a copy, so links, permissions, and counts stay in step: see below.

## Shared menu

Shore's own sidebar draws from this, and another app signed in through Shore shows the same menu (`domain/menu/menu.ts`).

- **In Shore:** `GET /api/orgs/{campaign}/menu`, with the signed-in session.
- **From Spoke's server:** `GET /api/integrations/spoke/{campaign}/menu` with `Authorization: Bearer <JWT>`. The token is HS256, signed with the campaign's Spoke shared secret (the one Shore signs Spoke sign-ins with), with claims `sub` (the person's email), `aud: "shore:menu"`, `iat`, and `exp` at most 5 minutes after `iat`. A browser on Spoke's site can't send Shore's sign-in cookie, so this call comes from Spoke's server. Answers: 401 bad or expired token, 403 not an active member, 404 unknown campaign or Spoke not turned on.

```json
{
  "org": { "slug": "graham-for-providence", "name": "Graham for Providence",
           "logo": { "light": "https://app.shore.vote/api/orgs/…/logo/light?v=…" } },
  "user": { "name": "Pat Example", "email": "pat@example.com", "role": "staff",
            "colorScheme": "auto" },
  "counts": { "message": 2, "volunteer": 1, "yard_sign": 0, "review": 3 },
  "groups": [
    { "label": null, "items": [
      { "key": "inbox", "label": "Inbox", "icon": "inbox",
        "url": "https://app.shore.vote/o/graham-for-providence/inbox", "path": "inbox", "count": 3 },
      { "key": "texting", "label": "Texting", "icon": "message",
        "url": "https://app.shore.vote/auth/spoke/graham-for-providence", "external": true }
    ] },
    { "label": "Admin", "items": [ { "key": "settings", "label": "Settings", "icon": "settings", "url": "…", "path": "settings" } ] }
  ]
}
```

- `icon` is a [Tabler icon](https://tabler.io/icons) name; draw it at stroke 1.7.
- `url` is absolute, for linking back into Shore; `path` is set only for Shore's own pages; `external` items open in a new tab. In Spoke, highlight the `texting` item as the current one.
- `count` appears only when something needs attention: draw it as the coral badge. `counts` is null for texters, whose menu is just Texting.
- The campaign logo URLs need a Shore session, so another app shows the monogram (the campaign's initials) instead, until logos have a public home (later.md).
- Fetch it when a page loads; no caching (`no-store`), so counts are current.
