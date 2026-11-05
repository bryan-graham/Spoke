import { useEffect, useState } from "react";
import { readCachedMenu, writeCachedMenu } from "./menuCache";

// Loads Shore's shared menu for this organization through Spoke's server
// (GET /shore-menu/:organizationId), fresh on every page load so counts are
// current.
//
// Returns { menu, loaded }: loaded is false until the first answer is known.
// Until then, menu is the last one this browser saw for the organization (if
// any), so the sidebar doesn't flicker.
//
// Two kinds of "no menu":
// - Settled (404: Shore isn't configured, or the person isn't a Shore
//   member): menu is null, the saved copy is dropped, and the sidebar shows
//   Spoke's own navigation.
// - Passing (Shore slow or down, e.g. waking up after being idle, or a
//   network blip): the last saved menu stays on screen, and Spoke asks again
//   after a short wait, when the tab comes back into view, and when the
//   browser comes back online.

// Waits before asking again after a passing failure. Shore can take several
// seconds to wake up, so the first retries come quickly and later ones back
// off; after the last, it waits for the tab to be shown again.
export const RETRY_DELAYS_MS = [2000, 5000, 15000, 30000, 60000];

const settled = status => status === 404;

export default function useShoreMenu(organizationId) {
  const [state, setState] = useState(() => ({
    menu: readCachedMenu(organizationId),
    loaded: false
  }));
  useEffect(() => {
    if (!organizationId || typeof fetch !== "function") {
      setState({ menu: null, loaded: true });
      return undefined;
    }
    let active = true;
    let attempt = 0;
    let timer = null;
    let inFlight = false;
    // Once a menu has arrived (or Shore said there's none), there's nothing
    // to retry.
    let done = false;

    setState(prev => ({
      menu: prev.menu || readCachedMenu(organizationId),
      loaded: false
    }));

    // A passing failure: keep the saved menu, and try again later.
    const keepAndRetry = () => {
      setState({ menu: readCachedMenu(organizationId), loaded: true });
      if (attempt < RETRY_DELAYS_MS.length) {
        timer = setTimeout(load, RETRY_DELAYS_MS[attempt]);
        attempt += 1;
      }
    };

    function load() {
      if (!active || done || inFlight) {
        return;
      }
      clearTimeout(timer);
      inFlight = true;
      fetch(`/shore-menu/${encodeURIComponent(organizationId)}`, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" }
      })
        .then(async res => {
          inFlight = false;
          if (!active) {
            return;
          }
          if (settled(res.status)) {
            done = true;
            writeCachedMenu(organizationId, null);
            setState({ menu: null, loaded: true });
            return;
          }
          const json = res.ok ? await res.json().catch(() => null) : null;
          if (!active) {
            return;
          }
          const menu = json && Array.isArray(json.groups) ? json : null;
          if (!menu) {
            keepAndRetry();
            return;
          }
          done = true;
          writeCachedMenu(organizationId, menu);
          setState({ menu, loaded: true });
        })
        .catch(() => {
          inFlight = false;
          if (active) {
            keepAndRetry();
          }
        });
    }

    // Coming back to the tab or back online: try again at once (and start
    // the waits over).
    const retryNow = () => {
      if (done || (typeof document !== "undefined" && document.hidden)) {
        return;
      }
      attempt = 0;
      load();
    };

    load();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", retryNow);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", retryNow);
    }
    return () => {
      active = false;
      clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", retryNow);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", retryNow);
      }
    };
  }, [organizationId]);
  return state;
}
