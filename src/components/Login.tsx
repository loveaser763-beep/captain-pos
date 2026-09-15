import React, { useState } from "react";
import { Lock, User as UserIcon, AlertTriangle, ArrowRight, Cpu } from "lucide-react";
import { User } from "../types";
import LangIndicator from "./LangIndicator";
import { login as apiLogin } from "../authFetch";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    } else if (role === "cashier") {
      setUsername("cashier");
      setPassword("cashier123");
    } else if (role === "storekeeper") {
      setUsername("store");
      setPassword("store123");
    }
    setError("");
  };

  const quickLogin = async (role: string) => {
    let user = "", pass = "";
    if (role === "admin") { user = "admin"; pass = "admin123"; }
    else if (role === "cashier") { user = "cashier"; pass = "cashier123"; }
    else if (role === "storekeeper") { user = "store"; pass = "store123"; }
    setLoading(true);
    setError("");
    try {
      const data = await apiLogin(user, pass);
      if (data.success && data.user) {
        onLoginSuccess(data.user);
      } else {
        setError(data.message || "خطأ في الدخول.");
      }
    } catch {
      setError("خطأ في الاتصال بالشبكة.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lux-scope min-h-screen flex flex-col justify-center items-center p-4 select-none font-sans" id="login-screen" style={{ direction: "rtl" }}>
      <div className="w-full max-w-md lux-glass p-6 md:p-8 relative" id="login-card">
        
        {/* Company Header */}
        <div className="flex items-center justify-between border-b border-[rgba(221,228,239,0.16)] pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-[#241a05] flex items-center justify-center shadow-lg">
              <Cpu size={22} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="lux-metallic text-lg tracking-widest font-mono uppercase">منظومة الكابتن</h1>
              <p className="text-[10px] font-mono font-bold text-slate-400 tracking-tight -mt-0.5">لهندسة الأرقام وريادة الأعمال</p>
            </div>
          </div>
          <div className="text-left font-mono">
            <span className="text-[10px] font-bold text-slate-100 block">الكابتن</span>
            <span className="text-[9px] text-slate-400 block">نظام منظومة الكابتن</span>
          </div>
        </div>

        {/* System Title */}
        <div className="mb-6 text-right">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-50">تسجيل الدخول للنظام</h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">أدخل بيانات الاعتماد للمتابعة في التحكم بالمتجر والمبيعات</p>
            </div>
            <LangIndicator compact />
          </div>
        </div>

        {/* Action Error Box */}
        {error && (
          <div className="mb-5 flex items-start gap-x-4 gap-y-2 lux-glass p-3 text-right" id="login-error">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-300" />
            <p className="font-bold text-xs text-rose-100 leading-snug">{error}</p>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="lux-label text-right">اسم المستخدم</label>
            <div className="relative">
              <input
                id="input-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="اسم المستخدم"
                className="lux-input w-full pr-9 text-right"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <UserIcon size={16} strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <div>
            <label className="lux-label text-right">كلمة المرور</label>
            <div className="relative">
              <input
                id="input-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                className="lux-input w-full pr-9 text-right"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={16} strokeWidth={1.5} />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="btn-login-submit"
            type="submit"
            disabled={loading}
            className="lux-btn lux-btn-primary w-full mt-2"
          >
            {loading ? (
              <span className="text-xs">جاري التحقق...</span>
            ) : (
              <>
                <ArrowRight size={16} strokeWidth={1.5} className="transform rotate-180" />
                <span>تسجيل الدخول للنظام</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Fill Demo Accounts */}
        <div className="mt-6 pt-4 border-t border-[rgba(221,228,239,0.16)]" id="login-helper-accounts">
          <p className="text-[10px] font-bold text-slate-400 text-center mb-3">حسابات التجربة السريعة</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              id="btn-fill-admin"
              type="button"
              onClick={() => quickLogin("admin")}
              disabled={loading}
              className="lux-btn lux-btn-ghost flex-1 min-w-[70px]"
            >
              المدير
            </button>
            <button
              id="btn-fill-cashier"
              type="button"
              onClick={() => quickLogin("cashier")}
              disabled={loading}
              className="lux-btn lux-btn-ghost flex-1 min-w-[70px]"
            >
              الكاشير
            </button>
            <button
              id="btn-fill-store"
              type="button"
              onClick={() => quickLogin("storekeeper")}
              disabled={loading}
              className="lux-btn lux-btn-ghost flex-1 min-w-[70px]"
            >
              أمين المخزن
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-[9px] font-mono text-slate-500">
          منظومة الكابتن — لهندسة الأرقام وريادة الأعمال © 2026
        </div>
      </div>
    </div>
  );
}

