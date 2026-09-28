import React, { useState, useEffect, useCallback, useMemo } from "react";
import { User } from "../types";
import { Search, Plus, X, Wallet, CreditCard, RefreshCw, FileText, Banknote, ArrowRight, PackageSearch } from "lucide-react";
import { authFetch } from "../authFetch";

interface AccountsProps {
  currentUser: User | null;
  onNavigateToTab?: (tab: string) => void;
  onWithdrawNow?: (customer: any) => void;
}

type Section = "all" | "debt" | "credit" | "cards" | "later" | "none";
type Msg = { kind: "ok" | "err"; text: string } | null;

const fmt = (n: number) => `${Number(n || 0).toFixed(2)} ج`;
const currentMonth = () => new Date().toISOString().slice(0, 7);

const LEDGER_LABEL: Record<string, string> = {
  opening_debit: "رصيد افتتاحي (دين قديم)",
  opening_credit: "رصيد افتتاحي (فلوس معي عنده)",
  payment: "سداد على الدفتر القديم",
};

export default function Accounts({ currentUser, onNavigateToTab, onWithdrawNow }: AccountsProps) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState<Section>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [collect, setCollect] = useState<{ inv: any; amount: string; source: string } | null>(null);
  const [ledgerModal, setLedgerModal] = useState<{ types: string[]; type: string; amount: string; note: string } | null>(null);
  const [cardModal, setCardModal] = useState<{ dir: "add" | "sub"; amount: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const canOpen =
    currentUser?.role === "admin" ||
    currentUser?.role === "developer" ||
    (currentUser?.permissions || []).includes("accounts");

  const refresh = useCallback(async (keepKey?: string) => {
    try {
      const res = await authFetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        setSummary(data.summary || null);
        if (keepKey) {
          const found = (data.accounts || []).find((a: any) => a.key === keepKey);
          setSelected(found || null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await refresh();
    setLoading(false);
  }, [refresh]);

  useEffect(() => {
    if (canOpen) load();
  }, [canOpen, load]);

  const hasActivity = (a: any) =>
    Math.abs(Number(a.balance || 0)) > 0.001 ||
    Number(a.card_value || 0) > 0 ||
    (a.status === "later" && a.status_month === currentMonth());

  const counts = useMemo(() => {
    const c = { all: 0, debt: 0, credit: 0, cards: 0, later: 0, none: 0 };
    for (const a of accounts) {
      if (hasActivity(a)) c.all++;
      if (a.balance > 0.001) c.debt++;
      if (a.balance < -0.001) c.credit++;
      if (a.card_value > 0) c.cards++;
      if (a.status === "later" && a.status_month === currentMonth()) c.later++;
      if (!hasActivity(a)) c.none++;
    }
    return c;
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return accounts.filter((a) => {
      if (section === "all" && !hasActivity(a)) return false;
      if (section === "debt" && !(a.balance > 0.001)) return false;
      if (section === "credit" && !(a.balance < -0.001)) return false;
      if (section === "cards" && !(a.card_value > 0)) return false;
      if (section === "later" && !(a.status === "later" && a.status_month === currentMonth())) return false;
      if (section === "none" && hasActivity(a)) return false;
      if (!q) return true;
      return (
        String(a.name || "").includes(q) ||
        String(a.secret_number || "").includes(q) ||
        String(a.phone || "").includes(q)
      );
    });
  }, [accounts, section, query]);

  const showMsg = (kind: "ok" | "err", text: string) => setMsg({ kind, text });

  const submitCollect = async () => {
    if (!collect) return;
    const amt = Number(collect.amount);
    if (!(amt > 0)) return showMsg("err", "اكتب المبلغ الأول");
    setBusy(true);
    setMsg(null);
    try {
      const res = await authFetch(`/api/credit/${collect.inv.id}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          payment_source: collect.source,
          user_name: currentUser?.name || "الكاشير",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) return showMsg("err", data.error || "حصل خطأ");
      const rem = Number(data.remaining || 0);
      showMsg("ok", rem > 0 ? `تمام، فاضل عليه ${fmt(rem)}` : "تم السداد بالكامل ✅");
      await refresh(selected?.key);
      setTimeout(() => { setCollect(null); setMsg(null); }, 900);
    } catch {
      showMsg("err", "فشل الاتصال بالسيرفر");
    } finally {
      setBusy(false);
    }
  };

  const submitLedger = async () => {
    if (!ledgerModal || !selected) return;
    const amt = Number(ledgerModal.amount);
    if (!(amt > 0)) return showMsg("err", "اكتب المبلغ الأول");
    setBusy(true);
    setMsg(null);
    try {
      const res = await authFetch("/api/accounts/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tamween_customer_id: selected.tamween_customer_id,
          customer_name: selected.name,
          type: ledgerModal.type,
          amount: amt,
          note: ledgerModal.note,
          user_name: currentUser?.name || "الكاشير",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) return showMsg("err", data.error || "حصل خطأ");
      showMsg("ok", "اتسجل في الدفتر ✅");
      await refresh(selected?.key);
      setTimeout(() => { setLedgerModal(null); setMsg(null); }, 900);
    } catch {
      showMsg("err", "فشل الاتصال بالسيرفر");
    } finally {
      setBusy(false);
    }
  };

  const submitCard = async () => {
    if (!cardModal || !selected) return;
    const amt = Number(cardModal.amount);
    if (!(amt > 0)) return showMsg("err", "اكتب المبلغ الأول");
    setBusy(true);
    setMsg(null);
    try {
      const res = await authFetch("/api/accounts/card-adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: selected.tamween_customer_id,
          delta: cardModal.dir === "add" ? amt : -amt,
          note: cardModal.note,
          user_name: currentUser?.name || "الكاشير",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) return showMsg("err", data.error || "حصل خطأ");
      showMsg("ok", `رصيد البطاقة بقى ${fmt(data.card_value)}`);
      await refresh(selected?.key);
      setTimeout(() => { setCardModal(null); setMsg(null); }, 900);
    } catch {
      showMsg("err", "فشل الاتصال بالسيرفر");
    } finally {
      setBusy(false);
    }
  };

  const withdrawLater = async () => {
    if (!selected || !onWithdrawNow || !selected.tamween_customer_id) return;
    setBusy(true);
    try {
      let pendingSale: any = null;
      try {
        const r = await authFetch(`/api/tamween-customers/${selected.tamween_customer_id}/pending-sale`);
        const d = await r.json();
        pendingSale = d?.pendingSale || null;
      } catch {}
      onWithdrawNow({
        id: selected.tamween_customer_id,
        name: selected.name,
        secret_number: selected.secret_number,
        card_value: selected.card_value,
        bread_points: selected.bread_points,
        pendingSale,
      });
    } finally {
      setBusy(false);
    }
  };

  if (!canOpen) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ direction: "rtl" }}>
        <div className="bg-[#c3c6bb] p-6 border border-[#222222] text-center max-w-md">
          <p className="font-black text-sm">مش عندك صلاحية تفتح صفحة حسابات الزبائن</p>
          <p className="text-xs font-bold mt-1">اطلب من الإدارة تفعيل صلاحية "حسابات الزبائن"</p>
        </div>
      </div>
    );
  }

  const chips: { id: Section; label: string }[] = [
    { id: "all", label: "كل الحسابات" },
    { id: "debt", label: "عليه دين" },
    { id: "credit", label: "فلوس عندي" },
    { id: "cards", label: "أرصدة بطاقات" },
    { id: "later", label: "صرف لاحق" },
    { id: "none", label: "بدون حركة" },
  ];

  return (
    <div className="w-full h-full flex flex-col gap-2 p-3 select-none font-sans overflow-hidden" id="printable-accounts" style={{ direction: "rtl" }}>
      {/* الترويسة */}
      <div className="bg-[#c3c6bb] px-3 py-2 border border-[#222222] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <h2 className="text-sm font-extrabold text-[#000000] flex items-center gap-1.5">
            <Wallet size={15} strokeWidth={1.5} />
            <span>حسابات الزبائن والديون</span>
          </h2>
          <p className="text-[11px] text-[#555555] font-semibold">
            آجل · سداد · بطاقات · صرف لاحق · أرصدة افتتاحية
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateToTab?.("sales")}
            className="h-6 px-2.5 flex items-center justify-center gap-1.5 bg-[#222222] text-[#c3c6bb] hover:bg-black text-xs font-bold border border-[#222222] transition-colors cursor-pointer"
          >
            <FileText size={13} />
            <span>آجل جديد</span>
          </button>
          <button
            type="button"
            onClick={load}
            className="h-6 px-2.5 flex items-center justify-center gap-1.5 bg-[#b8bcb2] hover:bg-[#888888] text-[#000000] font-bold text-xs border border-[#888888] transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* ملخص */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
        <div className="bg-white border-2 border-[#dc2626] px-3 py-2">
          <p className="text-[10px] font-black text-[#dc2626]">إجمالي المديونيات (ليّا)</p>
          <p className="text-lg font-black text-[#dc2626] font-mono">{fmt(summary?.total_debt || 0)}</p>
          <p className="text-[9px] font-bold text-[#555555]">{summary?.debtors || 0} زبون مدين</p>
        </div>
        <div className="bg-white border-2 border-[#16a34a] px-3 py-2">
          <p className="text-[10px] font-black text-[#16a34a]">فلوس عندي لصالح الزبائن</p>
          <p className="text-lg font-black text-[#16a34a] font-mono">{fmt(summary?.total_credit || 0)}</p>
          <p className="text-[9px] font-bold text-[#555555]">مقدم/أرصدة افتتاحية</p>
        </div>
        <div className="bg-white border-2 border-[#d97706] px-3 py-2">
          <p className="text-[10px] font-black text-[#d97706]">أرصدة بطاقات التموين</p>
          <p className="text-lg font-black text-[#d97706] font-mono">{fmt(summary?.total_card || 0)}</p>
          <p className="text-[9px] font-bold text-[#555555]">مقبوضة ولم تُصرف</p>
        </div>
        <div className="bg-white border-2 border-[#2563eb] px-3 py-2">
          <p className="text-[10px] font-black text-[#2563eb]">صرف لاحق هذا الشهر</p>
          <p className="text-lg font-black text-[#2563eb] font-mono">{summary?.later || 0}</p>
          <p className="text-[9px] font-bold text-[#555555]">زبائن بانتظار الاستلام</p>
        </div>
      </div>

      {/* الفلاتر + البحث */}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSection(c.id)}
            className={`px-2.5 h-7 text-[11px] font-black border transition-colors cursor-pointer ${
              section === c.id
                ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                : "bg-white text-[#222222] border-[#888888] hover:bg-[#e5e7eb]"
            }`}
          >
            {c.label} ({counts[c.id]})
          </button>
        ))}
        <div className="flex items-center bg-white border border-[#888888] h-7 px-2 gap-1.5 flex-1 min-w-[180px] max-w-xs ms-auto">
          <Search size={13} className="text-[#555555] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="دور باسم الزبون / رقم البطاقة / تليفون..."
            className="flex-1 min-w-0 text-[11px] font-bold outline-none bg-transparent"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="cursor-pointer text-[#555555] hover:text-black">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* الجدول */}
      <div className="flex-1 min-h-0 overflow-auto border border-[#222222] bg-white">
        <table className="w-full text-right">
          <thead className="bg-[#222222] text-[#c3c6bb] sticky top-0 z-10">
            <tr className="text-[11px] font-black">
              <th className="py-2 px-3">الزبون</th>
              <th className="py-2 px-3 text-center">النوع</th>
              <th className="py-2 px-3 text-center">عليه (ج)</th>
              <th className="py-2 px-3 text-center">ليّا (ج)</th>
              <th className="py-2 px-3 text-center">رصيد بطاقة (ج)</th>
              <th className="py-2 px-3 text-center">آخر حركة</th>
              <th className="py-2 px-3 text-center">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((a) => (
                <tr key={a.key} className="border-b border-[#e5e7eb] hover:bg-[#f3f4f6] text-xs">
                  <td className="py-2 px-3">
                    <p className="font-black text-[#000000]">{a.name}</p>
                    <p className="text-[10px] text-[#555555] font-mono">
                      {a.secret_number ? `بطاقة: ${a.secret_number}` : "بدون بطاقة"}
                      {a.phone ? ` · ${a.phone}` : ""}
                    </p>
                  </td>
                  <td className="py-2 px-3 text-center">
                    {a.card_value > 0 || a.secret_number ? (
                      <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] font-black rounded">ببطاقة</span>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 text-[9px] font-black rounded">بدون بطاقة</span>
                    )}
                    {a.status === "later" && a.status_month === currentMonth() && (
                      <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[9px] font-black rounded me-1">صرف لاحق</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-black text-[#dc2626]">
                    {a.balance > 0.001 ? Number(a.balance).toFixed(2) : "-"}
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-black text-[#16a34a]">
                    {a.balance < -0.001 ? Number(-a.balance).toFixed(2) : "-"}
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-bold text-[#d97706]">
                    {a.card_value > 0 ? Number(a.card_value).toFixed(2) : "-"}
                  </td>
                  <td className="py-2 px-3 text-center text-[10px] font-bold text-[#555555] font-mono">
                    {a.last_activity || "-"}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => { setSelected(a); setMsg(null); }}
                      className="bg-[#065f46] text-white hover:bg-[#047857] px-2.5 py-1 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors mx-auto"
                    >
                      فتح الحساب <ArrowRight size={12} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#555555] font-bold text-xs">
                  {loading ? "جاري التحميل..." : query ? "مفيش زبون بالبيانات دي" : "مفيش حسابات في القسم ده"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* نافذة الحساب */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ direction: "rtl" }}>
          <div className="bg-white w-full max-w-2xl border border-[#222222] shadow-2xl rounded-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-[#222222] text-[#c3c6bb] px-4 py-3 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-black truncate">{selected.name}</h3>
                <p className="text-[10px] font-bold opacity-80">
                  {selected.secret_number ? `رقم البطاقة: ${selected.secret_number}` : "بدون بطاقة"}
                  {selected.phone ? ` · ${selected.phone}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="cursor-pointer hover:text-white shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 overflow-auto flex-1 min-h-0 space-y-3">
              {/* الأرصدة */}
              <div className="grid grid-cols-3 gap-2">
                <div className="border-2 border-[#dc2626] px-2 py-1.5 text-center">
                  <p className="text-[9px] font-black text-[#dc2626]">عليه</p>
                  <p className="font-black font-mono text-[#dc2626]">
                    {fmt(selected.balance > 0 ? selected.balance : 0)}
                  </p>
                </div>
                <div className="border-2 border-[#16a34a] px-2 py-1.5 text-center">
                  <p className="text-[9px] font-black text-[#16a34a]">ليّا (مقدم)</p>
                  <p className="font-black font-mono text-[#16a34a]">
                    {fmt(selected.balance < 0 ? -selected.balance : 0)}
                  </p>
                </div>
                <div className="border-2 border-[#d97706] px-2 py-1.5 text-center">
                  <p className="text-[9px] font-black text-[#d97706]">رصيد بطاقة</p>
                  <p className="font-black font-mono text-[#d97706]">{fmt(selected.card_value || 0)}</p>
                </div>
              </div>

              <p className="text-[10px] font-bold text-[#555555]">
                تفاصيل: فواتير آجل مفتوحة {fmt(selected.invoice_debt)} · الدفتر القديم{" "}
                <span className={selected.ledger_net >= 0 ? "" : "text-[#16a34a]"}>
                  {fmt(selected.ledger_net)}
                </span>
              </p>

              {/* فواتير الآجل */}
              <div>
                <p className="text-xs font-black mb-1 flex items-center gap-1">
                  <FileText size={13} /> فواتير الآجل المفتوحة ({selected.open_invoices?.length || 0})
                </p>
                {selected.open_invoices?.length ? (
                  <div className="border border-[#888888] divide-y divide-[#e5e7eb]">
                    {selected.open_invoices.map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px]">
                        <div className="min-w-0">
                          <p className="font-bold font-mono">{inv.invoice_number}</p>
                          <p className="text-[10px] text-[#555555] font-mono">
                            {String(inv.date || "").slice(0, 10)} · الكاشير: {inv.created_by || "-"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`font-black font-mono ${
                              inv.remaining > 0 ? "text-[#dc2626]" : "text-[#16a34a]"
                            }`}
                          >
                            {fmt(inv.remaining)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCollect({ inv, amount: String(Number(inv.remaining || 0).toFixed(2)), source: "cash_register" });
                              setMsg(null);
                            }}
                            className="bg-[#065f46] text-white hover:bg-[#047857] px-2 py-1 font-bold text-[10px] cursor-pointer transition-colors"
                          >
                            سدّد
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] font-bold text-[#555555] border border-dashed border-[#888888] px-2 py-2 text-center">
                    مفيش فواتير آجل مفتوحة
                  </p>
                )}
              </div>

              {/* الدفتر القديم */}
              <div>
                <p className="text-xs font-black mb-1 flex items-center gap-1">
                  <Banknote size={13} /> الدفتر القديم ({selected.ledger?.length || 0})
                </p>
                {selected.ledger?.length ? (
                  <div className="border border-[#888888] divide-y divide-[#e5e7eb] max-h-40 overflow-auto">
                    {selected.ledger.map((e: any) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px]">
                        <div className="min-w-0">
                          <p className="font-bold">{LEDGER_LABEL[e.type] || e.type}</p>
                          <p className="text-[10px] text-[#555555]">
                            {String(e.created_at || "").slice(0, 10)} · {e.created_by || "-"}
                            {e.note ? ` · ${e.note}` : ""}
                          </p>
                        </div>
                        <span
                          className={`font-black font-mono shrink-0 ${
                            e.type === "opening_debit" ? "text-[#dc2626]" : "text-[#16a34a]"
                          }`}
                        >
                          {e.type === "opening_debit" ? "+" : "-"}
                          {Number(e.amount || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] font-bold text-[#555555] border border-dashed border-[#888888] px-2 py-2 text-center">
                    مفيش حركات دفتر
                  </p>
                )}
              </div>

              {msg && (
                <p
                  className={`text-[11px] font-black px-2 py-1.5 border ${
                    msg.kind === "ok"
                      ? "bg-green-50 border-green-600 text-green-700"
                      : "bg-red-50 border-red-600 text-red-700"
                  }`}
                >
                  {msg.text}
                </p>
              )}
            </div>

            {/* أزرار الإجراءات */}
            <div className="border-t border-[#222222] p-2 flex items-center gap-1.5 flex-wrap shrink-0 bg-[#f3f4f6]">
              <button
                type="button"
                onClick={() => { setLedgerModal({ types: ["opening_debit", "opening_credit"], type: "opening_debit", amount: "", note: "" }); setMsg(null); }}
                className="h-8 px-2.5 bg-[#222222] text-[#c3c6bb] hover:bg-black text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus size={13} /> رصيد افتتاحي
              </button>
              {(selected.ledger_net || 0) > 0.001 && (
                <button
                  type="button"
                  onClick={() => { setLedgerModal({ types: ["payment"], type: "payment", amount: String(Number(selected.ledger_net).toFixed(2)), note: "" }); setMsg(null); }}
                  className="h-8 px-2.5 bg-[#065f46] text-white hover:bg-[#047857] text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                >
                  سدّد على الدفتر
                </button>
              )}
              {selected.tamween_customer_id && (
                <>
                  <button
                    type="button"
                    onClick={() => { setCardModal({ dir: "add", amount: "", note: "" }); setMsg(null); }}
                    className="h-8 px-2.5 bg-[#d97706] text-white hover:bg-[#b45309] text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <CreditCard size={13} /> رصيد بطاقة
                  </button>
                  <button
                    type="button"
                    disabled={busy || !(selected.card_value > 0 || (selected.status === "later" && selected.status_month === currentMonth()))}
                    onClick={withdrawLater}
                    className="h-8 px-2.5 bg-[#2563eb] text-white hover:bg-[#1d4ed8] text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <PackageSearch size={13} /> صرف لاحقًا
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onNavigateToTab?.("sales")}
                className="h-8 px-2.5 bg-[#b8bcb2] hover:bg-[#888888] text-[#000000] text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
              >
                <FileText size={13} /> آجل جديد
              </button>
              <button
                type="button"
                onClick={() => { setSelected(null); setMsg(null); }}
                className="h-8 px-3 bg-white border border-[#888888] hover:bg-[#e5e7eb] text-[#000000] text-[11px] font-black ms-auto cursor-pointer transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة السداد على فاتورة */}
      {collect && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" style={{ direction: "rtl" }}>
          <div className="bg-white w-full max-w-sm border border-[#222222] shadow-2xl rounded-xl overflow-hidden">
            <div className="bg-[#065f46] text-white px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-black">سدّد فاتورة آجل</h3>
              <button type="button" onClick={() => { setCollect(null); setMsg(null); }} className="cursor-pointer hover:opacity-80">
                <X size={16} />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-[11px] font-bold text-[#555555]">
                فاتورة <span className="font-mono font-black text-black">{collect.inv.invoice_number}</span> — المتبقي{" "}
                <span className="text-[#dc2626] font-black">{fmt(collect.inv.remaining)}</span>
              </p>
              <label className="block text-[11px] font-black">المبلغ المدفوع (ج)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={collect.amount}
                onChange={(e) => setCollect({ ...collect, amount: e.target.value })}
                className="w-full h-9 bg-[#f3f4f6] border border-[#888888] px-3 text-center text-sm font-black font-mono focus:outline-none focus:border-[#222222]"
                autoFocus
              />
              <label className="block text-[11px] font-black">مصدر الفلوس</label>
              <div className="flex gap-1.5">
                {[
                  { id: "cash_register", label: "صندوق الكاشير" },
                  { id: "main_safe", label: "الخزينة الرئيسية" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCollect({ ...collect, source: s.id })}
                    className={`flex-1 h-8 text-[11px] font-black border cursor-pointer transition-colors ${
                      collect.source === s.id
                        ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                        : "bg-white border-[#888888] hover:bg-[#e5e7eb]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {msg && (
                <p className={`text-[11px] font-black px-2 py-1.5 border ${msg.kind === "ok" ? "bg-green-50 border-green-600 text-green-700" : "bg-red-50 border-red-600 text-red-700"}`}>
                  {msg.text}
                </p>
              )}
            </div>
            <div className="p-2 border-t border-[#222222] flex gap-1.5">
              <button
                type="button"
                onClick={submitCollect}
                disabled={busy}
                className="flex-1 h-9 bg-[#065f46] hover:bg-[#047857] text-white font-black text-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                {busy ? "جاري التسجيل..." : "تأكيد السداد"}
              </button>
              <button
                type="button"
                onClick={() => { setCollect(null); setMsg(null); }}
                className="h-9 px-3 bg-white border border-[#888888] hover:bg-[#e5e7eb] font-black text-xs cursor-pointer transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الدفتر */}
      {ledgerModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" style={{ direction: "rtl" }}>
          <div className="bg-white w-full max-w-sm border border-[#222222] shadow-2xl rounded-xl overflow-hidden">
            <div className="bg-[#222222] text-[#c3c6bb] px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-black">
                {ledgerModal.type === "payment" ? "سداد على الدفتر القديم" : "رصيد افتتاحي"}
              </h3>
              <button type="button" onClick={() => { setLedgerModal(null); setMsg(null); }} className="cursor-pointer hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-[11px] font-bold text-[#555555]">
                الزبون: <span className="text-black font-black">{selected?.name}</span>
              </p>
              {ledgerModal.types.length > 1 && (
                <div className="flex gap-1.5">
                  {ledgerModal.types.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLedgerModal({ ...ledgerModal, type: t })}
                      className={`flex-1 h-9 text-[11px] font-black border cursor-pointer transition-colors ${
                        ledgerModal.type === t
                          ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                          : "bg-white border-[#888888] hover:bg-[#e5e7eb]"
                      }`}
                    >
                      {t === "opening_debit" ? "الزبون ليّا عليه (دين)" : "فلوس عندي أنا لصالحه"}
                    </button>
                  ))}
                </div>
              )}
              <label className="block text-[11px] font-black">المبلغ (ج)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={ledgerModal.amount}
                onChange={(e) => setLedgerModal({ ...ledgerModal, amount: e.target.value })}
                className="w-full h-9 bg-[#f3f4f6] border border-[#888888] px-3 text-center text-sm font-black font-mono focus:outline-none focus:border-[#222222]"
                autoFocus
              />
              <label className="block text-[11px] font-black">ملاحظة (اختياري)</label>
              <input
                type="text"
                value={ledgerModal.note}
                onChange={(e) => setLedgerModal({ ...ledgerModal, note: e.target.value })}
                placeholder="مثال: ديون قديمة بضاعة 2024..."
                className="w-full h-9 bg-[#f3f4f6] border border-[#888888] px-3 text-xs font-bold focus:outline-none focus:border-[#222222]"
              />
              {msg && (
                <p className={`text-[11px] font-black px-2 py-1.5 border ${msg.kind === "ok" ? "bg-green-50 border-green-600 text-green-700" : "bg-red-50 border-red-600 text-red-700"}`}>
                  {msg.text}
                </p>
              )}
            </div>
            <div className="p-2 border-t border-[#222222] flex gap-1.5">
              <button
                type="button"
                onClick={submitLedger}
                disabled={busy}
                className="flex-1 h-9 bg-[#222222] hover:bg-black text-[#c3c6bb] font-black text-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                {busy ? "جاري التسجيل..." : "تسجيل في الدفتر"}
              </button>
              <button
                type="button"
                onClick={() => { setLedgerModal(null); setMsg(null); }}
                className="h-9 px-3 bg-white border border-[#888888] hover:bg-[#e5e7eb] font-black text-xs cursor-pointer transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة رصيد البطاقة */}
      {cardModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" style={{ direction: "rtl" }}>
          <div className="bg-white w-full max-w-sm border border-[#222222] shadow-2xl rounded-xl overflow-hidden">
            <div className="bg-[#d97706] text-white px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-black">رصيد بطاقة الزبون</h3>
              <button type="button" onClick={() => { setCardModal(null); setMsg(null); }} className="cursor-pointer hover:opacity-80">
                <X size={16} />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-[11px] font-bold text-[#555555]">
                {selected?.name} — الرصيد الحالي{" "}
                <span className="text-[#d97706] font-black font-mono">{fmt(selected?.card_value || 0)}</span>
              </p>
              <div className="flex gap-1.5">
                {[
                  { id: "add", label: "زيادة (ضرب بطاقة)" },
                  { id: "sub", label: "خصم" },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setCardModal({ ...cardModal, dir: d.id as "add" | "sub" })}
                    className={`flex-1 h-9 text-[11px] font-black border cursor-pointer transition-colors ${
                      cardModal.dir === d.id
                        ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                        : "bg-white border-[#888888] hover:bg-[#e5e7eb]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <label className="block text-[11px] font-black">المبلغ (ج)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cardModal.amount}
                onChange={(e) => setCardModal({ ...cardModal, amount: e.target.value })}
                className="w-full h-9 bg-[#f3f4f6] border border-[#888888] px-3 text-center text-sm font-black font-mono focus:outline-none focus:border-[#222222]"
                autoFocus
              />
              <label className="block text-[11px] font-black">ملاحظة (اختياري)</label>
              <input
                type="text"
                value={cardModal.note}
                onChange={(e) => setCardModal({ ...cardModal, note: e.target.value })}
                className="w-full h-9 bg-[#f3f4f6] border border-[#888888] px-3 text-xs font-bold focus:outline-none focus:border-[#222222]"
              />
              {msg && (
                <p className={`text-[11px] font-black px-2 py-1.5 border ${msg.kind === "ok" ? "bg-green-50 border-green-600 text-green-700" : "bg-red-50 border-red-600 text-red-700"}`}>
                  {msg.text}
                </p>
              )}
            </div>
            <div className="p-2 border-t border-[#222222] flex gap-1.5">
              <button
                type="button"
                onClick={submitCard}
                disabled={busy}
                className="flex-1 h-9 bg-[#d97706] hover:bg-[#b45309] text-white font-black text-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                {busy ? "جاري التسجيل..." : "تأكيد"}
              </button>
              <button
                type="button"
                onClick={() => { setCardModal(null); setMsg(null); }}
                className="h-9 px-3 bg-white border border-[#888888] hover:bg-[#e5e7eb] font-black text-xs cursor-pointer transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
