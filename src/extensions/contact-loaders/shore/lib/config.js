import { getConfig } from "../../../../server/api/lib/config";

// Config keys for the Shore extension. Each is read with getConfig(key, organization),
// so a value in the organization's features JSON wins over the environment.
// CONTACT_LOADERS (which must include "shore") is read by Spoke itself, from the
// environment only.
export const REQUIRED_KEYS = [
  "SHORE_URL",
  "SHORE_CAMPAIGN",
  "SHORE_INTEGRATION_KEY"
];

export const DEFAULTS = {
  cacheSeconds: 60,
  timeoutMs: 10000,
  settleSeconds: 15
};

export const MIN_KEY_LENGTH = 32;

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

export function parseShoreUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  let url;
  try {
    url = new URL(value);
  } catch (err) {
    return null;
  }
  const isLocal = LOCAL_HOSTS.includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    return null;
  }
  // Keep any path prefix, without a trailing slash, and drop query/hash.
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

const numberOr = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && value !== "" && value !== null
    ? n
    : fallback;
};

// Returns the validated config for an organization, or null when the extension
// isn't configured for it. Never throws.
export function getShoreConfig(organization) {
  const baseUrl = parseShoreUrl(getConfig("SHORE_URL", organization));
  const campaign = getConfig("SHORE_CAMPAIGN", organization);
  const key = getConfig("SHORE_INTEGRATION_KEY", organization);
  if (
    !baseUrl ||
    !campaign ||
    typeof campaign !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(campaign) ||
    !key ||
    typeof key !== "string" ||
    key.length < MIN_KEY_LENGTH
  ) {
    return null;
  }
  return {
    baseUrl,
    campaign,
    key,
    cacheSeconds: numberOr(
      getConfig("SHORE_CACHE_SECONDS", organization),
      DEFAULTS.cacheSeconds
    ),
    timeoutMs: numberOr(
      getConfig("SHORE_TIMEOUT_MS", organization),
      DEFAULTS.timeoutMs
    ),
    settleSeconds: numberOr(
      getConfig("SHORE_SETTLE_SECONDS", organization),
      DEFAULTS.settleSeconds
    )
  };
}
