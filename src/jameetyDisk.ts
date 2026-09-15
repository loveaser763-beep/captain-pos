// jameetyDisk.ts — Disk persistence bridge for Jameety/Zesty (SQLite on server).
// Tabs keep using localStorage untouched; this layer mirrors namespaced keys
// to disk (push on write, pull on load). Server is source of truth on load.

export type EntityNs = "jameety" | "zesty";

const timers: Record<string, any> = {};

function nsOf(key: string): EntityNs | null {
  if (key.startsWith("jameety_")) return "jameety";
  if (key.startsWith("zesty_")) return "zesty";
  return null;
}

function collect(ns: EntityNs): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && nsOf(k) === ns) {
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = v;
    }
  }
  return out;
}

export async function pushEntity(ns: EntityNs): Promise<number> {
  const entries = collect(ns);
  const res = await fetch("/api/jameety-kv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ns, entries }),
  });
  if (!res.ok) throw new Error("push failed: " + res.status);
  const data = await res.json();
  return Number(data.count || 0);
}

export async function deleteKeys(ns: EntityNs, keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const res = await fetch("/api/jameety-kv/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ns, keys }),
  });
  if (!res.ok) throw new Error("delete failed: " + res.status);
  const data = await res.json();
  return Number(data.count || 0);
}

export async function pullEntity(ns: EntityNs): Promise<number> {  const res = await fetch(`/api/jameety-kv?ns=${ns}`);
  if (!res.ok) throw new Error("pull failed: " + res.status);
  const data = await res.json();
  const entries = (data.data || {}) as Record<string, string>;
  let count = 0;
  // suspend auto-push while applying server state
  (window as any).__diskApplying = true;
  try {
    for (const [k, v] of Object.entries(entries)) {
      localStorage.setItem(k, v);
      count++;
    }
  } finally {
    setTimeout(() => { (window as any).__diskApplying = false; }, 500);
  }
  return count;
}

function schedulePush(ns: EntityNs) {
  if ((window as any).__diskApplying) return;
  if (timers[ns]) clearTimeout(timers[ns]);
  timers[ns] = setTimeout(() => {
    pushEntity(ns).catch(() => {});
  }, 2500);
}

export function flushDisk() {
  (["jameety", "zesty"] as EntityNs[]).forEach((ns) => {
    if (timers[ns]) {
      clearTimeout(timers[ns]);
      delete timers[ns];
      pushEntity(ns).catch(() => {});
    }
  });
}

// Patch localStorage.setItem once: mirror entity keys to disk (debounced)
if (typeof window !== "undefined" && !(window as any).__diskPatched) {
  (window as any).__diskPatched = true;
  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key: string, value: string) => {
    origSetItem(key, value);
    try {
      const ns = nsOf(key);
      if (ns) schedulePush(ns);
    } catch {}
  };
  window.addEventListener("pagehide", flushDisk);
}
export {};
