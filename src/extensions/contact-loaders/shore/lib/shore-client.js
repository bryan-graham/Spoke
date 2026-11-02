import fetch from "node-fetch";
import { signedHeaders } from "./signing";

// Client for Shore's Spoke-facing endpoints:
//   ${SHORE_URL}/api/spoke/v1/:campaign/...
// Every request is signed. Errors are thrown as ShoreError with a short code
// that is safe to show to admins and to log (never personal data).

export const MAX_PAGE_LIMIT = 5000;

export class ShoreError extends Error {
  constructor(code, status) {
    super(status ? `${code} (HTTP ${status})` : code);
    this.name = "ShoreError";
    this.code = code;
    this.status = status || null;
  }
}

const apiPath = (config, suffix) =>
  `/api/spoke/v1/${encodeURIComponent(config.campaign)}${suffix}`;

async function shoreRequest(config, method, suffix, payload, { onStatus }) {
  const url = new URL(`${config.baseUrl}${apiPath(config, suffix)}`);
  const pathWithQuery = `${url.pathname}${url.search}`;
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const headers = {
    Accept: "application/json",
    ...signedHeaders({
      key: config.key,
      method,
      path: pathWithQuery,
      body
    })
  };
  if (body) {
    headers["Content-Type"] = "application/json";
  }

  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body || undefined,
      timeout: config.timeoutMs,
      redirect: "error"
    });
  } catch (err) {
    throw new ShoreError("shore_unreachable");
  }

  if (res.status < 200 || res.status >= 300) {
    const mapped = onStatus && onStatus(res.status);
    if (mapped) {
      throw new ShoreError(mapped, res.status);
    }
    if (res.status >= 500) {
      throw new ShoreError("shore_unreachable", res.status);
    }
    throw new ShoreError("shore_rejected", res.status);
  }

  try {
    return await res.json();
  } catch (err) {
    throw new ShoreError("shore_bad_response", res.status);
  }
}

export async function listSegments(config) {
  const json = await shoreRequest(config, "GET", "/segments", undefined, {});
  if (!json || !Array.isArray(json.segments)) {
    throw new ShoreError("shore_bad_response");
  }
  return json.segments;
}

export async function startLoad(
  config,
  segmentId,
  { spokeCampaignId, spokeCampaignTitle, spokeJobId }
) {
  const json = await shoreRequest(
    config,
    "POST",
    `/segments/${encodeURIComponent(segmentId)}/loads`,
    { spokeCampaignId, spokeCampaignTitle, spokeJobId },
    { onStatus: status => (status === 404 ? "segment_not_found" : null) }
  );
  if (!json || !json.loadId) {
    throw new ShoreError("shore_bad_response");
  }
  return json;
}

export async function getContactsPage(config, loadId, { cursor, limit }) {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }
  params.set("limit", String(Math.min(limit || 1000, MAX_PAGE_LIMIT)));
  const json = await shoreRequest(
    config,
    "GET",
    `/loads/${encodeURIComponent(loadId)}/contacts?${params.toString()}`,
    undefined,
    {
      onStatus: status =>
        status === 404 || status === 410 ? "load_expired" : null
    }
  );
  if (!json || !Array.isArray(json.contacts)) {
    throw new ShoreError("shore_bad_response");
  }
  return { contacts: json.contacts, nextCursor: json.nextCursor || null };
}
