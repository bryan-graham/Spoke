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

  const optOut = async (contact, createdAt, reason = "") => {
    await r.knex("opt_out").insert({
      cell: contact.cell,
      assignment_id: campaign.assignmentId,
      organization_id: campaign.organizationId,
      reason_code: reason,
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
    expect(b.cell).toBe(second.cell);
    expect(b.first_name).toBe("'=cmd");
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
