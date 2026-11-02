import { r } from "../../../server/models";
import { getFormattedPhoneNumber } from "../../../lib/phone-format";
import {
  completeContactLoad,
  failedContactLoad,
  getTimezoneByZip
} from "../../../workers/jobs";
import { getShoreConfig, REQUIRED_KEYS } from "./lib/config";
import {
  listSegments,
  startLoad,
  getContactsPage,
  ShoreError
} from "./lib/shore-client";
import { mountRoutes } from "./lib/routes";

// Shore contact loader. See docs/spoke-plugins.md for the design and
// docs/HOWTO-integrate-with-shore.md for setup.
//
// Besides loading contacts, this loader mounts Shore's server-to-server
// endpoints (opt-outs in, interactions out), because contact loaders are the
// extension type whose addServerEndpoints Spoke calls at startup.

export const name = "shore";

export const PAGE_SIZE = 1000;
export const INSERT_BATCH_SIZE = 1000;

export function displayName() {
  return "Shore segment";
}

export function serverAdministratorInstructions() {
  return {
    environmentVariables: [...REQUIRED_KEYS],
    description:
      "Load contacts from a Shore segment, and let Shore send opt-outs to Spoke and read messages, survey answers, tags and opt-outs.",
    setupInstructions:
      "Add 'shore' to the CONTACT_LOADERS environment variable, then set SHORE_URL, SHORE_CAMPAIGN and SHORE_INTEGRATION_KEY (at least 32 characters) in the environment or in the organization's features. See docs/HOWTO-integrate-with-shore.md."
  };
}

export async function available(organization, user) {
  return {
    result: Boolean(getShoreConfig(organization)),
    expiresSeconds: 60
  };
}

export function addServerEndpoints(expressApp) {
  // Mounted whether or not any organization is configured; every request is
  // checked against the organization in its path and answered 404 when Shore
  // isn't configured for it.
  mountRoutes(expressApp);
}

export function clientChoiceDataCacheKey(campaign, user) {
  // The cache key already includes the organization ID.
  return "segments";
}

export async function getClientChoiceData(organization, campaign, user) {
  const config = getShoreConfig(organization);
  if (!config) {
    return {
      data: JSON.stringify({ error: "not_configured" }),
      expiresSeconds: 0
    };
  }
  try {
    const segments = await listSegments(config);
    return {
      data: JSON.stringify({
        segments: segments.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description || null,
          updatedAt: s.updatedAt || null,
          textableCount:
            typeof s.textableCount === "number" ? s.textableCount : null
        })),
        fetchedAt: new Date().toISOString()
      }),
      expiresSeconds: config.cacheSeconds
    };
  } catch (err) {
    const code = err instanceof ShoreError ? err.code : "shore_unreachable";
    console.warn(
      "shore: segment list failed",
      JSON.stringify({ organizationId: organization.id, code })
    );
    return { data: JSON.stringify({ error: code }), expiresSeconds: 0 };
  }
}

const cleanString = value =>
  value === undefined || value === null ? "" : String(value);

const cleanZip = value => {
  const match = cleanString(value).match(/^(\d{5})/);
  return match ? match[1] : "";
};

const cleanCustomFields = value => {
  const out = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.keys(value).forEach(key => {
      out[key] = cleanString(value[key]);
    });
  }
  return out;
};

// Maps one contact from Shore to a campaign_contact row, or null when its cell
// doesn't parse.
export async function toContactRow(contact, campaignId) {
  const cell = getFormattedPhoneNumber(cleanString(contact.cell));
  if (!cell) {
    return null;
  }
  const zip = cleanZip(contact.zip);
  return {
    campaign_id: campaignId,
    external_id: cleanString(contact.externalId),
    first_name: cleanString(contact.firstName),
    last_name: cleanString(contact.lastName),
    cell,
    zip,
    custom_fields: JSON.stringify(cleanCustomFields(contact.customFields)),
    message_status: "needsMessage",
    timezone_offset: zip ? await getTimezoneByZip(zip) : ""
  };
}

const parsePayload = payload => {
  try {
    const parsed = JSON.parse(payload);
    if (parsed && parsed.segmentId) {
      return {
        segmentId: String(parsed.segmentId),
        segmentName: cleanString(parsed.segmentName)
      };
    }
  } catch (err) {
    // fall through
  }
  return null;
};

export async function processContactLoad(job, maxContacts, organization) {
  const campaignId = Number(job.campaign_id);
  const choice = parsePayload(job.payload);
  const reference = JSON.stringify(choice || {});
  const fail = async code => {
    console.warn(
      "shore: contact load failed",
      JSON.stringify({ organizationId: organization.id, campaignId, code })
    );
    await failedContactLoad(
      job,
      null,
      reference,
      JSON.stringify({ errors: [code] })
    );
  };

  const config = getShoreConfig(organization);
  if (!config) {
    return fail("not_configured");
  }
  if (!choice) {
    return fail("segment_required");
  }

  const limit = Number(maxContacts) > 0 ? Number(maxContacts) : Infinity;
  let loadId = null;
  let inserted = 0;
  let invalidCellCount = 0;

  try {
    await r
      .knex("campaign_contact")
      .where("campaign_id", campaignId)
      .delete();

    const campaign = await r
      .knex("campaign")
      .where("id", campaignId)
      .first("title");
    const load = await startLoad(config, choice.segmentId, {
      spokeCampaignId: campaignId,
      spokeCampaignTitle: (campaign && campaign.title) || "",
      spokeJobId: job.id ? Number(job.id) : null
    });
    loadId = load.loadId;

    let cursor = null;
    do {
      const remaining = limit - inserted;
      const pageResult = await getContactsPage(config, loadId, {
        cursor,
        limit: Math.min(PAGE_SIZE, remaining)
      });
      const rows = [];
      for (const contact of pageResult.contacts) {
        if (inserted + rows.length >= limit) {
          break;
        }
        const row = await toContactRow(contact, campaignId);
        if (row) {
          rows.push(row);
        } else {
          invalidCellCount += 1;
        }
      }
      if (rows.length) {
        // Inserted in Shore's order; completeContactLoad keeps the highest id
        // per cell, so the last row for a repeated cell wins.
        await r.knex.batchInsert("campaign_contact", rows, INSERT_BATCH_SIZE);
        inserted += rows.length;
      }
      cursor = pageResult.nextCursor;
    } while (cursor && inserted < limit);
  } catch (err) {
    // Don't leave a partial list behind a failed load.
    await r
      .knex("campaign_contact")
      .where("campaign_id", campaignId)
      .delete()
      .catch(() => null);
    if (err instanceof ShoreError) {
      return fail(err.code);
    }
    console.error(
      "shore: contact load error",
      JSON.stringify({
        organizationId: organization.id,
        campaignId,
        name: err && err.name,
        code: err && err.code
      })
    );
    return fail("load_error");
  }

  await completeContactLoad(
    job,
    null,
    JSON.stringify({ ...choice, loadId }),
    JSON.stringify({ finalCount: inserted, invalidCellCount, loadId })
  );
}
