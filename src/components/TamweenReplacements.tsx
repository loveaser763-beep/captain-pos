import React, { useState, useEffect } from "react";
import { RefreshCw, Plus, Edit, Trash2, Search, X, Package, Minus, Eye, LineChart as LineChartIcon, BarChart3, CreditCard, Gem, UserCheck, Clock, Monitor, ArrowLeft, Users, Wheat, Lock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { authFetch, hardRefocus } from "../authFetch";
import { localDateStr } from "../localDate";
import UnifiedPrintButton from "./UnifiedPrintButton";

interface TamweenProduct {
  id: number;
  barcode: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  purchase_price: number;
  retail_price: number;
  wholesale_price: number;
}

interface ReplacementItem {
  rowKey?: string;
  name: string;
  barcode?: string;
  quantity: number;
  unit: string;
  purchase_price?: number;
  retail_price?: number;
  wholesale_price?: number;
  price?: number;
}

interface Replacement {
  id: number;
  date: string;
  invoice_number: string;
  supplier_name: string;
  items_description: string;
  items_json: string | ReplacementItem[];
  total_value: number;
  status: string;
  notes: string;
  created_at: string;
}

export default function TamweenReplacements({ onWithdrawNow, currentUser }: { onWithdrawNow?: (customer: any) => void; currentUser?: any }) {
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Replacement | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [tamweenProducts, setTamweenProducts] = useState<TamweenProduct[]>([]);
  const [selectedItems, setSelectedItems] = useState<ReplacementItem[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [expandedRepId, setExpandedRepId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  // ملخص الشهر للـ 6 مربعات المضيئة (نفس بند التقارير)
  const [monthSummary, setMonthSummary] = useState<any>(null);
  // مخطط حجم المبيعات — عنصر إضافي لا يمسّ بقية الصفحة
  const [chartViewType, setChartViewType] = useState<"hourly" | "daily">("daily");
  const [chartDate, setChartDate] = useState<string>(localDateStr());
  const [chartSales, setChartSales] = useState<any[]>([]);
  const [repHistCustomer, setRepHistCustomer] = useState<any>(null);
  const [repHistInvoices, setRepHistInvoices] = useState<any[]>([]);
  const [repHistLoading, setRepHistLoading] = useState(false);
  const [repExpandedInv, setRepExpandedInv] = useState<number | null>(null);
  const [repEditCustomer, setRepEditCustomer] = useState<any>(null);
  const [repForm, setRepForm] = useState({ name: "", secret_number: "", phone: "", card_value: 0, bread_points: 0 });

  const openRepHistory = async (c: any) => {
    setRepHistLoading(true);
    setRepHistCustomer(c);
    setRepHistInvoices([]);
    setRepExpandedInv(null);
    try {
      const res = await authFetch(`/api/tamween-customers/${c.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setRepHistCustomer(data.customer);
        setRepHistInvoices(data.invoices || []);
      }
    } catch {} finally { setRepHistLoading(false); }
  };

  const openRepEdit = (c: any) => {
    setRepEditCustomer(c);
    setRepForm({ name: c.name || "", secret_number: c.secret_number || "", phone: c.phone || "", card_value: c.card_value || 0, bread_points: c.bread_points || 0 });
  };

  const saveRepEdit = async () => {
    if (!repEditCustomer || !repForm.name.trim() || !repForm.secret_number.trim()) return;
    try {
      const res = await authFetch(`/api/tamween-customers/${repEditCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...repForm, name: repForm.name.trim(), secret_number: repForm.secret_number.trim(), phone: repForm.phone.trim() }),
      });
      if (res.ok) {
        setRepEditCustomer(null);
      }
    } catch {}
  };

  const deleteRepCustomer = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا العميل؟")) { try { hardRefocus(); } catch {} return; }
    try {
      const res = await authFetch(`/api/tamween-customers/${id}`, { method: "DELETE" });
      if (res.ok) {
        // اتمسح بنجاح — الجداول بتتحدّث مع التحميل الجديد
      }
    } catch {} finally { try { hardRefocus(); } catch {} }
  };

  // تفاصيل المربعات
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const PAGE_R = 10;
  const [pageModal, setPageModal] = useState(1);
  const [pageSum, setPageSum] = useState(1);
  const [pageDis, setPageDis] = useState(1);
  const [pageRep, setPageRep] = useState(1);
  useEffect(() => { setPageModal(1); setPageSum(1); setPageDis(1); }, [selectedCard, selectedMonth]);
  useEffect(() => { setPageRep(1); }, [selectedMonth, searchQuery]);
  const [cardDetails, setCardDetails] = useState<any>(null);
  const [profitSrc, setProfitSrc] = useState<"card" | "nocard">("card");
  const [cardLoading, setCardLoading] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [remainingDetails, setRemainingDetails] = useState<any[]>([]);
  // مطابقة سمارت (إدخال يدوي يومي): مبيعات سمارت + دعم سمارت + الفرق
  const [machineData, setMachineData] = useState<any>(null);
  // صف المقارنة الثلاثي (مطابقة سمارت / الدعم المنصرف / نقاط الخبز) + قوائم منبثقة
  const [sumBox, setSumBox] = useState<"smart" | "cards" | "bread" | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<{ month: string; data: any } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  // مستحقات نقاط الخبز (فلوس راكنة عند البنك لحد التحويل للخزينة)
  const [breadData, setBreadData] = useState<any>(null);
  const [breadForm, setBreadForm] = useState(false);
  const [stDate, setStDate] = useState(localDateStr());
  // الشهر المراد تسويرته (لازم يكون شهر خلص — الشهر الحالي ممنوع)
  const [stPeriod, setStPeriod] = useState(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });
  const [stAmount, setStAmount] = useState("");
  const [stNote, setStNote] = useState("");
  const [stSaving, setStSaving] = useState(false);
  const [stMsg, setStMsg] = useState("");
  const loadBreadPoints = () =>
    authFetch("/api/bread-points")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBreadData(d))
      .catch(() => setBreadData(null));
  const [machDay, setMachDay] = useState(localDateStr());
  const [machSales, setMachSales] = useState("");
  const [machSupport, setMachSupport] = useState("");
  const [machDiff, setMachDiff] = useState("");
  const [machNote, setMachNote] = useState("");
  const [machSaving, setMachSaving] = useState(false);
  const [machMsg, setMachMsg] = useState("");
  const fetchMachine = () =>
    authFetch(`/api/machine-sales?month=${selectedMonth}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMachineData(d))
      .catch(() => setMachineData(null));
  const loadMonthlyReport = (force = false) => {
    if (!force && (reportLoading || (monthlyReport && monthlyReport.month === selectedMonth))) return;
    setReportLoading(true);
    const m = selectedMonth;
    authFetch(`/api/tamween/monthly-report?month=${m}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMonthlyReport({ month: m, data: d }))
      .catch(() => setMonthlyReport({ month: m, data: null }))
      .finally(() => setReportLoading(false));
  };
  const toggleSumBox = (key: "smart" | "cards" | "bread") => {
    const next = sumBox === key ? null : key;
    setSumBox(next);
    setBreadForm(false); setStMsg("");
    if (next === "cards" || next === "bread") loadMonthlyReport();
    if (next === "bread") loadBreadPoints();
  };
  const saveSettlement = async () => {
    const v = Number(stAmount || 0);
    if (!/^\d{4}-\d{2}$/.test(stPeriod)) { setStMsg("اختار الشهر المتسوّي"); return; }
    if (stPeriod >= new Date().toISOString().slice(0, 7)) { setStMsg("التسوية من أول شهر لآخره — الشهر لسه شغال"); return; }
    if (!stDate) { setStMsg("أدخل التاريخ"); return; }
    if (!v || v <= 0 || isNaN(v)) { setStMsg("المبلغ غير صحيح"); return; }
    setStSaving(true); setStMsg("");
    try {
      const r = await authFetch("/api/bread-points/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: stPeriod, actual: v, date: stDate, note: stNote }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "فشل الحفظ");
      await loadBreadPoints();
      setStAmount(""); setStNote(""); setBreadForm(false); setStMsg("تم التحويل للخزينة ✅");
      setTimeout(() => setStMsg(""), 2500);
    } catch (e: any) { setStMsg(e?.message || "خطأ في الحفظ"); }
    finally { setStSaving(false); }
  };
  const saveMachineDay = async () => {
    if (!machDay) { setMachMsg("أدخل التاريخ"); return; }
    const s = Number(machSales || 0);
    const sp = Number(machSupport || 0);
    if (isNaN(s) || s < 0 || isNaN(sp) || sp < 0) { setMachMsg("قيمة غير صحيحة"); return; }
    const d = machDiff.trim() === "" ? null : Number(machDiff);
    if (d !== null && isNaN(d)) { setMachMsg("قيمة الفرق غير صحيحة"); return; }
    setMachSaving(true); setMachMsg("");
    try {
      const r = await authFetch("/api/machine-sales", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: machDay, sales: s, support: sp, diff: d, note: machNote }),
      });
      if (!r.ok) throw new Error("فشل الحفظ");
      setMachSales(""); setMachSupport(""); setMachDiff(""); setMachNote(""); setMachMsg("تم الحفظ ✅");
      await fetchMachine();
      setTimeout(() => setMachMsg(""), 2500);
    } catch (e: any) { setMachMsg(e?.message || "خطأ في الحفظ"); }
    finally { setMachSaving(false); }
  };
  const deleteMachineDay = async (day: string) => {
    if (!window.confirm(`حذف إدخال يوم ${day}؟`)) return;
    try { await authFetch(`/api/machine-sales/${day}`, { method: "DELETE" }); await fetchMachine(); } catch {}
  };
  const fetchMonthData = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    if (!y || !m) return;
    const lastDay = new Date(y, m, 0).getDate();
    const start = `${selectedMonth}-01`;
    const end = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
    // بيانات مخطط المبيعات لشهر مختار (فواتير مبيعات غير مرتجعة)
    const todayStr = localDateStr();
    setChartDate(todayStr >= start && todayStr <= end ? todayStr : end);
    authFetch(`/api/reports?reportType=sales&startDate=${start}&endDate=${end}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = Array.isArray(d?.invoices) ? d.invoices : [];
        setChartSales(list.filter((inv: any) => inv.status !== "returned"));
      })
      .catch(() => setChartSales([]));
    authFetch(`/api/reports/tamween?startDate=${start}&endDate=${end}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => setMonthSummary(t))
      .catch(() => setMonthSummary(null));
    setCardDetails(null);
    // ملحوظة: لا نغلق المودال عند تغيير الشهر — المحتوى يتحدث تلقائياً
    // تفاصيل المربعات للشهر
    authFetch(`/api/reports/tamween/details?startDate=${start}&endDate=${end}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => { setCardDetails(t); setDetailsLoaded(true); })
      .catch(() => { setCardDetails(null); setDetailsLoaded(true); });
    authFetch(`/api/tamween-replacements/remaining?month=${selectedMonth}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((t) => setRemainingDetails(Array.isArray(t) ? t : []))
      .catch(() => setRemainingDetails([]));
    fetchMachine();
    if (sumBox === "cards" || sumBox === "bread") loadMonthlyReport();
    if (sumBox === "bread") loadBreadPoints();
    fetchReplacements();
  };
  useEffect(() => {
    setDetailsLoaded(false);
    fetchMonthData();
  }, [selectedMonth]);

  // ===== إجراءات على الفواتير جوّه القوائم المنبثقة (عرض · تعديل · حذف) =====
  const isAdminUser = currentUser?.role === "admin" || currentUser?.role === "developer";
  const canEditInvoice = isAdminUser || (currentUser?.permissions || []).includes("edit_invoice");
  const canDeleteInvoice = isAdminUser || (currentUser?.permissions || []).includes("delete_invoice");
  const [invView, setInvView] = useState<any>(null);
  const [invViewItems, setInvViewItems] = useState<any[]>([]);
  const [invViewLoading, setInvViewLoading] = useState(false);
  const [invEdit, setInvEdit] = useState<any>(null);
  const [invEditForm, setInvEditForm] = useState({ customer_supplier_name: "", payment_source: "cash_register", paid: 0, remaining: 0 });
  const [invDelete, setInvDelete] = useState<any>(null);
  const [invBusy, setInvBusy] = useState(false);
  const [invMsg, setInvMsg] = useState("");

  const refreshAfterInvoiceAction = () => {
    setMonthlyReport(null);
    setReportLoading(false);
    fetchMonthData();
    setTimeout(() => loadMonthlyReport(true), 0);
  };

  const openInvView = async (inv: any) => {
    if (!inv?.id) return;
    setInvView(inv); setInvViewItems([]); setInvViewLoading(true); setInvMsg("");
    try {
      const res = await authFetch(`/api/invoices/${inv.id}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setInvViewItems(d.items || []);
    } catch { setInvMsg("تعذّر تحميل أصناف الفاتورة."); }
    finally { setInvViewLoading(false); }
  };

  const openInvEdit = (inv: any) => {
    if (!inv?.id) return;
    setInvEdit(inv);
    setInvEditForm({
      customer_supplier_name: inv.customer_supplier_name || "",
      payment_source: inv.payment_source || "cash_register",
      paid: Number(inv.paid || 0),
      remaining: Number(inv.remaining || 0),
    });
    setInvMsg("");
  };

  const saveInvEdit = async () => {
    if (!invEdit?.id || invBusy) return;
    setInvBusy(true); setInvMsg("");
    try {
      const res = await authFetch(`/api/invoices/${invEdit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...invEditForm, user_name: currentUser?.name || "مدير النظام" }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "تعذّر حفظ التعديلات.");
      setInvEdit(null);
      setNotice(`تم تعديل الفاتورة ${invEdit.invoice_number} بنجاح ✅`);
      refreshAfterInvoiceAction();
    } catch (e: any) { setInvMsg(e?.message || "خطأ أثناء حفظ التعديلات."); }
    finally { setInvBusy(false); }
  };

  const deleteInvoiceNow = async () => {
    if (!invDelete?.id || invBusy) return;
    setInvBusy(true); setInvMsg("");
    try {
      const res = await authFetch(
        `/api/invoices/${invDelete.id}?user_name=${encodeURIComponent(currentUser?.name || "")}&user_role=${encodeURIComponent(currentUser?.role || "")}`,
        { method: "DELETE" }
      );
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "فشل حذف الفاتورة.");
      setInvDelete(null);
      setNotice(`تم حذف الفاتورة ${invDelete.invoice_number} واستعادة كمياتها للمخزن ✅`);
      refreshAfterInvoiceAction();
    } catch (e: any) { setInvMsg(e?.message || "فشل حذف الفاتورة."); }
    finally { setInvBusy(false); }
  };

  const invActionsCell = (inv: any) => (
    <td className="py-2 px-3 text-center">
      <div className="flex gap-1 justify-center">
        <button onClick={() => openInvView(inv)} title="عرض أصناف الفاتورة"
          className="bg-[#8e44ad] text-white p-1.5 hover:bg-[#7d3c98] transition-colors rounded cursor-pointer">
          <Eye size={14} />
        </button>
        {canEditInvoice ? (
          <button onClick={() => openInvEdit(inv)} title="تعديل الفاتورة"
            className="bg-blue-500 text-white p-1.5 hover:bg-blue-600 transition-colors rounded cursor-pointer">
            <Edit size={14} />
          </button>
        ) : (
          <span title="ممنوع — مفيش صلاحية تعديل" className="bg-[#b8bcb2] text-[#888888] p-1.5 rounded">
            <Lock size={14} />
          </span>
        )}
        {canDeleteInvoice ? (
          <button onClick={() => { setInvDelete(inv); setInvMsg(""); }} title="حذف الفاتورة"
            className="bg-red-500 text-white p-1.5 hover:bg-red-600 transition-colors rounded cursor-pointer">
            <Trash2 size={14} />
          </button>
        ) : (
          <span title="ممنوع — مفيش صلاحية حذف" className="bg-[#b8bcb2] text-[#888888] p-1.5 rounded">
            <Lock size={14} />
          </span>
        )}
      </div>
    </td>
  );

  const openCardDetails = (key: string) => {
    setSelectedCard(key);
    setCardLoading(false);
    if (key === "profit") setProfitSrc("card");
  };
  // تقسيم الصفحات: 10 عناصر للصفحة + سكرول
  const paginate = (arr: any[], page: number) => {
    const tp = Math.max(1, Math.ceil(arr.length / PAGE_R));
    const s = Math.min(Math.max(1, page), tp);
    return arr.slice((s - 1) * PAGE_R, s * PAGE_R);
  };

  const renderPager = (total: number, page: number, setPage: (n: number) => void) => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_R));
    if (totalPages <= 1) return null;
    const safe = Math.min(Math.max(1, page), totalPages);
    return (
      <div className="flex items-center justify-center gap-1.5 p-2.5 border-t-2 flex-wrap" style={{ background: "var(--bg-input)", borderColor: "var(--border-strong)" }}>
        <button onClick={() => setPage(Math.max(1, safe - 1))} disabled={safe === 1}
          className="h-8 px-3 rounded-lg border text-xs font-black cursor-pointer disabled:opacity-40 transition-all" style={{ background: "var(--bg-input)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }}>‹ السابق</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => setPage(n)}
            className="h-8 min-w-8 px-2 text-xs font-black border rounded-lg cursor-pointer transition-all"
            style={n === safe
              ? { background: "var(--bg-deep)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }
              : { background: "var(--bg-input)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }}>{n}</button>
        ))}
        <button onClick={() => setPage(Math.min(totalPages, safe + 1))} disabled={safe === totalPages}
          className="h-8 px-3 rounded-lg border text-xs font-black cursor-pointer disabled:opacity-40 transition-all" style={{ background: "var(--bg-input)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }}>التالي ›</button>
        <span className="text-[11px] font-bold mr-1" style={{ color: "var(--text-secondary)" }}>صفحة {safe} من {totalPages}</span>
      </div>
    );
  };
  
  const [form, setForm] = useState({
    date: localDateStr(),
    invoice_number: "",
    supplier_name: "",
    items_description: "",
    total_value: 0,
    status: "pending",
    notes: ""
  });

const fetchReplacements = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/tamween-replacements?month=${selectedMonth}`);
      if (res.ok) {
        const data = await res.json();
        setReplacements(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTamweenProducts = async () => {
    try {
      // البحث في كل الأصناف (التمويني أولاً) — مش جدول tamween_products المنفصل
      const res = await authFetch("/api/items");
      if (res.ok) {
        const data: any[] = await res.json();
        const flagged: TamweenProduct[] = [];
        const rest: TamweenProduct[] = [];
        (Array.isArray(data) ? data : []).forEach((p: any) => {
          const mapped: TamweenProduct = {
            id: p.id,
            barcode: p.barcode || "",
            name: p.name || "",
            category: p.category || "عام",
            quantity: p.quantity || 0,
            unit: p.unit || "قطعة",
            purchase_price: p.purchase_price || 0,
            retail_price: p.retail_price || 0,
            wholesale_price: p.wholesale_price || 0,
          };
          if (p.is_tamween === 1) flagged.push(mapped);
          else rest.push(mapped);
        });
        setTamweenProducts([...flagged, ...rest]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const rowKeyOf = (it: ReplacementItem, idx: number) => it.rowKey || `${it.barcode || "n"}-${idx}`;

  const addProductToSelection = (product: TamweenProduct) => {
    const existingIdx = selectedItems.findIndex(item => item.barcode && item.barcode === product.barcode);
    let nextItems: ReplacementItem[];
    if (existingIdx > -1) {
      nextItems = selectedItems.map((item, i) =>
        i === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      nextItems = [...selectedItems, {
        rowKey: `r${Date.now()}${Math.floor(Math.random() * 1000)}`,
        name: product.name,
        barcode: product.barcode,
        quantity: 1,
        unit: product.unit,
        purchase_price: product.purchase_price,
        retail_price: product.retail_price,
        wholesale_price: product.wholesale_price,
      }];
    }
    setSelectedItems(nextItems);
    updateItemsDescription(nextItems);
  };

  // صف جديد فاضي زي المشتريات (باركود + اسم + أسعار يدوي)
  const addBlankRow = () => {
    const next = [...selectedItems, {
      rowKey: `r${Date.now()}${Math.floor(Math.random() * 1000)}`,
      name: "",
      barcode: "",
      quantity: 1,
      unit: "قطعة",
      purchase_price: 0,
      retail_price: 0,
      wholesale_price: 0,
    }];
    setSelectedItems(next);
    updateItemsDescription(next);
  };

  const setRowField = (idx: number, patch: Partial<ReplacementItem>) => {
    const updated = selectedItems.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    setSelectedItems(updated);
    updateItemsDescription(updated);
  };

  const updateSelectedItemQuantity = (idx: number, quantity: number) => {
    if (quantity <= 0) {
      const updated = selectedItems.filter((_, i) => i !== idx);
      setSelectedItems(updated);
      updateItemsDescription(updated);
    } else {
      setRowField(idx, { quantity });
    }
  };

  const updateSelectedItemPrice = (idx: number, price: number) => {
    setRowField(idx, { purchase_price: Math.max(0, price || 0) });
  };

  const updateSelectedItemRetail = (idx: number, price: number) => {
    setRowField(idx, { retail_price: Math.max(0, price || 0) });
  };

  const updateSelectedItemWholesale = (idx: number, price: number) => {
    setRowField(idx, { wholesale_price: Math.max(0, price || 0) });
  };

  const removeSelectedItem = (idx: number) => {
    const updated = selectedItems.filter((_, i) => i !== idx);
    setSelectedItems(updated);
    updateItemsDescription(updated);
  };

  const updateItemsDescription = (items: ReplacementItem[]) => {
    const desc = items.map(item => `${item.quantity} ${item.unit} ${item.name}`).join("، ");
    setForm(prev => ({ ...prev, items_description: desc }));
  };

  const parseItems = (items_json: string | ReplacementItem[]): ReplacementItem[] => {
    if (Array.isArray(items_json)) return items_json;
    try {
      return JSON.parse(items_json || "[]");
    } catch {
      return [];
    }
  };

  useEffect(() => {
    fetchReplacements();
  }, [selectedMonth]);

  useEffect(() => {
    if (showModal) {
      fetchTamweenProducts();
      authFetch("/api/suppliers")
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => setSuppliers(Array.isArray(list) ? list : []))
        .catch(() => {});
      if (editingItem) {
        const items = parseItems(editingItem.items_json);
        setSelectedItems(items);
      } else {
        setSelectedItems([]);
      }
    }
  }, [showModal, editingItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem ? `/api/tamween-replacements/${editingItem.id}` : "/api/tamween-replacements";
      const method = editingItem ? "PUT" : "POST";
      
      const validItems = selectedItems.filter((it) => (it.name || "").trim().length > 0 && Number(it.quantity) > 0);
      const computedTotal = validItems.length > 0 ? validItems.reduce((s, it) => s + it.quantity * (it.purchase_price || 0), 0) : form.total_value;
      const body = {
        ...form,
        total_value: computedTotal,
        items: validItems.length > 0 ? validItems : undefined
      };
      
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        const result = await res.json().catch(() => ({}));
        const parts: string[] = [];
        if (result.purchase_invoice_number) parts.push(`فاتورة شراء تلقائية: ${result.purchase_invoice_number} — الكميات دخلت المخزن`);
        else if (form.status === "received") parts.push("تم الحفظ بدون تحريك مخزن (المورد غير تمويني أو بلا أصناف)");
        else parts.push("تم حفظ الاستعاضة (قيد الانتظار — لم يتحرك المخزن)");
        (result.warnings || []).forEach((w: string) => parts.push(w));
        setNotice(parts.join(" | "));
        setShowModal(false);
        setEditingItem(null);
        resetForm();
        setSelectedItems([]);
        fetchReplacements();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه الاستعاضة؟ سيتم عكس كمياتها من المخزن وحذف فاتورة الشراء المرتبطة.")) { try { hardRefocus(); } catch {} return; }
    try {
      const res = await authFetch(`/api/tamween-replacements/${id}`, { method: "DELETE" });
      if (res.ok) {
        setNotice("تم حذف الاستعاضة وعكس كمياتها من المخزن.");
        fetchReplacements();
      }
    } catch (err) {
      console.error(err);
    } finally {
      try { hardRefocus(); } catch {}
    }
  };

  const resetForm = () => {
    setForm({
      date: localDateStr(),
      invoice_number: "",
      supplier_name: "",
      items_description: "",
      total_value: 0,
      status: "pending",
      notes: ""
    });
    setSelectedItems([]);
  };

  const filteredReplacements = replacements.filter(r => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (r.supplier_name || "").toLowerCase().includes(q) ||
      (r.items_description || "").toLowerCase().includes(q) ||
      (r.invoice_number || "").toLowerCase().includes(q);
  });

  const totalValue = filteredReplacements.reduce((sum, r) => sum + r.total_value, 0);

  // بيانات مخطط المبيعات: بالساعات ليوم محدد أو بالأيام لكل الشهر
  const processChartData = () => {
    if (!chartSales.length) return [];
    if (chartViewType === "hourly") {
      const dayInvoices = chartSales.filter((inv: any) => inv.date === chartDate);
      const hourlyData = Array.from({ length: 24 }, (_, i) => ({
        label: `${i.toString().padStart(2, "0")}:00`,
        hour: i,
        المبيعات: 0
      }));
      dayInvoices.forEach((inv: any) => {
        if (inv.created_at) {
          const hour = new Date(inv.created_at).getHours();
          if (hourlyData[hour]) hourlyData[hour].المبيعات += Number(inv.total || 0);
        }
      });
      return hourlyData;
    }
    const dailyMap: Record<string, number> = {};
    chartSales.forEach((inv: any) => {
      if (inv.date) dailyMap[inv.date] = (dailyMap[inv.date] || 0) + Number(inv.total || 0);
    });
    return Object.keys(dailyMap).sort().map((date) => ({ label: date.slice(5), المبيعات: dailyMap[date] }));
  };
  const chartDataArray = processChartData();

  // صفوف جدول "مبيعات التموين": البند التمويني (أي طريقة دفع) + الحر (بكارت الدعم فقط) — مطابقة للمربعات الثلاثة
  // مربعات الربح: أصناف تموينية مباعة بالبطاقة / بدون بطاقة + إجمالياتها
  const profitRows: any[] = (profitSrc === "card"
    ? ((cardDetails?.tamweenCardItems as any[]) || [])
    : ((cardDetails?.tamweenNoCardItems as any[]) || []));
  const profitGain = profitRows.filter((it: any) => Number(it.profit || 0) > 0).reduce((s: number, it: any) => s + Number(it.profit || 0), 0);
  const profitLoss = profitRows.filter((it: any) => Number(it.profit || 0) < 0).reduce((s: number, it: any) => s + Number(it.profit || 0), 0);
  const profitNet = profitGain + profitLoss;
  const netOf = (key: "card" | "nocard") =>
    (((key === "card" ? cardDetails?.tamweenCardItems : cardDetails?.tamweenNoCardItems) as any[]) || [])
      .reduce((s: number, it: any) => s + Number(it.profit || 0), 0);
  const salesRows: any[] = selectedCard === "profit"
    ? profitRows
    : [
        ...(((cardDetails?.tamweenAllItems as any[]) || []).map((it: any) => ({ ...it, band: "tamween" }))),
        ...(((cardDetails?.freeSalesItems as any[]) || []).map((it: any) => ({ ...it, band: "free" }))),
      ].sort((a: any, b: any) => Number(b.total || 0) - Number(a.total || 0));

  return (
    <div className="flex-1 min-h-0 flex flex-col font-sans" style={{ direction: "rtl", background: "var(--bg-card)" }}>
      {/* شريط مدمج: إضافة + بحث + شهر — فخم غامق + ذهبي */}
      <div className="px-4 py-2.5 flex gap-2 items-center shrink-0 no-print flex-wrap border-b-2" style={{ background: "var(--bg-input)", borderColor: "var(--border-strong)" }}>
        <button
          onClick={() => { setEditingItem(null); resetForm(); setShowModal(true); }}
          className="h-9 px-4 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 rounded-lg shadow-md hover:brightness-110"
          style={{ background: "linear-gradient(135deg,#047857,#0F766E)", color: "#fff" }}
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>+ إضافة استعاضة</span>
        </button>
        <div className="flex-1 flex items-center gap-2 min-w-[160px]">
          <Search size={15} className="text-[#222222]" />
          <input
            type="text"
            placeholder="بحث في الاستعاضات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-9 px-3 border text-xs font-bold rounded-lg"
            style={{ background: "var(--bg-input)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-black text-[#000000]">الشهر:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 px-2 border text-xs font-bold rounded-lg"
            style={{ background: "var(--bg-input)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }}
          />
        </div>
        <button
          onClick={() => { fetchReplacements(); }}
          title="تحديث"
          className="h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer shrink-0 shadow-md hover:brightness-125"
          style={{ background: "var(--bg-deep)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
        >
          <RefreshCw size={15} strokeWidth={2} />
        </button>
      </div>

      {notice && (
        <div className="mx-4 mt-3 p-3 border text-xs font-bold flex items-center justify-between gap-2 shrink-0 rounded-xl" style={{ background: "#d1fae5", borderColor: "#059669", color: "#065f46" }}>
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-[#065f46] font-black cursor-pointer text-sm">✕</button>
        </div>
      )}

      {/* مربعات المنظومة — مخطط موحد زي لوحة المنظومة */}
      {monthSummary && (
        <div className="px-4 pt-4 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1.5 h-6 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
            <h2 className="text-[17px] font-black tracking-tight" style={{ color: "var(--text-primary)" }}>لوحة المنظومة التموينية</h2>
            <span className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg" style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>{selectedMonth}</span>
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,var(--border),transparent)" }} />
          </div>
          {/* صف المقارنة الثلاثي + قوائم منبثقة */}
          {(() => {
            const mt = machineData?.totals || { smartSales: 0, smartSupport: 0, diff: 0 };
            const diff = Number(mt.diff || 0);
            const report = monthlyReport && monthlyReport.month === selectedMonth ? monthlyReport.data : null;
            const tone = diff < 0
              ? { c: "#e11d48", soft: "rgba(225,29,72,.10)", bg: "rgba(225,29,72,.14)" }
              : diff > 0
                ? { c: "#d97706", soft: "rgba(217,119,6,.10)", bg: "rgba(217,119,6,.14)" }
                : { c: "#2563eb", soft: "rgba(37,99,235,.10)", bg: "rgba(37,99,235,.12)" };
            const boxes = [
              {
                key: "smart" as const, label: "مقارنة مبيعات سمارت", value: diff, unit: "ج.م",
                sub: `مبيعات ${Number(mt.smartSales || 0).toFixed(2)} • دعم ${Number(mt.smartSupport || 0).toFixed(2)}`,
                Icon: Monitor, accent: tone.c, iconBg: tone.bg,
              },
              {
                key: "cards" as const, label: "إجمالي الدعم المنصرف", value: Number(monthSummary.disbursed || 0), unit: "ج.م",
                sub: `${Number(monthSummary.cardsUsed || 0)} كارت مصروف`,
                Icon: CreditCard, accent: "#d97706", iconBg: "rgba(217,119,6,.12)",
              },
              {
                key: "bread" as const, label: "إجمالي نقاط الخبز", value: Number(monthSummary.breadPoints || 0), unit: "نقطة",
                sub: report ? `${(report.breadInvoices || []).length} فاتورة` : "اضغط لعرض الفواتير",
                Icon: Wheat, accent: "#059669", iconBg: "rgba(5,150,105,.12)",
              },
            ];
            const list = Array.isArray(machineData?.list) ? machineData.list : [];
            const cardInvoices = report ? (report.invoices || []) : [];
            const breadInvoices = report ? (report.breadInvoices || []) : [];
            const settlements = breadData?.settlements || [];
            return (
              <div className="mb-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {boxes.map((b) => {
                    const open = sumBox === b.key;
                    const Icon = b.Icon;
                    return (
                      <div
                        key={b.key}
                        onClick={() => toggleSumBox(b.key)}
                        title="اضغط لعرض القائمة"
                        className="relative p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 overflow-hidden"
                        style={{
                          background: open ? b.iconBg : "var(--bg-card)",
                          border: `1px solid ${open ? b.accent : "var(--border)"}`,
                          boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05)",
                        }}
                      >
                        <span className="absolute top-0 inset-x-0 h-[3px]" style={{ background: b.accent }} />
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[12px] font-bold leading-snug pt-0.5" style={{ color: "var(--text-secondary)" }}>{b.label}</span>
                          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: b.iconBg, color: b.accent }}>
                            <Icon size={18} strokeWidth={2.25} />
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1.5 flex-wrap mt-1">
                          <h4 className="text-[26px] font-black font-mono leading-none tracking-tight" style={{ color: "var(--text-primary)" }}>
                            {b.value < 0 ? "−" : ""}{Math.abs(b.value).toFixed(2)}
                          </h4>
                          <span className="text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>{b.unit}</span>
                          <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>{b.sub}</span>
                          <span className="text-[10px] font-black mr-auto" style={{ color: b.accent }}>{open ? "▲" : "▼"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {sumBox && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ direction: "rtl" }} onClick={() => setSumBox(null)}>
                  <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden border shadow-2xl flex flex-col" style={{ borderColor: "#888888", background: "var(--bg-card)", boxShadow: "0 24px 60px rgba(0,0,0,.35)" }} onClick={(e) => e.stopPropagation()}>
                    <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap shrink-0" style={{ background: "#222222", borderBottom: "2px solid #888888" }}>
                      <span className="text-[13px] font-black" style={{ color: "#c3c6bb" }}>
                        {sumBox === "smart" ? "قائمة مبيعات سمارت (يوم بيوم)" : sumBox === "cards" ? "قائمة فواتير الدعم المنصرف" : "قائمة فواتير نقاط الخبز"}
                        <span className="font-mono text-[10px] font-bold mr-2 px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,.12)", color: "#c3c6bb", border: "1px solid rgba(255,255,255,.2)" }}>{selectedMonth}</span>
                      </span>
                      <button onClick={() => setSumBox(null)} className="text-[12px] font-black cursor-pointer hover:opacity-70" style={{ color: "#c3c6bb" }}>إغلاق ✕</button>
                    </div>

                    <div className="overflow-auto flex-1">
                      {sumBox === "smart" && (
                        list.length === 0 ? (
                          <div className="px-4 py-7 text-center">
                            <div className="text-[13px] font-black mb-1" style={{ color: "var(--text-primary)" }}>لا توجد أيام مُدخلة لشهر {selectedMonth}</div>
                            <div className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>افتح شاشة المطابقة عشان تضيف مبيعات ودعم سمارت</div>
                          </div>
                        ) : (
                          <table className="w-full text-right text-xs border-collapse">
                            <thead>
                              <tr style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)" }}>
                                <th className="py-2 px-3 font-black">#</th>
                                <th className="py-2 px-3 font-black">التاريخ</th>
                                <th className="py-2 px-3 font-black">مبيعات سمارت</th>
                                <th className="py-2 px-3 font-black">دعم سمارت</th>
                                <th className="py-2 px-3 font-black">الفرق</th>
                                <th className="py-2 px-3 font-black">ملاحظة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((d: any, i: number) => (
                                <tr key={d.day} style={{ background: i % 2 ? "var(--bg-card-hover)" : "var(--bg-card)" }}>
                                  <td className="py-2 px-3 font-mono font-black" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                                  <td className="py-2 px-3 font-mono font-black" style={{ color: "var(--text-secondary)" }}>{d.day}</td>
                                  <td className="py-2 px-3 font-mono font-black" style={{ color: "var(--primary)" }}>{Number(d.smartSales || 0).toFixed(2)}</td>
                                  <td className="py-2 px-3 font-mono font-black" style={{ color: "var(--series-2)" }}>{Number(d.smartSupport || 0).toFixed(2)}</td>
                                  <td className="py-2 px-3 font-mono font-black" style={{ color: Number(d.diff || 0) < 0 ? "var(--danger)" : Number(d.diff || 0) > 0 ? "var(--warning)" : "var(--text-secondary)" }}>
                                    {Number(d.diff || 0) < 0 ? "−" : ""}{Math.abs(Number(d.diff || 0)).toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 font-bold" style={{ color: "var(--text-muted)" }}>{d.note || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      )}

                      {sumBox === "cards" && (
                        !report ? (
                          <div className="px-4 py-7 text-center text-[12px] font-black" style={{ color: "var(--text-muted)" }}>{reportLoading ? "جارٍ التحميل..." : "تعذر تحميل الفواتير"}</div>
                        ) : cardInvoices.length === 0 ? (
                          <div className="px-4 py-7 text-center text-[12px] font-black" style={{ color: "var(--text-muted)" }}>مفيش فواتير فيها دعم تمويني في {selectedMonth}</div>
                        ) : (
                          <table className="w-full text-right text-xs border-collapse">
                            <thead>
                              <tr style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)" }}>
                                <th className="py-2 px-3 font-black">#</th>
                                <th className="py-2 px-3 font-black">رقم الفاتورة</th>
                                <th className="py-2 px-3 font-black">التاريخ</th>
                                <th className="py-2 px-3 font-black">العميل</th>
                                <th className="py-2 px-3 font-black">قيمة الدعم</th>
                                <th className="py-2 px-3 font-black text-center">إجراءات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cardInvoices.map((inv: any, i: number) => (
                                <tr key={inv.invoice_number + i} style={{ background: i % 2 ? "var(--bg-card-hover)" : "var(--bg-card)" }}>
                                  <td className="py-2 px-3 font-mono font-black" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                                  <td className="py-2 px-3 font-mono font-bold" style={{ color: "var(--text-secondary)" }}>{inv.invoice_number}</td>
                                  <td className="py-2 px-3 font-mono font-bold" style={{ color: "var(--text-secondary)" }}>{inv.date}</td>
                                  <td className="py-2 px-3 font-bold" style={{ color: "var(--text-primary)" }}>{inv.customer_supplier_name || "—"}</td>
                                  <td className="py-2 px-3 font-mono font-black" style={{ color: "#d97706" }}>{Number(inv.tamween_discount || 0).toFixed(2)}</td>
                                  {invActionsCell(inv)}
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: "var(--bg-input)", borderTop: "2px solid var(--border-strong)" }}>
                                <td className="py-2 px-3 font-black" colSpan={5} style={{ color: "var(--text-secondary)" }}>إجمالي {cardInvoices.length} فاتورة</td>
                                <td className="py-2 px-3 font-mono font-black" style={{ color: "#d97706" }}>
                                  {cardInvoices.reduce((s: number, inv: any) => s + Number(inv.tamween_discount || 0), 0).toFixed(2)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        )
                      )}

                      {sumBox === "bread" && (
                        <div>
                          {/* مستحقات نقاط الخبز: متراكم • مُحوَّل • رصيد راكن */}
                          <div className="px-4 pt-3 grid grid-cols-3 gap-2">
                            {[
                              { l: "متراكم من الفواتير", v: Number(breadData?.accrued || 0), c: "#059669" },
                              { l: "مُحوَّل للخزينة", v: Number(breadData?.settled || 0), c: "#2563eb" },
                              { l: "رصيد المستحقات (راكن)", v: Number(breadData?.balance || 0), c: "#d97706" },
                            ].map((s) => (
                              <div key={s.l} className="rounded-xl p-2.5 text-center" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
                                <div className="text-[10px] font-black mb-1" style={{ color: "var(--text-muted)" }}>{s.l}</div>
                                <div className="font-mono font-black text-[16px]" style={{ color: s.c }}>{s.v.toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                          <div className="px-4 pt-2.5 flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => { setBreadForm((v) => !v); setStMsg(""); }}
                              disabled={Number(breadData?.balance || 0) <= 0}
                              className="h-8 px-3 rounded-lg text-[12px] font-black cursor-pointer transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{ background: "#059669", color: "#fff" }}
                            >
                              صرف نقاط الخبز ← الخزينة
                            </button>
                            {stMsg && <span className="text-[11px] font-black" style={{ color: stMsg.includes("✅") ? "#059669" : "#e11d48" }}>{stMsg}</span>}
                          </div>
                          {breadForm && (
                            <div className="mx-4 mt-2 p-3 rounded-xl flex items-end gap-2 flex-wrap" style={{ background: "var(--bg-card-hover)", border: "1px dashed var(--border-strong)" }}>
                              <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-black" style={{ color: "var(--text-muted)" }}>الشهر المتسوّي</span>
                                <input type="month" value={stPeriod} onChange={(e) => setStPeriod(e.target.value)} className="h-8 px-2 rounded-lg text-[12px] font-bold" style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-black" style={{ color: "var(--text-muted)" }}>التاريخ</span>
                                <input type="date" value={stDate} onChange={(e) => setStDate(e.target.value)} className="h-8 px-2 rounded-lg text-[12px] font-bold" style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-black" style={{ color: "var(--text-muted)" }}>المبلغ (المتاح {Number(breadData?.balance || 0).toFixed(2)})</span>
                                <input type="number" step="0.01" value={stAmount} onChange={(e) => setStAmount(e.target.value)} placeholder="0.00" className="h-8 w-28 px-2 rounded-lg text-[12px] font-bold font-mono" style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                              </label>
                              <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
                                <span className="text-[10px] font-black" style={{ color: "var(--text-muted)" }}>ملاحظة</span>
                                <input type="text" value={stNote} onChange={(e) => setStNote(e.target.value)} placeholder="رد البنك..." className="h-8 px-2 rounded-lg text-[12px] font-bold" style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                              </label>
                              <button
                                onClick={saveSettlement}
                                disabled={stSaving}
                                className="h-8 px-4 rounded-lg text-[12px] font-black cursor-pointer disabled:opacity-50"
                                style={{ background: "var(--accent)", color: "#fff" }}
                              >
                                {stSaving ? "جارٍ الحفظ..." : "تأكيد التحويل"}
                              </button>
                            </div>
                          )}
                          {!report ? (
                          <div className="px-4 py-7 text-center text-[12px] font-black" style={{ color: "var(--text-muted)" }}>{reportLoading ? "جارٍ التحميل..." : "تعذر تحميل الفواتير"}</div>
                        ) : breadInvoices.length === 0 ? (
                          <div className="px-4 py-7 text-center text-[12px] font-black" style={{ color: "var(--text-muted)" }}>مفيش فواتير فيها نقاط خبز في {selectedMonth}</div>
                        ) : (
                          <table className="w-full text-right text-xs border-collapse">
                            <thead>
                              <tr style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)" }}>
                                <th className="py-2 px-3 font-black">#</th>
                                <th className="py-2 px-3 font-black">رقم الفاتورة</th>
                                <th className="py-2 px-3 font-black">التاريخ</th>
                                <th className="py-2 px-3 font-black">العميل</th>
                                <th className="py-2 px-3 font-black">نقاط الخبز</th>
                                <th className="py-2 px-3 font-black text-center">إجراءات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {breadInvoices.map((inv: any, i: number) => (
                                <tr key={inv.invoice_number + i} style={{ background: i % 2 ? "var(--bg-card-hover)" : "var(--bg-card)" }}>
                                  <td className="py-2 px-3 font-mono font-black" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                                  <td className="py-2 px-3 font-mono font-bold" style={{ color: "var(--text-secondary)" }}>{inv.invoice_number}</td>
                                  <td className="py-2 px-3 font-mono font-bold" style={{ color: "var(--text-secondary)" }}>{inv.date}</td>
                                  <td className="py-2 px-3 font-bold" style={{ color: "var(--text-primary)" }}>{inv.customer_supplier_name || "—"}</td>
                                  <td className="py-2 px-3 font-mono font-black" style={{ color: "#059669" }}>{Number(inv.bread_points || 0)}</td>
                                  {invActionsCell(inv)}
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: "var(--bg-input)", borderTop: "2px solid var(--border-strong)" }}>
                                <td className="py-2 px-3 font-black" colSpan={5} style={{ color: "var(--text-secondary)" }}>إجمالي {breadInvoices.length} فاتورة</td>
                                <td className="py-2 px-3 font-mono font-black" style={{ color: "#059669" }}>
                                  {breadInvoices.reduce((s: number, inv: any) => s + Number(inv.bread_points || 0), 0)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        )
                        }
                        {/* تقرير التحويلات السابقة (للاطلاع بعدين) */}
                        <div className="px-4 py-3">
                          <div className="text-[11px] font-black mb-1.5" style={{ color: "var(--text-secondary)" }}>تقرير التحويلات للخزينة</div>
                          {settlements.length === 0 ? (
                            <div className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>مفيش تحويلات لحد دلوقتي — الرصيد كله لسه راكن عند البنك</div>
                          ) : (
                            <table className="w-full text-right text-xs border-collapse">
                              <thead>
                                <tr style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)" }}>
                                  <th className="py-1.5 px-2 font-black">#</th>
                                  <th className="py-1.5 px-2 font-black">التاريخ</th>
                                  <th className="py-1.5 px-2 font-black">المبلغ</th>
                                  <th className="py-1.5 px-2 font-black">ملاحظة</th>
                                  <th className="py-1.5 px-2 font-black">المُدخل</th>
                                </tr>
                              </thead>
                              <tbody>
                                {settlements.map((s: any, i: number) => (
                                  <tr key={s.id} style={{ background: i % 2 ? "var(--bg-card-hover)" : "var(--bg-card)" }}>
                                    <td className="py-1.5 px-2 font-mono font-black" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                                    <td className="py-1.5 px-2 font-mono font-bold" style={{ color: "var(--text-secondary)" }}>{String(s.date || "").slice(0, 10)}</td>
                                    <td className="py-1.5 px-2 font-mono font-black" style={{ color: "#2563eb" }}>{Number(s.amount || 0).toFixed(2)}</td>
                                    <td className="py-1.5 px-2 font-bold" style={{ color: "var(--text-muted)" }}>{s.note || "—"}</td>
                                    <td className="py-1.5 px-2 font-bold" style={{ color: "var(--text-muted)" }}>{s.created_by || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                        </div>
                      )}
                    </div>

                    {sumBox === "smart" && (
                      <div className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap" style={{ background: "var(--bg-card-hover)", borderTop: "2px solid var(--border-strong)" }}>
                        <span className="text-[11px] font-black font-mono" style={{ color: "var(--text-muted)" }}>
                          إجمالي: مبيعات {Number(mt.smartSales || 0).toFixed(2)} • دعم {Number(mt.smartSupport || 0).toFixed(2)} • الفرق {diff < 0 ? "−" : ""}{Math.abs(diff).toFixed(2)} (الفرق = الدعم − المبيعات)
                        </span>
                        <button
                          onClick={() => { setSumBox(null); openCardDetails("machine"); }}
                          className="h-7 px-3 rounded-lg text-[11px] font-black cursor-pointer transition-all hover:opacity-80"
                          style={{ background: "var(--accent)", color: "#fff" }}
                        >
                          فتح شاشة المطابقة كاملة
                        </button>
                      </div>
                    )}
                  </div>
                  </div>
                )}
              </div>
            );
          })()}
          {/* صف المربعات الثلاثة */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: "sales", label: "إجمالي مبيعات التموين", value: (monthSummary.sales || 0).toFixed(2), unit: "ج.م", Icon: BarChart3, accent: "#2563eb", iconBg: "rgba(37,99,235,.12)" },
              { key: "replacements", label: "إجمالي الاستعاضات", value: (monthSummary.replacements || 0).toFixed(2), unit: "ج.م", Icon: RefreshCw, accent: "#7c3aed", iconBg: "rgba(124,58,237,.12)" },
              { key: "profit", label: "صافي ربح التموين الفعلي", value: (monthSummary.profit || 0).toFixed(2), unit: "ج.م", Icon: Gem, accent: "#059669", iconBg: "rgba(5,150,105,.12)", sub: `مكاسب: ${(monthSummary.gains || 0).toFixed(2)} • خسائر: ${(monthSummary.losses || 0).toFixed(2)}` },
            ].map((c) => {
              const Icon = c.Icon;
              return (
                <div
                  key={c.key}
                  onClick={() => openCardDetails(c.key)}
                  title="اضغط لعرض التفاصيل"
                  className="group relative p-4 rounded-2xl text-right cursor-pointer transition-all duration-200 hover:-translate-y-1 overflow-hidden min-h-[124px] flex flex-col justify-between"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05)" }}
                >
                  <span className="absolute top-0 inset-x-0 h-[3px]" style={{ background: c.accent }} />
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[12px] font-bold leading-snug pt-0.5" style={{ color: "var(--text-secondary)" }}>{c.label}</span>
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.iconBg, color: c.accent }}>
                      <Icon size={18} strokeWidth={2.25} />
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 flex-wrap mt-1">
                    <h4 className="text-[30px] font-black font-mono leading-none tracking-tight" style={{ color: "var(--text-primary)" }}>{c.value}</h4>
                    <span className="text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>{c.unit}</span>
                  </div>
                  {(c as any).sub && <span className="text-[11px] font-semibold block mt-1.5 leading-snug" style={{ color: "var(--text-muted)" }}>{(c as any).sub}</span>}
                  <span className="text-[11px] font-bold flex items-center gap-1 mt-2.5" style={{ color: c.accent }}>
                    التفاصيل
                    <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* مخطط حجم المبيعات — عنصر إضافي منفصل */}
      <div className="px-4 pt-4 shrink-0 no-print">
        <div className="rounded-xl border-2 overflow-hidden shadow-lg" style={{ borderColor: "var(--border-strong)", background: "var(--bg-card)" }}>
          <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b-2" style={{ borderColor: "var(--border-strong)", background: "var(--bg-input)" }}>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-7 rounded-full" style={{ background: "var(--accent)" }} />
              <div className="text-right">
                <h3 className="text-sm font-black text-[#000000]">رسم بياني لحجم المبيعات</h3>
                <p className="text-[11px] font-bold text-[#555555]">تحليل توزّع المبيعات بالساعات أو الأيام — {selectedMonth}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-lg border" style={{ background: "var(--bg-input)", borderColor: "var(--border-strong)" }}>
                <button
                  onClick={() => setChartViewType("hourly")}
                  className="h-7 px-3 text-[11px] font-black rounded-md cursor-pointer transition-all"
                  style={chartViewType === "hourly"
                    ? { background: "var(--bg-deep)", color: "var(--text-primary)" }
                    : { background: "transparent", color: "var(--text-primary)" }}
                >ساعات اليوم</button>
                <button
                  onClick={() => setChartViewType("daily")}
                  className="h-7 px-3 text-[11px] font-black rounded-md cursor-pointer transition-all"
                  style={chartViewType === "daily"
                    ? { background: "var(--bg-deep)", color: "var(--text-primary)" }
                    : { background: "transparent", color: "var(--text-primary)" }}
                >الأيام</button>
              </div>
              {chartViewType === "hourly" && (
                <input
                  type="date"
                  value={chartDate}
                  min={`${selectedMonth}-01`}
                  max={`${selectedMonth}-${String(new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate()).padStart(2, "0")}`}
                  onChange={(e) => setChartDate(e.target.value)}
                  className="h-8 px-2 border rounded-lg text-[11px] font-black font-mono"
                  style={{ background: "var(--bg-input)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }}
                />
              )}
            </div>
          </div>
          <div className="h-[280px] p-3" style={{ direction: "ltr" }}>
            {chartDataArray.length > 0 && chartDataArray.some((d) => d.المبيعات > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataArray} margin={{ top: 12, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#888888" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#555555", fontWeight: "bold" }} dy={5} interval={chartViewType === "hourly" ? 1 : 0} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#555555", fontWeight: "bold" }} dx={-4} width={48} />
                  <RechartsTooltip
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)", borderRadius: "10px", fontSize: "11px", fontWeight: "bold", color: "var(--text-primary)", direction: "rtl" }}
                    itemStyle={{ color: "var(--text-primary)" }}
                    labelStyle={{ color: "var(--text-secondary)" }}
                    formatter={(value: number) => [`${Number(value).toFixed(2)} ج.م`, "المبيعات"]}
                  />
                  <Bar dataKey="المبيعات" fill="#1971C2" maxBarSize={36} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center" style={{ direction: "rtl" }}>
                <LineChartIcon size={36} strokeWidth={1.5} className="mb-2 text-[#555555]" />
                <p className="font-bold text-xs text-[#555555]">لا توجد سجلات مبيعات في الفترة المحددة.</p>
                <p className="font-bold text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>
                  {chartViewType === "hourly" ? `يوم ${chartDate}` : `شهر ${selectedMonth}`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* مودال تفاصيل المربع */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ direction: "rtl" }}>
          <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-y-auto border border-[#888888] shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#888888] bg-[#222222] text-[#c3c6bb] sticky top-0 z-10">
              <h3 className="text-sm font-black">
                {selectedCard === "sales" && "تفاصيل مبيعات التموين"}
                {selectedCard === "replacements" && "تفاصيل الاستعاضات"}
                {selectedCard === "disbursed" && "تفاصيل الدعم المنصرف (البطاقات)"}
                {selectedCard === "remaining" && "تفاصيل المتبقي من الاستعاضات"}
                {selectedCard === "cards" && "البطاقات المصروفة"}
                {selectedCard === "bread" && "نقاط الخبز المصروفة"}
                {selectedCard === "profit" && (profitSrc === "card" ? "تفاصيل صافي الربح بالبطاقة" : "تفاصيل صافي الربح بدون بطاقة")}
                {selectedCard === "machine" && "مطابقة سمارت"}
                <span className="font-mono"> — {selectedMonth}</span>
              </h3>
              <div className="flex items-center gap-2">
                <select value={selectedMonth.slice(5, 7)} onChange={(e) => setSelectedMonth(`${selectedMonth.slice(0, 4)}-${e.target.value}`)}
                  className="h-7 px-1 bg-white text-black text-[11px] font-bold cursor-pointer" title="الشهر">
                  {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select value={selectedMonth.slice(0, 4)} onChange={(e) => setSelectedMonth(`${e.target.value}-${selectedMonth.slice(5, 7)}`)}
                  className="h-7 px-1 bg-white text-black text-[11px] font-bold cursor-pointer" title="السنة">
                  {Array.from({ length: 2050 - 2024 + 1 }, (_, i) => 2024 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <UnifiedPrintButton printableId="rep-modal-printable" thermalId="rep-modal-printable" title="طباعة" variant="primary" printLayout="wide" />
                <button onClick={() => setSelectedCard(null)} className="cursor-pointer hover:opacity-70"><X size={20} /></button>
              </div>
            </div>
            <div className="p-4" id="rep-modal-printable">
              {selectedCard === "machine" && (
                <>
                  {/* لوحة الملخص الفخمة */}
                  <div className="rounded-2xl overflow-hidden border-2 mb-4" style={{ borderColor: "#e5e7eb", background: "var(--bg-card)", boxShadow: "0 8px 26px rgba(0,0,0,.1)" }}>
                    <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: "1px solid #eee" }}>
                      <div className="flex items-center gap-2.5">
                        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(217,119,6,.14)", border: "1px solid rgba(217,119,6,.4)", color: "#d97706" }}>
                          <Monitor size={18} strokeWidth={2.25} />
                        </span>
                        <div>
                          <div className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>تسوية نهاية الشهر</div>
                          <div className="text-[11px] font-bold font-mono" style={{ color: "var(--text-muted)" }}>أدخل مبيعات سمارت ودعم سمارت اليومي، والفرق بينهم = الخصم من الدعم</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-md font-mono" style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}>
                        {machineData?.entries || 0} يوم مُدخل
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
                      {(() => {
                        const mt = machineData?.totals || { smartSales: 0, smartSupport: 0, diff: 0 };
                        const diff = Number(mt.diff || 0);
                        const dTone = (v: number) => (v < 0 ? "var(--danger)" : v > 0 ? "var(--warning)" : "var(--primary)");
                        const tiles = [
                          { k: "sales", label: "إجمالي مبيعات سمارت (يدوي)", value: Number(mt.smartSales || 0), icon: <BarChart3 size={16} strokeWidth={2.25} />, c: "var(--primary)", bg: "rgba(37,99,235,.1)" },
                          { k: "support", label: "قيمة الدعم من سمارت (يدوي)", value: Number(mt.smartSupport || 0), icon: <CreditCard size={16} strokeWidth={2.25} />, c: "var(--series-2)", bg: "rgba(124,58,237,.1)" },
                          { k: "diff", label: "الفرق", value: diff, icon: <Gem size={16} strokeWidth={2.25} />, c: dTone(diff), bg: dTone(diff) === "var(--danger)" ? "rgba(225,29,72,.1)" : dTone(diff) === "var(--warning)" ? "rgba(217,119,6,.1)" : "rgba(37,99,235,.1)" },
                        ];
                        return tiles.map((t) => (
                          <div key={t.k} className="rounded-xl p-3.5 border" style={{ background: "var(--bg-input)", borderColor: "var(--border)" }}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-black leading-snug" style={{ color: "var(--text-secondary)" }}>{t.label}</span>
                              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.bg, border: `1px solid ${t.c}55`, color: t.c }}>{t.icon}</span>
                            </div>
                            <div className="flex items-baseline gap-1.5 mt-2">
                              <span className="text-[26px] font-black font-mono leading-none" style={{ color: t.c }}>
                                {t.value < 0 ? "−" : ""}{Math.abs(t.value).toFixed(2)}
                              </span>
                              <span className="text-xs font-black" style={{ color: "var(--text-muted)" }}>ج.م</span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* نموذج الإدخال */}
                  <div className="rounded-xl border-2 p-3 mb-4" style={{ borderColor: "#b8bcb2", background: "var(--bg-card)", boxShadow: "0 4px 18px rgba(0,0,0,.08)" }}>
                    <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                      <span className="h-0.5 w-6 rounded-full" style={{ background: "#d97706" }} />
                      <span className="text-[12px] font-black text-[#222222]">إدخال / تعديل يوم</span>
                      {machMsg && <span className="text-[11px] font-black" style={{ color: machMsg.indexOf("تم الحفظ") === 0 ? "#059669" : "#e11d48" }}>{machMsg}</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-black mb-1 text-[var(--text-secondary)]">التاريخ</label>
                        <input type="date" value={machDay} onChange={(e) => setMachDay(e.target.value)} className="w-full h-9 px-2 border rounded-lg text-xs font-mono font-bold" style={{ borderColor: "var(--border-strong)", background: "var(--bg-card)" }} />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-black mb-1 text-[var(--text-secondary)]">إجمالي مبيعات سمارت (ج.م)</label>
                        <input type="number" inputMode="decimal" value={machSales} onChange={(e) => setMachSales(e.target.value)} placeholder="0.00" className="w-full h-9 px-2 border rounded-lg text-xs font-mono font-black" style={{ borderColor: "var(--border-strong)", background: "var(--bg-card)" }} />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-black mb-1 text-[var(--text-secondary)]">قيمة الدعم من سمارت (ج.م)</label>
                        <input type="number" inputMode="decimal" value={machSupport} onChange={(e) => setMachSupport(e.target.value)} placeholder="0.00" className="w-full h-9 px-2 border rounded-lg text-xs font-mono font-black" style={{ borderColor: "var(--border-strong)", background: "var(--bg-card)" }} />
                      </div>
                      <div className="sm:col-span-4">
                        <label className="block text-[10px] font-black mb-1 text-[var(--text-secondary)]">الفرق — الخصم من الدعم</label>
                        <input type="number" inputMode="decimal" value={machDiff} onChange={(e) => setMachDiff(e.target.value)} placeholder="0.00" className="w-full h-9 px-2 border rounded-lg text-xs font-mono font-black" style={{ borderColor: "var(--border-strong)", background: "var(--bg-card)" }} />
                      </div>
                      <div className="sm:col-span-8">
                        <label className="block text-[10px] font-black mb-1 text-[var(--text-secondary)]">ملاحظة (اختياري)</label>
                        <input type="text" value={machNote} onChange={(e) => setMachNote(e.target.value)} placeholder="مثال: تحصيل شبكة" className="w-full h-9 px-2 border rounded-lg text-xs font-bold" style={{ borderColor: "var(--border-strong)", background: "var(--bg-card)" }} />
                      </div>
                      <div className="sm:col-span-4">
                        <button onClick={saveMachineDay} disabled={machSaving} className="w-full h-9 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50" style={{ background: "#047857", color: "#ffffff", border: "1px solid #047857" }}>
                          <Plus size={14} /> {machSaving ? "جارٍ الحفظ..." : "حفظ"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* جدول المطابقة اليومي */}
                  {(() => {
                    const list: any[] = machineData?.list || [];
                    if (!list.length) return (
                      <div className="text-center py-10 rounded-xl border-2 border-dashed" style={{ borderColor: "#c9c9c9", background: "#fafafa" }}>
                        <div className="flex justify-center mb-2" style={{ color: "#6b7280" }}><Monitor size={28} strokeWidth={2} /></div>
                        <div className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>لا توجد بيانات مطابقة لهذا الشهر</div>
                        <div className="text-[11px] font-bold mt-1" style={{ color: "var(--text-muted)" }}>ابدأ بإدخال مبيعات سمارت ودعم سمارت من النموذج بالأعلى</div>
                      </div>
                    );
                    const mt = machineData?.totals || { smartSales: 0, smartSupport: 0, diff: 0 };
                    const dTone = (v: number) => (v < 0 ? "var(--danger)" : v > 0 ? "var(--warning)" : "var(--primary)");
                    const cells = [
                      { l: "إجمالي مبيعات سمارت", v: Number(mt.smartSales || 0), c: "var(--primary)" },
                      { l: "إجمالي دعم سمارت", v: Number(mt.smartSupport || 0), c: "var(--series-2)" },
                      { l: "الفرق", v: Number(mt.diff || 0), c: dTone(Number(mt.diff || 0)) },
                    ];
                    return (
                      <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: "var(--border)", boxShadow: "0 6px 22px rgba(0,0,0,.08)" }}>
                        <table className="w-full text-right text-xs border-collapse">
                          <thead>
                            <tr style={{ background: "var(--bg-input)", color: "var(--text-primary)", borderBottom: "2px solid var(--border-strong)" }}>
                              <th className="py-2.5 px-3 font-black">#</th>
                              <th className="py-2.5 px-3 font-black">التاريخ</th>
                              <th className="py-2.5 px-3 font-black">مبيعات سمارت (يدوي)</th>
                              <th className="py-2.5 px-3 font-black">دعم سمارت (يدوي)</th>
                              <th className="py-2.5 px-3 font-black">الفرق</th>
                              <th className="py-2.5 px-3 font-black">ملاحظة</th>
                              <th className="py-2.5 px-3 font-black text-center">إجراء</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((d, i) => {
                              const zero = Math.abs(Number(d.diff) || 0) < 0.005;
                              const tone = zero ? { bg: "#f3f4f6", fg: "#495057", bd: "#e5e7eb" }
                                : d.diff > 0 ? { bg: "#fffbeb", fg: "#b45309", bd: "#fcd34d" }
                                : { bg: "#fef2f2", fg: "#be123c", bd: "#fca5a5" };
                              const manual = d.hasManualDiff;
                              return (
                                <tr key={d.day} style={{ background: i % 2 ? "var(--bg-card-hover)" : "var(--bg-card)" }}>
                                  <td className="py-2 px-3 font-mono font-black" style={{ color: "var(--text-secondary)" }}>{i + 1}</td>
                                  <td className="py-2 px-3 font-mono font-black">{d.day}</td>
                                  <td className="py-2 px-3 font-mono font-black" style={{ color: "var(--primary)" }}>{Number(d.smartSales || 0).toFixed(2)}</td>
                                  <td className="py-2 px-3 font-mono font-black" style={{ color: "var(--series-2)" }}>{Number(d.smartSupport || 0).toFixed(2)}</td>
                                  <td className="py-2 px-3">
                                    <span className="inline-block px-2 py-0.5 rounded-md font-mono font-black text-[11px]" style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.bd}` }}>
                                      {d.diff > 0 ? "+" : d.diff < 0 ? "−" : ""}{Math.abs(Number(d.diff) || 0).toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 font-bold" style={{ color: "var(--text-secondary)" }}>{d.note || "—"}</td>
                                  <td className="py-2 px-3 text-center whitespace-nowrap">
                                    <button onClick={() => { setMachDay(d.day); setMachSales(String(Number(d.smartSales || 0))); setMachSupport(String(Number(d.smartSupport || 0))); setMachDiff(manual ? String(Number(d.diff || 0)) : ""); setMachNote(d.note || ""); }} className="ml-1 cursor-pointer hover:opacity-70" title="تعديل"><Edit size={14} /></button>
                                    <button onClick={() => deleteMachineDay(d.day)} className="cursor-pointer hover:opacity-70" title="حذف"><Trash2 size={14} color="#e11d48" /></button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="grid grid-cols-3" style={{ background: "var(--bg-card-hover)", borderTop: "2px solid var(--border-strong)" }}>
                          {cells.map((c) => (
                            <div key={c.l} className="px-3 py-2.5 text-center" style={{ borderRight: "1px solid var(--border)" }}>
                              <div className="text-[10px] font-black" style={{ color: "var(--text-secondary)" }}>{c.l}</div>
                              <div className="text-[16px] font-black font-mono" style={{ color: c.c }}>
                                {c.v < 0 ? "−" : ""}{Math.abs(c.v).toFixed(2)} <span className="text-[10px]">ج.م</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
              {(selectedCard === "sales" || selectedCard === "profit") && (
                <>
                <div className="sticky top-[64px] z-[5] bg-white pb-2 space-y-2">
                  {selectedCard === "sales" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(() => {
                        const tTot = ((cardDetails?.tamweenAllItems) || []).reduce((s: number, it: any) => s + Number(it.total || 0), 0);
                        const fTot = ((cardDetails?.freeSalesItems) || []).reduce((s: number, it: any) => s + Number(it.total || 0), 0);
                        const boxes = [
                          { key: "t", label: "بضاعة تموين مباعة في التموين", value: tTot, icon: "📦", bg: "#ffffff", fg: "#065f46", accent: "#059669" },
                          { key: "f", label: "بضاعة حر مباعة في التموين", value: fTot, icon: "🛒", bg: "#ffffff", fg: "#1e40af", accent: "#2563eb" },
                          { key: "g", label: "إجمالي الحر والتموين المباع في التموين", value: tTot + fTot, icon: "💰", bg: "#ffffff", fg: "#6d28d9", accent: "#7c3aed" },
                        ];
                        return boxes.map((b) => (
                          <div
                            key={b.key}
                            className="p-4 border-2 text-right rounded-xl shadow-lg overflow-hidden min-h-[96px] flex flex-col justify-between"
                            style={{ background: b.bg, borderColor: b.accent, color: b.fg, boxShadow: `0 4px 20px ${b.accent}33` }}
                          >
                            <span className="text-[12px] font-black leading-snug" style={{ color: b.fg }}>{b.label}</span>
                            <div className="flex items-baseline gap-1.5 flex-wrap mt-1">
                              <h4 className="text-[24px] font-black font-mono leading-none tracking-tight" style={{ color: b.accent }}>{b.value.toFixed(2)}</h4>
                              <span className="text-xs font-black" style={{ color: b.fg }}>ج.م</span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                  <>
                  {selectedCard === "profit" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {([
                        { k: "card" as const, label: "صافي ربح التموين بالبطاقة", sub: "أصناف تموينية اتباعت بكارت الدعم", accent: "#2563eb" },
                        { k: "nocard" as const, label: "صافي ربح التموين بدون بطاقة", sub: "أصناف تموينية اتباعت كاش/آجل", accent: "#d97706" },
                      ]).map((s) => {
                        const active = profitSrc === s.k;
                        return (
                          <button
                            key={s.k}
                            onClick={() => { setProfitSrc(s.k); setPageModal(1); }}
                            title="اضغط لعرض تفاصيل الربح والخسارة"
                            className="p-3.5 rounded-xl border-2 text-right cursor-pointer transition-all hover:-translate-y-0.5"
                            style={{ background: active ? `${s.accent}12` : "#ffffff", borderColor: active ? s.accent : "#e5e7eb", boxShadow: active ? `0 6px 18px ${s.accent}33` : "0 1px 2px rgba(0,0,0,.05)" }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12px] font-black leading-snug" style={{ color: active ? s.accent : "#374151" }}>{s.label}</span>
                              <span
                                className="text-[9px] font-black px-2 py-0.5 rounded-md shrink-0"
                                style={active ? { background: s.accent, color: "#fff" } : { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}
                              >
                                {active ? "مفعّل" : "افتح"}
                              </span>
                            </div>
                            <div className="text-[10px] font-bold mt-0.5" style={{ color: "#6b7280" }}>{s.sub}</div>
                            <div className="flex items-baseline gap-1.5 mt-1.5">
                              <span className="text-[22px] font-black font-mono leading-none" style={{ color: s.accent }}>
                                {netOf(s.k) < 0 ? "−" : ""}{Math.abs(netOf(s.k)).toFixed(2)}
                              </span>
                              <span className="text-[11px] font-black" style={{ color: "#6b7280" }}>ج.م</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="rounded-xl overflow-hidden border border-[#222222]" style={{ background: "var(--bg-card)" }}>
                    <div className="px-5 py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-hover))" }}>
                          <span className="text-[#c3c6bb] font-black text-xl leading-none">₺</span>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-black text-[#555555] tracking-wide">{selectedCard === "profit" ? (profitSrc === "card" ? "صافي ربح التموين بالبطاقة" : "صافي ربح التموين بدون بطاقة") : "إجمالي مبيعات الدعم"}</div>
                          <div className="text-[10px] text-[#6b7280] font-bold">{selectedMonth}</div>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-3xl font-black font-mono leading-none text-[#000000]">
                          {selectedCard === "profit"
                            ? profitNet.toFixed(2)
                            : (((cardDetails?.salesItems) || []).reduce((s: number, it: any) => s + Number(it.total || 0), 0)).toFixed(2)}
                        </div>
                        <div className="text-[11px] font-bold text-[#555555] mt-0.5">جنيه مصري</div>
                      </div>
                    </div>
                  </div>
                  {selectedCard === "profit" && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-2 border shadow-sm" style={{ background: "linear-gradient(135deg,#ecfdf5,#d1fae5)", borderColor: "#34d399" }}>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#059669", boxShadow: "0 0 8px rgba(5,150,105,.6)" }} />
                          <span className="text-[11px] font-black text-[#047857]">قيمة الربح</span>
                        </div>
                        <span className="text-xl font-black font-mono text-[#047857] leading-none">
                          {profitGain.toFixed(2)}
                        </span>
                      </div>
                      <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-2 border-2 shadow-md" style={{ background: "linear-gradient(135deg,#fff1f2,#ffe4e6)", borderColor: "#e11d48", boxShadow: "0 0 16px rgba(225,29,72,.25)" }}>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "#e11d48", boxShadow: "0 0 10px rgba(225,29,72,.8)" }} />
                          <span className="text-[11px] font-black text-[#e11d48]">قيمة الخسارة</span>
                        </div>
                        <span className="text-xl font-black font-mono text-[#e11d48] leading-none" style={{ textShadow: "0 0 12px rgba(225,29,72,.35)" }}>
                          {profitLoss.toFixed(2)}
                        </span>
                      </div>
                      <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-2 border" style={{ background: "#d1fae5", borderColor: "#059669" }}>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#059669" }} />
                          <span className="text-[11px] font-black text-[#065f46]">الصافي</span>
                        </div>
                        <span className="text-xl font-black font-mono text-[#065f46] leading-none">
                          {profitNet.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </div>
                <div className="rounded-xl overflow-hidden border border-[#e5e7eb] shadow-sm">
                  <table className="w-full text-right text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#222222] text-[#c3c6bb]">
                        <th className="py-2.5 px-3 font-black border-b-2 border-[#c3c6bb]">#</th>
                        <th className="py-2.5 px-3 font-black border-b-2 border-[#c3c6bb]">الصنف</th>
                        {selectedCard === "sales" && <th className="py-2.5 px-3 text-center font-black border-b-2 border-[#c3c6bb]">البند</th>}
                        <th className="py-2.5 px-3 font-black border-b-2 border-[#c3c6bb]">الباركود</th>
                        <th className="py-2.5 px-3 text-center font-black border-b-2 border-[#c3c6bb]">الكمية</th>
                        <th className="py-2.5 px-3 text-center font-black border-b-2 border-[#c3c6bb]">السعر</th>
                        <th className="py-2.5 px-3 text-center font-black border-b-2 border-[#c3c6bb]">الإجمالي</th>
                        {selectedCard === "profit" && <th className="py-2.5 px-3 text-center font-black border-b-2 border-[#c3c6bb]">الربح</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {paginate(salesRows, pageModal).map((it: any, i: number) => {
                        const isLoss = selectedCard === "profit" && Number(it.profit || 0) < 0;
                        const isGain = selectedCard === "profit" && Number(it.profit || 0) > 0;
                        return (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"} style={isLoss ? { background: "#fff1f2" } : undefined}>
                            <td className="py-2 px-3 border-b border-[#e5e7eb] text-[#6b7280] font-mono text-xs">{(Math.min(pageModal, Math.max(1, Math.ceil(salesRows.length / PAGE_R))) - 1) * PAGE_R + i + 1}</td>
                            <td className="py-2 px-3 font-bold border-b border-[#e5e7eb]">{it.name}</td>
                            {selectedCard === "sales" && (
                              <td className="py-2 px-3 text-center border-b border-[#e5e7eb]">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black whitespace-nowrap"
                                  style={it.band === "tamween"
                                    ? { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" }
                                    : { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                                  {it.band === "tamween" ? "📦 تمويني" : "🛒 حر"}
                                </span>
                              </td>
                            )}
                            <td className="py-2 px-3 font-mono text-[10px] border-b border-[#e5e7eb] text-[#6b7280]">{it.barcode}</td>
                            <td className="py-2 px-3 text-center font-mono border-b border-[#e5e7eb]">{it.qty} {it.unit || ""}</td>
                            <td className="py-2 px-3 text-center font-mono border-b border-[#e5e7eb]">{Number(it.price || 0).toFixed(2)}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold border-b border-[#e5e7eb]">{Number(it.total || 0).toFixed(2)}</td>
                            {selectedCard === "profit" && (
                              <td className="py-2 px-3 text-center border-b border-[#e5e7eb]">
                                <span className="inline-block px-2 py-0.5 rounded-md font-mono font-black text-xs" style={isLoss ? { background: "#e11d48", color: "#fff", boxShadow: "0 0 10px rgba(225,29,72,.35)" } : isGain ? { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" } : { color: "var(--text-secondary)" }}>
                                  {Number(it.profit || 0).toFixed(2)}
                                </span>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {renderPager(salesRows.length, pageModal, setPageModal)}
                </>
              )}
              {selectedCard === "replacements" && (
                <>
                {/* مربع إجمالي قيمة الاستعاضات + المتبقي — ثابت فوق */}
                <div className="sticky top-[64px] z-[5] bg-white grid grid-cols-2 gap-2 mb-3 pb-1">
                  <div className="rounded-xl overflow-hidden border border-[#222222]" style={{ background: "var(--bg-card)" }}>
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="text-right">
                        <div className="text-[11px] font-black text-[#555555]">إجمالي قيمة الاستعاضات</div>
                        <div className="text-[10px] text-[#6b7280] font-bold">{selectedMonth}</div>
                      </div>
                      <div className="text-left">
                        <div className="text-2xl font-black font-mono leading-none text-[#000000]">
                          {filteredReplacements.reduce((s: number, r: any) => s + Number(r.total_value || 0), 0).toFixed(2)}
                        </div>
                        <div className="text-[10px] font-bold text-[#555555] mt-0.5">ج.م</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-[#d97706]" style={{ background: "linear-gradient(135deg,#fffbeb 0%,#fef3c7 55%,#fde68a 100%)" }}>
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="text-right">
                        <div className="text-[11px] font-black text-[#92400e]">إجمالي المتبقي من الاستعاضات</div>
                        <div className="text-[10px] text-[#b45309] font-bold opacity-80">{selectedMonth}</div>
                      </div>
                      <div className="text-left">
                        <div className="text-2xl font-black font-mono leading-none text-[#78350f]">
                          {(monthSummary?.remaining || 0).toFixed(2)}
                        </div>
                        <div className="text-[10px] font-bold text-[#92400e] mt-0.5">ج.م</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* ملخص الأصناف — جدول مدمج بخط واضح بدل المربعات الكبيرة */}
                {(() => {
                  const agg: Record<string, any> = {};
                  filteredReplacements.forEach((r: any) => {
                    parseItems(r.items_json).forEach((it: any) => {
                      const key = it.barcode || it.name;
                      if (!agg[key]) agg[key] = { key, name: it.name, barcode: it.barcode || "—", unit: it.unit || "", qty: 0, total: 0, price: Number(it.purchase_price) || 0 };
                      agg[key].qty += Number(it.quantity) || 0;
                      agg[key].total += (Number(it.quantity) || 0) * (Number(it.purchase_price) || 0);
                    });
                  });
                  const remByKey: Record<string, number> = {};
                  remainingDetails.forEach((rep: any) => {
                    (rep.items || []).forEach((it: any) => {
                      const key = it.barcode || it.name;
                      remByKey[key] = (remByKey[key] || 0) + (Number(it.remaining_quantity) || 0);
                    });
                  });
                  const list = Object.values(agg);
                  if (list.length === 0) return null;
                  const page = Math.min(pageSum, Math.max(1, Math.ceil(list.length / PAGE_R)));
                  return (
                    <div className="rounded-xl border border-[#e5e7eb] mt-3 overflow-hidden shadow-sm">
                      <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "var(--bg-deep)" }}>
                        <span className="w-1.5 h-5 rounded-sm" style={{ background: "var(--bg-card)" }} />
                        <span className="text-xs font-black text-[#c3c6bb]">ملخص أصناف الاستعاضات</span>
                      </div>
                      <table className="w-full text-right text-sm border-collapse">
                        <thead>
                          <tr style={{ background: "var(--bg-deep)", color: "var(--text-primary)" }}>
                            <th className="py-2.5 px-3 font-black border-b border-[#888888]">#</th>
                            <th className="py-2.5 px-3 font-black border-b border-[#888888]">الصنف</th>
                            <th className="py-2.5 px-3 font-black border-b border-[#888888]">الباركود</th>
                            <th className="py-2.5 px-3 text-center font-black border-b border-[#888888]">إجمالي الكمية</th>
                            <th className="py-2.5 px-3 text-center font-black border-b border-[#888888]">المتبقي</th>
                            <th className="py-2.5 px-3 text-center font-black border-b border-[#888888]">سعر القطعة</th>
                            <th className="py-2.5 px-3 text-center font-black border-b border-[#888888]">إجمالي القيمة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginate(list, pageSum).map((a: any, i: number) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"} style={{ borderBottom: "1px solid #eef2f7" }}>
                              <td className="py-2.5 px-3 font-mono text-[#64748b]">{(page - 1) * PAGE_R + i + 1}</td>
                              <td className="py-2.5 px-3 font-black text-sm text-[#000000]">{a.name}</td>
                              <td className="py-2.5 px-3 font-mono text-xs text-[#64748b]">{a.barcode}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-[#000000]">{a.qty} {a.unit}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">{remByKey[a.key] ?? 0} {a.unit}</td>
                              <td className="py-2.5 px-3 text-center font-mono text-[#64748b]">{Number(a.price || 0).toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-black text-[#b45309]">{Number(a.total || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {renderPager(list.length, pageSum, setPageSum)}
                    </div>
                  );
                })()}
                </>
              )}
              {selectedCard === "disbursed" && (
                <>
                {/* المربعات فوق الجدول — ثابتة */}
                <div className="sticky top-[64px] z-[5] bg-white grid grid-cols-3 gap-2 mb-3 pb-1">
                  <div className="p-4 text-center cursor-default transition-all duration-200 hover:-translate-y-0.5"
                    style={{ backgroundColor: "#2563eb", color: "#fff" }}
                    onMouseEnter={(e) => { (e.currentTarget as any).style.boxShadow = `0 0 16px #2563eb`; }}
                    onMouseLeave={(e) => { (e.currentTarget as any).style.boxShadow = "none"; }}>
                    <div className="text-xs font-black">إجمالي عدد البطاقات</div>
                    <div className="text-xl font-black mt-1 font-mono">{(cardDetails?.customers || []).length} بطاقة</div>
                  </div>
                  <div className="p-4 text-center" style={{ backgroundColor: "var(--bg-deep)", color: "var(--text-primary)" }}>
                    <div className="text-xs font-black">إجمالي الدعم المنصرف</div>
                    <div className="text-xl font-black mt-1 font-mono">
                      {(cardDetails?.customers || []).reduce((s: number, c: any) => s + Number(c.card_value || 0), 0).toFixed(2)} ج.م
                    </div>
                  </div>
                  <div className="p-4 text-center cursor-default transition-all duration-200 hover:-translate-y-0.5"
                    style={{ backgroundColor: "#92400e", color: "#fff" }}
                    onMouseEnter={(e) => { (e.currentTarget as any).style.boxShadow = `0 0 16px #92400e`; }}
                    onMouseLeave={(e) => { (e.currentTarget as any).style.boxShadow = "none"; }}>
                    <div className="text-xs font-black">نقاط الخبز</div>
                    <div className="text-xl font-black mt-1 font-mono">
                      {(cardDetails?.customers || []).reduce((s: number, c: any) => s + Number(c.bread_points || 0), 0).toFixed(2)} ج.م
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-[#e5e7eb] overflow-hidden shadow-sm">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr style={{ background: "var(--bg-deep)", color: "var(--text-primary)" }}>
                        <th className="py-2.5 px-3 font-black border-b border-[#888888]">#</th>
                        <th className="py-2.5 px-3 font-black border-b border-[#888888]">العميل</th>
                        <th className="py-2.5 px-3 font-black border-b border-[#888888]">الرقم السري</th>
                        <th className="py-2.5 px-3 text-center font-black border-b border-[#888888]">قيمة الدعم المصروف</th>
                        <th className="py-2.5 px-3 text-center font-black border-b border-[#888888]">قيمة نقاط الخبز</th>
                        <th className="py-2.5 px-3 text-center font-black border-b border-[#888888]">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginate(cardDetails?.customers || [], pageDis).map((c: any, i: number) => (
                        <tr key={c.id ?? i} className={i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"} style={{ borderBottom: "1px solid #eef2f7" }}>
                          <td className="py-2.5 px-3 font-mono text-[#64748b]">{(Math.min(pageDis, Math.max(1, Math.ceil((cardDetails?.customers || []).length / PAGE_R))) - 1) * PAGE_R + i + 1}</td>
                          <td className="py-2.5 px-3 font-black text-[#000000]">{c.name}</td>
                          <td className="py-2.5 px-3 font-mono text-[#64748b]">{c.secret_number}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-[#1d4ed8]">{Number(c.card_value || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-[#b45309]">{Number(c.bread_points || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => openRepHistory(c)}
                                className="bg-[#8e44ad] text-white p-1.5 hover:bg-[#7d3c98] transition-colors rounded" title="السجل">
                                <Eye size={14} />
                              </button>
                              <button onClick={() => openRepEdit(c)}
                                className="bg-blue-500 text-white p-1.5 hover:bg-blue-600 transition-colors rounded" title="تعديل">
                                <Edit size={14} />
                              </button>
                              <button onClick={() => deleteRepCustomer(c.id)}
                                className="bg-red-500 text-white p-1.5 hover:bg-red-600 transition-colors rounded" title="حذف">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {renderPager((cardDetails?.customers || []).length, pageDis, setPageDis)}
                </>
              )}
              {(selectedCard === "cards" || selectedCard === "bread") && (
                <>
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#222222] text-[#c3c6bb]">
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">العميل</th>
                      <th className="py-2 px-3">الرقم السري</th>
                      <th className="py-2 px-3 text-center">مبلغ البطاقة</th>
                      <th className="py-2 px-3 text-center">نقاط الخبز</th>
                      <th className="py-2 px-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#888888]/30">
                    {paginate(cardDetails?.customers || [], pageModal).map((c: any, i: number) => (
                      <tr key={c.id ?? i} className="hover:bg-[#f5f5f5]">
                        <td className="py-2 px-3">{(Math.min(pageModal, Math.max(1, Math.ceil(((cardDetails?.customers) || []).length / PAGE_R))) - 1) * PAGE_R + i + 1}</td>
                        <td className="py-2 px-3 font-bold">{c.name}</td>
                        <td className="py-2 px-3 font-mono">{c.secret_number}</td>
                        <td className="py-2 px-3 text-center font-mono">{c.card_value} ج.م</td>
                        <td className="py-2 px-3 text-center font-mono">{c.bread_points} ج.م</td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => openRepHistory(c)}
                              className="bg-[#8e44ad] text-white p-1.5 hover:bg-[#7d3c98] transition-colors" title="السجل">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => openRepEdit(c)}
                              className="bg-blue-500 text-white p-1.5 hover:bg-blue-600 transition-colors" title="تعديل">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => deleteRepCustomer(c.id)}
                              className="bg-red-500 text-white p-1.5 hover:bg-red-600 transition-colors" title="حذف">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#f5f5f5] font-black">
                    <tr>
                      <td colSpan={3} className="py-2 px-3 text-left">إجمالي الكل ({(cardDetails?.customers || []).length} بطاقة)</td>
                      <td className="py-2 px-3 text-center font-mono text-blue-700">{(cardDetails?.customers || []).reduce((s: number, c: any) => s + Number(c.card_value || 0), 0).toFixed(2)} ج.م</td>
                      <td className="py-2 px-3 text-center font-mono text-amber-700">{(cardDetails?.customers || []).reduce((s: number, c: any) => s + Number(c.bread_points || 0), 0).toFixed(2)} ج.م</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
                {renderPager((cardDetails?.customers || []).length, pageModal, setPageModal)}
                </>
              )}
              {selectedCard === "remaining" && (
                <div className="space-y-3">
                  {remainingDetails.length === 0 ? (
                    <div className="p-6 text-center text-[#555555] font-bold text-xs">لا توجد بيانات متبقي لهذا الشهر</div>
                  ) : (
                    <>
                    <div className="sticky top-[64px] z-[5] bg-[#222222] text-[#c3c6bb] p-3 text-xs font-black flex flex-wrap gap-x-5 gap-y-1 border border-[#888888]">
                      <span>إجمالي كل الاستعاضات:</span>
                      <span className="font-mono">الأصلية: {remainingDetails.reduce((s: number, r: any) => s + (r.items || []).reduce((a: number, it: any) => a + Number(it.original_quantity || 0), 0), 0)}</span>
                      <span className="font-mono">المنصرف: {remainingDetails.reduce((s: number, r: any) => s + (r.items || []).reduce((a: number, it: any) => a + Number(it.sold_quantity || 0), 0), 0)}</span>
                      <span className="font-mono">المتبقي: {remainingDetails.reduce((s: number, r: any) => s + (r.items || []).reduce((a: number, it: any) => a + Number(it.remaining_quantity || 0), 0), 0)}</span>
                    </div>
                    {paginate(remainingDetails, pageModal).map((rep: any) => (
                      <div key={rep.id} className="border border-[#888888] p-3">
                        <div className="flex justify-between text-xs font-black mb-2">
                          <span>📅 {rep.date} — {rep.supplier_name}</span>
                        </div>
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-[#222222] text-[#c3c6bb]">
                              <th className="py-1 px-2">الصنف</th>
                              <th className="py-1 px-2 text-center">الأصلية</th>
                              <th className="py-1 px-2 text-center">المباعة</th>
                              <th className="py-1 px-2 text-center">المتبقية</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#ddd]">
                            {(rep.items || []).map((it: any, i: number) => (
                              <tr key={i}>
                                <td className="py-1 px-2 font-bold">{it.name}</td>
                                <td className="py-1 px-2 text-center font-mono">{it.original_quantity}</td>
                                <td className="py-1 px-2 text-center font-mono text-red-500">{it.sold_quantity}</td>
                                <td className="py-1 px-2 text-center font-mono text-green-700 font-bold">{it.remaining_quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                    {renderPager(remainingDetails.length, pageModal, setPageModal)}
                    </>
                  )}
                </div>
              )}
              {!cardDetails && selectedCard !== "remaining" && (
                detailsLoaded ? (
                  <div className="p-6 text-center text-xs font-bold space-y-2">
                    <p className="text-[#e11d48]">تعذر تحميل التفاصيل من السيرفر.</p>
                    <p className="text-[#555555]">اقفل البرنامج وافتحه من ملف سطح المكتب ثم أعد المحاولة — غالباً النسخة المفتوحة أقدم من التحديث.</p>
                    <button onClick={() => setSelectedCard(null)} className="h-8 px-4 bg-[#222222] text-[#c3c6bb] text-xs font-black cursor-pointer">إغلاق</button>
                  </div>
                ) : (
                  <div className="p-6 text-center text-[#555555] font-bold text-xs">جاري تحميل التفاصيل...</div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* مودال سجل العميل (من داخل الاستعاضات) */}
      {repHistCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" style={{ direction: "rtl" }}>
          <div className="bg-white w-full max-w-3xl max-h-[85vh] overflow-y-auto border border-[#888888] shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#888888] bg-[#222222] text-[#c3c6bb] sticky top-0 z-10">
              <h3 className="text-sm font-black">سجل العميل: {repHistCustomer?.name} <span className="font-mono">({repHistCustomer?.secret_number})</span></h3>
              <button onClick={() => { setRepHistCustomer(null); setRepHistInvoices([]); }} className="cursor-pointer hover:opacity-70"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              {repHistLoading ? (
                <div className="p-8 text-center text-[#555555] font-bold text-xs">جاري تحميل السجل...</div>
              ) : repHistInvoices.length === 0 ? (
                <div className="p-6 text-center text-[#555555] font-bold text-xs">لا توجد فواتير مسجلة لهذا العميل</div>
              ) : (
                repHistInvoices.map((inv: any) => {
                  const items = Array.isArray(inv.items) ? inv.items : [];
                  const exp = repExpandedInv === inv.id;
                  return (
                    <div key={inv.id} className="border border-[#888888]">
                      <div className="bg-[#f5f5f5] px-3 py-2 flex flex-wrap justify-between items-center gap-2 text-xs font-black">
                        <span className="font-mono">#{inv.invoice_number}</span>
                        <span className="font-mono">{inv.date}</span>
                        <span className="font-mono text-blue-700">{Number(inv.total || 0).toFixed(2)} ج.م</span>
                        <button onClick={() => setRepExpandedInv(exp ? null : inv.id)}
                          className="h-6 px-2 bg-[#222222] text-[#c3c6bb] text-[10px] font-bold cursor-pointer">
                          {exp ? "إخفاء الأصناف ▲" : `عرض الأصناف (${items.length}) ▼`}
                        </button>
                      </div>
                      {exp && (
                        <table className="w-full text-right text-[11px]">
                          <thead>
                            <tr className="bg-[#222222] text-[#c3c6bb]">
                              <th className="py-1 px-2">#</th>
                              <th className="py-1 px-2">الصنف</th>
                              <th className="py-1 px-2 text-center">الكمية</th>
                              <th className="py-1 px-2 text-center">السعر</th>
                              <th className="py-1 px-2 text-center">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#ddd]">
                            {items.map((it: any, i: number) => (
                              <tr key={i}>
                                <td className="py-1 px-2">{i + 1}</td>
                                <td className="py-1 px-2 font-bold">{it.name}</td>
                                <td className="py-1 px-2 text-center font-mono">{it.quantity} {it.unit || ""}</td>
                                <td className="py-1 px-2 text-center font-mono">{Number(it.price || 0).toFixed(2)}</td>
                                <td className="py-1 px-2 text-center font-mono font-bold">{Number(it.total || 0).toFixed(2)}</td>
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

      {/* مودال تعديل العميل (من داخل الاستعاضات) */}
      {repEditCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" style={{ direction: "rtl" }}>
          <div className="bg-[#c3c6bb] border border-[#222222] p-5 w-full max-w-md relative space-y-3">
            <button onClick={() => setRepEditCustomer(null)}
              className="absolute top-3 left-3 w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer">
              <X size={14} />
            </button>
            <h3 className="text-sm font-black border-b border-[#888888] pb-2">تعديل بيانات العميل</h3>
            <div>
              <label className="block text-xs font-bold mb-1">اسم العميل *</label>
              <input type="text" value={repForm.name} onChange={(e) => setRepForm({ ...repForm, name: e.target.value })}
                className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">الرقم السري *</label>
                <input type="text" value={repForm.secret_number} onChange={(e) => setRepForm({ ...repForm, secret_number: e.target.value })}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">التليفون</label>
                <input type="text" value={repForm.phone} onChange={(e) => setRepForm({ ...repForm, phone: e.target.value })}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">مبلغ البطاقة</label>
                <input type="number" step="1" min="1" value={repForm.card_value || ""} onChange={(e) => setRepForm({ ...repForm, card_value: Number(e.target.value) || 0 })}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">نقاط الخبز</label>
                <input type="number" value={repForm.bread_points || ""} onChange={(e) => setRepForm({ ...repForm, bread_points: Number(e.target.value) || 0 })}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-xs font-bold" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveRepEdit} className="h-10 px-6 bg-[#27ae60] hover:bg-[#219a52] text-white font-black text-xs cursor-pointer">حفظ التعديلات</button>
              <button onClick={() => setRepEditCustomer(null)} className="h-10 px-6 bg-[#888888] hover:bg-[#666666] text-white font-black text-xs cursor-pointer">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== نافذة عرض أصناف الفاتورة (زرار 👁) ===== */}
      {invView && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" style={{ direction: "rtl" }} onClick={() => { setInvView(null); setInvMsg(""); }}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden border shadow-2xl flex flex-col" style={{ borderColor: "#888888", background: "var(--bg-card)" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap shrink-0" style={{ background: "#222222", borderBottom: "2px solid #888888" }}>
              <span className="text-[13px] font-black" style={{ color: "#c3c6bb" }}>
                أصناف الفاتورة {invView.invoice_number}
                <span className="font-mono text-[10px] font-bold mr-2 px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)" }}>{invView.date}</span>
              </span>
              <button onClick={() => { setInvView(null); setInvMsg(""); }} className="text-[12px] font-black cursor-pointer hover:opacity-70" style={{ color: "#c3c6bb" }}>إغلاق ✕</button>
            </div>
            <div className="overflow-auto flex-1">
              <div className="px-4 pt-3 grid grid-cols-3 gap-2">
                {[
                  { l: "العميل", v: invView.customer_supplier_name || "—", c: "var(--text-primary)" },
                  { l: "إجمالي الفاتورة", v: `${Number(invView.total || 0).toFixed(2)} ج.م`, c: "#2563eb" },
                  { l: invView.tamween_discount > 0 ? "خصم التموين" : invView.bread_points > 0 ? "نقاط الخبز" : "المدفوع",
                    v: `${Number(invView.tamween_discount > 0 ? invView.tamween_discount : invView.bread_points > 0 ? invView.bread_points : invView.paid || 0).toFixed(2)} ج.م`,
                    c: invView.tamween_discount > 0 ? "#d97706" : invView.bread_points > 0 ? "#059669" : "#2563eb" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl p-2.5 text-center" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
                    <div className="text-[10px] font-black mb-1" style={{ color: "var(--text-muted)" }}>{s.l}</div>
                    <div className="font-mono font-black text-[13px]" style={{ color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div className="p-4">
                {invMsg && <div className="mb-2 text-[11px] font-black" style={{ color: "#e11d48" }}>{invMsg}</div>}
                {invViewLoading ? (
                  <div className="py-7 text-center text-[12px] font-black" style={{ color: "var(--text-muted)" }}>جارٍ التحميل...</div>
                ) : invViewItems.length === 0 ? (
                  <div className="py-7 text-center text-[12px] font-black" style={{ color: "var(--text-muted)" }}>مفيش أصناف مسجّلة على الفاتورة دي</div>
                ) : (
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)" }}>
                        <th className="py-2 px-3 font-black">#</th>
                        <th className="py-2 px-3 font-black">الباركود</th>
                        <th className="py-2 px-3 font-black">الصنف</th>
                        <th className="py-2 px-3 font-black text-center">الكمية</th>
                        <th className="py-2 px-3 font-black text-center">السعر</th>
                        <th className="py-2 px-3 font-black text-center">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invViewItems.map((it: any, i: number) => (
                        <tr key={it.id ?? i} style={{ background: i % 2 ? "var(--bg-card-hover)" : "var(--bg-card)" }}>
                          <td className="py-2 px-3 font-mono font-black" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                          <td className="py-2 px-3 font-mono" style={{ color: "var(--text-secondary)" }}>{it.barcode || "—"}</td>
                          <td className="py-2 px-3 font-bold" style={{ color: "var(--text-primary)" }}>{it.name}</td>
                          <td className="py-2 px-3 text-center font-mono font-black">{it.quantity} {it.unit || ""}</td>
                          <td className="py-2 px-3 text-center font-mono font-black">{Number(it.price || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-center font-mono font-black" style={{ color: "#d97706" }}>{Number(it.total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--bg-input)", borderTop: "2px solid var(--border-strong)" }}>
                        <td className="py-2 px-3 font-black" colSpan={5} style={{ color: "var(--text-secondary)" }}>إجمالي {invViewItems.length} صنف</td>
                        <td className="py-2 px-3 font-mono font-black text-center" style={{ color: "#d97706" }}>
                          {invViewItems.reduce((s: number, it: any) => s + Number(it.total || 0), 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== نافذة تعديل الفاتورة (زرار ✎) ===== */}
      {invEdit && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" style={{ direction: "rtl" }} onClick={() => { if (!invBusy) { setInvEdit(null); setInvMsg(""); } }}>
          <div className="w-full max-w-lg overflow-hidden border shadow-2xl" style={{ borderColor: "#888888", background: "var(--bg-card)" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 flex items-center justify-between gap-2 shrink-0" style={{ background: "#222222", borderBottom: "2px solid #888888" }}>
              <span className="text-[13px] font-black" style={{ color: "#c3c6bb" }}>تعديل الفاتورة {invEdit.invoice_number}</span>
              <button onClick={() => { setInvEdit(null); setInvMsg(""); }} className="text-[12px] font-black cursor-pointer hover:opacity-70" style={{ color: "#c3c6bb" }}>إغلاق ✕</button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block">
                <span className="block text-[11px] font-black mb-1" style={{ color: "var(--text-muted)" }}>اسم العميل / الجهة</span>
                <input type="text" value={invEditForm.customer_supplier_name} onChange={(e) => setInvEditForm({ ...invEditForm, customer_supplier_name: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg text-xs font-bold" style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </label>
              <div>
                <span className="block text-[11px] font-black mb-1" style={{ color: "var(--text-muted)" }}>المصدر المالي</span>
                <div className="grid grid-cols-2 gap-2">
                  {[{ k: "cash_register", l: "درج الكاشير" }, { k: "main_safe", l: "الخزنة الرئيسية" }].map((o) => (
                    <button key={o.k} type="button" onClick={() => setInvEditForm({ ...invEditForm, payment_source: o.k })}
                      className="h-9 rounded-lg text-[12px] font-black cursor-pointer transition-all"
                      style={{ background: invEditForm.payment_source === o.k ? "#222222" : "var(--bg-input)", color: invEditForm.payment_source === o.k ? "#c3c6bb" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-black mb-1" style={{ color: "var(--text-muted)" }}>المدفوع (ج.م)</span>
                  <input type="number" step="0.01" value={invEditForm.paid} onChange={(e) => setInvEditForm({ ...invEditForm, paid: Number(e.target.value) || 0 })}
                    className="w-full h-9 px-3 rounded-lg text-xs font-bold font-mono" style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-black mb-1" style={{ color: "var(--text-muted)" }}>المتبقي (ج.م)</span>
                  <input type="number" step="0.01" value={invEditForm.remaining} onChange={(e) => setInvEditForm({ ...invEditForm, remaining: Number(e.target.value) || 0 })}
                    className="w-full h-9 px-3 rounded-lg text-xs font-bold font-mono" style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                </label>
              </div>
              <div className="text-[10px] font-bold leading-relaxed" style={{ color: "var(--text-muted)" }}>
                أي تغيير في «المدفوع» هيسجّل حركة خزنة تلقائيًا، وعندما يُسجَّل في سجل أمني باسم المستخدم.
              </div>
              {invMsg && <div className="text-[11px] font-black" style={{ color: "#e11d48" }}>{invMsg}</div>}
              <div className="flex gap-2">
                <button onClick={saveInvEdit} disabled={invBusy}
                  className="h-10 px-6 bg-[#27ae60] hover:bg-[#219a52] text-white font-black text-xs cursor-pointer disabled:opacity-50">
                  {invBusy ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                </button>
                <button onClick={() => { setInvEdit(null); setInvMsg(""); }} disabled={invBusy}
                  className="h-10 px-6 bg-[#888888] hover:bg-[#666666] text-white font-black text-xs cursor-pointer disabled:opacity-50">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== نافذة تأكيد حذف الفاتورة (زرار 🗑) ===== */}
      {invDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" style={{ direction: "rtl" }} onClick={() => { if (!invBusy) { setInvDelete(null); setInvMsg(""); } }}>
          <div className="w-full max-w-md overflow-hidden border shadow-2xl" style={{ borderColor: "#888888", background: "var(--bg-card)" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 flex items-center justify-between gap-2 shrink-0" style={{ background: "#7f1d1d", borderBottom: "2px solid #888888" }}>
              <span className="text-[13px] font-black text-white">⚠ تأكيد حذف الفاتورة</span>
              <button onClick={() => { setInvDelete(null); setInvMsg(""); }} className="text-[12px] font-black text-white cursor-pointer hover:opacity-70">إغلاق ✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg p-3 text-xs font-bold space-y-1" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
                <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>الفاتورة:</span><span className="font-mono">{invDelete.invoice_number}</span></div>
                <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>التاريخ:</span><span className="font-mono">{invDelete.date}</span></div>
                <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>العميل:</span><span>{invDelete.customer_supplier_name || "—"}</span></div>
                <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>الإجمالي:</span><span className="font-mono font-black">{Number(invDelete.total || 0).toFixed(2)} ج.م</span></div>
              </div>
              <div className="text-[11px] font-black leading-relaxed" style={{ color: "#e11d48" }}>
                الحذف هيرجّع كميات الأصناف للمخزن، ويسجّل عملية في السجل الأمني باسمك. لا يمكن التراجع عن العملية.
              </div>
              {invMsg && <div className="text-[11px] font-black" style={{ color: "#e11d48" }}>{invMsg}</div>}
              <div className="flex gap-2">
                <button onClick={deleteInvoiceNow} disabled={invBusy}
                  className="h-10 px-6 bg-red-600 hover:bg-red-700 text-white font-black text-xs cursor-pointer disabled:opacity-50">
                  {invBusy ? "جارٍ الحذف..." : "نعم، احذف الفاتورة"}
                </button>
                <button onClick={() => { setInvDelete(null); setInvMsg(""); }} disabled={invBusy}
                  className="h-10 px-6 bg-[#888888] hover:bg-[#666666] text-white font-black text-xs cursor-pointer disabled:opacity-50">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4" style={{ background: "transparent" }}>
        {loading ? (
          <div className="p-12 text-center font-bold" style={{ color: "var(--text-secondary)" }}>جاري تحميل البيانات...</div>
        ) : (
          <>
            {/* Default Table View */}
            {(
              <div className="rounded-xl overflow-hidden border-2 shadow-lg" style={{ borderColor: "var(--border-strong)", background: "var(--bg-card)" }}>
                <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
                <table className="w-full text-right text-xs">
                  <thead className="sticky top-0">
                    <tr className="bg-[#222222] text-[#c3c6bb] font-black">
                      <th className="py-2.5 px-3 border-b-2 border-[#c3c6bb]">التاريخ</th>
                      <th className="py-2.5 px-3 border-b-2 border-[#c3c6bb]">رقم الفاتورة</th>
                      <th className="py-2.5 px-3 border-b-2 border-[#c3c6bb]">المورد</th>
                      <th className="py-2.5 px-3 text-center border-b-2 border-[#c3c6bb]">القيمة</th>
                      <th className="py-2.5 px-3 text-center border-b-2 border-[#c3c6bb]">الحالة</th>
                      <th className="py-2.5 px-3 text-center border-b-2 border-[#c3c6bb]">المخزن</th>
                      <th className="py-2.5 px-3 text-center border-b-2 border-[#c3c6bb]">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb] font-bold text-[#000000]">
                    {paginate(filteredReplacements, pageRep).map((item) => {
                      const items = parseItems(item.items_json);
                      const expanded = expandedRepId === item.id;
                      const grand = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.purchase_price) || 0), 0);
                      return (
                      <React.Fragment key={item.id}>
                        <tr className="transition-colors" style={{ background: "transparent" }}>
                          <td className="py-2 px-3 font-mono">{item.date}</td>
                          <td className="py-2 px-3 font-mono">{item.invoice_number || "-"}</td>
                          <td className="py-2 px-3">{item.supplier_name}</td>
                          <td className="py-2 px-3 text-center font-mono text-orange-600 font-black text-sm">{item.total_value.toFixed(2)} ج.م</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 text-[10px] font-bold ${
                              item.status === 'received' ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'
                            }`}>
                              {item.status === 'received' ? 'تم الاستلام' : 'قيد الانتظار'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {(item as any).stock_added ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-200 text-blue-800">بالمخزن ✓</span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-200 text-gray-600">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => setExpandedRepId(expanded ? null : item.id)}
                                className="bg-[#8e44ad] text-white p-1.5 hover:bg-[#7d3c98] transition-colors"
                                title="تفاصيل الأصناف المصروفة"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="bg-red-500 text-white p-1.5 hover:bg-red-600 transition-colors"
                                title="حذف"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={7} className="bg-[#f9f9f9] p-2">
                              {items.length > 0 ? (
                                <table className="w-full text-right text-xs">
                                  <thead>
                                    <tr className="bg-[#222222] text-[#c3c6bb]">
                                      <th className="py-1 px-2">#</th>
                                      <th className="py-1 px-2">الصنف</th>
                                      <th className="py-1 px-2">الباركود</th>
                                      <th className="py-1 px-2 text-center">الكمية</th>
                                      <th className="py-1 px-2 text-center">السعر</th>
                                      <th className="py-1 px-2 text-center">إجمالي الصنف</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#ddd]">
                                    {items.map((it: any, i: number) => (
                                      <tr key={i}>
                                        <td className="py-1 px-2">{i + 1}</td>
                                        <td className="py-1 px-2 font-bold">{it.name}</td>
                                        <td className="py-1 px-2 font-mono text-[10px]">{it.barcode || "—"}</td>
                                        <td className="py-1 px-2 text-center font-mono">{it.quantity} {it.unit || ""}</td>
                                        <td className="py-1 px-2 text-center font-mono">{Number(it.purchase_price || 0).toFixed(2)}</td>
                                        <td className="py-1 px-2 text-center font-mono font-bold">{((Number(it.quantity) || 0) * (Number(it.purchase_price) || 0)).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-[#eee] font-black">
                                    <tr>
                                      <td colSpan={5} className="py-1 px-2 text-left">إجمالي الكل</td>
                                      <td className="py-1 px-2 text-center font-mono text-orange-700">{grand.toFixed(2)} ج.م</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              ) : (
                                <p className="text-center text-[11px] text-[#555] py-2">{item.items_description || "لا توجد أصناف مسجلة"}</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                {renderPager(filteredReplacements.length, pageRep, setPageRep)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg border border-[#888888] shadow-lg">
            <div className="bg-[#222222] text-[#c3c6bb] p-4 flex justify-between items-center">
              <h3 className="font-bold">{editingItem ? "تعديل استعاضة" : "إضافة استعاضة جديدة"}</h3>
              <button onClick={() => setShowModal(false)} className="hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">التاريخ</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">رقم فاتورة الشركة</label>
                  <input
                    type="text"
                    value={form.invoice_number}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                    placeholder="اختياري"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#555555] mb-1">اسم المورد / الشركة (من موردي التموين)</label>
                <input
                  type="text"
                  value={form.supplier_name}
                  onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                  list="tamween-suppliers-list"
                  placeholder="اختار من القايمة أو اكتب اسم جديد..."
                  className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                  required
                />
                <datalist id="tamween-suppliers-list">
                  {suppliers.filter((s: any) => s.is_tamween_supplier === 1).map((s: any) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
                {suppliers.filter((s: any) => s.is_tamween_supplier === 1).length === 0 && (
                  <p className="text-[11px] text-[#a00] font-bold mt-1">مفيش مورد تمويني مسجل — ضيفه من صفحة الموردين وعلم عليه تمويني عشان المخزن يتحرك تلقائياً</p>
                )}
              </div>
              {/* بحث وإضافة صنف — زي فاتورة المشتريات */}
              <div>
                <label className="block text-xs font-bold text-[#555555] mb-1">ابحث وضيف صنف (بالاسم أو الباركود)</label>
                <input
                  type="text"
                  placeholder="اكتب اسم الصنف أو امسح الباركود..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                />
                <div className="border border-t-0 border-[#888888] max-h-32 overflow-y-auto bg-white">
                  {tamweenProducts
                    .filter(p => {
                      const q = productSearchQuery.toLowerCase().trim();
                      if (!q) return productSearchQuery.length > 0;
                      return p.name.toLowerCase().includes(q) || (p.barcode || "").toLowerCase().includes(q);
                    })
                    .slice(0, 10)
                    .map((product) => (
                      <div
                        key={product.id}
                        onClick={() => { addProductToSelection(product); setProductSearchQuery(""); }}
                        className="flex items-center justify-between p-2 hover:bg-[#e8f5e9] cursor-pointer border-b border-[#eee] last:border-0"
                      >
                        <div>
                          <span className="text-xs font-bold">+ {product.name}</span>
                          <span className="text-[10px] text-[#888] mr-2">({product.barcode})</span>
                        </div>
                        <div className="text-[10px] text-[#666]">
                          {product.purchase_price.toFixed(2)} ج.م
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              {/* سلة الاستعاضة — جدول زي المشتريات */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#555555]">أصناف الاستعاضة ({selectedItems.length})</label>
                  <button type="button" onClick={addBlankRow} className="h-7 px-3 bg-[#27ae60] hover:bg-[#219a52] text-white text-[11px] font-bold cursor-pointer">+ إدراج صنف جديد</button>
                </div>
                <div className="border border-[#888888] bg-white overflow-x-auto">
                  {selectedItems.length === 0 ? (
                    <p className="text-xs text-[#999] text-center py-3">ابحث فوق وضيف الأصناف، أو أدرج صنف جديد يدوياً</p>
                  ) : (
                    <table className="w-full text-right text-xs min-w-[640px]">
                      <thead>
                        <tr className="bg-[#222222] text-[#c3c6bb]">
                          <th className="py-2 px-2">الباركود</th>
                          <th className="py-2 px-2">اسم الصنف</th>
                          <th className="py-2 px-2 text-center">الكمية</th>
                          <th className="py-2 px-2 text-center">الوحدة</th>
                          <th className="py-2 px-2 text-center">سعر الشراء</th>
                          <th className="py-2 px-2 text-center">القطاعي</th>
                          <th className="py-2 px-2 text-center">الجملة</th>
                          <th className="py-2 px-2 text-center">الإجمالي</th>
                          <th className="py-2 px-2 text-center">✕</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ddd]">
                        {selectedItems.map((item, idx) => (
                          <tr key={rowKeyOf(item, idx)}>
                            <td className="py-1.5 px-1 text-center">
                              <input type="text" value={item.barcode || ""} onChange={(e) => setRowField(idx, { barcode: e.target.value })}
                                placeholder="باركود" className="w-24 px-1 py-1 border border-[#888] text-[11px] font-mono text-center" />
                            </td>
                            <td className="py-1.5 px-1">
                              <input type="text" value={item.name || ""} onChange={(e) => setRowField(idx, { name: e.target.value })}
                                placeholder="اسم الصنف" className="w-full min-w-[110px] px-1 py-1 border border-[#888] text-xs font-bold" />
                            </td>
                            <td className="py-1.5 px-1 text-center">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateSelectedItemQuantity(idx, Number(e.target.value))}
                                className="w-14 px-1 py-1 border border-[#888] text-xs font-bold text-center"
                                min="0"
                              />
                            </td>
                            <td className="py-1.5 px-1 text-center">
                              <input type="text" value={item.unit || ""} onChange={(e) => setRowField(idx, { unit: e.target.value })}
                                className="w-14 px-1 py-1 border border-[#888] text-[11px] text-center" />
                            </td>
                            <td className="py-1.5 px-1 text-center">
                              <input
                                type="number"
                                step="0.01"
                                value={item.purchase_price || 0}
                                onChange={(e) => updateSelectedItemPrice(idx, Number(e.target.value))}
                                className="w-[70px] px-1 py-1 border border-[#888] text-xs font-bold text-center font-mono"
                                min="0"
                              />
                            </td>
                            <td className="py-1.5 px-1 text-center">
                              <input
                                type="number"
                                step="0.01"
                                value={item.retail_price || 0}
                                onChange={(e) => updateSelectedItemRetail(idx, Number(e.target.value))}
                                className="w-[70px] px-1 py-1 border border-[#888] text-xs text-center font-mono"
                                min="0"
                              />
                            </td>
                            <td className="py-1.5 px-1 text-center">
                              <input
                                type="number"
                                step="0.01"
                                value={item.wholesale_price || 0}
                                onChange={(e) => updateSelectedItemWholesale(idx, Number(e.target.value))}
                                className="w-[70px] px-1 py-1 border border-[#888] text-xs text-center font-mono"
                                min="0"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono font-bold">{(item.quantity * (item.purchase_price || 0)).toFixed(2)}</td>
                            <td className="py-1.5 px-1 text-center">
                              <button type="button" onClick={() => removeSelectedItem(idx)} className="text-red-500 hover:text-red-700 font-black cursor-pointer">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">القيمة الإجمالية (محسوبة تلقائياً)</label>
                  <div className="w-full px-3 py-2 bg-[#222222] text-[#c3c6bb] text-base font-black text-center font-mono">
                    {(selectedItems.length > 0 ? selectedItems.reduce((sum, item) => sum + (item.quantity * (item.purchase_price || 0)), 0) : form.total_value).toFixed(2)} ج.م
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">الحالة</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 border border-[#888888] text-sm font-bold bg-white"
                  >
                    <option value="pending">قيد الانتظار</option>
                    <option value="received">تم الاستلام</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#555555] mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                  placeholder="اختياري"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-[#c3c6bb] text-[#000000] hover:bg-[#888888] text-sm font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#222222] text-[#c3c6bb] hover:bg-[#000000] text-sm font-bold transition-colors"
                >
                  {editingItem ? "تحديث" : "حفظ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
