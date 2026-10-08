// authFetch.ts — Wrapper for fetch that automatically includes JWT token
const TOKEN_KEY = "captain_auth_token";

// إعادة تركيز نافذة البرنامج من العملية الرئيسية — حل جذري لسرقة الفوكس
// بعد حوارات النظام (طباعة/تأكيد/سكرين) حيث window.focus() من الصفحة لا يكفي
export function hardRefocus(): void {
  try { (window as any).electronAPI?.refocus?.(); } catch {}
  try { window.focus(); } catch {}
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getAuthToken();
}

// Authenticated fetch — adds Bearer token to all requests
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  
  // Only set Content-Type for non-FormData requests
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  // If 401 → logout كامل: مسح التوكن + مسح جلسة الإلكترون + رجوع لشاشة الدخول
  // (من غير مسح الجلسة، Electron بيرجّعك للداشبورد بتوكن ميت في فضل "الرئيسية")
  // ⚠️ شرط `token`: لو مفيش توكن أصلًا (زي شاشة الدخول) مبنعيدش التحميل،
  //    وإلا هنعمل loop لا نهائي لما أي API يرجع 401 قبل تسجيل الدخول.
  if (res.status === 401 && token) {
    clearAuthToken();
    try { (window as any).electronAPI?.clearSession?.(); } catch {}
    window.location.reload();
  }

  return res;
}

// تنزيل ملف محمي بـ Bearer token.
// بوابة الأمان في السيرفر بتشترط ترويسة Authorization على كل /api،
// يعني <a href="/api/..."> العادي بيرجّع 401 — فلازم نجيب الملف بـ fetch ثم ننزّله.
export async function authDownload(url: string, fallbackName?: string): Promise<boolean> {
  try {
    const res = await authFetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    let name = fallbackName || "";
    if (!name) {
      const disp = res.headers.get("Content-Disposition") || "";
      const m = /filename="?([^";]+)"?/i.exec(disp);
      name = m ? m[1] : decodeURIComponent(url.split("/").pop() || "download");
    }
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(href); a.remove(); }, 1500);
    return true;
  } catch {
    return false;
  }
}

// Login helper
export async function login(username: string, password: string): Promise<{ success: boolean; token?: string; user?: any; message?: string }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.success && data.token) {
    setAuthToken(data.token);
  }
  return data;
}
