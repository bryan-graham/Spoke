import { r } from "../../../../server/models";

// Read endpoints Shore polls (GET /integrations/shore/:organizationId/...).
//
// Feeds page on each table's primary key (afterId → nextAfterId) in ascending
// order, scoped to the organization. Rows newer than settleSeconds are held
// back, and the page stops at the first such row, so a row that commits late
// with a lower id than one already returned is never skipped.
//
// These read from the primary database (r.knex), not a read replica: replica
// lag could otherwise exceed the settle window and hide rows behind the cursor.

export const DEFAULT_LIMIT = 500;
export const MAX_LIMIT = 2000;

const toIso = value =>
  value === null || value === undefined ? null : new Date(value).toISOString();

const toInt = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return /^\d{1,15}$/.test(String(value)) ? Number(value) : NaN;
};

export function parsePaging(query, cursorName = "afterId") {
  const after = toInt(query[cursorName], 0);
  const limit = toInt(query.limit, DEFAULT_LIMIT);
  if (Number.isNaN(after) || Number.isNaN(limit) || limit < 1) {
    return { error: "invalid_paging" };
  }
  return { after, limit: Math.min(limit, MAX_LIMIT) };
}

// Keeps rows up to (not including) the first one created after the cutoff.
export function settledPrefix(rows, settleSeconds, now = Date.now()) {
  if (!settleSeconds) {
    return rows;
  }
  const cutoff = now - settleSeconds * 1000;
  const idx = rows.findIndex(
    row => new Date(row.created_at).getTime() > cutoff
  );
  return idx === -1 ? rows : rows.slice(0, idx);
}

const page = (rows, after, key = "nextAfterId") => ({
  [key]: rows.length ? Number(rows[rows.length - 1].id) : after
});

export async function readMessages({ organizationId, after, limit, settle }) {
  const rows = await r
    .knex("message")
    .join(
      "campaign_contact",
      "campaign_contact.id",
      "message.campaign_contact_id"
    )
    .join("campaign", "campaign.id", "campaign_contact.campaign_id")
    .where("campaign.organization_id", organizationId)
    .where("message.id", ">", after)
    .orderBy("message.id", "asc")
    .limit(limit)
    .select(
      "message.id",
      "message.campaign_contact_id",
      "message.contact_number",
      "message.is_from_contact",
      "message.text",
      "message.send_status",
      "message.user_id",
      "message.created_at",
      "campaign_contact.campaign_id",
      "campaign_contact.external_id"
    );
  const settled = settledPrefix(rows, settle);
  return {
    messages: settled.map(m => ({
      id: Number(m.id),
      campaignId: Number(m.campaign_id),
      campaignContactId: Number(m.campaign_contact_id),
      externalId: m.external_id || null,
      contactNumber: m.contact_number,
      isFromContact: Boolean(m.is_from_contact),
      text: m.text,
      sendStatus: m.send_status,
      userId: m.user_id === null ? null : Number(m.user_id),
      createdAt: toIso(m.created_at)
    })),
    ...page(settled, after)
  };
}

export async function readQuestionResponses({
  organizationId,
  after,
  limit,
  settle
}) {
  const rows = await r
    .knex("question_response")
    .join(
      "campaign_contact",
      "campaign_contact.id",
      "question_response.campaign_contact_id"
    )
    .join("campaign", "campaign.id", "campaign_contact.campaign_id")
    .where("campaign.organization_id", organizationId)
    .where("question_response.id", ">", after)
    .orderBy("question_response.id", "asc")
    .limit(limit)
    .select(
      "question_response.id",
      "question_response.campaign_contact_id",
      "question_response.interaction_step_id",
      "question_response.value",
      "question_response.created_at",
      "campaign_contact.campaign_id",
      "campaign_contact.external_id"
    );
  const settled = settledPrefix(rows, settle);
  return {
    questionResponses: settled.map(q => ({
      id: Number(q.id),
      campaignId: Number(q.campaign_id),
      campaignContactId: Number(q.campaign_contact_id),
      externalId: q.external_id || null,
      interactionStepId: Number(q.interaction_step_id),
      value: q.value,
      createdAt: toIso(q.created_at)
    })),
    ...page(settled, after)
  };
}

