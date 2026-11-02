# Shore brand files

Put Shore's brand files here. When this Spoke is set up for Shore (`shore` is in
`CONTACT_LOADERS` and `SHORE_URL` is set), Spoke uses them; otherwise it keeps Spoke's own
favicon and shows no Shore mark. Each file is optional: a missing one falls back on its own.

| File | Used for | From Shore |
|---|---|---|
| `favicon.svg`, `favicon.png` or `favicon.ico` | The browser tab icon (the first one found, in that order). PNG: 32×32. | `web/public/` (made from `web/assets/img/favico.png`) |
| `apple-touch-icon.png` | Home-screen icon on phones. 180×180. | `web/public/` |
| `shore-logo.svg` | The faint "powered by" Shore mark at the bottom of the sidebar. | `web/assets/img/shore-logo-white.svg`, or the SVG in `web/src/components/Logo.tsx` |

Notes:

- The wordmark is drawn as a mask in the theme's faint colour, so the SVG's own colours
  don't matter (a white logo works). It needs a `viewBox` or `width`/`height` so its shape
  can be sized; it's shown 17px tall.
- Files are served at `/shore-assets/<name>`, only the names above, with a one-day cache.
  After replacing one, browsers may show the old icon for up to a day.
- These are Shore's own marks, not a campaign's. Campaign logos come from Shore's menu once
  they have a public home; until then the sidebar shows the campaign's initials.
