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
  Store,
  Sparkles,
  FileText,
  CreditCard
} from "lucide-react";
import { User } from "../types";
import ThemeSwitcher from "./ThemeSwitcher";
import { authFetch } from "../authFetch";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User | null;
  onLogout: () => void;
  entity: "jameety" | "zesty";
  onSelectEntity: (e: "jameety" | "zesty") => void;
  onHoverTab?: (tab: string | null) => void;
  onHoverEntity?: (e: "jameety" | "zesty") => void;
  onHoverLeave?: () => void;
}

// ألوان متدرجة لكل قسم
const tabColors: Record<string, string> = {
  dashboard: "from-slate-700 to-slate-900",
  sales: "from-emerald-500 to-teal-700",
  purchases: "from-orange-500 to-red-600",
  invoices_register: "from-blue-500 to-indigo-600",
  items: "from-violet-500 to-purple-700",
  inventory_audit: "from-amber-500 to-orange-600",
  suppliers: "from-pink-500 to-rose-700",
  reports: "from-cyan-500 to-blue-600",
  users: "from-indigo-500 to-blue-700",
  logs: "from-gray-500 to-slate-700",
  settings: "from-slate-600 to-gray-800",
  treasury: "from-yellow-500 to-amber-700",
  developer: "from-red-600 to-rose-800",
  jameety: "from-amber-500 to-orange-600",
  tamween: "from-teal-500 to-cyan-600",
};

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  entity,
  onSelectEntity,
  onHoverTab,
  onHoverEntity,
  onHoverLeave
}: SidebarProps) {
  const [marketName, setMarketName] = useState(() => localStorage.getItem("supermarket_market_name") || "منظومة الكابتن");

  useEffect(() => {
    authFetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.market_name) {
          setMarketName(data.market_name);
          localStorage.setItem("supermarket_market_name", data.market_name);
        }
      })
      .catch(() => {});
  }, [activeTab]);

  if (!currentUser) return null;

  const tabs = [
    { id: "dashboard", label: "الشاشة الرئيسية", description: "لوحة الإحصائيات والنشاط", icon: LayoutDashboard, permission: null },
    { id: "sales", label: "لوحة الكاشير", description: "إصدار فواتير المبيعات", icon: ShoppingCart, permission: "sales" },
    { id: "purchases", label: "فاتورة مشتريات", description: "تسجيل فواتير المشتريات", icon: TrendingDown, permission: "purchases" },
    { id: "invoices_register", label: "سجل الفواتير", description: "عرض جميع الفواتير", icon: FileText, permission: "reports" },
    { id: "items", label: "إدارة الأصناف", description: "إضافة وتعديل الأصناف", icon: Package, permission: "items" },
    { id: "inventory_audit", label: "جرد المخزن الكلي", description: "جرد شامل للمخزون", icon: ClipboardCheck, permission: "items" },
    { id: "suppliers", label: "سجل الموردين", description: "قائمة الموردين", icon: Truck, permission: "suppliers" },
    { id: "reports", label: "التقارير المحاسبية", description: "تقارير مالية ومحاسبية", icon: BarChart3, permission: "reports" },
    { id: "users", label: "إدارة المستخدمين", description: "إدارة حسابات النظام", icon: Users, permission: "users" },
    { id: "logs", label: "سجل العمليات", description: "سجل النشاط والتغييرات", icon: ClipboardList, permission: "reports" },
    { id: "tamween", label: "المنظومة التموينية", description: "عملاء و	report و استعاضات", icon: CreditCard, permission: "reports" },
    { id: "settings", label: "إعدادات النظام", description: "ضبط إعدادات النظام", icon: Settings, permission: "admin" },
    { id: "treasury", label: "اللوحة المالية", description: "الخزينة والحسابات", icon: Banknote, permission: "admin" },
    { id: "developer", label: "لوحة تحكم المبرمج", description: "أدوات المبرمج", icon: Terminal, permission: "developer" },
    { id: "jameety", label: "🏪 جمعيتي", description: "إدارة التموين", icon: Store, permission: "jameety" }
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

  // فصل "جمعيتي" عن باقي الأقسام (يظهر كزر ثابت أسفل زر الأقسام)
  const sectionsTabs = allowedTabs.filter(t => t.id !== "jameety");
  const jameetyTab = allowedTabs.find(t => t.id === "jameety");

  return (
    <>
      {/* Top Bar - شريط علوي فقط */}
      <div className="flex flex-col h-full bg-transparent select-none overflow-hidden font-sans" id="sidebar-container">

        {/* Brand & Market Header */}
        <div className="p-2 border-b border-[rgba(221,228,239,0.16)] flex flex-col gap-1.5 shrink-0" id="sidebar-brand">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={16} strokeWidth={1.5} className="text-amber-300" />
              <span className="text-xs font-black text-slate-50 tracking-wider font-sans">منظومة الكابتن</span>
            </div>
            <span className="text-xs font-bold text-slate-400 font-mono">الإصدار ٣.٢</span>
          </div>

          <div className="pt-2 border-t border-[rgba(221,228,239,0.12)] text-right">
            <h1 className="text-xs font-extrabold text-slate-50 truncate">{marketName}</h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">الفرع الرئيسي | نشط</p>
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
                onMouseEnter={() => onHoverTab?.(t.id)}
                onMouseLeave={() => onHoverLeave?.()}
                title={t.description}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${isActive ? "bg-gradient-to-l from-amber-500/25 to-orange-600/10 border-amber-400/60 text-amber-100" : "border-transparent text-slate-300 hover:bg-[rgba(221,228,239,0.08)] hover:text-slate-50 hover:border-[rgba(221,228,239,0.12)]"}`}
              >
                <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${tabColors[t.id] || "from-slate-500 to-slate-700"} flex items-center justify-center shrink-0`}>
                  <Icon size={15} strokeWidth={2} className="text-white" />
                </span>
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* إدارة التموين - جمعيتي + زيستي */}
        {jameetyTab && (
          <div className="p-2 border-b border-[rgba(221,228,239,0.12)] shrink-0 space-y-1">
            <p className="text-[10px] font-black text-slate-500 px-1">إدارة التموين</p>
            {([
              { e: "jameety" as const, label: "جمعيتي", sub: "التموين الرئيسي", Icon: Store, grad: "from-amber-400 to-orange-600" },
              { e: "zesty" as const, label: "زيستي", sub: "(نادي بورتو الرياضي)", Icon: Sparkles, grad: "from-cyan-400 to-blue-600" },
            ]).map(({ e, label, sub, Icon, grad }) => {
              const isActive = activeTab === "jameety" && entity === e;
              return (
                <button
                  key={e}
                  onClick={() => onSelectEntity(e)}
                  onMouseEnter={() => onHoverEntity?.(e)}
                  onMouseLeave={() => onHoverLeave?.()}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-300 cursor-pointer group border mr-3 ${isActive ? "bg-gradient-to-l from-amber-500/25 to-orange-600/15 border-amber-400/60" : "hover:bg-[rgba(221,228,239,0.08)] border-transparent hover:border-[rgba(221,228,239,0.12)]"}`}
                  title={label + " - " + sub}
                  id={e === "jameety" ? "jameety-menu-button" : "zesty-menu-button"}
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shadow-lg shrink-0`}>
                    <Icon size={17} strokeWidth={2} className="text-white" />
                  </div>
                  <div className="text-right min-w-0">
                    <div className={`text-xs font-black truncate ${isActive ? "text-amber-200" : "text-slate-50"}`}>{e === "jameety" ? "🏪 جمعيتي" : label}</div>
                    <div className={`text-[10px] font-semibold ${isActive ? "text-amber-200/80" : "text-slate-400"}`}>{sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* معلومات المستخدم في الأسفل */}
        <div className="mt-auto p-2 border-t border-[rgba(221,228,239,0.16)] flex items-center justify-between shrink-0" id="sidebar-user-card">
          <div className="text-right overflow-hidden">
            <p className="text-xs font-bold truncate text-slate-50">{currentUser.name}</p>
            <p className="text-xs text-slate-400 font-semibold">
              {currentUser.role === "admin" ? "مدير النظام" : currentUser.role === "cashier" ? "الكاشير" : "المخزن"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeSwitcher />
            <button
              onClick={onLogout}
              title="تسجيل الخروج"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-200 hover:bg-[rgba(251,122,147,0.15)] hover:text-rose-200 border border-[rgba(221,228,239,0.2)] transition-colors cursor-pointer"
            >
              <LogOut size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

    </>
  );
}