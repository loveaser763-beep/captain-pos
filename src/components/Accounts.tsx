import React, { useState, useEffect, useCallback, useMemo } from "react";
import { User } from "../types";
import { Search, Plus, X, Wallet, CreditCard, RefreshCw, FileText, Banknote, ArrowRight, PackageSearch, TrendingDown, PiggyBank, Clock, ScrollText, Receipt } from "lucide-react";
import { authFetch } from "../authFetch";

interface AccountsProps {
  currentUser: User | null;
  onNavigateToTab?: (tab: string) => void;
  onWithdrawNow?: (customer: any) => void;
  embedded?: boolean;
  // تحكّم خارجي (صفحة الديون) — عشان ضغط المربع يفلتر الجدول لوحده
  section?: Section;
  onSectionChange?: (s: Section) => void;
}

export type Section = "all" | "debt" | "credit" | "cards" | "later" | "none";
type Msg = { kind: "ok" | "err"; text: string } | null;

const fmt = (n: number) => `${Number(n || 0).toFixed(2)} ج`;

// آخر حركة بلغة بشرية بدل التاريخ الجامد
const relDay = (d: string) => {
  const s = String(d || "").slice(0, 10);
  if (!s) return null;
  const then = new Date(s + "T00:00:00").getTime();
  if (isNaN(then)) return s;
  const n = new Date();
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const diff = Math.round((today - then) / 86400000);
  if (diff <= 0) return "النهارده";
  if (diff === 1) return "امبارح";
  if (diff < 30) return `من ${diff} يوم`;
  if (diff < 365) return `من ${Math.round(diff / 30)} شهر`;
  return s;
};
const currentMonth = () => new Date().toISOString().slice(0, 7);

const LEDGER_LABEL: Record<string, string> = {
  opening_debit: "رصيد افتتاحي (دين قديم)",
  opening_credit: "رصيد افتتاحي (فلوس معي عنده)",
  payment: "سداد على الدفتر القديم",
  refund: "ردّ فلوس للزبون من الخزنة",
};

