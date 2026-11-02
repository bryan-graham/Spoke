import { useEffect, useState } from "react";

// Loads Shore's shared menu for this organization through Spoke's server
// (GET /shore-menu/:organizationId), fresh on every page load so counts are
// current. Resolves to null when there's no Shore menu (not configured, Shore
// unreachable, or the person isn't a Shore member); the sidebar then shows
// Spoke's own navigation only.
export default function useShoreMenu(organizationId) {
  const [menu, setMenu] = useState(null);
  useEffect(() => {
    if (!organizationId || typeof fetch !== "function") {
      setMenu(null);
      return undefined;
    }
    let active = true;
    fetch(`/shore-menu/${encodeURIComponent(organizationId)}`, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (active) {
          setMenu(json && Array.isArray(json.groups) ? json : null);
        }
      })
      .catch(() => {
        if (active) {
          setMenu(null);
        }
      });
    return () => {
      active = false;
    };
  }, [organizationId]);
  return menu;
}
