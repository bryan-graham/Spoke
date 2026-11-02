import React, { useCallback, useEffect, useMemo, useState } from "react";

// Which colour scheme Spoke shows.
//
// - With Shore connected, Spoke follows the person's Shore setting
//   (user.colorScheme in Shore's shared menu), so both apps match.
// - Otherwise it uses the person's choice in Spoke's account menu, kept in
//   this browser.
// - "auto" (the default) follows the device's light/dark setting.
//
// Both are remembered in localStorage so the next page load starts in the
// right scheme before Shore's menu arrives (render-index.js reads the same
// keys to set the background before the app loads).

export const PREFERENCES = ["auto", "light", "dark"];
export const STORAGE_KEYS = {
  local: "spoke.colorScheme",
  shore: "spoke.shoreColorScheme"
};

const valid = value => (PREFERENCES.includes(value) ? value : null);

const storage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch (err) {
    return null;
  }
};

export function readStored(key) {
  const s = storage();
  try {
    return s ? valid(s.getItem(key)) : null;
  } catch (err) {
    return null;
  }
}

export function writeStored(key, value) {
  const s = storage();
  try {
    if (!s) {
      return;
    }
    if (value) {
      s.setItem(key, value);
    } else {
      s.removeItem(key);
    }
  } catch (err) {
    // Private mode or storage disabled: just don't remember.
  }
}

export function effectivePreference({ shore, local }) {
  return valid(shore) || valid(local) || "auto";
}

export function resolveScheme(preference, prefersDark) {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  return prefersDark ? "dark" : "light";
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function usePrefersDark() {
  const query =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(DARK_QUERY)
      : null;
  const [prefersDark, setPrefersDark] = useState(
    Boolean(query && query.matches)
  );
  useEffect(() => {
    if (!query) {
      return undefined;
    }
    const onChange = event => setPrefersDark(event.matches);
    if (query.addEventListener) {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);
  return prefersDark;
}

export const ColorSchemeContext = React.createContext({
  preference: "auto",
  scheme: "light",
  followsShore: false,
  setPreference: () => {},
  setShorePreference: () => {}
});

// State for App.jsx's provider.
export function useColorSchemeState() {
  const [shore, setShore] = useState(() => readStored(STORAGE_KEYS.shore));
  const [local, setLocal] = useState(() => readStored(STORAGE_KEYS.local));
  const prefersDark = usePrefersDark();

  const setShorePreference = useCallback(value => {
    const next = valid(value);
    writeStored(STORAGE_KEYS.shore, next);
    setShore(next);
  }, []);
  const setPreference = useCallback(value => {
    const next = valid(value);
    writeStored(STORAGE_KEYS.local, next === "auto" ? null : next);
    setLocal(next === "auto" ? null : next);
  }, []);

  const preference = effectivePreference({ shore, local });
  const scheme = resolveScheme(preference, prefersDark);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-color-scheme", scheme);
    }
  }, [scheme]);

  return useMemo(
    () => ({
      preference,
      scheme,
      followsShore: Boolean(shore),
      setPreference,
      setShorePreference
    }),
    [preference, scheme, shore, setPreference, setShorePreference]
  );
}
