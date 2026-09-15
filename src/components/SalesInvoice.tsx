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
} from "lucide-react";
import { Item, InvoiceItem, User as LoggedUser } from "../types";
import { authFetch } from "../authFetch";
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
  const [breadPoints, setBreadPoints] = useState(0);
  // Autocomplete for customer name/secret
  const [nameSuggestions, setNameSuggestions] = useState<any[]>([]);
  const [secretSuggestions, setSecretSuggestions] = useState<any[]>([]);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showSecretDropdown, setShowSecretDropdown] = useState(false);
  const [withdrawalChoice, setWithdrawalChoice] = useState<"now" | "later">("now");
  // الحافز (Bonus) - manual input (بالموجب)
  const [bonus, setBonus] = useState(0);

  // Registered tamween cards (بطاقات تموين مسجلة)
  interface RegisteredCard {
    id: number;
    card_number: string;
    secret_number: string;
    family_count: number;
    value: number;
    holder_name: string;
  }
  const [registeredCards, setRegisteredCards] = useState<RegisteredCard[]>([]);
  const [showForgotSecret, setShowForgotSecret] = useState(false);
  const [cardSearchQuery, setCardSearchQuery] = useState("");

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

  useEffect(() => {
    authFetch("/api/tamween-cards")
      .then(r => r.json())
      .then(data => setRegisteredCards(data))
      .catch(() => {});
  }, []);

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
    saleType: "retail" | "wholesale";
    paymentMethod: "cash" | "instapay" | "visa" | "vodafone";
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
  const [nextTabId, setNextTabId] = useState(2);

  // Load held invoices from database on mount
  useEffect(() => {
    authFetch("/api/held-invoices")
      .then(r => r.json())
      .then((rows: any[]) => {
        if (rows.length > 0) {
          const loaded = rows.map((r: any) => ({
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
  }, []);

  // Save held invoices to database whenever they change
  useEffect(() => {
    if (heldInvoices.length === 0) return;
    const toSave = heldInvoices.map((inv, idx) => ({
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

  // Pre-fill customer data from TamweenCustomers "صرف الآن"
  useEffect(() => {
    if (tamweenCustomer) {
      setCustomerName(tamweenCustomer.name || "");
      setSecretNumber(tamweenCustomer.secret_number || "");
      if (tamweenCustomer.card_value > 0) {
        setTamweenCards([tamweenCustomer.card_value]);
      }
      if (tamweenCustomer.bread_points > 0) {
        setBreadPoints(tamweenCustomer.bread_points);
      }
      if (onClearTamweenCustomer) onClearTamweenCustomer();
    }
  }, [tamweenCustomer]);

  // Local Persistent Settings
  const [marketName, setMarketName] = useState(() => localStorage.getItem("supermarket_market_name") || "منظومة الكابتن");
  const [marketPhone, setMarketPhone] = useState(() => localStorage.getItem("supermarket_market_phone") || "01099887766");
  const [taxRate, setTaxRate] = useState(() => Number(localStorage.getItem("supermarket_tax_rate") ?? "14"));
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "instapay" | "visa" | "vodafone">("cash");

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

  const handleSubmitInvoiceRef = useRef<any>(null);
  const clearCartRef = useRef<any>(null);

  const saveCurrentToHeld = () => {
    setHeldInvoices(prev => {
      const updated = [...prev];
      updated[activeTabIndex] = {
        id: Date.now(),
        label: `فاتورة ${activeTabIndex + 1}`,
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
        invoiceNumber,
        date,
      };
      return updated;
    });
  };

  const loadFromHeld = (index: number) => {
    if (index === activeTabIndex) return;
    let targetInv: HeldInvoice | null = null;
    setHeldInvoices(prev => {
      let updated = [...prev];
      // Save current tab first if needed
      if ((cart.length > 0 || updated.length <= activeTabIndex) && activeTabIndex < updated.length) {
        updated[activeTabIndex] = {
          id: Date.now(),
          label: `فاتورة ${activeTabIndex + 1}`,
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
          invoiceNumber,
          date,
        };
      }
      // Load target tab
      targetInv = updated[index] || null;
      return updated;
    });
    if (targetInv) {
      setCart(targetInv.cart);
      setCustomerName(targetInv.customerName);
      setSecretNumber(targetInv.secretNumber);
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
    }
    setActiveTabIndex(index);
    setWithdrawalChoice("now");
  };

  const handleHoldInvoice = () => {
    if (cart.length === 0) return;
    setHeldInvoices(prev => {
      let updated = [...prev];
      if (activeTabIndex < updated.length) {
        updated[activeTabIndex] = {
          id: Date.now(),
          label: `فاتورة ${activeTabIndex + 1}`,
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
          invoiceNumber,
          date,
        };
      }
      const newInv: HeldInvoice = {
        id: Date.now(),
        label: `فاتورة ${updated.length + 1}`,
        cart: [],
        customerName: "عميل نقدي افتراضي",
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
    // Clear current after state update
    setActiveTabIndex(heldInvoices.length);
    setCart([]);
    setCustomerName("");
    setSecretNumber(""); setWithdrawalChoice("");
    setDiscount(0);
    setTamweenCards([]);
    setBreadPoints(0);
    setBonus(0);
    setPaid(0);
    generateInvoiceProps();
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };
  const handleHoldInvoiceRef = useRef<any>(null);

  const addNewTab = () => {
    let newIndex: number;
    setHeldInvoices(prev => {
      let updated = [...prev];
      // Save current tab if it has items
      if (cart.length > 0 && activeTabIndex < updated.length) {
        updated[activeTabIndex] = {
          id: Date.now(),
          label: `فاتورة ${activeTabIndex + 1}`,
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
          invoiceNumber,
          date,
        };
      }
      // Add new empty tab
      const newInv: HeldInvoice = {
        id: Date.now(),
        label: `فاتورة ${updated.length + 1}`,
        cart: [],
        customerName: "عميل نقدي افتراضي",
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
      newIndex = updated.length - 1;
      return updated;
    });
    setActiveTabIndex(newIndex!);
    setCart([]);
    setCustomerName("");
    setSecretNumber(""); setWithdrawalChoice("");
    setDiscount(0);
    setTamweenCards([]);
    setBreadPoints(0);
    setBonus(0);
    setPaid(0);
    generateInvoiceProps();
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  const closeTab = (index: number) => {
    let switchIndex = -1;
    setHeldInvoices(prev => {
      if (prev.length === 0) return prev;
      const newHeld = prev.filter((_, i) => i !== index);
      if (activeTabIndex === index) {
        switchIndex = Math.min(index, newHeld.length - 1);
      }
      return newHeld;
    });
    if (switchIndex >= 0) {
      loadFromHeld(switchIndex);
    } else if (switchIndex === -1 && cart.length > 0) {
      // Keep cart
    } else {
      clearCart();
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
    const existingIndex = cart.findIndex((i) => i.barcode === product.barcode);
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

  const updateCartQty = (barcode: string, qtyStr: string) => {
    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty <= 0) return;

    const item = cart.find((i) => i.barcode === barcode);
    if (item && item.is_unlimited !== 1 && (item.stock_quantity ?? 0) > 0 && qty > item.stock_quantity!) {
      setError(`الكمية (${qty}) تتجاوز المتاح في المخزون (${item.stock_quantity}).`);
      return;
    }

    const updated = cart.map((item) => {
      if (item.barcode === barcode) {
        return {
          ...item,
          quantity: qty,
          total: qty * item.price
        };
      }
      return item;
    });
    setCart(updated);
  };



  const removeFromCart = (barcode: string) => {
    setCart(cart.filter((i) => i.barcode !== barcode));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setTamweenCards([]);
    setBreadPoints(0);
    setBonus(0);
    setSecretNumber(""); setWithdrawalChoice("");

    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const subtotal = cart.reduce((add, item) => add + item.total, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  // Tamween card values (multi-select) - sum of all selected cards
  const tamweenValues = [0, 48, 98, 148, 198, 223, 248, 273, 299, 323, 348];
  const tamweenDiscount = tamweenCards.reduce((sum, count) => sum + (tamweenValues[count] || 0), 0);
  // Total = subtotal + tax - discount - tamween (sum) - breadPoints + bonus
  const total = Math.max(0, subtotal + taxAmount - discount - tamweenDiscount - breadPoints + bonus);
  const remaining = paid > total ? paid - total : total - paid;

  useEffect(() => {
    setPaid(total);
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


  const handleSubmitInvoice = async () => {
    setError("");
    setSuccess("");

    if (cart.length === 0) {
      setError("الرجاء إضافة صنف واحد على الأقل للفاتورة.");
      return;
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
      paid: total,
      remaining: 0,
      items: cart,
      created_by: currentUser?.name || "الكاشير",
      payment_method: paymentMethod
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
                }),
              });
            }
            if (customerId && withdrawalChoice) {
              const endpoint = withdrawalChoice === "now" ? "withdraw-now" : "activate";
              await authFetch(`/api/tamween-customers/${customerId}/${endpoint}`, { method: "POST" });
            }
          } catch {}
        }

        setCart([]);
        setDiscount(0);
        setTamweenCards([]);
        setBreadPoints(0);
        setBonus(0);
        setSecretNumber(""); setWithdrawalChoice("");
    
        generateInvoiceProps();

        // Clear all held invoices from database after successful save
        try {
          await authFetch("/api/held-invoices", { method: "DELETE" });
          setHeldInvoices([]);
          setActiveTabIndex(0);
          setNextTabId(2);
        } catch {}
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

  const handleManualPrint = async () => {
    await saveReceiptAsImage();
  };

  return (
    <div className="w-full space-y-6 select-none font-sans" id="printable-sales" style={{ direction: "rtl" }}>
      
      {/* Top Header */}
      <div className="bg-[#c3c6bb] p-4 border border-[#222222] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#000000] flex items-center gap-2">
            <Monitor size={20} strokeWidth={1.5} />
            <span>نقطة البيع والتحصيل</span>
          </h2>
          <p className="text-xs text-[#555555] font-semibold mt-1">
            رقم الفاتورة: <span className="font-mono text-[#000000] font-bold">{invoiceNumber}</span> | الكاشير: {currentUser?.name || "الكاشير"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadInvoiceHistory}
            className="h-9 px-3 flex items-center justify-center gap-1.5 bg-[#b8bcb2] hover:bg-[#888888] text-[#000000] font-bold text-xs border border-[#888888] transition-colors cursor-pointer"
          >
            <Search size={14} />
            <span>سجل الفواتير</span>
          </button>
          <div className="bg-[#222222] text-[#c3c6bb] px-3 py-1.5 text-xs font-bold shrink-0">
            الكاشير: نشط
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold">
          <AlertTriangle size={16} strokeWidth={1.5} className="text-[#222222] shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-[#c3c6bb] border border-[#222222] p-3 text-[#000000] text-xs flex items-center gap-2 font-bold">
          <CheckCircle size={16} strokeWidth={1.5} className="text-[#000000] shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Invoice Tabs (فواتير معلقة) */}
      <div className="bg-[#222222] border border-[#000000] p-2 flex items-center gap-2 overflow-x-auto">
        {heldInvoices.map((inv, idx) => (
          <div
            key={inv.id}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border cursor-pointer shrink-0 transition-colors ${
              activeTabIndex === idx
                ? "bg-[#c3c6bb] text-[#000000] border-[#000000]"
                : "bg-[#333333] text-[#c3c6bb] border-[#555555] hover:bg-[#444444]"
            }`}
          >
            <span onClick={() => loadFromHeld(idx)}>
              {inv.label}
              <span className="ml-1 text-[10px] opacity-60">({inv.cart.length})</span>
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(idx); }}
              className="ml-1 w-4 h-4 flex items-center justify-center bg-transparent hover:bg-[#c0392b] hover:text-white text-[10px] border-none cursor-pointer"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          onClick={addNewTab}
          className="px-3 py-1.5 text-xs font-bold bg-[#27ae60] hover:bg-[#219a52] text-white border border-[#27ae60] cursor-pointer shrink-0 transition-colors"
          title="فاتورة جديدة"
        >
          +
        </button>
        <div className="mr-auto text-[10px] text-[#888888] font-bold shrink-0">
          الفاتورة الحالية: {invoiceNumber}
        </div>
      </div>

      {/* Main 12-Column Grid Area */}
      <div className="grid grid-cols-12 gap-x-4 gap-y-2 items-stretch" style={{height: 'calc(100vh - 160px)'}}>
        
        {/* Left Column (8 Cols): Cart & Search */}
        <div className="col-span-12 lg:col-span-8 flex flex-col space-y-4 overflow-hidden">
          
          {/* Search Box */}
          <div className="bg-[#c3c6bb] p-4 border border-[#222222] space-y-2 relative">
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
              {cart.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleHoldInvoice}
                    className="h-8 px-2.5 bg-[#b8bcb2] hover:bg-[#c3c6bb] border border-[#888888] text-xs font-bold text-[#000000] flex items-center gap-2 cursor-pointer"
                  >
                    <Pause size={14} strokeWidth={1.5} />
                    <span>تعليق</span>
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
                            <p className="font-extrabold text-sm leading-tight">{item.name}</p>
                            <p className="text-[11px] text-[#555555] font-mono mt-0.5">{item.barcode}</p>
                          </td>
                          <td className="py-3 px-4 text-center font-black font-mono text-sm whitespace-nowrap">
                            {(item.price || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => updateCartQty(item.barcode, String(Math.max(0.1, item.quantity - 1)))}
                                className="w-7 h-7 bg-[#b8bcb2] border border-[#888888] font-black cursor-pointer hover:bg-[#222222] hover:text-[#c3c6bb] transition-colors"
                              >-</button>
                              <input
                                type="number"
                                step="any"
                                value={item.quantity || ""}
                                onChange={(e) => updateCartQty(item.barcode, e.target.value)}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="w-14 h-7 bg-[#b8bcb2] border border-[#888888] text-center text-xs font-bold text-[#000000] focus:outline-none"
                                min="0.001"
                              />
                              <button
                                onClick={() => updateCartQty(item.barcode, String(item.quantity + 1))}
                                className="w-7 h-7 bg-[#b8bcb2] border border-[#888888] font-black cursor-pointer hover:bg-[#222222] hover:text-[#c3c6bb] transition-colors"
                              >+</button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-black font-mono text-sm whitespace-nowrap">{(item.total || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-left whitespace-nowrap">
                            <button
                              onClick={() => removeFromCart(item.barcode)}
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

        {/* Right Column (4 Cols): Checkout & Summary */}
        <div className="col-span-12 lg:col-span-4 bg-[#c3c6bb] border border-[#222222] p-4 space-y-4 overflow-y-auto">
          <h3 className="text-sm font-extrabold text-[#000000] border-b border-[#888888] pb-2">
            بيانات التحصيل والتصفية
          </h3>

          <div className="space-y-3 text-xs font-bold text-[#000000]">
            
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
            <div>
              <label className="block text-[#000000] mb-1">بطاقة التموينية (اختر بطاقة أو أكثر - اضغط لإضافة)</label>
              <div className="bg-[#b8bcb2] p-2 border border-[#888888]">
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { count: 1, value: 48 },
                    { count: 2, value: 98 },
                    { count: 3, value: 148 },
                    { count: 4, value: 198 },
                    { count: 5, value: 223 },
                    { count: 6, value: 248 },
                    { count: 7, value: 273 },
                    { count: 8, value: 299 },
                    { count: 9, value: 323 },
                    { count: 10, value: 348 }
                  ].map(t => {
                    const isSelected = tamweenCards.includes(t.count);
                    return (
                      <button
                        key={t.count}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            const idx = tamweenCards.indexOf(t.count);
                            if (idx > -1) setTamweenCards([...tamweenCards.slice(0, idx), ...tamweenCards.slice(idx + 1)]);
                          } else {
                            setTamweenCards([...tamweenCards, t.count].sort((a, b) => a - b));
                            addTamweenItemsToCart();
                          }
                        }}
                        className={`h-9 text-[10px] font-black cursor-pointer border rounded-lg transition-all ${isSelected ? "text-white shadow" : "bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border)]"}`}
                        style={isSelected ? {background: 'var(--warning)', borderColor: 'var(--warning)'} : {}}
                        title={isSelected ? "إلغاء التحديد" : "إضافة بطاقة"}
                      >
                        {t.count === 1 ? "فرد" : t.count === 2 ? "فردين" : `${t.count} أفراد`}
                        <br />
                        <span className="text-[9px]">{t.value} ج</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1 text-[10px] text-center text-[#000000] font-bold">
                  {tamweenCards.length > 0 ? (
                    <>✅ {(() => {
                      // Count occurrences of each card
                      const counts: {[k: number]: number} = {};
                      tamweenCards.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
                      return Object.entries(counts).map(([c, n]) => `${n}× ${Number(c) === 1 ? "فرد" : Number(c) === 2 ? "فردين" : `${c} أفراد`}`).join(" + ");
                    })()} = <span className="text-[#b91c1c]">-{tamweenDiscount} ج.م</span></>
                  ) : (
                    "اضغط لتحديد بطاقة أو أكثر (يمكنك اختيار نفس البطاقة أكتر من مرة)"
                  )}
                </div>
              </div>
            </div>


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
                <button
                  type="button"
                  onClick={() => setShowForgotSecret(true)}
                  className="text-[10px] text-[#555555] font-bold hover:text-[#000000] underline cursor-pointer"
                >
                  نسيت الرقم السري؟
                </button>
              </div>
              <input
                type="text"
                value={secretNumber}
                onChange={(e) => setSecretNumber(e.target.value)}
                onFocus={() => setShowSecretDropdown(true)}
                onBlur={() => setTimeout(() => setShowSecretDropdown(false), 200)}
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
                  type="number"
                  step="0.01"
                  min="0"
                  value={breadPoints || ""}
                  onChange={(e) => setBreadPoints(Number(e.target.value) || 0)}
                  onWheel={(e) => e.currentTarget.blur()}
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
                  type="number"
                  step="0.01"
                  min="0"
                  value={bonus || ""}
                  onChange={(e) => setBonus(Number(e.target.value) || 0)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="flex-1 h-9 bg-[#c3c6bb] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222] [appearance-none] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="0.00"
                />
                <span className="text-[10px] text-[#000000] font-bold">ج.م (+)</span>
              </div>
            </div>


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
                      <span>بطاقة تموين ({c === 1 ? "فرد" : c === 2 ? "فردين" : `${c} أفراد`}):</span>
                      <span className="font-bold">- {[0, 48, 98, 148, 198, 223, 248, 273, 299, 323, 348][c]} ج.م</span>
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

            {/* Payment Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <label className="block text-[#000000] mb-1">طريقة الدفع</label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-2 text-right text-xs font-bold text-[#000000] cursor-pointer focus:outline-none focus:border-[#222222]"
                >
                  <option value="cash">نقداً (كاش)</option>
                  <option value="instapay">انستاباي</option>
                  <option value="visa">بطاقة بنكية</option>
                  <option value="vodafone">محفظة إلكترونية</option>
                </select>
              </div>
              <div>
                <label className="block text-[#000000] mb-1">الخزنة / الإيداع</label>
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
                    alert("ادخل اسم العميل والرقم السري");
                    return;
                  }
                  try {
                    const existingRes = await authFetch(`/api/tamween-customers/by-secret/${encodeURIComponent(secretNumber)}`);
                    const existing = await existingRes.json();
                    let customerId = existing?.id;
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
                        }),
                      });
                      const newData = await newRes.json();
                      customerId = newData.customer?.id;
                    } else {
                      // Update existing customer's card_value
                      await authFetch(`/api/tamween-customers/${customerId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: existing.name,
                          secret_number: existing.secret_number,
                          phone: existing.phone || "",
                          card_value: tamweenDiscount || 0,
                          bread_points: breadPoints || 0,
                        }),
                      });
                    }
                    if (customerId) {
                      await authFetch(`/api/tamween-customers/${customerId}/activate`, { method: "POST" });
                      alert("✅ تم حفظ البطاقة - صرف في وقت لاحق");
                      setCustomerName("");
                      setSecretNumber("");
                  
                      setBreadPoints(0);
                      setWithdrawalChoice("now");
                    }
                  } catch {
                    alert("خطأ في الاتصال بالخادم");
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
                disabled={loading || cart.length === 0}
                className="w-full h-11 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 shadow-lg"
                style={{background: 'var(--success)', boxShadow: '0 4px 16px var(--accent-glow)'}}
              >
                <Wallet size={16} strokeWidth={2} />
                <span>{loading ? "جاري الحفظ..." : "حفظ وتأكيد الفاتورة"}</span>
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
                backgroundColor: "#ffffff",
                color: "#000000",
                padding: "8px 4px",
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
                <div style={{ fontSize: "14px", fontWeight: "900", margin: "0 0 2px 0", color: "#000000" }}>
                  {printData.marketName || "منظومة الكابتن"}
                </div>
                {printData.marketPhone && (
                  <div style={{ fontSize: "9px", margin: "0", color: "#444444" }}>
                    ☎ {printData.marketPhone}
                  </div>
                )}
                <div style={{ margin: "6px 0", padding: "3px 0", borderTop: "1.5px solid #000000", borderBottom: "1.5px solid #000000", fontWeight: "900", fontSize: "10px", letterSpacing: "1px" }}>
                  ═══ إيصال مبيعات ═══
                </div>
              </div>

              {/* Receipt Meta Details */}
              <div style={{ fontSize: "9px", fontWeight: "bold", borderBottom: "1px dashed #000000", paddingBottom: "4px", marginBottom: "4px" }}>
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
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", marginBottom: "8px", tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #000000", fontWeight: "900" }}>
                    <th style={{ textAlign: "right", paddingBottom: "4px" }}>الصنف</th>
                    <th style={{ textAlign: "center", paddingBottom: "4px", width: "28px" }}>ك</th>
                    <th style={{ textAlign: "center", paddingBottom: "4px", width: "40px" }}>السعر</th>
                    <th style={{ textAlign: "left", paddingBottom: "4px", width: "50px" }}>الإجمالي</th>
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

              {/* Totals Summary */}
              <div style={{ borderTop: "1.5px solid #000000", paddingTop: "6px", fontSize: "9px", fontWeight: "bold" }}>
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

                {printData.bonus > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span>الحافز:</span>
                    <span style={{ fontFamily: "monospace" }}>+{(printData.bonus || 0).toFixed(2)} ج.م</span>
                  </div>
                )}

                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  backgroundColor: "#000000",
                  color: "#ffffff",
                  padding: "4px 6px",
                  fontWeight: "900",
                  fontSize: "11px",
                  marginTop: "6px",
                  letterSpacing: "0"
                }}>
                  <span>═══ الإجمالي النهائي ═══</span>
                  <span style={{ fontFamily: "monospace" }}>{(printData.total || 0).toFixed(2)} ج.م</span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: "center", marginTop: "8px", paddingTop: "6px", borderTop: "1.5px dashed #000000", fontSize: "8px", fontWeight: "bold", color: "#222222" }}>
                <p style={{ margin: "0 0 3px 0", fontSize: "9px" }}>شكراً لتسوقكم معنا!</p>
                <p style={{ margin: "0 0 2px 0", fontSize: "9px" }}>يسعدنا خدمتكم دائماً</p>
                <p style={{ margin: "0", fontSize: "7px", color: "#666666" }}>━━━━━━━━━━━━━━━━━━━━</p>
                <p style={{ margin: "3px 0 0 0", fontSize: "7px", color: "#666666" }}>☎ 01010561128 — منظومة الكابتن © 2026</p>
              </div>
            </div>


            <div className="w-full flex justify-center no-print">
              <UnifiedPrintButton printableId="thermal-receipt-printable-area" thermalId="thermal-receipt-printable-area" title="طباعة الفاتورة" variant="primary" />
            </div>
          </div>
        </div>
      )}

      {/* Forgot Secret Number Modal */}
      {showForgotSecret && (
        <div className="fixed inset-0 bg-[#000000]/60 flex justify-center items-center p-4 z-50">
          <div className="bg-[#c3c6bb] border border-[#222222] p-4 w-full max-w-lg relative space-y-4 max-h-[80vh] flex flex-col">
            <button
              onClick={() => { setShowForgotSecret(false); setCardSearchQuery(""); }}
              className="absolute top-3 left-3 w-7 h-7 flex items-center justify-center bg-[#b8bcb2] hover:bg-[#222222] hover:text-[#c3c6bb] border border-[#888888] text-[#000000] cursor-pointer"
            >
              <X size={14} />
            </button>
            <h3 className="text-sm font-black text-[#000000] border-b border-[#888888] pb-2">
              البطاقات التموينية المسجلة
            </h3>

            <input
              type="text"
              value={cardSearchQuery}
              onChange={(e) => setCardSearchQuery(e.target.value)}
              placeholder="ابحث برقم البطاقة أو اسم_holder أو الرقم السري..."
              className="w-full h-9 bg-[#b8bcb2] border border-[#888888] px-3 text-right text-xs font-bold text-[#000000] focus:outline-none focus:border-[#222222]"
            />

            <div className="overflow-y-auto flex-1 bg-white border border-[#888888]">
              {registeredCards.length > 0 ? (
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-[#222222] text-[#c3c6bb]">
                      <th className="py-2 px-2">رقم البطاقة</th>
                      <th className="py-2 px-2">الرقم السري</th>
                      <th className="py-2 px-2">العدد</th>
                      <th className="py-2 px-2">القيمة</th>
                      <th className="py-2 px-2">الاسم</th>
                      <th className="py-2 px-2">اختيار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#888888]/40">
                    {registeredCards
                      .filter(c =>
                        !cardSearchQuery ||
                        c.card_number.includes(cardSearchQuery) ||
                        c.secret_number.includes(cardSearchQuery) ||
                        c.holder_name.includes(cardSearchQuery)
                      )
                      .map((card) => (
                        <tr key={card.id} className="hover:bg-[#b8bcb2] transition-colors text-black font-bold">
                          <td className="py-2 px-2 font-mono">{card.card_number}</td>
                          <td className="py-2 px-2 font-mono font-black">{card.secret_number}</td>
                          <td className="py-2 px-2">{card.family_count}</td>
                          <td className="py-2 px-2">{card.value} ج.م</td>
                          <td className="py-2 px-2">{card.holder_name || "-"}</td>
                          <td className="py-2 px-2">
                            <button
                              onClick={() => {
                                setSecretNumber(card.secret_number);
                                setCustomerName(card.holder_name || card.card_number);
                                setShowForgotSecret(false);
                                setCardSearchQuery("");
                              }}
                              className="px-3 py-1 bg-[#27ae60] hover:bg-[#219a52] text-white font-bold text-[10px] cursor-pointer"
                            >
                              اختيار
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-[#555555] font-bold">
                  لا توجد بطاقات مسجلة بعد.
                  <br />
                  <span className="text-[10px]">سجّل البطاقات من إعدادات النظام.</span>
                </div>
              )}
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
                        const tamweenValues = [0, 48, 98, 148, 198, 223, 248, 273, 299, 323, 348];
                        const cardValue = c.card_value || 0;
                        const selectedCards: number[] = [];
                        let remainingValue = cardValue;
                        for (let i = tamweenValues.length - 1; i >= 1; i--) {
                          while (remainingValue >= tamweenValues[i] && selectedCards.length < 10) {
                            selectedCards.push(i);
                            remainingValue -= tamweenValues[i];
                          }
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
                                        alert(err.error);
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
                                        alert(err.error);
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
                        alert("اسم العميل والرقم السري مطلوبين");
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
                        alert(result.error || "حدث خطأ");
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
