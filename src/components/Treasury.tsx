import React, { useState, useEffect } from "react";
import { User } from "../types";
import { Banknote, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, RefreshCw, AlertTriangle } from "lucide-react";
import { authFetch } from "../authFetch";

interface TreasuryProps {
  currentUser: User | null;
}

export default function Treasury({ currentUser }: TreasuryProps) {
  const [balances, setBalances] = useState({ cash_register: 0, main_safe: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [txType, setTxType] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("cash_register");
  const [destination, setDestination] = useState("main_safe");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTreasury = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/treasury");
      if (!res.ok) throw new Error("فشل جلب البيانات");
      const data = await res.json();
      setBalances(data.balances);
      setTransactions(data.transactions);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTreasury();
  }, []);

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return alert("المبلغ غير صحيح");
    setSubmitting(true);
    try {
      const res = await authFetch("/api/treasury/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: txType,
          amount: parseFloat(amount),
          source: txType === "deposit" ? null : source,
          destination: txType === "withdraw" ? null : (txType === "transfer" ? destination : source), // If deposit, source is actually the target
          notes,
          user_name: currentUser?.name
        })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "خطأ أثناء التسجيل");
      }
      setAmount("");
      setNotes("");
      fetchTreasury();
    } catch (e: any) {
      alert(e.message);
    }
    setSubmitting(false);
  };

  const isAdmin = currentUser?.role === "admin";
  if (!isAdmin) {
    return (
      <div className="w-full p-6 flex flex-col items-center justify-center text-right select-none font-sans" style={{ direction: "rtl" }}>
        <div className="bg-[#c3c6bb] p-6 border border-[#222222] text-center max-w-md space-y-3">
          <AlertTriangle size={24} strokeWidth={1.5} className="mx-auto text-[#222222]" />
          <h3 className="text-sm font-black text-[#000000]">صلاحية الوصول غير متاحة</h3>
          <p className="text-xs text-[#555555] font-semibold leading-relaxed">
            اللوحة المالية تقتصر على المدير العام للنظام.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 select-none font-sans p-6" style={{ direction: "rtl" }}>
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex justify-between items-center">
        <div>
          <h2 className="text-xl font-extrabold text-[#000000] flex items-center gap-2">
            <Banknote size={20} strokeWidth={1.5} />
            <span>اللوحة المالية</span>
          </h2>
          <p className="text-xs text-[#555555] font-semibold mt-1">إدارة الأرصدة والسيولة النقدية للخزنة والدرج</p>
        </div>
        <button
          onClick={fetchTreasury}
          className="h-9 px-3 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw size={16} strokeWidth={1.5} />
          <span>تحديث الأرصدة</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center p-8 bg-[#c3c6bb] border border-[#222222] text-xs font-bold">جاري تحميل البيانات...</div>
      ) : error ? (
        <div className="text-center p-8 bg-[#c3c6bb] border border-[#222222] text-xs font-bold text-red-600">{error}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#c3c6bb] p-4 border border-[#222222] space-y-4">
              <h3 className="text-sm font-extrabold text-[#000000] border-b border-[#888888] pb-2">ملخص الأرصدة</h3>
              <div className="bg-[#b8bcb2] border border-[#888888] p-4 flex flex-col justify-center items-center gap-2">
                <span className="text-xs font-bold text-[#555555]">رصيد درج الكاشير</span>
                <span className="text-2xl font-black text-[#000000] font-mono">{balances.cash_register.toFixed(2)} ج.م</span>
              </div>
              <div className="bg-[#b8bcb2] border border-[#888888] p-4 flex flex-col justify-center items-center gap-2">
                <span className="text-xs font-bold text-[#555555]">رصيد الخزينة الرئيسية</span>
                <span className="text-2xl font-black text-[#000000] font-mono">{balances.main_safe.toFixed(2)} ج.م</span>
              </div>
            </div>

            <div className="bg-[#c3c6bb] p-4 border border-[#222222] space-y-4">
              <h3 className="text-sm font-extrabold text-[#000000] border-b border-[#888888] pb-2">إجراء حركة مالية</h3>
              <form onSubmit={handleTransaction} className="space-y-4">
                <div className="flex bg-[#b8bcb2] border border-[#888888] p-1 gap-1">
                  <button type="button" onClick={() => setTxType('deposit')} className={`flex-1 h-8 text-xs font-bold transition-colors ${txType === 'deposit' ? 'bg-[#222222] text-[#c3c6bb]' : 'text-[#222222] hover:bg-[#c3c6bb]'}`}>إيداع</button>
                  <button type="button" onClick={() => setTxType('withdraw')} className={`flex-1 h-8 text-xs font-bold transition-colors ${txType === 'withdraw' ? 'bg-[#222222] text-[#c3c6bb]' : 'text-[#222222] hover:bg-[#c3c6bb]'}`}>سحب</button>
                  <button type="button" onClick={() => setTxType('transfer')} className={`flex-1 h-8 text-xs font-bold transition-colors ${txType === 'transfer' ? 'bg-[#222222] text-[#c3c6bb]' : 'text-[#222222] hover:bg-[#c3c6bb]'}`}>تحويل</button>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-[#000000] mb-1">المبلغ (ج.م):</label>
                  <input type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-center text-xs font-bold focus:outline-none focus:border-[#222222]" />
                </div>

                {txType === 'deposit' && (
                  <div>
                    <label className="block text-xs font-bold text-[#000000] mb-1">إلى حساب:</label>
                    <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold focus:outline-none focus:border-[#222222]">
                      <option value="cash_register">درج الكاشير</option>
                      <option value="main_safe">الخزينة الرئيسية</option>
                    </select>
                  </div>
                )}

                {txType === 'withdraw' && (
                  <div>
                    <label className="block text-xs font-bold text-[#000000] mb-1">من حساب:</label>
                    <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold focus:outline-none focus:border-[#222222]">
                      <option value="cash_register">درج الكاشير</option>
                      <option value="main_safe">الخزينة الرئيسية</option>
                    </select>
                  </div>
                )}

                {txType === 'transfer' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#000000] mb-1">من:</label>
                      <select value={source} onChange={(e) => { setSource(e.target.value); if(e.target.value === destination) setDestination(e.target.value === 'cash_register' ? 'main_safe' : 'cash_register') }} className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold focus:outline-none focus:border-[#222222]">
                        <option value="cash_register">الدرج</option>
                        <option value="main_safe">الخزنة</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#000000] mb-1">إلى:</label>
                      <select value={destination} onChange={(e) => { setDestination(e.target.value); if(e.target.value === source) setSource(e.target.value === 'cash_register' ? 'main_safe' : 'cash_register') }} className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold focus:outline-none focus:border-[#222222]">
                        <option value="cash_register">الدرج</option>
                        <option value="main_safe">الخزنة</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#000000] mb-1">البيان / ملاحظات:</label>
                  <input type="text" required value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold focus:outline-none focus:border-[#222222]" placeholder="سبب الإيداع/السحب/التحويل..." />
                </div>

                <button type="submit" disabled={submitting} className="w-full h-9 bg-[#222222] hover:bg-[#000000] text-[#c3c6bb] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 mt-2">
                  {submitting ? 'جاري التنفيذ...' : 'تنفيذ العملية'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[#c3c6bb] p-4 border border-[#222222] min-h-[500px]">
              <h3 className="text-sm font-extrabold text-[#000000] border-b border-[#888888] pb-2 mb-4">سجل الحركات المالية المباشرة (آخر 50 حركة)</h3>
              
              {transactions.length === 0 ? (
                <div className="text-center p-8 text-xs font-bold text-[#555555]">لا توجد حركات مالية مباشرة مسجلة.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-[#b8bcb2] border-b border-[#888888]">
                        <th className="py-2 px-3 text-xs font-extrabold text-[#000000]">نوع الحركة</th>
                        <th className="py-2 px-3 text-xs font-extrabold text-[#000000]">المبلغ</th>
                        <th className="py-2 px-3 text-xs font-extrabold text-[#000000]">البيان</th>
                        <th className="py-2 px-3 text-xs font-extrabold text-[#000000]">التاريخ</th>
                        <th className="py-2 px-3 text-xs font-extrabold text-[#000000]">المستخدم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-[#888888]/40 hover:bg-[#b8bcb2]/30">
                          <td className="py-3 px-3 text-xs font-bold">
                            {tx.type === 'deposit' && <span className="text-green-700 flex items-center gap-1"><ArrowDownToLine size={14}/> إيداع ({tx.destination === 'cash_register' ? 'الدرج' : 'الخزنة'})</span>}
                            {tx.type === 'withdraw' && <span className="text-red-700 flex items-center gap-1"><ArrowUpFromLine size={14}/> سحب ({tx.source === 'cash_register' ? 'الدرج' : 'الخزنة'})</span>}
                            {tx.type === 'transfer' && <span className="text-blue-700 flex items-center gap-1"><ArrowRightLeft size={14}/> تحويل</span>}
                          </td>
                          <td className="py-3 px-3 text-xs font-mono font-bold text-[#000000]">{tx.amount.toFixed(2)}</td>
                          <td className="py-3 px-3 text-xs font-bold text-[#000000] max-w-[200px] truncate" title={tx.notes}>{tx.notes}</td>
                          <td className="py-3 px-3 text-[11px] font-mono text-[#555555]">{new Date(tx.date).toLocaleString('ar-EG')}</td>
                          <td className="py-3 px-3 text-xs font-bold text-[#000000]">{tx.created_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
