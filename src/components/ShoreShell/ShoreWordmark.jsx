import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { fonts, v } from "../../styles/shore-tokens";

// The quiet "powered by" Shore mark at the bottom of the sidebar, in the
// scheme's faint colour (light or dark).
//
// Uses Shore's wordmark from src/extensions/contact-loaders/shore/assets/
// shore-logo.svg when it's there (the server passes its URL as
// window.SHORE_LOGO_URL). The SVG is used as a mask, so its shape is drawn
// in the current faint colour whatever colour the file itself uses, the way
// Shore's Logo.tsx draws in currentColor. Without the file, the word "Shore"
// in DM Sans stands in.

export const logoUrl = () =>
  (typeof window !== "undefined" && window.SHORE_LOGO_URL) || "";

export default function ShoreWordmark({ height, src }) {
  const url = src === undefined ? logoUrl() : src;
  // The logo's width/height ratio, from the image itself.
  const [ratio, setRatio] = useState(null);
  useEffect(() => {
    if (!url || typeof Image === "undefined") {
      return undefined;
    }
    let active = true;
    const img = new Image();
    img.onload = () => {
      if (active && img.naturalWidth && img.naturalHeight) {
        setRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = url;
    return () => {
      active = false;
    };
  }, [url]);

  if (url && ratio) {
    const mask = `url("${url}") center / contain no-repeat`;
    return (
      <span
        role="img"
        aria-label="Shore"
        style={{
          display: "inline-block",
          height,
          width: Math.round(height * ratio),
          backgroundColor: v("faint"),
          WebkitMask: mask,
          mask
        }}
      />
    );
  }

  return (
    <span
      aria-label="Shore"
      style={{
        display: "inline-block",
        color: v("faint"),
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

ShoreWordmark.propTypes = { height: PropTypes.number, src: PropTypes.string };
ShoreWordmark.defaultProps = { height: 17 };
