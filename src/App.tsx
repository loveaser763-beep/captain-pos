import { useState, useEffect, useRef } from "react";
import { User } from "./types";
import Sidebar from "./components/Sidebar";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Products from "./components/Products";
import Suppliers from "./components/Suppliers";
import SalesInvoice from "./components/SalesInvoice";
import PurchaseInvoice from "./components/PurchaseInvoice";
import Reports from "./components/Reports";
import UsersManagement from "./components/Users";
import Logs from "./components/Logs";
import Settings from "./components/Settings";
import Treasury from "./components/Treasury";
import InventoryAudit from "./components/InventoryAudit";
import DeveloperPanel from "./components/DeveloperPanel";
import Jameety from "./components/Jameety";
import { Menu, PanelLeftClose, PanelLeftOpen, Minus, Square, X } from "lucide-react";
import UnifiedPrintButton from "./components/UnifiedPrintButton";
import { applyTheme, getSavedTheme } from "./components/ThemeSwitcher";
import { isLoggedIn, authFetch, clearAuthToken } from "./authFetch";

import InvoicesRegister from "./components/InvoicesRegister";
import LangIndicator from "./components/LangIndicator";
import TamweenCustomers from "./components/TamweenCustomers";
import TamweenReport from "./components/TamweenReport";
import TamweenReplacements from "./components/TamweenReplacements";
import TamweenHub from "./components/TamweenHub";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [previewTab, setPreviewTab] = useState<string | null>(null);
  const [previewEntity, setPreviewEntity] = useState<"jameety" | "zesty" | null>(null);
  const [jameetyEntity, setJameetyEntity] = useState<"jameety" | "zesty">("jameety");
  const [jameetyPrint, setJameetyPrint] = useState({ id: "closing-printable-area", title: "طباعة التقفيلة" });
  const [tamweenCustomerForSale, setTamweenCustomerForSale] = useState<any>(null);
  const sidebarTimerRef = useRef<any>(null);

  // تتبع التبويب النشط داخل جمعيتي/زيستي لزر الطباعة العام
  useEffect(() => {
    const onTarget = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.id) setJameetyPrint({ id: d.id, title: d.title || "طباعة" });
    };
    window.addEventListener("jameety-print-target", onTarget);
    return () => window.removeEventListener("jameety-print-target", onTarget);
  }, []);

  // Load user session on startup — من ملف على القرص فقط (بدون localStorage)
  useEffect(() => {
    const savedTheme = getSavedTheme();
    applyTheme(savedTheme);

    authFetch("/api/settings")
      .then((res) => res.json())
      .then((data) => { if (data?.theme) applyTheme(data.theme as any); })
      .catch(() => {});

    const api = (window as any).electronAPI;
    if (api?.loadSession) {
      api.loadSession().then((user: any) => {
        if (user && user.id) setCurrentUser(user);
      }).catch(() => {});
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    const api = (window as any).electronAPI;
    if (api?.saveSession) api.saveSession(user);

    if (user.role === "admin" || user.role === "developer") {
      setActiveTab("dashboard");
    } else if (user.role === "cashier" || user.permissions?.includes("sales")) {
      setActiveTab("sales");
    } else if (user.role === "storekeeper" || user.permissions?.includes("items")) {
      setActiveTab("items");
    } else {
      setActiveTab("dashboard");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    clearAuthToken();
    const api = (window as any).electronAPI;
    if (api?.clearSession) api.clearSession();
    setActiveTab("dashboard");
  };

  const openJameetyEntity = (e: "jameety" | "zesty") => {
    setJameetyEntity(e);
    setActiveTab("jameety");
    setIsSidebarCollapsed(true);
  };

  // Switch Sub-views - مع معاينة عند الـ hover بدون إخفاء الصفحة المفتوحة
  const displayTab = previewTab || activeTab;
  const displayEntity = previewEntity || jameetyEntity;
  const printableMap: Record<string, string> = {
    dashboard: "printable-dashboard",
    sales: "printable-sales",
    purchases: "purchase-invoice-view",
    invoices_register: "printable-invoices",
    items: "printable-items",
    inventory_audit: "printable-audit",
    suppliers: "printable-suppliers",
    reports: "printable-reports",
    users: "printable-users",
    logs: "printable-logs",
    settings: "printable-settings",
    treasury: "printable-treasury",
    developer: "printable-developer",
    jameety: "closing-printable-area",
    tamween_customers: "printable-tamween-customers",
  };
  const renderActiveView = () => {
    switch (displayTab) {
      case "dashboard":
        return <Dashboard currentUser={currentUser} onNavigateToTab={(tab) => setActiveTab(tab)} />;
      case "sales":
        return <SalesInvoice currentUser={currentUser} tamweenCustomer={tamweenCustomerForSale} onClearTamweenCustomer={() => setTamweenCustomerForSale(null)} />;
      case "purchases":
        return <PurchaseInvoice currentUser={currentUser} />;
      case "invoices_register":
        return <InvoicesRegister currentUser={currentUser} />;
      case "items":
        return <Products currentUser={currentUser} />;
      case "inventory_audit":
        return <InventoryAudit currentUser={currentUser} />;
      case "suppliers":
        return <Suppliers currentUser={currentUser} />;
      case "reports":
        return <Reports currentUser={currentUser} />;
      case "users":
        return <UsersManagement currentUser={currentUser} />;
      case "logs":
        return <Logs currentUser={currentUser} />;
      case "settings":
        return <Settings currentUser={currentUser} />;
      case "treasury":
        return <Treasury currentUser={currentUser} />;
      case "developer":
        return <DeveloperPanel currentUser={currentUser} />;
      case "tamween_customers":
        return <TamweenCustomers onWithdrawNow={(customer) => {
          setTamweenCustomerForSale(customer);
          setActiveTab("sales");
        }} />;
      case "tamween_report":
        return <TamweenReport />;
      case "tamween_replacements":
        return <TamweenReplacements />;
      case "tamween":
        return <TamweenHub />;
      case "jameety":
        return <Jameety key={displayEntity} initialEntity={displayEntity} />;
      default:
        return <Dashboard currentUser={currentUser} onNavigateToTab={(tab) => setActiveTab(tab)} />;
    }
  };

  // If session is unauthenticated, load login UI screen
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div
      className="lux-scope flex h-dvh w-full max-w-full min-w-0 overflow-hidden font-sans select-none"
      id="app-container"
      style={{ direction: "rtl" }}
    >
      {/* Backdrop شفاف - الصفحة وراها ظاهرة تماما */}
      {!isSidebarCollapsed && (
        <div
          className="fixed top-[68px] inset-x-0 bottom-0 bg-transparent z-40"
          onClick={() => { setPreviewTab(null); setPreviewEntity(null); setIsSidebarCollapsed(true); }}
        />
      )}

      {/* Sidebar - منسدل من تحت التوب بار، يبقى مفتوح أثناء التنقل بين المفاتيح */}
      <div
        onMouseEnter={() => { if (sidebarTimerRef.current) clearTimeout(sidebarTimerRef.current); setIsSidebarCollapsed(false); }}
        onMouseLeave={() => { setPreviewTab(null); setPreviewEntity(null); sidebarTimerRef.current = setTimeout(() => setIsSidebarCollapsed(true), 400); }}
        className={`fixed top-[68px] right-0 bottom-0 z-50 w-[280px] max-w-[85vw] flex flex-col border-l border-[rgba(221,228,239,0.12)] bg-[#0e1624]/95 backdrop-blur-md shadow-2xl overflow-hidden transform transition-transform duration-300 ease-out ${isSidebarCollapsed ? "translate-x-full opacity-0 pointer-events-none" : "translate-x-0 opacity-100 pointer-events-auto"}`}
        id="app-sidebar-panel"
      >
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setPreviewTab(null);
            setPreviewEntity(null);
            setIsSidebarCollapsed(true);
          }}
          onHoverTab={(tab) => setPreviewTab(tab)}
          onHoverEntity={(e) => { setPreviewTab("jameety"); setPreviewEntity(e); }}
          onHoverLeave={() => { setPreviewTab(null); setPreviewEntity(null); }}
          currentUser={currentUser}
          onLogout={handleLogout}
          entity={jameetyEntity}
          onSelectEntity={openJameetyEntity}
        />
      </div>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-full min-w-0 max-w-full overflow-hidden" id="app-main-viewport">

        {/* Top Control Bar - صفين: أزرار الويندوز فوق، زر القائمة تحتها أقصى اليمين */}
        <div className="bg-[#0e1624]/95 flex flex-col border-b border-[rgba(221,228,239,0.16)] shrink-0 z-30 min-w-0" id="top-enterprise-bar" style={{ WebkitAppRegion: 'drag' } as any}>
          {/* صف أزرار الويندوز - أقصى اليمين فيزيائيا */}
          <div className="flex justify-end items-center h-7 px-2 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <div className="flex items-center gap-1">
              <button onClick={() => (window as any).electronAPI?.minimize()} className="w-7 h-7 flex items-center justify-center hover:bg-[rgba(221,228,239,0.12)] text-slate-300 rounded-md transition-colors cursor-pointer" title="تصغير"><Minus size={13} /></button>
              <button onClick={() => (window as any).electronAPI?.maximize()} className="w-7 h-7 flex items-center justify-center hover:bg-[rgba(221,228,239,0.12)] text-slate-300 rounded-md transition-colors cursor-pointer" title="تكبير/استعادة"><Square size={12} /></button>
              <button onClick={() => (window as any).electronAPI?.close()} className="w-7 h-7 flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 rounded-md transition-colors cursor-pointer" title="إغلاق"><X size={13} /></button>
            </div>
          </div>
          {/* صف القائمة والعنوان - زر القائمة أقصى اليمين تحتهم مباشرة */}
          <div className="flex justify-between items-center px-2.5 sm:px-3 py-1.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* زر القائمة - أقصى اليمين فيزيائيا تحت أزرار الويندوز */}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                onMouseEnter={() => { if (sidebarTimerRef.current) clearTimeout(sidebarTimerRef.current); setIsSidebarCollapsed(false); }}
                onMouseLeave={() => { sidebarTimerRef.current = setTimeout(() => setIsSidebarCollapsed(true), 600); }}
                className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer shrink-0 border flex items-center gap-1 text-[10px] sm:text-xs font-black ${isSidebarCollapsed ? "bg-[var(--accent)] text-[#0B1120] border-[var(--accent)] shadow-lg" : "bg-[rgba(221,228,239,0.08)] text-slate-100 border-[rgba(221,228,239,0.12)] hover:bg-[rgba(221,228,239,0.14)]"}`}
                aria-label={isSidebarCollapsed ? "إظهار القائمة الجانبية" : "إخفاء القائمة الجانبية"}
                title="مرر الماوس لفتح القائمة"
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
                {isSidebarCollapsed ? <PanelLeftOpen size={15} strokeWidth={2} /> : <PanelLeftClose size={15} strokeWidth={2} />}
                <span className="hidden sm:inline">{isSidebarCollapsed ? "القائمة" : "إخفاء"}</span>
              </button>
              <div className="w-px h-4 bg-[rgba(221,228,239,0.12)] hidden sm:block shrink-0" />
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                 <span className="lux-metallic text-xs truncate">منظومة الكابتن</span>
                <span className="text-[10px] text-slate-400 font-semibold hidden xl:inline truncate">| لهندسة الأرقام وريادة الأعمال</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 font-medium shrink-0">
              <div style={{ WebkitAppRegion: 'no-drag' } as any}>
                <UnifiedPrintButton printableId={displayTab === "jameety" ? jameetyPrint.id : (printableMap[displayTab] || "app-viewport-inner")} title={displayTab === "jameety" ? jameetyPrint.title : "طباعة"} />
              </div>
              <LangIndicator />
              <div className="hidden xl:flex items-center gap-3">
                <span>المستخدم: <strong className="text-slate-50">{currentUser.name}</strong></span>
                <span className="text-slate-600">|</span>
                <span>الصلاحية: <strong className="text-slate-50">{currentUser.role === "developer" ? "منظومة الكابتن" : currentUser.role === "admin" ? "مدير النظام" : currentUser.role === "cashier" ? "الكاشير" : "المخزن"}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100 bg-[rgba(221,228,239,0.06)] px-2 py-1 rounded-full border border-[rgba(221,228,239,0.08)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0 animate-pulse"></span>
                <span>نشط</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Target Viewport - الصفحة ظاهرة دائما حتى مع القائمة */}
        <div className="flex-1 min-h-0 min-w-0 max-w-full overflow-y-auto lux-scroll flex flex-col w-full relative p-1 sm:p-1.5 md:p-2 lg:p-2.5 bg-transparent" id="app-viewport-inner">
          {renderActiveView()}
        </div>
      </div>
    </div>
  );
}
