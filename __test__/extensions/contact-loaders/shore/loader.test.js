import nock from "nock";
import { r, cacheableData } from "../../../../src/server/models";
import {
  setupTest,
  cleanupTest,
  createUser,
  createInvite,
  createOrganization,
  createCampaign,
  updateOrganizationFeatures,
  createJob
} from "../../../test_helpers";
import {
  available,
  getClientChoiceData,
  processContactLoad,
  toContactRow
} from "../../../../src/extensions/contact-loaders/shore";
import { verifySignature } from "../../../../src/extensions/contact-loaders/shore/lib/signing";
import { expectValid, schemaFor } from "./contract";

// The fake Shore below only sends bodies that match the published contract
// (docs/shore-contract.openapi.json), except where a test deliberately sends
// bad data to check Spoke copes.
const shoreSays = (schemaName, body) => {
  expectValid(schemaFor(schemaName), body);
  return body;
};

const KEY = "test-integration-key-0123456789abcdef";
const SHORE = "https://shore.test";
const API = "/api/spoke/v1/gotv";

// Fake Shore: checks that each request carries a valid Spoke signature.
// nock passes the path (with query) and the request body to reply().
const signedOk = (ctx, uri, body) =>
  verifySignature({
    key: KEY,
    timestamp: ctx.req.headers["x-shore-timestamp"],
    signature: ctx.req.headers["x-shore-signature"],
    method: ctx.req.method,
    path: uri,
    body: !body ? "" : typeof body === "string" ? body : JSON.stringify(body)
  }).ok;

const contact = (i, extra = {}) => ({
  externalId: `person-${i}`,
  firstName: `First${i}`,
  lastName: `Last${i}`,
  cell: `+1515555${String(1000 + i)}`,
  zip: "22031",
  customFields: {
    preferredName: `Pref${i}`,
    city: "Fairfax",
    pollingPlaceName: "",
    pollingPlaceAddress: "",
    precinct: ""
  },
  ...extra
});

