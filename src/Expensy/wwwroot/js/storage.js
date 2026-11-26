// Per-device preferences in localStorage (language, maps app...).
// localStorage can be unavailable (private mode, blocked site data), so failures are ignored:
// the preference then simply isn't remembered.

export function loadPref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

/** Saves the value; null or undefined removes it. */
export function savePref(key, value) {
  try {
    if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { /* not remembered */ }
}
