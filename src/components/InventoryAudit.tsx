import React, { useEffect, useState } from "react";
import {
  ClipboardCheck,
  Search,
  History,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  FileText,
  Printer,
  TrendingDown,
  TrendingUp,
  Filter
} from "lucide-react";
import { User, Item, InventoryAudit as AuditType, InventoryAuditItem as AuditItemType } from "../types";
import { authFetch } from "../authFetch";

interface InventoryAuditProps {
  currentUser: User | null;
}

export default function InventoryAudit({ currentUser }: InventoryAuditProps) {
  const [activeSubTab, setActiveSubTab] = useState<"new_audit" | "history">("new_audit");

  const [items, setItems] = useState<Item[]>([]);
  const [audits, setAudits] = useState<AuditType[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDiscrepancyOnly, setFilterDiscrepancyOnly] = useState(false);

  const [actualQuantities, setActualQuantities] = useState<Record<string, number>>({});
  const [prefilled, setPrefilled] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null);
  const [auditDetail, setAuditDetail] = useState<{ audit: AuditType; items: AuditItemType[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const isAdminOrStorekeeper = currentUser?.role === "admin" || currentUser?.permissions?.includes("items");

  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      const res = await authFetch("/api/items");
      if (!res.ok) throw new Error("فشلت الشبكة في تحميل قائمة الأصناف.");
      const data = await res.json();
      setItems(data);
      
      const initialQ: Record<string, number> = {};
      data.forEach((it: Item) => {
        initialQ[it.barcode] = 0;
      });
      setActualQuantities(initialQ);
      setPrefilled(false);
      setError("");
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تحميل الأصناف.");
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchAudits = async () => {
    setLoadingAudits(true);
    try {
      const res = await authFetch("/api/inventory/audits");
      if (!res.ok) throw new Error("فشلت الشبكة في جلب أرشيف الجرد.");
      const data = await res.json();
      setAudits(data);
    } catch (err: any) {
      console.error("Error loading audits:", err);
    } finally {
      setLoadingAudits(false);
    }
  };

  const fetchAuditDetail = async (id: number) => {
    setLoadingDetail(true);
    setSelectedAuditId(id);
    try {
      const res = await authFetch(`/api/inventory/audits/${id}`);
      if (!res.ok) throw new Error("فشل جلب تفاصيل الجلسة.");
      const data = await res.json();
      setAuditDetail(data);
    } catch (err: any) {
      alert(err.message || "فشل جلب التفاصيل.");
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchAudits();
  }, []);

  const prefillWithSystemQuantities = () => {
    const filled: Record<string, number> = {};
    items.forEach((it) => {
      filled[it.barcode] = it.quantity || 0;
    });
    setActualQuantities(filled);
    setPrefilled(true);
  };

  const handleQtyChange = (barcode: string, val: number) => {
    setActualQuantities((prev) => ({
      ...prev,
      [barcode]: Math.max(0, val)
    }));
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrStorekeeper) {
      setError("عذراً، لا تمتلك صلاحية اعتماد الجرد وتعديل الكميات.");
      return;
    }

    if (items.length === 0) {
      setError("لا يوجد أصناف في النظام لإجراء جرد عليها.");
      return;
    }

    if (!window.confirm("هل أنت متأكد من اعتماد الجرد؟ سيتم تسوية كميات المخزن فوراً.")) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const auditedItems = items.map((it) => ({
        barcode: it.barcode,
        actual_qty: typeof actualQuantities[it.barcode] === "number" ? actualQuantities[it.barcode] : 0
      }));

      const payload = {
        audited_by: currentUser?.name || "مشرف الجرد",
        notes: notes.trim(),
        items: auditedItems
      };

      const res = await authFetch("/api/inventory/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "حدوث خطأ أثناء الحفظ.");
      }

      const resData = await res.json();
      setMessage(`تم اعتماد وحفظ محضر الجرد بنجاح. رقم السند: ${resData.auditId}.`);
      setNotes("");
      
      fetchItems();
      fetchAudits();
      setActiveSubTab("history");
      if (resData.auditId) {
        fetchAuditDetail(resData.auditId);
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ مفاجئ.");
    } finally {
      setSaving(false);
    }
  };

  const computedStats = () => {
    let contestedItemsCount = 0;
    let discrepanciesCount = 0;
    let totalValueSystemCost = 0;
    let totalDeficit = 0;
    let totalSurplus = 0;

    items.forEach((it) => {
      const qSystem = it.quantity || 0;
      const qActual = actualQuantities[it.barcode] ?? 0;
      const diff = qActual - qSystem;
      const cost = it.purchase_price || 0;

      totalValueSystemCost += qSystem * cost;

      if (diff === 0) {
        contestedItemsCount++;
      } else {
        discrepanciesCount++;
        const financialValue = diff * cost;
        if (diff < 0) {
          totalDeficit += Math.abs(financialValue);
        } else {
          totalSurplus += financialValue;
        }
      }
    });

    return {
      totalValueSystemCost,
      totalDeficit,
      totalSurplus,
      contestedItemsCount,
      discrepanciesCount,
      totalItems: items.length
    };
  };

  const { totalValueSystemCost, totalDeficit, totalSurplus, contestedItemsCount, discrepanciesCount, totalItems } = computedStats();

  const filteredActiveItems = items.filter((it) => {
    const matchSearch =
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.barcode.includes(searchQuery);

    if (filterDiscrepancyOnly) {
      const systemVal = it.quantity || 0;
      const actualVal = actualQuantities[it.barcode] ?? 0;
      return matchSearch && systemVal !== actualVal;
    }

    return matchSearch;
  });

  const handlePrintAudit = async () => {
    const node = document.getElementById("inventory-audit-view");
    if (node) {
      try {
        const { toPng } = await import("html-to-image");
        const dataUrl = await toPng(node, { backgroundColor: "#ffffff" });
        const link = document.createElement("a");
        link.download = "جرد_المخزون.png";
        link.href = dataUrl;
        link.click();
      } catch (e) {
        alert("تعذر حفظ الصورة: " + e.message);
      }
    }
  };

  return (
    <div className="w-full space-y-6 select-none font-sans" id="inventory-audit-view" style={{ direction: "rtl" }}>
      
      {/* Header */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#000000] flex items-center gap-2">
            <ClipboardCheck size={20} strokeWidth={1.5} />
            <span>جرد وتسوية المخزون</span>
          </h2>
          <p className="text-xs text-[#555555] font-semibold mt-1">مطابقة المخزون الفعلي مع السجلات وحساب الفروقات والعجز</p>
        </div>

        <div className="flex bg-[#b8bcb2] p-1 border border-[#888888]">
          <button
            type="button"
            id="tab-new-audit"
            onClick={() => {
              setActiveSubTab("new_audit");
              setMessage("");
              setError("");
            }}
            className={`h-8 px-4 text-xs font-bold transition-colors cursor-pointer ${
              activeSubTab === "new_audit" ? "bg-[#222222] text-[#c3c6bb]" : "text-[#000000]"
            }`}
          >
            جلسة جرد جارية
          </button>
          <button
            type="button"
            id="tab-audit-history"
            onClick={() => {
              setActiveSubTab("history");
              setMessage("");
              setError("");
              fetchAudits();
            }}
            className={`h-8 px-4 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === "history" ? "bg-[#222222] text-[#c3c6bb]" : "text-[#000000]"
            }`}
          >
            <History size={14} strokeWidth={1.5} />
            <span>أرشيف الجرد</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="audit-msg-success">
          <CheckCircle size={16} strokeWidth={1.5} className="text-[#000000] shrink-0" />
          <p>{message}</p>
        </div>
      )}

      {error && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="audit-msg-error">
          <AlertTriangle size={16} strokeWidth={1.5} className="text-[#222222] shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {activeSubTab === "new_audit" ? (
        <div className="space-y-4">
          
          {/* Stats 12-Column Grid */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 sm:col-span-6 md:col-span-3 bg-[#c3c6bb] p-3 border border-[#222222] text-right">
              <span className="block text-xs font-bold text-[#555555]">إجمالي الأصناف</span>
              <p className="text-lg font-black text-[#000000] mt-1">{totalItems}</p>
            </div>
            <div className="col-span-12 sm:col-span-6 md:col-span-3 bg-[#c3c6bb] p-3 border border-[#222222] text-right">
              <span className="block text-xs font-bold text-[#555555]">قيمة المخزون (الشراء)</span>
              <p className="text-lg font-black text-[#000000] mt-1">{totalValueSystemCost.toFixed(2)} ج.م</p>
            </div>
            <div className="col-span-12 sm:col-span-6 md:col-span-3 bg-[#c3c6bb] p-3 border border-[#222222] text-right">
              <span className="block text-xs font-bold text-[#555555] flex items-center gap-1">
                <TrendingDown size={14} strokeWidth={1.5} />
                <span>إجمالي العجز</span>
              </span>
              <p className="text-lg font-black text-[#000000] mt-1">-{totalDeficit.toFixed(2)} ج.م</p>
            </div>
            <div className="col-span-12 sm:col-span-6 md:col-span-3 bg-[#c3c6bb] p-3 border border-[#222222] text-right">
              <span className="block text-xs font-bold text-[#555555] flex items-center gap-1">
                <TrendingUp size={14} strokeWidth={1.5} />
                <span>إجمالي الزيادة</span>
              </span>
              <p className="text-lg font-black text-[#000000] mt-1">+{totalSurplus.toFixed(2)} ج.م</p>
            </div>
          </div>

          {/* Controls Bar 12-Column Grid */}
          <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            
            <div className="flex flex-col sm:flex-row gap-x-4 gap-y-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="البحث بالاسم أو الباركود..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] pr-9 pl-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#555555]">
                  <Search size={16} strokeWidth={1.5} />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFilterDiscrepancyOnly(!filterDiscrepancyOnly)}
                className={`h-9 px-3 text-xs font-bold border transition-colors flex items-center gap-2 cursor-pointer ${
                  filterDiscrepancyOnly
                    ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                    : "bg-[#b8bcb2] text-[#000000] border-[#888888]"
                }`}
              >
                <Filter size={14} strokeWidth={1.5} />
                <span>{filterDiscrepancyOnly ? "عرض الكل" : "الفروقات فقط"}</span>
              </button>
            </div>

            <div className="flex gap-x-4 gap-y-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={prefillWithSystemQuantities}
                className="h-9 px-3 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] text-xs font-bold text-[#000000] flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw size={14} strokeWidth={1.5} />
                <span>نسخ الكميات الحالية</span>
              </button>
              <button
                type="button"
                onClick={fetchItems}
                className="h-9 px-3 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] text-xs font-bold text-[#000000] cursor-pointer"
              >
                إعادة تصفير
              </button>
            </div>
          </div>

          {/* Audit Form */}
          <form onSubmit={handleSaveAudit} className="space-y-4">
            
            <div className="bg-[#c3c6bb] border border-[#222222] p-4">
              {loadingItems ? (
                <div className="p-12 text-center text-[#555555] font-bold text-xs">جاري تحميل المخزون...</div>
              ) : filteredActiveItems.length === 0 ? (
                <div className="p-12 text-center text-[#555555] font-bold text-xs">لا توجد أصناف مطابقة.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs min-w-[850px] border-collapse">
                    <thead>
                      <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-10">
                        <th className="py-3 px-4 min-w-[200px]">الصنف / الباركود</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">سعر الشراء</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">الكمية المسجلة</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap min-w-[160px]">الكمية الفعلية</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">الفارق</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">قيمة الفارق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
                      {filteredActiveItems.map((it) => {
                        const systemQty = it.quantity || 0;
                        const actualQty = actualQuantities[it.barcode] ?? 0;
                        const diff = actualQty - systemQty;
                        const cost = it.purchase_price || 0;
                        const lossSurplus = diff * cost;

                        return (
                          <tr key={it.barcode} className="hover:bg-[#b8bcb2] transition-colors">
                            <td className="py-3 px-4 min-w-[200px]">
                              <p className="font-extrabold text-sm leading-tight">{it.name}</p>
                              <p className="text-[11px] text-[#555555] font-mono mt-0.5">{it.barcode}</p>
                            </td>
                            <td className="py-3 px-4 text-center font-mono whitespace-nowrap">{cost.toFixed(2)} ج.م</td>
                            <td className="py-3 px-4 text-center font-mono whitespace-nowrap">{systemQty} {it.unit}</td>
                            <td className="py-3 px-4 text-center whitespace-nowrap min-w-[160px]">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(it.barcode, Math.max(0, parseFloat((actualQty - 1).toFixed(3))))}
                                  className="w-7 h-7 bg-[#b8bcb2] border border-[#888888] font-black cursor-pointer hover:bg-[#222222] hover:text-[#c3c6bb] transition-colors"
                                >-</button>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={actualQty}
                                  onChange={(e) => handleQtyChange(it.barcode, parseFloat(e.target.value) || 0)}
                                  className="w-16 h-7 bg-[#b8bcb2] border border-[#888888] text-center text-xs font-bold text-[#000000] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(it.barcode, parseFloat((actualQty + 1).toFixed(3)))}
                                  className="w-7 h-7 bg-[#b8bcb2] border border-[#888888] font-black cursor-pointer hover:bg-[#222222] hover:text-[#c3c6bb] transition-colors"
                                >+</button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono whitespace-nowrap">
                              {diff === 0 ? "مطابق" : diff < 0 ? `${Number(diff.toFixed(3))} (عجز)` : `+${Number(diff.toFixed(3))} (زيادة)`}
                            </td>
                            <td className="py-3 px-4 text-center font-black font-mono text-sm whitespace-nowrap">
                              {diff === 0 ? "-" : `${lossSurplus.toFixed(2)} ج.م`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-[#c3c6bb] border border-[#222222] p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#000000] mb-1">ملاحظات ومحضر الجرد</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="تدوين أسباب أية فروقات إن وجدت..."
                  className="w-full bg-[#b8bcb2] border border-[#888888] p-2 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-[#888888]">
                <button
                  type="submit"
                  disabled={saving || loadingItems}
                  className="h-10 px-6 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <ClipboardCheck size={16} strokeWidth={1.5} />
                  <span>{saving ? "جاري الاعتماد..." : "اعتماد الجرد وتعديل الكميات"}</span>
                </button>
              </div>
            </div>

          </form>
        </div>
      ) : (
        /* History 12-Column Grid */
        <div className="grid grid-cols-12 gap-x-4 gap-y-2 items-start" id="audits-history-layout">
          
          {/* Left Archive List */}
          <div className="col-span-12 md:col-span-4 bg-[#c3c6bb] border border-[#222222] p-4 space-y-3">
            <h3 className="text-sm font-extrabold text-[#000000] border-b border-[#888888] pb-2 flex items-center gap-2">
              <History size={16} strokeWidth={1.5} />
              <span>محاضر الجرد السابقة</span>
            </h3>

            {loadingAudits ? (
              <div className="p-8 text-center text-[#555555] font-bold text-xs">جاري تحميل الأرشيف...</div>
            ) : audits.length === 0 ? (
              <div className="p-8 text-center text-[#555555] font-bold text-xs">لا يوجد أرشيف جرد سابق.</div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {audits.map((aud) => (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => fetchAuditDetail(aud.id!)}
                    className={`w-full text-right p-3 border text-xs transition-colors cursor-pointer space-y-1 ${
                      selectedAuditId === aud.id
                        ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                        : "bg-[#b8bcb2] text-[#000000] border-[#888888]"
                    }`}
                  >
                    <div className="flex justify-between items-center font-bold">
                      <span>محضر #{aud.id}</span>
                      <span className="font-mono text-[10px]">{new Date(aud.timestamp).toLocaleDateString("ar-EG")}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span>بواسطة: {aud.audited_by}</span>
                      <span>{aud.total_items} صنف</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Detail View */}
          <div className="col-span-12 md:col-span-8 bg-[#c3c6bb] border border-[#222222] p-4 space-y-4">
            {loadingDetail ? (
              <div className="p-12 text-center text-[#555555] font-bold text-xs">جاري تحميل تفاصيل الجلسة...</div>
            ) : auditDetail ? (
              <div className="space-y-4 text-xs font-bold text-[#000000]">
                <div className="flex justify-between items-center border-b border-[#888888] pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold">تفاصيل محضر الجرد #{auditDetail.audit.id}</h3>
                    <p className="text-xs text-[#555555] mt-0.5">المسؤول: {auditDetail.audit.audited_by} | التاريخ: {new Date(auditDetail.audit.timestamp).toLocaleString("ar-EG")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrintAudit}
                    className="h-8 px-3 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Printer size={14} strokeWidth={1.5} />
                    <span>طباعة المحضر</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 bg-[#b8bcb2] p-3 border border-[#888888]">
                  <div>الأصناف: {auditDetail.audit.total_items}</div>
                  <div>إجمالي العجز: -{auditDetail.audit.net_deficit.toFixed(2)} ج.م</div>
                  <div>إجمالي الزيادة: +{auditDetail.audit.net_surplus.toFixed(2)} ج.م</div>
                </div>

                {auditDetail.audit.notes && (
                  <div className="bg-[#b8bcb2] p-3 border border-[#888888]">
                    <span className="text-[#555555] block mb-1">الملاحظات:</span>
                    <p>{auditDetail.audit.notes}</p>
                  </div>
                )}

                <div className="overflow-x-auto border border-[#888888]">
                  <table className="w-full text-right text-xs min-w-[500px]">
                    <thead>
                      <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-8">
                        <th className="py-2 px-3">الصنف</th>
                        <th className="py-2 px-3 text-center">المسجل</th>
                        <th className="py-2 px-3 text-center">الفعلي</th>
                        <th className="py-2 px-3 text-center">الفارق</th>
                        <th className="py-2 px-3 text-center">القيمة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#888888]/40 font-bold">
                      {auditDetail.items.map((it) => (
                        <tr key={it.id} className="hover:bg-[#b8bcb2]">
                          <td className="py-2 px-3">{it.name}</td>
                          <td className="py-2 px-3 text-center">{it.system_qty}</td>
                          <td className="py-2 px-3 text-center font-black">{it.actual_qty}</td>
                          <td className="py-2 px-3 text-center">{it.difference}</td>
                          <td className="py-2 px-3 text-center font-black">{it.loss_surplus_value.toFixed(2)} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-[#555555] font-bold text-xs">
                اختر محضر جرد من القائمة لعرض التفاصيل.
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
