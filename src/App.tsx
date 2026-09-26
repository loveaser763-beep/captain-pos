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
import { isLoggedIn, authFetch, clearAuthToken, getAuthToken, hardRefocus } from "./authFetch";
import LicenseScreen from "./components/LicenseScreen";

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
  const [jameetyEntity, setJameetyEntity] = useState<"jameety" | "zesty">("jameety");
  const [jameetyPrint, setJameetyPrint] = useState({ id: "closing-printable-area", title: "طباعة التقفيلة" });
  const [tamweenCustomerForSale, setTamweenCustomerForSale] = useState<any>(null);
  const sidebarTimerRef = useRef<any>(null);
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const [topBarH, setTopBarH] = useState(68);

  // حالة الترخيص — لو غير مفعّل: شاشة التفعيل بدل أي شيء آخر (بلا نت)
  const [licenseActive, setLicenseActive] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/license/status")
      .then((r) => r.json())
      .then((d) => { if (alive) setLicenseActive(!!d?.active); })
      .catch(() => { if (alive) setLicenseActive(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const el = topBarRef.current;
    if (!el) return;
    const update = () => setTopBarH(Math.round(el.getBoundingClientRect().height));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // تتبع التبويب النشط داخل جمعيتي/زيستي لزر الطباعة العام
  useEffect(() => {
    const onTarget = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.id) setJameetyPrint({ id: d.id, title: d.title || "طباعة" });
    };
    window.addEventListener("jameety-print-target", onTarget);
    // شبكة أمان الفوكس: أي حوار نظام (طباعة/سكرين/تنبيه) بيسرق فوكس النافذة
    // والحقول بتبان مجمدة — أول ما الصفحة ترجع ظاهرة نرجع الفوكس من العملية الرئيسية
    // (بدون الاستماع لحدث focus نفسه حتى لا تتكون حلقة فوكس تجمد الكتابة)
    const onVis = () => {
      if (!document.hidden) {
        try { hardRefocus(); } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("jameety-print-target", onTarget);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Load user session on startup
  useEffect(() => {
    const savedTheme = getSavedTheme();
    applyTheme(savedTheme);

    authFetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const t = data?.theme || data?.ui_theme;
        if (t) applyTheme(t as any);
      })
      .catch(() => {});

    // Try Electron session first (disk), else validate token with server (no localStorage)
    const api = (window as any).electronAPI;
    if (api?.loadSession) {
      api.loadSession().then((user: any) => {
        if (user && user.id) {
          if (getAuthToken()) {
            setCurrentUser(user);
            // تحقق صامت من صلاحية التوكن — لو منتهي: authFetch يمسح الجلسة ويرجّع شاشة الدخول
            authFetch("/api/auth/me").catch(() => {});
          } else {
            // جلسة ديسك بدون توكن (بقايا باج تسجيل الدخول القديم) — خروج نظيف لشاشة الدخول
            try { api.clearSession?.(); } catch {}
          }
        }
      }).catch(() => {});
    } else if (getAuthToken()) {
      authFetch("/api/auth/me")
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data?.success && data.user?.id) setCurrentUser(data.user); })
        .catch(() => {});
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    const api = (window as any).electronAPI;
    if (api?.saveSession) api.saveSession(user);
    // Web session = JWT token only (validated via /api/auth/me on reload)

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

  // Switch Sub-views - التنقل بالضغط فقط (شِلنا معاينة الهوفر اللي كانت بتقلب الصفحة وترجعك قبل ما تشوفها)
  const displayTab = activeTab;
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
        return <TamweenReplacements onWithdrawNow={(customer) => {
          setTamweenCustomerForSale(customer);
          setActiveTab("sales");
        }} />;
      case "tamween":
        return <TamweenHub onWithdrawNow={(customer) => {
          setTamweenCustomerForSale(customer);
          setActiveTab("sales");
        }} />;
      case "jameety":
        // مفتاح ثابت على الكيان الحقيقي: معاينة الهوفر كانت تركب جمعيتي من جديد
        // مع كل حركة ماوس فيرجع الشهر المخزن ويضيع اختيار المستخدم
        return <Jameety key={jameetyEntity} initialEntity={jameetyEntity} />;
      default:
        return <Dashboard currentUser={currentUser} onNavigateToTab={(tab) => setActiveTab(tab)} />;
    }
  };

  // الترخيص قبل أي شيء: غير مفعّل → شاشة التفعيل فقط
  if (licenseActive === null) return null;
  if (!licenseActive) return <LicenseScreen onActivated={() => setLicenseActive(true)} />;

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
          className="fixed inset-x-0 bottom-0 bg-transparent z-40"
          style={{ top: topBarH }}
          onClick={() => { setIsSidebarCollapsed(true); }}
        />
      )}

      {/* Sidebar - منسدل من تحت التوب بار، يبقى مفتوح أثناء التنقل بين المفاتيح */}
      <div
        onMouseEnter={() => { if (sidebarTimerRef.current) clearTimeout(sidebarTimerRef.current); setIsSidebarCollapsed(false); }}
        onMouseLeave={() => { sidebarTimerRef.current = setTimeout(() => setIsSidebarCollapsed(true), 400); }}
        className={`fixed right-0 bottom-0 z-50 w-[280px] max-w-[85vw] flex flex-col border-l border-[var(--border)] bg-[var(--bg-card)] backdrop-blur-md shadow-2xl overflow-hidden transform transition-transform duration-300 ease-out ${isSidebarCollapsed ? "translate-x-full opacity-0 pointer-events-none" : "translate-x-0 opacity-100 pointer-events-auto"}`}
        style={{ top: topBarH }}
        id="app-sidebar-panel"
      >
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsSidebarCollapsed(true);
          }}
          currentUser={currentUser}
          onLogout={handleLogout}
          entity={jameetyEntity}
          onSelectEntity={openJameetyEntity}
        />
      </div>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-full min-w-0 max-w-full overflow-hidden" id="app-main-viewport">

        {/* Top Control Bar - صف واحد مضغوط */}
        <div ref={topBarRef} className="bg-[var(--bg-card)] flex flex-col border-b border-[var(--border)] shrink-0 z-30 min-w-0" id="top-enterprise-bar" style={{ WebkitAppRegion: 'drag' } as any}>
          <div className="flex justify-between items-center px-2.5 sm:px-3 py-1.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* زر القائمة - أقصى اليمين فيزيائيا تحت أزرار الويندوز */}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                onMouseEnter={() => { if (sidebarTimerRef.current) clearTimeout(sidebarTimerRef.current); setIsSidebarCollapsed(false); }}
                onMouseLeave={() => { sidebarTimerRef.current = setTimeout(() => setIsSidebarCollapsed(true), 600); }}
                className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer shrink-0 border flex items-center gap-1 text-[10px] sm:text-xs font-black ${isSidebarCollapsed ? "bg-[var(--accent)] text-[var(--bg-deep)] border-[var(--accent)] shadow-lg" : "bg-[var(--bg-input)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--accent-subtle)]"}`}
                aria-label={isSidebarCollapsed ? "إظهار القائمة الجانبية" : "إخفاء القائمة الجانبية"}
                title="مرر الماوس لفتح القائمة"
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
                {isSidebarCollapsed ? <PanelLeftOpen size={15} strokeWidth={2} /> : <PanelLeftClose size={15} strokeWidth={2} />}
                <span className="hidden sm:inline">{isSidebarCollapsed ? "القائمة" : "إخفاء"}</span>
              </button>
              <div className="w-px h-4 bg-[var(--border)] hidden sm:block shrink-0" />
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                 <span className="lux-metallic text-xs truncate">منظومة الكابتن</span>
                <span className="text-[10px] lux-bar-muted font-semibold hidden xl:inline truncate">| لهندسة الأرقام وريادة الأعمال</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs lux-bar-muted font-medium shrink-0">
              <div style={{ WebkitAppRegion: 'no-drag' } as any}>
                <UnifiedPrintButton printableId={displayTab === "jameety" ? jameetyPrint.id : (printableMap[displayTab] || "app-viewport-inner")} title={displayTab === "jameety" ? jameetyPrint.title : "طباعة"} />
              </div>
              <LangIndicator />
              <div className="hidden xl:flex items-center gap-3">
                <span>المستخدم: <strong className="lux-bar-strong">{currentUser.name}</strong></span>
                <span className="lux-bar-sep">|</span>
                <span>الصلاحية: <strong className="lux-bar-strong">{currentUser.role === "developer" ? "منظومة الكابتن" : currentUser.role === "admin" ? "مدير النظام" : currentUser.role === "cashier" ? "الكاشير" : "المخزن"}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold lux-bar-strong bg-[var(--bg-input)] px-2 py-1 rounded-full border border-[var(--border)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0 animate-pulse"></span>
                <span>نشط</span>
              </div>
              <div className="w-px h-4 bg-[var(--border)] shrink-0" />
              <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <button onClick={() => (window as any).electronAPI?.minimize()} className="w-6 h-6 flex items-center justify-center hover:bg-[var(--bg-input)] lux-bar-muted transition-colors cursor-pointer" title="تصغير"><Minus size={12} /></button>
                <button onClick={() => (window as any).electronAPI?.maximize()} className="w-6 h-6 flex items-center justify-center hover:bg-[var(--bg-input)] lux-bar-muted transition-colors cursor-pointer" title="تكبير/استعادة"><Square size={11} /></button>
                <button onClick={() => (window as any).electronAPI?.close()} className="w-6 h-6 flex items-center justify-center hover:bg-[var(--danger)] hover:text-white lux-bar-muted transition-colors cursor-pointer" title="إغلاق"><X size={12} /></button>
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
