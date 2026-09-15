import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Printer, Flame, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { getJson, setJson } from '../../jameetyApi';
import type { EntityNs } from '../../jameetyApi';

type UnitKind = "قطعة" | "كرتونة";

interface BurnedItem {
  id: number;
  itemName: string;
  quantity: number;
  unitKind: UnitKind;
  purchasePrice: number;
  salePrice: number;
  notes?: string;
}

interface DifferencesTabProps {
  key?: string | number;
  selectedMonth: string;
  selectedYear: string;
  ns?: string;
  locked?: boolean;
}

const migrate = (raw: any[]): BurnedItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((it: any) => ({
    id: Number(it.id) || Date.now() + Math.random(),
    itemName: String(it.itemName || it.name || ""),
    quantity: Number(it.quantity) || 0,
    unitKind: (it.unitKind === "كرتونة" ? "كرتونة" : "قطعة") as UnitKind,
    purchasePrice: it.purchasePrice !== undefined && it.purchasePrice !== "" ? Number(it.purchasePrice) : Number(it.unitPrice) || 0,
    salePrice: it.salePrice !== undefined && it.salePrice !== "" ? Number(it.salePrice) : 0,
    notes: String(it.notes || ""),
  })).filter(i => i.itemName);
};

export default function DifferencesTab({ selectedMonth, selectedYear, ns = "jameety", locked = false }: DifferencesTabProps) {
  const nsKey = ns as EntityNs;
  const storageKey = `differences_${selectedYear}_${selectedMonth}`;

  const [items, setItems] = useState<BurnedItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const data = await getJson<any>(nsKey, storageKey);
      if (!cancel) { setItems(migrate(data)); setLoaded(true); }
    })();
    return () => { cancel = true; };
  }, [nsKey, storageKey]);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedRef.current) { loadedRef.current = true; return; }
    if (!loaded) return;
    setJson(nsKey, storageKey, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState<any>("");
  const [unitKind, setUnitKind] = useState<UnitKind>("قطعة");
  const [purchasePrice, setPurchasePrice] = useState<any>("");
  const [salePrice, setSalePrice] = useState<any>("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState<any>("");
  const [editUnitKind, setEditUnitKind] = useState<UnitKind>("قطعة");
  const [editPurchase, setEditPurchase] = useState<any>("");
  const [editSale, setEditSale] = useState<any>("");
  const [editNotes, setEditNotes] = useState("");

  const purchaseTotal = items.reduce((sum, it) => sum + Number(it.purchasePrice || 0) * Number(it.quantity || 0), 0);
  const saleTotal = items.reduce((sum, it) => sum + Number(it.salePrice || 0) * Number(it.quantity || 0), 0);
  const burned = purchaseTotal - saleTotal;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !quantity || !purchasePrice) return;
    const newItem: BurnedItem = {
      id: Date.now(),
      itemName: itemName.trim(),
      quantity: Number(quantity),
      unitKind,
      purchasePrice: Number(purchasePrice),
      salePrice: salePrice === "" ? 0 : Number(salePrice),
      notes: notes.trim()
    };
    setItems([...items, newItem]);
    setItemName("");
    setQuantity("");
    setUnitKind("قطعة");
    setPurchasePrice("");
    setSalePrice("");
    setNotes("");
  };

  const handleDelete = (id: number) => {
    if (window.confirm("هل أنت متأكد من حذف هذا البند؟")) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const handleStartEdit = (item: BurnedItem) => {
    setEditingId(item.id);
    setEditName(item.itemName);
    setEditQty(String(item.quantity));
    setEditUnitKind(item.unitKind);
    setEditPurchase(String(item.purchasePrice));
    setEditSale(String(item.salePrice));
    setEditNotes(item.notes || "");
  };

  const handleSaveEdit = (id: number) => {
    setItems(items.map(i => i.id === id ? {
      ...i,
      itemName: editName.trim(),
      quantity: Number(editQty),
      unitKind: editUnitKind,
      purchasePrice: Number(editPurchase),
      salePrice: editSale === "" ? 0 : Number(editSale),
      notes: editNotes.trim()
    } : i));
    setEditingId(null);
  };

  const handleCancelEdit = () => setEditingId(null);

  return (
    <div className="lux-stage font-sans text-right" dir="rtl">
      <div className="max-w-none mx-auto space-y-3">

        <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">سجل فرق البضاعة المحروقة</p>
              <h3 className="text-sm font-black text-slate-800 mt-0.5">
                شهر <span className="text-orange-600">{selectedMonth}</span> سنة <span className="text-slate-900">{selectedYear}</span>
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">حفظ تلقائي فوري ✓</span>
          </div>
        </div>

        {/* ===== الأزرار الثلاثة فوق الإضافة (بديلة عن مربعات ملخص الفرق) ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-3.5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="text-right">
              <p className="text-[11px] font-black text-slate-600 tracking-wide">إجمالي سعر الشراء</p>
              <p className="text-xl font-black text-slate-900 mt-1 leading-none">{purchaseTotal.toLocaleString()} <span className="text-sm font-bold text-slate-500">ج.م</span></p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 shadow">
              <Wallet className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="bg-white border-2 border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="text-right">
              <p className="text-[11px] font-black text-emerald-700 tracking-wide">إجمالي سعر البيع</p>
              <p className="text-xl font-black text-emerald-700 mt-1 leading-none">{saleTotal.toLocaleString()} <span className="text-sm font-bold text-emerald-600">ج.م</span></p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="bg-white border-2 border-rose-200 rounded-2xl p-3.5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="text-right">
              <p className="text-[11px] font-black text-rose-700 tracking-wide">الفرق (شراء − بيع)</p>
              <p className="text-xl font-black text-rose-700 mt-1 leading-none">{burned.toLocaleString()} <span className="text-sm font-bold text-rose-500">ج.م</span></p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shrink-0 shadow">
              <Flame className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        {/* ===== بطاقة الإضافة — تصميم شيك وواضح ===== */}
        {!locked && (
          <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-l from-orange-600 to-amber-500 px-4 py-3 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
                <ShoppingBag className="w-5 h-5 text-white" />
              </span>
              <div className="text-right">
                <h3 className="text-sm font-black text-white">إضافة صنف جديد لفرق البضاعة</h3>
                <p className="text-[11px] font-bold text-white/90">شهر {selectedMonth} {selectedYear} — الحقول المميزة بـ * مطلوبة</p>
              </div>
              <span className="mr-auto hidden sm:inline-flex items-center gap-1.5 text-[11px] font-black bg-white text-orange-700 px-3 py-1.5 rounded-full shadow">
                <Plus className="w-3.5 h-3.5" /> إضافة سريعة
              </span>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {/* اسم الصنف */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black text-slate-700">اسم الصنف <span className="text-rose-600">*</span></span>
                  <input type="text" placeholder="مثال: سكر، زيت، أرز..." value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all" required />
                </label>

                {/* العدد */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black text-slate-700">العدد / الكمية <span className="text-rose-600">*</span></span>
                  <input type="number" step="0.01" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all" required />
                </label>

                {/* النوع */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black text-slate-700">النوع</span>
                  <select value={unitKind} onChange={(e) => setUnitKind(e.target.value as UnitKind)} className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-900 outline-none focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all cursor-pointer">
                    <option value="قطعة">قطعة</option>
                    <option value="كرتونة">كرتونة</option>
                  </select>
                </label>

                {/* سعر الشراء */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black text-slate-700">سعر الشراء <span className="text-rose-600">*</span></span>
                  <input type="number" step="0.01" placeholder="0.00 ج.م" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all" required />
                </label>

                {/* سعر البيع */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black text-slate-700">سعر البيع</span>
                  <input type="number" step="0.01" placeholder="0.00 ج.م (اختياري)" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all" />
                </label>

                {/* ملاحظات */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black text-slate-700">ملاحظات</span>
                  <input type="text" placeholder="اختياري..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all" />
                </label>
              </div>

              <button type="submit" className="mt-4 w-full bg-gradient-to-l from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white text-sm font-black py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                <Plus className="w-5 h-5" /> إضافة الصنف
              </button>

              {quantity && purchasePrice && (
                <div className="mt-3 flex items-center justify-center gap-2 text-[12px] font-black bg-orange-50 border border-orange-200 text-orange-800 rounded-xl px-4 py-2.5">
                  <Flame className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>الفرق المتوقع لهذا الصنف: <b className="text-slate-900">{((Number(purchasePrice) - (Number(salePrice) || 0)) * Number(quantity)).toLocaleString()} ج.م</b></span>
                </div>
              )}
          </div>
        </form>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">سجل بنود الفرق ({items.length} بند)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">اسم الصنف</th>
                  <th className="p-3.5">العدد</th>
                  <th className="p-3.5">النوع</th>
                  <th className="p-3.5">سعر الشراء</th>
                  <th className="p-3.5">سعر البيع</th>
                  <th className="p-3.5">الفرق</th>
                  <th className="p-3.5">ملاحظات</th>
                  <th className="p-3.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.length > 0 ? (
                  items.map((item) => {
                    const isEditing = editingId === item.id;
                    const diff = (Number(item.purchasePrice) - Number(item.salePrice)) * Number(item.quantity);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="p-3 font-bold text-slate-900">
                          {isEditing ? (
                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="px-2 py-1 border rounded text-xs bg-white w-full" />
                          ) : (
                            item.itemName
                          )}
                        </td>
                        <td className="p-3 text-slate-700">
                          {isEditing ? (
                            <input type="number" step="0.01" value={editQty} onChange={(e) => setEditQty(e.target.value)} className="w-20 px-2 py-1 border rounded text-xs bg-white" />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td className="p-3 text-slate-700">
                          {isEditing ? (
                            <select value={editUnitKind} onChange={(e) => setEditUnitKind(e.target.value as UnitKind)} className="px-2 py-1 border rounded text-xs bg-white cursor-pointer">
                              <option value="قطعة">قطعة</option>
                              <option value="كرتونة">كرتونة</option>
                            </select>
                          ) : (
                            <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold border bg-amber-50 text-amber-700 border-amber-200">
                              {item.unitKind}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-700">
                          {isEditing ? (
                            <input type="number" step="0.01" value={editPurchase} onChange={(e) => setEditPurchase(e.target.value)} className="w-24 px-2 py-1 border rounded text-xs bg-white" />
                          ) : (
                            `${Number(item.purchasePrice).toLocaleString()} ج.م`
                          )}
                        </td>
                        <td className="p-3 text-slate-700">
                          {isEditing ? (
                            <input type="number" step="0.01" value={editSale} onChange={(e) => setEditSale(e.target.value)} className="w-24 px-2 py-1 border rounded text-xs bg-white" />
                          ) : (
                            `${Number(item.salePrice).toLocaleString()} ج.م`
                          )}
                        </td>
                        <td className="p-3 font-black text-rose-700">
                          {isEditing ? (
                            <span>{((Number(editPurchase) - (Number(editSale) || 0)) * Number(editQty)).toLocaleString()} ج.م</span>
                          ) : (
                            `${diff.toLocaleString()} ج.م`
                          )}
                        </td>
                        <td className="p-3 text-slate-500 font-bold">
                          {isEditing ? (
                            <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="px-2 py-1 border rounded text-xs bg-white w-full" placeholder="ملاحظات..." />
                          ) : (
                            item.notes || '-'
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleSaveEdit(item.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700 cursor-pointer">حفظ</button>
                              <button onClick={handleCancelEdit} className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-300 cursor-pointer">إلغاء</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              {!locked && (
                                <>
                                  <button onClick={() => handleStartEdit(item)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer" title="تعديل">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer" title="حذف">
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
                    <td colSpan={8} className="text-center py-8 text-slate-400 font-bold">
                      لا توجد بنود مسجلة لشهر {selectedMonth}. ابدأ بإضافة صنف جديد من النموذج أعلاه.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
