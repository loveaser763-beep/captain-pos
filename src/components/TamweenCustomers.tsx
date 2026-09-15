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
        <div className="bg-[#c3c6bb] border border-[#222222] p-4 text-center">
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
                              onClick={() => onWithdrawNow({ name: c.name, secret_number: c.secret_number, card_value: c.card_value, bread_points: c.bread_points })}
                              className="h-8 px-2 flex items-center justify-center bg-[#27ae60] hover:bg-[#219a52] text-white border-none cursor-pointer text-[10px] font-bold gap-1"
                              title="صرف الآن"
                            >
                              <CreditCard size={10} />
                              <span>صرف الآن</span>
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
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#f5f5f5] p-3 border border-[#888888]">
                      <p className="text-[10px] text-[#555555] font-bold">الرقم السري</p>
                      <p className="text-sm font-black font-mono">{historyCustomer?.secret_number}</p>
                    </div>
                    <div className="bg-[#f5f5f5] p-3 border border-[#888888]">
                      <p className="text-[10px] text-[#555555] font-bold">قيمة البطاقة</p>
                      <p className="text-sm font-black font-mono">{historyCustomer?.card_value} ج.م</p>
                    </div>
                    <div className="bg-[#f5f5f5] p-3 border border-[#888888]">
                      <p className="text-[10px] text-[#555555] font-bold">الحالة الحالية</p>
                      <p className={`text-sm font-black ${historyCustomer?.status === 'withdrawn' ? 'text-red-600' : historyCustomer?.status === 'later' ? 'text-amber-600' : 'text-blue-600'}`}>
                        {historyCustomer?.status === 'withdrawn' ? 'تم الصرف' : historyCustomer?.status === 'later' ? 'صرف في وقت لاحق' : 'جديد'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[#222222] mb-2">الفواتير ({historyInvoices.length})</h4>
                    {historyInvoices.length > 0 ? (
                      <div className="border border-[#888888] overflow-hidden">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-[#b8bcb2]">
                            <tr>
                              <th className="py-2 px-3 font-bold">رقم الفاتورة</th>
                              <th className="py-2 px-3 font-bold">التاريخ</th>
                              <th className="py-2 px-3 font-bold">الإجمالي</th>
                              <th className="py-2 px-3 font-bold">الحالة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#888888]/40">
                            {historyInvoices.map((inv: any) => (
                              <tr key={inv.id} className="hover:bg-[#f5f5f5]">
                                <td className="py-2 px-3 font-mono">{inv.invoice_number}</td>
                                <td className="py-2 px-3">{inv.date}</td>
                                <td className="py-2 px-3 font-mono">{inv.total?.toFixed(2)} ج.م</td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 text-[10px] font-bold ${inv.status === 'returned' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {inv.status === 'returned' ? 'مرتجع' : '-active'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
    </div>
  );
}
