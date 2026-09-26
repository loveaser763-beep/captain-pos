import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  CreditCard,
  Clock,
  History,
  Receipt,
  Printer,
} from "lucide-react";
import { authFetch, hardRefocus } from "../authFetch";
import UnifiedPrintButton from "./UnifiedPrintButton";

interface TamweenCustomer {
  id: number;
  name: string;
  secret_number: string;
  phone: string;
  card_value: number;
  bread_points: number;
  status: string;
  status_month: string;
  created_at: string;
}

interface TamweenStats {
  total: number;
  withdrawn: number;
  later: number;
}

export default function TamweenCustomers({ onWithdrawNow }: { onWithdrawNow?: (customer: any) => void }) {
  const [customers, setCustomers] = useState<TamweenCustomer[]>([]);
  const [stats, setStats] = useState<TamweenStats>({ total: 0, withdrawn: 0, later: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<TamweenCustomer[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "withdrawn" | "later">("all");
  // فلتر الفترة: شهر + سنة حتى 2050
  const [filterYear, setFilterYear] = useState(() => new Date().getFullYear());
  const [filterMonthNum, setFilterMonthNum] = useState(() => new Date().getMonth() + 1);
  const filterMonth = `${filterYear}-${String(filterMonthNum).padStart(2, "0")}`;
  // تقسيم الصفحات: 10 أسماء للصفحة
  const PAGE_SIZE = 10;
  const [pageW, setPageW] = useState(1);
  const [pageL, setPageL] = useState(1);
  useEffect(() => { setPageW(1); setPageL(1); }, [filterYear, filterMonthNum, searchQuery, filterStatus]);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<TamweenCustomer | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<any>(null);
  const [historyInvoices, setHistoryInvoices] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showAllCustomersModal, setShowAllCustomersModal] = useState(false);
  const [pageAll, setPageAll] = useState(1);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const findCustomer = () => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return;
    const hit = customers.find((c) => c.name.toLowerCase().includes(q) || c.secret_number.toLowerCase().includes(q) || (c.phone || "").includes(q));
    if (hit) {
      setFilterStatus("all");
      setHighlightId(hit.id);
      setTimeout(() => {
        try { document.getElementById(`cust-row-${hit.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
      }, 100);
      setTimeout(() => setHighlightId(null), 4000);
    }
  };
  const [showInvoiceItems, setShowInvoiceItems] = useState(false);
  const [invoiceItemsData, setInvoiceItemsData] = useState<any>(null);
  const [invoiceItemsLoading, setInvoiceItemsLoading] = useState(false);
  const [expandedHistoryInvoice, setExpandedHistoryInvoice] = useState<number | null>(null);
  const [histYear, setHistYear] = useState(() => new Date().getFullYear());
  const [histMonthNum, setHistMonthNum] = useState(() => new Date().getMonth() + 1);
  const histMonth = `${histYear}-${String(histMonthNum).padStart(2, "0")}`;
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);

  const [formName, setFormName] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCardValue, setFormCardValue] = useState(0);
  const [formBreadPoints, setFormBreadPoints] = useState(0);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [custRes, statsRes] = await Promise.all([
        authFetch("/api/tamween-customers"),
        authFetch("/api/tamween-customers/stats"),
      ]);
      if (custRes.ok) setCustomers(await custRes.json());
      else setError("فشل في تحميل بيانات العملاء");
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (!showSearchDropdown || searchQuery.length < 1) { setSearchSuggestions([]); return; }
    const q = searchQuery.toLowerCase().trim();
    const filtered = customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.secret_number.toLowerCase().includes(q) || (c.phone || "").includes(q)
    ).slice(0, 8);
    setSearchSuggestions(filtered);
  }, [searchQuery, showSearchDropdown, customers]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const resetForm = () => {
    setFormName("");
    setFormSecret("");
    setFormPhone("");
    setFormCardValue(0);
    setFormBreadPoints(0);
    setEditingCustomer(null);
  };

  const openAddModal = () => { resetForm(); setShowModal(true); };

  const openEditModal = (c: TamweenCustomer) => {
    setFormName(c.name);
    setFormSecret(c.secret_number);
    setFormPhone(c.phone);
    setFormCardValue(c.card_value);
    setFormBreadPoints(c.bread_points);
    setEditingCustomer(c);
    setShowModal(true);
  };

  const handleSave = async () => {
    setError("");
    if (!formName.trim() || !formSecret.trim()) {
      setError("اسم العميل والرقم السري مطلوبين");
      return;
    }
    const payload = {
      name: formName.trim(),
      secret_number: formSecret.trim(),
      phone: formPhone.trim(),
      card_value: formCardValue,
      bread_points: formBreadPoints,
    };
    try {
      let res;
      if (editingCustomer) {
        res = await authFetch(`/api/tamween-customers/${editingCustomer.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await authFetch("/api/tamween-customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const result = await res.json();
      if (res.ok && result.success) {
        setSuccess(editingCustomer ? "تم تعديل بيانات العميل بنجاح" : "تم إضافة العميل بنجاح");
        setShowModal(false);
        resetForm();
        fetchAll();
      } else {
        setError(result.error || "حدث خطأ");
      }
    } catch {
      setError("خطأ في الاتصال بالخادم");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا العميل؟")) { try { hardRefocus(); } catch {} return; }
    try {
      const res = await authFetch(`/api/tamween-customers/${id}`, { method: "DELETE" });
      if (res.ok) { setSuccess("تم حذف العميل بنجاح"); fetchAll(); }
    } catch {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      try { hardRefocus(); } catch {}
    }
  };

  const openHistory = async (customer: TamweenCustomer) => {
    setHistoryLoading(true);
    setShowHistoryModal(true);
    setExpandedHistoryInvoice(null);
    setHistoryCustomer(null);
    setHistoryInvoices([]);
    try {
      const res = await authFetch(`/api/tamween-customers/${customer.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryCustomer(data.customer);
        setHistoryInvoices(data.invoices || []);
      }
    } catch {} finally { setHistoryLoading(false); }
  };

  const filtered = customers.filter(
    (c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.secret_number.toLowerCase().includes(q) || (c.phone || "").includes(q);
      if (!matchSearch) return false;
      if (filterStatus === "all") return true;
      if (filterStatus === "withdrawn") return c.status_month === filterMonth && c.status === "withdrawn";
      if (filterStatus === "later") return c.status_month === filterMonth && c.status === "later";
      return true;
    }
  );

  const getMonthLabel = (m: string) => {
    if (!m) return "";
    const [y, mo] = m.split("-");
    const months = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    return `${months[parseInt(mo)]} ${y}`;
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
    } catch { return iso; }
  };

  // مجاميع الفترة المختارة (محلياً من البيانات المحملة — تعمل لأي شهر حتى 2050)
  const monthCustomers = customers.filter((c) => c.status_month === filterMonth);
  const wListAll = monthCustomers.filter((c) => c.status === "withdrawn");
  const lListAll = monthCustomers.filter((c) => c.status === "later");
  const sumCard = (arr: TamweenCustomer[]) => arr.reduce((s, c) => s + Number(c.card_value || 0), 0);
  const sumBread = (arr: TamweenCustomer[]) => arr.reduce((s, c) => s + Number(c.bread_points || 0), 0);

  // قسم مستقل: جدول + مجاميع + تقسيم 10 + سكرول
  const renderTamweenGroup = (
    key: string, label: string, color: string,
    items: TamweenCustomer[], page: number, setPage: (n: number) => void
  ) => {
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    return (
      <div key={key} className="bg-[#c3c6bb] border border-[#222222]">
        {items.length === 0 ? (
          <div>
            <div className="px-4 py-2 font-black text-xs text-white flex flex-wrap items-center gap-x-3 gap-y-1" style={{ backgroundColor: color }}>
              <span>{label} — {getMonthLabel(filterMonth)}</span>
              <span className="bg-white/20 px-2 py-0.5 rounded">{items.length}</span>
            </div>
            <div className="p-6 text-center text-[#555555] font-bold text-xs">لا يوجد عملاء في هذا القسم لهذه الفترة</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
              <div className="px-4 py-2 font-black text-xs text-white flex flex-wrap items-center gap-x-3 gap-y-1 sticky top-0 z-10" style={{ backgroundColor: color }}>
                <span>{label} — {getMonthLabel(filterMonth)}</span>
                <span className="bg-white/20 px-2 py-0.5 rounded">{items.length}</span>
                <span className="font-mono">تموين: {sumCard(items).toFixed(2)} ج.م</span>
                <span className="font-mono">خبز: {sumBread(items).toFixed(2)} ج.م</span>
              </div>
              <table className="w-full text-right text-xs min-w-[800px] border-collapse">
                <thead className="sticky top-[33px]">
                  <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-9">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">اسم العميل</th>
                    <th className="py-2 px-3">الرقم السري</th>
                    <th className="py-2 px-3">التليفون</th>
                    <th className="py-2 px-3 text-center">مبلغ البطاقة</th>
                    <th className="py-2 px-3 text-center">نقاط الخبز</th>
                    <th className="py-2 px-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
                  {pageItems.map((c, idx) => (
                    <tr key={c.id} id={`cust-row-${c.id}`} className={`hover:bg-[#b8bcb2] transition-colors ${highlightId === c.id ? "bg-[#ffe58f]" : ""}`}>
                      <td className="py-2 px-3 text-[#555555] font-mono">{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="py-2 px-3">
                        <p className="font-extrabold text-sm">{c.name}</p>
                      </td>
                      <td className="py-2 px-3 font-mono font-black">{c.secret_number}</td>
                      <td className="py-2 px-3 font-mono">{c.phone || "-"}</td>
                      <td className="py-2 px-3 text-center font-mono">{c.card_value} ج.م</td>
                      <td className="py-2 px-3 text-center font-mono">{c.bread_points} ج.م</td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {c.status_month === filterMonth && c.status === "later" && onWithdrawNow && (
                            <button
                              onClick={async () => {
                                if (withdrawingId !== null) return;
                                setWithdrawingId(c.id);
                                try {
                                  let pendingSale: any = null;
                                  try {
                                    const r = await authFetch(`/api/tamween-customers/${c.id}/pending-sale`);
                                    if (r.ok) {
                                      const d = await r.json();
                                      pendingSale = d.pendingSale || null;
                                    }
                                  } catch {}
                                  onWithdrawNow({ id: c.id, name: c.name, secret_number: c.secret_number, card_value: c.card_value, bread_points: c.bread_points, pendingSale });
                                } finally {
                                  setTimeout(() => setWithdrawingId(null), 1500);
                                }
                              }}
                              disabled={withdrawingId === c.id}
                              className="h-8 px-2 flex items-center justify-center bg-[#27ae60] hover:bg-[#219a52] text-white border-none cursor-pointer text-[10px] font-bold gap-1 disabled:opacity-50"
                              title="صرف الآن"
                            >
                              <CreditCard size={10} />
                              <span>{withdrawingId === c.id ? "جاري الفتح..." : "صرف الآن"}</span>
                            </button>
                          )}
                          <button
                            onClick={() => openHistory(c)}
                            className="w-8 h-8 flex items-center justify-center bg-[#8e44ad] hover:bg-[#7d3c98] text-white border-none cursor-pointer"
                            title="السجل"
                          >
                            <History size={12} />
                          </button>
                          <button
                            onClick={() => openEditModal(c)}
                            className="w-8 h-8 flex items-center justify-center bg-[#3498db] hover:bg-[#2980b9] text-white border-none cursor-pointer"
                            title="تعديل"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="w-8 h-8 flex items-center justify-center bg-[#e74c3c] hover:bg-[#c0392b] text-white border-none cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 p-2 border-t border-[#888888] bg-[#b8bcb2] flex-wrap">
                <button
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  disabled={safePage === 1}
                  className="h-7 px-2 bg-[#c3c6bb] border border-[#888888] text-xs font-black cursor-pointer disabled:opacity-40"
                >‹ السابق</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`h-7 min-w-7 px-2 text-xs font-black border cursor-pointer ${n === safePage ? "bg-[#222222] text-[#c3c6bb] border-[#222222]" : "bg-[#c3c6bb] border-[#888888]"}`}
                  >{n}</button>
                ))}
                <button
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage === totalPages}
                  className="h-7 px-2 bg-[#c3c6bb] border border-[#888888] text-xs font-black cursor-pointer disabled:opacity-40"
                >التالي ›</button>
                <span className="text-[10px] font-bold text-[#555555]">صفحة {safePage} من {totalPages}</span>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-4 select-none font-sans" style={{ direction: "rtl" }}>
      {/* Header */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#000000] flex items-center gap-2">
            <Users size={20} strokeWidth={1.5} />
            <span>سجل عملاء التموين</span>
          </h2>
          <p className="text-xs text-[#555555] font-semibold mt-1">
            إدارة بيانات عملاء البطاقات التموينية ومتابعة حالة الصرف الشهرية
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="h-9 px-3 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0"
          >
            <RefreshCw size={14} strokeWidth={1.5} />
            <span>تحديث</span>
          </button>
          <button
            onClick={openAddModal}
            className="h-9 px-3 bg-[#27ae60] hover:bg-[#219a52] text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={14} strokeWidth={1.5} />
            <span>إضافة عميل</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold">
          <AlertTriangle size={16} strokeWidth={1.5} className="text-[#222222] shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold">
          <CheckCircle size={16} strokeWidth={1.5} className="text-[#000000] shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Month/Year filter FIRST */}
      <div className="bg-[#c3c6bb] p-3 border border-[#222222] flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-black text-[#000000]">الشهر:</label>
          <select
            value={filterMonthNum}
            onChange={(e) => setFilterMonthNum(Number(e.target.value))}
            className="h-9 px-2 bg-[#b8bcb2] border border-[#888888] text-xs font-bold text-[#000000] cursor-pointer"
          >
            {["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"].map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-black text-[#000000]">السنة:</label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="h-9 px-2 bg-[#b8bcb2] border border-[#888888] text-xs font-bold text-[#000000] cursor-pointer"
          >
            {Array.from({ length: 2050 - 2024 + 1 }, (_, i) => 2024 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <span className="text-[11px] text-[#555555] font-bold">الحالة بتتجدد تلقائياً في أول كل شهر</span>
        {filterStatus !== "all" && (
          <button
            onClick={() => setFilterStatus("all")}
            className="h-9 px-4 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] text-xs font-black cursor-pointer transition-colors"
          >
            عرض الكل
          </button>
        )}
      </div>

      {/* Search — بند بارز للبحث بالاسم والرقم السري */}
      <div className="bg-[#222222] p-3 border border-[#222222] relative">
        <label className="block text-[#c3c6bb] mb-2 text-xs font-black">🔍 بحث عن العميل بالاسم أو الرقم السري</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearchDropdown(true)}
              onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
              onKeyDown={(e) => { if (e.key === "Enter") findCustomer(); }}
              placeholder="ابحث بالاسم أو الرقم السري أو رقم التليفون..."
              className="w-full h-9 bg-[#b8bcb2] border border-[#888888] pr-9 pl-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#c3c6bb]"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#555555]">
              <Search size={16} strokeWidth={1.5} />
            </div>
          </div>
          <button
            onClick={findCustomer}
            className="h-9 px-5 bg-[#27ae60] hover:bg-[#219a52] text-white text-xs font-black cursor-pointer transition-colors shrink-0"
          >
            بحث
          </button>
        </div>
        {showSearchDropdown && searchSuggestions.length > 0 && (
          <div className="absolute top-full left-3 right-3 z-40 bg-white border border-[#888888] max-h-60 overflow-y-auto shadow-lg">
            {searchSuggestions.map((c) => {
              const isActive = c.status_month === currentMonth;
              const isWithdrawn = isActive && c.status === "withdrawn";
              const isLater = isActive && c.status === "later";
              return (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSearchQuery(c.name);
                    setShowSearchDropdown(false);
                  }}
                  className="w-full text-right px-3 py-2 text-xs font-bold text-[#000000] hover:bg-[#b8bcb2] border-b border-[#888888]/30 cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <span className="font-extrabold">{c.name}</span>
                    <span className="text-[10px] text-[#555555] mr-2 font-mono">{c.secret_number}</span>
                  </div>
                  <div>
                    {isWithdrawn ? (
                      <span className="inline-flex items-center gap-1 bg-[#e74c3c] text-white px-2 py-0.5 text-[9px] font-black rounded">تم الصرف</span>
                    ) : isLater ? (
                      <span className="inline-flex items-center gap-1 bg-[#f39c12] text-white px-2 py-0.5 text-[9px] font-black rounded">صرف لاحق</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-[#3498db] text-white px-2 py-0.5 text-[9px] font-black rounded">جديد</span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      )}
      </div>

      {/* Stats — كل مربع مختص ببياناته، والضغطة تثبت على قسمه */}
      <div className="grid grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setFilterStatus("withdrawn")}
          className={`bg-[#c3c6bb] border p-4 text-center cursor-pointer transition-all hover:-translate-y-0.5 ${filterStatus === "withdrawn" ? "border-[#27ae60] ring-2 ring-[#27ae60]/40 shadow-[0_0_18px_rgba(39,174,96,0.45)]" : "border-[#27ae60] hover:shadow-[0_0_14px_rgba(39,174,96,0.35)]"}`}
        >
          <div className="text-2xl font-black text-[#27ae60]">{wListAll.length}</div>
          <div className="text-xs font-bold text-[#27ae60] flex items-center justify-center gap-1">
            <CreditCard size={12} /> تم الصرف ({getMonthLabel(filterMonth)})
          </div>
          <div className="text-[11px] font-bold text-[#27ae60] mt-1 font-mono">تموين: {sumCard(wListAll).toFixed(2)} • خبز: {sumBread(wListAll).toFixed(2)}</div>
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus("later")}
          className={`bg-[#c3c6bb] border p-4 text-center cursor-pointer transition-all hover:-translate-y-0.5 ${filterStatus === "later" ? "border-[#f39c12] ring-2 ring-[#f39c12]/40 shadow-[0_0_18px_rgba(243,156,18,0.45)]" : "border-[#f39c12] hover:shadow-[0_0_14px_rgba(243,156,18,0.35)]"}`}
        >
          <div className="text-2xl font-black text-[#f39c12]">{lListAll.length}</div>
          <div className="text-xs font-bold text-[#f39c12] flex items-center justify-center gap-1">
            <Clock size={12} /> صرف في وقت لاحق
          </div>
          <div className="text-[11px] font-bold text-[#f39c12] mt-1 font-mono">تموين: {sumCard(lListAll).toFixed(2)} • خبز: {sumBread(lListAll).toFixed(2)}</div>
        </button>
        <div
          onClick={() => setShowAllCustomersModal(true)}
          className="bg-[#c3c6bb] border border-[#222222] p-4 text-center cursor-pointer hover:bg-[#b8bcb2] transition-colors"
        >
          <div className="text-2xl font-black text-[#000000]">{stats.total}</div>
          <div className="text-xs font-bold text-[#555555] flex items-center justify-center gap-1">
            <Users size={12} /> إجمالي عدد العملاء
          </div>
        </div>
      </div>

      {/* Table — قسمان مستقلان: تم الصرف فوقه صرف لاحق */}
      {loading ? (
        <div className="p-12 text-center text-[#555555] bg-[#c3c6bb] border border-[#222222] font-bold text-xs">
          جاري تحميل بيانات العملاء...
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-4">
          {/* شريط التاريخ + بحث صغير + طباعة — بدون كسر تنسيق الجداول */}
          <div className="bg-[#c3c6bb] border border-[#222222] px-3 py-2 flex flex-wrap items-center gap-2 no-print">
            <div className="flex items-center gap-1.5 bg-[#222222] text-[#c3c6bb] px-2.5 h-8 rounded-sm">
              <Printer size={13} strokeWidth={2} className="opacity-70" />
              <span className="text-[11px] font-black">تاريخ التقرير:</span>
              <span className="text-[11px] font-black font-mono text-[#fbbf24]">{getMonthLabel(filterMonth)}</span>
            </div>
            <div className="relative flex-1 min-w-[140px] max-w-[220px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث سريع في الجداول..."
                className="w-full h-8 pl-7 pr-2 border border-[#888888] bg-white text-[11px] font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
              />
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-[#555555]">
                <Search size={13} strokeWidth={1.5} />
              </div>
            </div>
            <div className="mr-auto">
              <UnifiedPrintButton printableId="tamween-customers-tables" thermalId="tamween-customers-tables" title="طباعة" printLayout="wide" />
            </div>
          </div>
          <div id="tamween-customers-tables">
            {(filterStatus === "all" || filterStatus === "withdrawn") &&
              renderTamweenGroup("withdrawn", "تم الصرف", "#e74c3c",
                filtered.filter((c) => c.status_month === filterMonth && c.status === "withdrawn"), pageW, setPageW)}
            {(filterStatus === "all" || filterStatus === "later") &&
              renderTamweenGroup("later", "صرف في وقت لاحق", "#f39c12",
                filtered.filter((c) => c.status_month === filterMonth && c.status === "later"), pageL, setPageL)}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-[#555555] bg-[#c3c6bb] border border-[#222222] font-bold text-xs space-y-1">
          <Users size={32} strokeWidth={1} className="mx-auto opacity-30" />
          <p>{searchQuery ? "لا توجد نتائج مطابقة للبحث" : "لا يوجد عملاء مسجلين بعد."}</p>
          <p className="text-[10px]">اضغط "إضافة عميل" لتسجيل أول عميل.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50">
          <div className="bg-[#c3c6bb] border border-[#222222] p-5 w-full max-w-lg relative space-y-4">
            <button
              onClick={() => { setShowModal(false); resetForm(); }}
              className="absolute top-3 left-3 w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] cursor-pointer"
            >
              <X size={14} />
            </button>
            <h3 className="text-sm font-black text-[#000000] border-b border-[#888888] pb-2">
              {editingCustomer ? "تعديل بيانات العميل" : "إضافة عميل تموين جديد"}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[#000000] mb-1 text-xs font-bold">اسم العميل *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="أدخل اسم العميل..."
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#000000] mb-1 text-xs font-bold">الرقم السري للبطاقة *</label>
                  <input
                    type="text"
                    value={formSecret}
                    onChange={(e) => setFormSecret(e.target.value)}
                    placeholder="أدخل الرقم السري..."
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
                <div>
                  <label className="block text-[#000000] mb-1 text-xs font-bold">رقم التليفون</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#000000] mb-1 text-xs font-bold">مبلغ البطاقة (ج.م)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formCardValue || ""}
                    onChange={(e) => setFormCardValue(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
                <div>
                  <label className="block text-[#000000] mb-1 text-xs font-bold">نقاط الخبز (ج.م)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formBreadPoints || ""}
                    onChange={(e) => setFormBreadPoints(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                className="h-10 px-6 bg-[#27ae60] hover:bg-[#219a52] text-white font-black text-xs transition-colors cursor-pointer"
              >
                {editingCustomer ? "حفظ التعديلات" : "إضافة العميل"}
              </button>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="h-10 px-6 bg-[#888888] hover:bg-[#666666] text-white font-black text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white w-full max-w-3xl max-h-[80vh] overflow-y-auto border border-[#888888] shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#888888] bg-[#222222] text-[#c3c6bb]">
              <h3 className="text-sm font-black">سجل العميل: {historyCustomer?.name}</h3>
              <button onClick={() => setShowHistoryModal(false)} className="cursor-pointer hover:opacity-70"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              {historyLoading ? (
                <div className="p-8 text-center text-[#555555] font-bold text-xs">جاري تحميل السجل...</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-blue-50 p-3 border border-blue-300 border-t-4 border-t-blue-500">
                      <p className="text-[10px] text-blue-700 font-black">اسم العميل</p>
                      <p className="text-sm font-black text-blue-900">{historyCustomer?.name}</p>
                    </div>
                    <div className="bg-purple-50 p-3 border border-purple-300 border-t-4 border-t-purple-500">
                      <p className="text-[10px] text-purple-700 font-black">الرقم السري</p>
                      <p className="text-sm font-black font-mono text-purple-900">{historyCustomer?.secret_number}</p>
                    </div>
                    <div className="bg-slate-50 p-3 border border-slate-300 border-t-4 border-t-slate-500">
                      <p className="text-[10px] text-slate-600 font-black">رقم التليفون</p>
                      <p className="text-sm font-black font-mono text-slate-800">{historyCustomer?.phone || "غير مسجل"}</p>
                    </div>
                    <div className="bg-emerald-50 p-3 border border-emerald-300 border-t-4 border-t-emerald-500">
                      <p className="text-[10px] text-emerald-700 font-black">قيمة البطاقة</p>
                      <p className="text-sm font-black font-mono text-emerald-700">{historyCustomer?.card_value} ج.م</p>
                    </div>
                    <div className="bg-amber-50 p-3 border border-amber-300 border-t-4 border-t-amber-500">
                      <p className="text-[10px] text-amber-700 font-black">نقاط الخبز</p>
                      <p className="text-sm font-black font-mono text-amber-700">{historyCustomer?.bread_points} ج.م</p>
                    </div>
                    <div className="bg-rose-50 p-3 border border-rose-300 border-t-4 border-t-rose-500">
                      <p className="text-[10px] text-rose-700 font-black">الحالة الحالية</p>
                      <p className={`text-sm font-black ${historyCustomer?.status === 'withdrawn' ? 'text-red-600' : historyCustomer?.status === 'later' ? 'text-amber-600' : 'text-blue-600'}`}>
                        {historyCustomer?.status === 'withdrawn' ? 'تم الصرف' : historyCustomer?.status === 'later' ? 'صرف في وقت لاحق' : 'جديد'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-[#222222] text-[#c3c6bb] p-3 text-xs font-bold flex flex-wrap gap-x-4 gap-y-1">
                    <span>تاريخ الصرف: <span className="font-mono">{historyCustomer?.status_month ? getMonthLabel(historyCustomer.status_month) : "—"}</span></span>
                    {historyCustomer?.withdrawn_at && <span>وقت التوثيق: <span className="font-mono">{formatDateTime(historyCustomer.withdrawn_at)}</span></span>}
                    {historyCustomer?.created_at && <span>مسجل منذ: <span className="font-mono">{formatDateTime(historyCustomer.created_at)}</span></span>}
                  </div>
                  {/* pending sale cart for later status - للمراجعة قبل الصرف */}
                  {historyCustomer?.pending_sale_json && (() => {
                    try {
                      const pending = typeof historyCustomer.pending_sale_json === 'string' ? JSON.parse(historyCustomer.pending_sale_json) : historyCustomer.pending_sale_json;
                      const cart = pending.cart || [];
                      if (!cart.length) return null;
                      const totalQty = cart.reduce((s: number, it: any) => s + Number(it.quantity||0), 0);
                      const totalVal = cart.reduce((s: number, it: any) => s + Number(it.total||0), 0);
                      return (
                        <div className="border border-amber-400 bg-amber-50 p-3">
                          <h4 className="text-xs font-black text-amber-700 mb-2">🕒 سلة معلقة (صرف لاحق) — لم تُحفظ كفاتورة بعد — للمراجعة مع العميل</h4>
                          <div className="text-[11px] font-bold text-[#000] mb-2">الإجمالي: {cart.map((it:any)=> `${it.name} ${it.quantity} ${it.unit}`).join(" • ")} — الكمية: {totalQty} — القيمة: {totalVal.toFixed(2)} ج.م</div>
                          <table className="w-full text-right text-[11px] border border-[#888888]">
                            <thead><tr className="bg-amber-200 text-[#000]"><th className="py-1 px-2">#</th><th className="py-1 px-2">الصنف</th><th className="py-1 px-2 text-center">الكمية</th><th className="py-1 px-2 text-center">السعر</th><th className="py-1 px-2 text-center">الإجمالي</th></tr></thead>
                            <tbody className="divide-y divide-[#ddd] bg-white">{cart.map((it:any,i:number)=>(<tr key={i}><td className="py-1 px-2">{i+1}</td><td className="py-1 px-2 font-bold">{it.name}</td><td className="py-1 px-2 text-center font-mono">{it.quantity} {it.unit}</td><td className="py-1 px-2 text-center font-mono">{Number(it.price||0).toFixed(2)}</td><td className="py-1 px-2 text-center font-mono font-bold">{Number(it.total||0).toFixed(2)}</td></tr>))}</tbody>
                          </table>
                        </div>
                      );
                    } catch { return null; }
                  })()}
                  <div>
                    <div className="bg-[#222222] text-[#c3c6bb] px-3 py-2 flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-black">فواتير شهر محدد</h4>
                      <select value={histMonthNum} onChange={(e) => { setHistMonthNum(Number(e.target.value)); setExpandedHistoryInvoice(null); }}
                        className="h-7 px-1 bg-white text-black text-[11px] font-bold cursor-pointer">
                        {["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"].map((m, i) => (
                          <option key={i + 1} value={i + 1}>{m}</option>
                        ))}
                      </select>
                      <select value={histYear} onChange={(e) => { setHistYear(Number(e.target.value)); setExpandedHistoryInvoice(null); }}
                        className="h-7 px-1 bg-white text-black text-[11px] font-bold cursor-pointer">
                        {Array.from({ length: 2050 - 2024 + 1 }, (_, i) => 2024 + i).map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      {(() => {
                        const ml = historyInvoices.filter((inv: any) => String(inv.date || "").slice(0, 7) === histMonth);
                        const mt = ml.reduce((s: number, v: any) => s + Number(v.total || 0), 0);
                        return <span className="text-[11px] font-mono">صرفيات: {ml.length} • الإجمالي: {mt.toFixed(2)} ج.م</span>;
                      })()}
                      {historyInvoices.length > 0 && (
                        <button
                          onClick={() => {
                            setShowInvoiceItems(true);
                            setInvoiceItemsLoading(true);
                            setInvoiceItemsData(null);
                            const withItems = historyInvoices.filter((inv: any) => Array.isArray(inv.items) && inv.items.length > 0);
                            if (withItems.length === historyInvoices.length) {
                              setInvoiceItemsData(withItems.map((inv: any) => ({ invoice: inv, items: inv.items })));
                              setInvoiceItemsLoading(false);
                            } else {
                              Promise.all(historyInvoices.map((inv: any) =>
                                authFetch(`/api/invoices/by-number/${inv.invoice_number}`).then(r => r.json())
                              )).then(results => {
                                setInvoiceItemsData(results.filter((r: any) => r.invoice));
                                setInvoiceItemsLoading(false);
                              }).catch(() => setInvoiceItemsLoading(false));
                            }
                          }}
                          className="h-7 px-3 bg-[#3498db] hover:bg-[#2980b9] text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer mr-auto"
                        >
                          <Receipt size={12} /> عرض فواتير العميل
                        </button>
                      )}
                    </div>
                    {(() => {
                      const ml = historyInvoices.filter((inv: any) => String(inv.date || "").slice(0, 7) === histMonth);
                      if (ml.length === 0) {
                        return <p className="text-xs text-[#555555] font-bold p-4 text-center bg-[#f5f5f5] border border-[#888888]">لا توجد صرفيات لهذا العميل في {getMonthLabel(histMonth)}</p>;
                      }
                      const agg: Record<string, any> = {};
                      ml.forEach((inv: any) => (Array.isArray(inv.items) ? inv.items : []).forEach((it: any) => {
                        const key = it.barcode || it.name;
                        if (!agg[key]) agg[key] = { name: it.name, unit: it.unit || "", qty: 0 };
                        agg[key].qty += Number(it.quantity || 0);
                      }));
                      const aggList = Object.values(agg);
                      return (
                      <div className="border border-[#888888] border-t-0 overflow-hidden">
                        {aggList.length > 0 && (
                          <div className="bg-[#eef3e6] px-3 py-1.5 text-[11px] font-bold text-[#000] border-b border-[#888888]">
                            إجمالي كميات الشهر: {aggList.map((a: any) => `${a.name} ${a.qty} ${a.unit}`).join(" • ")}
                          </div>
                        )}
                        <table className="w-full text-right text-xs">
                          <thead className="bg-[#b8bcb2]">
                            <tr>
                              <th className="py-2 px-3 font-bold">رقم الفاتورة</th>
                              <th className="py-2 px-3 font-bold">تاريخ الصرف</th>
                              <th className="py-2 px-3 font-bold">الدعم / الخبز</th>
                              <th className="py-2 px-3 font-bold">الإجمالي</th>
                              <th className="py-2 px-3 font-bold">الحالة</th>
                              <th className="py-2 px-3 font-bold text-center">السلة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#888888]/40">
                            {ml.map((inv: any) => {
                              const expanded = expandedHistoryInvoice === inv.id;
                              const items = Array.isArray(inv.items) ? inv.items : [];
                              return (
                                <React.Fragment key={inv.id}>
                                  <tr className="hover:bg-[#f5f5f5]">
                                    <td className="py-2 px-3 font-mono">{inv.invoice_number}</td>
                                    <td className="py-2 px-3 font-mono">{inv.date} <span className="text-[10px] text-[#888]">({inv.created_at || ""})</span></td>
                                    <td className="py-2 px-3 font-mono text-[11px]">دعم: {(inv.tamween_discount ?? 0).toFixed?.(2) ?? inv.tamween_discount} | خبز: {(inv.bread_points ?? 0).toFixed?.(2) ?? inv.bread_points}</td>
                                    <td className="py-2 px-3 font-mono">{inv.total?.toFixed(2)} ج.م</td>
                                    <td className="py-2 px-3">
                                      <span className={`px-2 py-0.5 text-[10px] font-bold ${inv.status === 'returned' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {inv.status === 'returned' ? 'مرتجع' : 'نشط'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <button onClick={() => setExpandedHistoryInvoice(expanded ? null : inv.id)} className="h-6 px-2 bg-[#222222] text-[#c3c6bb] text-[10px] font-bold cursor-pointer">
                                        {expanded ? "إخفاء الأصناف ▲" : `عرض الأصناف (${items.length}) ▼`}
                                      </button>
                                    </td>
                                  </tr>
                                  {expanded && (
                                    <tr>
                                      <td colSpan={6} className="bg-[#f9f9f9] p-2">
                                        {items.length > 0 ? (
                                          <table className="w-full text-right text-[11px]">
                                            <thead>
                                              <tr className="bg-[#222222] text-[#c3c6bb]">
                                                <th className="py-1 px-2">#</th>
                                                <th className="py-1 px-2">الصنف</th>
                                                <th className="py-1 px-2">الباركود</th>
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
                                                  <td className="py-1 px-2 font-mono">{it.barcode}</td>
                                                  <td className="py-1 px-2 text-center font-mono">{it.quantity} {it.unit || ""}</td>
                                                  <td className="py-1 px-2 text-center font-mono">{Number(it.price || 0).toFixed(2)}</td>
                                                  <td className="py-1 px-2 text-center font-mono font-bold">{Number(it.total || 0).toFixed(2)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        ) : (
                                          <p className="text-center text-[11px] text-[#888] py-2">لا توجد أصناف محفوظة لهذه الفاتورة</p>
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
                        )})()}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Items Modal - فواتير العميل كصفحة مبيعات قراءة فقط */}
      {showInvoiceItems && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-y-auto border border-[#888888] shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#888888] bg-[#222222] text-[#c3c6bb] sticky top-0 z-10">
              <h3 className="text-sm font-black">فواتير العميل (قراءة فقط): {historyCustomer?.name}</h3>
              <button onClick={() => { setShowInvoiceItems(false); setInvoiceItemsData(null); }} className="cursor-pointer hover:opacity-70"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              {invoiceItemsLoading ? (
                <div className="p-8 text-center text-[#555555] font-bold text-xs">جاري تحميل تفاصيل الفواتير...</div>
              ) : invoiceItemsData && invoiceItemsData.length > 0 ? (
                invoiceItemsData.map((data: any, idx: number) => {
                  const inv = data.invoice;
                  const items = data.items || [];
                  const linesSum = items.reduce((s: number, it: any) => s + Number(it.total || 0), 0);
                  const tDisc = Number(inv.tamween_discount || 0);
                  const tBread = Number(inv.bread_points || 0);
                  const tBonus = Number(inv.bonus || 0);
                  return (
                    <div key={idx} className="border-2 border-[#222222] overflow-hidden">
                      <div className="bg-[#222222] text-[#c3c6bb] px-4 py-2 flex flex-wrap justify-between items-center gap-2 text-xs font-black">
                        <span>فاتورة #{inv.invoice_number}</span>
                        <span className="font-mono">{inv.date}</span>
                        <span>الكاشير: {inv.created_by || "—"}</span>
                        <span className={`px-2 py-0.5 ${inv.status === 'returned' ? 'bg-red-500' : 'bg-green-600'} text-white`}>
                          {inv.status === 'returned' ? 'مرتجع' : 'نشط'}
                        </span>
                      </div>
                      <div className="bg-[#f5f5f5] px-4 py-2 text-[11px] font-bold text-[#333] flex flex-wrap gap-x-4 gap-y-1 border-b border-[#888888]">
                        <span>العميل: {inv.customer_supplier_name}</span>
                        <span>الدفع: {inv.payment_source === "cash_register" ? "درج الكاشير" : "الخزنة الرئيسية"}</span>
                        <span>المدفوع: {(inv.paid ?? 0).toFixed?.(2) ?? inv.paid} ج.م</span>
                        <span>المتبقي: {(inv.remaining ?? 0).toFixed?.(2) ?? inv.remaining} ج.م</span>
                      </div>
                      <table className="w-full text-right text-xs">
                        <thead className="bg-[#b8bcb2]">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">الصنف</th>
                            <th className="py-2 px-3">الباركود</th>
                            <th className="py-2 px-3 text-center">الكمية</th>
                            <th className="py-2 px-3">الوحدة</th>
                            <th className="py-2 px-3 text-center">سعر البيع</th>
                            <th className="py-2 px-3 text-center">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#888888]/40">
                          {items.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-[#f5f5f5]">
                              <td className="py-1.5 px-3 text-[#888]">{i + 1}</td>
                              <td className="py-1.5 px-3 font-bold">{item.name}</td>
                              <td className="py-1.5 px-3 font-mono text-[10px]">{item.barcode}</td>
                              <td className="py-1.5 px-3 text-center font-mono">{item.quantity}</td>
                              <td className="py-1.5 px-3">{item.unit || "قطعة"}</td>
                              <td className="py-1.5 px-3 text-center font-mono">{(item.price || 0).toFixed(2)}</td>
                              <td className="py-1.5 px-3 text-center font-mono font-bold">{item.total.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#f5f5f5] font-bold text-xs">
                          <tr className="border-t border-[#888888]">
                            <td colSpan={5} className="py-1.5 px-3 text-left">مجموع الأصناف (قبل الدعم)</td>
                            <td className="py-1.5 px-3 text-center font-mono">{items.reduce((s: number, it: any) => s + it.quantity, 0)}</td>
                            <td className="py-1.5 px-3 text-center font-mono">{linesSum.toFixed(2)} ج.م</td>
                          </tr>
                          {tDisc > 0 && (
                            <tr>
                              <td colSpan={6} className="py-1 px-3 text-left text-red-700">− خصم البطاقة التموينية</td>
                              <td className="py-1 px-3 text-center font-mono text-red-700">{tDisc.toFixed(2)} ج.م</td>
                            </tr>
                          )}
                          {tBread > 0 && (
                            <tr>
                              <td colSpan={6} className="py-1 px-3 text-left text-red-700">− نقاط الخبز</td>
                              <td className="py-1 px-3 text-center font-mono text-red-700">{tBread.toFixed(2)} ج.م</td>
                            </tr>
                          )}
                          {tBonus > 0 && (
                            <tr>
                              <td colSpan={6} className="py-1 px-3 text-left text-green-700">+ الحافز</td>
                              <td className="py-1 px-3 text-center font-mono text-green-700">{tBonus.toFixed(2)} ج.م</td>
                            </tr>
                          )}
                          <tr className="bg-[#222222] text-[#c3c6bb]">
                            <td colSpan={6} className="py-2 px-3 text-left font-black">الصافي = الأصناف − الدعم − الخبز + الحافز</td>
                            <td className="py-2 px-3 text-center font-mono font-black">{inv.total?.toFixed(2)} ج.م</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-[#555555] font-bold text-xs">لا توجد تفاصيل فواتير</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All Customers Modal — جدول منسق + تقسيم 10 */}
      {showAllCustomersModal && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50">
          <div className="bg-[#c3c6bb] border border-[#222222] p-5 w-full max-w-4xl max-h-[80vh] flex flex-col relative">
            <button
              onClick={() => setShowAllCustomersModal(false)}
              className="absolute top-3 left-3 w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] cursor-pointer z-10"
            >
              <X size={14} />
            </button>
            <h3 className="text-sm font-black text-[#000000] border-b border-[#888888] pb-2 mb-3">
              جدول جميع عملاء التموين ({customers.length} عميل) — {Math.max(1, Math.ceil(customers.length / PAGE_SIZE))} صفحات
            </h3>
            <div className="flex-1 overflow-y-auto">
              {customers.length > 0 ? (
                <>
                <table className="w-full text-right text-xs min-w-[600px] border-collapse">
                  <thead className="sticky top-0">
                    <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-10">
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">اسم العميل</th>
                      <th className="py-3 px-3">الرقم السري</th>
                      <th className="py-3 px-3 text-center">مبلغ التموين</th>
                      <th className="py-3 px-3 text-center">نقاط الخبز</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
                    {customers.slice((Math.min(pageAll, Math.max(1, Math.ceil(customers.length / PAGE_SIZE))) - 1) * PAGE_SIZE, Math.min(pageAll, Math.max(1, Math.ceil(customers.length / PAGE_SIZE))) * PAGE_SIZE).map((c, idx) => (
                      <tr key={c.id} className="hover:bg-[#b8bcb2] transition-colors">
                        <td className="py-2 px-3 text-[#555555] font-mono">{(Math.min(pageAll, Math.max(1, Math.ceil(customers.length / PAGE_SIZE))) - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="py-2 px-3 font-extrabold">{c.name}</td>
                        <td className="py-2 px-3 font-mono font-black">{c.secret_number}</td>
                        <td className="py-2 px-3 text-center font-mono">{c.card_value} ج.م</td>
                        <td className="py-2 px-3 text-center font-mono">{c.bread_points} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#222222] text-[#c3c6bb] font-black">
                      <td className="py-2 px-3" colSpan={3}>الإجمالي الكلي</td>
                      <td className="py-2 px-3 text-center font-mono">{customers.reduce((s, c) => s + c.card_value, 0)} ج.م</td>
                      <td className="py-2 px-3 text-center font-mono">{customers.reduce((s, c) => s + c.bread_points, 0)} ج.م</td>
                    </tr>
                  </tfoot>
                </table>
                {Math.ceil(customers.length / PAGE_SIZE) > 1 && (
                  <div className="flex items-center justify-center gap-1 p-2 bg-[#b8bcb2] border-t border-[#888888] flex-wrap sticky bottom-0">
                    <button onClick={() => setPageAll(Math.max(1, pageAll - 1))} disabled={pageAll === 1}
                      className="h-7 px-2 bg-[#c3c6bb] border border-[#888888] text-xs font-black cursor-pointer disabled:opacity-40">‹ السابق</button>
                    {Array.from({ length: Math.ceil(customers.length / PAGE_SIZE) }, (_, i) => i + 1).map((n) => (
                      <button key={n} onClick={() => setPageAll(n)}
                        className={`h-7 min-w-7 px-2 text-xs font-black border cursor-pointer ${n === pageAll ? "bg-[#222222] text-[#c3c6bb] border-[#222222]" : "bg-[#c3c6bb] border-[#888888]"}`}>{n}</button>
                    ))}
                    <button onClick={() => setPageAll(Math.min(Math.ceil(customers.length / PAGE_SIZE), pageAll + 1))} disabled={pageAll === Math.ceil(customers.length / PAGE_SIZE)}
                      className="h-7 px-2 bg-[#c3c6bb] border border-[#888888] text-xs font-black cursor-pointer disabled:opacity-40">التالي ›</button>
                  </div>
                )}
                </>
              ) : (
                <div className="p-8 text-center text-[#555555] font-bold text-xs">لا يوجد عملاء مسجلين</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
