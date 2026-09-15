import React, { useState, useEffect } from "react";
import { RefreshCw, Plus, Edit, Trash2, Search, X } from "lucide-react";
import { authFetch } from "../authFetch";

interface ReplacementItem {
  name: string;
  quantity: number;
  unit: string;
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

export default function TamweenReplacements() {
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Replacement | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showTotalsView, setShowTotalsView] = useState(false);
  const [showRemainingView, setShowRemainingView] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
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

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/tamween-replacements/summary?year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
    if (showTotalsView) fetchSummary();
  }, [showTotalsView, selectedYear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem ? `/api/tamween-replacements/${editingItem.id}` : "/api/tamween-replacements";
      const method = editingItem ? "PUT" : "POST";
      
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      
      if (res.ok) {
        setShowModal(false);
        setEditingItem(null);
        resetForm();
        fetchReplacements();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه الاستعاضة؟")) return;
    try {
      const res = await authFetch(`/api/tamween-replacements/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchReplacements();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (item: Replacement) => {
    setEditingItem(item);
    setForm({
      date: item.date,
      invoice_number: item.invoice_number,
      supplier_name: item.supplier_name,
      items_description: item.items_description,
      total_value: item.total_value,
      status: item.status,
      notes: item.notes
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setForm({
      date: new Date().toISOString().slice(0, 10),
      invoice_number: "",
      supplier_name: "",
      items_description: "",
      total_value: 0,
      status: "pending",
      notes: ""
    });
  };

  const filteredReplacements = replacements.filter(r => 
    r.supplier_name.includes(searchQuery) || 
    r.items_description.includes(searchQuery) ||
    r.invoice_number.includes(searchQuery)
  );

  const totalValue = filteredReplacements.reduce((sum, r) => sum + r.total_value, 0);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden font-sans" style={{ direction: "rtl" }}>
      {/* Header */}
      <header className="bg-[#c3c6bb] p-4 border-b border-[#222222] shrink-0 flex justify-between items-center no-print">
        <div className="flex items-center gap-3">
          <div className="bg-[#222222] p-2 text-[#c3c6bb]">
            <RefreshCw size={24} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#000000]">الاستعاضات التموينية</h2>
            <p className="text-xs text-[#555555] font-bold mt-1">تسجيل الاستعاضات من الشركة</p>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="p-4 bg-[#b8bcb2] border-b border-[#888888] flex gap-4 items-center shrink-0 no-print flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold">الشهر:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-[#888888] text-sm font-bold bg-white"
          />
        </div>
        {showTotalsView && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold">السنة:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 border border-[#888888] text-sm font-bold bg-white"
            >
              {[2024, 2025, 2026, 2027, 2028].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1 flex items-center gap-2">
          <Search size={16} />
          <input
            type="text"
            placeholder="بحث في الاستعاضات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 border border-[#888888] text-sm font-bold bg-white"
          />
        </div>
        <button
          onClick={() => { setShowTotalsView(!showTotalsView); setShowRemainingView(false); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-colors ${showTotalsView ? 'bg-[#e67e22] text-white' : 'bg-[#222222] text-[#c3c6bb] hover:bg-[#000000]'}`}
        >
          📊 إجمالي الاستعاضات
        </button>
        <button
          onClick={() => { setShowRemainingView(!showRemainingView); setShowTotalsView(false); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-colors ${showRemainingView ? 'bg-[#27ae60] text-white' : 'bg-[#222222] text-[#c3c6bb] hover:bg-[#000000]'}`}
        >
          📦 المتبقي من الاستعاضات
        </button>
        <button
          onClick={() => { resetForm(); setEditingItem(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#222222] text-[#c3c6bb] hover:bg-[#000000] text-sm font-bold transition-colors"
        >
          <Plus size={16} /> إضافة استعاضة
        </button>
      </div>

      {/* Summary */}
      <div className="p-4 bg-[#f5f5f5] border-b border-[#888888] shrink-0">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-[#555555]">عدد الاستعاضات: {filteredReplacements.length}</span>
          <span className="text-sm font-bold text-orange-600">إجمالي القيمة: {totalValue.toFixed(2)} ج.م</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        {loading ? (
          <div className="p-12 text-center text-[#555555] font-bold">جاري تحميل البيانات...</div>
        ) : (
          <>
            {/* Totals View - كشف التسويات الشهري والسنوي */}
            {showTotalsView && (
              <div className="space-y-4">
                {loading ? (
                  <div className="p-6 text-center text-[#555555]">جاري تحميل الكشف...</div>
                ) : summary ? (
                  <>
                    {/* الإجمالي السنوي */}
                    <div className="bg-gradient-to-l from-orange-500 to-orange-600 text-white p-5 border shadow-lg">
                      <h3 className="text-sm font-black mb-2 opacity-90">الإجمالي السنوي — {summary.year}</h3>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-3xl font-black">{summary.annual.total.toFixed(2)} <span className="text-lg">ج.م</span></p>
                          <p className="text-sm mt-1 opacity-80">{summary.annual.count} تسوية</p>
                        </div>
                      </div>
                    </div>

                    {/* تفاصيل شهري */}
                    <h3 className="text-sm font-black text-[#000000] bg-[#f5f5f5] p-3 border border-[#888888]">
                      تفصيل شهري
                    </h3>
                    {summary.monthly.length === 0 ? (
                      <div className="p-6 text-center text-[#555555]">لا توجد تسويات لهذا السنة.</div>
                    ) : (
                      summary.monthly.map((m: any) => {
                        const monthNames: Record<string, string> = {
                          "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
                          "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
                          "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
                        };
                        const monthKey = m.month.substring(5, 7);
                        const monthLabel = monthNames[monthKey] || monthKey;
                        const yearLabel = m.month.substring(0, 4);
                        const details = summary.monthly_details?.[m.month] || [];
                        const isExpanded = expandedMonth === m.month;
                        return (
                          <div key={m.month} className="border border-[#888888] bg-white">
                            <div
                              className="p-3 bg-[#f9f9f9] cursor-pointer hover:bg-[#eef] flex justify-between items-center"
                              onClick={() => setExpandedMonth(isExpanded ? null : m.month)}
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-black">📅 {monthLabel} {yearLabel}</span>
                                <span className="text-xs text-[#555555] bg-[#eee] px-2 py-0.5 rounded">{m.count} تسوية</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-orange-600">{m.total.toFixed(2)} ج.م</span>
                                <button className="text-[#222] font-black">{isExpanded ? "▲" : "▼"}</button>
                              </div>
                            </div>
                            {isExpanded && details.length > 0 && (
                              <div className="p-3 border-t border-[#ddd]">
                                <table className="w-full text-xs text-right">
                                  <thead>
                                    <tr className="bg-[#222] text-[#c3c6bb]">
                                      <th className="py-1 px-2">التاريخ</th>
                                      <th className="py-1 px-2">المورد</th>
                                      <th className="py-1 px-2">رقم الفاتورة</th>
                                      <th className="py-1 px-2 text-center">القيمة</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#888888]/30">
                                    {details.map((d: any) => (
                                      <tr key={d.id}>
                                        <td className="py-1 px-2">{d.date}</td>
                                        <td className="py-1 px-2">{d.supplier_name}</td>
                                        <td className="py-1 px-2">{d.invoice_number || "-"}</td>
                                        <td className="py-1 px-2 text-center font-mono font-bold">{d.total_value.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </>
                ) : (
                  <div className="p-6 text-center text-[#555555]">اضغط على الزر لتحميل الكشف.</div>
                )}
              </div>
            )}

            {/* Remaining View */}
            {showRemainingView && (
              <div className="space-y-3">
                <h3 className="text-sm font-black text-[#000000] bg-[#f5f5f5] p-3 border border-[#888888]">
                  📦 المتبقي من الاستعاضات (لم يُبَع بعد)
                </h3>
                {filteredReplacements.length === 0 ? (
                  <div className="p-6 text-center text-[#555555]">لا توجد استعاضات.</div>
                ) : (
                  filteredReplacements.map((rep) => {
                    const items = parseItems(rep.items_json);
                    const totalRemaining = items.reduce((sum, it) => sum + it.quantity, 0);
                    const hasRemaining = totalRemaining > 0;
                    return (
                      <div key={rep.id} className={`border ${hasRemaining ? 'border-green-400' : 'border-gray-400'} bg-white p-3`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-black">📅 {rep.date}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${hasRemaining ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'}`}>
                            {hasRemaining ? 'لم يُبَع بعد' : 'تم البيع الكامل'}
                          </span>
                        </div>
                        <p className="text-xs text-[#555555]">المورد: {rep.supplier_name}</p>
                        {items.length === 0 ? (
                          <p className="text-xs text-[#555555]">لا توجد بنود</p>
                        ) : (
                          <table className="w-full text-xs text-right mt-1">
                            <thead>
                              <tr className="bg-[#222] text-[#c3c6bb]">
                                <th className="py-1 px-2">الصنف</th>
                                <th className="py-1 px-2 text-center">الكمية الكلية</th>
                                <th className="py-1 px-2 text-center">المتبقي</th>
                                <th className="py-1 px-2 text-center">الوحدة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#888888]/30">
                              {items.map((it, idx) => (
                                <tr key={idx}>
                                  <td className="py-1 px-2">{it.name}</td>
                                  <td className="py-1 px-2 text-center font-mono">{it.quantity}</td>
                                  <td className="py-1 px-2 text-center font-mono text-green-600">{it.quantity}</td>
                                  <td className="py-1 px-2 text-center">{it.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        <p className="text-xs font-bold mt-1">إجمالي المتبقي: {totalRemaining} {items[0]?.unit || ""}</p>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Default Table View */}
            {!showTotalsView && !showRemainingView && (
              <div className="border border-[#888888] overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#222222] text-[#c3c6bb] font-bold">
                      <th className="py-3 px-4">التاريخ</th>
                      <th className="py-3 px-4">رقم الفاتورة</th>
                      <th className="py-3 px-4">المورد</th>
                      <th className="py-3 px-4">وصف المنتجات</th>
                      <th className="py-3 px-4 text-center">القيمة</th>
                      <th className="py-3 px-4 text-center">الحالة</th>
                      <th className="py-3 px-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#888888]/40 font-bold">
                    {filteredReplacements.map((item) => (
                      <tr key={item.id} className="hover:bg-[#b8bcb2] transition-colors">
                        <td className="py-3 px-4 font-mono">{item.date}</td>
                        <td className="py-3 px-4 font-mono">{item.invoice_number || "-"}</td>
                        <td className="py-3 px-4">{item.supplier_name}</td>
                        <td className="py-3 px-4 max-w-[200px] truncate">{item.items_description}</td>
                        <td className="py-3 px-4 text-center font-mono text-orange-600 font-black">{item.total_value.toFixed(2)} ج.م</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 text-[10px] font-bold ${
                            item.status === 'received' ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'
                          }`}>
                            {item.status === 'received' ? 'تم الاستلام' : 'قيد الانتظار'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleEdit(item)}
                              className="bg-blue-500 text-white p-1.5 hover:bg-blue-600 transition-colors"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="bg-red-500 text-white p-1.5 hover:bg-red-600 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <label className="block text-xs font-bold text-[#555555] mb-1">اسم المورد / الشركة</label>
                <input
                  type="text"
                  value={form.supplier_name}
                  onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#555555] mb-1">وصف المنتجات</label>
                <textarea
                  value={form.items_description}
                  onChange={(e) => setForm({ ...form, items_description: e.target.value })}
                  className="w-full px-3 py-2 border border-[#888888] text-sm font-bold h-20 resize-none"
                  placeholder="مثال: 20 عبوة حليب، 10 عبوات زبادي..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">القيمة الإجمالية (ج.م)</label>
                  <input
                    type="number"
                    value={form.total_value}
                    onChange={(e) => setForm({ ...form, total_value: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                    min="0"
                    required
                  />
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
