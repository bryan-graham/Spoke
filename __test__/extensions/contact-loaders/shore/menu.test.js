import nock from "nock";
import jwt from "jsonwebtoken";
import { r } from "../../../../src/server/models";
import {
  setupTest,
  cleanupTest,
  createUser,
  createInvite,
  createOrganization,
  updateOrganizationFeatures
} from "../../../test_helpers";
import {
  cleanMenu,
  menuHandler,
  signMenuToken,
  MENU_AUDIENCE
} from "../../../../src/extensions/contact-loaders/shore/lib/menu";

const SECRET = "token-auth-shared-secret-for-tests";
const SHORE = "https://shore.test";
const MENU_PATH = "/api/integrations/spoke/gotv/menu";

const MENU = {
  org: {
    slug: "gotv",
    name: "Graham for Providence",
    logo: { light: "https://shore.test/logo" }
  },
  user: {
    name: "Pat Example",
    email: "pat@example.com",
    role: "staff",
    colorScheme: "dark"
  },
  counts: { message: 2 },
  groups: [
    {
      label: null,
      items: [
        {
          key: "inbox",
          label: "Inbox",
          icon: "inbox",
          url: "https://shore.test/o/gotv/inbox",
          path: "inbox",
          count: 3
        },
        {
          key: "texting",
          label: "Texting",
          icon: "message",
          url: "https://shore.test/auth/spoke/gotv",
          external: true
        }
      ]
    }
  ]
};

const fakeRes = () => {
  const res = { headers: {} };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.set = (key, value) => {
    res.headers[key] = value;
    return res;
  };
  res.json = body => {
    res.body = body;
    return res;
  };
  return res;
};

describe("cleanMenu", () => {
  it("keeps the documented fields and drops the rest", () => {
    expect(cleanMenu(MENU)).toEqual({
      org: { slug: "gotv", name: "Graham for Providence" },
      user: {
        name: "Pat Example",
        email: "pat@example.com",
        role: "staff",
        colorScheme: "dark"
      },
      groups: [
        {
          label: null,
          items: [
            {
              key: "inbox",
              label: "Inbox",
              icon: "inbox",
              url: "https://shore.test/o/gotv/inbox",
              count: 3
            },
            {
              key: "texting",
              label: "Texting",
              icon: "message",
              url: "https://shore.test/auth/spoke/gotv",
              external: true
            }
          ]
        }
      ]
    });
  });

  it("drops unsafe links, bad icons and bad counts", () => {
    const menu = cleanMenu({
      groups: [
        {
          label: "X",
          items: [
            { key: "evil", label: "Evil", url: "javascript:alert(1)" },
            { key: "data", label: "Data", url: "data:text/html,hi" },
            {
              key: "ok",
              label: "OK",
              url: "https://shore.test/ok",
              icon: "<script>",
              count: -2
            },
            { key: "nolabel", url: "https://shore.test/x" }
          ]
        }
      ]
    });
    expect(menu.groups[0].items).toEqual([
      { key: "ok", label: "OK", icon: null, url: "https://shore.test/ok" }
    ]);
  });

  it("passes colorScheme only when it's auto, light or dark", () => {
    const scheme = value =>
      cleanMenu({ user: { colorScheme: value }, groups: [] }).user.colorScheme;
    expect(["auto", "light", "dark"].map(scheme)).toEqual([
      "auto",
      "light",
      "dark"
    ]);
    expect(scheme(undefined)).toBeNull();
    expect(scheme("purple")).toBeNull();
    expect(scheme({ evil: 1 })).toBeNull();
  });

  it("rejects something that isn't a menu", () => {
    expect(cleanMenu(null)).toBeNull();
    expect(cleanMenu({ groups: "nope" })).toBeNull();
  });
});

describe("signMenuToken", () => {
  it("signs HS256 with sub, aud and a short expiry", () => {
    const token = signMenuToken(SECRET, "pat@example.com");
    expect(jwt.decode(token, { complete: true }).header.alg).toBe("HS256");
    const claims = jwt.verify(token, SECRET, { audience: MENU_AUDIENCE });
    expect(claims.sub).toBe("pat@example.com");
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(300);
  });
});

describe("GET /shore-menu/:organizationId", () => {
  let user;
  let orgId;
  let testOrganization;

  beforeEach(async () => {
    await cleanupTest();
    await setupTest();
    user = await createUser({ email: "pat@example.com" });
    const invite = await createInvite();
    testOrganization = await createOrganization(user, invite);
    orgId = testOrganization.data.createOrganization.id;
    await updateOrganizationFeatures(testOrganization, {
      SHORE_URL: SHORE,
      SHORE_CAMPAIGN: "gotv",
      TOKEN_AUTH_SHARED_SECRET: SECRET
    });
    nock.disableNetConnect();
  }, global.DATABASE_SETUP_TEARDOWN_TIMEOUT);

  afterEach(async () => {
    nock.cleanAll();
    nock.enableNetConnect();
    await cleanupTest();
  }, global.DATABASE_SETUP_TEARDOWN_TIMEOUT);

  const call = async (reqUser, organizationId = orgId) => {
    const res = fakeRes();
    await menuHandler()(
      { user: reqUser, params: { organizationId: String(organizationId) } },
      res
    );
    return res;
  };

  it("fetches Shore's menu with a token Shore can verify, uncached", async () => {
    let claims;
    nock(SHORE)
      .get(MENU_PATH)
      .reply(function() {
        // nock gives header values as arrays
        const auth = [].concat(this.req.headers.authorization)[0];
        claims = jwt.verify(auth.replace(/^Bearer /, ""), SECRET, {
          audience: MENU_AUDIENCE,
          algorithms: ["HS256"]
        });
        return [200, MENU];
      });
    const res = await call(user);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(res.body.org.name).toBe("Graham for Providence");
    expect(res.body.groups[0].items.map(i => i.key)).toEqual([
      "inbox",
      "texting"
    ]);
    expect(claims.sub).toBe("pat@example.com");
  });

  it("needs a signed-in Spoke user", async () => {
    expect((await call(undefined)).statusCode).toBe(401);
  });

  it("refuses people outside the organization", async () => {
    const stranger = await createUser({
      auth0_id: "stranger",
      email: "stranger@example.com"
    });
    const res = await call(stranger);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "not_found" });
  });

  it("says not_configured without Shore's URL, campaign or secret", async () => {
    await updateOrganizationFeatures(testOrganization, {
      TOKEN_AUTH_SHARED_SECRET: ""
    });
    const res = await call(user);
    expect(res.body).toEqual({ error: "not_configured" });
  });

  it("treats Shore's 401/403 as no menu for this person", async () => {
    nock(SHORE)
      .get(MENU_PATH)
      .reply(403, { error: "not_a_member" });
    const res = await call(user);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "not_a_shore_member" });
  });

  it("reports Shore being down", async () => {
    nock(SHORE)
      .get(MENU_PATH)
      .replyWithError("ECONNREFUSED");
    expect((await call(user)).body).toEqual({ error: "shore_unreachable" });
    nock(SHORE)
      .get(MENU_PATH)
      .reply(500);
    expect((await call(user)).body).toEqual({ error: "shore_error" });
  });

  it("lets a superadmin outside the organization see it", async () => {
    nock(SHORE)
      .get(MENU_PATH)
      .reply(200, MENU);
    const admin = await createUser({
      auth0_id: "super",
      email: "super@example.com",
      is_superadmin: true
    });
    await r
      .knex("user_organization")
      .where({ user_id: admin.id })
      .delete();
    expect((await call(admin)).statusCode).toBe(200);
  });
});
