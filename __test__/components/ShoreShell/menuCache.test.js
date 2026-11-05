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
import useShoreMenu, {
  RETRY_DELAYS_MS
} from "../../../src/components/ShoreShell/useShoreMenu";

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
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.SPOKE_USER_ID = "5";
  });
  afterAll(() => {
    delete window.SPOKE_USER_ID;
  });

  it("remembers the menu per organization without the person's name or email", () => {
    writeCachedMenu("1", MENU);
    const cached = readCachedMenu("1");
    expect(cached.org).toEqual(MENU.org);
    expect(cached.groups).toEqual(MENU.groups);
    expect(cached.user).toEqual({ colorScheme: "dark" });
    expect(JSON.stringify(cached)).not.toContain("pat@example.com");
    expect(readCachedMenu("2")).toBeNull();
  });

  it("keeps it for this person, in this browser session only", () => {
    writeCachedMenu("1", MENU);
    expect(window.sessionStorage.getItem("spoke.shoreMenu.5.1")).not.toBeNull();
    expect(window.localStorage.length).toBe(0);
    // Someone else signed in on the same browser doesn't see it.
    window.SPOKE_USER_ID = "6";
    expect(readCachedMenu("1")).toBeNull();
    // Nor does anyone when nobody is signed in, and nothing is remembered.
    delete window.SPOKE_USER_ID;
    expect(readCachedMenu("1")).toBeNull();
    writeCachedMenu("2", MENU);
    expect(window.sessionStorage.length).toBe(1);
  });

  it("forgets it when there's no menu, and on logout", () => {
    writeCachedMenu("1", MENU);
    writeCachedMenu("1", null);
    expect(readCachedMenu("1")).toBeNull();
    writeCachedMenu("1", MENU);
    window.localStorage.setItem("spoke.logoShape.https://x.test/l?v=1", "3");
    window.localStorage.setItem("spoke.colorScheme", "dark");
    window.localStorage.setItem("spoke.shoreMenu.1", JSON.stringify(MENU));
    clearMenuCache();
    expect(readCachedMenu("1")).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
    expect(
      window.localStorage.getItem("spoke.logoShape.https://x.test/l?v=1")
    ).toBeNull();
    expect(window.localStorage.getItem("spoke.shoreMenu.1")).toBeNull();
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

  describe("when Shore doesn't answer", () => {
    const ok = menu => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(menu)
    });
    const failed = (status, error) => ({
      ok: false,
      status,
      json: () => Promise.resolve({ error })
    });

    let seen;
    const Probe = () => {
      const state = useShoreMenu("1");
      seen.push(state);
      return null;
    };
    const last = () => seen[seen.length - 1];
    const settle = () =>
      act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

    beforeEach(() => {
      jest.useFakeTimers();
      seen = [];
    });
    afterEach(() => {
      jest.useRealTimers();
      delete global.fetch;
    });

    it("keeps the remembered menu while Shore is waking up, then asks again", async () => {
      writeCachedMenu("1", MENU);
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(failed(502, "shore_unreachable"))
        .mockResolvedValueOnce(
          ok({ ...MENU, org: { ...MENU.org, name: "Back" } })
        );
      mount(<Probe />);
      await settle();
      expect(last()).toMatchObject({
        loaded: true,
        menu: { org: { name: "Graham for Providence" } }
      });
      expect(readCachedMenu("1")).not.toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(last().menu.org.name).toBe("Back");
      expect(readCachedMenu("1").org.name).toBe("Back");

      // Nothing more to retry once the menu is back.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("stops after the last wait, and asks again when the tab is shown", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
      mount(<Probe />);
      await settle();
      expect(last()).toEqual({ menu: null, loaded: true });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
      });
      expect(global.fetch).toHaveBeenCalledTimes(1 + RETRY_DELAYS_MS.length);

      global.fetch.mockResolvedValueOnce(ok(MENU));
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(global.fetch).toHaveBeenCalledTimes(2 + RETRY_DELAYS_MS.length);
      expect(last().menu.org.name).toBe("Graham for Providence");
    });

    it("drops the menu, and doesn't retry, when Shore isn't set up for this person", async () => {
      writeCachedMenu("1", MENU);
      global.fetch = jest
        .fn()
        .mockResolvedValue(failed(404, "not_a_shore_member"));
      mount(<Probe />);
      await settle();
      expect(last()).toEqual({ menu: null, loaded: true });
      expect(readCachedMenu("1")).toBeNull();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
