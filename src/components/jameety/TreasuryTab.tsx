import React, { useState, useEffect, useRef } from 'react';
import { Wallet, Calendar, Printer, Plus, Trash2, Edit3, Layers, CheckCircle2, X } from 'lucide-react';
import { getJson, setJson, setStr } from '../../jameetyApi';
import type { EntityNs } from '../../jameetyApi';

interface TreasuryTabProps {
  key?: string | number;
  selectedMonth: string;
  selectedYear: string;
  treasury: any;
  setTreasury: (val: any) => void;
  ns?: string;
  locked?: boolean;
}

export default function TreasuryTab({ selectedMonth, selectedYear, ns = "jameety", locked = false }: TreasuryTabProps) {
  const nsKey = ns as EntityNs;
  const storageKey = `treasury_final_v3_${selectedYear}_${selectedMonth}`;

  const [customItems, setCustomItems] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from SQLite
  useEffect(() => {
    let cancel = false;
    (async () => {
      const data = await getJson<any>(nsKey, storageKey);
      if (!cancel) { setCustomItems(data.filter((i: any) => i && Number(i.amount) > 0)); setLoaded(true); }
    })();
    return () => { cancel = true; };
  }, [nsKey, storageKey]);

  // Auto-save to SQLite
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedRef.current) { loadedRef.current = true; return; }
    if (!loaded) return;
    setJson(nsKey, storageKey, customItems);
    setStr(nsKey, `bread_points`, String(totalBreadPoints));
    setStr(nsKey, `cash_drawer`, String(totalCashInDrawer));
    setStr(nsKey, `visa_amount`, String(totalVisaAmount));
    setStr(nsKey, `total_withdrawals`, String(totalWithdrawals));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customItems, selectedYear, selectedMonth]);

  const safeItems = Array.isArray(customItems) ? customItems : [];
  const totalBreadPoints = safeItems.filter(i => i.category === "نقاط الخبز").reduce((a, i) => a + Number(i.amount || 0), 0);
  const totalCashInDrawer = safeItems.filter(i => i.category === "نقدي بالدرج").reduce((a, i) => a + Number(i.amount || 0), 0);
  const totalVisaAmount = safeItems.filter(i => i.category === "فيزا كارد").reduce((a, i) => a + Number(i.amount || 0), 0);
  const totalWithdrawals = safeItems.filter(i => i.category === "المسحوبات").reduce((a, i) => a + Number(i.amount || 0), 0);

  const [newItemCategory, setNewItemCategory] = useState("فيزا كارد");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [newItemNote, setNewItemNote] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState("فيزا كارد");
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemAmount || isNaN(Number(newItemAmount))) {
      alert("الرجاء إدخال مبلغ صحيح.");
      return;
    }

    const amount = parseFloat(newItemAmount);

    // التحقق: هل يوجد بند بنفس الفئة (نقاط الخبز، نقدي بالدرج، فيزا كارد، المسحوبات)؟
    const existingIndex = safeItems.findIndex(item => item && item.category === newItemCategory);

    if (existingIndex !== -1) {
      // ✅ البند موجود - اجمع المبلغ مع المبلغ الموجود
      const updatedItems = [...safeItems];
      const existingItem = updatedItems[existingIndex];
      updatedItems[existingIndex] = {
        ...existingItem,
        amount: Number(existingItem.amount || 0) + amount,
        note: newItemNote.trim() || existingItem.note || "---"
      };
      setCustomItems(updatedItems);
    } else {
      // ✅ البند غير موجود - أضفه جديداً
      const newItem = {
        id: Date.now(),
        name: newItemCategory,
        category: newItemCategory,
        amount: amount,
        note: newItemNote.trim() || "---"
      };
      setCustomItems([...safeItems, newItem]);
    }

    setNewItemAmount("");
    setNewItemNote("");
  };

  const handleDeleteItem = (id: any) => {
    setCustomItems(safeItems.filter(item => item.id !== id));
  };

  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditCategory(item.category);
    setEditAmount(item.amount);
    setEditNote(item.note || "");
  };

  const handleSaveEdit = (id: any) => {
    if (!editAmount || isNaN(Number(editAmount))) {
      alert("الرجاء إدخال مبلغ صحيح للتعديل.");
      return;
    }

    setCustomItems(safeItems.map(item => 
      item.id === id 
        ? { ...item, name: editCategory, category: editCategory, amount: parseFloat(editAmount), note: editNote.trim() || "---" }
        : item
    ));

    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="lux-stage font-sans text-right" dir="rtl">
      <div className="max-w-none mx-auto space-y-3">
        
        {/* شريط التحكم والتاريخ (مرتبط بالشهر النشط العلوي تماماً) */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">فترة المعاملة الحالية (مربوطة بالشهر النشط)</p>
              <h3 className="text-sm font-black text-slate-800 mt-0.5">
                شهر {selectedMonth} سنة {selectedYear}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">حفظ تلقائي فوري ✓</span>
          </div>
        </div>

        {/* مربعات الإجماليات والتقفيلة */}
        <div className={`grid gap-3 ${ns === "zesty" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}`}>
          {ns !== "zesty" && (
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400">إجمالي نقاط الخبز</p>
                <h3 className="text-xl font-black text-amber-600 mt-1">{totalBreadPoints.toLocaleString()} ج.م</h3>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Wallet className="w-6 h-6" /></div>
            </div>
          )}

          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400">إجمالي نقدي بالدرج</p>
              <h3 className="text-xl font-black text-emerald-600 mt-1">{totalCashInDrawer.toLocaleString()} ج.م</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Wallet className="w-6 h-6" /></div>
          </div>

          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400">إجمالي المبالغ بالفيزا</p>
              <h3 className="text-xl font-black text-blue-600 mt-1">{totalVisaAmount.toLocaleString()} ج.م</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Wallet className="w-6 h-6" /></div>
          </div>

          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400">إجمالي المسحوبات</p>
              <h3 className="text-xl font-black text-rose-600 mt-1">{totalWithdrawals.toLocaleString()} ج.م</h3>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><Wallet className="w-6 h-6" /></div>
          </div>
        </div>

        {/* نموذج الإضافة العلوي */}
        {!locked && (
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-800">إضافة أو تعديل بند للتقفيلة</h3>
            </div>

            <form onSubmit={handleAddCustomItem} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none cursor-pointer"
              >
                <option value="فيزا كارد">فيزا كارد</option>
                <option value="نقدي بالدرج">نقدي بالدرج</option>
                {ns !== "zesty" && <option value="نقاط الخبز">نقاط الخبز</option>}
                <option value="المسحوبات">المسحوبات</option>
              </select>

              <input
                type="number"
                step="0.01"
                placeholder="المبلغ (ج.م)..."
                value={newItemAmount}
                onChange={(e) => setNewItemAmount(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none"
                required
              />

              <input
                type="text"
                placeholder="ملاحظة..."
                value={newItemNote}
                onChange={(e) => setNewItemNote(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none"
              />

              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                إضافة للتقفيلة
              </button>
            </form>
          </div>
        )}

        {/* جدول التقفيلة النهائية */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <h3 className="text-xs font-black text-slate-800">سجل العمليات والتقفيلة النهائية لشهر {selectedMonth} ({selectedYear})</h3>
          
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">النوع</th>
                  <th className="p-3.5">المبلغ</th>
                  <th className="p-3.5">الملاحظة</th>
                  <th className="p-3.5 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {safeItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    {editingId === item.id ? (
                      <>
                        <td className="p-3.5">
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none cursor-pointer"
                          >
                            <option value="فيزا كارد">فيزا كارد</option>
                            <option value="نقدي بالدرج">نقدي بالدرج</option>
                            {ns !== "zesty" && <option value="نقاط الخبز">نقاط الخبز</option>}
                            <option value="المسحوبات">المسحوبات</option>
                          </select>
                        </td>
                        <td className="p-3.5">
                          <input
                            type="number"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-28 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none"
                          />
                        </td>
                        <td className="p-3.5">
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none"
                          />
                        </td>
                        <td className="p-3.5 text-center flex items-center justify-center gap-2">
                          <button onClick={() => handleSaveEdit(item.id)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg cursor-pointer"><CheckCircle2 className="w-4 h-4" /></button>
                          <button onClick={handleCancelEdit} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg cursor-pointer"><X className="w-4 h-4" /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold ${item.category === 'المسحوبات' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="p-3.5 font-black text-slate-900">{Number(item.amount || 0).toLocaleString()} ج.م</td>
                        <td className="p-3.5 text-slate-600 font-bold">{item.note || "---"}</td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!locked && (
                              <>
                                <button onClick={() => handleStartEdit(item)} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg cursor-pointer"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}