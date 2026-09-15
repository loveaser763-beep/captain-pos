import React, { useState, useEffect } from 'react';
import { Save, Printer, RefreshCw, Lock, LockOpen, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { readClosingInputs, monthTotalOf, prevMonthOf, nextMonthOf, ClosingInputs } from './closingCalc';
import { getJson, setJson, getStr, setStr } from '../../jameetyApi';
import type { EntityNs } from '../../jameetyApi';

interface ClosingTabProps {
  key?: string | number;
  selectedMonth: string;
  selectedYear: string;
  ns?: string;
  onLockChange?: () => void;
}

const fmt = (v: any) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function ClosingTab({ selectedMonth, selectedYear, ns = "jameety", onLockChange }: ClosingTabProps) {
  const nsKey = ns as EntityNs;
  const [inputs, setInputs] = useState<ClosingInputs | null>(null);
  const [prevTotal, setPrevTotal] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [locked, setLocked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [confirmResolve, setConfirmResolve] = useState<((v: boolean) => void) | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  const showConfirm = (msg: string) => new Promise<boolean>((resolve) => {
    setConfirmMsg(msg);
    setConfirmResolve(() => resolve);
    setConfirmOpen(true);
  });
  const doConfirm = (v: boolean) => {
    setConfirmOpen(false);
    if (confirmResolve) confirmResolve(v);
    setConfirmResolve(null);
  };
  const showAlert = (msg: string) => { setAlertMsg(msg); setAlertOpen(true); };

  const lockKey = `locked_${selectedYear}_${selectedMonth}`;

  const reload = async () => {
    const cur = await readClosingInputs(ns, selectedYear, selectedMonth);
    setInputs(cur);
    const prev = prevMonthOf(selectedYear, selectedMonth);
    const prevInputs = await readClosingInputs(ns, prev.year, prev.month);
    setPrevTotal(monthTotalOf(prevInputs));
    const lockVal = await getStr(nsKey, lockKey);
    setLocked(lockVal === "1");
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ns, selectedYear, selectedMonth, refreshTick]);

  const monthTotal = inputs ? monthTotalOf(inputs) : 0;
  const increase = monthTotal - prevTotal;
  const netProfit = (inputs ? inputs.withdrawals : 0) + increase;

  const handleSaveClosing = async () => {
    if (!inputs) return;
    if (!await showConfirm(`اعتماد تقفيلة ${selectedMonth} ${selectedYear}؟ سيتم قفل الصفحات للقراءة فقط وترحيل الأصناف والأسماء للشهر التالي.`)) return;
    try {
      // 1. حفظ ملخص التقفيلة
      const payload = {
        period: `${selectedMonth} ${selectedYear}`,
        monthTotal,
        prevTotal,
        increase,
        netMonthlyProfit: netProfit,
        withdrawals: inputs.withdrawals,
        breakdown: {
          subsidizedGoods: inputs.tamween,
          freeGoods: inputs.free,
          adjustments: inputs.settlement,
          toMe: inputs.toMe,
          onMe: inputs.onMe,
          breadPoints: inputs.bread,
          cashInDrawer: inputs.cash,
          visa: inputs.visa,
          withdrawals: inputs.withdrawals,
          purchaseTotal: inputs.purchaseTotal,
          saleTotal: inputs.saleTotal,
          burned: inputs.burned,
        },
        tamweenValue: inputs.tamween,
        freeValue: inputs.free,
        settlements: inputs.settlement,
        toMe: inputs.toMe,
        onMe: inputs.onMe,
        year: selectedYear,
        month: selectedMonth,
        savedAt: new Date().toISOString(),
      };
      await setJson(nsKey, `closing_${selectedYear}_${selectedMonth}`, payload);

      // 2. نسخ أصناف المخزون للشهر التالي
      const next = nextMonthOf(selectedYear, selectedMonth);
      const curInv = await getJson<any>(nsKey, `inventory_${selectedYear}_${selectedMonth}`);
      const nxtInv = await getJson<any>(nsKey, `inventory_${next.year}_${next.month}`);
      const names = new Set(nxtInv.map((x: any) => `${x.name}||${x.category}`));
      const copies = curInv
        .filter((x: any) => x && x.name && !names.has(`${x.name}||${x.category}`))
        .map((x: any) => ({ id: Date.now() + Math.random(), name: x.name, category: x.category, quantity: 0, wholesalePrice: Number(x.wholesalePrice) || 0 }));
      if (copies.length > 0) await setJson(nsKey, `inventory_${next.year}_${next.month}`, [...nxtInv, ...copies]);

      // 3. نسخ أسماء الديون للشهر التالي
      const curDebts = await getJson<any>(nsKey, `debts_data_${selectedYear}_${selectedMonth}`);
      const nxtDebts = await getJson<any>(nsKey, `debts_data_${next.year}_${next.month}`);
      const namesD = new Set(nxtDebts.map((x: any) => `${x.personName}||${x.type}`));
      const copiesD = curDebts
        .filter((x: any) => x && x.personName && !namesD.has(`${x.personName}||${x.type}`))
        .map((x: any) => ({ id: Date.now() + Math.random(), personName: x.personName, debtDetails: "", amount: 0, type: x.type }));
      if (copiesD.length > 0) await setJson(nsKey, `debts_data_${next.year}_${next.month}`, [...nxtDebts, ...copiesD]);

      // 4. قفل الصفحات
      await setStr(nsKey, lockKey, "1");
      if (onLockChange) onLockChange();
      setRefreshTick(t => t + 1);
      showAlert(`تم اعتماد تقفيلة ${selectedMonth} ${selectedYear} وقفل الصفحات للقراءة فقط.`);
    } catch {
      showAlert("حدث خطأ أثناء حفظ التقفيلة.");
    }
  };

  const handleUnlock = async () => {
    if (!await showConfirm("هل تريد فتح التعديل على الصفحات؟")) return;
    try {
      const { delKeys } = await import('../../jameetyApi');
      await delKeys(nsKey, [lockKey]);
    } catch {}
    if (onLockChange) onLockChange();
    setRefreshTick(t => t + 1);
  };

  const detailBoxes: { label: string; value: number; tone: "emerald" | "rose" | "gold" | "cyan" }[] = inputs ? [
    ...(ns !== "zesty" ? [
      { label: "السلع التموينية", value: inputs.tamween, tone: "emerald" as const },
      { label: "البضاعة الحرة", value: inputs.free, tone: "cyan" as const },
      { label: "التسويات", value: inputs.settlement, tone: "gold" as const },
    ] : [
      { label: "إجمالي قيمة البضاعة", value: inputs.free, tone: "cyan" as const },
    ]),
    { label: "إجمالي فلوس ليا", value: inputs.toMe, tone: "emerald" as const },
    { label: "إجمالي فلوس عليا (ديون عليا)", value: inputs.onMe, tone: "rose" as const },
    ...(ns !== "zesty" ? [
      { label: "نقاط الخبز", value: inputs.bread, tone: "gold" as const },
    ] : []),
    { label: "نقدي بالدرج", value: inputs.cash, tone: "cyan" as const },
    { label: "فيزا كارد", value: inputs.visa, tone: "cyan" as const },
    { label: "المسحوبات", value: inputs.withdrawals, tone: "rose" as const },
  ] : [];

  const toneStyle: Record<string, React.CSSProperties> = {
    emerald: { background: "rgba(61,220,151,.13)", color: "#065f46", border: "1px solid rgba(61,220,151,.45)" },
    rose: { background: "rgba(251,122,147,.13)", color: "#9f1239", border: "1px solid rgba(251,122,147,.45)" },
    gold: { background: "rgba(200,162,75,.15)", color: "#92400e", border: "1px solid rgba(200,162,75,.5)" },
    cyan: { background: "rgba(79,216,236,.13)", color: "#0e7490", border: "1px solid rgba(79,216,236,.45)" },
  };

  const handleThermalPrint = () => {
    const printerType = localStorage.getItem("captain_printer_type") || "thermal-80";
    const fs = printerType === "thermal-58" ? "11px" : "12px";

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow!.document;
    const rows = detailBoxes.map(r => `<tr><td style="text-align:right;padding:4px 8px 4px 5px;border:1px solid #000;font-size:${fs};font-weight:900;word-break:break-word;line-height:1.4">${r.label}</td><td style="text-align:left;padding:4px 5px 4px 8px;border:1px solid #000;font-size:${fs};font-weight:900;letter-spacing:0.3px;line-height:1.4;font-family:''Courier New'',monospace">${fmt(r.value)} ج.م</td></tr>`).join("");
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>التقفيلة ${selectedMonth} ${selectedYear}</title><style>
@page{size:80mm auto;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:80mm;max-width:80mm;margin:0;padding:0;font-family:Cairo,sans-serif;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;direction:rtl;font-size:${fs};line-height:1.3;overflow:visible}
h1{font-size:13px;text-align:center;margin:0;font-weight:900;letter-spacing:0.3px}
h2{font-size:10px;text-align:center;margin:0;color:#000;font-weight:700}
table{width:75mm;margin:4px 2.5mm;border-collapse:collapse;table-layout:fixed;border-left:2px solid #000;border-right:2px solid #000}
th{font-size:${fs};background:#000;color:#fff;padding:4px 8px;font-weight:900;border-left:1px solid #fff;border-right:1px solid #fff}
td{font-size:${fs};padding:4px 8px 4px 5px;border-left:1px solid #000;border-right:1px solid #000}
.totals{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin:4px 2.5mm;width:75mm}
.total{font-weight:900;font-size:12px;text-align:center;border:2px solid #000;padding:5px;word-break:break-word;line-height:1.3}
.footer{font-size:11px;font-weight:900;text-align:center;margin:5px 2.5mm 0;padding:4px;border:2px solid #000;color:#000;background:#fff;line-height:1.3;width:75mm}
.dateline{font-size:9px;text-align:center;margin:3px 2.5mm}
</style></head><body><h1>التقفيلة النهائية</h1><h2>${selectedMonth} ${selectedYear} - ${ns === 'zesty' ? 'زيستي (نادي بورتو)' : 'جمعيتي'}</h2><table><tr><th>البند</th><th style="width:42%">القيمة</th></tr>${rows}</table><div class="totals"><div class="total">الحالي: ${fmt(monthTotal)} ج.م</div><div class="total">السابق: ${fmt(prevTotal)} ج.م</div><div class="total">الزيادة: ${fmt(increase)} ج.م</div><div class="total">الربح: ${fmt(netProfit)} ج.م</div></div><div class="footer">منظومة الكابتن (لهندسة الأرقام وريادة الأعمال)</div><div class="dateline">شكراً لتعاملكم معنا — ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div></body></html>`;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1500);
    }, 400);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // لا تستمع إلا إذا كانت التقفيلة ظاهرة
      const el = document.getElementById('closing-printable-area');
      if (!el || el.offsetParent === null) return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleThermalPrint();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        handleThermalPrint();
      }
    };
    // مسار موحد: طلب طباعة حرارية من زر القائمة الموحد → نفس إيصال F9 بنفس المقاس
    const onThermalRequest = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id === 'closing-printable-area' || id === 'jameety-print-closing') {
        e.preventDefault();
        handleThermalPrint();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('thermal-print-request', onThermalRequest);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('thermal-print-request', onThermalRequest);
    };
  }, [inputs, monthTotal, prevTotal, increase, netProfit, selectedMonth, selectedYear, ns]);

  return (
    <div id="closing-printable-area" className="lux-stage printable-closing font-sans text-right" dir="rtl">
      <div className="max-w-none mx-auto space-y-3">

        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400">
                  التقفيلة النهائية المعتمدة {locked ? "• مقفولة للقراءة فقط" : ""}
                </p>
                <h3 className="text-sm font-black text-slate-800 mt-0.5">
                  شهر <span className="text-amber-600">{selectedMonth}</span> سنة <span className="text-slate-900">{selectedYear}</span>
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {!locked ? (
                <button onClick={handleSaveClosing} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-sm cursor-pointer">
                  <Save className="w-4 h-4" /> حفظ التقفيلة النهائية
                </button>
              ) : (
                <button onClick={handleUnlock} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-sm cursor-pointer">
                  <LockOpen className="w-4 h-4" /> التعديل
                </button>
              )}
              <button onClick={() => setRefreshTick(t => t + 1)} className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all border border-slate-200 cursor-pointer">
                <RefreshCw className="w-4 h-4" /> تحديث العرض
              </button>
            </div>
          </div>
        </div>

        {/* بنود التفاصيل أولاً */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {detailBoxes.map((r) => (
            <div key={r.label} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
              <p className="text-xs font-bold text-slate-500">{r.label}</p>
              <h3 className="text-lg font-black text-slate-900 mt-1">{fmt(r.value)} ج.م</h3>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold" style={toneStyle[r.tone]}>
                {r.value === 0 ? "صفر" : "معتمد"}
              </span>
            </div>
          ))}
        </div>

        {/* المربعات الإجمالية الأربعة */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 bg-white border-2 border-indigo-300 rounded-2xl shadow-sm">
            <p className="text-xs font-bold text-indigo-700">إجمالي الشهر الحالي</p>
            <h3 className="text-xl font-black text-indigo-700 mt-1">{fmt(monthTotal)} ج.م</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">{ns === "zesty" ? "ليا+درج+فيزا−عليا" : "تموين+حر+تسويات+ليا+خبز+درج+فيزا−عليا"}</p>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <p className="text-xs font-bold text-slate-500">إجمالي الشهر السابق</p>
            <h3 className="text-xl font-black text-slate-900 mt-1">{fmt(prevTotal)} ج.م</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">يُسحب تلقائياً من الشهر السابق</p>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <p className="text-xs font-bold text-slate-500 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> زيادة أو عجز عن الشهر السابق</p>
            <h3 className={`text-xl font-black mt-1 ${increase >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {increase >= 0 ? "+" : ""}{fmt(increase)} ج.م
            </h3>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <p className="text-xs font-bold text-slate-500 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> صافي الربح الشهري</p>
            <h3 className="text-xl font-black text-slate-900 mt-1">{fmt(netProfit)} ج.م</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">المسحوبات + الزيادة/العجز</p>
          </div>
        </div>

        {/* شريط صافي المديونية */}
        {inputs && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-black text-slate-700">
              <TrendingDown className="w-4 h-4 text-rose-500" /> فرق البضاعة المحروقة: {fmt(inputs.burned)} ج.م (قراءة فقط)
            </span>
            <span className="text-xs font-bold text-slate-400">|</span>
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Save className="w-4 h-4 text-emerald-600" /> الفترة: {selectedMonth} {selectedYear}
            </span>
          </div>
        )}

        {/* Confirm Modal */}
        {confirmOpen && (
          <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
              <p className="text-sm font-bold text-slate-800 mb-4">{confirmMsg}</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => doConfirm(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 cursor-pointer">إلغاء</button>
                <button onClick={() => doConfirm(true)} className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">تأكيد</button>
              </div>
            </div>
          </div>
        )}

        {/* Alert Modal */}
        {alertOpen && (
          <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
              <p className="text-sm font-bold text-slate-800 mb-4">{alertMsg}</p>
              <div className="flex justify-end">
                <button onClick={() => setAlertOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">موافق</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
