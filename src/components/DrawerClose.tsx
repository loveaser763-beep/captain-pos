import { useState, useEffect, useCallback, useMemo } from "react";
import { localDateStr } from "../localDate";
import { User } from "../types";
import {
  LockKeyhole,
  Calculator,
  Coins,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  History,
  Printer,
} from "lucide-react";
import { authFetch } from "../authFetch";
import UnifiedPrintButton from "./UnifiedPrintButton";

interface DrawerCloseProps {
  currentUser: User | null;
}

const NOTES = [200, 100, 50, 20, 10, 5, 1];
const COINS = [0.5];

const fmt = (n: any) => {
  const v = Number(n || 0);
  return (Math.round(v * 100) / 100).toFixed(2);
};
const signed = (n: any) => {
  const v = Number(n || 0);
  return `${v > 0 ? "+" : ""}${fmt(v)}`;
};

export default function DrawerClose({ currentUser }: DrawerCloseProps) {
  const today = localDateStr();
  const [date, setDate] = useState(today);
  const [marketName, setMarketName] = useState("منظومة الكابتن");

  const [preview, setPreview] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  const [mode, setMode] = useState<"denoms" | "direct">("denoms");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [direct, setDirect] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [serverDiff, setServerDiff] = useState<number | null>(null);

  const fetchAll = useCallback(async (dateStr: string) => {
    setLoading(true);
    setError("");
    setAccessDenied(false);
    try {
      const res = await authFetch(`/api/drawer/close-preview?date=${dateStr}`);
      if (res.status === 403) {
        setAccessDenied(true);
        setPreview(null);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("فشل جلب معاينة التقفيل");
      const data = await res.json();
      setPreview(data);
      if (data.existingClosing) {
        const cj = data.existingClosing.counted_json || {};
        const parsed = typeof cj === "string" ? JSON.parse(cj || "{}") : cj;
        if (parsed && typeof parsed === "object" && parsed.__mode === "direct") {
          setMode("direct");
          setDirect(String(parsed.__value ?? ""));
        } else if (parsed && Object.keys(parsed).length > 0) {
          setMode("denoms");
          const next: Record<string, string> = {};
          Object.keys(parsed).forEach((k) => { next[k] = String(parsed[k]); });
          setQty(next);
        }
        setNote(data.existingClosing.note || "");
        setServerDiff(Number(data.existingClosing.diff || 0));
      } else {
        setServerDiff(null);
      }
    } catch (e: any) {
      setError(e.message || "خطأ في الاتصال بالسيرفر");
    }
    try {
      const r = await authFetch("/api/drawer/closings");
      if (r.ok) {
        const d = await r.json();
        setHistory(Array.isArray(d) ? d : d?.closings || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll(date);
  }, [date, fetchAll]);

  // تغيير التاريخ = نبدأ عدّ جديد من الصفر
  useEffect(() => {
    setQty({});
    setDirect("");
    setMode("denoms");
    setNote("");
    setSavedMsg("");
    setServerDiff(null);
  }, [date]);

  useEffect(() => {
    authFetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s?.market_name) setMarketName(s.market_name); })
      .catch(() => {});
  }, []);

  const denomTotal = useMemo(() => {
    let t = 0;
    NOTES.forEach((n) => { t += Number(qty[`n${n}`] || 0) * n; });
    COINS.forEach((c) => { t += Number(qty[`c${c}`] || 0) * c; });
    return Math.round(t * 100) / 100;
  }, [qty]);

  const counted = mode === "denoms" ? denomTotal : Math.round(Number(direct || 0) * 100) / 100;
  const expected = preview ? Number(preview.expected || 0) : 0;
  const diff = Math.round((counted - expected) * 100) / 100;
  const state =
    Math.abs(diff) < 0.01 ? "مطابق" : diff > 0 ? `زيادة ${fmt(diff)}` : `عجز ${fmt(Math.abs(diff))}`;
  const stateTone =
    Math.abs(diff) < 0.01 ? "var(--success)" : diff > 0 ? "var(--warning)" : "var(--danger)";

  const existing = preview?.existingClosing || null;

  const handleSave = async () => {
    if (!preview) return;
    if (counted <= 0 && mode === "direct") return alert("اكتب المعدود الأول");
    const msg = existing
      ? `تقفيلة ${date} محفوظة قبل كده (${fmt(existing.counted)}) — عايز تعدلها بالمعدود الجديد ${fmt(counted)}؟`
      : `تقفيل يومية ${date}?\nالمعدود: ${fmt(counted)}\nالمتوقع: ${fmt(expected)}\nالفرق: ${state}`;
    if (!window.confirm(msg)) return;

    setSaving(true);
    setSavedMsg("");
    try {
      const counted_json =
        mode === "denoms"
          ? { ...qty }
          : { __mode: "direct", __value: direct };
      const res = await authFetch("/api/drawer/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          counted,
          counted_json,
          note,
          user_name: currentUser?.name || "",
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "تعذر حفظ التقفيل");
      setServerDiff(Number(d.closing?.diff ?? diff));
      setSavedMsg(existing ? "اتعدّلت التقفيلة بنجاح" : "اتحفظ تقفيل اليومية بنجاح");
      await fetchAll(date);
    } catch (e: any) {
      alert(e.message);
    }
    setSaving(false);
  };

  if (accessDenied) {
    return (
      <div className="w-full p-6 flex flex-col items-center justify-center text-right select-none font-sans" style={{ direction: "rtl" }}>
        <div className="bg-[var(--bg-card)] p-6 border border-[var(--border-strong)] rounded-2xl max-w-md space-y-3 text-center">
          <AlertTriangle size={24} strokeWidth={1.5} className="mx-auto" style={{ color: "var(--warning)" }} />
          <h3 className="text-sm font-black text-[var(--text-primary)]">صلاحية الوصول غير متاحة</h3>
          <p className="text-xs text-[var(--text-secondary)] font-semibold leading-relaxed">
            تقفيل اليومية متاح للكاشير عنده صلاحية "drawer" وللمدير العام بس.
          </p>
        </div>
      </div>
    );
  }

  const inputCls =
    "w-full h-9 px-2 border rounded-lg text-xs font-mono font-black text-center focus:outline-none";

  return (
    <div
      id="printable-drawer-close"
      className="w-full space-y-4 select-none font-sans"
      style={{ direction: "rtl" }}
    >
      {/* الترويسة */}
      <div className="bg-[var(--bg-card)] p-4 border border-[var(--border-strong)] rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <LockKeyhole size={20} strokeWidth={1.5} />
            <span>تقفيل اليومية</span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-semibold mt-1">
            عدّ فلوس الدرج يدويًا والنظام يحسب المتوقع ويعرض الفرق
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="drawer-close-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 px-3 border rounded-lg text-xs font-mono font-bold bg-[var(--bg-card)] text-[var(--text-primary)]"
            style={{ borderColor: "var(--border-strong)" }}
          />
          <button
            onClick={() => fetchAll(date)}
            className="h-9 px-3 flex items-center gap-1.5 border rounded-lg text-xs font-black bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
            style={{ borderColor: "var(--border)" }}
            title="تحديث"
          >
            <RefreshCw size={14} />
            <span>تحديث</span>
          </button>
          {preview && (
            <UnifiedPrintButton
              printableId="printable-drawer-close"
              thermalId="printable-drawer-close-thermal"
              title="طباعة التقفيل"
              printLayout="wide"
            />
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border p-3 text-xs font-bold no-print" style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--bg-card)" }}>
          {error}
        </div>
      )}

      {loading && !preview && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 text-center text-xs font-bold text-[var(--text-secondary)] no-print">
          جاري تحميل معاينة التقفيل...
        </div>
      )}

      {preview && (
        <>
          {/* شريط الملخص */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3">
              <div className="text-[11px] font-black text-[var(--text-secondary)] mb-1">{preview.openingLabel}</div>
              <div className="text-lg font-black text-[var(--text-primary)] font-mono">{fmt(preview.opening)}</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3" style={{ borderTop: "3px solid var(--primary)" }}>
              <div className="text-[11px] font-black text-[var(--text-secondary)] mb-1">المتوقع في الدرج</div>
              <div className="text-lg font-black text-[var(--text-primary)] font-mono">{fmt(expected)}</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3" style={{ borderTop: "3px solid var(--accent)" }}>
              <div className="text-[11px] font-black text-[var(--text-secondary)] mb-1">المعدود الفعلي</div>
              <div className="text-lg font-black text-[var(--text-primary)] font-mono">{fmt(counted)}</div>
            </div>
            <div className="bg-[var(--bg-card)] border rounded-2xl p-3" style={{ borderColor: stateTone, borderTop: `3px solid ${stateTone}` }}>
              <div className="text-[11px] font-black text-[var(--text-secondary)] mb-1">الفرق ({state})</div>
              <div className="text-lg font-black font-mono" style={{ color: stateTone }}>{signed(diff)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* العدّ */}
            <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-2xl p-4 space-y-4 no-print">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
                  <Calculator size={16} />
                  <span>عدّ فلوس الدرج</span>
                </h3>
                <div className="flex items-center gap-1 p-1 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                  <button
                    onClick={() => setMode("denoms")}
                    className={`px-3 h-7 rounded-md text-[11px] font-black transition-colors cursor-pointer ${mode === "denoms" ? "text-white" : "text-[var(--text-secondary)]"}`}
                    style={mode === "denoms" ? { background: "var(--accent)" } : {}}
                  >
                    عدّ فئات
                  </button>
                  <button
                    onClick={() => setMode("direct")}
                    className={`px-3 h-7 rounded-md text-[11px] font-black transition-colors cursor-pointer ${mode === "direct" ? "text-white" : "text-[var(--text-secondary)]"}`}
                    style={mode === "direct" ? { background: "var(--accent)" } : {}}
                  >
                    إجمالي مباشر
                  </button>
                </div>
              </div>

              {mode === "denoms" ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] font-black text-[var(--text-secondary)] mb-1.5">ورق (ج.م)</div>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {NOTES.map((n) => (
                        <div key={`n${n}`} className="border rounded-xl p-2 text-center" style={{ borderColor: "var(--border)" }}>
                          <div className="text-xs font-black text-[var(--text-primary)] mb-1">{n}</div>
                          <input
                            id={`drawer-denom-n${n}`}
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={qty[`n${n}`] || ""}
                            onChange={(e) => setQty({ ...qty, [`n${n}`]: e.target.value })}
                            className={inputCls}
                            style={{ borderColor: "var(--border-strong)", background: "var(--bg-card-hover)", color: "var(--text-primary)" }}
                            placeholder="0"
                          />
                          <div className="text-[10px] font-bold font-mono mt-1" style={{ color: "var(--text-muted)" }}>
                            {fmt(Number(qty[`n${n}`] || 0) * n)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-[var(--text-secondary)] mb-1.5">عملات (ج.م)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {COINS.map((c) => (
                        <div key={`c${c}`} className="border rounded-xl p-2 text-center" style={{ borderColor: "var(--border)" }}>
                          <div className="text-xs font-black text-[var(--text-primary)] mb-1">{c}</div>
                          <input
                            id={`drawer-denom-c${c}`}
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={qty[`c${c}`] || ""}
                            onChange={(e) => setQty({ ...qty, [`c${c}`]: e.target.value })}
                            className={inputCls}
                            style={{ borderColor: "var(--border-strong)", background: "var(--bg-card-hover)", color: "var(--text-primary)" }}
                            placeholder="0"
                          />
                          <div className="text-[10px] font-bold font-mono mt-1" style={{ color: "var(--text-muted)" }}>
                            {fmt(Number(qty[`c${c}`] || 0) * c)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border-strong)" }}>
                    <span className="text-xs font-black text-[var(--text-secondary)] flex items-center gap-1.5">
                      <Coins size={14} /> إجمالي العدّ بالفئات
                    </span>
                    <span className="text-base font-black font-mono" style={{ color: "var(--accent)" }}>{fmt(denomTotal)}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-black text-[var(--text-secondary)]">اكتب إجمالي فلوس الدرج</label>
                  <input
                    id="drawer-direct-total"
                    type="number"
                    step="0.01"
                    min={0}
                    inputMode="decimal"
                    value={direct}
                    onChange={(e) => setDirect(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-14 px-3 border-2 rounded-xl text-center text-2xl font-black font-mono focus:outline-none"
                    style={{ borderColor: "var(--accent)", background: "var(--bg-card-hover)", color: "var(--text-primary)" }}
                  />
                  <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                    استخدم الطريقة دي لو بتحسب الإجمالي على طول من غير عدّ كل فئة.
                  </p>
                </div>
              )}
            </div>

            {/* الفرق والحفظ */}
            <div className="space-y-4">
              <div className="rounded-2xl p-4 border-2 text-center" style={{ borderColor: stateTone, background: "var(--bg-card)" }}>
                <div className="flex items-center justify-center gap-1.5 mb-1" style={{ color: stateTone }}>
                  {Math.abs(diff) < 0.01 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span className="text-xs font-black">{state}</span>
                </div>
                <div className="text-3xl font-black font-mono" style={{ color: stateTone }}>{signed(diff)}</div>
                <div className="text-[11px] font-bold text-[var(--text-secondary)] mt-2 space-y-1">
                  <div className="flex justify-between"><span>المتوقع:</span><span className="font-mono">{fmt(expected)}</span></div>
                  <div className="flex justify-between"><span>المعدود:</span><span className="font-mono">{fmt(counted)}</span></div>
                  {preview.cardExcluded > 0 && (
                    <div className="flex justify-between" style={{ color: "var(--text-muted)" }}>
                      <span>مقبوضات بطاقة (مش في الدرج):</span>
                      <span className="font-mono">{fmt(preview.cardExcluded)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-2xl p-4 space-y-3 no-print">
                <div>
                  <label className="block text-xs font-black text-[var(--text-secondary)] mb-1">ملاحظة (اختياري)</label>
                  <textarea
                    id="drawer-close-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="مثال: فلوس ناقصة، تحصيل شبكة..."
                    className="w-full px-3 py-2 border rounded-lg text-xs font-bold resize-none focus:outline-none"
                    style={{ borderColor: "var(--border-strong)", background: "var(--bg-card-hover)", color: "var(--text-primary)" }}
                  />
                </div>
                <button
                  id="btn-drawer-close-save"
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="w-full h-11 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                  style={{ background: stateTone, color: "#fff" }}
                >
                  <Save size={16} />
                  <span>{saving ? "جاري الحفظ..." : existing ? "تعديل التقفيلة" : "تقفيل اليومية"}</span>
                </button>
                {existing && (
                  <div className="text-[11px] font-bold text-center" style={{ color: "var(--text-secondary)" }}>
                    متقفلة قبل كده بتاريخ {existing.date} · المعدود {fmt(existing.counted)} · الفرق {signed(existing.diff)}
                    {serverDiff !== null && savedMsg && (
                      <div style={{ color: stateTone }}>{savedMsg}</div>
                    )}
                  </div>
                )}
                {!existing && savedMsg && (
                  <div className="text-[11px] font-black text-center" style={{ color: "var(--success)" }}>{savedMsg}</div>
                )}
              </div>
            </div>
          </div>

          {/* كسر حركات النظام */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border-strong)", background: "var(--bg-card-hover)" }}>
              <h3 className="text-sm font-black text-[var(--text-primary)]">كيفية حساب المتوقع</h3>
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                {preview.openingFrom ? `الفترة: بعد ${preview.openingFrom} لحد ${date}` : `الفترة: من أول التشغيل لحد ${date}`}
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--bg-card-hover)" }}>
                  <th className="text-right px-4 py-2 font-black text-[var(--text-secondary)]">البند</th>
                  <th className="text-left px-4 py-2 font-black text-[var(--text-secondary)]">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-2 font-bold text-[var(--text-primary)] border-t" style={{ borderColor: "var(--border)" }}>{preview.openingLabel}</td>
                  <td className="px-4 py-2 font-mono font-black text-left border-t" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>{fmt(preview.opening)}</td>
                </tr>
                {preview.movements.map((m: any) => (
                  <tr key={m.key}>
                    <td className="px-4 py-2 font-bold text-[var(--text-primary)] border-t" style={{ borderColor: "var(--border)" }}>{m.label}</td>
                    <td
                      className="px-4 py-2 font-mono font-black text-left border-t"
                      style={{ borderColor: "var(--border)", color: m.amount >= 0 ? "var(--success)" : "var(--danger)" }}
                    >
                      {signed(m.amount)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "var(--bg-card-hover)" }}>
                  <td className="px-4 py-2.5 font-black text-[var(--text-primary)] border-t-2" style={{ borderColor: "var(--border-strong)" }}>المتوقع في الدرج</td>
                  <td className="px-4 py-2.5 font-mono font-black text-left text-sm border-t-2" style={{ borderColor: "var(--border-strong)", color: "var(--primary)" }}>{fmt(expected)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* السجل */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--border-strong)", background: "var(--bg-card-hover)" }}>
              <History size={15} className="text-[var(--text-secondary)]" />
              <h3 className="text-sm font-black text-[var(--text-primary)]">سجل تقفيل اليومية</h3>
            </div>
            {history.length === 0 ? (
              <div className="p-6 text-center text-xs font-bold text-[var(--text-secondary)]">مفيش تقفيلات محفوظة لحد دلوقتي</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--bg-card-hover)" }}>
                      <th className="text-right px-4 py-2 font-black text-[var(--text-secondary)]">التاريخ</th>
                      <th className="text-left px-4 py-2 font-black text-[var(--text-secondary)]">المتوقع</th>
                      <th className="text-left px-4 py-2 font-black text-[var(--text-secondary)]">المعدود</th>
                      <th className="text-left px-4 py-2 font-black text-[var(--text-secondary)]">الفرق</th>
                      <th className="text-right px-4 py-2 font-black text-[var(--text-secondary)]">بواسطة</th>
                      <th className="text-right px-4 py-2 font-black text-[var(--text-secondary)]">ملاحظة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((c: any) => {
                      const d = Number(c.diff || 0);
                      const col = Math.abs(d) < 0.01 ? "var(--success)" : d > 0 ? "var(--warning)" : "var(--danger)";
                      return (
                        <tr
                          key={c.date}
                          onClick={() => setDate(c.date)}
                          className="cursor-pointer hover:bg-[var(--bg-card-hover)]"
                          style={{ background: c.date === date ? "var(--accent-subtle)" : "var(--bg-card)" }}
                        >
                          <td className="px-4 py-2 font-mono font-bold text-[var(--text-primary)] border-t" style={{ borderColor: "var(--border)" }}>{c.date}</td>
                          <td className="px-4 py-2 font-mono text-left text-[var(--text-primary)] border-t" style={{ borderColor: "var(--border)" }}>{fmt(c.expected)}</td>
                          <td className="px-4 py-2 font-mono text-left text-[var(--text-primary)] border-t" style={{ borderColor: "var(--border)" }}>{fmt(c.counted)}</td>
                          <td className="px-4 py-2 font-mono font-black text-left border-t" style={{ borderColor: "var(--border)", color: col }}>{signed(d)}</td>
                          <td className="px-4 py-2 font-bold text-[var(--text-secondary)] border-t" style={{ borderColor: "var(--border)" }}>{c.created_by || "-"}</td>
                          <td className="px-4 py-2 font-bold text-[var(--text-secondary)] border-t" style={{ borderColor: "var(--border)" }}>{c.note || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* منطقة الإيصال الحراري 80mm — مخفية للزر الموحد */}
      {preview && (
        <div className="no-print" aria-hidden="true" style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }}>
          <div
            id="printable-drawer-close-thermal"
            className="bg-white p-3 font-sans text-black space-y-3 text-right border"
            style={{ direction: "rtl", width: "80mm", minWidth: "80mm", maxWidth: "80mm" }}
          >
            <div className="text-center space-y-0.5 border-b border-black pb-2 text-xs">
              <h4 className="font-bold">{marketName}</h4>
                <p className="text-[10px] text-black font-semibold">تقرير تقفيل اليومية</p>
              <p className="text-[10px] text-black font-semibold">التاريخ: {date}</p>
              <p className="text-[10px] text-gray-700">الكاشير: {currentUser?.name || "-"}</p>
            </div>

            <div className="space-y-1 text-xs border-b border-black pb-2 font-bold">
              <div className="flex justify-between">
                <span>{preview.openingLabel}:</span>
                <span>{fmt(preview.opening)}</span>
              </div>
              {preview.movements
                .filter((m: any) => Math.abs(Number(m.amount || 0)) >= 0.01)
                .map((m: any) => (
                  <div key={m.key} className="flex justify-between">
                    <span>{m.label}:</span>
                    <span>{signed(m.amount)}</span>
                  </div>
                ))}
            </div>

            <div className="space-y-1 text-xs font-bold">
              <div className="flex justify-between"><span>المتوقع:</span><span>{fmt(expected)}</span></div>
              <div className="flex justify-between"><span>المعدود:</span><span>{fmt(counted)}</span></div>
              <div className="flex justify-between text-sm border-t border-black pt-1 font-black">
                <span>الفرق ({state}):</span>
                <span>{signed(diff)}</span>
              </div>
            </div>

            {note && <div className="text-[10px] font-bold border-t border-black pt-1">ملاحظة: {note}</div>}

            <div className="flex justify-between text-[10px] font-bold border-t border-black pt-1">
              <span>تم بواسطة: {currentUser?.name || "-"}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Printer size={10} /> {new Date().toLocaleString("ar-EG")}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
