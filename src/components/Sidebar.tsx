import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingDown,
  Package,
  Truck,
  BarChart3,
  Users,
  ClipboardList,
  LogOut,
  Settings, Banknote,
  ClipboardCheck,
  Cpu,
  Terminal,
  FileText,
  CreditCard,
  Wallet,
  LockKeyhole
} from "lucide-react";
import { User } from "../types";
import ThemeSwitcher from "./ThemeSwitcher";
import { authFetch } from "../authFetch";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User | null;
  onLogout: () => void;
}

// ألوان متدرجة لكل قسم
const tabColors: Record<string, string> = {
  dashboard: "from-slate-700 to-slate-900",
  sales: "from-emerald-500 to-teal-700",
  purchases: "from-orange-500 to-red-600",
  invoices_register: "from-blue-500 to-indigo-600",
  accounts: "from-emerald-600 to-green-800",
  items: "from-violet-500 to-purple-700",
  inventory_audit: "from-amber-500 to-orange-600",
  suppliers: "from-pink-500 to-rose-700",
  reports: "from-cyan-500 to-blue-600",
  users: "from-indigo-500 to-blue-700",
  logs: "from-gray-500 to-slate-700",
  settings: "from-slate-600 to-gray-800",
  treasury: "from-yellow-500 to-amber-700",
  drawer_close: "from-lime-600 to-emerald-800",
  developer: "from-red-600 to-rose-800",
  tamween: "from-teal-500 to-cyan-600",
};

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout
}: SidebarProps) {
  const [marketName, setMarketName] = useState("منظومة الكابتن");

  useEffect(() => {
    authFetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.market_name) {
          setMarketName(data.market_name);
        }
      })
      .catch(() => {});
  }, [activeTab]);

  if (!currentUser) return null;

  const tabs = [
    { id: "dashboard", label: "الشاشة الرئيسية", description: "لوحة الإحصائيات والنشاط", icon: LayoutDashboard, permission: null },
    { id: "sales", label: "لوحة الكاشير", description: "إصدار فواتير المبيعات", icon: ShoppingCart, permission: "sales" },
    { id: "tamween", label: "المنظومة التموينية", description: "عملاء و	report و استعاضات", icon: CreditCard, permission: "reports" },
    { id: "accounts", label: "الديون", description: "ديون الزبائن والموردين والكروت", icon: Wallet, permission: "accounts" },
    { id: "suppliers", label: "سجل الموردين", description: "قائمة الموردين", icon: Truck, permission: "suppliers" },
    { id: "items", label: "إدارة الأصناف", description: "إضافة وتعديل الأصناف", icon: Package, permission: "items" },
    { id: "purchases", label: "فاتورة مشتريات", description: "تسجيل فواتير المشتريات", icon: TrendingDown, permission: "purchases" },
    { id: "invoices_register", label: "سجل الفواتير", description: "عرض جميع الفواتير", icon: FileText, permission: "reports" },
    { id: "logs", label: "سجل العمليات", description: "سجل النشاط والتغييرات", icon: ClipboardList, permission: "reports" },
    { id: "reports", label: "التقارير المحاسبية", description: "تقارير مالية ومحاسبية", icon: BarChart3, permission: "reports" },
    { id: "treasury", label: "اللوحة المالية", description: "الخزينة والحسابات", icon: Banknote, permission: "admin" },
    { id: "drawer_close", label: "تقفيل اليومية", description: "عدّ فلوس الدرج ومقارنة المتوقع", icon: LockKeyhole, permission: "drawer" },
    { id: "inventory_audit", label: "جرد المخزن الكلي", description: "جرد شامل للمخزون", icon: ClipboardCheck, permission: "items" },
    { id: "users", label: "إدارة المستخدمين", description: "إدارة حسابات النظام", icon: Users, permission: "users" },
    { id: "settings", label: "إعدادات النظام", description: "ضبط إعدادات النظام", icon: Settings, permission: "admin" },
    { id: "developer", label: "لوحة تحكم المبرمج", description: "أدوات المبرمج", icon: Terminal, permission: "developer" }
  ];

  // Filter tabs by user permissions (developer and admin get full access)
  const allowedTabs = tabs.filter((tab) => {
    if (currentUser.role === "developer") return true;
    if (tab.permission === "developer") return false;
    if (tab.permission === null) return true;
    if (currentUser.role === "admin") return true;
    if (tab.permission === "admin") return false;
    return currentUser.permissions?.includes(tab.permission);
  });

  const sectionsTabs = allowedTabs;

  return (
    <>
      {/* Top Bar - شريط علوي فقط */}
      <div className="flex flex-col h-full bg-transparent select-none overflow-hidden font-sans" id="sidebar-container">

        {/* Brand & Market Header */}
        <div className="p-2 border-b border-[var(--border)] flex flex-col gap-1.5 shrink-0" id="sidebar-brand">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={16} strokeWidth={1.5} className="text-[var(--accent)]" />
              <span className="text-xs font-black text-[var(--text-primary)] tracking-wider font-sans">منظومة الكابتن</span>
            </div>
            <span className="text-xs font-bold text-[var(--text-secondary)] font-mono">الإصدار ٣.٢</span>
          </div>

          <div className="pt-2 border-t border-[var(--border)] text-right">
            <h1 className="text-xs font-extrabold text-[var(--text-primary)] truncate">{marketName}</h1>
            <p className="text-xs text-[var(--text-secondary)] font-semibold mt-0.5">الفرع الرئيسي | نشط</p>
          </div>
        </div>

        {/* أقسام المنظومة - قائمة مباشرة مدمجة */}
        <nav className="flex-1 overflow-y-auto lux-scroll p-2 space-y-1" id="sidebar-nav">
          {sectionsTabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                title={t.description}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${isActive ? "bg-gradient-to-l from-amber-500/25 to-orange-600/10 border-amber-400/60 text-[var(--warning)]" : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border)]"}`}
              >
                <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${tabColors[t.id] || "from-slate-500 to-slate-700"} flex items-center justify-center shrink-0`}>
                  <Icon size={15} strokeWidth={2} className="text-white" />
                </span>
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* معلومات المستخدم في الأسفل */}
        <div className="mt-auto p-2 border-t border-[var(--border)] flex items-center justify-between shrink-0" id="sidebar-user-card">
          <div className="text-right overflow-hidden">
            <p className="text-xs font-bold truncate text-[var(--text-primary)]">{currentUser.name}</p>
            <p className="text-xs text-[var(--text-secondary)] font-semibold">
              {currentUser.role === "admin" ? "مدير النظام" : currentUser.role === "cashier" ? "الكاشير" : "المخزن"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeSwitcher />
            <button
              onClick={onLogout}
              title="تسجيل الخروج"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-primary)] hover:bg-[rgba(225,29,72,0.12)] hover:text-[var(--danger)] border border-[var(--border)] transition-colors cursor-pointer"
            >
              <LogOut size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

    </>
  );
}