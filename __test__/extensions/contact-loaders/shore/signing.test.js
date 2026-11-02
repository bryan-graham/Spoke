import {
  computeSignature,
  signedHeaders,
  verifySignature,
  MAX_SKEW_SECONDS
} from "../../../../src/extensions/contact-loaders/shore/lib/signing";
import {
  getShoreConfig,
  parseShoreUrl
} from "../../../../src/extensions/contact-loaders/shore/lib/config";

const KEY = "k".repeat(40);
const NOW = 1762000000;

const signed = overrides => {
  const req = {
    method: "POST",
    path: "/integrations/shore/v1/1/opt-outs",
    body: Buffer.from('{"cells":["+15555550123"]}'),
    ...overrides
  };
  const headers = signedHeaders({ key: KEY, timestamp: NOW, ...req });
  return {
    key: KEY,
    timestamp: headers["X-Shore-Timestamp"],
    signature: headers["X-Shore-Signature"],
    now: NOW,
    ...req
  };
};

describe("shore signing", () => {
  it("accepts a correctly signed request", () => {
    expect(verifySignature(signed())).toEqual({ ok: true });
  });

  it("accepts a GET with an empty body and a query string", () => {
    const req = signed({
      method: "GET",
      path: "/integrations/shore/v1/1/messages?afterId=10&limit=5",
      body: ""
    });
    expect(verifySignature(req)).toEqual({ ok: true });
  });

  it("signs the exact string documented in the design", () => {
    const crypto = require("crypto");
    const expected = crypto
      .createHmac("sha256", KEY)
      .update(`${NOW}.GET./a?b=1.`)
      .digest("hex");
    expect(
      computeSignature({
        key: KEY,
        timestamp: NOW,
        method: "get",
        path: "/a?b=1",
        body: ""
      })
    ).toBe(expected);
  });

  it("rejects the wrong key", () => {
    expect(verifySignature({ ...signed(), key: "x".repeat(40) })).toEqual({
      ok: false,
      reason: "bad_signature"
    });
  });

  it("rejects a tampered body, path, query or method", () => {
    const req = signed();
    expect(
      verifySignature({ ...req, body: Buffer.from('{"cells":[]}') }).ok
    ).toBe(false);
    expect(
      verifySignature({ ...req, path: "/integrations/shore/v1/2/opt-outs" }).ok
    ).toBe(false);
    expect(verifySignature({ ...req, path: `${req.path}?limit=1` }).ok).toBe(
      false
    );
    expect(verifySignature({ ...req, method: "PUT" }).ok).toBe(false);
  });

  it("rejects a stale or future timestamp", () => {
    const req = signed();
    expect(
      verifySignature({ ...req, now: NOW + MAX_SKEW_SECONDS + 1 })
    ).toEqual({ ok: false, reason: "stale_timestamp" });
    expect(
      verifySignature({ ...req, now: NOW - MAX_SKEW_SECONDS - 1 })
    ).toEqual({ ok: false, reason: "stale_timestamp" });
    expect(verifySignature({ ...req, now: NOW + MAX_SKEW_SECONDS }).ok).toBe(
      true
    );
  });

  it("rejects missing or malformed headers", () => {
    const req = signed();
    expect(verifySignature({ ...req, signature: undefined }).reason).toBe(
      "missing_signature"
    );
    expect(verifySignature({ ...req, timestamp: "abc" }).reason).toBe(
      "bad_timestamp"
    );
    expect(verifySignature({ ...req, signature: "zz" }).reason).toBe(
      "bad_signature"
    );
  });
});

describe("shore config", () => {
  const org = features => ({ id: 1, features: JSON.stringify(features) });
  const good = {
    SHORE_URL: "https://app.shore.example",
    SHORE_CAMPAIGN: "gotv-2026",
    SHORE_INTEGRATION_KEY: KEY
  };

  it("reads the config from organization features, with defaults", () => {
    expect(getShoreConfig(org(good))).toEqual({
      baseUrl: "https://app.shore.example",
      campaign: "gotv-2026",
      key: KEY,
      cacheSeconds: 60,
      timeoutMs: 10000,
      settleSeconds: 15
    });
  });

  it("reads optional numbers", () => {
    const config = getShoreConfig(
      org({ ...good, SHORE_CACHE_SECONDS: "5", SHORE_SETTLE_SECONDS: "0" })
    );
    expect(config.cacheSeconds).toBe(5);
    expect(config.settleSeconds).toBe(0);
  });

  it("is null when anything required is missing or invalid", () => {
    expect(getShoreConfig(org({}))).toBeNull();
    expect(getShoreConfig(org({ ...good, SHORE_URL: "" }))).toBeNull();
    expect(
      getShoreConfig(org({ ...good, SHORE_URL: "http://shore.example" }))
    ).toBeNull();
    expect(
      getShoreConfig(org({ ...good, SHORE_INTEGRATION_KEY: "short" }))
    ).toBeNull();
    expect(
      getShoreConfig(org({ ...good, SHORE_CAMPAIGN: "../etc" }))
    ).toBeNull();
  });

  it("allows http only for localhost, and strips trailing slashes", () => {
    expect(parseShoreUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000"
    );
    expect(parseShoreUrl("https://shore.example/app/?x=1")).toBe(
      "https://shore.example/app"
    );
    expect(parseShoreUrl("http://10.0.0.1")).toBeNull();
    expect(parseShoreUrl("ftp://shore.example")).toBeNull();
    expect(parseShoreUrl("not a url")).toBeNull();
  });
});