export async function readTags({ organizationId, after, limit, settle }) {
  const rows = await r
    .knex("tag_campaign_contact")
    .join("tag", "tag.id", "tag_campaign_contact.tag_id")
    .join(
      "campaign_contact",
      "campaign_contact.id",
      "tag_campaign_contact.campaign_contact_id"
    )
    .join("campaign", "campaign.id", "campaign_contact.campaign_id")
    .where("campaign.organization_id", organizationId)
    .where("tag_campaign_contact.id", ">", after)
    .orderBy("tag_campaign_contact.id", "asc")
    .limit(limit)
    .select(
      "tag_campaign_contact.id",
      "tag_campaign_contact.campaign_contact_id",
      "tag_campaign_contact.tag_id",
      "tag_campaign_contact.value",
      "tag_campaign_contact.created_at",
      "tag.name as tag_name",
      "campaign_contact.campaign_id",
      "campaign_contact.external_id"
    );
  const settled = settledPrefix(rows, settle);
  return {
    tags: settled.map(t => ({
      id: Number(t.id),
      campaignId: Number(t.campaign_id),
      campaignContactId: Number(t.campaign_contact_id),
      externalId: t.external_id || null,
      tagId: Number(t.tag_id),
      tagName: t.tag_name,
      value: t.value === undefined ? null : t.value,
      createdAt: toIso(t.created_at)
    })),
    ...page(settled, after)
  };
}

export async function readOptOuts({ organizationId, after, limit, settle }) {
  let query = r
    .knex("opt_out")
    .where("id", ">", after)
    .orderBy("id", "asc")
    .limit(limit)
    .select("id", "cell", "reason_code", "assignment_id", "created_at");
  // With OPTOUTS_SHARE_ALL_ORGS, an opt-out in any organization applies here.
  if (!process.env.OPTOUTS_SHARE_ALL_ORGS) {
    query = query.where("organization_id", organizationId);
  }
  const settled = settledPrefix(await query, settle);
  return {
    optOuts: settled.map(o => ({
      id: Number(o.id),
      cell: o.cell,
      reasonCode: o.reason_code,
      assignmentId: o.assignment_id === null ? null : Number(o.assignment_id),
      createdAt: toIso(o.created_at)
    })),
    ...page(settled, after)
  };
}

const parseJson = value => {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
};

export async function readCampaigns({ organizationId, after, limit }) {
  const campaigns = await r
    .knex("campaign")
    .leftJoin("campaign_admin", "campaign_admin.campaign_id", "campaign.id")
    .where("campaign.organization_id", organizationId)
    .where("campaign.id", ">", after)
    .orderBy("campaign.id", "asc")
    .limit(limit)
    .select(
      "campaign.id",
      "campaign.title",
      "campaign.is_started",
      "campaign.is_archived",
      "campaign.created_at",
      "campaign_admin.ingest_method",
      "campaign_admin.ingest_success",
      "campaign_admin.ingest_data_reference",
      "campaign_admin.ingest_result"
    );
  const ids = campaigns.map(c => c.id);
  const steps = ids.length
    ? await r
        .knex("interaction_step")
        .whereIn("campaign_id", ids)
        .orderBy("id", "asc")
        .select(
          "id",
          "campaign_id",
          "parent_interaction_id",
          "answer_option",
          "question",
          "is_deleted"
        )
    : [];
  return {
    campaigns: campaigns.map(c => {
      let shoreLoad = null;
      if (c.ingest_method === "shore" && c.ingest_success) {
        const reference = parseJson(c.ingest_data_reference) || {};
        const result = parseJson(c.ingest_result) || {};
        shoreLoad = {
          segmentId: reference.segmentId || null,
          segmentName: reference.segmentName || null,
          loadId: result.loadId || null
        };
      }
      return {
        id: Number(c.id),
        title: c.title,
        isStarted: Boolean(c.is_started),
        isArchived: Boolean(c.is_archived),
        createdAt: toIso(c.created_at),
        shoreLoad,
        interactionSteps: steps
          .filter(s => Number(s.campaign_id) === Number(c.id))
          .map(s => ({
            id: Number(s.id),
            parentInteractionId:
              s.parent_interaction_id === null
                ? null
                : Number(s.parent_interaction_id),
            answerOption: s.answer_option,
            question: s.question,
            isDeleted: Boolean(s.is_deleted)
          }))
      };
    }),
    ...page(campaigns, after)
  };
}

