// Shared Types for Supermarket POS and Management System

export interface User {
  id: number;
  username: string;
  name: string;
  role: "admin" | "cashier" | "storekeeper" | "developer";
  permissions: string[]; // ['sales', 'purchases', 'items', 'suppliers', 'reports', 'users', 'developer']
}

export interface Supplier {
  id?: number;
  name: string;
  phone: string;
  address: string;
}

export interface Item {
  id?: number;
  barcode: string;
  name: string;
  purchase_price: number;
  retail_price: number;
  wholesale_price: number;
  quantity: number;
  unit: string;
  low_stock_limit: number;
  is_unlimited?: number; // 0 for limited, 1 for unlimited/unknown stock
  is_tamween?: number; // 0 for normal, 1 for ration (تموين) item
  category?: string;
  supplier_id?: number | null;
  supplier_name?: string | null;
}

export type UnitType = "كرتونة" | "قطعة" | "دستة" | "علبة" | "كيلو" | "جرام" | "متر" | "وحدة";

export interface InvoiceItem {
  barcode: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  cost_price?: number;
  total: number;
  is_unlimited?: number;
  stock_quantity?: number;
}

export interface Invoice {
  id?: number;
  invoice_number: string;
  type: "sales" | "purchases";
  date: string;
  customer_supplier_name: string;
  payment_source: "cash_register" | "main_safe"; // درج الكاشير أو الخزنة
  sale_type?: "retail" | "wholesale" | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  created_by: string;
  created_at?: string;
}

export interface ActivityLog {
  id: number;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface GraphDataPoint {
  date: string;
  label: string;
  sales: number;
  purchases: number;
}

export interface DashboardStats {
  sales: {
    total: number;
    count: number;
  };
  purchases: {
    total: number;
    count: number;
  };
  profit: number;
  lowStockCount: number;
  topSelling: Array<{
    barcode: string;
    name: string;
    total_qty: number;
    unit: string;
    total_sales: number;
  }>;
  recentInvoices: Invoice[];
  recentLogs: ActivityLog[];
  graphData: GraphDataPoint[];
}

export interface InventoryAudit {
  id?: number;
  timestamp: string;
  audited_by: string;
  total_items: number;
  net_deficit: number;
  net_surplus: number;
  notes?: string;
}

export interface InventoryAuditItem {
  id?: number;
  audit_id: number;
  barcode: string;
  name: string;
  system_qty: number;
  actual_qty: number;
  difference: number;
  cost_price: number;
  loss_surplus_value: number;
}

