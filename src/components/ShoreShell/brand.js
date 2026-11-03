import { useEffect, useState } from "react";

// The campaign's logo from Shore's menu (org.publicLogo: { light, dark },
// addresses that load without a Shore sign-in). Each version is present only
// if it was uploaded; use the one for the current scheme, else the other.
export function pickLogo(publicLogo, scheme) {
  if (!publicLogo) {
    return null;
  }
  const { light, dark } = publicLogo;
  return (scheme === "dark" ? dark || light : light || dark) || null;
}

// Wider than this (width / height), a logo is a wordmark and stands alone;
// otherwise it's square-ish and sits beside the campaign name.
export const WORDMARK_RATIO = 1.6;

export const isWordmark = ratio => ratio > WORDMARK_RATIO;

// Loads an image to learn its shape. { status: "none" | "loading" | "ready" |
// "failed", ratio }.
export function useImageShape(url) {
  const [state, setState] = useState({
    status: url ? "loading" : "none",
    ratio: null
  });
  useEffect(() => {
    if (!url || typeof Image === "undefined") {
      setState({ status: "none", ratio: null });
      return undefined;
    }
    let active = true;
    setState({ status: "loading", ratio: null });
    const img = new Image();
    img.onload = () => {
      if (active) {
        setState(
          img.naturalWidth && img.naturalHeight
            ? { status: "ready", ratio: img.naturalWidth / img.naturalHeight }
            : { status: "failed", ratio: null }
        );
      }
    };
    img.onerror = () => {
      if (active) {
        setState({ status: "failed", ratio: null });
      }
    };
    img.src = url;
    return () => {
      active = false;
    };
  }, [url]);
  return state;
}

export const pageTitle = orgName =>
  orgName ? `${orgName} • Shore • Texting` : "Shore • Texting";
