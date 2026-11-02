import fs from "fs";
import path from "path";
import { getConfig } from "../../../../server/api/lib/config";
import { parseShoreUrl } from "./config";

// Shore's brand files for a Spoke connected to Shore: drop them in
// src/extensions/contact-loaders/shore/assets/ (see the README there).
//
// When this Spoke is set up for Shore (the shore loader is enabled and
// SHORE_URL is set), the page uses Shore's favicon and the sidebar shows
// Shore's wordmark; otherwise Spoke keeps its own favicon and no Shore mark.
// Any file that's missing falls back the same way, so each can be added on
// its own.

export const ASSETS_DIR = path.join(__dirname, "..", "assets");
export const ASSETS_PATH = "/shore-assets";

// Served files: name -> content type. Nothing else in the folder is served.
export const ASSET_FILES = {
  "favicon.svg": "image/svg+xml",
  "favicon.png": "image/png",
  "favicon.ico": "image/x-icon",
  "apple-touch-icon.png": "image/png",
  "shore-logo.svg": "image/svg+xml"
};

const exists = (dir, name) => {
  try {
    return fs.statSync(path.join(dir, name)).isFile();
  } catch (err) {
    return false;
  }
};

export function shoreConfigured() {
  const loaders = String(getConfig("CONTACT_LOADERS") || "").split(",");
  return (
    loaders.map(s => s.trim()).includes("shore") &&
    Boolean(parseShoreUrl(getConfig("SHORE_URL")))
  );
}

// URLs of the brand files present, or null when this Spoke isn't set up
// for Shore. { favicon, faviconType, appleTouchIcon, logo }, each null if
// its file is missing.
export function shoreBranding({ dir = ASSETS_DIR, configured } = {}) {
  const isConfigured =
    configured === undefined ? shoreConfigured() : configured;
  if (!isConfigured) {
    return null;
  }
  const url = name => (exists(dir, name) ? `${ASSETS_PATH}/${name}` : null);
  const faviconName = ["favicon.svg", "favicon.png", "favicon.ico"].find(name =>
    exists(dir, name)
  );
  return {
    favicon: faviconName ? `${ASSETS_PATH}/${faviconName}` : null,
    faviconType: faviconName ? ASSET_FILES[faviconName] : null,
    appleTouchIcon: url("apple-touch-icon.png"),
    logo: url("shore-logo.svg")
  };
}

export function assetsHandler({ dir = ASSETS_DIR } = {}) {
  return (req, res) => {
    const { name } = req.params;
    if (
      !Object.prototype.hasOwnProperty.call(ASSET_FILES, name) ||
      !exists(dir, name)
    ) {
      return res.status(404).end();
    }
    res.set("Content-Type", ASSET_FILES[name]);
    res.set("Cache-Control", "public, max-age=86400");
    // SVGs are images here, never documents that run scripts.
    res.set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'"
    );
    res.set("X-Content-Type-Options", "nosniff");
    return res.sendFile(path.join(dir, name));
  };
}
