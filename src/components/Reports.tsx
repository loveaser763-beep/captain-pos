import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Search,
  Printer,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle,
  Plus,
  Trash2,
  Edit,
  Users,
  X,
  LineChart as LineChartIcon
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "motion/react";
import UnifiedPrintButton from "./UnifiedPrintButton";
import { User } from "../types";
import { authFetch } from "../authFetch";

interface ReportsProps {
  currentUser?: User | null;
}

interface Partner {
  id: number;
  name: string;
  fixed_profit_percentage: number;
  purchase_percentage: number;
}

interface Expense {
  id: number;
  title: string;
  amount: number;
  date: string;
  category: string;
  notes: string;
}

export default function Reports({ currentUser }: ReportsProps = {}) {
  const [activeTab, setActiveTab] = useState<"financial_status" | "partners_ledger" | "expenses_manager" | "sales_charts">("financial_status");
  const [reportType, setReportType] = useState<"all" | "sales" | "purchases" | "profit" | "stock" | "expenses">("all");

  const canViewReports = currentUser?.role === "admin" || currentUser?.permissions?.includes("reports");

  if (!canViewReports) {
    return (
      <div className="w-full p-6 flex flex-col items-center justify-center text-right select-none" id="reports-unauthorized" style={{ direction: "rtl" }}>
        <div className="bg-[#c3c6bb] p-6 border border-[#222222] text-center max-w-md space-y-3">
          <AlertTriangle size={24} strokeWidth={1.5} className="mx-auto text-[#222222]" />
          <h3 className="text-sm font-black text-[#000000]">صلاحية الوصول غير متاحة</h3>
          <p className="text-xs text-[#555555] font-semibold leading-relaxed">
            عذراً، صلاحيات الحساب الحالي لا تسمح بالاطلاع على التقارير المالية أو موازنات الأرباح والشراكات.
          </p>
        </div>
      </div>
    );
  }
  
  // Date states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  // Partners & Expenses CRUD states
  const [partners, setPartners] = useState<Partner[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  // Partner Form State
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ id: 0, name: "", fixed_profit_percentage: 0, purchase_percentage: 0 });
  const [partnerError, setPartnerError] = useState("");

  // Expenses Form State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ id: 0, title: "", amount: 0, date: "", category: "صيانة", notes: "", payment_source: "cash_register" });
  const [expenseError, setExpenseError] = useState("");

  // Cashier Commission State
  const [cashierCommPercent, setCashierCommPercent] = useState<number>(0);
  const [cashierPayingPartners, setCashierPayingPartners] = useState<number[]>([]);

  // Charts State
  const [chartViewType, setChartViewType] = useState<"hourly" | "daily">("hourly");
  const [chartDate, setChartDate] = useState<string>("");

  useEffect(() => {
    const today = new Date();
    const formattedToday = today.toISOString().split("T")[0];
    
    const startObj = new Date(today.getFullYear(), today.getMonth(), 1);
    const formattedStart = startObj.toISOString().split("T")[0];

    setStartDate(formattedStart);
    setEndDate(formattedToday);
    setChartDate(formattedToday);
    
    setExpenseForm(prev => ({ ...prev, date: formattedToday }));
  }, []);

  const fetchReport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError("");
    try {
      const url = `/api/reports?reportType=${reportType}&startDate=${startDate}&endDate=${endDate}`;
      const response = await authFetch(url);
      if (!response.ok) throw new Error("فشل الخادم في جلب البيانات والتقارير الحسابية.");
      const resData = await response.json();
      setData(resData);
      
      if (resData.partners) {
        setPartners(resData.partners);
        if (cashierPayingPartners.length === 0) {
          setCashierPayingPartners(resData.partners.map((p: any) => p.id));
        }
      }
      if (resData.expenses) {
        setExpenses(resData.expenses);
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport();
    }
  }, [reportType, startDate, endDate]);

  const setPreset = (type: "today" | "month" | "year") => {
    const today = new Date();
    const formattedToday = today.toISOString().split("T")[0];

    if (type === "today") {
      setStartDate(formattedToday);
      setEndDate(formattedToday);
    } else if (type === "month") {
      const startObj = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(startObj.toISOString().split("T")[0]);
      setEndDate(formattedToday);
    } else if (type === "year") {
      const startObj = new Date(today.getFullYear(), 0, 1);
      setStartDate(startObj.toISOString().split("T")[0]);
      setEndDate(formattedToday);
    }
  };

  const exportToCSV = () => {
    if (!data) return;
    let csvContent = "\uFEFF";
    
    if (reportType === "stock") {
      csvContent += "الباركود,اسم الصنف,سعر الشراء,سعر البيع قطاعي,الكمية الحالية,الوحدة\n";
      data.inventoryStatus.forEach((it: any) => {
        csvContent += `"${it.barcode}","${it.name}",${it.purchase_price},${it.retail_price},${it.quantity},"${it.unit}"\n`;
      });
    } else if (reportType === "expenses") {
      csvContent += "البند,المبلغ,التاريخ,التصنيف,الملاحظات\n";
      expenses.forEach((ex: any) => {
        csvContent += `"${ex.title}",${ex.amount},"${ex.date}","${ex.category}","${ex.notes || ""}"\n`;
      });
    } else {
      csvContent += "رقم الفاتورة,التاريخ,الجهة,النوع,الإجمالي الجزئي,الضريبة,الخصم,خصم التموين,الصافي النهائي,المدفوع\n";
      data.invoices.forEach((inv: any) => {
        const typeAr = inv.type === "sales" ? "مبيعات" : "مشتريات";
        csvContent += `"${inv.invoice_number}","${inv.date}","${inv.customer_supplier_name}","${typeAr}",${inv.subtotal},${inv.tax},${inv.discount},${inv.tamween_discount || 0},${inv.total},${inv.paid}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_${reportType}_${startDate}_إلى_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerError("");
    const isEdit = partnerForm.id > 0;
    const url = isEdit ? `/api/partners/${partnerForm.id}` : "/api/partners";
    const method = isEdit ? "PUT" : "POST";

    try {
      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...partnerForm,
          logCreator: localStorage.getItem("supermarket_user_name") || "مسؤول المتجر"
        })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "فشل حفظ بيانات الشريك.");
      }
      setShowPartnerModal(false);
      setPartnerForm({ id: 0, name: "", fixed_profit_percentage: 0, purchase_percentage: 0 });
      fetchReport();
    } catch (err: any) {
      setPartnerError(err.message);
    }
  };

  const handleDeletePartner = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الشريك؟")) return;
    try {
      const response = await authFetch(`/api/partners/${id}?logCreator=${encodeURIComponent(localStorage.getItem("supermarket_user_name") || "مسؤول المتجر")}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("فشل حذف الشريك.");
      fetchReport();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError("");
    const isEdit = expenseForm.id > 0;
    const url = isEdit ? `/api/expenses/${expenseForm.id}` : "/api/expenses";
    const method = isEdit ? "PUT" : "POST";

    try {
      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...expenseForm,
          logCreator: localStorage.getItem("supermarket_user_name") || "مسؤول المتجر"
        })
      });
      if (!response.ok) throw new Error("فشل تسجيل قيد المصروفات.");
      setShowExpenseModal(false);
      setExpenseForm({ id: 0, title: "", amount: 0, date: new Date().toISOString().split("T")[0], category: "صيانة", notes: "" });
      fetchReport();
    } catch (err: any) {
      setExpenseError(err.message);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المصروف؟")) return;
    try {
      const response = await authFetch(`/api/expenses/${id}?logCreator=${encodeURIComponent(localStorage.getItem("supermarket_user_name") || "مسؤول المتجر")}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("فشل حذف المصروف.");
      fetchReport();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const totalSales = data?.invoices?.filter((i: any) => i.type === "sales" && i.status !== "returned").reduce((add: number, i: any) => add + i.total, 0) || 0;
  const totalPurchases = data?.invoices?.filter((i: any) => i.type === "purchases" && i.status !== "returned").reduce((add: number, i: any) => add + i.total, 0) || 0;
  
  const totalCostOfSales = data?.invoiceItems?.filter((ii: any) => ii.type === "sales").reduce((add: number, ii: any) => add + (ii.cost_price * ii.quantity), 0) || 0;
  const totalSalesRevenue = data?.invoiceItems?.filter((ii: any) => ii.type === "sales").reduce((add: number, ii: any) => add + ii.total, 0) || 0;
  
  const totalExpensesSum = expenses?.reduce((add, ex) => add + Number(ex.amount), 0) || 0;
  
  const grossProfit = totalSalesRevenue - totalCostOfSales;
  const netProfit = grossProfit - totalExpensesSum;

  const cashierCommissionAmount = netProfit > 0 ? (netProfit * cashierCommPercent) / 100 : 0;
  const netProfitAfterCashier = netProfit - cashierCommissionAmount;

  const partnersShares = partners.map(partner => {
    const purchaseShare = (totalPurchases * partner.purchase_percentage) / 100;
    const netProfitShare = netProfitAfterCashier > 0 ? (netProfitAfterCashier * partner.fixed_profit_percentage) / 100 : 0;
    
    const paysCashier = cashierPayingPartners.includes(partner.id);
    let cashierDeductionShare = 0;
    if (paysCashier && cashierCommissionAmount > 0) {
      const totalPayingWeights = partners
        .filter(p => cashierPayingPartners.includes(p.id))
        .reduce((sum, p) => sum + p.fixed_profit_percentage, 0);

      if (totalPayingWeights > 0) {
        cashierDeductionShare = (cashierCommissionAmount * partner.fixed_profit_percentage) / totalPayingWeights;
      }
    }

    const totalIncome = netProfitShare + purchaseShare;
    const finalPayout = totalIncome - cashierDeductionShare;

    return {
      ...partner,
      purchaseShare,
      netProfitShare,
      cashierDeductionShare,
      totalIncome,
      finalPayout
    };
  });

  const processChartData = () => {
    if (!data || !data.invoices) return [];
    
    const salesInvoices = data.invoices.filter((inv: any) => inv.type === "sales");

    if (chartViewType === "hourly") {
      const activeSales = salesInvoices.filter((inv: any) => inv.date === chartDate);
      
      const hourlyData = Array.from({ length: 24 }, (_, i) => ({
        label: `${i.toString().padStart(2, "0")}:00`,
        hour: i,
        المبيعات: 0
      }));

      activeSales.forEach((inv: any) => {
        if (inv.created_at) {
          const dateObj = new Date(inv.created_at);
          const hour = dateObj.getHours();
          hourlyData[hour].المبيعات += (inv.total || 0);
        }
      });
      return hourlyData;
    } else {
      const dailyMap: Record<string, number> = {};
      salesInvoices.forEach((inv: any) => {
        if (inv.date) {
            dailyMap[inv.date] = (dailyMap[inv.date] || 0) + (inv.total || 0);
        }
      });
      
      const sortedKeys = Object.keys(dailyMap).sort();
      return sortedKeys.map(date => ({
         label: date,
         المبيعات: dailyMap[date]
      }));
    }
  };

  const chartDataArray = processChartData();

  return (
    <div className="w-full space-y-6 select-none font-sans" id="printable-reports" style={{ direction: "rtl" }}>
      
      {/* Header section with print and export tools */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-x-4 gap-y-2 no-print">
        <div>
          <h2 className="text-xl font-extrabold text-[#000000] flex items-center gap-2">
            <BarChart3 size={20} strokeWidth={1.5} />
            <span>التقارير الحسابية والتحليل المالي</span>
          </h2>
          <p className="text-xs text-[#555555] font-semibold mt-1">تتبع إحصائيات المبيعات والأرباح والمصروفات ومستحقات الشركاء</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data && (
            <>
              <UnifiedPrintButton printableId="printable-reports" thermalId="reports-80mm-thermal-area" title="طباعة التقارير" />
              <button
                id="btn-export-csv"
                onClick={exportToCSV}
                className="h-9 px-3 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] font-bold text-xs text-[#000000] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet size={16} strokeWidth={1.5} />
                <span>تصدير CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex border-b border-[#222222] gap-x-4 gap-y-2 no-print overflow-x-auto" id="reports-tab-navigation">
        <button
          onClick={() => setActiveTab("financial_status")}
          className={`px-4 py-2 text-xs font-bold transition-colors cursor-pointer shrink-0 border-t border-x border-[#222222] ${
            activeTab === "financial_status" 
              ? "bg-[#222222] text-[#c3c6bb]" 
              : "bg-[#b8bcb2] text-[#000000] hover:bg-[#c3c6bb]"
          }`}
        >
          <span>المؤشرات والأرباح</span>
        </button>
        <button
          onClick={() => setActiveTab("partners_ledger")}
          className={`px-4 py-2 text-xs font-bold transition-colors cursor-pointer shrink-0 border-t border-x border-[#222222] ${
            activeTab === "partners_ledger" 
              ? "bg-[#222222] text-[#c3c6bb]" 
              : "bg-[#b8bcb2] text-[#000000] hover:bg-[#c3c6bb]"
          }`}
        >
          <span>حسابات الشركاء</span>
        </button>
        <button
          onClick={() => setActiveTab("expenses_manager")}
          className={`px-4 py-2 text-xs font-bold transition-colors cursor-pointer shrink-0 border-t border-x border-[#222222] ${
            activeTab === "expenses_manager" 
              ? "bg-[#222222] text-[#c3c6bb]" 
              : "bg-[#b8bcb2] text-[#000000] hover:bg-[#c3c6bb]"
          }`}
        >
          <span>المصروفات التشغيلية</span>
        </button>
        <button
          onClick={() => setActiveTab("sales_charts")}
          className={`px-4 py-2 text-xs font-bold transition-colors cursor-pointer shrink-0 border-t border-x border-[#222222] ${
            activeTab === "sales_charts" 
              ? "bg-[#222222] text-[#c3c6bb]" 
              : "bg-[#b8bcb2] text-[#000000] hover:bg-[#c3c6bb]"
          }`}
        >
          <span>مخطط المبيعات</span>
        </button>
      </div>

      {/* Date Filters 12-Column Grid */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] grid grid-cols-12 gap-x-4 gap-y-2 items-end no-print" id="reports-filters-toolbar">
        <div className="col-span-12 lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2">
          <button
            onClick={() => setPreset("today")}
            className="h-9 bg-[#b8bcb2] hover:bg-[#c3c6bb] text-xs font-bold text-[#000000] border border-[#888888] transition-colors cursor-pointer"
          >
            اليوم
          </button>
          <button
            onClick={() => setPreset("month")}
            className="h-9 bg-[#b8bcb2] hover:bg-[#c3c6bb] text-xs font-bold text-[#000000] border border-[#888888] transition-colors cursor-pointer"
          >
            الشهر
          </button>
          <button
            onClick={() => setPreset("year")}
            className="h-9 bg-[#b8bcb2] hover:bg-[#c3c6bb] text-xs font-bold text-[#000000] border border-[#888888] transition-colors cursor-pointer"
          >
            السنة
          </button>
        </div>

        <div className="col-span-12 sm:col-span-6 lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-right">
          <div>
            <label className="block text-xs font-bold text-[#000000] mb-1">من تاريخ</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#000000] mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
            />
          </div>
        </div>

        <div className="col-span-12 sm:col-span-6 lg:col-span-3 text-right">
          <label className="block text-xs font-bold text-[#000000] mb-1">نوع المستند</label>
          <select
            value={reportType}
            onChange={(e: any) => setReportType(e.target.value)}
            className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] cursor-pointer focus:outline-none focus:border-[#222222]"
          >
            <option value="all">كشف الفواتير الشامل</option>
            <option value="sales">فواتير المبيعات</option>
            <option value="purchases">فواتير المشتريات</option>
            <option value="profit">تحليل أرباح المنتجات</option>
            <option value="stock">تقييم المخزون الحالي</option>
            <option value="expenses">قائمة المصروفات</option>
          </select>
        </div>
      </div>

      {loading || !data ? (
        <div className="p-12 text-center text-[#555555] bg-[#c3c6bb] border border-[#222222] font-bold text-xs">
          جاري تجميع البيانات الحسابية والتقارير...
        </div>
      ) : error ? (
        <div className="p-3 bg-[#c3c6bb] text-[#000000] text-xs font-bold border border-[#222222] text-right">
          حدث خطأ: {error}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Financial Status */}
          {activeTab === "financial_status" && (
            <motion.div
              key="financial_status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Highlights 12-Column Grid */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-[#c3c6bb] p-4 border border-[#222222] text-right">
                  <span className="text-xs font-bold text-[#555555]">إجمالي المبيعات</span>
                  <h4 className="text-xl font-black text-[#000000] mt-1">{((totalSales || 0)).toFixed(2)} ج.م</h4>
                  <p className="text-xs text-[#555555] font-bold mt-1">الفواتير: {data?.invoices?.filter((i: any) => i.type === "sales").length || 0}</p>
                </div>

                <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-[#c3c6bb] p-4 border border-[#222222] text-right">
                  <span className="text-xs font-bold text-[#555555]">إجمالي المشتريات</span>
                  <h4 className="text-xl font-black text-[#000000] mt-1">{((totalPurchases || 0)).toFixed(2)} ج.م</h4>
                  <p className="text-xs text-[#555555] font-bold mt-1">تكلفة التوريدات</p>
                </div>

                <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-[#c3c6bb] p-4 border border-[#222222] text-right">
                  <span className="text-xs font-bold text-[#555555]">المصروفات التشغيلية</span>
                  <h4 className="text-xl font-black text-[#000000] mt-1">{((totalExpensesSum || 0)).toFixed(2)} ج.م</h4>
                  <p className="text-xs text-[#555555] font-bold mt-1">تكاليف التشغيل والخدمات</p>
                </div>

                <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-[#222222] p-4 border border-[#222222] text-right text-[#c3c6bb]">
                  <span className="text-xs font-bold text-[#b8bcb2]">صافي الربح الفعلي</span>
                  <h4 className="text-xl font-black text-[#c3c6bb] mt-1">
                    {((netProfit || 0)).toFixed(2)} ج.م
                  </h4>
                  <p className="text-xs text-[#b8bcb2] font-bold mt-1">عائد الأرباح النهائي</p>
                </div>
              </div>

              {/* Partners Calculations Grid */}
              {partners.length > 0 && (
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 lg:col-span-8 bg-[#c3c6bb] p-4 border border-[#222222] space-y-3 text-right">
                    <h3 className="text-sm font-extrabold text-[#000000] flex items-center gap-2">
                      <Users size={16} strokeWidth={1.5} />
                      <span>جدول مستحقات الشركاء</span>
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right min-w-[500px]">
                        <thead>
                          <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-9">
                            <th className="py-2 px-3">الشريك</th>
                            <th className="py-2 px-3 text-center">الأرباح</th>
                            <th className="py-2 px-3 text-center">المشتريات</th>
                            <th className="py-2 px-3 text-left">الصافي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
                          {partnersShares.map(p => (
                            <tr key={p.id}>
                              <td className="py-2.5 px-3">{p.name}</td>
                              <td className="py-2.5 px-3 text-center">
                                {(p.netProfitShare || 0).toFixed(2)} ج.م ({p.fixed_profit_percentage}%)
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {(p.purchaseShare || 0).toFixed(2)} ج.م ({p.purchase_percentage}%)
                              </td>
                              <td className="py-2.5 px-3 text-left font-black">{(p.finalPayout || 0).toFixed(2)} ج.م</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="col-span-12 lg:col-span-4 bg-[#c3c6bb] p-4 border border-[#222222] text-right space-y-3">
                    <h4 className="text-xs font-bold text-[#000000]">عمولة الكاشير</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-[#000000] mb-1">النسبة من صافي الربح %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cashierCommPercent}
                          onChange={(e) => setCashierCommPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                        />
                        <p className="text-xs text-[#555555] font-bold mt-1">المبلغ المحتسب: {(cashierCommissionAmount || 0).toFixed(2)} ج.م</p>
                      </div>

                      {cashierCommissionAmount > 0 && (
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-[#000000] mb-1">المساهمون في التكلفة:</label>
                          <div className="space-y-1 bg-[#b8bcb2] p-2 border border-[#888888]">
                            {partners.map(p => {
                              const checked = cashierPayingPartners.includes(p.id);
                              return (
                                <label key={p.id} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#000000]">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      if (checked) {
                                        setCashierPayingPartners(cashierPayingPartners.filter(id => id !== p.id));
                                      } else {
                                        setCashierPayingPartners([...cashierPayingPartners, p.id]);
                                      }
                                    }}
                                  />
                                  <span>{p.name} ({p.fixed_profit_percentage}%)</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Data Table Section */}
              <div className="bg-[#c3c6bb] border border-[#222222] p-4" id="reports-main-data-table-section">
                <div className="border-b border-[#888888] pb-2 mb-3 text-right">
                  <h3 className="font-extrabold text-xs text-[#000000]">السجلات المسرودة تفصيلياً</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs min-w-[850px] border-collapse">
                    <thead>
                      <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-10">
                        <th className="py-3 px-4 whitespace-nowrap">رقم المستند</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap min-w-[160px]">الطرف الثاني</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">التاريخ</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">النوع</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">الخصم</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">خصم التموين</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">المصدر</th>
                        <th className="py-3 px-4 text-left whitespace-nowrap">الصافي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
                      {data?.invoices && data?.invoices.length > 0 ? (
                        data?.invoices.map((inv: any) => (
                          <tr key={inv.id} className="hover:bg-[#b8bcb2] transition-colors">
                            <td className="py-3 px-4 font-mono whitespace-nowrap">{inv.invoice_number}</td>
                            <td className="py-3 px-4 text-center min-w-[160px]">{inv.customer_supplier_name}</td>
                            <td className="py-3 px-4 text-center font-mono whitespace-nowrap">{inv.date}</td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span className="bg-[#222222] text-[#c3c6bb] px-2.5 py-1 text-xs font-bold">
                                {inv.type === "sales" ? "مبيعات" : "مشتريات"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono whitespace-nowrap">-{(inv.discount || 0).toFixed(2)} ج.م</td>
                            <td className="py-3 px-4 text-center font-mono whitespace-nowrap">
                              {inv.tamween_discount > 0 ? (
                                <span className="text-orange-600 font-bold">{inv.tamween_discount.toFixed(2)} ج.م</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {inv.payment_source === "cash_register" ? "الكاشير" : "الخزنة"}
                            </td>
                            <td className="py-3 px-4 text-left font-black font-mono text-sm whitespace-nowrap">{(inv.total || 0).toFixed(2)} ج.م</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-[#555555] font-bold">لا توجد سجلات متوفرة في هذه الفترة.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: Partners Ledger */}
          {activeTab === "partners_ledger" && (
            <motion.div
              key="partners_ledger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center bg-[#c3c6bb] p-4 border border-[#222222] text-right no-print">
                <div>
                  <h3 className="font-extrabold text-sm text-[#000000]">سجل الشركاء والنسب المعتمدة</h3>
                  <p className="text-xs text-[#555555] font-semibold mt-0.5">تحديث إعدادات توزيع الأرباح وتكاليف التوريدات</p>
                </div>
                <button
                  id="btn-add-partner-modal"
                  onClick={() => {
                    setPartnerForm({ id: 0, name: "", fixed_profit_percentage: 0, purchase_percentage: 0 });
                    setPartnerError("");
                    setShowPartnerModal(true);
                  }}
                  className="h-9 px-3 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={16} strokeWidth={1.5} />
                  <span>إضافة شريك جديد</span>
                </button>
              </div>

              {partners.length > 0 ? (
                <div className="grid grid-cols-12 gap-4" id="partners-list-grid">
                  {partnersShares.map(p => (
                    <div key={p.id} className="col-span-12 sm:col-span-6 lg:col-span-4 bg-[#c3c6bb] border border-[#222222] p-4 flex flex-col justify-between space-y-4" id={`partner-card-${p.id}`}>
                      <div className="text-right space-y-2">
                        <div className="flex justify-between items-start pb-2 border-b border-[#888888]">
                          <span className="bg-[#222222] text-[#c3c6bb] text-xs font-bold px-2 py-0.5 flex items-center gap-1">
                            <Users size={14} strokeWidth={1.5} />
                            <span>شريك مسجل</span>
                          </span>
                          <div className="flex gap-x-4 gap-y-2 no-print">
                            <button
                              onClick={() => {
                                setPartnerForm({ ...p });
                                setPartnerError("");
                                setShowPartnerModal(true);
                              }}
                              className="w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer"
                            >
                              <Edit size={14} strokeWidth={1.5} />
                            </button>
                            <button
                              onClick={() => handleDeletePartner(p.id)}
                              className="w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer"
                            >
                              <Trash2 size={14} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>

                        <h4 className="font-extrabold text-sm text-[#000000]">{p.name}</h4>
                        <div className="flex gap-x-4 gap-y-2 text-xs font-bold text-[#555555]">
                          <span>الربح: {p.fixed_profit_percentage}%</span>
                          <span>المشتريات: {p.purchase_percentage}%</span>
                        </div>
                      </div>

                      <div className="bg-[#b8bcb2] p-3 border border-[#888888] space-y-2 text-right font-bold text-xs">
                        <div className="flex justify-between items-center text-[#000000]">
                          <span>حصة المشتريات:</span>
                          <span>{(p.purchaseShare || 0).toFixed(2)} ج.م</span>
                        </div>
                        <div className="flex justify-between items-center text-[#000000]">
                          <span>حصة الأرباح:</span>
                          <span>{(p.netProfitShare || 0).toFixed(2)} ج.م</span>
                        </div>
                        {p.cashierDeductionShare > 0 && (
                          <div className="flex justify-between items-center text-[#000000]">
                            <span>خصم الكاشير:</span>
                            <span>-{(p.cashierDeductionShare || 0).toFixed(2)} ج.م</span>
                          </div>
                        )}
                        <div className="border-t border-[#888888] pt-1 flex justify-between items-center text-sm font-black text-[#000000]">
                          <span>الصافي المستحق:</span>
                          <span>{(p.finalPayout || 0).toFixed(2)} ج.م</span>
                        </div>
                      </div>

                      <div className="w-full flex justify-center no-print">
                        <UnifiedPrintButton printableId="reports-80mm-thermal-area" thermalId="reports-80mm-thermal-area" title="طباعة البيان" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#c3c6bb] p-12 text-center text-[#000000] font-bold border border-[#222222] text-xs">
                  لا يوجد شركاء مسجلين بالنظام حالياً.
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: Operational Expenses */}
          {activeTab === "expenses_manager" && (
            <motion.div
              key="expenses_manager"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center bg-[#c3c6bb] p-4 border border-[#222222] text-right no-print">
                <div>
                  <h3 className="font-extrabold text-sm text-[#000000]">سجل المصروفات التشغيلية</h3>
                  <p className="text-xs text-[#555555] font-semibold mt-0.5">تسجيل متابعة تكاليف الصيانة والخدمات والرواتب</p>
                </div>
                <button
                  id="btn-add-expense-modal"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    setExpenseForm({ id: 0, title: "", amount: 0, date: todayStr, category: "صيانة", notes: "" });
                    setExpenseError("");
                    setShowExpenseModal(true);
                  }}
                  className="h-9 px-3 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={16} strokeWidth={1.5} />
                  <span>تسجيل مصروف جديد</span>
                </button>
              </div>

              <div className="bg-[#c3c6bb] border border-[#222222] p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs min-w-[850px] border-collapse">
                    <thead>
                      <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-10">
                        <th className="py-3 px-4 whitespace-nowrap min-w-[180px]">عنوان المصروف</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">المبلغ</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">التاريخ</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">التصنيف</th>
                        <th className="py-3 px-4 text-right min-w-[200px]">الملاحظات</th>
                        <th className="py-3 px-4 text-left whitespace-nowrap no-print">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
                      {expenses.length > 0 ? (
                        expenses.map((ex) => (
                          <tr key={ex.id} className="hover:bg-[#b8bcb2] transition-colors">
                            <td className="py-3 px-4 min-w-[180px]">{ex.title}</td>
                            <td className="py-3 px-4 text-center font-mono whitespace-nowrap">-{(ex.amount || 0).toFixed(2)} ج.م</td>
                            <td className="py-3 px-4 text-center font-mono whitespace-nowrap">{ex.date}</td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">{ex.category}</td>
                            <td className="py-3 px-4 text-right min-w-[200px] leading-snug">{ex.notes || "لا يوجد"}</td>
                            <td className="py-3 px-4 text-left whitespace-nowrap no-print">
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => {
                                    setExpenseForm({ ...ex });
                                    setExpenseError("");
                                    setShowExpenseModal(true);
                                  }}
                                  className="w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer"
                                >
                                  <Edit size={14} strokeWidth={1.5} />
                                </button>
                                <button
                                  onClick={() => handleDeleteExpense(ex.id)}
                                  className="w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer"
                                >
                                  <Trash2 size={14} strokeWidth={1.5} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[#555555] font-bold">لا توجد مصاريف مسجلة.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: Sales Charts */}
          {activeTab === "sales_charts" && (
            <motion.div
              key="sales_charts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#c3c6bb] p-4 border border-[#222222] text-right gap-3">
                <div>
                  <h3 className="font-extrabold text-sm text-[#000000]">رسم بياني لحجم المبيعات</h3>
                  <p className="text-xs text-[#555555] font-semibold mt-0.5">تحليل توزع المبيعات بالساعات أو الأيام</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-[#b8bcb2] p-1 border border-[#888888]">
                    <button
                      onClick={() => setChartViewType("hourly")}
                      className={`px-3 py-1 text-xs font-bold cursor-pointer ${
                        chartViewType === "hourly" ? "bg-[#222222] text-[#c3c6bb]" : "text-[#000000]"
                      }`}
                    >
                      ساعات اليوم
                    </button>
                    <button
                      onClick={() => setChartViewType("daily")}
                      className={`px-3 py-1 text-xs font-bold cursor-pointer ${
                        chartViewType === "daily" ? "bg-[#222222] text-[#c3c6bb]" : "text-[#000000]"
                      }`}
                    >
                      الأيام
                    </button>
                  </div>
                  
                  {chartViewType === "hourly" && (
                    <input
                      type="date"
                      value={chartDate}
                      onChange={(e) => setChartDate(e.target.value)}
                      className="h-8 bg-[#b8bcb2] border border-[#888888] px-2 text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                    />
                  )}
                </div>
              </div>

              <div className="bg-[#c3c6bb] border border-[#222222] p-4 h-[350px]">
                {chartDataArray.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDataArray} margin={{ top: 15, right: 15, left: 15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#888888" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#000000', fontWeight: 'bold' }} dy={5} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#000000', fontWeight: 'bold' }} dx={-5} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#c3c6bb', border: '1px solid #222222', borderRadius: '0px', fontSize: '11px', fontWeight: 'bold', color: '#000000' }} 
                        itemStyle={{ color: '#000000' }}
                        formatter={(value: number) => [`${value.toFixed(2)} ج.م`, "المبيعات"]}
                      />
                      <Bar dataKey="المبيعات" fill="#222222" maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#555555]">
                    <LineChartIcon size={36} strokeWidth={1.5} className="mb-2 text-[#222222]" />
                    <p className="font-bold text-xs">لا توجد سجلات مبيعات بالفترة المحددة.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      )}

      {/* Partner Modal */}
      {showPartnerModal && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50 text-right no-print">
          <div className="bg-[#c3c6bb] border border-[#222222] p-4 w-full max-w-sm relative space-y-3 font-sans">
            <button
              onClick={() => setShowPartnerModal(false)}
              className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="font-extrabold text-sm text-[#000000] border-b border-[#888888] pb-2">
              {partnerForm.id > 0 ? "تعديل بيانات الشريك" : "إضافة شريك جديد"}
            </h3>

            {partnerError && (
              <p className="bg-[#b8bcb2] text-[#000000] border border-[#222222] p-2 text-xs font-bold">{partnerError}</p>
            )}

            <form onSubmit={handleSavePartner} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-[#000000] mb-1">اسم الشريك</label>
                <input
                  type="text"
                  required
                  value={partnerForm.name}
                  onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                  placeholder="اسم الشريك..."
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <label className="block text-[#000000] mb-1">نسبة الربح %</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.1"
                    value={partnerForm.fixed_profit_percentage || ""}
                    onChange={(e) => setPartnerForm({ ...partnerForm, fixed_profit_percentage: parseFloat(e.target.value) || 0 })}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
                <div>
                  <label className="block text-[#000000] mb-1">نسبة المشتريات %</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.1"
                    value={partnerForm.purchase_percentage || ""}
                    onChange={(e) => setPartnerForm({ ...partnerForm, purchase_percentage: parseFloat(e.target.value) || 0 })}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-9 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors cursor-pointer mt-2"
              >
                {partnerForm.id > 0 ? "حفظ التعديلات" : "إضافة الشريك"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50 text-right no-print">
          <div className="bg-[#c3c6bb] border border-[#222222] p-4 w-full max-w-sm relative space-y-3 font-sans">
            <button
              onClick={() => setShowExpenseModal(false)}
              className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="font-extrabold text-sm text-[#000000] border-b border-[#888888] pb-2">
              {expenseForm.id > 0 ? "تعديل قيد المصروف" : "تسجيل مصروف جديد"}
            </h3>

            {expenseError && (
              <p className="bg-[#b8bcb2] text-[#000000] border border-[#222222] p-2 text-xs font-bold">{expenseError}</p>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs font-bold">

                <div>
                  <label className="block text-[#000000] mb-1">مصدر الدفع</label>
                  <select
                    value={expenseForm.payment_source || "cash_register"}
                    onChange={(e) => setExpenseForm({ ...expenseForm, payment_source: e.target.value })}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] cursor-pointer focus:outline-none focus:border-[#222222]"
                  >
                    <option value="cash_register">درج الكاشير</option>
                    <option value="main_safe">الخزينة الرئيسية</option>
                  </select>
                </div>

              <div>
                <label className="block text-[#000000] mb-1">عنوان المصروف</label>
                <input
                  type="text"
                  required
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  placeholder="عنوان المصروف..."
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <label className="block text-[#000000] mb-1">المبلغ (ج.م)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.1"
                    value={expenseForm.amount || ""}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
                <div>
                  <label className="block text-[#000000] mb-1">التصنيف</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] cursor-pointer focus:outline-none focus:border-[#222222]"
                  >
                    <option value="صيانة">صيانة عامة</option>
                    <option value="شراء جهاز">شراء معدات</option>
                    <option value="بناء">تجهيزات المتجر</option>
                    <option value="برمجيات ورخص">تراخيص وبرامج</option>
                    <option value="كهرباء ومرافق">فواتير ومرافق</option>
                    <option value="رواتب">رواتب وأجور</option>
                    <option value="أخرى">مصروفات أخرى</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#000000] mb-1">تاريخ الإنفاق</label>
                <input
                  type="date"
                  required
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                />
              </div>

              <div>
                <label className="block text-[#000000] mb-1">ملاحظات</label>
                <textarea
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  placeholder="ملاحظات..."
                  rows={2}
                  className="w-full bg-[#b8bcb2] border border-[#888888] p-2 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                />
              </div>

              <button
                type="submit"
                className="w-full h-9 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors cursor-pointer mt-2"
              >
                {expenseForm.id > 0 ? "حفظ التعديلات" : "تسجيل المصروف"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* منطقة الإيصال الحراري 80mm — مخفية دائماً للزر الموحد (حرارية/A4/صورة) */}
      {data && (
        <div className="no-print" aria-hidden="true" style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }}>
          <div
            id="reports-80mm-thermal-area"
            className="bg-white p-3 font-sans text-black space-y-3 text-right border"
            style={{ direction: "rtl", width: "80mm", minWidth: "80mm", maxWidth: "80mm" }}
          >
            <div className="text-center space-y-0.5 border-b border-black pb-2 text-xs">
              <h4 className="font-bold">{localStorage.getItem("supermarket_market_name") || "سوبرماركت المدينة المنورة"}</h4>
              <p className="text-[10px] text-gray-600">تقرير مالي وإحصائي</p>
              <p className="text-[10px] text-black font-semibold">من {startDate} إلى {endDate}</p>
            </div>

            <div className="space-y-1 text-xs border-b border-black pb-2 font-bold">
              <div className="flex justify-between"><span>المبيعات:</span> <span>{(totalSales || 0).toFixed(2)} ج.م</span></div>
              <div className="flex justify-between"><span>المشتريات:</span> <span>{(totalPurchases || 0).toFixed(2)} ج.م</span></div>
              <div className="flex justify-between"><span>المصروفات:</span> <span>-{(totalExpensesSum || 0).toFixed(2)} ج.م</span></div>
              <div className="flex justify-between font-black text-sm border-t border-black pt-1"><span>صافي الربح:</span> <span>{(netProfit || 0).toFixed(2)} ج.م</span></div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
