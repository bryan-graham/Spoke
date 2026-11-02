import crypto from "crypto";

// Every request between Spoke and Shore, in either direction, is signed with
// HMAC-SHA256 under the shared SHORE_INTEGRATION_KEY.
//
//   X-Shore-Timestamp: <unix seconds>
//   X-Shore-Signature: hex(HMAC(key, `${timestamp}.${METHOD}.${pathWithQuery}.${rawBody}`))
//
// The body is the exact bytes sent (empty for GET).

export const TIMESTAMP_HEADER = "x-shore-timestamp";
export const SIGNATURE_HEADER = "x-shore-signature";
export const MAX_SKEW_SECONDS = 300;

const toBuffer = body => {
  if (body === undefined || body === null) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  return Buffer.from(String(body), "utf8");
};

export function computeSignature({ key, timestamp, method, path, body }) {
  const hmac = crypto.createHmac("sha256", key);
  hmac.update(`${timestamp}.${String(method).toUpperCase()}.${path}.`, "utf8");
  hmac.update(toBuffer(body));
  return hmac.digest("hex");
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

// Headers to attach to an outgoing request.
export function signedHeaders({ key, method, path, body, timestamp }) {
  const ts = String(timestamp === undefined ? nowSeconds() : timestamp);
  return {
    "X-Shore-Timestamp": ts,
    "X-Shore-Signature": computeSignature({
      key,
      timestamp: ts,
      method,
      path,
      body
    })
  };
}

// Verifies an incoming request. Returns { ok: true } or { ok: false, reason }.
export function verifySignature({
  key,
  timestamp,
  signature,
  method,
  path,
  body,
  now
}) {
  if (!timestamp || !signature) {
    return { ok: false, reason: "missing_signature" };
  }
  if (!/^\d{1,12}$/.test(String(timestamp))) {
    return { ok: false, reason: "bad_timestamp" };
  }
  const current = now === undefined ? nowSeconds() : now;
  if (Math.abs(current - Number(timestamp)) > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }
  if (!/^[0-9a-f]{64}$/i.test(String(signature))) {
    return { ok: false, reason: "bad_signature" };
  }
  const expected = Buffer.from(
    computeSignature({ key, timestamp, method, path, body }),
    "hex"
  );
  const given = Buffer.from(String(signature), "hex");
  if (
    given.length !== expected.length ||
    !crypto.timingSafeEqual(given, expected)
  ) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}
