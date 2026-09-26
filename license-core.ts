// ============================================================================
//  CaptainPOS — ترخيص بلا نت (Offline Activation)
//  آلية العمل: توقيع Ed25519 غير متماثل
//    • المفتاح الخاص موجود بره المشروع (D:\CaptainPOS-KEYS) ولا يُشحن أبدًا
//    • المفتاح العام مدمج هنا ويُنسخ لحزمة التنصيب فقط
//    • المفتاح = توقيع خاص فوق كود جهاز العميل، فتعذّر توليده بدون الخاص
// ============================================================================
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEALPxxbEi18VNFtbVt20/nws1PRBu7Ad8V/RtjhRiOUwA=
-----END PUBLIC KEY-----`;

const LICENSE_FILE = ".captain-license";

let cachedMaterial: string | null = null;

function readMachineGuid(): string | null {
  if (process.platform !== "win32") return null;
  try {
    const out = execFileSync(
      "reg",
      ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
      { encoding: "utf8", timeout: 8000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
    );
    const m = out.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function macMaterial(): string {
  try {
    const ifs = os.networkInterfaces();
    const macs: string[] = [];
    for (const list of Object.values(ifs)) {
      for (const i of list || []) {
        if (i && !i.internal && i.mac && i.mac !== "00:00:00:00:00:00") macs.push(i.mac.toLowerCase());
      }
    }
    return macs.sort().join("|");
  } catch {
    return "";
  }
}

// المادة الخام للبصمة: معرّف تثبيت ويندوز إن وُجد (يثبت حتى تغيير كارت الشبكة)،
// وإلا نرجع لهوية المضيف + عناوين MAC.
function fingerprintMaterial(): string {
  if (cachedMaterial) return cachedMaterial;
  const guid = readMachineGuid();
  cachedMaterial = guid ? `win:${guid}` : `net:${os.hostname().toLowerCase()}|${macMaterial()}`;
  return cachedMaterial;
}

// كود الجهاز المعروض للعميل: CAP-XXXX-XXXX-XXXX (48 بت من sha256)
export function machineCode(): string {
  const h = crypto.createHash("sha256").update(fingerprintMaterial()).digest("hex").slice(0, 12).toUpperCase();
  return `CAP-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
}

function licensePath(dataDir: string): string {
  return path.join(dataDir, LICENSE_FILE);
}

function verifySignature(code: string, signature: string): boolean {
  try {
    // نقبل base64 أو base64url، ونشيل فواصل التجميع (-) والمسافات
    // مفتاح التوليد يُنتج base64 قياسي (A-Za-z0-9+/=) بلا شرطة، فالحذف آمن
    const clean = String(signature || "").replace(/[^A-Za-z0-9+/=]/g, "");
    if (clean.length < 80) return false;
    const buf = Buffer.from(clean, "base64");
    if (buf.length !== 64) return false;
    return crypto.verify(
      null,
      Buffer.from(code, "utf8"),
      crypto.createPublicKey(LICENSE_PUBLIC_KEY_PEM),
      buf,
    );
  } catch {
    return false;
  }
}

export type LicenseStatus = {
  active: boolean;
  code: string;
  reason?: string;
  activatedAt?: string;
};

export function licenseStatus(dataDir: string): LicenseStatus {
  const code = machineCode();
  let raw: any;
  try {
    raw = JSON.parse(fs.readFileSync(licensePath(dataDir), "utf8"));
  } catch {
    return { active: false, code, reason: "غير مفعّل" };
  }
  if (String(raw?.code || "") !== code) {
    return { active: false, code, reason: "المفتاح مفعّل على جهاز آخر" };
  }
  if (!verifySignature(code, String(raw?.signature || ""))) {
    return { active: false, code, reason: "المفتاح غير صالح" };
  }
  return { active: true, code, activatedAt: String(raw?.activatedAt || "") };
}

export function activateLicense(
  dataDir: string,
  signature: string,
): { ok: boolean; error?: string; status: LicenseStatus } {
  const code = machineCode();
  if (!verifySignature(code, signature)) {
    return { ok: false, error: "مفتاح التفعيل غير صحيح لهذا الجهاز", status: licenseStatus(dataDir) };
  }
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const payload = { code, signature: String(signature).trim(), activatedAt: new Date().toISOString() };
    fs.writeFileSync(licensePath(dataDir), JSON.stringify(payload, null, 2), { mode: 0o600 });
  } catch (e: any) {
    return { ok: false, error: "تعذّر حفظ التفعيل: " + String(e?.message || e), status: licenseStatus(dataDir) };
  }
  return { ok: true, status: licenseStatus(dataDir) };
}

// ============================================================================
//  سجل التفعيلات — يُخزَّن عند المالك فقط (لا يُشحن مع البرنامج أبدًا)
// ============================================================================
export type IssuedEntry = {
  code: string;
  note: string;
  firstIssued: string;
  lastIssued: string;
  count: number;
  revoked: boolean;
};

function keysDirOf(): string {
  return process.env.CAPTAIN_KEYS_DIR || "D:/CaptainPOS-KEYS";
}

function logPath(): string {
  return path.join(keysDirOf(), "issued-keys.json");
}

export function loadIssuedLog(): IssuedEntry[] {
  try {
    const raw = JSON.parse(fs.readFileSync(logPath(), "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveIssuedLog(list: IssuedEntry[]): void {
  const dir = keysDirOf();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(logPath(), JSON.stringify(list, null, 2), { mode: 0o600 });
}

// يسجّل إصدار مفتاح ويُعيد المدخل + هل الكود صدر منه قبل كده
export function recordIssued(code: string, note: string): { entry: IssuedEntry; duplicate: boolean } {
  const list = loadIssuedLog();
  const now = new Date().toISOString();
  const found = list.find((e) => e.code === code);
  if (found) {
    found.lastIssued = now;
    found.count = (found.count || 1) + 1;
    if (note && note.trim()) found.note = note.trim();
    saveIssuedLog(list);
    return { entry: found, duplicate: true };
  }
  const entry: IssuedEntry = {
    code,
    note: (note || "").trim(),
    firstIssued: now,
    lastIssued: now,
    count: 1,
    revoked: false,
  };
  list.unshift(entry);
  saveIssuedLog(list);
  return { entry, duplicate: false };
}

export function updateIssuedNote(code: string, note: string): IssuedEntry | null {
  const list = loadIssuedLog();
  const e = list.find((x) => x.code === code);
  if (!e) return null;
  e.note = note.trim();
  saveIssuedLog(list);
  return e;
}

export function setIssuedRevoked(code: string, revoked: boolean): IssuedEntry | null {
  const list = loadIssuedLog();
  const e = list.find((x) => x.code === code);
  if (!e) return null;
  e.revoked = revoked;
  saveIssuedLog(list);
  return e;
}
