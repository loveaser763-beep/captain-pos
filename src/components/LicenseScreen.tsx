import { useEffect, useState } from "react";
import { KeyRound, Copy, Check, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";

type Props = { onActivated: () => void };

export default function LicenseScreen({ onActivated }: Props) {
  const [code, setCode] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/license/status")
      .then((r) => r.json())
      .then((d) => { if (alive) { setCode(d?.code || ""); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const activate = async () => {
    const val = key.trim();
    if (!val) { setErr("اكتب مفتاح التفعيل الأول"); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: val }),
      });
      const d = await r.json();
      if (d?.success && d?.active) {
        setTimeout(() => onActivated(), 500);
        return;
      }
      setErr(d?.error || "مفتاح غير صالح");
    } catch (e: any) {
      setErr("تعذّر الاتصال بالسيرفر الداخلي");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="lux-scope flex h-dvh w-full items-center justify-center overflow-y-auto p-4"
      style={{ background: "var(--bg-deep)", direction: "rtl" }}
      id="license-lock-screen"
    >
      <div
        className="w-full max-w-[560px] rounded-2xl border p-6 sm:p-8 shadow-2xl"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--border)" }}
          >
            <ShieldCheck size={22} strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black truncate" style={{ color: "var(--text-primary)" }}>
              تفعيل منظومة الكابتن
            </h1>
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              الترخيص مربوط بهذا الجهاز — بدون الحاجة للإنترنت
            </p>
          </div>
        </div>

        <div className="my-5 h-px" style={{ background: "var(--border)" }} />

        {/* كود الجهاز */}
        <label className="block text-xs font-black mb-2" style={{ color: "var(--text-secondary)" }}>
          كود الجهاز — أرسله إلى مزوّد المنظومة
        </label>
        <div
          className="flex items-stretch gap-2 rounded-xl border p-3"
          style={{ background: "var(--bg-input)", borderColor: "var(--border-strong)" }}
        >
          <div
            className="flex-1 font-mono font-black tracking-widest flex items-center justify-center text-base sm:text-xl select-all min-w-0"
            style={{ color: "var(--accent)" }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : code || "—"}
          </div>
          <button
            onClick={copyCode}
            disabled={!code}
            className="shrink-0 px-3 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40"
            style={{ background: copied ? "var(--success)" : "var(--accent)", color: "var(--on-accent, #fff)" }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copied ? "تم النسخ" : "نسخ"}</span>
          </button>
        </div>

        {/* مفتاح التفعيل */}
        <label className="block text-xs font-black mt-5 mb-2" style={{ color: "var(--text-secondary)" }}>
          مفتاح التفعيل
        </label>
        <textarea
          value={key}
          onChange={(e) => { setKey(e.target.value); if (err) setErr(""); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); activate(); } }}
          placeholder="الصق مفتاح التفعيل هنا..."
          rows={3}
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-xl border px-3 py-2.5 font-mono text-sm outline-none resize-y"
          style={{ background: "var(--bg-input)", borderColor: err ? "var(--danger)" : "var(--border-strong)", color: "var(--text-primary)" }}
        />

        {err && (
          <div
            className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"
            style={{ background: "rgba(225,29,72,.1)", borderColor: "var(--danger)", color: "var(--danger)" }}
          >
            <AlertTriangle size={14} className="shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <button
          onClick={activate}
          disabled={busy}
          className="mt-5 w-full rounded-xl py-3 text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--on-accent, #fff)" }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          {busy ? "جارٍ التفعيل..." : "تفعيل البرنامج"}
        </button>

        <p className="mt-4 text-[11px] leading-relaxed font-semibold text-center" style={{ color: "var(--text-muted)" }}>
          البرنامج لن يعمل قبل التفعيل، ولا يمكن نقله إلى جهاز آخر بعد التفعيل.
        </p>
      </div>
    </div>
  );
}
