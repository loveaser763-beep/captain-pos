import React, { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Store,
  Percent,
  Save,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Users,
  Trash2,
  Edit,
  Database,
  Download,
  HardDrive,
  FileJson,
  Camera,
  ArchiveRestore,
  Printer
} from "lucide-react";
import { User } from "../types";
import { authFetch } from "../authFetch";

interface SettingsProps {
  currentUser: User | null;
}

export default function Settings({ currentUser }: SettingsProps) {
  const [settings, setSettings] = useState({
    market_name: "",
    market_phone: "",
    market_address: "",
    tax_rate: "14",
    currency: "ج.م",
    receipt_footer: ""
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Printer Settings
  const [printerType, setPrinterType] = useState("thermal-80");
  const [printerName, setPrinterName] = useState("");

  // Partners CRUD State
  const [partners, setPartners] = useState<any[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [partnersError, setPartnersError] = useState("");
  const [partnersSuccess, setPartnersSuccess] = useState("");
  const [savingPartner, setSavingPartner] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ id: 0, name: "", fixed_profit_percentage: 0, purchase_percentage: 0 });

  // Full System Snapshot State
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapMsg, setSnapMsg] = useState("");
  const [restoring, setRestoring] = useState(false);

  const loadSnapshots = async () => {
    try {
      const res = await authFetch("/api/system/snapshots");
      if (res.ok) setSnapshots(await res.json());
    } catch {}
  };

  useEffect(() => { loadSnapshots(); }, []);

  const handleTakeSnapshot = async () => {
    if (!confirm("أخذ نسخة شاملة الآن؟ (الأكواد + الصفحات + الإعدادات + قاعدة البيانات)")) return;
    setSnapLoading(true);
    setSnapMsg("");
    try {
      const res = await authFetch("/api/system/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: currentUser?.name || "المدير" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSnapMsg(`تم حفظ النسخة: ${data.filename} (${(data.size / 1024).toFixed(1)} KB) في backups/system-snapshots`);
        loadSnapshots();
      } else {
        setSnapMsg(data.error || "فشل إنشاء النسخة");
      }
    } catch {
      setSnapMsg("فشل الاتصال بالخادم");
    } finally {
      setSnapLoading(false);
    }
  };

  const handleRestoreSnapshot = async () => {
    const fileInput = document.getElementById("snapshot-restore-file") as HTMLInputElement;
    if (!fileInput.files || fileInput.files.length === 0) {
      alert("الرجاء اختيار ملف النسخة (.zip) أولاً");
      return;
    }
    if (!confirm("تحذير أخير: سيتم استبدال النظام الحالي بالكامل بالنسخة المختارة (مع حفظ نسخة أمان تلقائية). متابعة؟")) return;
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append("snapshot", fileInput.files[0]);
      const res = await authFetch("/api/system/restore-snapshot", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message + " سيتوقف السيرفر الآن - شغله من start-3001.bat");
      } else {
        alert(data.error || "فشلت الاستعادة");
      }
    } catch {
      alert("فشل الاتصال بالخادم");
    } finally {
      setRestoring(false);
    }
  };

  const isAdmin = currentUser?.role === "admin";

  const fetchSettings = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/settings");
      if (!response.ok) throw new Error("فشلت الشبكة في تحميل الإعدادات.");
      const data = await response.json();
      setSettings({
        market_name: data.market_name || "",
        market_phone: data.market_phone || "",
        market_address: data.market_address || "",
        tax_rate: data.tax_rate || "14",
        currency: data.currency || "ج.م",
        receipt_footer: data.receipt_footer || ""
      });
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPartners = async () => {
    setPartnersLoading(true);
    setPartnersError("");
    try {
      const response = await authFetch("/api/partners");
      if (!response.ok) throw new Error("فشل تحميل قائمة الشركاء.");
      const list = await response.json();
      setPartners(list);
    } catch (err: any) {
      setPartnersError(err.message || "حدث خطأ أثناء جلب بيانات الشركاء.");
    } finally {
      setPartnersLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchPartners();
    // Load printer settings from localStorage
    const savedPrinterType = localStorage.getItem("captain_printer_type") || "thermal-80";
    const savedPrinterName = localStorage.getItem("captain_printer_name") || "";
    setPrinterType(savedPrinterType);
    setPrinterName(savedPrinterName);
  }, []);

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setPartnersError("عذراً، هذه الخاصية مسموحة فقط للمدير العام.");
      return;
    }
    if (!partnerForm.name.trim()) {
      setPartnersError("يرجى كتابة اسم الشريك.");
      return;
    }

    setSavingPartner(true);
    setPartnersError("");
    setPartnersSuccess("");
    const isEdit = partnerForm.id > 0;
    const url = isEdit ? `/api/partners/${partnerForm.id}` : "/api/partners";
    const method = isEdit ? "PUT" : "POST";

    try {
      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: partnerForm.name.trim(),
          fixed_profit_percentage: partnerForm.fixed_profit_percentage,
          purchase_percentage: partnerForm.purchase_percentage,
          logCreator: currentUser?.name || "المدير العام"
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "فشل حفظ الشريك.");
      }

      setPartnersSuccess(isEdit ? "تم تحديث بيانات الشريك بنجاح." : "تم تسجيل الشريك الجديد بنجاح.");
      setPartnerForm({ id: 0, name: "", fixed_profit_percentage: 0, purchase_percentage: 0 });
      fetchPartners();
    } catch (err: any) {
      setPartnersError(err.message || "حدث خطأ أثناء حفظ الشريك.");
    } finally {
      setSavingPartner(false);
    }
  };

  const handleDeletePartner = async (id: number) => {
    if (!isAdmin) {
      setPartnersError("عذراً، هذه الخاصية مسموحة فقط للمدير العام.");
      return;
    }
    if (!window.confirm("هل أنت متأكد من حذف هذا الشريك؟")) return;

    setPartnersError("");
    setPartnersSuccess("");
    try {
      const response = await authFetch(`/api/partners/${id}?logCreator=${encodeURIComponent(currentUser?.name || "المدير العام")}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "فشل حذف الشريك.");
      }

      setPartnersSuccess("تم حذف الشريك بنجاح.");
      if (partnerForm.id === id) {
        setPartnerForm({ id: 0, name: "", fixed_profit_percentage: 0, purchase_percentage: 0 });
      }
      fetchPartners();
    } catch (err: any) {
      setPartnersError(err.message || "حدث خطأ أثناء حذف الشريك.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError("عذراً، تقتصر الإعدادات على مدير النظام فقط.");
      return;
    }
    
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await authFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          user_name: currentUser?.name || "المدير العام"
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "فشل حفظ الإعدادات.");
      }

      setMessage("تم تحديث إعدادات المتجر بنجاح.");
      
      localStorage.setItem("supermarket_market_name", settings.market_name);
      localStorage.setItem("supermarket_market_phone", settings.market_phone);
      localStorage.setItem("supermarket_tax_rate", settings.tax_rate);
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع.");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="w-full p-6 flex flex-col items-center justify-center text-right select-none font-sans" id="settings-unauthorized" style={{ direction: "rtl" }}>
        <div className="bg-[#c3c6bb] p-6 border border-[#222222] text-center max-w-md space-y-3">
          <AlertTriangle size={24} strokeWidth={1.5} className="mx-auto text-[#222222]" />
          <h3 className="text-sm font-black text-[#000000]">صلاحية الوصول غير متاحة</h3>
          <p className="text-xs text-[#555555] font-semibold leading-relaxed">
            تعديل الإعدادات العامة للمتجر يقتصر على المدير العام للنظام.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 select-none font-sans" id="settings-view" style={{ direction: "rtl" }}>
      {/* Header */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#000000] flex items-center gap-2">
            <SettingsIcon size={20} strokeWidth={1.5} />
            <span>إعدادات النظام وهوية المتجر</span>
          </h2>
          <p className="text-xs text-[#555555] font-semibold mt-1">بيانات الطباعة الحرارية، نسب الضرائب، والشركاء</p>
        </div>
        <button
          onClick={fetchSettings}
          className="h-9 px-3 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0"
        >
          <RotateCcw size={16} strokeWidth={1.5} />
          <span>إعادة تحميل</span>
        </button>
      </div>

      {message && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="settings-success">
          <CheckCircle size={16} strokeWidth={1.5} className="text-[#000000] shrink-0" />
          <p>{message}</p>
        </div>
      )}

      {error && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="settings-error">
          <AlertTriangle size={16} strokeWidth={1.5} className="text-[#222222] shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-[#555555] font-bold text-xs bg-[#c3c6bb] border border-[#222222]">
          جاري تحميل الإعدادات...
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-[#c3c6bb] border border-[#222222] p-4 space-y-4" id="settings-form">
          <div className="grid grid-cols-12 gap-4">
            
            {/* Store Branding */}
            <div className="col-span-12 md:col-span-6 space-y-3">
              <h3 className="text-sm font-extrabold text-[#000000] border-b border-[#888888] pb-2 flex items-center gap-2">
                <Store size={16} strokeWidth={1.5} />
                <span>بيانات المتجر والطباعة الحرارية</span>
              </h3>

              <div className="space-y-3 text-xs font-bold text-[#000000]">
                <div>
                  <label className="block text-[#000000] mb-1">اسم المتجر</label>
                  <input
                    type="text"
                    value={settings.market_name}
                    onChange={(e) => setSettings({ ...settings, market_name: e.target.value })}
                    placeholder="اسم المتجر..."
                    required
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>

                <div>
                  <label className="block text-[#000000] mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={settings.market_phone}
                    onChange={(e) => setSettings({ ...settings, market_phone: e.target.value })}
                    placeholder="رقم الهاتف..."
                    required
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>

                <div>
                  <label className="block text-[#000000] mb-1">العنوان</label>
                  <input
                    type="text"
                    value={settings.market_address}
                    onChange={(e) => setSettings({ ...settings, market_address: e.target.value })}
                    placeholder="العنوان التفصيلي..."
                    required
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
              </div>
            </div>

            {/* Financial Rules */}
            <div className="col-span-12 md:col-span-6 space-y-3">
              <h3 className="text-sm font-extrabold text-[#000000] border-b border-[#888888] pb-2 flex items-center gap-2">
                <Percent size={16} strokeWidth={1.5} />
                <span>الضرائب والعملة الرسمية</span>
              </h3>

              <div className="space-y-3 text-xs font-bold text-[#000000]">
                <div>
                  <label className="block text-[#000000] mb-1">نسبة ضريبة القيمة المضافة (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={settings.tax_rate}
                    onChange={(e) => setSettings({ ...settings, tax_rate: e.target.value })}
                    required
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>

                <div>
                  <label className="block text-[#000000] mb-1">رمز العملة الرئيسي</label>
                  <input
                    type="text"
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    placeholder="مثال: ج.م"
                    required
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>

                <div>
                  <label className="block text-[#000000] mb-1">ملاحظات أسفل إيصال الطباعة</label>
                  <textarea
                    rows={2}
                    value={settings.receipt_footer}
                    onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
                    placeholder="نص الترحيب والشكر أسفل الفاتورة..."
                    required
                    className="w-full bg-[#b8bcb2] border border-[#888888] p-2 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="pt-3 border-t border-[#888888] flex justify-end">
            <button
              type="submit"
              id="btn-save-supermarket-settings"
              disabled={saving}
              className="h-9 px-5 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <Save size={16} strokeWidth={1.5} />
              <span>{saving ? "جاري الحفظ..." : "حفظ الإعدادات"}</span>
            </button>
          </div>
        </form>
      )}

      {/* Printer Settings */}
      <div className="bg-[#c3c6bb] border border-[#222222] p-4 space-y-4" id="settings-printer-section">
        <div className="border-b border-[#888888] pb-3">
          <h3 className="text-sm font-extrabold text-[#000000] flex items-center gap-2">
            <Printer size={16} strokeWidth={1.5} />
            <span>إعدادات الطابعة</span>
          </h3>
          <p className="text-xs text-[#555555] font-semibold mt-0.5">اختيار نوع الطابعة وحجم الورق للطباعة الحرارية</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3 text-xs font-bold text-[#000000]">
            <div>
              <label className="block text-[#000000] mb-1">نوع الطابعة</label>
              <select
                value={printerType}
                onChange={(e) => {
                  setPrinterType(e.target.value);
                  localStorage.setItem("captain_printer_type", e.target.value);
                }}
                className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] cursor-pointer"
              >
                <option value="thermal-80">طابعة حرارية 80mm (فوجيتسو، إلخ)</option>
                <option value="thermal-58">طابعة حرارية 58mm</option>
                <option value="a4">طابعة عادية A4</option>
              </select>
            </div>

            <div>
              <label className="block text-[#000000] mb-1">اسم الطابعة (اختياري)</label>
              <input
                type="text"
                value={printerName}
                onChange={(e) => {
                  setPrinterName(e.target.value);
                  localStorage.setItem("captain_printer_name", e.target.value);
                }}
                placeholder="اتركه فارغاً للاختيار التلقائي..."
                className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
              />
            </div>
          </div>

          <div className="bg-[#b8bcb2] p-3 border border-[#888888] text-xs text-[#555555] font-semibold space-y-2">
            <p className="font-extrabold text-[#000000]">ملاحظات:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>80mm:</strong> فوجيتسو FP-1000 وأي طابعة حرارية بعرض 80mm</li>
              <li><strong>58mm:</strong> طابعات حرارية صغيرة (Rolex, Xprinter, إلخ)</li>
              <li><strong>A4:</strong> أي طابعة عادية (HP, Canon, Epson, إلخ)</li>
              <li>اسم الطابعة يتعرف تلقائياً لو تركته فارغاً</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Partners Manager */}
      <div className="bg-[#c3c6bb] border border-[#222222] p-4 space-y-4" id="settings-partners-fixed-section">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-x-4 gap-y-2 border-b border-[#888888] pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#000000] flex items-center gap-2">
              <Users size={16} strokeWidth={1.5} />
              <span>إدارة الشركاء والاستثمار</span>
            </h3>
            <p className="text-xs text-[#555555] font-semibold mt-0.5">تسجيل الشركاء وتحديد نسب أرباحهم ومشترياتهم</p>
          </div>
          <button
            onClick={() => {
              setPartnerForm({ id: 0, name: "", fixed_profit_percentage: 0, purchase_percentage: 0 });
              setPartnersError("");
              setPartnersSuccess("");
            }}
            className="h-8 px-3 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] text-xs font-bold text-[#000000] transition-colors cursor-pointer"
          >
            إعادة تعيين
          </button>
        </div>

        {partnersSuccess && (
          <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="partners-success">
            <CheckCircle size={16} strokeWidth={1.5} className="text-[#000000] shrink-0" />
            <p>{partnersSuccess}</p>
          </div>
        )}

        {partnersError && (
          <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="partners-error">
            <AlertTriangle size={16} strokeWidth={1.5} className="text-[#222222] shrink-0" />
            <p>{partnersError}</p>
          </div>
        )}

        <div className="grid grid-cols-12 gap-x-4 gap-y-2 text-right">
          {/* Form */}
          <div className="col-span-12 lg:col-span-5 bg-[#b8bcb2] p-3 border border-[#888888] space-y-3">
            <h4 className="text-xs font-extrabold text-[#000000] border-b border-[#888888] pb-1.5">
              {partnerForm.id > 0 ? "تعديل الشريك" : "تسجيل شريك جديد"}
            </h4>

            <form onSubmit={handleSavePartner} className="space-y-3 text-xs font-bold text-[#000000]">
              <div>
                <label className="block text-[#000000] mb-1">اسم الشريك</label>
                <input
                  type="text"
                  value={partnerForm.name}
                  onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                  placeholder="اسم الشريك..."
                  required
                  className="w-full h-9 bg-[#c3c6bb] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <label className="block text-[#000000] mb-1">نسبة الأرباح (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={partnerForm.fixed_profit_percentage || ""}
                    onChange={(e) => setPartnerForm({ ...partnerForm, fixed_profit_percentage: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full h-9 bg-[#c3c6bb] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>

                <div>
                  <label className="block text-[#000000] mb-1">نسبة المشتريات (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={partnerForm.purchase_percentage || ""}
                    onChange={(e) => setPartnerForm({ ...partnerForm, purchase_percentage: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full h-9 bg-[#c3c6bb] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPartner}
                className="w-full h-9 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors cursor-pointer disabled:opacity-40 mt-1"
              >
                {savingPartner ? "جاري الحفظ..." : partnerForm.id > 0 ? "تحديث الشريك" : "تسجيل الشريك"}
              </button>
            </form>
          </div>

          {/* List */}
          <div className="col-span-12 lg:col-span-7 space-y-3">
            <h4 className="text-xs font-extrabold text-[#000000] border-b border-[#888888] pb-1.5">
              قائمة الشركاء ({partners.length})
            </h4>

            {partnersLoading ? (
              <div className="p-8 text-center text-[#555555] font-bold text-xs bg-[#b8bcb2] border border-[#888888]">
                جاري تحميل بيانات الشركاء...
              </div>
            ) : partners.length === 0 ? (
              <div className="p-8 text-center text-[#555555] bg-[#b8bcb2] border border-[#888888] text-xs font-bold">
                لا يوجد شركاء مسجلين حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 max-h-72 overflow-y-auto">
                {partners.map((p) => (
                  <div key={p.id} className="bg-[#b8bcb2] border border-[#888888] p-3 flex flex-col justify-between space-y-2">
                    <div className="space-y-2 text-xs font-bold text-[#000000]">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold">{p.name}</span>
                        <span className="bg-[#c3c6bb] px-2 py-0.5 text-xs font-mono">#{p.id}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 bg-[#c3c6bb] p-2 border border-[#888888]/40 text-xs">
                        <div><span className="text-[#555555]">أرباح:</span> {p.fixed_profit_percentage}%</div>
                        <div><span className="text-[#555555]">مشتريات:</span> {p.purchase_percentage}%</div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#888888]/40 flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setPartnerForm({ ...p });
                          setPartnersError("");
                          setPartnersSuccess("");
                        }}
                        className="w-7 h-7 flex items-center justify-center bg-[#c3c6bb] hover:bg-[#222222] hover:text-[#c3c6bb] text-[#000000] border border-[#888888] cursor-pointer"
                        title="تعديل"
                      >
                        <Edit size={14} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => handleDeletePartner(p.id)}
                        className="w-7 h-7 flex items-center justify-center bg-[#c3c6bb] hover:bg-[#222222] hover:text-[#c3c6bb] text-[#000000] border border-[#888888] cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Database Backup & Export Section */}
      <div className="bg-[#c3c6bb] border border-[#222222] p-4 space-y-4" id="settings-database-backup-section">
        <div className="border-b border-[#888888] pb-3">
          <h3 className="text-sm font-extrabold text-[#000000] flex items-center gap-2">
            <Database size={16} strokeWidth={1.5} />
            <span>النسخ الاحتياطي وتصدير قاعدة البيانات (SQLite Backup)</span>
          </h3>
          <p className="text-xs text-[#555555] font-semibold mt-0.5">
            تنزيل وحفظ نسخة احتياطية من كافة سجلات وبيانات المنظومة لضمان سلامتها وأمانها.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
          {/* SQLite Direct File Download */}
          <div className="bg-[#b8bcb2] p-4 border border-[#888888] space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-[#000000]">
                <HardDrive size={18} strokeWidth={1.5} />
                <span>تنزيل ملف قاعدة البيانات SQLite المباشر (.sqlite)</span>
              </div>
              <p className="text-xs text-[#555555] font-semibold leading-relaxed">
                يقوم بسحب وتنزيل ملف قاعدة البيانات المركزية الحقيقي <code className="bg-[#c3c6bb] px-1 font-mono text-[11px]">database.sqlite</code> بكافة جداوله وبياناته لضمان الاستعادة الكاملة في أي وقت.
              </p>
            </div>

            <a
              href="/api/backup/download-sqlite"
              download
              className="h-10 px-4 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-extrabold text-xs flex items-center justify-center gap-x-4 gap-y-2 transition-colors cursor-pointer w-full text-center"
            >
              <Download size={16} strokeWidth={1.5} />
              <span>تنزيل ملف SQLite الأساسي (.sqlite)</span>
            </a>
          </div>

          
          {/* SQLite Direct File Import */}
          <div className="bg-[#b8bcb2] p-4 border border-[#888888] space-y-3 flex flex-col justify-between md:col-span-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-[#000000]">
                <HardDrive size={18} strokeWidth={1.5} />
                <span>استيراد واستعادة قاعدة البيانات (.sqlite)</span>
              </div>
              <p className="text-xs text-[#555555] font-semibold leading-relaxed">
                قم برفع ملف قاعدة البيانات بصيغة .sqlite لاستعادته. تحذير: سيتم استبدال قاعدة البيانات الحالية بالكامل وإعادة التشغيل.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <input 
                type="file" 
                accept=".sqlite" 
                id="sqlite-import-file"
                className="text-xs w-full bg-[#c3c6bb] border border-[#888888] p-2 focus:outline-none"
              />
              <button 
                onClick={async () => {
                  const fileInput = document.getElementById('sqlite-import-file') as HTMLInputElement;
                  if (!fileInput.files || fileInput.files.length === 0) {
                    alert('الرجاء تحديد ملف أولاً');
                    return;
                  }
                  
                  if (!confirm('هل أنت متأكد من رغبتك في استبدال قاعدة البيانات الحالية؟ سيتم مسح كافة البيانات الحالية واستبدالها بالملف المرفوع.')) {
                    return;
                  }

                  const formData = new FormData();
                  formData.append('database', fileInput.files[0]);

                  try {
                    const res = await authFetch('/api/database/import', {
                      method: 'POST',
                      body: formData,
                    });
                    const data = await res.json();
                    if (res.ok) {
                      alert(data.message || 'تم بنجاح');
                      setTimeout(() => window.location.reload(), 1500);
                    } else {
                      alert(data.error || 'حدث خطأ');
                    }
                  } catch (e) {
                    alert('فشل الاتصال بالخادم');
                  }
                }}
                className="h-10 px-6 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-extrabold text-xs flex items-center justify-center gap-x-2 transition-colors cursor-pointer w-full sm:w-auto whitespace-nowrap"
              >
                <RotateCcw size={16} strokeWidth={1.5} />
                <span>استعادة البيانات</span>
              </button>
            </div>
          </div>

          {/* JSON Structured Backup Download */}
          <div className="bg-[#b8bcb2] p-4 border border-[#888888] space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-[#000000]">
                <FileJson size={18} strokeWidth={1.5} />
                <span>تنزيل ملف النسخة الاحتياطية المنسق (.json)</span>
              </div>
              <p className="text-xs text-[#555555] font-semibold leading-relaxed">
                تصدير كافة بيانات النظام (الأصناف، الفواتير، الموردين، الحسابات، السجلات) كملف بيانات منسق بحجم خفيف لسهولة القراءة والاستعادة.
              </p>
            </div>

            <a
              href="/api/backup/download-json"
              download
              className="h-10 px-4 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-extrabold text-xs flex items-center justify-center gap-x-4 gap-y-2 transition-colors cursor-pointer w-full text-center"
            >
              <Download size={16} strokeWidth={1.5} />
              <span>تنزيل نسخة JSON الاحتياطية (.json)</span>
            </a>
          </div>

          {/* Full System Snapshot */}
          <div className="bg-[#b8bcb2] p-4 border-2 border-[#222222] space-y-3 md:col-span-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-[#000000]">
                <Camera size={18} strokeWidth={1.5} />
                <span>النسخة الشاملة للسيستم (الأكواد + الصفحات + الإعدادات + قاعدة البيانات)</span>
              </div>
              <p className="text-xs text-[#555555] font-semibold leading-relaxed">
                زر واحد يضغط المشروع كاملاً في ملف ZIP بتاريخ اليوم ويحفظه في <code className="bg-[#c3c6bb] px-1 font-mono text-[11px]">backups/system-snapshots</code>. الاستعادة ترجع كل شيء كما كان (مع نسخة أمان تلقائية قبل الاستبدال) ثم يعاد تشغيل السيرفر.
              </p>
              {snapMsg && (
                <p className="text-xs font-bold text-[#000000] bg-[#c3c6bb] border border-[#888888] p-2">{snapMsg}</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleTakeSnapshot}
                disabled={snapLoading}
                className="h-10 px-6 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-extrabold text-xs flex items-center justify-center gap-x-2 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Camera size={16} strokeWidth={1.5} />
                <span>{snapLoading ? "جاري الحفظ..." : "حفظ النسخة الشاملة الآن"}</span>
              </button>
              <button
                onClick={loadSnapshots}
                className="h-10 px-4 bg-[#c3c6bb] hover:bg-[#b8bcb2] text-[#000000] font-extrabold text-xs flex items-center justify-center gap-x-2 transition-colors cursor-pointer border border-[#888888] whitespace-nowrap"
              >
                <RotateCcw size={16} strokeWidth={1.5} />
                <span>تحديث القائمة</span>
              </button>
            </div>

            {snapshots.length > 0 && (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {snapshots.map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-2 bg-[#c3c6bb] border border-[#888888] px-3 py-2 text-xs font-bold text-[#000000]">
                    <span className="truncate font-mono" title={s.name}>{s.name} ({(s.size / 1024).toFixed(1)} KB)</span>
                    <a
                      href={`/api/system/snapshot/download/${s.name}`}
                      download
                      className="px-3 py-1.5 bg-[#222222] text-[#c3c6bb] text-[11px] font-extrabold hover:bg-[#000000] transition-colors whitespace-nowrap"
                    >
                      تنزيل
                    </a>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-[#888888] pt-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-[#000000]">
                <ArchiveRestore size={18} strokeWidth={1.5} />
                <span>استعادة شاملة من ملف</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-center">
                <input
                  type="file"
                  accept=".zip"
                  id="snapshot-restore-file"
                  className="text-xs w-full bg-[#c3c6bb] border border-[#888888] p-2 focus:outline-none"
                />
                <button
                  onClick={handleRestoreSnapshot}
                  disabled={restoring}
                  className="h-10 px-6 bg-[#7a1f1f] hover:bg-[#5c1414] text-white font-extrabold text-xs flex items-center justify-center gap-x-2 transition-colors cursor-pointer w-full sm:w-auto whitespace-nowrap disabled:opacity-50"
                >
                  <ArchiveRestore size={16} strokeWidth={1.5} />
                  <span>{restoring ? "جاري الاستعادة..." : "استعادة النسخة"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
