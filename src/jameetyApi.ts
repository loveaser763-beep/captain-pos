// jameetyApi.ts — API helper for reading/writing Jameety/Zesty data to SQLite
// No localStorage, no monkey-patching, just clean API calls.

export type EntityNs = "jameety" | "zesty";

const BASE = "/api/jameety-kv";

/** GET — read all keys for a namespace */
export async function pullAll(ns: EntityNs): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}?ns=${ns}`);
  const json = await res.json();
  return json.success ? json.data : {};
}

/** GET — read one key */
export async function getKey(ns: EntityNs, key: string): Promise<string | null> {
  const data = await pullAll(ns);
  return data[key] ?? null;
}

/** GET — read one key as string */
export async function getStr(ns: EntityNs, key: string): Promise<string | null> {
  return getKey(ns, key);
}

/** GET — read and parse JSON array from a key */
export async function getJson<T>(ns: EntityNs, key: string): Promise<T[]> {
  const raw = await getKey(ns, key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** GET — read and parse JSON object from a key */
export async function getObj<T>(ns: EntityNs, key: string): Promise<T | null> {
  const raw = await getKey(ns, key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** POST — write/update keys */
export async function setKeys(ns: EntityNs, entries: Record<string, string>): Promise<void> {
  await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ns, entries }),
  });
}

/** POST — write a single key with JSON value */
export async function setJson(ns: EntityNs, key: string, value: any): Promise<void> {
  await setKeys(ns, { [key]: JSON.stringify(value) });
}

/** POST — write a single key with string value */
export async function setStr(ns: EntityNs, key: string, value: string): Promise<void> {
  await setKeys(ns, { [key]: value });
}

/** POST — delete keys */
export async function delKeys(ns: EntityNs, keys: string[]): Promise<void> {
  await fetch(`${BASE}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ns, keys }),
  });
}

/** Seed from a JSON file (fetch + write to SQLite) */
export async function seedFromJson(ns: EntityNs, key: string, jsonUrl: string): Promise<boolean> {
  try {
    const res = await fetch(jsonUrl);
    if (!res.ok) return false;
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (data.value || []);
    if (arr.length > 0) {
      await setJson(ns, key, arr);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
