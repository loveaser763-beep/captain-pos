import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, ArrowUpRight, ArrowDownLeft, Calendar, Printer, Wallet } from 'lucide-react';
import { getJson, setJson, setStr } from '../../jameetyApi';
import type { EntityNs } from '../../jameetyApi';

interface DebtsTabProps {
  key?: string | number;
  selectedMonth: string;
  selectedYear: string;
  debts?: any[];
  setDebts?: any;
  ns?: string;
  locked?: boolean;
}

export default function DebtsTab({ selectedMonth, selectedYear, ns = "jameety", locked = false }: DebtsTabProps) {
  const nsKey = ns as EntityNs;
  const getDebtsKey = (y: string, m: string) => `debts_data_${y}_${m}`;
  const getFrozenKey = (y: string, m: string) => `frozen_amounts_${y}_${m}`;

  const [debts, setDebts] = useState<any[]>([]);
  const [frozenAmounts, setFrozenAmounts] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from SQLite
  useEffect(() => {
    let cancel = false;
    (async () => {
      const d = await getJson<any>(nsKey, getDebtsKey(selectedYear, selectedMonth));
      const f = await getJson<any>(nsKey, getFrozenKey(selectedYear, selectedMonth));
      if (!cancel) { setDebts(d); setFrozenAmounts(f); setLoaded(true); }
    })();
    return () => { cancel = true; };
  }, [nsKey, selectedYear, selectedMonth]);

  // Auto-save to SQLite
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedRef.current) { loadedRef.current = true; return; }
    if (!loaded) return;
    setJson(nsKey, getDebtsKey(selectedYear, selectedMonth), debts);
    setJson(nsKey, getFrozenKey(selectedYear, selectedMonth), frozenAmounts);
    setStr(nsKey, `debts_to_me`, String(totalToMe));
    setStr(nsKey, `debts_on_me`, String(totalOnMe));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debts, frozenAmounts, selectedYear, selectedMonth]);

  const totalToMe = debts.filter((d: any) => d.type === "toMe").reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
  const totalOnMe = debts.filter((d: any) => d.type === "onMe").reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
  const totalFrozen = frozenAmounts.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // لوحة التفاصيل الموسعة (فلوس ليا / فلوس عليا / غير مدرجة)
  const [expandedPanel, setExpandedPanel] = useState<null | "toMe" | "onMe" | "frozen">(null);

  const [personName, setPersonName] = useState("");
  const [debtDetails, setDebtDetails] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("toMe");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editAmount, setEditAmount] = useState<any>("");


  // ✅ فلتر الفلوس (ليّا / عليّا / الكل)
  const [debtFilter, setDebtFilter] = useState<"all" | "toMe" | "onMe">("all");

  const toMeList = debts.filter((d: any) => d.type === "toMe");
  const onMeList = debts.filter((d: any) => d.type === "onMe");

  const uniqueNames = Array.from(new Set(debts.map((d: any) => d.personName)));
  const filteredNamesList = uniqueNames.filter((name: string) => name.toLowerCase().includes(searchQuery.toLowerCase()));

  // ✅ فلتر حسب النوع + البحث
  const filteredDebts = debts.filter((d: any) => {
    const matchesType = debtFilter === "all" || d.type === debtFilter;
    const matchesSearch = !searchQuery.trim() || 
      d.personName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (d.debtDetails && d.debtDetails.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const totalPages = Math.ceil(filteredDebts.length / pageSize) || 1;
  const paginatedDebts = filteredDebts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="lux-stage font-sans text-right" dir="rtl">
      <div className="max-w-none mx-auto space-y-3">

        {/* شريط التحكم العلوي المربوط بالشهر العام */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">فترة حسابات الديون النشطة حالياً</p>
              <h3 className="text-sm font-black text-slate-800 mt-0.5">{selectedMonth} {selectedYear}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">حفظ تلقائي فوري ✓</span>
          </div>
        </div>

        {/* بطاقات الإجماليات - أزرار منسدلة للتفاصيل */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button onClick={() => setExpandedPanel(expandedPanel === "toMe" ? null : "toMe")} title="اضغط لعرض تفاصيل فلوس ليك" className={`text-right bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-3 rounded-2xl shadow-sm flex items-center justify-between cursor-pointer transition-all border-2 ${expandedPanel === "toMe" ? "border-white" : "border-transparent"}`}>
            <div>
              <p className="text-xs font-bold text-emerald-100 mb-1">إجمالي فلوس ليك ({selectedMonth})</p>
              <h3 className="text-2xl font-black">{totalToMe.toLocaleString()} ج.م</h3>
              <p className="text-[10px] font-bold text-emerald-100 mt-1">{expandedPanel === "toMe" ? "▲ إخفاء التفاصيل" : "▼ عرض التفاصيل ({toMeList.length})"}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl"><ArrowDownLeft className="w-6 h-6 text-white" /></div>
          </button>

          <button onClick={() => setExpandedPanel(expandedPanel === "onMe" ? null : "onMe")} title="اضغط لعرض تفاصيل فلوس عليك" className={`text-right bg-gradient-to-br from-rose-500 to-red-700 text-white p-3 rounded-2xl shadow-sm flex items-center justify-between cursor-pointer transition-all border-2 ${expandedPanel === "onMe" ? "border-white" : "border-transparent"}`}>
            <div>
              <p className="text-xs font-bold text-rose-100 mb-1">إجمالي فلوس عليك ({selectedMonth})</p>
              <h3 className="text-2xl font-black">{totalOnMe.toLocaleString()} ج.م</h3>
              <p className="text-[10px] font-bold text-rose-100 mt-1">{expandedPanel === "onMe" ? "▲ إخفاء التفاصيل" : "▼ عرض التفاصيل ({onMeList.length})"}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl"><ArrowUpRight className="w-6 h-6 text-white" /></div>
          </button>

          <button onClick={() => setExpandedPanel(expandedPanel === "frozen" ? null : "frozen")} title="اضغط لعرض تفاصيل المبالغ غير المدرجة" className={`text-right bg-gradient-to-br from-amber-500 to-orange-700 text-white p-3 rounded-2xl shadow-sm flex items-center justify-between cursor-pointer transition-all border-2 ${expandedPanel === "frozen" ? "border-white" : "border-transparent"}`}>
            <div>
              <p className="text-xs font-bold text-amber-100 mb-1">المبالغ غير المدرجة ({selectedMonth})</p>
              <h3 className="text-2xl font-black">{totalFrozen.toLocaleString()} ج.م</h3>
              <p className="text-[10px] font-bold text-amber-100 mt-1">{expandedPanel === "frozen" ? "▲ إخفاء التفاصيل" : `▼ عرض التفاصيل (${frozenAmounts.length})`}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl"><Calendar className="w-6 h-6 text-white" /></div>
          </button>
        </div>

        {/* لوحة تفاصيل موسعة */}
        {expandedPanel && (
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className={`text-sm font-black mb-2 ${expandedPanel === "toMe" ? "text-emerald-700" : expandedPanel === "onMe" ? "text-rose-700" : "text-amber-700"}`}>
              تفاصيل {expandedPanel === "toMe" ? "فلوس ليك" : expandedPanel === "onMe" ? "فلوس عليك" : "المبالغ غير المدرجة"} ({selectedMonth}) - {(expandedPanel === "toMe" ? toMeList : expandedPanel === "onMe" ? onMeList : frozenAmounts).length} بند
            </h3>
            {(expandedPanel === "toMe" ? toMeList : expandedPanel === "onMe" ? onMeList : frozenAmounts).length === 0 ? (
              <p className="text-xs font-bold text-slate-400 text-center py-3">لا توجد بنود مسجلة</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto lux-scroll">
                {(expandedPanel === "toMe" ? toMeList : expandedPanel === "onMe" ? onMeList : frozenAmounts).map((d: any) => (
                  <div key={d.id} className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold ${expandedPanel === "toMe" ? "bg-emerald-50 border-emerald-200 text-emerald-900" : expandedPanel === "onMe" ? "bg-rose-50 border-rose-200 text-rose-900" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
                    <span className="truncate">{d.personName || d.name || d.debtDetails || d.details || "بند"}{d.debtDetails && d.personName ? ` - ${d.debtDetails}` : ""}</span>
                    <span className="font-black shrink-0 mr-2">{Number(d.amount).toLocaleString()} ج.م</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* أزرار الفلتر السريع + البحث */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          {/* أزرار الفلتر */}
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={() => { setDebtFilter("all"); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${debtFilter === "all" ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Wallet className="w-4 h-4" />
              كل الحسابات ({debts.length})
            </button>
            <button 
              onClick={() => { setDebtFilter("toMe"); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${debtFilter === "toMe" ? 'bg-emerald-600 text-white shadow-md' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              فلوس ليّا ({debts.filter((d: any) => d.type === "toMe").length})
            </button>
            <button 
              onClick={() => { setDebtFilter("onMe"); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${debtFilter === "onMe" ? 'bg-rose-600 text-white shadow-md' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'}`}
            >
              <ArrowUpRight className="w-4 h-4" />
              فلوس عليّا ({debts.filter((d: any) => d.type === "onMe").length})
            </button>
          </div>

          {/* خانة البحث */}
          <div className="relative w-full md:w-72">
            <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ابحث في النوع المحدد..."
              value={searchQuery}
              onChange={(e) => { 
                setSearchQuery(e.target.value); 
                setCurrentPage(1); 
              }}
              className="w-full pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none"
            />
          </div>
        </div>

        {/* محتوى الصفحة الرئيسي */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {!locked && (
            <div className="lg:col-span-1 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-3 h-fit">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Plus className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">إضافة حساب جديد ({selectedMonth})</h3>
              </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!personName.trim() || !amount) return;
              if (type === "frozen") {
                const newFrozen = {
                  id: Date.now(),
                  personName: personName.trim(),
                  debtDetails: debtDetails.trim(),
                  amount: Number(amount)
                };
                setFrozenAmounts([...frozenAmounts, newFrozen]);
              } else {
                const newDebt = {
                  id: Date.now(),
                  personName: personName.trim(),
                  debtDetails: debtDetails.trim(),
                  amount: Number(amount),
                  type: type
                };
                setDebts([...debts, newDebt]);
              }
              setPersonName(""); setDebtDetails(""); setAmount("");
            }} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الشخص / الجهة</label>
                <input type="text" placeholder="اسم العميل أو المورد..." value={personName} onChange={(e) => setPersonName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تفاصيل الدين (السبب / البضاعة)</label>
                <input type="text" placeholder="مثلاً: بضاعة، فاتورة رقم..." value={debtDetails} onChange={(e) => setDebtDetails(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (ج.م)</label>
                <input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الحساب</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none cursor-pointer">
                  <option value="toMe">فلوس ليك (عند العميل)</option>
                  <option value="onMe">فلوس عليك (للمورد)</option>
                  <option value="frozen">مبالغ غير مدرجة</option>
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-all">حفظ الحساب</button>
            </form>
          </div>
          )}

          <div className={`${locked ? 'lg:col-span-3' : 'lg:col-span-2'} bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-3`}>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">اسم الشخص</th>
                    <th className="p-3.5">تفاصيل الدين</th>
                    <th className="p-3.5">المبلغ</th>
                    <th className="p-3.5">نوع الحساب</th>
                    <th className="p-3.5 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedDebts.length > 0 ? (
                    paginatedDebts.map((d: any) => {
                      const isEditing = editingId === d.id;
                      return (
                        <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900">
                            {isEditing ? <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1 border rounded bg-white text-xs font-bold" /> : d.personName}
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {isEditing ? <input type="text" value={editDetails} onChange={(e) => setEditDetails(e.target.value)} className="w-full px-2 py-1 border rounded bg-white text-xs font-bold" /> : (d.debtDetails || '-')}
                          </td>
                          <td className="p-3.5 font-black">
                            {isEditing ? <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-24 px-2 py-1 border rounded bg-white text-xs font-bold" /> : <span className={d.type === 'toMe' ? 'text-emerald-600' : 'text-rose-600'}>{Number(d.amount).toLocaleString()} ج.م</span>}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold ${d.type === 'toMe' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              {d.type === 'toMe' ? 'فلوس ليك' : 'فلوس عليك'}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!locked && (
                                <>
                                  {isEditing ? (
                                    <button onClick={() => {
                                      const updated = debts.map((item: any) => item.id === d.id ? { ...item, personName: editName, debtDetails: editDetails, amount: Number(editAmount) } : item);
                                      setDebts(updated);
                                      setEditingId(null);
                                    }} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold cursor-pointer">حفظ</button>
                                  ) : (
                                    <button onClick={() => { setEditingId(d.id); setEditName(d.personName); setEditDetails(d.debtDetails || ''); setEditAmount(d.amount); }} className="text-slate-400 hover:text-emerald-600 cursor-pointer p-1"><Edit2 className="w-4 h-4" /></button>
                                  )}
                                  <button onClick={() => setDebts(debts.filter((item: any) => item.id !== d.id))} className="text-slate-400 hover:text-red-600 cursor-pointer p-1"><Trash2 className="w-4 h-4" /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400 font-bold">لا توجد حسابات ديون مسجلة لشهر {selectedMonth}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentPage === page ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {page}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
