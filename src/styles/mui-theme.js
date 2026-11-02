import { createTheme } from "@material-ui/core/styles";
import { palette, tokens, fonts, layout } from "./shore-tokens";

/**
 * The default theme for the app, matching Shore's design
 * (docs/shore-design-guide.md). Light mode only for now.
 *
 * An organization's custom palette (Settings) still replaces `palette`; the
 * Shore shell's sidebar and canvas use the tokens directly, so they keep
 * Shore's look either way.
 */
const heading = {
  fontFamily: fonts.heading,
  fontWeight: 700,
  letterSpacing: "-0.02em"
};

const defaultTheme = {
  palette: {
    type: "light",
    primary: {
      main: palette.navy[7],
      light: palette.navy[5],
      dark: palette.navy[9],
      contrastText: "#FFFFFF"
    },
    secondary: {
      main: palette.ocean[7],
      contrastText: "#FFFFFF"
    },
    error: { main: palette.coral[6], contrastText: "#FFFFFF" },
    success: { main: palette.seagrass[6], contrastText: "#FFFFFF" },
    info: { main: palette.ocean[7], contrastText: "#FFFFFF" },
    warning: { main: palette.sand[6], contrastText: palette.navy[9] },
    text: { primary: tokens.text, secondary: tokens.dimmed },
    divider: tokens.panelBorder,
    background: { default: tokens.canvas, paper: tokens.surface }
  },
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
        body: { backgroundColor: tokens.canvas, color: tokens.text },
        a: { color: tokens.link }
      }
    },
    MuiButton: {
      root: { borderRadius: layout.controlRadius },
      contained: { boxShadow: "none", "&:hover": { boxShadow: "none" } },
      outlined: { backgroundColor: tokens.surface, borderColor: tokens.border }
    },
    MuiPaper: {
      rounded: { borderRadius: layout.controlRadius }
    },
    MuiCard: {
      root: {
        borderRadius: layout.cardRadius,
        border: `1px solid ${tokens.panelBorder}`,
        boxShadow: "none"
      }
    },
    MuiCardContent: { root: { padding: 20 } },
    MuiDialog: { paper: { borderRadius: layout.cardRadius } },
    MuiOutlinedInput: { root: { borderRadius: layout.controlRadius } },
    MuiTableCell: {
      root: { padding: "12px 20px", borderBottomColor: tokens.panelBorder },
      head: {
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: tokens.dimmed
      }
    },
    MuiTableRow: {
      hover: { "&$hover:hover": { backgroundColor: tokens.navHover } }
    },
    MuiChip: { root: { borderRadius: layout.controlRadius } },
    MuiTab: { root: { textTransform: "none", fontWeight: 600 } },
    MuiLink: { root: { color: tokens.link } },
    MuiAvatar: {
      colorDefault: { backgroundColor: palette.navy[7], color: "#FFFFFF" }
    }
  }
};

const theme = createTheme(defaultTheme);

export { defaultTheme };

export default theme;
