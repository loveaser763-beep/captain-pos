import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Package, DollarSign,
  Plus, Search, Edit2, Trash2, Check, X, Scale, RefreshCw, ChevronRight, Printer
} from 'lucide-react';
import { getJson, setJson, getObj, setStr, getStr } from '../../jameetyApi';
import { getSettlementValue } from './closingCalc';
import type { EntityNs } from '../../jameetyApi';

interface InventoryItem {
  id: number;
  name: string;
  category: "تموين" | "حر";
  quantity: number;
  wholesalePrice: number;
}

interface InventoryTabProps {
  key?: string | number;
  selectedMonth?: string;
  selectedYear?: string;
  ns?: string;
  locked?: boolean;
}

export default function InventoryTab({ selectedMonth: propMonth, selectedYear: propYear, ns = "jameety", locked = false }: InventoryTabProps) {

  const selectedMonth = propMonth || "أغسطس";
  const selectedYear = propYear || "2026";
  const nsKey = ns as EntityNs;

  const storageKey = `inventory_${selectedYear}_${selectedMonth}`;

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  // المفتاح اللي اتحمّلت منه البيانات فعلاً — لمنع كتابة بيانات شهر على شهر تاني أثناء التنقل
  const loadedKeyRef = useRef("");

  // Load from SQLite
  useEffect(() => {
    let cancel = false;
    (async () => {
      const data = await getJson<InventoryItem>(nsKey, storageKey);
      if (!cancel) { loadedKeyRef.current = storageKey; setItems(data); setLoaded(true); }
    })();
    return () => { cancel = true; };
  }, [nsKey, storageKey]);

  const settlementKey = `settlement_${selectedYear}_${selectedMonth}`;

  const [monthlySettlements, setMonthlySettlements] = useState<Record<string, number>>({});
  const [currentSettlement, setCurrentSettlement] = useState<number>(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const s = await getObj<Record<string, number>>(nsKey, `monthly_settlements`);
      if (!cancel && s) setMonthlySettlements(s);
      // سلسلة بدائل ضد ضياع القيمة (قانوني → قديم → تقفيلة → خريطة → بذرة)
      const val = await getSettlementValue(ns, selectedYear, selectedMonth);
      if (!cancel) setCurrentSettlement(val);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nsKey, settlementKey]);

  const handleSettlementChange = (value: string) => {
    const num = value === "" ? 0 : parseFloat(value);
    setCurrentSettlement(num);
    setStr(nsKey, settlementKey, String(num));
    // مزامنة المفتاح القديم أيضاً عشان أي قارئ قديم يلاقي القيمة
    setStr(nsKey, `${nsKey}_settlement_${selectedYear}_${selectedMonth}`, String(num));
    setStr(nsKey, `current_settlement`, String(num));
  };

  // Auto-save to SQLite
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedRef.current) { loadedRef.current = true; return; }
    if (!loaded) return;
    // حماية جذرية: لا تكتب أبداً لو البيانات المعروضة تخص شهراً آخر (أثناء التنقل بين الشهور)
    if (loadedKeyRef.current !== storageKey) return;
    setJson(nsKey, storageKey, items);
    setJson(nsKey, `monthly_settlements`, monthlySettlements);
    setStr(nsKey, `tamween_value`, String(totalTamweenValue));
    setStr(nsKey, `free_value`, String(totalFreeValue));
    // لا تسجّل 0 فوق قيمة حقيقية موجودة (حماية من المسح)
    (async () => {
      const prevTotal = await getStr(nsKey, `total_settlements`);
      if (currentSettlement !== 0 || !prevTotal || Number(prevTotal) === 0) {
        setStr(nsKey, `total_settlements`, String(currentSettlement));
      }
    })();
    // Update closing data only if not already locked/completed
    (async () => {
      const closingKey = `closing_${selectedYear}_${selectedMonth}`;
      const closingData = await getObj<any>(nsKey, closingKey) || {};
      const hasCompleteClosing = closingData.monthTotal != null && closingData.savedAt != null;
      if (!hasCompleteClosing) {
        closingData.tamweenValue = totalTamweenValue;
        closingData.freeValue = totalFreeValue;
        // لا تخفّض تسوية محفوظة إلى 0
        const prevSettle = Number(closingData.settlements || 0);
        if (currentSettlement !== 0 || prevSettle === 0) {
          closingData.settlements = currentSettlement;
        }
        setJson(nsKey, closingKey, closingData);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, currentSettlement, monthlySettlements, storageKey]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("الكل");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>("");
  const [newItemCategory, setNewItemCategory] = useState<"تموين" | "حر">("تموين");
  const [newItemQty, setNewItemQty] = useState<any>("");
  const [newItemPrice, setNewItemPrice] = useState<any>("");

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editCategory, setEditCategory] = useState<"تموين" | "حر">("تموين");
  const [editQty, setEditQty] = useState<any>("");
  const [editPrice, setEditPrice] = useState<any>("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  const tamweenItemsList = items.filter(i => i.category === "تموين");
  const freeItemsList = items.filter(i => i.category === "حر");
  const totalTamweenCount = tamweenItemsList.length;
  const totalFreeCount = freeItemsList.length;
  const totalTamweenValue = tamweenItemsList.reduce((acc, item) => acc + ((Number(item.quantity) || 0) * (Number(item.wholesalePrice) || 0)), 0);
  const totalFreeValue = freeItemsList.reduce((acc, item) => acc + ((Number(item.quantity) || 0) * (Number(item.wholesalePrice) || 0)), 0);

  const filteredItems = items.filter(item => {
    const matchesSearch = searchQuery.trim() === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "الكل" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const searchDropdownResults = searchQuery.trim() === "" ? [] : items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) return;
    const newItem: InventoryItem = {
      id: Date.now(),
      name: newItemName,
      category: ns === "zesty" ? "حر" : newItemCategory,
      quantity: newItemQty === "" ? 0 : parseFloat(String(newItemQty)),
      wholesalePrice: newItemPrice === "" ? 0 : parseFloat(String(newItemPrice))
    };
    setItems([newItem, ...items]);
    setNewItemName("");
    setNewItemQty("");
    setNewItemPrice("");
    setIsAddingNew(false);
  };

  const startEditing = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditQty(item.quantity);
    setEditPrice(item.wholesalePrice);
  };

  const saveEditing = (id: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          name: editName,
          category: editCategory,
          quantity: editQty === "" ? 0 : parseFloat(String(editQty)),
          wholesalePrice: editPrice === "" ? 0 : parseFloat(String(editPrice))
        };
      }
      return item;
    }));
    setEditingItemId(null);
    setSearchQuery("");
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);
  };

  const handleSelectFromDropdown = (item: InventoryItem) => {
    setSearchQuery(item.name);
    startEditing(item);
  };

  const handleDelete = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  return (
    <div className="lux-stage font-sans text-right" dir="rtl">
      <div className="max-w-none mx-auto space-y-3">
        
        {/* شريط الإجراءات */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">جرد المخزن النشط حالياً</p>
              <h3 className="text-sm font-black text-slate-800 mt-0.5">
                شهر <span className="text-emerald-600">{selectedMonth}</span> سنة <span className="text-slate-900">{selectedYear}</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">حفظ تلقائي فوري ✓</span>
          </div>
        </div>

        {/* الكروت الإحصائية */}
        {ns === "zesty" ? (
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between w-full max-w-md">
              <div>
                <p className="text-[11px] font-bold text-slate-400">إجمالي قيمة البضاعة</p>
                <h3 className="text-lg font-black text-emerald-600 mt-1">{(totalTamweenValue + totalFreeValue).toLocaleString()} ج.م</h3>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><DollarSign className="w-5 h-5" /></div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">أصناف التموين والحر</p>
                <h3 className="text-sm font-black text-slate-800 mt-1">
                  تموين: <span className="text-emerald-600">{totalTamweenCount} صنف</span> | حر: <span className="text-indigo-600">{totalFreeCount} صنف</span>
                </h3>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><Package className="w-5 h-5" /></div>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">قيمة السلع التموينية</p>
                <h3 className="text-lg font-black text-emerald-600 mt-1">{totalTamweenValue.toLocaleString()} ج.م</h3>
              </div>
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><DollarSign className="w-5 h-5" /></div>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">قيمة السلع الحرة</p>
                <h3 className="text-lg font-black text-indigo-600 mt-1">{totalFreeValue.toLocaleString()} ج.م</h3>
              </div>
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><DollarSign className="w-5 h-5" /></div>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-sm border-2 border-amber-300 flex items-center justify-between">
              <div className="w-full">
                <p className="text-[11px] font-bold text-slate-400">إجمالي التسويات ({selectedMonth}) — قراءة فقط</p>
                <h3 className="text-lg font-black text-amber-700 mt-1">{Number(currentSettlement || 0).toLocaleString()} ج.م</h3>
                <p className="text-[10px] text-emerald-600 mt-1 font-bold">✓ تُسمع تلقائياً بالتقفيلة — التعديل من زر التسوية بالأعلى</p>
              </div>
            </div>
          </div>
        )}

        {/* نموذج الإضافة */}
        {isAddingNew && !locked && (
          <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-2xl space-y-3">
            <h3 className="text-xs font-black text-emerald-900">إضافة صنف جديد لشهر {selectedMonth}</h3>
            <form onSubmit={handleAddItem} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <input type="text" placeholder="اسم الصنف..." value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold outline-none" required />
              {ns !== "zesty" && (
                <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value as "تموين" | "حر")} className="px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold outline-none cursor-pointer">
                  <option value="تموين">تموين</option>
                  <option value="حر">حر</option>
                </select>
              )}
              <input type="number" placeholder="الكمية" value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} className="px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold outline-none" />
              <input type="number" step="0.01" placeholder={ns === "zesty" ? "سعر الشراء" : "سعر الجملة"} value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} className="px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold outline-none" />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl cursor-pointer">حفظ</button>
                <button type="button" onClick={() => setIsAddingNew(false)} className="px-3 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer">إلغاء</button>
              </div>
            </form>
          </div>
        )}

        {/* جدول الأصناف والبحث */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              {ns !== "zesty" && ["الكل", "تموين", "حر"].map(cat => (
                <button key={cat} onClick={() => { setSelectedCategory(cat); setCurrentPage(1); }} className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${selectedCategory === cat ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {cat}
                </button>
              ))}
              {ns !== "zesty" && (
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-2 border-amber-300 rounded-xl cursor-pointer" title="مبلغ تسوية الشهر - يُسمع فوراً في قيمة التسويات والتقفيلة">
                  <Scale className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="text-xs font-black text-amber-800">تسوية:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={currentSettlement || ""}
                    onChange={(e) => handleSettlementChange(e.target.value)}
                    placeholder="0"
                    disabled={locked}
                    className="w-24 px-1.5 py-1 bg-white border border-amber-200 rounded-lg text-xs font-black text-amber-900 outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                </label>
              )}
              {!locked && (
                <button onClick={() => setIsAddingNew(true)} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> صنف جديد
                </button>
              )}
            </div>

            {/* خانة البحث الفوري */}
            <div className="relative w-full md:w-96">
              <div className="relative">
                <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="ابحث عن صنف لفتحه للتعديل فوراً..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchDropdownResults.length > 0) {
                      handleSelectFromDropdown(searchDropdownResults[0]);
                    }
                  }}
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                />
              </div>

              {searchDropdownResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                  {searchDropdownResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectFromDropdown(item)}
                      className="flex justify-between items-center px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-none text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.category === 'تموين' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                          {item.category}
                        </span>
                        <span className="font-bold text-slate-800">{item.name}</span>
                      </div>
                      <span className="text-slate-500 font-medium">سعر الجملة: {item.wholesalePrice} ج.م</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* جدول عرض الأصناف */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[11px] font-bold">
                    <th className="p-4">الصنف</th>
                    {ns !== "zesty" && <th className="p-4">التصنيف</th>}
                    <th className="p-4">الكمية</th>
                    <th className="p-4">{ns === "zesty" ? "سعر الشراء" : "سعر الجملة"}</th>
                    <th className="p-4">الإجمالي</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                  {paginatedItems.length > 0 ? (
                    paginatedItems.map((item) => {
                      const isEditing = editingItemId === item.id;
                      const itemTotal = (Number(item.quantity) || 0) * (Number(item.wholesalePrice) || 0);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold w-full outline-none"
                              />
                            ) : (
                              <span className="text-slate-900">{item.name}</span>
                            )}
                          </td>
                          {ns !== "zesty" && (
                          <td className="p-4">
                            {isEditing ? (
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value as "تموين" | "حر")}
                                className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none cursor-pointer"
                              >
                                <option value="تموين">تموين</option>
                                <option value="حر">حر</option>
                              </select>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] ${item.category === 'تموين' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                {item.category}
                              </span>
                            )}
                          </td>
                          )}
                          <td className="p-4">
                            {isEditing ? (
                              <input
                                type="number"
                                autoFocus
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveEditing(item.id);
                                  }
                                }}
                                className="px-2 py-1 bg-white border border-emerald-500 rounded-lg text-xs font-bold w-20 outline-none ring-2 ring-emerald-100"
                              />
                            ) : (
                              <span className="font-black text-slate-800">{item.quantity}</span>
                            )}
                          </td>
                          <td className="p-4">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveEditing(item.id);
                                  }
                                }}
                                className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold w-24 outline-none"
                              />
                            ) : (
                              <span>{item.wholesalePrice} ج.م</span>
                            )}
                          </td>
                          <td className="p-4 font-black text-slate-900">{itemTotal.toLocaleString()} ج.م</td>
                          <td className="p-4 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button onClick={() => saveEditing(item.id)} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg cursor-pointer" title="حفظ">
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => setEditingItemId(null)} className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer" title="إلغاء">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5">
                                {!locked && (
                                  <>
                                    <button onClick={() => startEditing(item)} className="p-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer" title="تعديل">
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg cursor-pointer" title="حذف">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={ns === "zesty" ? 5 : 6} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد أصناف مسجلة في هذا الشهر
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ترقيم الصفحات */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center p-4 border-t border-slate-100 bg-slate-50/50">
                <span className="text-[11px] font-bold text-slate-400">
                  صفحة {currentPage} من {totalPages}
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${currentPage === page ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}