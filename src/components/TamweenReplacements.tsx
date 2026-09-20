import React, { useState, useEffect } from "react";
import { RefreshCw, Plus, Edit, Trash2, Search, X, Package, Minus, Eye } from "lucide-react";
import { authFetch } from "../authFetch";

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
  name: string;
  barcode?: string;
  quantity: number;
  unit: string;
  purchase_price?: number;
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
  const [tamweenProducts, setTamweenProducts] = useState<TamweenProduct[]>([]);
  const [selectedItems, setSelectedItems] = useState<ReplacementItem[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [remainingData, setRemainingData] = useState<any[]>([]);
  const [showBreadPointsView, setShowBreadPointsView] = useState(false);
  const [breadPointsData, setBreadPointsData] = useState<any>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  
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

  const fetchTamweenProducts = async () => {
    try {
      const res = await authFetch("/api/tamween-products");
      if (res.ok) {
        const data = await res.json();
        setTamweenProducts(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addProductToSelection = (product: TamweenProduct) => {
    const existing = selectedItems.find(item => item.barcode === product.barcode);
    let nextItems: ReplacementItem[];
    if (existing) {
      nextItems = selectedItems.map(item =>
        item.barcode === product.barcode
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      nextItems = [...selectedItems, {
        name: product.name,
        barcode: product.barcode,
        quantity: 1,
        unit: product.unit,
        purchase_price: product.purchase_price
      }];
    }
    setSelectedItems(nextItems);
    updateItemsDescription(nextItems);
  };

  const updateSelectedItemQuantity = (barcode: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems(prev => prev.filter(item => item.barcode !== barcode));
      updateItemsDescription(selectedItems.filter(item => item.barcode !== barcode));
    } else {
      const updated = selectedItems.map(item => 
        item.barcode === barcode ? { ...item, quantity } : item
      );
      setSelectedItems(updated);
      updateItemsDescription(updated);
    }
  };

  const removeSelectedItem = (barcode: string) => {
    const updated = selectedItems.filter(item => item.barcode !== barcode);
    setSelectedItems(updated);
    updateItemsDescription(updated);
  };

  const updateItemsDescription = (items: ReplacementItem[]) => {
    const desc = items.map(item => `${item.quantity} ${item.unit} ${item.name}`).join("، ");
    setForm(prev => ({ ...prev, items_description: desc }));
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

  const fetchRemaining = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/tamween-replacements/remaining?month=${selectedMonth}`);
      if (res.ok) {
        const data = await res.json();
        setRemainingData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBreadPoints = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/tamween-customers/bread-points-summary?month=${selectedMonth}`);
      if (res.ok) {
        const data = await res.json();
        setBreadPointsData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoiceItems = async (invoiceNumber: string) => {
    if (!invoiceNumber) return;
    setLoadingItems(true);
    try {
      const res = await authFetch(`/api/invoices/by-number/${encodeURIComponent(invoiceNumber)}`);
      if (res.ok) {
        const data = await res.json();
        setInvoiceItems(data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItems(false);
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

  useEffect(() => {
    if (showRemainingView) fetchRemaining();
  }, [showRemainingView, selectedMonth]);

  useEffect(() => {
    if (showBreadPointsView) fetchBreadPoints();
  }, [showBreadPointsView, selectedMonth]);

  useEffect(() => {
    if (showModal) {
      fetchTamweenProducts();
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
      
      const computedTotal = selectedItems.length > 0 ? selectedItems.reduce((s, it) => s + it.quantity * (it.purchase_price || 0), 0) : form.total_value;
      const body = {
        ...form,
        total_value: computedTotal,
        items: selectedItems.length > 0 ? selectedItems : undefined
      };
      
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
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

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white font-sans" style={{ direction: "rtl" }}>
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
          onClick={() => { setShowBreadPointsView(!showBreadPointsView); setShowTotalsView(false); setShowRemainingView(false); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-colors ${showBreadPointsView ? 'bg-[#8B4513] text-white' : 'bg-[#222222] text-[#c3c6bb] hover:bg-[#000000]'}`}
        >
          🍞 إجمالي نقاط الخبز
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
                                      <th className="py-1 px-2 text-center">تفاصيل</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#888888]/30">
                                    {details.map((d: any) => (
                                      <React.Fragment key={d.id}>
                                        <tr>
                                          <td className="py-1 px-2">{d.date}</td>
                                          <td className="py-1 px-2">{d.supplier_name}</td>
                                          <td className="py-1 px-2">{d.invoice_number || "-"}</td>
                                          <td className="py-1 px-2 text-center font-mono font-bold">{d.total_value.toFixed(2)}</td>
                                          <td className="py-1 px-2 text-center">
                                            {d.invoice_number && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (expandedInvoiceId === d.id) {
                                                    setExpandedInvoiceId(null);
                                                    setInvoiceItems([]);
                                                  } else {
                                                    setExpandedInvoiceId(d.id);
                                                    fetchInvoiceItems(d.invoice_number);
                                                  }
                                                }}
                                                className="bg-blue-500 text-white p-1 hover:bg-blue-600 transition-colors"
                                                title="تفاصيل الفاتورة"
                                              >
                                                <Eye size={12} />
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                        {expandedInvoiceId === d.id && (
                                          <tr>
                                            <td colSpan={5} className="p-2 bg-[#f5f5f5]">
                                              {loadingItems ? (
                                                <div className="text-center text-xs text-[#888] py-2">جاري التحميل...</div>
                                              ) : invoiceItems.length > 0 ? (
                                                <table className="w-full text-[10px] text-right">
                                                  <thead>
                                                    <tr className="bg-[#222] text-[#c3c6bb]">
                                                      <th className="py-1 px-2">الصنف</th>
                                                      <th className="py-1 px-2">الباركود</th>
                                                      <th className="py-1 px-2 text-center">الكمية</th>
                                                      <th className="py-1 px-2">الوحدة</th>
                                                      <th className="py-1 px-2 text-center">سعر الشراء</th>
                                                      <th className="py-1 px-2 text-center">الإجمالي</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-[#ddd]/50">
                                                    {invoiceItems.map((item: any) => (
                                                      <tr key={item.id} className="hover:bg-white">
                                                        <td className="py-1 px-2 font-bold">{item.name}</td>
                                                        <td className="py-1 px-2 font-mono">{item.barcode}</td>
                                                        <td className="py-1 px-2 text-center font-mono">{item.quantity}</td>
                                                        <td className="py-1 px-2">{item.unit || "قطعة"}</td>
                                                        <td className="py-1 px-2 text-center font-mono">{(item.cost_price || item.price || 0).toFixed(2)}</td>
                                                        <td className="py-1 px-2 text-center font-mono font-bold">{item.total.toFixed(2)}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              ) : (
                                                <div className="text-center text-xs text-[#888] py-2">لا توجد أصناف</div>
                                              )}
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
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
                  📦 المتبقي من الاستعاضات (بعد البيع من الكاشير)
                </h3>
                {remainingData.length === 0 ? (
                  <div className="p-6 text-center text-[#555555]">لا توجد استعاضات.</div>
                ) : (
                  remainingData.map((rep: any) => {
                    const items = rep.items || [];
                    const totalRemaining = items.reduce((sum: number, it: any) => sum + it.remaining_quantity, 0);
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
                                <th className="py-1 px-2 text-center">الكمية الأصلية</th>
                                <th className="py-1 px-2 text-center">تم البيع</th>
                                <th className="py-1 px-2 text-center">المتبقي</th>
                                <th className="py-1 px-2 text-center">الوحدة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#888888]/30">
                              {items.map((it: any, idx: number) => (
                                <tr key={idx}>
                                  <td className="py-1 px-2">{it.name}</td>
                                  <td className="py-1 px-2 text-center font-mono">{it.original_quantity}</td>
                                  <td className="py-1 px-2 text-center font-mono text-red-500">{it.sold_quantity}</td>
                                  <td className="py-1 px-2 text-center font-mono text-green-600 font-bold">{it.remaining_quantity}</td>
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

            {/* Bread Points View */}
            {showBreadPointsView && (
              <div className="space-y-3">
                <h3 className="text-sm font-black text-[#000000] bg-[#f5f5f5] p-3 border border-[#888888]">
                  🍞 إجمالي نقاط الخبز الشهرية
                </h3>
                {breadPointsData ? (
                  <div className="space-y-3">
                    <div className="bg-gradient-to-l from-amber-500 to-amber-600 text-white p-5 border shadow-lg">
                      <h3 className="text-sm font-black mb-2 opacity-90">إجمالي نقاط الخبز — {selectedMonth}</h3>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-3xl font-black">{breadPointsData.total_points} <span className="text-lg">ج.م</span></p>
                          <p className="text-sm mt-1 opacity-80">{breadPointsData.customer_count} عميل</p>
                        </div>
                      </div>
                    </div>
                    
                    {breadPointsData.customers && breadPointsData.customers.length > 0 && (
                      <div className="border border-[#888888] bg-white">
                        <table className="w-full text-xs text-right">
                          <thead>
                            <tr className="bg-[#222] text-[#c3c6bb]">
                              <th className="py-2 px-3">العميل</th>
                              <th className="py-2 px-3">الرقم السري</th>
                              <th className="py-2 px-3 text-center">نقاط الخبز</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#888888]/30">
                            {breadPointsData.customers.map((c: any, idx: number) => (
                              <tr key={idx}>
                                <td className="py-2 px-3 font-bold">{c.name}</td>
                                <td className="py-2 px-3 font-mono">{c.secret_number}</td>
                                <td className="py-2 px-3 text-center font-mono font-bold text-amber-600">{c.bread_points} ج.م</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center text-[#555555]">جاري تحميل البيانات...</div>
                )}
              </div>
            )}

            {/* Default Table View */}
            {!showTotalsView && !showRemainingView && !showBreadPointsView && (
              <div className="border border-[#888888] overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#222222] text-[#c3c6bb] font-bold">
                      <th className="py-3 px-4">التاريخ</th>
                      <th className="py-3 px-4">رقم الفاتورة</th>
                      <th className="py-3 px-4">المورد</th>
                      <th className="py-3 px-4">تفاصيل المنتجات</th>
                      <th className="py-3 px-4 text-center">القيمة</th>
                      <th className="py-3 px-4 text-center">الحالة</th>
                      <th className="py-3 px-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#888888]/40 font-bold">
                    {filteredReplacements.map((item) => {
                      const items = parseItems(item.items_json);
                      return (
                        <tr key={item.id} className="hover:bg-[#b8bcb2] transition-colors">
                          <td className="py-3 px-4 font-mono">{item.date}</td>
                          <td className="py-3 px-4 font-mono">{item.invoice_number || "-"}</td>
                          <td className="py-3 px-4">{item.supplier_name}</td>
                          <td className="py-3 px-4 max-w-[250px]">
                            {items.length > 0 ? (
                              <div className="space-y-1">
                                {items.slice(0, 3).map((it, idx) => (
                                  <div key={idx} className="text-[10px]">
                                    <span className="font-black">{it.quantity}</span> {it.unit} {it.name}
                                    {it.purchase_price ? <span className="text-[#888]"> ({it.purchase_price.toFixed(2)} ج.م)</span> : null}
                                  </div>
                                ))}
                                {items.length > 3 && <div className="text-[10px] text-[#888]">+{items.length - 3} منتج آخر</div>}
                              </div>
                            ) : (
                              <span className="truncate block max-w-[200px]">{item.items_description}</span>
                            )}
                          </td>
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
                      );
                    })}
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
                <label className="block text-xs font-bold text-[#555555] mb-1">المنتجات المختارة</label>
                <div className="border border-[#888888] p-3 bg-[#f9f9f9] max-h-40 overflow-y-auto">
                  {selectedItems.length === 0 ? (
                    <p className="text-xs text-[#999] text-center py-2">لم يتم اختيار منتجات بعد</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedItems.map((item) => (
                        <div key={item.barcode} className="flex items-center gap-2 bg-white p-2 border border-[#ddd]">
                          <span className="flex-1 text-xs font-bold">{item.name}</span>
                          <span className="text-xs text-[#666]">{item.unit}</span>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateSelectedItemQuantity(item.barcode || "", Number(e.target.value))}
                            className="w-16 px-2 py-1 border border-[#888] text-xs font-bold text-center"
                            min="1"
                          />
                          <button
                            type="button"
                            onClick={() => removeSelectedItem(item.barcode || "")}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#555555] mb-1">إضافة منتج من التموين</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="بحث بالاسم أو الباركود..."
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[#888888] text-sm font-bold"
                  />
                </div>
                <div className="border border-[#888888] max-h-32 overflow-y-auto bg-white">
                  {tamweenProducts
                    .filter(p => {
                      const q = productSearchQuery.toLowerCase().trim();
                      if (!q) return true;
                      return p.name.toLowerCase().includes(q) || (p.barcode || "").toLowerCase().includes(q);
                    })
                    .slice(0, 10)
                    .map((product) => (
                      <div
                        key={product.id}
                        onClick={() => addProductToSelection(product)}
                        className="flex items-center justify-between p-2 hover:bg-[#e8f5e9] cursor-pointer border-b border-[#eee] last:border-0"
                      >
                        <div>
                          <span className="text-xs font-bold">{product.name}</span>
                          <span className="text-[10px] text-[#888] mr-2">({product.barcode})</span>
                        </div>
                        <div className="text-[10px] text-[#666]">
                          {product.quantity} {product.unit} | {product.purchase_price.toFixed(2)} ج.م
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">القيمة الإجمالية (ج.م) {selectedItems.length > 0 ? "(محسوبة تلقائياً)" : ""}</label>
                  <input
                    type="number"
                    value={selectedItems.length > 0 ? selectedItems.reduce((sum, item) => sum + (item.quantity * (item.purchase_price || 0)), 0) : form.total_value}
                    onChange={(e) => setForm({ ...form, total_value: Number(e.target.value) })}
                    readOnly={selectedItems.length > 0}
                    className={`w-full px-3 py-2 border border-[#888888] text-sm font-bold ${selectedItems.length > 0 ? 'bg-[#f0f0f0] cursor-not-allowed' : 'bg-white'}`}
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
