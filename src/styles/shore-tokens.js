// Shore's design tokens: the palette from Shore's web/src/theme.ts and the
// light/dark values from web/src/global.css (docs/shore-design-guide.md).
//
// Colours that change with the colour scheme are also published as CSS
// variables (--shore-*, see cssVariables below), so Spoke's static styles
// (aphrodite, inline styles) can follow light and dark mode too.

export const palette = {
  navy: [
    "#EEF0FB",
    "#DCDFF6",
    "#B9BFEC",
    "#959EE2",
    "#7A84DC",
    "#636CD6",
    "#4C55C2",
    "#293169",
    "#222958",
    "#1C2147"
  ],
  // Dark mode's surfaces and text: deep navy, not gray. 0 is text, 2 dimmed
  // text, 4 borders, 5-6 inputs and hover, 7 cards and menus, 8 the sidebar
  // and canvas, 9 the page panel.
  dark: [
    "#E2E8F0",
    "#CBD5E1",
    "#94A3B8",
    "#64748B",
    "#212C42",
    "#1C2639",
    "#162033",
    "#0F1729",
    "#0A1122",
    "#050A17"
  ],
  ocean: [
    "#F2F9FD",
    "#CFE8F6",
    "#ADD7F0",
    "#8AC6E9",
    "#68B5E3",
    "#45A4DC",
    "#3A8AB9",
    "#2A7FB8",
    "#245572",
    "#193B4F"
  ],
  shallow: [
    "#F7FCFE",
    "#D3EEFB",
    "#AFE0F7",
    "#8BD2F4",
    "#75B0CD",
    "#5F8FA6",
    "#486D7F",
    "#324C58",
    "#1C2A31",
    "#06080A"
  ],
  sand: [
    "#FEFCF9",
    "#F7EDE0",
    "#F1DFC6",
    "#EAD0AD",
    "#C5AF91",
    "#9F8D76",
    "#7A6C5A",
    "#544B3E",
    "#2F2A23",
    "#090807"
  ],
  seagrass: [
    "#F4F7F5",
    "#DAE4DF",
    "#C1D1C9",
    "#A7BEB2",
    "#8EAC9C",
    "#749986",
    "#5B8670",
    "#4C715E",
    "#3E5B4C",
    "#2F463A"
  ],
  coral: [
    "#FCF4F2",
    "#F6DCD6",
    "#F1C4BB",
    "#EBAD9F",
    "#E59583",
    "#DF7D67",
    "#D9654B",
    "#B6553F",
    "#944533",
    "#713527"
  ],
  // Mantine's default gray, which Shore's light mode uses for borders and
  // dimmed text.
  gray: [
    "#F8F9FA",
    "#F1F3F5",
    "#E9ECEF",
    "#DEE2E6",
    "#CED4DA",
    "#ADB5BD",
    "#868E96",
    "#495057",
    "#343A40",
    "#212529"
  ]
};

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  // eslint-disable-next-line no-bitwise
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const { navy, dark, coral, gray, sand } = palette;

// Per-scheme values. Keys become CSS variables: canvas -> --shore-canvas.
export const schemes = {
  light: {
    canvas: "#F3F4F8", // sidebar and around the panel
    panel: "#FFFFFF", // the page
    surface: "#FFFFFF", // cards, menus, modals
    input: "#FFFFFF",
    subtle: gray[1], // quiet fills (code, chips, notes)
    border: gray[3],
    panelBorder: "#E4E6EE",
    text: "#181818",
    dimmed: gray[6],
    link: "#2A7FB8",
    faint: "#C4C7D3", // the Shore mark
    primary: navy[7],
    navText: gray[8],
    navHover: rgba(navy[9], 0.06),
    navActiveBg: navy[7],
    navActiveText: "#FFFFFF",
    navActiveHover: navy[7],
    navActiveShadow: `0 1px 2px ${rgba(navy[9], 0.2)}`,
    subActiveBg: navy[0],
    subActiveText: navy[7],
    countBg: rgba(coral[6], 0.1),
    countText: coral[6],
    noticeBg: sand[0],
    noticeBorder: sand[3]
  },
  dark: {
    canvas: dark[8],
    panel: dark[9],
    surface: dark[7],
    input: dark[6],
    subtle: dark[6],
    border: dark[4],
    panelBorder: dark[5],
    text: dark[0],
    dimmed: dark[2],
    link: palette.shallow[3],
    faint: "#2E3A54",
    primary: navy[5],
    navText: dark[1],
    navHover: "rgba(255, 255, 255, 0.06)",
    navActiveBg: rgba(navy[5], 0.16),
    navActiveText: navy[3],
    navActiveHover: rgba(navy[5], 0.22),
    navActiveShadow: "none",
    subActiveBg: rgba(navy[5], 0.1),
    subActiveText: navy[3],
    countBg: rgba(coral[6], 0.15),
    countText: coral[4],
    noticeBg: rgba(sand[3], 0.08),
    noticeBorder: rgba(sand[3], 0.3)
  }
};

const kebab = key => key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

export function cssVariables(scheme) {
  const values = schemes[scheme] || schemes.light;
  return Object.keys(values).reduce((out, key) => {
    out[`--shore-${kebab(key)}`] = values[key];
    return out;
  }, {});
}

// Use in any style: v("canvas") -> "var(--shore-canvas)".
export const v = key => `var(--shore-${kebab(key)})`;

export const shared = {
  panelShadow: `0 1px 2px ${rgba(navy[9], 0.04)}, 0 4px 16px ${rgba(
    navy[9],
    0.04
  )}`,
  monogram: `linear-gradient(145deg, ${navy[6]}, ${navy[9]})`,
  monogramHighlight: "inset 0 1px 0 rgba(255, 255, 255, 0.18)"
};

export const fonts = {
  text:
    '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  heading:
    '"DM Sans Variable", "DM Sans", "Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif'
};

export const layout = {
  sidebarWidth: 256,
  panelGap: 8,
  panelRadius: 16,
  pageMaxWidth: 1280,
  pagePadding: { top: 36, side: 44, bottom: 48 },
  phonePagePadding: { top: 20, side: 16, bottom: 32 },
  phoneBreakpoint: 768,
  phoneTopBar: 56,
  controlRadius: 8,
  cardRadius: 16,
  iconStroke: 1.7
};

export { rgba };
