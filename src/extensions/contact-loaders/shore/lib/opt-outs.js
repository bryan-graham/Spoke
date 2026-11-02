import { r, cacheableData } from "../../../../server/models";
import { getFormattedPhoneNumber } from "../../../../lib/phone-format";

// POST /integrations/shore/v1/:organizationId/opt-outs
//
// Shore tells Spoke that numbers have opted out (or the person was suppressed)
// through another channel. Each number is recorded through Spoke's own
// cacheableData.optOut.save, the same path a STOP reply takes, so the Redis
// cache, the opt_out table and contacts in active campaigns all update.

export const MAX_CELLS = 500;
export const REASON_PREFIX = "shore:";
const REASON_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;

export function parseOptOutBody(rawBody) {
  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch (err) {
    return { error: "invalid_json" };
  }
  if (!body || typeof body !== "object" || !Array.isArray(body.cells)) {
    return { error: "cells_required" };
  }
  if (body.cells.length === 0 || body.cells.length > MAX_CELLS) {
    return { error: "cells_count" };
  }
  const reason = body.reason === undefined ? "optout" : body.reason;
  if (typeof reason !== "string" || !REASON_PATTERN.test(reason)) {
    return { error: "invalid_reason" };
  }
  const shoreRequestId =
    typeof body.shoreRequestId === "string"
      ? body.shoreRequestId.slice(0, 64)
      : null;
  return { cells: body.cells, reason, shoreRequestId };
}

// The most recent contact with this cell in the organization, with its
// campaign, so other service managers' onOptOut get a real contact.
async function findLatestContact(cell, organizationId) {
  const contact = await r
    .knex("campaign_contact")
    .join("campaign", "campaign.id", "campaign_contact.campaign_id")
    .where("campaign_contact.cell", cell)
    .where("campaign.organization_id", organizationId)
    .select("campaign_contact.*")
    .orderBy("campaign_contact.id", "desc")
    .first();
  if (!contact) {
    return { contact: null, campaign: null };
  }
  const campaign = await r
    .knex("campaign")
    .where("id", contact.campaign_id)
    .first();
  return { contact, campaign };
}

async function optOutRowExists(cell, organizationId) {
  const row = await r
    .knex("opt_out")
    .where({ cell, organization_id: organizationId })
    .first("id");
  return Boolean(row);
}

// Opts out one already-normalized cell. Returns
// "optedOut" | "alreadyOptedOut" | "failed".
export async function optOutCell({ cell, organization, reason }) {
  const organizationId = Number(organization.id);
  if (await cacheableData.optOut.query({ cell, organizationId })) {
    return "alreadyOptedOut";
  }
  const { contact, campaign } = await findLatestContact(cell, organizationId);
  try {
    await cacheableData.optOut.save({
      cell,
      campaign: campaign || { organization_id: organizationId },
      campaignContactId: contact ? contact.id : undefined,
      contact: contact || { cell, external_id: null },
      assignmentId: null,
      reason: `${REASON_PREFIX}${reason}`,
      noReply: false,
      user: null,
      organization
    });
    return "optedOut";
  } catch (err) {
    // save() writes the opt-out before calling other service managers'
    // onOptOut, which may throw. If the row is there, the opt-out stands.
    const saved = await optOutRowExists(cell, organizationId).catch(
      () => false
    );
    console.warn(
      "shore: error during opt-out save",
      JSON.stringify({
        organizationId,
        campaignContactId: contact ? contact.id : null,
        saved,
        errorName: err && err.name
      })
    );
    return saved ? "optedOut" : "failed";
  }
}

export function optOutsHandler() {
  return async (req, res) => {
    const { organization } = req.shore;
    const parsed = parseOptOutBody(req.body);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }
    const counts = { optedOut: 0, alreadyOptedOut: 0, invalid: 0, failed: 0 };
    const seen = new Set();
    for (const rawCell of parsed.cells) {
      const cell =
        typeof rawCell === "string" && rawCell.length <= 32
          ? getFormattedPhoneNumber(rawCell)
          : "";
      if (!cell) {
        counts.invalid += 1;
        continue;
      }
      if (seen.has(cell)) {
        counts.alreadyOptedOut += 1;
        continue;
      }
      seen.add(cell);
      const outcome = await optOutCell({
        cell,
        organization,
        reason: parsed.reason
      });
      counts[outcome] += 1;
    }
    console.log(
      "shore: opt-outs",
      JSON.stringify({
        organizationId: organization.id,
        shoreRequestId: parsed.shoreRequestId,
        ...counts
      })
    );
    // Any failure → 500 so Shore retries the whole request; the work is
    // idempotent, so the numbers already done are skipped next time.
    return res.status(counts.failed ? 500 : 200).json(counts);
  };
}
