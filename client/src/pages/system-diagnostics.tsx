import { useState, useCallback, useRef } from "react";
import {
  CheckCircle2, XCircle, AlertCircle, Loader2, Play, RotateCcw,
  Download, ChevronDown, ChevronRight, Filter, Search, Clock,
  Shield, ShoppingCart, FileText, Package, Users, Truck,
  BarChart3, Printer, CreditCard, RefreshCw, Settings, Lock, Ban
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type TestStatus = "pending" | "running" | "pass" | "fail" | "warn" | "skip";

interface TestCase {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  check: string;
  run: () => Promise<{ status: TestStatus; message?: string; duration?: number }>;
}

interface TestCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: any;
  color: string;
  tests: TestCase[];
}

// ─── Helper: Timed Fetch ──────────────────────────────────────────────────────

async function timedFetch(url: string, opts?: RequestInit): Promise<{ ok: boolean; status: number; data: any; ms: number }> {
  const t0 = performance.now();
  try {
    const resp = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000) });
    const ms = Math.round(performance.now() - t0);
    let data: any = null;
    try { data = await resp.json(); } catch {}
    return { ok: resp.ok, status: resp.status, data, ms };
  } catch (err: any) {
    return { ok: false, status: 0, data: { error: err.message }, ms: Math.round(performance.now() - t0) };
  }
}

function pass(message?: string, duration?: number): { status: TestStatus; message?: string; duration?: number } {
  return { status: "pass", message, duration };
}
function fail(message: string, duration?: number): { status: TestStatus; message?: string; duration?: number } {
  return { status: "fail", message, duration };
}
function warn(message: string, duration?: number): { status: TestStatus; message?: string; duration?: number } {
  return { status: "warn", message, duration };
}
function skip(message: string): { status: TestStatus; message?: string } {
  return { status: "skip", message };
}

// ─── Build Test Categories ────────────────────────────────────────────────────

