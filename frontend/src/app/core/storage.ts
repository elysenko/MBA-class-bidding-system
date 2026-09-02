/**
 * Mockups are served many-per-origin under /<mockup_id>/ while browser storage
 * is origin-scoped, so every key is namespaced with the first path segment.
 * All localStorage access in the app goes through these helpers.
 */
const NS = (typeof location !== 'undefined' && location.pathname.split('/')[1]) || 'app';

export const nsKey = (key: string): string => `${NS}:${key}`;

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(nsKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(nsKey(key), JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) — the UI still works */
  }
}

export function removeKeys(keys: string[]): void {
  try {
    keys.forEach((key) => localStorage.removeItem(nsKey(key)));
  } catch {
    /* no-op */
  }
}
