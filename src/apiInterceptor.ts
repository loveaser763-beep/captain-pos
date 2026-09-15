// Fetch API Interceptor to enable Serverless Local Failover (e.g. on Vercel)
import { initLocalDb, dbMock } from "./localDb";

// Set up globals
declare global {
  interface Window {
    __useLocalMockAPI?: boolean;
    __apiCheckPromise?: Promise<boolean>;
  }
}

// 1. Initialize local browser database seeds
initLocalDb();

// 2. Check if we should fall back to localStorage API
// We do a swift probe to the backend. If it returns 404 or connection fails, we toggle the fallback.
const probeBackend = async (): Promise<boolean> => {
  // If we are clearly on a static/serverless domain, bypass probe and use mock instantly.
  const hostname = window.location.hostname;
  if (
    hostname.includes("vercel.app") ||
    hostname.includes("netlify.app") ||
    hostname.includes("github.io") ||
    hostname.includes("localhost") === false && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/) && !hostname.includes("run.app")
  ) {
    console.warn("[API Interceptor] Static hosting detected. Standardizing to Browser Local persistence (localStorage).");
    window.__useLocalMockAPI = true;
    return true;
  }

  try {
    const res = await fetch("/api/settings", { method: "GET" });
    if (res.status === 404) {
      console.warn("[API Interceptor] Express server returned 404 for API. Emulating locally.");
      window.__useLocalMockAPI = true;
      return true;
    }
  } catch {
    console.warn("[API Interceptor] Express backend connection failed. Enabling client-only failover.");
    window.__useLocalMockAPI = true;
    return true;
  }
  return false;
};

// Initiate background probe immediately on app launch
window.__apiCheckPromise = probeBackend();

// Backup original fetch
const originalFetch = window.fetch;