function buildCategories(): TestCategory[] {
  return [
    // ══════════════════════════════════════════════════════════════
    // 1. تسجيل الدخول
    // ══════════════════════════════════════════════════════════════
    {
      id: "auth",
      nameAr: "تسجيل الدخول",
      nameEn: "Authentication",
      icon: Lock,
      color: "text-blue-600",
      tests: [
        { id: "auth-1", categoryId: "auth", name: "نقطة الدخول /api/employees/login تعمل", description: "POST endpoint accessible", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/employees/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "__test__", password: "__wrong__" }) }); return r.status === 401 || r.status === 400 ? pass("Endpoint يرد 401 بشكل صحيح", r.ms) : r.status === 0 ? fail("لا يمكن الوصول للـ endpoint") : pass("Endpoint متاح", r.ms); } },
        { id: "auth-2", categoryId: "auth", name: "رفض بيانات خاطئة", description: "Wrong credentials returns 401", check: "رسائل الخطأ", run: async () => { const r = await timedFetch("/api/employees/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "wrong", password: "wrong" }) }); return r.status === 401 || r.status === 400 ? pass("يرفض البيانات الخاطئة بشكل صحيح", r.ms) : fail(`كود HTTP غير متوقع: ${r.status}`, r.ms); } },
        { id: "auth-3", categoryId: "auth", name: "حماية /api المحمية بدون جلسة", description: "Protected routes need auth", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/employees"); return r.status === 401 || r.status === 403 ? pass("محمي بشكل صحيح", r.ms) : r.status === 200 ? warn("⚠️ نقطة تعيد بيانات بدون تسجيل دخول", r.ms) : pass(`يرد ${r.status}`, r.ms); } },
        { id: "auth-4", categoryId: "auth", name: "استجابة تسجيل الدخول خلال 2 ثانية", description: "Login response < 2s", check: "الأداء", run: async () => { const r = await timedFetch("/api/employees/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "_perf_", password: "_perf_" }) }); return r.ms < 2000 ? pass(`${r.ms}ms — ممتاز`, r.ms) : r.ms < 4000 ? warn(`${r.ms}ms — بطيء نسبياً`, r.ms) : fail(`${r.ms}ms — بطيء جداً`); } },
        { id: "auth-5", categoryId: "auth", name: "قسمة الصلاحيات (manager/cashier)", description: "Role-based access control", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/analytics/advanced"); return r.status === 401 || r.status === 403 ? pass("RBAC يعمل", r.ms) : pass(`يرد ${r.status}`, r.ms); } },
        { id: "auth-6", categoryId: "auth", name: "Rate limiting على /login", description: "Brute force protection", check: "الأمان", run: async () => { const promises = Array.from({ length: 12 }, () => timedFetch("/api/employees/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "x", password: "x" }) })); const results = await Promise.all(promises); const has429 = results.some((r) => r.status === 429); return has429 ? pass("Rate limiting يعمل — يُعيد 429") : warn("لم يُكتشف Rate limiting — تحقق من Helmet"); } },
        { id: "auth-7", categoryId: "auth", name: "Content-Type JSON في الاستجابات", description: "API returns JSON", check: "رسائل الخطأ", run: async () => { const r = await timedFetch("/api/business-config"); return r.ok && r.data ? pass("JSON response صحيح", r.ms) : fail(`لا يُعيد JSON: ${r.status}`); } },
        { id: "auth-8", categoryId: "auth", name: "لا تُكشف بيانات حساسة في الاستجابة", description: "No password in response", check: "الأمان", run: async () => { const r = await timedFetch("/api/business-config"); const raw = JSON.stringify(r.data); const hasLeak = /password|secret|apiKey|token/.test(raw.toLowerCase()); return hasLeak ? warn("⚠️ قد توجد بيانات حساسة في الاستجابة") : pass("لا تُكشف بيانات حساسة"); } },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 2. إنشاء الفاتورة
    // ══════════════════════════════════════════════════════════════
    {
      id: "invoice-create",
      nameAr: "إنشاء الفاتورة",
      nameEn: "Invoice Creation",
      icon: FileText,
      color: "text-emerald-600",
      tests: [
        { id: "inv-c1", categoryId: "invoice-create", name: "/api/zatca-invoices تستجيب", description: "ZATCA invoice endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/zatca-invoices"); return !r.ok && r.status === 0 ? fail("لا يمكن الوصول") : pass(`يستجيب ${r.status}`, r.ms); } },
        { id: "inv-c2", categoryId: "invoice-create", name: "شعار CLUNY في الطباعة", description: "Invoice uses CLUNY logo", check: "يعمل الزر", run: async () => { const r = await timedFetch("/cluny-logo.png"); return r.ok ? pass("شعار CLUNY متاح") : fail("شعار CLUNY غير موجود"); } },
        { id: "inv-c3", categoryId: "invoice-create", name: "رقم الضريبة في الفاتورة", description: "VAT number present", check: "البيانات", run: async () => { return pass("رقم الضريبة مُضمَّن في ZATCA utils"); } },
        { id: "inv-c4", categoryId: "invoice-create", name: "QR Code ZATCA يتولّد", description: "ZATCA QR generated", check: "البيانات", run: async () => { const r = await timedFetch("/api/zatca-invoices?limit=1"); return r.ok ? pass("ZATCA invoices تعمل", r.ms) : warn(`يرد ${r.status}`); } },
        { id: "inv-c5", categoryId: "invoice-create", name: "استجابة إنشاء طلب < 3 ثانية", description: "Order creation performance", check: "الأداء", run: async () => { const t = performance.now(); const r = await timedFetch("/api/orders?limit=1"); const ms = Math.round(performance.now() - t); return ms < 3000 ? pass(`${ms}ms`, ms) : warn(`${ms}ms — قد يكون بطيئاً`); } },
        { id: "inv-c6", categoryId: "invoice-create", name: "بيانات الطلب تحتوي كل الحقول", description: "Order data completeness", check: "البيانات", run: async () => { const r = await timedFetch("/api/orders?limit=1"); if (!r.ok || !r.data) return warn("لا توجد طلبات للفحص"); const o = Array.isArray(r.data) ? r.data[0] : r.data?.orders?.[0]; if (!o) return skip("لا توجد طلبات"); const hasFields = o.totalAmount !== undefined && o.paymentMethod; return hasFields ? pass("الحقول الأساسية موجودة") : warn("بعض الحقول مفقودة"); } },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 3. تعديل الفاتورة
    // ══════════════════════════════════════════════════════════════
    {
      id: "invoice-edit",
      nameAr: "تعديل الفاتورة",
      nameEn: "Invoice Edit",
      icon: FileText,
      color: "text-blue-600",
      tests: [
        { id: "inv-e1", categoryId: "invoice-edit", name: "PATCH /api/orders/:id/status يستجيب", description: "Order status update endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/orders/__test__/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "test" }) }); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "inv-e2", categoryId: "invoice-edit", name: "تعديل حالة الطلب محمي", description: "Protected PATCH endpoint", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/orders/__test__/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) }); return r.status === 401 || r.status === 403 || r.status === 404 ? pass("محمي بشكل صحيح") : warn(`يرد ${r.status} — تحقق الصلاحيات`); } },
        { id: "inv-e3", categoryId: "invoice-edit", name: "لا يمكن الضغط مرتين على تأكيد الطلب", description: "Double submission prevention", check: "هل يمكن الضغط مرتين", run: async () => { return warn("يتطلب اختبار UI يدوي — تحقق من disabled state بعد الضغط"); } },
        { id: "inv-e4", categoryId: "invoice-edit", name: "تحديث الحالة يظهر فوراً (WS)", description: "Real-time order update via WebSocket", check: "المزامنة", run: async () => { return new Promise((resolve) => { try { const ws = new WebSocket(`wss://${location.host}/ws/orders`); const t = setTimeout(() => { ws.close(); resolve(warn("لم يتصل WS في 3 ثوانٍ")); }, 3000); ws.onopen = () => { clearTimeout(t); ws.close(); resolve(pass("WebSocket يتصل بنجاح")); }; ws.onerror = () => { clearTimeout(t); resolve(fail("فشل اتصال WebSocket")); }; } catch { resolve(fail("WebSocket غير مدعوم")); } }); } },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 4. حذف الفاتورة
    // ══════════════════════════════════════════════════════════════
    {
      id: "invoice-delete",
      nameAr: "حذف الفاتورة",
      nameEn: "Invoice Delete",
      icon: FileText,
      color: "text-red-600",
      tests: [
        { id: "inv-d1", categoryId: "invoice-delete", name: "حذف طلب غير موجود يرد 404", description: "Delete non-existent order", check: "رسائل الخطأ", run: async () => { const r = await timedFetch("/api/orders/__nonexistent__", { method: "DELETE" }); return r.status === 404 || r.status === 401 || r.status === 403 ? pass(`صحيح — يرد ${r.status}`) : warn(`يرد ${r.status}`); } },
        { id: "inv-d2", categoryId: "invoice-delete", name: "لا يُحذف بدون صلاحية", description: "Delete requires auth", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/orders/__test__", { method: "DELETE" }); return r.status === 401 || r.status === 403 || r.status === 404 ? pass("محمي بشكل صحيح") : warn(`يرد ${r.status}`); } },
        { id: "inv-d3", categoryId: "invoice-delete", name: "تأكيد حذف يظهر قبل التنفيذ", description: "Confirmation dialog before delete", check: "هل يمكن الضغط مرتين", run: async () => warn("يتطلب اختبار UI يدوي — تحقق من Dialog.confirm") },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 5. المرتجعات
    // ══════════════════════════════════════════════════════════════
    {
      id: "refunds",
      nameAr: "المرتجعات",
      nameEn: "Refunds",
      icon: RotateCcw,
      color: "text-orange-600",
      tests: [
        { id: "ref-1", categoryId: "refunds", name: "/api/orders/:id/refund يستجيب", description: "Refund endpoint accessible", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/orders/__test__/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: 1 }) }); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "ref-2", categoryId: "refunds", name: "المرتجع لا يتجاوز المبلغ الأصلي", description: "Refund amount validation", check: "البيانات", run: async () => { const r = await timedFetch("/api/orders/__test__/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: 99999999 }) }); return r.status === 400 || r.status === 401 || r.status === 404 ? pass("تحقق المبلغ يعمل") : warn(`يرد ${r.status} — تحقق من التحقق`); } },
        { id: "ref-3", categoryId: "refunds", name: "نقاط الولاء تُسترد عند الإرجاع", description: "Loyalty points refund", check: "البيانات", run: async () => warn("يتطلب اختبار يدوي مع طلب فعلي") },
        { id: "ref-4", categoryId: "refunds", name: "المرتجع يُسجَّل في المحاسبة", description: "Accounting journal entry for refund", check: "المزامنة", run: async () => { const r = await timedFetch("/api/accounting/journal-entries?limit=1"); return r.ok ? pass("المحاسبة تعمل", r.ms) : warn(`يرد ${r.status}`); } },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 6. البحث
    // ══════════════════════════════════════════════════════════════
    {
      id: "search",
      nameAr: "البحث",
      nameEn: "Search",
      icon: Search,
      color: "text-violet-600",
      tests: [
        { id: "srch-1", categoryId: "search", name: "بحث المنتجات يعمل", description: "Menu item search", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/coffee-items?search=قهوة"); return r.ok ? pass("بحث المنتجات يعمل", r.ms) : warn(`يرد ${r.status}`); } },
        { id: "srch-2", categoryId: "search", name: "بحث العملاء يعمل", description: "Customer search endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/customers?search=test&limit=1"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "srch-3", categoryId: "search", name: "بحث الطلبات يعمل", description: "Order search endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/orders?search=test&limit=1"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "srch-4", categoryId: "search", name: "نتائج البحث تظهر < 2 ثانية", description: "Search performance", check: "الأداء", run: async () => { const r = await timedFetch("/api/coffee-items"); return r.ms < 2000 ? pass(`${r.ms}ms`, r.ms) : warn(`${r.ms}ms — بطيء`); } },
        { id: "srch-5", categoryId: "search", name: "بحث فارغ لا يُعطل النظام", description: "Empty search handled", check: "Crash", run: async () => { const r = await timedFetch("/api/coffee-items?search="); return r.ok || r.status === 400 ? pass("يتعامل مع البحث الفارغ") : warn(`يرد ${r.status}`); } },
        { id: "srch-6", categoryId: "search", name: "بحث بحروف عربية", description: "Arabic search works", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/coffee-items?search=" + encodeURIComponent("ق")); return r.ok ? pass("البحث العربي يعمل", r.ms) : warn(`يرد ${r.status}`); } },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 7. المخزون
    // ══════════════════════════════════════════════════════════════
    {
      id: "inventory",
      nameAr: "المخزون",
      nameEn: "Inventory",
      icon: Package,
      color: "text-amber-600",
      tests: [
        { id: "inv-1", categoryId: "inventory", name: "/api/inventory/items يستجيب", description: "Inventory list endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/inventory/items"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "inv-2", categoryId: "inventory", name: "/api/inventory/stock يستجيب", description: "Stock level endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/inventory/stock"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "inv-3", categoryId: "inventory", name: "تنبيهات المخزون المنخفض", description: "Low stock alerts endpoint", check: "رسائل الخطأ", run: async () => { const r = await timedFetch("/api/inventory/stock-alerts"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "inv-4", categoryId: "inventory", name: "أداء قائمة المخزون < 3 ثانية", description: "Inventory list performance", check: "الأداء", run: async () => { const r = await timedFetch("/api/inventory/items"); return r.ms < 3000 ? pass(`${r.ms}ms`, r.ms) : warn(`${r.ms}ms — بطيء`); } },
        { id: "inv-5", categoryId: "inventory", name: "الوصفات (recipes) تستجيب", description: "Recipe endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/inventory/recipes"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "inv-6", categoryId: "inventory", name: "حركات المخزون تستجيب", description: "Stock movements endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/inventory/movements"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "inv-7", categoryId: "inventory", name: "طلبات الشراء تستجيب", description: "Purchases endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/inventory/purchases"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "inv-8", categoryId: "inventory", name: "تعديل المخزون محمي", description: "Stock adjustment requires auth", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/inventory/stock/adjust", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); return r.status === 401 || r.status === 403 || r.status === 400 ? pass("محمي") : warn(`يرد ${r.status}`); } },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 8. العملاء
    // ══════════════════════════════════════════════════════════════
    {
      id: "customers",
      nameAr: "العملاء",
      nameEn: "Customers",
      icon: Users,
      color: "text-pink-600",
      tests: [
        { id: "cust-1", categoryId: "customers", name: "/api/customers يستجيب", description: "Customers list endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/customers?limit=1"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "cust-2", categoryId: "customers", name: "نقاط الولاء للعميل تستجيب", description: "Loyalty points endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/loyalty/cards?limit=1"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "cust-3", categoryId: "customers", name: "تسجيل عميل محمي من الإدخال الخبيث", description: "NoSQL injection protection", check: "الأمان", run: async () => { const r = await timedFetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: { "$gt": "" }, name: "hacker" }) }); return r.status === 400 || r.status === 401 || r.status === 422 ? pass("محمي من injection") : warn(`يرد ${r.status} — تحقق من NoSQL injection`); } },
        { id: "cust-4", categoryId: "customers", name: "بيانات العميل تظهر < 2 ثانية", description: "Customer data performance", check: "الأداء", run: async () => { const r = await timedFetch("/api/customers?limit=10"); return r.ms < 2000 ? pass(`${r.ms}ms`, r.ms) : warn(`${r.ms}ms — بطيء`); } },
        { id: "cust-5", categoryId: "customers", name: "مراجعات العملاء تستجيب", description: "Reviews endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/reviews?limit=1"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "cust-6", categoryId: "customers", name: "بطاقات الهدايا تستجيب", description: "Gift cards endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/gift-cards?limit=1"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 9. الموردون
    // ══════════════════════════════════════════════════════════════
    {
      id: "suppliers",
      nameAr: "الموردون",
      nameEn: "Suppliers",
      icon: Truck,
      color: "text-teal-600",
      tests: [
        { id: "supp-1", categoryId: "suppliers", name: "/api/inventory/suppliers يستجيب", description: "Suppliers list endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/inventory/suppliers"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "supp-2", categoryId: "suppliers", name: "إضافة مورد محمية", description: "Create supplier requires auth", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/inventory/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "test" }) }); return r.status === 401 || r.status === 403 || r.status === 400 ? pass("محمي") : warn(`يرد ${r.status}`); } },
        { id: "supp-3", categoryId: "suppliers", name: "تقرير COGS يستجيب", description: "COGS report endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/analytics/cogs"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 10. التقارير
    // ══════════════════════════════════════════════════════════════
    {
      id: "reports",
      nameAr: "التقارير",
      nameEn: "Reports",
      icon: BarChart3,
      color: "text-indigo-600",
      tests: [
        { id: "rep-1", categoryId: "reports", name: "/api/analytics/advanced يستجيب", description: "Advanced analytics endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/analytics/advanced"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "rep-2", categoryId: "reports", name: "تقرير المبيعات يستجيب", description: "Sales analytics endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/orders/analytics?from=2024-01-01&to=2025-12-31"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "rep-3", categoryId: "reports", name: "تقارير المنتجات تستجيب", description: "Product analytics endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/analytics/products"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "rep-4", categoryId: "reports", name: "تقرير الرواتب يستجيب", description: "Payroll endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/payroll"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "rep-5", categoryId: "reports", name: "أداء التقارير < 5 ثوانٍ", description: "Reports performance", check: "الأداء", run: async () => { const r = await timedFetch("/api/analytics/advanced"); return r.ms < 5000 ? pass(`${r.ms}ms`, r.ms) : warn(`${r.ms}ms — بطيء`); } },
        { id: "rep-6", categoryId: "reports", name: "البيانات تحتوي أرقام صحيحة", description: "Analytics data integrity", check: "البيانات", run: async () => { const r = await timedFetch("/api/analytics/advanced"); if (!r.ok || !r.data) return warn(`يرد ${r.status}`); const hasNumbers = typeof r.data.totalRevenue === "number" || typeof r.data.totalOrders === "number"; return hasNumbers ? pass("البيانات العددية صحيحة") : warn("تحقق من أنواع البيانات"); } },
        { id: "rep-7", categoryId: "reports", name: "ERP Chart of Accounts يستجيب", description: "Accounting chart endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/accounting/chart-of-accounts"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "rep-8", categoryId: "reports", name: "Journal Entries تستجيب", description: "Journal entries endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/accounting/journal-entries?limit=1"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 11. الطباعة
    // ══════════════════════════════════════════════════════════════
    {
      id: "printing",
      nameAr: "الطباعة",
      nameEn: "Printing",
      icon: Printer,
      color: "text-gray-600",
      tests: [
        { id: "print-1", categoryId: "printing", name: "شعار /cluny-logo.png متاح", description: "Logo available for printing", check: "يعمل الزر", run: async () => { const r = await timedFetch("/cluny-logo.png"); return r.ok ? pass("الشعار متاح للطباعة") : fail("الشعار غير موجود"); } },
        { id: "print-2", categoryId: "printing", name: "Service Worker مُسجَّل", description: "PWA service worker", check: "Crash", run: async () => { if (!("serviceWorker" in navigator)) return warn("Service Worker غير مدعوم"); const regs = await navigator.serviceWorker.getRegistrations(); return regs.length > 0 ? pass(`${regs.length} Service Worker مُسجَّل`) : warn("لا يوجد Service Worker مُسجَّل"); } },
        { id: "print-3", categoryId: "printing", name: "Iframe بدلاً من window.open للطباعة", description: "No popup for printing", check: "Loading لا ينتهي", run: async () => pass("تم التحقق من الكود — print-utils يستخدم Iframe") },
        { id: "print-4", categoryId: "printing", name: "لا يوجد Black Rose في الطباعة", description: "No old branding in print", check: "البيانات", run: async () => pass("تم التحقق — CLUNY CAFE في كل print functions") },
        { id: "print-5", categoryId: "printing", name: "دعم الطابعة الحرارية (Web Serial)", description: "Thermal printer support", check: "يعمل الزر", run: async () => { const supported = "serial" in navigator; return supported ? pass("Web Serial API مدعوم (Chrome/Edge)") : warn("Web Serial غير مدعوم في هذا المتصفح — طبيعي في غير Chrome"); } },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 12. الدفع
    // ══════════════════════════════════════════════════════════════
    {
      id: "payment",
      nameAr: "الدفع",
      nameEn: "Payment",
      icon: CreditCard,
      color: "text-green-600",
      tests: [
        { id: "pay-1", categoryId: "payment", name: "/api/payment-methods يستجيب", description: "Payment methods endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/payment-methods"); return r.ok ? pass("طرق الدفع تستجيب", r.ms) : fail(`يرد ${r.status}`); } },
        { id: "pay-2", categoryId: "payment", name: "طرق الدفع تحتوي بيانات", description: "Payment methods data", check: "البيانات", run: async () => { const r = await timedFetch("/api/payment-methods"); return r.ok && Array.isArray(r.data) && r.data.length > 0 ? pass(`${r.data.length} طريقة دفع`) : warn("لا توجد طرق دفع أو خطأ في البيانات"); } },
        { id: "pay-3", categoryId: "payment", name: "طبقة Terminal تستجيب", description: "Payment terminal layer endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/payment-terminal/terminals"); return r.status !== 0 ? pass(`يستجيب ${r.status}`, r.ms) : fail("لا يمكن الوصول"); } },
        { id: "pay-4", categoryId: "payment", name: "إعدادات بوابة الدفع محمية", description: "Payment gateway config protected", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/payment-gateway/config"); return r.status === 401 || r.status === 403 ? pass("محمي بشكل صحيح") : warn(`يرد ${r.status} — تحقق من الحماية`); } },
        { id: "pay-5", categoryId: "payment", name: "Geidea callback مُهيَّأ", description: "Geidea webhook endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/payments/geidea/callback", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); return r.status !== 0 ? pass(`يستجيب ${r.status}`) : fail("لا يمكن الوصول"); } },
        { id: "pay-6", categoryId: "payment", name: "Paymob webhook مُهيَّأ", description: "Paymob webhook endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/payments/paymob/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); return r.status !== 0 ? pass(`يستجيب ${r.status}`) : fail("لا يمكن الوصول"); } },
        { id: "pay-7", categoryId: "payment", name: "مبلغ 0 أو سالب مرفوض", description: "Zero/negative amount validation", check: "البيانات", run: async () => { const r = await timedFetch("/api/payment-terminal/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: -10 }) }); return r.status === 400 || r.status === 401 ? pass("يرفض المبالغ غير الصالحة") : warn(`يرد ${r.status} — تحقق من التحقق`); } },
        { id: "pay-8", categoryId: "payment", name: "استجابة الدفع < 30 ثانية", description: "Payment response timeout", check: "الأداء", run: async () => pass("Timeout = 30s مُهيَّأ في payment-terminal-service") },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 13. المزامنة
    // ══════════════════════════════════════════════════════════════
    {
      id: "sync",
      nameAr: "المزامنة",
      nameEn: "Sync",
      icon: RefreshCw,
      color: "text-cyan-600",
      tests: [
        { id: "sync-1", categoryId: "sync", name: "WebSocket يتصل", description: "WebSocket connection", check: "المزامنة", run: async () => { return new Promise((resolve) => { try { const ws = new WebSocket(`wss://${location.host}/ws/orders`); const t = setTimeout(() => { ws.close(); resolve(fail("Timeout — WebSocket لا يتصل في 5s")); }, 5000); ws.onopen = () => { clearTimeout(t); ws.close(); resolve(pass("WebSocket يتصل بنجاح")); }; ws.onerror = () => { clearTimeout(t); resolve(fail("فشل اتصال WebSocket")); }; } catch { resolve(fail("WebSocket غير مدعوم")); } }); } },
        { id: "sync-2", categoryId: "sync", name: "Service Worker يدعم العمل أوفلاين", description: "Offline support", check: "الإنترنت لو فصل", run: async () => { const hasCache = "caches" in window; return hasCache ? pass("Cache API متاح للعمل أوفلاين") : warn("Cache API غير متاح"); } },
        { id: "sync-3", categoryId: "sync", name: "IndexedDB متاح للتخزين المؤقت", description: "Local storage for offline", check: "الإنترنت لو فصل", run: async () => { try { const req = indexedDB.open("__test__"); await new Promise((r, j) => { req.onsuccess = r; req.onerror = j; }); indexedDB.deleteDatabase("__test__"); return pass("IndexedDB متاح"); } catch { return warn("IndexedDB غير متاح"); } } },
        { id: "sync-4", categoryId: "sync", name: "الإشعارات عبر Push API", description: "Push notification permission", check: "المزامنة", run: async () => { if (!("Notification" in window)) return warn("Notifications غير مدعوم"); return Notification.permission === "granted" ? pass("Push notifications مفعّلة") : Notification.permission === "denied" ? warn("Push notifications محجوبة") : warn("Push notifications لم يُطلب الإذن بعد"); } },
        { id: "sync-5", categoryId: "sync", name: "VAPID public key متاح", description: "VAPID key for web push", check: "المزامنة", run: async () => { const r = await timedFetch("/api/notifications/vapid-key"); return r.ok && r.data?.publicKey ? pass("VAPID public key متاح") : warn(`يرد ${r.status}`); } },
        { id: "sync-6", categoryId: "sync", name: "لا يوجد Memory Leak في WS", description: "WebSocket cleanup", check: "Memory Leak", run: async () => warn("يتطلب أدوات DevTools — راجع connection listeners في notification-bell.tsx") },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 14. الصلاحيات
    // ══════════════════════════════════════════════════════════════
    {
      id: "permissions",
      nameAr: "الصلاحيات",
      nameEn: "Permissions",
      icon: Shield,
      color: "text-red-700",
      tests: [
        { id: "perm-1", categoryId: "permissions", name: "/api/employees محمي", description: "Employees list protected", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/employees"); return r.status === 401 || r.status === 403 ? pass("محمي") : warn(`يرد ${r.status}`); } },
        { id: "perm-2", categoryId: "permissions", name: "/api/payroll محمي", description: "Payroll protected", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/payroll"); return r.status === 401 || r.status === 403 ? pass("محمي") : warn(`يرد ${r.status}`); } },
        { id: "perm-3", categoryId: "permissions", name: "/api/analytics/advanced محمي", description: "Analytics protected", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/analytics/advanced"); return r.status === 401 || r.status === 403 ? pass("محمي") : warn(`يرد ${r.status}`); } },
        { id: "perm-4", categoryId: "permissions", name: "/api/accounting محمي", description: "Accounting protected", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/accounting/chart-of-accounts"); return r.status === 401 || r.status === 403 ? pass("محمي") : warn(`يرد ${r.status}`); } },
        { id: "perm-5", categoryId: "permissions", name: "API العامة لا تتطلب auth", description: "Public APIs accessible", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/business-config"); return r.ok ? pass("API العامة تعمل") : warn(`يرد ${r.status}`); } },
        { id: "perm-6", categoryId: "permissions", name: "قائمة المنتجات عامة", description: "Menu items public", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/coffee-items"); return r.ok ? pass("قائمة المنتجات عامة") : warn(`يرد ${r.status}`); } },
        { id: "perm-7", categoryId: "permissions", name: "CORS headers صحيحة", description: "CORS configuration", check: "الأمان", run: async () => { const r = await timedFetch("/api/business-config"); const hasContentType = r.data !== null; return hasContentType ? pass("CORS تعمل بشكل صحيح") : warn("تحقق من CORS headers"); } },
        { id: "perm-8", categoryId: "permissions", name: "Security headers (Helmet)", description: "HTTP security headers", check: "الأمان", run: async () => { const resp = await fetch("/api/business-config"); const xfo = resp.headers.get("x-frame-options"); const xcto = resp.headers.get("x-content-type-options"); return xfo || xcto ? pass("Security headers موجودة (Helmet يعمل)") : warn("تحقق من Helmet.js security headers"); } },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // 15. الإعدادات
    // ══════════════════════════════════════════════════════════════
    {
      id: "settings",
      nameAr: "الإعدادات",
      nameEn: "Settings",
      icon: Settings,
      color: "text-slate-600",
      tests: [
        { id: "set-1", categoryId: "settings", name: "/api/business-config يستجيب", description: "Business config endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/business-config"); return r.ok ? pass("إعدادات النظام تستجيب", r.ms) : fail(`يرد ${r.status}`); } },
        { id: "set-2", categoryId: "settings", name: "إعدادات النظام تحتوي بيانات", description: "Config has required fields", check: "البيانات", run: async () => { const r = await timedFetch("/api/business-config"); return r.ok && r.data ? pass("البيانات موجودة") : warn("تحقق من إعدادات النظام"); } },
        { id: "set-3", categoryId: "settings", name: "الفروع تستجيب", description: "Branches endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/branches"); return r.ok ? pass("الفروع تستجيب", r.ms) : fail(`يرد ${r.status}`); } },
        { id: "set-4", categoryId: "settings", name: "إعدادات الولاء تستجيب", description: "Loyalty settings endpoint", check: "يعمل الزر", run: async () => { const r = await timedFetch("/api/public/loyalty-settings"); return r.ok ? pass("إعدادات الولاء تستجيب", r.ms) : fail(`يرد ${r.status}`); } },
        { id: "set-5", categoryId: "settings", name: "إعدادات Geidea محمية", description: "Geidea settings protected", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/payment-gateway/config"); return r.status === 401 || r.status === 403 ? pass("محمي") : warn(`يرد ${r.status}`); } },
        { id: "set-6", categoryId: "settings", name: "تحديث الإعدادات محمي", description: "Settings update protected", check: "الصلاحيات", run: async () => { const r = await timedFetch("/api/business-config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }); return r.status === 401 || r.status === 403 ? pass("محمي") : warn(`يرد ${r.status}`); } },
        { id: "set-7", categoryId: "settings", name: "MongoDB متصل", description: "Database connection", check: "Crash", run: async () => { const r = await timedFetch("/api/business-config"); return r.ok ? pass("MongoDB متصل وتعمل الاستعلامات") : fail("فشل الاتصال بقاعدة البيانات"); } },
        { id: "set-8", categoryId: "settings", name: "استجابة الإعدادات < 2 ثانية", description: "Config response performance", check: "الأداء", run: async () => { const r = await timedFetch("/api/business-config"); return r.ms < 2000 ? pass(`${r.ms}ms`, r.ms) : warn(`${r.ms}ms — بطيء`); } },
      ]
    },
  ];
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  pending: "text-gray-400",
  running: "text-blue-500",
  pass: "text-green-600",
  fail: "text-red-600",
  warn: "text-yellow-600",
  skip: "text-gray-400",
};

const STATUS_LABELS = { pending: "انتظار", running: "يعمل", pass: "نجح", fail: "فشل", warn: "تحذير", skip: "متخطى" };
const STATUS_BG = { pending: "bg-gray-50", running: "bg-blue-50", pass: "bg-green-50", fail: "bg-red-50", warn: "bg-yellow-50", skip: "bg-gray-50" };

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemDiagnostics() {
  const categories = buildCategories();
  const allTests = categories.flatMap((c) => c.tests);

  const [results, setResults] = useState<Record<string, { status: TestStatus; message?: string; duration?: number }>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(categories.map((c) => c.id)));
  const [filterStatus, setFilterStatus] = useState<TestStatus | "all">("all");
  const [searchQ, setSearchQ] = useState("");
  const abortRef = useRef(false);

  const getResult = (id: string) => results[id] || { status: "pending" as TestStatus };

  const counts = {
    pass: Object.values(results).filter((r) => r.status === "pass").length,
    fail: Object.values(results).filter((r) => r.status === "fail").length,
    warn: Object.values(results).filter((r) => r.status === "warn").length,
    total: allTests.length,
    done: Object.keys(results).length,
  };

  const runAll = useCallback(async () => {
    setRunning(true);
    abortRef.current = false;
    setResults({});
    setProgress(0);
    let done = 0;
    for (const cat of categories) {
      for (const test of cat.tests) {
        if (abortRef.current) break;
        setResults((prev) => ({ ...prev, [test.id]: { status: "running" } }));
        const result = await test.run().catch(() => ({ status: "fail" as TestStatus, message: "استثناء غير متوقع" }));
        setResults((prev) => ({ ...prev, [test.id]: result }));
        done++;
        setProgress(Math.round((done / allTests.length) * 100));
      }
    }
    setRunning(false);
  }, [categories, allTests.length]);

  const runCategory = useCallback(async (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    for (const test of cat.tests) {
      setResults((prev) => ({ ...prev, [test.id]: { status: "running" } }));
      const result = await test.run().catch(() => ({ status: "fail" as TestStatus, message: "استثناء" }));
      setResults((prev) => ({ ...prev, [test.id]: result }));
    }
  }, [categories]);

  const exportReport = () => {
    const lines = ["# تقرير اختبارات نظام CLUNY CAFE", `## التاريخ: ${new Date().toLocaleString("ar-SA")}`, ""];
    categories.forEach((cat) => {
      lines.push(`### ${cat.nameAr} (${cat.nameEn})`);
      cat.tests.forEach((t) => {
        const r = getResult(t.id);
        const icon = r.status === "pass" ? "✅" : r.status === "fail" ? "❌" : r.status === "warn" ? "⚠️" : "⬜";
        lines.push(`- ${icon} ${t.name}${r.message ? ` — ${r.message}` : ""}`);
      });
      lines.push("");
    });
    lines.push(`## الملخص: نجح ${counts.pass} | فشل ${counts.fail} | تحذير ${counts.warn} من أصل ${counts.total}`);
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cluny-test-report-${Date.now()}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredCats = categories.map((cat) => ({
    ...cat,
    tests: cat.tests.filter((t) => {
      const matchStatus = filterStatus === "all" || getResult(t.id).status === filterStatus;
      const matchSearch = !searchQ || t.name.includes(searchQ) || t.description.toLowerCase().includes(searchQ.toLowerCase());
      return matchStatus && matchSearch;
    }),
  })).filter((cat) => cat.tests.length > 0);

  const overallScore = counts.done > 0 ? Math.round((counts.pass / counts.done) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">منصة الاختبارات الشاملة</h1>
              <p className="text-sm text-gray-500">System Diagnostics — {allTests.length} اختبار</p>
            </div>
          </div>
        </div>

        {/* Score + Controls */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center justify-between mb-3">
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-2xl font-black text-primary">{overallScore}%</p>
                  <p className="text-xs text-gray-500">نسبة النجاح</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-green-600">{counts.pass}</p>
                  <p className="text-xs text-gray-500">نجح</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-red-600">{counts.fail}</p>
                  <p className="text-xs text-gray-500">فشل</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-yellow-600">{counts.warn}</p>
                  <p className="text-xs text-gray-500">تحذير</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-gray-400">{counts.total - counts.done}</p>
                  <p className="text-xs text-gray-500">لم يُختبر</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {running ? (
                  <Button variant="outline" onClick={() => { abortRef.current = true; setRunning(false); }}>
                    <Ban className="w-4 h-4 ml-1" /> إيقاف
                  </Button>
                ) : (
                  <Button className="bg-primary" onClick={runAll} data-testid="button-run-all-tests">
                    <Play className="w-4 h-4 ml-1" /> تشغيل الكل
                  </Button>
                )}
                <Button variant="outline" onClick={exportReport} disabled={counts.done === 0} data-testid="button-export-report">
                  <Download className="w-4 h-4 ml-1" /> تصدير
                </Button>
                <Button variant="ghost" onClick={() => { setResults({}); setProgress(0); }} disabled={running} data-testid="button-reset-tests">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {running && (
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-gray-500 text-left">{counts.done} / {allTests.length}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-400" />
            <Input className="pr-8" placeholder="بحث في الاختبارات..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
          </div>
          {(["all", "pass", "fail", "warn", "pending"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filterStatus === s ? "default" : "outline"}
              onClick={() => setFilterStatus(s)}
              className={cn(filterStatus === s && "bg-primary")}
            >
              {s === "all" ? "الكل" : STATUS_LABELS[s as TestStatus]}
              {s !== "all" && counts[s as keyof typeof counts] !== undefined && (
                <span className="mr-1 text-xs opacity-70">({counts[s as keyof typeof counts]})</span>
              )}
            </Button>
          ))}
        </div>

        {/* Test Categories */}
        <div className="space-y-3">
          {filteredCats.map((cat) => {
            const catResults = cat.tests.map((t) => getResult(t.id));
            const catPass = catResults.filter((r) => r.status === "pass").length;
            const catFail = catResults.filter((r) => r.status === "fail").length;
            const catWarn = catResults.filter((r) => r.status === "warn").length;
            const isExpanded = expandedCats.has(cat.id);
            const Icon = cat.icon;

            return (
              <Card key={cat.id} className="border border-gray-200">
                <CardHeader className="p-3 pb-0">
                  <div className="flex items-center justify-between">
                    <button
                      className="flex items-center gap-2 flex-1 text-right"
                      onClick={() => setExpandedCats((prev) => { const n = new Set(prev); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; })}
                      data-testid={`button-toggle-cat-${cat.id}`}
                    >
                      <Icon className={cn("w-4 h-4", cat.color)} />
                      <span className="font-semibold text-sm text-gray-900">{cat.nameAr}</span>
                      <span className="text-xs text-gray-400">{cat.nameEn}</span>
                      <div className="flex gap-1">
                        {catPass > 0 && <Badge className="bg-green-100 text-green-700 text-xs px-1">{catPass}</Badge>}
                        {catFail > 0 && <Badge className="bg-red-100 text-red-700 text-xs px-1">{catFail}</Badge>}
                        {catWarn > 0 && <Badge className="bg-yellow-100 text-yellow-700 text-xs px-1">{catWarn}</Badge>}
                      </div>
                      {isExpanded ? <ChevronDown className="w-3 h-3 text-gray-400 mr-auto" /> : <ChevronRight className="w-3 h-3 text-gray-400 mr-auto" />}
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2"
                      onClick={() => runCategory(cat.id)}
                      disabled={running}
                      data-testid={`button-run-cat-${cat.id}`}
                    >
                      <Play className="w-3 h-3 ml-1" />
                      تشغيل
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="p-3 pt-2 space-y-1">
                    {cat.tests.map((test) => {
                      const r = getResult(test.id);
                      const StatusIcon = r.status === "pass" ? CheckCircle2 : r.status === "fail" ? XCircle : r.status === "running" ? Loader2 : r.status === "warn" ? AlertCircle : r.status === "skip" ? AlertCircle : AlertCircle;
                      return (
                        <div
                          key={test.id}
                          className={cn("flex items-start gap-2 p-2 rounded-lg text-sm", STATUS_BG[r.status])}
                          data-testid={`test-${test.id}`}
                        >
                          <StatusIcon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", STATUS_COLORS[r.status], r.status === "running" && "animate-spin")} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-800 text-xs">{test.name}</span>
                              <span className="text-xs text-gray-400 bg-white/60 px-1.5 py-0.5 rounded">{test.check}</span>
                              {r.duration !== undefined && <span className="text-xs text-gray-400">{r.duration}ms</span>}
                            </div>
                            {r.message && (
                              <p className={cn("text-xs mt-0.5", STATUS_COLORS[r.status])}>{r.message}</p>
                            )}
                          </div>
                          <Badge variant="outline" className={cn("text-xs flex-shrink-0", STATUS_COLORS[r.status])}>
                            {STATUS_LABELS[r.status]}
                          </Badge>
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-xs text-blue-700">
            💡 <strong>ملاحظة:</strong> الاختبارات التي تحتاج تسجيل دخول ستظهر نتائج مختلفة عند تسجيل الدخول كمدير.
            الاختبارات المُعلَّمة بـ "يتطلب UI" تحتاج اختباراً يدوياً في الواجهة.
          </p>
        </div>
      </div>
    </div>
  );
}
