import { r } from "../models";

// An organization's own logos, one per colour scheme, set in Settings and
// shown in the sidebar when Spoke isn't showing Shore's menu (with Shore's
// menu the logo comes from Shore). Served at /org-logo/:organizationId/:scheme.

export const SCHEMES = ["light", "dark"];
export const MAX_BYTES = 512 * 1024;
export const LOGO_PATH = "/org-logo";

// Raster images only: an SVG served from Spoke's own address could run
// script if opened directly.
const TYPES = {
  "image/png": bytes =>
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47,
  "image/jpeg": bytes =>
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff,
  "image/gif": bytes => bytes.slice(0, 4).toString("ascii") === "GIF8",
  "image/webp": bytes =>
    bytes.slice(0, 4).toString("ascii") === "RIFF" &&
    bytes.slice(8, 12).toString("ascii") === "WEBP"
};

export class LogoError extends Error {}

// "data:image/png;base64,...." -> { contentType, data (base64) }, or throws a
// LogoError saying what's wrong.
export function parseLogo(dataUrl) {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    String(dataUrl || "")
  );
  if (!match) {
    throw new LogoError("Choose a PNG, JPEG, GIF or WebP image.");
  }
  const contentType = match[1].toLowerCase();
  const check = TYPES[contentType];
  if (!check) {
    throw new LogoError("Choose a PNG, JPEG, GIF or WebP image.");
  }
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (bytes.length > MAX_BYTES) {
    throw new LogoError("That image is over 512 KB; choose a smaller one.");
  }
  if (!check(bytes)) {
    throw new LogoError("That file isn't the image type it says it is.");
  }
  return { contentType, data: bytes.toString("base64") };
}

const version = updatedAt => {
  const time = new Date(updatedAt).getTime();
  return Number.isNaN(time) ? "0" : String(time);
};

export const logoUrl = (organizationId, scheme, updatedAt) =>
  `${LOGO_PATH}/${organizationId}/${scheme}?v=${version(updatedAt)}`;

// { light, dark }: the address of each uploaded version (the ?v= changes
// with every upload, so each address can be cached for good), or null.
export async function getLogoUrls(organizationId) {
  const rows = await r
    .knex("organization_logo")
    .where({ organization_id: organizationId })
    .select("scheme", "updated_at");
  const urls = { light: null, dark: null };
  rows.forEach(row => {
    if (SCHEMES.includes(row.scheme)) {
      urls[row.scheme] = logoUrl(organizationId, row.scheme, row.updated_at);
    }
  });
  return urls;
}

export async function saveLogo(organizationId, scheme, dataUrl) {
  if (!SCHEMES.includes(scheme)) {
    throw new LogoError("Unknown colour scheme.");
  }
  if (!dataUrl) {
    await r
      .knex("organization_logo")
      .where({ organization_id: organizationId, scheme })
      .del();
    return;
  }
  const { contentType, data } = parseLogo(dataUrl);
  await r.knex.transaction(async trx => {
    await trx("organization_logo")
      .where({ organization_id: organizationId, scheme })
      .del();
    await trx("organization_logo").insert({
      organization_id: organizationId,
      scheme,
      content_type: contentType,
      data,
      updated_at: new Date()
    });
  });
}

export async function readLogo(organizationId, scheme) {
  if (!SCHEMES.includes(scheme) || !/^\d+$/.test(String(organizationId))) {
    return null;
  }
  const row = await r
    .knex("organization_logo")
    .where({ organization_id: organizationId, scheme })
    .first("content_type", "data", "updated_at");
  return row || null;
}

// GET /org-logo/:organizationId/:scheme — public, like Shore's publicLogo,
// so it loads anywhere the sidebar does.
export async function logoHandler(req, res) {
  try {
    const row = await readLogo(req.params.organizationId, req.params.scheme);
    if (!row) {
      res.status(404).end();
      return;
    }
    const current = version(row.updated_at);
    res.set({
      "Content-Type": row.content_type,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control":
        req.query.v === current
          ? "public, max-age=31536000, immutable"
          : "no-cache"
    });
    res.send(Buffer.from(row.data, "base64"));
  } catch (err) {
    res.status(500).end();
  }
}
