import React, { useState, useEffect, useCallback } from "react";
import { User } from "../types";
import {
  Wallet,
  Users,
  Truck,
  CreditCard,
  Coins,
  RefreshCw,
  Search,
  X,
  ArrowRight,
  Plus,
  Banknote,
  ShoppingBag,
  PackageSearch,
  UserCheck,
  Clock,
  Scissors,
} from "lucide-react";
import { authFetch, hardRefocus } from "../authFetch";
import UnifiedPrintButton from "./UnifiedPrintButton";
import Accounts, { Section } from "./Accounts";

interface DebtsPageProps {
  currentUser: User | null;
  onNavigateToTab?: (tab: string) => void;
  onWithdrawNow?: (customer: any) => void;
}

type Tab = "customers" | "cards" | "suppliers" | "debt_on_me";
type Msg = { kind: "ok" | "err"; text: string } | null;

const fmt = (n: number) => `${Number(n || 0).toFixed(2)} ج`;

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

const LEDGER_LABEL: Record<string, string> = {
  opening_debit: "رصيد افتتاحي (فلوس علينا)",
  opening_credit: "رصيد افتتاحي (مقدمات عندنا)",
  payment: "سداد للمورّد",
};

const PAGE_R = 6;

export default function DebtsPage({
  currentUser,
  onNavigateToTab,
  onWithdrawNow,
}: DebtsPageProps) {
  const [tab, setTab] = useState<Tab>("customers");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const curMonth = new Date().toISOString().slice(0, 7);
  const [custModal, setCustModal] =
    useState<"withdrawn" | "later" | "partial" | null>(null);
  const [custSearch, setCustSearch] = useState("");
  const [pageCust, setPageCust] = useState(1);
  // مودالا الديون (طلب 66): دين ليا / دين عليا — بنفس فخامة مودال البطاقات
  const [debtModal, setDebtModal] = useState<"to_me" | "on_me" | null>(null);
  const [debtSearch, setDebtSearch] = useState("");
  const [pageDebt, setPageDebt] = useState(1);
  const [repHistCustomer, setRepHistCustomer] = useState<any>(null);
  const [repHistInvoices, setRepHistInvoices] = useState<any[]>([]);
  const [repHistLoading, setRepHistLoading] = useState(false);
  const [repExpandedInv, setRepExpandedInv] = useState<number | null>(null);
  const [repEditCustomer, setRepEditCustomer] = useState<any>(null);
  const [repForm, setRepForm] = useState({
    name: "",
    secret_number: "",
    phone: "",
    card_value: 0,
    bread_points: 0,
  });
  useEffect(() => {
    setPageCust(1);
  }, [custModal, custSearch]);
  useEffect(() => {
    setPageDebt(1);
  }, [debtModal, debtSearch]);

  const [custSummary, setCustSummary] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  // فلتر جدول الزبائن — بيتحكّم من مربع «دين ليا» فوق
  const [accSection, setAccSection] = useState<Section>("all");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supSummary, setSupSummary] = useState<any>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [bread, setBread] = useState<any>(null);

  const [selected, setSelected] = useState<any>(null);
  const [ledgerModal, setLedgerModal] = useState<{
    types: string[];
    type: string;
    amount: string;
    note: string;
    source: string;
  } | null>(null);
  const [collect, setCollect] = useState<{
    inv: any;
    amount: string;
    source: string;
  } | null>(null);

  const canOpen =
    currentUser?.role === "admin" ||
    currentUser?.role === "developer" ||
    (currentUser?.permissions || []).includes("accounts");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s, c, b] = await Promise.all([
        authFetch("/api/accounts")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        authFetch("/api/accounts/suppliers")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        authFetch("/api/tamween-customers")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        authFetch("/api/bread-points")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      setCustSummary(a?.summary || null);
      setAccounts(Array.isArray(a?.accounts) ? a.accounts : []);
      setSuppliers(Array.isArray(s?.suppliers) ? s.suppliers : []);
      setSupSummary(s?.summary || null);
      const list = Array.isArray(c)
        ? c
        : Array.isArray(c?.customers)
          ? c.customers
          : [];
      setCards(list);
      setBread(b || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canOpen) load();
  }, [canOpen, load]);

  const refreshOne = useCallback(async (key?: string) => {
    const [s] = await Promise.all([
      authFetch("/api/accounts/suppliers")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      authFetch("/api/accounts")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((a) => {
          setCustSummary(a?.summary || null);
          setAccounts(Array.isArray(a?.accounts) ? a.accounts : []);
        }),
    ]);
    setSuppliers(Array.isArray(s?.suppliers) ? s.suppliers : []);
    setSupSummary(s?.summary || null);
    if (key) {
      const found = (
        Array.isArray(s?.suppliers) ? s.suppliers : []
      ).find((r: any) => r.key === key);
      setSelected(found || null);
    }
  }, []);

  const showMsg = (kind: "ok" | "err", text: string) =>
    setMsg({ kind, text });

  const openCards = cards.filter(
    (c) => Number(c.remaining || 0) > 0.001 || c.status === "later"
  );
  const cardsRemaining = openCards.reduce(
    (s, c) => s + Math.max(0, Number(c.remaining || 0)),
    0
  );
  const q = query.trim();
  const filteredCards = openCards.filter(
    (c) =>
      !q ||
      String(c.name || "").includes(q) ||
      String(c.secret_number || "").includes(q) ||
      String(c.phone || "").includes(q)
  );
  const filteredSup = suppliers.filter(
    (s) =>
      !q || String(s.name || "").includes(q) || String(s.phone || "").includes(q)
  );

  // ── «دين عليا»: كل اللي أنا مديون ليهم — مورّد (فلوس علينا) + شخص (فلوس عندي) ──
  const supOwed = suppliers.filter((s) => Number(s.balance || 0) > 0.001);
  const personsOwed = accounts.filter((a) => Number(a.balance || 0) < -0.001);
  const debtOnMeTotal =
    supOwed.reduce((s, x) => s + Number(x.balance || 0), 0) +
    personsOwed.reduce((s, x) => s - Number(x.balance || 0), 0);

  const debtOnMeRows = [
    ...supOwed.map((s) => ({
      key: String(s.key ?? s.id ?? s.name),
      kind: "supplier" as const,
      name: String(s.name || ""),
      phone: String(s.phone || ""),
      amount: Number(s.balance || 0),
      last: String(s.last_activity || ""),
      ref: s,
    })),
    ...personsOwed.map((a) => ({
      key: String(a.key ?? a.name),
      kind: "person" as const,
      name: String(a.name || ""),
      phone: String(a.phone || ""),
      amount: -Number(a.balance || 0),
      last: String(a.last_activity || ""),
      ref: a,
    })),
  ]
    .sort((x, y) => y.amount - x.amount)
    .filter((r) => !q || r.name.includes(q) || r.phone.includes(q));

  // ── «دين ليا»: الزبائن المدينة (رصيد موجب) — للمودال الفخم (طلب 66) ──
  const debtorsRows = accounts
    .filter((a: any) => Number(a.balance || 0) > 0.001)
    .map((a: any) => ({
      key: String(a.key ?? a.tamween_customer_id ?? a.name),
      name: String(a.name || ""),
      phone: String(a.phone || ""),
      amount: Number(a.balance || 0),
      invoices: Number(a.invoice_debt || 0),
      last: String(a.last_activity || ""),
      ref: a,
    }))
    .sort((x, y) => y.amount - x.amount)
    .filter(
      (r) =>
        !debtSearch.trim() ||
        r.name.includes(debtSearch.trim()) ||
        r.phone.includes(debtSearch.trim())
    );

  // ── «دين عليا» في المودال: نفس صفوف التبويب بس مفلترة ببحث المودال (طلب 66) ──
  const onMeRows = (() => {
    const dsq = debtSearch.trim();
    const rows = !dsq
      ? debtOnMeRows
      : debtOnMeRows.filter(
          (r) => r.name.includes(dsq) || r.phone.includes(dsq)
        );
    return rows;
  })();
  const onMeTotal = onMeRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const onMeSupCount = onMeRows.filter(
    (r) => r.kind === "supplier"
  ).length;

  const withdrawCard = async (c: any) => {
    if (!onWithdrawNow) return;
    setBusy(true);
    try {
      let pendingSale: any = null;
      try {
        const r = await authFetch(
          `/api/tamween-customers/${c.id}/pending-sale`
        );
        const d = await r.json();
        pendingSale = d?.pendingSale || null;
      } catch {}
      onWithdrawNow({
        id: c.id,
        name: c.name,
        secret_number: c.secret_number,
        card_value: c.card_value,
        bread_points: c.bread_points,
        pendingSale,
      });
    } finally {
      setBusy(false);
    }
  };

  const openRepHistory = async (c: any) => {
    setRepHistLoading(true);
    setRepHistCustomer(c);
    setRepHistInvoices([]);
    setRepExpandedInv(null);
    try {
      const res = await authFetch(
        `/api/tamween-customers/${c.id}/history`
      );
      if (res.ok) {
        const data = await res.json();
        setRepHistCustomer(data.customer);
        setRepHistInvoices(data.invoices || []);
      }
    } catch {
    } finally {
      setRepHistLoading(false);
    }
  };

  const openRepEdit = (c: any) => {
    setRepEditCustomer(c);
    setRepForm({
      name: c.name || "",
      secret_number: c.secret_number || "",
      phone: c.phone || "",
      card_value: c.card_value || 0,
      bread_points: c.bread_points || 0,
    });
  };

  const saveRepEdit = async () => {
    if (
      !repEditCustomer ||
      !repForm.name.trim() ||
      !repForm.secret_number.trim()
    )
      return;
    try {
      const res = await authFetch(
        `/api/tamween-customers/${repEditCustomer.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...repForm,
            name: repForm.name.trim(),
            secret_number: repForm.secret_number.trim(),
            phone: repForm.phone.trim(),
          }),
        }
      );
      if (res.ok) {
        setRepEditCustomer(null);
        load();
      }
    } catch {}
  };

  const deleteRepCustomer = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا العميل؟")) {
      try {
        hardRefocus();
      } catch {}
      return;
    }
    try {
      const res = await authFetch(`/api/tamween-customers/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        load();
      }
    } catch {
    } finally {
      try {
        hardRefocus();
      } catch {}
    }
  };

  const paginate = (arr: any[], page: number) => {
    const tp = Math.max(1, Math.ceil(arr.length / PAGE_R));
    const s = Math.min(Math.max(1, page), tp);
    return arr.slice((s - 1) * PAGE_R, s * PAGE_R);
  };

  const renderPager = (
    total: number,
    page: number,
    setPage: (n: number) => void
  ) => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_R));
    if (totalPages <= 1) return null;
    const safe = Math.min(Math.max(1, page), totalPages);
    return (
      <div
        className="flex items-center justify-center gap-1.5 p-2.5 border-t flex-wrap"
        style={{
          background: "var(--bg-input)",
          borderColor: "var(--border)",
        }}
      >
        <button
          onClick={() => setPage(Math.max(1, safe - 1))}
          disabled={safe === 1}
          className="h-8 px-3 rounded-lg border text-xs font-black cursor-pointer disabled:opacity-40"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-strong)",
            color: "var(--text-primary)",
          }}
        >
          ‹ السابق
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => setPage(n)}
            className="h-8 min-w-8 px-2 text-xs font-black border rounded-lg cursor-pointer"
            style={
              n === safe
                ? {
                    background: "var(--gradient-accent)",
                    borderColor: "transparent",
                    color: "var(--on-accent)",
                  }
                : {
                    background: "var(--bg-card)",
                    borderColor: "var(--border-strong)",
                    color: "var(--text-primary)",
                  }
            }
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => setPage(Math.min(totalPages, safe + 1))}
          disabled={safe === totalPages}
          className="h-8 px-3 rounded-lg border text-xs font-black cursor-pointer disabled:opacity-40"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-strong)",
            color: "var(--text-primary)",
          }}
        >
          التالي ›
        </button>
        <span
          className="text-[11px] font-bold mr-1"
          style={{ color: "var(--text-secondary)" }}
        >
          صفحة {safe} من {totalPages}
        </span>
      </div>
    );
  };

  const submitLedger = async () => {
    if (!ledgerModal || !selected) return;
    const amt = Number(ledgerModal.amount);
    if (!(amt > 0)) return showMsg("err", "اكتب المبلغ الأول");
    setBusy(true);
    setMsg(null);
    try {
      const res = await authFetch("/api/accounts/supplier-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: selected.supplier_id,
          supplier_name: selected.name,
          type: ledgerModal.type,
          amount: amt,
          note: ledgerModal.note,
          user_name: currentUser?.name || "الكاشير",
          payment_source: ledgerModal.source,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error)
        return showMsg("err", data.error || "حصل خطأ");
      showMsg("ok", "اتسجل في دفتر المورّد ✅");
      await refreshOne(selected.key);
      setTimeout(() => {
        setLedgerModal(null);
        setMsg(null);
      }, 900);
    } catch {
      showMsg("err", "فشل الاتصال بالسيرفر");
    } finally {
      setBusy(false);
    }
  };

  const submitCollect = async () => {
    if (!collect) return;
    const amt = Number(collect.amount);
    if (!(amt > 0)) return showMsg("err", "اكتب المبلغ الأول");
    setBusy(true);
    setMsg(null);
    try {
      const res = await authFetch(`/api/purchases/${collect.inv.id}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          payment_source: collect.source,
          user_name: currentUser?.name || "الكاشير",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error)
        return showMsg("err", data.error || "حصل خطأ");
      const rem = Number(data.remaining || 0);
      showMsg(
        "ok",
        rem > 0 ? `تمام، فاضل على المورّد ${fmt(rem)}` : "اتسددت بالكامل ✅"
      );
      await refreshOne(selected?.key);
      setTimeout(() => {
        setCollect(null);
        setMsg(null);
      }, 900);
    } catch {
      showMsg("err", "فشل الاتصال بالسيرفر");
    } finally {
      setBusy(false);
    }
  };

  if (!canOpen) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ direction: "rtl" }}
      >
        <div
          className="lux-glass p-8 text-center max-w-md"
          style={{ borderRadius: "var(--lux-radius, 16px)" }}
        >
          <Wallet
            size={40}
            strokeWidth={1.5}
            className="mx-auto mb-3"
            style={{ color: "var(--accent)" }}
          />
          <p
            className="font-black text-base"
            style={{ color: "var(--text-primary)" }}
          >
            مش عندك صلاحية تفتح صفحة الديون
          </p>
          <p
            className="text-xs font-bold mt-2"
            style={{ color: "var(--text-muted)" }}
          >
            اطلب من الإدارة تفعيل صلاحية "حسابات الزبائن"
          </p>
        </div>
      </div>
    );
  }

  // ── مجموعات البطاقات — نفس فرز مودال القائمة بالظبط (شهر معيّن) ──
  const monthCards = cards.filter((c: any) => c.status_month === curMonth);
  const cardLater = monthCards.filter(
    (c: any) => c.status === "later" && Number(c.spent_month || 0) <= 0.001
  );
  const cardPartial = monthCards.filter(
    (c: any) =>
      c.status === "later" &&
      Number(c.spent_month || 0) > 0.001 &&
      Number(c.remaining || 0) > 0.001
  );
  const cardDone = monthCards.filter((c: any) => c.status === "withdrawn");
  const sumRem = (a: any[]) =>
    a.reduce((s, c) => s + Math.max(0, Number(c.remaining || 0)), 0);
  const sumVal = (a: any[]) =>
    a.reduce((s, c) => s + Number(c.card_value || 0), 0);
  const sumSpent = (a: any[]) =>
    a.reduce(
      (s, c) =>
        s + Math.max(0, Number(c.card_value || 0) - Math.max(0, Number(c.remaining || 0))),
      0
    );

  const resetView = () => {
    setQuery("");
    setMsg(null);
    setSelected(null);
    setLedgerModal(null);
    setCollect(null);
  };

  // ٥ مربعات بس — كل مربع بيفتح قائمته
  const boxes = [
    {
      id: "debt_to_me",
      label: "دين ليا",
      value: Number(custSummary?.total_debt || 0),
      sub: `${custSummary?.debtors || 0} زبون مدين`,
      color: "var(--danger)",
      tint: "rgba(239,68,68,0.10)",
      icon: Users,
      count: custSummary?.debtors || 0,
      active: debtModal === "to_me",
      onClick: () => {
        setCustModal(null);
        resetView();
        setDebtSearch("");
        setPageDebt(1);
        setDebtModal(debtModal === "to_me" ? null : "to_me");
      },
    },
    {
      id: "debt_on_me",
      label: "دين عليا",
      value: debtOnMeTotal,
      sub: `${supOwed.length} مورد · ${personsOwed.length} شخص`,
      color: "var(--warning)",
      tint: "rgba(245,158,11,0.10)",
      icon: Truck,
      count: supOwed.length + personsOwed.length,
      active: debtModal === "on_me",
      onClick: () => {
        setCustModal(null);
        resetView();
        setDebtSearch("");
        setPageDebt(1);
        setDebtModal(debtModal === "on_me" ? null : "on_me");
      },
    },
    {
      id: "cards_unspent",
      label: "بطاقات لم تصرف",
      value: sumVal(cardLater),
      sub: `${cardLater.length} كرت — قيمة كاملة`,
      color: "#d97706",
      tint: "rgba(217,119,6,.12)",
      icon: Clock,
      count: cardLater.length,
      active: custModal === "later",
      onClick: () => {
        resetView();
        setDebtModal(null);
        setCustModal(custModal === "later" ? null : "later");
      },
    },
    {
      id: "cards_partial",
      label: "بطاقات صرف جزئي",
      value: sumRem(cardPartial),
      sub: `${cardPartial.length} كرت — المتبقي`,
      color: "#7c3aed",
      tint: "rgba(124,58,237,.12)",
      icon: Scissors,
      count: cardPartial.length,
      active: custModal === "partial",
      onClick: () => {
        resetView();
        setDebtModal(null);
        setCustModal(custModal === "partial" ? null : "partial");
      },
    },
    {
      id: "cards_done",
      label: "بطاقات تم الصرف",
      value: sumSpent(cardDone),
      sub: `${cardDone.length} كرت — اللي اتصرف`,
      color: "#0891b2",
      tint: "rgba(8,145,178,.12)",
      icon: UserCheck,
      count: cardDone.length,
      active: custModal === "withdrawn",
      onClick: () => {
        resetView();
        setDebtModal(null);
        setCustModal(custModal === "withdrawn" ? null : "withdrawn");
      },
    },
  ];

  return (
    <div
      className="w-full h-full flex flex-col gap-2.5 p-3 select-none font-sans overflow-hidden"
      style={{ direction: "rtl" }}
      id="printable-debts"
    >
      {/* ── الترويسة ── */}
      <div
        className="px-5 py-3 flex items-center justify-between gap-3 shrink-0"
        style={{
          background:
            "linear-gradient(135deg, var(--bg-deep) 0%, var(--bg-card) 50%, var(--accent-subtle, rgba(201,168,76,0.08)) 100%)",
          border: "1px solid var(--border-strong)",
          borderRadius: "18px",
          boxShadow:
            "0 8px 32px -8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-wrap">
          <div
            className="w-11 h-11 flex items-center justify-center shrink-0"
            style={{
              background:
                "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)",
              borderRadius: "14px",
              boxShadow:
                "0 6px 20px -6px var(--accent), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            <Wallet size={20} strokeWidth={2.2} style={{ color: "var(--on-accent)" }} />
          </div>
          <div>
            <h2
              className="lux-metallic leading-tight"
              style={{ fontSize: "1.1rem", letterSpacing: "0.5px" }}
            >
              الديون
            </h2>
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              دين ليا · دين عليا · البطاقات (لم تُصرف / جزئي / تم الصرف)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={load}
            className="h-8 px-4 flex items-center gap-1.5 text-xs font-black"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-strong)",
              borderRadius: "12px",
            }}
          >
            <RefreshCw
              size={14}
              className={loading ? "animate-spin" : ""}
            />
            تحديث
          </button>
        </div>
      </div>

      {/* ── المربعات (٥ بس — كل مربع بيفتح قائمته) ── */}
      <div
        className="grid grid-cols-5 gap-3.5 shrink-0"
        id="debts-kpis"
      >
        {boxes.map((b) => {
          const Icon = b.icon;
          return (
            <div
              key={b.id}
              onClick={b.onClick}
              className="lux-glass px-4 py-4 flex items-center gap-3.5 cursor-pointer transition-all hover:-translate-y-0.5"
              title="اضغط لعرض القائمة"
              data-active={b.active ? "true" : "false"}
              style={{
                borderRadius: "var(--lux-radius, 16px)",
                borderRight: `4px solid ${b.color}`,
                boxShadow: b.active
                  ? `0 0 0 2px ${b.color}, 0 8px 24px -12px ${b.color}`
                  : undefined,
                opacity: b.active || !custModal ? 1 : 0.72,
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: b.tint,
                  border: `1px solid ${b.color}33`,
                }}
              >
                <Icon size={22} style={{ color: b.color }} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-black"
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {b.label}
                </p>
                <p
                  className="font-black font-mono leading-tight truncate"
                  style={{ color: b.color, fontSize: "1.3rem" }}
                >
                  {fmt(b.value)}
                </p>
                <p
                  className="truncate font-bold"
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                  }}
                >
                  {b.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── شريط البحث ── */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="flex items-center h-9 px-3 gap-2 flex-1 min-w-[180px] max-w-xs ms-auto rounded-xl focus-within:shadow-lg"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-strong)",
          }}
        >
          <Search
            size={14}
            style={{ color: "var(--text-muted)" }}
            className="shrink-0"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "suppliers"
                ? "دور باسم المورّد أو التليفون..."
                : "دور باسم الزبون / الرقم السري / التليفون..."
            }
            className="flex-1 min-w-0 font-bold outline-none bg-transparent"
            style={{
              fontSize: "0.78rem",
              color: "var(--text-primary)",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="cursor-pointer transition-transform hover:scale-125"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── المحتوى ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {tab === "customers" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <Accounts
              currentUser={currentUser}
              onNavigateToTab={onNavigateToTab}
              onWithdrawNow={onWithdrawNow}
              embedded
              section={accSection}
              onSectionChange={setAccSection}
            />
          </div>
        )}

        {tab === "cards" && (
          <div
            className="lux-stage flex-1 min-h-0 overflow-auto lux-scroll"
            style={{ padding: "0.5rem" }}
          >
            <table className="w-full text-right">
              <thead>
                <tr
                  className="text-[11px] font-black"
                  style={{
                    background: "var(--gradient-header)",
                  }}
                >
                  <th
                    className="py-2.5 px-3"
                    style={{ color: "var(--accent)" }}
                  >
                    الزبون
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    الشحن (ج)
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    المصروف (ج)
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    المتبقي (ج)
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    الحالة
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    آخر خروج
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    إجراء
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.length > 0 ? (
                  filteredCards.map((c) => {
                    const rem = Number(c.remaining || 0);
                    const rel = relDay(c.last_withdraw?.date);
                    return (
                      <tr
                        key={c.id}
                        className="text-xs transition-all"
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td className="py-2.5 px-3">
                          <p
                            className="font-black"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {c.name}
                          </p>
                          <p
                            className="font-mono flex items-center gap-1.5 flex-wrap"
                            style={{
                              fontSize: "0.68rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            <span>
                              {c.secret_number
                                ? `بطاقة ${c.secret_number}`
                                : "بدون بطاقة"}
                            </span>
                            {c.phone && <span>· {c.phone}</span>}
                          </p>
                        </td>
                        <td
                          className="py-2.5 px-3 text-center font-mono font-bold"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {Number(c.topped || 0).toFixed(2)}
                        </td>
                        <td
                          className="py-2.5 px-3 text-center font-mono font-bold"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {Number(c.spent || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className="lux-chip font-mono"
                            style={{
                              background: "var(--accent-subtle)",
                              borderColor: "var(--border-strong)",
                              color: "var(--accent)",
                              fontSize: "0.72rem",
                              fontWeight: 900,
                            }}
                          >
                            {rem.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {c.status === "later" &&
                          c.status_month === curMonth ? (
                            <span
                              className="lux-chip"
                              style={{
                                background: "rgba(99,102,241,0.12)",
                                borderColor: "rgba(99,102,241,0.35)",
                                color: "#818cf8",
                                fontSize: "0.65rem",
                              }}
                            >
                              صرف لاحق مستنّي
                            </span>
                          ) : (
                            <span
                              className="lux-chip"
                              style={{
                                background: "rgba(245,158,11,0.10)",
                                borderColor: "rgba(245,158,11,0.30)",
                                color: "var(--warning)",
                                fontSize: "0.65rem",
                              }}
                            >
                              باقي على الكارت
                            </span>
                          )}
                        </td>
                        <td
                          className="py-2.5 px-3 text-center font-bold font-mono"
                          style={{
                            fontSize: "0.68rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {c.last_withdraw ? (
                            <span>
                              {rel ||
                                String(c.last_withdraw.date || "").slice(
                                  0,
                                  10
                                )}{" "}
                              · {fmt(c.last_withdraw.amount || 0)}
                            </span>
                          ) : (
                            <span>لسه مخرجش</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => withdrawCard(c)}
                            className="h-7 px-3 font-black text-xs mx-auto rounded-lg disabled:opacity-50"
                            style={{
                              background: "var(--gradient-accent)",
                              color: "var(--on-accent)",
                              border: "none",
                              boxShadow:
                                "0 4px 12px -6px var(--accent)",
                            }}
                          >
                            <span className="flex items-center gap-1">
                              <PackageSearch size={12} /> صرف الآن
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center"
                          style={{
                            background: "var(--accent-subtle)",
                            border: "1px dashed var(--border-strong)",
                          }}
                        >
                          <CreditCard
                            size={28}
                            strokeWidth={1.5}
                            style={{ color: "var(--text-muted)" }}
                          />
                        </div>
                        <p
                          className="font-black"
                          style={{
                            color: "var(--text-primary)",
                            fontSize: "0.9rem",
                          }}
                        >
                          {loading
                            ? "جاري التحميل..."
                            : q
                              ? "مفيش كرت بالبيانات دي"
                              : "مفيش كروت عليها رصيد"}
                        </p>
                        <p
                          className="font-bold"
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          كل كرت صرف بالكامل هيختفّي من هنا
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── «دين عليا»: مورّدين + أشخاص في جدول واحد ── */}
        {tab === "debt_on_me" && (
          <div
            className="lux-stage flex-1 min-h-0 overflow-auto lux-scroll"
            style={{ padding: "0.5rem" }}
          >
            <table className="w-full text-right">
              <thead>
                <tr
                  className="text-[11px] font-black"
                  style={{ background: "var(--gradient-header)" }}
                >
                  <th className="py-2.5 px-3" style={{ color: "var(--accent)" }}>
                    الاسم
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    النوع
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    المستحق (ج)
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    آخر حركة
                  </th>
                </tr>
              </thead>
              <tbody>
                {debtOnMeRows.length > 0 ? (
                  debtOnMeRows.map((r) => {
                    const rel = relDay(r.last);
                    const isSup = r.kind === "supplier";
                    return (
                      <tr
                        key={`${r.kind}:${r.key}`}
                        onClick={() => {
                          resetView();
                          if (isSup) {
                            setSelected(r.ref);
                            setTab("suppliers");
                          } else {
                            setTab("customers");
                          }
                        }}
                        className="text-xs cursor-pointer transition-all"
                        style={{
                          borderBottom: "1px solid var(--border)",
                          borderRight: isSup
                            ? "3px solid var(--warning)"
                            : "3px solid var(--danger)",
                        }}
                      >
                        <td className="py-2.5 px-3">
                          <p
                            className="font-black flex items-center gap-1.5"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {isSup ? (
                              <Truck
                                size={13}
                                style={{ color: "var(--text-muted)" }}
                              />
                            ) : (
                              <Users
                                size={13}
                                style={{ color: "var(--text-muted)" }}
                              />
                            )}
                            {r.name}
                          </p>
                          <p
                            className="font-mono"
                            style={{
                              fontSize: "0.68rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {r.phone ? r.phone : "من غير تليفون"}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className="lux-chip font-black"
                            style={{
                              background: isSup
                                ? "rgba(245,158,11,0.10)"
                                : "rgba(239,68,68,0.10)",
                              borderColor: isSup
                                ? "rgba(245,158,11,0.35)"
                                : "rgba(239,68,68,0.35)",
                              color: isSup
                                ? "var(--warning)"
                                : "var(--danger)",
                              fontSize: "0.68rem",
                            }}
                          >
                            {isSup ? "مورّد" : "فرد"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className="lux-chip font-mono"
                            style={{
                              background: isSup
                                ? "rgba(245,158,11,0.10)"
                                : "rgba(239,68,68,0.10)",
                              borderColor: isSup
                                ? "rgba(245,158,11,0.35)"
                                : "rgba(239,68,68,0.35)",
                              color: isSup
                                ? "var(--warning)"
                                : "var(--danger)",
                              fontSize: "0.72rem",
                              fontWeight: 900,
                            }}
                          >
                            {r.amount.toFixed(2)}
                          </span>
                        </td>
                        <td
                          className="py-2.5 px-3 text-center font-bold font-mono"
                          style={{
                            fontSize: "0.68rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {rel ? <span>{rel}</span> : <span>لسه مفيش</span>}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-10 text-center font-black"
                      style={{ color: "var(--text-muted)" }}
                    >
                      مفيش أي مديونية عليا دلوقتي
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="mt-3 flex justify-center">
              <span
                className="lux-chip font-black"
                style={{
                  background: "rgba(245,158,11,0.10)",
                  borderColor: "rgba(245,158,11,0.45)",
                  color: "var(--warning)",
                  fontSize: "0.8rem",
                }}
              >
                إجمالي دين عليا: {fmt(debtOnMeTotal)}
              </span>
            </div>
          </div>
        )}

        {tab === "suppliers" && (
          <div
            className="lux-stage flex-1 min-h-0 overflow-auto lux-scroll"
            style={{ padding: "0.5rem" }}
          >
            <table className="w-full text-right">
              <thead>
                <tr
                  className="text-[11px] font-black"
                  style={{ background: "var(--gradient-header)" }}
                >
                  <th
                    className="py-2.5 px-3"
                    style={{ color: "var(--accent)" }}
                  >
                    المورّد
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    فلوس علينا (ج)
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    مقدّمات عندنا (ج)
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    فواتير آجل
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    آخر حركة
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    إجراء
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSup.length > 0 ? (
                  filteredSup.map((s) => {
                    const debt = s.balance > 0.001;
                    const credit = s.balance < -0.001;
                    const rel = relDay(s.last_activity);
                    return (
                      <tr
                        key={s.key}
                        onClick={() => {
                          setSelected(s);
                          setMsg(null);
                        }}
                        className="text-xs cursor-pointer transition-all"
                        style={{
                          borderBottom: "1px solid var(--border)",
                          borderRight: `3px solid ${
                            debt
                              ? "var(--warning)"
                              : credit
                                ? "var(--success)"
                                : "transparent"
                          }`,
                        }}
                      >
                        <td className="py-2.5 px-3">
                          <p
                            className="font-black flex items-center gap-1.5"
                            style={{ color: "var(--text-primary)" }}
                          >
                            <Truck
                              size={13}
                              style={{ color: "var(--text-muted)" }}
                            />
                            {s.name}
                          </p>
                          <p
                            className="font-mono"
                            style={{
                              fontSize: "0.68rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {s.phone ? s.phone : "من غير تليفون"}
                            {(s.open_invoices?.length || 0) > 0 && (
                              <span
                                className="lux-chip ms-1.5"
                                style={{
                                  background: "rgba(239,68,68,0.10)",
                                  borderColor: "rgba(239,68,68,0.30)",
                                  color: "var(--danger)",
                                  fontSize: "0.62rem",
                                }}
                              >
                                {s.open_invoices.length} فاتورة
                              </span>
                            )}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {debt ? (
                            <span
                              className="lux-chip font-mono"
                              style={{
                                background: "rgba(245,158,11,0.10)",
                                borderColor: "rgba(245,158,11,0.35)",
                                color: "var(--warning)",
                                fontSize: "0.72rem",
                                fontWeight: 900,
                              }}
                            >
                              {Number(s.balance).toFixed(2)}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>
                              —
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {credit ? (
                            <span
                              className="lux-chip font-mono"
                              style={{
                                background: "rgba(16,185,129,0.10)",
                                borderColor: "rgba(16,185,129,0.35)",
                                color: "var(--success)",
                                fontSize: "0.72rem",
                                fontWeight: 900,
                              }}
                            >
                              {Number(-s.balance).toFixed(2)}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>
                              —
                            </span>
                          )}
                        </td>
                        <td
                          className="py-2.5 px-3 text-center font-mono font-bold"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {Number(s.invoice_debt || 0).toFixed(2)}
                        </td>
                        <td
                          className="py-2.5 px-3 text-center font-bold font-mono"
                          style={{
                            fontSize: "0.68rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {rel ? (
                            <span>{rel}</span>
                          ) : (
                            <span>لسه مفيش</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(s);
                              setMsg(null);
                            }}
                            className="h-7 px-3 font-black text-xs mx-auto rounded-lg flex items-center gap-1"
                            style={{
                              background: "var(--gradient-accent)",
                              color: "var(--on-accent)",
                              border: "none",
                              boxShadow: "0 4px 12px -6px var(--accent)",
                            }}
                          >
                            فتح الحساب <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center"
                          style={{
                            background: "var(--accent-subtle)",
                            border: "1px dashed var(--border-strong)",
                          }}
                        >
                          <Truck
                            size={28}
                            strokeWidth={1.5}
                            style={{ color: "var(--text-muted)" }}
                          />
                        </div>
                        <p
                          className="font-black"
                          style={{
                            color: "var(--text-primary)",
                            fontSize: "0.9rem",
                          }}
                        >
                          {loading
                            ? "جاري التحميل..."
                            : q
                              ? "مفيش مورّد بالبيانات دي"
                              : "مفيش حسابات موردين"}
                        </p>
                        <p
                          className="font-bold"
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          أول ما يكون فيه فاتورة مشتريات آجل هتظهر هنا
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── نافذة حساب المورّد ── */}
      {selected && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[70] p-4"
          style={{
            background: "rgb(13 18 25 / 0.7)",
            backdropFilter: "blur(6px)",
            direction: "rtl",
          }}
        >
          <div
            className="lux-pop flex flex-col overflow-hidden"
            style={{
              width: "55vw",
              minWidth: "560px",
              maxWidth: "1000px",
              maxHeight: "90vh",
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--lux-radius, 16px)",
              boxShadow: "0 25px 60px -15px rgba(0,0,0,0.6)",
            }}
          >
            <div
              className="px-5 py-3.5 flex items-center justify-between shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--warning), #b45309)",
              }}
            >
              <div className="min-w-0">
                <h3
                  className="font-black truncate"
                  style={{ fontSize: "0.95rem", color: "#fff" }}
                >
                  {selected.name}
                </h3>
                <p
                  className="font-bold opacity-80"
                  style={{ fontSize: "0.68rem", color: "#fff" }}
                >
                  {selected.phone ? selected.phone : "حساب مورّد"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setMsg(null);
                }}
                className="cursor-pointer hover:bg-white/20 rounded-lg p-1.5 transition-colors shrink-0"
                style={{ color: "#fff" }}
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 overflow-auto flex-1 min-h-0 space-y-3 lux-scroll">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setLedgerModal({
                      types: ["opening_debit", "opening_credit"],
                      type: "opening_debit",
                      amount: "",
                      note: "",
                      source: "main_safe",
                    });
                    setMsg(null);
                  }}
                  className="h-8 px-3 text-[11px] font-black flex items-center gap-1.5 cursor-pointer rounded-lg"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-strong)",
                  }}
                >
                  <Plus size={13} /> رصيد افتتاحي
                </button>
                {selected.balance > 0.001 && (
                  <button
                    type="button"
                    onClick={() => {
                      setLedgerModal({
                        types: ["payment"],
                        type: "payment",
                        amount: String(
                          Number(selected.balance).toFixed(2)
                        ),
                        note: "",
                        source: "cash_register",
                      });
                      setMsg(null);
                    }}
                    className="h-8 px-3 text-[11px] font-black flex items-center gap-1.5 cursor-pointer rounded-lg"
                    style={{
                      background: "var(--gradient-accent)",
                      color: "var(--on-accent)",
                      border: "none",
                      boxShadow: "0 4px 12px -6px var(--accent)",
                    }}
                  >
                    <Banknote size={13} /> سدّد للمورّد
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div
                  className="lux-glass px-2 py-2 text-center"
                  style={{ borderRadius: "var(--lux-radius-sm, 10px)" }}
                >
                  <p
                    className="font-black"
                    style={{
                      fontSize: "0.65rem",
                      color:
                        selected.balance > 0.001
                          ? "var(--warning)"
                          : selected.balance < -0.001
                            ? "var(--success)"
                            : "var(--text-secondary)",
                    }}
                  >
                    {selected.balance > 0.001
                      ? "علينا"
                      : selected.balance < -0.001
                        ? "مقدّم عندنا"
                        : "الرصيد"}
                  </p>
                  <p
                    className="font-black font-mono"
                    style={{
                      color:
                        selected.balance > 0.001
                          ? "var(--warning)"
                          : selected.balance < -0.001
                            ? "var(--success)"
                            : "var(--text-secondary)",
                      fontSize: "1rem",
                    }}
                  >
                    {fmt(Math.abs(selected.balance))}
                  </p>
                </div>
                <div
                  className="lux-glass px-2 py-2 text-center"
                  style={{ borderRadius: "var(--lux-radius-sm, 10px)" }}
                >
                  <p
                    className="font-black"
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    فواتير آجل
                  </p>
                  <p
                    className="font-black font-mono"
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "1rem",
                    }}
                  >
                    {fmt(selected.invoice_debt)}
                  </p>
                </div>
              </div>

              {selected.open_invoices?.length ? (
              <div>
                <p
                  className="font-black mb-2 flex items-center gap-1.5"
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-primary)",
                  }}
                >
                  <ShoppingBag
                    size={14}
                    style={{ color: "var(--warning)" }}
                  />
                  فواتير المشتريات الآجلة (
                  {selected.open_invoices?.length || 0})
                </p>
                {selected.open_invoices?.length ? (
                  <div
                    className="divide-y rounded-xl overflow-hidden"
                    style={{
                      border: "1px solid var(--border)",
                      borderColor: "var(--border)",
                    }}
                  >
                    {selected.open_invoices.map((inv: any) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] transition-colors"
                        style={{
                          background: "var(--bg-input)",
                          borderColor: "var(--border)",
                        }}
                      >
                        <div className="min-w-0">
                          <p
                            className="font-bold font-mono"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {inv.invoice_number}
                          </p>
                          <p
                            className="font-mono"
                            style={{
                              fontSize: "0.68rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {String(inv.date || "").slice(0, 10)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="font-black font-mono"
                            style={{
                              color:
                                inv.remaining > 0
                                  ? "var(--warning)"
                                  : "var(--success)",
                            }}
                          >
                            {fmt(inv.remaining)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCollect({
                                inv,
                                amount: String(
                                  Number(inv.remaining || 0).toFixed(2)
                                ),
                                source: "cash_register",
                              });
                              setMsg(null);
                            }}
                            className="h-6 px-3 font-bold rounded-md cursor-pointer"
                            style={{
                              background: "var(--success)",
                              color: "#fff",
                              border: "none",
                              fontSize: "0.7rem",
                            }}
                          >
                            سدّد
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              ) : null}

              <div>
                <p
                  className="font-black mb-2 flex items-center gap-1.5"
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-primary)",
                  }}
                >
                  <Banknote
                    size={14}
                    style={{ color: "var(--success)" }}
                  />
                  دفتر المورّد ({selected.ledger?.length || 0})
                </p>
                {selected.ledger?.length ? (
                  <div
                    className="lux-scroll max-h-44 overflow-auto rounded-xl"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    {selected.ledger.map((e: any) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-[11px]"
                        style={{
                          background: "var(--bg-input)",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <div className="min-w-0">
                          <p
                            className="font-bold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {LEDGER_LABEL[e.type] || e.type}
                          </p>
                          <p
                            style={{
                              fontSize: "0.68rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {String(e.created_at || "").slice(0, 10)} ·{" "}
                            {e.created_by || "-"}
                            {e.note ? ` · ${e.note}` : ""}
                          </p>
                        </div>
                        <span
                          className="font-black font-mono shrink-0"
                          style={{
                            color:
                              e.type === "opening_debit"
                                ? "var(--warning)"
                                : "var(--success)",
                          }}
                        >
                          {e.type === "opening_debit" ? "+" : "-"}
                          {Number(e.amount || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p
                    className="font-bold text-center rounded-xl px-3 py-3"
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      border: "1px dashed var(--border-strong)",
                      background: "var(--bg-input)",
                    }}
                  >
                    مفيش حركات دفتر
                  </p>
                )}
              </div>

              {msg && (
                <p
                  className="font-black px-3 py-2 rounded-xl text-[11px]"
                  style={{
                    background:
                      msg.kind === "ok"
                        ? "rgba(16,185,129,0.08)"
                        : "rgba(239,68,68,0.08)",
                    border: `1px solid ${
                      msg.kind === "ok"
                        ? "rgba(16,185,129,0.3)"
                        : "rgba(239,68,68,0.3)"
                    }`,
                    color:
                      msg.kind === "ok"
                        ? "var(--success)"
                        : "var(--danger)",
                  }}
                >
                  {msg.text}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── نافذة سداد فاتورة مشتريات ── */}
      {collect && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[71] p-4"
          style={{
            background: "rgb(13 18 25 / 0.75)",
            backdropFilter: "blur(8px)",
            direction: "rtl",
          }}
        >
          <div
            className="lux-pop overflow-hidden"
            style={{
              width: "50vw",
              minWidth: "440px",
              maxWidth: "820px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--lux-radius, 16px)",
              boxShadow: "0 25px 60px -15px rgba(0,0,0,0.6)",
            }}
          >
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{
                background:
                  "linear-gradient(135deg, var(--success), #065f46)",
              }}
            >
              <h3
                className="font-black"
                style={{ fontSize: "0.9rem", color: "#fff" }}
              >
                سدّد فاتورة مشتريات
              </h3>
              <button
                type="button"
                onClick={() => {
                  setCollect(null);
                  setMsg(null);
                }}
                className="cursor-pointer hover:bg-white/20 rounded-lg p-1 transition-colors"
                style={{ color: "#fff" }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p
                className="font-bold"
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                }}
              >
                فاتورة{" "}
                <span
                  className="font-mono font-black"
                  style={{ color: "var(--text-primary)" }}
                >
                  {collect.inv.invoice_number}
                </span>{" "}
                — المتبقي{" "}
                <span
                  className="font-black"
                  style={{ color: "var(--warning)" }}
                >
                  {fmt(collect.inv.remaining)}
                </span>
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="block font-black mb-1.5"
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    المبلغ المدفوع (ج)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={collect.amount}
                    onChange={(e) =>
                      setCollect({ ...collect, amount: e.target.value })
                    }
                    className="lux-select w-full text-center"
                    style={{ fontSize: "1rem", fontWeight: 900 }}
                    autoFocus
                  />
                </div>
                <div>
                  <label
                    className="block font-black mb-1.5"
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    مصدر الفلوس
                  </label>
                  <div className="lux-pills" style={{ padding: "0.25rem" }}>
                    {[
                      { id: "cash_register", label: "صندوق الكاشير" },
                      { id: "main_safe", label: "الخزينة الرئيسية" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        data-active={
                          collect.source === s.id ? "true" : "false"
                        }
                        onClick={() =>
                          setCollect({ ...collect, source: s.id })
                        }
                        className="lux-pill flex-1"
                        style={{ justifyContent: "center" }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {msg && (
                <p
                  className="font-black px-3 py-2 rounded-xl text-[11px]"
                  style={{
                    background:
                      msg.kind === "ok"
                        ? "rgba(16,185,129,0.08)"
                        : "rgba(239,68,68,0.08)",
                    border: `1px solid ${
                      msg.kind === "ok"
                        ? "rgba(16,185,129,0.3)"
                        : "rgba(239,68,68,0.3)"
                    }`,
                    color:
                      msg.kind === "ok"
                        ? "var(--success)"
                        : "var(--danger)",
                  }}
                >
                  {msg.text}
                </p>
              )}
            </div>

            <div
              className="p-3 flex gap-2"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <button
                type="button"
                onClick={submitCollect}
                disabled={busy}
                className="flex-1 h-9 font-black text-xs cursor-pointer rounded-xl disabled:opacity-50"
                style={{
                  background: "var(--gradient-accent)",
                  color: "var(--on-accent)",
                  border: "none",
                  boxShadow: "0 6px 16px -8px var(--accent)",
                }}
              >
                {busy ? "جاري التسجيل..." : "تأكيد السداد"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCollect(null);
                  setMsg(null);
                }}
                className="h-9 px-4 font-black text-xs cursor-pointer rounded-xl"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── نافذة دفتر المورّد ── */}
      {ledgerModal && selected && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[72] p-4"
          style={{
            background: "rgb(13 18 25 / 0.75)",
            backdropFilter: "blur(8px)",
            direction: "rtl",
          }}
        >
          <div
            className="lux-pop overflow-hidden"
            style={{
              width: "50vw",
              minWidth: "440px",
              maxWidth: "820px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--lux-radius, 16px)",
              boxShadow: "0 25px 60px -15px rgba(0,0,0,0.6)",
            }}
          >
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{
                background:
                  "linear-gradient(135deg, var(--accent), var(--accent-hover))",
              }}
            >
              <h3
                className="font-black"
                style={{ fontSize: "0.9rem", color: "var(--on-accent)" }}
              >
                {ledgerModal.type === "payment"
                  ? `سداد للمورّد ${selected.name}`
                  : `رصيد افتتاحي — ${selected.name}`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setLedgerModal(null);
                  setMsg(null);
                }}
                className="cursor-pointer hover:bg-white/20 rounded-lg p-1 transition-colors"
                style={{ color: "var(--on-accent)" }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {ledgerModal.types.length > 1 && (
                <div className="lux-pills">
                  {ledgerModal.types.map((t) => (
                    <button
                      key={t}
                      type="button"
                      data-active={
                        ledgerModal.type === t ? "true" : "false"
                      }
                      onClick={() =>
                        setLedgerModal({ ...ledgerModal, type: t })
                      }
                      className="lux-pill flex-1"
                      style={{ justifyContent: "center" }}
                    >
                      {t === "opening_debit"
                        ? "فلوس علينا للمورّد"
                        : "مقدّم عندنا منه"}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label
                  className="lux-label"
                  style={{ fontSize: "0.75rem" }}
                >
                  المبلغ (ج)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ledgerModal.amount}
                  onChange={(e) =>
                    setLedgerModal({
                      ...ledgerModal,
                      amount: e.target.value,
                    })
                  }
                  className="lux-select w-full text-center"
                  style={{ fontSize: "1rem", fontWeight: 900 }}
                  autoFocus
                />
              </div>

              <div>
                <label
                  className="lux-label"
                  style={{ fontSize: "0.75rem" }}
                >
                  ملاحظة
                </label>
                <input
                  type="text"
                  value={ledgerModal.note}
                  onChange={(e) =>
                    setLedgerModal({
                      ...ledgerModal,
                      note: e.target.value,
                    })
                  }
                  placeholder="سبب الحركة..."
                  className="lux-select w-full"
                  style={{ fontSize: "0.8rem" }}
                />
              </div>

              {ledgerModal.type === "payment" && (
                <div>
                  <label
                    className="block font-black mb-1.5"
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    مصدر الفلوس
                  </label>
                  <div className="lux-pills" style={{ padding: "0.25rem" }}>
                    {[
                      { id: "cash_register", label: "صندوق الكاشير" },
                      { id: "main_safe", label: "الخزينة الرئيسية" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        data-active={
                          ledgerModal.source === s.id ? "true" : "false"
                        }
                        onClick={() =>
                          setLedgerModal({ ...ledgerModal, source: s.id })
                        }
                        className="lux-pill flex-1"
                        style={{ justifyContent: "center" }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p
                className="rounded-xl px-3 py-2 font-bold"
                style={{
                  fontSize: "0.68rem",
                  color: "var(--text-muted)",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                }}
              >
                {ledgerModal.type === "payment"
                  ? `السداد بيخصم من ${
                      ledgerModal.source === "cash_register"
                        ? "صندوق الكاشير"
                        : "الخزينة الرئيسية"
                    } ويتسجّل في حركات الخزنة.`
                  : "الرصيد الافتتاحي بس بيتسجّل في دفتر المورّد — من غير حركة خزنة."}
              </p>

              {msg && (
                <p
                  className="font-black px-3 py-2 rounded-xl text-[11px]"
                  style={{
                    background:
                      msg.kind === "ok"
                        ? "rgba(16,185,129,0.08)"
                        : "rgba(239,68,68,0.08)",
                    border: `1px solid ${
                      msg.kind === "ok"
                        ? "rgba(16,185,129,0.3)"
                        : "rgba(239,68,68,0.3)"
                    }`,
                    color:
                      msg.kind === "ok"
                        ? "var(--success)"
                        : "var(--danger)",
                  }}
                >
                  {msg.text}
                </p>
              )}
            </div>

            <div
              className="p-3 flex gap-2"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <button
                type="button"
                onClick={submitLedger}
                disabled={busy}
                className="flex-1 h-9 font-black text-xs cursor-pointer rounded-xl disabled:opacity-50"
                style={{
                  background: "var(--gradient-accent)",
                  color: "var(--on-accent)",
                  border: "none",
                  boxShadow: "0 6px 16px -8px var(--accent)",
                }}
              >
                {busy ? "جاري التسجيل..." : "تأكيد"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLedgerModal(null);
                  setMsg(null);
                }}
                className="h-9 px-4 font-black text-xs cursor-pointer rounded-xl"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── مودال عملاء الشهر ── */}
      {custModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[60] p-4"
          style={{
            background: "rgb(13 18 25 / 0.7)",
            backdropFilter: "blur(6px)",
            direction: "rtl",
          }}
        >
          <div
            className="lux-pop w-full max-w-4xl overflow-y-auto lux-scroll"
            style={{
              maxHeight: "85vh",
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--lux-radius, 16px)",
              boxShadow: "0 25px 60px -15px rgba(0,0,0,0.6)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5 sticky top-0 z-10"
              style={{
                background: "var(--gradient-header)",
                borderBottom: "1px solid var(--border-strong)",
                borderRadius:
                  "var(--lux-radius, 16px) var(--lux-radius, 16px) 0 0",
              }}
            >
              <h3
                className="font-black flex items-center gap-2"
                style={{ fontSize: "0.9rem", color: "var(--accent)" }}
              >
                {custModal === "withdrawn"
                  ? "عملاء تم الصرف"
                  : custModal === "partial"
                    ? "بطاقات صرف جزئي"
                    : "لم تصرف بعد"}
                <span
                  className="lux-chip font-mono"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {curMonth}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setCustModal(null)}
                className="cursor-pointer hover:scale-110 transition-transform"
                style={{ color: "var(--text-secondary)" }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              {(() => {
                const monthList = cards.filter(
                  (c: any) => c.status_month === curMonth
                );
                const baseList = monthList.filter((c: any) =>
                  custModal === "partial"
                    ? c.status === "later" &&
                      Number(c.spent_month || 0) > 0.001 &&
                      Number(c.remaining || 0) > 0.001
                    : custModal === "later"
                      ? c.status === "later" &&
                        Number(c.spent_month || 0) <= 0.001
                      : c.status === custModal
                );
                const cq = custSearch.toLowerCase().trim();
                const list = !cq
                  ? baseList
                  : baseList.filter(
                      (c: any) =>
                        (c.name || "").toLowerCase().includes(cq) ||
                        (c.secret_number || "").toLowerCase().includes(cq) ||
                        (c.phone || "").toLowerCase().includes(cq)
                    );
                const bar = (
                  <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
                    <div
                      className="lux-chip flex items-center gap-2"
                      style={{ fontSize: "0.75rem" }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>
                        تاريخ التقرير:
                      </span>
                      <span
                        className="font-mono font-black"
                        style={{ color: "var(--accent)" }}
                      >
                        {curMonth}
                      </span>
                    </div>
                    <div className="relative flex-1 min-w-[140px] max-w-[220px]">
                      <input
                        type="text"
                        value={custSearch}
                        onChange={(e) => setCustSearch(e.target.value)}
                        placeholder="بحث سريع..."
                        className="lux-select w-full"
                        style={{
                          padding: "0.4rem 2rem 0.4rem 0.6rem",
                          fontSize: "0.75rem",
                        }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Search size={13} strokeWidth={2} />
                      </div>
                    </div>
                    <UnifiedPrintButton
                      printableId="debts-cust-printable"
                      thermalId="debts-cust-printable"
                      title="طباعة"
                      printLayout="wide"
                    />
                  </div>
                );
                if (baseList.length === 0)
                  return (
                    <div
                      className="p-8 text-center font-bold"
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "0.8rem",
                      }}
                    >
                      لا يوجد عملاء في هذا القسم
                    </div>
                  );
                if (list.length === 0)
                  return (
                    <>
                      {bar}
                      <div
                        className="p-8 text-center font-bold"
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.8rem",
                        }}
                      >
                        لا توجد نتائج مطابقة للبحث
                      </div>
                    </>
                  );
                // المتبقي الحقيقي للزبون = متبقي الكارت + نقاط الخبز المتبقية (ملاحظة الكابتن 41)
                const remainingOf = (c: any) =>
                  Number(c.remaining || 0) + Number(c.bread_points || 0);
                // تفصيل الباقي (طلب 57): كارت كذا · نقاط كذا · مجموع كذا · مأخوذ كذا · الباقي كذا
                const breakdownOf = (c: any) => {
                  const cardT = Number(c.topped ?? c.card_value ?? 0);
                  const ptsT = Number(c.bread_points ?? 0) + Number(c.bread_spent ?? 0);
                  const taken = Number(c.spent ?? 0) + Number(c.bread_spent ?? 0);
                  return `كارت ${cardT.toFixed(2)} + نقاط ${ptsT.toFixed(2)} = ${(cardT + ptsT).toFixed(2)} · مأخوذ ${taken.toFixed(2)} · الباقي ${remainingOf(c).toFixed(2)}`;
                };
                const sumCard = list.reduce(
                  (s: number, c: any) => s + Number(c.card_value || 0),
                  0
                );
                const sumBread = list.reduce(
                  (s: number, c: any) =>
                    s + Number(c.bread_spent ?? c.bread_points ?? 0),
                  0
                );
                return (
                  <>
                    {bar}
                    <div id="debts-cust-printable">
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div
                          className="lux-glass overflow-hidden"
                          style={{
                            borderRadius: "var(--lux-radius, 16px)",
                          }}
                        >
                          <div className="px-4 py-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{
                                  background:
                                    "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                                }}
                              >
                                <Users
                                  size={16}
                                  style={{ color: "var(--on-accent)" }}
                                />
                              </div>
                              <div className="text-right">
                                <div
                                  className="font-black"
                                  style={{
                                    fontSize: "0.68rem",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  إجمالي العملاء
                                </div>
                                <div
                                  className="font-bold"
                                  style={{
                                    fontSize: "0.65rem",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  {curMonth}
                                </div>
                              </div>
                            </div>
                            <div className="text-left">
                              <div
                                className="font-black font-mono leading-none"
                                style={{
                                  fontSize: "1.5rem",
                                  color: "var(--text-primary)",
                                }}
                              >
                                {list.length}
                              </div>
                              <div
                                className="font-bold"
                                style={{
                                  fontSize: "0.65rem",
                                  color: "var(--text-muted)",
                                }}
                              >
                                عميل
                              </div>
                            </div>
                          </div>
                        </div>
                        <div
                          className="lux-glass overflow-hidden"
                          style={{
                            borderRadius: "var(--lux-radius, 16px)",
                            borderRight: "4px solid var(--success)",
                          }}
                        >
                          <div className="px-4 py-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{
                                  background: "rgba(16,185,129,0.12)",
                                }}
                              >
                                <Banknote
                                  size={16}
                                  style={{ color: "var(--success)" }}
                                />
                              </div>
                              <div className="text-right">
                                <div
                                  className="font-black"
                                  style={{
                                    fontSize: "0.68rem",
                                    color: "var(--success)",
                                  }}
                                >
                                  إجمالي الدعم المنصرف
                                </div>
                                <div
                                  className="font-bold"
                                  style={{
                                    fontSize: "0.65rem",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  مبلغ البطاقات
                                </div>
                              </div>
                            </div>
                            <div className="text-left">
                              <div
                                className="font-black font-mono leading-none"
                                style={{
                                  fontSize: "1.5rem",
                                  color: "var(--success)",
                                }}
                              >
                                {sumCard.toFixed(2)}
                              </div>
                              <div
                                className="font-bold"
                                style={{
                                  fontSize: "0.65rem",
                                  color: "var(--success)",
                                }}
                              >
                                ج.م
                              </div>
                            </div>
                          </div>
                        </div>
                        <div
                          className="lux-glass overflow-hidden"
                          style={{
                            borderRadius: "var(--lux-radius, 16px)",
                            borderRight: "4px solid var(--warning)",
                          }}
                        >
                          <div className="px-4 py-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{
                                  background: "rgba(245,158,11,0.12)",
                                }}
                              >
                                <Coins
                                  size={16}
                                  style={{ color: "var(--warning)" }}
                                />
                              </div>
                              <div className="text-right">
                                <div
                                  className="font-black"
                                  style={{
                                    fontSize: "0.68rem",
                                    color: "var(--warning)",
                                  }}
                                >
                                  إجمالي نقاط الخبز المنصرفه
                                </div>
                                <div
                                  className="font-bold"
                                  style={{
                                    fontSize: "0.65rem",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  خلال الفترة
                                </div>
                              </div>
                            </div>
                            <div className="text-left">
                              <div
                                className="font-black font-mono leading-none"
                                style={{
                                  fontSize: "1.5rem",
                                  color: "var(--warning)",
                                }}
                              >
                                {sumBread.toFixed(2)}
                              </div>
                              <div
                                className="font-bold"
                                style={{
                                  fontSize: "0.65rem",
                                  color: "var(--warning)",
                                }}
                              >
                                ج.م
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        className="overflow-hidden"
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: "var(--lux-radius-sm, 10px)",
                        }}
                      >
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr
                              style={{
                                background: "var(--gradient-header)",
                              }}
                            >
                              {[
                                "#",
                                "اسم العميل",
                                "الرقم السري",
                                "التليفون",
                                "مبلغ البطاقة",
                                "المتبقي",
                                "نقاط الخبز المنصرفه",
                                "إجراءات",
                              ].map((h, i) => (
                                <th
                                  key={h}
                                  className="py-2.5 px-3 font-black"
                                  style={{
                                    color: "var(--accent)",
                                    borderBottom:
                                      "2px solid var(--border-strong)",
                                    textAlign: i >= 4 && i <= 6 ? "center" : i === 7 ? "center" : "right",
                                  }}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {paginate(list, pageCust).map(
                              (c: any, i: number) => (
                                <tr
                                  key={c.id}
                                  style={{
                                    background:
                                      i % 2 === 0
                                        ? "var(--bg-card)"
                                        : "var(--bg-input)",
                                    borderBottom:
                                      "1px solid var(--border)",
                                  }}
                                >
                                  <td
                                    className="py-2 px-3 font-mono"
                                    style={{
                                      fontSize: "0.68rem",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    {(Math.min(
                                      pageCust,
                                      Math.max(
                                        1,
                                        Math.ceil(list.length / PAGE_R)
                                      )
                                    ) -
                                      1) *
                                      PAGE_R +
                                    i +
                                    1}
                                  </td>
                                  <td
                                    className="py-2 px-3 font-bold"
                                    style={{ color: "var(--text-primary)" }}
                                  >
                                    {c.name}
                                    <div
                                      className="font-mono font-normal"
                                      style={{
                                        fontSize: "0.62rem",
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      {breakdownOf(c)}
                                    </div>
                                  </td>
                                  <td
                                    className="py-2 px-3 font-mono"
                                    style={{ color: "var(--text-secondary)" }}
                                  >
                                    {c.secret_number}
                                  </td>
                                  <td
                                    className="py-2 px-3 font-mono"
                                    style={{ color: "var(--text-secondary)" }}
                                  >
                                    {c.phone || "—"}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span
                                      className="lux-chip font-mono"
                                      style={{
                                        background:
                                          "rgba(16,185,129,0.10)",
                                        borderColor:
                                          "rgba(16,185,129,0.35)",
                                        color: "var(--success)",
                                      }}
                                    >
                                      {c.card_value} ج.م
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span
                                      className="lux-chip font-mono"
                                      style={{
                                        background:
                                          remainingOf(c) >
                                          0.001
                                            ? "var(--accent-subtle)"
                                            : "var(--bg-input)",
                                        borderColor:
                                          remainingOf(c) >
                                          0.001
                                            ? "var(--border-strong)"
                                            : "var(--border)",
                                        color:
                                          remainingOf(c) >
                                          0.001
                                            ? "var(--accent)"
                                            : "var(--text-muted)",
                                      }}
                                    >
                                      {remainingOf(c).toFixed(2)}{" "}
                                      ج.م
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span
                                      className="lux-chip font-mono"
                                      style={{
                                        background:
                                          "rgba(245,158,11,0.10)",
                                        borderColor:
                                          "rgba(245,158,11,0.35)",
                                        color: "var(--warning)",
                                      }}
                                    >
                                      {Number(
                                        c.bread_spent ?? c.bread_points ?? 0
                                      ).toFixed(2)}{" "}
                                      ج.م
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      {c.status === "later" &&
                                        c.status_month === curMonth && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              withdrawCard(c)
                                            }
                                            disabled={busy}
                                            className="h-6 px-2.5 font-bold rounded-md disabled:opacity-50 cursor-pointer"
                                            style={{
                                              background:
                                                "var(--success)",
                                              color: "#fff",
                                              border: "none",
                                              fontSize: "0.65rem",
                                            }}
                                            title="صرف الآن"
                                          >
                                            {busy
                                              ? "..."
                                              : "صرف الآن"}
                                          </button>
                                        )}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openRepHistory(c)
                                        }
                                        className="w-6 h-6 rounded-md cursor-pointer text-white font-bold"
                                        style={{
                                          background: "#8e44ad",
                                          border: "none",
                                          fontSize: "0.65rem",
                                        }}
                                        title="السجل"
                                      >
                                        ▤
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openRepEdit(c)}
                                        className="w-6 h-6 rounded-md cursor-pointer text-white font-bold"
                                        style={{
                                          background: "#2563eb",
                                          border: "none",
                                          fontSize: "0.65rem",
                                        }}
                                        title="تعديل"
                                      >
                                        ✎
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteRepCustomer(c.id)
                                        }
                                        className="w-6 h-6 rounded-md cursor-pointer text-white font-bold"
                                        style={{
                                          background: "#e11d48",
                                          border: "none",
                                          fontSize: "0.65rem",
                                        }}
                                        title="حذف"
                                      >
                                        🗑
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                      {renderPager(list.length, pageCust, setPageCust)}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── مودال دين ليا (طلب 66) ── */}
      {debtModal === "to_me" && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[60] p-4"
          style={{
            background: "rgb(13 18 25 / 0.7)",
            backdropFilter: "blur(6px)",
            direction: "rtl",
          }}
        >
          <div
            className="lux-pop w-full max-w-4xl overflow-y-auto lux-scroll"
            style={{
              maxHeight: "85vh",
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--lux-radius, 16px)",
              boxShadow: "0 25px 60px -15px rgba(0,0,0,0.6)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5 sticky top-0 z-10"
              style={{
                background: "var(--gradient-header)",
                borderBottom: "1px solid var(--border-strong)",
                borderRadius:
                  "var(--lux-radius, 16px) var(--lux-radius, 16px) 0 0",
              }}
            >
              <h3
                className="font-black flex items-center gap-2"
                style={{ fontSize: "0.9rem", color: "var(--danger)" }}
              >
                <Users size={18} /> دين ليا — مستحقاتي عند الزبائن
              </h3>
              <button
                type="button"
                onClick={() => setDebtModal(null)}
                className="cursor-pointer hover:scale-110 transition-transform"
                style={{ color: "var(--text-secondary)" }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
                <div className="relative flex-1 min-w-[140px] max-w-[220px]">
                  <input
                    type="text"
                    value={debtSearch}
                    onChange={(e) => setDebtSearch(e.target.value)}
                    placeholder="بحث سريع..."
                    className="lux-select w-full"
                    style={{
                      padding: "0.4rem 2rem 0.4rem 0.6rem",
                      fontSize: "0.75rem",
                    }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Search size={13} strokeWidth={2} />
                  </div>
                </div>
                <UnifiedPrintButton
                  printableId="debts-tome-printable"
                  thermalId="debts-tome-printable"
                  title="طباعة"
                  printLayout="wide"
                />
              </div>
              {debtorsRows.length === 0 ? (
                <div
                  className="p-8 text-center font-bold"
                  style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}
                >
                  لا يوجد زبائن مدينين
                </div>
              ) : (
                <>
                  <div id="debts-tome-printable">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div
                        className="lux-glass overflow-hidden"
                        style={{
                          borderRadius: "var(--lux-radius, 16px)",
                          borderRight: "4px solid var(--danger)",
                        }}
                      >
                        <div className="px-4 py-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{ background: "rgba(239,68,68,0.12)" }}
                            >
                              <Banknote
                                size={16}
                                style={{ color: "var(--danger)" }}
                              />
                            </div>
                            <div className="text-right">
                              <div
                                className="font-black"
                                style={{
                                  fontSize: "0.68rem",
                                  color: "var(--danger)",
                                }}
                              >
                                إجمالي دين ليا
                              </div>
                              <div
                                className="font-bold"
                                style={{
                                  fontSize: "0.65rem",
                                  color: "var(--text-muted)",
                                }}
                              >
                                مستحقات عند الزبائن
                              </div>
                            </div>
                          </div>
                          <div className="text-left">
                            <div
                              className="font-black font-mono leading-none"
                              style={{
                                fontSize: "1.5rem",
                                color: "var(--danger)",
                              }}
                            >
                              {debtorsRows
                                .reduce((s, r) => s + r.amount, 0)
                                .toFixed(2)}
                            </div>
                            <div
                              className="font-bold"
                              style={{
                                fontSize: "0.65rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              ج.م
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        className="lux-glass overflow-hidden"
                        style={{
                          borderRadius: "var(--lux-radius, 16px)",
                        }}
                      >
                        <div className="px-4 py-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{
                                background:
                                  "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                              }}
                            >
                              <Users
                                size={16}
                                style={{ color: "var(--on-accent)" }}
                              />
                            </div>
                            <div className="text-right">
                              <div
                                className="font-black"
                                style={{
                                  fontSize: "0.68rem",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                عدد المدينين
                              </div>
                              <div
                                className="font-bold"
                                style={{
                                  fontSize: "0.65rem",
                                  color: "var(--text-muted)",
                                }}
                              >
                                زبون عليه فلوس
                              </div>
                            </div>
                          </div>
                          <div className="text-left">
                            <div
                              className="font-black font-mono leading-none"
                              style={{
                                fontSize: "1.5rem",
                                color: "var(--text-primary)",
                              }}
                            >
                              {debtorsRows.length}
                            </div>
                            <div
                              className="font-bold"
                              style={{
                                fontSize: "0.65rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              زبون
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      className="lux-glass overflow-hidden"
                      style={{ borderRadius: "var(--lux-radius, 16px)" }}
                    >
                      <table className="w-full text-right">
                        <thead>
                          <tr
                            className="text-[11px] font-black"
                            style={{
                              background: "var(--gradient-header)",
                            }}
                          >
                            <th
                              className="py-2.5 px-3"
                              style={{ color: "var(--accent)" }}
                            >
                              #
                            </th>
                            <th
                              className="py-2.5 px-3"
                              style={{ color: "var(--accent)" }}
                            >
                              الاسم
                            </th>
                            <th
                              className="py-2.5 px-3 text-center"
                              style={{ color: "var(--accent)" }}
                            >
                              فواتير آجل
                            </th>
                            <th
                              className="py-2.5 px-3 text-center"
                              style={{ color: "var(--accent)" }}
                            >
                              المستحق (ج)
                            </th>
                            <th
                              className="py-2.5 px-3 text-center"
                              style={{ color: "var(--accent)" }}
                            >
                              آخر حركة
                            </th>
                            <th
                              className="py-2.5 px-3 text-center"
                              style={{ color: "var(--accent)" }}
                            >
                              إجراء
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginate(debtorsRows, pageDebt).map(
                            (r: any, i: number) => {
                              const rel = relDay(r.last);
                              return (
                                <tr
                                  key={r.key}
                                  className="text-xs"
                                  style={{
                                    borderBottom: "1px solid var(--border)",
                                    borderRight:
                                      "3px solid var(--danger)",
                                  }}
                                >
                                  <td className="py-2 px-3 font-mono text-[var(--text-muted)]">
                                    {(Math.min(
                                      pageDebt,
                                      Math.max(
                                        1,
                                        Math.ceil(
                                          debtorsRows.length / PAGE_R
                                        )
                                      )
                                    ) -
                                      1) *
                                      PAGE_R +
                                      i +
                                      1}
                                  </td>
                                  <td className="py-2 px-3">
                                    <p
                                      className="font-black"
                                      style={{
                                        color: "var(--text-primary)",
                                      }}
                                    >
                                      {r.name}
                                    </p>
                                    <p
                                      className="font-mono"
                                      style={{
                                        fontSize: "0.68rem",
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      {r.phone ? r.phone : "من غير تليفون"}
                                    </p>
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono">
                                    {r.invoices.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span
                                      className="lux-chip font-mono"
                                      style={{
                                        background:
                                          "rgba(239,68,68,0.10)",
                                        borderColor:
                                          "rgba(239,68,68,0.35)",
                                        color: "var(--danger)",
                                        fontWeight: 900,
                                      }}
                                    >
                                      {r.amount.toFixed(2)} ج.م
                                    </span>
                                  </td>
                                  <td
                                    className="py-2 px-3 text-center font-bold font-mono"
                                    style={{
                                      fontSize: "0.68rem",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    {rel ||
                                      String(r.last || "").slice(0, 10) ||
                                      "—"}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelected(r.ref);
                                        setMsg(null);
                                      }}
                                      className="h-6 px-2.5 font-bold rounded-md cursor-pointer"
                                      style={{
                                        background: "#1f6feb",
                                        color: "#fff",
                                        border: "none",
                                        fontSize: "0.65rem",
                                      }}
                                    >
                                      فتح الحساب ←
                                    </button>
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>
                    {renderPager(debtorsRows.length, pageDebt, setPageDebt)}
                    <div className="no-print flex justify-center mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDebtModal(null);
                          setTab("customers");
                          setAccSection("debt");
                        }}
                        className="h-8 px-4 rounded-lg border text-xs font-black cursor-pointer"
                        style={{
                          background: "var(--bg-input)",
                          borderColor: "var(--border-strong)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        عرض في الجدول الرئيسي
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── مودال دين عليا (طلب 66) ── */}
      {debtModal === "on_me" && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[60] p-4"
          style={{
            background: "rgb(13 18 25 / 0.7)",
            backdropFilter: "blur(6px)",
            direction: "rtl",
          }}
        >
          <div
            className="lux-pop w-full max-w-4xl overflow-y-auto lux-scroll"
            style={{
              maxHeight: "85vh",
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--lux-radius, 16px)",
              boxShadow: "0 25px 60px -15px rgba(0,0,0,0.6)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5 sticky top-0 z-10"
              style={{
                background: "var(--gradient-header)",
                borderBottom: "1px solid var(--border-strong)",
                borderRadius:
                  "var(--lux-radius, 16px) var(--lux-radius, 16px) 0 0",
              }}
            >
              <h3
                className="font-black flex items-center gap-2"
                style={{ fontSize: "0.9rem", color: "var(--warning)" }}
              >
                <Truck size={18} /> دين عليا — اللي أنا مديون ليهم
              </h3>
              <button
                type="button"
                onClick={() => setDebtModal(null)}
                className="cursor-pointer hover:scale-110 transition-transform"
                style={{ color: "var(--text-secondary)" }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
                <div className="relative flex-1 min-w-[140px] max-w-[220px]">
                  <input
                    type="text"
                    value={debtSearch}
                    onChange={(e) => setDebtSearch(e.target.value)}
                    placeholder="بحث سريع..."
                    className="lux-select w-full"
                    style={{
                      padding: "0.4rem 2rem 0.4rem 0.6rem",
                      fontSize: "0.75rem",
                    }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Search size={13} strokeWidth={2} />
                  </div>
                </div>
                <UnifiedPrintButton
                  printableId="debts-onme-printable"
                  thermalId="debts-onme-printable"
                  title="طباعة"
                  printLayout="wide"
                />
              </div>
              {onMeRows.length === 0 ? (
                <div
                  className="p-8 text-center font-bold"
                  style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}
                >
                  لا يوجد مستحقات عليك — رصيدك نضيف
                </div>
              ) : (
                <>
                  <div id="debts-onme-printable">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div
                        className="lux-glass overflow-hidden"
                        style={{
                          borderRadius: "var(--lux-radius, 16px)",
                          borderRight: "4px solid var(--warning)",
                        }}
                      >
                        <div className="px-4 py-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{
                                background: "rgba(245,158,11,0.12)",
                              }}
                            >
                              <Truck
                                size={16}
                                style={{ color: "var(--warning)" }}
                              />
                            </div>
                            <div className="text-right">
                              <div
                                className="font-black"
                                style={{
                                  fontSize: "0.68rem",
                                  color: "var(--warning)",
                                }}
                              >
                                إجمالي دين عليا
                              </div>
                              <div
                                className="font-bold"
                                style={{
                                  fontSize: "0.65rem",
                                  color: "var(--text-muted)",
                                }}
                              >
                                مستحقات للموردين والأشخاص
                              </div>
                            </div>
                          </div>
                          <div className="text-left">
                            <div
                              className="font-black font-mono leading-none"
                              style={{
                                fontSize: "1.5rem",
                                color: "var(--warning)",
                              }}
                            >
                              {onMeTotal.toFixed(2)}
                            </div>
                            <div
                              className="font-bold"
                              style={{
                                fontSize: "0.65rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              ج.م
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        className="lux-glass overflow-hidden"
                        style={{
                          borderRadius: "var(--lux-radius, 16px)",
                        }}
                      >
                        <div className="px-4 py-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{
                                background:
                                  "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                              }}
                            >
                              <Users
                                size={16}
                                style={{ color: "var(--on-accent)" }}
                              />
                            </div>
                            <div className="text-right">
                              <div
                                className="font-black"
                                style={{
                                  fontSize: "0.68rem",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                مورد · شخص
                              </div>
                              <div
                                className="font-bold"
                                style={{
                                  fontSize: "0.65rem",
                                  color: "var(--text-muted)",
                                }}
                              >
                                اللي ليهم فلوس عندنا
                              </div>
                            </div>
                          </div>
                          <div className="text-left">
                            <div
                              className="font-black font-mono leading-none"
                              style={{
                                fontSize: "1.5rem",
                                color: "var(--text-primary)",
                              }}
                            >
                              {onMeSupCount} ·{" "}
                              {onMeRows.length - onMeSupCount}
                            </div>
                            <div
                              className="font-bold"
                              style={{
                                fontSize: "0.65rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              مورد · شخص
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      className="lux-glass overflow-hidden"
                      style={{ borderRadius: "var(--lux-radius, 16px)" }}
                    >
                      <table className="w-full text-right">
                        <thead>
                          <tr
                            className="text-[11px] font-black"
                            style={{
                              background: "var(--gradient-header)",
                            }}
                          >
                            <th
                              className="py-2.5 px-3"
                              style={{ color: "var(--accent)" }}
                            >
                              #
                            </th>
                            <th
                              className="py-2.5 px-3"
                              style={{ color: "var(--accent)" }}
                            >
                              الاسم
                            </th>
                            <th
                              className="py-2.5 px-3 text-center"
                              style={{ color: "var(--accent)" }}
                            >
                              النوع
                            </th>
                            <th
                              className="py-2.5 px-3 text-center"
                              style={{ color: "var(--accent)" }}
                            >
                              المبلغ (ج)
                            </th>
                            <th
                              className="py-2.5 px-3 text-center"
                              style={{ color: "var(--accent)" }}
                            >
                              آخر حركة
                            </th>
                            <th
                              className="py-2.5 px-3 text-center"
                              style={{ color: "var(--accent)" }}
                            >
                              إجراء
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginate(onMeRows, pageDebt).map(
                            (r: any, i: number) => {
                              const rel = relDay(r.last);
                              const isSup = r.kind === "supplier";
                              return (
                                <tr
                                  key={`${r.kind}:${r.key}`}
                                  className="text-xs"
                                  style={{
                                    borderBottom: "1px solid var(--border)",
                                    borderRight: isSup
                                      ? "3px solid var(--warning)"
                                      : "3px solid var(--danger)",
                                  }}
                                >
                                  <td className="py-2 px-3 font-mono text-[var(--text-muted)]">
                                    {(Math.min(
                                      pageDebt,
                                      Math.max(
                                        1,
                                        Math.ceil(
                                          onMeRows.length / PAGE_R
                                        )
                                      )
                                    ) -
                                      1) *
                                      PAGE_R +
                                      i +
                                      1}
                                  </td>
                                  <td className="py-2 px-3">
                                    <p
                                      className="font-black flex items-center gap-1.5"
                                      style={{
                                        color: "var(--text-primary)",
                                      }}
                                    >
                                      {isSup ? (
                                        <Truck
                                          size={13}
                                          style={{
                                            color: "var(--text-muted)",
                                          }}
                                        />
                                      ) : (
                                        <Users
                                          size={13}
                                          style={{
                                            color: "var(--text-muted)",
                                          }}
                                        />
                                      )}
                                      {r.name}
                                    </p>
                                    <p
                                      className="font-mono"
                                      style={{
                                        fontSize: "0.68rem",
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      {r.phone
                                        ? r.phone
                                        : "من غير تليفون"}
                                    </p>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span
                                      className="lux-chip font-black"
                                      style={{
                                        background: isSup
                                          ? "rgba(245,158,11,0.10)"
                                          : "rgba(239,68,68,0.10)",
                                        borderColor: isSup
                                          ? "rgba(245,158,11,0.35)"
                                          : "rgba(239,68,68,0.35)",
                                        color: isSup
                                          ? "var(--warning)"
                                          : "var(--danger)",
                                        fontSize: "0.68rem",
                                      }}
                                    >
                                      {isSup ? "مورّد" : "فرد"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span
                                      className="lux-chip font-mono"
                                      style={{
                                        background: isSup
                                          ? "rgba(245,158,11,0.10)"
                                          : "rgba(239,68,68,0.10)",
                                        borderColor: isSup
                                          ? "rgba(245,158,11,0.35)"
                                          : "rgba(239,68,68,0.35)",
                                        color: isSup
                                          ? "var(--warning)"
                                          : "var(--danger)",
                                        fontWeight: 900,
                                      }}
                                    >
                                      {r.amount.toFixed(2)} ج.م
                                    </span>
                                  </td>
                                  <td
                                    className="py-2 px-3 text-center font-bold font-mono"
                                    style={{
                                      fontSize: "0.68rem",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    {rel ||
                                      String(r.last || "").slice(0, 10) ||
                                      "—"}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelected(r.ref);
                                        setMsg(null);
                                      }}
                                      className="h-6 px-2.5 font-bold rounded-md cursor-pointer"
                                      style={{
                                        background: "#1f6feb",
                                        color: "#fff",
                                        border: "none",
                                        fontSize: "0.65rem",
                                      }}
                                    >
                                      فتح الحساب ←
                                    </button>
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>
                    {renderPager(onMeRows.length, pageDebt, setPageDebt)}
                    <div className="no-print flex justify-center mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDebtModal(null);
                          setTab("debt_on_me");
                        }}
                        className="h-8 px-4 rounded-lg border text-xs font-black cursor-pointer"
                        style={{
                          background: "var(--bg-input)",
                          borderColor: "var(--border-strong)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        عرض في الجدول الرئيسي
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── مودال سجل العميل ── */}
      {repHistCustomer && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[61] p-4"
          style={{
            background: "rgb(13 18 25 / 0.7)",
            backdropFilter: "blur(6px)",
            direction: "rtl",
          }}
        >
          <div
            className="lux-pop w-full max-w-3xl overflow-y-auto lux-scroll"
            style={{
              maxHeight: "85vh",
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--lux-radius, 16px)",
              boxShadow: "0 25px 60px -15px rgba(0,0,0,0.6)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5 sticky top-0 z-10"
              style={{
                background: "var(--gradient-header)",
                borderBottom: "1px solid var(--border-strong)",
                borderRadius:
                  "var(--lux-radius, 16px) var(--lux-radius, 16px) 0 0",
              }}
            >
              <h3
                className="font-black"
                style={{ fontSize: "0.9rem", color: "var(--accent)" }}
              >
                سجل العميل: {repHistCustomer?.name}{" "}
                <span
                  className="font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  ({repHistCustomer?.secret_number})
                </span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setRepHistCustomer(null);
                  setRepHistInvoices([]);
                }}
                className="cursor-pointer hover:scale-110 transition-transform"
                style={{ color: "var(--text-secondary)" }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {repHistLoading ? (
                <div
                  className="p-10 text-center font-bold"
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.8rem",
                  }}
                >
                  جاري تحميل السجل...
                </div>
              ) : repHistInvoices.length === 0 ? (
                <div
                  className="p-8 text-center font-bold"
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.8rem",
                  }}
                >
                  لا توجد فواتير مسجلة لهذا العميل
                </div>
              ) : (
                repHistInvoices.map((inv: any) => {
                  const items = Array.isArray(inv.items)
                    ? inv.items
                    : [];
                  const exp = repExpandedInv === inv.id;
                  return (
                    <div
                      key={inv.id}
                      className="overflow-hidden"
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: "var(--lux-radius-sm, 10px)",
                      }}
                    >
                      <div
                        className="px-3 py-2 flex flex-wrap justify-between items-center gap-2 font-black"
                        style={{
                          background: "var(--bg-input)",
                          borderBottom: "1px solid var(--border)",
                          fontSize: "0.78rem",
                          color: "var(--text-primary)",
                        }}
                      >
                        <span
                          className="font-mono"
                          style={{ color: "var(--accent)" }}
                        >
                          #{inv.invoice_number}
                        </span>
                        <span className="font-mono">{inv.date}</span>
                        <span
                          className="font-mono"
                          style={{ color: "var(--accent)" }}
                        >
                          {Number(inv.total || 0).toFixed(2)} ج.م
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRepExpandedInv(exp ? null : inv.id)
                          }
                          className="h-6 px-3 font-bold rounded-md cursor-pointer"
                          style={{
                            background: "var(--accent-subtle)",
                            color: "var(--accent)",
                            border: "1px solid var(--border-strong)",
                            fontSize: "0.68rem",
                          }}
                        >
                          {exp
                            ? "إخفاء الأصناف ▲"
                            : `عرض الأصناف (${items.length}) ▼`}
                        </button>
                      </div>
                      {exp && (
                        <table className="w-full text-right text-[11px]">
                          <thead>
                            <tr
                              style={{
                                background: "var(--gradient-header)",
                              }}
                            >
                              {["#", "الصنف", "الكمية", "السعر", "الإجمالي"].map(
                                (h, i) => (
                                  <th
                                    key={h}
                                    className="py-1.5 px-2"
                                    style={{
                                      color: "var(--accent)",
                                      textAlign:
                                        i >= 2 ? "center" : "right",
                                    }}
                                  >
                                    {h}
                                  </th>
                                )
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it: any, i: number) => (
                              <tr
                                key={i}
                                style={{
                                  borderBottom:
                                    "1px solid var(--border)",
                                }}
                              >
                                <td
                                  className="py-1.5 px-2"
                                  style={{
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  {i + 1}
                                </td>
                                <td
                                  className="py-1.5 px-2 font-bold"
                                  style={{
                                    color: "var(--text-primary)",
                                  }}
                                >
                                  {it.name}
                                </td>
                                <td
                                  className="py-1.5 px-2 text-center font-mono"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  {it.quantity} {it.unit || ""}
                                </td>
                                <td
                                  className="py-1.5 px-2 text-center font-mono"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  {Number(it.price || 0).toFixed(2)}
                                </td>
                                <td
                                  className="py-1.5 px-2 text-center font-mono font-black"
                                  style={{ color: "var(--accent)" }}
                                >
                                  {Number(it.total || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── مودال تعديل العميل ── */}
      {repEditCustomer && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[61] p-4"
          style={{
            background: "rgb(13 18 25 / 0.7)",
            backdropFilter: "blur(6px)",
            direction: "rtl",
          }}
        >
          <div
            className="lux-pop p-5 w-full max-w-md relative space-y-3"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--lux-radius, 16px)",
              boxShadow: "0 25px 60px -15px rgba(0,0,0,0.6)",
            }}
          >
            <button
              type="button"
              onClick={() => setRepEditCustomer(null)}
              className="absolute top-3 left-3 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-secondary)",
              }}
            >
              <X size={14} />
            </button>

            <h3
              className="font-black pb-2"
              style={{
                fontSize: "0.9rem",
                color: "var(--text-primary)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              تعديل بيانات العميل
            </h3>

            <div>
              <label className="lux-label">اسم العميل *</label>
              <input
                type="text"
                value={repForm.name}
                onChange={(e) =>
                  setRepForm({ ...repForm, name: e.target.value })
                }
                className="lux-select w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lux-label">الرقم السري *</label>
                <input
                  type="text"
                  value={repForm.secret_number}
                  onChange={(e) =>
                    setRepForm({
                      ...repForm,
                      secret_number: e.target.value,
                    })
                  }
                  className="lux-select w-full"
                />
              </div>
              <div>
                <label className="lux-label">التليفون</label>
                <input
                  type="text"
                  value={repForm.phone}
                  onChange={(e) =>
                    setRepForm({ ...repForm, phone: e.target.value })
                  }
                  className="lux-select w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lux-label">مبلغ البطاقة</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={repForm.card_value || ""}
                  onChange={(e) =>
                    setRepForm({
                      ...repForm,
                      card_value: Number(e.target.value) || 0,
                    })
                  }
                  className="lux-select w-full text-center"
                  style={{ fontWeight: 900 }}
                />
              </div>
              <div>
                <label className="lux-label">نقاط الخبز</label>
                <input
                  type="number"
                  value={repForm.bread_points || ""}
                  onChange={(e) =>
                    setRepForm({
                      ...repForm,
                      bread_points: Number(e.target.value) || 0,
                    })
                  }
                  className="lux-select w-full text-center"
                  style={{ fontWeight: 900 }}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={saveRepEdit}
                className="h-10 px-6 font-black text-xs cursor-pointer rounded-xl"
                style={{
                  background: "var(--gradient-accent)",
                  color: "var(--on-accent)",
                  border: "none",
                  boxShadow: "0 6px 16px -8px var(--accent)",
                }}
              >
                حفظ التعديلات
              </button>
              <button
                type="button"
                onClick={() => setRepEditCustomer(null)}
                className="h-10 px-6 font-black text-xs cursor-pointer rounded-xl"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                }}
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
