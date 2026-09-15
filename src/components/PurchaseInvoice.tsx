import React, { useState, useEffect, useRef } from "react";
import {
  TrendingDown,
  Plus,
  Trash2,
  FileText,
  Truck,
  Calculator,
  CheckCircle,
  AlertTriangle,
  X,
  Printer,
  RefreshCw,
  Search,
  Save,
  Download,
  ExternalLink,
  Keyboard
} from "lucide-react";
import { Supplier, Item, UnitType, User } from "../types";
import { authFetch } from "../authFetch";
import UnifiedPrintButton from "./UnifiedPrintButton";

interface PurchaseInvoiceProps {
  currentUser: User | null;
}

export default function PurchaseInvoice({ currentUser }: PurchaseInvoiceProps) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [paymentSource, setPaymentSource] = useState<"cash_register" | "main_safe">("main_safe");

  // Print Preview Dialog States
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showShortcutsPopover, setShowShortcutsPopover] = useState(false);
  const [printData, setPrintData] = useState<any>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [imageSavedStatus, setImageSavedStatus] = useState("");
  const [savedImageUrl, setSavedImageUrl] = useState("");
  const [savedFilename, setSavedFilename] = useState("");

  // Suppliers & Products
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dbItems, setDbItems] = useState<Item[]>([]);

  // Cart
  type PurchaseItemInput = {
    barcode: string;
    name: string;
    quantity: number;
    unit: string;
    purchase_price: number;
    retail_price: number;
    wholesale_price: number;
    total: number;
  };
  const [items, setItems] = useState<PurchaseItemInput[]>([]);

  // Dynamic values
  const [searchCode, setSearchCode] = useState("");
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showInvoiceHistory, setShowInvoiceHistory] = useState(false);
  const [historyInvoices, setHistoryInvoices] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadInvoiceHistory = async () => {
    setHistoryLoading(true);
    setShowInvoiceHistory(true);
    try {
      const res = await authFetch("/api/invoices?type=purchases");
      if (res.ok) {
        const data = await res.json();
        setHistoryInvoices(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleReprintInvoice = async (invoiceId: number) => {
    try {
      const res = await authFetch(`/api/invoices/${invoiceId}`);
      if (res.ok) {
        const { invoice, items } = await res.json();
        setPrintData({
          invoice_number: invoice.invoice_number,
          date: invoice.date,
          supplier_name: invoice.customer_supplier_name,
          payment_source: invoice.payment_source,
          subtotal: invoice.subtotal || invoice.total,
          tax: invoice.tax || 0,
          discount: invoice.discount || 0,
          total: invoice.total,
          paid: invoice.paid || 0,
          remaining: invoice.remaining || 0,
          items: items.map((it: any) => ({
            name: it.name || it.item_name,
            quantity: it.quantity,
            unit: it.unit || "",
            price: it.price || 0,
            total: it.total || 0
          })),
          cashier: invoice.cashier || "الكاشير",
          marketName: "سوبرماركت المدينة المنورة",
          marketPhone: ""
        });
        setShowInvoiceHistory(false);
        setShowPrintModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };
  const [success, setSuccess] = useState("");

  const units: UnitType[] = ["كرتونة", "قطعة", "دستة", "علبة", "كيلو", "جرام", "متر", "وحدة"];

  const buildConfigs = async () => {
    try {
      const supResponse = await authFetch("/api/suppliers");
      const supData = await supResponse.json();
      setSuppliers(supData);
      // No default supplier selected

      const itemResponse = await authFetch("/api/items");
      const itemData = await itemResponse.json();
      setDbItems(itemData);
    } catch (err) {
      console.error("خطأ أثناء جلب التهيئة للمشتريات", err);
    }
  };

  const searchBarRef = useRef<HTMLInputElement>(null);
  const handleSubmitRef = useRef<any>(null);

  const generateInvoiceProps = () => {
    const formattedDate = new Date().toISOString().split("T")[0];
    setDate(formattedDate);
    const randNum = Math.floor(100000 + Math.random() * 900000);
    setInvoiceNumber(`PINV-${randNum}`);
  };

  useEffect(() => {
    buildConfigs();
    generateInvoiceProps();
    if (searchBarRef.current) {
      searchBarRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const lowerKey = key.toLowerCase();

      // Save Invoice: Alt+1 OR Ctrl+Enter OR F1
      if ((e.altKey && key === "1") || (e.ctrlKey && key === "Enter") || key === "F1") {
        e.preventDefault();
        if (handleSubmitRef.current) {
          handleSubmitRef.current();
        }
      } 
      // Focus Search: Alt+2 OR Alt+B OR F2
      else if ((e.altKey && (key === "2" || lowerKey === "b")) || key === "F2") {
        e.preventDefault();
        if (searchBarRef.current) {
          searchBarRef.current.focus();
          searchBarRef.current.select();
        }
      } 
      // Insert Row: Alt+3 OR Alt+N OR F3
      else if ((e.altKey && (key === "3" || lowerKey === "n")) || key === "F3") {
        e.preventDefault();
        addNewItemRow();
      } 
      // Clear Items: Alt+7 OR Alt+C OR F10
      else if ((e.altKey && (key === "7" || lowerKey === "c")) || key === "F10") {
        e.preventDefault();
        setItems([]);
      } 
      // Escape
      else if (key === "Escape" || key === "Esc") {
        if (showPrintModal) {
          e.preventDefault();
          setShowPrintModal(false);
        } else if (searchCode) {
          e.preventDefault();
          setSearchCode("");
          setSearchResults([]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPrintModal, searchCode]);

  // Handle Search Input Change
  useEffect(() => {
    const searchItems = async () => {
      if (!searchCode) {
        setSearchResults([]);
        return;
      }
      try {
        const response = await authFetch(`/api/items/search?query=${encodeURIComponent(searchCode)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);

          const exactMatch = data.find((i: Item) => i.barcode === searchCode);
          if (exactMatch) {
            addExistingProductToInvoice(exactMatch);
            setSearchCode("");
            setSearchResults([]);
          }
        }
      } catch (err) {
        console.error("خطأ أثناء البحث المتزامن للمشتريات", err);
      }
    };

    const timer = setTimeout(searchItems, 200);
    return () => clearTimeout(timer);
  }, [searchCode]);

  const addExistingProductToInvoice = (found: Item) => {
    if (!supplierName) {
      setError("الرجاء اختيار المورد أولاً قبل إضافة الأصناف.");
      return;
    }
    // No supplier_name check - allow adding any product to any supplier
    const existingIdx = items.findIndex((it) => it.barcode === found.barcode);
    if (existingIdx > -1) {
      const updated = [...items];
      updated[existingIdx].quantity += 1;
      updated[existingIdx].total = updated[existingIdx].quantity * updated[existingIdx].purchase_price;
      setItems(updated);
    } else {
      const newItem: PurchaseItemInput = {
        barcode: found.barcode,
        name: found.name,
        quantity: 1,
        unit: found.unit,
        purchase_price: found.purchase_price,
        retail_price: found.retail_price,
        wholesale_price: found.wholesale_price,
        total: found.purchase_price
      };
      setItems([...items, newItem]);
    }
  };

  const handleReloadStock = async () => {
    const itemResponse = await authFetch("/api/items");
    const itemData = await itemResponse.json();
    setDbItems(itemData);
  };

  const handleBarcodeSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      triggerBarcodeSearch();
    }
  };

  const triggerBarcodeSearch = () => {
    if (!searchCode) return;
    setError("");

    const found = dbItems.find((p) => p.barcode === searchCode);
    if (found) {
      addExistingProductToInvoice(found);
      setSearchCode("");
      setSearchResults([]);
    } else {
      const newItem: PurchaseItemInput = {
        barcode: searchCode,
        name: "",
        quantity: "" as any,
        unit: "قطعة",
        purchase_price: "" as any,
        retail_price: "" as any,
        wholesale_price: "" as any,
        total: 0
      };
      setItems([...items, newItem]);
      setSearchCode("");
      setSearchResults([]);
    }
  };

  const addNewItemRow = () => {
    const newItem: PurchaseItemInput = {
      barcode: "",
      name: "",
      quantity: "" as any,
      unit: "قطعة",
      purchase_price: "" as any,
      retail_price: "" as any,
      wholesale_price: "" as any,
      total: 0
    };
    setItems([...items, newItem]);
  };

  const updateRowField = (idx: number, field: keyof PurchaseItemInput, val: any) => {
    const updated = [...items];
    const item = updated[idx];

    if (field === "barcode") {
      const found = dbItems.find(p => p.barcode === val);
      if (found) {
        item.barcode = found.barcode;
        item.name = found.name;
        item.unit = found.unit;
        item.purchase_price = found.purchase_price;
        item.retail_price = found.retail_price;
        item.wholesale_price = found.wholesale_price;
        item.total = item.quantity * found.purchase_price;
        setError("");
      } else {
        item.barcode = val;
      }
    }
    else if (field === "name") item.name = val;
    else if (field === "unit") item.unit = val;
    else if (field === "quantity") {
      item.quantity = val === "" ? ("" as any) : (Number(val) || 0);
      item.total = (Number(item.quantity) || 0) * (Number(item.purchase_price) || 0);
    } else if (field === "purchase_price") {
      item.purchase_price = val === "" ? ("" as any) : (Number(val) || 0);
      item.total = (Number(item.quantity) || 0) * (Number(item.purchase_price) || 0);
    } else if (field === "retail_price") item.retail_price = val === "" ? ("" as any) : (Number(val) || 0);
    else if (field === "wholesale_price") item.wholesale_price = val === "" ? ("" as any) : (Number(val) || 0);

    setItems(updated);
  };

  const removeRow = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount - discount;
  const remaining = total - paid > 0 ? total - paid : 0;

  useEffect(() => {
    setPaid(total);
  }, [total]);

  const saveReceiptAsImage = async () => {
    const node = document.getElementById("thermal-receipt-printable-area");
    if (!node) return;
    setIsSavingImage(true);
    setImageSavedStatus("جاري تحويل وحفظ صورة الفاتورة في المجلد...");
    try {
      const { toPng } = await import("html-to-image");
      const width = node.offsetWidth || 302;
      const height = node.scrollHeight || node.offsetHeight;

      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        quality: 1.0,
        pixelRatio: 2,
        cacheBust: true,
        width: width,
        height: height,
        style: {
          transform: "none",
          margin: "0",
          width: "302px",
          minWidth: "302px",
          maxWidth: "302px",
          boxSizing: "border-box"
        }
      });

      const link = document.createElement("a");
link.download = "فاتورة_" + (invoiceNumber || "بدون_رقم") + ".png";
link.href = dataUrl;
link.click();
const data = { success: true, url: dataUrl, filename: link.download };
if (true) {
        setSavedImageUrl(data.url);
        setSavedFilename(data.filename);
        setImageSavedStatus(`تم حفظ صورة الفاتورة بنجاح بالاسم الثابت (${data.filename}).`);
      } else {
        throw new Error((data as any).error || "فشل الرد التوريدي من الخادم.");
      }
    } catch (err: any) {
      console.error("Image saving failure", err);
      setImageSavedStatus("أكملت الفاتورة ولكن تعذر حفظ نسختها كصورة.");
    } finally {
      setIsSavingImage(false);
    }
  };


  const handleManualPrint = async () => {
    await saveReceiptAsImage();
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!supplierName) {
      setError("الرجاء اختيار اسم المورد المسجل أولاً لإتمام الحفظ.");
      return;
    }

    if (items.length === 0) {
      setError("لا يمكن إرسال فاتورة فارغة. يرجى إدراج صنف واحد على الأقل.");
      return;
    }

    const invalid = items.some((item) => !item.name || !item.barcode || item.purchase_price <= 0);
    if (invalid) {
      setError("يرجى التأكد من ملء الحقول بالكامل (اسم الصنف، الباركود، وسعر الشراء أكبر من صفر) لكل الأسطر.");
      return;
    }
    for (const item of items) {
      const found = dbItems.find(p => p.barcode === item.barcode);
      // No supplier_name check - allow any product in any purchase invoice
    }

    const payload = {
      invoice_number: invoiceNumber,
      date,
      supplier_name: supplierName,
      payment_source: paymentSource,
      subtotal,
      tax: taxAmount,
      discount,
      total,
      paid,
      remaining,
      items,
      created_by: currentUser?.name || "مسؤول المتجر"
    };

    setLoading(true);
    try {
      const response = await authFetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const arabicDateStr = new Intl.DateTimeFormat("ar-EG", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true
        }).format(new Date());

        const savedMarketName = localStorage.getItem("supermarket_market_name") || "سوبرماركت المدينة المنورة";
        const savedMarketPhone = localStorage.getItem("supermarket_market_phone") || "01099887766";

        setPrintData({
          invoice_number: invoiceNumber,
          date,
          arabicDateStr,
          supplier_name: supplierName,
          payment_source: paymentSource,
          subtotal,
          tax: taxAmount,
          discount,
          total,
          paid,
          remaining,
          items: [...items],
          cashier: currentUser?.name || "مسؤول المتجر",
          marketName: savedMarketName,
          marketPhone: savedMarketPhone,
          is_purchase: true
        });

        setSuccess("تم تسجيل وحفظ فاتورة الاستيراد بنجاح، ورفع حصيلة المخزون تلقائيًا.");
        setShowPrintModal(true);
        setItems([]);
        setDiscount(0);
        generateInvoiceProps();
        handleReloadStock();
      } else {
        const d = await response.json();
        setError(d.error || "فشل تسجيل الفاتورة في قاعدة البيانات.");
      }
    } catch (err) {
      setError("حدث خطأ في الاتصال بالشبكة المحمية.");
    } finally {
      setLoading(false);
    }
  };

  handleSubmitRef.current = handleSubmit;

  return (
    <div className="w-full space-y-6 select-none font-sans" id="purchase-invoice-view" style={{ direction: "rtl" }}>
      

      
      {success && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="purchase-success">
          <CheckCircle size={16} strokeWidth={1.5} className="shrink-0 text-[#000000]" />
          <p className="text-right">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="purchase-error">
          <AlertTriangle size={16} strokeWidth={1.5} className="shrink-0 text-[#222222]" />
          <p className="text-right">{error}</p>
        </div>
      )}

      {/* Main Header & Form Panel */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] space-y-4" id="purchase-meta-inputs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-x-4 gap-y-2 pb-3 border-b border-[#888888]">
          <div className="text-right">
            <h2 className="text-xl font-extrabold text-[#000000] flex items-center gap-2">
              <TrendingDown size={20} strokeWidth={1.5} />
              <span>تسجيل فاتورة توريد ومشتريات جديدة</span>
            </h2>
            <p className="text-xs text-[#555555] font-semibold mt-1">إدخال بضائع للمستودع وتحديث الرصيد والتكلفة الموردة</p>
          </div>
          <div className="flex items-center gap-2">
            <UnifiedPrintButton printableId="purchase-invoice-view" title="طباعة المشتريات" />
            <button
              type="button"
              onClick={loadInvoiceHistory}
              className="h-9 px-3 flex items-center justify-center gap-1.5 bg-[#b8bcb2] hover:bg-[#888888] text-[#000000] font-bold text-xs border border-[#888888] transition-colors cursor-pointer"
            >
              <Search size={14} />
              <span>سجل الفواتير</span>
            </button>
            {/* Shortcuts Popover Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowShortcutsPopover(!showShortcutsPopover)}
                className="h-9 px-3 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] hover:text-[#ffffff] border border-[#555555] font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="عرض اختصارات المفاتيح"
              >
                <Keyboard size={15} strokeWidth={1.5} />
                <span>اختصارات المفاتيح</span>
              </button>

              {showShortcutsPopover && (
                <div className="absolute left-0 mt-2 w-64 bg-[#222222] text-[#ffffff] border border-[#000000] p-3 shadow-2xl z-50 text-xs">
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-[#444444]">
                    <span className="font-extrabold flex items-center gap-1.5 text-xs text-[#c3c6bb]">
                      <Keyboard size={14} /> دليل اختصارات المفاتيح
                    </span>
                    <button 
                      type="button"
                      onClick={() => setShowShortcutsPopover(false)}
                      className="text-[#888888] hover:text-[#ffffff] p-0.5 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2 text-[11px] font-semibold">
                    <div className="flex justify-between items-center pb-1 border-b border-[#333333]">
                      <span className="text-[#dddddd]">حفظ الفاتورة</span>
                      <span className="bg-[#444444] text-[#ffffff] px-1.5 py-0.5 font-mono text-[10px] border border-[#555555]">Ctrl + Enter</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-[#333333]">
                      <span className="text-[#dddddd]">التركيز على البحث</span>
                      <span className="bg-[#444444] text-[#ffffff] px-1.5 py-0.5 font-mono text-[10px] border border-[#555555]">Alt + 2 / F2</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-[#333333]">
                      <span className="text-[#dddddd]">إدراج صنف جديد</span>
                      <span className="bg-[#444444] text-[#ffffff] px-1.5 py-0.5 font-mono text-[10px] border border-[#555555]">Alt + 3 / F3</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-[#333333]">
                      <span className="text-[#dddddd]">إفراغ الأصناف</span>
                      <span className="bg-[#444444] text-[#ffffff] px-1.5 py-0.5 font-mono text-[10px] border border-[#555555]">Alt + 7</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#dddddd]">إلغاء / إغلاق النافذة</span>
                      <span className="bg-[#444444] text-[#ffffff] px-1.5 py-0.5 font-mono text-[10px] border border-[#555555]">ESC</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              id="btn-reload-items-spec"
              onClick={handleReloadStock}
              className="h-9 px-4 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] font-bold text-xs text-[#000000] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={16} strokeWidth={1.5} />
              <span>تحديث قوام الأصناف</span>
            </button>
          </div>
        </div>

        {/* 12-COLUMN GRID FORM */}
        <div className="grid grid-cols-12 gap-x-4 gap-y-2 text-xs font-bold">
          <div className="col-span-12 sm:col-span-6 lg:col-span-3 space-y-1">
            <label className="block text-[#000000]">رقم الفاتورة الواردة</label>
            <input
              id="purchase-invoice-num"
              type="text"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 lg:col-span-3 space-y-1">
            <label className="block text-[#000000]">تاريخ التوريد</label>
            <input
              id="purchase-invoice-date"
              type="date"
              required
              disabled={!(currentUser?.role === "admin" || currentUser?.permissions?.includes("edit_invoice"))}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] disabled:opacity-50"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 lg:col-span-3 space-y-1">
            <label className="block text-[#000000]">جهة المورد</label>
            {suppliers.length > 0 ? (
              <select
                id="purchase-invoice-supplier"
                value={supplierName}
                onChange={(e) => {
                  if (items.length > 0) {
                    if (window.confirm("تغيير المورد سيؤدي إلى مسح الأصناف الحالية. هل تريد المتابعة؟")) {
                      setItems([]);
                      setSupplierName(e.target.value);
                    }
                  } else {
                    setSupplierName(e.target.value);
                  }
                }}
                className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] cursor-pointer"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            ) : (
              <div className="h-9 px-3 bg-[#b8bcb2] border border-[#888888] flex items-center text-xs text-[#000000]">
                لا يوجد موردون مسجلون
              </div>
            )}
          </div>

          <div className="col-span-12 sm:col-span-6 lg:col-span-3 space-y-1">
            <label className="block text-[#000000]">مصدر الخصم المالي</label>
            <select
              id="purchase-payment-source"
              value={paymentSource}
              onChange={(e: any) => setPaymentSource(e.target.value)}
              className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] cursor-pointer"
            >
              <option value="main_safe">الخزنة الرئيسية</option>
              <option value="cash_register">درج الكاشير</option>
            </select>
          </div>
        </div>
      </div>

      {/* Row Insert Bar */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col sm:flex-row justify-between items-center gap-4" id="purchase-row-insert-tool">
        <div className="flex-1 w-full relative">
          <div className="flex items-center gap-2 bg-[#b8bcb2] border border-[#888888] px-3 h-9">
            <Search size={16} strokeWidth={1.5} className="text-[#222222]" />
            <input
              id="purchase-barcode-search"
              ref={searchBarRef}
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyDown={handleBarcodeSearchKeyPress}
              placeholder="ابحث برمز الباركود أو اسم الصنف لإدراجه بالفاتورة..."
              className="w-full bg-transparent text-right text-xs font-bold text-[#000000] placeholder:text-[#555555] focus:outline-none"
            />
          </div>
          
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-[#c3c6bb] border border-[#222222] mt-1 z-20 max-h-64 overflow-y-auto divide-y divide-[#888888]/40">
              {searchResults.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => {
                    addExistingProductToInvoice(prod);
                    setSearchCode("");
                    setSearchResults([]);
                  }}
                  className="flex justify-between items-center p-2.5 hover:bg-[#b8bcb2] cursor-pointer text-right transition-colors"
                >
                  <div>
                    <p className="text-xs font-bold text-[#000000]">{prod.name}</p>
                    <p className="text-xs text-[#555555] font-mono">{prod.barcode}</p>
                  </div>
                  <div className="text-left font-bold text-xs text-[#000000]">
                    <p>{(prod.purchase_price || 0).toFixed(2)} ج.م</p>
                    <p className="text-xs text-[#555555] font-normal">المخزون: {prod.quantity} {prod.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          id="btn-add-purchase-row"
          type="button"
          onClick={addNewItemRow}
          className="h-9 px-4 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center justify-center gap-x-4 gap-y-2 cursor-pointer w-full sm:w-auto shrink-0"
        >
          <Plus size={16} strokeWidth={1.5} />
          <span>إدراج صنف جديد</span>
        </button>
      </div>

      {/* Items Table */}
      <div className="bg-[#c3c6bb] border border-[#222222] overflow-x-auto" id="purchase-sheet-table">
        {items.length > 0 ? (
          <table className="w-full text-right text-xs min-w-[1100px] border-collapse">
            <thead>
              <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-10">
                <th className="py-3 px-4 text-center whitespace-nowrap w-12">#</th>
                <th className="py-3 px-4 min-w-[150px] whitespace-nowrap">الباركود</th>
                <th className="py-3 px-4 min-w-[220px]">اسم الصنف</th>
                <th className="py-3 px-4 text-center whitespace-nowrap w-28">الكمية</th>
                <th className="py-3 px-4 text-center whitespace-nowrap w-28">الوحدة</th>
                <th className="py-3 px-4 text-center whitespace-nowrap w-28">سعر الشراء</th>
                <th className="py-3 px-4 text-center whitespace-nowrap w-28">القطاعي</th>
                <th className="py-3 px-4 text-center whitespace-nowrap w-28">الجملة</th>
                <th className="py-3 px-4 text-left whitespace-nowrap w-32">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
              {items.map((it, idx) => (
                <tr key={idx} className="hover:bg-[#b8bcb2] transition-colors">
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <button
                      id={`btn-remove-purchase-row-${idx}`}
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer mx-auto transition-colors"
                      title="حذف السطر"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </td>

                  <td className="py-3 px-4 min-w-[150px]">
                    <input
                      type="text"
                      required
                      value={it.barcode}
                      onChange={(e) => updateRowField(idx, "barcode", e.target.value)}
                      className="w-full h-8 bg-[#b8bcb2] border border-[#888888] px-2.5 text-right font-mono text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                    />
                  </td>

                  <td className="py-3 px-4 min-w-[220px]">
                    <input
                      type="text"
                      required
                      value={it.name}
                      onChange={(e) => updateRowField(idx, "name", e.target.value)}
                      placeholder="اسم الصنف..."
                      readOnly={!!dbItems.find(p => p.barcode === it.barcode)}
                      className={`w-full h-8 border px-2.5 text-right text-xs font-bold focus:outline-none ${!!dbItems.find(p => p.barcode === it.barcode) ? "bg-[#d3d3d3] border-[#aaaaaa] text-[#555555] cursor-not-allowed" : "bg-[#b8bcb2] border-[#888888] text-[#000000] focus:border-[#222222]"}`}
                    />
                  </td>

                  <td className="py-3 px-4 text-center">
                    <input
                      type="number"
                      step="any"
                      required
                      value={it.quantity}
                      onChange={(e) => updateRowField(idx, "quantity", e.target.value)}
                      className="w-22 h-8 bg-[#b8bcb2] border border-[#888888] text-center font-bold text-xs text-[#000000] focus:outline-none focus:border-[#222222] mx-auto"
                      min="0.001"
                    />
                  </td>

                  <td className="py-3 px-4 text-center">
                    <select
                      value={it.unit}
                      onChange={(e) => updateRowField(idx, "unit", e.target.value)}
                      disabled={!!dbItems.find(p => p.barcode === it.barcode)}
                      className={`w-24 h-8 border text-right px-2 font-bold text-xs focus:outline-none mx-auto ${!!dbItems.find(p => p.barcode === it.barcode) ? "bg-[#d3d3d3] border-[#aaaaaa] text-[#555555] cursor-not-allowed" : "bg-[#b8bcb2] border-[#888888] text-[#000000] focus:border-[#222222] cursor-pointer"}`}
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={it.purchase_price}
                      onChange={(e) => updateRowField(idx, "purchase_price", e.target.value)}
                      className="w-24 h-8 bg-[#b8bcb2] border border-[#888888] text-center font-bold text-xs text-[#000000] focus:outline-none focus:border-[#222222] mx-auto font-mono"
                      min="0"
                    />
                  </td>

                  <td className="py-3 px-4 text-center">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={it.retail_price}
                      onChange={(e) => updateRowField(idx, "retail_price", e.target.value)}
                      readOnly={!!dbItems.find(p => p.barcode === it.barcode)}
                      className={`w-24 h-8 border text-center font-bold text-xs focus:outline-none mx-auto font-mono ${!!dbItems.find(p => p.barcode === it.barcode) ? "bg-[#d3d3d3] border-[#aaaaaa] text-[#555555] cursor-not-allowed" : "bg-[#b8bcb2] border-[#888888] text-[#000000] focus:border-[#222222]"}`}
                      min="0"
                    />
                  </td>

                  <td className="py-3 px-4 text-center">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={it.wholesale_price}
                      onChange={(e) => updateRowField(idx, "wholesale_price", e.target.value)}
                      readOnly={!!dbItems.find(p => p.barcode === it.barcode)}
                      className={`w-24 h-8 border text-center font-bold text-xs focus:outline-none mx-auto font-mono ${!!dbItems.find(p => p.barcode === it.barcode) ? "bg-[#d3d3d3] border-[#aaaaaa] text-[#555555] cursor-not-allowed" : "bg-[#b8bcb2] border-[#888888] text-[#000000] focus:border-[#222222]"}`}
                      min="0"
                    />
                  </td>

                  <td className="py-3 px-4 text-left font-black font-mono text-sm text-[#000000] whitespace-nowrap">
                    {(it.total || 0).toFixed(2)} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-[#555555] font-bold text-xs">
            لا توجد أصناف في شيت الفاتورة حالياً. استخدم البحث أو اضغط على إدراج صنف جديد.
          </div>
        )}
      </div>

      {/* Financial Totals and Submission */}
      <div className="grid grid-cols-12 gap-4" id="purchase-accounting-footer">
        <div className="col-span-12 lg:col-span-7 bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-[#000000] flex items-center gap-2">
              <Truck size={16} strokeWidth={1.5} />
              <span>ملاحظات التوريد واحتساب الأثر المخزني</span>
            </h3>
            <p className="text-xs text-[#555555] font-semibold mt-2 leading-relaxed">
              عند اعتماد الفاتورة سيتم إضافة كميات البضائع تلقائياً إلى المستودع وتعديل متوسطات تكلفة الشراء وأسعار البيع.
            </p>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 bg-[#c3c6bb] p-4 border border-[#222222] space-y-3 font-bold text-xs" id="purchase-billing-card">
          <div className="flex justify-between items-center pb-2 border-b border-[#888888]">
            <span className="text-[#555555]">المجموع الفرعي:</span>
            <span className="text-[#000000]">{(subtotal || 0).toFixed(2)} ج.م</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#555555]">نسبة الضريبة (%):</span>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="w-20 h-8 bg-[#b8bcb2] border border-[#888888] text-center font-bold text-xs text-[#000000] focus:outline-none focus:border-[#222222]"
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#555555]">قيمة الخصم (ج.م):</span>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-24 h-8 bg-[#b8bcb2] border border-[#888888] text-center font-bold text-xs text-[#000000] focus:outline-none focus:border-[#222222]"
            />
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-[#888888] text-sm">
            <span className="text-[#000000] font-black">الإجمالي الكلي:</span>
            <span className="text-[#000000] font-black">{(total || 0).toFixed(2)} ج.م</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-1">
            <div>
              <label className="block text-[#555555] mb-1">المدفوع:</label>
              <input
                type="number"
                value={paid}
                onChange={(e) => setPaid(Number(e.target.value))}
                className="w-full h-9 bg-[#b8bcb2] border border-[#888888] text-center font-bold text-xs text-[#000000] focus:outline-none focus:border-[#222222]"
              />
              <div className="flex gap-1 mt-1">
                <button type="button" onClick={() => setPaid(total)} className="flex-1 py-1 bg-[#c3c6bb] hover:bg-[#888888] text-[#000000] text-[10px] font-bold border border-[#888888] transition-colors cursor-pointer">كامل المبلغ</button>
                <button type="button" onClick={() => setPaid(50)} className="flex-1 py-1 bg-[#c3c6bb] hover:bg-[#888888] text-[#000000] text-[10px] font-bold border border-[#888888] transition-colors cursor-pointer">50</button>
                <button type="button" onClick={() => setPaid(100)} className="flex-1 py-1 bg-[#c3c6bb] hover:bg-[#888888] text-[#000000] text-[10px] font-bold border border-[#888888] transition-colors cursor-pointer">100</button>
                <button type="button" onClick={() => setPaid(200)} className="flex-1 py-1 bg-[#c3c6bb] hover:bg-[#888888] text-[#000000] text-[10px] font-bold border border-[#888888] transition-colors cursor-pointer">200</button>
              </div>
            </div>
            <div>
              <label className="block text-[#555555] mb-1">المتبقي للمورد:</label>
              <div className="w-full h-9 bg-[#b8bcb2]/60 border border-[#888888] flex items-center justify-center font-bold text-xs text-[#000000]">
                {(remaining || 0).toFixed(2)} ج.م
              </div>
            </div>
          </div>

          <button
            id="btn-confirm-purchase-invoice"
            onClick={handleSubmit}
            disabled={loading || items.length === 0}
            className="w-full h-10 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center justify-center gap-x-4 gap-y-2 cursor-pointer disabled:opacity-40"
          >
            <Save size={16} strokeWidth={1.5} />
            <span>حفظ واعتماد الفاتورة</span>
          </button>
        </div>
      </div>

      {/* Invoice History Modal */}
      {showInvoiceHistory && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50 no-print">
          <div className="bg-[#c3c6bb] border border-[#222222] p-4 w-full max-w-2xl relative space-y-4 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowInvoiceHistory(false)}
              className="absolute top-3 left-3 w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] cursor-pointer"
            >
              <X size={14} />
            </button>
            <h3 className="text-sm font-black text-[#000000] border-b border-[#888888] pb-2">
              سجل فواتير المشتريات
            </h3>
            <div className="overflow-y-auto flex-1 bg-white border border-[#888888]">
              {historyLoading ? (
                <div className="p-8 text-center text-[#555555] font-bold">جاري تحميل الفواتير...</div>
              ) : historyInvoices.length > 0 ? (
                <table className="w-full text-sm text-center border-collapse">
                  <thead>
                    <tr className="bg-[#222222] text-[#c3c6bb]">
                      <th className="py-2 px-3">رقم الفاتورة</th>
                      <th className="py-2 px-3">المورد</th>
                      <th className="py-2 px-3">التاريخ</th>
                      <th className="py-2 px-3">الإجمالي</th>
                      <th className="py-2 px-3">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#888888]/40">
                    {historyInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#b8bcb2] transition-colors text-black font-bold">
                        <td className="py-2 px-3 font-mono">{inv.invoice_number}</td>
                        <td className="py-2 px-3">{inv.customer_supplier_name}</td>
                        <td className="py-2 px-3 font-mono">{inv.date}</td>
                        <td className="py-2 px-3 font-mono">{(inv.total || 0).toFixed(2)} ج.م</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => handleReprintInvoice(inv.id)}
                            className="bg-[#222222] text-[#c3c6bb] hover:bg-[#000000] px-3 py-1 font-bold text-xs flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <Printer size={12} /> طباعة
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-[#555555] font-bold">لا توجد فواتير سابقة.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* PRINT RECEIPT MODAL */}
      {showPrintModal && printData && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50 no-print">
          <div className="bg-[#c3c6bb] p-4 w-full max-w-sm border border-[#222222] relative flex flex-col space-y-3 font-sans">
            <button
              onClick={() => {
                setShowPrintModal(false);
                setPrintData(null);
              }}
              className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="text-center">
              <h3 className="text-xs font-black text-[#000000]">إيصال توريد واستلام</h3>
              <p className="text-xs text-[#555555] font-semibold mt-0.5">معاينة سند المشتريات</p>
            </div>

            <div
              id="thermal-receipt-printable-area"
              className="printable-receipt"
              style={{
                direction: "rtl",
                width: "302px",
                minWidth: "302px",
                maxWidth: "302px",
                boxSizing: "border-box",
                backgroundColor: "#ffffff",
                color: "#000000",
                padding: "16px 12px",
                margin: "0 auto",
                fontFamily: "Arial, Tahoma, sans-serif",
                fontSize: "11px",
                border: "1px solid #000000",
                lineHeight: "1.4"
              }}
            >
              {/* Receipt Header */}
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <h4 style={{ fontSize: "15px", fontWeight: "900", margin: "0 0 2px 0", color: "#000000" }}>
                  {printData.marketName || "سوبرماركت المدينة المنورة"}
                </h4>
                <div style={{ margin: "6px 0 4px 0", padding: "2px 0", borderTop: "1px solid #000000", borderBottom: "1px solid #000000", fontWeight: "bold", fontSize: "11px" }}>
                  إيصال مشتريات وتوريد
                </div>
              </div>

              {/* Receipt Meta Details */}
              <div style={{ fontSize: "10px", fontWeight: "bold", borderBottom: "1px dashed #000000", paddingBottom: "6px", marginBottom: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>رقم سند التوريد:</span>
                  <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{printData.invoice_number}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                  <span>التاريخ:</span>
                  <span>{printData.date}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                  <span>المورد:</span>
                  <span>{printData.supplier_name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                  <span>المستلم:</span>
                  <span>{printData.cashier || "النظام"}</span>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", marginBottom: "8px" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #000000", fontWeight: "900" }}>
                    <th style={{ textAlign: "right", paddingBottom: "4px" }}>الصنف</th>
                    <th style={{ textAlign: "center", paddingBottom: "4px", width: "40px" }}>ك</th>
                    <th style={{ textAlign: "left", paddingBottom: "4px", width: "65px" }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.items.map((it: any, index: number) => (
                    <tr key={index} style={{ borderBottom: "1px dashed #dddddd" }}>
                      <td style={{ textAlign: "right", padding: "4px 0", fontWeight: "bold", wordBreak: "break-word" }}>
                        {it.name}
                      </td>
                      <td style={{ textAlign: "center", padding: "4px 0", fontFamily: "monospace" }}>
                        {it.quantity} {it.unit}
                      </td>
                      <td style={{ textAlign: "left", padding: "4px 0", fontWeight: "bold", fontFamily: "monospace" }}>
                        {(it.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary */}
              <div style={{ borderTop: "1.5px solid #000000", paddingTop: "6px", fontSize: "10px", fontWeight: "bold" }}>
                <div style={{
                  display: "flex",
                  justify: "space-between",
                  backgroundColor: "#000000",
                  color: "#ffffff",
                  padding: "5px 6px",
                  fontWeight: "900",
                  fontSize: "12px",
                  marginTop: "4px",
                  marginBottom: "4px"
                }}>
                  <span>إجمالي التوريد:</span>
                  <span style={{ fontFamily: "monospace" }}>{(printData.total || 0).toFixed(2)} ج.م</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginTop: "4px" }}>
                  <span>جهة الدفع:</span>
                  <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                    {printData.payment_source === "cash_register" ? "درج الكاشير" : "الخزينة الرئيسية"}
                  </span>
                </div>
                {printData.paid !== undefined && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#333333", marginTop: "2px" }}>
                    <span>المدفوع للمورد:</span>
                    <span style={{ fontFamily: "monospace" }}>{(printData.paid || 0).toFixed(2)} ج.م</span>
                  </div>
                )}
                {printData.remaining !== undefined && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#333333", marginTop: "2px" }}>
                    <span>الباقي للمورد:</span>
                    <span style={{ fontFamily: "monospace" }}>{(printData.remaining || 0).toFixed(2)} ج.م</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ textAlign: "center", marginTop: "10px", paddingTop: "6px", borderTop: "1px dashed #000000", fontSize: "9px", fontWeight: "bold", color: "#222222" }}>
                <p style={{ margin: "0", fontSize: "8px", color: "#666666", fontFamily: "monospace" }}>منظومة الكابتن — لهندسة الأرقام وريادة الأعمال</p>
              </div>
            </div>

            <div className="w-full flex justify-center no-print">
              <UnifiedPrintButton printableId="thermal-receipt-printable-area" thermalId="thermal-receipt-printable-area" title="طباعة المستند" variant="primary" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
