import React, { useState, useEffect } from "react";
import { Package, Plus, Edit, Trash2, Search, X, BarChart3 } from "lucide-react";
import { authFetch } from "../authFetch";

interface TamweenProduct {
  id: number;
  barcode: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  purchase_price: number;
  retail_price: number;
  wholesale_price: number;
  created_at: string;
}

export default function TamweenProducts() {
  const [products, setProducts] = useState<TamweenProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TamweenProduct | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ totalProducts: 0, totalValue: 0, totalQuantity: 0 });
  
  const [form, setForm] = useState({
    barcode: "",
    name: "",
    category: "عام",
    quantity: 0,
    unit: "قطعة",
    purchase_price: 0,
    retail_price: 0,
    wholesale_price: 0
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/tamween-products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
      const statsRes = await authFetch("/api/tamween-products/stats");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem ? `/api/tamween-products/${editingItem.id}` : "/api/tamween-products";
      const method = editingItem ? "PUT" : "POST";
      
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      
      if (res.ok) {
        setShowModal(false);
        setEditingItem(null);
        resetForm();
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    try {
      const res = await authFetch(`/api/tamween-products/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (item: TamweenProduct) => {
    setEditingItem(item);
    setForm({
      barcode: item.barcode,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      purchase_price: item.purchase_price,
      retail_price: item.retail_price,
      wholesale_price: item.wholesale_price
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setForm({
      barcode: "",
      name: "",
      category: "عام",
      quantity: 0,
      unit: "قطعة",
      purchase_price: 0,
      retail_price: 0,
      wholesale_price: 0
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.includes(searchQuery) || 
    p.barcode.includes(searchQuery) ||
    p.category.includes(searchQuery)
  );

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden font-sans" style={{ direction: "rtl" }}>
      {/* Header */}
      <header className="bg-[#c3c6bb] p-4 border-b border-[#222222] shrink-0 flex justify-between items-center no-print">
        <div className="flex items-center gap-3">
          <div className="bg-[#222222] p-2 text-[#c3c6bb]">
            <Package size={24} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#000000]">المنتجات التموينية</h2>
            <p className="text-xs text-[#555555] font-bold mt-1">إدارة منتجات البطاقات التموينية</p>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="p-4 bg-[#f5f5f5] border-b border-[#888888] shrink-0">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 size={20} className="text-blue-500" />
            <div>
              <p className="text-xs text-[#555555] font-bold">عدد المنتجات</p>
              <p className="text-lg font-black text-[#000000]">{stats.totalProducts}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Package size={20} className="text-green-500" />
            <div>
              <p className="text-xs text-[#555555] font-bold">إجمالي الكمية</p>
              <p className="text-lg font-black text-[#000000]">{stats.totalQuantity}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <BarChart3 size={20} className="text-orange-500" />
            <div>
              <p className="text-xs text-[#555555] font-bold">إجمالي القيمة</p>
              <p className="text-lg font-black text-orange-600">{stats.totalValue.toFixed(2)} ج.م</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 bg-[#b8bcb2] border-b border-[#888888] flex gap-4 items-center shrink-0 no-print">
        <div className="flex-1 flex items-center gap-2">
          <Search size={16} />
          <input
            type="text"
            placeholder="بحث في المنتجات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 border border-[#888888] text-sm font-bold bg-white"
          />
        </div>
        <button
          onClick={() => { resetForm(); setEditingItem(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#222222] text-[#c3c6bb] hover:bg-[#000000] text-sm font-bold transition-colors"
        >
          <Plus size={16} /> إضافة منتج
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        {loading ? (
          <div className="p-12 text-center text-[#555555] font-bold">جاري تحميل البيانات...</div>
        ) : filteredProducts.length > 0 ? (
          <div className="border border-[#888888] overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-[#222222] text-[#c3c6bb] font-bold">
                  <th className="py-3 px-4">الباركود</th>
                  <th className="py-3 px-4">الاسم</th>
                  <th className="py-3 px-4">التصنيف</th>
                  <th className="py-3 px-4 text-center">الكمية</th>
                  <th className="py-3 px-4">الوحدة</th>
                  <th className="py-3 px-4 text-center">سعر الشراء</th>
                  <th className="py-3 px-4 text-center">سعر البيع</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#888888]/40 font-bold">
                {filteredProducts.map((item) => (
                  <tr key={item.id} className="hover:bg-[#b8bcb2] transition-colors">
                    <td className="py-3 px-4 font-mono">{item.barcode}</td>
                    <td className="py-3 px-4">{item.name}</td>
                    <td className="py-3 px-4">{item.category}</td>
                    <td className="py-3 px-4 text-center font-mono">{item.quantity}</td>
                    <td className="py-3 px-4">{item.unit}</td>
                    <td className="py-3 px-4 text-center font-mono">{item.purchase_price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center font-mono">{item.retail_price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleEdit(item)}
                          className="bg-blue-500 text-white p-1.5 hover:bg-blue-600 transition-colors"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="bg-red-500 text-white p-1.5 hover:bg-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-[#555555]">لا توجد منتجات تموينية مسجلة.</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg border border-[#888888] shadow-lg">
            <div className="bg-[#222222] text-[#c3c6bb] p-4 flex justify-between items-center">
              <h3 className="font-bold">{editingItem ? "تعديل منتج" : "إضافة منتج جديد"}</h3>
              <button onClick={() => setShowModal(false)} className="hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">الباركود</label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">الاسم</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">التصنيف</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">الكمية</label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                    min="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">الوحدة</label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">سعر الشراء</label>
                  <input
                    type="number"
                    value={form.purchase_price}
                    onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#555555] mb-1">سعر البيع</label>
                  <input
                    type="number"
                    value={form.retail_price}
                    onChange={(e) => setForm({ ...form, retail_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#888888] text-sm font-bold"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-[#c3c6bb] text-[#000000] hover:bg-[#888888] text-sm font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#222222] text-[#c3c6bb] hover:bg-[#000000] text-sm font-bold transition-colors"
                >
                  {editingItem ? "تحديث" : "حفظ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
