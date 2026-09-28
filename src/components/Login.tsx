import React, { useState } from "react";
import {
  Lock,
  User as UserIcon,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { User } from "../types";
import LangIndicator from "./LangIndicator";
import { login as apiLogin } from "../authFetch";
import "../login3d.css";
import "../login-variants.css";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [maskUsername, setMaskUsername] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // نموذج الصفحة الحالي (glass | matte | slim) — وزر التبديل في أسفل الشاشة
  const STYLES: Array<"glass" | "matte" | "slim"> = ["glass", "matte", "slim"];
  const STYLE_LABELS: Record<string, string> = { glass: "زجاجي", matte: "داكن ذهبي", slim: "مدمج" };
  const [styleKey, setStyleKey] = useState<"glass" | "matte" | "slim">(() => {
    try {
      const v = localStorage.getItem("cap_login_style");
      return v === "matte" || v === "slim" ? v : "glass";
    } catch {
      return "glass";
    }
  });
  const cycleStyle = () => {
    const next = STYLES[(STYLES.indexOf(styleKey) + 1) % STYLES.length];
    setStyleKey(next);
    try { localStorage.setItem("cap_login_style", next); } catch {}
  };

  const doLogin = async (u: string, p: string) => {
    if (!u || !p) {
      setError("الرجاء إدخال اسم المستخدم وكلمة المرور.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiLogin(u, p);
      if (data.success && data.user) {
        onLoginSuccess(data.user);
      } else {
        setError(data.message || "اسم المستخدم أو كلمة المرور غير صحيحة.");
      }
    } catch (err) {
      setError("حدث خطأ في الاتصال بالشبكة. يرجى التأكد من تشغيل خادم Node.js الخلفي بنجاح.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void doLogin(username, password);
  };

  // زر الدخول السريع: يملّي اسم المستخدم بس وينتظر كتابة كلمة المرور يدويًا
  const fillCredentials = (role: string) => {
    let u = "";
    if (role === "admin") {
      u = "admin";
    } else if (role === "cashier") {
      u = "cashier";
    } else if (role === "storekeeper") {
      u = "store";
    }
    if (!u) return;
    setUsername(u);
    setPassword("");
    setMaskUsername(false);
    setError("");
    setTimeout(() => document.getElementById("input-password")?.focus(), 0);
  };

  return (
    <div
      className={`lux-scope relative min-h-screen flex items-center justify-center select-none font-sans overflow-hidden login-style-${styleKey}`}
      id="login-screen"
      style={{ direction: "rtl" }}
    >
      {/* ============ الخلفية: نموذج 4B — تاج ذهبي + شبكة على كحلي ============ */}
      <div className="login-3d" aria-hidden="true">
        <svg
          className="login-3d__art"
          viewBox="0 0 1366 728"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="capGold4b" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FCEFC0" />
              <stop offset="55%" stopColor="#E4B95B" />
              <stop offset="100%" stopColor="#A9752A" />
            </linearGradient>
            <linearGradient id="capTitleGold" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#F7E3A1" />
              <stop offset="50%" stopColor="#E4B95B" />
              <stop offset="100%" stopColor="#C08D31" />
            </linearGradient>
            <filter id="capCrownGlow" x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="capTitleGlow" x="-25%" y="-60%" width="150%" height="220%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* اسم المنظومة فوق التاج */}
          <text
            x="683"
            y="92"
            textAnchor="middle"
            fill="url(#capTitleGold)"
            filter="url(#capTitleGlow)"
            style={{
              fontFamily: '"Cairo", "Segoe UI", Tahoma, sans-serif',
              fontSize: "58px",
              fontWeight: 900,
              letterSpacing: "3px",
            }}
          >
            منظومة الكابتن
          </text>

          {/* الشبكة + العُقد */}
          <g stroke="url(#capGold4b)" strokeWidth="1.3" fill="none" opacity="0.45">
            <path d="M50,640 L300,470 L520,540 L683,436 L880,510 L1080,420 L1316,580" />
            <path d="M100,340 L340,450 L540,340 L683,436 L840,310 L1040,400 L1266,310" />
            <path d="M300,470 L340,450 M520,540 L540,340 M880,510 L840,310 M1080,420 L1040,400" />
            <path d="M50,640 L100,340 M1316,580 L1266,310 M683,436 L683,264 M540,340 L683,264 M840,310 L683,264" />
          </g>
          <g fill="url(#capGold4b)">
            <circle cx="50" cy="640" r="6" />
            <circle cx="300" cy="470" r="8" />
            <circle cx="520" cy="540" r="6" />
            <circle cx="683" cy="436" r="12" />
            <circle cx="880" cy="510" r="8" />
            <circle cx="1080" cy="420" r="6" />
            <circle cx="1316" cy="580" r="6" />
            <circle cx="100" cy="340" r="5" />
            <circle cx="340" cy="450" r="5" />
            <circle cx="540" cy="340" r="5" />
            <circle cx="840" cy="310" r="5" />
            <circle cx="1040" cy="400" r="5" />
            <circle cx="1266" cy="310" r="5" />
            <circle cx="683" cy="264" r="7" />
          </g>

          {/* التاج الذهبي + الشريط تحته */}
          <g transform="translate(683,296) scale(0.98)" filter="url(#capCrownGlow)">
            <path
              d="M-150,-40 L-86,-124 L-40,-64 L0,-152 L40,-64 L86,-124 L150,-40 L130,4 L-130,4 Z"
              fill="url(#capGold4b)"
            />
            <rect x="-130" y="28" width="260" height="18" rx="9" fill="url(#capGold4b)" opacity="0.9" />
            <circle cx="0" cy="-176" r="16" fill="url(#capGold4b)" />
          </g>

          {/* أعمدة بيانية في الأسفل */}
          <g fill="url(#capGold4b)" opacity="0.7">
            <rect x="170" y="636" width="17" height="62" rx="8" />
            <rect x="202" y="606" width="17" height="92" rx="8" />
            <rect x="234" y="650" width="17" height="48" rx="8" />
            <rect x="1148" y="636" width="17" height="62" rx="8" />
            <rect x="1180" y="600" width="17" height="98" rx="8" />
            <rect x="1212" y="648" width="17" height="50" rx="8" />
          </g>

          {/* الشعار الفرعي تحت التاج والخطوط */}
          <text
            x="683"
            y="676"
            textAnchor="middle"
            fill="#E4C98A"
            style={{
              fontFamily: '"Cairo", "Segoe UI", Tahoma, sans-serif',
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "5px",
            }}
          >
            لهندسة الأرقام وريادة الأعمال
          </text>
        </svg>
        <div className="login-3d__scrim" />
      </div>

      {/* ============ لوحة الدخول الصغيرة ============ */}
      <div className="login-corner-panel" id="login-card">
        <div className="login-panel-head mb-2.5">
          <h2>أهلًا بك من جديد</h2>
          <p>سجّل دخولك عشان تكمّل شغلك في التحكم بالمتجر والمبيعات.</p>
        </div>

        {/* صندوق الخطأ */}
        {error && (
          <div
            id="login-error"
            className="mb-5 flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-input)] p-3.5"
            role="alert"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--danger)]" />
            <p className="text-xs font-bold leading-snug text-[var(--danger)]">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label htmlFor="input-username" className="lux-label">
              اسم المستخدم
            </label>
            <div className="relative">
              <input
                id="input-username"
                type={maskUsername ? "password" : "text"}
                autoComplete={maskUsername ? "off" : "username"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="login-field"
              />
              <span className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--text-muted)]">
                <UserIcon size={16} strokeWidth={1.7} />
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="input-password" className="lux-label">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="input-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="login-field"
              />
              <span className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--text-muted)]">
                <Lock size={16} strokeWidth={1.7} />
              </span>
            </div>
          </div>

          <button id="btn-login-submit" type="submit" disabled={loading} className="login-submit">
            {loading ? (
              <>
                <span className="login-spinner" />
                <span>جاري التحقق…</span>
              </>
            ) : (
              <>
                <span>تسجيل الدخول</span>
                <ArrowLeft size={17} strokeWidth={2.2} />
              </>
            )}
          </button>
        </form>

        {/* حسابات التجربة السريعة */}
        <div className="mt-2.5 border-t border-[var(--border)] pt-2.5" id="login-helper-accounts">
          <div className="mb-2 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-[8.5px] font-black tracking-[0.18em] text-[var(--text-muted)]">
              دخول سريع
            </span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              id="btn-fill-admin"
              type="button"
              onClick={() => fillCredentials("admin")}
              disabled={loading}
              className="login-chip"
            >
              المدير
            </button>
            <button
              id="btn-fill-cashier"
              type="button"
              onClick={() => fillCredentials("cashier")}
              disabled={loading}
              className="login-chip"
            >
              الكاشير
            </button>
            <button
              id="btn-fill-store"
              type="button"
              onClick={() => fillCredentials("storekeeper")}
              disabled={loading}
              className="login-chip"
            >
              أمين المخزن
            </button>
          </div>
        </div>

        <div className="login-panel-foot">
          منظومة الكابتن — لهندسة الأرقام وريادة الأعمال © 2026
        </div>
      </div>

      {/* ============ سطور صغيرة أسفل الشاشة ============ */}
      <div className="login-corner-meta">v3.1 · 2026</div>
      <button
        type="button"
        id="btn-login-style"
        onClick={cycleStyle}
        className="login-style-switch"
        title="تبديل نموذج شاشة الدخول"
      >
        النموذج: {STYLE_LABELS[styleKey]}
      </button>
      <div className="login-lang">
        <LangIndicator compact />
      </div>
    </div>
  );
}
