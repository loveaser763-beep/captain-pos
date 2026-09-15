// Local Browser Database (localStorage persistent SQLite replica)
// This ensures 100% functionality when deployed to static or serverless environments (like Vercel)

export interface LocalUser {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: string[];
}

export interface LocalSupplier {
  id: number;
  name: string;
  phone: string;
  address: string;
}

export interface LocalItem {
  id: number;
  barcode: string;
  name: string;
  purchase_price: number;
  retail_price: number;
  wholesale_price: number;
  quantity: number;
  unit: string;
  low_stock_limit: number;
  is_unlimited: number; // 0 or 1
  category?: string;
  supplier_id?: number | null;
  supplier_name?: string | null;
}

export interface LocalInvoice {
  id: number;
  invoice_number: string;
  type: "sales" | "purchases";
  date: string;
  customer_supplier_name: string;
  payment_source: string;
  sale_type?: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  created_by: string;
  created_at: string;
  status?: string; // e.g. 'active', 'returned'
}

export interface LocalInvoiceItem {
  id: number;
  invoice_id: number;
  barcode: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  cost_price: number;
  total: number;
  returned_quantity: number;
}

export interface LocalLog {
  id: number;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface LocalPartner {
  id: number;
  name: string;
  fixed_profit_percentage: number;
  purchase_percentage: number;
}

export interface LocalExpense {
  id: number;
  title: string;
  amount: number;
  date: string;
  category: string;
  notes: string;
}

export interface LocalAudit {
  id: number;
  timestamp: string;
  audited_by: string;
  total_items: number;
  net_deficit: number;
  net_surplus: number;
  notes: string;
}

export interface LocalAuditItem {
  id: number;
  audit_id: number;
  barcode: string;
  name: string;
  system_qty: number;
  actual_qty: number;
  difference: number;
  cost_price: number;
  loss_surplus_value: number;
}

// Key names
const KEYS = {
  USERS: "ymarket_users",
  SUPPLIERS: "ymarket_suppliers",
  ITEMS: "ymarket_items",
  INVOICES: "ymarket_invoices",
  INVOICE_ITEMS: "ymarket_invoice_items",
  LOGS: "ymarket_logs",
  PARTNERS: "ymarket_partners",
  EXPENSES: "ymarket_expenses",
  SETTINGS: "ymarket_settings",
  AUDITS: "ymarket_audits",
  AUDIT_ITEMS: "ymarket_audit_items",
};

// Helper getter & setter
function getJson<T>(key: string, defaultVal: T): T {
  const val = localStorage.getItem(key);
  if (!val) return defaultVal;
  try {
    return JSON.parse(val);
  } catch {
    return defaultVal;
  }
}

function setJson<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Seeds if empty
export function initLocalDb() {
  // 1. Settings
  const settings = getJson<Record<string, string>>(KEYS.SETTINGS, {});
  if (Object.keys(settings).length === 0) {
    setJson(KEYS.SETTINGS, {
      market_name: "منظومة الكابتن",
      market_phone: "01099887766",
      market_address: "المنطقة الوسطى، المدينة المنورة",
      tax_rate: "14",
      currency: "ج.م",
      receipt_footer: "شكراً لزيارتكم! يسعدنا تقديم أفضل الخدمات لكم دائماً.",
    });
  }

  // 2. Users
  const users = getJson<any[]>(KEYS.USERS, []);
  if (users.length === 0) {
    setJson(KEYS.USERS, [
      {
        id: 1,
        username: "admin",
        password: "admin123",
        name: "أحمد المدير العام",
        role: "admin",
        permissions: ["sales", "purchases", "items", "suppliers", "reports", "users"],
      },
      {
        id: 2,
        username: "cashier",
        password: "cashier123",
        name: "محمود الكاشير",
        role: "cashier",
        permissions: ["sales"],
      },
      {
        id: 3,
        username: "store",
        password: "store123",
        name: "سعيد أمين المخزن",
        role: "storekeeper",
        permissions: ["purchases", "items", "suppliers"],
      },
    ]);
  }

  // 3. Suppliers
  const suppliers = getJson<LocalSupplier[]>(KEYS.SUPPLIERS, []);
  if (suppliers.length === 0) {
    setJson(KEYS.SUPPLIERS, [
      { id: 1, name: "شركة الوداد لتجارة الجملة", phone: "01099887766", address: "شارع رمسيس، القاهرة" },
      { id: 2, name: "مصنع النور للصناعات الغذائية", phone: "01222334455", address: "المنطقة الصناعية، 6 أكتوبر" },
      { id: 3, name: "الشركة المصرية المتحدة للمشروبات", phone: "01144556677", address: "ش جسر السويس، عين شمس" },
    ]);
  }

  // 4. Items (Products)
  const items = getJson<LocalItem[]>(KEYS.ITEMS, []);
  if (items.length === 0) {
    setJson(KEYS.ITEMS, [
      {
        id: 1,
        barcode: "6223000101111",
        name: "جبنة عبور لاند فيتا 500ج",
        purchase_price: 24.0,
        retail_price: 30.0,
        wholesale_price: 28.0,
        quantity: 45,
        unit: "علبة",
        low_stock_limit: 15,
        is_unlimited: 0,
      },
      {
        id: 2,
        barcode: "6221000112222",
        name: "حليب جهينة كامل الدسم 1 لتر",
        purchase_price: 28.0,
        retail_price: 38.0,
        wholesale_price: 35.0,
        quantity: 9,
        unit: "علبة",
        low_stock_limit: 15,
        is_unlimited: 0,
      },
      {
        id: 3,
        barcode: "6224000334444",
        name: "أرز المطبخ ممتاز 1 كيلو",
        purchase_price: 22.0,
        retail_price: 28.0,
        wholesale_price: 26.0,
        quantity: 110,
        unit: "كيلو",
        low_stock_limit: 20,
        is_unlimited: 0,
      },
      {
        id: 4,
        barcode: "6221034567890",
        name: "كوكا كولا كانز 330 مل",
        purchase_price: 7.0,
        retail_price: 10.0,
        wholesale_price: 9.0,
        quantity: 150,
        unit: "قطعة",
        low_stock_limit: 30,
        is_unlimited: 0,
      },
      {
        id: 5,
        barcode: "6221054321098",
        name: "كرتونة مياه نستله 20 زجاجة",
        purchase_price: 60.0,
        retail_price: 80.0,
        wholesale_price: 75.0,
        quantity: 4,
        unit: "كرتونة",
        low_stock_limit: 10,
        is_unlimited: 0,
      },
      {
        id: 6,
        barcode: "6222012345678",
        name: "شوكولاتة جالاكسي بالبندق",
        purchase_price: 12.0,
        retail_price: 18.0,
        wholesale_price: 16.0,
        quantity: 12,
        unit: "قطعة",
        low_stock_limit: 25,
        is_unlimited: 0,
      },
    ]);
  }

  // 5. Partners
  const partners = getJson<LocalPartner[]>(KEYS.PARTNERS, []);
  if (partners.length === 0) {
    setJson(KEYS.PARTNERS, [
      { id: 1, name: "الحاج أبو بكر (شريك تمويل)", fixed_profit_percentage: 25.0, purchase_percentage: 5.0 },
      { id: 2, name: "المهندس شريف (شريك مؤسس)", fixed_profit_percentage: 15.0, purchase_percentage: 0.0 },
      { id: 3, name: "الأستاذة مروة (مستثمر صامت)", fixed_profit_percentage: 10.0, purchase_percentage: 2.0 },
    ]);
  }

  // 6. Expenses
  const expenses = getJson<LocalExpense[]>(KEYS.EXPENSES, []);
  if (expenses.length === 0) {
    const todayStr = new Date().toISOString().split("T")[0];
    setJson(KEYS.EXPENSES, [
      { id: 1, title: "شراء ثلاجة عرض ألبان رئيسية", amount: 14500.0, date: todayStr, category: "شراء جهاز", notes: "ثلاجة توشيبا 30 قدم جديدة" },
      { id: 2, title: "أعمال صيانة وإصلاح التكييف المركزي", amount: 650.0, date: todayStr, category: "صيانة", notes: "تعبئة الفريون وتغيير فلتر الهواء" },
      { id: 3, title: "تكلفة لافتة المحل الخارجية المضيئة", amount: 3200.0, date: todayStr, category: "بناء", notes: "لوحة ليد أكريليك باسم سوبرماركت المدينة" },
    ]);
  }

  // 7. Invoices & Invoices Items (Historic seed so dashboard analytics shows graphs)
  const invoices = getJson<LocalInvoice[]>(KEYS.INVOICES, []);
  if (invoices.length === 0) {
    const pastDateStr = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split("T")[0];
    };
    const dateToday = pastDateStr(0);

    const seededInvoices: LocalInvoice[] = [
      {
        id: 1,
        invoice_number: "PINV-1001",
        type: "purchases",
        date: pastDateStr(3),
        customer_supplier_name: "شركة الوداد لتجارة الجملة",
        payment_source: "main_safe",
        sale_type: null,
        subtotal: 1500.0,
        tax: 150.0,
        discount: 50.0,
        total: 1600.0,
        paid: 1600.0,
        remaining: 0.0,
        created_by: "admin",
        created_at: pastDateStr(3) + "T10:00:00Z",
        status: "active",
      },
      {
        id: 2,
        invoice_number: "SINV-2001",
        type: "sales",
        date: pastDateStr(2),
        customer_supplier_name: "عميل كاش",
        payment_source: "cash_register",
        sale_type: "retail",
        subtotal: 170.0,
        tax: 17.0,
        discount: 10.0,
        total: 177.0,
        paid: 200.0,
        remaining: 0.0,
        created_by: "admin",
        created_at: pastDateStr(2) + "T14:30:00Z",
        status: "active",
      },
      {
        id: 3,
        invoice_number: "SINV-2002",
        type: "sales",
        date: pastDateStr(1),
        customer_supplier_name: "عميل جملة (محلات النجمة)",
        payment_source: "cash_register",
        sale_type: "wholesale",
        subtotal: 635.0,
        tax: 0.0,
        discount: 35.0,
        total: 600.0,
        paid: 600.0,
        remaining: 0.0,
        created_by: "cashier",
        created_at: pastDateStr(1) + "T16:45:00Z",
        status: "active",
      },
      {
        id: 4,
        invoice_number: "SINV-2003",
        type: "sales",
        date: dateToday,
        customer_supplier_name: "عميل نقدي افتراضي",
        payment_source: "cash_register",
        sale_type: "retail",
        subtotal: 214.0,
        tax: 20.0,
        discount: 0.0,
        total: 234.0,
        paid: 234.0,
        remaining: 0.0,
        created_by: "admin",
        created_at: dateToday + "T11:15:00Z",
        status: "active",
      },
    ];

    const seededInvoiceItems: LocalInvoiceItem[] = [
      // PINV-1001 items
      { id: 1, invoice_id: 1, barcode: "6224000334444", name: "أرز المطبخ ممتاز 1 كيلو", quantity: 50, unit: "كيلو", price: 22.0, cost_price: 22.0, total: 1100.0, returned_quantity: 0 },
      { id: 2, invoice_id: 1, barcode: "6221054321098", name: "كرتونة مياه نستله 20 زجاجة", quantity: 5, unit: "كرتونة", price: 60.0, cost_price: 60.0, total: 300.0, returned_quantity: 0 },
      // SINV-2001 items
      { id: 3, invoice_id: 2, barcode: "6223000101111", name: "جبنة عبور لاند فيتا 500ج", quantity: 3, unit: "علبة", price: 30.0, cost_price: 24.0, total: 90.0, returned_quantity: 0 },
      { id: 4, invoice_id: 2, barcode: "6221034567890", name: "كوكا كولا كانز 330 مل", quantity: 8, unit: "قطعة", price: 10.0, cost_price: 7.0, total: 80.0, returned_quantity: 0 },
      // SINV-2002 items
      { id: 5, invoice_id: 3, barcode: "6221000112222", name: "حليب جهينة كامل الدسم 1 لتر", quantity: 10, unit: "علبة", price: 35.0, cost_price: 28.0, total: 350.0, returned_quantity: 0 },
      { id: 6, invoice_id: 3, barcode: "6224000334444", name: "أرز المطبخ ممتاز 1 كيلو", quantity: 10, unit: "كيلو", price: 26.0, cost_price: 22.0, total: 260.0, returned_quantity: 0 },
      { id: 7, invoice_id: 3, barcode: "6222012345678", name: "شوكولاتة جالاكسي بالبندق", quantity: 2, unit: "قطعة", price: 16.0, cost_price: 12.0, total: 32.0, returned_quantity: 0 },
      // SINV-2003 items
      { id: 8, invoice_id: 4, barcode: "6223000101111", name: "جبنة عبور لاند فيتا 500ج", quantity: 2, unit: "علبة", price: 30.0, cost_price: 24.0, total: 60.0, returned_quantity: 0 },
      { id: 9, invoice_id: 4, barcode: "6221000112222", name: "حليب جهينة كامل الدسم 1 لتر", quantity: 3, unit: "علبة", price: 38.0, cost_price: 28.0, total: 114.0, returned_quantity: 0 },
      { id: 10, invoice_id: 4, barcode: "6221034567890", name: "كوكا كولا كانز 330 مل", quantity: 4, unit: "قطعة", price: 10.0, cost_price: 7.0, total: 40.0, returned_quantity: 0 },
    ];

    setJson(KEYS.INVOICES, seededInvoices);
    setJson(KEYS.INVOICE_ITEMS, seededInvoiceItems);
  }

