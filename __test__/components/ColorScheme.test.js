/**
 * @jest-environment jsdom
 */
import React, { useContext } from "react";
import { mount } from "enzyme";
import { act } from "react-dom/test-utils";
import {
  effectivePreference,
  resolveScheme,
  readStored,
  writeStored,
  useColorSchemeState,
  ColorSchemeContext,
  STORAGE_KEYS
} from "../../src/components/ColorScheme";
import { buildThemeOptions } from "../../src/styles/mui-theme";

describe("color scheme rules", () => {
  it("prefers Shore's setting, then Spoke's, then auto", () => {
    expect(effectivePreference({ shore: "dark", local: "light" })).toBe("dark");
    expect(effectivePreference({ shore: null, local: "light" })).toBe("light");
    expect(effectivePreference({ shore: null, local: null })).toBe("auto");
    expect(effectivePreference({ shore: "purple", local: null })).toBe("auto");
  });

  it("resolves auto from the device", () => {
    expect(resolveScheme("auto", true)).toBe("dark");
    expect(resolveScheme("auto", false)).toBe("light");
    expect(resolveScheme("light", true)).toBe("light");
    expect(resolveScheme("dark", false)).toBe("dark");
  });

  it("remembers only valid values", () => {
    writeStored(STORAGE_KEYS.local, "dark");
    expect(readStored(STORAGE_KEYS.local)).toBe("dark");
    window.localStorage.setItem(STORAGE_KEYS.local, "neon");
    expect(readStored(STORAGE_KEYS.local)).toBeNull();
    writeStored(STORAGE_KEYS.local, null);
    expect(window.localStorage.getItem(STORAGE_KEYS.local)).toBeNull();
  });
});

describe("useColorSchemeState", () => {
  let current;
  const Probe = () => {
    current = useColorSchemeState();
    return null;
  };

  beforeEach(() => {
    window.localStorage.clear();
    window.matchMedia = jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }));
  });

  it("follows Shore while connected and Spoke's choice otherwise", () => {
    mount(<Probe />);
    expect(current).toMatchObject({ preference: "auto", scheme: "light" });

    act(() => current.setPreference("dark"));
    expect(current).toMatchObject({
      preference: "dark",
      scheme: "dark",
      followsShore: false
    });
    expect(document.documentElement.getAttribute("data-color-scheme")).toBe(
      "dark"
    );

    act(() => current.setShorePreference("light"));
    expect(current).toMatchObject({
      preference: "light",
      scheme: "light",
      followsShore: true
    });
    expect(window.localStorage.getItem(STORAGE_KEYS.shore)).toBe("light");

    act(() => current.setShorePreference(null));
    expect(current).toMatchObject({ preference: "dark", followsShore: false });
    expect(window.localStorage.getItem(STORAGE_KEYS.shore)).toBeNull();
  });

  it("starts from what was remembered", () => {
    window.localStorage.setItem(STORAGE_KEYS.shore, "dark");
    mount(<Probe />);
    expect(current).toMatchObject({ scheme: "dark", followsShore: true });
  });
});

describe("buildThemeOptions", () => {
  it("builds Shore's light and dark themes", () => {
    const light = buildThemeOptions("light");
    const dark = buildThemeOptions("dark");
    expect(light.palette.type).toBe("light");
    expect(light.palette.primary.main).toBe("#293169");
    expect(light.palette.background.default).toBe("#F3F4F8");
    expect(dark.palette.type).toBe("dark");
    expect(dark.palette.primary.main).toBe("#636CD6");
    expect(dark.palette.background).toEqual({
      default: "#0A1122",
      paper: "#0F1729"
    });
    const rootVars = dark.overrides.MuiCssBaseline["@global"][":root"];
    expect(rootVars["--shore-canvas"]).toBe("#0A1122");
    expect(rootVars["--shore-link"]).toBe("#8BD2F4");
  });

  it("lets an organization's palette set colours but not surfaces", () => {
    const options = buildThemeOptions("dark", {
      type: "light",
      primary: { main: "#209556" },
      background: { default: "#FFFFFF" }
    });
    expect(options.palette.primary.main).toBe("#209556");
    expect(options.palette.type).toBe("dark");
    expect(options.palette.background.default).toBe("#0A1122");
  });
});

describe("ColorSchemeContext default", () => {
  it("is safe to use without a provider", () => {
    let value;
    const Reader = () => {
      value = useContext(ColorSchemeContext);
      return null;
    };
    mount(<Reader />);
    expect(value.scheme).toBe("light");
    expect(() => value.setShorePreference("dark")).not.toThrow();
  });
});
