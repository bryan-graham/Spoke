import Papa from "papaparse";
import { r } from "../../../src/server/models/";
import {
  exportHandler,
  parseRange,
  safeText,
  COLUMNS
} from "../../../src/server/lib/opt-out-export";
import {
  cleanupTest,
  createCampaign,
  createStartedCampaign,
  setupTest
} from "../../test_helpers";

const fakeRes = () => {
  const res = { statusCode: 200, headers: {}, body: null };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.set = headers => Object.assign(res.headers, headers);
  res.send = body => {
    res.body = body;
    return res;
  };
  res.end = () => res;
  return res;
};

describe("opt-out export helpers", () => {
  it("needs a start before the end", () => {
    expect(() => parseRange("", "")).toThrow("start and end");
    expect(() =>
      parseRange("2026-11-02T00:00:00.000Z", "2026-11-01T00:00:00.000Z")
    ).toThrow("on or after");
    expect(() => parseRange("nope", "2026-11-01T00:00:00.000Z")).toThrow();
  });

  it("keeps text from becoming a spreadsheet formula", () => {
    expect(safeText("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(safeText("@SUM")).toBe("'@SUM");
    expect(safeText("Pat")).toBe("Pat");
    expect(safeText(null)).toBe("");
  });
});

describe("opt-out export", () => {
  let campaign;

  beforeEach(async () => {
    await setupTest();
    campaign = await createStartedCampaign();
  }, global.DATABASE_SETUP_TEARDOWN_TIMEOUT);

  afterEach(async () => {
    await cleanupTest();
  }, global.DATABASE_SETUP_TEARDOWN_TIMEOUT);

  const optOut = async (
    contact,
    createdAt,
    reason = "",
    assignmentId = campaign.assignmentId
  ) => {
    await r.knex("opt_out").insert({
      cell: contact.cell,
      assignment_id: assignmentId,
      organization_id: campaign.organizationId,
      reason_code: reason,
      created_at: createdAt
    });
  };

  const inbound = async (contactId, cell, createdAt, text = "STOP") => {
    await r.knex("message").insert({
      campaign_contact_id: contactId,
      contact_number: cell,
      user_number: "+12025550100",
      is_from_contact: true,
      text,
      send_status: "DELIVERED",
      created_at: createdAt
    });
  };

  const run = async (user, query) => {
    const res = fakeRes();
    await exportHandler(
      { user, params: { organizationId: campaign.organizationId }, query },
      res
    );
    return res;
  };

  it("exports the opt-outs between the dates as CSV", async () => {
    const [first, second, third] = campaign.testContacts;
    await r
      .knex("campaign_contact")
      .where("id", second.id)
      .update({ first_name: "=cmd" });
    await optOut(first, "2026-10-01T12:00:00Z", "STOP");
    await optOut(second, "2026-10-15T12:00:00Z");
    await optOut(third, "2026-11-02T12:00:00Z"); // after the range

    const res = await run(campaign.testAdminUser, {
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-11-01T00:00:00.000Z",
      label: "2026-10-01-to-2026-10-31"
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain("text/csv");
    expect(res.headers["Content-Disposition"]).toBe(
      'attachment; filename="opt-outs-2026-10-01-to-2026-10-31.csv"'
    );

    const parsed = Papa.parse(res.body, { header: true });
    expect(parsed.meta.fields).toEqual(COLUMNS);
    expect(parsed.data).toHaveLength(2);
    const [a, b] = parsed.data;
    expect(a.opted_out_at).toBe("2026-10-01T12:00:00.000Z");
    expect(a.cell).toBe(first.cell);
    expect(a.campaign_id).toBe(String(campaign.testCampaign.id));
    expect(a.reason).toBe("STOP");
    expect(a.texter).not.toBe("");
    expect(a.matched_by).toBe("assignment");
    expect(a.first_name).toBe(first.first_name);
    expect(b.cell).toBe(second.cell);
    expect(b.first_name).toBe("'=cmd");
  });

  it("matches each opt-out to a contact: stop message, assignment, last inbound", async () => {
    const [first, second, third, fourth] = campaign.testContacts;
    await r
      .knex("campaign_contact")
      .where("id", first.id)
      .update({ external_id: "A-1" });
    await r
      .knex("campaign_contact")
      .where("id", second.id)
      .update({ external_id: "A-2" });
    // The same numbers are also contacts in another of the org's campaigns.
    const other = await createCampaign(
      campaign.testAdminUser,
      campaign.testOrganization
    );
    const [otherFirst] = await r
      .knex("campaign_contact")
      .insert({
        campaign_id: other.id,
        cell: first.cell,
        external_id: "B-1",
        first_name: "Bea",
        last_name: "One"
      })
      .returning("id");
    const [otherThird] = await r
      .knex("campaign_contact")
      .insert({
        campaign_id: other.id,
        cell: third.cell,
        external_id: "B-3",
        first_name: "Bea",
        last_name: "Three"
      })
      .returning("id");
    const idOf = row => (typeof row === "object" ? row.id : row);

    // first: replied STOP in the other campaign 20s before the opt-out, so
    // the message wins over the assignment.
    await inbound(idOf(otherFirst), first.cell, "2026-10-01T11:59:40Z");
    await optOut(first, "2026-10-01T12:00:00Z", "STOP");
    // second: entered by hand, no message: the assignment's campaign.
    await optOut(second, "2026-10-02T12:00:00Z");
    // third: no assignment and no STOP, but replied earlier.
    await inbound(
      idOf(otherThird),
      third.cell,
      "2026-09-20T12:00:00Z",
      "who is this"
    );
    await optOut(third, "2026-10-03T12:00:00Z", "", null);
    // fourth: nothing to match.
    await optOut(fourth, "2026-10-04T12:00:00Z", "", null);

    const res = await run(campaign.testAdminUser, {
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-11-01T00:00:00.000Z"
    });
    const rows = Papa.parse(res.body, { header: true }).data;
    expect(
      rows.map(row => [
        row.cell,
        row.matched_by,
        row.external_id,
        row.first_name
      ])
    ).toEqual([
      [first.cell, "stop_message", "B-1", "Bea"],
      [second.cell, "assignment", "A-2", second.first_name],
      [third.cell, "last_inbound", "B-3", "Bea"],
      [fourth.cell, "", "", ""]
    ]);
  });

  it("is only for admins", async () => {
    const texter = await run(campaign.testTexterUser, {
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-11-01T00:00:00.000Z"
    });
    expect(texter.statusCode).toBe(403);
    const nobody = await run(undefined, {
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-11-01T00:00:00.000Z"
    });
    expect(nobody.statusCode).toBe(401);
  });

  it("says what's wrong with the dates", async () => {
    const res = await run(campaign.testAdminUser, { from: "", to: "" });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("start and end");
  });
});
