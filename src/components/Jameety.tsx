// Jameety.tsx — Ultra-Luxury Enterprise Shell (Obsidian & Platinum)
// Elite Sticky Command Bar + Entity Switch (جمعيتي / زيستي) + Seamless Collapsible Drawers
import { useState, useEffect } from "react";
import {
  Package,
  CreditCard,
  Wallet,
  TrendingUp,
  ChevronDown,
  Store,
  Sparkles,
  Scale,
  Layers,
  Lock,
} from "lucide-react";
import UnifiedPrintButton from "./UnifiedPrintButton";

import InventoryTab from "./jameety/InventoryTab";
import DebtsTab from "./jameety/DebtsTab";
import TreasuryTab from "./jameety/TreasuryTab";
import ProfitComparisonTab from "./jameety/ProfitComparisonTab";
import DifferencesTab from "./jameety/DifferencesTab";
import ClosingTab from "./jameety/ClosingTab";
import { pullAll, setJson, setStr, getStr, seedFromJson } from "../jameetyApi";

type JTab = "inventory" | "debts" | "treasury" | "differences" | "closing" | "profit";
type Entity = "jameety" | "zesty";

const ENTITY_META: Record<Entity, { label: string; blurb: string; Icon: any }> = {
  jameety: { label: "جمعيتي", blurb: "التموين الرئيسي", Icon: Store },
  zesty: { label: "زيستي", blurb: "(نادي بورتو الرياضي)", Icon: Sparkles },
};

const ENTITY_FILES: Record<Entity, { inv: string[]; debts: string; treasury: string; closing: string }> = {
  jameety: {
    inv: [
      "/jameety-data/inventory/inventory_august.json",
      "/jameety-data/inventory/inventory_august_part2.json",
      "/jameety-data/inventory/inventory_august_part3.json",
    ],
    debts: "/jameety-data/debts/debts_august.json",
    treasury: "/jameety-data/treasury/treasury_august.json",
    closing: "/jameety-data/closing/closing_august.json",
  },
  zesty: {
    inv: ["/zesty-data/inventory/zesty_inventory_august.json"],
    debts: "/zesty-data/debts/zesty_debts_august.json",
    treasury: "/zesty-data/treasury/zesty_treasury_august.json",
    closing: "/zesty-data/closing/zesty_closing_august.json",
  },
};

