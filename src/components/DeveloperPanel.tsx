import React, { useState, useEffect, FormEvent } from "react";
import {
  Terminal,
  Database,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  Key,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Play,
  FileCode,
  HardDrive
} from "lucide-react";
import { authFetch } from "../authFetch";
import { User } from "../types";

interface DeveloperPanelProps {
  currentUser: User | null;
}

export default function DeveloperPanel({ currentUser }: DeveloperPanelProps) {
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "reset" | "sql" | "backup" | "users">("overview");

  // Reset System State
  const [resetOptions, setResetOptions] = useState({
    invoices: true,
    items: true,
    suppliers: true,
    expenses: true,
    partners: true,
    treasury: true,
    logs: true
  });
  const [resetMessage, setResetMessage] = useState({ type: "", text: "" });
  const [isResetting, setIsResetting] = useState(false);

  // SQL Console State
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM users;");
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlError, setSqlError] = useState("");
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  // Backup & Restore State
  const [restoreJson, setRestoreJson] = useState("");
  const [backupMessage, setBackupMessage] = useState({ type: "", text: "" });
  const [isRestoring, setIsRestoring] = useState(false);

  // User Control State
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await authFetch("/api/developer/stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await authFetch("/api/users");
      const data = await res.json();
      setUsersList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchUsers();
  }, []);

  // System Reset Handler
  const handleSystemReset = async (e: FormEvent) => {
    e.preventDefault();

    if (!window.confirm("تأكيد أخير: هل أنت متأكد تماماً من تصفية كافة بيانات النظام والجداول وإعادة الضبط للوضع المصنعي؟")) {
      return;
    }

    setIsResetting(true);
    setResetMessage({ type: "", text: "" });

    try {
      const res = await authFetch("/api/developer/reset-system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetOptions
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResetMessage({ type: "success", text: data.message });
        fetchStats();
        fetchUsers();
      } else {
        setResetMessage({ type: "error", text: data.error || "تعذر إعادة ضبط النظام." });
      }
    } catch (err: any) {
      setResetMessage({ type: "error", text: `خطأ اتصال: ${err.message}` });
    } finally {
      setIsResetting(false);
    }
  };

  // SQL Runner Handler
  const handleExecuteSql = async (e: FormEvent) => {
    e.preventDefault();
    setSqlError("");
    setSqlResult(null);
    setIsExecutingSql(true);

    try {
      const res = await authFetch("/api/developer/sql", {
        method: "POST",
        body: JSON.stringify({ query: sqlQuery })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSqlResult(data);
        fetchStats();
      } else {
        setSqlError(data.error || "فشل تنفيذ الاستعلام.");
      }
    } catch (err: any) {
      setSqlError(`خطأ في الاتصال: ${err.message}`);
    } finally {
      setIsExecutingSql(false);
    }
  };

  // Export Backup
  const handleExportBackup = async () => {
    try {
      const res = await authFetch("/api/developer/backup");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `innocode_database_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("فشل تصدير النسخة الاحتياطية.");
    }
  };

  // Restore Backup
  const handleRestoreBackup = async (e: FormEvent) => {
    e.preventDefault();

    let parsedData: any = null;
    try {
      parsedData = JSON.parse(restoreJson);
      if (parsedData.data) parsedData = parsedData.data;
    } catch (e) {
      setBackupMessage({ type: "error", text: "كود النسخة الاحتياطية JSON غير صالح." });
      return;
    }

    setIsRestoring(true);
    setBackupMessage({ type: "", text: "" });

    try {
      const res = await authFetch("/api/developer/restore", {
        method: "POST",
        body: JSON.stringify({ data: parsedData })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBackupMessage({ type: "success", text: data.message });
        setRestoreJson("");
        fetchStats();
        fetchUsers();
      } else {
        setBackupMessage({ type: "error", text: data.error || "فشلت الاستعادة." });
      }
    } catch (err: any) {
      setBackupMessage({ type: "error", text: `خطأ اتصال: ${err.message}` });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 select-none font-sans" id="developer-panel-container">
      
      {/* Title & Developer Banner */}
      <div className="bg-[#c3c6bb] p-5 border border-[#222222] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#222222] text-[#c3c6bb] flex items-center justify-center font-bold">
            <Terminal size={22} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-base font-black text-[#000000]">لوحة تحكم منظومة الكابتن</h1>
            <p className="text-xs text-[#555555] font-semibold mt-0.5">
              مرحباً بك المبرمج <strong className="text-[#000000]">innocode</strong> - صلاحيات الوصول الكاملة والجذرية لقواعد البيانات والمحرك
            </p>
          </div>
        </div>

        <button
          onClick={fetchStats}
          className="px-3 py-1.5 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer self-start md:self-auto"
        >
          <RefreshCw size={14} className={loadingStats ? "animate-spin" : ""} />
          <span>تحديث إحصائيات المحرك</span>
        </button>
      </div>

      {/* Control Tabs Header */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-[#222222] pb-2">
        <button
          onClick={() => setActiveSubTab("overview")}
          className={`px-4 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === "overview"
              ? "bg-[#222222] text-[#c3c6bb]"
              : "bg-[#c3c6bb] text-[#222222] hover:bg-[#b8bcb2]"
          }`}
        >
          <HardDrive size={14} />
          <span>إحصائيات المحرك والجداول</span>
        </button>

        <button
          onClick={() => setActiveSubTab("reset")}
          className={`px-4 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === "reset"
              ? "bg-[#222222] text-[#c3c6bb]"
              : "bg-[#c3c6bb] text-[#222222] hover:bg-[#b8bcb2]"
          }`}
        >
          <Trash2 size={14} />
          <span>تصفية وتصفير البيانات بالكامل</span>
        </button>

        <button
          onClick={() => setActiveSubTab("sql")}
          className={`px-4 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === "sql"
              ? "bg-[#222222] text-[#c3c6bb]"
              : "bg-[#c3c6bb] text-[#222222] hover:bg-[#b8bcb2]"
          }`}
        >
          <FileCode size={14} />
          <span>مُحرر واستعلامات SQL المباشرة</span>
        </button>

        <button
          onClick={() => setActiveSubTab("backup")}
          className={`px-4 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === "backup"
              ? "bg-[#222222] text-[#c3c6bb]"
              : "bg-[#c3c6bb] text-[#222222] hover:bg-[#b8bcb2]"
          }`}
        >
          <Download size={14} />
          <span>النسخ الاحتياطي والاستعادة</span>
        </button>

        <button
          onClick={() => setActiveSubTab("users")}
          className={`px-4 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === "users"
              ? "bg-[#222222] text-[#c3c6bb]"
              : "bg-[#c3c6bb] text-[#222222] hover:bg-[#b8bcb2]"
          }`}
        >
          <Key size={14} />
          <span>إدارة حسابات النظام والجذر</span>
        </button>
      </div>

      {/* SUB-TAB 1: OVERVIEW & STATS */}
      {activeSubTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-[#c3c6bb] p-4 border border-[#222222] text-right">
              <p className="text-[11px] text-[#555555] font-bold">حجم قاعدة البيانات SQLite</p>
              <p className="text-lg font-black text-[#000000] mt-1">{stats?.dbSize || "..."}</p>
            </div>
            <div className="bg-[#c3c6bb] p-4 border border-[#222222] text-right">
              <p className="text-[11px] text-[#555555] font-bold">إجمالي المستخدمين</p>
              <p className="text-lg font-black text-[#000000] mt-1">{stats?.usersCount ?? "..."}</p>
            </div>
            <div className="bg-[#c3c6bb] p-4 border border-[#222222] text-right">
              <p className="text-[11px] text-[#555555] font-bold">إجمالي المنتجات</p>
              <p className="text-lg font-black text-[#000000] mt-1">{stats?.itemsCount ?? "..."}</p>
            </div>
            <div className="bg-[#c3c6bb] p-4 border border-[#222222] text-right">
              <p className="text-[11px] text-[#555555] font-bold">فواتير المبيعات</p>
              <p className="text-lg font-black text-[#000000] mt-1">{stats?.salesCount ?? "..."}</p>
            </div>
            <div className="bg-[#c3c6bb] p-4 border border-[#222222] text-right">
              <p className="text-[11px] text-[#555555] font-bold">فواتير المشتريات</p>
              <p className="text-lg font-black text-[#000000] mt-1">{stats?.purchasesCount ?? "..."}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-[#c3c6bb] p-4 border border-[#222222] text-right">
              <p className="text-[11px] text-[#555555] font-bold">إجمالي الموردين</p>
              <p className="text-lg font-black text-[#000000] mt-1">{stats?.suppliersCount ?? "..."}</p>
            </div>
            <div className="bg-[#c3c6bb] p-4 border border-[#222222] text-right">
              <p className="text-[11px] text-[#555555] font-bold">جلسات الجرد الكلي</p>
              <p className="text-lg font-black text-[#000000] mt-1">{stats?.auditsCount ?? "..."}</p>
            </div>
            <div className="bg-[#c3c6bb] p-4 border border-[#222222] text-right">
              <p className="text-[11px] text-[#555555] font-bold">سجلات النظام (Logs)</p>
              <p className="text-lg font-black text-[#000000] mt-1">{stats?.logsCount ?? "..."}</p>
            </div>
            <div className="bg-[#c3c6bb] p-4 border border-[#222222] text-right">
              <p className="text-[11px] text-[#555555] font-bold">سجلات المصروفات</p>
              <p className="text-lg font-black text-[#000000] mt-1">{stats?.expensesCount ?? "..."}</p>
            </div>
            <div className="bg-[#c3c6bb] p-4 border border-[#222222] text-right">
              <p className="text-[11px] text-[#555555] font-bold">مدة عمل الخادم (Uptime)</p>
              <p className="text-lg font-black text-[#000000] mt-1">{stats?.uptime ?? "..."}</p>
            </div>
          </div>

          <div className="bg-[#c3c6bb] p-5 border border-[#222222] space-y-3">
            <h3 className="text-xs font-black text-[#000000]">معلومات بيئة التشغيل والخادم:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs font-medium text-[#333333]">
              <div className="bg-[#b8bcb2] p-2.5 border border-[#888888]">
                <span>اسم المستخدم المبرمج: </span>
                <strong className="text-[#000000]">innocode</strong>
              </div>
              <div className="bg-[#b8bcb2] p-2.5 border border-[#888888]">
                <span>المحرك وقاعدة البيانات: </span>
                <strong className="text-[#000000]">Node.js / Express / SQLite3</strong>
              </div>
              <div className="bg-[#b8bcb2] p-2.5 border border-[#888888]">
                <span>منفذ السيرفر: </span>
                <strong className="text-[#000000]">Port 3000 (External Ingress)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: FACTORY RESET / WIPE DATA */}
      {activeSubTab === "reset" && (
        <div className="bg-[#c3c6bb] p-6 border border-[#222222] space-y-5">
          <div className="flex items-center gap-2 text-[#222222]">
            <ShieldAlert size={28} className="text-[#000000]" />
            <div>
              <h2 className="text-sm font-black text-[#000000]">إعادة ضبط المصنع وتصفية كافة البيانات</h2>
              <p className="text-xs text-[#555555] font-semibold mt-0.5">
                تتيح هذه الخاصية تفريغ جميع فواتير المبيعات، المشتريات، المنتجات، الموردين، والمصروفات بالكامل وتجهيز السيستم للعميل.
              </p>
            </div>
          </div>

          {resetMessage.text && (
            <div className={`p-3 border text-xs font-bold flex items-center gap-2 ${
              resetMessage.type === "success" 
                ? "bg-[#a8b898] border-[#222222] text-[#000000]" 
                : "bg-[#d8a8a8] border-[#880000] text-[#550000]"
            }`}>
              {resetMessage.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span>{resetMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleSystemReset} className="space-y-4 max-w-lg">
            <div className="bg-[#b8bcb2] p-4 border border-[#888888] space-y-3">
              <h3 className="text-xs font-bold border-b border-[#888888] pb-2 mb-2 text-[#000000]">حدد الجداول المراد تصفيرها:</h3>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#000000]">
                <input type="checkbox" checked={resetOptions.invoices} onChange={(e) => setResetOptions({...resetOptions, invoices: e.target.checked})} className="w-4 h-4 accent-[#222222]" />
                <span>الفواتير (مبيعات ومشتريات) وعناصرها</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#000000]">
                <input type="checkbox" checked={resetOptions.treasury} onChange={(e) => setResetOptions({...resetOptions, treasury: e.target.checked})} className="w-4 h-4 accent-[#222222]" />
                <span>سجل الحركات المالية المباشرة (الخزنة والدرج)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#000000]">
                <input type="checkbox" checked={resetOptions.expenses} onChange={(e) => setResetOptions({...resetOptions, expenses: e.target.checked})} className="w-4 h-4 accent-[#222222]" />
                <span>المصروفات</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#000000]">
                <input type="checkbox" checked={resetOptions.items} onChange={(e) => setResetOptions({...resetOptions, items: e.target.checked})} className="w-4 h-4 accent-[#222222]" />
                <span>الأصناف والمنتجات</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#000000]">
                <input type="checkbox" checked={resetOptions.suppliers} onChange={(e) => setResetOptions({...resetOptions, suppliers: e.target.checked})} className="w-4 h-4 accent-[#222222]" />
                <span>الموردين</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#000000]">
                <input type="checkbox" checked={resetOptions.partners} onChange={(e) => setResetOptions({...resetOptions, partners: e.target.checked})} className="w-4 h-4 accent-[#222222]" />
                <span>الشركاء</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#000000]">
                <input type="checkbox" checked={resetOptions.logs} onChange={(e) => setResetOptions({...resetOptions, logs: e.target.checked})} className="w-4 h-4 accent-[#222222]" />
                <span>سجل النظام (اللوج) وعمليات الجرد</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isResetting}
              className="px-5 py-2.5 bg-[#000000] hover:bg-[#222222] text-[#ffffff] font-extrabold text-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Trash2 size={16} />
              <span>{isResetting ? "جاري تصفية البيانات ونظافة النظام..." : "تأكيد تصفية البيانات وإعادة ضبط المصنع"}</span>
            </button>
          </form>

          <div className="pt-6 border-t border-[#888888]">
            <h3 className="text-xs font-black text-[#000000] mb-2">تغذية وشحن قاعدة البيانات المباشر:</h3>
            <p className="text-xs text-[#555555] mb-3">
              يمكنك ضغط الزر التالي لشحن النظام فوراً بأكثر من 100 صنف متنوع (ألبان، مشروبات، بقالة، إلخ) مع كافة الموردين وفواتير المبيعات والمشتريات والمصروفات.
            </p>
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm("هل تريد شحن النظام بـ 100+ صنف وبينات تجريبية كاملة؟")) return;
                try {
                  setIsResetting(true);
                  const res = await authFetch("/api/developer/seed-full-data", {
                    method: "POST"
                  });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    setResetMessage({ type: "success", text: data.message });
                    fetchStats();
                    fetchUsers();
                  } else {
                    setResetMessage({ type: "error", text: data.error || "فشل شحن البيانات" });
                  }
                } catch (e: any) {
                  setResetMessage({ type: "error", text: e.message });
                } finally {
                  setIsResetting(false);
                }
              }}
              disabled={isResetting}
              className="px-5 py-2.5 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-extrabold text-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Database size={16} />
              <span>شحن وتغذية 100+ صنف وداتا تجريبية كاملة</span>
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: DIRECT SQL QUERY RUNNER */}
      {activeSubTab === "sql" && (
        <div className="bg-[#c3c6bb] p-6 border border-[#222222] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#000000]">مُحرر ومستعلم استعلامات SQL المباشر</h2>
            <span className="text-xs text-[#555555] font-semibold">محمي بالمصادقة</span>
          </div>

          <form onSubmit={handleExecuteSql} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#333333]">كود استعلام SQLite:</label>
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                rows={5}
                dir="ltr"
                className="w-full p-3 bg-[#111111] text-[#00ff66] font-mono text-xs border border-[#222222] focus:outline-none"
                placeholder="SELECT * FROM users;"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="submit"
                disabled={isExecutingSql}
                className="h-9 px-4 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
              >
                <Play size={14} />
                <span>{isExecutingSql ? "جاري التنفيذ..." : "تشغيل الاستعلام"}</span>
              </button>
            </div>
          </form>

          {sqlError && (
            <div className="p-3 bg-[#d8a8a8] border border-[#880000] text-[#550000] text-xs font-bold dir-ltr font-mono">
              {sqlError}
            </div>
          )}

          {sqlResult && (
            <div className="space-y-2 pt-2 border-t border-[#888888]">
              <p className="text-xs font-black text-[#000000]">نتيجة الاستعلام ({sqlResult.type}):</p>

              {sqlResult.rows ? (
                <div className="overflow-x-auto max-h-80 border border-[#222222] bg-[#b8bcb2]">
                  <table className="w-full text-right text-xs min-w-[600px] border-collapse">
                    <thead>
                      <tr className="bg-[#222222] text-[#c3c6bb]">
                        {Object.keys(sqlResult.rows[0] || {}).map((col) => (
                          <th key={col} className="p-2 border border-[#444444] font-bold">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sqlResult.rows.map((row: any, idx: number) => (
                        <tr key={idx} className="border-b border-[#888888] hover:bg-[#a8aca2]">
                          {Object.values(row).map((val: any, vIdx: number) => (
                            <td key={vIdx} className="p-2 border border-[#888888] font-mono text-[11px] text-[#000000]">
                              {typeof val === "object" ? JSON.stringify(val) : String(val ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 bg-[#a8b898] border border-[#222222] text-xs font-bold font-mono">
                  {JSON.stringify(sqlResult.result)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: BACKUP & RESTORE */}
      {activeSubTab === "backup" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#c3c6bb] p-6 border border-[#222222] space-y-4">
            <h2 className="text-sm font-black text-[#000000]">تصدير وتنزيل قاعدة البيانات</h2>
            <p className="text-xs text-[#555555] font-semibold leading-relaxed">
              تتيح لك هذه الأداة سحب ملف قاعدة البيانات SQLite المركزية المباشر أو ملف JSON يحتوي على كامل بيانات كل الجداول (المستخدمين، المنتجات، المبيعات، المشتريات، الموردين) لحفظه بآمان.
            </p>

            <div className="space-y-2 pt-2">
              <a
                href="/api/backup/download-sqlite"
                download
                className="w-full h-10 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-extrabold text-xs flex items-center justify-center gap-x-4 gap-y-2 cursor-pointer transition-colors"
              >
                <HardDrive size={16} />
                <span>تنزيل ملف SQLite المباشر (.sqlite)</span>
              </a>

              <a
                href="/api/backup/download-json"
                download
                className="w-full h-10 bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] font-extrabold text-xs flex items-center justify-center gap-x-4 gap-y-2 cursor-pointer transition-colors"
              >
                <Download size={16} />
                <span>تنزيل ملف النسخة الاحتياطية (.json)</span>
              </a>
            </div>
          </div>

          <div className="bg-[#c3c6bb] p-6 border border-[#222222] space-y-4">
            <h2 className="text-sm font-black text-[#000000]">استعادة النسخة الاحتياطية</h2>
            
            {backupMessage.text && (
              <div className={`p-3 border text-xs font-bold ${
                backupMessage.type === "success" ? "bg-[#a8b898] text-[#000000]" : "bg-[#d8a8a8] text-[#550000]"
              }`}>
                {backupMessage.text}
              </div>
            )}

            <form onSubmit={handleRestoreBackup} className="space-y-3">
              <textarea
                value={restoreJson}
                onChange={(e) => setRestoreJson(e.target.value)}
                rows={4}
                dir="ltr"
                className="w-full p-2.5 bg-[#b8bcb2] border border-[#888888] font-mono text-[11px] focus:outline-none"
                placeholder="ألصق كود النسخة الاحتياطية JSON هنا..."
                required
              />

              <button
                type="submit"
                disabled={isRestoring}
                className="w-full h-10 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-extrabold text-xs flex items-center justify-center gap-x-4 gap-y-2 cursor-pointer"
              >
                <Upload size={16} />
                <span>{isRestoring ? "جاري الاستعادة..." : "تنفيذ استعادة البيانات"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: USERS & ROOT ACCOUNTS */}
      {activeSubTab === "users" && (
        <div className="bg-[#c3c6bb] p-6 border border-[#222222] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#000000]">قائمة الحسابات المسجلة في النظام</h2>
            <button
              onClick={fetchUsers}
              className="px-2.5 py-1 bg-[#222222] text-[#c3c6bb] text-xs font-bold cursor-pointer hover:bg-[#000000]"
            >
              تحديث القائمة
            </button>
          </div>

          <div className="overflow-x-auto border border-[#222222]">
            <table className="w-full text-right text-xs min-w-[600px] border-collapse">
              <thead>
                <tr className="bg-[#222222] text-[#c3c6bb]">
                  <th className="p-2.5 border border-[#444444] font-bold">المعرف</th>
                  <th className="p-2.5 border border-[#444444] font-bold">اسم الحساب</th>
                  <th className="p-2.5 border border-[#444444] font-bold">الاسم الظاهر</th>
                  <th className="p-2.5 border border-[#444444] font-bold">الرتبة</th>
                  <th className="p-2.5 border border-[#444444] font-bold">الصلاحيات</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => (
                  <tr key={u.id} className={`border-b border-[#888888] ${u.username === "innocode" ? "bg-[#a8b898] font-bold" : "hover:bg-[#b8bcb2]"}`}>
                    <td className="p-2.5 border border-[#888888] font-mono">{u.id}</td>
                    <td className="p-2.5 border border-[#888888] font-bold text-[#000000]">
                      {u.username} {u.username === "innocode" && <span className="mr-1 text-[10px] bg-[#222222] text-[#c3c6bb] px-1.5 py-0.5">(المبرمج)</span>}
                    </td>
                    <td className="p-2.5 border border-[#888888]">{u.name}</td>
                    <td className="p-2.5 border border-[#888888] font-bold">{u.role}</td>
                    <td className="p-2.5 border border-[#888888] text-[10px] text-[#333333]">
                      {Array.isArray(u.permissions) ? u.permissions.join(" | ") : String(u.permissions)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
