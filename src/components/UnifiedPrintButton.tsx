import { useState, useRef, useEffect } from "react";
import { Printer, ChevronDown, FileText, Image as ImageIcon, ScrollText } from "lucide-react";

interface UnifiedPrintButtonProps {
  printableId: string; // id للعنصر اللي هيتطبع
  thermalId?: string; // id لمنطقة الإيصال الحراري (لو مختلفة عن printableId)
  title?: string;
  variant?: "primary" | "ghost";
}

export default function UnifiedPrintButton({ printableId, thermalId, title = "طباعة", variant = "ghost" }: UnifiedPrintButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // قراءة إعدادات الطابعة من localStorage
  const getPrinterSettings = () => {
    const type = localStorage.getItem("captain_printer_type") || "thermal-80";
    const name = localStorage.getItem("captain_printer_name") || "";
    return { type, name };
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
    const el = document.getElementById(thermalId || printableId);
    if (!el) { window.print(); return; }

    const { type } = getPrinterSettings();
    const paperWidth = type === "thermal-58" ? "58mm" : "80mm";
    const contentWidth = type === "thermal-58" ? "52mm" : "74mm";
    const fontSize = type === "thermal-58" ? "11px" : "12px";

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
    let shopName = "منظومة الكابتن";
    let shopTag = "لهندسة الأرقام وريادة الأعمال";
    let shopPhone = "01010561128";
    try {
      shopName = localStorage.getItem("supermarket_market_name") || localStorage.getItem("shop_name") || shopName;
      shopPhone = localStorage.getItem("supermarket_market_phone") || localStorage.getItem("shop_phone") || shopPhone;
    } catch {}
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @page{size:${paperWidth} auto;margin:1mm}
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{width:100%;max-width:100%;margin:0;padding:1mm;font-family:Cairo, Tahoma, sans-serif;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;direction:rtl;font-size:${fontSize};line-height:1.3}
        div,section,article,header,footer{margin:0;padding:0}
        div[class*="flex"]{display:flex;justify-content:space-between;align-items:center;gap:2px;flex-wrap:wrap}
        div[class*="flex-col"]{flex-direction:column;justify-content:flex-start;align-items:stretch}
        div[class*="justify-center"]{justify-content:center}
        div[class*="justify-end"]{justify-content:flex-end}
        div[class*="items-start"]{align-items:flex-start}
        div[class*="grid"]{display:grid;gap:3px}
        div[class*="grid-cols-2"],div[class*="grid-cols-3"],div[class*="grid-cols-4"]{grid-template-columns:1fr 1fr}
        div[class*="text-center"]{text-align:center}
        div[class*="text-left"]{text-align:left}
        span[class*="text-center"]{text-align:center}
        h1{font-size:13px;margin:3px 0;text-align:center}
        h2{font-size:11px;margin:2px 0;text-align:center}
        h3{font-size:10px;margin:2px 0}
        h4{font-size:9px;margin:2px 0}
        p{font-size:10px;margin:1px 0}
        span{font-size:inherit}
        table{width:100%;max-width:${contentWidth};border-collapse:collapse;margin:4px 0;page-break-inside:auto;table-layout:fixed}
        tr{page-break-inside:avoid}
        th{background:#000;color:#fff;padding:4px 5px;font-size:10px;word-break:break-word;overflow-wrap:anywhere}
        td{padding:4px 5px;border:1px solid #000;font-size:10px;word-break:break-word;overflow-wrap:anywhere}
        .no-print{display:none !important}
        img{max-width:100%;width:100%;height:auto;object-fit:contain}
        div:has(> img){width:100%;text-align:center}
      </style>
      </head><body>${clone.innerHTML}<div style="text-align:center;margin-top:5px;padding-top:4px;border-top:2px solid #000;font-size:11px;font-weight:900">${shopName} (${shopTag})</div><div style="text-align:center;font-size:9px">شكراً لتعاملكم معنا — ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</div></body></html>`;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1500);
    }, 300);
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
    ? "bg-[var(--accent)] text-[#0B1120] border-[var(--accent)] hover:brightness-110"
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
