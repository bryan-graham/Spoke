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

// A logo's shape, remembered per address. Shore's logo addresses change
// (?v=) with every upload, so a remembered shape never goes stale.
const SHAPE_PREFIX = "spoke.logoShape.";
const shapes = {};

const rememberedShape = url => {
  if (!url) {
    return null;
  }
  if (shapes[url]) {
    return shapes[url];
  }
  try {
    const ratio = Number(window.localStorage.getItem(SHAPE_PREFIX + url));
    return ratio > 0 ? ratio : null;
  } catch (err) {
    return null;
  }
};

const rememberShape = (url, ratio) => {
  shapes[url] = ratio;
  try {
    window.localStorage.setItem(SHAPE_PREFIX + url, String(ratio));
  } catch (err) {
    // ignore
  }
};

const initialShape = url => {
  if (!url) {
    return { status: "none", ratio: null };
  }
  const ratio = rememberedShape(url);
  return ratio
    ? { status: "ready", ratio }
    : { status: "loading", ratio: null };
};

// Loads an image to learn its shape. { status: "none" | "loading" | "ready" |
// "failed", ratio }. A shape seen before is "ready" at once.
export function useImageShape(url) {
  const [state, setState] = useState(() => initialShape(url));
  useEffect(() => {
    if (!url || typeof Image === "undefined") {
      setState({ status: "none", ratio: null });
      return undefined;
    }
    let active = true;
    setState(initialShape(url));
    const img = new Image();
    img.onload = () => {
      if (active) {
        if (img.naturalWidth && img.naturalHeight) {
          const ratio = img.naturalWidth / img.naturalHeight;
          rememberShape(url, ratio);
          setState({ status: "ready", ratio });
        } else {
          setState({ status: "failed", ratio: null });
        }
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
