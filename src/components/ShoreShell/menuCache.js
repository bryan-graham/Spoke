// Remembers the last Shore menu so the sidebar (and the campaign logo) can
// show at once on the next page while a fresh copy loads, instead of
// flickering from Spoke's own menu and the campaign's initials.
//
// The menu is personal (it's built for the signed-in person), so the copy is:
// - kept per person and organization (keyed by the Spoke user id the server
//   puts on the page as window.SPOKE_USER_ID; with no signed-in user nothing
//   is remembered),
// - kept only for this browser session (sessionStorage: this tab, gone when
//   it closes), and
// - cleared on logout (src/client/auth-service.js).
// The person's name and email aren't stored at all.

const PREFIX = "spoke.shoreMenu.";

const sessionStore = () => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch (err) {
    return null;
  }
};

const localStore = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch (err) {
    return null;
  }
};

const removeKeys = (store, test) => {
  if (!store) {
    return;
  }
  try {
    Object.keys(store)
      .filter(test)
      .forEach(key => store.removeItem(key));
  } catch (err) {
    // ignore
  }
};

// Earlier versions kept the menu in localStorage, keyed by organization only.
// Drop those copies (once per page load).
let legacyCleared = false;
const clearLegacy = () => {
  if (!legacyCleared) {
    legacyCleared = true;
    removeKeys(localStore(), key => key.startsWith(PREFIX));
  }
};

const currentUserId = () =>
  (typeof window !== "undefined" && window.SPOKE_USER_ID) || null;

const keyFor = organizationId => {
  const userId = currentUserId();
  return userId && organizationId
    ? `${PREFIX}${userId}.${organizationId}`
    : null;
};

export function readCachedMenu(organizationId) {
  clearLegacy();
  const s = sessionStore();
  const key = keyFor(organizationId);
  if (!s || !key) {
    return null;
  }
  try {
    const menu = JSON.parse(s.getItem(key));
    return menu && Array.isArray(menu.groups) ? menu : null;
  } catch (err) {
    return null;
  }
}

export function writeCachedMenu(organizationId, menu) {
  clearLegacy();
  const s = sessionStore();
  const key = keyFor(organizationId);
  if (!s || !key) {
    return;
  }
  try {
    if (menu && Array.isArray(menu.groups)) {
      const { org, groups, user } = menu;
      s.setItem(
        key,
        JSON.stringify({
          org,
          groups,
          // Only what the sidebar needs before the fresh copy arrives.
          user: { colorScheme: (user && user.colorScheme) || null }
        })
      );
    } else {
      s.removeItem(key);
    }
  } catch (err) {
    // Storage full or disabled: just don't remember.
  }
}

export function clearMenuCache() {
  removeKeys(sessionStore(), key => key.startsWith(PREFIX));
  removeKeys(
    localStore(),
    key => key.startsWith(PREFIX) || key.startsWith("spoke.logoShape.")
  );
}