  // 8. Logs
  const logs = getJson<LocalLog[]>(KEYS.LOGS, []);
  if (logs.length === 0) {
    setJson(KEYS.LOGS, [
      {
        id: 1,
        timestamp: new Date().toISOString(),
        user: "SYSTEM",
        action: "تهيئة قاعدة البيانات السحابية",
        details: "تم تهيئة قاعدة البيانات المحلية للمتصفح (Demo/Client Base) لضمان العمل بدون خادم خارجي.",
      },
    ]);
  }

  // 9. Audits
  getJson<LocalAudit[]>(KEYS.AUDITS, []);
  getJson<LocalAuditItem[]>(KEYS.AUDIT_ITEMS, []);
}

// Emulation services
export const dbMock = {
  // Login
  login: (body: any) => {
    const { username, password } = body;
    const users = getJson<any[]>(KEYS.USERS, []);
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      // Log connection
      dbMock.addLog(user.name, "تسجيل دخول", `دخل المستخدم ${user.username} إلى النظام (محاكاة محلياً)`);
      const { password: _, ...sanitized } = user;
      return { success: true, user: sanitized };
    }
    return { success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" };
  },

  // Logs
  getLogs: () => {
    return getJson<LocalLog[]>(KEYS.LOGS, []).slice(0, 300);
  },
  addLog: (user: string, action: string, details: string) => {
    const logs = getJson<LocalLog[]>(KEYS.LOGS, []);
    const newLog: LocalLog = {
      id: logs.length > 0 ? Math.max(...logs.map(l => l.id)) + 1 : 1,
      timestamp: new Date().toISOString(),
      user,
      action,
      details,
    };
    logs.unshift(newLog); // Put new at start
    setJson(KEYS.LOGS, logs);
    return newLog;
  },

  // Settings
  getSettings: () => {
    return getJson<Record<string, string>>(KEYS.SETTINGS, {});
  },
  saveSettings: (body: any) => {
    const { settings, user_name } = body;
    const current = getJson<Record<string, string>>(KEYS.SETTINGS, {});
    const updated = { ...current, ...settings };
    setJson(KEYS.SETTINGS, updated);
    dbMock.addLog(user_name || "المدير العام", "تعديل إعدادات المتجر", "تم تعديل إعدادات الهوية ومحددات البيع بالمتجر.");
    return { success: true };
  },

  // Users
  getUsers: () => {
    const users = getJson<any[]>(KEYS.USERS, []);
    return users.map(({ password: _, ...u }) => u);
  },
  addUser: (body: any) => {
    const { username, password, name, role, permissions, logCreator } = body;
    const users = getJson<any[]>(KEYS.USERS, []);
    const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
    const newUser = { id: newId, username, password, name, role, permissions: permissions || [] };
    users.push(newUser);
    setJson(KEYS.USERS, users);
    dbMock.addLog(logCreator || "المدير", "إضافة مستخدم", `تم إضافة مستخدم: ${name} (${username}) بصلاحية ${role}`);
    return { success: true, id: newId };
  },
  updateUser: (id: number, body: any) => {
    const { username, password, name, role, permissions, logCreator } = body;
    const users = getJson<any[]>(KEYS.USERS, []);
    const idx = users.findIndex(u => u.id === id);
    if (idx !== -1) {
      users[idx].username = username;
      users[idx].name = name;
      users[idx].role = role;
      users[idx].permissions = permissions || [];
      if (password) {
        users[idx].password = password;
      }
      setJson(KEYS.USERS, users);
      dbMock.addLog(logCreator || "المدير", "تعديل مستخدم", `تم تعديل بيانات المستخدم ID: ${id} واسمه ${name}`);
      return { success: true };
    }
    return { success: false, message: "المستخدم غير موجود" };
  },
  deleteUser: (id: number, logCreator: string) => {
    const users = getJson<any[]>(KEYS.USERS, []);
    const user = users.find(u => u.id === id);
    if (user) {
      const filtered = users.filter(u => u.id !== id);
      setJson(KEYS.USERS, filtered);
      dbMock.addLog(logCreator || "المدير", "حذف مستخدم", `تم حذف المستخدم ${user.name} رقم المعرف: ${id}`);
      return { success: true };
    }
    return { success: false, message: "المستخدم غير موجود" };
  },

  // Suppliers
  getSuppliers: () => {
    return getJson<LocalSupplier[]>(KEYS.SUPPLIERS, []);
  },
  addSupplier: (body: any) => {
    const { name, phone, address, logCreator } = body;
    const suppliers = getJson<LocalSupplier[]>(KEYS.SUPPLIERS, []);
    const newId = suppliers.length > 0 ? Math.max(...suppliers.map(s => s.id)) + 1 : 1;
    const newSup: LocalSupplier = { id: newId, name, phone, address };
    suppliers.unshift(newSup);
    setJson(KEYS.SUPPLIERS, suppliers);
    dbMock.addLog(logCreator || "المدير", "إضافة مورد", `تم إضافة المورد ${name}، هاتف: ${phone}`);
    return { success: true, id: newId };
  },
  updateSupplier: (id: number, body: any) => {
    const { name, phone, address, logCreator } = body;
    const suppliers = getJson<LocalSupplier[]>(KEYS.SUPPLIERS, []);
    const idx = suppliers.findIndex(s => s.id === id);
    if (idx !== -1) {
      suppliers[idx] = { id, name, phone, address };
      setJson(KEYS.SUPPLIERS, suppliers);
      dbMock.addLog(logCreator || "المدير", "تعديل مورد", `تم تعديل المورد ${name} رقم المعرف: ${id}`);
      return { success: true };
    }
    return { success: false, message: "المورد غير موجود" };
  },
  deleteSupplier: (id: number, logCreator: string) => {
    const suppliers = getJson<LocalSupplier[]>(KEYS.SUPPLIERS, []);
    const sup = suppliers.find(s => s.id === id);
    if (sup) {
      const filtered = suppliers.filter(s => s.id !== id);
      setJson(KEYS.SUPPLIERS, filtered);
      dbMock.addLog(logCreator || "المدير", "حذف مورد", `تم حذف المورد ${sup.name} رقم المعرف: ${id}`);
      return { success: true };
    }
    return { success: false, message: "المورد غير موجود" };
  },

  // Items (Products)
  getItems: () => {
    return getJson<LocalItem[]>(KEYS.ITEMS, []);
  },
  addItem: (body: any) => {
    const { barcode, name, purchase_price, retail_price, wholesale_price, quantity, unit, low_stock_limit, is_unlimited, category, supplier_id, supplier_name, logCreator } = body;
    const items = getJson<LocalItem[]>(KEYS.ITEMS, []);
    
    // Check barcode unique
    if (items.some(it => it.barcode === barcode)) {
      throw new Error("الباركود هذا مستخدم بالفعل في صنف آخر.");
    }

    const newId = items.length > 0 ? Math.max(...items.map(it => it.id)) + 1 : 1;
    const newItem: LocalItem = {
      id: newId,
      barcode,
      name,
      purchase_price: Number(purchase_price),
      retail_price: Number(retail_price),
      wholesale_price: Number(wholesale_price),
      quantity: Number(quantity),
      unit,
      low_stock_limit: Number(low_stock_limit),
      is_unlimited: is_unlimited ? 1 : 0,
      category: category || 'عام',
      supplier_id: supplier_id || null,
      supplier_name: supplier_name || null,
    };
    items.unshift(newItem);
    setJson(KEYS.ITEMS, items);
    dbMock.addLog(logCreator || "المدير", "إضافة صنف", `تم إضافة صنف جديد ${name} (باركود: ${barcode})، المورد: ${supplier_name || "غير محدد"}`);
    return { success: true, id: newId };
  },
  updateItem: (id: number, body: any) => {
    const { barcode, name, purchase_price, retail_price, wholesale_price, quantity, unit, low_stock_limit, is_unlimited, category, supplier_id, supplier_name, logCreator } = body;
    const items = getJson<LocalItem[]>(KEYS.ITEMS, []);
    const idx = items.findIndex(it => it.id === id);
    if (idx === -1) {
      return { success: false, message: "الصنف غير موجود" };
    }

    // Check barcode duplicate
    if (items.some(it => it.barcode === barcode && it.id !== id)) {
      return { success: false, message: "الباركود مستعمل بالفعل لصنف آخر." };
    }

    const original = items[idx];
    const targetQty = Number(quantity);

    if (original.is_unlimited === 0 && original.quantity === 0 && targetQty !== 0 && !is_unlimited) {
      return { success: false, message: "لا يمكن تعديل كمية الصنف النافذ (0) يدويًا في المستودع لمنع التلاعب. يرجى إدراجه وتحديث كميته حصريًا عبر فاتورة المشتريات." };
    }

    const changes: string[] = [];
    if (original.name !== name) changes.push(`الاسم: "${original.name}" -> "${name}"`);
    if (original.barcode !== barcode) changes.push(`الباركود: "${original.barcode}" -> "${barcode}"`);
    if (Number(original.purchase_price) !== Number(purchase_price)) changes.push(`الشراء: ${original.purchase_price} -> ${purchase_price}`);
    if (original.retail_price !== Number(retail_price)) changes.push(`القطاعي: ${original.retail_price} -> ${retail_price}`);
    if (original.quantity !== targetQty) changes.push(`الكمية: ${original.quantity} -> ${targetQty}`);
    if (original.supplier_name !== supplier_name) changes.push(`المورد: "${original.supplier_name || 'غير محدد'}" -> "${supplier_name || 'غير محدد'}"`);

    items[idx] = {
      id,
      barcode,
      name,
      purchase_price: Number(purchase_price),
      retail_price: Number(retail_price),
      wholesale_price: Number(wholesale_price),
      quantity: targetQty,
      unit,
      low_stock_limit: Number(low_stock_limit),
      is_unlimited: is_unlimited ? 1 : 0,
      category: category || original.category || 'عام',
      supplier_id: supplier_id !== undefined ? supplier_id : original.supplier_id,
      supplier_name: supplier_name !== undefined ? supplier_name : original.supplier_name,
    };
    setJson(KEYS.ITEMS, items);

    if (changes.length > 0) {
      dbMock.addLog(logCreator || "المدير", "تعديل صنف", `تم تعديل الصنف "${name}" (معرف: ${id}): [${changes.join(" | ")}]`);
    }
    return { success: true };
  },
  deleteItem: (id: number, logCreator: string) => {
    const items = getJson<LocalItem[]>(KEYS.ITEMS, []);
    const item = items.find(it => it.id === id);
    if (item) {
      const filtered = items.filter(it => it.id !== id);
      setJson(KEYS.ITEMS, filtered);
      dbMock.addLog(logCreator || "المدير", "حذف صنف", `تم حذف الصنف ${item.name} كود المعرف: ${id}`);
      return { success: true };
    }
    return { success: false, message: "الصنف غير موجود" };
  },

  // Invoices & Purchases/Sales Creators
  getInvoices: (type?: string) => {
    const invoices = getJson<LocalInvoice[]>(KEYS.INVOICES, []);
    if (type) {
      return invoices.filter(i => i.type === type);
    }
    return invoices;
  },
  getInvoice: (id: number) => {
    const invoices = getJson<LocalInvoice[]>(KEYS.INVOICES, []);
    const invoice = invoices.find(i => i.id === id);
    if (!invoice) return null;
    const items = getJson<LocalInvoiceItem[]>(KEYS.INVOICE_ITEMS, []);
    const invoiceItems = items.filter(ii => ii.invoice_id === id);
    return { invoice, items: invoiceItems };
  },
  addPurchase: (body: any) => {
    const {
      invoice_number,
      date,
      supplier_name,
      payment_source,
      subtotal,
      tax,
      discount,
      total,
      paid,
      remaining,
      items: invoiceItems,
      created_by,
    } = body;

    const invoices = getJson<LocalInvoice[]>(KEYS.INVOICES, []);
    const items = getJson<LocalItem[]>(KEYS.ITEMS, []);
    const allInvoiceItems = getJson<LocalInvoiceItem[]>(KEYS.INVOICE_ITEMS, []);

    const newInvoiceId = invoices.length > 0 ? Math.max(...invoices.map(i => i.id)) + 1 : 1;
    const newInvoice: LocalInvoice = {
      id: newInvoiceId,
      invoice_number,
      type: "purchases",
      date,
      customer_supplier_name: supplier_name,
      payment_source,
      subtotal: Number(subtotal),
      tax: Number(tax),
      discount: Number(discount),
      total: Number(total),
      paid: Number(paid),
      remaining: Number(remaining),
      created_by: created_by || "المدير",
      created_at: new Date().toISOString(),
      status: "active",
    };

    invoices.unshift(newInvoice);
    setJson(KEYS.INVOICES, invoices);

    let iiId = allInvoiceItems.length > 0 ? Math.max(...allInvoiceItems.map(ii => ii.id)) + 1 : 1;

    for (const item of invoiceItems) {
      const invItemRecord: LocalInvoiceItem = {
        id: iiId++,
        invoice_id: newInvoiceId,
        barcode: item.barcode,
        name: item.name,
        quantity: Number(item.quantity),
        unit: item.unit,
        price: Number(item.purchase_price),
        cost_price: Number(item.purchase_price),
        total: Number(item.total),
        returned_quantity: 0,
      };
      allInvoiceItems.push(invItemRecord);

      // Stock increase and supplier linkage
      const existingIdx = items.findIndex(it => it.barcode === item.barcode);
      if (existingIdx !== -1) {
        items[existingIdx].quantity += Number(item.quantity);
        items[existingIdx].purchase_price = Number(item.purchase_price);
        items[existingIdx].retail_price = Number(item.retail_price);
        items[existingIdx].wholesale_price = Number(item.wholesale_price);
        if (supplier_name) {
          items[existingIdx].supplier_name = supplier_name;
        }
      } else {
        const itemNewId = items.length > 0 ? Math.max(...items.map(it => it.id)) + 1 : 1;
        items.unshift({
          id: itemNewId,
          barcode: item.barcode,
          name: item.name,
          purchase_price: Number(item.purchase_price),
          retail_price: Number(item.retail_price),
          wholesale_price: Number(item.wholesale_price),
          quantity: Number(item.quantity),
          unit: item.unit,
          low_stock_limit: 10,
          is_unlimited: 0,
          supplier_name: supplier_name || null,
        });
      }
    }

    setJson(KEYS.ITEMS, items);
    setJson(KEYS.INVOICE_ITEMS, allInvoiceItems);

    dbMock.addLog(
      created_by || "المدير",
      "فاتورة مشتريات",
      `تم تسجيل فاتورة مشتريات رقم ${invoice_number} بقيمة ${total} من المورد ${supplier_name}`
    );

    return { success: true, invoice_id: newInvoiceId };
  },
  addSale: (body: any) => {
    const {
      invoice_number,
      date,
      customer_name,
      payment_source,
      sale_type,
      subtotal,
      tax,
      discount,
      total,
      paid,
      remaining,
      items: invoiceItems,
      created_by,
    } = body;

    const invoices = getJson<LocalInvoice[]>(KEYS.INVOICES, []);
    const items = getJson<LocalItem[]>(KEYS.ITEMS, []);
    const allInvoiceItems = getJson<LocalInvoiceItem[]>(KEYS.INVOICE_ITEMS, []);

    const newInvoiceId = invoices.length > 0 ? Math.max(...invoices.map(i => i.id)) + 1 : 1;
    const newInvoice: LocalInvoice = {
      id: newInvoiceId,
      invoice_number,
      type: "sales",
      date,
      customer_supplier_name: customer_name,
      payment_source,
      sale_type,
      subtotal: Number(subtotal),
      tax: Number(tax),
      discount: Number(discount),
      total: Number(total),
      paid: Number(paid),
      remaining: Number(remaining),
      created_by: created_by || "الكاشير",
      created_at: new Date().toISOString(),
      status: "active",
    };

    invoices.unshift(newInvoice);
    setJson(KEYS.INVOICES, invoices);

    let iiId = allInvoiceItems.length > 0 ? Math.max(...allInvoiceItems.map(ii => ii.id)) + 1 : 1;

    for (const item of invoiceItems) {
      const prod = items.find(it => it.barcode === item.barcode);
      const cost_price = prod ? prod.purchase_price : item.price;

      const invItemRecord: LocalInvoiceItem = {
        id: iiId++,
        invoice_id: newInvoiceId,
        barcode: item.barcode,
        name: item.name,
        quantity: Number(item.quantity),
        unit: item.unit,
        price: Number(item.price),
        cost_price: Number(cost_price),
        total: Number(item.total),
        returned_quantity: 0,
      };
      allInvoiceItems.push(invItemRecord);

      // Deduct warehouse
      if (prod && prod.is_unlimited !== 1) {
        prod.quantity = Math.max(0, prod.quantity - Number(item.quantity));
      }
    }

    setJson(KEYS.ITEMS, items);
    setJson(KEYS.INVOICE_ITEMS, allInvoiceItems);

    dbMock.addLog(
      created_by || "الكاشير",
      "فاتورة مبيعات",
      `تم بيع فاتورة مبيعات رقم ${invoice_number} بقيمة ${total} للعميل ${customer_name}`
    );

    return { success: true, invoice_id: newInvoiceId };
  },

  // Return sale invoice (مرتجع الفاتورة)
  returnInvoice: (id: number, body: any) => {
    const { user_name } = body;
    const invoices = getJson<LocalInvoice[]>(KEYS.INVOICES, []);
    const invoiceItems = getJson<LocalInvoiceItem[]>(KEYS.INVOICE_ITEMS, []);
    const items = getJson<LocalItem[]>(KEYS.ITEMS, []);

    const idx = invoices.findIndex(i => i.id === id);
    if (idx === -1) {
      return { success: false, message: "الفاتورة غير موجودة" };
    }

    invoices[idx].status = "returned";
    invoices[idx].total = 0;
    invoices[idx].paid = 0;
    invoices[idx].remaining = 0;
    invoices[idx].subtotal = 0;
    invoices[idx].tax = 0;
    invoices[idx].discount = 0;

    // Get units to return to stock
    const activeItems = invoiceItems.filter(ii => ii.invoice_id === id);
    for (const ii of activeItems) {
      ii.returned_quantity = ii.quantity;
      const prod = items.find(it => it.barcode === ii.barcode);
      if (prod && prod.is_unlimited !== 1) {
        prod.quantity += ii.quantity;
      }
    }

    setJson(KEYS.INVOICES, invoices);
    setJson(KEYS.ITEMS, items);
    setJson(KEYS.INVOICE_ITEMS, invoiceItems);

    dbMock.addLog(
      user_name || "المدير",
      "مرتجع فاتورة مبيعات",
      `تم معالجة مرتجع كلي للفاتورة ID: ${id} وإرجاع الأصناف للمستودعات.`
    );

    return { success: true, message: "تم تسجيل مرتجع الفاتورة، تصفير مخرجات المبيعات واستعادة مخزون الأصناف بنجاح" };
  },

  // Edit Invoice
  updateInvoice: (id: number, body: any) => {
    const { customer_supplier_name, payment_source, paid, remaining, user_name } = body;
    const invoices = getJson<LocalInvoice[]>(KEYS.INVOICES, []);
    const idx = invoices.findIndex(i => i.id === id);
    if (idx !== -1) {
      invoices[idx].customer_supplier_name = customer_supplier_name;
      invoices[idx].payment_source = payment_source;
      invoices[idx].paid = Number(paid);
      invoices[idx].remaining = Number(remaining);
      setJson(KEYS.INVOICES, invoices);

      dbMock.addLog(user_name || "المدير", "تعديل فاتورة", `تم تعديل بيانات الفاتورة المعتمدة رقم المعرف: ${id}`);
      return { success: true };
    }
    return { success: false, message: "الفاتورة غير موجودة" };
  },

  // Partners
  getPartners: () => {
    return getJson<LocalPartner[]>(KEYS.PARTNERS, []);
  },
  addPartner: (body: any) => {
    const { name, fixed_profit_percentage, purchase_percentage, logCreator } = body;
    const partners = getJson<LocalPartner[]>(KEYS.PARTNERS, []);
    const newId = partners.length > 0 ? Math.max(...partners.map(p => p.id)) + 1 : 1;
    const newPart = { id: newId, name, fixed_profit_percentage: Number(fixed_profit_percentage), purchase_percentage: Number(purchase_percentage) };
    partners.unshift(newPart);
    setJson(KEYS.PARTNERS, partners);
    dbMock.addLog(logCreator || "المدير العام", "إضافة شريك", `تم تسجيل شريك تمويلي جديد ${name}`);
    return { success: true, id: newId };
  },
  updatePartner: (id: number, body: any) => {
    const { name, fixed_profit_percentage, purchase_percentage, logCreator } = body;
    const partners = getJson<LocalPartner[]>(KEYS.PARTNERS, []);
    const idx = partners.findIndex(p => p.id === id);
    if (idx !== -1) {
      partners[idx] = { id, name, fixed_profit_percentage: Number(fixed_profit_percentage), purchase_percentage: Number(purchase_percentage) };
      setJson(KEYS.PARTNERS, partners);
      dbMock.addLog(logCreator || "المدير العام", "تعديل شريك", `تم تحديث حصة الشريك: ${name}`);
      return { success: true };
    }
    return { success: false };
  },
  deletePartner: (id: number, logCreator: string) => {
    const partners = getJson<LocalPartner[]>(KEYS.PARTNERS, []);
    const p = partners.find(p_ => p_.id === id);
    if (p) {
      const filtered = partners.filter(p_ => p_.id !== id);
      setJson(KEYS.PARTNERS, filtered);
      dbMock.addLog(logCreator || "المدير العام", "حذف شريك", `تم حذف الشريك ${p.name} من سجلات الحصص`);
      return { success: true };
    }
    return { success: false };
  },

  // Expenses
  getExpenses: () => {
    return getJson<LocalExpense[]>(KEYS.EXPENSES, []);
  },
  addExpense: (body: any) => {
    const { title, amount, date, category, notes, logCreator } = body;
    const expenses = getJson<LocalExpense[]>(KEYS.EXPENSES, []);
    const newId = expenses.length > 0 ? Math.max(...expenses.map(e => e.id)) + 1 : 1;
    const newExp = { id: newId, title, amount: Number(amount), date, category, notes: notes || "" };
    expenses.unshift(newExp);
    setJson(KEYS.EXPENSES, expenses);
    dbMock.addLog(logCreator || "المدير", "إضافة مصروفات", `تم تسجيل مصروف بند "${title}" بقيمة ${amount} ج.م`);
    return { success: true, id: newId };
  },
  updateExpense: (id: number, body: any) => {
    const { title, amount, date, category, notes, logCreator } = body;
    const expenses = getJson<LocalExpense[]>(KEYS.EXPENSES, []);
    const idx = expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      expenses[idx] = { id, title, amount: Number(amount), date, category, notes: notes || "" };
      setJson(KEYS.EXPENSES, expenses);
      dbMock.addLog(logCreator || "المدير", "تعديل مصروفات", `تعديل بند المصروفات: "${title}" بقيمة الجديد: ${amount}`);
      return { success: true };
    }
    return { success: false };
  },
  deleteExpense: (id: number, logCreator: string) => {
    const expenses = getJson<LocalExpense[]>(KEYS.EXPENSES, []);
    const e = expenses.find(e_ => e_.id === id);
    if (e) {
      const filtered = expenses.filter(e_ => e_.id !== id);
      setJson(KEYS.EXPENSES, filtered);
      dbMock.addLog(logCreator || "المدير", "حذف مصروفات", `حذف مصروف "${e.title}" رقم المعرف: ${id}`);
      return { success: true };
    }
    return { success: false };
  },

  // Audits & Inventory
  getAudits: () => {
    return getJson<LocalAudit[]>(KEYS.AUDITS, []);
  },
  getAuditDetails: (id: number) => {
    const audits = getJson<LocalAudit[]>(KEYS.AUDITS, []);
    const audit = audits.find(a => a.id === id);
    if (!audit) return null;
    const allItems = getJson<LocalAuditItem[]>(KEYS.AUDIT_ITEMS, []);
    const items = allItems.filter(ai => ai.audit_id === id);
    return { audit, items };
  },
  performAudit: (body: any) => {
    const { audited_by, notes, items: auditedItems } = body;
    const audits = getJson<LocalAudit[]>(KEYS.AUDITS, []);
    const allAuditItems = getJson<LocalAuditItem[]>(KEYS.AUDIT_ITEMS, []);
    const itemsDB = getJson<LocalItem[]>(KEYS.ITEMS, []);

    const newAuditId = audits.length > 0 ? Math.max(...audits.map(a => a.id)) + 1 : 1;
    let newAiId = allAuditItems.length > 0 ? Math.max(...allAuditItems.map(ai => ai.id)) + 1 : 1;

    let net_deficit = 0;
    let net_surplus = 0;

    for (const audItem of auditedItems) {
      const dbProduct = itemsDB.find(it => it.barcode === audItem.barcode);
      if (!dbProduct) continue;

      const system_qty = Number(dbProduct.quantity || 0);
      const actual_qty = Number(audItem.actual_qty);
      const difference = actual_qty - system_qty;
      const cost_price = Number(dbProduct.purchase_price || 0);
      const loss_surplus_value = difference * cost_price;

      if (difference < 0) {
        net_deficit += Math.abs(loss_surplus_value);
      } else if (difference > 0) {
        net_surplus += loss_surplus_value;
      }

      // 1. Update stock in local items DB
      dbProduct.quantity = actual_qty;

      // 2. Add audit item log
      allAuditItems.push({
        id: newAiId++,
        audit_id: newAuditId,
        barcode: audItem.barcode,
        name: dbProduct.name,
        system_qty,
        actual_qty,
        difference,
        cost_price,
        loss_surplus_value,
      });
    }

    const newAudit: LocalAudit = {
      id: newAuditId,
      timestamp: new Date().toISOString(),
      audited_by: audited_by || "المدير العام",
      total_items: auditedItems.length,
      net_deficit,
      net_surplus,
      notes: notes || "",
    };

    audits.unshift(newAudit);
    setJson(KEYS.AUDITS, audits);
    setJson(KEYS.AUDIT_ITEMS, allAuditItems);
    setJson(KEYS.ITEMS, itemsDB);

    dbMock.addLog(
      audited_by || "المدير العام",
      "جرد مخزن",
      `تم جرد مخزن كامل (${auditedItems.length} صنف). العجز: ${net_deficit.toFixed(2)} ج.م. الزيادة: ${net_surplus.toFixed(2)} ج.م`
    );

    return { success: true, auditId: newAuditId, net_deficit, net_surplus };
  },

  // Custom reports & profit calculator
  getReportsData: (startDate: string, endDate: string) => {
    const invoices = getJson<LocalInvoice[]>(KEYS.INVOICES, []);
    const invoiceItems = getJson<LocalInvoiceItem[]>(KEYS.INVOICE_ITEMS, []);
    const items = getJson<LocalItem[]>(KEYS.ITEMS, []);
    const partners = getJson<LocalPartner[]>(KEYS.PARTNERS, []);
    const expenses = getJson<LocalExpense[]>(KEYS.EXPENSES, []);

    // Convert date filter
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    endObj.setHours(23, 59, 59, 999);

    const filterInvoices = invoices.filter(i => {
      const d = new Date(i.date);
      return d >= startObj && d <= endObj;
    });

    const filterInvoiceItems = invoiceItems.filter(ii =>
      filterInvoices.some(i => i.id === ii.invoice_id)
    );

    const filterExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      // Date string match works simply
      return e.date >= startDate && e.date <= endDate;
    });

    return {
      invoices: filterInvoices,
      invoiceItems: filterInvoiceItems,
      inventoryStatus: [...items].sort((a,b)=> a.quantity - b.quantity),
      partners,
      expenses: filterExpenses,
    };
  },

  // Dashboard calculations
  getStats: () => {
    const dateToday = new Date().toISOString().split("T")[0];
    const invoices = getJson<LocalInvoice[]>(KEYS.INVOICES, []);
    const invoiceItems = getJson<LocalInvoiceItem[]>(KEYS.INVOICE_ITEMS, []);
    const items = getJson<LocalItem[]>(KEYS.ITEMS, []);
    const logs = getJson<LocalLog[]>(KEYS.LOGS, []);

    // Sales total (exclude returned invoices)
    const salesInvoices = invoices.filter(i => i.type === "sales" && i.status !== "returned");
    const purchaseInvoices = invoices.filter(i => i.type === "purchases");

    const totalSales = salesInvoices.reduce((acc, i) => acc + i.total, 0);
    const totalPurchases = purchaseInvoices.reduce((acc, i) => acc + i.total, 0);

    const lowStockCount = items.filter(it => it.quantity <= it.low_stock_limit).length;

    // Calculate real net profits
    const salesInvoiceIds = new Set(salesInvoices.map(i => i.id));
    const saleItems = invoiceItems.filter(ii => salesInvoiceIds.has(ii.invoice_id));
    const totalProfit = saleItems.reduce((acc, ii) => acc + (ii.price - ii.cost_price) * ii.quantity, 0);

    // Top Selling Products
    const salesSummaryMap = new Map<string, { barcode: string; name: string; qty: number; unit: string; totalSales: number }>();
    saleItems.forEach(ii => {
      const existing = salesSummaryMap.get(ii.barcode);
      if (existing) {
        existing.qty += ii.quantity;
        existing.totalSales += ii.total;
      } else {
        salesSummaryMap.set(ii.barcode, {
          barcode: ii.barcode,
          name: ii.name,
          qty: ii.quantity,
          unit: ii.unit,
          totalSales: ii.total,
        });
      }
    });

    const topSelling = Array.from(salesSummaryMap.values())
      .map(entry => ({
        barcode: entry.barcode,
        name: entry.name,
        total_qty: entry.qty,
        unit: entry.unit,
        total_sales: entry.totalSales,
      }))
      .sort((a, b) => b.total_qty - a.total_qty)
      .slice(0, 5);

    const recentInvoices = invoices.slice(0, 5);
    const recentLogs = logs.slice(0, 5);

    // Cash register
    const drawerSales = invoices.filter(i => i.type === "sales" && i.payment_source === "cash_register" && i.status !== "returned").reduce((acc,i)=> acc + i.total, 0);
    const drawerPurchases = invoices.filter(i => i.type === "purchases" && i.payment_source === "cash_register").reduce((acc,i)=> acc+i.total,0);
    const drawerBalance = drawerSales - drawerPurchases;

    // Today sales count
    const todaySalesInvs = salesInvoices.filter(i => i.date === dateToday);
    const todaySalesCount = todaySalesInvs.length;

    // Today returns
    const todayReturns = invoices.filter(i => i.status === "returned" && i.date === dateToday);
    const todayReturnsCount = todayReturns.length;

    // Graph Data
    const graphData: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      const parts = dateStr.split("-");
      const displayLabel = `${parts[1]}/${parts[2]}`;

      const sSum = invoices.filter(inv => inv.type === "sales" && inv.status !== "returned" && inv.date === dateStr).reduce((acc,inv)=> acc+inv.total, 0);
      const pSum = invoices.filter(inv => inv.type === "purchases" && inv.date === dateStr).reduce((acc,inv)=> acc+inv.total, 0);

      graphData.push({
        date: dateStr,
        label: displayLabel,
        sales: sSum,
        purchases: pSum,
      });
    }

    return {
      sales: {
        total: totalSales,
        count: salesInvoices.length,
      },
      purchases: {
        total: totalPurchases,
        count: purchaseInvoices.length,
      },
      profit: totalProfit,
      lowStockCount,
      topSelling,
      recentInvoices,
      recentLogs,
      graphData,
      drawerBalance,
      todaySalesCount,
      todayReturnsCount,
    };
  },
};