// Create a custom mock Response generator
function createMockResponse(data: any, status = 200): Response {
  const jsonString = JSON.stringify(data);
  return new Response(jsonString, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

// Intercept window.fetch globally
const customFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlString = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  
  // Look only at requests going to "/api/"
  if (urlString.startsWith("/api/") || urlString.includes("/api/")) {
    // Wait for the probe to finish for a seamless transition
    if (window.__apiCheckPromise) {
      await window.__apiCheckPromise;
    }

    if (window.__useLocalMockAPI) {
      const method = init?.method?.toUpperCase() || "GET";
      const body = init?.body ? JSON.parse(init.body as string) : null;
      
      // Extract path of route
      const cleanUrl = urlString.replace(/^(https?:\/\/[^/]+)?/, ""); // gets e.g. /api/auth/login
      const urlPath = cleanUrl.split("?")[0];
      const searchParams = new URLSearchParams(cleanUrl.split("?")[1] || "");

      console.log(`[Mock API Handler] Intercepted: ${method} ${urlPath}`, { body, searchParams });

      try {
        // --- 1. Authentic Login ---
        if (urlPath === "/api/auth/login" && method === "POST") {
          const result = dbMock.login(body);
          if (result.success) return createMockResponse(result);
          return createMockResponse(result, 401);
        }

        // --- 2. Logs ---
        if (urlPath === "/api/logs" && method === "GET") {
          return createMockResponse(dbMock.getLogs());
        }

        // --- 3. Settings ---
        if (urlPath === "/api/settings") {
          if (method === "GET") {
            return createMockResponse(dbMock.getSettings());
          }
          if (method === "POST") {
            return createMockResponse(dbMock.saveSettings(body));
          }
        }

        // --- 4. Users CRUD ---
        if (urlPath === "/api/users") {
          if (method === "GET") return createMockResponse(dbMock.getUsers());
          if (method === "POST") return createMockResponse(dbMock.addUser(body));
        }
        if (urlPath.startsWith("/api/users/")) {
          const parts = urlPath.split("/");
          const id = Number(parts[parts.length - 1]);
          if (method === "PUT") return createMockResponse(dbMock.updateUser(id, body));
          if (method === "DELETE") {
            const creator = searchParams.get("logCreator") || "المدير";
            return createMockResponse(dbMock.deleteUser(id, creator));
          }
        }

        // --- 5. Suppliers CRUD ---
        if (urlPath === "/api/suppliers") {
          if (method === "GET") return createMockResponse(dbMock.getSuppliers());
          if (method === "POST") return createMockResponse(dbMock.addSupplier(body));
        }
        if (urlPath.startsWith("/api/suppliers/")) {
          const parts = urlPath.split("/");
          const id = Number(parts[parts.length - 1]);
          if (method === "PUT") return createMockResponse(dbMock.updateSupplier(id, body));
          if (method === "DELETE") {
            const creator = searchParams.get("logCreator") || "المدير";
            return createMockResponse(dbMock.deleteSupplier(id, creator));
          }
        }

        // --- 6. Items CRUD ---
        if (urlPath === "/api/items") {
          if (method === "GET") return createMockResponse(dbMock.getItems());
          if (method === "POST") {
            try {
              const res = dbMock.addItem(body);
              return createMockResponse(res);
            } catch (err: any) {
              return createMockResponse({ error: err.message }, 500);
            }
          }
        }
        if (urlPath === "/api/items/search" && method === "GET") {
          const query = searchParams.get("query") || "";
          const items = dbMock.getItems();
          const q = query.toLowerCase();
          const filtered = items.filter(
            it => it.barcode === query || it.name.includes(q) || it.barcode.includes(q)
          ).slice(0, 15);
          return createMockResponse(filtered);
        }
        if (urlPath.startsWith("/api/items/")) {
          const parts = urlPath.split("/");
          const id = Number(parts[parts.length - 1]);
          if (method === "PUT") {
            const res = dbMock.updateItem(id, body);
            if (res.success) return createMockResponse(res);
            return createMockResponse({ error: res.message }, 400);
          }
          if (method === "DELETE") {
            const creator = searchParams.get("logCreator") || "المدير";
            return createMockResponse(dbMock.deleteItem(id, creator));
          }
        }

        // --- 7. Invoices ---
        if (urlPath === "/api/invoices" && method === "GET") {
          const type = searchParams.get("type") || undefined;
          return createMockResponse(dbMock.getInvoices(type));
        }
        if (urlPath.startsWith("/api/invoices/")) {
          const parts = urlPath.split("/");
          const idStr = parts[parts.length - 1];

          if (idStr === "save-image") {
            // Simulated save image
            return createMockResponse({ success: true, url: "/last_invoice.png" });
          }

          const id = Number(idStr);
          if (method === "GET") {
            const result = dbMock.getInvoice(id);
            if (result) return createMockResponse(result);
            return createMockResponse({ error: "الفاتورة غير موجودة" }, 404);
          }
          if (method === "PUT") {
            return createMockResponse(dbMock.updateInvoice(id, body));
          }
        }

        // --- 8. Purchases & Sales Creators ---
        if (urlPath === "/api/purchases" && method === "POST") {
          return createMockResponse(dbMock.addPurchase(body));
        }
        if (urlPath === "/api/sales" && method === "POST") {
          return createMockResponse(dbMock.addSale(body));
        }
        if (urlPath.startsWith("/api/sales/return/")) { // e.g. /api/sales/return/:id
          const parts = urlPath.split("/");
          const id = Number(parts[parts.length - 1]);
          return createMockResponse(dbMock.returnInvoice(id, body));
        }

        // --- 9. Partners CRUD ---
        if (urlPath === "/api/partners") {
          if (method === "GET") return createMockResponse(dbMock.getPartners());
          if (method === "POST") return createMockResponse(dbMock.addPartner(body));
        }
        if (urlPath.startsWith("/api/partners/")) {
          const parts = urlPath.split("/");
          const id = Number(parts[parts.length - 1]);
          if (method === "PUT") return createMockResponse(dbMock.updatePartner(id, body));
          if (method === "DELETE") {
            const creator = searchParams.get("logCreator") || "المدير العام";
            return createMockResponse(dbMock.deletePartner(id, creator));
          }
        }

        // --- 10. Expenses CRUD ---
        if (urlPath === "/api/expenses") {
          if (method === "GET") return createMockResponse(dbMock.getExpenses());
          if (method === "POST") return createMockResponse(dbMock.addExpense(body));
        }
        if (urlPath.startsWith("/api/expenses/")) {
          const parts = urlPath.split("/");
          const id = Number(parts[parts.length - 1]);
          if (method === "PUT") return createMockResponse(dbMock.updateExpense(id, body));
          if (method === "DELETE") {
            const creator = searchParams.get("logCreator") || "المدير";
            return createMockResponse(dbMock.deleteExpense(id, creator));
          }
        }

        // --- 11. Audits & Inventory Sessions ---
        if (urlPath === "/api/inventory/audits") {
          if (method === "GET") return createMockResponse(dbMock.getAudits());
          if (method === "POST") return createMockResponse(dbMock.performAudit(body));
        }
        if (urlPath.startsWith("/api/inventory/audits/")) {
          const parts = urlPath.split("/");
          const id = Number(parts[parts.length - 1]);
          if (method === "GET") {
            const res = dbMock.getAuditDetails(id);
            if (res) return createMockResponse(res);
            return createMockResponse({ error: "جلسة الجرد غير موجودة" }, 404);
          }
        }

        // --- 12. Dashboard Stats ---
        if (urlPath === "/api/dashboard/stats" && method === "GET") {
          return createMockResponse(dbMock.getStats());
        }

        // --- 13. Reports Analytics Queries ---
        if (urlPath === "/api/reports" && method === "GET") {
          const start = searchParams.get("startDate") || new Date().toISOString().split("T")[0];
          const end = searchParams.get("endDate") || new Date().toISOString().split("T")[0];
          return createMockResponse(dbMock.getReportsData(start, end));
        }
        if (urlPath === "/api/reports/save-image" && method === "POST") {
          return createMockResponse({ success: true, url: "/last_report.png" });
        }

        // Fallback for unconfigured mock routes
        console.warn(`[Mock API Handler] Configuration missing for route: ${method} ${urlPath}`);
        return createMockResponse({ success: false, error: "Mock API Route Unconfigured" }, 404);
      } catch (err: any) {
        console.error(`[Mock API Handler] Failed logic processing:`, err);
        return createMockResponse({ success: false, error: err.message }, 500);
      }
    }
  }

  // Fallthrough to the original native fetch action
  return originalFetch(input, init);
};

// Intercept window.fetch securely using safe fallback property definitions
try {
  window.fetch = customFetch;
} catch (e) {
  try {
    Object.defineProperty(window, "fetch", {
      value: customFetch,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  } catch (err) {
    console.error("[API Interceptor] Absolute failure to patch window.fetch:", err);
  }
}
