import request from "supertest";
import { r, cacheableData } from "../../../../src/server/models";
import {
  setupTest,
  cleanupTest,
  createStartedCampaign,
  createUser,
  createInvite,
  createOrganization,
  createCampaign,
  createContacts,
  updateOrganizationFeatures
} from "../../../test_helpers";
import { signedHeaders } from "../../../../src/extensions/contact-loaders/shore/lib/signing";
import { settledPrefix } from "../../../../src/extensions/contact-loaders/shore/lib/read-api";

// The rest of Spoke's app is real; only the React page renderer (which needs
// built client assets) and the polyfill (already loaded) are stubbed.
jest.mock("babel-polyfill", () => ({}));
jest.mock("../../../../src/server/middleware/app-renderer", () => (req, res) =>
  res.status(404).send("app")
);

const KEY = "test-integration-key-0123456789abcdef";
const VENDOR_JSON = "application/vnd.shore+json";

const shoreFeatures = extra => ({
  SHORE_URL: "https://shore.test",
  SHORE_CAMPAIGN: "gotv",
  SHORE_INTEGRATION_KEY: KEY,
  SHORE_SETTLE_SECONDS: "0",
  ...extra
});

describe("shore endpoints (through Spoke's app)", () => {
  let app;
  let c; // createStartedCampaign() result
  let orgId;
  let fakeServiceManager; // from the same module registry as the app

  const get = (path, { key = KEY } = {}) =>
    request(app)
      .get(path)
      .set(signedHeaders({ key, method: "GET", path, body: "" }));

  const post = (
    path,
    payload,
    { key = KEY, contentType = VENDOR_JSON } = {}
  ) => {
    const body =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    return request(app)
      .post(path)
      .set(signedHeaders({ key, method: "POST", path, body }))
      .set("Content-Type", contentType)
      .send(body);
  };

  const optOutPath = () => `/integrations/shore/${orgId}/opt-outs`;

  beforeAll(async () => {
    // Jest's setup file has already loaded Spoke's contact-loader list, which
    // is fixed when that module first loads. Reload Spoke's modules with
    // CONTACT_LOADERS including "shore", as a real deployment would have it.
    jest.resetModules();
    global.CONTACT_LOADERS = "csv-upload,shore";
    global.SUPPRESS_SEED_CALLS = "1";
    global.SUPPRESS_MIGRATIONS = "1";
    app = require("../../../../src/server").default;
    fakeServiceManager = require("../../../../src/extensions/service-managers/test-fake-example");

    // Spoke mounts its routes (ours included) once Apollo has started.
    // Once mounted, our router answers with a JSON error rather than Spoke's
    // page renderer. (Tables aren't created until beforeEach, so this may be
    // a 500.)
    const mounted = async () => {
      const res = await request(app).get("/integrations/shore/999999/messages");
      return Boolean(res.body && res.body.error);
    };
    let ok = false;
    for (let i = 0; i < 100 && !(ok = await mounted()); i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(ok).toBe(true);
  });

  afterAll(() => {
    delete global.CONTACT_LOADERS;
  });

  beforeEach(async () => {
    await cleanupTest();
    await setupTest();
    c = await createStartedCampaign();
    orgId = c.organizationId;
    await updateOrganizationFeatures(c.testOrganization, shoreFeatures());
  }, global.DATABASE_SETUP_TEARDOWN_TIMEOUT);

  afterEach(async () => {
    await cleanupTest();
  }, global.DATABASE_SETUP_TEARDOWN_TIMEOUT);

  describe("authentication", () => {
    it("answers 404 for an unknown or unconfigured organization", async () => {
      await get("/integrations/shore/99999/messages").expect(404);
      await get("/integrations/shore/abc/messages").expect(404);
      await updateOrganizationFeatures(c.testOrganization, {
        SHORE_INTEGRATION_KEY: ""
      });
      await get(`/integrations/shore/${orgId}/messages`).expect(404);
    });

    it("answers 401 for a bad or missing signature", async () => {
      const path = `/integrations/shore/${orgId}/messages`;
      await get(path, { key: "w".repeat(40) }).expect(401);
      await request(app)
        .get(path)
        .expect(401);
      // Signed for a different query string
      await request(app)
        .get(`${path}?afterId=5`)
        .set(signedHeaders({ key: KEY, method: "GET", path, body: "" }))
        .expect(401);
    });

    it("ignores Spoke's session: no cookie is needed or used", async () => {
      const res = await get(`/integrations/shore/${orgId}/messages`).expect(
        200
      );
      expect(res.body).toEqual({ messages: [], nextAfterId: 0 });
    });
  });

  describe("POST /opt-outs", () => {
    it("receives the raw body intact through Spoke's global JSON parser", async () => {
      const res = await post(optOutPath(), {
        cells: ["+15155559100"],
        reason: "manual"
      }).expect(200);
      expect(res.body).toEqual({
        optedOut: 1,
        alreadyOptedOut: 0,
        invalid: 0,
        failed: 0
      });
    });

    it("refuses application/json with 415, even when correctly signed", async () => {
      await post(
        optOutPath(),
        { cells: ["+15155559100"] },
        { contentType: "application/json" }
      ).expect(415);
    });

    it("rejects a tampered body", async () => {
      const path = optOutPath();
      const signedFor = JSON.stringify({ cells: ["+15155559100"] });
      await request(app)
        .post(path)
        .set(signedHeaders({ key: KEY, method: "POST", path, body: signedFor }))
        .set("Content-Type", VENDOR_JSON)
        .send(JSON.stringify({ cells: ["+15155559199"] }))
        .expect(401);
    });

    it("opts out a contact through Spoke's own path", async () => {
      const contact = c.dbCampaignContact;
      const res = await post(optOutPath(), {
        cells: [contact.cell],
        reason: "manual",
        shoreRequestId: "req-1"
      }).expect(200);
      expect(res.body.optedOut).toBe(1);

      const optOut = await r
        .knex("opt_out")
        .where({ cell: contact.cell, organization_id: orgId })
        .first();
      expect(optOut.reason_code).toBe("shore:manual");
      expect(optOut.assignment_id).toBeNull();
      const updated = await r
        .knex("campaign_contact")
        .where("id", contact.id)
        .first();
      expect(updated.is_opted_out).toBe(true);
      expect(
        await cacheableData.optOut.query({
          cell: contact.cell,
          organizationId: orgId
        })
      ).toBe(true);
    });

    it("is idempotent and counts bad and repeated cells", async () => {
      const cell = c.dbCampaignContact.cell;
      await post(optOutPath(), { cells: [cell] }).expect(200);
      const res = await post(optOutPath(), {
        cells: [cell, "not a number", "+15155559111", "+15155559111", 42]
      }).expect(200);
      expect(res.body).toEqual({
        optedOut: 1,
        alreadyOptedOut: 2,
        invalid: 2,
        failed: 0
      });
      const rows = await r.knex("opt_out").where({ cell });
      expect(rows.length).toBe(1);
      expect(rows[0].reason_code).toBe("shore:optout");
    });

    it("validates the request", async () => {
      await post(optOutPath(), "{not json").expect(400);
      await post(optOutPath(), { cells: [] }).expect(400);
      await post(optOutPath(), {
        cells: Array(501).fill("+15155559100")
      }).expect(400);
      await post(optOutPath(), {
        cells: ["+15155559100"],
        reason: "has spaces"
      }).expect(400);
    });

    it("keeps the opt-out when another service manager throws", async () => {
      global.SERVICE_MANAGERS = "test-fake-example";
      const spy = jest
        .spyOn(fakeServiceManager, "onOptOut")
        .mockImplementation(async () => {
          throw new Error("boom");
        });
      try {
        const cell = c.dbCampaignContact.cell;
        const res = await post(optOutPath(), { cells: [cell] }).expect(200);
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].contact.cell).toBe(cell);
        expect(res.body.optedOut).toBe(1);
        expect(await r.knex("opt_out").where({ cell })).toHaveLength(1);
      } finally {
        spy.mockRestore();
        delete global.SERVICE_MANAGERS;
      }
    });
  });

  describe("read endpoints", () => {
    let otherContact;

    const insertMessage = (contact, overrides = {}) =>
      r
        .knex("message")
        .insert({
          campaign_contact_id: contact.id,
          contact_number: contact.cell,
          user_number: "+15555559000",
          is_from_contact: false,
          text: "Hi there",
          send_status: "SENT",
          service: "fakeservice",
          ...overrides
        })
        .returning("id");

    beforeEach(async () => {
      // A second organization whose rows must never appear.
      const user = await createUser({ auth0_id: "other-org-user" });
      const invite = await createInvite();
      const otherOrg = await createOrganization(user, invite);
      const otherCampaign = await createCampaign(user, otherOrg);
      [otherContact] = await createContacts(otherCampaign, 1);
    });

    it("pages messages by id, scoped to the organization", async () => {
      const contact = c.dbCampaignContact;
      await insertMessage(contact, { text: "one" });
      await insertMessage(otherContact, { text: "other org" });
      await insertMessage(contact, {
        text: "two",
        is_from_contact: true,
        send_status: "DELIVERED"
      });

      const base = `/integrations/shore/${orgId}/messages`;
      const first = await get(`${base}?limit=1`).expect(200);
      expect(first.body.messages).toHaveLength(1);
      expect(first.body.messages[0]).toMatchObject({
        campaignId: Number(c.testCampaign.id),
        campaignContactId: Number(contact.id),
        contactNumber: contact.cell,
        isFromContact: false,
        text: "one",
        sendStatus: "SENT"
      });
      const next = await get(
        `${base}?afterId=${first.body.nextAfterId}&limit=10`
      ).expect(200);
      expect(next.body.messages.map(m => m.text)).toEqual(["two"]);
      expect(next.body.messages[0].isFromContact).toBe(true);

      const done = await get(`${base}?afterId=${next.body.nextAfterId}`).expect(
        200
      );
      expect(done.body).toEqual({
        messages: [],
        nextAfterId: next.body.nextAfterId
      });
    });

    it("holds back rows newer than the settle window", async () => {
      // (updateOrganizationFeatures replaces earlier test features)
      await updateOrganizationFeatures(
        c.testOrganization,
        shoreFeatures({ SHORE_SETTLE_SECONDS: "15" })
      );
      await insertMessage(c.dbCampaignContact);
      const res = await get(`/integrations/shore/${orgId}/messages`).expect(
        200
      );
      expect(res.body).toEqual({ messages: [], nextAfterId: 0 });
    });

    it("rejects bad paging", async () => {
      await get(`/integrations/shore/${orgId}/messages?afterId=-1`).expect(400);
      await get(`/integrations/shore/${orgId}/messages?limit=0`).expect(400);
    });

    it("returns survey answers, tags and opt-outs", async () => {
      const contact = c.dbCampaignContact;
      const [step] = await r
        .knex("interaction_step")
        .insert({
          campaign_id: c.testCampaign.id,
          question: "Can we count on your vote?"
        })
        .returning("id");
      const stepId = step.id || step;
      await r.knex("question_response").insert({
        campaign_contact_id: contact.id,
        interaction_step_id: stepId,
        value: "Yes"
      });
      const [tag] = await r
        .knex("tag")
        .insert({
          name: "Needs a ride",
          description: "",
          organization_id: orgId
        })
        .returning("id");
      const tagId = tag.id || tag;
      await r
        .knex("tag_campaign_contact")
        .insert({ tag_id: tagId, campaign_contact_id: contact.id });
      await r.knex("opt_out").insert({
        cell: "+15555550123",
        organization_id: orgId,
        reason_code: "stop"
      });

      const qr = await get(
        `/integrations/shore/${orgId}/question-responses`
      ).expect(200);
      expect(qr.body.questionResponses).toEqual([
        expect.objectContaining({
          campaignContactId: Number(contact.id),
          interactionStepId: Number(stepId),
          value: "Yes"
        })
      ]);

      const tags = await get(`/integrations/shore/${orgId}/tags`).expect(200);
      expect(tags.body.tags).toEqual([
        expect.objectContaining({
          campaignContactId: Number(contact.id),
          tagId: Number(tagId),
          tagName: "Needs a ride"
        })
      ]);

      const optOuts = await get(`/integrations/shore/${orgId}/opt-outs`).expect(
        200
      );
      expect(optOuts.body.optOuts).toEqual([
        expect.objectContaining({ cell: "+15555550123", reasonCode: "stop" })
      ]);

      const campaigns = await get(
        `/integrations/shore/${orgId}/campaigns`
      ).expect(200);
      expect(campaigns.body.campaigns).toHaveLength(1);
      expect(campaigns.body.campaigns[0]).toMatchObject({
        id: Number(c.testCampaign.id),
        isStarted: true,
        isArchived: false,
        shoreLoad: null
      });
      expect(
        campaigns.body.campaigns[0].interactionSteps.find(
          s => s.id === Number(stepId)
        )
      ).toMatchObject({ question: "Can we count on your vote?" });

      const statePath = `/integrations/shore/${orgId}/campaigns/${c.testCampaign.id}/contact-state?limit=1`;
      const state = await get(statePath).expect(200);
      expect(state.body.contacts).toEqual([
        {
          campaignContactId: Number(contact.id),
          externalId: contact.external_id || null,
          messageStatus: expect.any(String),
          isOptedOut: false,
          questionResponses: [
            { interactionStepId: Number(stepId), value: "Yes" }
          ],
          tags: [{ tagId: Number(tagId), tagName: "Needs a ride", value: null }]
        }
      ]);

      // A cleared answer only shows up in contact state.
      await r
        .knex("question_response")
        .where("campaign_contact_id", contact.id)
        .delete();
      const cleared = await get(statePath).expect(200);
      expect(cleared.body.contacts[0].questionResponses).toEqual([]);
    });

    it("404s contact state for a campaign in another organization", async () => {
      await get(
        `/integrations/shore/${orgId}/campaigns/${otherContact.campaign_id}/contact-state`
      ).expect(404);
    });
  });
});

describe("settledPrefix", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  const at = secondsAgo => ({
    created_at: new Date(now - secondsAgo * 1000).toISOString()
  });

  it("stops at the first row inside the window", () => {
    const rows = [at(60), at(30), at(5), at(40)];
    expect(settledPrefix(rows, 15, now)).toEqual([at(60), at(30)]);
  });

  it("returns everything when the window is 0", () => {
    const rows = [at(1), at(0)];
    expect(settledPrefix(rows, 0, now)).toEqual(rows);
  });
});