// Returns null when the campaign isn't in the organization.
export async function readContactState({
  organizationId,
  campaignId,
  after,
  limit
}) {
  const campaign = await r
    .knex("campaign")
    .where({ id: campaignId, organization_id: organizationId })
    .first("id");
  if (!campaign) {
    return null;
  }
  const contacts = await r
    .knex("campaign_contact")
    .where("campaign_id", campaignId)
    .where("id", ">", after)
    .orderBy("id", "asc")
    .limit(limit)
    .select("id", "external_id", "message_status", "is_opted_out");
  const ids = contacts.map(c => c.id);
  const [responses, tags] = ids.length
    ? await Promise.all([
        r
          .knex("question_response")
          .whereIn("campaign_contact_id", ids)
          .orderBy("id", "asc")
          .select("campaign_contact_id", "interaction_step_id", "value"),
        r
          .knex("tag_campaign_contact")
          .join("tag", "tag.id", "tag_campaign_contact.tag_id")
          .whereIn("tag_campaign_contact.campaign_contact_id", ids)
          .orderBy("tag_campaign_contact.id", "asc")
          .select(
            "tag_campaign_contact.campaign_contact_id",
            "tag_campaign_contact.tag_id",
            "tag_campaign_contact.value",
            "tag.name as tag_name"
          )
      ])
    : [[], []];
  const byContact = (rows, map) => {
    const out = {};
    rows.forEach(row => {
      const key = Number(row.campaign_contact_id);
      (out[key] = out[key] || []).push(map(row));
    });
    return out;
  };
  const responsesBy = byContact(responses, q => ({
    interactionStepId: Number(q.interaction_step_id),
    value: q.value
  }));
  const tagsBy = byContact(tags, t => ({
    tagId: Number(t.tag_id),
    tagName: t.tag_name,
    value: t.value === undefined ? null : t.value
  }));
  return {
    contacts: contacts.map(c => ({
      campaignContactId: Number(c.id),
      externalId: c.external_id || null,
      messageStatus: c.message_status,
      isOptedOut: Boolean(c.is_opted_out),
      questionResponses: responsesBy[Number(c.id)] || [],
      tags: tagsBy[Number(c.id)] || []
    })),
    ...page(contacts, after, "nextAfterContactId")
  };
}

const FEEDS = {
  messages: readMessages,
  "question-responses": readQuestionResponses,
  tags: readTags,
  "opt-outs": readOptOuts
};

const sendError = (res, err) => {
  console.error(
    "shore: read error",
    JSON.stringify({ name: err && err.name, code: err && err.code })
  );
  res.status(500).json({ error: "internal_error" });
};

export function addReadRoutes(router) {
  Object.keys(FEEDS).forEach(feed => {
    router.get(`/${feed}`, async (req, res) => {
      const paging = parsePaging(req.query);
      if (paging.error) {
        return res.status(400).json({ error: paging.error });
      }
      try {
        const result = await FEEDS[feed]({
          organizationId: Number(req.shore.organization.id),
          after: paging.after,
          limit: paging.limit,
          settle: req.shore.config.settleSeconds
        });
        return res.json(result);
      } catch (err) {
        return sendError(res, err);
      }
    });
  });

  router.get("/campaigns", async (req, res) => {
    const paging = parsePaging(req.query);
    if (paging.error) {
      return res.status(400).json({ error: paging.error });
    }
    try {
      return res.json(
        await readCampaigns({
          organizationId: Number(req.shore.organization.id),
          after: paging.after,
          limit: paging.limit
        })
      );
    } catch (err) {
      return sendError(res, err);
    }
  });

  router.get("/campaigns/:campaignId/contact-state", async (req, res) => {
    const paging = parsePaging(req.query, "afterContactId");
    const campaignId = toInt(req.params.campaignId, NaN);
    if (paging.error || Number.isNaN(campaignId)) {
      return res
        .status(400)
        .json({ error: paging.error || "invalid_campaign" });
    }
    try {
      const result = await readContactState({
        organizationId: Number(req.shore.organization.id),
        campaignId,
        after: paging.after,
        limit: paging.limit
      });
      if (!result) {
        return res.status(404).json({ error: "campaign_not_found" });
      }
      return res.json(result);
    } catch (err) {
      return sendError(res, err);
    }
  });
}
