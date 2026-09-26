# تقرير الفحص الشامل — CaptainPOS
**تاريخ الفحص:** 2026-09-26 · **طريقة الفحص:** قراءة فقط (4 فحوص متوازية) · **الحالة:** `tsc` ✅ · `build` ✅

> ملاحظة: فحوصات Jameety (الجمعية) اقتصرت على **الإبلاغ فقط** — مفيش أي تعديل اتعرض عليها، حسب طلبك.

---

## ⚡ الخلاصة في 10 ثواني

| | |
|---|---|
| 🔴 **حرج (يصلح فورًا)** | **5 أمور أمان** — أهمها إن **100 API من أصل 111 مفتوحة من غير تسجيل دخول**، وفيه مسار بيرفع ملف ZIP ويعدّل كود السيرفر نفسه من غير أي صلاحية |
| 🟠 **مهم** | ألوان باقية سوداء/مكسورة، جسر ثيم بيكسر الشفافية، كود ميت ~2000 سطر |
| 🟡 **متوسط** | `server.ts` = 4464 سطر في ملف واحد، 624 `any`، مفيش ESLint |
| ✅ **اتعمل** | #1 نقاط الخبز · #2 تباين النصوص · بوابة دخول المبرمج · شاشة الدخول Split Corporate |

---

## 🔴 1. أمان — 5 أمور لازم تتصلح

### 1.1 ❗ 100 مسار API مفتوحة بالكامل
- **الملف:** `server.ts`
- **الحقيقة:** من أصل **111 مسار**، بس **11 بس** محميّين بـ `requireAuth` (`server.ts:1143, 1153, 1176, 1208, 1863, 1956, 1966, 1997, 2078, 3094, 3105`)
- يعني **أي حد على نفس الشبكة** يقدر يعدّل الأصناف والفواتير والخزينة والإعدادات والمستخدمين
- **الحل:** بوابة واحدة `app.use("/api", requireAuth)` مع قائمة استثناء قصيرة (`/api/auth/login` فقط)

### 1.2 ❗ رفع ملفات يعدّل كود السيرفر (RCE)
- `server.ts:3238` — `POST /api/system/restore-snapshot`
- **من غير أي تسجيل دخول** يرفع ZIP، وبيعمل `fs.cpSync(...)` فوق `server.ts` و `src/` و `database.sqlite` (`server.ts:3271`) وبعدين `process.exit(0)` (`server.ts:3279`)
- **الحل:** `requireAuth, requireAdmin` + التحقق من توقيع الـ snapshot

### 1.3 ❗ استبدال أي حساب مستخدم
- `server.ts:923` — `POST /api/sync-from-local`
- مفيش فيه توثيق، محدّد بس بـ `req.body.confirmed === true` (`server.ts:926`)
- بيقبل `INSERT OR REPLACE INTO users` بما فيه `password` (`server.ts:937`) → **أسرق أي حساب بما فيه المدير**
- **الحل:** توثيق + منع استبدال عمود `password`

### 1.4 ❗ سر JWT ثابت ومنتشر
- `server.ts:19` — `process.env.JWT_SECRET || "captain-pos-secret-key-2024"`
- نفس السر ده موجود في `dist/server.cjs:37` (يتوزّع مع كل تنصيب)
- ملاحظة: **`dotenv` موجود في `package.json:78` بس مش مستورد في أي مكان** → ملف `.env` أصلًا مش بيتسجل → يعني السر الثابت ده دايمًا شغّال
- **الحل:** سر عشوائي واحد يتعمل عند أول تشغيل ويتحفظ بصلاحية 0600

### 1.5 ❗ كلمات سر افتراضية مكتوبة في الكود
| المكان | المحتوى |
|---|---|
| `server.ts:832-834, 867-869` | `admin123` / `cashier123` / `store123` بتتعمل **كل ما السيرفر يشتغل** |
| `server.ts:894` | `bcrypt.hash("561128")` — حساب **`ME561128`** بيتزرع كل تشغيلة |
| `server.ts:1932` | إعادة الضبط بترجّع `admin123` تاني |
| `src/localDb.ts:165,173,181` | كلمات السر دي **نص صريح في الواجهة الأمامية** |
| `src/components/jameety/data/jameety/settings/jameety_users.json:7,15` | `561128` و `12345678` صريح |
| `src/components/jameety/README.md:74-80` | الكريدينشالز مكتوبة في الدوكيومنتيشن |