const monthsList = [
  "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

export default function Jameety({ initialEntity: initialEntityProp, key }: { key?: string | number; initialEntity?: Entity }) {
  // ===== State =====
  const [tab, setTab] = useState<JTab>("inventory");
  const storedEntity: Entity = (() => {
    try { return localStorage.getItem("lux_entity") === "zesty" ? "zesty" : "jameety"; }
    catch { return "jameety"; }
  })();
  const [entity, setEntity] = useState<Entity>(initialEntityProp ?? storedEntity);
  // كل كيان له شهره وسنته الخاصة (غير مرتبطين ببعض)
  const readPeriod = (e: Entity): { m: string; y: string } => {
    try {
      const raw = localStorage.getItem(`lux_period_${e}`);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.m && p.y) return { m: p.m, y: p.y };
      }
      const saved = localStorage.getItem(`jameety_selected_month_${e}`);
      if (saved) {
        const rawY = localStorage.getItem(`jameety_selected_year_${e}`);
        if (rawY) return { m: saved, y: rawY };
      }
    } catch {}
    return { m: "أغسطس", y: "2026" };
  };
  const [selectedMonth, setSelectedMonth] = useState(() => readPeriod(initialEntityProp ?? storedEntity).m);
  const [selectedYear, setSelectedYear] = useState(() => readPeriod(initialEntityProp ?? storedEntity).y);
  const [dataVersion, setDataVersion] = useState(0);
  const [diskState, setDiskState] = useState<"loading" | "ready">("loading");
  const [lockTick, setLockTick] = useState(0);

  // قفل التقفيلة: القراءة فقط بعد الاعتماد (لكل كيان وشهر)
  const lockKey = `${entity}_locked_${selectedYear}_${selectedMonth}`;
  const isLocked = lockTick > 0;
  const YEARS = Array.from({ length: 27 }, (_, i) => String(2024 + i)); // 2024 حتى 2050

  // التبديل بين الكيانات مع استدعاء فترة كل كيان الخاصة
  const switchEntity = (e: Entity) => {
    if (e === entity) return;
    setEntity(e);
    const p = readPeriod(e);
    setSelectedMonth(p.m);
    setSelectedYear(p.y);
    setTab("inventory");
  };

  // مزامنة الكيان القادم من القائمة الجانبية
  useEffect(() => {
    if (initialEntityProp && initialEntityProp !== entity) switchEntity(initialEntityProp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEntityProp]);

  // ===== Persist selection =====
  useEffect(() => {
    const savedMonth = localStorage.getItem(`jameety_selected_month_${entity}`);
    const savedYear = localStorage.getItem(`jameety_selected_year_${entity}`);
    if (savedMonth) setSelectedMonth(savedMonth);
    if (savedYear) setSelectedYear(savedYear);
  }, [entity]);

  useEffect(() => {
    localStorage.setItem("jameety_selected_month", selectedMonth);
    localStorage.setItem("jameety_selected_year", selectedYear);
    // حفظ فترة الكيان الحالي بشكل مستقل + مفاتيح خاصة بكل كيان (حل جذري ضد اختلاط الشهور)
    localStorage.setItem(`jameety_selected_month_${entity}`, selectedMonth);
    localStorage.setItem(`jameety_selected_year_${entity}`, selectedYear);
    try { localStorage.setItem(`lux_period_${entity}`, JSON.stringify({ m: selectedMonth, y: selectedYear })); } catch {}
  }, [selectedMonth, selectedYear, entity]);

  useEffect(() => {
    try { localStorage.setItem("lux_entity", entity); } catch {}
  }, [entity]);

  // قراءة حالة القفل كل ما الشهر/السنة يتغير
  useEffect(() => {
    const checkLock = async () => {
      try {
        const ns = entity;
        const lockKeyClosing = `locked_${selectedYear}_${selectedMonth}`;
        const existing = await pullAll(ns);
        const lockVal = existing[lockKeyClosing];
        setLockTick(lockVal === "1" ? 1 : 0);
      } catch {}
    };
    checkLock();
  }, [entity, selectedYear, selectedMonth]);

  // ===== Seed Data per entity (SQLite only) =====
  useEffect(() => {
    const boot = async () => {
      setDiskState("loading");
      try {
        const ns = entity;
        const files = ENTITY_FILES[ns];
        const invKey = `inventory_${selectedYear}_${selectedMonth}`;
        const debtsKey = `debts_data_${selectedYear}_${selectedMonth}`;
        const treasuryKey = `treasury_final_v3_${selectedYear}_${selectedMonth}`;
        const closingKey = `closing_${selectedYear}_${selectedMonth}`;

                // Check what already exists in SQLite
        const existing = await pullAll(ns);

        // قراءة حالة القفل من SQLite
        try {
          const lockKeyClosing = `locked_${selectedYear}_${selectedMonth}`;
          const lockValClosing = existing[lockKeyClosing];
          if (lockValClosing === "1") {
            setLockTick(1);
          }
        } catch {}

        // هجرة جذرية: وحّد مفاتيح التسوية القديمة (ns_settlement_*) مع القانونية (settlement_*)
        try {
          const canonKey = `settlement_${selectedYear}_${selectedMonth}`;
          const legacyKey = `${ns}_settlement_${selectedYear}_${selectedMonth}`;
          if ((!existing[canonKey] || Number(existing[canonKey]) === 0) && existing[legacyKey] && Number(existing[legacyKey]) !== 0) {
            await setStr(ns, canonKey, String(Number(existing[legacyKey])));
            existing[canonKey] = String(Number(existing[legacyKey]));
          }
          if ((!existing[`total_settlements`] || Number(existing[`total_settlements`]) === 0) && existing[`${ns}_total_settlements`] && Number(existing[`${ns}_total_settlements`]) !== 0) {
            await setStr(ns, `total_settlements`, String(Number(existing[`${ns}_total_settlements`])));
            existing[`total_settlements`] = String(Number(existing[`${ns}_total_settlements`]));
          }
        } catch {}
        const hasInv = existing[invKey] && JSON.parse(existing[invKey]).length > 0;
        const hasDebts = existing[debtsKey] && JSON.parse(existing[debtsKey]).length > 0;
        const hasTreasury = existing[treasuryKey] && JSON.parse(existing[treasuryKey]).length > 0;
        const hasClosing = existing[closingKey] && Object.keys(JSON.parse(existing[closingKey] || "{}")).length > 0;

        // Only seed if namespace is completely empty (first boot)
        const nsHasData = Object.keys(existing).length > 0;
        if (!nsHasData) {
          // Seed all missing data from JSON files (first boot only)
          if (!hasInv) {
            let allItems: any[] = [];
            for (const file of files.inv) {
              try {
                const res = await fetch(file);
                if (res.ok) {
                  const data = await res.json();
                  const arr = Array.isArray(data) ? data : (data.value || []);
                  allItems = [...allItems, ...arr];
                }
              } catch {}
            }
            if (allItems.length > 0) await setJson(ns, invKey, allItems);
          }
          if (!hasDebts) await seedFromJson(ns, debtsKey, files.debts);
          if (!hasTreasury) await seedFromJson(ns, treasuryKey, files.treasury);
          if (!hasClosing) await seedFromJson(ns, closingKey, files.closing);
        }
      } catch (e) {
        console.error("Boot error:", e);
      }
      setDataVersion(v => v + 1);
      setDiskState("ready");
    };
    boot();
  }, [entity, selectedYear, selectedMonth]);
  // ===== Drawer Configuration =====
  // كل تبويب له منطقة طباعة وعنوان زر خاصين به — الزر الموحد يطبع التبويب النشط فقط
  const TAB_PRINT: Record<JTab, { id: string; title: string }> = {
    inventory: { id: "jameety-print-inventory", title: "طباعة المخزون" },
    debts: { id: "jameety-print-debts", title: "طباعة الديون" },
    treasury: { id: "jameety-print-treasury", title: "طباعة الخزينة" },
    differences: { id: "jameety-print-differences", title: "طباعة الفروق" },
    closing: { id: "jameety-print-closing", title: "طباعة التقفيلة" },
    profit: { id: "jameety-print-profit", title: "طباعة مقارنة الأرباح" },
  };

  // إبلاغ زر الطباعة العام في الشريط العلوي بالتبويب النشط
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("jameety-print-target", { detail: TAB_PRINT[tab] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, entity]);
  const tabsConfig: { id: JTab; label: string; Icon: any; color: string; description: string }[] = [
    { id: "inventory", label: "المخزون", Icon: Package, color: "from-emerald-500 to-teal-500", description: "إدارة الأصناف والكميات" },
    { id: "debts", label: "الديون", Icon: CreditCard, color: "from-rose-500 to-pink-500", description: "الديون المستحقة والمدفوعة" },
    { id: "treasury", label: "الخزينة", Icon: Wallet, color: "from-violet-500 to-purple-500", description: "الخزينة والمصاريف" },
    ...(entity === "jameety" ? [{ id: "differences" as JTab, label: "فرق البضاعة المحروقة", Icon: Scale, color: "from-orange-500 to-amber-600", description: "سجل الفروق والخسائر الشهرية" }] : []),
    { id: "closing", label: "التقفيلة النهائية", Icon: Lock, color: "from-lime-500 to-green-600", description: "ملخص التقفيلة المعتمدة للشهر" },
    { id: "profit", label: "مقارنة الأرباح", Icon: TrendingUp, color: "from-cyan-500 to-blue-500", description: "مقارنة الأرباح الشهرية والسنوية" },
  ];

  const renderTabBody = (id: JTab) => {
    const k = `${entity}-${selectedYear}-${selectedMonth}-${dataVersion}`;
    switch (id) {
      case "inventory":
        return <InventoryTab key={`inventory-${k}`} ns={entity} locked={isLocked} selectedMonth={selectedMonth} selectedYear={selectedYear} />;
      case "debts":
        return <DebtsTab key={`debts-${k}`} ns={entity} locked={isLocked} selectedMonth={selectedMonth} selectedYear={selectedYear} />;
      case "treasury":
        return <TreasuryTab key={`treasury-${k}`} ns={entity} locked={isLocked} selectedMonth={selectedMonth} selectedYear={selectedYear} treasury={null} setTreasury={() => {}} />;
      case "closing":
        return <ClosingTab key={`closing-${k}`} ns={entity} selectedMonth={selectedMonth} selectedYear={selectedYear} onLockChange={() => setLockTick(t => t + 1)} />;
      case "differences":
        return <DifferencesTab key={`differences-${k}`} ns={entity} locked={isLocked} selectedMonth={selectedMonth} selectedYear={selectedYear} />;
      case "profit":
        return <ProfitComparisonTab key={`profit-${k}`} ns={entity} locked={isLocked} selectedYear={selectedYear} selectedMonth={selectedMonth} />;
      default:
        return null;
    }
  };

  const openDrawer = (id: JTab) => {
    // تمرير للأعلى أولاً
    const scroller = document.getElementById("jameety-scroll");
    if (scroller) scroller.scrollTo({ top: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "instant" });
    setTab(id);
    // انتظار اكتمال تمدد الدرج ثم التمرير لأوله
    setTimeout(() => {
      const el = document.getElementById(`drawer-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  const EntityIcon = ENTITY_META[entity].Icon;
  const activeMeta = tabsConfig.find((t) => t.id === tab)!;

  // ===== JSX =====
  return (
    <div className="lux-scope flex flex-col h-full overflow-hidden" dir="rtl">
      {/* ===== ELITE STICKY COMMAND BAR ===== */}
      <div className="lux-commandbar px-2 sm:px-3 pt-2 pb-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* تم حذف مفتاح التبديل من هنا — التبديل يتم فقط من القائمة الجانبية تحت زر جمعيتي */}

          {/* Brand pulse */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg">
              <EntityIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="lux-metallic text-sm leading-tight truncate">
                {ENTITY_META[entity].label} <span className="text-[10px] font-bold">• {ENTITY_META[entity].blurb}</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 -mt-0.5">
                {activeMeta.label} • {selectedMonth} {selectedYear}
              </p>
            </div>
          </div>

          <div className="flex-1" />

          {/* Disk status */}
          <span className="lux-chip" title="حالة الحفظ على القرص">
            {diskState === "loading" ? "جارٍ التحميل من القرص..." : "محفوظ على القرص"}
          </span>

          {/* Period selector + Print buttons */}
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="lux-select"
              aria-label="الشهر"
            >
              {monthsList.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="lux-select"
              aria-label="السنة"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <UnifiedPrintButton printableId={TAB_PRINT[tab].id} title={TAB_PRINT[tab].title} />
            </div>
          </div>
        </div>

        {/* Tab pills */}
        <div className="lux-pills mt-2" role="tablist" aria-label="أنظمة المنظومة">
          {tabsConfig.map((t) => {
            const Icon = t.Icon;
            return (
              <button
                key={t.id}
                role="tab"
                data-active={tab === t.id}
                onClick={() => openDrawer(t.id)}
                className="lux-pill"
                title={t.description}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== DRAWERS (accordion, state-preserving) ===== */}
      <div id="jameety-scroll" className="flex-1 overflow-y-auto lux-scroll px-2 sm:px-3 py-2">
        <div className="max-w-[1500px] mx-auto space-y-3 pb-6">
          {tabsConfig.map((t) => {
            const Icon = t.Icon;
            const open = tab === t.id;
            return (
              <section
                key={t.id}
                id={`drawer-${t.id}`}
                className="lux-glass lux-drawer scroll-mt-28"
                data-open={open}
              >
                <button className="lux-drawer-head" onClick={() => openDrawer(t.id)} aria-expanded={open}>
                  <span className="flex items-center gap-3 min-w-0">
                    <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center shadow-lg shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </span>
                    <span className="text-right min-w-0">
                      <span className="lux-glass-title block truncate">{t.label}</span>
                      <span className="lux-glass-sub block truncate">{t.description}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="lux-chip lux-chip-gold">{selectedMonth} {selectedYear}</span>
                    <ChevronDown className="lux-drawer-chev w-5 h-5 text-slate-400" />
                  </span>
                </button>
                <div className="lux-drawer-body">
                  <div className="lux-drawer-inner">
                    <div className="lux-divider mx-3" />
                    <div className="p-1.5 sm:p-2" id={TAB_PRINT[t.id].id}>
                      {t.id === "closing" ? (
                        renderTabBody(t.id)
                      ) : (
                        <div>
                          {isLocked && (
                            <div className="mb-2 flex items-center gap-2 text-[11px] font-black text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded-xl px-3 py-2">
                              <Lock className="w-4 h-4" />
                              مقفولة للقراءة فقط — التعديل من تبويب التقفيلة النهائية
                            </div>
                          )}
                          {renderTabBody(t.id)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}

          {/* Footer strip */}
          <div className="flex items-center justify-between px-2 pt-1 text-[10px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              {tabsConfig.length} أنظمة • {ENTITY_META[entity].label} • {selectedMonth} {selectedYear}
            </span>
            <span className="inline-flex items-center gap-2">
              <span>منظومة الكابتن — لهندسة الأرقام وريادة الأعمال</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
