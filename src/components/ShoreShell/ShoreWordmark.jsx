import React from "react";
import PropTypes from "prop-types";
import { fonts, tokens } from "../../styles/shore-tokens";

// The quiet "powered by" Shore mark at the bottom of the sidebar.
//
// Placeholder: the word "Shore" set in DM Sans. Replace with the SVG from
// Shore's web/src/components/Logo.tsx (drawn in currentColor) when it's
// copied in.
export default function ShoreWordmark({ height }) {
  return (
    <span
      aria-label="Shore"
      style={{
        display: "inline-block",
        color: tokens.faint,
        fontFamily: fonts.heading,
        fontWeight: 700,
        fontSize: height,
        lineHeight: `${height}px`,
        letterSpacing: "-0.02em",
        userSelect: "none"
      }}
    >
      Shore
    </span>
  );
}

ShoreWordmark.propTypes = { height: PropTypes.number };
ShoreWordmark.defaultProps = { height: 17 };
