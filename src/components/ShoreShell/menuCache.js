// Remembers the last Shore menu per organization in this browser, so the
// sidebar (and the campaign logo) can show at once on the next page while a
// fresh copy loads, instead of flickering from Spoke's own menu and the
// campaign's initials.
//
// The person's name and email aren't stored, and logging out clears it all
// (src/client/auth-service.js), so a shared computer doesn't show one
// person's menu to the next.

const PREFIX = "spoke.shoreMenu.";

const storage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch (err) {
    return null;
  }
};

export function readCachedMenu(organizationId) {
  const s = storage();
  if (!s || !organizationId) {
    return null;
  }
  try {
    const menu = JSON.parse(s.getItem(PREFIX + organizationId));
    return menu && Array.isArray(menu.groups) ? menu : null;
  } catch (err) {
    return null;
  }
}

export function writeCachedMenu(organizationId, menu) {
  const s = storage();
  if (!s || !organizationId) {
    return;
  }
  try {
    if (menu && Array.isArray(menu.groups)) {
      const { org, groups, user } = menu;
      s.setItem(
        PREFIX + organizationId,
        JSON.stringify({
          org,
          groups,
          // Only what the sidebar needs before the fresh copy arrives.
          user: { colorScheme: (user && user.colorScheme) || null }
        })
      );
    } else {
      s.removeItem(PREFIX + organizationId);
    }
  } catch (err) {
    // Storage full or disabled: just don't remember.
  }
}

export function clearMenuCache() {
  const s = storage();
  if (!s) {
    return;
  }
  try {
    Object.keys(s)
      .filter(
        key => key.startsWith(PREFIX) || key.startsWith("spoke.logoShape.")
      )
      .forEach(key => s.removeItem(key));
  } catch (err) {
    // ignore
  }
}