### 1.6 حقن SQL (2 مسار)
- `server.ts:2088` — ``DELETE FROM ${table}`` حيث `table` جاي من **`req.body`**
- `server.ts:2095` — ``INSERT INTO ${table} (${cols}) ...`` حيث `cols` من **JSON الطلب** → حقن اسم عمود
- المحطّم من ورا `requireAuth+requireAdmin` بس (أي: أي `admin`)
- **الحل:** قائمة بيضاء على أسماء الجداول والأعمدة

### 1.7 أمور تانية
| الشدة | المكان | المشكلة |
|---|---|---|
| 🟠 | `server.ts:1033` | مفيش تقييد محاولات الدخول (brute force) |
| 🟠 | `server.ts:4438` | `app.listen(PORT, "0.0.0.0")` — السيرفر مفتوح على كل الكروت الشبكية، بس Electron محتاج `localhost` بس |
| 🟠 | مفيش `helmet` ولا `cors` ولا `csrf` في `package.json` إطلاقًا | |
| 🟠 | `server.ts:20, 1051` | توكن **30 يوم** بدون إلغاء — المستخدم اللي اتشال صلاحيته بيفضل `admin` شهر |
| 🟡 | `electron/main.cjs:142-145` | `shell.openExternal(url)` لأي سكيم بدون فلتر |
| 🟡 | `electron/main.cjs:116` | `sandbox: false` |
| ✅ | `electron/main.cjs:112-117` | `contextIsolation: true`, `nodeIntegration: false` — **سليم** |
| ✅ | باقي الـ SQL | كل الاستعلامات التانية بتستخدم `?` placeholders — **سليم** |
| ✅ | `server.ts:1043` | كلمات السر متخزنة bcrypt cost 10 — **سليم** |

---

## 🟠 2. الواجهة والثيمات

### 2.1 ❗ الجسر بيكسر الشفافية (19 مكان)
- `luxury.css:534` — `[class*="bg-[#000000]"] { background-color: var(--bg-deep) !important; }`
- الكلاس ده بيتطابق كمان مع `bg-[#000000]/60` → **السكريم الشفاف بيبقى لوح صلب**
- المتأثرة: `Dashboard.tsx:708,781,877,911` · `InvoicesRegister.tsx:325` · `Products.tsx:695` · `PurchaseInvoice.tsx:1049,1167` · `Reports.tsx:1053,1173` · `SalesInvoice.tsx:1594,2452,2505,2691` · `Suppliers.tsx:319,464` · `TamweenCustomers.tsx:624,1032` · `Users.tsx:291`
- نفس المشكلة مع `bg-white/20` (`luxury.css:535`) → بيخلي قواعد `index.css:174-176` **ميتة**

### 2.2 ❗ أبيض فوق أبيض (مش ظاهر خالص)
- مفيش قاعدة `[class*="text-[#ffffff]"]` في الجسر (فيه بس `hover:text-[#ffffff]`)
- `DeveloperPanel.tsx:425` — `bg-[#000000]` + `text-[#ffffff]` → في الثيم الأبيض: **نص أبيض على خلفية بيضا**
- `PurchaseInvoice.tsx:655, 671-687` — نفس المشكلة

### 2.3 ❗ أشرطة إجمالي الفواتير مش ظاهرة
| المكان | المشكلة |
|---|---|
| `SalesInvoice.tsx:2657-2661` | `backgroundColor:"var(--bg-deep)"` + `color:"#ffffff"` → في **pure-white**: أبيض على أبيض |
| `PurchaseInvoice.tsx:1261-1265` | نفس المشكلة |
| `InvoicesRegister.tsx:442` | نفس المشكلة |
| `InvoicesRegister.tsx:456` | `color:"#000"` على `--bg-card` → في **captain-nocturne**: أسود على كحلي ≈ 1.9:1 |

### 2.4 ❗ 7 خلفيات سوداء لسه موجودة
| المكان | المحتوى |
|---|---|
| `jameety/TreasuryTab.tsx:228` | `bg-slate-900` على زر رئيسي |
| `jameety/DebtsTab.tsx:170` | `bg-slate-900` على الفلتر النشط |
| `jameety/InventoryTab.tsx:305, 511` | `bg-slate-900` على الفئة/الصفحة النشطة |
| `jameety/DifferencesTab.tsx:162` | `bg-slate-900` على بلاطة أيقونة |
| `DeveloperPanel.tsx:486` | `bg-[#111111]` + نيون أخضر |
| `DeveloperPanel.tsx:425` | `bg-[#000000]` |

> ⚠️ **5 منها في Jameety** — زي ما طلبت: **ملمسهاش**. سجّلتها هنا بس عشان تعرف.

