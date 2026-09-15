import React, { useEffect, useState } from "react";
import {
  ClipboardList,
  Search,
  RefreshCw,
  AlertTriangle,
  Clock,
  HardDrive
} from "lucide-react";
import { ActivityLog, User } from "../types";
import { authFetch } from "../authFetch";

interface LogsProps {
  currentUser?: User | null;
}

export default function Logs({ currentUser }: LogsProps = {}) {
  const [logsList, setLogsList] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "sales_purchases" | "items_pricing" | "employees_auth" | "partners_expenses">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const fetchLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/logs");
      if (!response.ok) throw new Error("فشلت الشبكة في جلب سجل العمليات.");
      const data = await response.json();
      setLogsList(data);
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const canView = currentUser?.role === "admin" || currentUser?.permissions?.includes("reports");

  if (!canView) {
    return (
      <div className="w-full p-6 flex flex-col items-center justify-center text-right select-none font-sans" id="logs-unauthorized" style={{ direction: "rtl" }}>
        <div className="bg-[#c3c6bb] p-6 border border-[#222222] text-center max-w-md space-y-3">
          <AlertTriangle size={24} strokeWidth={1.5} className="mx-auto text-[#222222]" />
          <h3 className="text-sm font-black text-[#000000]">صلاحية الوصول غير متاحة</h3>
          <p className="text-xs text-[#555555] font-semibold leading-relaxed">
            عذراً، صلاحيات الحساب الحالي لا تسمح بالاطلاع على سجل العمليات.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeCategory]);

  const matchesCategory = (log: ActivityLog) => {
    if (activeCategory === "all") return true;
    
    const act = log.action.toLowerCase();
    const det = log.details.toLowerCase();

    if (activeCategory === "sales_purchases") {
      return act.includes("فاتورة") || act.includes("بيع") || act.includes("شراء") || act.includes("مرتجع") || det.includes("فاتورة") || det.includes("مرتجع");
    }
    if (activeCategory === "items_pricing") {
      return act.includes("صنف") || act.includes("تعديل صنف") || act.includes("إضافة صنف") || act.includes("حذف صنف") || act.includes("سعر") || det.includes("سعر");
    }
    if (activeCategory === "employees_auth") {
      return act.includes("دخول") || act.includes("مستخدم") || act.includes("خروج") || act.includes("تسجيل") || det.includes("كلمة المرور") || act.includes("تعديل بيانات المستخدم");
    }
    if (activeCategory === "partners_expenses") {
      return act.includes("شريك") || act.includes("مصروف") || act.includes("قيد") || act.includes("بند") || det.includes("شريك") || det.includes("مصروف");
    }
    return true;
  };

  const filteredLogs = logsList.filter(
    (log) =>
      matchesCategory(log) && (
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.details.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  const parseChangesToBadges = (details: string) => {
    if (!details) return null;

    if (details.includes("|")) {
      const parts = details.split("|");
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
          {parts.map((p, idx) => {
            const cleanP = p.trim().replace(/^\[|\]$/g, "");
            return (
              <span key={idx} className="bg-[#b8bcb2] text-[#000000] text-xs font-bold px-2 py-0.5 border border-[#888888]/60">
                {cleanP}
              </span>
            );
          })}
        </div>
      );
    }

    if (details.includes("->") || details.includes("إلى")) {
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
          <span className="bg-[#b8bcb2] text-[#000000] text-xs font-bold px-2 py-0.5 border border-[#888888]/60">
            {details}
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full space-y-6 select-none font-sans" id="logs-view" style={{ direction: "rtl" }}>
      
      {/* Header */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#000000] flex items-center gap-2">
            <ClipboardList size={20} strokeWidth={1.5} />
            <span>سجل العمليات وحركات النظام</span>
          </h2>
          <p className="text-xs text-[#555555] font-semibold mt-1">تتبع التغييرات والسجلات الزمنية لكافة المستخدمين</p>
        </div>

        <button
          id="btn-refresh-logs-api"
          onClick={fetchLogs}
          className="h-9 px-3 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw size={16} strokeWidth={1.5} />
          <span>تحديث السجل</span>
        </button>
      </div>

      {error && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="logs-error">
          <AlertTriangle size={16} strokeWidth={1.5} className="text-[#222222] shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] space-y-4" id="logs-filters-panel">
        <div className="relative">
          <input
            id="logs-search-input-instant"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث باسم الموظف أو نوع العملية أو تفاصيل الحركة..."
            className="w-full h-9 bg-[#b8bcb2] border border-[#888888] pr-9 pl-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#555555]">
            <Search size={16} strokeWidth={1.5} />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 border text-xs font-bold transition-colors cursor-pointer ${
              activeCategory === "all"
                ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                : "bg-[#b8bcb2] text-[#000000] border-[#888888]"
            }`}
          >
            الكل ({logsList.length})
          </button>
          <button
            onClick={() => setActiveCategory("sales_purchases")}
            className={`px-3 py-1.5 border text-xs font-bold transition-colors cursor-pointer ${
              activeCategory === "sales_purchases"
                ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                : "bg-[#b8bcb2] text-[#000000] border-[#888888]"
            }`}
          >
            الفواتير والمبيعات ({logsList.filter(l => { const a=l.action.toLowerCase(); const d=l.details.toLowerCase(); return a.includes("فاتورة")||a.includes("بيع")||a.includes("شراء")||a.includes("مرتجع")||d.includes("فاتورة")||d.includes("مرتجع"); }).length})
          </button>
          <button
            onClick={() => setActiveCategory("items_pricing")}
            className={`px-3 py-1.5 border text-xs font-bold transition-colors cursor-pointer ${
              activeCategory === "items_pricing"
                ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                : "bg-[#b8bcb2] text-[#000000] border-[#888888]"
            }`}
          >
            الأصناف والمخزن ({logsList.filter(l => { const a=l.action.toLowerCase(); return a.includes("صنف")||a.includes("سعر"); }).length})
          </button>
          <button
            onClick={() => setActiveCategory("employees_auth")}
            className={`px-3 py-1.5 border text-xs font-bold transition-colors cursor-pointer ${
              activeCategory === "employees_auth"
                ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                : "bg-[#b8bcb2] text-[#000000] border-[#888888]"
            }`}
          >
            المستخدمون والحسابات ({logsList.filter(l => { const a=l.action.toLowerCase(); const d=l.details.toLowerCase(); return a.includes("دخول")||a.includes("مستخدم")||a.includes("خروج")||a.includes("تسجيل")||d.includes("كلمة المرور"); }).length})
          </button>
          <button
            onClick={() => setActiveCategory("partners_expenses")}
            className={`px-3 py-1.5 border text-xs font-bold transition-colors cursor-pointer ${
              activeCategory === "partners_expenses"
                ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                : "bg-[#b8bcb2] text-[#000000] border-[#888888]"
            }`}
          >
            الشركاء والمصروفات ({logsList.filter(l => { const a=l.action.toLowerCase(); const d=l.details.toLowerCase(); return a.includes("شريك")||a.includes("مصروف")||a.includes("قيد")||d.includes("شريك")||d.includes("مصروف"); }).length})
          </button>
        </div>
      </div>

      {/* Log timeline */}
      {loading ? (
        <div className="p-12 text-center text-[#555555] bg-[#c3c6bb] border border-[#222222] font-bold text-xs">
          جاري تحميل السجلات...
        </div>
      ) : paginatedLogs.length > 0 ? (
        <div className="bg-[#c3c6bb] border border-[#222222] p-4 space-y-4" id="logs-timeline-container">
          <div className="space-y-2" id="logs-interactive-list">
            {paginatedLogs.map((log) => {
              const dateObj = new Date(log.timestamp);
              const dateStr = dateObj.toLocaleDateString("ar-EG");
              const timeStr = dateObj.toLocaleTimeString("ar-EG", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
              });

              return (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-x-4 gap-y-2 bg-[#b8bcb2] p-3 border border-[#888888] text-right"
                  id={`log-trail-${log.id}`}
                >
                  <div className="space-y-1 font-bold text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-[#222222] text-[#c3c6bb] px-2 py-0.5 text-xs font-bold">
                        {log.action}
                      </span>
                      <span className="text-xs text-[#555555] font-mono flex items-center gap-1">
                        <Clock size={12} strokeWidth={1.5} />
                        <span>{dateStr} - {timeStr}</span>
                      </span>
                    </div>
                    
                    <p className="text-xs text-[#000000] leading-relaxed mt-1">{log.details}</p>
                    {parseChangesToBadges(log.details)}
                  </div>

                  <div className="shrink-0 text-xs font-bold text-[#000000]">
                    <span className="bg-[#c3c6bb] px-2.5 py-1 border border-[#888888]">المستخدم: {log.user}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-[#b8bcb2] p-3 border border-[#888888] text-xs font-bold" id="logs-pagination-toolbar">
              <button
                id="btn-logs-page-prev"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 px-3 bg-[#c3c6bb] border border-[#222222] font-bold text-[#000000] hover:bg-[#222222] hover:text-[#c3c6bb] transition-colors cursor-pointer disabled:opacity-40"
              >
                السابقة
              </button>
              <span className="text-[#000000] text-xs font-bold">
                صفحة {currentPage} من {totalPages} ({filteredLogs.length} سجل)
              </span>
              <button
                id="btn-logs-page-next"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 px-3 bg-[#c3c6bb] border border-[#222222] font-bold text-[#000000] hover:bg-[#222222] hover:text-[#c3c6bb] transition-colors cursor-pointer disabled:opacity-40"
              >
                التالية
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#c3c6bb] p-12 text-center text-[#000000] border border-[#222222]" id="logs-empty-view">
          <HardDrive size={32} strokeWidth={1.5} className="mx-auto mb-2 text-[#222222]" />
          <p className="text-xs font-bold">لا توجد سجلات مطابقة.</p>
        </div>
      )}
    </div>
  );
}
