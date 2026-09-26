// ============================================================================
//  توليد مفتاح تفعيل — أداة المالك فقط (لا تُشحن مع البرنامج)
//
//  الاستخدام:
//     node gen-license.cjs CAP-7F3A-9B21-4D05
//     node gen-license.cjs CAP-7F3A-9B21-4D05 --revoke
//
//  المفتاح الخاص مقروء من D:\CaptainPOS-KEYS\license.private.pem
// ============================================================================
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEYS_DIR = process.env.CAPTAIN_KEYS_DIR || "D:/CaptainPOS-KEYS";
const PRIV = path.join(KEYS_DIR, "license.private.pem");
const REVOKED = path.join(KEYS_DIR, "revoked.txt");

function fail(msg) {
  console.error("\n  ❌ " + msg + "\n");
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const code = (args[0] || "").trim().toUpperCase();

if (!/^CAP-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(code)) {
  fail('صيغة كود الجهاز غلط. الصيغة الصحيحة: CAP-XXXX-XXXX-XXXX\n   مثال:  node gen-license.cjs CAP-7F3A-9B21-4D05');
}
if (!fs.existsSync(PRIV)) fail("مفتاح التوقيع الخاص غير موجود:\n   " + PRIV);

// ==== وضع الرفض ====
if (flags.includes("--revoke")) {
  let list = [];
  try { list = fs.readFileSync(REVOKED, "utf8").split("\n").map((s) => s.trim()).filter(Boolean); } catch {}
  if (!list.includes(code)) list.push(code);
  fs.writeFileSync(REVOKED, list.join("\n") + "\n");
  console.log("\n  🚫 اتسجّل كود مرفوض: " + code);
  console.log("     (الرفض ده ملاحظة شخصية ليك — التوقيع لسه هيشتغل، الرفض الفعلي = متعطّلش تجديد المفاتيح)\n");
  process.exit(0);
}

// ==== توليد المفتاح ====
const priv = crypto.createPrivateKey(fs.readFileSync(PRIV, "utf8"));
const signature = crypto.sign(null, Buffer.from(code, "utf8"), priv);

// التحقق قبل الطباعة — مانطبعش مفتاح غلط أبدًا
const pubPem = fs.readFileSync(path.join(KEYS_DIR, "license.public.pem"), "utf8");
if (!crypto.verify(null, Buffer.from(code, "utf8"), crypto.createPublicKey(pubPem), signature)) {
  fail("التوقيع فشل التحقق — المفتاح الخاص مش متطابق مع العام");
}

const b64 = signature.toString("base64");
const grouped = b64.replace(/(.{4})/g, "$1-").replace(/-$/, "");

console.log("");
console.log("  كود الجهاز : " + code);
console.log("  مفتاح التفعيل:");
console.log("");
console.log("  " + grouped);
console.log("");
console.log("  ابعت المفتاح ده للعميل — يلزمه مرة واحدة على نفس الجهاز.");
console.log("");