### 2.5 جدول الألوان الميتة (أُبلغ فقط)
- **85 كائن `style={{}}`** فيها لون hardcoded في 5 ملفات — `TamweenReplacements.tsx` (50)، `SalesInvoice.tsx` (12)، `PurchaseInvoice.tsx` (10)، `InvoicesRegister.tsx` (8)، `Dashboard.tsx` (5)
- **12 حدود inline** `borderColor: "#888888"` مش بتتحجّم بالجسر أصلًا (الجسر بيستهدف `class` مش `style`)
- **~40 عنصر** أبيض فوق لون فاتح بيفشل WCAG AA (مثلاً `bg-amber-500` = 1.9:1، `bg-[#f39c12]` = 2.2:1، `bg-[#27ae60]` = 2.9:1)
- `.lux-btn-primary` و `.lux-pill[data-active]` بيفشلوا في **الثيمات الفاتحة التلاتة** (3.5–3.8:1)

---

## 🟠 3. السيرفر والداتابيس

### 3.1 حرج
| # | المكان | المشكلة |
|---|---|---|
| 1 | `server.ts:55` | **`PRAGMA foreign_keys = ON` مش منفّذ** → كل `ON DELETE CASCADE` ديكور بس (اتأكدت live: `foreign_keys: 0`) |
| 2 | `server.ts:4427, 4449` | `fs.copyFileSync` على قاعدة WAL شغّالة → **بيفقد صفوف متسجلة في الـ WAL** (live: `-wal` = 28KB). `server.ts:3182` عنده `VACUUM INTO` الصح |
| 3 | `server.ts:4462` | لو السيرفر ما اتفتحش → بس `console.error` وخلاص، **مفيش `process.exit(1)`** → Electron يستنى 15 ثانية ويفشل برسالة غامضة |
| 4 | مفيش `BEGIN/COMMIT` **ولا مرة** في الملف | `POST /api/sales` بيعدّل الفاتورة + الأصناف + المخزون بدون ترانزاكشن → خطأ في النص = مخزون مكسور |
| 5 | `server.ts:2399 + 2449` | `getTamweenMonthSummary` بيتعاد استدعاؤه لحد **61 مستوى** × 5 استعلامات = **~305 استعلام لكل طلب داشبورد** (لأن `tamween_month_openings` فاضية) |

### 3.2 فهرسة — **فيه فهرس واحد بس في الداتابيس كلها**
محتاجة: `invoices(type, date)` · `invoices(status)` · `invoice_items(invoice_id)` · `invoice_items(barcode)` · `treasury_transactions(date)` · `logs(timestamp)` · `tamween_replacements(date)`

### 3.3 N+1 (استعلامات داخل لوبات)
`server.ts:1705` (مبيعات) · `:1579` (مشتريات) · `:1488` (جرد) · `:2182` (حذف فاتورة) · `:2243 + :2311` (مرتجعات) · `:4118` (تاريخ عميل) · `:3783` (استعاضات)

### 3.4 جداول و أعمدة زايدة (اتأكدت live)
- **8 جداول فاضية 0 صف:** `sales, sale_items, purchases, purchase_items, products, customers, debts, debt_payments`
- **أعمدة ميتة:** `items.tamween_price` · `invoices.pricing_mode` · `active_carts.pricing_mode` · `held_invoices.pricing_mode` · `tamween_customers.last_withdrawal_month` · `tamween_customers.blocked`
- `tamween_customers.withdrawn_at` → بتتقرأ في الواجهة (`TamweenCustomers.tsx:760`) بس **م بتتكتب أبدًا**
- عمود مزوّد مرتين: `items.supplier` (`server.ts:118`) و `items.supplier_name` (`server.ts:239`)

### 3.5 نقاط الخبز (#1) — **اللي اتصلح النهارده**
- ✅ `server.ts:2420` → دلوقتي بيجمّع من `invoices.bread_points` (كان بيجمّع من `tamween_customers.status` اللي تاريخه بضيع)
- ✅ `server.ts:2657` → نفس الكلام للفترة
- ⚠️ **باقي مصدر تالت لسه:** `jameety/TreasuryTab.tsx:39` بيتكتب فيه `bread_points` في `jameety_kv` — **ومفيش أي حد بيقراه** (اتأكدت: صفر قراءات). وكمان **المفتاح مش مربوط بالشهر** → أي شهر يتفتح بيكتب فوق اللي قبله
- → **محتاج قرار منك** قبل ما ألمسه (ده ملف Jameety)

