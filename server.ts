import multer from 'multer';
import fs from 'fs';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { execFile } from "child_process";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
// ملحوظة: vite تُستورد ديناميكياً داخل وضع التطوير فقط — نسخة التشغيل المجمّعة لا تعتمد عليها.

const _currentDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(process.argv[1] || '.');

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // JWT Secret — ثابت للتطبيق (ممكن يتغير من Environment Variable)
  const JWT_SECRET = process.env.JWT_SECRET || "captain-pos-secret-key-2024";
  const JWT_EXPIRY = "8h";

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Auth Middleware — التحقق من JWT Token
  const requireAuth = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "غير مصرح - سجل دخول أولاً" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: "التوكن منتهي الصلاحية - سجل دخول مرة تانية" });
    }
  };

  // Admin-only Middleware
  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "محتاج صلاحيات Admin" });
    }
    next();
  };

  // مجلد البيانات: في نسخة التشغيل المجمّعة يأتي من CAPTAIN_DATA_DIR (مجلد كتابة مضمون)،
  // وفي وضع التطوير يبقى مجلد العمل الحالي.
  const DATA_DIR = process.env.CAPTAIN_DATA_DIR || process.cwd();

  // Initialize SQLite Database
  const dbPath = path.join(DATA_DIR, "database.sqlite");
  const db = new sqlite3.Database(dbPath);

  // Helper functions for Database Promises
  function dbRun(query: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  function dbAll(query: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  function dbGet(query: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Set up Database Tables
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      name TEXT,
      role TEXT,
      permissions TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      address TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT,
      purchase_price REAL,
      retail_price REAL,
      wholesale_price REAL,
      quantity INTEGER,
      unit TEXT,
      low_stock_limit INTEGER,
      category TEXT DEFAULT 'عام'
      ,supplier TEXT DEFAULT ''
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE,
      type TEXT, -- 'sales' or 'purchases'
      date TEXT, -- YYYY-MM-DD
      customer_supplier_name TEXT,
      payment_source TEXT, -- 'cash_register' or 'main_safe'
      sale_type TEXT, -- 'retail' or 'wholesale'
      subtotal REAL,
      tax REAL,
      discount REAL,
      total REAL,
      paid REAL,
      remaining REAL,
      created_by TEXT,
      created_at TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      barcode TEXT,
      name TEXT,
      quantity INTEGER,
      unit TEXT,
      price REAL,
      cost_price REAL,
      total REAL,
      FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      user TEXT,
      action TEXT,
      details TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      fixed_profit_percentage REAL DEFAULT 0,
      purchase_percentage REAL DEFAULT 0
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      amount REAL,
      date TEXT,
      category TEXT,
      notes TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS treasury_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT, 
      amount REAL,
      source TEXT,
      destination TEXT,
      date TEXT,
      notes TEXT,
      created_by TEXT
    )
  `);

  try {
    await dbRun("ALTER TABLE expenses ADD COLUMN payment_source TEXT DEFAULT 'cash_register'");
  } catch (e) {
    // Column might already exist
  }

  try {
    await dbRun("ALTER TABLE invoices ADD COLUMN status TEXT DEFAULT 'active'");
  } catch (err) {
    // Column already exists, ignore
  }

  try {
    await dbRun("ALTER TABLE items ADD COLUMN is_unlimited INTEGER DEFAULT 0");
  } catch (err) {
    // Column already exists, ignore
  }

  try {
    await dbRun("ALTER TABLE items ADD COLUMN category TEXT DEFAULT 'عام'");
  } catch (err) {
    // Column already exists, ignore
  }

  try {
    await dbRun("ALTER TABLE items ADD COLUMN supplier TEXT DEFAULT ''");
  } catch (err) {
    // Column already exists, ignore
  }

  try {
    await dbRun("ALTER TABLE items ADD COLUMN supplier_id INTEGER");
  } catch (err) {
    // Column already exists, ignore
  }

  try {
    await dbRun("ALTER TABLE items ADD COLUMN supplier_name TEXT");
  } catch (err) {
    // Column already exists, ignore
  }

  try {
    await dbRun("ALTER TABLE invoice_items ADD COLUMN returned_quantity INTEGER DEFAULT 0");
  } catch (err) {
    // Column already exists, ignore
  }

  // Create Settings Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Seed default settings if empty
  const settingsCount = await dbGet("SELECT COUNT(*) as count FROM settings");
  if (settingsCount.count === 0) {
    const defaultSettings = [
      { key: "market_name", value: "سوبرماركت الكابتن" },
      { key: "market_phone", value: "01099887766" },
      { key: "market_address", value: "المنطقة الوسطى، المدينة المنورة" },
      { key: "tax_rate", value: "14" },
      { key: "currency", value: "ج.م" },
      { key: "receipt_footer", value: "شكراً لزيارتكم! يسعدنا تقديم أفضل الخدمات لكم دائماً." }
    ];
    for (const d of defaultSettings) {
      await dbRun("INSERT INTO settings (key, value) VALUES (?, ?)", [d.key, d.value]);
    }
  }

  // Create Inventory Audit Tables
  await dbRun(`
    CREATE TABLE IF NOT EXISTS inventory_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      audited_by TEXT,
      total_items INTEGER,
      net_deficit REAL DEFAULT 0,
      net_surplus REAL DEFAULT 0,
      notes TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS inventory_audit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER,
      barcode TEXT,
      name TEXT,
      system_qty INTEGER,
      actual_qty INTEGER,
      difference INTEGER,
      cost_price REAL,
      loss_surplus_value REAL,
      FOREIGN KEY (audit_id) REFERENCES inventory_audits (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS tamween_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_number TEXT UNIQUE,
      secret_number TEXT,
      family_count INTEGER,
      value REAL,
      holder_name TEXT DEFAULT '',
      created_at TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS tamween_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      secret_number TEXT UNIQUE,
      phone TEXT DEFAULT '',
      card_value REAL DEFAULT 0,
      bread_points REAL DEFAULT 0,
      status TEXT DEFAULT '',
      status_month TEXT DEFAULT '',
      created_at TEXT
    )
  `);

  // Migration: ensure tamween_customers has status/status_month columns
  try {
    const cols = await dbAll("PRAGMA table_info(tamween_customers)");
    const colNames = cols.map((c: any) => c.name);
    console.log("[Migration] tamween_customers columns:", colNames);
    if (!colNames.includes("status")) {
      await dbRun("ALTER TABLE tamween_customers ADD COLUMN status TEXT DEFAULT ''");
      console.log("[Migration] Added 'status' column");
    }
    if (!colNames.includes("status_month")) {
      await dbRun("ALTER TABLE tamween_customers ADD COLUMN status_month TEXT DEFAULT ''");
      console.log("[Migration] Added 'status_month' column");
    }
  } catch (e: any) {
    console.log("[Migration] tamween_customers table might not exist, will be created by CREATE TABLE IF NOT EXISTS above");
  }

  // Migration: ensure invoices has tamween_discount column
  try {
    const invCols = await dbAll("PRAGMA table_info(invoices)");
    const invColNames = invCols.map((c: any) => c.name);
    if (!invColNames.includes("tamween_discount")) {
      await dbRun("ALTER TABLE invoices ADD COLUMN tamween_discount REAL DEFAULT 0");
      console.log("[Migration] Added 'tamween_discount' column to invoices");
    }
  } catch (e: any) {
    console.log("[Migration] invoices tamween_discount migration skipped:", e.message);
  }

  // Migration: ensure invoices has bread_points and bonus columns
  try {
    const invCols = await dbAll("PRAGMA table_info(invoices)");
    const invColNames = invCols.map((c: any) => c.name);
    if (!invColNames.includes("bread_points")) {
      await dbRun("ALTER TABLE invoices ADD COLUMN bread_points REAL DEFAULT 0");
      console.log("[Migration] Added 'bread_points' column to invoices");
    }
    if (!invColNames.includes("bonus")) {
      await dbRun("ALTER TABLE invoices ADD COLUMN bonus REAL DEFAULT 0");
      console.log("[Migration] Added 'bonus' column to invoices");
    }
  } catch (e: any) {
    console.log("[Migration] invoices bread_points/bonus migration skipped:", e.message);
  }

  // Migration: ensure items has is_tamween column
  try {
    const itemCols = await dbAll("PRAGMA table_info(items)");
    const itemColNames = itemCols.map((c: any) => c.name);
    if (!itemColNames.includes("is_tamween")) {
      await dbRun("ALTER TABLE items ADD COLUMN is_tamween INTEGER DEFAULT 0");
      console.log("[Migration] Added 'is_tamween' column to items");
    }
  } catch (e: any) {
    console.log("[Migration] items is_tamween migration skipped:", e.message);
  }

  // Migration: ensure suppliers has is_tamween_supplier column
  try {
    const supCols = await dbAll("PRAGMA table_info(suppliers)");
    const supColNames = supCols.map((c: any) => c.name);
    if (!supColNames.includes("is_tamween_supplier")) {
      await dbRun("ALTER TABLE suppliers ADD COLUMN is_tamween_supplier INTEGER DEFAULT 0");
      console.log("[Migration] Added 'is_tamween_supplier' column to suppliers");
    }
  } catch (e: any) {
    console.log("[Migration] suppliers is_tamween_supplier migration skipped:", e.message);
  }

  // Migration: تشويش كلمات السور القديمة (المخزنة كنص عادي)
  try {
    const users = await dbAll("SELECT id, password FROM users");
    let migrated = 0;
    for (const user of users) {
      // لو كلمة السور مش مشوشه ( begging بـ $2b$ يعني bcrypt)
      if (user.password && !user.password.startsWith("$2b$") && !user.password.startsWith("$2a$")) {
        const hashed = await bcrypt.hash(user.password, 10);
        await dbRun("UPDATE users SET password = ? WHERE id = ?", [hashed, user.id]);
        migrated++;
      }
    }
    if (migrated > 0) {
      console.log(`[Migration] Hashed ${migrated} plain-text passwords`);
    }
  } catch (e: any) {
    console.log("[Migration] Password hashing skipped:", e.message);
  }

  // Create tamween_replacements table for tracking استعاضات
  await dbRun(`
    CREATE TABLE IF NOT EXISTS tamween_replacements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      invoice_number TEXT,
      supplier_name TEXT,
      items_description TEXT,
      items_json TEXT,
      total_value REAL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT
    )
  `);

  // Add items_json column if not exists (migration)
  try {
    await dbRun(`ALTER TABLE tamween_replacements ADD COLUMN items_json TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Create tamween_products table for tracking منتجات التموين
  await dbRun(`
    CREATE TABLE IF NOT EXISTS tamween_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT,
      name TEXT,
      category TEXT DEFAULT 'عام',
      quantity INTEGER DEFAULT 0,
      unit TEXT DEFAULT 'قطعة',
      purchase_price REAL DEFAULT 0,
      retail_price REAL DEFAULT 0,
      wholesale_price REAL DEFAULT 0,
      created_at TEXT
    )
  `);

  // Create held_invoices table for persisting suspended invoices
  await dbRun(`
    CREATE TABLE IF NOT EXISTS held_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tab_index INTEGER,
      cart_json TEXT,
      customer_name TEXT,
      secret_number TEXT,
      sale_type TEXT,
      payment_method TEXT,
      payment_source TEXT,
      discount REAL DEFAULT 0,
      tamween_cards_json TEXT DEFAULT '[]',
      bread_points REAL DEFAULT 0,
      bonus REAL DEFAULT 0,
      paid REAL DEFAULT 0,
      invoice_number TEXT,
      date TEXT,
      label TEXT,
      created_at TEXT
    )
  `);

  // Function to seed 100+ realistic products, suppliers, invoices and data
  async function seed100ItemsAndFullData() {
    const sample100Items = [
      // ألبان وأجبان
      { barcode: "6223000101111", name: "جبنة عبور لاند فيتا 500ج", purchase_price: 24, retail_price: 30, wholesale_price: 28, quantity: 45, unit: "علبة", low_stock_limit: 15, category: "ألبان وأجبان" },
      { barcode: "6223000101128", name: "جبنة عبور لاند إسطنبولي 500ج", purchase_price: 25, retail_price: 32, wholesale_price: 29, quantity: 38, unit: "علبة", low_stock_limit: 15, category: "ألبان وأجبان" },
      { barcode: "6223000101135", name: "جبنة دومتي بلس فيتا 250ج", purchase_price: 13, retail_price: 17, wholesale_price: 15, quantity: 60, unit: "علبة", low_stock_limit: 20, category: "ألبان وأجبان" },
      { barcode: "6223000101142", name: "جبنة دومتي بلس رومي 250ج", purchase_price: 14, retail_price: 18, wholesale_price: 16, quantity: 50, unit: "علبة", low_stock_limit: 15, category: "ألبان وأجبان" },
      { barcode: "6221000112222", name: "حليب جهينة كامل الدسم 1 لتر", purchase_price: 28, retail_price: 38, wholesale_price: 35, quantity: 9, unit: "علبة", low_stock_limit: 15, category: "ألبان وأجبان" },
      { barcode: "6221000112239", name: "حليب جهينة خالي الدسم 1 لتر", purchase_price: 28, retail_price: 38, wholesale_price: 35, quantity: 24, unit: "علبة", low_stock_limit: 10, category: "ألبان وأجبان" },
      { barcode: "6221000112246", name: "حليب المراعي كامل الدسم 1 لتر", purchase_price: 29, retail_price: 39, wholesale_price: 36, quantity: 32, unit: "علبة", low_stock_limit: 10, category: "ألبان وأجبان" },
      { barcode: "6221000112253", name: "حليب بخيره 500 مل", purchase_price: 13, retail_price: 17, wholesale_price: 15, quantity: 48, unit: "علبة", low_stock_limit: 15, category: "ألبان وأجبان" },
      { barcode: "6221000112260", name: "زبادي جهينة طبيعي 105ج", purchase_price: 6, retail_price: 8.5, wholesale_price: 7.5, quantity: 80, unit: "علبة", low_stock_limit: 25, category: "ألبان وأجبان" },
      { barcode: "6221000112277", name: "زبادي المراعي لايت 105ج", purchase_price: 6.5, retail_price: 9, wholesale_price: 8, quantity: 65, unit: "علبة", low_stock_limit: 20, category: "ألبان وأجبان" },
      { barcode: "6221000112284", name: "جبنة رومي قديم مبشور 250ج", purchase_price: 42, retail_price: 55, wholesale_price: 50, quantity: 22, unit: "طبق", low_stock_limit: 8, category: "ألبان وأجبان" },
      { barcode: "6221000112291", name: "جبنة موزاريلا الفراودة 500ج", purchase_price: 55, retail_price: 72, wholesale_price: 65, quantity: 18, unit: "كيس", low_stock_limit: 10, category: "ألبان وأجبان" },
      { barcode: "6221000112307", name: "قشطة جهينة بلدي 100ج", purchase_price: 18, retail_price: 24, wholesale_price: 21, quantity: 30, unit: "علبة", low_stock_limit: 10, category: "ألبان وأجبان" },
      { barcode: "6221000112314", name: "زبدة لورباك غير مملحة 200ج", purchase_price: 85, retail_price: 110, wholesale_price: 100, quantity: 14, unit: "قطعة", low_stock_limit: 5, category: "ألبان وأجبان" },
      { barcode: "6221000112321", name: "زبدة فيرن خليط 1 كيلو", purchase_price: 110, retail_price: 135, wholesale_price: 125, quantity: 25, unit: "كيلو", low_stock_limit: 8, category: "ألبان وأجبان" },

      // عصائر ومشروبات
      { barcode: "6221034567890", name: "كوكا كولا كانز 330 مل", purchase_price: 7, retail_price: 10, wholesale_price: 9, quantity: 150, unit: "قطعة", low_stock_limit: 30, category: "عصائر ومشروبات" },
      { barcode: "6221034567807", name: "بيبسي كانز 330 مل", purchase_price: 7, retail_price: 10, wholesale_price: 9, quantity: 140, unit: "قطعة", low_stock_limit: 30, category: "عصائر ومشروبات" },
      { barcode: "6221034567814", name: "سفن أب كانز 330 مل", purchase_price: 7, retail_price: 10, wholesale_price: 9, quantity: 120, unit: "قطعة", low_stock_limit: 25, category: "عصائر ومشروبات" },
      { barcode: "6221034567821", name: "فريندا برتقال 250 مل", purchase_price: 5, retail_price: 8, wholesale_price: 7, quantity: 90, unit: "زجاجة", low_stock_limit: 20, category: "عصائر ومشروبات" },
      { barcode: "6221034567838", name: "عصير جهينة مانجو 1 لتر", purchase_price: 22, retail_price: 30, wholesale_price: 27, quantity: 40, unit: "علبة", low_stock_limit: 12, category: "عصائر ومشروبات" },
      { barcode: "6221034567845", name: "عصير جهينة جوافة 1 لتر", purchase_price: 22, retail_price: 30, wholesale_price: 27, quantity: 35, unit: "علبة", low_stock_limit: 12, category: "عصائر ومشروبات" },
      { barcode: "6221034567852", name: "عصير جهينة تفاح 200 مل", purchase_price: 5.5, retail_price: 8, wholesale_price: 7, quantity: 110, unit: "علبة", low_stock_limit: 30, category: "عصائر ومشروبات" },
      { barcode: "6221034567869", name: "عصير المراعي كوكتيل 1 لتر", purchase_price: 24, retail_price: 32, wholesale_price: 28, quantity: 28, unit: "علبة", low_stock_limit: 10, category: "عصائر ومشروبات" },
      { barcode: "6221054321012", name: "مياه نستله 1.5 لتر", purchase_price: 6, retail_price: 9, wholesale_price: 8, quantity: 180, unit: "زجاجة", low_stock_limit: 40, category: "عصائر ومشروبات" },
      { barcode: "6221054321098", name: "كرتونة مياه نستله 20 زجاجة", purchase_price: 60, retail_price: 80, wholesale_price: 75, quantity: 4, unit: "كرتونة", low_stock_limit: 10, category: "عصائر ومشروبات" },
      { barcode: "6221054321029", name: "مياه بركة 600 مل", purchase_price: 3.5, retail_price: 5, wholesale_price: 4.5, quantity: 220, unit: "زجاجة", low_stock_limit: 50, category: "عصائر ومشروبات" },
      { barcode: "6221054321036", name: "شاي العروسة 250ج", purchase_price: 38, retail_price: 48, wholesale_price: 44, quantity: 55, unit: "باكو", low_stock_limit: 15, category: "عصائر ومشروبات" },
      { barcode: "6221054321043", name: "شاي ليبتون 100 فتلة", purchase_price: 62, retail_price: 78, wholesale_price: 72, quantity: 42, unit: "علبة", low_stock_limit: 12, category: "عصائر ومشروبات" },
      { barcode: "6221054321050", name: "نسكافيه بلاك 100ج", purchase_price: 70, retail_price: 92, wholesale_price: 85, quantity: 20, unit: "برطمان", low_stock_limit: 8, category: "عصائر ومشروبات" },
      { barcode: "6221054321067", name: "نسكافيه 3 في 1 كلاسيك", purchase_price: 4.5, retail_price: 6, wholesale_price: 5.5, quantity: 300, unit: "كيس", low_stock_limit: 60, category: "عصائر ومشروبات" },
      { barcode: "6221054321074", name: "بن شاهين فاتح محوج 200ج", purchase_price: 68, retail_price: 88, wholesale_price: 80, quantity: 25, unit: "باكو", low_stock_limit: 10, category: "عصائر ومشروبات" },
      { barcode: "6221054321081", name: "بن العروبة سادة 100ج", purchase_price: 30, retail_price: 40, wholesale_price: 36, quantity: 30, unit: "باكو", low_stock_limit: 10, category: "عصائر ومشروبات" },

      // بقالة وزيوت
      { barcode: "6224000334444", name: "أرز المطبخ ممتاز 1 كيلو", purchase_price: 22, retail_price: 28, wholesale_price: 26, quantity: 110, unit: "كيلو", low_stock_limit: 20, category: "بقالة وزيوت" },
      { barcode: "6224000334451", name: "أرز الضحى فاخر 1 كيلو", purchase_price: 27, retail_price: 35, wholesale_price: 32, quantity: 85, unit: "كيلو", low_stock_limit: 20, category: "بقالة وزيوت" },
      { barcode: "6224000334468", name: "أرز الساعة 5 كيلو", purchase_price: 125, retail_price: 155, wholesale_price: 142, quantity: 30, unit: "شكارة", low_stock_limit: 8, category: "بقالة وزيوت" },
      { barcode: "6224000334475", name: "زيت عافية عباد الشمس 1.6 لتر", purchase_price: 95, retail_price: 120, wholesale_price: 110, quantity: 40, unit: "زجاجة", low_stock_limit: 10, category: "بقالة وزيوت" },
      { barcode: "6224000334482", name: "زيت كريستال ذرة 800 مل", purchase_price: 62, retail_price: 78, wholesale_price: 72, quantity: 50, unit: "زجاجة", low_stock_limit: 12, category: "بقالة وزيوت" },
      { barcode: "6224000334499", name: "زيت هلا عباد 800 مل", purchase_price: 48, retail_price: 60, wholesale_price: 55, quantity: 65, unit: "زجاجة", low_stock_limit: 15, category: "بقالة وزيوت" },
      { barcode: "6224000334505", name: "زيت زيتون وادي فود 500 مل", purchase_price: 140, retail_price: 180, wholesale_price: 165, quantity: 16, unit: "زجاجة", low_stock_limit: 5, category: "بقالة وزيوت" },
      { barcode: "6224000334512", name: "سمنة كريستال ذرة 700ج", purchase_price: 58, retail_price: 74, wholesale_price: 68, quantity: 32, unit: "برطمان", low_stock_limit: 10, category: "بقالة وزيوت" },
      { barcode: "6224000334529", name: "سمنة روابي بلدي 1.5 كيلو", purchase_price: 115, retail_price: 145, wholesale_price: 132, quantity: 22, unit: "علبة", low_stock_limit: 6, category: "بقالة وزيوت" },
      { barcode: "6224000334536", name: "مكرونة الملكة اسباجيتي 400ج", purchase_price: 9.5, retail_price: 13, wholesale_price: 11.5, quantity: 140, unit: "كيس", low_stock_limit: 30, category: "بقالة وزيوت" },
      { barcode: "6224000334543", name: "مكرونة الملكة بنة 400ج", purchase_price: 9.5, retail_price: 13, wholesale_price: 11.5, quantity: 150, unit: "كيس", low_stock_limit: 30, category: "بقالة وزيوت" },
      { barcode: "6224000334550", name: "مكرونة الضحى شعرية 400ج", purchase_price: 12, retail_price: 16, wholesale_price: 14.5, quantity: 90, unit: "كيس", low_stock_limit: 20, category: "بقالة وزيوت" },
      { barcode: "6224000334567", name: "مكرونة حواء لسان عصفور 400ج", purchase_price: 9, retail_price: 12.5, wholesale_price: 11, quantity: 110, unit: "كيس", low_stock_limit: 25, category: "بقالة وزيوت" },
      { barcode: "6224000334574", name: "دقيق الضحى فاخر 1 كيلو", purchase_price: 18, retail_price: 24, wholesale_price: 22, quantity: 75, unit: "كيلو", low_stock_limit: 20, category: "بقالة وزيوت" },
      { barcode: "6224000334581", name: "دقيق المطبخ 1 كيلو", purchase_price: 16, retail_price: 21, wholesale_price: 19, quantity: 95, unit: "كيلو", low_stock_limit: 20, category: "بقالة وزيوت" },
      { barcode: "6224000334598", name: "سكر الأسرة 1 كيلو", purchase_price: 27, retail_price: 35, wholesale_price: 32, quantity: 130, unit: "كيلو", low_stock_limit: 30, category: "بقالة وزيوت" },
      { barcode: "6224000334604", name: "سكر المطبخ بلوري 1 كيلو", purchase_price: 26, retail_price: 34, wholesale_price: 31, quantity: 100, unit: "كيلو", low_stock_limit: 25, category: "بقالة وزيوت" },
      { barcode: "6224000334611", name: "ملح طعام بونو 300ج", purchase_price: 2.5, retail_price: 4, wholesale_price: 3.5, quantity: 200, unit: "كيس", low_stock_limit: 40, category: "بقالة وزيوت" },

      // معلبات وصلصات
      { barcode: "6225000441011", name: "صلصة طماطم هاينز 360ج", purchase_price: 18, retail_price: 24, wholesale_price: 21, quantity: 60, unit: "برطمان", low_stock_limit: 15, category: "معلبات وصلصات" },
      { barcode: "6225000441028", name: "صلصة فاين فودز 280ج", purchase_price: 14, retail_price: 19, wholesale_price: 17, quantity: 70, unit: "برطمان", low_stock_limit: 15, category: "معلبات وصلصات" },
      { barcode: "6225000441035", name: "كاتشب هاينز ضاغط 285ج", purchase_price: 25, retail_price: 32, wholesale_price: 29, quantity: 45, unit: "عبوة", low_stock_limit: 10, category: "معلبات وصلصات" },
      { barcode: "6225000441042", name: "مايونيز هاينز 285ج", purchase_price: 28, retail_price: 36, wholesale_price: 32, quantity: 38, unit: "عبوة", low_stock_limit: 10, category: "معلبات وصلصات" },
      { barcode: "6225000441059", name: "تونة سان جيو مفتتة 185ج", purchase_price: 28, retail_price: 36, wholesale_price: 32, quantity: 80, unit: "علبة", low_stock_limit: 20, category: "معلبات وصلصات" },
      { barcode: "6225000441066", name: "تونة دولفين قطع 200ج", purchase_price: 42, retail_price: 54, wholesale_price: 48, quantity: 65, unit: "علبة", low_stock_limit: 15, category: "معلبات وصلصات" },
      { barcode: "6225000441073", name: "فول حدائق كاليفورنيا 400ج", purchase_price: 11, retail_price: 15, wholesale_price: 13.5, quantity: 120, unit: "علبة", low_stock_limit: 25, category: "معلبات وصلصات" },
      { barcode: "6225000441080", name: "فول أمريكانا خلطة 400ج", purchase_price: 10.5, retail_price: 14.5, wholesale_price: 13, quantity: 110, unit: "علبة", low_stock_limit: 25, category: "معلبات وصلصات" },
      { barcode: "6225000441097", name: "مشروم أمريكانا شرائح 400ج", purchase_price: 32, retail_price: 42, wholesale_price: 38, quantity: 35, unit: "علبة", low_stock_limit: 10, category: "معلبات وصلصات" },
      { barcode: "6225000441103", name: "ذرة حلوة جولد ليف 340ج", purchase_price: 26, retail_price: 34, wholesale_price: 30, quantity: 40, unit: "علبة", low_stock_limit: 10, category: "معلبات وصلصات" },
      { barcode: "6225000441110", name: "مرقة دجاج فاين فودز 12 مكعب", purchase_price: 12, retail_price: 16, wholesale_price: 14.5, quantity: 95, unit: "علبة", low_stock_limit: 20, category: "معلبات وصلصات" },
      { barcode: "6225000441127", name: "خردل هاينز أصفر 220ج", purchase_price: 22, retail_price: 29, wholesale_price: 26, quantity: 28, unit: "عبوة", low_stock_limit: 8, category: "معلبات وصلصات" },

      // مجمدات ومصنعات
      { barcode: "6226000552018", name: "برجر أطياب بقرى 8 قطع", purchase_price: 75, retail_price: 98, wholesale_price: 88, quantity: 22, unit: "علبة", low_stock_limit: 8, category: "مجمدات ومصنعات" },
      { barcode: "6226000552025", name: "كفتة أطياب مشوية 900ج", purchase_price: 110, retail_price: 140, wholesale_price: 128, quantity: 18, unit: "كيس", low_stock_limit: 6, category: "مجمدات ومصنعات" },
      { barcode: "6226000552032", name: "بانيه كوكي عادي 1 كيلو", purchase_price: 120, retail_price: 155, wholesale_price: 140, quantity: 25, unit: "علبة", low_stock_limit: 8, category: "مجمدات ومصنعات" },
      { barcode: "6226000552049", name: "بانيه كوكي حار 1 كيلو", purchase_price: 120, retail_price: 155, wholesale_price: 140, quantity: 20, unit: "علبة", low_stock_limit: 8, category: "مجمدات ومصنعات" },
      { barcode: "6226000552056", name: "فراخ مجمده العابد 1.1 كيلو", purchase_price: 105, retail_price: 130, wholesale_price: 120, quantity: 15, unit: "قطعة", low_stock_limit: 5, category: "مجمدات ومصنعات" },
      { barcode: "6226000552063", name: "ملوخية بسمة مجمده 400ج", purchase_price: 12, retail_price: 16.5, wholesale_price: 14.5, quantity: 50, unit: "كيس", low_stock_limit: 15, category: "مجمدات ومصنعات" },
      { barcode: "6226000552070", name: "خضار مشكل بسمة 400ج", purchase_price: 14, retail_price: 19, wholesale_price: 17, quantity: 45, unit: "كيس", low_stock_limit: 12, category: "مجمدات ومصنعات" },
      { barcode: "6226000552087", name: "بطاطس فارم فرتس 2.5 كيلو", purchase_price: 95, retail_price: 125, wholesale_price: 112, quantity: 16, unit: "كيس", low_stock_limit: 5, category: "مجمدات ومصنعات" },
      { barcode: "6226000552094", name: "جلاش الكرامة 350ج", purchase_price: 15, retail_price: 21, wholesale_price: 18.5, quantity: 40, unit: "لفة", low_stock_limit: 10, category: "مجمدات ومصنعات" },
      { barcode: "6226000552100", name: "سمبوسك الكرامة بالجبنة 500ج", purchase_price: 28, retail_price: 36, wholesale_price: 32, quantity: 30, unit: "علبة", low_stock_limit: 10, category: "مجمدات ومصنعات" },

      // تسالي وشوكولاتة
      { barcode: "6222012345678", name: "شوكولاتة جالاكسي بالبندق", purchase_price: 12, retail_price: 18, wholesale_price: 16, quantity: 12, unit: "قطعة", low_stock_limit: 25, category: "تسالي وشوكولاتة" },
      { barcode: "6227000663015", name: "شيبسي طماطم عائلي", purchase_price: 8, retail_price: 12, wholesale_price: 10.5, quantity: 85, unit: "كيس", low_stock_limit: 20, category: "تسالي وشوكولاتة" },
      { barcode: "6227000663022", name: "شيبسي ملح وخل كبير", purchase_price: 8, retail_price: 12, wholesale_price: 10.5, quantity: 90, unit: "كيس", low_stock_limit: 20, category: "تسالي وشوكولاتة" },
      { barcode: "6227000663039", name: "دوريتوس بالجبنة الناتشو", purchase_price: 9, retail_price: 13, wholesale_price: 11.5, quantity: 70, unit: "كيس", low_stock_limit: 15, category: "تسالي وشوكولاتة" },
      { barcode: "6227000663046", name: "بيج شيبس فلفل حلو", purchase_price: 5, retail_price: 8, wholesale_price: 7, quantity: 110, unit: "كيس", low_stock_limit: 25, category: "تسالي وشوكولاتة" },
      { barcode: "6227000663053", name: "شوكولاتة كادبوري بابلي 87ج", purchase_price: 22, retail_price: 30, wholesale_price: 26, quantity: 40, unit: "قطعة", low_stock_limit: 12, category: "تسالي وشوكولاتة" },
      { barcode: "6227000663060", name: "شوكولاتة كيت كات 4 أصابع", purchase_price: 15, retail_price: 21, wholesale_price: 18.5, quantity: 65, unit: "قطعة", low_stock_limit: 15, category: "تسالي وشوكولاتة" },
      { barcode: "6227000663077", name: "بسكويت أولكر لوكر بالموز", purchase_price: 6, retail_price: 9, wholesale_price: 8, quantity: 100, unit: "قطعة", low_stock_limit: 20, category: "تسالي وشوكولاتة" },
      { barcode: "6227000663084", name: "بسكويت بيمبو الشوكولاتة", purchase_price: 4.5, retail_price: 7, wholesale_price: 6, quantity: 130, unit: "قطعة", low_stock_limit: 30, category: "تسالي وشوكولاتة" },
      { barcode: "6227000663091", name: "بسكويت شاي أولكر 12 قطعة", purchase_price: 3.5, retail_price: 5, wholesale_price: 4.5, quantity: 150, unit: "باكو", low_stock_limit: 35, category: "تسالي وشوكولاتة" },
      { barcode: "6227000663107", name: "مارشميلو كاندي 150ج", purchase_price: 12, retail_price: 17, wholesale_price: 15, quantity: 45, unit: "كيس", low_stock_limit: 10, category: "تسالي وشوكولاتة" },
      { barcode: "6227000663114", name: "لبان كليرتس نعناع", purchase_price: 2, retail_price: 3.5, wholesale_price: 3, quantity: 200, unit: "شريط", low_stock_limit: 40, category: "تسالي وشوكولاتة" },

      // منظفات ورقيات
      { barcode: "6228000774012", name: "مسحوق أريال أوتوماتيك 4 كيلو", purchase_price: 180, retail_price: 230, wholesale_price: 210, quantity: 25, unit: "شكارة", low_stock_limit: 8, category: "منظفات ورقيات" },
      { barcode: "6228000774029", name: "مسحوق برسيل جيل 2.6 لتر", purchase_price: 125, retail_price: 160, wholesale_price: 145, quantity: 30, unit: "زجاجة", low_stock_limit: 8, category: "منظفات ورقيات" },
      { barcode: "6228000774036", name: "مسحوق باهي يدوي 1 كيلو", purchase_price: 28, retail_price: 36, wholesale_price: 32, quantity: 60, unit: "كيس", low_stock_limit: 15, category: "منظفات ورقيات" },
      { barcode: "6228000774043", name: "صابون أطباق فيري 650 مل", purchase_price: 32, retail_price: 42, wholesale_price: 38, quantity: 50, unit: "زجاجة", low_stock_limit: 12, category: "منظفات ورقيات" },
      { barcode: "6228000774050", name: "صابون أطباق بريل 1 لتر", purchase_price: 24, retail_price: 32, wholesale_price: 28, quantity: 65, unit: "زجاجة", low_stock_limit: 15, category: "منظفات ورقيات" },
      { barcode: "6228000774067", name: "مناديل فاين ناعمة 550 منديل", purchase_price: 48, retail_price: 62, wholesale_price: 56, quantity: 40, unit: "علبة", low_stock_limit: 10, category: "منظفات ورقيات" },
      { barcode: "6228000774074", name: "مناديل مطبخ زينة 4 رول", purchase_price: 32, retail_price: 42, wholesale_price: 38, quantity: 45, unit: "لفة", low_stock_limit: 12, category: "منظفات ورقيات" },
      { barcode: "6228000774081", name: "ورق تواليت فاين 6 رول", purchase_price: 38, retail_price: 50, wholesale_price: 45, quantity: 35, unit: "لفة", low_stock_limit: 10, category: "منظفات ورقيات" },
      { barcode: "6228000774098", name: "ورق ألومنيوم فريش 10 متر", purchase_price: 28, retail_price: 37, wholesale_price: 33, quantity: 50, unit: "لفة", low_stock_limit: 12, category: "منظفات ورقيات" },
      { barcode: "6228000774104", name: "أكياس قمامة زينة 70x90 سم", purchase_price: 22, retail_price: 30, wholesale_price: 26, quantity: 55, unit: "لفة", low_stock_limit: 15, category: "منظفات ورقيات" },

      // عناية شخصية
      { barcode: "6229000885019", name: "صابون لوكس معطر 120ج", purchase_price: 9, retail_price: 13, wholesale_price: 11.5, quantity: 120, unit: "قطعة", low_stock_limit: 25, category: "عناية شخصية" },
      { barcode: "6229000885026", name: "صابون دوف بيضاء 100ج", purchase_price: 18, retail_price: 25, wholesale_price: 22, quantity: 90, unit: "قطعة", low_stock_limit: 20, category: "عناية شخصية" },
      { barcode: "6229000885033", name: "شامبو هيد اند شولدرز 400مل", purchase_price: 55, retail_price: 72, wholesale_price: 65, quantity: 30, unit: "عبوة", low_stock_limit: 8, category: "عناية شخصية" },
      { barcode: "6229000885040", name: "شامبو بانتين بديل الزيت 360مل", purchase_price: 50, retail_price: 66, wholesale_price: 58, quantity: 28, unit: "عبوة", low_stock_limit: 8, category: "عناية شخصية" },
      { barcode: "6229000885057", name: "معجون أسنان سيجنال 120مل", purchase_price: 20, retail_price: 27, wholesale_price: 24, quantity: 70, unit: "أنبوب", low_stock_limit: 15, category: "عناية شخصية" },
      { barcode: "6229000885064", name: "معجون أسنان سنسوداين 75مل", purchase_price: 42, retail_price: 56, wholesale_price: 50, quantity: 40, unit: "أنبوب", low_stock_limit: 10, category: "عناية شخصية" },
      { barcode: "6229000885071", name: "بلسم صان سيلك ليمون 350مل", purchase_price: 32, retail_price: 43, wholesale_price: 38, quantity: 35, unit: "عبوة", low_stock_limit: 10, category: "عناية شخصية" },
      { barcode: "6229000885088", name: "شاور جيل كاماي أحمر 750مل", purchase_price: 45, retail_price: 60, wholesale_price: 53, quantity: 25, unit: "عبوة", low_stock_limit: 6, category: "عناية شخصية" },
      { barcode: "6229000885095", name: "حفاضات بيللا مقاس 4 كبير 40 حفاضة", purchase_price: 130, retail_price: 165, wholesale_price: 150, quantity: 20, unit: "عبوة", low_stock_limit: 5, category: "عناية شخصية" },
      { barcode: "6229000885101", name: "فوائد صحية أولويز بلس 16 قطعة", purchase_price: 32, retail_price: 42, wholesale_price: 38, quantity: 50, unit: "عبوة", low_stock_limit: 12, category: "عناية شخصية" },

      // عطارة ومستلزمات
      { barcode: "6221000996016", name: "فلفل أسود حصى 100ج", purchase_price: 25, retail_price: 34, wholesale_price: 30, quantity: 60, unit: "كيس", low_stock_limit: 15, category: "عطارة ومستلزمات" },
      { barcode: "6221000996023", name: "كمون مطحون 100ج", purchase_price: 28, retail_price: 38, wholesale_price: 34, quantity: 55, unit: "كيس", low_stock_limit: 15, category: "عطارة ومستلزمات" },
      { barcode: "6221000996030", name: "شطة حارة مطحونة 100ج", purchase_price: 15, retail_price: 22, wholesale_price: 19, quantity: 70, unit: "كيس", low_stock_limit: 15, category: "عطارة ومستلزمات" },
      { barcode: "6221000996047", name: "كركديه أسواني فاخر 250ج", purchase_price: 35, retail_price: 48, wholesale_price: 42, quantity: 40, unit: "كيس", low_stock_limit: 10, category: "عطارة ومستلزمات" },
      { barcode: "6221000996054", name: "فاصوليا بيضاء الضحى 500ج", purchase_price: 28, retail_price: 36, wholesale_price: 32, quantity: 45, unit: "كيس", low_stock_limit: 10, category: "عطارة ومستلزمات" },
      { barcode: "6221000996061", name: "عدس أصفر الضحى 500ج", purchase_price: 26, retail_price: 34, wholesale_price: 30, quantity: 50, unit: "كيس", low_stock_limit: 12, category: "عطارة ومستلزمات" },
      { barcode: "6221000996078", name: "خميرة فورية كوكس 11ج", purchase_price: 3, retail_price: 5, wholesale_price: 4, quantity: 250, unit: "ظرف", low_stock_limit: 50, category: "عطارة ومستلزمات" },
      { barcode: "6221000996085", name: "بيكنج بودر كوكس 16ج", purchase_price: 3, retail_price: 5, wholesale_price: 4, quantity: 240, unit: "ظرف", low_stock_limit: 50, category: "عطارة ومستلزمات" },
      { barcode: "6221000996092", name: "فانيليا كوكس 5 أظرف", purchase_price: 4, retail_price: 6.5, wholesale_price: 5.5, quantity: 180, unit: "علبة", low_stock_limit: 30, category: "عطارة ومستلزمات" },
      { barcode: "6221000996108", name: "خل أبيض هاينز 1 لتر", purchase_price: 12, retail_price: 17, wholesale_price: 15, quantity: 80, unit: "زجاجة", low_stock_limit: 20, category: "عطارة ومستلزمات" }
    ];

    for (const item of sample100Items) {
      const existing = await dbGet("SELECT id FROM items WHERE barcode = ?", [item.barcode]);
      if (!existing) {
        await dbRun(
          `INSERT INTO items (barcode, name, purchase_price, retail_price, wholesale_price, quantity, unit, low_stock_limit, category)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.barcode, item.name, item.purchase_price, item.retail_price, item.wholesale_price, item.quantity, item.unit, item.low_stock_limit, item.category]
        );
      }
    }

    // Seed Tamween Supplier + Items
    const tamweenSup = await dbGet("SELECT id FROM suppliers WHERE name = ? AND is_tamween_supplier = 1", ["مخزن التموين"]);
    if (!tamweenSup) {
      const supResult = await dbRun("INSERT INTO suppliers (name, phone, address, is_tamween_supplier) VALUES (?, ?, ?, 1)", ["مخزن التموين", "01012345678", "شارع التموين، القاهرة"]);
      const tamweenItems = [
        { barcode: "8801000000001", name: "سكر تمويني", purchase_price: 12.35, retail_price: 12.5, wholesale_price: 12.5, quantity: 200, unit: "كيلو", low_stock_limit: 50, category: "تموين" },
        { barcode: "8801000000002", name: "زيت تمويني 800مل", purchase_price: 29.75, retail_price: 30, wholesale_price: 30, quantity: 100, unit: "زجاجة", low_stock_limit: 20, category: "تموين" },
        { barcode: "8801000000003", name: "مكرونة تموين 350جم", purchase_price: 8.85, retail_price: 9, wholesale_price: 9, quantity: 150, unit: "كيس", low_stock_limit: 30, category: "تموين" },
        { barcode: "8801000000004", name: "جبنه تموين 250جم", purchase_price: 13.75, retail_price: 14, wholesale_price: 14, quantity: 120, unit: "علبة", low_stock_limit: 25, category: "تموين" },
      ];
      for (const item of tamweenItems) {
        const existing = await dbGet("SELECT id FROM items WHERE barcode = ?", [item.barcode]);
        if (!existing) {
          await dbRun(
            `INSERT INTO items (barcode, name, purchase_price, retail_price, wholesale_price, quantity, unit, low_stock_limit, category)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.barcode, item.name, item.purchase_price, item.retail_price, item.wholesale_price, item.quantity, item.unit, item.low_stock_limit, item.category]
          );
        }
      }
    }

    // Seed 10 Suppliers - DISABLED by owner (keep project data clean)
    const suppliersCount = await dbGet("SELECT COUNT(*) as count FROM suppliers");
    if (false && suppliersCount.count < 5) {
      const defaultSuppliers = [
        { name: "شركة الوداد لتجارة الجملة والتوزيع", phone: "01099887766", address: "شارع رمسيس، القاهرة" },
        { name: "مصنع النور للصناعات الغذائية والألبان", phone: "01222334455", address: "المنطقة الصناعية، 6 أكتوبر" },
        { name: "الشركة المصرية المتحدة للمشروبات والأغذية", phone: "01144556677", address: "ش جسر السويس، عين شمس" },
        { name: "مجموعة الأهرام للتجارة والتوريدات", phone: "01001122334", address: "طريق مصر إسكندرية الزراعي" },
        { name: "شركة الدلتا للتوزيع والخدمات اللوجستية", phone: "01288776655", address: "طنطا - شارع البحر" },
        { name: "مؤسسة البركة للمستوردات والمواد الغذائية", phone: "01555443322", address: "السويس - حي الأربعين" },
        { name: "شركة العالمية للمنظفات والورقيات", phone: "01033221100", address: "العاشر من رمضان - المنطقة الثالثة" },
        { name: "شركة النيل للزيوت والحبوب", phone: "01244556677", address: "الزقازيق - طريق المعاهد" },
        { name: "الشركة الوطنية للمجمدات واللحوم", phone: "01199887711", address: "الاسكندرية - كرموز" },
        { name: "شركة العبد للاستيراد والتصدير", phone: "01055443322", address: "دمياط - المنطقة الحرة" }
      ];
      for (const sup of defaultSuppliers) {
        await dbRun("INSERT INTO suppliers (name, phone, address) VALUES (?, ?, ?)", [sup.name, sup.phone, sup.address]);
      }
    }

    // Seed Invoices - DISABLED by owner (keep project data clean)
    const invoicesCount = await dbGet("SELECT COUNT(*) as count FROM invoices");
    if (false && invoicesCount.count < 8) {
      const pastDate = (daysAgo: number) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        return d.toISOString().split("T")[0];
      };
      const dateToday = new Date().toISOString().split("T")[0];

      const mockInvoicesData = [
        {
          num: "SINV-5001", type: "sales", daysAgo: 10, customer: "عميل كاش - سوبرماركت الهداية", payment: "cash_register", sale_type: "retail",
          subtotal: 450, tax: 45, discount: 15, total: 480, paid: 480, remaining: 0, by: "cashier",
          items: [
            { barcode: "6221000112222", name: "حليب جهينة كامل الدسم 1 لتر", qty: 5, unit: "علبة", price: 38, cost: 28, total: 190 },
            { barcode: "6223000101111", name: "جبنة عبور لاند فيتا 500ج", qty: 6, unit: "علبة", price: 30, cost: 24, total: 180 },
            { barcode: "6221034567890", name: "كوكا كولا كانز 330 مل", qty: 8, unit: "قطعة", price: 10, cost: 7, total: 80 }
          ]
        },
        {
          num: "PINV-6001", type: "purchases", daysAgo: 8, customer: "مصنع النور للصناعات الغذائية والألبان", payment: "main_safe", sale_type: null,
          subtotal: 3500, tax: 0, discount: 100, total: 3400, paid: 3400, remaining: 0, by: "store",
          items: [
            { barcode: "6223000101111", name: "جبنة عبور لاند فيتا 500ج", qty: 100, unit: "علبة", price: 24, cost: 24, total: 2400 },
            { barcode: "6221000112222", name: "حليب جهينة كامل الدسم 1 لتر", qty: 35, unit: "علبة", price: 28, cost: 28, total: 980 }
          ]
        },
        {
          num: "SINV-5002", type: "sales", daysAgo: 6, customer: "مطعم البرنس (عميل جملة)", payment: "cash_register", sale_type: "wholesale",
          subtotal: 1850, tax: 0, discount: 50, total: 1800, paid: 1800, remaining: 0, by: "admin",
          items: [
            { barcode: "6224000334444", name: "أرز المطبخ ممتاز 1 كيلو", qty: 50, unit: "كيلو", price: 26, cost: 22, total: 1300 },
            { barcode: "6224000334475", name: "زيت عافية عباد الشمس 1.6 لتر", qty: 5, unit: "زجاجة", price: 110, cost: 95, total: 550 }
          ]
        },
        {
          num: "SINV-5003", type: "sales", daysAgo: 4, customer: "عميل نقدي", payment: "cash_register", sale_type: "retail",
          subtotal: 320, tax: 32, discount: 0, total: 352, paid: 352, remaining: 0, by: "cashier",
          items: [
            { barcode: "6227000663015", name: "شيبسي طماطم عائلي", qty: 10, unit: "كيس", price: 12, cost: 8, total: 120 },
            { barcode: "6221054321012", name: "مياه نستله 1.5 لتر", qty: 10, unit: "زجاجة", price: 9, cost: 6, total: 90 },
            { barcode: "6222012345678", name: "شوكولاتة جالاكسي بالبندق", qty: 6, unit: "قطعة", price: 18, cost: 12, total: 108 }
          ]
        },
        {
          num: "PINV-6002", type: "purchases", daysAgo: 2, customer: "شركة العالمية للمنظفات والورقيات", payment: "main_safe", sale_type: null,
          subtotal: 5200, tax: 200, discount: 150, total: 5250, paid: 5250, remaining: 0, by: "admin",
          items: [
            { barcode: "6228000774012", name: "مسحوق أريال أوتوماتيك 4 كيلو", qty: 20, unit: "شكارة", price: 180, cost: 180, total: 3600 },
            { barcode: "6228000774067", name: "مناديل فاين ناعمة 550 منديل", qty: 30, unit: "علبة", price: 48, cost: 48, total: 1440 }
          ]
        },
        {
          num: "SINV-5004", type: "sales", daysAgo: 0, customer: "عميل نقدي افتراضي", payment: "cash_register", sale_type: "retail",
          subtotal: 580, tax: 0, discount: 20, total: 560, paid: 600, remaining: 0, by: "cashier",
          items: [
            { barcode: "6226000552032", name: "بانيه كوكي عادي 1 كيلو", qty: 2, unit: "علبة", price: 155, cost: 120, total: 310 },
            { barcode: "6224000334536", name: "مكرونة الملكة اسباجيتي 400ج", qty: 10, unit: "كيس", price: 13, cost: 9.5, total: 130 },
            { barcode: "6225000441011", name: "صلصة طماطم هاينز 360ج", qty: 5, unit: "برطمان", price: 24, cost: 18, total: 120 }
          ]
        }
      ];

      for (const inv of mockInvoicesData) {
        const invDate = inv.daysAgo === 0 ? dateToday : pastDate(inv.daysAgo);
        await dbRun(
          `INSERT INTO invoices (invoice_number, type, date, customer_supplier_name, payment_source, sale_type, subtotal, tax, discount, total, paid, remaining, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [inv.num, inv.type, invDate, inv.customer, inv.payment, inv.sale_type, inv.subtotal, inv.tax, inv.discount, inv.total, inv.paid, inv.remaining, inv.by, invDate + "T12:00:00Z"]
        );
        const invIdRes = await dbGet("SELECT last_insert_rowid() as id");
        const invId = invIdRes.id;
        for (const item of inv.items) {
          await dbRun(
            `INSERT INTO invoice_items (invoice_id, barcode, name, quantity, unit, price, cost_price, total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [invId, item.barcode, item.name, item.qty, item.unit, item.price, item.cost, item.total]
          );
        }
      }
    }

    // Seed Expenses - DISABLED by owner (keep project data clean)
    const expensesCount = await dbGet("SELECT COUNT(*) as count FROM expenses");
    if (false && expensesCount.count < 5) {
      const todayStr = new Date().toISOString().split("T")[0];
      const defaultExpenses = [
        { title: "شراء ثلاجة عرض ألبان رئيسية", amount: 14500.00, date: todayStr, category: "شراء جهاز", notes: "ثلاجة توشيبا 30 قدم جديدة" },
        { title: "أعمال صيانة وإصلاح التكييف المركزي", amount: 650.00, date: todayStr, category: "صيانة", notes: "تعبئة الفريون وتغيير فلتر الهواء" },
        { title: "تكلفة لافتة المحل الخارجية المضيئة", amount: 3200.00, date: todayStr, category: "بناء", notes: "لوحة ليد أكريليك باسم سوبرماركت المدينة" },
        { title: "فاتورة كهرباء ومياه شهرية", amount: 1850.00, date: todayStr, category: "فواتير خدمية", notes: "سداد فاتورة العداد التجاري" },
        { title: "رواتب ومستحقات العمال والكاشيرية", amount: 12000.00, date: todayStr, category: "أجور ومرتبات", notes: "مرتبات شهر كامل لجميع طاقم العمل" },
        { title: "مطبوعات وكراتين وتغليف الفواتير", amount: 800.00, date: todayStr, category: "دعاية وإعلان", notes: "أكياس مطبوعة باسم المحل ورول حراري" }
      ];
      for (const exp of defaultExpenses) {
        await dbRun("INSERT INTO expenses (title, amount, date, category, notes, payment_source) VALUES (?, ?, ?, ?, ?, ?)", [
          exp.title, exp.amount, exp.date, exp.category, exp.notes
        ]);
      }
    }

    // Seed Users if empty
    const usersCount = await dbGet("SELECT COUNT(*) as count FROM users");
    if (usersCount.count === 0) {
      const adminPermissions = JSON.stringify(["sales", "purchases", "items", "suppliers", "reports", "users"]);
      const cashierPermissions = JSON.stringify(["sales"]);
      const storekeeperPermissions = JSON.stringify(["purchases", "items", "suppliers"]);

      // تشويش كلمات السور بـ bcrypt
      const hashedAdmin = await bcrypt.hash("admin123", 10);
      const hashedCashier = await bcrypt.hash("cashier123", 10);
      const hashedStore = await bcrypt.hash("store123", 10);

      await dbRun(
        "INSERT INTO users (username, password, name, role, permissions) VALUES (?, ?, ?, ?, ?)",
        ["admin", hashedAdmin, "آسر المدير العام", "admin", adminPermissions]
      );
      await dbRun(
        "INSERT INTO users (username, password, name, role, permissions) VALUES (?, ?, ?, ?, ?)",
        ["cashier", hashedCashier, "إياد الكاشير", "cashier", cashierPermissions]
      );
      await dbRun(
        "INSERT INTO users (username, password, name, role, permissions) VALUES (?, ?, ?, ?, ?)",
        ["store", hashedStore, "ياسين أمين المخزن", "storekeeper", storekeeperPermissions]
      );
    }

    // Log seed completion
    await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, 'SYSTEM', 'تغذية البيانات الشاملة', ?)", [
      new Date().toISOString(),
      "تم إدراج 105 صنف متكامل وتغذية قاعدة البيانات بالموردين والفواتير والمصروفات"
    ]);
  }

  // Auto-run seed if items count < 50
  const currentItemsCount = await dbGet("SELECT COUNT(*) as count FROM items");
  if (currentItemsCount.count < 50) {
    await seed100ItemsAndFullData();
  }

  // Ensure Developer Account (innocode / yrcode) always exists
  try {
    const devPermissions = JSON.stringify([
      "sales", "purchases", "items", "suppliers", "reports", "users", "developer",
      "dashboard_stats", "view_purchases_invoices", "edit_invoice", "delete_invoice", "return_invoice"
    ]);
    const devUserExists = await dbGet("SELECT * FROM users WHERE username = ?", ["ME561128"]);
    if (!devUserExists) {
      await dbRun(
        "INSERT INTO users (username, password, name, role, permissions) VALUES (?, ?, ?, ?, ?)",
        ["ME561128", "561128", "منظومة الكابتن — لهندسة الأرقام وريادة الأعمال - 01010561128", "developer", devPermissions]
      );
      // تنظيف الحساب القديم innocode لو موجود
      await dbRun("DELETE FROM users WHERE username = ?", ["innocode"]);
    } else {
      await dbRun(
        "UPDATE users SET password = ?, name = ?, role = 'developer', permissions = ? WHERE username = ?",
        ["561128", "منظومة الكابتن — لهندسة الأرقام وريادة الأعمال - 01010561128", devPermissions, "ME561128"]
      );
      await dbRun("DELETE FROM users WHERE username = ?", ["innocode"]);
    }
  } catch (err) {
    console.error("Error syncing innocode developer account:", err);
  }

  // Standalone seed for Partners and Expenses (DISABLED)
  /*
  const partnersCount = await dbGet("SELECT COUNT(*) as count FROM partners");
  // ...
  const expensesCount = await dbGet("SELECT COUNT(*) as count FROM expenses");
  // ...
  */

  // ============================================
  // API - SYNC FROM LOCALSTORAGE
  // ============================================
  app.post("/api/sync-from-local", async (req, res) => {
    try {
      // المزامنة التلقائية معطلة بقرار المالك - تتطلب تأكيداً صريحاً
      if ((req.body as any)?.confirmed !== true) {
        return res.status(403).json({ success: false, error: "المزامنة التلقائية معطلة" });
      }
      const { items, suppliers, invoices, invoice_items, partners, expenses, users, settings } = req.body;
      const results = { items: 0, suppliers: 0, invoices: 0, partners: 0, expenses: 0, users: 0, settings: 0 };
      if (items?.length) for (const i of items) { try { await dbRun(`INSERT OR REPLACE INTO items (id, barcode, name, purchase_price, retail_price, wholesale_price, quantity, unit, low_stock_limit, category, supplier, supplier_id, supplier_name, is_unlimited) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [i.id, i.barcode, i.name, i.purchase_price, i.retail_price, i.wholesale_price, i.quantity, i.unit, i.low_stock_limit, i.category||'عام', i.supplier||'', i.supplier_id||null, i.supplier_name||'', i.is_unlimited||0]); results.items++; } catch {} }
      if (suppliers?.length) for (const s of suppliers) { try { await dbRun(`INSERT OR REPLACE INTO suppliers (id, name, phone, address) VALUES (?,?,?,?)`, [s.id, s.name, s.phone, s.address]); results.suppliers++; } catch {} }
      if (invoices?.length) for (const inv of invoices) { try { await dbRun(`INSERT OR REPLACE INTO invoices (id, invoice_number, type, date, customer_supplier_name, payment_source, sale_type, subtotal, tax, discount, total, paid, remaining, created_by, created_at, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [inv.id, inv.invoice_number, inv.type, inv.date, inv.customer_supplier_name, inv.payment_source, inv.sale_type, inv.subtotal, inv.tax, inv.discount, inv.total, inv.paid, inv.remaining, inv.created_by, inv.created_at, inv.status||'active']); results.invoices++; } catch {} }
      if (invoice_items?.length) for (const ii of invoice_items) { try { await dbRun(`INSERT OR REPLACE INTO invoice_items (id, invoice_id, barcode, name, quantity, unit, price, cost_price, total, returned_quantity) VALUES (?,?,?,?,?,?,?,?,?,?)`, [ii.id, ii.invoice_id, ii.barcode, ii.name, ii.quantity, ii.unit, ii.price, ii.cost_price, ii.total, ii.returned_quantity||0]); } catch {} }
      if (partners?.length) for (const p of partners) { try { await dbRun(`INSERT OR REPLACE INTO partners (id, name, fixed_profit_percentage, purchase_percentage) VALUES (?,?,?,?)`, [p.id, p.name, p.fixed_profit_percentage, p.purchase_percentage]); results.partners++; } catch {} }
      if (expenses?.length) for (const e of expenses) { try { await dbRun(`INSERT OR REPLACE INTO expenses (id, title, amount, date, category, notes) VALUES (?,?,?,?,?,?)`, [e.id, e.title, e.amount, e.date, e.category, e.notes]); results.expenses++; } catch {} }
      if (users?.length) for (const u of users) { try { await dbRun(`INSERT OR REPLACE INTO users (id, username, password, name, role, permissions) VALUES (?,?,?,?,?,?)`, [u.id, u.username, u.password, u.name, u.role, JSON.stringify(u.permissions||[])]); results.users++; } catch {} }
      if (settings) for (const [k,v] of Object.entries(settings)) { try { await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)`, [k, String(v)]); results.settings++; } catch {} }
      console.log('✅ Sync completed:', results);
      res.json({ success: true, results });
    } catch (err: any) { console.error('Sync error:', err); res.status(500).json({ success: false, error: err.message }); }
  });

  app.get("/api/db-stats", async (req, res) => {
    try {
      const items = await dbGet("SELECT COUNT(*) as c FROM items");
      const invoices = await dbGet("SELECT COUNT(*) as c FROM invoices");
      res.json({ items: items.c, invoices: invoices.c });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  // API - IMPORT FROM JSON FILES
  // ============================================
  const DATA_PATH = path.join(_currentDir, 'src', 'components', 'jameety', 'data', 'ymarket');

  app.post("/api/import-json", async (req, res) => {
    try {
      const fs = require('fs');
      const results: any = { items: 0, invoices: 0, invoice_items: 0, suppliers: 0, users: 0, partners: 0, expenses: 0 };

      // Helper to read JSON file
      const readJson = (filePath: string) => {
        try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return []; }
      };

      // Import Items
      const items = readJson(path.join(DATA_PATH, 'items', 'ymarket_items.json'));
      for (const i of items) {
        try {
          await dbRun(`INSERT OR REPLACE INTO items (id, barcode, name, purchase_price, retail_price, wholesale_price, quantity, unit, low_stock_limit, is_unlimited) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [i.id, i.barcode, i.name, i.purchase_price, i.retail_price, i.wholesale_price, i.quantity, i.unit, i.low_stock_limit, i.is_unlimited || 0]);
          results.items++;
        } catch {}
      }

      // Import Suppliers
      const suppliers = readJson(path.join(DATA_PATH, 'suppliers', 'ymarket_suppliers.json'));
      for (const s of suppliers) {
        try { await dbRun(`INSERT OR REPLACE INTO suppliers (id, name, phone, address) VALUES (?,?,?,?)`, [s.id, s.name, s.phone, s.address]); results.suppliers++; } catch {}
      }

      // Import Invoices
      const invoices = readJson(path.join(DATA_PATH, 'invoices', 'ymarket_invoices.json'));
      for (const inv of invoices) {
        try {
          await dbRun(`INSERT OR REPLACE INTO invoices (id, invoice_number, type, date, customer_supplier_name, payment_source, sale_type, subtotal, tax, discount, total, paid, remaining, created_by, created_at, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [inv.id, inv.invoice_number, inv.type, inv.date, inv.customer_supplier_name, inv.payment_source, inv.sale_type, inv.subtotal, inv.tax, inv.discount, inv.total, inv.paid, inv.remaining, inv.created_by, inv.created_at, inv.status || 'active']);
          results.invoices++;
        } catch {}
      }

      // Import Invoice Items
      const invoiceItems = readJson(path.join(DATA_PATH, 'invoices', 'ymarket_invoice_items.json'));
      for (const ii of invoiceItems) {
        try { await dbRun(`INSERT OR REPLACE INTO invoice_items (id, invoice_id, barcode, name, quantity, unit, price, cost_price, total, returned_quantity) VALUES (?,?,?,?,?,?,?,?,?,?)`, [ii.id, ii.invoice_id, ii.barcode, ii.name, ii.quantity, ii.unit, ii.price, ii.cost_price, ii.total, ii.returned_quantity || 0]); results.invoice_items++; } catch {}
      }

      // Import Users
      const users = readJson(path.join(DATA_PATH, 'users', 'ymarket_users.json'));
      for (const u of users) {
        try { await dbRun(`INSERT OR REPLACE INTO users (id, username, password, name, role, permissions) VALUES (?,?,?,?,?,?)`, [u.id, u.username, u.password, u.name, u.role, JSON.stringify(u.permissions)]); results.users++; } catch {}
      }

      // Import Partners
      const partners = readJson(path.join(DATA_PATH, 'partners', 'ymarket_partners.json'));
      for (const p of partners) {
        try { await dbRun(`INSERT OR REPLACE INTO partners (id, name, fixed_profit_percentage, purchase_percentage) VALUES (?,?,?,?)`, [p.id, p.name, p.fixed_profit_percentage, p.purchase_percentage]); results.partners++; } catch {}
      }

      // Import Expenses
      const expenses = readJson(path.join(DATA_PATH, 'expenses', 'ymarket_expenses.json'));
      for (const e of expenses) {
        try { await dbRun(`INSERT OR REPLACE INTO expenses (id, title, amount, date, category, notes) VALUES (?,?,?,?,?,?)`, [e.id, e.title, e.amount, e.date, e.category, e.notes]); results.expenses++; } catch {}
      }

      console.log('✅ Import from JSON completed:', results);
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'استيراد JSON', ?)", [
        new Date().toISOString(),
        "النظام",
        `تم استيراد: ${results.items} منتج, ${results.invoices} فاتورة, ${results.suppliers} مورد, ${results.users} مستخدم`
      ]);
      res.json({ success: true, results });
    } catch (err: any) {
      console.error('Import error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API - Auth Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      // جلب المستخدم بالاسم فقط
      const user = await dbGet("SELECT id, username, password, name, role, permissions FROM users WHERE username = ?", [username]);
      if (!user) {
        return res.status(401).json({ success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      
      // مقارنة كلمة السور المشوشه
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      user.permissions = JSON.parse(user.permissions);
      
      // إنشاء JWT Token
      const token = jwt.sign(
        { id: user.id, username: user.username, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      
      // Log Login Action
      const timestamp = new Date().toISOString();
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'تسجيل دخول', ?)", [
        timestamp,
        user.name,
        `دخل المستخدم ${user.username} إلى النظام`
      ]);

      // إرسال Token + بيانات المستخدم (بدون كلمة السور)
      return res.json({ success: true, token, user: { id: user.id, username: user.username, name: user.name, role: user.role, permissions: user.permissions } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API - Operation Logs
  app.get("/api/logs", async (req, res) => {
    try {
      const logsList = await dbAll("SELECT * FROM logs ORDER BY id DESC LIMIT 300");
      res.json(logsList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Get Settings
  app.get("/api/settings", async (req, res) => {
    try {
      const rows = await dbAll("SELECT * FROM settings");
      const settingsObj: Record<string, string> = {};
      rows.forEach((r) => {
        settingsObj[r.key] = r.value;
      });
      res.json(settingsObj);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Save Settings
  app.post("/api/settings", async (req, res) => {
    try {
      const { settings, user_name } = req.body;
      if (!settings || typeof settings !== "object") {
        return res.status(400).json({ error: "تنسيق البيانات غير صحيح" });
      }

      for (const [key, value] of Object.entries(settings)) {
        await dbRun(
          "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
          [key, String(value), String(value)]
        );
      }

      // Record log
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'تعديل إعدادات المتجر', ?)", [
        new Date().toISOString(),
        user_name || "المدير العام",
        "تم تغيير إعدادات الهوية وسياقات الضريبة ونسبة القيمة المضافة لدرج المبيعات بنجاح."
      ]);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Users CRUD — Admin only + Auth
  app.get("/api/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const usersList = await dbAll("SELECT id, username, name, role, permissions FROM users");
      const sanitized = usersList.map(u => ({ ...u, permissions: JSON.parse(u.permissions || "[]") }));
      res.json(sanitized);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { username, password, name, role, permissions, logCreator } = req.body;
      const permString = JSON.stringify(permissions || []);
      // تشويش كلمة السور بـ bcrypt
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await dbRun(
        "INSERT INTO users (username, password, name, role, permissions) VALUES (?, ?, ?, ?, ?)",
        [username, hashedPassword, name, role, permString]
      );
      
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'إضافة مستخدم', ?)", [
        new Date().toISOString(),
        logCreator || "المدير",
        `تم إضافة مستخدم جديد: ${name} (${username}) بصلاحية ${role}`
      ]);

      res.json({ id: result.id, success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, name, role, permissions, logCreator } = req.body;
      const permString = JSON.stringify(permissions || []);
      
      if (password) {
        // تشويش كلمة السور الجديدة بـ bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);
        await dbRun(
          "UPDATE users SET username = ?, password = ?, name = ?, role = ?, permissions = ? WHERE id = ?",
          [username, hashedPassword, name, role, permString, id]
        );
      } else {
        await dbRun(
          "UPDATE users SET username = ?, name = ?, role = ?, permissions = ? WHERE id = ?",
          [username, name, role, permString, id]
        );
      }

      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'تعديل مستخدم', ?)", [
        new Date().toISOString(),
        logCreator || "المدير",
        `تم تعديل بيانات المستخدم ID: ${id} واسمه: ${name}`
      ]);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { logCreator } = req.query;
      const user = await dbGet("SELECT name FROM users WHERE id = ?", [id]);
      
      await dbRun("DELETE FROM users WHERE id = ?", [id]);

      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'حذف مستخدم', ?)", [
        new Date().toISOString(),
        (logCreator as string) || "المدير",
        `تم حذف المستخدم ${user ? user.name : "غير معروف"} رقم المعرف: ${id}`
      ]);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Suppliers CRUD
  app.get("/api/suppliers", async (req, res) => {
    try {
      const s = await dbAll("SELECT * FROM suppliers ORDER BY id DESC");
      res.json(s);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const { name, phone, address, is_tamween_supplier, logCreator } = req.body;
      const isTamweenVal = is_tamween_supplier ? 1 : 0;
      const result = await dbRun("INSERT INTO suppliers (name, phone, address, is_tamween_supplier) VALUES (?, ?, ?, ?)", [name, phone, address, isTamweenVal]);
      
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'إضافة مورد', ?)", [
        new Date().toISOString(),
        logCreator || "المدير",
        `تم إضافة المورد ${name}، هاتف: ${phone}`
      ]);

      res.json({ success: true, id: result.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/suppliers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone, address, is_tamween_supplier, logCreator } = req.body;
      const isTamweenVal = is_tamween_supplier ? 1 : 0;
      
      // Get old name first
      const oldSupplier = await dbGet("SELECT name FROM suppliers WHERE id = ?", [id]);
      const oldName = oldSupplier ? oldSupplier.name : null;
      
      await dbRun("UPDATE suppliers SET name = ?, phone = ?, address = ?, is_tamween_supplier = ? WHERE id = ?", [name, phone, address, isTamweenVal, id]);
      
      // If name changed, update all items, invoices and replacements referencing old name
      if (oldName && oldName !== name) {
        await dbRun("UPDATE items SET supplier_name = ? WHERE supplier_name = ?", [name, oldName]);
        await dbRun("UPDATE invoices SET customer_supplier_name = ? WHERE customer_supplier_name = ? AND type = 'purchases'", [name, oldName]);
        await dbRun("UPDATE tamween_replacements SET supplier_name = ? WHERE supplier_name = ?", [name, oldName]);
      }

      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'تعديل مورد', ?)", [
        new Date().toISOString(),
        logCreator || "المدير",
        `تم تعديل بيانات المورد ${name} رقم المعرف: ${id}`
      ]);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/suppliers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { logCreator } = req.query;
      const supplier = await dbGet("SELECT name FROM suppliers WHERE id = ?", [id]);

      await dbRun("DELETE FROM suppliers WHERE id = ?", [id]);

      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'حذف مورد', ?)", [
        new Date().toISOString(),
        (logCreator as string) || "المدير",
        `تم حذف المورد ${supplier ? supplier.name : ""} رقم المعرف: ${id}`
      ]);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Items CRUD (الأصناف)
  app.get("/api/items", async (req, res) => {
    try {
      const query = "SELECT * FROM items ORDER BY id DESC";
      const productList = await dbAll(query);
      res.json(productList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/items", async (req, res) => {
    try {
      const { barcode, name, purchase_price, retail_price, wholesale_price, quantity, unit, low_stock_limit, is_unlimited, category, supplier_id, supplier_name, logCreator } = req.body;
      const isUnlimitedVal = is_unlimited ? 1 : 0;
      const categoryVal = category || 'عام';
      const result = await dbRun(
        "INSERT INTO items (barcode, name, purchase_price, retail_price, wholesale_price, quantity, unit, low_stock_limit, is_unlimited, category, supplier_id, supplier_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [barcode, name, Number(purchase_price), Number(retail_price), Number(wholesale_price), Number(quantity), unit, Number(low_stock_limit), isUnlimitedVal, categoryVal, supplier_id || null, supplier_name || null]
      );

      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'إضافة صنف', ?)", [
        new Date().toISOString(),
        logCreator || "المدير",
        `تم إضافة صنف جديد: ${name} (باركود: ${barcode})، سعر بيع قطاعي: ${retail_price}، المورد: ${supplier_name || "غير محدد"}`
      ]);

      res.json({ success: true, id: result.id });
    } catch (err: any) {
      res.status(500).json({ error: "الباركود قد يكون مكررًا أو البيانات غير مكتملة." });
    }
  });

  app.put("/api/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { barcode, name, purchase_price, retail_price, wholesale_price, quantity, unit, low_stock_limit, is_unlimited, is_tamween, category, supplier_id, supplier_name, logCreator } = req.body;
      const categoryVal = category || 'عام';
      
      const original = await dbGet("SELECT * FROM items WHERE id = ?", [id]);
      if (!original) {
        return res.status(404).json({ error: "الصنف غير موجود بمجموعة البيانات." });
      }

      const isUnlimitedVal = is_unlimited ? 1 : 0;
      const isTamweenVal = is_tamween ? 1 : 0;
      let targetQuantity = Number(quantity);

      // Audit and block rules
      if (original.is_unlimited === 0 && original.quantity === 0 && targetQuantity !== 0) {
        // Prevent increasing quantity manually if the item got to 0 in warehouse
        if (isUnlimitedVal === 0) {
          return res.status(400).json({ error: "لا يمكن تعديل كمية الصنف النافذ (0) يدويًا في المستودع لمنع التلاعب. يرجى إدراجه وتحديث كميته حصريًا عبر فاتورة المشتريات." });
        }
      }

      const changes: string[] = [];
      if (original.name !== name) changes.push(`الاسم: "${original.name}" -> "${name}"`);
      if (original.barcode !== barcode) changes.push(`الباركود: "${original.barcode}" -> "${barcode}"`);
      if (Number(original.purchase_price) !== Number(purchase_price)) changes.push(`سعر الشرا: ${original.purchase_price} -> ${purchase_price}`);
      if (Number(original.retail_price) !== Number(retail_price)) changes.push(`البيع قطاعي: ${original.retail_price} -> ${retail_price}`);
      if (Number(original.wholesale_price) !== Number(wholesale_price)) changes.push(`البيع جملة: ${original.wholesale_price} -> ${wholesale_price}`);
      if (Number(original.quantity) !== targetQuantity) changes.push(`الكمية بالمخزن: ${original.quantity} -> ${targetQuantity}`);
      if (original.unit !== unit) changes.push(`الوحدة: "${original.unit}" -> "${unit}"`);
      if (Number(original.low_stock_limit) !== Number(low_stock_limit)) changes.push(`حد الأمان: ${original.low_stock_limit} -> ${low_stock_limit}`);
      if (Number(original.is_unlimited || 0) !== isUnlimitedVal) {
        changes.push(`نوع المخزون: ${original.is_unlimited === 1 ? "غير معلوم" : "محدد"} -> ${isUnlimitedVal === 1 ? "غير معلوم" : "محدد"}`);
      }
      if (original.category !== categoryVal) {
        changes.push(`التصنيف: "${original.category}" -> "${categoryVal}"`);
      }
      if (original.supplier_name !== supplier_name) {
        changes.push(`المورد: "${original.supplier_name || 'غير محدد'}" -> "${supplier_name || 'غير محدد'}"`);
      }

      await dbRun(
        "UPDATE items SET barcode = ?, name = ?, purchase_price = ?, retail_price = ?, wholesale_price = ?, quantity = ?, unit = ?, low_stock_limit = ?, is_unlimited = ?, is_tamween = ?, category = ?, supplier_id = ?, supplier_name = ? WHERE id = ?",
        [barcode, name, Number(purchase_price), Number(retail_price), Number(wholesale_price), targetQuantity, unit, Number(low_stock_limit), isUnlimitedVal, isTamweenVal, categoryVal, supplier_id || null, supplier_name || null, id]
      );

      if (changes.length > 0) {
        await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'تعديل صنف', ?)", [
          new Date().toISOString(),
          logCreator || "المدير",
          `تم تعديل الصنف "${name}" (معرف: ${id}): [${changes.join(" | ")}]`
        ]);
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "فشل تعديل الصنف. قد يكون الباركود مستخدمًا بالفعل." });
    }
  });

  app.delete("/api/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { logCreator } = req.query;
      const prod = await dbGet("SELECT name FROM items WHERE id = ?", [id]);
      
      await dbRun("DELETE FROM items WHERE id = ?", [id]);

      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'حذف صنف', ?)", [
        new Date().toISOString(),
        (logCreator as string) || "المدير",
        `تم حذف الصنف ${prod ? prod.name : ""} كود المعرف: ${id}`
      ]);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Search Item by Code or Name
  app.get("/api/items/search", async (req, res) => {
    try {
      const { query } = req.query;
      if (!query) return res.json([]);
      
      const q = `%${query}%`;
      const result = await dbAll(
        "SELECT * FROM items WHERE barcode = ? OR name LIKE ? OR barcode LIKE ? LIMIT 15",
        [query as string, q, q]
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Get All Inventory Audits
  app.get("/api/inventory/audits", async (req, res) => {
    try {
      const audits = await dbAll("SELECT * FROM inventory_audits ORDER BY id DESC");
      res.json(audits);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Get Specific Inventory Audit details
  app.get("/api/inventory/audits/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const audit = await dbGet("SELECT * FROM inventory_audits WHERE id = ?", [id]);
      if (!audit) {
        return res.status(404).json({ error: "جلسة الجرد غير موجودة." });
      }
      const items = await dbAll("SELECT * FROM inventory_audit_items WHERE audit_id = ?", [id]);
      res.json({ audit, items });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Perform General Inventory Audit (تأكيد واعتماد جرد المخازن)
  app.post("/api/inventory/audits", async (req, res) => {
    try {
      const { audited_by, notes, items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "الرجاء توفير قائمة الأصناف المجرودة بشكل صحيح." });
      }

      // Fetch all current items
      const currentItems = await dbAll("SELECT barcode, name, quantity, purchase_price, unit FROM items");
      const itemsMap = new Map<string, any>();
      currentItems.forEach(it => {
        itemsMap.set(it.barcode, it);
      });

      // Insert audit metadata
      const auditResult = await dbRun(
        "INSERT INTO inventory_audits (timestamp, audited_by, total_items, notes) VALUES (?, ?, ?, ?)",
        [new Date().toISOString(), audited_by || "المدير العام", items.length, notes || ""]
      );
      const auditId = auditResult.id;

      let net_deficit = 0;
      let net_surplus = 0;

      for (const audItem of items) {
        const itemInfo = itemsMap.get(audItem.barcode);
        if (!itemInfo) continue;

        const system_qty = Number(itemInfo.quantity || 0);
        const actual_qty = Number(audItem.actual_qty);
        const difference = actual_qty - system_qty;
        const cost_price = Number(itemInfo.purchase_price || 0);
        const loss_surplus_value = difference * cost_price;

        if (difference < 0) {
          net_deficit += Math.abs(loss_surplus_value);
        } else if (difference > 0) {
          net_surplus += loss_surplus_value;
        }

        // 1. Update stock in core items database table
        await dbRun("UPDATE items SET quantity = ? WHERE barcode = ?", [actual_qty, audItem.barcode]);

        // 2. Insert item-level log for this audit
        await dbRun(
          `INSERT INTO inventory_audit_items 
           (audit_id, barcode, name, system_qty, actual_qty, difference, cost_price, loss_surplus_value) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [auditId, audItem.barcode, itemInfo.name, system_qty, actual_qty, difference, cost_price, loss_surplus_value]
        );
      }

      // Update calculations
      await dbRun(
        "UPDATE inventory_audits SET net_deficit = ?, net_surplus = ? WHERE id = ?",
        [net_deficit, net_surplus, auditId]
      );

      // Record in security/system audit logs
      const logDetails = `تم اعتماد جرد مخزن كامل وتفصيلي بواسطة ${audited_by || "المدير العام"}. إجمالي الأصناف المجرودة: ${items.length} صنف. العجز الكلي: ${(net_deficit || 0).toFixed(2)} ج.م. الزيادة الكلية: ${(net_surplus || 0).toFixed(2)} ج.م. ملاحظات: ${notes || "لا يوجد"}`;
      await dbRun(
        "INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'جرد مخزن', ?)",
        [new Date().toISOString(), audited_by || "المدير العام", logDetails]
      );

      res.json({ success: true, auditId, net_deficit, net_surplus });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Create Purchases Invoice (فاتورة مشتريات)
  app.post("/api/purchases", async (req, res) => {
    try {
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
        created_by
      } = req.body;
      if (!invoice_number || !supplier_name || !Array.isArray(invoiceItems) || invoiceItems.length === 0) {
        return res.status(400).json({ error: "بيانات الفاتورة غير مكتملة." });
      }
      for (const item of invoiceItems) {
        if (!item.barcode || isNaN(Number(item.quantity)) || Number(item.quantity) <= 0) {
          return res.status(400).json({ error: "بيانات الأصناف غير صحيحة." });
        }
      }

      // Wrap in manual SQLite transaction logic / sequence
      const created_at = new Date().toISOString();
      await dbRun(`
        INSERT INTO invoices (invoice_number, type, date, customer_supplier_name, payment_source, sale_type, subtotal, tax, discount, total, paid, remaining, created_by, created_at)
        VALUES (?, 'purchases', ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [invoice_number, date, supplier_name, payment_source, subtotal, tax, discount, total, paid, remaining, created_by, created_at]);

      const invIdRow = await dbGet("SELECT last_insert_rowid() as id");
      const invoice_id = invIdRow.id;

      // Look up supplier ID if available
      let supRecord = null;
      if (supplier_name) {
        supRecord = await dbGet("SELECT id, name FROM suppliers WHERE name = ?", [supplier_name]);
      }
      const supplierId = supRecord ? supRecord.id : null;
      const supplierName = supplier_name || (supRecord ? supRecord.name : null);

      for (const item of invoiceItems) {
        // Add invoice item
        await dbRun(`
          INSERT INTO invoice_items (invoice_id, barcode, name, quantity, unit, price, cost_price, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [invoice_id, item.barcode, item.name, item.quantity, item.unit, item.purchase_price, item.purchase_price, item.total]);

        // Check if item exists in store. If so, update stock, price & supplier link. If not, create standard.
        const existing = await dbGet("SELECT id, quantity, is_unlimited FROM items WHERE barcode = ?", [item.barcode]);
        if (existing) {
          const newQty = existing.is_unlimited === 1 ? existing.quantity : (existing.quantity + Number(item.quantity));
          await dbRun(
            "UPDATE items SET quantity = ?, purchase_price = ?, retail_price = ?, wholesale_price = ?, supplier_id = COALESCE(?, supplier_id), supplier_name = COALESCE(?, supplier_name) WHERE barcode = ?",
            [newQty, Number(item.purchase_price), Number(item.retail_price), Number(item.wholesale_price), supplierId, supplierName, item.barcode]
          );
        } else {
          await dbRun(`
            INSERT INTO items (barcode, name, purchase_price, retail_price, wholesale_price, quantity, unit, low_stock_limit, category, supplier_id, supplier_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [item.barcode, item.name, Number(item.purchase_price), Number(item.retail_price), Number(item.wholesale_price), Number(item.quantity), item.unit, 10, 'عام', supplierId, supplierName]);
        }
      }

      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'فاتورة مشتريات', ?)", [
        new Date().toISOString(),
        created_by || "المدير",
        `تم تسجيل فاتورة مشتريات رقم ${invoice_number} بقيمة ${total} من المورد ${supplier_name}`
      ]);

      // Check if supplier is tamween supplier and auto-create replacement
      if (supRecord) {
        const supDetails = await dbGet("SELECT is_tamween_supplier FROM suppliers WHERE id = ?", [supRecord.id]);
        if (supDetails && supDetails.is_tamween_supplier === 1) {
          const itemsDesc = invoiceItems.map((item: any) => `${item.quantity} ${item.unit || 'قطعة'} ${item.name}`).join("، ");
          await dbRun(
            "INSERT INTO tamween_replacements (date, invoice_number, supplier_name, items_description, total_value, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [date, invoice_number, supplier_name, itemsDesc, total || 0, "received", "تم الإنشاء تلقائياً من فاتورة المشتريات", created_at]
          );
          await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'استعاضة تموين', ?)", [
            new Date().toISOString(),
            "النظام",
            `تم إنشاء استعاضة تلقائياً من فاتورة مشتريات رقم ${invoice_number} بقيمة ${total} ج.م`
          ]);
        }
      }

      res.json({ success: true, invoice_id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Create Sales Invoice (فاتورة مبيعات)
  app.post("/api/sales", async (req, res) => {
    try {
      const {
        invoice_number,
        date,
        customer_name,
        payment_source, // e.g. 'cash_register'
        sale_type, // 'retail' or 'wholesale'
        subtotal,
        tax,
        discount,
        tamween_discount,
        bread_points,
        bonus,
        total,
        paid,
        remaining,
        items: invoiceItems,
        created_by
      } = req.body;

      const created_at = new Date().toISOString();
      if (!invoice_number || !Array.isArray(invoiceItems) || invoiceItems.length === 0) {
        return res.status(400).json({ error: "بيانات الفاتورة غير مكتملة." });
      }
      for (const item of invoiceItems) {
        if (!item.barcode || isNaN(Number(item.quantity)) || Number(item.quantity) <= 0) {
          return res.status(400).json({ error: "بيانات الأصناف غير صحيحة." });
        }
      }

      await dbRun(`
        INSERT INTO invoices (invoice_number, type, date, customer_supplier_name, payment_source, sale_type, subtotal, tax, discount, tamween_discount, bread_points, bonus, total, paid, remaining, created_by, created_at)
        VALUES (?, 'sales', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [invoice_number, date, customer_name, payment_source, sale_type, subtotal, tax, discount, tamween_discount || 0, bread_points || 0, bonus || 0, total, paid, remaining, created_by, created_at]);

      const invIdRow = await dbGet("SELECT last_insert_rowid() as id");
      const invoice_id = invIdRow.id;

      for (const item of invoiceItems) {
        // We need original purchase_price to record cost_price for profit calculation!
        const product = await dbGet("SELECT purchase_price, quantity, is_unlimited FROM items WHERE barcode = ?", [item.barcode]);
        const costPrice = product ? product.purchase_price : item.price;

        // Add item details
        await dbRun(`
          INSERT INTO invoice_items (invoice_id, barcode, name, quantity, unit, price, cost_price, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         `, [invoice_id, item.barcode, item.name, item.quantity, item.unit, item.price, costPrice, item.total]);

        // Deduct inventory ONLY if not unlimited
        if (product && product.is_unlimited !== 1) {
          const newQty = Math.max(0, product.quantity - Number(item.quantity));
          await dbRun("UPDATE items SET quantity = ? WHERE barcode = ?", [newQty, item.barcode]);
        }
      }

      const tamweenMsg = tamween_discount > 0 ? ` | خصم تموين: ${tamween_discount}` : '';
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'فاتورة مبيعات', ?)", [
        new Date().toISOString(),
        created_by || "الكاشير",
        `تم بيع فاتورة مبيعات رقم ${invoice_number} بقيمة ${total} للعميل ${customer_name}${tamweenMsg}`
      ]);

      res.json({ success: true, invoice_id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Save Thermal Invoice Image Statically (حفظ صورة الفاتورة باسم ثابت لجميع الفواتير)
  app.post("/api/invoices/save-image", express.json({ limit: "50mb" }), async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "الرجاء توفير كود الصورة Base64 للملف." });
      }

      const base64Data = image.replace(/^data:image\/png;base64,/, "");
      const fs = await import("fs");
      const path = await import("path");

      // Save inside public/ with fixed filename: last_invoice.png
      const publicDir = path.join(DATA_DIR, "public");
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      // Fixed filenames
      const fixedFileName = "last_invoice.png";
      const targetFilePath = path.join(publicDir, fixedFileName);
      fs.writeFileSync(targetFilePath, base64Data, "base64");

      // Also save to invoice.png for additional alias
      fs.writeFileSync(path.join(publicDir, "invoice.png"), base64Data, "base64");

      // Save in public/invoices/last_invoice.png as well
      const invoicesDir = path.join(publicDir, "invoices");
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }
      fs.writeFileSync(path.join(invoicesDir, fixedFileName), base64Data, "base64");

      // Copy to dist/ if dist directory exists
      const distDir = path.join(DATA_DIR, "dist");
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, fixedFileName), base64Data, "base64");
        fs.writeFileSync(path.join(distDir, "invoice.png"), base64Data, "base64");

        const distInvoicesDir = path.join(distDir, "invoices");
        if (!fs.existsSync(distInvoicesDir)) {
          fs.mkdirSync(distInvoicesDir, { recursive: true });
        }
        fs.writeFileSync(path.join(distInvoicesDir, fixedFileName), base64Data, "base64");
      }

      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'حفظ صورة فاتورة', ?)", [
        new Date().toISOString(),
        "النظام",
        `تم حفظ صورة الفاتورة: ${fixedFileName}`
      ]);

      res.json({
        success: true,
        filename: fixedFileName,
        url: `/${fixedFileName}`
      });
    } catch (err: any) {
      res.status(500).json({ error: `فشل حفظ صورة الفاتورة: ${err.message}` });
    }
  });

  // API - Get List of Saved Invoice Images
  app.get("/api/invoices/saved-images", async (req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const invoicesDir = path.join(DATA_DIR, "public", "invoices");
      if (!fs.existsSync(invoicesDir)) {
        return res.json([]);
      }
      const files = fs.readdirSync(invoicesDir).filter(f => f.endsWith(".png"));
      const list = files.map(filename => ({
        filename,
        url: `/invoices/${filename}`
      }));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== DEVELOPER CONTROL PANEL APIS ====================
  // API - Get Developer System Statistics
  app.get("/api/developer/stats", async (req, res) => {
    try {
      const usersCount = (await dbGet("SELECT COUNT(*) as c FROM users")).c;
      const itemsCount = (await dbGet("SELECT COUNT(*) as c FROM items")).c;
      const suppliersCount = (await dbGet("SELECT COUNT(*) as c FROM suppliers")).c;
      const invoicesCount = (await dbGet("SELECT COUNT(*) as c FROM invoices")).c;
      const salesCount = (await dbGet("SELECT COUNT(*) as c FROM invoices WHERE type='sales'")).c;
      const purchasesCount = (await dbGet("SELECT COUNT(*) as c FROM invoices WHERE type='purchases'")).c;
      const auditsCount = (await dbGet("SELECT COUNT(*) as c FROM inventory_audits")).c;
      const logsCount = (await dbGet("SELECT COUNT(*) as c FROM logs")).c;
      const expensesCount = (await dbGet("SELECT COUNT(*) as c FROM expenses")).c;
      const partnersCount = (await dbGet("SELECT COUNT(*) as c FROM partners")).c;
      
      const fs = await import("fs");
      let dbSize = "غير معروف";
      try {
        const stats = fs.statSync(dbPath);
        dbSize = (stats.size / (1024 * 1024)).toFixed(2) + " ميجابايت";
      } catch (e) {}

      res.json({
        usersCount,
        itemsCount,
        suppliersCount,
        invoicesCount,
        salesCount,
        purchasesCount,
        auditsCount,
        logsCount,
        expensesCount,
        partnersCount,
        dbSize,
        uptime: Math.floor(process.uptime()) + " ثانية"
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Full System Factory Reset / Wipe Data — Admin only + Auth
  app.post("/api/developer/reset-system", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { resetOptions } = req.body;

      // Default to old behavior if resetOptions is not provided
      const opts = resetOptions || {
        invoices: true, items: true, suppliers: true, expenses: true, partners: true, treasury: true, logs: true
      };

      if (opts.invoices) {
        await dbRun("DELETE FROM invoice_items");
        await dbRun("DELETE FROM invoices");
      }
      
      if (opts.items) {
        await dbRun("DELETE FROM items");
      }
      
      if (opts.suppliers) {
        await dbRun("DELETE FROM suppliers");
      }
      
      if (opts.expenses) {
        await dbRun("DELETE FROM expenses");
      }
      
      if (opts.partners) {
        await dbRun("DELETE FROM partners");
      }
      
      if (opts.treasury) {
        try {
          await dbRun("DELETE FROM treasury_transactions");
        } catch(e) {}
      }
      
      if (opts.logs) {
        await dbRun("DELETE FROM inventory_audit_items");
        await dbRun("DELETE FROM inventory_audits");
        await dbRun("DELETE FROM logs");
      }


      // Reset AutoIncrement counters where applicable
      try {
        await dbRun("DELETE FROM sqlite_sequence");
      } catch (e) {}

      // Re-seed Default System Settings
      const defaultSettings = [
        { key: "market_name", value: "سوبرماركت الكابتن" },
        { key: "market_phone", value: "01099887766" },
        { key: "market_address", value: "المنطقة الوسطى، المدينة المنورة" },
        { key: "tax_rate", value: "14" },
        { key: "currency", value: "ج.م" },
        { key: "receipt_footer", value: "شكراً لزيارتكم! يسعدنا تقديم أفضل الخدمات لكم دائماً." }
      ];
      for (const d of defaultSettings) {
        await dbRun("INSERT INTO settings (key, value) VALUES (?, ?)", [d.key, d.value]);
      }

      // Re-seed Default Admin and Developer Users
      const adminPermissions = JSON.stringify([
        "sales", "purchases", "items", "suppliers", "reports", "users",
        "dashboard_stats", "view_purchases_invoices", "edit_invoice", "delete_invoice", "return_invoice"
      ]);
      const devPermissions = JSON.stringify([
        "sales", "purchases", "items", "suppliers", "reports", "users", "developer",
        "dashboard_stats", "view_purchases_invoices", "edit_invoice", "delete_invoice", "return_invoice"
      ]);

      await dbRun(
        "INSERT INTO users (username, password, name, role, permissions) VALUES (?, ?, ?, ?, ?)",
        ["admin", await bcrypt.hash("admin123", 10), "أحمد المدير العام", "admin", adminPermissions]
      );
      await dbRun(
        "INSERT INTO users (username, password, name, role, permissions) VALUES (?, ?, ?, ?, ?)",
        ["innocode", await bcrypt.hash("yrcode", 10), "مبرمج النظام (InnoCode)", "developer", devPermissions]
      );

      // If user chose to include demo data
      const keepDemoData = (opts && opts.keepDemoData) || (resetOptions && resetOptions.keepDemoData) || false;
      if (keepDemoData) {
        // await seed100ItemsAndFullData();
      }

      // Add system log entry for reset
      const timeNow = new Date().toISOString();
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, ?, ?)", [
        timeNow,
        "innocode", "إعادة ضبط المصنع وتصفية النظام",
        keepDemoData ? "تم تفريغ كافة البيانات والعمليات مع إبقاء وتغذية البيانات الضخمة" : "تم تفريغ النظام كاملاً وتفريغ الجداول بالكامل"
      ]);

      res.json({ success: true, message: "تمت تصفية وإعادة ضبط قاعدة البيانات بالنظام بنجاح." });
    } catch (err: any) {
      res.status(500).json({ error: `خطأ أثناء ضبط النظام: ${err.message}` });
    }
  });

  // API - Seed 100+ Items and Full Test Data — Admin only + Auth
  app.post("/api/developer/seed-full-data", requireAuth, requireAdmin, async (req, res) => {
    try {
      // await seed100ItemsAndFullData();
      res.json({ success: true, message: "تمت إضافة 100+ صنف وكافة البيانات الشاملة بنجاح!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Execute Raw Developer SQL Command — Admin only + Auth
  app.post("/api/developer/sql", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "يرجى كتابة استعلام SQL." });
      }

      const trimQ = query.trim().toUpperCase();
      if (trimQ.startsWith("SELECT") || trimQ.startsWith("PRAGMA")) {
        const rows = await dbAll(query);
        await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'استعلام SQL', ?)", [
          new Date().toISOString(),
          "المبرمج",
          `استعلام: ${query.slice(0, 100)}`
        ]);
        res.json({ success: true, type: "SELECT", rows });
      } else {
        const result = await dbRun(query);
        await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'تنفيذ SQL', ?)", [
          new Date().toISOString(),
          "المبرمج",
          `تنفيذ: ${query.slice(0, 100)}`
        ]);
        res.json({ success: true, type: "EXECUTE", result });
      }
    } catch (err: any) {
      res.status(500).json({ error: `خطأ في تنفيذ SQL: ${err.message}` });
    }
  });

  // API - Full JSON Database Backup Export — Auth required
  app.get("/api/developer/backup", requireAuth, requireAdmin, async (req, res) => {
    try {
      const tables = ["users", "suppliers", "items", "invoices", "invoice_items", "logs", "partners", "expenses", "settings", "inventory_audits", "inventory_audit_items"];
      const backupData: Record<string, any[]> = {};
      for (const t of tables) {
        try {
          backupData[t] = await dbAll(`SELECT * FROM ${t}`);
        } catch (e) {
          backupData[t] = [];
        }
      }
      res.json({
        exportedAt: new Date().toISOString(),
        system: "InnoCode POS System",
        data: backupData
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Download Direct SQLite Database File (.sqlite)
  app.get("/api/backup/download-sqlite", async (req, res) => {
    try {
      const fs = await import("fs");
      if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: "ملف قاعدة البيانات غير موجود على الخادم." });
      }
      const todayStr = new Date().toISOString().split("T")[0];
      const filename = `database_backup_${todayStr}.sqlite`;
      res.download(dbPath, filename);
    } catch (err: any) {
      res.status(500).json({ error: `فشل تنزيل ملف قاعدة البيانات: ${err.message}` });
    }
  });

  // API - Download Full Backup JSON File
  app.get("/api/backup/download-json", async (req, res) => {
    try {
      const tables = ["users", "suppliers", "items", "invoices", "invoice_items", "logs", "partners", "expenses", "settings", "inventory_audits", "inventory_audit_items"];
      const backupData: Record<string, any[]> = {};
      for (const t of tables) {
        try {
          backupData[t] = await dbAll(`SELECT * FROM ${t}`);
        } catch (e) {
          backupData[t] = [];
        }
      }
      const fullBackup = {
        exportedAt: new Date().toISOString(),
        system: "InnoCode POS System - SQLite Database Backup",
        data: backupData
      };
      const todayStr = new Date().toISOString().split("T")[0];
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="database_backup_${todayStr}.json"`);
      res.send(JSON.stringify(fullBackup, null, 2));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Full JSON Database Restore — Admin only + Auth
  app.post("/api/developer/restore", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { data } = req.body;
      if (!data || typeof data !== "object") {
        return res.status(400).json({ error: "بيانات النسخة الاحتياطية غير صالحة." });
      }

      for (const table of Object.keys(data)) {
        const rows = data[table];
        if (Array.isArray(rows)) {
          await dbRun(`DELETE FROM ${table}`);
          for (const row of rows) {
            const keys = Object.keys(row);
            if (keys.length === 0) continue;
            const cols = keys.join(", ");
            const placeholders = keys.map(() => "?").join(", ");
            const values = keys.map(k => row[k]);
            await dbRun(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, values);
          }
        }
      }

      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'استعادة النسخة الاحتياطية', ?)", [
        new Date().toISOString(),
        "المبرمج",
        `تمت استعادة ${Object.keys(data).length} جدول`
      ]);

      res.json({ success: true, message: "تمت استعادة كافة الجداول والبيانات بنجاح." });
    } catch (err: any) {
      res.status(500).json({ error: `فشلت الاستعادة: ${err.message}` });
    }
  });

  // API - Get All Invoices
  app.get("/api/invoices", async (req, res) => {
    try {
      const type = req.query.type; // 'sales' or 'purchases'
      let query = "SELECT * FROM invoices ORDER BY id DESC";
      let params: any[] = [];
      if (type) {
        query = "SELECT * FROM invoices WHERE type = ? ORDER BY id DESC";
        params = [type];
      }
      const list = await dbAll(query, params);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Get Single Invoice with Items
  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await dbGet("SELECT * FROM invoices WHERE id = ?", [id]);
      if (!invoice) return res.status(404).json({ error: "الفاتورة غير موجودة" });

      const invoiceItems = await dbAll("SELECT * FROM invoice_items WHERE invoice_id = ?", [id]);
      res.json({ invoice, items: invoiceItems });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Update/Edit Invoice (تعديل فاتورة)
  app.put("/api/invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { customer_supplier_name, payment_source, paid, remaining, user_name } = req.body;

      const invoice = await dbGet("SELECT * FROM invoices WHERE id = ?", [id]);
      if (!invoice) return res.status(404).json({ error: "الفاتورة غير موجودة" });

      await dbRun(
        `UPDATE invoices SET customer_supplier_name = ?, payment_source = ?, paid = ?, remaining = ? WHERE id = ?`,
        [customer_supplier_name, payment_source, Number(paid), Number(remaining), id]
      );

      // Log the modification under high-security trace
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'تعديل فاتورة أمني', ?)", [
        new Date().toISOString(),
        user_name || "المدير العام",
        `[تعديل أمني] تم تعديل تفاصيل الفاتورة رقم ${invoice.invoice_number} (نوع: ${invoice.type === "sales" ? "مبيعات" : "مشتريات"}). العميل الجديد: ${customer_supplier_name}، المدفوع: ${paid}ج.م، المتبقي: ${remaining}ج.م. بواسطة المستخدم: ${user_name}`
      ]);

      res.json({ success: true, message: "تم تعديل الفاتورة بنجاح" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Delete Invoice (حذف فاتورة مع استرجاع المخزن)
  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { user_name, user_role } = req.query; // to track who requested the delete

      const invoice = await dbGet("SELECT * FROM invoices WHERE id = ?", [id]);
      if (!invoice) return res.status(404).json({ error: "الفاتورة غير موجودة" });

      const items = await dbAll("SELECT * FROM invoice_items WHERE invoice_id = ?", [id]);

      // Revert stock changes based on type
      for (const item of items) {
        if (invoice.type === "sales") {
          // If a sold invoice is deleted, restock items
          await dbRun("UPDATE items SET quantity = quantity + ? WHERE barcode = ? AND (is_unlimited IS NULL OR is_unlimited = 0)", [item.quantity, item.barcode]);
        } else if (invoice.type === "purchases") {
          // If a purchased invoice is deleted, remove those items from stock
          await dbRun("UPDATE items SET quantity = MAX(0, quantity - ?) WHERE barcode = ? AND (is_unlimited IS NULL OR is_unlimited = 0)", [item.quantity, item.barcode]);
        }
      }

      // Delete the items and main record
      await dbRun("DELETE FROM invoice_items WHERE invoice_id = ?", [id]);
      await dbRun("DELETE FROM invoices WHERE id = ?", [id]);

      // High visibility operational security log
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'إلغاء وحذف فاتورة', ?)", [
        new Date().toISOString(),
        user_name || "مدير النظام",
        `[حذف أمني للرقابة الكاشير] تم حذف وإلغاء الفاتورة رقم ${invoice.invoice_number} بالكامل بقيمة ${invoice.total} ج.م، وتم تصفير واستعادة كميات الأصناف المودعة بها تلقائياً لمنع التلاعب. الموظف المسؤول: ${user_name} (صلاحية: ${user_role || "كاشير"})`
      ]);

      res.json({ success: true, message: "تم حذف الفاتورة واستعادة مخزونها بنجاح" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Return/Refund Invoice (فاتورة مرتجع مالي وأمني عالي)
  app.post("/api/invoices/:id/return", async (req, res) => {
    try {
      const { id } = req.params;
      const { user_name, user_role, refund_items } = req.body; // refund_items contains fine-grained or full returns

      const invoice = await dbGet("SELECT * FROM invoices WHERE id = ?", [id]);
      if (!invoice) return res.status(404).json({ error: "الفاتورة غير موجودة" });

      if (invoice.status === "returned") {
        return res.status(400).json({ error: "هذه الفاتورة مرتجعة بالفعل بالكامل" });
      }

      const items = await dbAll("SELECT * FROM invoice_items WHERE invoice_id = ?", [id]);

      // PARTIAL / FINE-GRAINED RETURN LOGIC
      if (Array.isArray(refund_items) && refund_items.length > 0) {
        // First validate all requested partial refunds
        for (const refItem of refund_items) {
          const ii = items.find(it => it.id === Number(refItem.id));
          if (!ii) {
            return res.status(400).json({ error: `الصنف ذو الرمز ${refItem.barcode} غير متواجد بالفاتورة.` });
          }
          const alreadyReturned = ii.returned_quantity || 0;
          const remainingAvailable = ii.quantity - alreadyReturned;
          const requestedQty = Number(refItem.qtyToReturn !== undefined ? refItem.qtyToReturn : refItem.returned_quantity);
          if (isNaN(requestedQty) || requestedQty <= 0 || requestedQty > remainingAvailable) {
            return res.status(400).json({ error: `الكمية المدخلة للإرجاع للصنف "${ii.name}" غير صالحة.` });
          }
        }

        let totalRefundSubtotal = 0;
        const detailsArray: string[] = [];

        for (const refItem of refund_items) {
          const ii = items.find(it => it.id === Number(refItem.id))!;
          const qty = Number(refItem.qtyToReturn !== undefined ? refItem.qtyToReturn : refItem.returned_quantity);
          console.log("refItem:", refItem, "qty:", qty, "barcode:", ii.barcode);

          // Update returned_quantity on the invoice item record
          await dbRun(
            "UPDATE invoice_items SET returned_quantity = IFNULL(returned_quantity, 0) + ? WHERE id = ?",
            [qty, ii.id]
          );

          // Return items back to stock
          if (invoice.type === "sales") {
            await dbRun("UPDATE items SET quantity = quantity + ? WHERE barcode = ? AND (is_unlimited IS NULL OR is_unlimited = 0)", [qty, ii.barcode]);
          } else if (invoice.type === "purchases") {
            await dbRun("UPDATE items SET quantity = MAX(0, quantity - ?) WHERE barcode = ? AND (is_unlimited IS NULL OR is_unlimited = 0)", [qty, ii.barcode]);
          }

          totalRefundSubtotal += qty * ii.price;
          detailsArray.push(`${ii.name} (${qty} ${ii.unit})`);
        }

        // Proportional tax, discount and total refund calculation
        const original_subtotal = invoice.subtotal || 1;
        const subtotal_ratio = totalRefundSubtotal / original_subtotal;
        const tax_refund = (invoice.tax || 0) * subtotal_ratio;
        const discount_refund = (invoice.discount || 0) * subtotal_ratio;
        const total_refund = totalRefundSubtotal + tax_refund - discount_refund;

        // Calculate new invoice totals
        const new_subtotal = Math.max(0, invoice.subtotal - totalRefundSubtotal);
        const new_tax = Math.max(0, invoice.tax - tax_refund);
        const new_discount = Math.max(0, invoice.discount - discount_refund);
        const new_total = Math.max(0, invoice.total - total_refund);

        // Adjust paid and remaining balances cleanly
        let to_deduct = total_refund;
        let new_remaining = Math.max(0, (invoice.remaining || 0) - to_deduct);
        let deducted_from_remaining = (invoice.remaining || 0) - new_remaining;
        to_deduct -= deducted_from_remaining;
        let new_paid = Math.max(0, (invoice.paid || 0) - to_deduct);

        // Check if all items in the invoice are fully returned now
        const updatedItems = await dbAll("SELECT id, quantity, IFNULL(returned_quantity, 0) as returned_quantity FROM invoice_items WHERE invoice_id = ?", [id]);
        const allReturned = updatedItems.every(it => it.quantity === it.returned_quantity);
        const newStatus = allReturned ? 'returned' : 'partial_returned';

        await dbRun(
          "UPDATE invoices SET subtotal = ?, tax = ?, discount = ?, total = ?, paid = ?, remaining = ?, status = ? WHERE id = ?",
          [new_subtotal, new_tax, new_discount, new_total, new_paid, new_remaining, newStatus, id]
        );

        // Security operations audit log
        const securityAuditTag = user_role === "cashier" ? "[تحذير أمني: مرتجع جزئي بواسطة كاشير]" : "[مرتجع جزئي معتمد محاسبياً]";
        await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'مرتجع جزئي', ?)", [
          new Date().toISOString(),
          user_name || "الكاشير",
          `${securityAuditTag} تم إجراء مرتجع جزئي على الفاتورة رقم ${invoice.invoice_number} (نوع: ${invoice.type === "sales" ? "مبيعات" : "مشتريات"}) بقيمة مستردة ${(total_refund || 0).toFixed(2)} ج.م (تخفيض من الدرج/الخزنة). الأصناف المرتجعة للمخزن: [ ${detailsArray.join("، ")} ]. المستخدم المنفذ: ${user_name} (${user_role})`
        ]);

        return res.json({ success: true, message: `تم تسجيل مرتجع البضاعة الجزئي، وتعديل كميات الأصناف والموازنات الحسابية بنجاح.` });
      }

      // FULL FALLBACK RETURN LOGIC
      // Set status as 'returned'
      await dbRun("UPDATE invoices SET status = 'returned' WHERE id = ?", [id]);

      // Revert stock of items returned
      for (const item of items) {
        const remainingToReturn = item.quantity - (item.returned_quantity || 0);
        if (remainingToReturn > 0) {
          if (invoice.type === "sales") {
            await dbRun("UPDATE items SET quantity = quantity + ? WHERE barcode = ? AND (is_unlimited IS NULL OR is_unlimited = 0)", [remainingToReturn, item.barcode]);
          } else if (invoice.type === "purchases") {
            await dbRun("UPDATE items SET quantity = MAX(0, quantity - ?) WHERE barcode = ? AND (is_unlimited IS NULL OR is_unlimited = 0)", [remainingToReturn, item.barcode]);
          }
        }
        await dbRun("UPDATE invoice_items SET returned_quantity = quantity WHERE id = ?", [item.id]);
      }

      // High alert fraud check / security tag
      let securityAuditTag = "[مرتجع معياري]";
      if (user_role === "cashier") {
        securityAuditTag = "[تحذير أمني: مرتجع مالي بواسطة كاشير]";
      } else {
        securityAuditTag = "[مرتجع معتمد إدارياً]";
      }

      const itemsSummary = items.map(it => `${it.name} (${it.quantity} ${it.unit})`).join("، ");

      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'عملية مرتجع فوري', ?)", [
        new Date().toISOString(),
        user_name || "الكاشير",
        `${securityAuditTag} تم إجراء مرتجع كامل على الفاتورة رقم ${invoice.invoice_number} (نوع: ${invoice.type === "sales" ? "مبيعات" : "مشتريات"}) بقيمة إعفاء مبيعات ${invoice.total} ج.م ومصدر الدفع: ${invoice.payment_source === "cash_register" ? "درج الكاشير" : "الخزنة الرئيسية"}. الأصناف المستردة للمخزن: [ ${itemsSummary} ]. المستخدم المنفذ: ${user_name} (${user_role})`
      ]);

      res.json({ success: true, message: "تم تسجيل مرتجع الفاتورة، تصفير مخرجات المبيعات واستعادة مخزون الأصناف بنجاح" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Dashboard Stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const dateToday = new Date().toISOString().split("T")[0];

      // Total Sales Summary
      const salesSum = await dbGet("SELECT SUM(total) as total, COUNT(*) as count FROM invoices WHERE type = 'sales' AND (status != 'returned' OR status IS NULL)");
      // Total Purchases Summary
      const purchasesSum = await dbGet("SELECT SUM(total) as total, COUNT(*) as count FROM invoices WHERE type = 'purchases'");

      // Low Stock Count
      const lowStockCount = await dbGet("SELECT COUNT(*) as count FROM items WHERE quantity <= low_stock_limit");

      // Calculate Net Profits: Sum of (sale_price - cost_price) * qty
      // invoice_items of 'sales' type invoices
      const profitSum = await dbGet(`
        SELECT SUM((ii.price - ii.cost_price) * ii.quantity) as profit
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE i.type = 'sales' AND (i.status != 'returned' OR i.status IS NULL)
      `);

      // Top Selling Products
      const topSelling = await dbAll(`
        SELECT ii.barcode, ii.name, SUM(ii.quantity) as total_qty, ii.unit, SUM(ii.total) as total_sales
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE i.type = 'sales' AND (i.status != 'returned' OR i.status IS NULL)
        GROUP BY ii.barcode, ii.name, ii.unit
        ORDER BY total_qty DESC
        LIMIT 5
      `);

      // Recent 5 Invoices
      const recentInvoices = await dbAll("SELECT * FROM invoices ORDER BY id DESC LIMIT 5");

      // Last 5 Operation logs
      const recentLogs = await dbAll("SELECT * FROM logs ORDER BY id DESC LIMIT 5");

      // Custom Cash Drawer calculations
      const drawerSales = await dbGet("SELECT SUM(total) as s FROM invoices WHERE type = 'sales' AND payment_source = 'cash_register' AND (status != 'returned' OR status IS NULL)");
      const drawerPurchases = await dbGet("SELECT SUM(total) as p FROM invoices WHERE type = 'purchases' AND payment_source = 'cash_register'");
      const drawerBalance = (drawerSales.s || 0) - (drawerPurchases.p || 0);

      // Today's Sales Count
      const todaySales = await dbGet("SELECT COUNT(*) as count FROM invoices WHERE type = 'sales' AND date = ? AND (status != 'returned' OR status IS NULL)", [dateToday]);
      const todaySalesCount = todaySales.count || 0;

      // Today's Returns Count
      const todayReturns = await dbGet("SELECT COUNT(*) as count FROM invoices WHERE status = 'returned' AND date = ?", [dateToday]);
      const todayReturnsCount = todayReturns.count || 0;

      // Tamween Stats
      const currentMonth = new Date().toISOString().slice(0, 7);
      const tamweenDiscount = await dbGet("SELECT COALESCE(SUM(tamween_discount), 0) as total FROM invoices WHERE type = 'sales' AND tamween_discount > 0 AND date LIKE ?", [`${currentMonth}%`]);
      const tamweenCardsUsed = await dbGet("SELECT COUNT(*) as count FROM tamween_customers WHERE status = 'withdrawn' AND status_month = ?", [currentMonth]);
      const tamweenReplacements = await dbGet("SELECT COALESCE(SUM(total_value), 0) as total FROM tamween_replacements WHERE date LIKE ?", [`${currentMonth}%`]);

      // Graph Data: Past 7 days sales & purchases
      const graphData: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];

        // Format label nicely as MM/DD
        const labelParts = dateStr.split("-");
        const displayLabel = `${labelParts[1]}/${labelParts[2]}`;

        const daySales = await dbGet("SELECT SUM(total) as s FROM invoices WHERE type = 'sales' AND date = ? AND (status != 'returned' OR status IS NULL)", [dateStr]);
        const dayPurchases = await dbGet("SELECT SUM(total) as p FROM invoices WHERE type = 'purchases' AND date = ?", [dateStr]);

        graphData.push({
          date: dateStr,
          label: displayLabel,
          sales: daySales.s || 0,
          purchases: dayPurchases.p || 0
        });
      }

      res.json({
        sales: {
          total: salesSum.total || 0,
          count: salesSum.count || 0,
        },
        purchases: {
          total: purchasesSum.total || 0,
          count: purchasesSum.count || 0,
        },
        profit: profitSum.profit || 0,
        lowStockCount: lowStockCount.count || 0,
        topSelling,
        recentInvoices,
        recentLogs,
        graphData,
        drawerBalance,
        todaySalesCount,
        todayReturnsCount,
        tamween: {
          discount: tamweenDiscount.total || 0,
          cardsUsed: tamweenCardsUsed.count || 0,
          replacements: tamweenReplacements.total || 0,
          netOwed: (tamweenDiscount.total || 0) - (tamweenReplacements.total || 0)
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Partners CRUD
  app.get("/api/partners", async (req, res) => {
    try {
      const list = await dbAll("SELECT * FROM partners ORDER BY id DESC");
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/partners", async (req, res) => {
    try {
      const { name, fixed_profit_percentage, purchase_percentage, logCreator } = req.body;
      const result = await dbRun(
        "INSERT INTO partners (name, fixed_profit_percentage, purchase_percentage) VALUES (?, ?, ?)",
        [name, Number(fixed_profit_percentage), Number(purchase_percentage)]
      );
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'إضافة شريك', ?)", [
        new Date().toISOString(),
        logCreator || "المدير العام",
        `تم إضافة شريك جديد باسم: ${name} وبنسبة ربح ثابتة ${fixed_profit_percentage}% وقيمة فواتير مشتريات ${purchase_percentage}%`
      ]);
      res.json({ success: true, id: result.id });
    } catch (err: any) {
      res.status(500).json({ error: "اسم الشريك مسجل بالفعل مسبقًا." });
    }
  });

  app.put("/api/partners/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, fixed_profit_percentage, purchase_percentage, logCreator } = req.body;
      const original = await dbGet("SELECT * FROM partners WHERE id = ?", [id]);
      await dbRun(
        "UPDATE partners SET name = ?, fixed_profit_percentage = ?, purchase_percentage = ? WHERE id = ?",
        [name, Number(fixed_profit_percentage), Number(purchase_percentage), id]
      );
      if (original) {
        await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'تعديل شريك', ?)", [
          new Date().toISOString(),
          logCreator || "المدير العام",
          `تم تعديل الشريك "${name}": الربح من ${original.fixed_profit_percentage}% -> ${fixed_profit_percentage}%، تشارك المشتريات من ${original.purchase_percentage}% -> ${purchase_percentage}%`
        ]);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/partners/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { logCreator } = req.query;
      const partner = await dbGet("SELECT name FROM partners WHERE id = ?", [id]);
      await dbRun("DELETE FROM partners WHERE id = ?", [id]);
      if (partner) {
        await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'حذف شريك', ?)", [
          new Date().toISOString(),
          (logCreator as string) || "المدير العام",
          `تم حذف الشريك "${partner.name}" رقم المعرف: ${id}`
        ]);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Expenses CRUD
  app.get("/api/expenses", async (req, res) => {
    try {
      const list = await dbAll("SELECT * FROM expenses ORDER BY id DESC");
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const { title, amount, date, category, notes, payment_source, logCreator } = req.body;
      const result = await dbRun(
        "INSERT INTO expenses (title, amount, date, category, notes) VALUES (?, ?, ?, ?, ?)",
        [title, Number(amount), date, category, notes, payment_source || "cash_register"]
      );
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'بند مصروفات', ?)", [
        new Date().toISOString(),
        logCreator || "المدير العام",
        `تم إضافة قيد مصروفات تشغيلية [${category}] ${title} بقيمة ${amount} ج.م`
      ]);
      res.json({ success: true, id: result.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/expenses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { title, amount, date, category, notes, payment_source, logCreator } = req.body;
      // placeholder
      const original = await dbGet("SELECT * FROM expenses WHERE id = ?", [id]);
      await dbRun(
        "UPDATE expenses SET title = ?, amount = ?, date = ?, category = ?, notes = ?, payment_source = ? WHERE id = ?",
        [title, Number(amount), date, category, notes, payment_source || "cash_register", id]
      );
      if (original) {
        await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'تعديل مصروفات', ?)", [
          new Date().toISOString(),
          logCreator || "المدير العام",
          `تم تعديل مصروفات "${original.title}" بقيمة ${original.amount} -> "${title}" بقيمة ${amount} ج.م`
        ]);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { logCreator } = req.query;
      const original = await dbGet("SELECT * FROM expenses WHERE id = ?", [id]);
      await dbRun("DELETE FROM expenses WHERE id = ?", [id]);
      if (original) {
        await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'حذف بند مصروفات', ?)", [
          new Date().toISOString(),
          (logCreator as string) || "المدير العام",
          `تم حذف بند مصروفات "${original.title}" بقيمة ${original.amount} ج.م`
        ]);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Save Thermal Report Image Statically
  app.post("/api/reports/save-image", express.json({ limit: "25mb" }), async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "الرجاء توفير كود الصورة Base64 للملف." });
      }

      const base64Data = image.replace(/^data:image\/png;base64,/, "");
      const fs = await import("fs");
      const path = await import("path");

      const publicDir = path.join(DATA_DIR, "public");
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      const targetFilePath = path.join(publicDir, "last_report.png");
      fs.writeFileSync(targetFilePath, base64Data, "base64");

      const distDir = path.join(DATA_DIR, "dist");
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, "last_report.png"), base64Data, "base64");
      }

      res.json({ success: true, url: "/last_report.png" });
    } catch (err: any) {
      res.status(500).json({ error: `فشل الحفظ: ${err.message}` });
    }
  });

  // API - Reports
  app.get("/api/reports", async (req, res) => {
    try {
      const { reportType, startDate, endDate } = req.query;
      let invoicesQuery = `
        SELECT * FROM invoices 
        WHERE date >= ? AND date <= ?
      `;
      let params = [startDate as string, endDate as string];

      if (reportType === "sales") {
        invoicesQuery += " AND type = 'sales'";
      } else if (reportType === "purchases") {
        invoicesQuery += " AND type = 'purchases'";
      }
      
      invoicesQuery += " ORDER BY id DESC";

      const rInvoices = await dbAll(invoicesQuery, params);

      // Fetch all items within dates
      const rItems = await dbAll(`
        SELECT ii.*, i.type, i.date
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE i.date >= ? AND i.date <= ?
      `, [startDate as string, endDate as string]);

      // Calculate profitability or stock levels
      const inventoryStatus = await dbAll("SELECT * FROM items ORDER BY quantity ASC");

      // Fetch operational expenses & partners
      const rPartners = await dbAll("SELECT * FROM partners ORDER BY name ASC");
      const rExpenses = await dbAll("SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC", [startDate as string, endDate as string]);

      res.json({
        invoices: rInvoices,
        invoiceItems: rItems,
        inventoryStatus,
        partners: rPartners,
        expenses: rExpenses
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  
  // Export Database — Auth required
  app.get("/api/database/export", requireAuth, requireAdmin, (req, res) => {
    const dbPath = path.join(DATA_DIR, "database.sqlite");
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: "قاعدة البيانات غير موجودة" });
    }
    res.download(dbPath, `database-export-${Date.now()}.sqlite`);
  });

  // Import Database
  
  const upload = multer({ dest: "uploads/" });
  app.post("/api/database/import", requireAuth, requireAdmin, upload.single("database"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم رفع أي ملف" });
    }
    const dbPath = path.join(DATA_DIR, "database.sqlite");
    const backupPath = path.join(DATA_DIR, `database-backup-${Date.now()}.sqlite`);
    
    try {
      // Backup current DB
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
      }
      
      // Replace with new DB
      fs.renameSync(req.file.path, dbPath);
      
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'استيراد قاعدة البيانات', ?)", [
        new Date().toISOString(),
        "النظام",
        "تم استيراد قاعدة بيانات جديدة"
      ]);
      
      res.json({ success: true, message: "تم استيراد قاعدة البيانات بنجاح، يرجى إعادة تشغيل النظام" });
      
      // Note: In a real app we might need to reconnect to sqlite or restart the server.
      // Restarting the process will reload the DB connection.
      setTimeout(() => process.exit(0), 1000); 
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "فشل استيراد قاعدة البيانات" });
    }
  });

  // ============================================
  // FULL SYSTEM SNAPSHOT (code + pages + settings + database)
  // ============================================
  const SNAPSHOT_ITEMS = [
    "server.ts", "package.json", "package-lock.json", "vite.config.ts",
    "tsconfig.json", "index.html", "prebuild.js",
    "src", "public", "uploads", "database.sqlite"
  ];

  function snapshotStamp() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  function runPowershell(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], { cwd: DATA_DIR }, (err, stdout, stderr) => {
        if (err) reject(new Error(String(stderr || err.message || err)));
        else resolve(String(stdout || ""));
      });
    });
  }

  async function createSystemSnapshot(prefix = "snapshot"): Promise<{ filename: string; size: number }> {
    if (process.platform !== "win32") {
      throw new Error("النسخة الشاملة متاحة على نظام ويندوز فقط");
    }
    const dir = path.join(DATA_DIR, "backups", "system-snapshots");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stage = path.join(DATA_DIR, "backups", ".snap-stage");
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
    fs.mkdirSync(stage, { recursive: true });
    try {
      const filename = `${prefix}-${snapshotStamp()}.zip`;
      const dest = path.join(dir, filename);
      // Stage everything; database via VACUUM INTO (consistent copy while server is running)
      for (const item of SNAPSHOT_ITEMS) {
        if (item === "database.sqlite") continue;
        const src = path.join(DATA_DIR, item);
        if (!fs.existsSync(src)) continue;
        fs.cpSync(src, path.join(stage, item), { recursive: true });
      }
      const stageDb = path.join(stage, "database.sqlite").replace(/'/g, "''");
      await dbRun(`VACUUM INTO '${stageDb}'`);
      await runPowershell(`Compress-Archive -Path 'backups/.snap-stage/*' -DestinationPath 'backups/system-snapshots/${filename}' -Force`);
      fs.rmSync(stage, { recursive: true, force: true });
      const size = fs.statSync(dest).size;
      return { filename, size };
    } catch (e) {
      try { fs.rmSync(stage, { recursive: true, force: true }); } catch {}
      throw e;
    }
  }

  // Create snapshot
  app.post("/api/system/snapshot", async (req, res) => {
    try {
      const snap = await createSystemSnapshot("snapshot");
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'نسخة شاملة', ?)", [
        new Date().toISOString(),
        (req.body as any)?.user_name || "المدير",
        `تم حفظ نسخة شاملة للسيستم: ${snap.filename}`
      ]);
      res.json({ success: true, ...snap });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "فشل إنشاء النسخة" });
    }
  });

  // List snapshots
  app.get("/api/system/snapshots", (req, res) => {
    try {
      const dir = path.join(DATA_DIR, "backups", "system-snapshots");
      if (!fs.existsSync(dir)) return res.json([]);
      const files = fs.readdirSync(dir)
        .filter((f) => f.endsWith(".zip"))
        .map((f) => {
          const st = fs.statSync(path.join(dir, f));
          return { name: f, size: st.size, mtime: st.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Download snapshot
  app.get("/api/system/snapshot/download/:name", (req, res) => {
    const name = req.params.name;
    if (!/^snapshot-[\d-]+\.zip$/.test(name) && !/^pre-restore-[\d-]+\.zip$/.test(name)) {
      return res.status(400).json({ error: "اسم الملف غير صالح" });
    }
    const full = path.join(DATA_DIR, "backups", "system-snapshots", name);
    if (!fs.existsSync(full)) return res.status(404).json({ error: "الملف غير موجود" });
    res.download(full, name);
  });

  // Restore snapshot (upload zip) - safety snapshot first, then replace, then restart
  app.post("/api/system/restore-snapshot", upload.single("snapshot"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم رفع أي ملف" });
    }
    const tmpRoot = path.join(DATA_DIR, "backups", ".restore-tmp");
    try {
      if (!req.file.originalname.endsWith(".zip")) throw new Error("الملف يجب أن يكون بصيغة ZIP");
      // 1. Safety snapshot of current system before touching anything
      const safety = await createSystemSnapshot("pre-restore");
      // multer saves without extension; Expand-Archive requires .zip
      const zipPath = req.file.path + ".zip";
      fs.renameSync(req.file.path, zipPath);
      // 2. Extract upload to temp
      if (fs.existsSync(tmpRoot)) fs.rmSync(tmpRoot, { recursive: true, force: true });
      fs.mkdirSync(tmpRoot, { recursive: true });
      await runPowershell(`Expand-Archive -Path '${zipPath}' -DestinationPath 'backups/.restore-tmp' -Force`);
      // 3. Locate payload (flat or single top folder)
      let payload = tmpRoot;
      const entries = fs.readdirSync(tmpRoot);
      if (entries.length === 1 && fs.statSync(path.join(tmpRoot, entries[0])).isDirectory()) {
        payload = path.join(tmpRoot, entries[0]);
      }
      for (const must of ["server.ts", "database.sqlite", "package.json"]) {
        if (!fs.existsSync(path.join(payload, must))) {
          throw new Error("ملف النسخة غير صالح (مفقود: " + must + ")");
        }
      }
      if (!fs.statSync(path.join(payload, "src")).isDirectory()) {
        throw new Error("ملف النسخة غير صالح (مجلد src مفقود)");
      }
      // 4. Apply (never touch backups dir itself)
      for (const e of fs.readdirSync(payload)) {
        if (e === "backups") continue;
        fs.cpSync(path.join(payload, e), path.join(DATA_DIR, e), { recursive: true });
      }
      fs.rmSync(tmpRoot, { recursive: true, force: true });
      try { fs.unlinkSync(zipPath); } catch {}
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'استعادة شاملة', ?)", [
        new Date().toISOString(), "المدير", `تمت استعادة نسخة شاملة (نسخة الأمان: ${safety.filename})`
      ]).catch(() => {});
      res.json({ success: true, message: "تمت الاستعادة بنجاح. سيعاد تشغيل السيرفر الآن - أعد فتحه من start-3001.bat", safety: safety.filename });
      setTimeout(() => process.exit(0), 1500);
    } catch (err: any) {
      try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
      try { if (req.file) { fs.unlinkSync(req.file.path); fs.unlinkSync(req.file.path + ".zip"); } } catch {}
      res.status(500).json({ success: false, error: err.message || "فشلت الاستعادة" });
    }
  });

  
  // ============================================
  // JAMEETY/ZESTY DISK STORE (browser-independent persistence)
  // ============================================
  await dbRun(`
    CREATE TABLE IF NOT EXISTS jameety_kv (
      ns TEXT,
      key TEXT,
      value TEXT,
      updated_at TEXT,
      PRIMARY KEY (ns, key)
    )
  `);

  // Pull: whole namespace
  app.get("/api/jameety-kv", async (req, res) => {
    try {
      const ns = String((req.query as any).ns || "jameety");
      if (ns !== "jameety" && ns !== "zesty") return res.status(400).json({ error: "نطاق غير صالح" });
      const rows = await dbAll("SELECT key, value FROM jameety_kv WHERE ns = ?", [ns]);
      const data: Record<string, string> = {};
      for (const r of rows) data[r.key] = r.value;
      res.json({ success: true, count: rows.length, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Push: upsert namespace entries
  app.post("/api/jameety-kv", async (req, res) => {
    try {
      const { ns, entries } = req.body as { ns: string; entries: Record<string, string> };
      if ((ns !== "jameety" && ns !== "zesty") || !entries || typeof entries !== "object") {
        return res.status(400).json({ error: "بيانات غير صالحة" });
      }
      const now = new Date().toISOString();
      let count = 0;
      for (const [k, v] of Object.entries(entries)) {
        if (typeof v !== "string") continue;
        await dbRun("INSERT INTO jameety_kv (ns, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(ns, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", [ns, k, v, now]);
        count++;
      }
      res.json({ success: true, count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete keys (decontamination)
  app.post("/api/jameety-kv/delete", async (req, res) => {
    try {
      const { ns, keys } = req.body as { ns: string; keys: string[] };
      if ((ns !== "jameety" && ns !== "zesty") || !Array.isArray(keys)) {
        return res.status(400).json({ error: "بيانات غير صالحة" });
      }
      let count = 0;
      for (const k of keys) {
        if (typeof k !== "string") continue;
        await dbRun("DELETE FROM jameety_kv WHERE ns = ? AND key = ?", [ns, k]);
        count++;
      }
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'حذف بيانات جامعتي/زيستي', ?)", [
        new Date().toISOString(),
        "النظام",
        `حذف ${count} مفتاح من ${ns}`
      ]);
      res.json({ success: true, count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== TAMWEEN CARDS API ====================
  app.get("/api/tamween-cards", async (req, res) => {
    try {
      const cards = await dbAll("SELECT * FROM tamween_cards ORDER BY id DESC");
      res.json(cards);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tamween-cards/search", async (req, res) => {
    try {
      const { secret } = req.query;
      if (!secret) return res.status(400).json({ error: "الرقم السري مطلوب" });
      const card = await dbGet("SELECT * FROM tamween_cards WHERE secret_number = ?", [secret]);
      if (card) {
        res.json(card);
      } else {
        res.json(null);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/tamween-cards", async (req, res) => {
    try {
      const { card_number, secret_number, family_count, value, holder_name } = req.body;
      if (!card_number || !secret_number) {
        return res.status(400).json({ error: "رقم البطاقة والرقم السري مطلوبين" });
      }
      const exists = await dbGet("SELECT id FROM tamween_cards WHERE card_number = ?", [card_number]);
      if (exists) {
        return res.status(400).json({ error: "رقم البطاقة مسجل بالفعل" });
      }
      await dbRun(
        "INSERT INTO tamween_cards (card_number, secret_number, family_count, value, holder_name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [card_number, secret_number, family_count || 1, value || 0, holder_name || "", new Date().toISOString()]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/tamween-cards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { card_number, secret_number, family_count, value, holder_name } = req.body;
      await dbRun(
        "UPDATE tamween_cards SET card_number=?, secret_number=?, family_count=?, value=?, holder_name=? WHERE id=?",
        [card_number, secret_number, family_count, value, holder_name, id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/tamween-cards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await dbRun("DELETE FROM tamween_cards WHERE id=?", [id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== TAMWEEN CUSTOMERS API ====================
  app.get("/api/tamween-customers", async (req, res) => {
    try {
      const customers = await dbAll("SELECT * FROM tamween_customers ORDER BY id DESC");
      res.json(customers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tamween-customers/stats", async (req, res) => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const total = (await dbGet("SELECT COUNT(*) as c FROM tamween_customers WHERE status = 'withdrawn' AND status_month = ?", [currentMonth])).c;
      const withdrawn = (await dbGet("SELECT COUNT(*) as c FROM tamween_customers WHERE status = 'withdrawn' AND status_month = ?", [currentMonth])).c;
      const later = (await dbGet("SELECT COUNT(*) as c FROM tamween_customers WHERE status = 'later' AND status_month = ?", [currentMonth])).c;
      res.json({ total, withdrawn, later });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Tamween Monthly Reconciliation Report
  app.get("/api/tamween/monthly-report", async (req, res) => {
    try {
      const month = req.query.month as string || new Date().toISOString().slice(0, 7);
      
      // Get invoices with tamween_discount for this month
      const invoices = await dbAll(
        "SELECT invoice_number, date, customer_supplier_name, subtotal, discount, tamween_discount, total, paid FROM invoices WHERE type = 'sales' AND tamween_discount > 0 AND date LIKE ? ORDER BY date ASC",
        [`${month}%`]
      );
      
      // Get tamween customers stats for this month
      const customers = await dbAll(
        "SELECT name, secret_number, card_value, status FROM tamween_customers WHERE status_month = ?",
        [month]
      );
      
      // Get replacements for this month
      const replacements = await dbAll(
        "SELECT * FROM tamween_replacements WHERE date LIKE ? ORDER BY date ASC",
        [`${month}%`]
      );
      
      // Calculate totals
      const totalTamweenDiscount = invoices.reduce((sum: number, inv: any) => sum + (inv.tamween_discount || 0), 0);
      const totalInvoiceValue = invoices.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
      const totalSubtotal = invoices.reduce((sum: number, inv: any) => sum + (inv.subtotal || 0), 0);
      const withdrawnCount = customers.filter((c: any) => c.status === 'withdrawn').length;
      const laterCount = customers.filter((c: any) => c.status === 'later').length;
      const totalReplacementsValue = replacements.reduce((sum: number, r: any) => sum + (r.total_value || 0), 0);
      
      res.json({
        month,
        summary: {
          total_invoices: invoices.length,
          total_subtotal: totalSubtotal,
          total_tamween_discount: totalTamweenDiscount,
          total_invoice_value: totalInvoiceValue,
          withdrawn_customers: withdrawnCount,
          later_customers: laterCount,
          total_customers: customers.length,
          total_replacements: replacements.length,
          total_replacements_value: totalReplacementsValue
        },
        invoices,
        customers,
        replacements
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Tamween Replacements (الاستعاضات)
  app.get("/api/tamween-replacements", async (req, res) => {
    try {
      const month = req.query.month as string;
      let query = "SELECT * FROM tamween_replacements ORDER BY date DESC";
      let params: any[] = [];
      if (month) {
        query = "SELECT * FROM tamween_replacements WHERE date LIKE ? ORDER BY date DESC";
        params = [`${month}%`];
      }
      const replacements = await dbAll(query, params);
      res.json(replacements);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/tamween-replacements", async (req, res) => {
    try {
      const { date, invoice_number, supplier_name, items_description, items, total_value, status, notes } = req.body;
      const created_at = new Date().toISOString();
      const itemsJson = items ? JSON.stringify(items) : null;
      
      await dbRun(
        "INSERT INTO tamween_replacements (date, invoice_number, supplier_name, items_description, items_json, total_value, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [date, invoice_number || "", supplier_name || "", items_description || "", itemsJson, total_value || 0, status || "pending", notes || "", created_at]
      );
      
      const invIdRow = await dbGet("SELECT last_insert_rowid() as id");
      const replacementId = invIdRow.id;

      // Auto-create purchase invoice from tamween supplier if items provided
      if (items && Array.isArray(items) && items.length > 0) {
        const supRecord = await dbGet("SELECT id FROM suppliers WHERE name = ? AND is_tamween_supplier = 1", [supplier_name]);
        if (supRecord) {
          const genInvoiceNumber = `RE-${date.replace(/-/g, "")}-${replacementId}`;
          await dbRun(
            `INSERT INTO invoices (invoice_number, type, date, customer_supplier_name, payment_source, sale_type, subtotal, tax, discount, total, paid, remaining, created_by, created_at)
             VALUES (?, 'purchases', ?, ?, 'main_safe', NULL, ?, 0, 0, ?, 0, 0, 'النظام', ?)`,
            [genInvoiceNumber, date, supplier_name, total_value || 0, total_value || 0, created_at]
          );
          const invIdRow2 = await dbGet("SELECT last_insert_rowid() as id");
          const invoiceId = invIdRow2.id;

          for (const item of items) {
            await dbRun(
              `INSERT INTO invoice_items (invoice_id, barcode, name, quantity, unit, price, cost_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [invoiceId, item.barcode, item.name, item.quantity, item.unit || "قطعة", item.purchase_price, item.purchase_price, (item.quantity || 0) * (item.purchase_price || 0)]
            );
            // Update stock
            const existing = await dbGet("SELECT id, quantity, is_unlimited FROM items WHERE barcode = ?", [item.barcode]);
            if (existing) {
              const newQty = existing.is_unlimited === 1 ? existing.quantity : (existing.quantity + Number(item.quantity));
              await dbRun("UPDATE items SET quantity = ?, supplier_id = COALESCE(?, supplier_id), supplier_name = COALESCE(?, supplier_name) WHERE barcode = ?",
                [newQty, supRecord.id, supplier_name, item.barcode]);
            } else {
              await dbRun(`INSERT INTO items (barcode, name, purchase_price, retail_price, wholesale_price, quantity, unit, low_stock_limit, category, is_tamween, is_unlimited, supplier_id, supplier_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, 10, 'تموين', 0, 0, ?, ?)`,
                [item.barcode, item.name, item.purchase_price, (item.purchase_price || 0) * 1.2, item.purchase_price || 0, item.quantity || 0, item.unit || "قطعة", supRecord.id, supplier_name]);
            }
          }

          await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'فاتورة شراء استعاضة', ?)", [
            new Date().toISOString(), "النظام",
            `تم إنشاء فاتورة شراء ${genInvoiceNumber} بقيمة ${total_value} ج.م من مخزن التموين عبر استعاضة #${replacementId}`
          ]);
        }
      }

      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'استعاضة تموين', ?)", [
        new Date().toISOString(), "النظام",
        `تم إضافة استعاضة بقيمة ${total_value} ج.م من ${supplier_name}`
      ]);
      res.json({ success: true, invoice_generated: !!items && Array.isArray(items) && items.length > 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/tamween-replacements/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { date, invoice_number, supplier_name, items_description, total_value, status, notes } = req.body;
      await dbRun(
        "UPDATE tamween_replacements SET date=?, invoice_number=?, supplier_name=?, items_description=?, total_value=?, status=?, notes=? WHERE id=?",
        [date, invoice_number || "", supplier_name || "", items_description || "", total_value || 0, status || "pending", notes || "", id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/tamween-replacements/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await dbRun("DELETE FROM tamween_replacements WHERE id=?", [id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update monthly report to include replacements
  const originalMonthlyReport = app._router.stack.find((r: any) => r.route && r.route.path === '/api/tamween/monthly-report');
  
  // API - Tamween Replacements Summary (كشف التسويات الشهري والسنوي)
  app.get("/api/tamween-replacements/summary", async (req, res) => {
    try {
      const year = req.query.year as string || new Date().getFullYear().toString();
      
      // Monthly breakdown for the year
      const monthlyData = await dbAll(`
        SELECT 
          substr(date, 1, 7) as month,
          COUNT(*) as count,
          SUM(total_value) as total
        FROM tamween_replacements
        WHERE date LIKE ?
        GROUP BY substr(date, 1, 7)
        ORDER BY month ASC
      `, [`${year}%`]);
      
      // Annual total
      const annualRow = await dbGet(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(total_value), 0) as total
        FROM tamween_replacements
        WHERE date LIKE ?
      `, [`${year}%`]);
      
      // All replacements for the year (detailed)
      const allReplacements = await dbAll(`
        SELECT * FROM tamween_replacements
        WHERE date LIKE ?
        ORDER BY date DESC
      `, [`${year}%`]);
      
      // Monthly detail maps
      const monthlyDetails: Record<string, any[]> = {};
      for (const r of allReplacements) {
        const m = r.date?.substring(0, 7) || "غير محدد";
        if (!monthlyDetails[m]) monthlyDetails[m] = [];
        monthlyDetails[m].push(r);
      }

      res.json({
        year,
        annual: { count: annualRow.count, total: annualRow.total },
        monthly: monthlyData,
        monthly_details: monthlyDetails,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Tamween Products (المنتجات التموينية)
  app.get("/api/tamween-products", async (req, res) => {
    try {
      const products = await dbAll("SELECT * FROM tamween_products ORDER BY id DESC");
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/tamween-products", async (req, res) => {
    try {
      const { barcode, name, category, quantity, unit, purchase_price, retail_price, wholesale_price } = req.body;
      const created_at = new Date().toISOString();
      
      // Add to tamween_products table
      await dbRun(
        "INSERT INTO tamween_products (barcode, name, category, quantity, unit, purchase_price, retail_price, wholesale_price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [barcode, name, category || "عام", quantity || 0, unit || "قطعة", purchase_price || 0, retail_price || 0, wholesale_price || 0, created_at]
      );
      
      // Also add to main items table for cashier to use
      try {
        await dbRun(
          "INSERT OR REPLACE INTO items (barcode, name, purchase_price, retail_price, wholesale_price, quantity, unit, low_stock_limit, category, is_unlimited) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [barcode, name, purchase_price || 0, retail_price || 0, wholesale_price || 0, quantity || 0, unit || "قطعة", 5, category || "عام", 0]
        );
      } catch (itemErr) {
        console.log("[Tamween] Could not add to items table:", itemErr);
      }
      
      await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'منتج تمويني', ?)", [
        new Date().toISOString(),
        "النظام",
        `تم إضافة منتج تمويني: ${name}`
      ]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/tamween-products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { barcode, name, category, quantity, unit, purchase_price, retail_price, wholesale_price } = req.body;
      
      // Update tamween_products table
      await dbRun(
        "UPDATE tamween_products SET barcode=?, name=?, category=?, quantity=?, unit=?, purchase_price=?, retail_price=?, wholesale_price=? WHERE id=?",
        [barcode, name, category || "عام", quantity || 0, unit || "قطعة", purchase_price || 0, retail_price || 0, wholesale_price || 0, id]
      );
      
      // Also update in main items table
      try {
        await dbRun(
          "UPDATE items SET name=?, purchase_price=?, retail_price=?, wholesale_price=?, quantity=?, unit=?, category=? WHERE barcode=?",
          [name, purchase_price || 0, retail_price || 0, wholesale_price || 0, quantity || 0, unit || "قطعة", category || "عام", barcode]
        );
      } catch (itemErr) {
        console.log("[Tamween] Could not update items table:", itemErr);
      }
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/tamween-products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await dbRun("DELETE FROM tamween_products WHERE id=?", [id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Tamween Products Stats
  app.get("/api/tamween-products/stats", async (req, res) => {
    try {
      const totalProducts = (await dbGet("SELECT COUNT(*) as c FROM tamween_products")).c;
      const totalValue = (await dbGet("SELECT COALESCE(SUM(quantity * purchase_price), 0) as total FROM tamween_products")).total;
      const totalQuantity = (await dbGet("SELECT COALESCE(SUM(quantity), 0) as total FROM tamween_products")).total;
      res.json({ totalProducts, totalValue, totalQuantity });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tamween-customers/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.json([]);
      const customers = await dbAll(
        "SELECT * FROM tamween_customers WHERE name LIKE ? OR secret_number LIKE ? OR phone LIKE ? ORDER BY id DESC",
        [`%${q}%`, `%${q}%`, `%${q}%`]
      );
      res.json(customers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tamween-customers/by-secret/:secret", async (req, res) => {
    try {
      const { secret } = req.params;
      const customer = await dbGet("SELECT * FROM tamween_customers WHERE secret_number = ?", [secret]);
      res.json(customer || null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/tamween-customers", async (req, res) => {
    try {
      const { name, secret_number, phone, card_value, bread_points } = req.body;
      if (!name || !secret_number) {
        return res.status(400).json({ error: "اسم العميل والرقم السري مطلوبين" });
      }
      const exists = await dbGet("SELECT id FROM tamween_customers WHERE secret_number = ?", [secret_number]);
      if (exists) {
        return res.status(400).json({ error: "الرقم السري مسجل بالفعل لعميل آخر" });
      }
      await dbRun(
        "INSERT INTO tamween_customers (name, secret_number, phone, card_value, bread_points, status, status_month, created_at) VALUES (?, ?, ?, ?, ?, '', '', ?)",
        [name, secret_number, phone || "", card_value || 0, bread_points || 0, new Date().toISOString()]
      );
      const newCustomer = await dbGet("SELECT * FROM tamween_customers WHERE secret_number = ?", [secret_number]);
      res.json({ success: true, customer: newCustomer });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/tamween-customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, secret_number, phone, card_value, bread_points } = req.body;
      await dbRun(
        "UPDATE tamween_customers SET name=?, secret_number=?, phone=?, card_value=?, bread_points=? WHERE id=?",
        [name, secret_number, phone, card_value, bread_points, id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/tamween-customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await dbRun("DELETE FROM tamween_customers WHERE id=?", [id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Activate card (صرف في وقت لاحق)
  app.post("/api/tamween-customers/:id/activate", async (req, res) => {
    try {
      const { id } = req.params;
      const currentMonth = new Date().toISOString().slice(0, 7);
      const customer = await dbGet("SELECT * FROM tamween_customers WHERE id = ?", [id]);
      if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
      if (customer.status === "withdrawn" && customer.status_month === currentMonth) {
        return res.status(400).json({ error: "العميل اصرف الشهر ده بالفعل - ممنوع" });
      }
      await dbRun("UPDATE tamween_customers SET status = 'later', status_month = ? WHERE id = ?", [currentMonth, id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Withdraw now (صرف الآن)
  app.post("/api/tamween-customers/:id/withdraw-now", async (req, res) => {
    try {
      const { id } = req.params;
      const currentMonth = new Date().toISOString().slice(0, 7);
      const customer = await dbGet("SELECT * FROM tamween_customers WHERE id = ?", [id]);
      if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
      if (customer.status === "withdrawn" && customer.status_month === currentMonth) {
        return res.status(400).json({ error: "العميل اصرف الشهر ده بالفعل - ممنوع الصرف المكرر" });
      }
      await dbRun("UPDATE tamween_customers SET status = 'withdrawn', status_month = ? WHERE id = ?", [currentMonth, id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/tamween-customers/reset-monthly", async (req, res) => {
    try {
      await dbRun("UPDATE tamween_customers SET status = '', status_month = ''");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get customer transaction history
  app.get("/api/tamween-customers/:id/history", async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await dbGet("SELECT * FROM tamween_customers WHERE id = ?", [id]);
      if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
      
      // Get all invoices for this customer
      const invoices = await dbAll(
        "SELECT * FROM invoices WHERE customer_supplier_name = ? AND type = 'sales' ORDER BY date DESC, id DESC",
        [customer.name]
      );
      
      // Get customer replacements (if any)
      const replacements = await dbAll(
        "SELECT * FROM tamween_replacements WHERE customer_name = ? ORDER BY id DESC",
        [customer.name]
      );
      
      res.json({ customer, invoices, replacements });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Treasury API
  app.get("/api/treasury", async (req, res) => {
    try {
      const sales = await dbAll("SELECT payment_source, SUM(paid) as total_paid FROM invoices WHERE type = 'sales' AND (status != 'returned' OR status IS NULL) GROUP BY payment_source");
      const purchases = await dbAll("SELECT payment_source, SUM(paid) as total_paid FROM invoices WHERE type = 'purchases' AND (status != 'returned' OR status IS NULL) GROUP BY payment_source");
      const expenses = await dbAll("SELECT payment_source, SUM(amount) as total_amount FROM expenses GROUP BY payment_source");
      
      const transactions = await dbAll("SELECT * FROM treasury_transactions ORDER BY id DESC LIMIT 50");
      
      let cash_register = 0;
      let main_safe = 0;

      sales.forEach(s => {
        if (s.payment_source === 'cash_register') cash_register += s.total_paid;
        if (s.payment_source === 'main_safe') main_safe += s.total_paid;
      });

      purchases.forEach(p => {
        if (p.payment_source === 'cash_register') cash_register -= p.total_paid;
        if (p.payment_source === 'main_safe') main_safe -= p.total_paid;
      });

      expenses.forEach(e => {
        const source = e.payment_source || 'cash_register';
        if (source === 'cash_register') cash_register -= e.total_amount;
        if (source === 'main_safe') main_safe -= e.total_amount;
      });

      const allTx = await dbAll("SELECT * FROM treasury_transactions");
      allTx.forEach(tx => {
        if (tx.type === 'deposit') {
          if (tx.destination === 'cash_register') cash_register += tx.amount;
          if (tx.destination === 'main_safe') main_safe += tx.amount;
        } else if (tx.type === 'withdraw') {
          if (tx.source === 'cash_register') cash_register -= tx.amount;
          if (tx.source === 'main_safe') main_safe -= tx.amount;
        } else if (tx.type === 'transfer') {
          if (tx.source === 'cash_register') cash_register -= tx.amount;
          if (tx.source === 'main_safe') main_safe -= tx.amount;
          if (tx.destination === 'cash_register') cash_register += tx.amount;
          if (tx.destination === 'main_safe') main_safe += tx.amount;
        }
      });

      res.json({
        balances: {
          cash_register,
          main_safe
        },
        transactions
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/treasury/transaction", async (req, res) => {
    try {
        const { type, amount, source, destination, notes, user_name } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({error: "المبلغ غير صحيح"});

        await dbRun("INSERT INTO treasury_transactions (type, amount, source, destination, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)", [
            type, Number(amount), source, destination, new Date().toISOString(), notes, user_name || 'System'
        ]);

        let logMsg = `حركة ${type} بقيمة ${amount} ج.م`;
        if (type === 'transfer') logMsg = `تحويل مبلغ ${amount} ج.م من ${source === 'cash_register' ? 'الدرج' : 'الخزنة'} إلى ${destination === 'cash_register' ? 'الدرج' : 'الخزنة'}`;

        await dbRun("INSERT INTO logs (timestamp, user, action, details) VALUES (?, ?, 'حركة مالية', ?)", [
            new Date().toISOString(),
            user_name || "System",
            logMsg
        ]);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
  });

  // Held Invoices API
  app.get("/api/held-invoices", async (req, res) => {
    try {
      const rows = await dbAll("SELECT * FROM held_invoices ORDER BY tab_index ASC");
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/held-invoices", async (req, res) => {
    try {
      await dbRun("DELETE FROM held_invoices");
      const { invoices } = req.body;
      if (!invoices || !Array.isArray(invoices)) return res.json({ success: true });
      for (const inv of invoices) {
        await dbRun(
          `INSERT INTO held_invoices (tab_index, cart_json, customer_name, secret_number, sale_type, payment_method, payment_source, discount, tamween_cards_json, bread_points, bonus, paid, invoice_number, date, label, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            inv.tab_index ?? 0,
            JSON.stringify(inv.cart ?? []),
            inv.customer_name ?? "",
            inv.secret_number ?? "",
            inv.sale_type ?? "retail",
            inv.payment_method ?? "cash",
            inv.payment_source ?? "cash_register",
            inv.discount ?? 0,
            JSON.stringify(inv.tamween_cards ?? []),
            inv.bread_points ?? 0,
            inv.bonus ?? 0,
            inv.paid ?? 0,
            inv.invoice_number ?? "",
            inv.date ?? "",
            inv.label ?? "",
            new Date().toISOString(),
          ]
        );
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/held-invoices", async (req, res) => {
    try {
      await dbRun("DELETE FROM held_invoices");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite development vs production fallback
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // لا تراقب ملفات البيانات/النسخ/الرفوعات — أي كتابة فيها كانت تعيد تحميل الصفحة باستمرار
        watch: { ignored: ["**/database*.sqlite*", "**/backups/**", "**/uploads/**", "**/*.log", "**/dist/**"] },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(DATA_DIR, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Automatic startup backup of the database (keep last 7 copies)
  try {
    const backupsDir = path.join(DATA_DIR, "backups");
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dest = path.join(backupsDir, `database-${stamp}.sqlite`);
    fs.copyFileSync(dbPath, dest);
    const files = fs.readdirSync(backupsDir).filter((f) => f.startsWith("database-") && f.endsWith(".sqlite")).sort();
    while (files.length > 7) {
      const old = files.shift()!;
      try { fs.unlinkSync(path.join(backupsDir, old)); } catch {}
    }
    console.log(`[Backup] Startup backup saved (${files.length} kept)`);
  } catch (e) {
    console.error("[Backup] Startup backup failed:", e);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error("FATAL: Failed to start server:", e);
});
