import { createTheme } from "@material-ui/core/styles";
import { palette, schemes, cssVariables, fonts, layout } from "./shore-tokens";

/**
 * Spoke's Material-UI theme, matching Shore (docs/shore-design-guide.md) in
 * light and dark. buildThemeOptions(scheme) gives the options for either;
 * `defaultTheme` is the light one.
 *
 * The theme also publishes Shore's per-scheme colours as CSS variables on
 * :root (--shore-canvas, --shore-text, ...), so static styles can follow the
 * scheme with `var(...)` (see shore-tokens.js `v`).
 */
const heading = {
  fontFamily: fonts.heading,
  fontWeight: 700,
  letterSpacing: "-0.02em"
};

// Kinds of colour an organization's custom palette (Settings) may set. The
// surfaces and text always come from the scheme, so a custom palette can't
// make dark mode unreadable.
const ORG_PALETTE_KEYS = [
  "primary",
  "secondary",
  "error",
  "warning",
  "info",
  "success"
];

export function buildThemeOptions(scheme = "light", orgPalette = null) {
  const isDark = scheme === "dark";
  const t = isDark ? schemes.dark : schemes.light;
  const basePalette = {
    type: isDark ? "dark" : "light",
    primary: isDark
      ? {
          main: palette.navy[5],
          light: palette.navy[3],
          dark: palette.navy[7],
          contrastText: "#FFFFFF"
        }
      : {
          main: palette.navy[7],
          light: palette.navy[5],
          dark: palette.navy[9],
          contrastText: "#FFFFFF"
        },
    secondary: {
      main: isDark ? palette.shallow[3] : palette.ocean[7],
      contrastText: isDark ? palette.dark[9] : "#FFFFFF"
    },
    error: { main: palette.coral[6], contrastText: "#FFFFFF" },
    success: { main: palette.seagrass[6], contrastText: "#FFFFFF" },
    info: {
      main: isDark ? palette.ocean[5] : palette.ocean[7],
      contrastText: "#FFFFFF"
    },
    warning: {
      main: palette.sand[isDark ? 3 : 6],
      contrastText: palette.navy[9]
    },
    text: { primary: t.text, secondary: t.dimmed },
    divider: t.panelBorder,
    background: { default: t.canvas, paper: t.surface },
    action: { hover: t.navHover }
  };
  const orgOverrides = {};
  if (orgPalette && typeof orgPalette === "object") {
    ORG_PALETTE_KEYS.forEach(key => {
      if (orgPalette[key]) {
        orgOverrides[key] = orgPalette[key];
      }
    });
  }

  return {
    palette: { ...basePalette, ...orgOverrides },
    typography: {
      fontFamily: fonts.text,
      fontSize: 14,
      h1: { ...heading, fontSize: 30, lineHeight: 1.15 },
      h2: { ...heading, fontSize: 26, lineHeight: 1.2 },
      h3: { ...heading, fontSize: 22, lineHeight: 1.25 },
      h4: { ...heading, fontSize: 20, lineHeight: 1.3 },
      h5: { ...heading, fontSize: 17, lineHeight: 1.35 },
      h6: { ...heading, fontSize: 15, lineHeight: 1.4 },
      button: { textTransform: "none", fontWeight: 600 }
    },
    shape: { borderRadius: layout.controlRadius },
    overrides: {
      MuiCssBaseline: {
        "@global": {
          ":root": { ...cssVariables(scheme), colorScheme: scheme },
          body: { backgroundColor: t.canvas, color: t.text },
          a: { color: t.link }
        }
      },
      MuiButton: {
        root: { borderRadius: layout.controlRadius },
        contained: { boxShadow: "none", "&:hover": { boxShadow: "none" } },
        outlined: { backgroundColor: t.surface, borderColor: t.border }
      },
      MuiPaper: {
        rounded: { borderRadius: layout.controlRadius }
      },
      MuiCard: {
        root: {
          borderRadius: layout.cardRadius,
          border: `1px solid ${t.panelBorder}`,
          boxShadow: "none"
        }
      },
      MuiCardContent: { root: { padding: 20 } },
      MuiDialog: { paper: { borderRadius: layout.cardRadius } },
      MuiOutlinedInput: {
        root: { borderRadius: layout.controlRadius, backgroundColor: t.input },
        notchedOutline: { borderColor: t.border }
      },
      MuiTableCell: {
        root: { padding: "12px 20px", borderBottomColor: t.panelBorder },
        head: {
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: t.dimmed
        }
      },
      MuiTableRow: {
        hover: { "&$hover:hover": { backgroundColor: t.navHover } }
      },
      MuiChip: { root: { borderRadius: layout.controlRadius } },
      MuiTab: { root: { textTransform: "none", fontWeight: 600 } },
      MuiLink: { root: { color: t.link } },
      MuiAvatar: {
        colorDefault: {
          backgroundColor: palette.navy[isDark ? 5 : 7],
          color: "#FFFFFF"
        }
      },
      // App bars Spoke still uses (outside the shell): navy in light mode, a
      // dark surface rather than a bright indigo bar in dark mode.
      MuiAppBar: {
        colorPrimary: isDark
          ? { backgroundColor: palette.dark[7], color: t.text }
          : { backgroundColor: palette.navy[7], color: "#FFFFFF" }
      }
    }
  };
}

const defaultTheme = buildThemeOptions("light");

const theme = createTheme(defaultTheme);

export { defaultTheme };

export default theme;
