import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import {
  AlertTriangle,
  Receipt,
  ArrowUpLeft,
  RefreshCw,
  ShoppingBag,
  Eye,
  Edit,
  Trash2,
  RotateCcw,
  Lock,
  CheckCircle,
  X
} from "lucide-react";
import { DashboardStats, User, Invoice, InvoiceItem } from "../types";
import { authFetch } from "../authFetch";

interface DashboardProps {
  onNavigateToTab: (tab: string) => void;
  currentUser: User | null;
}

export default function Dashboard({ onNavigateToTab, currentUser }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modals state
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [viewInvoiceItems, setViewInvoiceItems] = useState<InvoiceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editPaymentSource, setEditPaymentSource] = useState<"cash_register" | "main_safe">("cash_register");
  const [editPaid, setEditPaid] = useState(0);
  const [editRemaining, setEditRemaining] = useState(0);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteInvoiceNumber, setDeleteInvoiceNumber] = useState("");

  const [returnInvoice, setReturnInvoice] = useState<Invoice | null>(null);
  const [returnInvoiceDetails, setReturnInvoiceDetails] = useState<{ invoice: any; items: any[] } | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [loadingReturnDetails, setLoadingReturnDetails] = useState(false);
  const [returnType, setReturnType] = useState<"full" | "partial">("partial");

  useEffect(() => {
    if (returnInvoice) {
      setLoadingReturnDetails(true);
      setReturnInvoiceDetails(null);
      setReturnQuantities({});
      setReturnType("partial");
      authFetch(`/api/invoices/${returnInvoice.id}`)
        .then((res) => res.json())
        .then((data) => {
          setReturnInvoiceDetails(data);
          const initialQ: Record<number, number> = {};
          (data.items || []).forEach((it: any) => {
            initialQ[it.id] = 0;
          });
          setReturnQuantities(initialQ);
        })
        .catch((err) => console.error("خطأ جلب بيانات الفاتورة:", err))
        .finally(() => setLoadingReturnDetails(false));
    } else {
      setReturnInvoiceDetails(null);
    }
  }, [returnInvoice]);

  const fetchStats = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/dashboard/stats");
      if (!response.ok) throw new Error("فشل اتصال لوحة التحكم بالنظام المحاسبي.");
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || "فشلت عملية جلب معلومات الشاشة الرئيسية.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const handleViewInvoice = async (inv: Invoice) => {
    setViewInvoice(inv);
    setLoadingItems(true);
    try {
      const res = await authFetch(`/api/invoices/${inv.id}`);
      if (res.ok) {
        const data = await res.json();
        setViewInvoiceItems(data.items || []);
      }
    } catch (err) {
      console.error("فشل تحميل أصناف الفاتورة", err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSaveEditInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInvoice || !editInvoice.id) return;

    try {
      const res = await authFetch(`/api/invoices/${editInvoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_supplier_name: editCustomerName,
          payment_source: editPaymentSource,
          paid: editPaid,
          remaining: editRemaining,
          user_name: currentUser?.name || "مدير النظام"
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "تعذر تعديل بيانات الفاتورة.");
      }

      setSuccessMsg(`تم تعديل بيانات الفاتورة رقم ${editInvoice.invoice_number} بنجاح.`);
      setEditInvoice(null);
      fetchStats();
    } catch (err: any) {
      alert(err.message || "خطأ أثناء حفظ التعديلات");
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deleteId) return;

    try {
      const res = await authFetch(`/api/invoices/${deleteId}?user_name=${encodeURIComponent(currentUser?.name || "")}&user_role=${encodeURIComponent(currentUser?.role || "")}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل تنفيذ عملية الحذف.");
      }

      setSuccessMsg(`تم حذف الفاتورة وإلغاؤها واستعادة الكميات للمخزن بنجاح.`);
      setDeleteId(null);
      fetchStats();
    } catch (err: any) {
      alert(err.message || "فشل إلغاء الفاتورة");
    }
  };

  const handleReturnInvoice = async () => {
    if (!returnInvoice || !returnInvoice.id) return;

    try {
      const payload: any = {
        user_name: currentUser?.name || "الكاشير",
        user_role: currentUser?.role || "cashier"
      };

      if (returnType === "partial") {
        const refund_items = Object.keys(returnQuantities)
          .map((idKey) => ({
            id: Number(idKey),
            qtyToReturn: returnQuantities[Number(idKey)]
          }))
          .filter((item) => item.qtyToReturn > 0);

        if (refund_items.length === 0) {
          alert("الرجاء تحديد كمية صنف واحد على الأقل لإجراء المرتجع الجزئي.");
          return;
        }
        payload.refund_items = refund_items;
      }

      const res = await authFetch(`/api/invoices/${returnInvoice.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "خطأ أثناء إجراء معاملة المرتجع.");
      }

      setSuccessMsg(`تم تسجيل مرتجع الفاتورة رقم ${returnInvoice.invoice_number} بنجاح.`);
      setReturnInvoice(null);
      fetchStats();
    } catch (err: any) {
      alert(err.message || "خطأ في تسجيل مرتجع الفاتورة");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center h-96 gap-4" id="dashboard-loading">
        <div className="w-8 h-8 border-2 border-[#222222] border-t-transparent animate-spin"></div>
        <p className="text-[#222222] text-xs font-bold">جاري تحميل لوحة التحكم المحاسبية...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-x-4 gap-y-2 bg-[#c3c6bb] border border-[#222222]" id="dashboard-error">
        <AlertTriangle size={32} className="text-[#222222]" />
        <h3 className="text-sm font-bold text-[#000000]">خطأ في الاتصال بالحسابات</h3>
        <p className="text-[#222222] text-xs font-bold max-w-md">{error || "تأكد من تشغيل الخادم والاتصال بقاعدة البيانات"}</p>
        <button
          onClick={fetchStats}
          className="h-9 px-6 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors cursor-pointer"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin";
  const canViewReports = isAdmin || currentUser?.permissions?.includes("reports");
  const canViewStats = isAdmin || currentUser?.permissions?.includes("dashboard_stats");
  const canViewPurchasesInvoices = isAdmin || currentUser?.permissions?.includes("view_purchases_invoices");
  const canEditInvoice = isAdmin || currentUser?.permissions?.includes("edit_invoice");
  const canDeleteInvoice = isAdmin || currentUser?.permissions?.includes("delete_invoice");
  const canReturnInvoice = isAdmin || currentUser?.permissions?.includes("return_invoice");

  const filteredInvoices = (stats.recentInvoices || []).filter((inv) => {
    if (inv.type === "purchases") return canViewPurchasesInvoices;
    return true;
  });

  return (
    <div className="w-full space-y-6 select-none font-sans" id="printable-dashboard" style={{ direction: "rtl" }}>
      
      {/* Page Header Bar */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" id="dashboard-heading">
        <div className="text-right">
          <h2 className="text-xl font-extrabold text-[#000000]">لوحة التحكم والمراقبة المحاسبية</h2>
          <p className="text-xs text-[#555555] font-semibold mt-1">المؤشرات المالية والسجلات الفورية للمتجر</p>
        </div>
        <button
          onClick={fetchStats}
          id="btn-refresh-dashboard"
          className="h-9 px-4 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] font-bold text-xs text-[#000000] transition-colors flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw size={16} strokeWidth={1.5} />
          <span>تحديث الشاشة</span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-3" id="dashboard-success-toast">
          <CheckCircle size={16} strokeWidth={1.5} className="text-[#000000] shrink-0" />
          <p className="font-bold text-right">{successMsg}</p>
        </div>
      )}

      {/* 12-COLUMN GRID SECTION */}
      {canViewStats ? (
        <div className="space-y-6" id="financial-statistics-section">
          
          {/* 12-COLUMN GRID: KPI Metrics */}
          <div className="grid grid-cols-12 gap-4" id="dashboard-kpis">
            
            {/* KPI Card 1 - success */}
            <div className="col-span-12 min-[420px]:col-span-6 lg:col-span-3 lux-glass p-0 border-0 flex flex-col justify-between overflow-hidden" id="kpi-sales" style={{borderTop: '3px solid var(--success)'}}>
              <div className="p-[1px] rounded-[16px] h-full" style={{background: 'var(--success)'}}>
                <div className="bg-[var(--bg-card)] rounded-[15px] p-4 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                    <span className="text-xs font-black flex items-center gap-1.5" style={{color: 'var(--success)'}}><span className="w-2 h-2 rounded-full" style={{background: 'var(--success)'}}></span>المبيعات الكلية</span>
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)]">٠١</span>
                  </div>
                  <div className="text-right mt-3">
                    <h3 className="text-2xl font-black" style={{color: 'var(--success)'}}>
                      {(stats.sales?.total || 0).toFixed(2)} <span className="text-xs font-bold text-[var(--text-secondary)]">ج.م</span>
                    </h3>
                    <span className="text-xs text-[var(--text-secondary)] font-semibold block mt-1">{stats.sales?.count || 0} فواتير مسجلة</span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Card 2 - danger */}
            <div className="col-span-12 min-[420px]:col-span-6 lg:col-span-3 lux-glass p-0 border-0 flex flex-col justify-between overflow-hidden" id="kpi-purchases" style={{borderTop: '3px solid var(--danger)'}}>
              <div className="p-[1px] rounded-[16px] h-full" style={{background: 'var(--danger)'}}>
                <div className="bg-[var(--bg-card)] rounded-[15px] p-4 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                    <span className="text-xs font-black flex items-center gap-1.5" style={{color: 'var(--danger)'}}><span className="w-2 h-2 rounded-full" style={{background: 'var(--danger)'}}></span>المشتريات الكلية</span>
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)]">٠٢</span>
                  </div>
                  <div className="text-right mt-3">
                    <h3 className="text-2xl font-black" style={{color: 'var(--danger)'}}>
                      {(stats.purchases?.total || 0).toFixed(2)} <span className="text-xs font-bold text-[var(--text-secondary)]">ج.م</span>
                    </h3>
                    <span className="text-xs text-[var(--text-secondary)] font-semibold block mt-1">{stats.purchases?.count || 0} فواتير توريد</span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Card 3 - accent */}
            <div className="col-span-12 min-[420px]:col-span-6 lg:col-span-3 lux-glass p-0 border-0 flex flex-col justify-between overflow-hidden" id="kpi-profits" style={{borderTop: '3px solid var(--accent)'}}>
              <div className="p-[1px] rounded-[16px] h-full" style={{background: 'var(--accent)'}}>
                <div className="bg-[var(--bg-card)] rounded-[15px] p-4 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                    <span className="text-xs font-black flex items-center gap-1.5" style={{color: 'var(--accent)'}}><span className="w-2 h-2 rounded-full" style={{background: 'var(--accent)'}}></span>صافي الأرباح</span>
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)]">٠٣</span>
                  </div>
                  <div className="text-right mt-3">
                    <h3 className="text-2xl font-black" style={{color: 'var(--accent)'}}>
                      {(stats.profit || 0).toFixed(2)} <span className="text-xs font-bold text-[var(--text-secondary)]">ج.م</span>
                    </h3>
                    <span className="text-xs text-[var(--text-secondary)] font-semibold block mt-1">المكسب الأسبوعي الفعلي</span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Card 4 - primary */}
            <div className="col-span-12 min-[420px]:col-span-6 lg:col-span-3 lux-glass p-0 border-0 flex flex-col justify-between overflow-hidden" id="kpi-drawer-cash" style={{borderTop: '3px solid var(--primary)'}}>
              <div className="p-[1px] rounded-[16px] h-full" style={{background: 'var(--primary)'}}>
                <div className="bg-[var(--bg-card)] rounded-[15px] p-4 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                    <span className="text-xs font-black flex items-center gap-1.5" style={{color: 'var(--primary)'}}><span className="w-2 h-2 rounded-full" style={{background: 'var(--primary)'}}></span>نقدية الدرج</span>
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)]">٠٤</span>
                  </div>
                  <div className="text-right mt-3">
                    <h3 className="text-2xl font-black" style={{color: 'var(--primary)'}}>
                      {(stats.drawerBalance || 0).toFixed(2)} <span className="text-xs font-bold text-[var(--text-secondary)]">ج.م</span>
                    </h3>
                    <span className="text-xs text-[var(--text-secondary)] font-semibold block mt-1">السيولة بختام الوردية</span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Card 5 - tamween */}
            <div className="col-span-12 min-[420px]:col-span-6 lg:col-span-3 lux-glass p-0 border-0 flex flex-col justify-between overflow-hidden" id="kpi-tamween" style={{borderTop: '3px solid #f59e0b'}}>
              <div className="p-[1px] rounded-[16px] h-full" style={{background: '#f59e0b'}}>
                <div className="bg-[var(--bg-card)] rounded-[15px] p-4 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                    <span className="text-xs font-black flex items-center gap-1.5" style={{color: '#f59e0b'}}><span className="w-2 h-2 rounded-full" style={{background: '#f59e0b'}}></span>المنظومة التموينية</span>
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)]">٠٥</span>
                  </div>
                  <div className="text-right mt-3 space-y-1">
                    <h3 className="text-xl font-black" style={{color: '#f59e0b'}}>
                      {(stats.tamween?.discount || 0).toFixed(2)} <span className="text-xs font-bold text-[var(--text-secondary)]">ج.م</span>
                    </h3>
                    <span className="text-xs text-[var(--text-secondary)] font-semibold block">{stats.tamween?.cardsUsed || 0} بطاقة مصروفة</span>
                    <span className="text-xs text-[var(--text-secondary)] font-semibold block">استعاضات: {(stats.tamween?.replacements || 0).toFixed(2)} ج.م</span>
                    <span className="text-xs font-bold block" style={{color: (stats.tamween?.netOwed || 0) > 0 ? '#ef4444' : '#22c55e'}}>
                      صافي:{(stats.tamween?.netOwed || 0) > 0 ? ' لسه مدينهولك' : ' الشركة مديالك'} {Math.abs(stats.tamween?.netOwed || 0).toFixed(2)} ج.م
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* 12-COLUMN GRID: Chart & Top Selling Products */}
          <div className="grid grid-cols-12 gap-4" id="dashboard-analytics-section">
            
            {/* Chart (Col 8) */}
            <div className="col-span-12 lg:col-span-8 bg-[#c3c6bb] p-4 border border-[#888888] flex flex-col justify-between" id="analytics-chart-container">
              <div className="flex justify-between items-center border-b border-[#888888] pb-3 mb-3">
                <div className="text-right">
                  <h3 className="text-sm font-extrabold text-[#000000]">التدفق المالي الأسبوعي</h3>
                  <p className="text-xs text-[#555555] font-semibold mt-0.5">مقارنة حركة مبيعات ومشتريات المتجر</p>
                </div>
                <div className="flex gap-x-4 gap-y-2 text-xs font-bold text-[#222222]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#222222] inline-block"></span> مبيعات</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#666666] inline-block"></span> مشتريات</span>
                </div>
              </div>

              <div className="w-full h-60" id="custom-recharts-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.graphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="1 1" vertical={false} stroke="#888888" />
                    <XAxis dataKey="label" axisLine={true} tickLine={false} tick={{ fill: '#222222', fontSize: 11, fontWeight: 'bold' }} dy={5} />
                    <YAxis axisLine={true} tickLine={false} tick={{ fill: '#222222', fontSize: 11 }} />
                    <RechartsTooltip 
                      cursor={{fill: '#b8bcb2'}}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const salesP = payload.find(p => p.dataKey === 'sales');
                          const purchasesP = payload.find(p => p.dataKey === 'purchases');
                          const dataPoint = stats.graphData.find(d => d.label === label);
                          
                          return (
                            <div className="bg-[#c3c6bb] text-[#000000] p-3 border border-[#222222] text-xs font-sans space-y-1 text-right" style={{direction: "rtl"}}>
                              <p className="font-bold border-b border-[#888888] pb-1">{dataPoint?.date || label}</p>
                              {salesP && <div className="flex justify-between gap-4"><span>المبيعات:</span> <span className="font-bold">{Number(salesP.value).toFixed(2)} ج.م</span></div>}
                              {purchasesP && <div className="flex justify-between gap-4"><span>المشتريات:</span> <span className="font-bold">{Number(purchasesP.value).toFixed(2)} ج.م</span></div>}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="sales" name="المبيعات" fill="#222222" maxBarSize={32} />
                    <Bar dataKey="purchases" name="المشتريات" fill="#666666" maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Products (Col 4) */}
            <div className="col-span-12 lg:col-span-4 bg-[#c3c6bb] p-4 border border-[#888888] flex flex-col justify-between" id="top-selling-products">
              <div>
                <div className="border-b border-[#888888] pb-3 mb-3">
                  <h3 className="text-sm font-extrabold text-[#000000] flex items-center gap-2">
                    <ShoppingBag size={16} strokeWidth={1.5} />
                    <span>الأصناف الأكثر مبيعاً</span>
                  </h3>
                </div>

                {stats.topSelling && stats.topSelling.length > 0 ? (
                  <div className="space-y-2" id="top-selling-list">
                    {stats.topSelling.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2.5 bg-[#b8bcb2] border border-[#888888] text-xs">
                        <div className="text-right min-w-0 pr-1">
                          <p className="font-bold text-[#000000] truncate">{p.name}</p>
                          <span className="text-xs text-[#555555] font-mono block">{p.barcode}</span>
                        </div>
                        <div className="text-left shrink-0 pl-1">
                          <p className="font-bold text-[#000000]">{p.total_sales.toFixed(2)} ج.م</p>
                          <p className="text-xs text-[#555555]">{p.total_qty} {p.unit}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-36 flex flex-col items-center justify-center text-center text-[#555555] text-xs font-bold">
                    لا توجد بيانات مبيعات مسجلة
                  </div>
                )}
              </div>

              { (isAdmin || currentUser?.permissions?.includes("sales")) && (
                <button
                  id="btn-nav-cashier"
                  onClick={() => onNavigateToTab("sales")}
                  className="w-full mt-4 h-9 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center justify-center gap-x-4 gap-y-2 cursor-pointer"
                >
                  <ArrowUpLeft size={16} strokeWidth={1.5} />
                  <span>الذهاب لنقطة البيع الكاشير</span>
                </button>
              )}
            </div>

          </div>
        </div>
      ) : (
        <div className="bg-[#c3c6bb] p-8 border border-[#222222] text-center space-y-3" id="dashboard-security-placeholder">
          <div className="w-10 h-10 bg-[#222222] text-[#c3c6bb] flex items-center justify-center mx-auto">
            <Lock size={16} strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-bold text-[#000000]">حماية البيانات المالية</h3>
          <p className="text-xs text-[#555555] max-w-lg mx-auto leading-relaxed">
            تم إخفاء مؤشرات الأرباح والشارتات المالية تلقائياً بناءً على صلاحيات الحساب.
          </p>
        </div>
      )}

      {/* RECENT INVOICES REGISTER TABLE */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] space-y-4" id="recent-invoices-dashboard">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-x-4 gap-y-2 pb-2 border-b border-[#888888]">
          <div className="text-right">
            <h3 className="text-sm font-extrabold text-[#000000] flex items-center gap-2">
              <Receipt size={16} strokeWidth={1.5} />
              <span>آخر الفواتير والمردودات المسجلة</span>
            </h3>
          </div>
          {canViewReports && (
            <button
              id="btn-all-reports-bottom"
              onClick={() => onNavigateToTab("reports")}
              className="text-xs font-bold text-[#222222] hover:text-[#000000] transition-colors text-right"
            >
              عرض أرشيف الفواتير الكامل &larr;
            </button>
          )}
        </div>

        <div className="overflow-x-auto border border-[#888888]" id="recent-invoices-table">
          <table className="w-full text-right text-xs min-w-[850px]">
            <thead>
              <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-9">
                <th className="py-2 px-3 font-bold">رقم الفاتورة</th>
                <th className="py-2 px-3 font-bold">المنشئ</th>
                <th className="py-2 px-3 font-bold">النوع</th>
                <th className="py-2 px-3 font-bold">الجهة</th>
                <th className="py-2 px-3 font-bold">المصدر المالي</th>
                <th className="py-2 px-3 font-bold text-left">قيمة الفاتورة</th>
                <th className="py-2 px-3 font-bold text-center">الحالة</th>
                <th className="py-2 px-3 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#b8bcb2] transition-colors">
                    <td className="py-2.5 px-3 font-mono">{inv.invoice_number}</td>
                    <td className="py-2.5 px-3">{inv.created_by || "الكاشير"}</td>
                    <td className="py-2.5 px-3">
                      <span className="bg-[#222222] text-[#c3c6bb] px-2 py-0.5 text-xs font-bold">
                        {inv.type === "sales" ? "مبيعات" : "مشتريات"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 truncate max-w-[140px]">{inv.customer_supplier_name}</td>
                    <td className="py-2.5 px-3">
                      {inv.payment_source === "cash_register" ? "درج الكاشير" : "الخزنة الرئيسية"}
                    </td>
                    <td className="py-2.5 px-3 text-left font-black">{inv.total.toFixed(2)} ج.م</td>
                    <td className="py-2.5 px-3 text-center">
                      {inv.status === "returned" ? (
                        <span className="text-xs font-bold text-[#555555]">مرتجع</span>
                      ) : (
                        <span className="text-xs font-bold text-[#000000]">نشط</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        
                        <button
                          id={`btn-view-inv-${inv.id}`}
                          onClick={() => handleViewInvoice(inv)}
                          className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] transition-colors cursor-pointer"
                          title="عرض أصناف الفاتورة"
                        >
                          <Eye size={14} strokeWidth={1.5} />
                        </button>

                        {canEditInvoice ? (
                          <button
                            id={`btn-edit-inv-${inv.id}`}
                            onClick={() => {
                              setEditInvoice(inv);
                              setEditCustomerName(inv.customer_supplier_name);
                              setEditPaymentSource(inv.payment_source);
                              setEditPaid(inv.paid);
                              setEditRemaining(inv.remaining);
                            }}
                            className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] transition-colors cursor-pointer"
                            title="تعديل الفاتورة"
                          >
                            <Edit size={14} strokeWidth={1.5} />
                          </button>
                        ) : (
                          <span className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] text-[#888888] border border-[#888888] cursor-not-allowed">
                            <Lock size={14} strokeWidth={1.5} />
                          </span>
                        )}

                        {canReturnInvoice ? (
                          <button
                            id={`btn-return-inv-${inv.id}`}
                            onClick={() => setReturnInvoice(inv)}
                            disabled={inv.status === "returned"}
                            className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] transition-colors cursor-pointer disabled:opacity-30"
                            title="مرتجع الفاتورة"
                          >
                            <RotateCcw size={14} strokeWidth={1.5} />
                          </button>
                        ) : (
                          <span className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] text-[#888888] border border-[#888888] cursor-not-allowed">
                            <Lock size={14} strokeWidth={1.5} />
                          </span>
                        )}

                        {canDeleteInvoice && inv.type === 'purchases' ? (
                          <button
                            id={`btn-delete-inv-${inv.id}`}
                            onClick={() => {
                              setDeleteId(inv.id || null);
                              setDeleteInvoiceNumber(inv.invoice_number);
                            }}
                            className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] transition-colors cursor-pointer"
                            title="حذف الفاتورة"
                          >
                            <Trash2 size={14} strokeWidth={1.5} />
                          </button>
                        ) : (
                          <span className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] text-[#888888] border border-[#888888] cursor-not-allowed">
                            <Lock size={14} strokeWidth={1.5} />
                          </span>
                        )}

                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#555555] font-bold">
                    لا توجد فواتير مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW RECEIPT MODAL */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50" id="modal-invoice-receipt">
          <div className="bg-[#c3c6bb] max-w-lg w-full p-6 border border-[#222222] relative space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-[#888888] pb-3 shrink-0">
              <div className="text-right">
                <h4 className="text-sm font-extrabold text-[#000000]">سند رقم: {viewInvoice.invoice_number}</h4>
                <p className="text-xs text-[#555555] font-mono">التاريخ: {viewInvoice.date}</p>
              </div>
              <button
                onClick={() => setViewInvoice(null)}
                className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-2 bg-[#b8bcb2] p-3 border border-[#888888] text-right">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 font-bold">
                <div><span className="text-[#555555]">منشئ السند:</span> <span className="text-[#000000]">{viewInvoice.created_by || "الكاشير"}</span></div>
                <div><span className="text-[#555555]">طريقة الدفع:</span> <span className="text-[#000000]">{viewInvoice.payment_source === "cash_register" ? "درج الكاشير" : "الخزنة الرئيسية"}</span></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-[#888888] font-bold">
                <div><span className="text-[#555555]">النوع:</span> <span className="text-[#000000]">{viewInvoice.type === "sales" ? "مبيعات" : "مشتريات"}</span></div>
                <div><span className="text-[#555555]">الجهة:</span> <span className="text-[#000000]">{viewInvoice.customer_supplier_name}</span></div>
              </div>
            </div>

            <div className="space-y-2 flex-1 min-h-0 flex flex-col">
              <p className="text-xs font-bold text-[#000000] text-right shrink-0">قائمة الأصناف:</p>
              {loadingItems ? (
                <div className="py-6 text-center text-[#555555] text-xs font-bold">جاري تحميل أصناف الفاتورة...</div>
              ) : viewInvoiceItems.length > 0 ? (
                <div className="flex-1 overflow-y-auto min-h-[100px] border border-[#888888] divide-y divide-[#888888]/40 text-right text-xs">
                  {viewInvoiceItems.map((item, id) => (
                    <div key={id} className="p-2.5 flex justify-between items-center bg-[#c3c6bb]">
                      <div>
                        <p className="font-bold text-[#000000]">{item.name}</p>
                        <p className="text-xs text-[#555555] font-mono">{item.barcode}</p>
                      </div>
                      <div className="text-left font-bold text-[#000000]">
                        <p className="text-xs text-[#555555]">{item.quantity} {item.unit} &times; {item.price.toFixed(2)} ج.م</p>
                        <p className="text-[#000000]">{item.total.toFixed(2)} ج.م</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-6 text-[#555555] text-xs font-bold">لا توجد أصناف في هذا السند</p>
              )}
            </div>

            <div className="border-t border-[#888888] pt-3 text-xs space-y-1 text-right shrink-0 font-bold">
              <div className="flex justify-between">
                <span className="text-[#555555]">المجموع الفرعي:</span>
                <span className="text-[#000000]">{viewInvoice.subtotal?.toFixed(2) || viewInvoice.total.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between font-black text-sm border-t border-[#888888] pt-1 text-[#000000]">
                <span>المبلغ الإجمالي:</span>
                <span>{viewInvoice.total.toFixed(2)} ج.م</span>
              </div>
            </div>

            <button
              onClick={() => setViewInvoice(null)}
              className="w-full h-9 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors cursor-pointer text-center shrink-0"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      )}

      {/* EDIT INVOICE MODAL */}
      {editInvoice && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50" id="modal-edit-invoice">
          <form onSubmit={handleSaveEditInvoice} className="bg-[#c3c6bb] max-w-md w-full p-6 border border-[#222222] relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#888888] pb-3">
              <h4 className="text-sm font-extrabold text-[#000000] flex items-center gap-2">
                <Edit size={16} />
                <span>تعديل بيانات الفاتورة: {editInvoice.invoice_number}</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditInvoice(null)}
                className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-right text-xs font-bold">
              <div>
                <label className="block text-[#000000] mb-1">اسم العميل / الجهة الموردة:</label>
                <input
                  type="text"
                  required
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                />
              </div>

              <div>
                <label className="block text-[#000000] mb-1">المصدر والوعاء المالي للفاتورة:</label>
                <select
                  value={editPaymentSource}
                  onChange={(e: any) => setEditPaymentSource(e.target.value)}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                >
                  <option value="cash_register">درج الكاشير الحالي</option>
                  <option value="main_safe">الخزينة الرئيسية</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <label className="block text-[#000000] mb-1">المبلغ المدفوع (ج.م):</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPaid}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEditPaid(val);
                      setEditRemaining(Math.max(0, editInvoice.total - val));
                    }}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-center font-bold text-xs text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                  <div className="flex gap-1 mt-1">
                    <button type="button" onClick={() => { setEditPaid(editInvoice.total); setEditRemaining(0); }} className="flex-1 py-1 bg-[#c3c6bb] hover:bg-[#888888] text-[#000000] text-[10px] font-bold border border-[#888888] transition-colors cursor-pointer">كامل المبلغ</button>
                    <button type="button" onClick={() => { setEditPaid(50); setEditRemaining(Math.max(0, editInvoice.total - 50)); }} className="flex-1 py-1 bg-[#c3c6bb] hover:bg-[#888888] text-[#000000] text-[10px] font-bold border border-[#888888] transition-colors cursor-pointer">50</button>
                    <button type="button" onClick={() => { setEditPaid(100); setEditRemaining(Math.max(0, editInvoice.total - 100)); }} className="flex-1 py-1 bg-[#c3c6bb] hover:bg-[#888888] text-[#000000] text-[10px] font-bold border border-[#888888] transition-colors cursor-pointer">100</button>
                    <button type="button" onClick={() => { setEditPaid(200); setEditRemaining(Math.max(0, editInvoice.total - 200)); }} className="flex-1 py-1 bg-[#c3c6bb] hover:bg-[#888888] text-[#000000] text-[10px] font-bold border border-[#888888] transition-colors cursor-pointer">200</button>
                  </div>
                </div>
                <div>
                  <label className="block text-[#000000] mb-1">المبلغ المتبقي:</label>
                  <input
                    type="number"
                    disabled
                    value={editRemaining.toFixed(2)}
                    className="w-full h-9 bg-[#b8bcb2]/60 border border-[#888888] px-3 text-center font-bold text-xs text-[#000000]"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-x-4 gap-y-2 pt-2">
              <button
                type="submit"
                id="btn-confirm-edit-invoice-modal"
                className="flex-1 h-9 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors cursor-pointer text-center"
              >
                حفظ التعديلات
              </button>
              <button
                type="button"
                onClick={() => setEditInvoice(null)}
                className="flex-1 h-9 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] text-[#000000] font-bold text-xs transition-colors cursor-pointer text-center"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteId && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50" id="modal-delete-confirm">
          <div className="bg-[#c3c6bb] max-w-sm w-full p-6 border border-[#222222] space-y-4 text-center">
            <div className="w-10 h-10 bg-[#222222] text-[#c3c6bb] flex items-center justify-center mx-auto">
              <Trash2 size={18} />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-[#000000]">تأكيد حذف الفاتورة ({deleteInvoiceNumber})</h4>
              <p className="text-xs text-[#555555] font-semibold">
                سيتم استرجاع كميات البضائع للمخزن وتوثيق العملية.
              </p>
            </div>

            <div className="flex gap-x-4 gap-y-2 pt-2">
              <button
                onClick={handleDeleteInvoice}
                id="btn-confirm-delete-action"
                className="flex-1 h-9 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors cursor-pointer"
              >
                تأكيد الحذف
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 h-9 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] text-[#000000] font-bold text-xs transition-colors cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN CONFIRM MODAL */}
      {returnInvoice && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50" id="modal-return-confirm" style={{ direction: "rtl" }}>
          <div className="bg-[#c3c6bb] max-w-lg w-full p-6 border border-[#222222] space-y-4 text-center max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-10 bg-[#222222] text-[#c3c6bb] flex items-center justify-center mx-auto">
              <RotateCcw size={18} />
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-extrabold text-[#000000]">معالجة مرتجع الفاتورة ({returnInvoice.invoice_number})</h4>
              
              <div className="flex border border-[#888888] bg-[#b8bcb2] p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setReturnType("partial")}
                  className={`flex-1 h-8 text-xs font-bold transition-all ${
                    returnType === "partial" ? "bg-[#222222] text-[#c3c6bb]" : "text-[#222222] hover:bg-[#c3c6bb]"
                  }`}
                >
                  مرتجع جزئي
                </button>
                <button
                  type="button"
                  onClick={() => setReturnType("full")}
                  className={`flex-1 h-8 text-xs font-bold transition-all ${
                    returnType === "full" ? "bg-[#222222] text-[#c3c6bb]" : "text-[#222222] hover:bg-[#c3c6bb]"
                  }`}
                >
                  مرتجع كلي
                </button>
              </div>
            </div>

            {returnType === "partial" ? (
              <div className="space-y-2 text-right">
                <p className="text-xs text-[#555555] font-semibold">
                  حدد كميات المواد المراد إرجاعها للمخزن.
                </p>

                {loadingReturnDetails ? (
                  <div className="text-center py-4 text-xs text-[#555555] font-bold">
                    جاري تحميل تفاصيل الأصناف...
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-[#888888] p-3 bg-[#b8bcb2]">
                    {returnInvoiceDetails?.items && returnInvoiceDetails.items.length > 0 ? (
                      returnInvoiceDetails.items.map((item: any) => {
                        const remaining = item.quantity - (item.returned_quantity || 0);
                        return (
                          <div key={item.id} className="flex justify-between items-center border-b border-[#888888]/40 pb-2 last:border-0 last:pb-0">
                            <div>
                              <p className="text-xs font-bold text-[#000000]">{item.name}</p>
                              <p className="text-xs text-[#555555]">
                                الكمية: {item.quantity} {item.unit}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {remaining > 0 ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={(returnQuantities[item.id] || 0) <= 0}
                                    onClick={() =>
                                      setReturnQuantities({
                                        ...returnQuantities,
                                        [item.id]: Math.max(0, (returnQuantities[item.id] || 0) - 1)
                                      })
                                    }
                                    className="w-6 h-6 bg-[#c3c6bb] border border-[#888888] text-[#000000] font-bold text-xs flex items-center justify-center cursor-pointer disabled:opacity-30"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-bold w-6 text-center text-[#000000]">
                                    {returnQuantities[item.id] || 0}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={(returnQuantities[item.id] || 0) >= remaining}
                                    onClick={() =>
                                      setReturnQuantities({
                                        ...returnQuantities,
                                        [item.id]: Math.min(remaining, (returnQuantities[item.id] || 0) + 1)
                                      })
                                    }
                                    className="w-6 h-6 bg-[#c3c6bb] border border-[#888888] text-[#000000] font-bold text-xs flex items-center justify-center cursor-pointer disabled:opacity-30"
                                  >
                                    +
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs text-[#555555] font-bold">
                                  تم الإرجاع بالكامل
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center py-2 text-xs text-[#555555] font-bold">لا توجد أصناف في هذه الفاتورة</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1 text-right text-xs font-bold">
                <p className="text-xs text-[#555555]">
                  سيتم إلغاء الفاتورة بالكامل بقيمة <span className="text-[#000000]">{returnInvoice.total.toFixed(2)} ج.م</span>.
                </p>
              </div>
            )}

            <div className="flex gap-x-4 gap-y-2 pt-2">
              <button
                onClick={handleReturnInvoice}
                id="btn-confirm-return-action"
                className="flex-1 h-9 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors cursor-pointer"
              >
                تأكيد المرتجع
              </button>
              <button
                onClick={() => setReturnInvoice(null)}
                className="flex-1 h-9 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] text-[#000000] font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
