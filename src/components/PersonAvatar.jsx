import PropTypes from "prop-types";
import React from "react";
import { useTheme } from "@material-ui/core/styles";
import { palette, fonts } from "../styles/shore-tokens";

// Shore's people avatar (docs/shore-design-guide.md, "People"): round, with
// the person's initials, in a colour picked from the name (navy, ocean,
// seagrass, coral, sand): pale tints in light mode, solid in dark.

const COLORS = ["navy", "ocean", "seagrass", "coral", "sand"];

export function personInitials(name) {
  const words = String(name || "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return words[0][0].toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function avatarColorName(name) {
  const text = String(name || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function avatarColors(name, scheme) {
  const color = avatarColorName(name);
  const scale = palette[color];
  if (scheme === "dark") {
    return color === "sand"
      ? { backgroundColor: scale[3], color: palette.navy[9] }
      : { backgroundColor: scale[6], color: "#FFFFFF" };
  }
  return { backgroundColor: scale[1], color: scale[8] };
}

export default function PersonAvatar({ name, size = 36 }) {
  const theme = useTheme();
  const scheme = theme && theme.palette && theme.palette.type;
  return (
    <span
      aria-hidden
      style={{
        ...avatarColors(name, scheme),
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: fonts.heading,
        fontWeight: 700,
        fontSize: Math.round(size * 0.38),
        letterSpacing: "0.01em"
      }}
    >
      {personInitials(name)}
    </span>
  );
}

PersonAvatar.propTypes = {
  name: PropTypes.string,
  size: PropTypes.number
};
