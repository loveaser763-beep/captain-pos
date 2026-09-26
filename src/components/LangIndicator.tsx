import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";

export default function LangIndicator({ compact = false }: { compact?: boolean }) {
  const [lang, setLang] = useState<"EN" | "AR">(() => {
    try {
      return navigator.language?.toLowerCase().startsWith("ar") ? "AR" : "EN";
    } catch {
      return "EN";
    }
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // كشف مباشر من الحرف المكتوب
      if (e.key.length === 1) {
        if (/[a-zA-Z]/.test(e.key)) setLang("EN");
        else if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(e.key)) setLang("AR");
      }
    };

    const onInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!target || typeof target.value !== "string") return;
      const val = target.value;
      if (!val) return;
      const last = val.slice(-1);
      if (/[a-zA-Z]/.test(last)) setLang("EN");
      else if (/[\u0600-\u06FF]/.test(last)) setLang("AR");
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("input", onInput, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("input", onInput, true);
    };
  }, []);

  const isAR = lang === "AR";

  if (compact) {
    return (
      <div
        title={isAR ? "الكيبورد عربي - اضغط Alt+Shift للتبديل للإنجليزي" : "الكيبورد إنجليزي - اضغط Alt+Shift للتبديل للعربي"}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest border select-none bg-[var(--bg-input)] ${
          isAR
            ? "text-[var(--success)] border-[var(--border)]"
            : "text-[var(--accent)] border-[var(--border)]"
        }`}
      >
        <Keyboard size={11} strokeWidth={2} className="shrink-0 opacity-80" />
        <span>{isAR ? "عربي" : "EN"}</span>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAR ? "bg-[var(--success)]" : "bg-[var(--accent)]"}`} />
      </div>
    );
  }

  return (
    <div
      title={isAR ? "الكيبورد عربي - اضغط Alt+Shift للتبديل للإنجليزي" : "الكيبورد إنجليزي - اضغط Alt+Shift للتبديل للعربي"}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black tracking-widest border cursor-help select-none transition-colors bg-[var(--bg-input)] ${
        isAR
          ? "text-[var(--success)] border-[var(--border)]"
          : "text-[var(--accent)] border-[var(--border)]"
      }`}
    >
      <Keyboard size={12} strokeWidth={2} className="shrink-0 opacity-70" />
      <span>{isAR ? "ع" : "EN"}</span>
      <span className={`w-2 h-2 rounded-full shrink-0 ${isAR ? "bg-[var(--success)]" : "bg-[var(--accent)]"}`} />
    </div>
  );
}
