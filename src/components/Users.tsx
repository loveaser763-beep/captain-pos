import React, { useEffect, useState } from "react";
import { Users, Plus, Shield, ShieldCheck, Edit2, Trash2, X, AlertTriangle, CheckCircle } from "lucide-react";
import { User } from "../types";
import { authFetch } from "../authFetch";

interface UsersProps {
  currentUser: User | null;
}

export default function UsersManagement({ currentUser }: UsersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal controls
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "cashier" | "storekeeper">("cashier");
  
  // Permissions state array
  const [permissions, setPermissions] = useState<string[]>([]);

  const availablePermissions = [
    { id: "sales", label: "درج الكاشير والمبيعات" },
    { id: "purchases", label: "إدخال المشتريات والتوريد" },
    { id: "items", label: "إدارة الأصناف المخزنية والأسعار" },
    { id: "suppliers", label: "إدارة الموردين والجهات" },
    { id: "reports", label: "سحب التقارير والأرباح" },
    { id: "users", label: "التحكم في مستخدمي النظام وصلاحياتهم" },
    { id: "jameety", label: "🏪 جمعيتي (إدارة حسابات الجمعيتي)" },
    { id: "dashboard_stats", label: "رؤية الأرقام والإحصائيات المالية بالشاشة الرئيسية" },
    { id: "view_purchases_invoices", label: "عرض فواتير المشتريات بالشاشة الرئيسية" },
    { id: "edit_invoice", label: "تعديل الفواتير من الشاشة الرئيسية" },
    { id: "delete_invoice", label: "حذف الفواتير من الشاشة الرئيسية" },
    { id: "return_invoice", label: "إجراء مرتجع الفواتير من الشاشة الرئيسية (أمان عالي)" },
  ];

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/users");
      if (!response.ok) throw new Error("تعذر جلب ملفات المستخدمين.");
      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAdd = () => {
    setSelectedUser(null);
    setUsername("");
    setPassword("");
    setName("");
    setRole("cashier");
    setPermissions(["sales"]);
    setError("");
    setShowModal(true);
  };

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setUsername(user.username);
    setPassword("");
    setName(user.name);
    setRole(user.role);
    setPermissions(user.permissions || []);
    setError("");
    setShowModal(true);
  };

  const togglePermission = (permId: string) => {
    if (permissions.includes(permId)) {
      setPermissions(permissions.filter((p) => p !== permId));
    } else {
      setPermissions([...permissions, permId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !name || (!selectedUser && !password)) {
      setError("يرجى تعبئة الحقول الإلزامية كاملة وتحديد الصلاحيات.");
      return;
    }

    const payload = {
      username,
      password: password || undefined,
      name,
      role,
      permissions,
      logCreator: currentUser?.name || "المدير العام"
    };

    try {
      const url = selectedUser ? `/api/users/${selectedUser.id}` : "/api/users";
      const method = selectedUser ? "PUT" : "POST";

      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSuccess(selectedUser ? "تم تعديل ملف وبيانات المستخدم وصلاحياته." : "تم تسجيل حساب المستخدم بنجاح.");
        setShowModal(false);
        fetchUsers();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("اسم المستخدم مكرر بالفعل أو تعذر على الخادم الحفظ.");
      }
    } catch (err) {
      setError("خطأ اتصال بالخادم.");
    }
  };

  const handleDelete = async (id: number) => {
    const target = users.find(u => u.id === id);
    if (target?.username === "innocode") {
      alert("خطأ: لا يمكن حذف حساب مبرمج النظام الحصري.");
      return;
    }

    if (id === currentUser?.id) {
      alert("خطأ: لا يمكنك حذف حسابك الذي تسجل به حالياً.");
      return;
    }

    if (!window.confirm("هل ترغب بالفعل في حذف حساب هذا المستخدم نهائياً؟")) return;

    try {
      const response = await authFetch(`/api/users/${id}?logCreator=${encodeURIComponent(currentUser?.name || "")}`, {
        method: "DELETE"
      });
      if (response.ok) {
        setSuccess("تم إزالة ملف المستخدم بالكامل من النظام.");
        fetchUsers();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("فشلت عملية الحذف من قاعدة البيانات.");
      }
    } catch (err) {
      setError("خطأ اتصال الخادم.");
    }
  };

  return (
    <div className="w-full space-y-6 select-none font-sans" id="users-view" style={{ direction: "rtl" }}>
      {/* Header section */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#000000] flex items-center gap-2">
            <Users size={20} strokeWidth={1.5} />
            <span>إدارة الحسابات وصلاحيات الوصول</span>
          </h2>
          <p className="text-xs text-[#555555] font-semibold mt-1">إضافة المستخدمين وتخصيص الصلاحيات وأدوار العمل</p>
        </div>

        { (currentUser?.role === "admin" || currentUser?.permissions?.includes("users")) && (
          <button
            id="btn-add-user"
            onClick={handleOpenAdd}
            className="h-9 px-4 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} strokeWidth={1.5} />
            <span>تسجيل مستخدم جديد</span>
          </button>
        )}
      </div>

      {success && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="users-success">
          <CheckCircle size={16} strokeWidth={1.5} className="text-[#000000] shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {error && !showModal && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="users-error">
          <AlertTriangle size={16} strokeWidth={1.5} className="text-[#222222] shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Staff 12-Column Grid */}
      {loading ? (
        <div className="p-12 text-center text-[#555555] font-bold text-xs">جاري تحميل حسابات المستخدمين...</div>
      ) : (
        <div className="grid grid-cols-12 gap-4" id="users-grid">
          {users
            .filter((u) => u.username !== "innocode" || currentUser?.username === "innocode")
            .map((u) => (
            <div
              key={u.id}
              className="col-span-12 sm:col-span-6 lg:col-span-4 bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col justify-between space-y-4"
              id={`user-card-${u.id}`}
            >
              <div className="flex justify-between items-start pb-3 border-b border-[#888888]">
                <div>
                  <h4 className="font-extrabold text-sm text-[#000000]">{u.name}</h4>
                  <p className="text-xs text-[#555555] font-mono">@{u.username}</p>
                </div>

                {(currentUser?.role === "admin" || currentUser?.permissions?.includes("users") || currentUser?.role === "developer") && (
                  <div className="flex gap-1">
                    <button
                      id={`btn-edit-user-${u.id}`}
                      onClick={() => handleOpenEdit(u)}
                      className="w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] transition-colors cursor-pointer"
                      title="تعديل"
                    >
                      <Edit2 size={14} strokeWidth={1.5} />
                    </button>
                    {u.username !== "innocode" && (
                      <button
                        id={`btn-delete-user-${u.id}`}
                        onClick={() => handleDelete(u.id)}
                        className="w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] transition-colors cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 text-xs font-bold text-[#000000]">
                <div className="flex items-center justify-between bg-[#b8bcb2] p-2 border border-[#888888]/40">
                  <span className="text-[#555555]">الدور الرئيسي:</span>
                  <span>
                    {u.role === "developer" ? "مبرمج النظام" : u.role === "admin" ? "مدير عام" : u.role === "cashier" ? "كاشير" : "أمين مخزن"}
                  </span>
                </div>

                <div className="pt-2 border-t border-[#888888]/40">
                  <p className="text-xs font-bold text-[#555555] mb-2">الصلاحيات:</p>
                  <div className="flex flex-wrap gap-1">
                    {u.role === "admin" ? (
                      <span className="bg-[#222222] text-[#c3c6bb] text-xs font-bold px-2 py-0.5">صلاحيات عامة شاملة</span>
                    ) : u.permissions && u.permissions.length > 0 ? (
                      u.permissions.map((p, idx) => {
                        let label = p;
                        if (p === "sales") label = "المبيعات";
                        else if (p === "purchases") label = "المشتريات";
                        else if (p === "items") label = "المخزن";
                        else if (p === "suppliers") label = "الموردين";
                        else if (p === "reports") label = "التقارير";
                        else if (p === "users") label = "المستخدمين";
                        else if (p === "dashboard_stats") label = "الإحصائيات";
                        else if (p === "view_purchases_invoices") label = "عرض المشتريات";
                        else if (p === "edit_invoice") label = "تعديل الفواتير";
                        else if (p === "delete_invoice") label = "حذف الفواتير";
                        else if (p === "return_invoice") label = "مرتجع الفواتير";
                        return (
                          <span key={idx} className="bg-[#b8bcb2] text-[#000000] text-xs font-bold px-2 py-0.5 border border-[#888888]/60">
                            {label}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[#000000] text-xs font-bold">بدون صلاحيات إضافية</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50" id="user-modal">
          <div className="bg-[#c3c6bb] w-full max-w-md border border-[#222222] p-4 relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              id="btn-close-user-modal"
              onClick={() => setShowModal(false)}
              className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="text-sm font-black text-[#000000] text-right border-b border-[#888888] pb-2">
              {selectedUser ? `تعديل الحساب: ${selectedUser.name}` : "تسجيل مستخدم جديد"}
            </h3>

            {error && (
              <div className="bg-[#b8bcb2] border border-[#222222] p-2 text-[#000000] text-xs text-right font-bold">
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-right text-xs font-bold">
              <div>
                <label className="block text-[#000000] mb-1">الاسم الكامل للموظف</label>
                <input
                  id="modal-user-displayname"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم الموظف..."
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <label className="block text-[#000000] mb-1">اسم الدخول</label>
                  <input
                    id="modal-user-username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="اسم المستخدم"
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
                <div>
                  <label className="block text-[#000000] mb-1">
                    {selectedUser ? "كلمة المرور الجديدة" : "كلمة المرور"}
                  </label>
                  <input
                    id="modal-user-password"
                    type="password"
                    required={!selectedUser}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={selectedUser ? "تترك فارغة لتفادي التغيير" : "كلمة المرور"}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#000000] mb-1">الدور الوظيفي الرئيسي</label>
                <select
                  id="modal-user-role"
                  value={role}
                  onChange={(e: any) => {
                    const r = e.target.value;
                    setRole(r);
                    if (r === "admin") {
                      setPermissions(["sales", "purchases", "items", "suppliers", "reports", "users"]);
                    } else if (r === "cashier") {
                      setPermissions(["sales"]);
                    } else if (r === "storekeeper") {
                      setPermissions(["purchases", "items", "suppliers"]);
                    }
                  }}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] cursor-pointer"
                >
                  <option value="cashier">كاشير مبيعات</option>
                  <option value="storekeeper">أمين مخزن</option>
                  <option value="admin">مدير عام للنظام</option>
                </select>
              </div>

              {role !== "admin" && (
                <div className="pt-2 border-t border-[#888888]">
                  <label className="block text-[#000000] mb-2">الصلاحيات المخصصة:</label>
                  <div className="space-y-1">
                    {availablePermissions.map((perm) => {
                      const isChecked = permissions.includes(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className="flex items-center gap-2 bg-[#b8bcb2] p-2 border border-[#888888]/40 hover:bg-[#c3c6bb] cursor-pointer text-xs"
                        >
                          <input
                            id={`perm-checkbox-${perm.id}`}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(perm.id)}
                            className="w-4 h-4 accent-[#222222]"
                          />
                          <span className="text-[#000000] font-bold">{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                id="btn-save-user-submit"
                type="submit"
                className="w-full h-9 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center justify-center gap-x-4 gap-y-2 mt-2 cursor-pointer"
              >
                <ShieldCheck size={16} strokeWidth={1.5} />
                <span>حفظ بيانات الحساب</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
