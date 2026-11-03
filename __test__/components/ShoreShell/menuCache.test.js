/**
 * @jest-environment jsdom
 */
import React from "react";
import { mount } from "enzyme";
import { act } from "react-dom/test-utils";
import {
  readCachedMenu,
  writeCachedMenu,
  clearMenuCache
} from "../../../src/components/ShoreShell/menuCache";
import useShoreMenu from "../../../src/components/ShoreShell/useShoreMenu";

const MENU = {
  org: {
    slug: "gfp",
    name: "Graham for Providence",
    publicLogo: { light: "https://x.test/l?v=1", dark: null }
  },
  user: {
    name: "Pat",
    email: "pat@example.com",
    role: "staff",
    colorScheme: "dark"
  },
  groups: [
    {
      label: null,
      items: [
        { key: "inbox", label: "Inbox", url: "https://x.test/inbox", count: 2 }
      ]
    }
  ]
};

describe("Shore menu cache", () => {
  beforeEach(() => window.localStorage.clear());

  it("remembers the menu per organization without the person's name or email", () => {
    writeCachedMenu("1", MENU);
    const cached = readCachedMenu("1");
    expect(cached.org).toEqual(MENU.org);
    expect(cached.groups).toEqual(MENU.groups);
    expect(cached.user).toEqual({ colorScheme: "dark" });
    expect(JSON.stringify(cached)).not.toContain("pat@example.com");
    expect(readCachedMenu("2")).toBeNull();
  });

  it("forgets it when there's no menu, and on logout", () => {
    writeCachedMenu("1", MENU);
    writeCachedMenu("1", null);
    expect(readCachedMenu("1")).toBeNull();
    writeCachedMenu("1", MENU);
    window.localStorage.setItem("spoke.logoShape.https://x.test/l?v=1", "3");
    window.localStorage.setItem("spoke.colorScheme", "dark");
    clearMenuCache();
    expect(readCachedMenu("1")).toBeNull();
    expect(
      window.localStorage.getItem("spoke.logoShape.https://x.test/l?v=1")
    ).toBeNull();
    expect(window.localStorage.getItem("spoke.colorScheme")).toBe("dark");
  });

  it("starts from the remembered menu, then uses the fresh one", async () => {
    writeCachedMenu("1", MENU);
    let resolve;
    global.fetch = jest.fn(
      () =>
        new Promise(r => {
          resolve = r;
        })
    );
    const seen = [];
    const Probe = () => {
      const state = useShoreMenu("1");
      seen.push(state);
      return null;
    };
    mount(<Probe />);
    expect(seen[0].menu.org.name).toBe("Graham for Providence");
    expect(seen[0].loaded).toBe(false);
    const fresh = { ...MENU, org: { ...MENU.org, name: "Renamed" } };
    await act(async () => {
      resolve({ ok: true, json: () => Promise.resolve(fresh) });
      await new Promise(r => setTimeout(r, 0));
    });
    const last = seen[seen.length - 1];
    expect(last).toMatchObject({
      loaded: true,
      menu: { org: { name: "Renamed" } }
    });
    expect(readCachedMenu("1").org.name).toBe("Renamed");
    delete global.fetch;
  });
});