describe("shore contact loader", () => {
  let organization;
  let testOrganization;
  let testCampaign;

  beforeEach(async () => {
    await cleanupTest();
    await setupTest();
    const user = await createUser();
    const invite = await createInvite();
    testOrganization = await createOrganization(user, invite);
    testCampaign = await createCampaign(user, testOrganization);
    await updateOrganizationFeatures(testOrganization, {
      SHORE_URL: SHORE,
      SHORE_CAMPAIGN: "gotv",
      SHORE_INTEGRATION_KEY: KEY
    });
    organization = await cacheableData.organization.load(
      testOrganization.data.createOrganization.id
    );
    nock.disableNetConnect();
  }, global.DATABASE_SETUP_TEARDOWN_TIMEOUT);

  afterEach(async () => {
    nock.cleanAll();
    nock.enableNetConnect();
    await cleanupTest();
  }, global.DATABASE_SETUP_TEARDOWN_TIMEOUT);

  const contactsInDb = () =>
    r
      .knex("campaign_contact")
      .where("campaign_id", testCampaign.id)
      .orderBy("id");

  const adminRow = () =>
    r
      .knex("campaign_admin")
      .where("campaign_id", testCampaign.id)
      .first();

  const makeJob = payload =>
    createJob(testCampaign, {
      payload: JSON.stringify(payload),
      job_type: "ingest.shore"
    });

  it("is available only when configured", async () => {
    expect((await available(organization)).result).toBe(true);
    expect((await available({ id: 99, features: "{}" })).result).toBe(false);
  });

  describe("getClientChoiceData", () => {
    it("lists segments", async () => {
      nock(SHORE)
        .get(`${API}/segments`)
        .reply(function(uri, body) {
          return signedOk(this, uri, body)
            ? [
                200,
                shoreSays("SegmentList", {
                  segments: [
                    {
                      id: "seg-1",
                      name: "Pledged",
                      description: null,
                      updatedAt: "2026-11-01T14:00:00Z",
                      textableCount: 412
                    }
                  ]
                })
              ]
            : [401, { error: "unauthorized" }];
        });
      const result = await getClientChoiceData(organization, testCampaign);
      const data = JSON.parse(result.data);
      expect(data.segments).toEqual([
        {
          id: "seg-1",
          name: "Pledged",
          description: null,
          updatedAt: "2026-11-01T14:00:00Z",
          textableCount: 412
        }
      ]);
      expect(data.fetchedAt).toBeTruthy();
      expect(result.expiresSeconds).toBe(60);
    });

    it("reports Shore being down without caching it", async () => {
      nock(SHORE)
        .get(`${API}/segments`)
        .reply(503);
      const result = await getClientChoiceData(organization, testCampaign);
      expect(JSON.parse(result.data)).toEqual({ error: "shore_unreachable" });
      expect(result.expiresSeconds).toBe(0);
    });

    it("reports a rejected key", async () => {
      nock(SHORE)
        .get(`${API}/segments`)
        .reply(401, { error: "unauthorized" });
      const result = await getClientChoiceData(organization, testCampaign);
      expect(JSON.parse(result.data)).toEqual({ error: "shore_rejected" });
    });
  });

  describe("toContactRow", () => {
    it("normalizes the cell, zip, timezone and custom fields", async () => {
      const row = await toContactRow(
        contact(1, {
          cell: "(515) 555-1001",
          zip: "22031-1234",
          customFields: { preferredName: "P", count: 3, missing: null }
        }),
        7
      );
      expect(row).toMatchObject({
        campaign_id: 7,
        external_id: "person-1",
        first_name: "First1",
        last_name: "Last1",
        cell: "+15155551001",
        zip: "22031",
        message_status: "needsMessage"
      });
      expect(row.timezone_offset).toBeTruthy();
      expect(JSON.parse(row.custom_fields)).toEqual({
        preferredName: "P",
        count: "3",
        missing: ""
      });
    });

    it("rejects a cell that doesn't parse", async () => {
      expect(await toContactRow(contact(1, { cell: "123" }), 7)).toBeNull();
    });
  });

  describe("processContactLoad", () => {
    it("pages through a load, replaces old contacts and records the result", async () => {
      await r.knex("campaign_contact").insert({
        campaign_id: testCampaign.id,
        cell: "+15155559999",
        first_name: "Old",
        message_status: "needsMessage"
      });
      let startBody;
      nock(SHORE)
        .post(`${API}/segments/seg-1/loads`)
        .reply(function(uri, body) {
          startBody = body;
          return signedOk(this, uri, body)
            ? [
                200,
                shoreSays("StartLoadResponse", { loadId: "load-1", count: 4 })
              ]
            : [401, {}];
        })
        .get(`${API}/loads/load-1/contacts`)
        .query({ limit: "1000" })
        // Deliberately off-contract (a bad cell) to check Spoke skips it.
        .reply(200, {
          contacts: [contact(1), contact(2, { cell: "bad" })],
          nextCursor: "c2"
        })
        .get(`${API}/loads/load-1/contacts`)
        .query({ cursor: "c2", limit: "1000" })
        .reply(
          200,
          shoreSays("ContactPage", {
            // contact 1 again with a new name: last row wins
            contacts: [contact(3), contact(1, { firstName: "Newer" })],
            nextCursor: null
          })
        );

      const job = await makeJob({ segmentId: "seg-1", segmentName: "Pledged" });
      await processContactLoad(job, null, organization);

      expectValid(schemaFor("StartLoadRequest"), startBody);
      expect(startBody).toEqual({
        spokeCampaignId: Number(testCampaign.id),
        spokeCampaignTitle: expect.any(String),
        spokeJobId: Number(job.id)
      });
      const rows = await contactsInDb();
      expect(rows.map(c => [c.external_id, c.first_name])).toEqual([
        ["person-3", "First3"],
        ["person-1", "Newer"]
      ]);
      expect(JSON.parse(rows[0].custom_fields)).toEqual({
        preferredName: "Pref3",
        city: "Fairfax",
        pollingPlaceName: "",
        pollingPlaceAddress: "",
        precinct: ""
      });
      const admin = await adminRow();
      expect(admin.ingest_success).toBe(true);
      expect(JSON.parse(admin.ingest_data_reference)).toEqual({
        segmentId: "seg-1",
        segmentName: "Pledged",
        loadId: "load-1"
      });
      expect(JSON.parse(admin.ingest_result)).toEqual({
        finalCount: 3,
        invalidCellCount: 1,
        loadId: "load-1"
      });
      expect(nock.isDone()).toBe(true);
    });

    it("stops at maxContacts", async () => {
      nock(SHORE)
        .post(`${API}/segments/seg-1/loads`)
        .reply(
          200,
          shoreSays("StartLoadResponse", { loadId: "load-2", count: 3 })
        )
        .get(`${API}/loads/load-2/contacts`)
        .query({ limit: "2" })
        .reply(
          200,
          shoreSays("ContactPage", {
            contacts: [contact(1), contact(2), contact(3)],
            nextCursor: "more"
          })
        );
      const job = await makeJob({ segmentId: "seg-1", segmentName: "S" });
      await processContactLoad(job, 2, organization);
      expect((await contactsInDb()).length).toBe(2);
      expect(nock.isDone()).toBe(true);
    });

    it("fails with load_expired and leaves no partial list", async () => {
      nock(SHORE)
        .post(`${API}/segments/seg-1/loads`)
        .reply(200, { loadId: "load-3", count: 2 })
        .get(`${API}/loads/load-3/contacts`)
        .query({ limit: "1000" })
        .reply(200, { contacts: [contact(1)], nextCursor: "next" })
        .get(`${API}/loads/load-3/contacts`)
        .query({ cursor: "next", limit: "1000" })
        .reply(410, { error: "expired" });
      const job = await makeJob({ segmentId: "seg-1", segmentName: "S" });
      await processContactLoad(job, null, organization);
      expect((await contactsInDb()).length).toBe(0);
      const admin = await adminRow();
      expect(admin.ingest_success).toBe(false);
      expect(JSON.parse(admin.ingest_result)).toEqual({
        errors: ["load_expired"]
      });
    });

    it("fails with shore_unreachable when Shore is down", async () => {
      nock(SHORE)
        .post(`${API}/segments/seg-1/loads`)
        .replyWithError("connect ECONNREFUSED");
      const job = await makeJob({ segmentId: "seg-1", segmentName: "S" });
      await processContactLoad(job, null, organization);
      expect(JSON.parse((await adminRow()).ingest_result)).toEqual({
        errors: ["shore_unreachable"]
      });
    });

    it("fails without a segment", async () => {
      const job = await makeJob({});
      await processContactLoad(job, null, organization);
      expect(JSON.parse((await adminRow()).ingest_result)).toEqual({
        errors: ["segment_required"]
      });
    });
  });
});