export default function Accounts({ currentUser, onNavigateToTab, onWithdrawNow, embedded, section: sectionProp, onSectionChange }: AccountsProps) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [internalSection, setInternalSection] = useState<Section>("all");
  const section = sectionProp ?? internalSection;
  const setSection = (s: Section) => {
    setInternalSection(s);
    onSectionChange?.(s);
  };
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [collect, setCollect] = useState<{ inv: any; amount: string; source: string } | null>(null);
  const [ledgerModal, setLedgerModal] = useState<{ types: string[]; type: string; amount: string; note: string; source: string } | null>(null);
  const [newCust, setNewCust] = useState<{ name: string; type: string; amount: string; note: string } | null>(null);
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
          payment_source: ledgerModal.source,
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

  const submitNewCustomer = async () => {
    if (!newCust) return;
    const nm = newCust.name.trim();
    const amt = Number(newCust.amount);
    if (!nm) return showMsg("err", "اكتب اسم الزبون الأول");
    if (!(amt > 0)) return showMsg("err", "اكتب المبلغ الأول");
    setBusy(true);
    setMsg(null);
    try {
      const res = await authFetch("/api/accounts/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: nm,
          type: newCust.type,
          amount: amt,
          note: newCust.note,
          user_name: currentUser?.name || "المدير",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) return showMsg("err", data.error || "حصل خطأ");
      showMsg("ok", `اتسجل رصيد افتتاحي لـ ${nm} ✅`);
      await refresh();
      setTimeout(() => { setNewCust(null); setMsg(null); }, 900);
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
        <div className="bg-[var(--bg-card)] p-6 border border-[var(--border)] rounded-xl shadow-sm text-center max-w-md">
          <p className="font-black text-sm text-[var(--text-primary)]">مش عندك صلاحية تفتح صفحة حسابات الزبائن</p>
          <p className="text-xs font-bold mt-1 text-[var(--text-muted)]">اطلب من الإدارة تفعيل صلاحية "حسابات الزبائن"</p>
        </div>
      </div>
    );
  }

  const chips: { id: Section; label: string }[] = [
    { id: "all", label: "كل الحسابات" },
    { id: "debt", label: "دين ليا" },
    { id: "credit", label: "دين عليا" },
    { id: "cards", label: "أرصدة بطاقات" },
    { id: "later", label: "صرف لاحق" },
    { id: "none", label: "بدون حركة" },
  ];

  return (
    <div className="w-full h-full flex flex-col gap-2 p-3 select-none font-sans overflow-hidden" id="printable-accounts" style={{ direction: "rtl" }}>
      {/* الترويسة */}
      <div className="bg-[var(--bg-card)] px-3 py-2 border border-[var(--border)] rounded-xl shadow-sm flex items-center justify-between gap-2 shrink-0">
        <div className={`flex items-center gap-2 min-w-0 flex-wrap ${embedded ? "hidden" : ""}`}>
          <h2 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
            <Wallet size={15} strokeWidth={1.5} className="text-[var(--accent)]" />
            <span>حسابات الزبائن والديون</span>
          </h2>
          <p className="text-[11px] text-[var(--text-muted)] font-semibold">
            آجل · سداد · بطاقات · صرف لاحق · أرصدة افتتاحية
          </p>
        </div>
        <div className={`flex items-center gap-2 shrink-0 ${embedded ? "" : "flex-row"}`}>
          {!embedded && (
          <button
            type="button"
            onClick={() => onNavigateToTab?.("sales")}
            className="h-6 px-2.5 flex items-center justify-center gap-1.5 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] text-xs font-bold border border-[var(--accent)] rounded-lg transition-colors cursor-pointer"
          >
            <FileText size={13} />
            <span>آجل جديد</span>
          </button>
          )}
          {!embedded && (
          <button
            type="button"
            onClick={load}
            className="h-6 px-2.5 flex items-center justify-center gap-1.5 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] font-bold text-xs border border-[var(--border)] rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>تحديث</span>
          </button>
          )}
          <button
            type="button"
            onClick={() => { setNewCust({ name: "", type: "opening_debit", amount: "", note: "" }); setMsg(null); }}
            className="h-6 px-2.5 flex items-center justify-center gap-1.5 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] font-bold text-xs border border-[var(--border)] rounded-lg transition-colors cursor-pointer"
            title="إضافة زبون جديد برصيد افتتاحي (دين قديم أو فلوس مقدمة)"
          >
            <Plus size={13} />
            <span>زبون برصيد افتتاحي</span>
          </button>
        </div>
      </div>

      {/* سطر الحكاية — الصفحة بتشرح نفسها (مخفية لما تكون مدمجة جوّه صفحة الديون) */}
      {!embedded && (
      <>
      <div className="shrink-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-sm px-3 py-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] font-black">
        {(summary?.total_debt || 0) > 0.001 ? (
          <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-[var(--danger)] shrink-0" />
            مستحقّ من الزبائن
            <b className="font-mono text-[var(--danger)] text-xs">{fmt(summary?.total_debt)}</b>
            <b className="text-[var(--danger)]">({summary?.debtors || 0} زبون)</b>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--success)] shrink-0" />
            مفيش مديونيات
          </span>
        )}
        <span className="text-[var(--border)]">│</span>
        {(summary?.total_credit || 0) > 0.001 ? (
          <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            معايا لصالح الزبائن
            <b className="font-mono text-[var(--success)] text-xs">{fmt(summary?.total_credit)}</b>
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">مفيش فلوس مقدّمة عندنا</span>
        )}
        <span className="text-[var(--border)]">│</span>
        {(summary?.total_card || 0) > 0.001 ? (
          <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <CreditCard size={12} className="text-[var(--warning)]" />
            كروت عليها رصيد
            <b className="font-mono text-[var(--warning)] text-xs">{fmt(summary?.total_card)}</b>
            <b className="text-[var(--warning)]">({counts.cards} كرت)</b>
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">مفيش كروت عليها رصيد</span>
        )}
        <span className="text-[var(--border)]">│</span>
        {(summary?.later || 0) > 0 ? (
          <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Clock size={12} className="text-[var(--accent)]" />
            <b className="text-[var(--accent)]">{summary?.later} زبون</b>
            مستنّي استلام صرف لاحق
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">مفيش صرف لاحق مستنّي</span>
        )}
      </div>

      {/* ملخص — 3 مربعات مسطّحة (شيل «أرصدة بطاقات التموين») */}
      <div className="grid grid-cols-3 gap-2 shrink-0">
        <div
          className="bg-[var(--bg-input)] px-3 py-2 rounded-xl border border-[var(--border)] flex items-center gap-2"
          style={{ borderRight: "4px solid var(--danger)" }}
        >
          <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
            <TrendingDown size={15} className="text-[var(--danger)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-[var(--text-secondary)]">دين ليا</p>
            <p className="text-lg font-black text-[var(--danger)] font-mono leading-tight">{fmt(summary?.total_debt || 0)}</p>
            <p className="text-[9px] font-bold text-[var(--text-muted)]">{summary?.debtors || 0} زبون مدين</p>
          </div>
        </div>
        <div
          className="bg-[var(--bg-input)] px-3 py-2 rounded-xl border border-[var(--border)] flex items-center gap-2"
          style={{ borderRight: "4px solid var(--success)" }}
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <PiggyBank size={15} className="text-[var(--success)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-[var(--text-secondary)]">دين عليا</p>
            <p className="text-lg font-black text-[var(--success)] font-mono leading-tight">{fmt(summary?.total_credit || 0)}</p>
            <p className="text-[9px] font-bold text-[var(--text-muted)]">مقدم/أرصدة افتتاحية</p>
          </div>
        </div>
        <div
          className="bg-[var(--bg-input)] px-3 py-2 rounded-xl border border-[var(--border)] flex items-center gap-2"
          style={{ borderRight: "4px solid var(--accent)" }}
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Clock size={15} className="text-[var(--accent)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-[var(--text-secondary)]">صرف لاحق هذا الشهر</p>
            <p className="text-lg font-black text-[var(--accent)] font-mono leading-tight">{summary?.later || 0}</p>
            <p className="text-[9px] font-bold text-[var(--text-muted)]">زبائن بانتظار الاستلام</p>
          </div>
        </div>
      </div>
      </>
      )}

      {/* الفلاتر + البحث — الفلاتر بتتشال لما تكون داخل صفحة الديون (المربعات فوق بتاخدها) */}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
        {!embedded && chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSection(c.id)}
            className={`px-2.5 h-7 text-[11px] font-black border rounded-lg transition-colors cursor-pointer ${
              section === c.id
                ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
            }`}
          >
            {c.label} ({counts[c.id]})
          </button>
        ))}
        <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border)] h-7 px-2 gap-1.5 flex-1 min-w-[180px] max-w-xs ms-auto rounded-lg focus-within:border-[var(--accent)] transition-colors">
          <Search size={13} className="text-[var(--text-muted)] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="دور باسم الزبون / رقم البطاقة / تليفون..."
            className="flex-1 min-w-0 text-[11px] font-bold outline-none bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* الجدول */}
      <div className="flex-1 min-h-0 overflow-auto border border-[var(--border)] bg-[var(--bg-card)] rounded-xl shadow-sm">
        <table className="w-full text-right">
          <thead className="bg-[var(--bg-input)] text-[var(--text-secondary)] sticky top-0 z-10">
            <tr className="text-[11px] font-black">
              <th className="py-2 px-3">الزبون</th>
              <th className="py-2 px-3 text-center">عليه (ج)</th>
              <th className="py-2 px-3 text-center">ليّا (ج)</th>
              <th className="py-2 px-3 text-center">رصيد بطاقة (ج)</th>
              <th className="py-2 px-3 text-center">آخر حركة</th>
              <th className="py-2 px-3 text-center">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((a) => {
                const debt = a.balance > 0.001;
                const credit = a.balance < -0.001;
                const invCount = a.open_invoices?.length || 0;
                const hasLedger = (a.ledger?.length || 0) > 0;
                const rel = relDay(a.last_activity);
                return (
                  <tr
                    key={a.key}
                    onClick={() => { setSelected(a); setMsg(null); }}
                    className={`border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] text-xs cursor-pointer transition-colors border-r-[3px] ${
                      debt ? "border-r-[var(--danger)]" : credit ? "border-r-[var(--success)]" : "border-r-transparent"
                    }`}
                  >
                    <td className="py-2 px-3">
                      <p className="font-black text-[var(--text-primary)] flex items-center gap-1.5">
                        {a.name}
                        {a.status === "later" && a.status_month === currentMonth() && (
                          <span className="bg-indigo-500/10 text-[var(--accent)] px-1.5 py-0.5 text-[9px] font-black rounded">صرف لاحق</span>
                        )}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-1.5 flex-wrap">
                        <span>{a.secret_number ? `بطاقة ${a.secret_number}` : "بدون بطاقة"}</span>
                        {a.phone && <span>· {a.phone}</span>}
                        {invCount > 0 && (
                          <span className="bg-red-500/10 text-[var(--danger)] px-1.5 py-[1px] rounded font-black font-sans">
                            {invCount} فاتورة آجل
                          </span>
                        )}
                        {hasLedger && (
                          <span className="bg-indigo-500/10 text-[var(--accent)] px-1.5 py-[1px] rounded font-black font-sans">
                            فيه دفتر قديم
                          </span>
                        )}
                        {a.card_value > 0 && (
                          <span className="bg-amber-500/10 text-[var(--warning)] px-1.5 py-[1px] rounded font-black font-sans">
                            فيه رصيد كرت
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {debt ? (
                        <span className="inline-block bg-red-500/10 text-[var(--danger)] font-mono font-black px-2 py-0.5 rounded-md">
                          {Number(a.balance).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {credit ? (
                        <span className="inline-block bg-emerald-500/10 text-[var(--success)] font-mono font-black px-2 py-0.5 rounded-md">
                          {Number(-a.balance).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {a.card_value > 0 ? (
                        <span className="inline-block bg-amber-500/10 text-[var(--warning)] font-mono font-black px-2 py-0.5 rounded-md">
                          {Number(a.card_value).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center text-[10px] font-bold font-mono">
                      {rel ? (
                        <span className={rel === "النهارده" || rel === "امبارح" ? "text-[var(--success)]" : "text-[var(--text-muted)]"}>
                          {rel}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">لسه مفيش</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelected(a); setMsg(null); }}
                        className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] px-2.5 py-1 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors mx-auto rounded-lg"
                      >
                        فتح الحساب <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-14 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--bg-input)] flex items-center justify-center">
                      <Wallet size={26} strokeWidth={1.5} className="text-[var(--text-muted)]" />
                    </div>
                    <p className="font-black text-sm text-[var(--text-primary)]">
                      {loading ? "جاري التحميل..." : query ? "مفيش زبون بالبيانات دي" : "مفيش حسابات في القسم ده"}
                    </p>
                    <p className="text-[11px] font-bold text-[var(--text-muted)]">
                      {query ? "جرّب اسم تاني أو رقم بطاقة مختلف" : "أول ما يكون فيه حركة على حساب هيظهر هنا"}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* نافذة الحساب — نص الشاشة */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ direction: "rtl" }}>
          <div className="lux-pop bg-[var(--bg-card)] w-[50vw] min-w-[560px] max-w-[1000px] border border-[var(--border)] shadow-2xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-l from-[var(--accent)] to-[var(--accent-hover)] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-black truncate">{selected.name}</h3>
                <p className="text-[10px] font-bold opacity-80">
                  {selected.secret_number ? `رقم البطاقة: ${selected.secret_number}` : "بدون بطاقة"}
                  {selected.phone ? ` · ${selected.phone}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="cursor-pointer hover:bg-white/20 rounded-lg p-1.5 transition-colors shrink-0"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 overflow-auto flex-1 min-h-0 space-y-3">
              {/* أزرار الإجراءات — داخل محتوى النافذة (شيل الشريط السفلي) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                    onClick={() => { setLedgerModal({ types: ["opening_debit", "opening_credit"], type: "opening_debit", amount: "", note: "", source: "cash_register" }); setMsg(null); }}
                  className="h-8 px-2.5 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] border border-[var(--border)] text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors rounded-lg"
                >
                  <Plus size={13} /> رصيد افتتاحي
                </button>
                {(selected.ledger_net || 0) > 0.001 && (
                  <button
                    type="button"
                      onClick={() => { setLedgerModal({ types: ["payment"], type: "payment", amount: String(Number(selected.ledger_net).toFixed(2)), note: "", source: "cash_register" }); setMsg(null); }}
                    className="h-8 px-2.5 bg-[var(--success)] text-white hover:brightness-110 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all rounded-lg"
                  >
                    سدّد على الدفتر
                  </button>
                )}
                {selected.tamween_customer_id && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setCardModal({ dir: "add", amount: "", note: "" }); setMsg(null); }}
                      className="h-8 px-2.5 bg-[var(--warning)] text-white hover:brightness-110 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all rounded-lg"
                    >
                      <CreditCard size={13} /> رصيد بطاقة
                    </button>
                    <button
                      type="button"
                      disabled={busy || !(selected.card_value > 0 || (selected.status === "later" && selected.status_month === currentMonth()))}
                      onClick={withdrawLater}
                      className="h-8 px-2.5 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
                    >
                      <PackageSearch size={13} /> صرف لاحقًا
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateToTab?.("sales")}
                  className="h-8 px-2.5 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] border border-[var(--border)] text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors rounded-lg"
                >
                  <FileText size={13} /> آجل جديد
                </button>
              </div>
              {/* الأرصدة */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[var(--bg-input)] px-2 py-1.5 text-center rounded-lg">
                  <p className="text-[9px] font-black text-[var(--danger)]">عليه</p>
                  <p className="font-black font-mono text-[var(--danger)]">
                    {fmt(selected.balance > 0 ? selected.balance : 0)}
                  </p>
                </div>
                <div className="bg-[var(--bg-input)] px-2 py-1.5 text-center rounded-lg">
                  <p className="text-[9px] font-black text-[var(--success)]">ليّا (مقدم)</p>
                  <p className="font-black font-mono text-[var(--success)]">
                    {fmt(selected.balance < 0 ? -selected.balance : 0)}
                  </p>
                </div>
                <div className="bg-[var(--bg-input)] px-2 py-1.5 text-center rounded-lg">
                  <p className="text-[9px] font-black text-[var(--warning)]">رصيد بطاقة</p>
                  <p className="font-black font-mono text-[var(--warning)]">{fmt(selected.card_value || 0)}</p>
                </div>
              </div>

              {/* معادلة الرصيد — بتشرح الحساب بنفسها */}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-black">
                <span className="bg-red-500/10 text-[var(--danger)] px-2 py-1 rounded-lg">
                  فواتير آجل {fmt(selected.invoice_debt)}
                </span>
                <span className="text-[var(--text-muted)]">+</span>
                <span
                  className={`px-2 py-1 rounded-lg ${
                    selected.ledger_net >= 0 ? "bg-red-500/10 text-[var(--danger)]" : "bg-emerald-500/10 text-[var(--success)]"
                  }`}
                >
                  دفتر قديم {fmt(selected.ledger_net)}
                </span>
                <span className="text-[var(--text-muted)]">=</span>
                <span
                  className={`px-2 py-1 rounded-lg ${
                    selected.balance > 0.001
                      ? "bg-red-500/15 text-[var(--danger)]"
                      : selected.balance < -0.001
                        ? "bg-emerald-500/15 text-[var(--success)]"
                        : "bg-[var(--bg-input)] text-[var(--text-muted)]"
                  }`}
                >
                  {selected.balance > 0.001 ? "المطلوب منه" : selected.balance < -0.001 ? "محفوظ عنده" : "الرصيد"}{" "}
                  {fmt(selected.balance)}
                </span>
                {selected.card_value > 0 && (
                  <span className="bg-amber-500/10 text-[var(--warning)] px-2 py-1 rounded-lg">
                    كرت تموين {fmt(selected.card_value)}
                  </span>
                )}
              </div>

              {/* فواتير الآجل */}
              <div>
                <p className="text-xs font-black mb-1 flex items-center gap-1 text-[var(--text-primary)]">
                  <FileText size={13} className="text-[var(--accent)]" /> فواتير الآجل المفتوحة ({selected.open_invoices?.length || 0})
                </p>
                {selected.open_invoices?.length ? (
                  <div className="border border-[var(--border)] divide-y divide-[var(--border)] rounded-lg overflow-hidden">
                    {selected.open_invoices.map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] hover:bg-[var(--bg-card-hover)] transition-colors">
                        <div className="min-w-0">
                          <p className="font-bold font-mono text-[var(--text-primary)]">{inv.invoice_number}</p>
                          <p className="text-[10px] text-[var(--text-muted)] font-mono">
                            {String(inv.date || "").slice(0, 10)} · الكاشير: {inv.created_by || "-"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`font-black font-mono ${
                              inv.remaining > 0 ? "text-[var(--danger)]" : "text-[var(--success)]"
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
                            className="bg-[var(--success)] text-white hover:brightness-110 px-2 py-1 font-bold text-[10px] cursor-pointer transition-all rounded-md"
                          >
                            سدّد
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] font-bold text-[var(--text-muted)] border border-dashed border-[var(--border)] px-2 py-2 text-center rounded-lg">
                    مفيش فواتير آجل مفتوحة
                  </p>
                )}
              </div>

              {/* الدفتر القديم */}
              <div>
                <p className="text-xs font-black mb-1 flex items-center gap-1 text-[var(--text-primary)]">
                  <Banknote size={13} className="text-[var(--success)]" /> الدفتر القديم ({selected.ledger?.length || 0})
                </p>
                {selected.ledger?.length ? (
                  <div className="border border-[var(--border)] divide-y divide-[var(--border)] max-h-40 overflow-auto rounded-lg">
                    {selected.ledger.map((e: any) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] hover:bg-[var(--bg-card-hover)] transition-colors">
                        <div className="min-w-0">
                          <p className="font-bold text-[var(--text-primary)]">{LEDGER_LABEL[e.type] || e.type}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">
                            {String(e.created_at || "").slice(0, 10)} · {e.created_by || "-"}
                            {e.note ? ` · ${e.note}` : ""}
                          </p>
                        </div>
                        <span
                          className={`font-black font-mono shrink-0 ${
                            e.type === "opening_debit" || e.type === "refund" ? "text-[var(--danger)]" : "text-[var(--success)]"
                          }`}
                        >
                          {e.type === "opening_debit" || e.type === "refund" ? "+" : "-"}
                          {Number(e.amount || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] font-bold text-[var(--text-muted)] border border-dashed border-[var(--border)] px-2 py-2 text-center rounded-lg">
                    مفيش حركات دفتر
                  </p>
                )}
              </div>

              {msg && (
                <p
                  className={`text-[11px] font-black px-2 py-1.5 border rounded-lg ${
                    msg.kind === "ok"
                      ? "bg-emerald-50 border-[var(--success)] text-[var(--success)]"
                      : "bg-red-50 border-[var(--danger)] text-[var(--danger)]"
                  }`}
                >
                  {msg.text}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* نافذة السداد على فاتورة — نص الشاشة */}
      {collect && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" style={{ direction: "rtl" }}>
          <div className="lux-pop bg-[var(--bg-card)] w-[50vw] min-w-[440px] max-w-[820px] border border-[var(--border)] shadow-2xl rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-l from-[var(--success)] to-emerald-700 text-white px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-black">سدّد فاتورة آجل</h3>
              <button type="button" onClick={() => { setCollect(null); setMsg(null); }} className="cursor-pointer hover:bg-white/20 rounded-lg p-1 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[11px] font-bold text-[var(--text-muted)]">
                فاتورة <span className="font-mono font-black text-[var(--text-primary)]">{collect.inv.invoice_number}</span> — المتبقي{" "}
                <span className="text-[var(--danger)] font-black">{fmt(collect.inv.remaining)}</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-[var(--text-primary)]">المبلغ المدفوع (ج)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={collect.amount}
                    onChange={(e) => setCollect({ ...collect, amount: e.target.value })}
                    className="w-full h-9 bg-[var(--bg-input)] border border-[var(--border)] px-3 text-center text-sm font-black font-mono text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition-colors"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-[var(--text-primary)]">مصدر الفلوس</label>
                  <div className="flex gap-1.5">
                    {[
                      { id: "cash_register", label: "صندوق الكاشير" },
                      { id: "main_safe", label: "الخزينة الرئيسية" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setCollect({ ...collect, source: s.id })}
                        className={`flex-1 h-9 text-[11px] font-black border rounded-lg cursor-pointer transition-colors ${
                          collect.source === s.id
                            ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                            : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {msg && (
                <p className={`text-[11px] font-black px-2 py-1.5 border rounded-lg ${msg.kind === "ok" ? "bg-emerald-50 border-[var(--success)] text-[var(--success)]" : "bg-red-50 border-[var(--danger)] text-[var(--danger)]"}`}>
                  {msg.text}
                </p>
              )}
            </div>
            <div className="p-3 border-t border-[var(--border)] flex gap-1.5">
              <button
                type="button"
                onClick={submitCollect}
                disabled={busy}
                className="flex-1 h-9 bg-[var(--success)] hover:brightness-110 text-white font-black text-xs cursor-pointer disabled:opacity-50 transition-all rounded-lg"
              >
                {busy ? "جاري التسجيل..." : "تأكيد السداد"}
              </button>
              <button
                type="button"
                onClick={() => { setCollect(null); setMsg(null); }}
                className="h-9 px-3 bg-[var(--bg-input)] border border-[var(--border)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] font-black text-xs cursor-pointer transition-colors rounded-lg"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الدفتر — نص الشاشة */}
      {ledgerModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" style={{ direction: "rtl" }}>
          <div className="lux-pop bg-[var(--bg-card)] w-[50vw] min-w-[440px] max-w-[820px] border border-[var(--border)] shadow-2xl rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-l from-[var(--accent)] to-[var(--accent-hover)] text-white px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-black">
                {ledgerModal.type === "payment" ? "سداد على الدفتر القديم" : "رصيد افتتاحي"}
              </h3>
              <button type="button" onClick={() => { setLedgerModal(null); setMsg(null); }} className="cursor-pointer hover:bg-white/20 rounded-lg p-1 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[11px] font-bold text-[var(--text-muted)]">
                الزبون: <span className="text-[var(--text-primary)] font-black">{selected?.name}</span>
              </p>
              {ledgerModal.types.length > 1 && (
                <div className="flex gap-1.5">
                  {ledgerModal.types.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLedgerModal({ ...ledgerModal, type: t })}
                      className={`flex-1 h-9 text-[11px] font-black border rounded-lg cursor-pointer transition-colors ${
                        ledgerModal.type === t
                          ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                          : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
                      }`}
                    >
                    {t === "opening_debit" ? "دين ليا" : "دين عليا"}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-[var(--text-primary)]">المبلغ (ج)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ledgerModal.amount}
                    onChange={(e) => setLedgerModal({ ...ledgerModal, amount: e.target.value })}
                    className="w-full h-9 bg-[var(--bg-input)] border border-[var(--border)] px-3 text-center text-sm font-black font-mono text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition-colors"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-[var(--text-primary)]">ملاحظة (اختياري)</label>
                  <input
                    type="text"
                    value={ledgerModal.note}
                    onChange={(e) => setLedgerModal({ ...ledgerModal, note: e.target.value })}
                    placeholder="مثال: ديون قديمة بضاعة 2024..."
                    className="w-full h-9 bg-[var(--bg-input)] border border-[var(--border)] px-3 text-xs font-bold text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </div>
              {ledgerModal.type === "payment" && (
                <div>
                  <label className="block text-[11px] font-black text-[var(--text-primary)]">مصدر الفلوس</label>
                  <div className="flex gap-1.5">
                    {[
                      { id: "cash_register", label: "صندوق الكاشير" },
                      { id: "main_safe", label: "الخزينة الرئيسية" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setLedgerModal({ ...ledgerModal, source: s.id })}
                        className={`flex-1 h-9 text-[11px] font-black border rounded-lg cursor-pointer transition-colors ${
                          ledgerModal.source === s.id
                            ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                            : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] mt-1">
                    التحصيل بيتحسب في{" "}
                    {ledgerModal.source === "cash_register" ? "صندوق الكاشير" : "الخزينة الرئيسية"}.
                  </p>
                </div>
              )}
              {msg && (
                <p className={`text-[11px] font-black px-2 py-1.5 border rounded-lg ${msg.kind === "ok" ? "bg-emerald-50 border-[var(--success)] text-[var(--success)]" : "bg-red-50 border-[var(--danger)] text-[var(--danger)]"}`}>
                  {msg.text}
                </p>
              )}
            </div>
            <div className="p-3 border-t border-[var(--border)] flex gap-1.5">
              <button
                type="button"
                onClick={submitLedger}
                disabled={busy}
                className="flex-1 h-9 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-black text-xs cursor-pointer disabled:opacity-50 transition-colors rounded-lg"
              >
                {busy ? "جاري التسجيل..." : "تسجيل في الدفتر"}
              </button>
              <button
                type="button"
                onClick={() => { setLedgerModal(null); setMsg(null); }}
                className="h-9 px-3 bg-[var(--bg-input)] border border-[var(--border)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] font-black text-xs cursor-pointer transition-colors rounded-lg"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة زبون جديد برصيد افتتاحي — نص الشاشة */}
      {newCust && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" style={{ direction: "rtl" }}>
          <div className="lux-pop bg-[var(--bg-card)] w-[50vw] min-w-[440px] max-w-[820px] border border-[var(--border)] shadow-2xl rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-l from-[var(--accent)] to-[var(--accent-hover)] text-white px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-black">زبون جديد برصيد افتتاحي</h3>
              <button type="button" onClick={() => { setNewCust(null); setMsg(null); }} className="cursor-pointer hover:bg-white/20 rounded-lg p-1 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-[var(--text-primary)]">اسم الزبون</label>
                  <input
                    type="text"
                    value={newCust.name}
                    onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                    placeholder="مثال: أحمد عبد الله"
                    className="w-full h-9 bg-[var(--bg-input)] border border-[var(--border)] px-3 text-right text-xs font-bold text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition-colors"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-[var(--text-primary)]">المبلغ (ج)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newCust.amount}
                    onChange={(e) => setNewCust({ ...newCust, amount: e.target.value })}
                    className="w-full h-9 bg-[var(--bg-input)] border border-[var(--border)] px-3 text-center text-sm font-black font-mono text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-1.5">
                {(["opening_debit", "opening_credit"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewCust({ ...newCust, type: t })}
                    className={`flex-1 h-9 text-[11px] font-black border rounded-lg cursor-pointer transition-colors ${
                      newCust.type === t
                        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                        : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
                    }`}
                  >
                    {t === "opening_debit" ? "الزبون ليّا عليه (دين)" : "فلوس عندي أنا لصالحه"}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-[11px] font-black text-[var(--text-primary)]">ملاحظة (اختياري)</label>
                <input
                  type="text"
                  value={newCust.note}
                  onChange={(e) => setNewCust({ ...newCust, note: e.target.value })}
                  placeholder="مثال: ديون قديمة بضاعة 2025..."
                  className="w-full h-9 bg-[var(--bg-input)] border border-[var(--border)] px-3 text-xs font-bold text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
              {msg && (
                <p className={`text-[11px] font-black px-2 py-1.5 border rounded-lg ${msg.kind === "ok" ? "bg-emerald-50 border-[var(--success)] text-[var(--success)]" : "bg-red-50 border-[var(--danger)] text-[var(--danger)]"}`}>
                  {msg.text}
                </p>
              )}
            </div>
            <div className="p-3 border-t border-[var(--border)] flex gap-1.5">
              <button
                type="button"
                onClick={submitNewCustomer}
                disabled={busy}
                className="flex-1 h-9 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-black text-xs cursor-pointer disabled:opacity-50 transition-colors rounded-lg"
              >
                {busy ? "جاري التسجيل..." : "حفظ الرصيد الافتتاحي"}
              </button>
              <button
                type="button"
                onClick={() => { setNewCust(null); setMsg(null); }}
                className="h-9 px-3 bg-[var(--bg-input)] border border-[var(--border)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] font-black text-xs cursor-pointer transition-colors rounded-lg"
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
          <div className="lux-pop bg-[var(--bg-card)] w-full max-w-sm border border-[var(--border)] shadow-2xl rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-l from-[var(--warning)] to-amber-700 text-white px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-black">رصيد بطاقة الزبون</h3>
              <button type="button" onClick={() => { setCardModal(null); setMsg(null); }} className="cursor-pointer hover:bg-white/20 rounded-lg p-1 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-[11px] font-bold text-[var(--text-muted)]">
                {selected?.name} — الرصيد الحالي{" "}
                <span className="text-[var(--warning)] font-black font-mono">{fmt(selected?.card_value || 0)}</span>
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
                    className={`flex-1 h-9 text-[11px] font-black border rounded-lg cursor-pointer transition-colors ${
                      cardModal.dir === d.id
                        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                        : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <label className="block text-[11px] font-black text-[var(--text-primary)]">المبلغ (ج)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cardModal.amount}
                onChange={(e) => setCardModal({ ...cardModal, amount: e.target.value })}
                className="w-full h-9 bg-[var(--bg-input)] border border-[var(--border)] px-3 text-center text-sm font-black font-mono text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition-colors"
                autoFocus
              />
              <label className="block text-[11px] font-black text-[var(--text-primary)]">ملاحظة (اختياري)</label>
              <input
                type="text"
                value={cardModal.note}
                onChange={(e) => setCardModal({ ...cardModal, note: e.target.value })}
                className="w-full h-9 bg-[var(--bg-input)] border border-[var(--border)] px-3 text-xs font-bold text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              {msg && (
                <p className={`text-[11px] font-black px-2 py-1.5 border rounded-lg ${msg.kind === "ok" ? "bg-emerald-50 border-[var(--success)] text-[var(--success)]" : "bg-red-50 border-[var(--danger)] text-[var(--danger)]"}`}>
                  {msg.text}
                </p>
              )}
            </div>
            <div className="p-2 border-t border-[var(--border)] flex gap-1.5">
              <button
                type="button"
                onClick={submitCard}
                disabled={busy}
                className="flex-1 h-9 bg-[var(--warning)] hover:brightness-110 text-white font-black text-xs cursor-pointer disabled:opacity-50 transition-all rounded-lg"
              >
                {busy ? "جاري التسجيل..." : "تأكيد"}
              </button>
              <button
                type="button"
                onClick={() => { setCardModal(null); setMsg(null); }}
                className="h-9 px-3 bg-[var(--bg-input)] border border-[var(--border)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] font-black text-xs cursor-pointer transition-colors rounded-lg"
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
