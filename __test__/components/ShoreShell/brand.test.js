import {
  pickLogo,
  isWordmark,
  pageTitle
} from "../../../src/components/ShoreShell/brand";

describe("campaign brand", () => {
  const both = { light: "https://x.test/l?v=1", dark: "https://x.test/d?v=1" };

  it("uses the logo for the current scheme, else the other one", () => {
    expect(pickLogo(both, "light")).toBe(both.light);
    expect(pickLogo(both, "dark")).toBe(both.dark);
    expect(pickLogo({ light: both.light, dark: null }, "dark")).toBe(
      both.light
    );
    expect(pickLogo({ light: null, dark: both.dark }, "light")).toBe(both.dark);
    expect(pickLogo({ light: null, dark: null }, "light")).toBeNull();
    expect(pickLogo(undefined, "light")).toBeNull();
  });

  it("treats wide logos as wordmarks", () => {
    expect(isWordmark(3.2)).toBe(true);
    expect(isWordmark(1)).toBe(false);
    expect(isWordmark(1.5)).toBe(false);
  });

  it("titles the page with the campaign, Shore and Texting", () => {
    expect(pageTitle("Graham for Providence")).toBe(
      "Graham for Providence • Shore • Texting"
    );
    expect(pageTitle("")).toBe("Shore • Texting");
  });
});
