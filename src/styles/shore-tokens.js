// Shore's design tokens, from docs/shore-design-guide.md.
//
// Shades marked "guide" are exact values from the design guide. The others
// fill in the 10-step scales (0 lightest … 9 darkest) and are close
// approximations: replace them with Shore's web/src/theme.ts values when that
// file is copied in.

export const palette = {
  navy: [
    "#EEF0FB", // 0 guide
    "#DCDFF6",
    "#BCC1EE",
    "#959EE2", // 3 guide
    "#7C85DC",
    "#636CD6", // 5 guide
    "#434CB0",
    "#293169", // 7 guide
    "#1E2552",
    "#141A3C"
  ],
  ocean: [
    "#E8F4FB",
    "#CFE7F5",
    "#A4D1EC",
    "#76B9E1",
    "#4FA3D6",
    "#3792CA",
    "#2F88C1",
    "#2A7FB8", // 7 guide
    "#21689A",
    "#18507A"
  ],
  shallow: [
    "#EAF7FD",
    "#CDEDFB",
    "#ACE1F8",
    "#8BD2F4", // 3 guide
    "#6CC3EE",
    "#4FB3E6",
    "#3BA1D6",
    "#2E8BBD",
    "#24729C",
    "#1A5779"
  ],
  sand: [
    "#FBF5EC",
    "#F5E9D7",
    "#EFDDC2",
    "#EAD0AD", // 3 guide
    "#E1BE90",
    "#D6AB73",
    "#C3955B",
    "#A67C47",
    "#866338",
    "#664B2A"
  ],
  seagrass: [
    "#EEF4F0",
    "#DAE7DF",
    "#B9D2C3",
    "#97BBA6",
    "#7AA58C",
    "#68957C",
    "#5B8670", // 6 guide
    "#4B705D",
    "#3C5A4B",
    "#2D4438"
  ],
  coral: [
    "#FCEFEB",
    "#F8DDD5",
    "#F1BBAC",
    "#EA9A84",
    "#E37E63",
    "#DE7056",
    "#D9654B", // 6 guide
    "#BC523A",
    "#9A422F",
    "#783324"
  ]
};

const alpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  // eslint-disable-next-line no-bitwise
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// Light mode only for now (see docs/shore-ui.md).
export const tokens = {
  canvas: "#F3F4F8",
  panel: "#FFFFFF",
  surface: "#FFFFFF",
  panelBorder: "#E4E6EE",
  border: "#DEE2E6", // Mantine gray-3
  text: "#181818",
  dimmed: "#868E96", // Mantine gray-6
  link: palette.ocean[7],
  faint: "#C4C7D3",
  primary: palette.navy[7],
  panelShadow: `0 1px 2px ${alpha(palette.navy[7], 0.04)}, 0 4px 16px ${alpha(
    palette.navy[7],
    0.04
  )}`,
  navHover: alpha(palette.navy[7], 0.06),
  navActive: palette.navy[7],
  navActiveShadow: `0 1px 2px ${alpha(palette.navy[9], 0.24)}`,
  countBg: alpha(palette.coral[6], 0.12),
  countText: palette.coral[7],
  monogram: `linear-gradient(135deg, ${palette.navy[6]}, ${palette.navy[9]})`
};

export const fonts = {
  text:
    '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  heading:
    '"DM Sans Variable", "DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif'
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

export { alpha };
