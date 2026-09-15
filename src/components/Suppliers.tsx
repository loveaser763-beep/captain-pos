import React, { useEffect, useState } from "react";
import { Truck, Plus, Search, Edit2, Trash2, X, Check, AlertTriangle, CheckCircle, Smartphone, MapPin, Package, FileText, Eye } from "lucide-react";
import { Supplier, Item, Invoice, User } from "../types";
import { authFetch } from "../authFetch";

interface SuppliersProps {
  currentUser: User | null;
}

export default function Suppliers({ currentUser }: SuppliersProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal Control
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Detail Modal Control (Linked items & purchase invoices)
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [activeTab, setActiveTab] = useState<"items" | "invoices">("items");

  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isTamweenSupplier, setIsTamweenSupplier] = useState<number>(0);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [supRes, itemsRes, invRes] = await Promise.all([
        authFetch("/api/suppliers"),
        authFetch("/api/items"),
        authFetch("/api/invoices?type=purchases")
      ]);

      if (!supRes.ok) throw new Error("فشل في تحميل لائحة الموردين من النظام.");
      const supData = await supRes.json();
      setSuppliers(supData);

      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        setItems(itemsData);
      }

      if (invRes.ok) {
        const invData = await invRes.json();
        setPurchaseInvoices(invData);
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setSelectedSupplier(null);
    setName("");
    setPhone("");
    setAddress("");
    setError("");
    setShowModal(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setSelectedSupplier(sup);
    setName(sup.name);
    setPhone(sup.phone);
    setAddress(sup.address);
    setIsTamweenSupplier((sup as any).is_tamween_supplier || 0);
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name || !phone) {
      setError("حقول اسم المورد ورقم الهاتف رئيسية ومطلوبة.");
      return;
    }

    const payload = {
      name,
      phone,
      address,
      is_tamween_supplier: isTamweenSupplier,
      logCreator: currentUser?.name || "المدير"
    };

    try {
      const url = selectedSupplier ? `/api/suppliers/${selectedSupplier.id}` : "/api/suppliers";
      const method = selectedSupplier ? "PUT" : "POST";

      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSuccess(selectedSupplier ? "تم تعديل بيانات المورد." : "تم تسجيل المورد الجديد بنجاح في المنظومة.");
        setShowModal(false);
        fetchData();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("فشلت عملية حفظ المورد، يرجى التأكد من البيانات.");
      }
    } catch (err) {
      setError("خطأ اتصال بالخادم.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("هل ترغب بالفعل بحذف هذا المورد؟")) return;
    try {
      const response = await authFetch(`/api/suppliers/${id}?logCreator=${encodeURIComponent(currentUser?.name || "")}`, {
        method: "DELETE"
      });
      if (response.ok) {
        setSuccess("تم إزالة بيانات المورد من النظام بالكامل.");
        fetchData();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("تعذر الحذف من الخادم.");
      }
    } catch (err) {
      setError("خطأ اتصال بالخادم.");
    }
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.includes(searchQuery) || s.phone.includes(searchQuery)
  );

  return (
    <div className="w-full space-y-6 select-none font-sans" id="suppliers-view" style={{ direction: "rtl" }}>
      {/* Header section */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#000000] flex items-center gap-2">
            <Truck size={20} strokeWidth={1.5} />
            <span>سجل الموردين وشركات الإمداد</span>
          </h2>
          <p className="text-xs text-[#555555] font-semibold mt-1">إدارة الشركات والمصانع الموردة للسلع والبضائع</p>
        </div>

        {(currentUser?.role === "admin" || currentUser?.permissions?.includes("suppliers")) && (
          <button
            id="btn-add-supplier"
            onClick={handleOpenAdd}
            className="h-9 px-4 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} strokeWidth={1.5} />
            <span>تسجيل مورد جديد</span>
          </button>
        )}
      </div>

      {/* Alert Messages */}
      {success && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="supplier-success">
          <CheckCircle size={16} strokeWidth={1.5} className="text-[#000000] shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {error && !showModal && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="supplier-error">
          <AlertTriangle size={16} strokeWidth={1.5} className="text-[#222222] shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Filter and search tools */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222]" id="suppliers-search-tool">
        <div className="relative">
          <input
            id="suppliers-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم المورد أو الشركة أو رقم الهاتف..."
            className="w-full h-9 bg-[#b8bcb2] border border-[#888888] pr-9 pl-3 text-right text-xs text-[#000000] font-bold focus:outline-none focus:border-[#222222] placeholder:text-[#555555]"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#222222]">
            <Search size={16} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Display List Cards 12-Column Grid */}
      {loading ? (
        <div className="p-12 text-center text-[#555555] font-bold text-xs">جاري تحميل سجل الموردين...</div>
      ) : filteredSuppliers.length > 0 ? (
        <div className="grid grid-cols-12 gap-4" id="suppliers-grid">
          {filteredSuppliers.map((sup) => (
            <div
              key={sup.id}
              className="col-span-12 sm:col-span-6 lg:col-span-4 bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col justify-between space-y-4"
              id={`supplier-card-${sup.id}`}
            >
              <div className="flex justify-between items-start pb-3 border-b border-[#888888]">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm text-[#000000]">{sup.name}</h4>
                    {(sup as any).is_tamween_supplier === 1 && (
                      <span className="bg-orange-200 text-orange-800 px-1.5 py-0.5 text-[10px] font-bold">تموين</span>
                    )}
                  </div>
                  <span className="text-xs text-[#555555] font-mono">مورد #{sup.id}</span>
                </div>

                {(currentUser?.role === "admin" || currentUser?.permissions?.includes("suppliers")) && (
                  <div className="flex gap-1">
                    <button
                      id={`btn-edit-supplier-${sup.id}`}
                      onClick={() => handleOpenEdit(sup)}
                      className="w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] transition-colors cursor-pointer"
                      title="تعديل"
                    >
                      <Edit2 size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      id={`btn-delete-supplier-${sup.id}`}
                      onClick={() => handleDelete(sup.id!)}
                      className="w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] transition-colors cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs font-bold text-[#000000]">
                <div className="flex items-center justify-between bg-[#b8bcb2] p-2 border border-[#888888]/40">
                  <span className="text-[#555555]">الهاتف:</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span>{sup.phone}</span>
                    <Smartphone size={14} strokeWidth={1.5} className="text-[#222222]" />
                  </div>
                </div>

                {sup.address && (
                  <div className="flex items-center justify-between bg-[#b8bcb2] p-2 border border-[#888888]/40">
                    <span className="text-[#555555]">العنوان:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[180px]">{sup.address}</span>
                      <MapPin size={14} strokeWidth={1.5} className="text-[#222222] shrink-0" />
                    </div>
                  </div>
                )}

                {/* Linked metrics */}
                {(() => {
                  const supItems = items.filter(i => i.supplier_id === sup.id || i.supplier_name === sup.name);
                  const supInvoices = purchaseInvoices.filter(inv => inv.customer_name === sup.name);
                  const totalPurchasesAmount = supInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

                  return (
                    <div className="space-y-2 pt-2 border-t border-[#888888]">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-center text-[11px]">
                        <div className="bg-[#b8bcb2] p-2 border border-[#888888]/40">
                          <div className="text-[#555555]">الأصناف:</div>
                          <div className="font-extrabold text-[#000000] text-xs flex items-center justify-center gap-1">
                            <Package size={12} strokeWidth={1.5} />
                            <span>{supItems.length} صنف</span>
                          </div>
                        </div>
                        <div className="bg-[#b8bcb2] p-2 border border-[#888888]/40">
                          <div className="text-[#555555]">فواتير المشتريات:</div>
                          <div className="font-extrabold text-[#000000] text-xs flex items-center justify-center gap-1">
                            <FileText size={12} strokeWidth={1.5} />
                            <span>{supInvoices.length} فاتورة</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setDetailSupplier(sup);
                          setActiveTab("items");
                        }}
                        className="w-full h-8 bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye size={14} strokeWidth={1.5} />
                        <span>عرض الأصناف والفواتير المرتبطة</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#c3c6bb] p-12 text-center text-[#555555] border border-[#222222] font-bold text-xs space-y-2">
          <Truck size={32} strokeWidth={1.5} className="mx-auto text-[#222222]" />
          <p>لا يوجد موردون مسجلون يطابقون نتيجة البحث.</p>
        </div>
      )}

      {/* Supplier Linked Detail Drawer Modal */}
      {detailSupplier && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50">
          <div className="bg-[#c3c6bb] border border-[#222222] w-full max-w-4xl p-4 relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setDetailSupplier(null)}
              className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="border-b border-[#888888] pb-3 text-right">
              <h3 className="text-base font-extrabold text-[#000000] flex items-center gap-2">
                <Truck size={18} strokeWidth={1.5} />
                <span>المورد: {detailSupplier.name}</span>
              </h3>
              <p className="text-xs text-[#555555] font-semibold mt-1">
                الهاتف: {detailSupplier.phone} {detailSupplier.address ? `| العنوان: ${detailSupplier.address}` : ""}
              </p>
            </div>

            {/* Tabs Header */}
            <div className="flex gap-x-4 gap-y-2 border-b border-[#888888]">
              <button
                onClick={() => setActiveTab("items")}
                className={`h-9 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                  activeTab === "items"
                    ? "border-[#222222] text-[#000000] bg-[#b8bcb2]"
                    : "border-transparent text-[#555555] hover:text-[#000000]"
                }`}
              >
                <Package size={14} strokeWidth={1.5} />
                <span>الأصناف التابعة للمورد ({items.filter(i => i.supplier_id === detailSupplier.id || i.supplier_name === detailSupplier.name).length})</span>
              </button>
              <button
                onClick={() => setActiveTab("invoices")}
                className={`h-9 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                  activeTab === "invoices"
                    ? "border-[#222222] text-[#000000] bg-[#b8bcb2]"
                    : "border-transparent text-[#555555] hover:text-[#000000]"
                }`}
              >
                <FileText size={14} strokeWidth={1.5} />
                <span>فواتير الشراء ({purchaseInvoices.filter(inv => inv.customer_name === detailSupplier.name).length})</span>
              </button>
            </div>

            {/* Tab Contents */}
            {activeTab === "items" && (
              <div className="space-y-3">
                {(() => {
                  const linkedItems = items.filter(i => i.supplier_id === detailSupplier.id || i.supplier_name === detailSupplier.name);
                  if (linkedItems.length === 0) {
                    return (
                      <div className="p-8 text-center text-[#555555] font-bold text-xs">
                        لا توجد أصناف مرتبطة بهذا المورد حالياً. يمكن ربط الأصناف من قائمة الأصناف أو عند تسجيل فاتورة شراء.
                      </div>
                    );
                  }
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs min-w-[750px] border-collapse">
                        <thead>
                          <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-10">
                            <th className="py-3 px-4 whitespace-nowrap">الباركود</th>
                            <th className="py-3 px-4 min-w-[180px]">اسم الصنف</th>
                            <th className="py-3 px-4 text-center whitespace-nowrap">التصنيف</th>
                            <th className="py-3 px-4 text-center whitespace-nowrap">المخزون الحالي</th>
                            <th className="py-3 px-4 text-center whitespace-nowrap">سعر الشراء</th>
                            <th className="py-3 px-4 text-center whitespace-nowrap">البيع قطاعي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
                          {linkedItems.map((item) => (
                            <tr key={item.id} className="hover:bg-[#b8bcb2] transition-colors">
                              <td className="py-3 px-4 font-mono whitespace-nowrap">{item.barcode}</td>
                              <td className="py-3 px-4 min-w-[180px] leading-snug">{item.name}</td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">{item.category || "عام"}</td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">{item.is_unlimited === 1 ? "-" : item.quantity} {item.unit}</td>
                              <td className="py-3 px-4 text-center font-mono whitespace-nowrap">{(item.purchase_price || 0).toFixed(2)} ج.م</td>
                              <td className="py-3 px-4 text-center font-mono whitespace-nowrap">{(item.retail_price || 0).toFixed(2)} ج.م</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === "invoices" && (
              <div className="space-y-3">
                {(() => {
                  const linkedInvoices = purchaseInvoices.filter(inv => inv.customer_name === detailSupplier.name);
                  if (linkedInvoices.length === 0) {
                    return (
                      <div className="p-8 text-center text-[#555555] font-bold text-xs">
                        لا توجد فواتير شراء مسجلة باسم هذا المورد حتى الآن.
                      </div>
                    );
                  }
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs min-w-[750px] border-collapse">
                        <thead>
                          <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-10">
                            <th className="py-3 px-4 whitespace-nowrap">رقم الفاتورة</th>
                            <th className="py-3 px-4 whitespace-nowrap">التاريخ</th>
                            <th className="py-3 px-4 text-center whitespace-nowrap">الإجمالي</th>
                            <th className="py-3 px-4 text-center whitespace-nowrap">المدفوع</th>
                            <th className="py-3 px-4 text-center whitespace-nowrap">المتبقي</th>
                            <th className="py-3 px-4 text-center whitespace-nowrap">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
                          {linkedInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-[#b8bcb2] transition-colors">
                              <td className="py-3 px-4 font-mono whitespace-nowrap">{inv.invoice_number}</td>
                              <td className="py-3 px-4 font-mono whitespace-nowrap">{inv.date}</td>
                              <td className="py-3 px-4 text-center font-extrabold font-mono whitespace-nowrap">{(inv.total_amount || 0).toFixed(2)} ج.م</td>
                              <td className="py-3 px-4 text-center font-mono whitespace-nowrap">{(inv.paid_amount || 0).toFixed(2)} ج.م</td>
                              <td className="py-3 px-4 text-center font-mono whitespace-nowrap">{(inv.remaining_amount || 0).toFixed(2)} ج.م</td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 text-xs font-bold border ${
                                  inv.remaining_amount === 0 
                                    ? "bg-[#b8bcb2] border-[#888888] text-[#000000]"
                                    : "bg-[#222222] text-[#c3c6bb]"
                                }`}>
                                  {inv.remaining_amount === 0 ? "خالصة" : "آجل"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Supplier Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50" id="supplier-modal">
          <div className="bg-[#c3c6bb] w-full max-w-md border border-[#222222] p-4 relative space-y-4">
            <button
              id="btn-close-supplier-modal"
              onClick={() => setShowModal(false)}
              className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="text-sm font-black text-[#000000] text-right border-b border-[#888888] pb-2">
              {selectedSupplier ? "تعديل بيانات المورد" : "تسجيل مورد جديد"}
            </h3>

            {error && (
              <div className="bg-[#b8bcb2] border border-[#222222] p-2 text-[#000000] text-xs text-right font-bold">
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-right text-xs font-bold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <label className="block text-[#000000] mb-1">اسم المورد / الشركة</label>
                  <input
                    id="modal-supplier-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="شركة النور للتوريدات..."
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] placeholder:text-[#555555]"
                  />
                </div>

                <div>
                  <label className="block text-[#000000] mb-1">رقم الهاتف</label>
                  <input
                    id="modal-supplier-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01000000000"
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right font-mono text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] placeholder:text-[#555555]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#000000] mb-1">العنوان التفصيلي</label>
                <textarea
                  id="modal-supplier-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="عنوان المقر الرئيسي..."
                  rows={2}
                  className="w-full bg-[#b8bcb2] border border-[#888888] p-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] placeholder:text-[#555555]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-[#888888]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTamweenSupplier === 1}
                    onChange={(e) => setIsTamweenSupplier(e.target.checked ? 1 : 0)}
                    className="w-4 h-4 accent-[#222222]"
                  />
                  <span className="text-sm font-bold text-[#000000]">مورد تمويني</span>
                </label>
              </div>

              <button
                id="btn-save-supplier-submit"
                type="submit"
                className="w-full h-9 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center justify-center gap-x-4 gap-y-2 mt-2 cursor-pointer"
              >
                <Check size={16} strokeWidth={1.5} />
                <span>حفظ البيانات</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
