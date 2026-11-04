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
  "first_name",
  "last_name",
  "campaign_id",
  "campaign_title",
  "texter",
  "reason"
];

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

export async function getOptOuts(organizationId, { start, end }) {
  let query = r
    .knexReadOnly("opt_out")
    .leftJoin("assignment", "assignment.id", "opt_out.assignment_id")
    .leftJoin("campaign", "campaign.id", "assignment.campaign_id")
    .leftJoin("user", "user.id", "assignment.user_id")
    .leftJoin("campaign_contact", function joinContact() {
      this.on(
        "campaign_contact.campaign_id",
        "=",
        "assignment.campaign_id"
      ).andOn("campaign_contact.cell", "=", "opt_out.cell");
    })
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
      "user.last_name as texter_last_name",
      "campaign_contact.first_name as first_name",
      "campaign_contact.last_name as last_name"
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
  // A number listed twice in a campaign would repeat its opt-out: keep one.
  const seen = new Set();
  return inRange.filter(row => {
    if (seen.has(row.id)) {
      return false;
    }
    seen.add(row.id);
    return true;
  });
}

export function toCsv(rows) {
  const data = rows.map(row => [
    new Date(row.created_at).toISOString(),
    row.cell || "",
    safeText(row.first_name),
    safeText(row.last_name),
    row.campaign_id || "",
    safeText(row.campaign_title),
    safeText(
      [row.texter_first_name, row.texter_last_name].filter(Boolean).join(" ")
    ),
    safeText(row.reason_code)
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
