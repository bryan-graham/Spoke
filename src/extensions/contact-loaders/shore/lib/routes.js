import express from "express";
import bodyParser from "body-parser";
import { shoreAuth } from "./auth";
import { optOutsHandler } from "./opt-outs";
import { addReadRoutes } from "./read-api";
import { MENU_PATH, menuHandler } from "./menu";

export const BASE_PATH = "/integrations/shore/v1/:organizationId";

// Shore sends POST bodies with this content type. Spoke's global parsers
// (bodyParser.json and urlencoded in src/server/index.js) don't match it, so
// the body reaches us untouched and we can verify the signature over the exact
// bytes without changing Spoke's core files.
export const BODY_CONTENT_TYPE = "application/vnd.shore+json";

const requireShoreBody = (req, res, next) => {
  if (!req.is(BODY_CONTENT_TYPE) || !Buffer.isBuffer(req.body)) {
    return res.status(415).json({ error: "unsupported_media_type" });
  }
  return next();
};

export function buildRouter() {
  const router = express.Router({ mergeParams: true });

  router.post(
    "/opt-outs",
    bodyParser.raw({ type: BODY_CONTENT_TYPE, limit: "256kb" }),
    requireShoreBody,
    shoreAuth(),
    optOutsHandler()
  );

  router.use(shoreAuth());
  addReadRoutes(router);

  router.use((req, res) => res.status(404).json({ error: "not_found" }));
  return router;
}

export function mountRoutes(app) {
  // Shore's shared sidebar menu, for signed-in Spoke users (session auth).
  app.get(MENU_PATH, menuHandler());
  // Server-to-server endpoints (signed by Shore).
  app.use(BASE_PATH, buildRouter());
}
