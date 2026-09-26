import { useEffect, useState } from "react";
import { X, KeyRound, Copy, Check, Loader2, AlertTriangle, Search, Ban, RotateCcw, ClipboardList } from "lucide-react";
import { authFetch } from "../authFetch";

type Entry = {
  code: string;
  note: string;
  firstIssued: string;
  lastIssued: string;
  count: number;
  revoked: boolean;
};

type Props = { onClose: () => void };

const isValidCode = (c: string) => /^CAP-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(c);

const fmt = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
};

export default function LicenseCenter({ onClose }: Props) {
  const [tab, setTab] = useState<"generate" | "log">("generate");

  // Generator
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<{ type: "" | "ok" | "err" | "warn"; text: string }>({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Log
  const [entries, setEntries] = useState<Entry[]>([]);
  const [q, setQ] = useState("");
  const [logBusy, setLogBusy] = useState(false);

  const loadLog = async () => {
    setLogBusy(true);
    try {
      const r = await authFetch("/api/developer/license/log");
      const d = await r.json();
      setEntries(Array.isArray(d?.entries) ? d.entries : []);
    } catch { setEntries([]); } finally { setLogBusy(false); }
  };

  useEffect(() => { loadLog(); }, []);

  const alreadyIssued = (c: string) => entries.find((e) => e.code === c);

  const generate = async () => {
    const c = code.trim().toUpperCase();
    if (!isValidCode(c)) {
      setMsg({ type: "err", text: "صيغة كود الجهاز غلط — الصيغة: CAP-XXXX-XXXX-XXXX" });
      setKey("");
      return;
    }
    setBusy(true); setMsg({ type: "", text: "" }); setKey("");
    try {
      const r = await authFetch("/api/developer/license/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, note }),
      });
      const d = await r.json();
      if (d?.ok && d?.key) {
        setKey(d.key);
        if (d.duplicate) {
          setMsg({ type: "warn", text: `⚠️ الكود ده اتولّد له مفتاح قبل كده (${d.record?.count} مرة) — لو الجهاز نفسه يبقى عادي، بس اتأكد إنه مش مكرر بغير سبب.` });
          setTab("log");
        } else {
          setMsg({ type: "ok", text: "اتولّد المفتاح — انسخه وأرسله لصاحب الجهاز." });
        }
        loadLog();
      } else {
        setMsg({ type: "err", text: d?.error || "تعذّر توليد المفتاح" });
      }
    } catch { setMsg({ type: "err", text: "تعذّر الاتصال بالسيرفر" }); }
    finally { setBusy(false); }
  };

  const copyKey = async () => {
    try { await navigator.clipboard.writeText(key); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  const saveNote = async (c: string, n: string) => {
    try {
      await authFetch("/api/developer/license/log/note", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, note: n }),
      });
      loadLog();
    } catch {}
  };

  const toggleRevoke = async (e: Entry) => {
    try {
      await authFetch("/api/developer/license/log/revoke", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: e.code, revoked: !e.revoked }),
      });
      loadLog();
    } catch {}
  };

  const filtered = entries.filter((e) =>
    !q.trim() || e.code.toLowerCase().includes(q.trim().toLowerCase()) || (e.note || "").toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.55)" }} onClick={onClose}>
      <div
        className="bg-[#c3c6bb] border-2 border-[#222222] w-full max-w-[940px] max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-[#222222] text-[#c3c6bb] px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <KeyRound size={17} className="shrink-0" />
            <h2 className="text-sm font-black truncate">مركز الترخيص والتفعيل</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center hover:bg-[#000000] transition-colors cursor-pointer shrink-0" title="إغلاق">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#222222] shrink-0">
          <button
            onClick={() => setTab("generate")}
            className={`px-5 py-2.5 text-xs font-black flex items-center gap-2 cursor-pointer transition-colors ${
              tab === "generate" ? "bg-[#222222] text-[#c3c6bb]" : "bg-[#b8bcb2] text-[#222222] hover:bg-[#a8ada1]"
            }`}
          >
            <KeyRound size={14} />
            <span>توليد مفتاح جديد</span>
          </button>
          <button
            onClick={() => { setTab("log"); loadLog(); }}
            className={`px-5 py-2.5 text-xs font-black flex items-center gap-2 cursor-pointer transition-colors ${
              tab === "log" ? "bg-[#222222] text-[#c3c6bb]" : "bg-[#b8bcb2] text-[#222222] hover:bg-[#a8ada1]"
            }`}
          >
            <ClipboardList size={14} />
            <span>سجل التفعيلات ({entries.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto">
          {msg.text && (
            <div
              className={`mb-4 p-3 border text-xs font-bold flex items-start gap-2 ${
                msg.type === "ok" ? "bg-[#a8b898] text-[#000000] border-[#222222]"
                : msg.type === "warn" ? "bg-[#e0d0a0] text-[#4a3a00] border-[#8a7040]"
                : "bg-[#d8a8a8] text-[#550000] border-[#884444]"
              }`}
            >
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{msg.text}</span>
            </div>
          )}

          {tab === "generate" && (
            <div className="space-y-4 max-w-[680px]">
              <p className="text-xs text-[#333333] font-semibold leading-relaxed">
                صاحب الجهاز يفتح البرنامج فيظهر له <b>كود الجهاز</b> بصيغة
                <span className="font-mono"> CAP-XXXX-XXXX-XXXX</span> — يرسله إليك، فتولّد له هنا مفتاحًا صالحًا على جهازه وحده.
                نقل البرنامج لجهاز آخر يعني كودًا مختلفًا، فيصبح المفتاح القديم بلا عمل. <b>تفعيل بلا إنترنت.</b>
              </p>

              <div>
                <label className="block text-xs font-black text-[#000000] mb-1.5">كود الجهاز</label>
                <input
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); if (msg.text) setMsg({ type: "", text: "" }); }}
                  onKeyDown={(e) => { if (e.key === "Enter") generate(); }}
                  placeholder="CAP-0000-0000-0000"
                  spellCheck={false} autoComplete="off" dir="ltr"
                  className="w-full p-2.5 bg-[#b8bcb2] border border-[#888888] font-mono font-bold text-sm focus:outline-none"
                />
                {isValidCode(code.trim().toUpperCase()) && alreadyIssued(code.trim().toUpperCase()) && (
                  <p className="mt-1.5 text-[11px] font-bold text-[#550000] bg-[#e8c8c8] border border-[#aa7777] px-2 py-1.5">
                    ⚠️ الكود ده متسجّل قبل كده — آخر إصدار {fmt(alreadyIssued(code.trim().toUpperCase())!.lastIssued)}
                    {alreadyIssued(code.trim().toUpperCase())!.note ? ` — (${alreadyIssued(code.trim().toUpperCase())!.note})` : ""}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-[#000000] mb-1.5">ملاحظة (اسم العميل / الفرع) — اختياري</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثال: أحمد — فرع مدينة نصر"
                  className="w-full p-2.5 bg-[#b8bcb2] border border-[#888888] text-sm font-semibold focus:outline-none"
                />
              </div>

              <button
                onClick={generate}
                disabled={busy}
                className="h-11 px-6 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-extrabold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                <span>{busy ? "جارٍ التوليد..." : "توليد مفتاح التفعيل"}</span>
              </button>

              {key && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-black text-[#000000]">مفتاح التفعيل — أرسله للعميل</label>
                  <div className="flex gap-2 items-stretch">
                    <textarea
                      value={key} readOnly rows={3} dir="ltr"
                      className="flex-1 min-w-0 p-2.5 bg-[#b8bcb2] border border-[#888888] font-mono text-[11px] leading-relaxed focus:outline-none resize-none"
                    />
                    <button
                      onClick={copyKey}
                      className={`w-[92px] shrink-0 font-extrabold text-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        copied ? "bg-[#a8b898] text-[#000000]" : "bg-[#222222] hover:bg-[#000000] text-[#c3c6bb]"
                      }`}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copied ? "تم النسخ" : "نسخ"}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="border-t border-[#888888] pt-3">
                <p className="text-[11px] text-[#555555] font-semibold">
                  <b>بديل من الطرفية:</b>{" "}
                  <span className="font-mono bg-[#b8bcb2] px-1.5 py-0.5" dir="ltr">node D:\CaptainPOS\gen-license.cjs CAP-XXXX-XXXX-XXXX</span>
                </p>
              </div>
            </div>
          )}

          {tab === "log" && (
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1 max-w-[340px]">
                  <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555555]" />
                  <input
                    value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="ابحث بكود الجهاز أو اسم العميل..."
                    className="w-full p-2.5 pr-8 bg-[#b8bcb2] border border-[#888888] text-xs font-semibold focus:outline-none"
                  />
                </div>
                <button
                  onClick={loadLog} disabled={logBusy}
                  className="px-3 py-2.5 bg-[#222222] text-[#c3c6bb] text-xs font-bold cursor-pointer hover:bg-[#000000] disabled:opacity-60 flex items-center gap-1.5"
                >
                  <RotateCcw size={13} className={logBusy ? "animate-spin" : ""} />
                  تحديث
                </button>
              </div>

              {filtered.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold text-[#555555] bg-[#b8bcb2] border border-[#888888]">
                  {entries.length === 0 ? "مفيش تفعيلات مسجّلة لحد دلوقتي" : "مفيش نتائج مطابقة للبحث"}
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#222222]">
                  <table className="w-full text-right text-xs min-w-[720px] border-collapse">
                    <thead>
                      <tr className="bg-[#222222] text-[#c3c6bb]">
                        <th className="p-2.5 border border-[#444444] font-bold">كود الجهاز</th>
                        <th className="p-2.5 border border-[#444444] font-bold">العميل / ملاحظة</th>
                        <th className="p-2.5 border border-[#444444] font-bold">أول إصدار</th>
                        <th className="p-2.5 border border-[#444444] font-bold">آخر إصدار</th>
                        <th className="p-2.5 border border-[#444444] font-bold">مرات</th>
                        <th className="p-2.5 border border-[#444444] font-bold">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((e) => (
                        <tr key={e.code} className={`border-b border-[#888888] ${e.revoked ? "bg-[#d8a8a8]" : "hover:bg-[#b8bcb2]"}`}>
                          <td className="p-2.5 border border-[#888888] font-mono font-bold whitespace-nowrap">{e.code}</td>
                          <td className="p-2 border border-[#888888]">
                            <input
                              defaultValue={e.note}
                              onBlur={(ev) => { if (ev.target.value !== e.note) saveNote(e.code, ev.target.value); }}
                              onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }}
                              placeholder="اكتب اسم العميل..."
                              className="w-full bg-transparent border border-[#aaaaaa] px-1.5 py-1 text-xs font-semibold focus:outline-none focus:border-[#222222]"
                            />
                          </td>
                          <td className="p-2.5 border border-[#888888] whitespace-nowrap">{fmt(e.firstIssued)}</td>
                          <td className="p-2.5 border border-[#888888] whitespace-nowrap">{fmt(e.lastIssued)}</td>
                          <td className="p-2.5 border border-[#888888] font-bold text-center">{e.count}</td>
                          <td className="p-2 border border-[#888888]">
                            <button
                              onClick={() => toggleRevoke(e)}
                              className={`px-2 py-1 text-[10px] font-black flex items-center gap-1 cursor-pointer ${
                                e.revoked ? "bg-[#222222] text-[#c3c6bb] hover:bg-[#555555]" : "bg-[#884444] text-[#ffffff] hover:bg-[#662222]"
                              }`}
                              title={e.revoked ? "إلغاء التعليم" : "تعليم كمرفوض"}
                            >
                              {e.revoked ? <><RotateCcw size={11} /> تفعيل</> : <><Ban size={11} /> رفض</>}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-[11px] text-[#555555] font-semibold leading-relaxed pt-1">
                <b>ملاحظة:</b> الكود مربوط بـ<b>معرّف تثبيت ويندوز</b> — إلغاء تثبيت البرنامج أو إعادة تسطيره على نفس الجهاز
                <b> لا يغيّر الكود</b>، فيظهر هنا كمُكرّر. أما فرمتة الجهاز أو تبديله فتُنتج كودًا جديدًا لا يمكن تمييزه عن جهاز جديد.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
