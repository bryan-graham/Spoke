import { cacheableData } from "../../../../server/models";
import { getShoreConfig } from "./config";
import { verifySignature, TIMESTAMP_HEADER, SIGNATURE_HEADER } from "./signing";

// Express middleware for every /integrations/shore/v1/:organizationId route.
// Order matters:
//   1. 404 unless the organization exists and has Shore configured, so
//      unconfigured instances expose nothing.
//   2. 401 unless the request is signed with that organization's key.
// It never looks at Spoke's session or signed-in user.
//
// For POSTs, req.body must already be the raw Buffer (see routes), because the
// signature covers the exact bytes.
export function shoreAuth() {
  return async (req, res, next) => {
    try {
      const { organizationId } = req.params;
      if (!/^\d{1,10}$/.test(String(organizationId))) {
        return res.status(404).json({ error: "not_found" });
      }
      const organization = await cacheableData.organization.load(
        Number(organizationId)
      );
      const config = organization && getShoreConfig(organization);
      if (!config) {
        return res.status(404).json({ error: "not_found" });
      }

      const body =
        req.method === "GET" || req.method === "HEAD"
          ? ""
          : Buffer.isBuffer(req.body)
          ? req.body
          : null;
      if (body === null) {
        // The raw body wasn't captured (wrong content type); the route
        // answers 415 before getting here, so this is defensive.
        return res.status(415).json({ error: "unsupported_media_type" });
      }

      const result = verifySignature({
        key: config.key,
        timestamp: req.get(TIMESTAMP_HEADER),
        signature: req.get(SIGNATURE_HEADER),
        method: req.method,
        path: req.originalUrl,
        body
      });
      if (!result.ok) {
        console.warn(
          "shore: rejected request",
          JSON.stringify({ organizationId, reason: result.reason })
        );
        return res.status(401).json({ error: "unauthorized" });
      }

      req.shore = { organization, config };
      return next();
    } catch (err) {
      console.error(
        "shore: auth error",
        JSON.stringify({ name: err && err.name, code: err && err.code })
      );
      return res.status(500).json({ error: "internal_error" });
    }
  };
}
