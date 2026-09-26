import { useState, useRef, useEffect } from "react";
import { Printer, ChevronDown, FileText, Image as ImageIcon, ScrollText } from "lucide-react";
import { hardRefocus, authFetch } from "../authFetch";

interface UnifiedPrintButtonProps {
  printableId: string; // id للعنصر اللي هيتطبع
  thermalId?: string; // id لمنطقة الإيصال الحراري (لو مختلفة عن printableId)
  title?: string;
  variant?: "primary" | "ghost";
  printLayout?: "receipt" | "wide"; // wide = نوافذ المنظومة الواسعة بنفس تنظيم الشاشة
}

export default function UnifiedPrintButton({ printableId, thermalId, title = "طباعة", variant = "ghost", printLayout = "receipt" }: UnifiedPrintButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // إعدادات الطابعة من القرص (server settings) مع كاش في الذاكرة
  const [printerType, setPrinterType] = useState("thermal-80");
  const [shopInfo, setShopInfo] = useState({ name: "منظومة الكابتن", phone: "01010561128" });
  useEffect(() => {
    authFetch("/api/settings")
      .then(r => r.ok ? r.json() : null)
      .then(s => {
        if (!s) return;
        if (s.printer_type) setPrinterType(s.printer_type);
        setShopInfo({
          name: s.market_name || "منظومة الكابتن",
          phone: s.market_phone || "01010561128",
        });
      })
      .catch(() => {});
  }, []);

  const getPrinterSettings = () => {
    return { type: printerType, name: "" };
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const printA4 = () => {
    setOpen(false);
    const el = document.getElementById(printableId);
    if (!el) { window.print(); return; }
    // اطبع المنطقة المختارة فقط: عزل باقي الصفحة عبر كلاس على body
    el.classList.add("printable-closing", "print-target");
    document.body.classList.add("printing-isolate");
    const cleanup = () => {
      el.classList.remove("printable-closing", "print-target");
      document.body.classList.remove("printing-isolate");
      window.removeEventListener("afterprint", cleanup);
      try { hardRefocus(); } catch {}
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 2000);
  };

  const printThermalFujitsu = () => {
    setOpen(false);
    try {
      const req = new CustomEvent("thermal-print-request", { detail: { id: thermalId || printableId }, cancelable: true });
      if (window.dispatchEvent(req) === false) return;
    } catch {}
    try {
      const el = document.getElementById(thermalId || printableId);
      if (!el) throw new Error("receipt-missing");
      // نفس خلطة التقفيلة المجربة على نفس الطابعة: iframe بمقاس ثابت وهوامش محسوبة
      // wide = نوافذ المنظومة بنفس تنظيم الشاشة (شبكات + مربعات بحدود بدل الخلفيات)
      const is58 = getPrinterSettings().type === "thermal-58" ? true : false;
      const wide = printLayout === "wide";
      const pageW = is58 ? "58mm" : "80mm";
      const contentW = wide ? "70mm" : (is58 ? "50mm" : "68mm");
      const fontSize = wide ? "12px" : (is58 ? "12px" : "13px");
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".no-print, button, svg, input, select, textarea, video, audio, iframe").forEach(n => n.remove());
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow!.document;
      const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @page{size:${pageW} auto;margin:0}
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{width:${pageW};max-width:${pageW};margin:0;padding:0;font-family:Tahoma,sans-serif;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;direction:rtl;font-size:${fontSize};line-height:1.4;overflow:visible}
        .receipt-wrap{width:${contentW};margin:0 auto}
        table{width:100%;border-collapse:collapse;table-layout:fixed}
        th{background:#000 !important;color:#fff !important;padding:3px 4px;font-size:10px}
        td{padding:3px 4px;border:1px solid #000;font-size:11px;word-break:break-word}
        div[class*="flex"]{display:flex;justify-content:space-between;align-items:center;gap:2px}
        div[class*="text-center"]{text-align:center}
        div[class*="text-left"]{text-align:left}
        div[class*="grid"]{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:4px 0}
        div[class*="grid"]>div{border:2px solid #000;padding:5px;line-height:1.7;break-inside:avoid;page-break-inside:avoid}
        tr{page-break-inside:avoid;break-inside:avoid}
        [style]{background:#fff !important;color:#000 !important;border-color:#000 !important;box-shadow:none !important}
        div[class*="grid"]>div [style]{background:#fff !important;color:#000 !important}
      </style>
      </head><body><div class="receipt-wrap">${clone.innerHTML}</div></body></html>`;
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        try { iframe.contentWindow!.focus(); } catch {}
        try { iframe.contentWindow!.print(); } catch {}
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch {}
          try { hardRefocus(); } catch {}
        }, 1500);
      }, 400);
    } catch {
      alert("تعذر فتح نافذة الطباعة — تأكد من تعريف الطابعة على الويندوز ثم أعد المحاولة.");
    }
  };

  const saveAsImage = async () => {
    setOpen(false);
    const el = document.getElementById(printableId);
    if (!el) return;
    try {
      const { toPng } = await import("html-to-image");
      // دقة عالية: 3 أضعاف + تثبيت العرض الكامل عشان الصورة تطلع مالية الورقة
      const w = el.scrollWidth || el.offsetWidth || 800;
      const dataUrl = await toPng(el, {
        backgroundColor: "#ffffff",
        pixelRatio: 3,
        cacheBust: true,
        width: w,
        style: { margin: "0", transform: "none" },
      });
      const a = document.createElement("a");
      a.download = `${title}_${new Date().toISOString().slice(0,10)}.png`;
      a.href = dataUrl;
      a.click();
    } catch {}
  };

  const baseCls = variant === "primary"
    ? "bg-[var(--accent)] text-[var(--bg-deep)] border-[var(--accent)] hover:brightness-110"
    : "bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--bg-input)]";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className={`h-9 px-3 flex items-center gap-1.5 border rounded-lg text-xs font-black transition-all cursor-pointer ${baseCls}`}
        title="اختر نوع الطباعة"
      >
        <Printer size={14} strokeWidth={2} />
        <span>{title}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-56 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-xl shadow-xl z-50 overflow-hidden">
          <button onClick={printThermalFujitsu} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--accent-subtle)] text-right transition-colors cursor-pointer">
            <ScrollText size={16} className="text-[var(--accent)]" />
            <div>
              <div className="text-xs font-black text-[var(--text-primary)]">
                حرارية {getPrinterSettings().type === "thermal-58" ? "58mm" : "80mm"}
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">إيصال مطبوع</div>
            </div>
          </button>
          <button onClick={printA4} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--accent-subtle)] text-right border-t border-[var(--border)] transition-colors cursor-pointer">
            <FileText size={16} className="text-[var(--primary)]" />
            <div>
              <div className="text-xs font-black text-[var(--text-primary)]">عادية A4</div>
              <div className="text-[10px] text-[var(--text-muted)]">تقرير كامل</div>
            </div>
          </button>
          <button onClick={saveAsImage} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--accent-subtle)] text-right border-t border-[var(--border)] transition-colors cursor-pointer">
            <ImageIcon size={16} className="text-emerald-500" />
            <div>
              <div className="text-xs font-black text-[var(--text-primary)]">حفظ كصورة</div>
              <div className="text-[10px] text-[var(--text-muted)]">PNG عالي الدقة</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
