import React, { useState, useEffect, useRef } from "react";
import {
  ShoppingCart,
  Search,
  Trash2,
  Printer,
  Barcode,
  X,
  Wallet,
  AlertTriangle,
  CheckCircle,
  Pause,
  Monitor,
  Download,
  ExternalLink,
  Undo2,
  Star,
} from "lucide-react";
import { Item, InvoiceItem, User as LoggedUser } from "../types";
import { authFetch, hardRefocus } from "../authFetch";
import UnifiedPrintButton from "./UnifiedPrintButton";

interface SalesInvoiceProps {
  currentUser: LoggedUser | null;
  tamweenCustomer?: any;
  onClearTamweenCustomer?: () => void;
}

export default function SalesInvoice({ currentUser, tamweenCustomer, onClearTamweenCustomer }: SalesInvoiceProps) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [secretNumber, setSecretNumber] = useState("");
  const [saleType, setSaleType] = useState<"retail" | "wholesale">("retail");
  const [paymentSource, setPaymentSource] = useState<"cash_register" | "main_safe">("cash_register");
  const [tamweenCards, setTamweenCards] = useState<number[]>([]);
  const [manualCardOpen, setManualCardOpen] = useState(false);
  const [manualCardInput, setManualCardInput] = useState("");
  const [breadPoints, setBreadPoints] = useState(0);
  // Autocomplete for customer name/secret
  const [nameSuggestions, setNameSuggestions] = useState<any[]>([]);
  const [secretSuggestions, setSecretSuggestions] = useState<any[]>([]);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showSecretDropdown, setShowSecretDropdown] = useState(false);
  const [withdrawalChoice, setWithdrawalChoice] = useState<"now" | "later">("now");
  const [tamweenCustomerId, setTamweenCustomerId] = useState<number | null>(null);
  // الحافز (Bonus) - manual input (بالموجب)
  const [bonus, setBonus] = useState(0);

  // Customer search (بحث عملاء التموين)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerSecret, setNewCustomerSecret] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerCardValue, setNewCustomerCardValue] = useState(0);
  const [newCustomerBreadPoints, setNewCustomerBreadPoints] = useState(0);

  // Customer search (بحث عملاء التموين)
  useEffect(() => {
    if (!customerSearchQuery || !showCustomerSearch) {
      setCustomerSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      authFetch(`/api/tamween-customers/search?q=${encodeURIComponent(customerSearchQuery)}`)
        .then(r => r.json())
        .then(data => setCustomerSearchResults(data))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [customerSearchQuery, showCustomerSearch]);

  // Autocomplete: customer name
  useEffect(() => {
    if (!showNameDropdown || customerName.length < 1) { setNameSuggestions([]); return; }
    const timer = setTimeout(() => {
      authFetch(`/api/tamween-customers/search?q=${encodeURIComponent(customerName)}`)
        .then(r => r.json())
        .then(data => setNameSuggestions(data.slice(0, 5)))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [customerName, showNameDropdown]);

  // Autocomplete: secret number
  useEffect(() => {
    if (!showSecretDropdown || secretNumber.length < 1) { setSecretSuggestions([]); return; }
    const timer = setTimeout(() => {
      authFetch(`/api/tamween-customers/search?q=${encodeURIComponent(secretNumber)}`)
        .then(r => r.json())
        .then(data => setSecretSuggestions(data.slice(0, 5)))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [secretNumber, showSecretDropdown]);

  // Multi-invoice tabs (فواتير معلقة)
  interface HeldInvoice {
    id: number;
    label: string;
    cart: InvoiceItem[];
    customerName: string;
    secretNumber: string;
    tamweenCustomerId?: number | null;
    saleType: "retail" | "wholesale";
    paymentMethod: "cash" | "instapay" | "visa" | "vodafone" | "credit";
    paymentSource: "cash_register" | "main_safe";
    discount: number;
    tamweenCards: number[];
    breadPoints: number;
    bonus: number;
    paid: number;
    invoiceNumber: string;
    date: string;
  }
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  // تأكيد داخل الصفحة بدل confirm النظام (اللي بيسرق الفوكس ويجمد الحقول)
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [nextTabId, setNextTabId] = useState(2);

  // Load held invoices + active cart from DB only (no localStorage)
  // NOTE: skipped entirely when opened via "صرف الآن" — the tamween effect below
  // orchestrates loading (held + active) itself to avoid races that used to eat invoices.
  useEffect(() => {
    if (tamweenCustomer) return;
    authFetch("/api/held-invoices")
      .then(r => r.json())
      .then((rows: any[]) => {
        if (rows.length > 0) {
          const loaded = rows
            .map((r: any) => ({
              id: r.id,
              label: r.label || "فاتورة",
              cart: r.cart_json ? JSON.parse(r.cart_json) : [],
              customerName: r.customer_name || "",
              secretNumber: r.secret_number || "",
              saleType: r.sale_type || "retail",
              paymentMethod: r.payment_method || "cash",
              paymentSource: r.payment_source || "cash_register",
              discount: r.discount || 0,
              tamweenCards: r.tamween_cards_json ? JSON.parse(r.tamween_cards_json) : [],
              breadPoints: r.bread_points || 0,
              bonus: r.bonus || 0,
              paid: r.paid || 0,
              invoiceNumber: r.invoice_number || "",
              date: r.date || "",
            }));
          setHeldInvoices(loaded);
          setNextTabId(loaded.length + 1);
        }
      })
      .catch(() => {});

    // 2. Load active cart from DB (skip if tamweenCustomer is set — it will overwrite)
    if (!tamweenCustomer) {
      authFetch("/api/active-cart")
        .then(r => r.json())
        .then((ac: any) => {
          if (ac && ac.cart && ac.cart.length > 0) {
            setCart(ac.cart);
            setCustomerName(ac.customerName || "");
            setSecretNumber(ac.secretNumber || "");
            setSaleType(ac.saleType || "retail");
            setPaymentSource(ac.paymentSource || "cash_register");
            setDiscount(ac.discount || 0);
            setTamweenCards(ac.tamweenCards || []);
            setBreadPoints(ac.breadPoints || 0);
            setBonus(ac.bonus || 0);
            setPaid(ac.paid || 0);
            setInvoiceNumber(ac.invoiceNumber || "");
            setDate(ac.date || "");
            setActiveTabIndex(ac.activeTabIndex || 0);
          }
          hasLoadedActiveCart.current = true;
        })
        .catch(() => { hasLoadedActiveCart.current = true; });
    } else {
      hasLoadedActiveCart.current = true;
    }
  }, []);



  // Save held invoices to database whenever they change
  useEffect(() => {
    if (!hasLoadedActiveCart.current) return;
    if (heldInvoices.length === 0) {
      authFetch("/api/held-invoices", { method: "DELETE" }).catch(() => {});
      return;
    }
    // Only save tabs that have actual cart items (prevent empty "سعد" ghosts)
    const toSave = heldInvoices
      .filter(inv => inv.cart.length > 0 || (inv.customerName && inv.customerName !== "عميل نقدي افتراضي"))
      .map((inv, idx) => ({
        tab_index: idx,
            cart: inv.cart,
        customer_name: inv.customerName,
        secret_number: inv.secretNumber,
        sale_type: inv.saleType,
        payment_method: inv.paymentMethod,
        payment_source: inv.paymentSource,
        discount: inv.discount,
        tamween_cards: inv.tamweenCards,
        bread_points: inv.breadPoints,
        bonus: inv.bonus,
        paid: inv.paid,
        invoice_number: inv.invoiceNumber,
        date: inv.date,
        label: inv.label,
      }));
    authFetch("/api/held-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoices: toSave }),
    }).catch(() => {});
  }, [heldInvoices]);

  // Pre-fill customer data from TamweenCustomers "صرف الآن/لاحق"
  // NEVER overwrite active work: queue in-memory OR database-persisted work to the
  // waiting list first (covers remount-after-navigation where state is fresh but the
  // work lives in active_carts), then open the recalled customer in a fresh tab beside it.
  useEffect(() => {
    if (!tamweenCustomer) return;
    // Same customer recalled twice within 3s (double-click) → handle once only
    const tKey = String((tamweenCustomer as any).id ?? `${(tamweenCustomer as any).name}|${(tamweenCustomer as any).secret_number}`);
    const nowTs = Date.now();
    if (lastTamweenHandled.current.key === tKey && nowTs - lastTamweenHandled.current.t < 3000) {
      if (onClearTamweenCustomer) onClearTamweenCustomer();
      return;
    }
    lastTamweenHandled.current = { key: tKey, t: nowTs };
    let cancelled = false;
    (async () => {
      const cur: any = (stateRef as any)?.current || {};
      const memHasWork =
        (Array.isArray(cur.cart) && cur.cart.length > 0) ||
        (cur.customerName && cur.customerName !== "" && cur.customerName !== "عميل نقدي افتراضي") ||
        (cur.secretNumber && cur.secretNumber !== "");

      // Work may live only in DB (navigated away without holding) — fetch it
      let dbHeldRows: any[] = [];
      let dbActive: any = null;
      try {
        const r = await authFetch("/api/held-invoices");
        if (r.ok) dbHeldRows = await r.json();
      } catch {}
      try {
        const r = await authFetch("/api/active-cart");
        if (r.ok) dbActive = await r.json();
      } catch {}
      if (cancelled) return;

      const mapRow = (r: any) => ({
        id: r.id ?? Date.now() + Math.random(),
        label: r.label || r.customer_name || "فاتورة",
        cart: r.cart_json ? JSON.parse(r.cart_json) : [],
        customerName: r.customer_name || "",
        secretNumber: r.secret_number || "",
        tamweenCustomerId: null as number | null,
        saleType: r.sale_type || "retail",
        paymentMethod: r.payment_method || "cash",
        paymentSource: r.payment_source || "cash_register",
        discount: r.discount || 0,
        tamweenCards: r.tamween_cards_json ? JSON.parse(r.tamween_cards_json) : [],
        breadPoints: r.bread_points || 0,
        bonus: r.bonus || 0,
        paid: r.paid || 0,
        invoiceNumber: r.invoice_number || "",
        date: r.date || "",
      });

      const memHeld = Array.isArray(cur.heldInvoices) ? cur.heldInvoices : [];
      const base: any[] = memHeld.length > 0 ? [...memHeld] : dbHeldRows.map(mapRow);

      const dbActiveHasWork =
        dbActive && (
          (Array.isArray(dbActive.cart) && dbActive.cart.length > 0) ||
          (dbActive.customerName && dbActive.customerName !== "")
        );

      // Dedupe: never queue the same invoice twice (same number, or same
      // customer+cart fingerprint) — protects against double recalls
      const cartFingerprint = (c: any, n: any, s: any, items: any[]) =>
        `${c || ""}|${n || ""}|${s || ""}|${(items || []).length}|${(items || []).reduce((a: number, it: any) => a + Number(it.total || 0), 0)}`;
      const alreadyQueued = (snap: any) =>
        base.some((b: any) =>
          (snap.invoiceNumber && b.invoiceNumber && snap.invoiceNumber === b.invoiceNumber) ||
          cartFingerprint(snap.cart, snap.customerName, snap.secretNumber, snap.cart) ===
            cartFingerprint(b.cart, b.customerName, b.secretNumber, b.cart)
        );

      if (memHasWork) {
        const snap: any = {
          id: Date.now(),
          label: cur.customerName && cur.customerName !== "عميل نقدي افتراضي" ? cur.customerName : `فاتورة ${base.length + 1}`,
          cart: Array.isArray(cur.cart) ? [...cur.cart] : [],
          customerName: cur.customerName || "",
          secretNumber: cur.secretNumber || "",
          tamweenCustomerId: cur.tamweenCustomerId ?? null,
          saleType: cur.saleType || "retail",
          paymentMethod: cur.paymentMethod || "cash",
          paymentSource: cur.paymentSource || "cash_register",
          discount: cur.discount || 0,
          tamweenCards: Array.isArray(cur.tamweenCards) ? [...cur.tamweenCards] : [],
          breadPoints: cur.breadPoints || 0,
          bonus: cur.bonus || 0,
          paid: cur.paid || 0,
          invoiceNumber: cur.invoiceNumber || "",
          date: cur.date || "",
        };
        if (!alreadyQueued(snap)) base.push(snap);
      } else if (dbActiveHasWork) {
        const snap: any = {
          id: Date.now(),
          label: dbActive.customerName || `فاتورة ${base.length + 1}`,
          cart: dbActive.cart || [],
          customerName: dbActive.customerName || "",
          secretNumber: dbActive.secretNumber || "",
          tamweenCustomerId: null,
          saleType: dbActive.saleType || "retail",
          paymentMethod: dbActive.paymentMethod || "cash",
          paymentSource: dbActive.paymentSource || "cash_register",
          discount: dbActive.discount || 0,
          tamweenCards: dbActive.tamweenCards || [],
          breadPoints: dbActive.breadPoints || 0,
          bonus: dbActive.bonus || 0,
          paid: dbActive.paid || 0,
          invoiceNumber: dbActive.invoiceNumber || "",
          date: dbActive.date || "",
        };
        if (!alreadyQueued(snap)) base.push(snap);
      }

      const buildIncoming = () => {
        if (typeof tamweenCustomer.id === "number") setTamweenCustomerId(tamweenCustomer.id);
        else if (typeof tamweenCustomer.customerId === "number") setTamweenCustomerId(tamweenCustomer.customerId);
        else setTamweenCustomerId(null);
        const ps = tamweenCustomer.pendingSale;
        if (ps && (Array.isArray(ps.cart) || ps.customerName)) {
          if (Array.isArray(ps.cart)) setCart(ps.cart); else setCart([]);
          // هوية العميل المستدعى هي المرجع دائماً — تجاهل الاسم/السري القدامى المخزنين في pendingSale
          setCustomerName(tamweenCustomer.name ?? ps.customerName ?? "");
          setSecretNumber(tamweenCustomer.secret_number ?? ps.secretNumber ?? "");
          if (ps.saleType === "retail" || ps.saleType === "wholesale") setSaleType(ps.saleType);
          if (ps.paymentMethod) setPaymentMethod(ps.paymentMethod);
          if (ps.paymentSource) setPaymentSource(ps.paymentSource);
          if (typeof ps.discount === "number") setDiscount(ps.discount); else setDiscount(0);
          if (Array.isArray(ps.tamweenCards)) setTamweenCards(ps.tamweenCards); else setTamweenCards([]); setManualCardOpen(false); setManualCardInput("");
          if (typeof ps.breadPoints === "number") setBreadPoints(ps.breadPoints); else setBreadPoints(0);
          if (typeof ps.bonus === "number") setBonus(ps.bonus); else setBonus(0);
          if (typeof ps.paid === "number") setPaid(ps.paid); else setPaid(0);
          setWithdrawalChoice("now");
          generateInvoiceProps();
        } else {
          setCart([]);
          setCustomerName(tamweenCustomer.name || "");
          setSecretNumber(tamweenCustomer.secret_number || "");
          setDiscount(0); setTamweenCards([]); setManualCardOpen(false); setManualCardInput(""); setBreadPoints(0); setBonus(0); setPaid(0);
          if (tamweenCustomer.bread_points > 0) setBreadPoints(tamweenCustomer.bread_points);
          if (tamweenCustomer.card_value > 0) {
            const tv = [0, 48.5, 98.5, 148.5, 198.5, 223.5, 248.5, 273.5, 299.5, 323.5, 348.5];
            const cards: number[] = [];
            let rem = tamweenCustomer.card_value;
            for (let i = tv.length - 1; i >= 1; i--) { while (rem >= tv[i] && cards.length < 10) { cards.push(i); rem -= tv[i]; } }
            setTamweenCards(cards);
          }
          setWithdrawalChoice("now");
          generateInvoiceProps();
        }
      };

      if (base.length > 0 && (memHasWork || dbActiveHasWork || memHeld.length > 0 || dbHeldRows.length > 0)) {
        setHeldInvoices(base);
        setActiveTabIndex(base.length);
        // Persist deterministically (replace-all) so a restart never resurrects ghosts
        const toSave = base
          .filter((inv: any) => inv.cart.length > 0 || (inv.customerName && inv.customerName !== "عميل نقدي افتراضي"))
          .map((inv: any, idx: number) => ({
            tab_index: idx,
            cart: inv.cart,
            customer_name: inv.customerName,
            secret_number: inv.secretNumber,
            sale_type: inv.saleType,
            payment_method: inv.paymentMethod,
            payment_source: inv.paymentSource,
            discount: inv.discount,
            tamween_cards: inv.tamweenCards,
            bread_points: inv.breadPoints,
            bonus: inv.bonus,
            paid: inv.paid,
            invoice_number: inv.invoiceNumber,
            date: inv.date,
            label: inv.label,
          }));
        if (toSave.length > 0) {
          authFetch("/api/held-invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoices: toSave }),
          }).catch(() => {});
        }
        try { setSuccess(`تم حفظ الفاتورة الحالية في الانتظار، وفتح فاتورة ${tamweenCustomer.name || ""} بجانبها`); } catch {}
      }
      hasLoadedActiveCart.current = true;
      buildIncoming();
      if (onClearTamweenCustomer) onClearTamweenCustomer();
      try { if (barcodeInputRef.current) (barcodeInputRef.current as any).focus?.(); } catch {}
    })();
    return () => { cancelled = true; };
  }, [tamweenCustomer]);

  // Market identity from disk (server settings), not localStorage
  const [marketName, setMarketName] = useState("منظومة الكابتن");
  const [marketPhone, setMarketPhone] = useState("01099887766");
  const [taxRate, setTaxRate] = useState(14);
  useEffect(() => {
    authFetch("/api/settings")
      .then(r => r.ok ? r.json() : null)
      .then(s => {
        if (!s) return;
        if (s.market_name) setMarketName(s.market_name);
        if (s.market_phone) setMarketPhone(s.market_phone);
        if (s.tax_rate !== undefined && s.tax_rate !== null && s.tax_rate !== "") setTaxRate(Number(s.tax_rate));
      })
      .catch(() => {});
  }, []);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "instapay" | "visa" | "vodafone" | "credit">("cash");

  // Image Saving indicators
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [imageSavedStatus, setImageSavedStatus] = useState("");
  const [savedImageUrl, setSavedImageUrl] = useState("");
  const [savedFilename, setSavedFilename] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  
  // Cart
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [cartPage, setCartPage] = useState(1);
  const [lastRemoved, setLastRemoved] = useState<{ items: InvoiceItem[]; at: number } | null>(null);
  const undoRemoveRef = useRef<() => void>(() => {});
  const [showQuickGrid, setShowQuickGrid] = useState(false);
  const [quickProducts, setQuickProducts] = useState<Item[]>([]);
  const quickLoadedRef = useRef(false);
  const itemsPerPage = 5;
  
  // Calculations
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printedInvoiceId, setPrintedInvoiceId] = useState<any>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<any>(null);
  const [showInvoiceHistory, setShowInvoiceHistory] = useState(false);
  const [historyInvoices, setHistoryInvoices] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadInvoiceHistory = async () => {
    setHistoryLoading(true);
    setShowInvoiceHistory(true);
    try {
      const res = await authFetch("/api/invoices?type=sales");
      if (res.ok) {
        const data = await res.json();
        setHistoryInvoices(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleReprintInvoice = async (invoiceId: number) => {
    try {
      const res = await authFetch(`/api/invoices/${invoiceId}`);
      if (res.ok) {
        const { invoice, items } = await res.json();
        setPrintData({
          invoice_number: invoice.invoice_number,
          date: invoice.date,
          customer_name: invoice.customer_supplier_name,
          payment_source: invoice.payment_source,
          payment_method: invoice.payment_method || "cash",
          sale_type: invoice.sale_type || "retail",
          subtotal: invoice.subtotal || invoice.total,
          tax: invoice.tax || 0,
          discount: invoice.discount || 0,
          tamweenDiscount: invoice.tamween_discount || 0,
          breadPoints: invoice.bread_points || 0,
          bonus: invoice.bonus || 0,
          total: invoice.total,
          paid: invoice.paid || 0,
          remaining: invoice.remaining || 0,
          items: items.map((it: any) => ({
            name: it.name || it.item_name,
            quantity: it.quantity,
            unit: it.unit || "",
            price: it.price || 0,
            total: it.total || 0
          })),
          cashier: invoice.cashier || "الكاشير",
          marketName: marketName,
          marketPhone: marketPhone
        });
        setShowInvoiceHistory(false);
        setShowPrintModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const paidInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const secretInputRef = useRef<HTMLInputElement>(null);
  const breadInputRef = useRef<HTMLInputElement>(null);
  const bonusInputRef = useRef<HTMLInputElement>(null);

  const handleSubmitInvoiceRef = useRef<any>(null);
  const clearCartRef = useRef<any>(null);

  // Keep refs in sync with state for the tamweenCustomer effect (which runs before state is declared)
  const stateRef = useRef({ cart: [] as any[], customerName: "", secretNumber: "", tamweenCustomerId: null as number | null, saleType: "retail" as any, paymentMethod: "cash" as any, paymentSource: "cash_register" as any, discount: 0, tamweenCards: [] as number[], breadPoints: 0, bonus: 0, paid: 0, invoiceNumber: "", date: "", activeTabIndex: 0, heldInvoices: [] as any[] });
  stateRef.current = { cart, customerName, secretNumber, tamweenCustomerId, saleType, paymentMethod, paymentSource, discount, tamweenCards, breadPoints, bonus, paid, invoiceNumber, date, activeTabIndex, heldInvoices };

  // Flag to prevent save effect from running before DB load completes
  const hasLoadedActiveCart = useRef(false);
  // Guard against double-clicks on "صرف الآن" (each click makes a new object → effect refires
  // while the form still shows the old customer → duplicate waiting tabs like علي/علي)
  const lastTamweenHandled = useRef<{ key: string; t: number }>({ key: "", t: 0 });

  // Save active cart to DB on every change (for remount recovery)
  useEffect(() => {
    // Skip until first load completes
    if (!hasLoadedActiveCart.current) return;

    // Debounce: save after 300ms of no changes
    const timer = setTimeout(() => {
      if (cart.length > 0 || customerName) {
        authFetch("/api/active-cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cart, customerName, secretNumber, saleType, paymentMethod, paymentSource,
            discount, tamweenCards, breadPoints, bonus, paid,
            invoiceNumber, date, activeTabIndex,
          }),
        }).catch(() => {});
      } else {
        authFetch("/api/active-cart", { method: "DELETE" }).catch(() => {});
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [cart, customerName, secretNumber, saleType, paymentMethod, paymentSource, discount, tamweenCards, breadPoints, bonus, paid, invoiceNumber, date, activeTabIndex]);

  // Flush active work to DB synchronously on unmount (real tab switch) — the 300ms
  // debounce above is cancelled on unmount, so without this the recall flow would
  // read a stale active_carts row and the old invoice would vanish.
  useEffect(() => {
    return () => {
      try {
        const s: any = stateRef.current;
        if (s && hasLoadedActiveCart.current && (s.cart?.length > 0 || s.customerName)) {
          authFetch("/api/active-cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cart: s.cart, customerName: s.customerName, secretNumber: s.secretNumber,
              saleType: s.saleType, paymentMethod: s.paymentMethod, paymentSource: s.paymentSource,
              discount: s.discount, tamweenCards: s.tamweenCards, breadPoints: s.breadPoints,
              bonus: s.bonus, paid: s.paid, invoiceNumber: s.invoiceNumber, date: s.date,
              activeTabIndex: s.activeTabIndex,
            }),
          }).catch(() => {});
        }
      } catch {}
    };
  }, []);

  const saveCurrentToHeld = () => {
    const s: any = (stateRef as any)?.current || {};
    const curIdx = typeof s.activeTabIndex === "number" ? s.activeTabIndex : activeTabIndex;
    if (curIdx >= heldInvoices.length) return;
    setHeldInvoices(prev => {
      const updated = [...prev];
      updated[curIdx] = {
        id: Date.now(),
        label: (s.customerName || customerName) && (s.customerName || customerName) !== "عميل نقدي افتراضي" ? (s.customerName || customerName) : `فاتورة ${curIdx + 1}`,
        cart: [...(s.cart ?? cart)],
        customerName: s.customerName ?? customerName,
        secretNumber: s.secretNumber ?? secretNumber,
        tamweenCustomerId: s.tamweenCustomerId ?? tamweenCustomerId,
        saleType: s.saleType ?? saleType,
        paymentMethod: s.paymentMethod ?? paymentMethod,
        paymentSource: s.paymentSource ?? paymentSource,
        discount: s.discount ?? discount,
        tamweenCards: [...(s.tamweenCards ?? tamweenCards)],
        breadPoints: s.breadPoints ?? breadPoints,
        bonus: s.bonus ?? bonus,
        paid: s.paid ?? paid,
        invoiceNumber: s.invoiceNumber ?? invoiceNumber,
        date: s.date ?? date,
      };
      return updated;
    });
  };

  const loadFromHeld = (index: number) => {
    const s: any = (stateRef as any)?.current || {};
    const curIdx = typeof s.activeTabIndex === "number" ? s.activeTabIndex : activeTabIndex;
    const curHeld: any[] = Array.isArray(s.heldInvoices) ? s.heldInvoices : heldInvoices;
    if (index === curIdx) return;
    // Read target BEFORE updating state (avoid stale closure)
    const targetInv = curHeld[index];
    if (!targetInv) return;
    // Save current tab state from the LIVE ref (never stale closure) — ONLY if it has
    // cart items (never overwrite a held invoice with an empty form)
    const liveCart = Array.isArray(s.cart) ? s.cart : [];
    setHeldInvoices(prev => {
      const updated = [...prev];
      if (curIdx < updated.length && liveCart.length > 0) {
        updated[curIdx] = {
          ...updated[curIdx],
          cart: [...liveCart],
          customerName: s.customerName || "",
          secretNumber: s.secretNumber || "",
          tamweenCustomerId: s.tamweenCustomerId ?? null,
          saleType: s.saleType || "retail",
          paymentMethod: s.paymentMethod || "cash",
          paymentSource: s.paymentSource || "cash_register",
          discount: s.discount || 0,
          tamweenCards: Array.isArray(s.tamweenCards) ? [...s.tamweenCards] : [],
          breadPoints: s.breadPoints || 0,
          bonus: s.bonus || 0,
          paid: s.paid || 0,
          invoiceNumber: s.invoiceNumber || "",
          date: s.date || "",
          label: s.customerName && s.customerName !== "عميل نقدي افتراضي" ? s.customerName : updated[curIdx]?.label || `فاتورة ${curIdx + 1}`,
        };
      } else if (curIdx >= updated.length && liveCart.length > 0) {
        // الفاتورة النشطة خارج القائمة (تبويب جديد) — ادفعها للقائمة بدل ما تضيع
        updated.push({
          id: Date.now(),
          label: s.customerName && s.customerName !== "عميل نقدي افتراضي" ? s.customerName : `فاتورة ${updated.length + 1}`,
          cart: [...liveCart],
          customerName: s.customerName || "",
          secretNumber: s.secretNumber || "",
          tamweenCustomerId: s.tamweenCustomerId ?? null,
          saleType: s.saleType || "retail",
          paymentMethod: s.paymentMethod || "cash",
          paymentSource: s.paymentSource || "cash_register",
          discount: s.discount || 0,
          tamweenCards: Array.isArray(s.tamweenCards) ? [...s.tamweenCards] : [],
          breadPoints: s.breadPoints || 0,
          bonus: s.bonus || 0,
          paid: s.paid || 0,
          invoiceNumber: s.invoiceNumber || "",
          date: s.date || "",
        });
      }
      return updated;
    });
    // Restore target tab state
    setCart(targetInv.cart);
    setCustomerName(targetInv.customerName);
    setSecretNumber(targetInv.secretNumber);
    setTamweenCustomerId((targetInv as any).tamweenCustomerId ?? null);
    setSaleType(targetInv.saleType);
    setPaymentMethod(targetInv.paymentMethod);
    setPaymentSource(targetInv.paymentSource);
    setDiscount(targetInv.discount);
    setTamweenCards(targetInv.tamweenCards);
    setBreadPoints(targetInv.breadPoints);
    setBonus(targetInv.bonus);
    setPaid(targetInv.paid);
    setInvoiceNumber(targetInv.invoiceNumber);
    setDate(targetInv.date);
    setActiveTabIndex(index);
    setWithdrawalChoice("now");
  };

  const handleHoldInvoice = () => {
    const s: any = (stateRef as any)?.current || {};
    if (!s.cart || s.cart.length === 0) return;
    // Calculate new tab index BEFORE updating state
    // If replacing existing tab: new empty is at heldInvoices.length
    // If pushing current (no existing tab): new empty is at heldInvoices.length + 1
    const newIndex = (s.activeTabIndex ?? activeTabIndex) < (s.heldInvoices ?? heldInvoices).length
      ? (s.heldInvoices ?? heldInvoices).length : (s.heldInvoices ?? heldInvoices).length + 1;
    setHeldInvoices(prev => {
      let updated = [...prev];
      const currentTab: HeldInvoice = {
        id: Date.now(),
        label: s.customerName && s.customerName !== "عميل نقدي افتراضي" ? s.customerName : `فاتورة ${updated.length + 1}`,
        cart: [...s.cart],
        customerName: s.customerName || "",
        secretNumber: s.secretNumber || "",
        saleType: s.saleType || "retail",
        paymentMethod: s.paymentMethod || "cash",
        paymentSource: s.paymentSource || "cash_register",
        discount: s.discount || 0,
        tamweenCards: [...(s.tamweenCards || [])],
        breadPoints: s.breadPoints || 0,
        bonus: s.bonus || 0,
        paid: s.paid || 0,
        invoiceNumber: s.invoiceNumber || "",
        date: s.date || "",
      };
      if (activeTabIndex < updated.length) {
        updated[activeTabIndex] = currentTab;
      } else {
        updated.push(currentTab);
      }
      const emptyTab: HeldInvoice = {
        id: Date.now() + 1,
        label: `فاتورة ${updated.length + 1}`,
        cart: [],
        customerName: "",
        secretNumber: "",
        saleType: "retail",
        paymentMethod: "cash",
        paymentSource: "cash_register",
        discount: 0,
        tamweenCards: [],
        breadPoints: 0,
        bonus: 0,
        paid: 0,
        invoiceNumber: "",
        date: "",
      };
      updated.push(emptyTab);
      return updated;
    });
    setActiveTabIndex(newIndex);
    setCart([]);
    setCustomerName("");
    setSecretNumber(""); setWithdrawalChoice("");
    setDiscount(0);
    setTamweenCards([]); setManualCardOpen(false); setManualCardInput("");
    setBreadPoints(0);
    setBonus(0);
    setPaid(0);
    generateInvoiceProps();
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };
  const handleHoldInvoiceRef = useRef<any>(null);

  const addNewTab = () => {
    const s: any = (stateRef as any)?.current || {};
    const newIndex = (s.activeTabIndex ?? activeTabIndex) < (s.heldInvoices ?? heldInvoices).length
      ? (s.heldInvoices ?? heldInvoices).length : (s.heldInvoices ?? heldInvoices).length + 1;
    setHeldInvoices(prev => {
      let updated = [...prev];
      // Save current tab if it has data — from live ref (never stale closure)
      if ((s.activeTabIndex ?? activeTabIndex) < updated.length && (Array.isArray(s.cart) ? s.cart.length > 0 : false)) {
        const curIdx = s.activeTabIndex ?? activeTabIndex;
        updated[curIdx] = {
          ...updated[curIdx],
          cart: [...s.cart],
          customerName: s.customerName || "",
          secretNumber: s.secretNumber || "",
          saleType: s.saleType || "retail",
          paymentMethod: s.paymentMethod || "cash",
          paymentSource: s.paymentSource || "cash_register",
          discount: s.discount || 0,
          tamweenCards: [...(s.tamweenCards || [])],
          breadPoints: s.breadPoints || 0,
          bonus: s.bonus || 0,
          paid: s.paid || 0,
          invoiceNumber: s.invoiceNumber || "",
          date: s.date || "",
          label: s.customerName && s.customerName !== "عميل نقدي افتراضي" ? s.customerName : updated[s.activeTabIndex ?? activeTabIndex]?.label || `فاتورة ${(s.activeTabIndex ?? activeTabIndex) + 1}`,
        };
      }
      // Add new empty tab
      const newInv: HeldInvoice = {
        id: Date.now(),
        label: `فاتورة ${updated.length + 1}`,
        cart: [],
        customerName: "",
        secretNumber: "",
        saleType: "retail",
        paymentMethod: "cash",
        paymentSource: "cash_register",
        discount: 0,
        tamweenCards: [],
        breadPoints: 0,
        bonus: 0,
        paid: 0,
        invoiceNumber: "",
        date: "",
      };
      updated = [...updated, newInv];
      return updated;
    });
    setActiveTabIndex(newIndex);
    setCart([]);
    setCustomerName("");
    setSecretNumber(""); setWithdrawalChoice("");
    setDiscount(0);
    setTamweenCards([]); setManualCardOpen(false); setManualCardInput("");
    setBreadPoints(0);
    setBonus(0);
    setPaid(0);
    generateInvoiceProps();
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  const closeTab = (index: number) => {
    const cur: any = (stateRef as any)?.current || {};
    const held: any[] = Array.isArray(cur.heldInvoices) ? cur.heldInvoices : heldInvoices;
    const curActive = typeof cur.activeTabIndex === "number" ? cur.activeTabIndex : activeTabIndex;
    if (held.length === 0) return;
    const updated = held.filter((_, i) => i !== index);
    setHeldInvoices(updated);
    if (index === curActive) {
      // closing active tab → switch to neighbor and load it directly (no stale closure)
      if (updated.length === 0) {
        setActiveTabIndex(0);
        clearCart();
        return;
      }
      const nextIdx = Math.min(index, updated.length - 1);
      const target = updated[nextIdx];
      if (target) {
        setCart(target.cart || []);
        setCustomerName(target.customerName || "");
        setSecretNumber(target.secretNumber || "");
        setSaleType(target.saleType || "retail");
        setPaymentMethod(target.paymentMethod || "cash");
        setPaymentSource(target.paymentSource || "cash_register");
        setDiscount(target.discount || 0);
        setTamweenCards(target.tamweenCards || []);
        setBreadPoints(target.breadPoints || 0);
        setBonus(target.bonus || 0);
        setPaid(target.paid || 0);
        setInvoiceNumber(target.invoiceNumber || "");
        setDate(target.date || "");
        setWithdrawalChoice("now");
      }
      setActiveTabIndex(nextIdx);
    } else if (index < curActive) {
      // closing a tab before active → shift active index left
      setActiveTabIndex(Math.max(0, curActive - 1));
    }
  };

  const generateInvoiceProps = () => {
    const d = new Date();
    const formattedDate = d.toISOString().split("T")[0];
    setDate(formattedDate);

    const randNum = Math.floor(100000 + Math.random() * 900000);
    setInvoiceNumber(`SINV-${randNum}`);
  };

  useEffect(() => {
    generateInvoiceProps();
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  // Auto-update current tab label when customer name changes
  useEffect(() => {
    if (heldInvoices.length === 0) return;
    setHeldInvoices(prev => {
      const updated = [...prev];
      if (activeTabIndex < updated.length) {
        updated[activeTabIndex] = {
          ...updated[activeTabIndex],
          label: customerName || `فاتورة ${activeTabIndex + 1}`,
          customerName,
        };
      }
      return updated;
    });
  }, [customerName]);

  useEffect(() => {
    const searchItems = async () => {
      if (!searchQuery) {
        setSearchResults([]);
        return;
      }
      try {
        const response = await authFetch(`/api/items/search?query=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);

          const exactMatch = data.find((i: Item) => i.barcode === searchQuery);
          if (exactMatch) {
            addToCart(exactMatch);
            setSearchQuery("");
            setSearchResults([]);
          }
        }
      } catch (err) {
        console.error("خطأ أثناء البحث المتزامن", err);
      }
    };

    const timer = setTimeout(searchItems, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addToCart = (product: Item) => {
    setError("");
    // الأصناف بلا باركود لا تدمج أبداً (كل سطر مستقل)
    const existingIndex = product.barcode
      ? cart.findIndex((i) => i.barcode && i.barcode === product.barcode)
      : -1;
    const selectedPrice = saleType === "retail" ? product.retail_price : product.wholesale_price;

    if (product.is_unlimited !== 1 && product.quantity <= 0) {
      setError("لا يتوفر مخزون كافٍ لهذا المنتج (المخزون = 0).");
      return;
    }

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      const newQty = updatedCart[existingIndex].quantity + 1;
      
      if (product.is_unlimited !== 1 && newQty > product.quantity) {
        setError(`الكمية المطلوبة (${newQty}) تتجاوز المتاح (${product.quantity}).`);
        return;
      }

      const updatedItem = { ...updatedCart[existingIndex] };
      updatedItem.quantity = newQty;
      updatedItem.total = newQty * updatedItem.price;
      
      updatedCart.splice(existingIndex, 1);
      setCart([updatedItem, ...updatedCart]);
      setCartPage(1);
    } else {
      const newItem: InvoiceItem = {
        barcode: product.barcode,
        name: product.name,
        quantity: 1,
        unit: product.unit,
        price: selectedPrice,
        cost_price: product.purchase_price,
        total: selectedPrice,
        is_unlimited: product.is_unlimited,
        stock_quantity: product.quantity,
        low_stock_limit: product.low_stock_limit,
      };
      setCart([newItem, ...cart]);
      setCartPage(1);
    }

    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const TAMWEEN_BARCODES = ["8801000000001", "8801000000002"];

  const addTamweenItemsToCart = async () => {
    try {
      const response = await authFetch("/api/items");
      if (response.ok) {
        const allItems: Item[] = await response.json();
        const tamweenItems = allItems.filter(i => TAMWEEN_BARCODES.includes(i.barcode));
        for (const item of tamweenItems) {
          const alreadyInCart = cart.find(c => c.barcode === item.barcode);
          if (!alreadyInCart) {
            addToCart(item);
          }
        }
      }
    } catch (err) {
      console.error("خطأ أثناء جلب أصناف التموين", err);
    }
  };

  const updateCartQty = (index: number, qtyStr: string) => {
    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty <= 0) return;

    const item = cart[index];
    if (item && item.is_unlimited !== 1 && (item.stock_quantity ?? 0) > 0 && qty > item.stock_quantity!) {
      setError(`الكمية (${qty}) تتجاوز المتاح في المخزون (${item.stock_quantity}).`);
      return;
    }

    setCart(cart.map((it, i) => {
      if (i === index) {
        return { ...it, quantity: qty, total: qty * it.price };
      }
      return it;
    }));
  };



  const removeFromCart = (index: number) => {
    if (cart[index]) setLastRemoved({ items: [cart[index]], at: index });
    setCart(cart.filter((_, i) => i !== index));
  };

  const undoRemove = () => {
    if (!lastRemoved) return;
    const prev = lastRemoved;
    setCart(cur => {
      const next = [...cur];
      next.splice(Math.min(prev.at, next.length), 0, ...prev.items);
      return next;
    });
    setLastRemoved(null);
  };

  const toggleQuickGrid = async () => {
    const next = !showQuickGrid;
    setShowQuickGrid(next);
    if (next && !quickLoadedRef.current) {
      try {
        const r = await authFetch("/api/quick-products");
        if (r.ok) {
          const rows = await r.json();
          if (Array.isArray(rows) && rows.length > 0) {
            setQuickProducts(rows as Item[]);
            quickLoadedRef.current = true;
          }
        }
      } catch {}
    }
  };

  // سعر السوق اللحظي: تعديل سعر الصنف في السلة بدون المساس ببيانات الصنف الأساسية
  const updateCartPrice = (index: number, priceStr: string) => {
    const price = parseFloat(priceStr);
    if (isNaN(price) || price < 0) return;
    setCart(cart.map((item, i) => {
      if (i === index) {
        return { ...item, price, total: item.quantity * price };
      }
      return item;
    }));
  };

  const clearCart = () => {
    if (cart.length > 0) setLastRemoved({ items: [...cart], at: 0 });
    setCart([]);
    setCustomerName("");
    setTamweenCustomerId(null);
    setDiscount(0);
    setTamweenCards([]); setManualCardOpen(false); setManualCardInput("");
    setBreadPoints(0);
    setBonus(0);
    setSecretNumber(""); setWithdrawalChoice("");
    authFetch("/api/active-cart", { method: "DELETE" }).catch(() => {});

    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const subtotal = cart.reduce((add, item) => add + item.total, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  // Tamween card values (multi-select) - sum of all selected cards
  const tamweenValues = [0, 48.5, 98.5, 148.5, 198.5, 223.5, 248.5, 273.5, 299.5, 323.5, 348.5];
  const isManualCard = (c: number) => !(Number.isInteger(c) && c >= 1 && c <= 10);
  const cardValueOf = (c: number) => (isManualCard(c) ? c : (tamweenValues[c] || 0));
  const addManualCard = () => {
    const v = parseFloat(manualCardInput);
    if (isNaN(v) || v <= 0) { setError("أدخل قيمة صحيحة أكبر من صفر"); return; }
    if (Number.isInteger(v) && v >= 1 && v <= 10) { setError("دي قيمة بالجنيه مش عدد أفراد — لو عايز عدد أفراد استخدم الكروت الجاهزة"); return; }
    setTamweenCards([...tamweenCards, v]);
    setManualCardInput("");
    setManualCardOpen(false);
    addTamweenItemsToCart();
  };
  const tamweenDiscount = tamweenCards.reduce((sum, c) => sum + cardValueOf(c), 0);
  // Total = subtotal + tax - discount - tamween (sum) - breadPoints + bonus
  // Can be negative when tamween/bread points/bonus are selected before adding products
  const total = subtotal + taxAmount - discount - tamweenDiscount - breadPoints + bonus;
  const remaining = paymentMethod === "credit"
    ? Math.max(0, total - paid)
    : (paid > total ? paid - total : total - paid);

  useEffect(() => {
    if (paymentMethod === "credit") {
      setPaid(0);
    } else {
      setPaid(total);
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (paymentMethod !== "credit") setPaid(total);
    else setPaid((p) => Math.min(p, total));
  }, [total]);

  useEffect(() => {
    const adjustCartPrices = async () => {
      const response = await authFetch("/api/items");
      if (response.ok) {
        const dbItems: Item[] = await response.json();
        const updatedCart = cart.map((cartItem) => {
          const matched = dbItems.find((p) => p.barcode === cartItem.barcode);
          if (matched) {
            const chosenPrice = saleType === "retail" ? matched.retail_price : matched.wholesale_price;
            return {
              ...cartItem,
              price: chosenPrice,
              total: cartItem.quantity * chosenPrice
            };
          }
          return cartItem;
        });
        setCart(updatedCart);
      }
    };
    if (cart.length > 0) {
      adjustCartPrices();
    }
  }, [saleType]);

  const saveReceiptAsImage = async () => {
    const node = document.getElementById("thermal-receipt-printable-area");
    if (!node) return;
    setIsSavingImage(true);
    setImageSavedStatus("جاري تحويل وحفظ صورة الفاتورة في المجلد...");
    try {
      const { toPng } = await import("html-to-image");
      const width = node.offsetWidth || 302;
      const height = node.scrollHeight || node.offsetHeight;

      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        quality: 1.0,
        pixelRatio: 2,
        cacheBust: true,
        width: width,
        height: height,
        style: {
          transform: "none",
          margin: "0",
          width: "302px",
          minWidth: "302px",
          maxWidth: "302px",
          boxSizing: "border-box"
        }
      });

      const link = document.createElement("a");
link.download = "فاتورة_" + (invoiceNumber || "بدون_رقم") + ".png";
link.href = dataUrl;
link.click();
const data = { success: true, url: dataUrl, filename: link.download };
if (true) {
        setSavedImageUrl(data.url);
        setSavedFilename(data.filename);
        setImageSavedStatus(`تم حفظ صورة الفاتورة بنجاح بالاسم الثابت (${data.filename}).`);
      } else {
        throw new Error((data as any).error || "فشل الرد من الخادم.");
      }
    } catch (err: any) {
      console.error("Image saving failure", err);
      setImageSavedStatus("تعذر حفظ صورة الفاتورة في المجلد.");
    } finally {
      setIsSavingImage(false);
    }
  };


  const [errorTick, setErrorTick] = useState(0);

  const handleSubmitInvoice = async () => {
    setError("");
    setErrorTick((t) => t + 1);
    setSuccess("");

    if (cart.length === 0) {
      setError("الرجاء إضافة صنف واحد على الأقل للفاتورة.");
      return;
    }

    // حماية محاسبية: الإجمالي النهائي يجب أن يكون بالموجب دائماً
    if (total <= 0) {
      setError("لا يمكن حفظ الفاتورة — الإجمالي النهائي يجب أن يكون بالموجب. راجع قيم الدعم والخصومات.");
      return;
    }

    // كارت تموين: لا موافقة على البيع غير لما الاسم والرقم السري والحافز يكونوا معمّلين (نقاط الخبز مش شرط)
    if (Number(tamweenDiscount) > 0 || tamweenCards.length > 0) {
      const missingFields: string[] = [];
      if (!customerName.trim()) missingFields.push("اسم العميل");
      if (!secretNumber.trim()) missingFields.push("الرقم السري");
      if (!(Number(bonus) > 0)) missingFields.push("الحافز");
      if (missingFields.length > 0) {
        setError(`ملئ الحقول: فيه كارت تموين في الفاتورة ولازم تكمل ${missingFields.join(" + ")} قبل الموافقة على البيع. (نقاط الخبز مش شرط)`);
        return;
      }
    }

    // بيع آجل: لازم اسم عميل لتحديد المدين + المدفوع أقل من الإجمالي
    if (paymentMethod === "credit") {
      if (!customerName.trim()) {
        setError("لازم تدخل اسم العميل على الفاتورة الآجلة.");
        return;
      }
      if (paid >= total) {
        setError("في البيع الآجل لازم المدفوع يكون أقل من الإجمالي — غير كده يبقى بيع خالص.");
        return;
      }
    }

    // تنبيه البيع بخسارة: سعر أقل من التكلفة في أي صنف
    const losingItems = cart.filter((it) => Number(it.price) < Number(it.cost_price || 0));
    if (losingItems.length > 0) {
      const lossLines = losingItems.map((it) => `${it.name}: بيع ${it.price} / تكلفة ${it.cost_price}`).join("\n");
      const lossTotal = losingItems.reduce((s, it) => s + (Number(it.cost_price || 0) - Number(it.price)) * it.quantity, 0);
      const go = confirm(`⚠️ تنبيه بيع بخسارة:\n${lossLines}\nإجمالي الخسارة: ${lossTotal.toFixed(2)} ج.م\n\nمتابعة الحفظ؟`);
      try { hardRefocus(); } catch {}
      if (!go) return;
    }

    const arabicDateStr = new Intl.DateTimeFormat("ar-EG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).format(new Date());

    const payload = {
      invoice_number: invoiceNumber,
      date,
      customer_name: customerName,
      payment_source: paymentSource,
      sale_type: saleType,
      subtotal,
      tax: taxAmount,
      discount,
      tamween_discount: tamweenDiscount,
      bread_points: breadPoints,
      bonus: bonus,
      total,
      paid: paymentMethod === "credit" ? Math.min(paid, total) : total,
      remaining: paymentMethod === "credit" ? Math.max(0, total - paid) : 0,
      items: cart,
      created_by: currentUser?.name || "الكاشير",
      payment_method: paymentMethod,
      tamween_customer_id: tamweenCustomerId,
      secret_number: secretNumber
    };

    setLoading(true);
    try {
      const response = await authFetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setSuccess("تم حفظ الفاتورة وخصم المخزون بنجاح.");
        setPrintData({
          invoice_number: invoiceNumber,
          date,
          arabicDateStr,
          customer_name: customerName,
          payment_source: paymentSource,
          payment_method: paymentMethod,
          sale_type: saleType,
          subtotal,
          tax: taxAmount,
          discount,
          tamweenDiscount: tamweenDiscount,
          breadPoints: breadPoints,
          bonus: bonus,
          total,
          paid,
          remaining,
          items: cart,
          cashier: currentUser?.name || "الكاشير",
          marketName,
          marketPhone
        });
        setPrintedInvoiceId(result.invoice_id);
        setShowPrintModal(true);

        // Auto-save customer + set withdrawal status (فقط لو بيستخدم بطاقة تموين)
        if (secretNumber && customerName && tamweenDiscount > 0) {
          try {
            const existingRes = await authFetch(`/api/tamween-customers/by-secret/${encodeURIComponent(secretNumber)}`);
            const existing = await existingRes.json();
            let customerId = existing?.id;
            if (!existing) {
              const newRes = await authFetch("/api/tamween-customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: customerName,
                  secret_number: secretNumber,
                  phone: "",
                  card_value: tamweenDiscount || 0,
                  bread_points: breadPoints || 0,
                  pending_sale: {
                    cart: [...cart],
                    customerName,
                    secretNumber,
                    saleType,
                    paymentMethod,
                    paymentSource,
                    discount,
                    tamweenCards: [...tamweenCards],
                    breadPoints,
                    bonus,
                    paid,
                  },
                }),
              });
              const newData = await newRes.json();
              customerId = newData.customer?.id;
            } else {
              await authFetch(`/api/tamween-customers/${customerId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: existing.name,
                  secret_number: existing.secret_number,
                  phone: existing.phone || "",
                  card_value: tamweenDiscount || 0,
                  bread_points: breadPoints || 0,
                  pending_sale: {
                    cart: [...cart],
                    customerName: existing.name,
                    secretNumber: existing.secret_number,
                    saleType,
                    paymentMethod,
                    paymentSource,
                    discount,
                    tamweenCards: [...tamweenCards],
                    breadPoints,
                    bonus,
                    paid,
                  },
                }),
              });
            }
            if (customerId && withdrawalChoice) {
              const endpoint = withdrawalChoice === "now" ? "withdraw-now" : "activate";
              await authFetch(`/api/tamween-customers/${customerId}/${endpoint}`, { method: "POST" });
            }
          } catch {}
        }

        setLastRemoved(null);
        setCart([]);
        setCustomerName("");
        setDiscount(0);
        setTamweenCards([]); setManualCardOpen(false); setManualCardInput("");
        setBreadPoints(0);
        setBonus(0);
        setSecretNumber(""); setWithdrawalChoice("");
        setTamweenCustomerId(null);
    
        generateInvoiceProps();
        authFetch("/api/active-cart", { method: "DELETE" }).catch(() => {});

        // Remove the SOLD client's tab by identity (invoice number first,
        // then customer+secret fallback) — then show the next waiting invoice
        // in the form (never leave an empty form pointing at a held tab,
        // otherwise the next tab click overwrites that tab with emptiness)
        const soldInvoiceNumber = invoiceNumber;
        const soldCustomerName = customerName;
        const soldSecretNumber = secretNumber;
        const s: any = (stateRef as any)?.current || {};
        const curHeldWork: any[] = Array.isArray(s.heldInvoices) ? s.heldInvoices : heldInvoices;
        const curActiveIdxWork: number = typeof s.activeTabIndex === "number" ? s.activeTabIndex : activeTabIndex;
        const isSold = (inv: any, idx: number) => {
          if (soldInvoiceNumber && inv.invoiceNumber && inv.invoiceNumber === soldInvoiceNumber) return true;
          if (idx === curActiveIdxWork) return true;
          if (
            soldCustomerName && soldSecretNumber &&
            inv.customerName === soldCustomerName && inv.secretNumber === soldSecretNumber
          ) return true;
          return false;
        };
        const remainingHeld = curHeldWork.filter((inv: any, idx: number) => !isSold(inv, idx));
        setHeldInvoices(remainingHeld);
        if (remainingHeld.length === 0) {
          try { authFetch("/api/held-invoices", { method: "DELETE" }).catch(() => {}); } catch {}
          try { authFetch("/api/active-cart", { method: "DELETE" }).catch(() => {}); } catch {}
          setActiveTabIndex(0);
        } else {
          const pruneGhosts = remainingHeld.filter((inv: any) => Array.isArray(inv.cart) && inv.cart.length > 0);
          const toSaveBase = pruneGhosts.length > 0 ? pruneGhosts : remainingHeld;
          // Show the next waiting invoice in the form (never leave an empty form pointing
          // at a held tab — otherwise the next tab click overwrites that tab with emptiness)
          const first = (toSaveBase[0] as any);
          setCart(first.cart || []);
          setCustomerName(first.customerName || "");
          setSecretNumber(first.secretNumber || "");
          setTamweenCustomerId(first.tamweenCustomerId ?? null);
          setSaleType(first.saleType || "retail");
          setPaymentMethod(first.paymentMethod || "cash");
          setPaymentSource(first.paymentSource || "cash_register");
          setDiscount(first.discount || 0);
          setTamweenCards(first.tamweenCards || []);
          setBreadPoints(first.breadPoints || 0);
          setBonus(first.bonus || 0);
          setPaid(first.paid || 0);
          setInvoiceNumber(first.invoiceNumber || "");
          setDate(first.date || "");
          setWithdrawalChoice("now");
          setActiveTabIndex(0);
          const toSave = toSaveBase.map((inv: any, idx: number) => ({
            tab_index: idx,
            cart: inv.cart,
            customer_name: inv.customerName,
            secret_number: inv.secretNumber,
            sale_type: inv.saleType,
            payment_method: inv.paymentMethod,
            payment_source: inv.paymentSource,
            discount: inv.discount,
            tamween_cards: inv.tamweenCards,
            bread_points: inv.breadPoints,
            bonus: inv.bonus,
            paid: inv.paid,
            invoice_number: inv.invoiceNumber,
            date: inv.date,
            label: inv.label,
          }));
          authFetch("/api/held-invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoices: toSave }),
          }).catch(() => {});
        }
      } else {
        setError(result.error || "حدث خطأ أثناء حفظ الفاتورة.");
      }
    } catch (err) {
      setError("خطأ في الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  };

  handleSubmitInvoiceRef.current = handleSubmitInvoice;
  clearCartRef.current = clearCart;
  handleHoldInvoiceRef.current = handleHoldInvoice;
  undoRemoveRef.current = undoRemove;

  // ⌨️ اختصارات الكاشير: F9 = حفظ الفاتورة | Ctrl+Z = رجوع آخر صنف اتحذف
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "F9") {
        e.preventDefault();
        handleSubmitInvoiceRef.current?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (inField) return;
        e.preventDefault();
        undoRemoveRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleManualPrint = async () => {
    await saveReceiptAsImage();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full space-y-1 select-none font-sans" id="printable-sales" style={{ direction: "rtl" }}>
      
      {/* Top Header — مضغوط في سطر واحد */}
      <div className="bg-[#c3c6bb] px-2 py-1 border border-[#222222] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <h2 className="text-sm font-extrabold text-[#000000] flex items-center gap-1.5 shrink-0">
            <Monitor size={15} strokeWidth={1.5} />
            <span>نقطة البيع والتحصيل</span>
          </h2>
          <p className="text-[11px] text-[#555555] font-semibold">
            رقم الفاتورة: <span className="font-mono text-[#000000] font-bold">{invoiceNumber}</span> | الكاشير: {currentUser?.name || "الكاشير"}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadInvoiceHistory}
            className="h-6 px-2.5 flex items-center justify-center gap-1.5 bg-[#b8bcb2] hover:bg-[#888888] text-[#000000] font-bold text-xs border border-[#888888] transition-colors cursor-pointer"
          >
            <Search size={13} />
            <span>سجل الفواتير</span>
          </button>
          <div className="bg-[#222222] text-[#c3c6bb] px-2 py-0.5 text-[11px] font-bold shrink-0">
            الكاشير: نشط
          </div>
        </div>
      </div>

      {error && (
        <div key={`${errorTick}:${error}`} className="cap-shake bg-[#c3c6bb] border border-[#222222] p-2 text-[#000000] text-xs flex items-center gap-2 font-bold">
          <AlertTriangle size={16} strokeWidth={1.5} className="text-[#222222] shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-2 text-[#000000] text-xs flex items-center gap-2 font-bold">
          <CheckCircle size={16} strokeWidth={1.5} className="text-[#000000] shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Invoice Tabs (فواتير معلقة) */}
      <div className="bg-[#222222] border border-[#000000] p-1.5 flex items-center gap-2 overflow-x-auto shrink-0">
        {heldInvoices.map((inv, idx) => {
          const cartTotal = (inv.cart || []).reduce((sum: number, item: any) => sum + (Number(item.total) || (Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);
          const isActive = activeTabIndex === idx;
          const displayName = inv.customerName && inv.customerName !== "عميل نقدي افتراضي" ? inv.customerName : (inv.label || `فاتورة ${idx + 1}`);
          return (
            <div
              key={inv.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border cursor-pointer shrink-0 transition-colors ${
                isActive
                  ? "bg-white text-[#222222] border-[#e74c3c] border-r-4 shadow-sm"
                  : "bg-[#e8e8e8] text-[#333333] border-[#cccccc] hover:bg-[#d5d5d5]"
              }`}
            >
              <span onClick={() => loadFromHeld(idx)} className="flex flex-col items-start leading-tight">
                <span className="flex items-center gap-1">
                  <span>{displayName}</span>
                  {inv.cart.length > 0 && (
                    <span className={`px-1 rounded text-[9px] ${isActive ? 'bg-[#e74c3c] text-white' : 'bg-[#222222] text-[#c3c6bb]'}`}>{inv.cart.length}</span>
                  )}
                </span>
                {cartTotal > 0 && (
                  <span className={`text-[9px] font-mono ${isActive ? 'text-[#666666]' : 'text-[#888888]'}`}>{cartTotal.toFixed(2)} ج.م</span>
                )}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(idx); }}
                className={`ml-1 w-4 h-4 flex items-center justify-center border-none cursor-pointer ${isActive ? 'bg-transparent hover:bg-[#e74c3c]/20 text-[#e74c3c]' : 'bg-transparent hover:bg-[#999] text-[#888]'}`}
              >
                &times;
              </button>
            </div>
          );
        })}
        <button
          onClick={addNewTab}
          className="px-3 py-1.5 text-xs font-bold bg-[#27ae60] hover:bg-[#219a52] text-white border border-[#27ae60] cursor-pointer shrink-0 transition-colors"
          title="فاتورة جديدة"
        >
          + عميل جديد
        </button>
        {heldInvoices.length > 0 && (
          <button
            onClick={() => setShowClearAllConfirm(true)}
            className="px-3 py-1.5 text-xs font-bold bg-[#c0392b] hover:bg-[#a93226] text-white border border-[#922b21] cursor-pointer shrink-0 transition-colors"
            title="مسح كل المعلق"
          >
            مسح الكل ({heldInvoices.length})
          </button>
        )}
        <div className="mr-auto text-[10px] text-[#888888] font-bold shrink-0">
          الفاتورة الحالية: {invoiceNumber}
        </div>
      </div>

      {/* تأكيد مسح الكل — داخل الصفحة (بدون نافذة نظام) */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50">
          <div className="bg-[#c3c6bb] max-w-sm w-full p-6 border border-[#222222] space-y-4 text-center">
            <h4 className="text-sm font-extrabold text-[#000000]">مسح كل الفواتير المعلقة ({heldInvoices.length})؟</h4>
            <p className="text-xs text-[#555555] font-semibold">لا يمكن التراجع بعد المسح.</p>
            <div className="flex gap-x-4 gap-y-2 pt-2">
              <button
                onClick={() => {
                  setHeldInvoices([]);
                  setActiveTabIndex(0);
                  authFetch("/api/held-invoices", { method: "DELETE" }).catch(() => {});
                  setShowClearAllConfirm(false);
                  try { setSuccess("تم مسح كل الفواتير المعلقة"); } catch {}
                  try { hardRefocus(); } catch {}
                  try { if (barcodeInputRef.current) barcodeInputRef.current.focus(); } catch {}
                }}
                className="flex-1 h-9 bg-[#c0392b] hover:bg-[#a93226] text-white font-bold text-xs transition-colors cursor-pointer"
              >
                تأكيد المسح
              </button>
              <button
                onClick={() => {
                  setShowClearAllConfirm(false);
                  try { hardRefocus(); } catch {}
                  try { if (barcodeInputRef.current) barcodeInputRef.current.focus(); } catch {}
                }}
                className="flex-1 h-9 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] text-[#000000] font-bold text-xs transition-colors cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid Area — تصميم 3: ثلاثة أعمدة متجاوبة (عميل · جدول · ملخص) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[300px_minmax(0,1fr)_310px] items-stretch overflow-y-auto flex-1 min-h-0">

        {/* Col 2: البحث + المحتويات (النص) */}
        <div className="order-2 flex flex-col space-y-4 overflow-hidden min-h-0">
          
          {/* Search Box */}
          <div className="bg-[#c3c6bb] p-4 border border-[#222222] space-y-2 relative">
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-extrabold text-[#000000]">البحث عن منتج / مسح الباركود (F2)</label>
                <div className="relative">
                  <input
                    id="cashier-product-search-bar"
                    ref={barcodeInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم المنتج أو امسح الباركود..."
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] pr-9 pl-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#555555]">
                    <Search size={16} strokeWidth={1.5} />
                  </div>
                </div>
              </div>

              {/* الدفع فوق — شريط علوي جنب البحث (تصميم 3) */}
              <div className="w-40">
                <label className="block text-xs font-extrabold text-[#000000]">طريقة الدفع</label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] cursor-pointer focus:outline-none focus:border-[#222222]"
                >
                  <option value="cash">نقداً (كاش)</option>
                  <option value="instapay">انستاباي</option>
                  <option value="visa">بطاقة بنكية</option>
                  <option value="vodafone">محفظة إلكترونية</option>
                  <option value="credit">بيع آجل (على الحساب)</option>
                </select>
              </div>
              <div className="w-36">
                <label className="block text-xs font-extrabold text-[#000000]">الخزنة / الإيداع</label>
                <select
                  value={paymentSource}
                  onChange={(e: any) => setPaymentSource(e.target.value)}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] cursor-pointer focus:outline-none focus:border-[#222222]"
                >
                  <option value="cash_register">درج الكاشير</option>
                  <option value="main_safe">الخزنة الرئيسية</option>
                </select>
              </div>
            </div>

            {/* Instant Search Results Dropdown overlay */}
            {searchResults.length > 0 && (
              <div className="absolute top-[100%] mt-1 left-0 right-0 bg-[#c3c6bb] border border-[#222222] z-50 max-h-60 overflow-y-auto divide-y divide-[#888888]/40">
                {searchResults.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => {
                      addToCart(prod);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="p-3 hover:bg-[#b8bcb2] cursor-pointer flex justify-between items-center text-xs font-bold text-[#000000]"
                  >
                    <div>
                      <p className="font-extrabold">{prod.name}</p>
                      <p className="text-[#555555] text-[10px] font-mono">{prod.barcode}</p>
                    </div>
                    <div className="text-left">
                      <span>{saleType === "retail" ? (prod.retail_price || 0).toFixed(2) : (prod.wholesale_price || 0).toFixed(2)} ج.م</span>
                      <span className="block text-[10px] text-[#555555]">المتاح: {prod.quantity} {prod.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Table */}
          <div className="bg-[#c3c6bb] border border-[#222222] p-4 space-y-3 flex-1 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#888888] pb-3">
              <h3 className="text-sm font-extrabold text-[#000000] flex items-center gap-2">
                <ShoppingCart size={16} strokeWidth={1.5} />
                <span>محتويات الفاتورة ({cart.length})</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleQuickGrid}
                  className={`h-8 px-2.5 border text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                    showQuickGrid
                      ? "bg-[#222222] text-[#c3c6bb] border-[#222222]"
                      : "bg-[#b8bcb2] hover:bg-[#c3c6bb] text-[#000000] border-[#888888]"
                  }`}
                  title="أصناف الأكثر مبيعًا — ضغطة واحدة تضيفها"
                >
                  <Star size={14} strokeWidth={1.5} fill={showQuickGrid ? "#c3c6bb" : "none"} />
                  <span>الأصناف السريعة</span>
                </button>
                {lastRemoved && (
                  <button
                    onClick={undoRemove}
                    className="h-8 px-2.5 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] text-xs font-bold text-[#000000] flex items-center gap-2 cursor-pointer"
                    title="رجوع آخر صنف اتحذف (Ctrl+Z)"
                  >
                    <Undo2 size={14} strokeWidth={1.5} />
                    <span>تراجع</span>
                  </button>
                )}
                {cart.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleHoldInvoice}
                      className="h-8 px-2.5 bg-[#e74c3c] hover:bg-[#c0392b] border border-[#c0392b] text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
                    >
                      <Pause size={14} strokeWidth={1.5} />
                      <span>تعليق</span>
                      {heldInvoices.length > 1 && (
                        <span className="bg-white/20 px-1 rounded text-[9px]">{heldInvoices.length - 1}</span>
                      )}
                    </button>
                    <button
                      onClick={clearCart}
                      className="h-8 px-2.5 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] text-xs font-bold text-[#000000] flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                      <span>إفراغ</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* جريد الأصناف السريعة — مطوي افتراضيًا */}
            {showQuickGrid && (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 pb-3 border-b border-[#888888]">
                {quickProducts.length === 0 ? (
                  <div className="col-span-full text-center text-xs font-bold text-[#555555] py-3">
                    لا توجد بيانات مبيعات كافية بعد — أول ما تبيع أصناف هتظهر هنا.
                  </div>
                ) : (
                  quickProducts.map((p, idx) => (
                    <button
                      key={`${p.barcode || "nb"}-${idx}`}
                      onClick={() => addToCart(p)}
                      className="bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] p-2 text-right cursor-pointer transition-colors flex flex-col gap-1"
                      title="اضغط للإضافة للفاتورة"
                    >
                      <span className="font-extrabold text-xs leading-tight line-clamp-2">{p.name}</span>
                      <span className="flex justify-between items-center text-[10px] font-mono gap-1">
                        <span className="font-black">{(saleType === "retail" ? p.retail_price : p.wholesale_price || 0).toFixed(2)} ج.م</span>
                        <span className={p.is_unlimited !== 1 && (p.quantity ?? 0) <= (p.low_stock_limit ?? 5) ? "text-[#e74c3c] font-black" : "text-[#555555]"}>
                          {p.is_unlimited === 1 ? "بلا حد" : `${p.quantity ?? 0} ${p.unit || ""}`}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {cart.length === 0 ? (
              <div className="p-12 text-center text-[#555555] font-bold text-xs space-y-1">
                <p>السلة فارغة حالياً.</p>
                <p className="text-[10px]">امسح الباركود أو استخدم مربع البحث لإضافة أصناف.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs min-w-[750px] border-collapse">
                  <thead>
                    <tr className="bg-[#222222] text-[#c3c6bb] font-bold h-10">
                      <th className="py-3 px-4 whitespace-nowrap w-12">#</th>
                      <th className="py-3 px-4 min-w-[200px]">الصنف</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap w-28">السعر</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap w-36">الكمية</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap w-28">الإجمالي</th>
                      <th className="py-3 px-4 text-left whitespace-nowrap w-16">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#888888]/40 text-[#000000] font-bold">
                    {cart.slice((cartPage - 1) * itemsPerPage, cartPage * itemsPerPage).map((item, index) => {
                      const actualIndex = (cartPage - 1) * itemsPerPage + index;
                      return (
                        <tr key={actualIndex} className="hover:bg-[#b8bcb2] transition-colors">
                          <td className="py-3 px-4 text-[#555555] font-mono whitespace-nowrap">{actualIndex + 1}</td>
                          <td className="py-3 px-4 min-w-[180px]">
                            <p className="font-extrabold text-sm leading-tight flex items-center gap-1.5">
                              <span>{item.name}</span>
                              {item.is_unlimited !== 1 && (item.stock_quantity ?? 0) > 0 && (item.stock_quantity ?? 0) - (item.quantity || 0) <= (item.low_stock_limit ?? 5) && (
                                <span
                                  className="bg-[#c0392b] text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm shrink-0"
                                  title={`الحد الأدنى للصنف: ${item.low_stock_limit ?? 5}`}
                                >
                                  متبقي {((item.stock_quantity ?? 0) - (item.quantity || 0)).toFixed(0)}
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-[#555555] font-mono mt-0.5">{item.barcode}</p>
                          </td>
                          <td className="py-3 px-4 text-center font-black font-mono text-sm whitespace-nowrap">
                            {saleType === "retail" ? (
                              <span title="سعر القطاعي ثابت من بيانات الصنف">{(item.price || 0).toFixed(2)}</span>
                            ) : (
                              <input
                                type="number"
                                step="any"
                                value={item.price ?? ""}
                                onChange={(e) => updateCartPrice(actualIndex, e.target.value)}
                                onWheel={(e) => e.currentTarget.blur()}
                                title="سعر الجملة — عدل بحرية دون المساس بسعر الصنف الأساسي"
                                className="w-20 h-7 bg-[#b8bcb2] border border-[#888888] text-center text-xs font-black font-mono text-[#000000] focus:outline-none focus:border-[#222222]"
                                min="0"
                              />
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => updateCartQty(actualIndex, String(Math.max(0.1, item.quantity - 1)))}
                                className="w-7 h-7 bg-[#b8bcb2] border border-[#888888] font-black cursor-pointer hover:bg-[#222222] hover:text-[#c3c6bb] transition-colors"
                              >-</button>
                              <input
                                type="number"
                                step="any"
                                value={item.quantity || ""}
                                onChange={(e) => updateCartQty(actualIndex, e.target.value)}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="w-14 h-7 bg-[#b8bcb2] border border-[#888888] text-center text-xs font-bold text-[#000000] focus:outline-none"
                                min="0.001"
                              />
                              <button
                                onClick={() => updateCartQty(actualIndex, String(item.quantity + 1))}
                                className="w-7 h-7 bg-[#b8bcb2] border border-[#888888] font-black cursor-pointer hover:bg-[#222222] hover:text-[#c3c6bb] transition-colors"
                              >+</button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-black font-mono text-sm whitespace-nowrap">{(item.total || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-left whitespace-nowrap">
                            <button
                              onClick={() => removeFromCart(actualIndex)}
                              className="w-8 h-8 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] cursor-pointer transition-colors"
                              title="إزالة"
                            >
                              <Trash2 size={14} strokeWidth={1.5} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {Math.ceil(cart.length / itemsPerPage) > 1 && (
                  <div className="flex justify-center items-center gap-x-4 gap-y-2 pt-3 border-t border-[#888888] mt-2">
                    <button
                      onClick={() => setCartPage(prev => Math.max(1, prev - 1))}
                      disabled={cartPage === 1}
                      className="px-3 h-7 bg-[#b8bcb2] border border-[#888888] text-xs font-bold cursor-pointer disabled:opacity-40"
                    >السابق</button>
                    <span className="text-xs font-bold">{cartPage} / {Math.ceil(cart.length / itemsPerPage)}</span>
                    <button
                      onClick={() => setCartPage(prev => Math.min(Math.ceil(cart.length / itemsPerPage), prev + 1))}
                      disabled={cartPage === Math.ceil(cart.length / itemsPerPage)}
                      className="px-3 h-7 bg-[#b8bcb2] border border-[#888888] text-xs font-bold cursor-pointer disabled:opacity-40"
                    >التالي</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Col 1: بيانات العميل والكارت (يمين — وصفّ كامل فوق في الشاشات المتوسطة) */}
        <div className="order-1 bg-[#c3c6bb] border border-[#222222] p-4 space-y-4 overflow-y-auto min-h-0 lg:col-span-2 xl:col-span-1">
          <h3 className="text-sm font-extrabold text-[#000000] border-b border-[#888888] pb-2">
            بيانات العميل والكارت
          </h3>

          <div className="space-y-3 text-xs font-bold text-[#000000] lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0 xl:grid-cols-1 xl:space-y-3">
            
            {/* Sale Type - theme-aware */}
            <div>
              <label className="block text-[var(--text-secondary)] mb-1 font-black text-[11px]">نوع البيع</label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setSaleType("retail")}
                  className={`h-8 text-xs font-black rounded-lg cursor-pointer transition-all ${saleType === "retail" ? "text-white shadow" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                  style={saleType === "retail" ? {background: 'var(--success)'} : {}}
                >قطاعي</button>
                <button
                  type="button"
                  onClick={() => setSaleType("wholesale")}
                  className={`h-8 text-xs font-black rounded-lg cursor-pointer transition-all ${saleType === "wholesale" ? "text-white shadow" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                  style={saleType === "wholesale" ? {background: 'var(--primary)'} : {}}
                >جملة</button>
              </div>
            </div>

            {/* Tamween Card (بطاقة التموين) - 10 cards multi-select */}
            <div className="lg:col-span-2 xl:col-span-1">
              <label className="block text-[#000000] mb-1">بطاقة التموينية (اختر بطاقة أو أكثر - اضغط لإضافة)</label>
              <div className="bg-[#b8bcb2] p-2 border border-[#888888]">
                <div className="grid grid-cols-5 xl:grid-cols-3 gap-1">
                  {[
                    { count: 1, value: 48.5 },
                    { count: 2, value: 98.5 },
                    { count: 3, value: 148.5 },
                    { count: 4, value: 198.5 },
                    { count: 5, value: 223.5 },
                    { count: 6, value: 248.5 },
                    { count: 7, value: 273.5 },
                    { count: 8, value: 299.5 },
                    { count: 9, value: 323.5 },
                    { count: 10, value: 348.5 }
                  ].map(t => {
                    const occurrences = tamweenCards.filter(c => c === t.count);
                    const isSelected = occurrences.length > 0;
                    return (
                      <button
                        key={t.count}
                        type="button"
                        onClick={() => {
                          setTamweenCards([...tamweenCards, t.count].sort((a, b) => a - b));
                          addTamweenItemsToCart();
                        }}
                        className={`h-9 text-[10px] font-black cursor-pointer border rounded-lg transition-all relative ${isSelected ? "text-white shadow" : "bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border)]"}`}
                        style={isSelected ? {background: 'var(--warning)', borderColor: 'var(--warning)'} : {}}
                        title={isSelected ? `إضافة أخرى (${occurrences.length}×)` : "إضافة بطاقة"}
                      >
                        {isSelected && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              const idx = tamweenCards.indexOf(t.count);
                              if (idx > -1) setTamweenCards([...tamweenCards.slice(0, idx), ...tamweenCards.slice(idx + 1)]);
                            }}
                            className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-black leading-none hover:bg-red-700 z-10"
                            title="حذف واحدة"
                          >×</span>
                        )}
                        {t.count === 1 ? "فرد" : t.count === 2 ? "فردين" : `${t.count} أفراد`}
                        <br />
                        <span className="text-[9px]">{t.value} ج</span>
                        {occurrences.length > 1 && (
                          <span className="block text-[8px] mt-0.5 opacity-80">{occurrences.length}×</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* مربع فاضي — بطاقة بقيمة يدوية */}
                <div className="mt-1.5 flex items-center gap-1">
                  {!manualCardOpen ? (
                    <button
                      type="button"
                      onClick={() => { setManualCardOpen(true); setManualCardInput(""); }}
                      className="h-9 w-full text-[10px] font-black cursor-pointer rounded-lg border-2 border-dashed transition-all"
                      style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-subtle)" }}
                      title="اضغط ودخل قيمة البطاقة بنفسك"
                    >
                      ✏️ بطاقة بقيمة يدوية — اضغط لكتابة القيمة
                    </button>
                  ) : (
                    <>
                      <input
                        autoFocus
                        type="number"
                        step="0.01"
                        min="0"
                        value={manualCardInput}
                        onChange={(e) => setManualCardInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManualCard(); } if (e.key === "Escape") { setManualCardOpen(false); setManualCardInput(""); } }}
                        placeholder="أدخل قيمة البطاقة (ج.م)"
                        className="flex-1 h-9 px-2 text-[11px] font-black rounded-lg border-2 outline-none text-center font-mono"
                        style={{ background: "var(--bg-card)", borderColor: "var(--accent)", color: "var(--text-primary)" }}
                      />
                      <button
                        type="button"
                        onClick={addManualCard}
                        className="h-9 px-3 text-[10px] font-black text-white rounded-lg cursor-pointer"
                        style={{ background: "var(--accent)" }}
                      >إضافة</button>
                      <button
                        type="button"
                        onClick={() => { setManualCardOpen(false); setManualCardInput(""); }}
                        className="h-9 px-2 text-[10px] font-black rounded-lg cursor-pointer border"
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-card)" }}
                      >إلغاء</button>
                    </>
                  )}
                </div>
                {/* كروت يدوية مُضافة — قابلة للحذف */}
                {tamweenCards.some(isManualCard) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tamweenCards.map((c, idx) => isManualCard(c) ? (
                      <span
                        key={`m-${idx}-${c}`}
                        className="inline-flex items-center gap-1 h-6 px-2 text-[10px] font-black font-mono rounded-md border"
                        style={{ background: "var(--accent-subtle)", borderColor: "var(--accent)", color: "var(--accent)" }}
                      >
                        ✏️ {c} ج.م
                        <button
                          type="button"
                          onClick={() => setTamweenCards(tamweenCards.filter((_, i) => i !== idx))}
                          className="w-3.5 h-3.5 leading-none rounded-full text-white cursor-pointer"
                          style={{ background: "var(--danger)" }}
                          title="حذف البطاقة اليدوية"
                        >×</button>
                      </span>
                    ) : null)}
                  </div>
                )}
                <div className="mt-1 text-[10px] text-center font-bold" style={{ color: "var(--text-primary)" }}>
                  {tamweenCards.length > 0 ? (
                    <>✅ {(() => {
                      const counts: {[k: number]: number} = {};
                      const manualParts: string[] = [];
                      tamweenCards.forEach(c => {
                        if (isManualCard(c)) manualParts.push(`يدوي ${c} ج`);
                        else counts[c] = (counts[c] || 0) + 1;
                      });
                      const presetParts = Object.entries(counts).map(([c, n]) => `${n}× ${Number(c) === 1 ? "فرد" : Number(c) === 2 ? "فردين" : `${c} أفراد`}`);
                      return [...presetParts, ...manualParts].join(" + ");
                    })()} = <span style={{ color: "var(--danger)" }}>-{tamweenDiscount} ج.م</span></>
                  ) : (
                    "اضغط لتحديد بطاقة أو أكثر (يمكنك اختيار نفس البطاقة أكتر من مرة)"
                  )}
                </div>
              </div>
            </div>

            {/* تنبيه حي «ملئ الحقول» — يظهر لحظة اختيار الكارت من غير حفظ */}
            {(tamweenCards.length > 0 || Number(tamweenDiscount) > 0) && (() => {
              const missingFields: string[] = [];
              if (!customerName.trim()) missingFields.push("اسم العميل");
              if (!secretNumber.trim()) missingFields.push("الرقم السري");
              if (!(Number(bonus) > 0)) missingFields.push("الحافز");
              if (missingFields.length === 0) return null;
              return (
                <div className="cap-shake bg-[#fdecea] border-2 border-[#c0392b] p-2 flex items-start gap-1.5 text-[#9b1c1c] text-[11px] font-black">
                  <AlertTriangle size={14} strokeWidth={2} className="shrink-0 mt-0.5" />
                  <span>ملئ الحقول: ناقص {missingFields.join(" + ")} قبل الحفظ — (نقاط الخبز مش شرط)</span>
                </div>
              );
            })()}

            {/* Customer Name (اسم العميل) */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[#000000]">اسم العميل</label>
                <button
                  type="button"
                  onClick={() => setShowCustomerSearch(true)}
                  className="text-[10px] text-[#555555] font-bold hover:text-[#000000] underline cursor-pointer"
                >
                  🔍 بحث بالاسم أو الرقم السري
                </button>
              </div>
              <input
                ref={customerInputRef}
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onFocus={() => setShowNameDropdown(true)}
                onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); try { secretInputRef.current?.focus(); } catch {} } }}
                placeholder="اسم العميل..."
                className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
              />
              {showNameDropdown && nameSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-40 bg-white border border-[#888888] max-h-40 overflow-y-auto shadow-lg">
                  {nameSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCustomerName(c.name);
                        setSecretNumber(c.secret_number);
                        setShowNameDropdown(false);
                      }}
                      className="w-full text-right px-3 py-2 text-xs font-bold text-[#000000] hover:bg-[#b8bcb2] border-b border-[#888888]/30 cursor-pointer flex justify-between items-center"
                    >
                      <span>{c.name}</span>
                      <span className="text-[10px] text-[#555555] font-mono">{c.secret_number}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Secret Number (الرقم السري) */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[#000000]">الرقم السري</label>
              </div>
              <input
                ref={secretInputRef}
                type="text"
                value={secretNumber}
                onChange={(e) => setSecretNumber(e.target.value)}
                onFocus={() => setShowSecretDropdown(true)}
                onBlur={() => setTimeout(() => setShowSecretDropdown(false), 200)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); try { breadInputRef.current?.focus(); } catch {} } }}
                placeholder="أدخل الرقم السري..."
                className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
              />
              {showSecretDropdown && secretSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-40 bg-white border border-[#888888] max-h-40 overflow-y-auto shadow-lg">
                  {secretSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCustomerName(c.name);
                        setSecretNumber(c.secret_number);
                        setShowSecretDropdown(false);
                      }}
                      className="w-full text-right px-3 py-2 text-xs font-bold text-[#000000] hover:bg-[#b8bcb2] border-b border-[#888888]/30 cursor-pointer flex justify-between items-center"
                    >
                      <span className="font-mono">{c.secret_number}</span>
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bread Points (نقاط الخبز) - manual */}
            <div>
              <label className="block text-[#000000] mb-1">نقاط الخبز (يدوي - بالسالب)</label>
              <div className="flex items-center gap-2 bg-[#b8bcb2] p-1 border border-[#888888]">
                <input
                  ref={breadInputRef}
                  type="number"
                  step="0.01"
                  min="0"
                  value={breadPoints || ""}
                  onChange={(e) => setBreadPoints(Number(e.target.value) || 0)}
                  onWheel={(e) => e.currentTarget.blur()}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); try { bonusInputRef.current?.focus(); } catch {} } }}
                  className="flex-1 h-9 bg-[#c3c6bb] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] [appearance-none] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="0.00"
                />
                <span className="text-[10px] text-[#000000] font-bold">ج.م (-)</span>
              </div>
            </div>


            {/* Bonus (الحافز) - manual */}
            <div>
              <label className="block text-[#000000] mb-1">الحافز (يدوي - مثال: 5 ج.م)</label>
              <div className="flex items-center gap-2 bg-[#b8bcb2] p-1 border border-[#888888]">
                <input
                  ref={bonusInputRef}
                  type="number"
                  step="0.01"
                  min="0"
                  value={bonus || ""}
                  onChange={(e) => setBonus(Number(e.target.value) || 0)}
                  onWheel={(e) => e.currentTarget.blur()}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); try { barcodeInputRef.current?.focus(); } catch {} } }}
                  className="flex-1 h-9 bg-[#c3c6bb] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] [appearance-none] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="0.00"
                />
                <span className="text-[10px] text-[#000000] font-bold">ج.م (+)</span>
              </div>
            </div>

          </div>
        </div>

        {/* Col 3: ملخص الفاتورة والدفع (يسار) */}
        <div className="order-3 bg-[#c3c6bb] border border-[#222222] p-4 space-y-4 overflow-y-auto min-h-0">
          <h3 className="text-sm font-extrabold text-[#000000] border-b border-[#888888] pb-2">
            ملخص الفاتورة والدفع
          </h3>

          <div className="space-y-3 text-xs font-bold text-[#000000]">

            {/* Totals Breakdown - lux glass */}
            <div className="lux-glass p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-[#555555]">المجموع الفرعي:</span>
                <span>{(subtotal || 0).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555555]">الضريبة ({taxRate}%):</span>
                <span>{(taxAmount || 0).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#888888]">
                <span>الخصم (ج.م):</span>
                <input
                  ref={discountInputRef}
                  type="number"
                  step="0.01"
                  value={discount || ""}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-20 h-7 bg-[#c3c6bb] border border-[#888888] text-center text-xs font-bold text-[#000000] focus:outline-none"
                  placeholder="0.00"
                />
              </div>
              {tamweenCards.length > 0 && (
                <>
                  {tamweenCards.map((c, idx) => (
                    <div key={`${c}-${idx}`} className="flex justify-between text-[#b91c1c]">
                      <span>بطاقة تموين {isManualCard(c) ? "(يدوية)" : `(${c === 1 ? "فرد" : c === 2 ? "فردين" : `${c} أفراد`})`}:</span>
                      <span className="font-bold">- {cardValueOf(c).toFixed(2)} ج.م</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-[#b91c1c] border-t border-[#888888] pt-1 font-bold">
                    <span>إجمالي بطاقات التموين:</span>
                    <span>- {tamweenDiscount.toFixed(2)} ج.م</span>
                  </div>
                </>
              )}
              {breadPoints > 0 && (
                <div className="flex justify-between text-[#b91c1c]">
                  <span>نقاط الخبز:</span>
                  <span className="font-bold">- {breadPoints.toFixed(2)} ج.م</span>
                </div>
              )}
              {(tamweenDiscount + breadPoints) > 0 && (
                <div className="flex justify-between text-[#b91c1c] border-t border-[#888888] pt-1 font-black">
                  <span>إجمالي الدعم ونقاط الخبز:</span>
                  <span>- {(tamweenDiscount + breadPoints).toFixed(2)} ج.م</span>
                </div>
              )}
              {bonus > 0 && (
                <div className="flex justify-between text-[#15803d]">
                  <span>الحافز:</span>
                  <span className="font-bold">+ {bonus.toFixed(2)} ج.م</span>
                </div>
              )}
            </div>

            {/* Final Total Display - theme-aware */}
            <div className="p-[1px] rounded-xl" style={{background: 'var(--success)'}}>
              <div className="p-3 flex justify-between items-center font-black text-sm rounded-xl text-white" style={{background: 'var(--success)'}}>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white"></span>الإجمالي النهائي:</span>
                <span className="text-xl font-mono">{(total || 0).toFixed(2)} <span className="text-xs opacity-90">ج.م</span></span>
              </div>
            </div>

            {/* بيع آجل — المدفوع الآن + المتبقي على الحساب */}
            {paymentMethod === "credit" && (
              <div className="rounded-xl border-2 p-3 space-y-2" style={{ background: "var(--bg-card)", borderColor: "var(--border-strong)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#000000]">💸 حساب الآجل — المدفوع الآن</span>
                  <span className="text-[11px] font-bold font-mono text-[#555555]">الإجمالي: {total.toFixed(2)} ج.م</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="number"
                    min={0}
                    max={total}
                    step={0.5}
                    value={paid}
                    onChange={(e) => setPaid(Math.min(total, Math.max(0, Number(e.target.value) || 0)))}
                    className="flex-1 min-w-[120px] h-9 px-3 border rounded-lg text-sm font-black font-mono"
                    style={{ background: "var(--bg-input)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }}
                    placeholder="0"
                  />
                  <div className="flex gap-1">
                    {[0, 50, 100, 200].map((v) => (
                      <button key={v} type="button" onClick={() => setPaid(Math.min(total, v))}
                        className="h-8 px-2 text-[11px] font-black rounded-md cursor-pointer border"
                        style={{ background: "var(--bg-input)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }}>{v}</button>
                    ))}
                    <button type="button" onClick={() => setPaid(total)}
                      className="h-8 px-2 text-[11px] font-black rounded-md cursor-pointer border"
                      style={{ background: "#047857", borderColor: "#065F46", color: "#ffffff" }}>كامل</button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs font-black">
                  <span className="text-[#555555]">المتبقي على الحساب:</span>
                  <span className="font-mono text-lg text-[#000000]">{Math.max(0, total - paid).toFixed(2)} ج.م</span>
                </div>
              </div>
            )}

            {/* Withdrawal Choice - replaces المدفوع والباقي */}
            <div>
              <label className="block text-[#000000] mb-1 font-black text-[11px]">اختيار الصرف</label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setWithdrawalChoice("now")}
                  className={`h-9 text-xs font-black rounded-lg cursor-pointer transition-all ${withdrawalChoice === "now" ? "text-white shadow" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                  style={withdrawalChoice === "now" ? {background: '#27ae60'} : {}}
                >💰 صرف الآن</button>
                <button
                  type="button"
                  onClick={() => setWithdrawalChoice("later")}
                  className={`h-9 text-xs font-black rounded-lg cursor-pointer transition-all ${withdrawalChoice === "later" ? "text-white shadow" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                  style={withdrawalChoice === "later" ? {background: '#f39c12'} : {}}
                >⏳ صرف في وقت لاحق</button>
              </div>
            </div>

            {withdrawalChoice === "later" ? (
              <button
                type="button"
                onClick={async () => {
                  if (!customerName.trim() || !secretNumber.trim()) {
                    setError("ادخل اسم العميل والرقم السري أولاً.");
                    return;
                  }
                  if (tamweenCards.length === 0) {
                    setError("للحفظ كـ صرف لاحق لازم تختار كارت قيمة التموين أولاً.");
                    return;
                  }
                  try {
                    const existingRes = await authFetch(`/api/tamween-customers/by-secret/${encodeURIComponent(secretNumber)}`);
                    const existing = await existingRes.json();
                    let customerId = existing?.id;
                    // Full snapshot of the sale page to restore it exactly on "صرف الآن"
                    const pending_sale = {
                      cart: [...cart],
                      customerName: customerName.trim(),
                      secretNumber: secretNumber.trim(),
                      saleType,
                      paymentMethod,
                      paymentSource,
                      discount,
                      tamweenCards: [...tamweenCards],
                      breadPoints,
                      bonus,
                      paid,
                    };
                    if (!existing) {
                      const newRes = await authFetch("/api/tamween-customers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: customerName.trim(),
                          secret_number: secretNumber.trim(),
                          phone: "",
                          card_value: tamweenDiscount || 0,
                          bread_points: breadPoints || 0,
                          pending_sale,
                        }),
                      });
                      const newData = await newRes.json();
                      customerId = newData.customer?.id;
                    } else {
                      // Update existing customer's card_value — pending snapshot always carries the record identity
                      await authFetch(`/api/tamween-customers/${customerId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: existing.name,
                          secret_number: existing.secret_number,
                          phone: existing.phone || "",
                          card_value: tamweenDiscount || 0,
                          bread_points: breadPoints || 0,
                          pending_sale: { ...pending_sale, customerName: existing.name, secretNumber: existing.secret_number },
                        }),
                      });
                    }
                    if (customerId) {
                      await authFetch(`/api/tamween-customers/${customerId}/activate`, { method: "POST" });
                      // رسالة داخل الصفحة بدل alert — الـ alert بيسرق فوكس النافذة ويجمد الحقول
                      setError("");
                      setSuccess("تم حفظ البطاقة — صرف في وقت لاحق.");
                      setCustomerName("");
                      setSecretNumber("");
                      setCart([]);
                      setDiscount(0);
                      setTamweenCards([]); setManualCardOpen(false); setManualCardInput("");
                      setBreadPoints(0);
                      setBonus(0);
                      setPaid(0);
                      setWithdrawalChoice("now");
                      generateInvoiceProps();
                      // Remove current tab and clear active cart from DB
                      setHeldInvoices(prev => {
                        const updated = prev.filter((_, idx) => idx !== activeTabIndex);
                        if (updated.length === 0) {
                          authFetch("/api/held-invoices", { method: "DELETE" }).catch(() => {});
                        }
                        return updated;
                      });
                      setActiveTabIndex(0);
                      authFetch("/api/active-cart", { method: "DELETE" }).catch(() => {});
                      try { window.focus(); } catch {}
                      try { if (barcodeInputRef.current) barcodeInputRef.current.focus(); } catch {}
                    }
                  } catch {
                    setError("خطأ في الاتصال بالخادم.");
                  }
                }}
                className="w-full h-11 bg-[#f39c12] hover:bg-[#e67e22] text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Wallet size={16} strokeWidth={2} />
                <span>💾 حفظ البطاقة فقط (بدون منتجات)</span>
              </button>
            ) : (
              <button
                onClick={handleSubmitInvoice}
                disabled={loading}
                title={total <= 0 && cart.length > 0 ? "الإجمالي النهائي يجب أن يكون بالموجب — راجع الدعم والخصومات" : ""}
                className="w-full h-11 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 shadow-lg"
                style={{background: 'var(--success)', boxShadow: '0 4px 16px var(--accent-glow)'}}
              >
                <Wallet size={16} strokeWidth={2} />
                <span>{loading ? "جاري الحفظ..." : total <= 0 && cart.length > 0 ? "الإجمالي غير موجب — لا يمكن الحفظ" : "حفظ وتأكيد الفاتورة"}</span>
              </button>
            )}

          </div>
        </div>

      </div>

      {/* Invoice History Modal */}
      {showInvoiceHistory && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50">
          <div className="bg-[#c3c6bb] border border-[#222222] p-4 w-full max-w-2xl relative space-y-4 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowInvoiceHistory(false)}
              className="absolute top-3 left-3 w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] cursor-pointer"
            >
              <X size={14} />
            </button>
            <h3 className="text-sm font-black text-[#000000] border-b border-[#888888] pb-2">
              سجل الفواتير السابقة
            </h3>
            <div className="overflow-y-auto flex-1 bg-white border border-[#888888]">
              {historyLoading ? (
                <div className="p-8 text-center text-[#555555] font-bold">جاري تحميل الفواتير...</div>
              ) : historyInvoices.length > 0 ? (
                <table className="w-full text-sm text-center border-collapse">
                  <thead>
                    <tr className="bg-[#222222] text-[#c3c6bb]">
                      <th className="py-2 px-3">رقم الفاتورة</th>
                      <th className="py-2 px-3">العميل</th>
                      <th className="py-2 px-3">التاريخ</th>
                      <th className="py-2 px-3">الإجمالي</th>
                      <th className="py-2 px-3">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#888888]/40">
                    {historyInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#b8bcb2] transition-colors text-black font-bold">
                        <td className="py-2 px-3 font-mono">{inv.invoice_number}</td>
                        <td className="py-2 px-3">{inv.customer_supplier_name || "عميل نقدي"}</td>
                        <td className="py-2 px-3 font-mono">{inv.date}</td>
                        <td className="py-2 px-3 font-mono">{(inv.total || 0).toFixed(2)} ج.م</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => handleReprintInvoice(inv.id)}
                            className="bg-[#222222] text-[#c3c6bb] hover:bg-[#000000] px-3 py-1 font-bold text-xs flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <Printer size={12} /> طباعة
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-[#555555] font-bold">لا توجد فواتير سابقة.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Thermal Print Modal */}
      {showPrintModal && printData && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50">
          <div className="bg-[#c3c6bb] border border-[#222222] p-4 w-full max-w-sm relative space-y-3">
            <button
              id="btn-close-print-modal"
              onClick={() => {
                setShowPrintModal(false);
                setPrintData(null);
              }}
              className="absolute top-3 left-3 w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] cursor-pointer"
            >
              <X size={14} />
            </button>

            <h3 className="text-xs font-black text-[#000000] text-center border-b border-[#888888] pb-2">
              فاتورة مبيعات مبسطة
            </h3>

            <div
              id="thermal-receipt-printable-area"
              className="printable-receipt"
              style={{
                direction: "rtl",
                width: "302px",
                minWidth: "302px",
                maxWidth: "302px",
                boxSizing: "border-box",
                backgroundColor: "var(--bg-card)",
                color: "var(--text-primary)",
                padding: "8px 8px",
                margin: "0 auto",
                fontFamily: "Arial, Tahoma, sans-serif",
                fontSize: "11px",
                border: "1px solid #000000",
                lineHeight: "1.4",
                overflow: "hidden",
                wordWrap: "break-word"
              }}
            >
              {/* Receipt Header */}
              <div style={{ textAlign: "center", marginBottom: "6px" }}>
                <div style={{ fontSize: "14px", fontWeight: "900", margin: "0 0 2px 0", color: "var(--text-primary)" }}>
                  {printData.marketName || "منظومة الكابتن"}
                </div>
                {printData.marketPhone && (
                  <div style={{ fontSize: "9px", margin: "0", color: "var(--text-secondary)" }}>
                    ☎ {printData.marketPhone}
                  </div>
                )}
                <div style={{ margin: "6px 0", padding: "3px 0", borderTop: "1.5px solid #000000", borderBottom: "1.5px solid #000000", fontWeight: "900", fontSize: "10px", letterSpacing: "1px" }}>
                  ═══ إيصال مبيعات ═══
                </div>
              </div>

              {/* Receipt Meta Details */}
              <div style={{ fontSize: "10px", fontWeight: "bold", borderBottom: "1px dashed #000000", paddingBottom: "4px", marginBottom: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>رقم الفاتورة:</span>
                  <span style={{ fontFamily: "monospace" }}>{printData.invoice_number}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                  <span>التاريخ:</span>
                  <span>{printData.arabicDateStr || printData.date}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                  <span>العميل:</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{printData.customer_name || "عميل نقدي"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                  <span>الكاشير:</span>
                  <span>{printData.cashier || "النظام"}</span>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "8px", tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #000000", fontWeight: "900" }}>
                    <th style={{ textAlign: "right", paddingBottom: "4px" }}>الصنف</th>
                    <th style={{ textAlign: "center", paddingBottom: "4px", width: "26px" }}>ك</th>
                    <th style={{ textAlign: "center", paddingBottom: "4px", width: "38px" }}>السعر</th>
                    <th style={{ textAlign: "left", paddingBottom: "4px", width: "48px" }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.items.map((it: any, index: number) => (
                    <tr key={index} style={{ borderBottom: "1px dashed #dddddd" }}>
                      <td style={{ textAlign: "right", padding: "3px 0", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {it.name}
                      </td>
                      <td style={{ textAlign: "center", padding: "3px 0", fontFamily: "monospace" }}>
                        {it.quantity}
                      </td>
                      <td style={{ textAlign: "center", padding: "3px 0", fontFamily: "monospace" }}>
                        {(it.price || 0).toFixed(1)}
                      </td>
                      <td style={{ textAlign: "left", padding: "3px 0", fontWeight: "bold", fontFamily: "monospace" }}>
                        {(it.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary — الترتيب المعتمد: الفرعي أولاً ثم البنود ثم المجمع ثم الحافز */}
              <div style={{ borderTop: "1.5px solid #000000", paddingTop: "6px", fontSize: "11px", fontWeight: "bold", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                  <span>المجموع الفرعي:</span>
                  <span style={{ fontFamily: "monospace" }}>{(printData.subtotal || 0).toFixed(2)} ج.م</span>
                </div>

                {printData.tax > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span>الضريبة:</span>
                    <span style={{ fontFamily: "monospace" }}>{(printData.tax || 0).toFixed(2)} ج.م</span>
                  </div>
                )}

                {printData.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span>الخصم:</span>
                    <span style={{ fontFamily: "monospace" }}>-{(printData.discount || 0).toFixed(2)} ج.م</span>
                  </div>
                )}

                {printData.tamweenDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span>خصم البطاقة التموينية:</span>
                    <span style={{ fontFamily: "monospace" }}>-{(printData.tamweenDiscount || 0).toFixed(2)} ج.م</span>
                  </div>
                )}

                {printData.breadPoints > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span>نقاط الخبز:</span>
                    <span style={{ fontFamily: "monospace" }}>-{(printData.breadPoints || 0).toFixed(2)} ج.م</span>
                  </div>
                )}

                {((printData.tamweenDiscount || 0) + (printData.breadPoints || 0)) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px", borderTop: "1px dashed #000000", paddingTop: "2px" }}>
                    <span>إجمالي الدعم ونقاط الخبز:</span>
                    <span style={{ fontFamily: "monospace" }}>-{((printData.tamweenDiscount || 0) + (printData.breadPoints || 0)).toFixed(2)} ج.م</span>
                  </div>
                )}

                {printData.bonus > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span>الحافز:</span>
                    <span style={{ fontFamily: "monospace" }}>+{(printData.bonus || 0).toFixed(2)} ج.م</span>
                  </div>
                )}

                <div className="pos-total-bar" style={{
                  display: "flex",
                  justifyContent: "space-between",
                  backgroundColor: "var(--accent)",
                  color: "var(--on-accent)",
                  padding: "6px 8px",
                  fontWeight: "900",
                  fontSize: "15px",
                  marginTop: "6px",
                  letterSpacing: "0"
                }}>
                  <span>═══ الإجمالي النهائي ═══</span>
                  <span style={{ fontFamily: "monospace", fontSize: "16px" }}>{(printData.total || 0).toFixed(2)} ج.م</span>
                </div>
              </div>

              {/* Footer — ثابت: 3 سطور فقط ولا شيء بعدهما */}
              <div style={{ textAlign: "center", marginTop: "8px", paddingTop: "6px", borderTop: "1.5px dashed #000000", fontWeight: "bold", color: "var(--text-primary)" }}>
                <p style={{ margin: "0 0 3px 0", fontSize: "10px", fontWeight: "900" }}>شكراً لتسوقكم معنا</p>
                <p style={{ margin: "0 0 2px 0", fontSize: "10px", fontWeight: "900" }}>منظومة الكابتن (لهندسة الأرقام وريادة الأعمال)</p>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: "900", fontFamily: "monospace" }}>هاتف: {printData.marketPhone || marketPhone || "01099887766"}</p>
              </div>
            </div>


            <div className="w-full flex justify-center no-print">
              <UnifiedPrintButton printableId="thermal-receipt-printable-area" thermalId="thermal-receipt-printable-area" title="طباعة الفاتورة" variant="primary" />
            </div>
          </div>
        </div>
      )}

      {/* Customer Search Modal (بحث عملاء التموين) */}
      {showCustomerSearch && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50">
          <div className="bg-[#c3c6bb] border border-[#222222] p-4 w-full max-w-lg relative space-y-4 max-h-[85vh] flex flex-col">
            <button
              onClick={() => { setShowCustomerSearch(false); setCustomerSearchQuery(""); setCustomerSearchResults([]); setShowNewCustomerForm(false); }}
              className="absolute top-3 left-3 w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] cursor-pointer"
            >
              <X size={14} />
            </button>
            <h3 className="text-sm font-black text-[#000000] border-b border-[#888888] pb-2">
              {showNewCustomerForm ? "تسجيل عميل جديد" : "بحث في عملاء التموين"}
            </h3>

            {!showNewCustomerForm ? (
              <>
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو الرقم السري أو التليفون..."
                  autoFocus
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                />

                <div className="overflow-y-auto flex-1 bg-white border border-[#888888]">
                  {customerSearchResults.length > 0 ? (
                    <div className="divide-y divide-[#888888]/40">
                      {customerSearchResults.map((c) => {
                        const currentMonth = new Date().toISOString().slice(0, 7);
                        const isActive = c.status_month === currentMonth;
                        const isWithdrawn = isActive && c.status === "withdrawn";
                        const isLater = isActive && c.status === "later";

                        // Convert card_value back to tamweenCards indices
                        const tamweenValues = [0, 48.5, 98.5, 148.5, 198.5, 223.5, 248.5, 273.5, 299.5, 323.5, 348.5];
                        const cardValue = c.card_value || 0;
                        const selectedCards: number[] = [];
                        let remainingValue = cardValue;
                        for (let i = tamweenValues.length - 1; i >= 1; i--) {
                          while (remainingValue >= tamweenValues[i] && selectedCards.length < 10) {
                            selectedCards.push(i);
                            remainingValue -= tamweenValues[i];
                          }
                        }
                        // أي فاضل مش مكوّن من الكروت الجاهزة → بطاقة يدوية عشان المجموع يظبط بالظبط
                        if (remainingValue > 0.01) {
                          selectedCards.push(Math.round(remainingValue * 100) / 100);
                        }

                        return (
                          <div key={c.id} className="p-3 text-black font-bold text-xs space-y-2">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-extrabold text-sm">{c.name}</p>
                                <p className="text-[10px] text-[#555555] font-mono">الرقم السري: {c.secret_number} | التليفون: {c.phone || "غير مسجل"}</p>
                                <p className="text-[10px] text-[#555555]">مبلغ البطاقة: {c.card_value} ج.م | نقاط الخبز: {c.bread_points} ج.م</p>
                              </div>
                              <div className="text-left">
                                {isWithdrawn ? (
                                  <span className="inline-flex items-center gap-1 bg-[#e74c3c] text-white px-2 py-1 text-[10px] font-black rounded">
                                    🚫 تم الصرف من قبل
                                  </span>
                                ) : isLater ? (
                                  <span className="inline-flex items-center gap-1 bg-[#f39c12] text-white px-2 py-1 text-[10px] font-black rounded">
                                    ⏳ صرف في وقت لاحق
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-[#27ae60] text-white px-2 py-1 text-[10px] font-black rounded">
                                    ✅ جديد
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-1">
                              {isWithdrawn ? (
                                <div className="w-full text-center py-2 bg-[#e74c3c]/10 border border-[#e74c3c]/30 text-[#e74c3c] text-[11px] font-black rounded">
                                  ⚠️ تم صرف هذه البطاقة هذا الشهر - ممنوع الصرف المكرر
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={async () => {
                                      // Withdraw now
                                      const res = await authFetch(`/api/tamween-customers/${c.id}/withdraw-now`, { method: "POST" });
                                      if (res.ok) {
                                        setCustomerName(c.name);
                                        setSecretNumber(c.secret_number);
                                        setBreadPoints(c.bread_points);
                                        setTamweenCards(selectedCards);
                                        setShowCustomerSearch(false);
                                        setCustomerSearchQuery("");
                                        setCustomerSearchResults([]);
                                      } else {
                                        const err = await res.json();
                                        setError(err.error || "تعذر الصرف.");
                                      }
                                    }}
                                    className="flex-1 py-1.5 bg-[#27ae60] hover:bg-[#219a52] text-white font-black text-[10px] cursor-pointer rounded"
                                  >
                                    💰 صرف الآن
                                  </button>
                                  <button
                                    onClick={async () => {
                                      // Activate for later
                                      const res = await authFetch(`/api/tamween-customers/${c.id}/activate`, { method: "POST" });
                                      if (res.ok) {
                                        setCustomerName(c.name);
                                        setSecretNumber(c.secret_number);
                                        setBreadPoints(c.bread_points);
                                        setTamweenCards(selectedCards);
                                        setShowCustomerSearch(false);
                                        setCustomerSearchQuery("");
                                        setCustomerSearchResults([]);
                                      } else {
                                        const err = await res.json();
                                        setError(err.error || "تعذر الحفظ للاحق.");
                                      }
                                    }}
                                    className="flex-1 py-1.5 bg-[#f39c12] hover:bg-[#e67e22] text-white font-black text-[10px] cursor-pointer rounded"
                                  >
                                    ⏳ صرف في وقت لاحق
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-[#555555] font-bold space-y-3">
                      {customerSearchQuery ? (
                        <>
                          <p>لا توجد نتائج مطابقة</p>
                          <button
                            onClick={() => {
                              setShowNewCustomerForm(true);
                              setNewCustomerSecret(customerSearchQuery);
                            }}
                            className="px-4 py-2 bg-[#27ae60] hover:bg-[#219a52] text-white font-black text-xs cursor-pointer rounded"
                          >
                            + تسجيل عميل جديد بالرقم السري: {customerSearchQuery}
                          </button>
                        </>
                      ) : (
                        <p>ابحث عن عميل بالاسم أو الرقم السري</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* New Customer Registration Form */
              <div className="space-y-3 overflow-y-auto flex-1">
                <div>
                  <label className="block text-[#000000] mb-1 text-xs font-bold">اسم العميل *</label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="أدخل اسم العميل..."
                    className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#000000] mb-1 text-xs font-bold">الرقم السري *</label>
                    <input
                      type="text"
                      value={newCustomerSecret}
                      onChange={(e) => setNewCustomerSecret(e.target.value)}
                      placeholder="أدخل الرقم السري..."
                      className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#000000] mb-1 text-xs font-bold">رقم التليفون</label>
                    <input
                      type="text"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#000000] mb-1 text-xs font-bold">مبلغ البطاقة (ج.م)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newCustomerCardValue || ""}
                      onChange={(e) => setNewCustomerCardValue(Number(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#000000] mb-1 text-xs font-bold">نقاط الخبز (ج.م)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newCustomerBreadPoints || ""}
                      onChange={(e) => setNewCustomerBreadPoints(Number(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!newCustomerName.trim() || !newCustomerSecret.trim()) {
                        setError("اسم العميل والرقم السري مطلوبين.");
                        return;
                      }
                      const res = await authFetch("/api/tamween-customers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: newCustomerName.trim(),
                          secret_number: newCustomerSecret.trim(),
                          phone: newCustomerPhone.trim(),
                          card_value: newCustomerCardValue,
                          bread_points: newCustomerBreadPoints,
                        }),
                      });
                      const result = await res.json();
                      if (res.ok && result.success) {
                        setCustomerName(result.customer.name);
                        setSecretNumber(result.customer.secret_number);
                        setBreadPoints(result.customer.bread_points);
                        setShowCustomerSearch(false);
                        setCustomerSearchQuery("");
                        setCustomerSearchResults([]);
                        setShowNewCustomerForm(false);
                        setNewCustomerName("");
                        setNewCustomerSecret("");
                        setNewCustomerPhone("");
                        setNewCustomerCardValue(0);
                        setNewCustomerBreadPoints(0);
                      } else {
                        setError(result.error || "حدث خطأ أثناء التسجيل.");
                      }
                    }}
                    className="flex-1 py-2 bg-[#27ae60] hover:bg-[#219a52] text-white font-black text-xs cursor-pointer rounded"
                  >
                    💾 تسجيل وتفعيل
                  </button>
                  <button
                    onClick={() => { setShowNewCustomerForm(false); }}
                    className="flex-1 py-2 bg-[#888888] hover:bg-[#666666] text-white font-black text-xs cursor-pointer rounded"
                  >
                    رجوع للبحث
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
