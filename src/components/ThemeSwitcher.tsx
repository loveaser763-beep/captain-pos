import { useState, useEffect, useRef } from "react";
import { Palette, Check } from "lucide-react";
import { authFetch } from "../authFetch";

export const THEMES = [
  { id: "royal-captain", name: "Royal Captain", emoji: "🏆", desc: "ذهبي + كحلي" },
  { id: "midnight-emerald", name: "Midnight Emerald", emoji: "💎", desc: "أخضر زمردي + أسود" },
  { id: "platinum-navy", name: "Platinum Navy", emoji: "⚡", desc: "نيلي + أسود" },
  { id: "obsidian-platinum", name: "Obsidian Platinum", emoji: "🖤", desc: "فضة + أسود" },
  { id: "midnight-sapphire", name: "Midnight Sapphire", emoji: "💙", desc: "أزرق ياقوتي + كحلي" },
  { id: "velvet-noir", name: "Velvet Noir", emoji: "🟣", desc: "بنفسجي + أسود" },
  { id: "pure-white", name: "Pure White", emoji: "☀️", desc: "أبيض ناصع + أسود" },
] as const;

export type ThemeId = typeof THEMES[number]["id"];

export function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  localStorage.setItem("captain-theme", id);
}

export function getSavedTheme(): ThemeId {
  return (localStorage.getItem("captain-theme") as ThemeId) || "royal-captain";
}

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ThemeId>(getSavedTheme);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTheme(current);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const select = (id: ThemeId) => {
    setCurrent(id);
    applyTheme(id);
    setOpen(false);
    authFetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { theme: id }, user_name: "النظام" }),
    }).catch(() => {});
  };

  const currentTheme = THEMES.find((t) => t.id === current);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title="تبديل التصميم"
        className="w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer hover:scale-110"
        style={{
          background: "var(--gradient-accent)",
          borderColor: "var(--border-strong)",
          boxShadow: "var(--shadow-glow)",
        }}
      >
        <Palette size={14} strokeWidth={2} className="text-white" />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 w-56 rounded-xl overflow-hidden z-[9999] border"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-strong)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>
              اختر التصميم
            </p>
          </div>
          <div className="p-1.5 max-h-72 overflow-y-auto">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => select(t.id)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-right transition-all duration-150 cursor-pointer hover:opacity-80"
                style={{
                  background: current === t.id ? "var(--accent-subtle)" : "transparent",
                  border: current === t.id ? `1px solid var(--border-strong)` : "1px solid transparent",
                }}
              >
                <span className="text-base">{t.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold truncate" style={{ color: "var(--text-primary)" }}>
                    {t.name}
                  </div>
                  <div className="text-[9px] font-semibold" style={{ color: "var(--text-muted)" }}>
                    {t.desc}
                  </div>
                </div>
                {current === t.id && (
                  <Check size={13} strokeWidth={2.5} style={{ color: "var(--accent)" }} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
