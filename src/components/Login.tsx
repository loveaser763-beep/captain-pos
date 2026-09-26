import React, { useState } from "react";
import {
  Lock,
  User as UserIcon,
  AlertTriangle,
  ArrowLeft,
  Cpu,
  Store,
  Package,
  BarChart3,
  Wallet,
} from "lucide-react";
import { User } from "../types";
import LangIndicator from "./LangIndicator";
import { login as apiLogin } from "../authFetch";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

const FEATURES: { icon: React.ElementType; title: string; sub: string }[] = [
  { icon: Store, title: "نقطة بيع وفواتير", sub: "بيع سريع وطباعة فورية" },
  { icon: Package, title: "مخزون ومشتريات", sub: "جرد وتوريد وتحت الحساب" },
  { icon: BarChart3, title: "تقارير ومطابقة التموين", sub: "أرباح واستعاضات ونقاط" },
  { icon: Wallet, title: "خزينة وتقسيط", sub: "مقبوضات ومدفوعات وشرائح" },
];

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [maskUsername, setMaskUsername] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devMode, setDevMode] = useState(false);
  const [devUser, setDevUser] = useState("");
  const [devPass, setDevPass] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("الرجاء إدخال اسم المستخدم وكلمة المرور.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiLogin(username, password);
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

  const fillCredentials = (role: string) => {
    if (role === "admin") {
      setUsername("admin");
      setPassword("admin123");
      setMaskUsername(false);
    } else if (role === "cashier") {
      setUsername("cashier");
      setPassword("cashier123");
      setMaskUsername(false);
    } else if (role === "storekeeper") {
      setUsername("store");
      setPassword("store123");
      setMaskUsername(false);
    }
    setError("");
  };

  const cancelDevGate = () => {
    setDevMode(false);
    setDevUser("");
    setDevPass("");
    setError("");
  };

  const submitDevGate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devUser || !devPass) {
      setError("الرجاء إدخال اسم المستخدم وكلمة المرور.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiLogin(devUser, devPass);
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

  const BrandMark = ({ size = 54 }: { size?: number }) => (
    <div className="login-brand-mark" style={{ width: size, height: size }}>
      <Cpu size={Math.round(size * 0.52)} strokeWidth={1.6} />
    </div>
  );

  return (
    <div
      className="lux-scope min-h-screen flex select-none font-sans"
      id="login-screen"
      style={{ direction: "rtl" }}
    >
      {/* ============ عمود العلامة (يمين) ============ */}
      <aside className="login-brand relative hidden lg:flex w-[44%] max-w-[580px] shrink-0 flex-col justify-between overflow-hidden p-10 xl:p-14">
        <div className="login-brand-grid" aria-hidden="true" />
        <div className="login-brand-blob" aria-hidden="true" />

        {/* هوية */}
        <div className="relative z-10 flex items-center gap-4">
          <BrandMark />
          <div className="leading-tight">
            <div className="text-[19px] font-black tracking-[0.16em]">منظومة الكابتن</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.34em] opacity-70">
              Captain POS Suite
            </div>
          </div>
        </div>

        {/* العرض القيمي */}
        <div className="relative z-10 my-8">
          <h1 className="text-[26px] xl:text-[31px] font-black leading-[1.4] max-w-[16ch]">
            منصّة واحدة
            <br />
            لإدارة بيتك تجاريًا.
          </h1>
          <p className="mt-3 max-w-[38ch] text-[13px] font-semibold leading-relaxed opacity-80">
            مبيعات، مخزون، خزينة، وتقارير لحظية — كلها متجمّعة في شاشة واحدة تتابعها لحظة بلحظة.
          </p>

          <ul className="mt-7 space-y-3.5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.title} className="flex items-center gap-3">
                  <span className="login-feat-icon">
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[13px] font-black">{f.title}</span>
                    <span className="block text-[11px] font-semibold opacity-70">{f.sub}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* تذييل */}
        <div className="relative z-10 flex items-center justify-between gap-4 text-[11px] font-black">
          <span className="opacity-80">لهندسة الأرقام وريادة الأعمال</span>
          <span className="opacity-60 font-mono">v3.1 · 2026</span>
        </div>
      </aside>

      {/* ============ لوحة النموذج (يسار) ============ */}
      <main className="relative flex flex-1 min-w-0 items-center justify-center px-5 py-8 sm:px-8">
        <div className="absolute top-5 left-5 z-10">
          <LangIndicator compact />
        </div>

        <div className="w-full max-w-[420px]" id="login-card">
          {/* هوية مصغّرة للشاشات الصغيرة */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size={42} />
            <div className="leading-tight">
              <div className="text-[15px] font-black tracking-[0.1em]">منظومة الكابتن</div>
              <div className="text-[9.5px] font-black uppercase tracking-[0.28em] text-[var(--text-muted)]">
                Captain POS Suite
              </div>
            </div>
          </div>

          {/* العنوان */}
          <div className="mb-7">
            <h2 className="text-[23px] font-black leading-tight text-[var(--text-primary)]">
              أهلًا بك من جديد
            </h2>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-[var(--text-secondary)]">
              سجّل دخولك عشان تكمّل شغلك في التحكم بالمتجر والمبيعات.
            </p>
          </div>

          {/* صندوق الخطأ */}
          {error && (
            <div
              id="login-error"
              className="mb-6 flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-input)] p-3.5"
              role="alert"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--danger)]" />
              <p className="text-xs font-bold leading-snug text-[var(--danger)]">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="اسم المستخدم"
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

          {/* بوابة دخول المبرمج — بتطلب البيانات يدويًا من غير ما تفضحها */}
          {devMode ? (
            <div className="mt-7 border-t border-[var(--border)] pt-6" id="login-dev-gate">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-[10px] font-black tracking-[0.18em] text-[var(--danger)]">
                  🔒 دخول المبرمج
                </span>
                <span className="h-px flex-1 bg-[var(--border)]" />
              </div>

              <p className="mb-4 text-center text-[11px] font-bold leading-relaxed text-[var(--text-muted)]">
                أدخل بيانات الاعتماد يدويًا — مش محفوظة ولا بتظهر لأي حد.
              </p>

              <form onSubmit={submitDevGate} className="space-y-3">
                <div className="relative">
                  <input
                    id="dev-input-username"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={devUser}
                    onChange={(e) => setDevUser(e.target.value)}
                    placeholder="اسم المستخدم"
                    className="login-field"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--text-muted)]">
                    <UserIcon size={16} strokeWidth={1.7} />
                  </span>
                </div>

                <div className="relative">
                  <input
                    id="dev-input-password"
                    type="password"
                    autoComplete="new-password"
                    value={devPass}
                    onChange={(e) => setDevPass(e.target.value)}
                    placeholder="كلمة المرور"
                    className="login-field"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--text-muted)]">
                    <Lock size={16} strokeWidth={1.7} />
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    id="btn-dev-confirm"
                    type="submit"
                    disabled={loading}
                    className="login-chip login-chip-strong flex-1"
                  >
                    {loading ? "جاري التحقق…" : "تأكيد الدخول"}
                  </button>
                  <button
                    id="btn-dev-cancel"
                    type="button"
                    onClick={cancelDevGate}
                    disabled={loading}
                    className="login-chip flex-1"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="mt-7 border-t border-[var(--border)] pt-6" id="login-helper-accounts">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-[10px] font-black tracking-[0.18em] text-[var(--text-muted)]">
                  تجربة سريعة
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

              <button
                id="btn-fill-developer"
                type="button"
                onClick={() => {
                  setDevMode(true);
                  setDevUser("");
                  setDevPass("");
                  setError("");
                }}
                disabled={loading}
                title="دخول المبرمج — بيطلب البيانات يدويًا"
                className="login-chip login-chip-secret"
              >
                •••&nbsp;&nbsp;دخول المبرمج
              </button>
            </div>
          )}

          <div className="mt-7 text-center text-[10.5px] font-bold text-[var(--text-muted)]">
            منظومة الكابتن — لهندسة الأرقام وريادة الأعمال © 2026
          </div>
        </div>
      </main>
    </div>
  );
}
