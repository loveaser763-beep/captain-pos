import React, { useEffect, useState } from "react";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Barcode,
  Check,
  X,
  CheckCircle,
  LayoutGrid,
  List,
  Truck
} from "lucide-react";
import { Item, Supplier, UnitType, User } from "../types";
import { authFetch } from "../authFetch";

interface ProductsProps {
  currentUser: User | null;
}

export default function Products({ currentUser }: ProductsProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "available">("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [sortFilter, setSortFilter] = useState("added_desc");
  const [viewFormat, setViewFormat] = useState<"table" | "grid">("table");

  // Pagination States for Smart & Fast Loading
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(25);

  // Reset page number on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, stockFilter, unitFilter, categoryFilter, supplierFilter, sortFilter, pageSize]);

  // Edit / Add Modal controller
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [retailPrice, setRetailPrice] = useState(0);
  const [wholesalePrice, setWholesalePrice] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState<UnitType>("قطعة");
  const [lowStockLimit, setLowStockLimit] = useState(10);
  const [isUnlimited, setIsUnlimited] = useState<number>(0);
  const [isTamween, setIsTamween] = useState<number>(0);
  const [category, setCategory] = useState("عام");
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierName, setSupplierName] = useState("");

  // Barcode mock input emulator
  const [mockScanCode, setMockScanCode] = useState("");

  const units: UnitType[] = ["كرتونة", "قطعة", "دستة", "علبة", "كيلو", "جرام", "متر", "وحدة"];

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [itemsRes, suppliersRes] = await Promise.all([
        authFetch("/api/items"),
        authFetch("/api/suppliers")
      ]);
      if (!itemsRes.ok) throw new Error("تعذر جلب الأصناف من خادم البيانات.");
      const itemsData = await itemsRes.json();
      setItems(itemsData);

      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json();
        setSuppliers(suppliersData);
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
    setSelectedItem(null);
    setName("");
    setBarcode("");
    setPurchasePrice(0);
    setRetailPrice(0);
    setWholesalePrice(0);
    setQuantity(0);
    setUnit("قطعة");
    setLowStockLimit(10);
    setIsUnlimited(0);
    setIsTamween(0);
    setCategory("عام");
    setSupplierId(null);
    setSupplierName("");
    setError("");
    setShowModal(true);
  };

  const handleOpenEdit = (item: Item) => {
    setSelectedItem(item);
    setName(item.name);
    setBarcode(item.barcode);
    setPurchasePrice(item.purchase_price);
    setRetailPrice(item.retail_price);
    setWholesalePrice(item.wholesale_price);
    setQuantity(item.quantity);
    setUnit(item.unit as UnitType);
    setLowStockLimit(item.low_stock_limit);
    setIsUnlimited(item.is_unlimited || 0);
    setIsTamween(item.is_tamween || 0);
    setCategory(item.category || "عام");
    setSupplierId(item.supplier_id || null);
    setSupplierName(item.supplier_name || "");
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!supplierId || !supplierName) {
      setError("الرجاء اختيار المورد أولاً قبل حفظ الصنف.");
      return;
    }
    if (!name || !barcode || purchasePrice < 0 || retailPrice < 0 || wholesalePrice < 0 || quantity < 0) {
      setError("الرجاء التحقق من المدخلات وملء جميع الحقول الإلزامية.");
      return;
    }

    const itemPayload = {
      barcode,
      name,
      purchase_price: purchasePrice,
      retail_price: retailPrice,
      wholesale_price: wholesalePrice,
      quantity,
      unit,
      low_stock_limit: lowStockLimit,
      is_unlimited: isUnlimited,
      is_tamween: isTamween,
      category,
      supplier_id: supplierId,
      supplier_name: supplierName,
      logCreator: currentUser?.name || "المدير"
    };

    try {
      const url = selectedItem ? `/api/items/${selectedItem.id}` : "/api/items";
      const method = selectedItem ? "PUT" : "POST";
      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemPayload),
      });

      const resData = await response.json();
      if (response.ok && (resData.success || !resData.error)) {
        setSuccess(selectedItem ? "تم حفظ التعديلات بنجاح." : "تم إضافة الصنف الجديد للمخزن.");
        setShowModal(false);
        fetchData();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(resData.error || "تعذرت العملية. يرجى مراجعة الباركود.");
      }
    } catch (err: any) {
      setError("فشل الاتصال بالخادم لحفظ الصنف.");
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا الصنف بالكامل؟")) return;
    try {
      const url = `/api/items/${id}?logCreator=${encodeURIComponent(currentUser?.name || "")}`;
      const response = await authFetch(url, { method: "DELETE" });
      const data = await response.json();
      if (response.ok && data.success) {
        setSuccess("تم حذف الصنف بنجاح.");
        fetchData();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "تعذر إتمام الحذف.");
      }
    } catch (err) {
      setError("حدث خطأ أثناء الاتصال بالخادم للحذف.");
    }
  };

  const [isContinuousScan, setIsContinuousScan] = useState(false);

  const triggerMockScan = async () => {
    if (!mockScanCode) return;
    
    if (isContinuousScan) {
      const existing = items.find((i) => i.barcode === mockScanCode);
      try {
        if (!existing) {
          const newItem = {
            name: "صنف مضاف سريعاً",
            barcode: mockScanCode,
            purchase_price: 1,
            retail_price: 1.5,
            wholesale_price: 1.25,
            quantity: 1,
            unit: "قطعة",
            low_stock_limit: 10,
            is_unlimited: 0
          };
          const response = await authFetch("/api/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newItem)
          });
          if (response.ok) {
            setSuccess(`تم إضافة المنتج ${mockScanCode} بنجاح.`);
            setTimeout(() => setSuccess(""), 3000);
            fetchData();
          }
        } else {
          const updatedItem = { ...existing };
          updatedItem.quantity += 1;
          const response = await authFetch(`/api/items/${existing.id}?logCreator=${encodeURIComponent(currentUser?.name || "نظام المسح")}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedItem)
          });
          if (response.ok) {
            setSuccess(`تم تحديث كمية المنتج: ${existing.name}`);
            setTimeout(() => setSuccess(""), 3000);
            fetchData();
          }
        }
      } catch (err: any) {
        setError(err.message || "فشل المسح المستمر");
      }
    } else {
      setSearchQuery(mockScanCode);
    }
    setMockScanCode("");
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcode.includes(searchQuery);

    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "low" && item.quantity <= item.low_stock_limit) ||
      (stockFilter === "available" && item.quantity > item.low_stock_limit);

    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesSupplier = supplierFilter === "all" || item.supplier_name === supplierFilter;
    const matchesUnit = unitFilter === "all" || item.unit === unitFilter;

    return matchesSearch && matchesStock && matchesUnit && matchesCategory && matchesSupplier;
  }).sort((a, b) => {
    if (sortFilter === "purchase_asc") {
      return a.purchase_price - b.purchase_price;
    } else if (sortFilter === "purchase_desc") {
      return b.purchase_price - a.purchase_price;
    } else if (sortFilter === "profit_desc") {
      const profitA = a.retail_price - a.purchase_price;
      const profitB = b.retail_price - b.purchase_price;
      return profitB - profitA;
    }
    return b.id - a.id;
  });

  const totalPages = pageSize === "all" ? 1 : Math.ceil(filteredItems.length / (pageSize as number)) || 1;
  const displayedItems = pageSize === "all"
    ? filteredItems
    : filteredItems.slice((currentPage - 1) * (pageSize as number), currentPage * (pageSize as number));

  const renderPaginationBar = () => {
    if (filteredItems.length === 0) return null;

    const startNum = pageSize === "all" ? 1 : (currentPage - 1) * (pageSize as number) + 1;
    const endNum = pageSize === "all" ? filteredItems.length : Math.min(currentPage * (pageSize as number), filteredItems.length);

    return (
      <div className="flex flex-col sm:flex-row justify-between items-center gap-x-4 gap-y-2 py-2.5 px-3 bg-[#b8bcb2] border border-[#888888] text-xs font-bold text-[#000000]">
        <div className="flex items-center gap-2">
          <span>عرض {startNum} - {endNum} من أصل {filteredItems.length} صنف</span>
          {pageSize !== "all" && totalPages > 1 && (
            <span className="text-[#555555] font-semibold">(صفحة {currentPage} من {totalPages})</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[#555555] text-[11px]">عدد العناصر بالصفحة:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="h-7 bg-[#c3c6bb] border border-[#888888] px-1 text-xs font-bold text-[#000000] cursor-pointer focus:outline-none"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">عرض الكل</option>
            </select>
          </div>

          {pageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 px-2.5 bg-[#c3c6bb] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                السابق
              </button>

              <div className="flex items-center gap-2 px-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pNum = i + 1;
                  if (totalPages > 5) {
                    if (currentPage > 3 && currentPage < totalPages - 1) {
                      pNum = currentPage - 2 + i;
                    } else if (currentPage >= totalPages - 1) {
                      pNum = totalPages - 4 + i;
                    }
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={`w-7 h-7 flex items-center justify-center font-bold border transition-colors cursor-pointer ${
                        currentPage === pNum
                          ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                          : "bg-[#c3c6bb] text-[#000000] border-[#888888] hover:bg-[#b8bcb2]"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-7 px-2.5 bg-[#c3c6bb] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                التالي
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 select-none font-sans" id="items-view" style={{ direction: "rtl" }}>
      
      {/* Header & Controls 12-Column Grid */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#000000] flex items-center gap-2">
            <Package size={20} strokeWidth={1.5} />
            <span>إدارة الأصناف والمستودع</span>
          </h2>
          <p className="text-xs text-[#555555] font-semibold mt-1">قائمة الأصناف، الأسعار، الباركود، ومستويات المخزون</p>
        </div>
        
        {(currentUser?.role === "admin" || currentUser?.permissions?.includes("items")) && (
          <button
            id="btn-add-item-modal"
            onClick={handleOpenAdd}
            className="h-9 px-4 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} strokeWidth={1.5} />
            <span>إضافة صنف جديد (F4)</span>
          </button>
        )}
      </div>

      {success && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="items-success-alert">
          <CheckCircle size={16} strokeWidth={1.5} className="text-[#000000] shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {error && !showModal && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold" id="items-error-alert">
          <AlertTriangle size={16} strokeWidth={1.5} className="text-[#222222] shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Filter and Barcode Toolbar 12-Column Grid */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] space-y-4" id="items-filter-bar">
        <div className="grid grid-cols-12 gap-x-4 gap-y-2 items-center">
          
          <div className="col-span-12 md:col-span-5 relative">
            <input
              id="items-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث بالاسم أو رمز الباركود..."
              className="w-full h-9 bg-[#b8bcb2] border border-[#888888] pr-9 pl-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#555555]">
              <Search size={16} strokeWidth={1.5} />
            </div>
          </div>

          <div className="col-span-12 sm:col-span-4 md:col-span-2">
            <select
              id="items-stock-filter"
              value={stockFilter}
              onChange={(e: any) => setStockFilter(e.target.value)}
              className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] cursor-pointer focus:outline-none focus:border-[#222222]"
            >
              <option value="all">كل المخزون</option>
              <option value="low">المنخفض والمنتهي</option>
              <option value="available">المتوفر</option>
            </select>
          </div>

          <div className="col-span-12 sm:col-span-4 md:col-span-2">
            <select
              id="items-category-filter"
              value={categoryFilter}
              onChange={(e: any) => setCategoryFilter(e.target.value)}
              className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] cursor-pointer focus:outline-none focus:border-[#222222]"
            >
              <option value="all">كل التصنيفات</option>
              {Array.from(new Set(items.map(i => i.category || 'عام'))).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="col-span-12 sm:col-span-4 md:col-span-2">
            <select
              id="items-supplier-filter"
              value={supplierFilter}
              onChange={(e: any) => setSupplierFilter(e.target.value)}
              className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] cursor-pointer focus:outline-none focus:border-[#222222]"
            >
              <option value="all">كل الموردين</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-12 sm:col-span-4 md:col-span-1">
            <select
              id="items-sort-filter"
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value)}
              className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] cursor-pointer focus:outline-none focus:border-[#222222]"
            >
              <option value="added_desc">الأحدث إضافة</option>
              <option value="purchase_desc">أعلى سعر شراء</option>
              <option value="purchase_asc">أقل سعر شراء</option>
              <option value="profit_desc">أعلى هامش ربح</option>
            </select>
          </div>

        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-x-4 gap-y-2 pt-3 border-t border-[#888888]">
          <div className="flex items-center gap-2 bg-[#b8bcb2] p-1 border border-[#888888]">
            <button
              onClick={() => setViewFormat("table")}
              className={`h-7 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                viewFormat === "table" ? "bg-[#222222] text-[#c3c6bb]" : "text-[#000000]"
              }`}
            >
              <List size={14} strokeWidth={1.5} />
              <span>جدول</span>
            </button>
            <button
              onClick={() => setViewFormat("grid")}
              className={`h-7 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                viewFormat === "grid" ? "bg-[#222222] text-[#c3c6bb]" : "text-[#000000]"
              }`}
            >
              <LayoutGrid size={14} strokeWidth={1.5} />
              <span>شبكة</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              id="barcode-emulator-input"
              type="text"
              value={mockScanCode}
              onChange={(e) => setMockScanCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && triggerMockScan()}
              placeholder="اختبار الباركود..."
              className="h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] w-full sm:w-48"
            />
            <button
              id="btn-trigger-scan"
              onClick={triggerMockScan}
              className="h-9 px-3 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Barcode size={16} strokeWidth={1.5} />
              <span>مسح</span>
            </button>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="bg-[#c3c6bb] border border-[#222222] p-4 space-y-4" id="items-stock-table-card">
        {/* Tamween Low Stock Alert */}
        {items.filter(i => i.is_tamween === 1 && i.quantity <= i.low_stock_limit && i.is_unlimited !== 1).length > 0 && (
          <div className="bg-orange-50 border border-orange-300 p-3 flex items-center gap-3">
            <AlertTriangle size={20} className="text-orange-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-orange-700">تنبيه: منتجات تموينية على وشك النفاد!</p>
              <p className="text-xs text-orange-600 mt-1">
                {items.filter(i => i.is_tamween === 1 && i.quantity <= i.low_stock_limit && i.is_unlimited !== 1).map(i => i.name).join("، ")}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-[#555555] font-bold text-xs">جاري تحميل الأصناف...</div>
        ) : filteredItems.length > 0 ? (
          <>
            {renderPaginationBar()}

            {viewFormat === "table" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs min-w-[1100px] border-collapse">
                  <thead>
                    <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-10">
                      <th className="py-3 px-4 whitespace-nowrap w-[130px]">الباركود</th>
                      <th className="py-3 px-4 min-w-[220px]">اسم الصنف</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap w-[120px]">التصنيف</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap min-w-[140px]">المورد</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap w-[100px]">الشراء</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap w-[100px]">القطاعي</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap w-[100px]">الجملة</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap w-[90px]">الكمية</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap w-[90px]">الوحدة</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap w-[90px]">الحالة</th>
                      <th className="py-3 px-4 text-left whitespace-nowrap w-[100px]">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
                    {displayedItems.map((item) => {
                      const isUnlimitedStock = item.is_unlimited === 1;
                      const isLowStock = !isUnlimitedStock && (item.quantity <= item.low_stock_limit);

                      return (
                        <tr key={item.id} className="hover:bg-[#b8bcb2] transition-colors">
                          <td className="py-3 px-4 font-mono whitespace-nowrap w-[130px]">{item.barcode}</td>
                          <td className="py-3 px-4 min-w-[220px] leading-relaxed">
                            <div className="flex items-center gap-2">
                              <span>{item.name}</span>
                              {item.is_tamween === 1 && (
                                <span className="bg-orange-200 text-orange-800 px-1.5 py-0.5 text-[10px] font-bold">تموين</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap w-[120px]">{item.category || "عام"}</td>
                          <td className="py-3 px-4 text-center min-w-[140px]">
                            {item.supplier_name ? (
                              <span className="bg-[#b8bcb2] px-2.5 py-1 text-xs font-bold border border-[#888888] inline-flex items-center gap-2 whitespace-nowrap">
                                <Truck size={12} strokeWidth={1.5} />
                                <span>{item.supplier_name}</span>
                              </span>
                            ) : (
                              <span className="text-[#666666] text-xs font-normal whitespace-nowrap">غير محدد</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono whitespace-nowrap w-[100px]">{(item.purchase_price || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-center font-black font-mono whitespace-nowrap w-[100px]">{(item.retail_price || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-center font-mono whitespace-nowrap w-[100px]">{(item.wholesale_price || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-center font-mono whitespace-nowrap w-[90px]">
                            {isUnlimitedStock ? "-" : item.quantity}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap w-[90px]">{item.unit}</td>
                          <td className="py-3 px-4 text-center whitespace-nowrap w-[90px]">
                            {isUnlimitedStock ? (
                              <span className="bg-[#b8bcb2] px-2.5 py-1 text-xs font-bold border border-[#888888]">خدمي</span>
                            ) : isLowStock ? (
                              <span className="bg-[#222222] text-[#c3c6bb] px-2.5 py-1 text-xs font-bold">منخفض</span>
                            ) : (
                              <span className="bg-[#b8bcb2] px-2.5 py-1 text-xs font-bold border border-[#888888]">متوفر</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-left whitespace-nowrap w-[100px]">
                            <div className="flex gap-1.5 justify-end">
                              {(currentUser?.role === "admin" || currentUser?.permissions?.includes("items")) && (
                                <>
                                  <button
                                    id={`btn-edit-item-${item.id}`}
                                    onClick={() => handleOpenEdit(item)}
                                    className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer transition-colors"
                                    title="تعديل"
                                  >
                                    <Edit2 size={14} strokeWidth={1.5} />
                                  </button>
                                  <button
                                    id={`btn-delete-item-${item.id}`}
                                    onClick={() => handleDeleteItem(item.id!)}
                                    className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer transition-colors"
                                    title="حذف"
                                  >
                                    <Trash2 size={14} strokeWidth={1.5} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-3">
                {displayedItems.map((item) => (
                  <div key={item.id} className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3 bg-[#b8bcb2] border border-[#888888] p-3 flex flex-col justify-between space-y-3">
                    <div className="space-y-2 text-xs font-bold text-[#000000]">
                      <div className="flex justify-between items-center border-b border-[#888888]/40 pb-2">
                        <span className="font-mono text-xs">{item.barcode}</span>
                        <span className="bg-[#c3c6bb] px-2 py-0.5 text-xs">{item.category || "عام"}</span>
                      </div>
                      <h4 className="font-extrabold text-sm">{item.name}</h4>
                      <div className="flex justify-between items-center bg-[#c3c6bb] p-2 border border-[#888888]/40">
                        <span>القطاعي: {(item.retail_price || 0).toFixed(2)} ج.م</span>
                        <span>الكمية: {item.is_unlimited === 1 ? "-" : item.quantity}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#888888]/40 flex justify-end gap-1">
                      {(currentUser?.role === "admin" || currentUser?.permissions?.includes("items")) && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="h-8 px-3 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs flex items-center gap-2 cursor-pointer"
                          >
                            <Edit2 size={14} strokeWidth={1.5} />
                            <span>تعديل</span>
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id!)}
                            className="w-8 h-8 flex items-center justify-center bg-[#c3c6bb] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer"
                          >
                            <Trash2 size={14} strokeWidth={1.5} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {renderPaginationBar()}
          </>
        ) : (
          <div className="p-12 text-center text-[#555555] text-xs font-bold">
            لا توجد أصناف مطابقة لخيارات البحث.
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50" id="product-modal">
          <div className="bg-[#c3c6bb] border border-[#222222] w-full max-w-xl p-4 relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              id="btn-close-product-modal"
              onClick={() => setShowModal(false)}
              className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="text-sm font-black text-[#000000] text-right border-b border-[#888888] pb-2">
              {selectedItem ? `تعديل الصنف: ${selectedItem.name}` : "إضافة صنف جديد"}
            </h3>

            {error && (
              <div className="bg-[#b8bcb2] border border-[#222222] p-2 text-[#000000] text-xs text-right font-bold">
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-right text-xs font-bold text-[#000000]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <label className="block text-[#000000] mb-1">اسم الصنف</label>
                  <input
                    id="modal-item-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اسم الصنف..."
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
                <div>
                  <label className="block text-[#000000] mb-1">التصنيف</label>
                  <input
                    id="modal-item-category"
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="التصنيف..."
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <label className="block text-[#000000] mb-1">الباركود</label>
                  <input
                    id="modal-item-barcode"
                    type="text"
                    required
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="رمز الباركود..."
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
                <div>
                  <label className="block text-[#000000] mb-1">وحدة القياس</label>
                  <select
                    id="modal-item-unit"
                    value={unit}
                    onChange={(e: any) => setUnit(e.target.value)}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] cursor-pointer focus:outline-none focus:border-[#222222]"
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#000000] mb-1">المورد / الشركة الموزعة</label>
                <select
                  id="modal-item-supplier"
                  required
                  value={supplierName}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    setSupplierName(selectedName);
                    const foundSup = suppliers.find(s => s.name === selectedName);
                    setSupplierId(foundSup?.id || null);
                  }}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] cursor-pointer focus:outline-none focus:border-[#222222]"
                >
                  <option value="" disabled>-- اختر المورد --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>{s.name} ({s.phone})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2">
                <div>
                  <label className="block text-[#000000] mb-1">سعر الشراء</label>
                  <input
                    id="modal-item-purchase-price"
                    type="number"
                    step="0.01"
                    required
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
                <div>
                  <label className="block text-[#000000] mb-1">البيع قطاعي</label>
                  <input
                    id="modal-item-retail-price"
                    type="number"
                    step="0.01"
                    required
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(Number(e.target.value))}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
                <div>
                  <label className="block text-[#000000] mb-1">بيع جملة</label>
                  <input
                    id="modal-item-wholesale-price"
                    type="number"
                    step="0.01"
                    required
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(Number(e.target.value))}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-[#888888]">
                <div>
                  <label className="block text-[#000000] mb-1">الكمية المتاحة</label>
                  <input
                    id="modal-item-quantity"
                    type="number"
                    step="any"
                    min="0"
                    required
                    disabled={isUnlimited === 1}
                    value={isUnlimited === 1 ? "" : quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="block text-[#000000] mb-1">حد التنبيه</label>
                  <input
                    id="modal-item-low-stock-limit"
                    type="number"
                    step="any"
                    min="0"
                    required
                    disabled={isUnlimited === 1}
                    value={isUnlimited === 1 ? "" : lowStockLimit}
                    onChange={(e) => setLowStockLimit(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-[#888888]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTamween === 1}
                    onChange={(e) => setIsTamween(e.target.checked ? 1 : 0)}
                    className="w-4 h-4 accent-[#222222]"
                  />
                  <span className="text-sm font-bold text-[#000000]">منتج تمويني</span>
                </label>
              </div>

              <button
                id="btn-save-item-submit"
                type="submit"
                className="w-full h-9 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center justify-center gap-x-4 gap-y-2 mt-2 cursor-pointer"
              >
                <Check size={16} strokeWidth={1.5} />
                <span>{selectedItem ? "حفظ التعديلات" : "إضافة الصنف"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
