import { r } from "../../src/server/models";
import { tokenLogin } from "../../src/server/auth-passport";
import {
  setupTest,
  cleanupTest,
  createUser,
  createInvite,
  createOrganization
} from "../test_helpers";

const rolesFor = async userId =>
  (
    await r
      .knex("user_organization")
      .where("user_id", userId)
      .orderBy("organization_id")
      .select("organization_id", "role")
  ).map(row => [Number(row.organization_id), row.role]);

describe("tokenLogin (PASSPORT_STRATEGY=token)", () => {
  let orgId;

  beforeEach(async () => {
    await cleanupTest();
    await setupTest();
    const owner = await createUser({
      auth0_id: "owner",
      email: "owner@example.com"
    });
    const org = await createOrganization(owner, await createInvite());
    orgId = Number(org.data.createOrganization.id);
  }, global.DATABASE_SETUP_TEARDOWN_TIMEOUT);

  afterEach(async () => {
    await cleanupTest();
  }, global.DATABASE_SETUP_TEARDOWN_TIMEOUT);

  it("signs in on a new Spoke when the asserted organization doesn't exist yet", async () => {
    const user = await tokenLogin({
      sub: "pat@example.com",
      name: "Pat Example",
      user_organizations: [{ organization_id: 999, role: "OWNER" }]
    });
    expect(user.email).toBe("pat@example.com");
    expect(user.first_name).toBe("Pat");
    expect(await rolesFor(user.id)).toEqual([]);
  });

  it("adds the user to existing asserted organizations", async () => {
    const user = await tokenLogin({
      sub: "pat@example.com",
      user_organizations: [
        { organization_id: orgId, role: "ADMIN" },
        { organization_id: 999, role: "TEXTER" }
      ]
    });
    expect(await rolesFor(user.id)).toEqual([[orgId, "ADMIN"]]);
  });

  it("syncs roles on later sign-ins and reuses the user", async () => {
    const first = await tokenLogin({
      sub: "pat@example.com",
      user_organizations: [{ organization_id: orgId, role: "TEXTER" }]
    });
    const second = await tokenLogin({
      sub: "pat@example.com",
      user_organizations: [{ organization_id: String(orgId), role: "OWNER" }]
    });
    expect(second.id).toBe(first.id);
    expect(await rolesFor(second.id)).toEqual([[orgId, "OWNER"]]);
  });

  it("skips invalid organization ids and roles", async () => {
    const user = await tokenLogin({
      sub: "pat@example.com",
      user_organizations: [
        { organization_id: "graham-for-providence", role: "OWNER" },
        { organization_id: orgId, role: "EMPEROR" },
        null
      ]
    });
    expect(await rolesFor(user.id)).toEqual([]);
  });

  it("leaves roles alone when the token asserts none", async () => {
    const user = await tokenLogin({
      sub: "pat@example.com",
      user_organizations: [{ organization_id: orgId, role: "ADMIN" }]
    });
    await tokenLogin({ sub: "pat@example.com" });
    expect(await rolesFor(user.id)).toEqual([[orgId, "ADMIN"]]);
  });
});
