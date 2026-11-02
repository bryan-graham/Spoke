import { useEffect, useState } from "react";

// Loads Shore's shared menu for this organization through Spoke's server
// (GET /shore-menu/:organizationId), fresh on every page load so counts are
// current. Resolves to null when there's no Shore menu (not configured, Shore
// unreachable, or the person isn't a Shore member); the sidebar then shows
// Spoke's own navigation only.
//
// Returns { menu, loaded }: loaded is false until the answer is known.
export default function useShoreMenu(organizationId) {
  const [state, setState] = useState({ menu: null, loaded: false });
  useEffect(() => {
    if (!organizationId || typeof fetch !== "function") {
      setState({ menu: null, loaded: true });
      return undefined;
    }
    let active = true;
    setState(prev => ({ menu: prev.menu, loaded: false }));
    fetch(`/shore-menu/${encodeURIComponent(organizationId)}`, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (active) {
          setState({
            menu: json && Array.isArray(json.groups) ? json : null,
            loaded: true
          });
        }
      })
      .catch(() => {
        if (active) {
          setState({ menu: null, loaded: true });
        }
      });
    return () => {
      active = false;
    };
  }, [organizationId]);
  return state;
}
