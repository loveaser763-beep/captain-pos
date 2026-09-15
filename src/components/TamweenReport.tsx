import React, { useState, useEffect } from "react";
import { FileText, Download, Search, Calendar, CreditCard, Printer } from "lucide-react";
import { authFetch } from "../authFetch";

interface MonthlyReport {
  month: string;
  summary: {
    total_invoices: number;
    total_subtotal: number;
    total_tamween_discount: number;
    total_invoice_value: number;
    withdrawn_customers: number;
    later_customers: number;
    total_customers: number;
    total_replacements: number;
    total_replacements_value: number;
  };
  invoices: any[];
  customers: any[];
  replacements: any[];
}

export default function TamweenReport() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/tamween/monthly-report?month=${selectedMonth}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedMonth]);

  const exportToCSV = () => {
    if (!report) return;
    
    let csvContent = "\uFEFF";
    csvContent += "تقرير التسوية الشهرية - التموين\n";
    csvContent += `الشهر: ${report.month}\n\n`;
    
    // Summary
    csvContent += "الملخص\n";
    csvContent += `عدد الفواتير,${report.summary.total_invoices}\n`;
    csvContent += `إجمالي المنتجات,${report.summary.total_subtotal}\n`;
    csvContent += `إجمالي خصم التموين,${report.summary.total_tamween_discount}\n`;
    csvContent += `إجمالي الفواتير النهائي,${report.summary.total_invoice_value}\n`;
    csvContent += `عدد العملاء المصروفين,${report.summary.withdrawn_customers}\n`;
    csvContent += `عدد العملاء (صرف لاحق),${report.summary.later_customers}\n\n`;
    
    // Invoices
    csvContent += "الفواتير\n";
    csvContent += "رقم الفاتورة,التاريخ,العميل,الإجمالي الجزئي,خصم التموين,الصافي\n";
    report.invoices.forEach(inv => {
      csvContent += `"${inv.invoice_number}","${inv.date}","${inv.customer_supplier_name}",${inv.subtotal},${inv.tamween_discount},${inv.total}\n`;
    });
    
    // Customers
    csvContent += "\nالعملاء\n";
    csvContent += "الاسم,الرقم السري,قيمة البطاقة,الحالة\n";
    report.customers.forEach(c => {
      const status = c.status === 'withdrawn' ? 'تم الصرف' : 'صرف في وقت لاحق';
      csvContent += `"${c.name}","${c.secret_number}",${c.card_value},"${status}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_التموين_${report.month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden font-sans" style={{ direction: "rtl" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 10mm; }
          table { font-size: 10px; }
          th, td { padding: 4px 8px !important; }
        }
      `}</style>
      {/* Header */}
      <header className="bg-[#c3c6bb] p-4 border-b border-[#222222] shrink-0 flex justify-between items-center no-print">
        <div className="flex items-center gap-3">
          <div className="bg-[#222222] p-2 text-[#c3c6bb]">
            <FileText size={24} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#000000]">تقرير التسوية الشهرية - التموين</h2>
            <p className="text-xs text-[#555555] font-bold mt-1">تقرير شامل لصرف البطاقات التموينية للشركة</p>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="p-4 bg-[#b8bcb2] border-b border-[#888888] flex gap-4 items-center shrink-0 no-print">
        <div className="flex items-center gap-2">
          <Calendar size={16} />
          <label className="text-sm font-bold">الشهر:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-[#888888] text-sm font-bold bg-white"
          />
        </div>
        <button
          onClick={exportToCSV}
          disabled={!report}
          className="flex items-center gap-2 px-4 py-2 bg-[#222222] text-[#c3c6bb] hover:bg-[#000000] text-sm font-bold transition-colors disabled:opacity-50"
        >
          <Download size={16} /> تصدير CSV
        </button>
        <button
          onClick={handlePrint}
          disabled={!report}
          className="flex items-center gap-2 px-4 py-2 bg-[#c3c6bb] text-[#000000] hover:bg-[#888888] border border-[#888888] text-sm font-bold transition-colors disabled:opacity-50"
        >
          <Printer size={16} /> طباعة
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        {loading ? (
          <div className="p-12 text-center text-[#555555] font-bold">جاري تحميل التقرير...</div>
        ) : report ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#f5f5f5] p-4 border border-[#888888]">
                <p className="text-xs text-[#555555] font-bold">عدد الفواتير</p>
                <p className="text-2xl font-black text-[#000000] mt-1">{report.summary.total_invoices}</p>
              </div>
              <div className="bg-[#f5f5f5] p-4 border border-[#888888]">
                <p className="text-xs text-[#555555] font-bold">إجمالي المنتجات</p>
                <p className="text-2xl font-black text-[#000000] mt-1">{report.summary.total_subtotal.toFixed(2)} ج.م</p>
              </div>
              <div className="bg-orange-50 p-4 border border-orange-200">
                <p className="text-xs text-orange-600 font-bold">إجمالي خصم التموين</p>
                <p className="text-2xl font-black text-orange-600 mt-1">{report.summary.total_tamween_discount.toFixed(2)} ج.م</p>
              </div>
              <div className="bg-green-50 p-4 border border-green-200">
                <p className="text-xs text-green-600 font-bold">إجمالي الفواتير النهائي</p>
                <p className="text-2xl font-black text-green-600 mt-1">{report.summary.total_invoice_value.toFixed(2)} ج.م</p>
              </div>
            </div>

            {/* Customer Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 border border-blue-200">
                <p className="text-xs text-blue-600 font-bold">العملاء المصروفين</p>
                <p className="text-2xl font-black text-blue-600 mt-1">{report.summary.withdrawn_customers}</p>
              </div>
              <div className="bg-amber-50 p-4 border border-amber-200">
                <p className="text-xs text-amber-600 font-bold">صرف في وقت لاحق</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{report.summary.later_customers}</p>
              </div>
              <div className="bg-gray-50 p-4 border border-gray-200">
                <p className="text-xs text-gray-600 font-bold">إجمالي العملاء</p>
                <p className="text-2xl font-black text-gray-600 mt-1">{report.summary.total_customers}</p>
              </div>
            </div>

            {/* Debt Tracking Section */}
            <div className="border border-[#888888] overflow-hidden">
              <div className="bg-[#222222] text-[#c3c6bb] p-3 font-bold text-sm">
                تتبع ديون الشركة - التسوية المالية
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-orange-50 p-4 border border-orange-200">
                    <p className="text-xs text-orange-600 font-bold"> Company you should pay ( Company owes you )</p>
                    <p className="text-xs text-orange-500 mt-1">Company should pay for tamween cards used</p>
                    <p className="text-2xl font-black text-orange-600 mt-2">{report.summary.total_tamween_discount.toFixed(2)} ج.م</p>
                  </div>
                  <div className="bg-green-50 p-4 border border-green-200">
                    <p className="text-xs text-green-600 font-bold">قيمة الاستعاضات (الشركة أرسلتلك)</p>
                    <p className="text-xs text-green-500 mt-1">البضاعة البديلة اللي الشركة أرسلتها</p>
                    <p className="text-2xl font-black text-green-600 mt-2">{report.summary.total_replacements_value.toFixed(2)} ج.م</p>
                  </div>
                </div>
                <div className={`p-4 border-2 ${(report.summary.total_tamween_discount - report.summary.total_replacements_value) > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                  <p className={`text-sm font-bold ${(report.summary.total_tamween_discount - report.summary.total_replacements_value) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    الصافي {(report.summary.total_tamween_discount - report.summary.total_replacements_value) > 0 ? 'الشركة مديالك' : 'أنت مديهم'}
                  </p>
                  <p className={`text-3xl font-black mt-2 ${(report.summary.total_tamween_discount - report.summary.total_replacements_value) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {Math.abs(report.summary.total_tamween_discount - report.summary.total_replacements_value).toFixed(2)} ج.م
                  </p>
                </div>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="border border-[#888888] overflow-hidden">
              <div className="bg-[#222222] text-[#c3c6bb] p-3 font-bold text-sm">
                الفواتير содержащая خصم تموين ({report.invoices.length})
              </div>
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#c3c6bb] font-bold">
                    <th className="py-3 px-4">رقم الفاتورة</th>
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">العميل</th>
                    <th className="py-3 px-4 text-center">الإجمالي الجزئي</th>
                    <th className="py-3 px-4 text-center">خصم التموين</th>
                    <th className="py-3 px-4 text-center">الصافي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#888888]/40 font-bold">
                  {report.invoices.length > 0 ? (
                    report.invoices.map((inv, idx) => (
                      <tr key={idx} className="hover:bg-[#b8bcb2] transition-colors">
                        <td className="py-3 px-4 font-mono">{inv.invoice_number}</td>
                        <td className="py-3 px-4 font-mono">{inv.date}</td>
                        <td className="py-3 px-4">{inv.customer_supplier_name}</td>
                        <td className="py-3 px-4 text-center font-mono">{inv.subtotal.toFixed(2)} ج.م</td>
                        <td className="py-3 px-4 text-center font-mono text-orange-600 font-black">{inv.tamween_discount.toFixed(2)} ج.م</td>
                        <td className="py-3 px-4 text-center font-mono">{inv.total.toFixed(2)} ج.م</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#555555]">لا توجد فواتير بخصم تموين في هذا الشهر.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Customers Table */}
            <div className="border border-[#888888] overflow-hidden">
              <div className="bg-[#222222] text-[#c3c6bb] p-3 font-bold text-sm">
                عملاء التموين ({report.customers.length})
              </div>
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#c3c6bb] font-bold">
                    <th className="py-3 px-4">الاسم</th>
                    <th className="py-3 px-4">الرقم السري</th>
                    <th className="py-3 px-4 text-center">قيمة البطاقة</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#888888]/40 font-bold">
                  {report.customers.length > 0 ? (
                    report.customers.map((cust, idx) => (
                      <tr key={idx} className="hover:bg-[#b8bcb2] transition-colors">
                        <td className="py-3 px-4">{cust.name}</td>
                        <td className="py-3 px-4 font-mono">{cust.secret_number}</td>
                        <td className="py-3 px-4 text-center font-mono">{cust.card_value.toFixed(2)} ج.م</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 text-[10px] font-bold ${
                            cust.status === 'withdrawn' ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'
                          }`}>
                            {cust.status === 'withdrawn' ? 'تم الصرف' : 'صرف في وقت لاحق'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-[#555555]">لا يوجد عملاء تموين في هذا الشهر.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-[#555555]">حدث خطأ في تحميل التقرير.</div>
        )}
      </div>
    </div>
  );
}
