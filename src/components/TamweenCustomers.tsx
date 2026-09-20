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
} from "lucide-react";
import { authFetch } from "../authFetch";

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
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<TamweenCustomer | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<any>(null);
  const [historyInvoices, setHistoryInvoices] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showAllCustomersModal, setShowAllCustomersModal] = useState(false);
  const [showInvoiceItems, setShowInvoiceItems] = useState(false);
  const [invoiceItemsData, setInvoiceItemsData] = useState<any>(null);
  const [invoiceItemsLoading, setInvoiceItemsLoading] = useState(false);
  const [expandedHistoryInvoice, setExpandedHistoryInvoice] = useState<number | null>(null);
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
    const filtered = customers.filter(
      (c) => c.name.includes(searchQuery) || c.secret_number.includes(searchQuery) || c.phone.includes(searchQuery)
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
    if (!confirm("هل أنت متأكد من حذف هذا العميل؟")) return;
    try {
      const res = await authFetch(`/api/tamween-customers/${id}`, { method: "DELETE" });
      if (res.ok) { setSuccess("تم حذف العميل بنجاح"); fetchAll(); }
    } catch {
      setError("خطأ في الاتصال بالخادم");
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
      const matchSearch = !searchQuery || c.name.includes(searchQuery) || c.secret_number.includes(searchQuery) || c.phone.includes(searchQuery);
      if (!matchSearch) return false;
      if (filterStatus === "all") return true;
      if (filterStatus === "withdrawn") return c.status_month === currentMonth && c.status === "withdrawn";
      if (filterStatus === "later") return c.status_month === currentMonth && c.status === "later";
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

      {/* Search ABOVE stats */}
      <div className="bg-[#c3c6bb] p-3 border border-[#222222] relative">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearchDropdown(true)}
            onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
            placeholder="ابحث بالاسم أو الرقم السري أو رقم التليفون..."
            className="w-full h-9 bg-[#b8bcb2] border border-[#888888] pr-9 pl-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#555555]">
            <Search size={16} strokeWidth={1.5} />
          </div>
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

      {/* All Customers Modal */}
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
              جدول جميع عملاء التموين ({customers.length} عميل)
            </h3>
            <div className="flex-1 overflow-y-auto">
              {customers.length > 0 ? (
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
                    {customers.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-[#b8bcb2] transition-colors">
                        <td className="py-2 px-3 text-[#555555] font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-extrabold">{c.name}</td>
                        <td className="py-2 px-3 font-mono font-black">{c.secret_number}</td>
                        <td className="py-2 px-3 text-center font-mono">{c.card_value} ج.م</td>
                        <td className="py-2 px-3 text-center font-mono">{c.bread_points} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#222222] text-[#c3c6bb] font-black">
                      <td className="py-2 px-3" colSpan={3}>الإجمالي</td>
                      <td className="py-2 px-3 text-center font-mono">{customers.reduce((s, c) => s + c.card_value, 0)} ج.م</td>
                      <td className="py-2 px-3 text-center font-mono">{customers.reduce((s, c) => s + c.bread_points, 0)} ج.م</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className="p-8 text-center text-[#555555] font-bold text-xs">لا يوجد عملاء مسجلين</div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === "all" ? "withdrawn" : filterStatus === "withdrawn" ? "all" : "withdrawn")}
          className={`bg-[#c3c6bb] border p-4 text-center cursor-pointer transition-all ${filterStatus === "withdrawn" ? "border-[#27ae60] ring-2 ring-[#27ae60]/40" : "border-[#27ae60]"}`}
        >
          <div className="text-2xl font-black text-[#27ae60]">{stats.withdrawn}</div>
          <div className="text-xs font-bold text-[#27ae60] flex items-center justify-center gap-1">
            <CreditCard size={12} /> تم الصرف ({getMonthLabel(currentMonth)})
          </div>
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === "all" ? "later" : filterStatus === "later" ? "all" : "later")}
          className={`bg-[#c3c6bb] border p-4 text-center cursor-pointer transition-all ${filterStatus === "later" ? "border-[#f39c12] ring-2 ring-[#f39c12]/40" : "border-[#f39c12]"}`}
        >
          <div className="text-2xl font-black text-[#f39c12]">{stats.later}</div>
          <div className="text-xs font-bold text-[#f39c12] flex items-center justify-center gap-1">
            <Clock size={12} /> صرف في وقت لاحق
          </div>
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

      {/* Month notice */}
      <div className="bg-[#e74c3c]/10 border border-[#e74c3c]/30 p-3 text-xs font-bold text-[#000000] flex items-center gap-2">
        <AlertTriangle size={14} strokeWidth={1.5} className="text-[#e74c3c] shrink-0" />
        <span>الشهر الحالي: {getMonthLabel(currentMonth)} — الحالة بتتجدد تلقائياً في أول كل شهر</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-[#555555] bg-[#c3c6bb] border border-[#222222] font-bold text-xs">
          جاري تحميل بيانات العملاء...
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-4">
          {[
            { key: "withdrawn", label: "تم الصرف", color: "#e74c3c", items: filtered.filter(c => c.status_month === currentMonth && c.status === "withdrawn") },
            { key: "later", label: "صرف في وقت لاحق", color: "#f39c12", items: filtered.filter(c => c.status_month === currentMonth && c.status === "later") },
          ].filter(g => g.items.length > 0).map((group) => (
            <div key={group.key} className="bg-[#c3c6bb] border border-[#222222] overflow-x-auto">
              <div className="px-4 py-2 font-black text-xs text-white flex items-center gap-2" style={{ backgroundColor: group.color }}>
                <span>{group.label}</span>
                <span className="bg-white/20 px-2 py-0.5 rounded">{group.items.length}</span>
              </div>
              <table className="w-full text-right text-xs min-w-[800px] border-collapse">
                <thead>
                  <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-10">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">اسم العميل</th>
                    <th className="py-3 px-3">الرقم السري</th>
                    <th className="py-3 px-3">التليفون</th>
                    <th className="py-3 px-3 text-center">مبلغ البطاقة</th>
                    <th className="py-3 px-3 text-center">نقاط الخبز</th>
                    <th className="py-3 px-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
                  {group.items.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-[#b8bcb2] transition-colors">
                      <td className="py-3 px-3 text-[#555555] font-mono">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <p className="font-extrabold text-sm">{c.name}</p>
                      </td>
                      <td className="py-3 px-3 font-mono font-black">{c.secret_number}</td>
                      <td className="py-3 px-3 font-mono">{c.phone || "-"}</td>
                      <td className="py-3 px-3 text-center font-mono">{c.card_value} ج.م</td>
                      <td className="py-3 px-3 text-center font-mono">{c.bread_points} ج.م</td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {c.status_month === currentMonth && c.status === "later" && onWithdrawNow && (
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
          ))}
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
                    <div className="bg-[#f5f5f5] p-3 border border-[#888888]">
                      <p className="text-[10px] text-[#555555] font-bold">اسم العميل</p>
                      <p className="text-sm font-black">{historyCustomer?.name}</p>
                    </div>
                    <div className="bg-[#f5f5f5] p-3 border border-[#888888]">
                      <p className="text-[10px] text-[#555555] font-bold">الرقم السري</p>
                      <p className="text-sm font-black font-mono">{historyCustomer?.secret_number}</p>
                    </div>
                    <div className="bg-[#f5f5f5] p-3 border border-[#888888]">
                      <p className="text-[10px] text-[#555555] font-bold">رقم التليفون</p>
                      <p className="text-sm font-black font-mono">{historyCustomer?.phone || "غير مسجل"}</p>
                    </div>
                    <div className="bg-[#f5f5f5] p-3 border border-[#888888]">
                      <p className="text-[10px] text-[#555555] font-bold">قيمة البطاقة</p>
                      <p className="text-sm font-black font-mono text-blue-600">{historyCustomer?.card_value} ج.م</p>
                    </div>
                    <div className="bg-[#f5f5f5] p-3 border border-[#888888]">
                      <p className="text-[10px] text-[#555555] font-bold">نقاط الخبز</p>
                      <p className="text-sm font-black font-mono text-amber-600">{historyCustomer?.bread_points} ج.م</p>
                    </div>
                    <div className="bg-[#f5f5f5] p-3 border border-[#888888]">
                      <p className="text-[10px] text-[#555555] font-bold">الحالة الحالية</p>
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
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black text-[#222222]">بيانات الصرف ({historyInvoices.length}) — متقسمة بالشهر، اضغط على أي صرف لعرض الأصناف</h4>
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
                          className="h-7 px-3 bg-[#3498db] hover:bg-[#2980b9] text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Receipt size={12} /> عرض فواتير العميل
                        </button>
                      )}
                    </div>
                    {historyInvoices.length > 0 ? (
                      <div className="space-y-3">
                        {(() => {
                          const groups: Record<string, any[]> = {};
                          historyInvoices.forEach((inv: any) => {
                            const mk = String(inv.date || "").slice(0, 7) || "بدون تاريخ";
                            if (!groups[mk]) groups[mk] = [];
                            groups[mk].push(inv);
                          });
                          return Object.keys(groups).sort().reverse().map((mk) => {
                            const list = groups[mk];
                            const mTotal = list.reduce((s: number, v: any) => s + Number(v.total || 0), 0);
                            const mTamween = list.reduce((s: number, v: any) => s + Number(v.tamween_discount || 0), 0);
                            const mBread = list.reduce((s: number, v: any) => s + Number(v.bread_points || 0), 0);
                            const agg: Record<string, any> = {};
                            list.forEach((inv: any) => (Array.isArray(inv.items) ? inv.items : []).forEach((it: any) => {
                              const key = it.barcode || it.name;
                              if (!agg[key]) agg[key] = { name: it.name, unit: it.unit || "", qty: 0 };
                              agg[key].qty += Number(it.quantity || 0);
                            }));
                            const aggList = Object.values(agg);
                            return (
                              <div key={mk} className="border border-[#888888] overflow-hidden">
                                <div className="bg-[#222222] text-[#c3c6bb] px-3 py-2 text-xs font-black flex flex-wrap justify-between gap-2">
                                  <span>شهر {getMonthLabel(mk)} — {list.length} صرفية</span>
                                  <span className="font-mono">الإجمالي: {mTotal.toFixed(2)} ج.م | دعم: {mTamween.toFixed(2)} | خبز: {mBread.toFixed(2)}</span>
                                </div>
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
                                    {list.map((inv: any) => {
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
                            );
                          });
                        })()}
                      </div>
                    ) : (
                      <p className="text-xs text-[#555555] font-bold p-4 text-center bg-[#f5f5f5] border border-[#888888]">لا توجد فواتير مسجلة لهذا العميل</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Items Modal - عرض فواتير العميل */}
      {showInvoiceItems && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-y-auto border border-[#888888] shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#888888] bg-[#222222] text-[#c3c6bb] sticky top-0 z-10">
              <h3 className="text-sm font-black">فواتير العميل: {historyCustomer?.name}</h3>
              <button onClick={() => { setShowInvoiceItems(false); setInvoiceItemsData(null); }} className="cursor-pointer hover:opacity-70"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              {invoiceItemsLoading ? (
                <div className="p-8 text-center text-[#555555] font-bold text-xs">جاري تحميل تفاصيل الفواتير...</div>
              ) : invoiceItemsData && invoiceItemsData.length > 0 ? (
                invoiceItemsData.map((data: any, idx: number) => {
                  const inv = data.invoice;
                  const items = data.items || [];
                  return (
                    <div key={idx} className="border border-[#888888] overflow-hidden">
                      <div className="bg-[#c3c6bb] px-4 py-2 flex justify-between items-center text-xs font-black">
                        <span>فاتورة #{inv.invoice_number}</span>
                        <span className="font-mono">{inv.date}</span>
                        <span className="font-mono text-blue-600">{inv.total?.toFixed(2)} ج.م</span>
                      </div>
                      <table className="w-full text-right text-xs">
                        <thead className="bg-[#222222] text-[#c3c6bb]">
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
                        <tfoot className="bg-[#f5f5f5] font-black">
                          <tr>
                            <td colSpan={5} className="py-2 px-3 text-left">إجمالي الفاتورة</td>
                            <td className="py-2 px-3 text-center font-mono">{items.reduce((s: number, it: any) => s + it.quantity, 0)}</td>
                            <td className="py-2 px-3 text-center font-mono text-blue-600">{inv.total?.toFixed(2)} ج.م</td>
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

      {/* All Customers Modal */}
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
              جدول جميع عملاء التموين ({customers.length} عميل)
            </h3>
            <div className="flex-1 overflow-y-auto">
              {customers.length > 0 ? (
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
                    {customers.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-[#b8bcb2] transition-colors">
                        <td className="py-2 px-3 text-[#555555] font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-extrabold">{c.name}</td>
                        <td className="py-2 px-3 font-mono font-black">{c.secret_number}</td>
                        <td className="py-2 px-3 text-center font-mono">{c.card_value} ج.م</td>
                        <td className="py-2 px-3 text-center font-mono">{c.bread_points} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#222222] text-[#c3c6bb] font-black">
                      <td className="py-2 px-3" colSpan={3}>الإجمالي</td>
                      <td className="py-2 px-3 text-center font-mono">{customers.reduce((s, c) => s + c.card_value, 0)} ج.م</td>
                      <td className="py-2 px-3 text-center font-mono">{customers.reduce((s, c) => s + c.bread_points, 0)} ج.م</td>
                    </tr>
                  </tfoot>
                </table>
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
