import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import { r, cacheableData } from "../../../../server/models";
import { getConfig } from "../../../../server/api/lib/config";
import { parseShoreUrl } from "./config";

// GET /shore-menu/:organizationId
//
// Shore's shared sidebar menu for the signed-in Spoke user
// (docs/shore-design-guide.md, "Shared menu"). The browser can't send Shore's
// sign-in cookie, so Spoke's server asks Shore on the user's behalf:
//
//   GET {SHORE_URL}/api/integrations/spoke/{SHORE_CAMPAIGN}/menu
//   Authorization: Bearer <HS256 JWT, sub=email, aud="shore:menu", exp<=5min>
//
// signed with TOKEN_AUTH_SHARED_SECRET, the secret Shore signs Spoke sign-ins
// with. The response is cleaned (only http(s) links, bounded strings) because
// it's rendered as links in Spoke, and never cached.

export const MENU_PATH = "/shore-menu/:organizationId";
export const MENU_AUDIENCE = "shore:menu";
export const MENU_TOKEN_SECONDS = 60;
export const MENU_TIMEOUT_MS = 3000;

const str = (value, max = 200) =>
  typeof value === "string" ? value.slice(0, max) : null;

const httpUrl = value => {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch (err) {
    return null;
  }
};

const ICON_NAME = /^[a-z0-9-]{1,64}$/;

// The person's colour scheme in Shore, shared across apps. null when Shore
// doesn't send one (or sends something else).
export const COLOR_SCHEMES = ["auto", "light", "dark"];

function cleanItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const key = str(item.key, 64);
  const label = str(item.label, 80);
  if (!key || !label) {
    return null;
  }
  const url = httpUrl(item.url);
  // Everything but Spoke's own "texting" item must link somewhere safe.
  if (!url && key !== "texting") {
    return null;
  }
  const out = {
    key,
    label,
    icon:
      typeof item.icon === "string" && ICON_NAME.test(item.icon)
        ? item.icon
        : null,
    url
  };
  if (item.external === true) {
    out.external = true;
  }
  if (Number.isInteger(item.count) && item.count > 0) {
    out.count = Math.min(item.count, 9999);
  }
  return out;
}

export function cleanMenu(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.groups)) {
    return null;
  }
  const org = raw.org && typeof raw.org === "object" ? raw.org : {};
  const user = raw.user && typeof raw.user === "object" ? raw.user : {};
  return {
    org: { slug: str(org.slug, 128), name: str(org.name, 120) },
    user: {
      name: str(user.name, 120),
      email: str(user.email, 254),
      role: str(user.role, 32),
      colorScheme: COLOR_SCHEMES.includes(user.colorScheme)
        ? user.colorScheme
        : null
    },
    groups: raw.groups.slice(0, 20).map(group => ({
      label: group && str(group.label, 60),
      items: ((group && Array.isArray(group.items) && group.items) || [])
        .slice(0, 50)
        .map(cleanItem)
        .filter(Boolean)
    }))
  };
}

export function menuConfig(organization) {
  const baseUrl = parseShoreUrl(getConfig("SHORE_URL", organization));
  const campaign = getConfig("SHORE_CAMPAIGN", organization);
  const secret = getConfig("TOKEN_AUTH_SHARED_SECRET", organization);
  if (
    !baseUrl ||
    typeof campaign !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(campaign) ||
    !secret
  ) {
    return null;
  }
  return { baseUrl, campaign, secret };
}

export function signMenuToken(secret, email) {
  return jwt.sign({ sub: email, aud: MENU_AUDIENCE }, secret, {
    algorithm: "HS256",
    expiresIn: MENU_TOKEN_SECONDS
  });
}

async function isMember(user, organizationId) {
  if (user.is_superadmin) {
    return true;
  }
  const row = await r
    .knex("user_organization")
    .where({ user_id: user.id, organization_id: organizationId })
    .first("id");
  return Boolean(row);
}

const reply = (res, status, body) =>
  res
    .status(status)
    .set("Cache-Control", "no-store")
    .json(body);

export function menuHandler() {
  return async (req, res) => {
    const { organizationId } = req.params;
    if (!req.user) {
      return reply(res, 401, { error: "unauthorized" });
    }
    if (!/^\d{1,10}$/.test(String(organizationId))) {
      return reply(res, 404, { error: "not_found" });
    }
    try {
      const orgId = Number(organizationId);
      if (!(await isMember(req.user, orgId))) {
        return reply(res, 404, { error: "not_found" });
      }
      const organization = await cacheableData.organization.load(orgId);
      const config = organization && menuConfig(organization);
      if (!config || !req.user.email) {
        return reply(res, 404, { error: "not_configured" });
      }
      const url = `${
        config.baseUrl
      }/api/integrations/spoke/${encodeURIComponent(config.campaign)}/menu`;
      let shoreRes;
      try {
        shoreRes = await fetch(url, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${signMenuToken(
              config.secret,
              req.user.email
            )}`
          },
          timeout: MENU_TIMEOUT_MS,
          redirect: "error"
        });
      } catch (err) {
        return reply(res, 502, { error: "shore_unreachable" });
      }
      if (shoreRes.status === 401 || shoreRes.status === 403) {
        // Bad token (secrets differ) or not an active member in Shore.
        console.warn(
          "shore: menu refused",
          JSON.stringify({ organizationId: orgId, status: shoreRes.status })
        );
        return reply(res, 404, { error: "not_a_shore_member" });
      }
      if (!shoreRes.ok) {
        return reply(res, 502, { error: "shore_error" });
      }
      const menu = cleanMenu(await shoreRes.json().catch(() => null));
      if (!menu) {
        return reply(res, 502, { error: "shore_bad_response" });
      }
      return reply(res, 200, menu);
    } catch (err) {
      console.error(
        "shore: menu error",
        JSON.stringify({ name: err && err.name, code: err && err.code })
      );
      return reply(res, 500, { error: "internal_error" });
    }
  };
}
