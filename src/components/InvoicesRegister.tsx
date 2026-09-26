import React, { useState, useEffect } from "react";
import { User, Invoice } from "../types";
import { Printer, Search, Eye, ArrowUpLeft, X } from "lucide-react";
import UnifiedPrintButton from "./UnifiedPrintButton";
import { authFetch } from "../authFetch";

interface InvoicesRegisterProps {
  currentUser: User | null;
}

export default function InvoicesRegister({ currentUser }: InvoicesRegisterProps) {
  const [filterType, setFilterType] = useState<"sales" | "purchases" | "credit">("purchases");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<any>(null);
  const [marketName, setMarketName] = useState("المدينة المنورة");
  const [marketPhone, setMarketPhone] = useState("01099887766");
  const [creditSummary, setCreditSummary] = useState<{ total_remaining: number; count: number } | null>(null);
  const [collectTarget, setCollectTarget] = useState<any>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectSource, setCollectSource] = useState<"cash_register" | "main_safe">("cash_register");
  const [collectBusy, setCollectBusy] = useState(false);
  const [collectMsg, setCollectMsg] = useState("");

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      if (filterType === "credit") {
        const res = await authFetch("/api/credit/sales");
        if (res.ok) {
          const data = await res.json();
          setInvoices(data.invoices || []);
          setCreditSummary(data.summary || null);
        }
      } else {
        setCreditSummary(null);
        const res = await authFetch(`/api/invoices?type=${filterType}`);
        if (res.ok) {
          const data = await res.json();
          setInvoices(data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = async () => {
    if (!collectTarget) return;
    const amt = Number(collectAmount);
    if (!(amt > 0)) { setCollectMsg("دخل مبلغ صحيح أكبر من صفر."); return; }
    setCollectBusy(true);
    setCollectMsg("");
    try {
      const res = await authFetch(`/api/credit/${collectTarget.id}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          payment_source: collectSource,
          user_name: currentUser?.name || "الكاشير"
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCollectMsg(data.remaining > 0
          ? `تم التحصيل — المتبقي: ${Number(data.remaining).toFixed(2)} ج.م`
          : "تم تحصيل كامل المبلغ — الفاتورة خالصة ✓");
        setTimeout(() => { setCollectTarget(null); setCollectAmount(""); setCollectMsg(""); fetchInvoices(); }, 900);
      } else {
        setCollectMsg(data.error || "فشل التحصيل");
      }
    } catch {
      setCollectMsg("خطأ في الاتصال بالخادم");
    } finally {
      setCollectBusy(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    authFetch("/api/settings")
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (s?.market_name) setMarketName(s.market_name); if (s?.market_phone) setMarketPhone(s.market_phone); })
      .catch(() => {});
  }, [filterType]);

  const handleReprintInvoice = async (invoiceId: number) => {
    try {
      const res = await authFetch(`/api/invoices/${invoiceId}`);
      if (res.ok) {
        const { invoice, items } = await res.json();
        setPrintData({
          type: invoice.type,
          invoice_number: invoice.invoice_number,
          date: invoice.date,
          customer_supplier_name: invoice.customer_supplier_name,
          payment_source: invoice.payment_source,
          subtotal: invoice.subtotal || invoice.total,
          tax: invoice.tax || 0,
          discount: invoice.discount || 0,
          tamween_discount: invoice.tamween_discount || 0,
          bread_points: invoice.bread_points || 0,
          bonus: invoice.bonus || 0,
          total: invoice.total,
          paid: invoice.paid || invoice.total,
          remaining: invoice.remaining || 0,
          items: items
        });
        setShowPrintModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden font-sans" style={{ direction: "rtl" }}>
      {/* Header */}
      <header className="bg-[#c3c6bb] p-4 border-b border-[#222222] shrink-0 flex justify-between items-center no-print">
        <div className="flex items-center gap-3">
          <div className="bg-[#222222] p-2 text-[#c3c6bb]">
            <Search size={24} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#000000]">سجل الفواتير الشامل</h2>
            <p className="text-xs text-[#555555] font-bold mt-1">عرض وطباعة فواتير المبيعات والمشتريات السابقة</p>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="p-4 bg-[#b8bcb2] border-b border-[#888888] flex gap-2 shrink-0 no-print">
        <button
          onClick={() => setFilterType("purchases")}
          className={`px-4 py-2 text-xs font-bold transition-colors border ${filterType === "purchases" ? "bg-[#222222] text-[#c3c6bb] border-[#000000]" : "bg-white text-[#000000] border-[#888888] hover:bg-[#e0e0e0]"}`}
        >
          سجل فواتير المشتريات
        </button>
        <button
          onClick={() => setFilterType("sales")}
          className={`px-4 py-2 text-xs font-bold transition-colors border ${filterType === "sales" ? "bg-[#222222] text-[#c3c6bb] border-[#000000]" : "bg-white text-[#000000] border-[#888888] hover:bg-[#e0e0e0]"}`}
        >
          سجل فواتير المبيعات
        </button>
        <button
          onClick={() => setFilterType("credit")}
          className={`px-4 py-2 text-xs font-bold transition-colors border ${filterType === "credit" ? "bg-[#222222] text-[#c3c6bb] border-[#000000]" : "bg-white text-[#000000] border-[#888888] hover:bg-[#e0e0e0]"}`}
        >
          حساب الآجل 💳
        </button>
        {filterType === "credit" && creditSummary && (
          <div className="mr-auto flex items-center gap-3 bg-[#222222] text-[#c3c6bb] px-3 py-1.5 border border-[#000000]">
            <span className="text-[11px] font-bold">إجمالي المديونية:</span>
            <span className="text-sm font-black font-mono text-[#c3c6bb]">{Number(creditSummary.total_remaining || 0).toFixed(2)} ج.م</span>
            <span className="text-[11px] font-bold text-[#888888]">({creditSummary.count} فاتورة)</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        {loading ? (
          <div className="p-12 text-center text-[#555555] font-bold">جاري تحميل السجل...</div>
        ) : (
          <div className="border border-[#888888] overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-[#222222] text-[#c3c6bb] font-bold">
                  <th className="py-3 px-4">رقم الفاتورة</th>
                  <th className="py-3 px-4">{filterType === "purchases" ? "المورد" : "العميل"}</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-center">الإجمالي</th>
                  {filterType === "sales" && <th className="py-3 px-4 text-center">خصم التموين</th>}
                  {filterType === "credit" && (
                    <>
                      <th className="py-3 px-4 text-center">المدفوع</th>
                      <th className="py-3 px-4 text-center">المتبقي</th>
                    </>
                  )}
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#888888]/40 font-bold">
                {invoices.length > 0 ? (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#b8bcb2] transition-colors">
                      <td className="py-3 px-4 font-mono">{inv.invoice_number}</td>
                      <td className="py-3 px-4">{inv.customer_supplier_name}</td>
                      <td className="py-3 px-4 font-mono">{inv.date}</td>
                      <td className="py-3 px-4">
                        {filterType === "credit" ? (
                          <span className="bg-amber-200 text-amber-900 px-2 py-0.5 text-[10px]">آجل</span>
                        ) : inv.status === 'returned' ? (
                          <span className="bg-red-200 text-red-800 px-2 py-0.5 text-[10px]">مرتجع كلي</span>
                        ) : inv.status === 'partial_returned' ? (
                          <span className="bg-orange-200 text-orange-800 px-2 py-0.5 text-[10px]">مرتجع جزئي</span>
                        ) : (
                          <span className="bg-green-200 text-green-800 px-2 py-0.5 text-[10px]">معتمدة</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">{(inv.total || 0).toFixed(2)} ج.م</td>
                      {filterType === "sales" && (
                        <td className="py-3 px-4 text-center font-mono">
                          {inv.tamween_discount > 0 ? (
                            <span className="text-orange-600 font-bold">{inv.tamween_discount.toFixed(2)} ج.م</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      {filterType === "credit" && (
                        <>
                          <td className="py-3 px-4 text-center font-mono text-green-700">{(inv.paid || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-center font-mono font-black text-red-700">{(inv.remaining || 0).toFixed(2)}</td>
                        </>
                      )}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {filterType === "credit" && (
                            <button
                              onClick={() => { setCollectTarget(inv); setCollectAmount(String(inv.remaining || "")); setCollectMsg(""); setCollectSource("cash_register"); }}
                              className="bg-[#065f46] text-white hover:bg-[#047857] px-2.5 py-1.5 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              💰 تحصيل
                            </button>
                          )}
                          <button
                            onClick={() => handleReprintInvoice(inv.id)}
                            className="bg-[#222222] text-[#c3c6bb] hover:bg-[#000000] px-3 py-1.5 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Printer size={14} /> طباعة
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={filterType === "credit" ? 8 : filterType === "sales" ? 7 : 6} className="py-12 text-center text-[#555555]">
                      {filterType === "credit" ? "لا توجد فواتير آجلة — كل المبيعات خالصة." : "لا توجد فواتير مسجلة."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collect Credit Modal */}
      {collectTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 no-print" style={{ direction: "rtl" }}>
          <div className="bg-white w-full max-w-md border border-[#222222] shadow-2xl rounded-xl overflow-hidden">
            <div className="bg-[#222222] text-[#c3c6bb] px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-black">💰 تحصيل دفعة من فاتورة آجلة</h3>
              <button onClick={() => { setCollectTarget(null); setCollectMsg(""); }} className="cursor-pointer hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-[#f5f5f5] border border-[#888888] rounded-lg p-3 text-xs font-bold space-y-1">
                <div className="flex justify-between"><span className="text-[#555555]">الفاتورة:</span><span className="font-mono">{collectTarget.invoice_number}</span></div>
                <div className="flex justify-between"><span className="text-[#555555]">العميل:</span><span>{collectTarget.customer_supplier_name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-[#555555]">الإجمالي:</span><span className="font-mono">{Number(collectTarget.total || 0).toFixed(2)} ج.م</span></div>
                <div className="flex justify-between"><span className="text-[#555555]">المتبقي:</span><span className="font-mono font-black text-red-700">{Number(collectTarget.remaining || 0).toFixed(2)} ج.م</span></div>
              </div>
              <div>
                <label className="block text-xs font-black text-[#555555] mb-1">المبلغ المحصّل *</label>
                <input
                  type="number"
                  min={0}
                  max={collectTarget.remaining}
                  step={0.5}
                  value={collectAmount}
                  onChange={(e) => { setCollectAmount(e.target.value); setCollectMsg(""); }}
                  className="w-full h-10 px-3 border border-[#888888] rounded-lg text-sm font-black font-mono focus:outline-none focus:border-[#222222]"
                  autoFocus
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button type="button" onClick={() => setCollectAmount(String(collectTarget.remaining))}
                    className="h-7 px-2.5 text-[11px] font-black bg-[#065f46] text-white rounded-md cursor-pointer">كامل المتبقي</button>
                  {[50, 100, 200].map((v) => (
                    <button key={v} type="button" onClick={() => setCollectAmount(String(Math.min(Number(collectTarget.remaining), v)))}
                      className="h-7 px-2.5 text-[11px] font-black bg-[#b8bcb2] border border-[#888888] rounded-md cursor-pointer">{v}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-[#555555] mb-1">الإيداع في</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => setCollectSource("cash_register")}
                    className={`h-9 text-xs font-black rounded-lg cursor-pointer border transition-all ${collectSource === "cash_register" ? "bg-[#222222] text-[#c3c6bb] border-[#000000]" : "bg-white border-[#888888]"}`}>درج الكاشير</button>
                  <button type="button" onClick={() => setCollectSource("main_safe")}
                    className={`h-9 text-xs font-black rounded-lg cursor-pointer border transition-all ${collectSource === "main_safe" ? "bg-[#222222] text-[#c3c6bb] border-[#000000]" : "bg-white border-[#888888]"}`}>الخزنة الرئيسية</button>
                </div>
              </div>
              {collectMsg && (
                <div className={`p-2 text-xs font-black text-center rounded-lg ${collectMsg.includes("فشل") || collectMsg.includes("أكبر") || collectMsg.includes("اتصال") ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                  {collectMsg}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleCollect}
                  disabled={collectBusy}
                  className="flex-1 h-10 bg-[#065f46] hover:bg-[#047857] text-white font-black text-xs rounded-lg cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {collectBusy ? "جاري التحصيل..." : "تأكيد التحصيل 💰"}
                </button>
                <button
                  onClick={() => { setCollectTarget(null); setCollectMsg(""); }}
                  className="h-10 px-4 bg-[#b8bcb2] border border-[#888888] font-black text-xs rounded-lg cursor-pointer"
                >إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT RECEIPT MODAL */}
      {showPrintModal && printData && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50 no-print">
          <div className="bg-[#c3c6bb] p-4 w-full max-w-sm border border-[#222222] relative flex flex-col space-y-3 font-sans shadow-2xl">
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
              <h3 className="text-xs font-black text-[#000000]">إيصال {printData.type === 'sales' ? 'مبيعات' : 'مشتريات'}</h3>
              <p className="text-xs text-[#555555] font-semibold mt-0.5">معاينة للطباعة (80mm)</p>
            </div>

            <div
              id="thermal-receipt-printable-area"
              className="printable-receipt border border-[#222222]"
              style={{
                direction: "rtl",
                width: "302px",
                minWidth: "302px",
                maxWidth: "302px",
                boxSizing: "border-box",
                backgroundColor: "var(--bg-card)",
                color: "var(--text-primary)",
                padding: "16px 12px",
                margin: "0 auto",
                fontFamily: "Arial, Tahoma, sans-serif",
                fontSize: "11px",
                lineHeight: "1.4"
              }}
            >
              <div style={{ textAlign: "center", marginBottom: "10px", borderBottom: "1px dashed #000", paddingBottom: "10px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: "900", margin: "0 0 4px 0" }}>
                  {marketName}
                </h2>
                <p style={{ margin: "2px 0", fontSize: "12px", fontWeight: "bold" }}>
                  سند {printData.type === 'sales' ? 'مبيعات' : 'توريد مشتريات'}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginTop: "8px" }}>
                  <span>رقم: <span style={{ fontFamily: "monospace" }}>{printData.invoice_number}</span></span>
                  <span style={{ fontFamily: "monospace", direction: "ltr" }}>{new Date(printData.date).toLocaleString("en-GB")}</span>
                </div>
              </div>

              <div style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px dashed #000" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: "bold" }}>{printData.type === 'sales' ? 'العميل' : 'المورد'}:</span>
                  <span style={{ fontWeight: "bold" }}>{printData.customer_supplier_name || "نقدي"}</span>
                </div>
              </div>

              <table style={{ width: "100%", marginBottom: "10px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #000", fontWeight: "bold" }}>
                    <th style={{ textAlign: "right", padding: "4px 0" }}>الصنف</th>
                    <th style={{ textAlign: "center", padding: "4px 0" }}>الكمية</th>
                    <th style={{ textAlign: "center", padding: "4px 0" }}>السعر</th>
                    <th style={{ textAlign: "left", padding: "4px 0" }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.items.map((it: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px dotted #ccc" }}>
                      <td style={{ textAlign: "right", padding: "6px 0", fontWeight: "bold" }}>{it.name}</td>
                      <td style={{ textAlign: "center", padding: "6px 0", fontFamily: "monospace" }}>{it.quantity}</td>
                      <td style={{ textAlign: "center", padding: "6px 0", fontFamily: "monospace" }}>{(it.price || 0).toFixed(2)}</td>
                      <td style={{ textAlign: "left", padding: "6px 0", fontFamily: "monospace", fontWeight: "bold" }}>{(it.total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: "1px dashed #000", paddingTop: "10px", marginTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: "bold" }}>الإجمالي:</span>
                  <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>{(printData.subtotal || 0).toFixed(2)} ج.م</span>
                </div>
                {printData.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: "bold" }}>خصم:</span>
                    <span style={{ fontFamily: "monospace" }}>{(printData.discount || 0).toFixed(2)} ج.م</span>
                  </div>
                )}
                {printData.tax > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: "bold" }}>ضريبة:</span>
                    <span style={{ fontFamily: "monospace" }}>{(printData.tax || 0).toFixed(2)} ج.م</span>
                  </div>
                )}
                {(printData.tamween_discount || 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: "bold" }}>خصم البطاقة التموينية:</span>
                    <span style={{ fontFamily: "monospace" }}>-{(printData.tamween_discount || 0).toFixed(2)} ج.م</span>
                  </div>
                )}
                {(printData.bread_points || 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: "bold" }}>نقاط الخبز:</span>
                    <span style={{ fontFamily: "monospace" }}>-{(printData.bread_points || 0).toFixed(2)} ج.م</span>
                  </div>
                )}
                {((printData.tamween_discount || 0) + (printData.bread_points || 0)) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", borderTop: "1px dashed #000", paddingTop: "4px" }}>
                    <span style={{ fontWeight: "900" }}>إجمالي الدعم ونقاط الخبز:</span>
                    <span style={{ fontFamily: "monospace", fontWeight: "900" }}>-{((printData.tamween_discount || 0) + (printData.bread_points || 0)).toFixed(2)} ج.م</span>
                  </div>
                )}
                {(printData.bonus || 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: "bold" }}>الحافز:</span>
                    <span style={{ fontFamily: "monospace" }}>+{(printData.bonus || 0).toFixed(2)} ج.م</span>
                  </div>
                )}
                <div className="pos-total-bar" style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", padding: "6px 8px", backgroundColor: "var(--accent)", color: "var(--on-accent)", fontSize: "15px" }}>
                  <span style={{ fontWeight: "900" }}>الصافي:</span>
                  <span style={{ fontFamily: "monospace", fontWeight: "900", fontSize: "16px" }}>{(printData.total || 0).toFixed(2)} ج.م</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "10px" }}>
                  <span style={{ fontWeight: "bold" }}>المدفوع:</span>
                  <span style={{ fontFamily: "monospace" }}>{(printData.paid || 0).toFixed(2)} ج.م</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "10px" }}>
                  <span style={{ fontWeight: "bold" }}>المتبقي:</span>
                  <span style={{ fontFamily: "monospace" }}>{(printData.remaining || 0).toFixed(2)} ج.م</span>
                </div>
              </div>

              <div style={{ textAlign: "center", marginTop: "12px", paddingTop: "8px", borderTop: "1.5px dashed var(--border-strong)", fontWeight: "900", color: "var(--text-primary)" }}>
                <p style={{ margin: "0 0 3px 0", fontSize: "10px" }}>شكراً لتسوقكم معنا</p>
                <p style={{ margin: "0 0 2px 0", fontSize: "10px" }}>منظومة الكابتن (لهندسة الأرقام وريادة الأعمال)</p>
                <p style={{ margin: 0, fontSize: "11px", fontFamily: "monospace" }}>هاتف: {marketPhone || "01099887766"}</p>
              </div>
            </div>

            <div className="w-full flex justify-center no-print">
              <UnifiedPrintButton printableId="thermal-receipt-printable-area" thermalId="thermal-receipt-printable-area" title="طباعة السند" variant="primary" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
