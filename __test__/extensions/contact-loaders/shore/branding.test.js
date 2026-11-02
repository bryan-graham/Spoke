import fs from "fs";
import os from "os";
import path from "path";
import {
  shoreBranding,
  shoreConfigured,
  assetsHandler,
  ASSETS_DIR
} from "../../../../src/extensions/contact-loaders/shore/lib/branding";
import renderIndex from "../../../../src/server/middleware/render-index";

const makeDir = files => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shore-assets-"));
  files.forEach(name => fs.writeFileSync(path.join(dir, name), "x"));
  return dir;
};

const fakeRes = () => {
  const res = { headers: {} };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.end = () => res;
  res.set = (k, val) => {
    res.headers[k] = val;
    return res;
  };
  res.sendFile = file => {
    res.sentFile = file;
    return res;
  };
  return res;
};

describe("shoreBranding", () => {
  it("is null when this Spoke isn't set up for Shore", () => {
    const dir = makeDir(["favicon.png", "shore-logo.svg"]);
    expect(shoreBranding({ dir, configured: false })).toBeNull();
  });

  it("lists the files that are there", () => {
    const dir = makeDir([
      "favicon.png",
      "apple-touch-icon.png",
      "shore-logo.svg"
    ]);
    expect(shoreBranding({ dir, configured: true })).toEqual({
      favicon: "/shore-assets/favicon.png",
      faviconType: "image/png",
      appleTouchIcon: "/shore-assets/apple-touch-icon.png",
      logo: "/shore-assets/shore-logo.svg"
    });
  });

  it("prefers an SVG favicon and allows any file to be missing", () => {
    const dir = makeDir(["favicon.ico", "favicon.svg"]);
    expect(shoreBranding({ dir, configured: true })).toEqual({
      favicon: "/shore-assets/favicon.svg",
      faviconType: "image/svg+xml",
      appleTouchIcon: null,
      logo: null
    });
  });

  it("is configured only with the shore loader and a valid SHORE_URL", () => {
    const old = { ...global };
    try {
      global.CONTACT_LOADERS = "csv-upload,shore";
      global.SHORE_URL = "https://app.shore.test";
      expect(shoreConfigured()).toBe(true);
      global.SHORE_URL = "not a url";
      expect(shoreConfigured()).toBe(false);
      global.SHORE_URL = "https://app.shore.test";
      global.CONTACT_LOADERS = "csv-upload";
      expect(shoreConfigured()).toBe(false);
    } finally {
      delete global.SHORE_URL;
      if (old.CONTACT_LOADERS === undefined) {
        delete global.CONTACT_LOADERS;
      } else {
        global.CONTACT_LOADERS = old.CONTACT_LOADERS;
      }
    }
  });
});

describe("GET /shore-assets/:name", () => {
  const dir = makeDir(["favicon.png", "shore-logo.svg", "secret.txt"]);
  const get = name => {
    const res = fakeRes();
    assetsHandler({ dir })({ params: { name } }, res);
    return res;
  };

  it("serves a listed file with its type and safe headers", () => {
    const res = get("shore-logo.svg");
    expect(res.sentFile).toBe(path.join(dir, "shore-logo.svg"));
    expect(res.headers["Content-Type"]).toBe("image/svg+xml");
    expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(res.headers["Content-Security-Policy"]).toMatch(
      /default-src 'none'/
    );
  });

  it("serves nothing else", () => {
    expect(get("secret.txt").statusCode).toBe(404);
    expect(get("../branding.js").statusCode).toBe(404);
    expect(get("apple-touch-icon.png").statusCode).toBe(404); // listed, missing
    expect(get("README.md").statusCode).toBe(404);
  });

  it("ships a README in the real folder", () => {
    expect(fs.existsSync(path.join(ASSETS_DIR, "README.md"))).toBe(true);
  });
});

describe("renderIndex favicon", () => {
  const args = [
    "",
    { content: "", renderedClassNames: "" },
    { "bundle.js": "" }
  ];

  it("keeps Spoke's favicon and no Shore logo when not set up for Shore", () => {
    const html = renderIndex(...args);
    expect(html).toContain("spoke-public/spoke_logo.svg");
    expect(html).toContain('window.SHORE_LOGO_URL=""');
  });
});
