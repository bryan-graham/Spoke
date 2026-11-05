import Papa from "papaparse";
import { r, isSqlite } from "../models";
import { accessRequired } from "../api/errors";

// Opt-outs export (Settings, for admins when Spoke isn't connected to Shore):
// GET /opt-out-export/:organizationId?from=<ISO>&to=<ISO> downloads a CSV of
// the organization's opt-outs made from `from` up to (not including) `to`.
// The page sends the start of the first day and the start of the day after
// the last, in the admin's own time zone.

export const EXPORT_PATH = "/opt-out-export";

export const COLUMNS = [
  "opted_out_at",
  "cell",
  "external_id",
  "first_name",
  "last_name",
  "campaign_id",
  "campaign_title",
  "texter",
  "reason",
  "matched_by"
];

// How an opt-out was tied to a contact (the matched_by column), tried in
// this order:
// - stop_message: an incoming message from that number within a minute of
//   the opt-out (almost always "STOP"). A message belongs to exactly one
//   contact, so this is the most reliable.
// - assignment: opt-outs a texter entered by hand record their assignment,
//   so use the contact with that number in that assignment's campaign.
// - last_inbound: the contact behind the last message that number sent
//   before opting out.
export const STOP_WINDOW_MS = 60 * 1000;
const CHUNK = 500;

export class ExportRangeError extends Error {}

export function parseRange(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (
    !from ||
    !to ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    throw new ExportRangeError("Choose a start and end date.");
  }
  if (start >= end) {
    throw new ExportRangeError(
      "The end date must be on or after the start date."
    );
  }
  return { start, end };
}

