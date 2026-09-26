// hideZesty.ts — Zesty stays visible locally (D:\ + client installs),
// hidden automatically on the Railway demo (hostname) or via VITE_HIDE_ZESTY=true.
export function isZestyHidden(): boolean {
  try {
    if ((import.meta as any)?.env?.VITE_HIDE_ZESTY === "true") return true;
    const h = window.location.hostname || "";
    if (h.includes("railway.app")) return true;
  } catch {}
  return false;
}