### 3.6 4 تقارير تموين متداخلة
`server.ts:2419` · `:2605` · `:2616` · `:2699` — كل واحد بصيغة مختلفة. محتاجة دمج في `computeTamweenMonth()`

---

## 🟡 4. صحة الكود

### 4.1 كود ميت (~2000 سطر) — **حذفه بلا خطر**
| الملف | السطور | الحالة |
|---|---|---|
| `src/localDb.ts` | 1,220 | **مش مستورد من مكان** (المستورِد الوحيد `apiInterceptor.ts` وهو كمان ميت) |
| `src/apiInterceptor.ts` | 307 | **صفر استيرادات** |
| `src/jameetyDisk.ts` | 92 | **صفر استيرادات** |
| `src/components/TamweenProducts.tsx` | 339 | **مش مستورد** |
| `src/components/TamweenCustomers.tsx` | 1,097 | `App.tsx:186` فيه الـ case بس **مفيش حاجة بتستدعيه أبدًا** |
| `src/components/TamweenReport.tsx` | 283 | نفس المشكلة (`App.tsx:191`) |
| `src/App.tsx.bak` | 161 | نسخة احتياطية جوّه `src/` |
| `src/components/jameety/check_log.txt` | 0 | ملف فاضي |

> ⚠️ **3 منهم Jameety** (`TamweenCustomers`, `TamweenReport`, `TamweenProducts`) → **مستني رأيك**

### 4.2 ملفات عملاقة
| السطور | الملف |
|---:|---|
| **2,957** | `SalesInvoice.tsx` — **58 `useState`** + `return` واحد بطول 1465 سطر + JSX بعمق 26 |
| **4,464** | `server.ts` — **111 مسار في ملف واحد**، مفيش تقسيم خالص |
| 2,064 | `TamweenReplacements.tsx` — 47 `useState` |
| 1,312 | `PurchaseInvoice.tsx` |
| 1,307 | `Reports.tsx` — **4 تبويبات كاملة في ملف واحد** |
| 1,043 | `Dashboard.tsx` |
| 9 ملفات | فوق 800 سطر |

### 4.3 تكرار — أهم 5 بؤر
1. **هيدر الصفحة** منسوخ في **10 ملفات** (`Products.tsx:375`, `Users.tsx:166`, `Logs.tsx:133`, `Settings.tsx:307`, `Suppliers.tsx:150`, `Reports.tsx:414`, …)
2. **جدول البيانات** منسوخ في **10 ملفات** (~130 خلية بنفس الكلاسات)
3. **قشرة المودال** منسوخة في **6 ملفات**
4. **شريط أداة تبويبات Jameety** منسوخ في **5 ملفات**
5. **تنسيق الأرقام** — **240 استدعاء `.toFixed()`** في 32 ملف **من غير أي helper مشترك**

### 4.4 أدوات
- ❌ **مفيش ESLint/Prettier خالص** — `npm run lint` = `tsc --noEmit` بس
- ❌ `tsconfig.json` مفيهوش `strict` ولا `noUnusedLocals`
- ⚠️ **624 `any`** (430 في `src` + 194 في `server.ts`) — أكترهم `TamweenReplacements.tsx` (90) و `SalesInvoice.tsx` (70)
- ⚠️ **77 `as any`** + **8 `eslint-disable`** كلها `exhaustive-deps`
- ✅ **صفر `@ts-ignore`** · ✅ **صفر `TODO/FIXME/HACK`** · ✅ **صفر كود معلّق كبير**

### 4.5 `useEffect` خطر
`InventoryTab.tsx:54-65` · `InventoryTab.tsx:78-111` · `DebtsTab.tsx:45` — ناقصة dependencies → **ممكن تحفظ قيم قديمة**

### 4.6 تبعيات
| الحالة | التفاصيل |
|---|---|
| ❌ ميتة | `dotenv` (مش مستورد أبدًا) · `wait-on` (مش في أي سكربت) · `autoprefixer` (Tailwind v4 مش محتاجه) · `@types/bcrypt` (المشروع بيستخدم `bcryptjs`) |
| ⚠️ مكررة | `vite` موجود في `dependencies` **و** `devDependencies` |
| ⚠️ | `electron:dev` = `npm run dev & sleep 2 && ...` → **بيموت في PowerShell** (لازم `concurrently`) |
| ⚠️ | `.gitignore:14-15` بيتجاهل `public/zesty-data/` و `public/jameety-data/` → **كلون جديد = مفيش بيانات seed** |
| ⚠️ | الحجم: `index-*.js` = **1.36 MB** — مفيش `manualChunks` ولا `React.lazy` |