// A spreadsheet runs a cell starting with = + - @ (or a tab/return) as a
// formula; prefix text from contacts and texters with ' so it stays text.
// Phone numbers are left alone (they start with +, and come from Spoke).
export function safeText(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

const time = value => {
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime();
};

const chunks = list => {
  const out = [];
  for (let i = 0; i < list.length; i += CHUNK) {
    out.push(list.slice(i, i + CHUNK));
  }
  return out;
};

const CONTACT_FIELDS = [
  "campaign_contact.id as contact_id",
  "campaign_contact.campaign_id as contact_campaign_id",
  "campaign_contact.cell as contact_cell",
  "campaign_contact.external_id as external_id",
  "campaign_contact.first_name as first_name",
  "campaign_contact.last_name as last_name"
];

// Incoming messages from these numbers to the organization's contacts, sent
// before `until`, newest first.
async function inboundMessages(organizationId, cells, until) {
  const parts = await Promise.all(
    chunks(cells).map(part => {
      let query = r
        .knexReadOnly("message")
        .join(
          "campaign_contact",
          "campaign_contact.id",
          "message.campaign_contact_id"
        )
        .join("campaign", "campaign.id", "campaign_contact.campaign_id")
        .where("campaign.organization_id", organizationId)
        .where("message.is_from_contact", true)
        .whereIn("message.contact_number", part);
      if (!isSqlite) {
        query = query.andWhere("message.created_at", "<", until.toISOString());
      }
      return query.select(
        "message.id as message_id",
        "message.created_at as message_at",
        "message.contact_number as message_cell",
        ...CONTACT_FIELDS
      );
    })
  );
  const found = [].concat(...parts);
  const limit = until.getTime();
  return found
    .filter(m => time(m.message_at) < limit)
    .sort(
      (a, b) =>
        time(b.message_at) - time(a.message_at) || b.message_id - a.message_id
    );
}

// The contact with each number in each campaign, keyed "campaign:cell".
async function campaignContacts(pairs) {
  const byKey = new Map();
  const byCampaign = new Map();
  pairs.forEach(({ campaignId, cell }) => {
    if (!byCampaign.has(campaignId)) {
      byCampaign.set(campaignId, new Set());
    }
    byCampaign.get(campaignId).add(cell);
  });
  const queries = [];
  byCampaign.forEach((cells, campaignId) => {
    chunks([...cells]).forEach(part => {
      queries.push(
        r
          .knexReadOnly("campaign_contact")
          .where("campaign_contact.campaign_id", campaignId)
          .whereIn("campaign_contact.cell", part)
          .orderBy("campaign_contact.id", "asc")
          .select(...CONTACT_FIELDS)
      );
    });
  });
  const results = await Promise.all(queries);
  results.forEach(rows => {
    rows.forEach(row => {
      const key = `${row.contact_campaign_id}:${row.contact_cell}`;
      // A number listed twice in a campaign: keep the first.
      if (!byKey.has(key)) {
        byKey.set(key, row);
      }
    });
  });
  return byKey;
}

const contactPart = contact => ({
  external_id: contact ? contact.external_id : null,
  first_name: contact ? contact.first_name : null,
  last_name: contact ? contact.last_name : null
});

export async function matchContacts(organizationId, optOuts) {
  if (!optOuts.length) {
    return [];
  }
  const cells = [...new Set(optOuts.map(row => row.cell).filter(Boolean))];
  const latest = optOuts.reduce(
    (most, row) => Math.max(most, time(row.created_at)),
    0
  );
  const messages = await inboundMessages(
    organizationId,
    cells,
    new Date(latest + STOP_WINDOW_MS + 1)
  );
  const messagesByCell = new Map();
  messages.forEach(m => {
    if (!messagesByCell.has(m.message_cell)) {
      messagesByCell.set(m.message_cell, []);
    }
    messagesByCell.get(m.message_cell).push(m);
  });
  const byCampaign = await campaignContacts(
    optOuts
      .filter(row => row.campaign_id && row.cell)
      .map(row => ({ campaignId: row.campaign_id, cell: row.cell }))
  );

  return optOuts.map(row => {
    const at = time(row.created_at);
    const sent = messagesByCell.get(row.cell) || [];
    // 1. The incoming message closest to the opt-out, within a minute.
    let stop = null;
    sent.forEach(m => {
      const gap = Math.abs(time(m.message_at) - at);
      if (
        gap <= STOP_WINDOW_MS &&
        (!stop || gap < Math.abs(time(stop.message_at) - at))
      ) {
        stop = m;
      }
    });
    if (stop) {
      return { ...row, ...contactPart(stop), matched_by: "stop_message" };
    }
    // 2. The number in the campaign of the assignment it was entered from.
    const assigned =
      row.campaign_id && byCampaign.get(`${row.campaign_id}:${row.cell}`);
    if (assigned) {
      return { ...row, ...contactPart(assigned), matched_by: "assignment" };
    }
    // 3. The last message the number sent before opting out (newest first).
    const last = sent.find(m => time(m.message_at) <= at);
    if (last) {
      return { ...row, ...contactPart(last), matched_by: "last_inbound" };
    }
    return { ...row, ...contactPart(null), matched_by: "" };
  });
}

export async function getOptOuts(organizationId, { start, end }) {
  let query = r
    .knexReadOnly("opt_out")
    .leftJoin("assignment", "assignment.id", "opt_out.assignment_id")
    .leftJoin("campaign", "campaign.id", "assignment.campaign_id")
    .leftJoin("user", "user.id", "assignment.user_id")
    .where("opt_out.organization_id", organizationId);
  if (!isSqlite) {
    query = query
      .andWhere("opt_out.created_at", ">=", start.toISOString())
      .andWhere("opt_out.created_at", "<", end.toISOString());
  }
  const rows = await query
    .orderBy("opt_out.created_at", "asc")
    .orderBy("opt_out.id", "asc")
    .select(
      "opt_out.id as id",
      "opt_out.created_at as created_at",
      "opt_out.cell as cell",
      "opt_out.reason_code as reason_code",
      "campaign.id as campaign_id",
      "campaign.title as campaign_title",
      "user.first_name as texter_first_name",
      "user.last_name as texter_last_name"
    );
  // SQLite (development) keeps times in more than one format, so the range
  // is applied here rather than in SQL.
  const from = start.getTime();
  const to = end.getTime();
  const inRange = isSqlite
    ? rows
        .filter(
          row => time(row.created_at) >= from && time(row.created_at) < to
        )
        .sort((a, b) => time(a.created_at) - time(b.created_at) || a.id - b.id)
    : rows;
  return matchContacts(organizationId, inRange);
}

export function toCsv(rows) {
  const data = rows.map(row => [
    new Date(row.created_at).toISOString(),
    row.cell || "",
    safeText(row.external_id),
    safeText(row.first_name),
    safeText(row.last_name),
    row.campaign_id || "",
    safeText(row.campaign_title),
    safeText(
      [row.texter_first_name, row.texter_last_name].filter(Boolean).join(" ")
    ),
    safeText(row.reason_code),
    row.matched_by || ""
  ]);
  return Papa.unparse({ fields: COLUMNS, data });
}

const day = date => date.toISOString().slice(0, 10);

export async function exportHandler(req, res) {
  const { organizationId } = req.params;
  if (!/^\d+$/.test(String(organizationId))) {
    res.status(404).end();
    return;
  }
  try {
    await accessRequired(req.user, organizationId, "ADMIN", true);
  } catch (err) {
    res
      .status(req.user ? 403 : 401)
      .send("You can't export this organization's opt-outs.");
    return;
  }
  let range;
  try {
    range = parseRange(req.query.from, req.query.to);
  } catch (err) {
    res.status(400).send(err.message);
    return;
  }
  try {
    const rows = await getOptOuts(organizationId, range);
    const label = String(req.query.label || "").replace(/[^0-9A-Za-z_-]/g, "");
    const name = `opt-outs-${label ||
      `${day(range.start)}-to-${day(range.end)}`}.csv`;
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    res.send(toCsv(rows));
  } catch (err) {
    res.status(500).send("The export failed. Try again.");
  }
}
