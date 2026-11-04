import { r } from "../../../src/server/models/";
import {
  ORGANIZATION_LOGO_QUERY,
  UPDATE_ORGANIZATION_LOGO
} from "../../../src/components/OrganizationLogoSettings";
import {
  logoHandler,
  parseLogo,
  LogoError,
  MAX_BYTES
} from "../../../src/server/lib/organization-logo";
import {
  cleanupTest,
  createStartedCampaign,
  runGql,
  setupTest
} from "../../test_helpers";

// The smallest valid PNG (1x1).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
const pngUrl = `data:image/png;base64,${PNG.toString("base64")}`;

const fakeRes = () => {
  const res = { statusCode: 200, headers: {}, body: null };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.set = headers => Object.assign(res.headers, headers);
  res.send = body => {
    res.body = body;
  };
  res.end = () => {};
  return res;
};

describe("parseLogo", () => {
  it("accepts a PNG data URL", () => {
    expect(parseLogo(pngUrl)).toEqual({
      contentType: "image/png",
      data: PNG.toString("base64")
    });
  });

  it("refuses SVG, which could run script from Spoke's address", () => {
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>");
    expect(() =>
      parseLogo(`data:image/svg+xml;base64,${svg.toString("base64")}`)
    ).toThrow(LogoError);
  });

  it("refuses a file that isn't the type it claims", () => {
    expect(() =>
      parseLogo(
        `data:image/png;base64,${Buffer.from("hello").toString("base64")}`
      )
    ).toThrow("isn't the image type");
  });

  it("refuses an image over the size limit", () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_BYTES)]);
    expect(() =>
      parseLogo(`data:image/png;base64,${big.toString("base64")}`)
    ).toThrow("512 KB");
  });

  it("refuses something that isn't a data URL", () => {
    expect(() => parseLogo("https://example.com/logo.png")).toThrow(LogoError);
  });
});

describe("organization logos", () => {
  let campaign;

  beforeEach(async () => {
    await setupTest();
    campaign = await createStartedCampaign();
  }, global.DATABASE_SETUP_TEARDOWN_TIMEOUT);

  afterEach(async () => {
    await cleanupTest();
  }, global.DATABASE_SETUP_TEARDOWN_TIMEOUT);

  const update = (user, scheme, image) =>
    runGql(
      UPDATE_ORGANIZATION_LOGO,
      { organizationId: campaign.organizationId, scheme, image },
      user
    );

  it("lets an owner upload, replace and remove a logo; members see it", async () => {
    const { organizationId, testAdminUser, testTexterUser } = campaign;
    const saved = await update(testAdminUser, "dark", pngUrl);
    expect(saved.errors).toBeUndefined();
    const { light, dark } = saved.data.updateOrganizationLogo.logo;
    expect(light).toBeNull();
    expect(dark).toMatch(
      new RegExp(`^/org-logo/${organizationId}/dark\\?v=\\d+$`)
    );

    // a texter's sidebar gets the same address
    const read = await runGql(
      ORGANIZATION_LOGO_QUERY,
      { organizationId },
      testTexterUser
    );
    expect(read.data.organization.logo.dark).toBe(dark);

    // the address serves the image, cacheable for good at this version
    const version = dark.split("v=")[1];
    const res = fakeRes();
    await logoHandler(
      { params: { organizationId, scheme: "dark" }, query: { v: version } },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("image/png");
    expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(res.headers["Cache-Control"]).toContain("immutable");
    expect(Buffer.compare(res.body, PNG)).toBe(0);

    // replacing keeps one row per scheme
    await update(testAdminUser, "dark", pngUrl);
    const rows = await r
      .knex("organization_logo")
      .where({ organization_id: organizationId });
    expect(rows).toHaveLength(1);

    // removing
    const removed = await update(testAdminUser, "dark", null);
    expect(removed.data.updateOrganizationLogo.logo.dark).toBeNull();
    const gone = fakeRes();
    await logoHandler(
      { params: { organizationId, scheme: "dark" }, query: {} },
      gone
    );
    expect(gone.statusCode).toBe(404);
  });

  it("doesn't let a texter change the logo", async () => {
    const result = await update(campaign.testTexterUser, "light", pngUrl);
    expect(result.errors).toBeDefined();
    const rows = await r.knex("organization_logo");
    expect(rows).toHaveLength(0);
  });

  it("says what's wrong with an unusable image", async () => {
    const result = await update(
      campaign.testAdminUser,
      "light",
      `data:image/png;base64,${Buffer.from("nope").toString("base64")}`
    );
    expect(result.errors[0].message).toContain("isn't the image type");
  });
});