---

## 📋 5. خطة عمل مقترحة (مستني موافقتك)

### 🔴 الدفعة A — أمان (الأهم)
1. بوابة `requireAuth` عامة على `/api/*` + استثناء `POST /api/auth/login` فقط
2. قفل `POST /api/system/restore-snapshot` و `POST /api/sync-from-local`
3. سر JWT عشوائي بدل `"captain-pos-secret-key-2024"`
4. إيقاف تزريعة `admin123`/`561128` عند كل تشغيل + حذف كلمات السر من `src/localDb.ts`
5. قائمة بيضاء على أسماء الجداول والأعمدة في `server.ts:2088, 2095`
6. `app.listen(PORT, "127.0.0.1")` بدل `0.0.0.0`
7. إضافة `helmet` + تقييد محاولات الدخول

### 🟠 الدفعة B — ثيم وواجهة (ملمسهاش Jameety)
1. إصلاح كسر الشفافية في الجسر (`luxury.css:534-535`)
2. إضافة قاعدة `text-[#ffffff]` + إصلاح `DeveloperPanel.tsx` و `PurchaseInvoice.tsx`
3. إصلاح أشرطة الإجمالي في `SalesInvoice` / `PurchaseInvoice` / `InvoicesRegister`
4. إصلاح ~40 تباين أبيض-فوق-لون + `.lux-btn-primary`
5. توحيد الـ 85 لون inline في 5 ملفات (مهم `TamweenReplacements.tsx`)

### 🟠 الدفعة C — سيرفر
1. `PRAGMA foreign_keys = ON`
2. `VACUUM INTO` بدل `copyFileSync` في النسخ الاحتياطي
3. ترانزاكشنات حوالين `POST /api/sales`
4. كاش لـ `getTamweenMonthSummary` (305 استعلام → كاش واحد)
5. فهارس الـ 7 أعمدة
6. `process.exit(1)` عند فشل الإقفال

### 🟡 الدفعة D — صحة الكود
1. حذف الـ 4 ملفات الميتة من غير Jameety (`localDb.ts`, `apiInterceptor.ts`, `jameetyDisk.ts`, `App.tsx.bak`)
2. إضافة ESLint + تشغيل `noUnusedLocals`
3. استخراج `<PageHeader>` / `<DataTable>` / `<Modal>` / `src/utils/format.ts`
4. تقسيم `SalesInvoice.tsx` و `server.ts`
5. حذف التبعيات الميتة

### ⏸️ معلّقة — محتاجة قرارك
| # | الموضوع | ليه مستني |
|---|---|---|
| 1 | **ملفات Jameety الثلاثة الميتة** (`TamweenCustomers`, `TamweenReport`, `TamweenProducts`) | قلت "ملكيش دعوة بجمعيتي" |
| 2 | **7 خلفيات `bg-slate-900`** (5 منها Jameety + 2 في `DeveloperPanel`) | 5 منها Jameety |
| 3 | **`TreasuryTab.tsx:39`** — مفتاح `bread_points` ميت وغير مربوط بالشهر | Jameety |
| 4 | **إعادة تصميم لوحة المنظومة التموينية** | قلت "مش دي" |
| 5 | **رأيك في بوابة دخول المبرمج والشاشة الجديدة** | لازم `Ctrl+R` الأول |

---

## ✅ اللي اتنفذ في الجلسة دي
| # | الشغلانة | الحالة |
|---|---|---|
| 1 | نظام مطابقة مبيعات الماكينة (جدول + API + واجهة) | ✅ |
| 2 | تبسيط الثيمات لـ 4 بس + حارس `applyTheme` | ✅ |
| 3 | تحويل 87 لون inline لمتغيّرات الثيم | ✅ |
| 4 | مربع البطاقة اليدوية في فواتير التموين | ✅ |
| 5 | الشريط العلوي + القائمة الجانبية يتبعوا الثيم | ✅ |
| 6 | إزالة آخر الأسود المرئي (16 عنصر) | ✅ |
| 7 | شاشة الدخول → Split Corporate | ✅ |
| 8 | بوابة دخول المبرمج (يوزر/باسوورد يدوي) | ✅ |
| 9 | **#1** توحيد مصدر نقاط الخبز في `server.ts` | ✅ |
| 10 | **#2** إصلاح تباين `text-slate-600/700/800` | ✅ |
| 11 | إصلاح تباين `LangIndicator` | ✅ |
| 12 | الفحص الشامل (4 فحوص) | ✅ |
