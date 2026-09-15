import React, { useState, useEffect } from 'react';
import { TrendingUp, Wallet, Flame } from 'lucide-react';
import { readClosingInputs } from './closingCalc';
import { getObj } from '../../jameetyApi';
import type { EntityNs } from '../../jameetyApi';

interface ProfitComparisonTabProps {
  key?: string | number;
  selectedYear?: string;
  selectedMonth?: string;
  ns?: string;
  locked?: boolean;
}

export default function ProfitComparisonTab({ selectedYear: propYear, selectedMonth: propMonth, ns = "jameety" }: ProfitComparisonTabProps) {
  const [yearlyData, setYearlyData] = useState<any[]>([]);
  const selectedYear = propYear || "2026";
  const selectedMonth = propMonth || "أغسطس";
  const nsKey = ns as EntityNs;

  const monthsList = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];

  useEffect(() => {
    loadComparisonData();
  }, [selectedYear, selectedMonth]);

  const loadComparisonData = async () => {
    try {
      const data = await Promise.all(monthsList.map(async (month) => {
        let withdrawals = 0;
        let netProfit = 0;
        let burned = 0;

        const parsed = await getObj<any>(nsKey, `closing_${selectedYear}_${month}`);
        const hasData = parsed !== null;

        if (parsed) {
          withdrawals = Number(parsed.withdrawals ?? parsed.breakdown?.withdrawals ?? parsed.totalWithdrawals ?? 0);
          netProfit = Number(parsed.netMonthlyProfit ?? parsed.netProfit ?? parsed.net ?? 0);
        }

        try {
          const ci = await readClosingInputs(ns, selectedYear, month);
          burned = ci.burned;
        } catch {}

        return { month, withdrawals, netProfit, burned, hasData };
      }));

      setYearlyData(data);
    } catch (e) {
      console.error(e);
    }
  };

  const realMonths = yearlyData.filter(d => d.hasData);
  const totalAnnualNetProfit = realMonths.reduce((sum, item) => sum + Number(item.netProfit || 0), 0);
  const totalAnnualWithdrawals = realMonths.reduce((sum, item) => sum + Number(item.withdrawals || 0), 0);
  const totalAnnualBurned = realMonths.reduce((sum, item) => sum + Number(item.burned || 0), 0);

  const maxVal = Math.max(
    ...yearlyData.map(d => Math.max(d.withdrawals, d.netProfit, 100)),
    1000
  );

  return (
    <div className="lux-stage font-sans text-right" dir="rtl">
      <div className="max-w-none mx-auto space-y-3">

        {/* رأس الصفحة واختيار السنة */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">مقارنة الأرباح والمسحوبات الشهرية</h2>
              <p className="text-xs text-slate-500 mt-0.5">عرض الشهر المحدد: <span className="font-black text-indigo-600">{selectedMonth} {selectedYear}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">السنة:</span>
            <span className="bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-xl text-xs font-black text-indigo-700">{selectedYear}</span>
          </div>
        </div>

        {/* ✅ بانر الشهر المختار من كل الصفحات */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-600 text-white rounded-xl">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-emerald-700">📅 الشهر النشط في كل الصفحات</p>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">{selectedMonth} {selectedYear}</h3>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-bold max-w-xs">
              يتم تحديث البيانات تلقائياً عند تغيير الشهر من القائمة الرئيسية في Jameety.tsx
            </div>
          </div>
        </div>

        {/* إجمالي العام - 3 مربعات */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-indigo-100">إجمالي صافي الربح السنوي ({selectedYear})</p>
              <h3 className="text-2xl font-black mt-1">{totalAnnualNetProfit.toLocaleString()} ج.م</h3>
            </div>
            <div className="p-3 bg-white/10 rounded-xl">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-100">إجمالي المسحوبات السنوية ({selectedYear})</p>
              <h3 className="text-2xl font-black mt-1">{totalAnnualWithdrawals.toLocaleString()} ج.م</h3>
            </div>
            <div className="p-3 bg-white/10 rounded-xl">
              <Wallet className="w-6 h-6 text-white" />
            </div>
          </div>

          {ns !== "zesty" && (
            <div className="p-3 bg-gradient-to-br from-orange-600 to-amber-700 text-white rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-orange-100">إجمالي فرق البضاعة المحروقة ({selectedYear})</p>
                <h3 className="text-2xl font-black mt-1">{totalAnnualBurned.toLocaleString()} ج.م</h3>
              </div>
              <div className="p-3 bg-white/10 rounded-xl">
                <Flame className="w-6 h-6 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* الرسم البياني للأعمدة */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                <span className="text-xs font-bold text-slate-600">صافي الربح الشهري</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-xs font-bold text-slate-600">إجمالي المسحوبات</span>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-400">سنة {selectedYear}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-3">
            {realMonths.length === 0 && (
              <p className="col-span-full text-center text-xs font-bold text-slate-400 py-6">
                لا توجد شهور محفوظة لسنة {selectedYear} — احفظ تقفيلة أي شهر لتظهر هنا
              </p>
            )}
            {realMonths.map((item, index) => {
              const profitHeight = Math.min(Math.max((item.netProfit / maxVal) * 100, 4), 100);
              const withdrawalsHeight = Math.min(Math.max((item.withdrawals / maxVal) * 100, 4), 100);
              const isCurrent = item.month === selectedMonth;

              return (
                <div key={index} className={`bg-slate-50 border p-3 rounded-2xl flex flex-col items-center justify-between h-72 ${isCurrent ? "border-indigo-500 border-2" : "border-slate-200"}`}>
                  <span className={`text-xs font-black ${isCurrent ? "text-indigo-700" : "text-slate-800"}`}>{item.month}{isCurrent ? " • الحالي" : ""}</span>
                  
                  <div className="w-full flex items-end justify-center gap-2 h-48 px-1 border-b border-slate-200 pb-2">
                    {/* عمود صافي الربح */}
                    <div className="w-1/2 flex flex-col items-center h-full justify-end group relative">
                      <span className="text-[9px] font-bold text-indigo-600 mb-1">{item.netProfit}</span>
                      <div 
                        style={{ height: `${profitHeight}%` }} 
                        className="w-full bg-indigo-600 rounded-t-lg transition-all duration-500 hover:bg-indigo-700"
                        title={`صافي الربح: ${item.netProfit}`}
                      ></div>
                    </div>

                    {/* عمود إجمالي المسحوبات */}
                    <div className="w-1/2 flex flex-col items-center h-full justify-end group relative">
                      <span className="text-[9px] font-bold text-emerald-600 mb-1">{item.withdrawals}</span>
                      <div 
                        style={{ height: `${withdrawalsHeight}%` }} 
                        className="w-full bg-emerald-500 rounded-t-lg transition-all duration-500 hover:bg-emerald-600"
                        title={`إجمالي المسحوبات: ${item.withdrawals}`}
                      ></div>
                    </div>
                  </div>

                  <div className="w-full text-center pt-2">
                    <span className="text-[10px] text-slate-400 font-bold">جنيه مصري</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* الجدول التفصيلي بالأرقام في الأسفل */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <h3 className="text-sm font-black text-slate-900">البيانات التفصيلية بالأرقام لكل شهور السنة</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-black text-slate-500 bg-slate-50">
                  <th className="p-3">الشهر</th>
                  <th className="p-3">صافي الربح الشهري</th>
                  <th className="p-3">إجمالي المسحوبات</th>
                  {ns !== "zesty" && <th className="p-3">فرق البضاعة المحروقة</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {realMonths.map((row, idx) => (
                  <tr key={idx} className={`transition-colors ${row.month === selectedMonth ? "bg-indigo-50" : "hover:bg-slate-50"}`}>
                    <td className="p-3 font-black text-slate-900">{row.month}{row.month === selectedMonth ? " •" : ""}</td>
                    <td className="p-3 text-indigo-600">{Number(row.netProfit || 0).toLocaleString()} ج.م</td>
                    <td className="p-3 text-emerald-600">{Number(row.withdrawals || 0).toLocaleString()} ج.م</td>
                    {ns !== "zesty" && <td className="p-3 text-orange-600">{Number(row.burned || 0).toLocaleString()} ج.م</td>}
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
