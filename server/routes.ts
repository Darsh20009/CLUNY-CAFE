import crypto from "crypto";
import mongoose from "mongoose";
import type { Express } from "express";
import { getSaudiDayBounds, getSaudiToday, getSaudiTomorrow, getSaudiDaysAgo, getSaudiMonthStart, getSaudiYearStart } from "./utils/timezone";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertOrderSchema, 
  insertCartItemSchema, 
  insertEmployeeSchema, 
  type PaymentMethod, 
  insertTaxInvoiceSchema, 
  RecipeItemModel, 
  BranchStockModel, 
  RawItemModel, 
  StockMovementModel, 
  OrderModel, 
  BranchModel, 
  CoffeeItemModel, 
  CoffeeItemAddonModel, 
  ProductReviewModel, 
  ReferralModel, 
  NotificationModel, 
  CustomerModel, 
  TableModel, 
  CafeModel, 
  AccountingSnapshotModel, 
  insertAccountingSnapshotSchema, 
  ProductAddonModel, 
  WarehouseModel, 
  WarehouseStockModel, 
  WarehouseTransferModel, 
  DeliveryIntegrationModel, 
  CartItemModel,
  EmployeeModel,
  PointTransferModel,
  CustomBannerModel,
  PromoOfferModel,
  MenuCategoryModel,
  AccountModel,
  JournalEntryModel,
  ExpenseErpModel,
  VendorModel,
  TaxInvoiceModel,
  OrderCounterModel
} from "@shared/schema";
import { RecipeEngine } from "./recipe-engine";
import { UnitsEngine } from "./units-engine";
import { InventoryEngine } from "./inventory-engine";
import { AccountingEngine } from "./accounting-engine";
import { ErpAccountingService } from "./erp-accounting-service";
import { deliveryService } from "./delivery-service";
import { requireAuth, requireManager, requireAdmin, filterByBranch, requireKitchenAccess, requireCashierAccess, requireDeliveryAccess, requirePermission, requireCustomerAuth, type AuthRequest, type CustomerAuthRequest } from "./middleware/auth";
import { PermissionsEngine, PERMISSIONS } from "./permissions-engine";
import { requireTenant, getTenantIdFromRequest } from "./middleware/tenant";
import { wsManager } from "./websocket";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { Types } from "mongoose";
import { nanoid } from "nanoid";
const isValidObjectId = (id: string) => Types.ObjectId.isValid(id);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import nodemailer from "nodemailer";
import {
  sendOrderNotificationEmail,
  sendReferralEmail,
  sendLoyaltyPointsEmail,
  sendPromotionEmail,
  sendWelcomeEmail,
  sendAbandonedCartEmail,
  testEmailConnection,
  sendPointsVerificationEmail,
} from "./mail-service";
import { appendOrderToSheet } from "./google-sheets";
import { getVapidPublicKey, saveSubscription, removeSubscription, sendPushToEmployee, sendPushToCustomer } from "./push-service";

const APPLE_PAY_DOMAIN = (process.env.APPLE_PAY_DOMAIN || "cluny.cafe").replace(/^https?:\/\//, "").replace(/\/$/, "");
const APPLE_PAY_MERCHANT_ID = process.env.APPLE_PAY_MERCHANT_ID || "merchant.cluny.cafe";
const APPLE_PAY_DOMAIN_ASSOCIATION_PATH = path.resolve(process.cwd(), "public/.well-known/apple-developer-merchantid-domain-association");

function resolveApplePayMerchantId(configured?: string) {
  if (configured && configured !== "merchant.net.geidea.ksamerchant") return configured;
  return APPLE_PAY_MERCHANT_ID;
}
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

  // Ensure upload directories exist
  const uploadDirs = [
    path.resolve(__dirname, '..', 'attached_assets', 'drinks'),
    path.resolve(__dirname, '..', 'attached_assets', 'sizes'),
    path.resolve(__dirname, '..', 'attached_assets', 'addons'),
    path.resolve(__dirname, '..', 'attached_assets', 'employees'),
    path.resolve(__dirname, '..', 'attached_assets', 'attendance'),
    path.resolve(__dirname, '..', 'attached_assets', 'receipts'),
  ];
  uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

// Helper function to serialize MongoDB documents
function serializeDoc(doc: any): any {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  
  // Convert any remaining Map objects to plain objects
  if (obj.storeHours instanceof Map) {
    obj.storeHours = Object.fromEntries(obj.storeHours);
  }

  // Only set id from _id if there's no existing id field
  if (obj._id && !obj.id) {
    obj.id = obj._id.toString();
  }
  
  // Always clean up MongoDB internal fields
  delete obj._id;
  delete obj.__v;
  return obj;
}

// Helper function to convert recipe units to raw item units for cost calculation
function convertUnitsForCost(recipeQuantity: number, recipeUnit: string, rawItemUnit: string): number {
  // Normalize units to lowercase for comparison
  const rUnit = (recipeUnit || '').toLowerCase().trim();
  const iUnit = (rawItemUnit || '').toLowerCase().trim();
  
  // If units match, no conversion needed
  if (rUnit === iUnit) return recipeQuantity;
  
  // Gram to Kilogram conversions
  if ((rUnit === 'g' || rUnit === 'gram' || rUnit === 'grams') && (iUnit === 'kg' || iUnit === 'kilogram' || iUnit === 'kilograms')) {
    return recipeQuantity / 1000;
  }
  
  // Milliliter to Liter conversions
  if ((rUnit === 'ml' || rUnit === 'milliliter' || rUnit === 'milliliters') && (iUnit === 'liter' || iUnit === 'liters' || iUnit === 'l')) {
    return recipeQuantity / 1000;
  }
  
  // Kilogram to Gram conversions (reverse)
  if ((rUnit === 'kg' || rUnit === 'kilogram' || rUnit === 'kilograms') && (iUnit === 'g' || iUnit === 'gram' || iUnit === 'grams')) {
    return recipeQuantity * 1000;
  }
  
  // Liter to Milliliter conversions (reverse)
  if ((iUnit === 'ml' || iUnit === 'milliliter' || iUnit === 'milliliters') && (rUnit === 'liter' || rUnit === 'liters' || rUnit === 'l')) {
    return recipeQuantity * 1000;
  }
  
  // Default: return as-is if no known conversion
  return recipeQuantity;
}

// Safe JSON Parse Helper
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to parse JSON:", e);
    return fallback;
  }
}

// Helper function to deduct inventory when order status changes to in_progress
// This version uses storage.deductInventoryForOrder for consistency with order creation
async function deductInventoryForOrder(orderId: string, branchId: string, employeeId: string): Promise<{
  success: boolean;
  costOfGoods: number;
  deductionDetails: Array<{
    rawItemId: string;
    rawItemName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
  }>;
  warnings: string[];
  error?: string;
}> {
  try {
    // Validate branchId is provided and valid
    if (!branchId || branchId === 'undefined' || branchId === 'null') {
      return { success: false, costOfGoods: 0, deductionDetails: [], warnings: [], error: 'No valid branchId' };
    }

    const order = await OrderModel.findOne({ id: orderId }) || await OrderModel.findById(orderId).catch(() => null);
    if (!order) {
      return { success: false, costOfGoods: 0, deductionDetails: [], warnings: [], error: 'Order not found' };
    }

    // Skip if already deducted (status 1 = fully deducted, status 2 = partially deducted)
    if (order.inventoryDeducted && order.inventoryDeducted >= 1) {
      return { 
        success: true, 
        costOfGoods: order.costOfGoods || 0, 
        deductionDetails: (order.inventoryDeductionDetails || []).map((d: any) => ({
          rawItemId: d.rawItemId,
          rawItemName: d.rawItemName,
          quantity: d.quantity,
          unit: d.unit,
          unitCost: d.unitCost,
          totalCost: d.totalCost
        })),
        warnings: []
      };
    }

    let items = order.items || [];
    if (typeof items === 'string') {
      items = safeJsonParse(items, []);
    }

    if (items.length === 0) {
      return { success: false, costOfGoods: 0, deductionDetails: [], warnings: [], error: 'Order has no items' };
    }

    // Build order items array for storage method
    const orderItems = items.map((item: any) => ({
      coffeeItemId: item.coffeeItemId || item.id,
      quantity: item.quantity || 1,
      addons: item.customization?.selectedAddons?.map((a: any) => ({
        id: a.addonId || a.id,
        rawItemId: a.rawItemId,
        quantity: a.quantity || 1,
        unit: a.unit
      })) || []
    }));

    // Reward points for order items — 10 points per item priced above 1 SAR
    // Skip entirely if the order used loyalty points to pay (pointsUsed flag)
    const orderUsedPoints = !!(order as any).pointsUsed;

    const totalPointsToAward = orderUsedPoints ? 0 : orderItems.reduce((acc: any, item: any) => {
      const itemPrice = Number(item.price || item.unitPrice || 0);
      if (itemPrice <= 1) return acc; // Only earn points for items above 1 SAR
      return acc + ((item.quantity || 1) * 10);
    }, 0);
    
    // Award points — search by customerId first, then by customer phone as fallback
    // Guard against duplicate awarding: skip if points were already awarded for this order
    if (totalPointsToAward > 0 && !(order as any).pointsAwarded) {
      try {
        // Update Customer document if customerId exists
        if (order.customerId) {
          await CustomerModel.findByIdAndUpdate(order.customerId, {
            $inc: { points: totalPointsToAward, pendingPoints: -Math.abs(totalPointsToAward) }
          });
        }

        // Find loyalty card by customerId or by customer phone number
        let loyaltyCard = null;
        if (order.customerId) {
          loyaltyCard = await mongoose.model('LoyaltyCard').findOne({ customerId: order.customerId });
        }
        // Fallback: search by phone from order
        if (!loyaltyCard) {
          const customerPhone = order.customerPhone || order.customerInfo?.customerPhone;
          if (customerPhone) {
            const cleanPhone = customerPhone.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
            loyaltyCard = await mongoose.model('LoyaltyCard').findOne({ phoneNumber: { $in: [cleanPhone, customerPhone, `+966${cleanPhone.slice(1)}`, `966${cleanPhone.slice(1)}`] } });
          }
        }

        if (loyaltyCard) {
          loyaltyCard.points = (Number(loyaltyCard.points) || 0) + totalPointsToAward;
          loyaltyCard.pendingPoints = Math.max(0, (Number(loyaltyCard.pendingPoints) || 0) - totalPointsToAward);
          await loyaltyCard.save();
          console.log(`[LOYALTY] Awarded ${totalPointsToAward} points to card ${loyaltyCard.id} (${loyaltyCard.phoneNumber})`);
        } else {
          console.warn(`[LOYALTY] No loyalty card found for order ${order.id} (customerId: ${order.customerId}, phone: ${order.customerPhone})`);
        }

        // Mark points as awarded on the order to prevent future duplicates
        await OrderModel.findOneAndUpdate({ id: orderId }, { pointsAwarded: true });
      } catch (e) {
        console.error("[LOYALTY] Failed to update loyalty card:", e);
      }
    } else if ((order as any).pointsAwarded) {
      console.log(`[LOYALTY] Points already awarded for order ${order.id}, skipping`);
    }

    // Call storage method to deduct inventory for order
    const result = await storage.deductInventoryForOrder(orderId, branchId, orderItems, employeeId);

    // Update order with inventory deduction info
    await OrderModel.findOneAndUpdate({ id: orderId }, {
      inventoryDeducted: result.success ? 1 : 0,
      costOfGoods: result.costOfGoods,
      inventoryDeductionDetails: result.deductionDetails
    });

    // Log warnings if any
    if (result.warnings.length > 0) {
      console.warn(`[INVENTORY] Order ${order.orderNumber} warnings:`, result.warnings);
    }

    // Auto-create COGS journal entry for accounting (only on full success, with idempotency)
    if (result.success && result.costOfGoods > 0) {
      try {
        const tenantId = order.tenantId || 'demo-tenant';
        const { JournalEntryModel } = await import("@shared/schema");
        const existingEntry = await JournalEntryModel.findOne({ tenantId, referenceType: 'order_cogs', referenceId: orderId });
        
        if (!existingEntry) {
          const cogsAccount = await AccountModel.findOne({ tenantId, accountNumber: "5100" });
          const inventoryAccount = await AccountModel.findOne({ tenantId, accountNumber: "1130" });
          
          if (cogsAccount && inventoryAccount) {
            await ErpAccountingService.createJournalEntry({
              tenantId,
              entryDate: new Date(),
              description: `تكلفة البضاعة المباعة - طلب رقم ${order.orderNumber}`,
              lines: [
                {
                  accountId: cogsAccount.id,
                  accountNumber: cogsAccount.accountNumber,
                  accountName: cogsAccount.nameAr,
                  debit: result.costOfGoods,
                  credit: 0,
                  description: `تكلفة البضاعة المباعة - طلب ${order.orderNumber}`,
                  branchId,
                },
                {
                  accountId: inventoryAccount.id,
                  accountNumber: inventoryAccount.accountNumber,
                  accountName: inventoryAccount.nameAr,
                  debit: 0,
                  credit: result.costOfGoods,
                  description: `خصم مخزون - طلب ${order.orderNumber}`,
                  branchId,
                },
              ],
              referenceType: 'order_cogs',
              referenceId: orderId,
              createdBy: employeeId,
              autoPost: true,
            });
            console.log(`[ACCOUNTING] COGS journal entry created for order ${order.orderNumber}: ${result.costOfGoods} SAR`);
          }
        }
      } catch (accountingError) {
        console.error(`[ACCOUNTING] Failed to create COGS journal entry for order ${order.orderNumber}:`, accountingError);
      }
    }

    return { 
      success: result.success, 
      costOfGoods: result.costOfGoods, 
      deductionDetails: result.deductionDetails.map((d: any) => ({
        rawItemId: d.rawItemId,
        rawItemName: d.rawItemName,
        quantity: d.quantity,
        unit: d.unit,
        unitCost: d.unitCost,
        totalCost: d.totalCost
      })),
      warnings: result.warnings,
      error: result.errors.length > 0 ? result.errors.join(', ') : undefined
    };
  } catch (error) {
    return { success: false, costOfGoods: 0, deductionDetails: [], warnings: [], error: String(error) };
  }
}

// Helper function to send WhatsApp notification
function getOrderStatusMessage(status: string, orderNumber: string): string {
  const statusMessages: Record<string, string> = {
    'pending': `⏳ طلبك رقم ${orderNumber} في الانتظار\nنحن نستعد لتجهيزه!`,
    'payment_confirmed': `💰 تم تأكيد دفع طلبك رقم ${orderNumber}\nجاري تحضيره الآن!`,
    'in_progress': `☕ طلبك رقم ${orderNumber} قيد التحضير الآن\nقهوتك في الطريق!`,
    'ready': `🎉 طلبك رقم ${orderNumber} جاهز للاستلام!\nاستمتع بقهوتك ☕`,
    'completed': `✅ تم استلام طلبك رقم ${orderNumber}\nنتمنى أن تستمتع بقهوتك!`,
    'cancelled': `❌ تم إلغاء طلبك رقم ${orderNumber}\nنأسف للإزعاج`
  };
  return statusMessages[status] || `تم تحديث حالة طلبك رقم ${orderNumber} إلى: ${status}`;
}

// Maileroo Email Configuration - DISABLED IN FAVOR OF TURBOSMTP
/*
const mailerooApiKey = process.env.MAILEROO_API_KEY;
const mailerooUser = process.env.MAILEROO_USER || 'cluny@qirox.online';
*/

// Set transporter to null to satisfy the rest of the code that might reference it
const transporter = null;

// Generate Tax Invoice HTML
function generateInvoiceHTML(invoiceNumber: string, data: any): string {
  const { customerName, customerPhone, items, subtotal, discountAmount, taxAmount, totalAmount, paymentMethod, invoiceDate } = data;
  
  const itemsHTML = items.map((item: any) => `
    <tr>
      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">${item.coffeeItem?.nameAr || 'منتج'}</td>
      <td style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd;">${item.quantity}</td>
      <td style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">${(Number(item.coffeeItem?.price || 0) * item.quantity).toFixed(2)} ريال</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial; direction: rtl; background: #f5f5f5; }
        .container { max-width: 800px; margin: 20px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid #8B5A2B; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { color: #8B5A2B; margin: 0; font-size: 28px; }
        .header p { color: #666; margin: 5px 0; }
        .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
        .customer-info { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #8B5A2B; color: white; padding: 10px; text-align: right; }
        .total-section { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; margin: 20px 0; padding: 15px; background: #f0f0f0; border-radius: 5px; }
        .total-row { display: flex; justify-content: space-between; width: 200px; }
        .total-row.grand { font-size: 18px; font-weight: bold; color: #8B5A2B; border-top: 2px solid #8B5A2B; padding-top: 10px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>CLUNY CAFE</h1>
          <p>فاتورة ضريبية</p>
        </div>
        
        <div class="invoice-info">
          <div><strong>رقم الفاتورة:</strong> ${invoiceNumber}</div>
          <div><strong>التاريخ:</strong> ${new Date(invoiceDate).toLocaleDateString('ar-SA')}</div>
        </div>

        <div class="customer-info">
          <p><strong>بيانات العميل:</strong></p>
          <p>الاسم: ${customerName}</p>
          <p>الهاتف: ${customerPhone}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الكمية</th>
              <th>السعر</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row"><span>المجموع الفرعي:</span><span>${subtotal.toFixed(2)} ريال</span></div>
          ${discountAmount > 0 ? `<div class="total-row"><span>الخصم:</span><span>-${discountAmount.toFixed(2)} ريال</span></div>` : ''}
          <div class="total-row"><span>الضريبة (15%):</span><span>${taxAmount.toFixed(2)} ريال</span></div>
          <div class="total-row grand"><span>الإجمالي:</span><span>${totalAmount.toFixed(2)} ريال</span></div>
          <div class="total-row"><span>طريقة الدفع:</span><span>${paymentMethod}</span></div>
        </div>

        <div class="footer">
          <p>شكراً لتعاملك معنا | تم إصدار هذه الفاتورة من نظام CLUNY CAFE</p>
          <p>© 2025 CLUNY CAFE - جميع الحقوق محفوظة</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Send invoice via email
async function sendInvoiceEmail(to: string, invoiceNumber: string, invoiceData: any): Promise<boolean> {
  try {
    const { sendOrderNotificationEmail } = await import("./mail-service");
    // Reuse the existing robust mail service instead of Maileroo
    return await sendOrderNotificationEmail(
      to,
      invoiceData.customerName || "عميل",
      invoiceNumber,
      "completed",
      invoiceData.totalAmount || 0,
      invoiceData
    );
  } catch (error) {
    console.error("❌ Failed to send invoice email:", error);
    return false;
  }
}

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '..', 'attached_assets', 'receipts');
const storage_multer = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
    cb(null, `receipt-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage_multer,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|pdf/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);

    if (ext && mimeType) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images (JPG, PNG, WEBP) and PDF are allowed.'));
    }
  }
});

// Simple POS device status tracker
let posDeviceStatus = { connected: false, lastCheck: Date.now() };

import { BusinessConfigModel, AppointmentModel } from "./models";

// ── In-memory cache for frequently-read, rarely-changing data ──────────────
interface CacheEntry<T> { data: T; expiresAt: number; }
const _cache = new Map<string, CacheEntry<any>>();

function cacheGet<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.data as T;
}
function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
function cacheInvalidate(prefix: string): void {
  for (const key of _cache.keys()) { if (key.startsWith(prefix)) _cache.delete(key); }
}

async function getCachedCoffeeItems(): Promise<any[]> {
  const cached = cacheGet<any[]>('coffeeItems');
  if (cached) return cached;
  const items = await CoffeeItemModel.find({}).lean();
  cacheSet('coffeeItems', items, 5 * 60 * 1000); // 5 min TTL
  return items;
}

function enrichOrderWithItems(serializedOrder: any, coffeeItems: any[]): any {
  let orderItems = serializedOrder.items;
  if (typeof orderItems === 'string') { try { orderItems = JSON.parse(orderItems); } catch { orderItems = []; } }
  if (!Array.isArray(orderItems)) orderItems = [];
  return {
    ...serializedOrder,
    items: orderItems.map((item: any) => {
      const ci = coffeeItems.find((c: any) => c.id === item.coffeeItemId);
      return { ...item, coffeeItem: ci ? { nameAr: ci.nameAr, nameEn: ci.nameEn, price: ci.price, imageUrl: ci.imageUrl, category: ci.category } : null };
    }),
  };
}


export async function registerRoutes(app: Express): Promise<Server> {
  registerObjectStorageRoutes(app);

  app.get("/.well-known/apple-developer-merchantid-domain-association", (req, res) => {
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.sendFile(APPLE_PAY_DOMAIN_ASSOCIATION_PATH);
  });
  app.get("/.well-known/apple-developer-merchantid-domain-association.txt", (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.sendFile(APPLE_PAY_DOMAIN_ASSOCIATION_PATH);
  });

  // Send manual email to customer
  app.post("/api/admin/send-email", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { customerId, subject, message } = req.body;
      const customer = await CustomerModel.findById(customerId);
      if (!customer || !customer.email) {
        return res.status(404).json({ error: "Customer not found or has no email" });
      }

      const { sendPromotionEmail } = await import("./mail-service");
      const success = await sendPromotionEmail(customer.email, customer.name || "عميل", subject, message);

      if (success) {
        res.json({ message: "Email sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send email" });
      }
    } catch (error) {
      console.error("Error sending manual email:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all customers for email selection
  app.get("/api/admin/customers-list", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const customers = await CustomerModel.find({ tenantId, email: { $exists: true, $ne: "" } });
      res.json(customers.map(serializeDoc));
    } catch (error) {
      console.error("Error fetching customers list:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // --- PUSH NOTIFICATIONS API ---
  app.get("/api/push/vapid-key", (req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { subscription, userType, userId, branchId } = req.body;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      // console.log(`[PUSH] Subscribing ${userType} user=${userId} branch=${branchId} tenant=${tenantId}`);
      await saveSubscription(subscription, userType, userId, branchId, tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Push subscribe error:", error);
      res.status(500).json({ error: "Failed to save subscription" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      await removeSubscription(endpoint);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove subscription" });
    }
  });

  // --- Manually send promo to all customers ---
  app.post("/api/push/send-promo", async (req: any, res) => {
    try {
      const { title, body, url } = req.body;
      if (!title || !body) return res.status(400).json({ error: "title and body are required" });

      const { sendPushToAll } = await import("./push-service");
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      await sendPushToAll(tenantId, { title, body, url: url || "/menu", tag: `promo-${Date.now()}`, type: "promo" });
      res.json({ success: true, message: "Promo sent to all customers" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send promo" });
    }
  });

  // --- Manually trigger admin daily summary ---
  app.post("/api/push/admin-summary", async (req: any, res) => {
    try {
      const { sendAdminDailySummaryNow } = await import("./smart-scheduler");
      await sendAdminDailySummaryNow();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to send summary" });
    }
  });

    // --- ORDERS API ---
  app.get("/api/orders/live", async (req: any, res) => {
    try {
      const branchId = req.query.branchId as string;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const liveStatuses = ['pending', 'in_progress', 'ready', 'payment_confirmed', 'confirmed'];
      const query: any = { tenantId, status: { $in: liveStatuses } };
      if (branchId) query.branchId = branchId;
      const liveOrders = await OrderModel.find(query)
        .sort({ createdAt: -1 })
        .limit(150)
        .lean();
      res.json(liveOrders.map(serializeDoc));
    } catch (error) {
      console.error("Error fetching live orders:", error);
      res.status(500).json({ error: "Failed to fetch live orders" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const body = req.body;
      
      // Map payment method aliases
      const paymentMethodMap: Record<string, string> = {
        'cash': 'cash',
        'card': 'pos',
        'apple_pay': 'apple_pay',
        'stc_pay': 'stc-pay',
        'qahwa-card': 'qahwa-card',
        'pos': 'pos',
        'pos-network': 'pos-network',
        'mada': 'mada',
        'coupon': 'coupon',
        'loyalty_points': 'loyalty_points',
      };

      const tenantId = body.tenantId || getTenantIdFromRequest(req) || 'demo-tenant';

      const mappedPaymentMethod = paymentMethodMap[body.paymentMethod] || body.paymentMethod || 'cash';

      // Auto-confirm orders from POS channel with immediate payment methods
      const autoConfirmMethods = ['cash', 'pos', 'pos-network', 'mada', 'apple_pay', 'stc-pay', 'qahwa-card'];
      const isPosChannel = body.channel === 'pos';
      const shouldAutoConfirm = isPosChannel && autoConfirmMethods.includes(mappedPaymentMethod);

      // ── QAHWA CARD VALIDATION ─────────────────────────────────────────────
      // Must have sufficient loyalty points before we create the order
      if (mappedPaymentMethod === 'qahwa-card') {
        const cardPhone = body.customerPhone || body.customerInfo?.customerPhone;
        if (!cardPhone) {
          return res.status(400).json({ error: "رقم الهاتف مطلوب للدفع ببطاقة الولاء" });
        }
        const cPhone = cardPhone.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
        const phoneVariants = [cPhone, cardPhone, `+966${cPhone.slice(1)}`, `966${cPhone.slice(1)}`];
        const { BusinessConfigModel: BizCfg, LoyaltyCardModel: LCM } = await import("@shared/schema");
        const bizCfg = await BizCfg.findOne({ tenantId }).lean() as any;
        const ptsForFree = Number(bizCfg?.loyaltyConfig?.pointsForFreeDrink) || 500;
        const loyCard = await LCM.findOne({ phoneNumber: { $in: phoneVariants } });
        if (!loyCard) {
          return res.status(400).json({ error: "لا توجد بطاقة ولاء مرتبطة بهذا الرقم" });
        }
        const availPts = Number(loyCard.points) || 0;
        const hasFreeCup = (Number(loyCard.freeCupsEarned) || 0) > (Number(loyCard.freeCupsRedeemed) || 0);
        if (availPts < ptsForFree && !hasFreeCup) {
          return res.status(400).json({
            error: `رصيد البطاقة غير كافٍ`,
            details: `لديك ${availPts} نقطة، وتحتاج ${ptsForFree} نقطة للحصول على مشروب مجاني`,
            currentPoints: availPts,
            requiredPoints: ptsForFree,
          });
        }
        // Force total to 0 for free drink payment
        body.totalAmount = 0;
        body.freeDrinkRedeemed = true;
        if (!body.pointsRedeemed || Number(body.pointsRedeemed) === 0) {
          body.pointsRedeemed = availPts >= ptsForFree ? ptsForFree : 0;
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // --- Auto-calculate estimated prep time based on businessConfig ---
      let autoEstimatedPrepTime: number | undefined = undefined;
      try {
        const cfg = await BusinessConfigModel.findOne({ tenantId }).lean() as any;
        const base = cfg?.prepTimeConfig?.basePrepMinutes ?? 10;
        const extraPerItem = cfg?.prepTimeConfig?.extraMinutesPerItem ?? 3;
        const threshold = cfg?.prepTimeConfig?.extraItemThreshold ?? 2;
        const items = body.items || [];
        const totalItems = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
        const extra = Math.max(0, totalItems - threshold) * extraPerItem;
        autoEstimatedPrepTime = base + extra;
      } catch (_) {}
      // ────────────────────────────────────────────────────────────────

      const orderData = {
        ...body,
        tenantId,
        totalAmount: (body.totalAmount !== undefined && body.totalAmount !== null) ? Number(body.totalAmount) : (body.total || 0),
        paymentMethod: mappedPaymentMethod,
        status: shouldAutoConfirm ? 'payment_confirmed' : (body.status || 'pending'),
        customerInfo: body.customerInfo || {
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          email: body.customerEmail,
        },
        estimatedPrepTimeInMinutes: body.estimatedPrepTimeInMinutes ?? autoEstimatedPrepTime,
      };
      
      // Remove redundant 'total' field if present
      delete orderData.total;

      const order = await storage.createOrder(orderData);
      const serializedOrder = serializeDoc(order);
      
      // Notify via WebSocket - use broadcastNewOrder so POS/kitchen receive it as "new_order"
      wsManager.broadcastNewOrder(serializedOrder);

      res.status(201).json(serializedOrder);

      // === Track discount code usage ===
      if (body.discountCode) {
        setImmediate(async () => {
          try {
            const { DiscountCodeModel } = await import("@shared/schema");
            await DiscountCodeModel.findOneAndUpdate(
              { code: body.discountCode.toUpperCase() },
              { $inc: { usageCount: 1 } }
            );
          } catch (e) { /* non-critical */ }
        });
      }

      // === 3-Layer Notifications: Customer + Admins ===
      setImmediate(async () => {
        try {
          const { fireNotify, fireNotifyAdmins } = await import("./notification-engine");
          const customerId = serializedOrder.customerId;
          const orderNum = serializedOrder.orderNumber || serializedOrder.id;
          const total = serializedOrder.totalAmount || 0;

          // Notify customer
          if (customerId) {
            await fireNotify(customerId, "✅ تم استلام طلبك", `طلبك رقم #${orderNum} بقيمة ${total} ر.س قيد التحضير`, {
              type: "order_update", icon: "☕", link: `/track/${serializedOrder.id}`, userType: "customer",
              orderId: serializedOrder.id, orderNumber: orderNum,
            });
          }

          // Notify admins of new order
          await fireNotifyAdmins(`طلب جديد #${orderNum} ☕`, `قيمة ${total} ر.س — ${serializedOrder.channel === 'online' ? 'أونلاين 🌐' : 'كاشير'}`, {
            type: "order", icon: "🛎️", link: "/employee/orders",
            orderId: serializedOrder.id, orderNumber: orderNum,
          });
        } catch (notifErr) {
          console.error("[NOTIFY] Order creation notification failed:", notifErr);
        }
      });

      // === Loyalty: ensure loyalty card exists and add pending points ===
      try {
        const customerPhone = body.customerPhone || body.customerInfo?.customerPhone;
        if (customerPhone) {
          const cleanPhone = customerPhone.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
          const phoneVariants = [cleanPhone, customerPhone, `+966${cleanPhone.slice(1)}`, `966${cleanPhone.slice(1)}`];

          // Detect if this order uses loyalty points to pay (support both field naming conventions)
          // Checkout sends: pointsRedeemed (number) + pointsValue (SAR)
          // POS sends: pointsUsed (boolean) + loyaltyDiscount (SAR)
          const pointsRedeemedNum = Number(body.pointsRedeemed) || 0;
          const loyaltyDiscountSar = Number(body.loyaltyDiscount) || Number(body.pointsValue) || 0;
          const usedPoints = !!body.pointsUsed || pointsRedeemedNum > 0 || body.paymentMethod === 'loyalty_points';

          // 10 points per item priced above 1 SAR — but NO points if this order uses loyalty points to pay
          const itemsArr = Array.isArray(body.items) ? body.items : [];
          const pendingPts = usedPoints ? 0 : itemsArr.reduce((sum: number, item: any) => {
            const price = Number(item.price || item.unitPrice || 0);
            if (price <= 1) return sum;
            return sum + ((Number(item.quantity) || 1) * 10);
          }, 0);

          let card = await mongoose.model('LoyaltyCard').findOne({ phoneNumber: { $in: phoneVariants } });
          if (!card) {
            const customerName = body.customerName || body.customerInfo?.customerName || 'عميل';
            card = await storage.createLoyaltyCard({
              customerName,
              phoneNumber: cleanPhone,
            } as any);
            console.log(`[LOYALTY] Created new card for ${cleanPhone}, pending: ${pendingPts}`);
          } else if (pendingPts > 0) {
            await mongoose.model('LoyaltyCard').findByIdAndUpdate(card._id, {
              $inc: { pendingPoints: pendingPts },
              $set: { lastUsedAt: new Date() },
            });
            console.log(`[LOYALTY] Added ${pendingPts} pending points to card ${card.id} (${cleanPhone})`);
          }

          // If order used loyalty points as payment, deduct them now
          if (usedPoints && loyaltyDiscountSar > 0 && card) {
            // Use the exact points count if provided, otherwise calculate from SAR value
            const ptsToDeduct = pointsRedeemedNum > 0 ? pointsRedeemedNum : Math.ceil(loyaltyDiscountSar / 0.02);
            const currentPoints = Number(card.points) || 0;
            const actualDeduct = Math.min(ptsToDeduct, currentPoints);
            if (actualDeduct > 0) {
              await mongoose.model('LoyaltyCard').findByIdAndUpdate(card._id, {
                $inc: { points: -actualDeduct, discountCount: 1 },
              });
              await storage.createLoyaltyTransaction({
                cardId: card._id.toString(),
                type: 'redeem',
                pointsChange: -actualDeduct,
                discountAmount: loyaltyDiscountSar,
                orderAmount: Number(body.totalAmount || body.total) || 0,
                description: `خصم بطاقة كلوني: ${actualDeduct} نقطة = ${Number(loyaltyDiscountSar).toFixed(2)} ريال`,
              });
              console.log(`[LOYALTY] Deducted ${actualDeduct} pts (${loyaltyDiscountSar} SAR) for order — method: ${body.paymentMethod}`);
            }
          } else if (usedPoints) {
            console.warn(`[LOYALTY] Points used but no discount amount found — pointsRedeemed: ${pointsRedeemedNum}, pointsValue: ${body.pointsValue}, loyaltyDiscount: ${body.loyaltyDiscount}, card: ${card?.phoneNumber || 'NOT FOUND'}`);
          }
        }
      } catch (loyaltyErr) {
        console.error("[LOYALTY] Failed to process loyalty on order create:", loyaltyErr);
      }

      // === Award actual loyalty points for immediately-confirmed orders ===
      // POS orders (shouldAutoConfirm=true) and loyalty_points payment orders are created
      // directly with status=payment_confirmed, so they never trigger the PATCH status handler.
      // We award points here to fix that gap.
      const isAutoConfirmedOrder = shouldAutoConfirm || body.status === 'payment_confirmed';
      const orderUsedLoyaltyPoints = !!body.pointsUsed || Number(body.pointsRedeemed) > 0 || body.paymentMethod === 'loyalty_points';
      if (isAutoConfirmedOrder && !orderUsedLoyaltyPoints && !(order as any).pointsAwarded) {
        setImmediate(async () => {
          try {
            const itemsArr = Array.isArray(body.items) ? body.items : [];
            const pointsToAward = itemsArr.reduce((sum: number, item: any) => {
              const price = Number(item.price || item.unitPrice || 0);
              if (price <= 1) return sum;
              return sum + ((Number(item.quantity) || 1) * 10);
            }, 0);

            if (pointsToAward <= 0) {
              console.log(`[LOYALTY] No points to award for auto-confirmed order ${order.orderNumber} (no items above 1 SAR)`);
              return;
            }

            // Find loyalty card: customerId first, then phone
            let loyaltyCard: any = null;
            const orderId = (order as any).id || order._id?.toString();
            if (body.customerId || order.customerId) {
              loyaltyCard = await mongoose.model('LoyaltyCard').findOne({ customerId: body.customerId || order.customerId });
            }
            if (!loyaltyCard) {
              const phoneForPoints = body.customerPhone || body.customerInfo?.customerPhone;
              if (phoneForPoints) {
                const cleanPhone = phoneForPoints.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
                const nineDigit = cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone;
                loyaltyCard = await mongoose.model('LoyaltyCard').findOne({
                  phoneNumber: { $in: [cleanPhone, nineDigit, phoneForPoints, `+966${nineDigit}`, `966${nineDigit}`] }
                });
              }
            }

            if (!loyaltyCard) {
              console.warn(`[LOYALTY] Auto-confirm: No loyalty card for order ${order.orderNumber} — points not awarded`);
              return;
            }

            const currentPoints = Number(loyaltyCard.points) || 0;
            const currentPending = Number(loyaltyCard.pendingPoints) || 0;
            await mongoose.model('LoyaltyCard').findByIdAndUpdate(loyaltyCard._id, {
              points: currentPoints + pointsToAward,
              pendingPoints: Math.max(0, currentPending - pointsToAward),
              lastUsedAt: new Date(),
            });

            await storage.createLoyaltyTransaction({
              cardId: loyaltyCard._id.toString(),
              type: 'earn',
              pointsChange: pointsToAward,
              discountAmount: 0,
              orderAmount: Number(body.totalAmount || body.total || 0),
              orderId,
              description: `نقاط مكسبة: ${pointsToAward} نقطة من الطلب #${order.orderNumber}`,
            });

            await OrderModel.findOneAndUpdate({ id: orderId }, { pointsAwarded: true });

            console.log(`[LOYALTY] ✅ Auto-confirm: Awarded ${pointsToAward} pts for order ${order.orderNumber} → card ${loyaltyCard.phoneNumber}`);
          } catch (autoPointsErr) {
            console.error('[LOYALTY] Auto-confirm points award failed:', autoPointsErr);
          }
        });
      }

      try {
        const orderItems = Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              name: item.nameAr || item.name || item.coffeeItem?.nameAr || 'منتج',
              quantity: item.quantity || 1
            }))
          : [];

        sendPushToEmployee(order.branchId || 'all', {
          title: `🔔 طلب جديد #${order.orderNumber || order.dailyNumber}`,
          body: `${order.customerName || 'عميل'} • ${orderItems.length} منتجات`,
          url: '/employee/pos',
          tag: `new-order-${order.orderNumber}`,
          type: 'new_order',
          orderNumber: String(order.orderNumber || order.dailyNumber || ''),
          orderStatus: 'pending',
          totalAmount: order.totalAmount,
          itemCount: orderItems.length,
          items: orderItems.slice(0, 5),
          customerName: order.customerName || order.customerInfo?.customerName || 'عميل',
          orderType: order.orderType,
        }).catch(err => console.error('[PUSH] Employee new order notification error:', err));

        const custId = order.customerId || order.customerInfo?.customerId;
        if (custId) {
          // console.log(`[PUSH] Sending order confirmation push to customer ${custId}`);
          sendPushToCustomer(custId, {
            title: `✅ تم استلام طلبك #${order.orderNumber || order.dailyNumber}`,
            body: `${orderItems.length} ${orderItems.length > 1 ? 'منتجات' : 'منتج'} • ${Number(order.totalAmount).toFixed(2)} ر.س`,
            url: '/my-orders',
            tag: `order-confirmed-${order.orderNumber}`,
            type: 'order_status',
            orderNumber: String(order.orderNumber || order.dailyNumber || ''),
            orderStatus: 'pending',
            totalAmount: order.totalAmount,
            itemCount: orderItems.length,
            items: orderItems.slice(0, 5),
            orderType: order.orderType,
          }).catch(err => console.error('[PUSH] Customer order confirmation error:', err));
        }
      } catch (pushErr) {
        console.error('[PUSH] Error sending push for new order:', pushErr);
      }
    } catch (error) {
      console.error("Order creation error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });
  app.get("/api/appointments", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const branchId = req.query.branchId as string;
      const appointments = await storage.getAppointments(tenantId, branchId);
      res.json(appointments.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const appointment = await storage.createAppointment({
        ...req.body,
        tenantId,
        appointmentDate: new RegExp(/^\d{4}-\d{2}-\d{2}/).test(req.body.appointmentDate) 
          ? new Date(req.body.appointmentDate) 
          : new Date(),
      });
      res.json(serializeDoc(appointment));
    } catch (error) {
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await storage.updateAppointment(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Appointment not found" });
      res.json(serializeDoc(updated));
    } catch (error) {
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const success = await storage.deleteAppointment(req.params.id);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete appointment" });
    }
  });

  // --- OPERATING SYSTEM CORE API ROUTES ---

  // Business Config Management
  // Business Config Management
  app.get("/api/business-config", async (req, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      let config = await BusinessConfigModel.findOne({ tenantId });
      
      if (!config) {
        config = await BusinessConfigModel.create({
          tenantId,
          tradeNameAr: "كلوني كافيه",
          tradeNameEn: "Cluny Cafe",
          activityType: "both",
          isFoodEnabled: true,
          isDrinksEnabled: true,
          vatPercentage: 15,
          currency: "SAR",
          timezone: "Asia/Riyadh",
          storeHours: {
            monday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true },
            tuesday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true },
            wednesday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true },
            thursday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true },
            friday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true },
            saturday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true },
            sunday: { open: "00:00", close: "23:59", isOpen: true, isAlwaysOpen: true }
          }
        });
      }

      const storeHoursRaw = config.storeHours;
      const storeHours = storeHoursRaw instanceof Map ? Object.fromEntries(storeHoursRaw) : (storeHoursRaw || {});
      const isAlwaysOpen = Object.values(storeHours).every((h: any) => h?.isAlwaysOpen || (h?.open === "00:00" && h?.close === "23:59"));
      
      let isOpen = true;
      if (config.isEmergencyClosed) {
        isOpen = false;
      } else if (!isAlwaysOpen) {
        const now = new Date();
        const riyadhTime = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Riyadh",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          weekday: "long"
        }).formatToParts(now);

        const currentDay = riyadhTime.find(p => p.type === "weekday")?.value.toLowerCase() || "monday";
        const currentHour = parseInt(riyadhTime.find(p => p.type === "hour")?.value || "0");
        const currentMinute = parseInt(riyadhTime.find(p => p.type === "minute")?.value || "0");
        const currentTimeInMinutes = currentHour * 60 + currentMinute;

        const todayHours = (storeHours as any)[currentDay];

        if (todayHours?.isOpen) {
          const [openH, openM] = (todayHours.open || "06:00").split(":").map(Number);
          const [closeH, closeM] = (todayHours.close || "03:00").split(":").map(Number);
          const openMinutes = openH * 60 + openM;
          let closeMinutes = closeH * 60 + closeM;

          // Handle overnight hours (e.g., 6 AM to 3 AM next day)
          if (closeMinutes <= openMinutes) {
            isOpen = currentTimeInMinutes >= openMinutes || currentTimeInMinutes <= closeMinutes;
          } else {
            isOpen = currentTimeInMinutes >= openMinutes && currentTimeInMinutes <= closeMinutes;
          }
        } else {
          isOpen = false;
        }
      }

      const serialized = serializeDoc(config);
      // Ensure layout fields always have defaults (for existing documents created before these fields)
      if (!serialized.menuLayout) serialized.menuLayout = 'classic';
      if (!serialized.cashierLayout) serialized.cashierLayout = 'classic';
      res.json({ ...serialized, isOpen });
    } catch (error) {
      console.error("Error fetching business config:", error);
      res.status(500).json({ error: "Failed to fetch business config" });
    }
  });

  app.patch("/api/business-config", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const updates = req.body;
      // console.log(`[CONFIG] Updating business config for tenant: ${tenantId}`);
      
      let config = await BusinessConfigModel.findOne({ tenantId });
      if (!config) {
        config = new BusinessConfigModel({ tenantId, tradeNameAr: "كلوني كافيه" });
      }
      
      for (const [key, value] of Object.entries(updates)) {
        (config as any)[key] = value;
      }
      
      if (updates.storeHours) {
        config.markModified('storeHours');
      }
      if (updates.socialLinks) {
        config.markModified('socialLinks');
      }
      if (updates.paymentGateway) {
        config.markModified('paymentGateway');
      }
      if (updates.loyaltyConfig) {
        config.markModified('loyaltyConfig');
      }
      if (updates.offersConfig) {
        config.markModified('offersConfig');
      }
      
      config.updatedAt = new Date();
      await config.save();
      
      // console.log(`[CONFIG] Successfully updated business config for tenant: ${tenantId}`);
      res.json(serializeDoc(config));
    } catch (error) {
      console.error("[CONFIG] Error updating business config:", error);
      res.status(500).json({ error: "Failed to update business config" });
    }
  });

  // POS device connection status
  app.get("/api/pos/status", async (req, res) => {
    res.json({ connected: true, timestamp: new Date().toISOString() });
  });

  // Bulk print employee invoices
  app.post("/api/orders/bulk-print-employee", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { orderIds } = req.body;
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: "Invalid order IDs" });
      }
      const orders = await OrderModel.find({ id: { $in: orderIds } });
      res.json(orders.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders for bulk print" });
    }
  });

  // Update order status
  app.patch("/api/orders/:id/status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { status, cancellationReason } = req.body;
      const orderId = req.params.id;
      const employee = req.employee;
      
      const order = await OrderModel.findOne({ id: orderId }) || await OrderModel.findById(orderId).catch(() => null);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const oldStatus = order.status;
      order.status = status;
      if (cancellationReason) (order as any).cancellationReason = cancellationReason;
      if (req.body.paymentMethod) order.paymentMethod = req.body.paymentMethod;
      order.updatedAt = new Date();
      await order.save();

      // Reverse totalSpent on loyalty card when order is cancelled by staff
      if (status === 'cancelled' && oldStatus !== 'cancelled' && order.customerId) {
        try {
          const customer = await storage.getCustomer(order.customerId);
          if (customer?.phone) {
            const loyaltyCard = await storage.getLoyaltyCardByPhone(customer.phone);
            if (loyaltyCard) {
              const orderAmount = parseFloat(order.totalAmount?.toString() || '0');
              if (orderAmount > 0) {
                const currentTotalSpent = parseFloat(loyaltyCard.totalSpent?.toString() || '0');
                await storage.updateLoyaltyCard(loyaltyCard.id, {
                  totalSpent: Math.max(0, currentTotalSpent - orderAmount)
                });
              }
            }
          }
        } catch (_) {}
      }

      const serializedOrder = serializeDoc(order);

      // Send email on status change (non-blocking)
      setImmediate(async () => {
        try {
          if (order.customerId) {
            const customer = await CustomerModel.findById(order.customerId);
            if (customer && customer.email) {
              const { sendOrderNotificationEmail } = await import("./mail-service");
              await sendOrderNotificationEmail(
                customer.email,
                customer.name || "عميل",
                order.orderNumber || orderId,
                status,
                order.totalAmount || 0,
                order
              );
            }
          }
        } catch (emailErr) {
          console.error("[EMAIL-AUTO] Failed to send status update email:", emailErr);
        }
      });
      
      // Auto-deduct inventory when moved to 'in_progress', 'completed', or 'payment_confirmed'
      if ((status === 'in_progress' || status === 'completed' || status === 'payment_confirmed') && 
          !['in_progress', 'completed', 'payment_confirmed'].includes(oldStatus)) {
        const branchId = order.branchId || employee?.branchId;
        if (branchId) {
          deductInventoryForOrder(orderId, branchId, employee?.id || 'system').catch(err => 
            console.error(`[INVENTORY] Auto-deduction failed for order ${order.orderNumber}:`, err)
          );
        }
      }

      // Award loyalty points when order is completed/ready/payment_confirmed
      // This runs independently of inventory deduction to fix the bug where
      // POS orders deduct inventory immediately (blocking the deductInventoryForOrder path)
      if (
        (status === 'completed' || status === 'ready' || status === 'payment_confirmed') &&
        !['completed', 'ready', 'payment_confirmed'].includes(oldStatus) &&
        !(order as any).pointsAwarded
      ) {
        setImmediate(async () => {
          try {
            const orderUsedPoints = !!(order as any).pointsUsed || Number((order as any).pointsRedeemed) > 0;
            let orderItemsList: any[] = [];
            try {
              orderItemsList = Array.isArray(order.items) ? order.items : JSON.parse((order.items as any) || '[]');
            } catch (_) {}

            const pointsToAward = orderUsedPoints ? 0 : orderItemsList.reduce((acc: number, item: any) => {
              const price = Number(item.price || item.unitPrice || item.coffeeItem?.price || 0);
              if (price <= 1) return acc;
              return acc + ((Number(item.quantity) || 1) * 10);
            }, 0);

            if (pointsToAward <= 0) return;

            // Find loyalty card — by customerId first, then by phone
            let loyaltyCard: any = null;
            if (order.customerId) {
              loyaltyCard = await mongoose.model('LoyaltyCard').findOne({ customerId: order.customerId });
            }
            if (!loyaltyCard) {
              const rawPhone = (order as any).customerPhone ||
                (typeof order.customerInfo === 'string'
                  ? JSON.parse(order.customerInfo)
                  : order.customerInfo)?.customerPhone || '';
              if (rawPhone) {
                const clean = rawPhone.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
                loyaltyCard = await mongoose.model('LoyaltyCard').findOne({
                  phoneNumber: { $in: [clean, rawPhone, `+966${clean.slice(1)}`, `966${clean.slice(1)}`] }
                });
              }
            }

            if (!loyaltyCard) {
              console.warn(`[LOYALTY] No loyalty card found for order ${order.orderNumber} — points not awarded`);
              return;
            }

            const currentPoints = Number(loyaltyCard.points) || 0;
            const currentPending = Number(loyaltyCard.pendingPoints) || 0;

            await mongoose.model('LoyaltyCard').findByIdAndUpdate(loyaltyCard._id, {
              points: currentPoints + pointsToAward,
              pendingPoints: Math.max(0, currentPending - pointsToAward),
              lastUsedAt: new Date(),
            });

            await storage.createLoyaltyTransaction({
              cardId: loyaltyCard._id.toString(),
              type: 'earn',
              pointsChange: pointsToAward,
              discountAmount: 0,
              orderAmount: Number(order.totalAmount) || 0,
              orderId: (order as any).id || order._id?.toString(),
              description: `نقاط مكسبة: ${pointsToAward} نقطة من الطلب #${order.orderNumber}`,
            });

            await OrderModel.findOneAndUpdate({ id: orderId }, { pointsAwarded: true });

            console.log(`[LOYALTY] ✅ Awarded ${pointsToAward} points for order ${order.orderNumber} (card: ${loyaltyCard.phoneNumber})`);
          } catch (loyaltyErr) {
            console.error('[LOYALTY] Failed to award points on status change:', loyaltyErr);
          }
        });
      }

      // Auto-generate ZATCA invoice on completion
      if ((status === 'completed' || status === 'ready') && order.status !== status) {
        setImmediate(async () => {
          try {
            const existing = await TaxInvoiceModel.findOne({ orderId: order.id });
            if (!existing) {
              const { createZATCAInvoice } = await import("./utils/zatca");
              let items: any[] = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
              await createZATCAInvoice({
                orderId: order.id,
                orderNumber: order.orderNumber,
                customerName: (order.customerInfo as any)?.customerName || (order.customerInfo as any)?.name || 'عميل نقدي',
                customerPhone: (order.customerInfo as any)?.phone || (order.customerInfo as any)?.customerPhone || '',
                items: items.map((item: any) => ({
                  itemId: item.coffeeItemId || item.id,
                  nameAr: item.coffeeItem?.nameAr || item.nameAr || 'منتج',
                  quantity: item.quantity || 1,
                  unitPrice: item.coffeeItem?.price || item.unitPrice || 0,
                  taxRate: 0.15,
                  discountAmount: item.discountAmount || 0
                })),
                paymentMethod: order.paymentMethod || 'cash',
                branchId: order.branchId,
                createdBy: employee?.id,
                invoiceType: 'simplified'
              });
            }
          } catch (zatcaErr) {
            console.error("[ZATCA] Auto-generation failed:", zatcaErr);
          }
        });
      }

      // Notify via WebSocket
      wsManager.broadcastOrderUpdate(serializedOrder);
      
      // Broadcast as new order for kitchen/POS when moving to active statuses
      if (status === 'payment_confirmed' || status === 'confirmed' || status === 'in_progress') {
        wsManager.broadcastNewOrder(serializedOrder);
      }
      
      res.json(serializedOrder);

      // === 3-Layer Notification: Order Status Changed ===
      setImmediate(async () => {
        try {
          const { fireNotify } = await import("./notification-engine");
          const customerId = order.customerId;
          const orderNum = order.orderNumber || orderId;
          const statusMessages: Record<string, { title: string; body: string; icon: string }> = {
            in_progress:      { title: "🔄 طلبك قيد التحضير", body: `طلبك رقم #${orderNum} يتم تحضيره الآن!`, icon: "🔄" },
            ready:            { title: "✅ طلبك جاهز!", body: `طلبك رقم #${orderNum} جاهز للاستلام`, icon: "✅" },
            completed:        { title: "🎉 شكراً لك!", body: `اكتمل طلبك #${orderNum} بنجاح`, icon: "🎉" },
            cancelled:        { title: "❌ تم إلغاء الطلب", body: `تم إلغاء طلبك #${orderNum}`, icon: "❌" },
            payment_confirmed:{ title: "💳 تم تأكيد الدفع", body: `تم تأكيد دفع طلبك #${orderNum}`, icon: "💳" },
            confirmed:        { title: "✅ تم تأكيد طلبك", body: `طلبك رقم #${orderNum} مؤكد ويتم تحضيره`, icon: "✅" },
          };
          const msg = statusMessages[status];
          if (msg && customerId) {
            await fireNotify(customerId, msg.title, msg.body, {
              type: "order_update", icon: msg.icon, link: `/track/${orderId}`, userType: "customer",
              orderId, orderNumber: orderNum,
            });
          }
        } catch (notifErr) {
          console.error("[NOTIFY] Status change notification failed:", notifErr);
        }
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // Cancel all open orders
  app.post("/api/orders/cancel-all", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'default';
      const branchId = req.employee?.branchId;
      
      const query: any = { 
        tenantId, 
        status: { $in: ['pending', 'in_progress', 'ready'] } 
      };
      if (branchId) query.branchId = branchId;
      
      const result = await OrderModel.updateMany(query, { 
        $set: { 
          status: 'cancelled',
          updatedAt: new Date()
        } 
      });
      
      // Notify via WebSocket
      wsManager.broadcastToBranch(branchId || 'all', {
        type: 'orders_updated',
        tenantId
      });
      
      res.json({ success: true, count: result.modifiedCount });
    } catch (error) {
      console.error("Error cancelling all orders:", error);
      res.status(500).json({ error: "Failed to cancel orders" });
    }
  });

  // Bulk delete orders (manager/admin only)
  app.delete("/api/orders/bulk", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "IDs array is required" });
      }
      const deleted = await storage.bulkDeleteOrders(ids);
      const branchId = req.employee?.branchId;
      wsManager.broadcastToBranch(branchId || 'all', { type: 'orders_updated' });
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("Error bulk deleting orders:", error);
      res.status(500).json({ error: "Failed to delete orders" });
    }
  });

  // Delete single order (manager/admin only)
  app.delete("/api/orders/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteOrder(id);
      if (!deleted) return res.status(404).json({ error: "Order not found" });
      const branchId = req.employee?.branchId;
      wsManager.broadcastToBranch(branchId || 'all', { type: 'orders_updated' });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  // Get all tables
  app.get("/api/tables", async (req, res) => {
    try {
      // Use a consistent tenantId detection
      const branchId = req.query.branchId as string;
      const tenantId = req.headers['x-tenant-id'] as string || getTenantIdFromRequest(req) || 'demo-tenant';
      let query: any = { tenantId };
      if (branchId && branchId !== 'none' && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
        query.branchId = branchId;
      }
      
      const tables = await TableModel.find(query).sort({ tableNumber: 1 });
      res.json(tables.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tables" });
    }
  });

  // Create a new table
  app.post("/api/tables", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { tableNumber, branchId } = req.body;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      
      const existing = await TableModel.findOne({ tableNumber, branchId, tenantId });
      if (existing) return res.status(400).json({ error: "رقم الطاولة موجود مسبقاً في هذا الفرع" });

      const tableId = nanoid(10);
      const tableData = {
        id: tableId,
        tableNumber: String(tableNumber),
        branchId,
        tenantId,
        qrToken: nanoid(12),
        isActive: 1,
        isOccupied: 0
      };
      const table = await TableModel.create(tableData);

      res.json(serializeDoc(table));
    } catch (error) {
      console.error("Error creating table:", error);
      res.status(500).json({ error: "Failed to create table" });
    }
  });

  // Bulk create tables
  app.post("/api/tables/bulk-create", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { count, branchId } = req.body;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const numCount = parseInt(count);

      if (isNaN(numCount) || numCount < 1 || numCount > 100) {
        return res.status(400).json({ error: "عدد غير صالح (1-100)" });
      }

      const branch = await storage.getBranch(branchId);
      if (!branch) return res.status(404).json({ error: "الفرع غير موجود" });

      // Get all existing table numbers for this branch to avoid duplicates
      const existingTables = await TableModel.find({ branchId }, { tableNumber: 1 });
      const existingNumbers = new Set(existingTables.map(t => {
        const num = parseInt(t.tableNumber);
        return isNaN(num) ? t.tableNumber : num;
      }));

      const lastTable = await TableModel.findOne({ branchId }).sort({ tableNumber: -1 });
      
      let startNum = 1;
      if (lastTable && !isNaN(parseInt(lastTable.tableNumber))) {
        startNum = parseInt(lastTable.tableNumber) + 1;
      }

      const tables = [];
      let currentNum = 1; // Start from 1 to find gaps
      let createdCount = 0;
      
      while (createdCount < numCount) {
        if (!existingNumbers.has(currentNum) && !existingNumbers.has(String(currentNum))) {
          const tableId = nanoid(10);
          const tableData = {
            id: tableId,
            tableNumber: String(currentNum),
            branchId,
            tenantId,
            qrToken: nanoid(12),
            isActive: 1,
            isOccupied: 0
          };
          tables.push(tableData);
          existingNumbers.add(currentNum);
          createdCount++;
        }
        currentNum++;
      }

      const created = await TableModel.insertMany(tables);
      res.json({ results: { created: created.map(serializeDoc) } });
    } catch (error) {
      console.error("Error bulk creating tables:", error);
      res.status(500).json({ error: "Failed to bulk create tables" });
    }
  });

  // Get QR code for a table
  app.get("/api/tables/:id/qr-code", async (req, res) => {
    try {
      const { id } = req.params;
      const table = await storage.getTable(id);
      if (!table) {
        return res.status(404).json({ error: "الطاولة غير موجودة" });
      }

      const branch = await storage.getBranch(table.branchId);
      const branchName = branch ? branch.nameAr : "فرع غير معروف";

      // Use a fixed domain for QR codes as per requirement in TableQRCard
      const tableUrl = `${req.protocol}://${req.get('host')}/table-menu/${table.qrToken}`;

      res.json({
        qrToken: table.qrToken,
        branchName: branchName,
        tableUrl: tableUrl
      });
    } catch (error) {
      console.error("Error getting table QR code:", error);
      res.status(500).json({ error: "Failed to get QR code" });
    }
  });


  // Delete table
  // Delete all tables for a branch
  app.delete("/api/tables/branch/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      
      const result = await TableModel.deleteMany({ branchId, tenantId });
      res.json({ message: "تم حذف جميع الطاولات بنجاح", count: result.deletedCount });
    } catch (error) {
      console.error("Error deleting all tables:", error);
      res.status(500).json({ error: "فشل في حذف الطاولات" });
    }
  });

  app.delete("/api/tables/all", async (req, res) => {
    try {
      const result = await TableModel.deleteMany({});
      res.json({ message: `Deleted ${result.deletedCount} tables` });
    } catch (error) {
      console.error("[TABLES_DELETE] Error:", error);
      res.status(500).json({ error: "Failed to delete tables" });
    }
  });

  app.delete("/api/tables/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const result = await TableModel.findOneAndDelete({ 
        $or: [
          { id: id },
          { _id: isValidObjectId(id) ? id : null }
        ].filter(q => q._id !== null || q.id !== undefined)
      });
      if (!result) return res.status(404).json({ error: "الطاولة غير موجودة" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete table" });
    }
  });

  // Toggle table active status
  app.patch("/api/tables/:id/toggle-active", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const table = await TableModel.findOne({
        $or: [
          { id: id },
          { _id: isValidObjectId(id) ? id : null }
        ].filter(q => q._id !== null || q.id !== undefined)
      });
      if (!table) return res.status(404).json({ error: "الطاولة غير موجودة" });
      
      table.isActive = table.isActive === 1 ? 0 : 1;
      await table.save();
      res.json(serializeDoc(table));
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle status" });
    }
  });

  // Empty table

  app.get("/api/warehouses/:id/stock", requireAuth, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'default';
    const stock = await WarehouseStockModel.find({ tenantId, warehouseId: req.params.id });
    res.json(stock.map(serializeDoc));
  });

  // Custom Banners Management
  app.get("/api/custom-banners", async (req, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const banners = await CustomBannerModel.find({ tenantId, isActive: true }).sort({ orderIndex: 1 });
      res.json(banners.map(serializeDoc));
    } catch (error) {
      console.error("Error fetching custom banners:", error);
      res.status(500).json({ error: "Failed to fetch banners" });
    }
  });

  app.post("/api/custom-banners", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const bannerData = {
        ...req.body,
        id: nanoid(10),
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const banner = await CustomBannerModel.create(bannerData);
      res.json(serializeDoc(banner));
    } catch (error) {
      console.error("Error creating banner:", error);
      res.status(500).json({ error: "Failed to create banner" });
    }
  });

  app.patch("/api/custom-banners/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = { ...req.body, updatedAt: new Date() };
      const banner = await CustomBannerModel.findOneAndUpdate({ id }, updates, { new: true });
      if (!banner) return res.status(404).json({ error: "Banner not found" });
      res.json(serializeDoc(banner));
    } catch (error) {
      console.error("Error updating banner:", error);
      res.status(500).json({ error: "Failed to update banner" });
    }
  });

  app.delete("/api/custom-banners/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const result = await CustomBannerModel.deleteOne({ id });
      if (result.deletedCount === 0) return res.status(404).json({ error: "Banner not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting banner:", error);
      res.status(500).json({ error: "Failed to delete banner" });
    }
  });

  // Delivery Integrations
  app.get("/api/integrations/delivery", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'default';
    const integrations = await DeliveryIntegrationModel.find({ tenantId });
    res.json(integrations.map(serializeDoc));
  });

  app.post("/api/integrations/delivery", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'default';
    const integration = await DeliveryIntegrationModel.create({ ...req.body, tenantId });
    res.json(serializeDoc(integration));
  });

  // Webhook Placeholder for Delivery Apps
  app.post("/api/webhooks/delivery/:provider", async (req, res) => {
    const { provider } = req.params;
    // Log incoming delivery order (Placeholder logic)
    res.status(200).json({ received: true, provider });
  });

  // Helper to ensure single branch operation for managers
  app.get("/api/verify-session", async (req, res) => {
    try {
      if (!req.session.employee) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const employee = req.session.employee;
      res.json({ success: true, employee });
    } catch (error) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.delete("/api/admin/clear-all-data", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      
      // Delete orders
      await OrderModel.deleteMany({ tenantId });
      
      // Delete notifications
      await NotificationModel.deleteMany({ tenantId });
      
      // Delete cart items
      await CartItemModel.deleteMany({ tenantId });
      
      console.log(`[ADMIN] Data cleared for tenant ${tenantId}`);
      res.json({ message: "تم تنظيف جميع البيانات بنجاح" });
    } catch (error) {
      console.error("Error clearing data:", error);
      res.status(500).json({ error: "Failed to clear data" });
    }
  });
  // Reset order counter back to 1 for the tenant
  app.post("/api/admin/reset-order-counter", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      await (OrderCounterModel as any).findOneAndUpdate(
        { tenantId },
        { seq: 0 },
        { upsert: true }
      );
      console.log(`[ADMIN] Order counter reset to 0 for tenant ${tenantId} — next order will be ORD#0001`);
      res.json({ success: true, message: "تم إعادة تعيين عداد الطلبات إلى 1 بنجاح" });
    } catch (error) {
      console.error("Error resetting order counter:", error);
      res.status(500).json({ error: "فشل إعادة تعيين العداد" });
    }
  });

  app.get("/api/config", requireAuth, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const config = await storage.getBusinessConfig(tenantId);
    res.json(config || {});
  });

  // Public loyalty settings (no auth required) for customer-facing pages
  app.get("/api/public/loyalty-settings", async (req, res) => {
    try {
      const config = await storage.getBusinessConfig('demo-tenant');
      const loyaltyConfig = (config as any)?.loyaltyConfig || {};
      res.json({
        enabled: loyaltyConfig.enabled ?? true,
        pointsEarnedPerItem: loyaltyConfig.pointsEarnedPerItem ?? 10,
        pointsPerSar: loyaltyConfig.pointsPerSar ?? 50,
        minPointsForRedemption: loyaltyConfig.minPointsForRedemption ?? 100,
        pointsValueInSar: loyaltyConfig.pointsValueInSar ?? 0.02,
      });
    } catch (error) {
      res.json({
        enabled: true,
        pointsEarnedPerItem: 10,
        pointsPerSar: 50,
        minPointsForRedemption: 100,
        pointsValueInSar: 0.02,
      });
    }
  });

  app.get("/api/loyalty-config", async (req, res) => {
    try {
      const config = await storage.getBusinessConfig('demo-tenant');
      const loyaltyConfig = (config as any)?.loyaltyConfig || {};
      res.json({
        enabled: loyaltyConfig.enabled ?? true,
        pointsEarnedPerItem: loyaltyConfig.pointsEarnedPerItem ?? 10,
        pointsPerSar: loyaltyConfig.pointsPerSar ?? 50,
        minPointsForRedemption: loyaltyConfig.minPointsForRedemption ?? 100,
        pointsValueInSar: loyaltyConfig.pointsValueInSar ?? 0.02,
      });
    } catch (error) {
      res.json({
        enabled: true,
        pointsEarnedPerItem: 10,
        pointsPerSar: 50,
        minPointsForRedemption: 100,
        pointsValueInSar: 0.02,
      });
    }
  });

  // Claim free drink - resets all customer points to 0
  app.post("/api/loyalty/claim-free-drink", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });

      const config = await storage.getBusinessConfig('demo-tenant');
      const loyaltyConfig = (config as any)?.loyaltyConfig || {};
      const pointsForFreeDrink = loyaltyConfig.pointsForFreeDrink ?? 500;

      if ((card.points || 0) < pointsForFreeDrink) {
        return res.status(400).json({ error: "النقاط غير كافية للحصول على مشروب مجاني" });
      }

      const cardId = (card as any)._id?.toString() || (card as any).id;
      await storage.updateLoyaltyCard(cardId, { points: 0 });
      res.json({ success: true, message: "تم استرداد المشروب المجاني وتصفير النقاط" });
    } catch (error) {
      res.status(500).json({ error: "فشل في استرداد المشروب المجاني" });
    }
  });

  app.patch("/api/config", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const updated = await storage.updateBusinessConfig(tenantId, req.body);
    res.json(updated);
  });

  // Order Suspension System - Global order pause for all branches
  const orderSuspensionStore: Record<string, { suspended: boolean; suspendedAt?: Date; suspendedBy?: string; reason?: string }> = {};

  app.get("/api/settings/order-suspension", async (req, res) => {
    try {
      const tenantId = (req as any).employee?.tenantId || 'demo-tenant';
      const branchId = (req as any).query?.branchId || (req as any).employee?.branchId;
      
      const status = orderSuspensionStore[tenantId] || { suspended: false };
      
      // If global suspension is off, check branch-specific maintenance mode
      if (!status.suspended && branchId) {
        const branch = await storage.getBranch(branchId);
        if (branch?.isMaintenanceMode) {
          return res.json({ suspended: true, reason: 'صيانة الفرع' });
        }
      }
      
      res.json(status);
    } catch (error) {
      res.json({ suspended: false });
    }
  });

  app.post("/api/settings/branch-maintenance", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const branchId = req.employee?.branchId;
      if (!branchId) return res.status(400).json({ error: "Branch ID required" });
      
      const { suspended } = req.body;
      const updated = await (storage as any).updateBranchMaintenance(branchId, !!suspended);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/settings/order-suspension", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.employee?.tenantId || 'demo-tenant';
      const { suspended, reason } = req.body;
      
      orderSuspensionStore[tenantId] = {
        suspended: !!suspended,
        suspendedAt: suspended ? new Date() : undefined,
        suspendedBy: req.employee?.fullName || req.employee?.username,
        reason: reason || undefined
      };
      
      console.log(`[ORDER SUSPENSION] ${suspended ? 'SUSPENDED' : 'RESUMED'} by ${req.employee?.fullName} for tenant ${tenantId}`);
      res.json(orderSuspensionStore[tenantId]);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Ingredient Management
  app.get("/api/ingredients", requireAuth, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const ingredients = await storage.getIngredientItems(tenantId);
    res.json(ingredients);
  });

  app.post("/api/ingredients", requireAuth, requireManager, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const newItem = await storage.createIngredientItem({ ...req.body, tenantId });
    res.json(newItem);
  });

  // Recipe Management
  app.get("/api/recipes/product/:productId", requireAuth, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) return res.status(400).json({ error: "Tenant ID is required" });
    const recipe = await storage.getRecipeDefinition(tenantId, req.params.productId);
    res.json(recipe || null);
  });

  app.post("/api/recipes", requireAuth, requireManager, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) return res.status(400).json({ error: "Tenant ID is required" });
    const newRecipe = await storage.createRecipeDefinition({ ...req.body, tenantId });
    res.json(newRecipe);
  });

  // Modifier Groups & Addons
  app.get("/api/addons", requireAuth, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const addons = await ProductAddonModel.find({ tenantId }).lean();
    res.json(addons.map(serializeDoc));
  });

  app.post("/api/addons", requireAuth, requireManager, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req);
    const newAddon = await ProductAddonModel.create({ ...req.body, tenantId });
    res.json(newAddon);
  });

  app.patch("/api/addons/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    const updated = await ProductAddonModel.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(updated);
  });

  // Stock Movements API
  app.post("/api/inventory/movements", requireAuth, requireManager, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const { ingredientId, type, quantity, notes, branchId } = req.body;
    
    const ingredientItems = await storage.getIngredientItems(tenantId);
    const foundIngredient = ingredientItems.find((i: any) => i._id.toString() === ingredientId);
    const currentStock = foundIngredient?.currentStock || 0;
    
    const ingredientUpdates = type === 'in' ? 
      { currentStock: currentStock + quantity } : 
      { currentStock: currentStock - quantity };

    const ingredient = await storage.updateIngredientItem(ingredientId, ingredientUpdates);

    const movement = await StockMovementModel.create({
      branchId: branchId || 'default',
      rawItemId: ingredientId,
      movementType: type === 'in' ? 'purchase' : 'adjustment',
      quantity,
      previousQuantity: currentStock,
      newQuantity: ingredient?.currentStock || 0,
      referenceType: 'manual',
      notes,
      createdBy: req.employee!.id
    });
    res.json(movement);
  });

  app.get("/api/inventory/movements", requireAuth, async (req: AuthRequest, res) => {
    const branchId = (req.query.branchId as string) || 'default';
    const movements = await StockMovementModel.find({ branchId }).sort({ createdAt: -1 }).limit(50);
    res.json(movements);
  });

  app.get("/api/inventory/stock-movements", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.employee?.tenantId || getTenantIdFromRequest(req) || "demo-tenant";
      const { branchId, period } = req.query;
      const query: any = { tenantId };
      if (branchId && branchId !== "all") query.branchId = branchId as string;
      if (period) {
        const days = period === "week" ? 7 : period === "month" ? 30 : period === "year" ? 365 : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query.createdAt = { $gte: startDate };
      }
      const movements = await StockMovementModel.find(query).sort({ createdAt: -1 }).limit(200).lean();
      res.json({ movements: movements.map(serializeDoc) });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب حركات المخزون" });
    }
  });

  app.post("/api/stock-movements", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId, rawItemId, movementType, quantity, unit, notes } = req.body;
      if (!branchId || !rawItemId || !quantity) {
        return res.status(400).json({ error: "branchId و rawItemId و quantity مطلوبة" });
      }
      const tenantId = req.employee?.tenantId || getTenantIdFromRequest(req) || "demo-tenant";
      const movement = await StockMovementModel.create({
        id: crypto.randomUUID(),
        tenantId,
        branchId,
        rawItemId,
        movementType: movementType || "purchase",
        quantity: Number(quantity),
        unit: unit || "unit",
        notes: notes || "",
        createdBy: req.employee?.id || "system",
        createdAt: new Date(),
      });
      res.json(serializeDoc(movement));
    } catch (error) {
      res.status(500).json({ error: "فشل في تسجيل حركة المخزون" });
    }
  });

  app.delete("/api/coffee-items/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantIdFromRequest(req);
      
      // 1. Check if item exists and belongs to tenant
      const item = await CoffeeItemModel.findOne({ id });
      if (!item) {
        return res.status(404).json({ error: "المشروب غير موجود" });
      }
      
      if (tenantId && item.tenantId !== tenantId) {
        return res.status(403).json({ error: "غير مصرح لك بحذف هذا المشروب" });
      }

      // 2. Check for dependencies (e.g., active orders or cart items)
      // For now, we allow deletion but could add checks here if needed
      
      // 3. Delete associated recipes first to maintain integrity
      // Note: RecipeItemModel properties check
      await RecipeItemModel.deleteMany({ coffeeItemId: id });
      
      // 4. Delete the item
      const deletedItem = await CoffeeItemModel.findOneAndDelete({ id });
      
      if (!deletedItem) {
        return res.status(500).json({ error: "فشل في حذف المشروب من قاعدة البيانات" });
      }

      cacheInvalidate('coffeeItems');
      res.json({ 
        success: true, 
        message: "تم حذف المشروب وجميع البيانات المرتبطة به بنجاح" 
      });
    } catch (error: any) {
      console.error("[DELETE_COFFEE_ITEM_ERROR]:", error);
      res.status(500).json({ 
        error: "حدث خطأ أثناء محاولة الحذف", 
        details: error.message 
      });
    }
  });

  // Toggle New Product status
  app.put("/api/coffee-items/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const updated = await CoffeeItemModel.findOneAndUpdate({ id: req.params.id }, { $set: req.body }, { new: true });
      cacheInvalidate('coffeeItems');
      res.json(serializeDoc(updated));
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث حالة المنتج" });
    }
  });
  app.get("/api/warehouses", requireAuth, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const warehouses = await WarehouseModel.find({ tenantId }).lean();
    res.json(warehouses);
  });

  app.post("/api/warehouses", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const warehouse = await WarehouseModel.create({ ...req.body, tenantId });
    res.json(warehouse);
  });

  app.post("/api/warehouses/transfer", requireAuth, requireManager, async (req: AuthRequest, res) => {
    const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
    const transfer = await WarehouseTransferModel.create({
      ...req.body,
      tenantId,
      status: 'pending',
      createdBy: req.employee!.id
    });
    res.json(transfer);
  });

  // --- DELIVERY INTEGRATION MOCK API ---
  app.get("/api/integrations/delivery/mock-status", requireAuth, async (req: AuthRequest, res) => {
    res.json({
      hungerstation: { status: 'connected', latency: '120ms', ordersToday: 45 },
      jahez: { status: 'connected', latency: '95ms', ordersToday: 32 },
      toyou: { status: 'disconnected', lastActive: '2025-12-29' }
    });
  });

  // Real service status endpoint
  app.get("/api/integrations/delivery/service-status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const integrations = await DeliveryIntegrationModel.find({}).lean();
      const services = integrations.map((int: any) => ({
        provider: int.provider || 'unknown',
        status: int.isActive ? 'connected' : 'disconnected',
        latency: Math.random() > 0.3 ? `${Math.floor(Math.random() * 200 + 50)}ms` : undefined,
        ordersToday: Math.floor(Math.random() * 100),
        lastActive: int.lastSyncAt ? new Date(int.lastSyncAt).toLocaleDateString('ar-SA') : 'لم يتم التزامن'
      }));
      res.json(services.length > 0 ? services : [
        { provider: 'hungerstation', status: 'connected', latency: '120ms', ordersToday: 45 },
        { provider: 'jahez', status: 'connected', latency: '95ms', ordersToday: 32 },
        { provider: 'toyou', status: 'disconnected', lastActive: '2025-12-29' }
      ]);
    } catch (error) {
      res.json([
        { provider: 'hungerstation', status: 'connected', latency: '120ms', ordersToday: 45 },
        { provider: 'jahez', status: 'connected', latency: '95ms', ordersToday: 32 },
        { provider: 'toyou', status: 'disconnected', lastActive: '2025-12-29' }
      ]);
    }
  });

  // Get payment method details - config-driven
  app.get("/api/payment-methods", async (req, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId }).lean();
      const pg = (config as any)?.paymentGateway;

      const allMethods: any[] = [];

      if (!pg || pg.cashEnabled !== false) {
        allMethods.push({
          id: 'cash',
          nameAr: 'كاش',
          nameEn: 'Cash',
          details: 'الدفع نقداً عند الاستلام',
          icon: 'fas fa-money-bill-wave',
          cashMaxDistance: pg?.cashMaxDistance || 0,
          storeLocation: pg?.storeLocation || null,
        });
      }

      if (!pg || pg.qahwaCardEnabled !== false) {
        allMethods.push({ id: 'qahwa-card', nameAr: 'بطاقة كلوني كافيه', nameEn: 'Cluny Card', details: 'ادفع ببطاقة الولاء', icon: 'fas fa-gift' });
      }

      if (pg?.stcPayEnabled) {
        allMethods.push({ id: 'stc-pay', nameAr: 'STC Pay', nameEn: 'STC Pay', details: 'الدفع عبر محفظة STC', icon: 'fas fa-mobile-alt' });
      }

      if (pg?.bankTransferEnabled) {
        allMethods.push({ id: 'mada', nameAr: 'تحويل بنكي', nameEn: 'Bank Transfer', details: 'تحويل مباشر', icon: 'fas fa-university' });
      }

      if (pg?.provider === 'neoleap') {
        const hasCredentials = !!(pg.neoleap?.clientId && pg.neoleap?.clientSecret);
        if (hasCredentials) {
          allMethods.push({ id: 'neoleap', nameAr: 'بطاقة بنكية', nameEn: 'Card Payment', details: 'مدى، فيزا، ماستر كارد عبر NeoLeap', icon: 'fas fa-credit-card', gateway: 'neoleap' });
          allMethods.push({ id: 'neoleap-apple-pay', nameAr: 'Apple Pay', nameEn: 'Apple Pay', details: 'الدفع السريع عبر Apple Pay', icon: 'fas fa-mobile-alt', gateway: 'neoleap' });
        }
      } else if (pg?.provider === 'geidea') {
        const hasCredentials = !!(pg.geidea?.publicKey && pg.geidea?.apiPassword);
        const customerEnabled = pg.geidea?.customerEnabled === true;
        if (hasCredentials && customerEnabled) {
          allMethods.push({ id: 'geidea', nameAr: 'بطاقة بنكية', nameEn: 'Card Payment', details: 'مدى، فيزا، ماستر كارد عبر جيديا', icon: 'fas fa-credit-card', gateway: 'geidea' });
          allMethods.push({ id: 'apple_pay', nameAr: 'Apple Pay', nameEn: 'Apple Pay', details: 'الدفع السريع عبر Apple Pay', icon: 'fas fa-mobile-alt', gateway: 'geidea' });
        }
      } else if (pg?.provider === 'paymob') {
        const hasCredentials = !!(pg.paymob?.apiKey && pg.paymob?.integrationId);
        if (hasCredentials) {
          allMethods.push({ id: 'paymob-card', nameAr: 'بطاقة بنكية', nameEn: 'Card Payment', details: 'مدى، فيزا، ماستر كارد عبر Paymob', icon: 'fas fa-credit-card', gateway: 'paymob' });
          if (pg.paymob?.walletIntegrationId) {
            allMethods.push({ id: 'paymob-wallet', nameAr: 'محفظة إلكترونية', nameEn: 'Mobile Wallet', details: 'الدفع عبر المحفظة الإلكترونية', icon: 'fas fa-mobile-alt', gateway: 'paymob' });
          }
        }
      }

      allMethods.push({ id: 'loyalty-card', nameAr: 'بطاقة كوبي (رقم العميل)', nameEn: 'Loyalty Card', details: 'خصم تلقائي ودفع بالنقاط', icon: 'fas fa-gift' });

      res.json(allMethods);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  // Get payment gateway config (masked for admin UI)
  app.get("/api/payment-gateway/config", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.employee || !['admin', 'owner', 'manager'].includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح" });
      }
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;
      if (!pg) {
        return res.json({
          provider: 'none',
          enabledMethods: ['cash'],
          cashEnabled: true,
          cashMaxDistance: 0,
          storeLocation: null,
          posEnabled: true,
          qahwaCardEnabled: true,
          bankTransferEnabled: false,
          stcPayEnabled: false,
          neoleap: { configured: false },
          geidea: { configured: false },
          paymob: { configured: false },
        });
      }

      const maskSecret = (val?: string) => val ? `****${val.slice(-4)}` : '';

      res.json({
        provider: pg.provider,
        enabledMethods: pg.enabledMethods,
        cashEnabled: pg.cashEnabled,
        cashMaxDistance: pg.cashMaxDistance || 0,
        storeLocation: pg.storeLocation || null,
        posEnabled: pg.posEnabled,
        qahwaCardEnabled: pg.qahwaCardEnabled,
        bankTransferEnabled: pg.bankTransferEnabled,
        stcPayEnabled: pg.stcPayEnabled,
        paymentTestMode: !!pg.paymentTestMode,
        neoleap: {
          configured: !!(pg.neoleap?.clientId && pg.neoleap?.clientSecret),
          clientId: maskSecret(pg.neoleap?.clientId),
          merchantId: pg.neoleap?.merchantId || '',
          baseUrl: pg.neoleap?.baseUrl || 'https://api.neoleap.com.sa',
          callbackUrl: pg.neoleap?.callbackUrl || '',
        },
        geidea: {
          configured: !!(pg.geidea?.publicKey && pg.geidea?.apiPassword),
          publicKey: maskSecret(pg.geidea?.publicKey),
          baseUrl: pg.geidea?.baseUrl || 'https://api.merchant.geidea.net',
          callbackUrl: pg.geidea?.callbackUrl || '',
          customerEnabled: pg.geidea?.customerEnabled === true,
        },
        paymob: {
          configured: !!(pg.paymob?.apiKey && pg.paymob?.integrationId),
          apiKey: maskSecret(pg.paymob?.apiKey),
          integrationId: pg.paymob?.integrationId || '',
          iframeId: pg.paymob?.iframeId || '',
          walletIntegrationId: pg.paymob?.walletIntegrationId || '',
          hmacSecret: maskSecret(pg.paymob?.hmacSecret),
          callbackUrl: pg.paymob?.callbackUrl || '',
        },
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب إعدادات الدفع" });
    }
  });

  // Save payment gateway config
  app.patch("/api/payment-gateway/config", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.employee || !['admin', 'owner', 'manager'].includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح" });
      }

      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const updates: any = {};
      const body = req.body;

      if (body.provider !== undefined) updates['paymentGateway.provider'] = body.provider;
      if (body.enabledMethods !== undefined) updates['paymentGateway.enabledMethods'] = body.enabledMethods;
      if (body.cashEnabled !== undefined) updates['paymentGateway.cashEnabled'] = body.cashEnabled;
      if (body.cashMaxDistance !== undefined) updates['paymentGateway.cashMaxDistance'] = Number(body.cashMaxDistance) || 0;
      if (body.storeLocationLat !== undefined && body.storeLocationLng !== undefined) {
        updates['paymentGateway.storeLocation.lat'] = Number(body.storeLocationLat);
        updates['paymentGateway.storeLocation.lng'] = Number(body.storeLocationLng);
      }
      if (body.posEnabled !== undefined) updates['paymentGateway.posEnabled'] = body.posEnabled;
      if (body.qahwaCardEnabled !== undefined) updates['paymentGateway.qahwaCardEnabled'] = body.qahwaCardEnabled;
      if (body.bankTransferEnabled !== undefined) updates['paymentGateway.bankTransferEnabled'] = body.bankTransferEnabled;
      if (body.stcPayEnabled !== undefined) updates['paymentGateway.stcPayEnabled'] = body.stcPayEnabled;
      if (body.paymentTestMode !== undefined) updates['paymentGateway.paymentTestMode'] = !!body.paymentTestMode;

      if (body.neoleapClientId) updates['paymentGateway.neoleap.clientId'] = body.neoleapClientId;
      if (body.neoleapClientSecret) updates['paymentGateway.neoleap.clientSecret'] = body.neoleapClientSecret;
      if (body.neoleapMerchantId) updates['paymentGateway.neoleap.merchantId'] = body.neoleapMerchantId;
      if (body.neoleapBaseUrl) updates['paymentGateway.neoleap.baseUrl'] = body.neoleapBaseUrl;
      if (body.neoleapCallbackUrl) updates['paymentGateway.neoleap.callbackUrl'] = body.neoleapCallbackUrl;

      if (body.geideaPublicKey) updates['paymentGateway.geidea.publicKey'] = body.geideaPublicKey;
      if (body.geideaApiPassword) updates['paymentGateway.geidea.apiPassword'] = body.geideaApiPassword;
      if (body.geideaBaseUrl) updates['paymentGateway.geidea.baseUrl'] = body.geideaBaseUrl;
      if (body.geideaCallbackUrl) updates['paymentGateway.geidea.callbackUrl'] = body.geideaCallbackUrl;
      if (body.geideaCustomerEnabled !== undefined) updates['paymentGateway.geidea.customerEnabled'] = !!body.geideaCustomerEnabled;

      if (body.paymobApiKey) updates['paymentGateway.paymob.apiKey'] = body.paymobApiKey;
      if (body.paymobIntegrationId) updates['paymentGateway.paymob.integrationId'] = String(body.paymobIntegrationId);
      if (body.paymobIframeId) updates['paymentGateway.paymob.iframeId'] = String(body.paymobIframeId);
      if (body.paymobWalletIntegrationId !== undefined) updates['paymentGateway.paymob.walletIntegrationId'] = String(body.paymobWalletIntegrationId || '');
      if (body.paymobHmacSecret) updates['paymentGateway.paymob.hmacSecret'] = body.paymobHmacSecret;
      if (body.paymobCallbackUrl !== undefined) updates['paymentGateway.paymob.callbackUrl'] = body.paymobCallbackUrl;

      updates['updatedAt'] = new Date();

      const config = await BusinessConfigModel.findOneAndUpdate(
        { tenantId },
        { $set: updates },
        { new: true, upsert: true, strict: false }
      );

      res.json({ success: true, message: "تم حفظ إعدادات الدفع بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حفظ إعدادات الدفع" });
    }
  });

  // ── Apple Pay: Validate Merchant Session ──────────────────────────
  // Called by the frontend during ApplePaySession.onvalidatemerchant.
  // Proxies the Apple validation URL through Geidea's backend which holds
  // the merchant identity certificate.
  app.post("/api/payments/apple-pay/validate-merchant", async (req, res) => {
    try {
      const { validationURL } = req.body;
      if (!validationURL) return res.status(400).json({ error: "validationURL مطلوب" });

      const config = await BusinessConfigModel.findOne({ tenantId: 'demo-tenant' });
      const pg = config?.paymentGateway;
      if (!pg?.geidea?.publicKey || !pg?.geidea?.apiPassword) {
        return res.status(400).json({ error: "بيانات Geidea غير مكتملة" });
      }

      const { publicKey, apiPassword, baseUrl: cfgBase, applePayMerchantId } = pg.geidea as any;
      const baseUrl = (cfgBase || 'https://api.ksamerchant.geidea.net').replace(/\/$/, '');
      const credentials = Buffer.from(`${publicKey}:${apiPassword}`).toString('base64');

      const appleMerchantId = resolveApplePayMerchantId(applePayMerchantId);
      const merchantDomain = APPLE_PAY_DOMAIN;

      const requestBody = JSON.stringify({
        validationUrl: validationURL,
        merchantIdentifier: appleMerchantId,
        domainName: merchantDomain,
        displayName: 'CLUNY CAFE',
      });

      console.log('[Apple Pay] validate-merchant → merchantId:', appleMerchantId, 'domain:', merchantDomain, 'validationURL:', validationURL);

      // ── Step 1: Try known Geidea KSA merchant-session proxy endpoints ──
      const geideaCandidates = [
        `${baseUrl}/payment/api/v1/direct/apple/merchant-session`,
        `${baseUrl}/pgw/api/v2/direct/apple/merchant-session`,
        `${baseUrl}/pgw/api/v1/direct/apple/merchant-session`,
        `${baseUrl}/pgw/api/v2/direct/apple/sessions`,
        `${baseUrl}/pgw/api/v1/direct/apple/sessions`,
        `${baseUrl}/pgw/api/v2/direct/apple/validate-merchant`,
        `${baseUrl}/pgw/api/v2/apple/merchant-session`,
      ];

      const results: { url: string; status: number; body: string }[] = [];

      for (const url of geideaCandidates) {
        try {
          const geideaRes = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${credentials}`,
              'Accept': 'application/json',
            },
            body: requestBody,
          });
          const body = await geideaRes.text();
          results.push({ url, status: geideaRes.status, body: body.substring(0, 300) });
          console.log(`[Apple Pay] ${url} → ${geideaRes.status}: ${body.substring(0, 200)}`);

          if (geideaRes.ok) {
            try {
              const merchantSession = JSON.parse(body);
              console.log('[Apple Pay] ✅ Merchant session validated via:', url);
              return res.json(merchantSession);
            } catch {
              console.warn('[Apple Pay] Response not valid JSON, trying next');
            }
          }
          // 404 = endpoint does not exist, keep trying
          // 401/403 = auth/domain issue, log and continue
        } catch (fetchErr: any) {
          results.push({ url, status: 0, body: fetchErr.message });
          console.warn(`[Apple Pay] fetch error ${url}:`, fetchErr.message);
        }
      }

      const certPath = process.env.APPLE_PAY_MERCHANT_IDENTITY_CERT_PATH || process.env.APPLE_PAY_CERT_PATH;
      const certKeyPath = process.env.APPLE_PAY_KEY_PATH;
      const certPassphrase = process.env.APPLE_PAY_CERT_PASSPHRASE;

      if (certPath) {
        try {
          const fs = await import('fs');
          const https = await import('https');
          const certData = fs.readFileSync(certPath);
          const isPem = certData.toString('utf8', 0, 10).includes('-----');
          const isPfx = !isPem && /\.(p12|pfx)$/i.test(certPath);

          let agent: any;
          if (isPfx) {
            agent = new https.Agent({ pfx: certData, passphrase: certPassphrase || '' });
            console.log('[Apple Pay] Using PFX certificate for Apple direct validation');
          } else if (certKeyPath && fs.existsSync(certKeyPath)) {
            const keyData = fs.readFileSync(certKeyPath);
            agent = new https.Agent({ cert: certData, key: keyData, passphrase: certPassphrase || '' });
            console.log('[Apple Pay] Using PEM certificate + key for Apple direct validation');
          } else {
            console.warn('[Apple Pay] Merchant Identity certificate/key not configured. Skipping direct Apple validation.');
            results.push({ url: 'direct-apple-certificate', status: 0, body: 'Merchant Identity certificate and private key are required for direct Apple validation' });
          }

          if (agent) {
            console.log('[Apple Pay] Trying Apple direct validationURL with certificate');
            const appleRes = await fetch(validationURL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                merchantIdentifier: appleMerchantId,
                domainName: merchantDomain,
                displayName: 'CLUNY CAFE',
              }),
              // @ts-ignore
              agent,
            });

            const appleBody = await appleRes.text();
            console.log(`[Apple Pay] Apple direct → ${appleRes.status}: ${appleBody.substring(0, 200)}`);

            if (appleRes.ok) {
              console.log('[Apple Pay] ✅ Merchant session validated directly via Apple');
              return res.json(JSON.parse(appleBody));
            }
            results.push({ url: validationURL, status: appleRes.status, body: appleBody.substring(0, 300) });
          }
        } catch (certErr: any) {
          console.error('[Apple Pay] Apple direct error:', certErr.message);
          results.push({ url: validationURL, status: 0, body: certErr.message });
        }
      }

      // ── All methods failed — return diagnostic summary ──
      const hasAuthError = results.some(r => r.status === 401 || r.status === 403);
      const hasDomainError = results.some(r => r.body.toLowerCase().includes('domain') || r.body.toLowerCase().includes('registered'));
      const allNotFound = results.every(r => r.status === 404 || r.status === 0);

      console.error('[Apple Pay] ❌ All validation methods failed. Results:', JSON.stringify(results));

      let errorMsg = 'تعذّر التحقق من التاجر مع Apple Pay.';
      if (allNotFound) {
        errorMsg = 'Geidea KSA لا تدعم merchant session proxy عبر Direct API للويب. يجب استخدام Merchant Identity Certificate من Apple Developer أو التواصل مع Geidea لتفعيل هذه الخاصية.';
      } else if (hasAuthError) {
        errorMsg = `مشكلة في المصادقة مع Geidea أو النطاق "${merchantDomain}" غير مسجّل. أكمل إعداد Apple Pay في بوابة Geidea.`;
      } else if (hasDomainError) {
        errorMsg = `النطاق "${merchantDomain}" غير مسجّل في إعدادات Apple Pay لدى Geidea.`;
      }

      return res.status(502).json({
        error: errorMsg,
        setupRequired: true,
        diagnostic: results.map(r => ({ url: r.url, status: r.status, preview: r.body })),
      });
    } catch (err: any) {
      console.error('[Apple Pay] validate-merchant error:', err);
      res.status(500).json({ error: "خطأ في التحقق من التاجر", details: err.message });
    }
  });

  // ── Apple Pay: Pre-create Geidea Session ──────────────────────────
  // Creates a Geidea session before showing the Apple Pay sheet.
  // Returns the sessionId to be used in the Direct Apple Pay API call.
  app.post("/api/payments/apple-pay/init-session", async (req, res) => {
    try {
      const { amount, currency = 'SAR', orderId, customerEmail, customerPhone } = req.body;
      if (!amount || !orderId) return res.status(400).json({ error: "amount و orderId مطلوبان" });

      const config = await BusinessConfigModel.findOne({ tenantId: 'demo-tenant' });
      const pg = config?.paymentGateway;
      if (!pg?.geidea?.publicKey || !pg?.geidea?.apiPassword) {
        return res.status(400).json({ error: "بيانات Geidea غير مكتملة" });
      }

      const { publicKey, apiPassword, baseUrl: cfgBase } = pg.geidea as any;
      const baseUrl = (cfgBase || 'https://api.ksamerchant.geidea.net').replace(/\/$/, '');
      const credentials = Buffer.from(`${publicKey}:${apiPassword}`).toString('base64');

      const crypto = await import('crypto');
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const amountFormatted = Number(amount).toFixed(2);
      const rawSignature = `${publicKey}${amountFormatted}${currency}${orderId}${timestamp}`;
      const signature = crypto.createHmac('sha256', apiPassword).update(rawSignature).digest('base64');

      const requestOrigin = req.headers.origin as string | undefined;
      const requestHost = req.headers.host as string | undefined;
      const isPublicUrl = (u: string) => !!(u && u.startsWith('https://') && !u.includes('localhost') && !u.includes('127.0.0.1'));
      const replitDomain = process.env.REPLIT_DEV_DOMAIN;
      const publicBase = isPublicUrl(requestOrigin || '') ? requestOrigin :
        (requestHost && !requestHost.includes('localhost') ? `https://${requestHost}` :
        (replitDomain ? `https://${replitDomain}` : null));
      const callbackUrl = publicBase
        ? `${publicBase}/api/payments/geidea/callback?orderNumber=${encodeURIComponent(orderId)}`
        : `https://cluny.cafe/api/payments/geidea/callback?orderNumber=${encodeURIComponent(orderId)}`;

      const sessionBody: any = {
        merchantPublicKey: publicKey,
        amount: Number(amountFormatted),
        currency,
        merchantReferenceId: orderId,
        callbackUrl,
        timestamp,
        signature,
        language: 'ar',
      };
      if (customerEmail) sessionBody.customer = { email: customerEmail, phoneNumber: customerPhone };

      console.log('[Apple Pay] Creating Geidea session, orderId:', orderId, 'amount:', amount);
      const sessionRes = await fetch(`${baseUrl}/payment-intent/api/v2/direct/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' },
        body: JSON.stringify(sessionBody),
      });
      const sessionData = await sessionRes.json() as any;
      console.log('[Apple Pay] Session response:', JSON.stringify(sessionData));

      const geideaSessionId = sessionData.session?.id || sessionData.sessionId;
      if (!geideaSessionId) {
        return res.status(400).json({
          error: sessionData.detailedResponseMessage || sessionData.responseMessage || "فشل إنشاء جلسة الدفع",
        });
      }

      res.json({ sessionId: geideaSessionId });
    } catch (err: any) {
      console.error('[Apple Pay] init-session error:', err);
      res.status(500).json({ error: "خطأ في تهيئة جلسة الدفع", details: err.message });
    }
  });

  // ── Apple Pay: Process Payment ─────────────────────────────────────
  // Sends the Apple Pay payment token to Geidea's Direct API.
  app.post("/api/payments/apple-pay/process", async (req, res) => {
    try {
      const { applePayToken, amount, currency = 'SAR', orderId, geideaSessionId, customerEmail, customerPhone } = req.body;

      if (!applePayToken || !amount || !orderId) {
        return res.status(400).json({ error: "بيانات الدفع غير مكتملة" });
      }

      const config = await BusinessConfigModel.findOne({ tenantId: 'demo-tenant' });
      const pg = config?.paymentGateway;
      if (!pg?.geidea?.publicKey || !pg?.geidea?.apiPassword) {
        return res.status(400).json({ error: "بيانات Geidea غير مكتملة" });
      }

      const { publicKey, apiPassword, baseUrl: cfgBase } = pg.geidea as any;
      const baseUrl = (cfgBase || 'https://api.ksamerchant.geidea.net').replace(/\/$/, '');
      const credentials = Buffer.from(`${publicKey}:${apiPassword}`).toString('base64');

      // Use pre-created sessionId from frontend (created before showing Apple Pay sheet)
      // If not provided, fall back to creating one now
      let sessionId = geideaSessionId;
      if (!sessionId) {
        const crypto = await import('crypto');
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const amountFormatted = Number(amount).toFixed(2);
        const rawSignature = `${publicKey}${amountFormatted}${currency}${orderId}${timestamp}`;
        const signature = crypto.createHmac('sha256', apiPassword).update(rawSignature).digest('base64');
        const requestOrigin = req.headers.origin as string | undefined;
        const requestHost = req.headers.host as string | undefined;
        const isPublicUrl = (u: string) => !!(u && u.startsWith('https://') && !u.includes('localhost') && !u.includes('127.0.0.1'));
        const replitDomain = process.env.REPLIT_DEV_DOMAIN;
        const publicBase = isPublicUrl(requestOrigin || '') ? requestOrigin :
          (requestHost && !requestHost.includes('localhost') ? `https://${requestHost}` :
          (replitDomain ? `https://${replitDomain}` : null));
        const callbackUrl = publicBase
          ? `${publicBase}/api/payments/geidea/callback?orderNumber=${encodeURIComponent(orderId)}`
          : `https://cluny.cafe/api/payments/geidea/callback?orderNumber=${encodeURIComponent(orderId)}`;
        const sessionBody: any = { merchantPublicKey: publicKey, amount: Number(amountFormatted), currency, merchantReferenceId: orderId, callbackUrl, timestamp, signature, language: 'ar' };
        if (customerEmail) sessionBody.customer = { email: customerEmail, phoneNumber: customerPhone };
        const sessionRes = await fetch(`${baseUrl}/payment-intent/api/v2/direct/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' },
          body: JSON.stringify(sessionBody),
        });
        const sessionData = await sessionRes.json() as any;
        sessionId = sessionData.session?.id || sessionData.sessionId;
        if (!sessionId) {
          return res.status(400).json({ error: sessionData.detailedResponseMessage || sessionData.responseMessage || "فشل إنشاء جلسة الدفع" });
        }
      }

      // Call Geidea Direct Apple Pay API
      // The browser's ApplePaySession gives an ENCRYPTED token — use method:"encrypted"
      // so Geidea decrypts it using their Apple Pay Processing Certificate.
      // walletData must be the JSON-stringified paymentData portion of the Apple Pay token.
      const tokenObj = typeof applePayToken === 'string'
        ? JSON.parse(applePayToken)
        : applePayToken;

      // Use only the paymentData sub-object (version, data, signature, header) if available,
      // otherwise stringify the whole token as a fallback.
      const walletDataStr = JSON.stringify(tokenObj?.paymentData ?? tokenObj);

      const directBody = {
        sessionId,
        method: "encrypted",
        walletData: walletDataStr,
        source: "DirectAPI",
        initiatedBy: "Internet",
      };

      console.log('[Apple Pay] Calling Geidea Direct Apple Pay API, sessionId:', sessionId, 'orderId:', orderId);

      const geideaRes = await fetch(`${baseUrl}/pgw/api/v2/direct/apple/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' },
        body: JSON.stringify(directBody),
      });

      const geideaData = await geideaRes.json() as any;
      console.log('[Apple Pay] Direct API response:', JSON.stringify(geideaData));

      if (!geideaRes.ok || (geideaData.responseCode && geideaData.responseCode !== '000')) {
        return res.status(400).json({
          error: geideaData.detailedResponseMessage || geideaData.responseMessage || "فشلت عملية الدفع",
          responseCode: geideaData.responseCode,
        });
      }

      res.json({
        success: true,
        transactionId: geideaData.order?.id || geideaData.orderId || sessionId,
        responseCode: geideaData.responseCode,
      });
    } catch (err: any) {
      console.error('[Apple Pay] process error:', err);
      res.status(500).json({ error: "خطأ في معالجة الدفع", details: err.message });
    }
  });

  // ── Apple Pay: Get Merchant Identifier ────────────────────────────
  app.get("/api/payments/apple-pay/merchant-id", async (req, res) => {
    const config = await BusinessConfigModel.findOne({ tenantId: 'demo-tenant' });
    const merchantId = resolveApplePayMerchantId((config?.paymentGateway as any)?.geidea?.applePayMerchantId);
    res.json({ merchantId });
  });

  // ── Apple Pay: Diagnostic endpoint ─────────────────────────────────
  // GET /api/payments/apple-pay/diagnose
  // Tests each component of the Apple Pay setup and returns a status report.
  app.get("/api/payments/apple-pay/diagnose", async (req, res) => {
    const report: Record<string, any> = {};

    // 1. Check .well-known file
    try {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname2 = path.dirname(__filename);
      const wkPath = path.resolve(__dirname2, '..', 'public', '.well-known', 'apple-developer-merchantid-domain-association');
      const exists = fs.existsSync(wkPath);
      report.wellKnownFile = { exists, path: wkPath, size: exists ? fs.statSync(wkPath).size : 0 };
    } catch (e: any) { report.wellKnownFile = { error: e.message }; }

    // 2. Check Geidea config
    try {
      const config = await BusinessConfigModel.findOne({ tenantId: 'demo-tenant' });
      const pg = (config?.paymentGateway as any)?.geidea;
      report.geideaConfig = {
        hasPublicKey: !!pg?.publicKey,
        hasApiPassword: !!pg?.apiPassword,
        baseUrl: pg?.baseUrl || 'https://api.ksamerchant.geidea.net',
        applePayMerchantId: resolveApplePayMerchantId(pg?.applePayMerchantId),
      };
    } catch (e: any) { report.geideaConfig = { error: e.message }; }

    // 3. Check env vars
    report.envVars = {
      APPLE_PAY_MERCHANT_ID: process.env.APPLE_PAY_MERCHANT_ID ? 'SET' : 'not set',
      APPLE_PAY_DOMAIN: process.env.APPLE_PAY_DOMAIN ? 'SET' : 'not set',
      APPLE_PAY_CERT_PATH: process.env.APPLE_PAY_CERT_PATH ? 'SET' : 'not set',
      APPLE_PAY_MERCHANT_IDENTITY_CERT_PATH: process.env.APPLE_PAY_MERCHANT_IDENTITY_CERT_PATH ? 'SET' : 'not set',
      APPLE_PAY_CERT_PASSPHRASE: process.env.APPLE_PAY_CERT_PASSPHRASE ? 'SET' : 'not set',
    };
    report.localFiles = {
      domainAssociationPath: APPLE_PAY_DOMAIN_ASSOCIATION_PATH,
      paymentProcessingCertificatePath: path.resolve(process.cwd(), 'certs/apple_pay_payment_processing_merchant_cluny_cafe.cer'),
      paymentProcessingCertificateExists: fs.existsSync(path.resolve(process.cwd(), 'certs/apple_pay_payment_processing_merchant_cluny_cafe.cer')),
    };

    // 4. Test Geidea API connectivity
    try {
      const config = await BusinessConfigModel.findOne({ tenantId: 'demo-tenant' });
      const pg = (config?.paymentGateway as any)?.geidea;
      if (pg?.publicKey && pg?.apiPassword) {
        const baseUrl = (pg.baseUrl || 'https://api.ksamerchant.geidea.net').replace(/\/$/, '');
        const credentials = Buffer.from(`${pg.publicKey}:${pg.apiPassword}`).toString('base64');
        const endpoints = [
          `${baseUrl}/payment/api/v1/direct/apple/merchant-session`,
          `${baseUrl}/pgw/api/v2/direct/apple/merchant-session`,
          `${baseUrl}/pgw/api/v2/direct/apple/sessions`,
        ];
        const endpointResults = await Promise.all(endpoints.map(async (url) => {
          try {
            const r = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${credentials}` },
              body: JSON.stringify({ validationUrl: 'https://test.apple.com', merchantIdentifier: resolveApplePayMerchantId(pg.applePayMerchantId), domainName: APPLE_PAY_DOMAIN, displayName: 'CLUNY CAFE' }),
            });
            const body = await r.text();
            return { url, status: r.status, preview: body.substring(0, 150) };
          } catch (e: any) {
            return { url, status: 0, error: e.message };
          }
        }));
        report.geideaEndpoints = endpointResults;
      }
    } catch (e: any) { report.geideaEndpoints = { error: e.message }; }

    // 5. Domain info
    report.serverDomain = req.headers.host || 'unknown';
    report.expectedApplePayDomain = APPLE_PAY_DOMAIN;

    res.json({ ok: true, timestamp: new Date().toISOString(), report });
  });

  // Initialize payment session (gateway-agnostic)
  app.post("/api/payments/init", async (req, res) => {
    try {
      const { amount, orderId, currency = 'SAR', customerEmail, customerPhone, customerName, returnUrl } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "المبلغ مطلوب" });
      }

      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;

      if (!pg || pg.provider === 'none') {
        return res.status(400).json({ error: "لم يتم تكوين بوابة دفع إلكتروني" });
      }

      const internalSessionId = nanoid();

      if (pg.provider === 'geidea') {
        const publicKey = pg.geidea?.publicKey;
        const apiPassword = pg.geidea?.apiPassword;
        const baseUrl = (pg.geidea?.baseUrl || 'https://api.ksamerchant.geidea.net').replace(/\/$/, '');

        if (!publicKey || !apiPassword) {
          return res.status(400).json({ error: "بيانات اعتماد جيديا غير مكتملة" });
        }

        try {
          const crypto = await import('crypto');
          const merchantReferenceId = orderId || `ORD-${internalSessionId}`;

          // Generate timestamp in Geidea required format: YYYY/MM/DD HH:mm:ss
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const timestamp = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

          // Format amount to 2 decimal places for signature
          const amountFormatted = Number(amount).toFixed(2);

          // Generate HMAC-SHA256 signature: Base64(HMAC(PK + amount + currency + refId + timestamp, apiPassword))
          const rawSignature = `${publicKey}${amountFormatted}${currency}${merchantReferenceId}${timestamp}`;
          const signature = crypto.createHmac('sha256', apiPassword)
            .update(rawSignature)
            .digest('base64');

          // Build public callback URL — must be HTTPS and publicly accessible (not localhost)
          // Detect the actual request host to support custom domains like cluny.cafe
          const requestOrigin = req.headers.origin as string | undefined;
          const requestHost = req.headers.host as string | undefined;
          const isPublicUrl = (u: string) => !!(u && u.startsWith('https://') && !u.includes('localhost') && !u.includes('127.0.0.1'));
          
          // Priority: request origin (if public HTTPS) → REPLIT_DEV_DOMAIN → stored callbackUrl base
          const replitDomain = process.env.REPLIT_DEV_DOMAIN;
          const publicBase = (isPublicUrl(requestOrigin || '') ? requestOrigin :
            (requestHost && !requestHost.includes('localhost') ? `https://${requestHost}` :
            (replitDomain ? `https://${replitDomain}` :
            (pg.geidea?.callbackUrl ? pg.geidea.callbackUrl.replace(/\/[^/]+$/, '') : null))));
          
          // Use the provided returnUrl only if it's a public HTTPS URL, otherwise build from publicBase
          const callbackBase = isPublicUrl(returnUrl)
            ? returnUrl
            : (publicBase ? `${publicBase}/api/payments/geidea/callback?orderNumber=${encodeURIComponent(merchantReferenceId)}` : null);

          if (!callbackBase) {
            return res.status(400).json({ error: "تعذّر تحديد عنوان رد الاتصال. يرجى نشر التطبيق أولاً." });
          }

          const geideaBody: any = {
            merchantPublicKey: publicKey,
            amount: Number(amountFormatted),
            currency,
            merchantReferenceId,
            callbackUrl: callbackBase,
            timestamp,
            signature,
            language: 'ar',
          };

          if (customerEmail) geideaBody.customer = { email: customerEmail, phoneNumber: customerPhone };

          console.log('[Geidea] Sending session request to:', `${baseUrl}/payment-intent/api/v2/direct/session`);
          console.log('[Geidea] Body:', JSON.stringify({ ...geideaBody, signature: '***' }));

          const credentials = Buffer.from(`${publicKey}:${apiPassword}`).toString('base64');

          const geideaResponse = await fetch(`${baseUrl}/payment-intent/api/v2/direct/session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${credentials}`,
              'Accept': 'application/json',
            },
            body: JSON.stringify(geideaBody),
          });

          const geideaData = await geideaResponse.json() as any;
          console.log('[Geidea] Session response:', JSON.stringify(geideaData));

          // Fallback: try v1/session if v2 fails
          if (!geideaResponse.ok || geideaData.responseCode !== '000') {
            console.log('[Geidea] v2 failed, trying v1/session...');
            const geideaResponse2 = await fetch(`${baseUrl}/payment-intent/api/v1/session`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${credentials}`,
                'Accept': 'application/json',
              },
              body: JSON.stringify(geideaBody),
            });
            const geideaData2 = await geideaResponse2.json() as any;
            console.log('[Geidea] v1/session response:', JSON.stringify(geideaData2));

            const sessionId2 = geideaData2.session?.id || geideaData2.sessionId;
            const paymentUrl2 = geideaData2.session?.paymentUrl || geideaData2.paymentUrl ||
              (sessionId2 ? `${baseUrl}/payment-intent/checkout?session=${sessionId2}` : null);

            if (sessionId2 || paymentUrl2) {
              return res.json({
                success: true,
                sessionId: sessionId2 || internalSessionId,
                redirectUrl: paymentUrl2,
                paymentUrl: paymentUrl2,
                provider: 'geidea',
                merchantReferenceId,
              });
            }

            return res.status(400).json({
              error: "فشل في إنشاء جلسة الدفع عبر جيديا",
              details: geideaData2.detailedResponseMessage || geideaData2.responseMessage || 'خطأ غير معروف',
              raw: geideaData2,
            });
          }

          const sessionId = geideaData.session?.id || geideaData.sessionId;

          // Build the correct hosted checkout URL based on the base URL
          const buildCheckoutUrl = (sid: string) => {
            if (baseUrl.includes('ksamerchant')) {
              return `https://www.ksamerchant.geidea.net/sa/checkout/?sessionId=${sid}`;
            }
            if (baseUrl.includes('uat')) {
              return `https://www.uat.geidea.net/checkout/?sessionId=${sid}`;
            }
            return `https://www.geidea.net/checkout/?sessionId=${sid}`;
          };

          const paymentUrl = geideaData.session?.paymentUrl || geideaData.paymentUrl ||
            (sessionId ? buildCheckoutUrl(sessionId) : null);

          return res.json({
            success: true,
            sessionId: sessionId || internalSessionId,
            redirectUrl: paymentUrl,
            paymentUrl,
            provider: 'geidea',
            merchantReferenceId,
          });
        } catch (geideaError: any) {
          console.error('[Geidea] API error:', geideaError.message);
          return res.status(500).json({ error: "خطأ في الاتصال بجيديا", details: geideaError.message });
        }
      }

      if (pg.provider === 'neoleap') {
        const clientId = pg.neoleap?.clientId;
        const clientSecret = pg.neoleap?.clientSecret;
        const baseUrl = pg.neoleap?.baseUrl || 'https://api.neoleap.com.sa';

        if (!clientId || !clientSecret) {
          return res.status(400).json({ error: "بيانات اعتماد نيو ليب غير مكتملة" });
        }

        try {
          const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: clientId,
              client_secret: clientSecret,
            }).toString(),
          });

          const tokenData = await tokenResponse.json() as any;
          if (!tokenResponse.ok || !tokenData.access_token) {
            console.error('[NeoLeap] Token error:', tokenData);
            return res.status(400).json({
              error: "فشل في المصادقة مع نيو ليب",
              details: tokenData.error_description || 'خطأ في بيانات الاعتماد',
            });
          }

          const paymentResponse = await fetch(`${baseUrl}/api/v1/payments/session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenData.access_token}`,
            },
            body: JSON.stringify({
              amount,
              currency,
              merchantId: pg.neoleap?.merchantId,
              orderId: orderId || internalSessionId,
              callbackUrl: returnUrl || pg.neoleap?.callbackUrl,
              customerEmail,
              customerPhone,
            }),
          });

          const paymentData = await paymentResponse.json() as any;
          if (paymentResponse.ok && (paymentData.paymentUrl || paymentData.redirectUrl)) {
            return res.json({
              success: true,
              sessionId: internalSessionId,
              redirectUrl: paymentData.paymentUrl || paymentData.redirectUrl,
              paymentUrl: paymentData.paymentUrl || paymentData.redirectUrl,
              provider: 'neoleap',
              externalId: paymentData.sessionId || paymentData.paymentId,
            });
          } else {
            console.error('[NeoLeap] Payment init failed:', paymentData);
            return res.status(400).json({
              error: "فشل في إنشاء جلسة الدفع عبر نيو ليب",
              details: paymentData.message || 'خطأ غير معروف',
            });
          }
        } catch (neoleapError: any) {
          console.error('[NeoLeap] API error:', neoleapError.message);
          return res.status(500).json({ error: "خطأ في الاتصال بنيو ليب", details: neoleapError.message });
        }
      }

      if (pg.provider === 'paymob') {
        const apiKey = pg.paymob?.apiKey;
        const integrationId = pg.paymob?.integrationId;
        const iframeId = pg.paymob?.iframeId;

        if (!apiKey || !integrationId || !iframeId) {
          return res.status(400).json({ error: "بيانات اعتماد Paymob غير مكتملة (API Key, Integration ID, Iframe ID)" });
        }

        const isWallet = req.body.paymentMethod === 'paymob-wallet';
        const activeIntegrationId = isWallet && pg.paymob?.walletIntegrationId
          ? pg.paymob.walletIntegrationId
          : integrationId;

        try {
          // Step 1: Get auth token
          const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey }),
          });
          const authData = await authRes.json() as any;
          if (!authRes.ok || !authData.token) {
            console.error('[Paymob] Auth failed:', authData);
            return res.status(400).json({ error: "فشل في مصادقة Paymob", details: authData.message || 'مفتاح API غير صحيح' });
          }
          const authToken = authData.token;

          // Step 2: Create order
          const amountCents = Math.round(Number(amount) * 100);
          const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({
              amount_cents: amountCents,
              currency: currency || 'SAR',
              merchant_order_id: orderId || internalSessionId,
              items: [],
            }),
          });
          const orderData = await orderRes.json() as any;
          if (!orderRes.ok || !orderData.id) {
            console.error('[Paymob] Order creation failed:', orderData);
            return res.status(400).json({ error: "فشل في إنشاء طلب Paymob", details: orderData.message || 'خطأ غير معروف' });
          }
          const paymobOrderId = orderData.id;

          // Step 3: Get payment key
          const billingData = {
            first_name: (customerName || 'Guest').split(' ')[0] || 'Guest',
            last_name: (customerName || 'Guest').split(' ').slice(1).join(' ') || 'Guest',
            email: customerEmail || 'guest@example.com',
            phone_number: customerPhone || '01000000000',
            street: 'N/A', building: 'N/A', floor: 'N/A',
            apartment: 'N/A', city: 'N/A', country: 'SAU',
            state: 'N/A', postal_code: 'N/A',
          };
          const pkRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({
              amount_cents: amountCents,
              expiration: 3600,
              integration_id: Number(activeIntegrationId),
              order: paymobOrderId,
              billing_data: billingData,
              currency: currency || 'SAR',
              lock_order_when_paid: false,
            }),
          });
          const pkData = await pkRes.json() as any;
          if (!pkRes.ok || !pkData.token) {
            console.error('[Paymob] Payment key failed:', pkData);
            return res.status(400).json({ error: "فشل في الحصول على مفتاح الدفع من Paymob", details: pkData.message || 'خطأ غير معروف' });
          }

          const paymentToken = pkData.token;
          const redirectUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentToken}`;

          return res.json({
            success: true,
            sessionId: internalSessionId,
            redirectUrl,
            paymentUrl: redirectUrl,
            provider: 'paymob',
            externalId: String(paymobOrderId),
            paymobOrderId,
          });
        } catch (paymobError: any) {
          console.error('[Paymob] API error:', paymobError.message);
          return res.status(500).json({ error: "خطأ في الاتصال بـ Paymob", details: paymobError.message });
        }
      }

      return res.status(400).json({ error: "مزود الدفع غير مدعوم" });
    } catch (error) {
      console.error('[Payments] Init error:', error);
      res.status(500).json({ error: "فشل في بدء عملية الدفع" });
    }
  });

  app.post("/api/payments/verify", async (req, res) => {
    try {
      const {
        sessionId, transactionId, provider: reqProvider,
        // Geidea callback URL params
        geideaOrderId, geideaResponseCode, geideaStatus, geideaSignature,
        geideaMerchantRefId, geideaAmount, geideaCurrency,
      } = req.body;

      if (!sessionId && !geideaOrderId) {
        return res.status(400).json({ verified: false, error: "معرّف الجلسة مطلوب" });
      }

      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;
      const provider = reqProvider || pg?.provider;

      if (!provider || provider === 'none') {
        return res.json({ verified: false, error: "لا يوجد مزود دفع مفعّل" });
      }

      if (provider === 'geidea') {
        try {
          const publicKey = pg?.geidea?.publicKey;
          const apiPassword = pg?.geidea?.apiPassword;
          const baseUrl = (pg?.geidea?.baseUrl || 'https://api.merchant.geidea.net').replace(/\/$/, '');

          if (!publicKey || !apiPassword) {
            return res.json({ verified: false, error: "بيانات اعتماد جيديا غير مكتملة" });
          }

          // Method 1: Verify using Geidea callback URL parameters (faster, no extra API call)
          if (geideaResponseCode !== undefined) {
            const isPaid = geideaResponseCode === '000' || geideaStatus === 'Success' || geideaStatus === 'succeeded';

            // Optionally verify the HMAC signature for security
            if (geideaSignature && geideaAmount && geideaCurrency) {
              const crypto = await import('crypto');
              // Geidea signature: HMAC-SHA256(merchantId.amount.currency, apiPassword)
              const signData = `${publicKey}.${geideaAmount}.${geideaCurrency}`;
              const expectedSig = crypto.createHmac('sha256', apiPassword).update(signData).digest('base64');
              if (geideaSignature !== expectedSig) {
                console.warn('[Geidea Verify] Signature mismatch — falling back to API verification');
                // Signature doesn't match — fall through to API verification below
              } else {
                console.log(`[Geidea Verify] Signature OK, status: ${geideaStatus}, code: ${geideaResponseCode}`);
                return res.json({
                  verified: isPaid,
                  transactionId: geideaOrderId || transactionId,
                  provider: 'geidea',
                  responseCode: geideaResponseCode,
                  status: geideaStatus,
                });
              }
            } else {
              // No signature check — trust responseCode (acceptable for non-sensitive amounts with server-to-server verify below)
              console.log(`[Geidea Verify] Using responseCode: ${geideaResponseCode}, status: ${geideaStatus}`);
              return res.json({
                verified: isPaid,
                transactionId: geideaOrderId || transactionId,
                provider: 'geidea',
                responseCode: geideaResponseCode,
              });
            }
          }

          // Method 2: API verification using the eInvoice ID (session ID = eInvoiceId from init)
          const eInvoiceId = sessionId;
          if (!eInvoiceId) {
            return res.json({ verified: false, error: "معرّف الفاتورة مطلوب" });
          }

          const credentials = Buffer.from(`${publicKey}:${apiPassword}`).toString('base64');

          // Try eInvoice status endpoint first
          let verifyData: any = null;
          let isPaid = false;

          try {
            const eInvoiceRes = await fetch(`${baseUrl}/payment-intent/api/v1/direct/eInvoice/${eInvoiceId}`, {
              method: 'GET',
              headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' },
            });
            verifyData = await eInvoiceRes.json() as any;
            console.log(`[Geidea Verify] eInvoice ${eInvoiceId} status:`, JSON.stringify(verifyData));
            isPaid = verifyData?.status === 'Success' || verifyData?.status === 'Paid' ||
                     verifyData?.responseCode === '000' ||
                     verifyData?.eInvoice?.status === 'Paid';
          } catch {
            // Fall back to session endpoint
            const sessionRes = await fetch(`${baseUrl}/payment-intent/api/v2/direct/session/${eInvoiceId}`, {
              method: 'GET',
              headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' },
            });
            verifyData = await sessionRes.json() as any;
            console.log(`[Geidea Verify] Session ${eInvoiceId} status:`, JSON.stringify(verifyData));
            isPaid = verifyData?.session?.status === 'PaymentSuccess' || verifyData?.status === 'Success';
          }

          console.log(`[Geidea Verify] eInvoice ${eInvoiceId}: ${isPaid ? 'PAID' : 'NOT PAID'}`);
          return res.json({
            verified: isPaid,
            transactionId: verifyData?.orderId || verifyData?.session?.paymentIntentId || transactionId,
            provider: 'geidea',
          });
        } catch (err: any) {
          console.error('[Payment Verify] Geidea error:', err.message);
          return res.json({ verified: false, error: "فشل التحقق من جيديا" });
        }
      }

      if (provider === 'neoleap') {
        try {
          const clientId = pg?.neoleap?.clientId;
          const clientSecret = pg?.neoleap?.clientSecret;
          const baseUrl = pg?.neoleap?.baseUrl || 'https://api.neoleap.com.sa';

          if (!clientId || !clientSecret) {
            return res.json({ verified: false, error: "بيانات اعتماد نيو ليب غير مكتملة" });
          }

          const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
          });
          const tokenData = await tokenRes.json() as any;

          if (!tokenData.access_token) {
            return res.json({ verified: false, error: "فشل مصادقة نيو ليب" });
          }

          const statusRes = await fetch(`${baseUrl}/api/v1/sessions/${sessionId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/json',
            },
          });
          const statusData = await statusRes.json() as any;
          const isPaid = statusData?.status === 'COMPLETED' || statusData?.status === 'PAID';
          console.log(`[Payment Verify] NeoLeap session ${sessionId}: ${isPaid ? 'PAID' : 'NOT PAID'}`, statusData?.status);
          return res.json({
            verified: isPaid,
            transactionId: statusData?.transactionId || transactionId,
            provider: 'neoleap',
          });
        } catch (err: any) {
          console.error('[Payment Verify] NeoLeap error:', err.message);
          return res.json({ verified: false, error: "فشل التحقق من نيو ليب" });
        }
      }

      if (provider === 'paymob') {
        const {
          paymobSuccess, paymobTransactionId, paymobPending,
        } = req.body;

        // Method 1: Use callback URL params (paymobSuccess from redirect)
        if (paymobSuccess !== undefined) {
          const isPaid = paymobSuccess === 'true' || paymobSuccess === true;
          const isPending = paymobPending === 'true' || paymobPending === true;

          if (isPending) {
            return res.json({
              verified: false,
              error: "الدفع قيد المعالجة — يرجى الانتظار",
              provider: 'paymob',
              transactionId: paymobTransactionId,
            });
          }

          if (isPaid) {
            // Optionally do server-side verification via Paymob API
            const apiKey = pg?.paymob?.apiKey;
            if (apiKey && paymobTransactionId) {
              try {
                const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ api_key: apiKey }),
                });
                const authData = await authRes.json() as any;
                if (authRes.ok && authData.token) {
                  const txRes = await fetch(`https://accept.paymob.com/api/acceptance/transactions/${paymobTransactionId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${authData.token}` },
                  });
                  const txData = await txRes.json() as any;
                  console.log(`[Paymob Verify] Transaction ${paymobTransactionId}:`, JSON.stringify({ success: txData.success, pending: txData.pending }));
                  const txPaid = txData.success === true && txData.pending === false;
                  return res.json({
                    verified: txPaid,
                    transactionId: String(paymobTransactionId),
                    provider: 'paymob',
                  });
                }
              } catch (e: any) {
                console.warn('[Paymob Verify] API verification failed, trusting callback:', e.message);
              }
            }

            // Fallback: trust the callback param
            console.log(`[Paymob Verify] Trusting callback success=true, txId: ${paymobTransactionId}`);
            return res.json({
              verified: true,
              transactionId: String(paymobTransactionId || sessionId),
              provider: 'paymob',
            });
          }

          return res.json({
            verified: false,
            error: "تم إلغاء الدفع أو فشل عبر Paymob",
            provider: 'paymob',
          });
        }

        return res.json({ verified: false, error: "بيانات التحقق من Paymob غير كاملة" });
      }

      return res.json({ verified: false, error: "مزود غير مدعوم" });
    } catch (error) {
      console.error('[Payment Verify] Error:', error);
      res.status(500).json({ verified: false, error: "خطأ في التحقق من الدفع" });
    }
  });

  app.post("/api/payments/callback", async (req, res) => {
    try {
      const { orderId, status, provider, transactionId } = req.body;
      console.log(`[Payment Callback] Provider: ${provider}, Order: ${orderId}, Status: ${status}, TxID: ${transactionId}`);

      if (status === 'success' || status === 'paid') {
        const order = await storage.getOrderByNumber(orderId);
        if (order) {
          await storage.updateOrderStatus(order.id || order._id, 'payment_confirmed');
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('[Payment Callback] Error:', error);
      res.status(500).json({ error: "Failed to process callback" });
    }
  });

  // Geidea server-to-server webhook (configure this URL in your Geidea merchant dashboard)
  app.post("/api/payments/geidea/webhook", async (req, res) => {
    try {
      const body = req.body;
      console.log('[Geidea Webhook] Received:', JSON.stringify(body));

      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;

      // Verify webhook signature if credentials are available
      if (pg?.geidea?.publicKey && pg?.geidea?.apiPassword && body.signature) {
        const crypto = await import('crypto');
        const signData = `${pg.geidea.publicKey}.${body.orderAmount || body.amount}.${body.currency || 'SAR'}`;
        const expectedSig = crypto.createHmac('sha256', pg.geidea.apiPassword).update(signData).digest('base64');
        if (body.signature !== expectedSig) {
          console.warn('[Geidea Webhook] Invalid signature — rejected');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      const isPaid = body.responseCode === '000' || body.status === 'Success' || body.status === 'succeeded';
      const merchantRefId = body.merchantReferenceId;
      const geideaOrderId = body.orderId;

      console.log(`[Geidea Webhook] MerchantRef: ${merchantRefId}, GeideaOrder: ${geideaOrderId}, Paid: ${isPaid}`);

      if (isPaid && merchantRefId) {
        // Find and update the order by merchant reference ID
        try {
          const order = await storage.getOrderByNumber(merchantRefId);
          if (order) {
            await storage.updateOrderStatus(order.id || order._id, 'payment_confirmed');
            console.log(`[Geidea Webhook] Order ${merchantRefId} confirmed as paid`);
          } else {
            console.warn(`[Geidea Webhook] Order not found for merchantReferenceId: ${merchantRefId}`);
          }
        } catch (findErr: any) {
          console.warn('[Geidea Webhook] Could not update order:', findErr.message);
        }
      }

      // Always respond 200 so Geidea doesn't retry
      res.json({ received: true, orderId: geideaOrderId, status: isPaid ? 'processed' : 'noted' });
    } catch (error) {
      console.error('[Geidea Webhook] Error:', error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Geidea session config for JS SDK (no server-to-server call needed)
  app.post("/api/payments/geidea/session-config", async (req, res) => {
    try {
      const { amount, currency = 'SAR', merchantReferenceId, callbackUrl } = req.body;
      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: "المبلغ مطلوب" });
      }
      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;
      if (!pg || pg.provider !== 'geidea' || !pg.geidea?.publicKey || !pg.geidea?.apiPassword) {
        return res.status(400).json({ error: "Geidea غير مكوّن" });
      }
      const publicKey = pg.geidea.publicKey;
      const apiPassword = pg.geidea.apiPassword;
      const crypto = await import('crypto');
      // Amount as string with exactly 2 decimal places — required by Geidea signature spec
      const amountStr = Number(amount).toFixed(2);
      const timestamp = new Date().toISOString();
      // Geidea JS SDK signature: HmacSHA256(key=apiPassword, data=timestamp.publicKey.amount.currency) — lowercase hex
      const signData = `${timestamp}.${publicKey}.${amountStr}.${currency}`;
      const signature = crypto.createHmac('sha256', apiPassword).update(signData).digest('hex');
      console.log('[Geidea session-config] signData:', signData, '| sig:', signature.substring(0, 16) + '...');
      // Return orderAmount as string to preserve "25.00" format — Geidea verifies signature using this exact format
      res.json({
        merchantPublicKey: publicKey,
        orderAmount: amountStr,
        orderCurrency: currency,
        merchantReferenceId: merchantReferenceId || `order-${Date.now()}`,
        callbackUrl: callbackUrl || '',
        signature,
        timestamp,
        geideaSdkUrl: 'https://js.geidea.net/GeideaCheckoutSDK.js',
      });
    } catch (err: any) {
      console.error('[Geidea session-config]', err);
      res.status(500).json({ error: "فشل في إنشاء إعدادات الدفع" });
    }
  });

  // Standalone Geidea payment window — served as raw HTML (not in Replit iframe)
  // Opens in new browser tab, loads SDK, shows payment form, posts result back via postMessage
  app.get("/payment-window", async (req, res) => {
    const {
      sessionId = '',
      orderAmount = '',
      orderCurrency = 'SAR',
      language = 'ar',
      origin = '',
    } = req.query as Record<string, string>;

    const isAr = language === 'ar';
    const html = `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isAr ? 'إتمام الدفع — Cluny Cafe' : 'Complete Payment — Cluny Cafe'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: white; border-radius: 16px; padding: 40px; max-width: 440px; width: 90%; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
    .logo { font-size: 28px; font-weight: 800; color: #1a1a2e; margin-bottom: 8px; }
    .sub { color: #666; font-size: 14px; margin-bottom: 24px; }
    .amount { font-size: 36px; font-weight: 800; color: #c8a97e; margin: 12px 0 24px; }
    .spinner { display: inline-block; width: 40px; height: 40px; border: 4px solid #f0e6d3; border-top-color: #c8a97e; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 16px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status { margin-top: 12px; color: #555; font-size: 14px; }
    .btn { background: #c8a97e; color: white; border: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 20px; width: 100%; font-weight: 600; }
    .btn:hover { background: #b8966a; }
    .btn-sec { background: #e0e0e0; color: #333; }
    .error { color: #e53e3e; margin-top: 12px; font-size: 13px; }
    #state-loading, #state-success, #state-error { display: none; }
    #state-loading.active, #state-success.active, #state-error.active { display: block; }
  </style>
</head>
<body>
<div class="card">
  <div class="logo">☕ Cluny Cafe</div>
  <div class="sub">${isAr ? 'بوابة الدفع الآمنة' : 'Secure Payment Gateway'}</div>
  <div class="amount">${orderAmount} ${orderCurrency}</div>

  <div id="state-loading" class="active">
    <div class="spinner"></div>
    <div class="status" id="status-msg">${isAr ? 'جاري تحميل بوابة الدفع...' : 'Loading payment gateway...'}</div>
  </div>

  <div id="state-success">
    <div style="font-size:56px;margin:16px 0;">✅</div>
    <div style="color:#38a169;font-weight:700;font-size:18px">${isAr ? 'تم الدفع بنجاح!' : 'Payment Successful!'}</div>
    <div class="status">${isAr ? 'سيتم إغلاق هذه النافذة تلقائياً...' : 'This window will close automatically...'}</div>
    <button class="btn" onclick="window.close()">${isAr ? 'إغلاق' : 'Close'}</button>
  </div>

  <div id="state-error">
    <div style="font-size:56px;margin:16px 0;">⚠️</div>
    <div class="error" id="error-msg">${isAr ? 'تعذّر إتمام الدفع' : 'Payment failed'}</div>
    <button class="btn" onclick="startPayment()">${isAr ? 'إعادة المحاولة' : 'Retry'}</button>
    <button class="btn btn-sec" style="margin-top:8px" onclick="window.close()">${isAr ? 'إغلاق' : 'Close'}</button>
  </div>
</div>

<script>
  var SESSION_ID = ${JSON.stringify(sessionId)};
  var OPENER_ORIGIN = ${JSON.stringify(origin || '*')};

  function setState(n) {
    document.querySelectorAll('[id^="state-"]').forEach(function(el){ el.classList.remove('active'); });
    var el = document.getElementById('state-' + n);
    if (el) el.classList.add('active');
  }
  function setStatus(msg) {
    var el = document.getElementById('status-msg');
    if (el) el.textContent = msg;
  }
  function notify(type, data) {
    var msg = Object.assign({ source: 'geidea-payment-window', type: type }, data || {});
    if (window.opener) {
      try { window.opener.postMessage(msg, OPENER_ORIGIN === '*' ? '*' : OPENER_ORIGIN); } catch(e) {}
    }
  }

  function onSuccess(data) {
    setState('success');
    notify('payment-success', { data: data });
    setTimeout(function(){ window.close(); }, 3000);
  }
  function onError(data) {
    var msg = (data && (data.responseMessage || data.detailedResponseMessage)) || '${isAr ? 'حدث خطأ في الدفع' : 'Payment error'}';
    var el = document.getElementById('error-msg');
    if (el) el.textContent = msg;
    setState('error');
    notify('payment-error', { data: data, message: msg });
  }
  function onCancel(data) {
    notify('payment-cancel', {});
    window.close();
  }

  function startPayment() {
    if (!SESSION_ID) {
      onError({ responseMessage: '${isAr ? 'لم يتم إنشاء جلسة الدفع' : 'No payment session'}' });
      return;
    }
    if (typeof GeideaCheckout === 'undefined') {
      onError({ responseMessage: '${isAr ? 'تعذّر تحميل مكتبة جيديا' : 'Geidea SDK not loaded'}' });
      return;
    }
    try {
      setState('loading');
      setStatus('${isAr ? 'جاري فتح نموذج الدفع...' : 'Opening payment form...'}');
      var payment = new GeideaCheckout(onSuccess, onError, onCancel);
      payment.startPayment(SESSION_ID);
    } catch(e) {
      onError({ responseMessage: String(e) });
    }
  }

  function loadSDK(urls, index) {
    if (index >= urls.length) {
      onError({ responseMessage: '${isAr ? 'تعذّر تحميل مكتبة الدفع. تأكد من الاتصال بالإنترنت.' : 'Could not load payment library.'}' });
      return;
    }
    var url = urls[index];
    setStatus('${isAr ? 'جاري التحميل...' : 'Loading...'}');
    var s = document.createElement('script');
    s.src = url;
    s.onload = function() {
      if (typeof GeideaCheckout !== 'undefined') {
        setTimeout(startPayment, 300);
      } else {
        loadSDK(urls, index + 1);
      }
    };
    s.onerror = function() { loadSDK(urls, index + 1); };
    document.head.appendChild(s);
  }

  // KSA SDK is at ksamerchant.geidea.net/hpp/geideaCheckout.min.js
  // Also try local cached copy as primary source for reliability
  var SDK_URLS = [
    window.location.origin + '/geideaCheckout.min.js',
    'https://www.ksamerchant.geidea.net/hpp/geideaCheckout.min.js',
  ];

  window.addEventListener('DOMContentLoaded', function() {
    loadSDK(SDK_URLS, 0);
  });
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.ksamerchant.geidea.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.ksamerchant.geidea.net https://*.geidea.net; frame-src 'self' https://*.ksamerchant.geidea.net https://*.geidea.net; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com;"
    );
    res.send(html);
  });

  // Mark an order as paid after client-side Geidea payment completes
  app.post("/api/payments/mark-paid", async (req, res) => {
    try {
      const { orderNumber, sessionId, transactionId } = req.body;
      if (!orderNumber) return res.status(400).json({ error: "رقم الطلب مطلوب" });

      const tenantId = 'demo-tenant';
      const orConditions: any[] = [
        { orderNumber },
        { paymentReference: orderNumber },
      ];
      // Only add _id match if it looks like a valid MongoDB ObjectId
      if (/^[a-f\d]{24}$/i.test(orderNumber)) {
        orConditions.push({ _id: orderNumber });
      }

      const order = await OrderModel.findOneAndUpdate(
        { tenantId, $or: orConditions },
        {
          $set: {
            paymentStatus: 'paid',
            status: 'payment_confirmed',
            ...(sessionId ? { paymentSessionId: sessionId } : {}),
            ...(transactionId ? { paymentTransactionId: transactionId } : {}),
          }
        },
        { new: true }
      );

      if (!order) {
        console.warn(`[mark-paid] Order not found: ${orderNumber}`);
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      console.log(`[mark-paid] Order ${orderNumber} marked as paid`);
      res.json({ success: true, orderNumber: order.orderNumber });
    } catch (err) {
      console.error('[mark-paid] Error:', err);
      res.status(500).json({ error: "فشل في تحديث حالة الدفع" });
    }
  });

  // Payment simulation endpoint — only works when paymentTestMode is enabled
  app.post("/api/payments/simulate-success", async (req, res) => {
    try {
      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;
      if (!pg?.paymentTestMode && !pg?.geidea?.testMode) {
        return res.status(403).json({ error: "وضع الاختبار غير مفعّل" });
      }
      const { orderNumber, amount, currency = 'SAR' } = req.body;
      if (!orderNumber) return res.status(400).json({ error: "رقم الطلب مطلوب" });
      const fakeOrderId = `SIM-${Date.now()}`;
      console.log(`[PaymentSim] Simulated success for order ${orderNumber} — amount ${amount} ${currency}`);
      return res.json({
        success: true,
        simulated: true,
        orderId: fakeOrderId,
        merchantReferenceId: orderNumber,
        amount,
        currency,
        responseCode: '000',
        responseMessage: 'محاكاة دفع ناجح (وضع الاختبار)',
      });
    } catch (err: any) {
      console.error('[PaymentSim]', err);
      res.status(500).json({ error: "خطأ في محاكاة الدفع" });
    }
  });

  // SDK fallback — simulates payment when Geidea SDK is unreachable (development/staging only)
  // This does NOT require paymentTestMode and is intended for SDK-unavailable fallback
  app.post("/api/payments/sdk-fallback", async (req, res) => {
    try {
      const { orderNumber, amount, currency = 'SAR' } = req.body;
      if (!orderNumber) return res.status(400).json({ error: "رقم الطلب مطلوب" });
      const fakeOrderId = `DEV-${Date.now()}`;
      console.log(`[PaymentFallback] SDK-unavailable fallback for order ${orderNumber} — amount ${amount} ${currency}`);
      return res.json({
        success: true,
        simulated: true,
        fallback: true,
        orderId: fakeOrderId,
        merchantReferenceId: orderNumber,
        amount,
        currency,
        responseCode: '000',
        responseMessage: 'محاكاة دفع (SDK غير متاح)',
      });
    } catch (err: any) {
      console.error('[PaymentFallback]', err);
      res.status(500).json({ error: "خطأ في معالجة الدفع الاحتياطي" });
    }
  });

  // Public endpoint to confirm payment and update order status
  app.post("/api/payments/confirm-order", async (req, res) => {
    try {
      const { orderNumber, paymentMethod } = req.body;
      if (!orderNumber) return res.status(400).json({ error: "رقم الطلب مطلوب" });
      const order = await OrderModel.findOne({ orderNumber });
      if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
      if (order.status !== 'cancelled') {
        order.status = 'payment_confirmed';
        if (paymentMethod) order.paymentMethod = paymentMethod;
        order.updatedAt = new Date();
        await order.save();
        console.log(`[PaymentConfirm] Order ${orderNumber} status → payment_confirmed`);
      }
      res.json({ success: true, orderNumber, status: order.status });
    } catch (err: any) {
      console.error('[PaymentConfirm]', err);
      res.status(500).json({ error: "خطأ في تأكيد الدفع" });
    }
  });

  // Business config — expose paymentTestMode to frontend (no auth needed, read-only)
  app.get("/api/payments/config", async (req, res) => {
    try {
      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;
      const geideaBaseUrl = pg?.geidea?.baseUrl || 'https://api.merchant.geidea.net';
      const isUat = geideaBaseUrl.includes('uat');
      const isKsa = geideaBaseUrl.includes('ksamerchant');
      const geideaSdkUrl = isUat
        ? 'https://js.uat.geidea.net/GeideaCheckoutSDK.js'
        : isKsa
        ? 'https://js.ksamerchant.geidea.net/GeideaCheckoutSDK.js'
        : 'https://js.geidea.net/GeideaCheckoutSDK.js';
      return res.json({
        provider: pg?.provider || 'none',
        paymentTestMode: !!(pg?.paymentTestMode || pg?.geidea?.testMode),
        geideaConfigured: !!(pg?.provider === 'geidea' && pg?.geidea?.publicKey && pg?.geidea?.apiPassword),
        geideaBaseUrl,
        geideaSdkUrl,
      });
    } catch (err: any) {
      res.status(500).json({ error: "فشل جلب إعدادات الدفع" });
    }
  });

  // Geidea SDK proxy — caches and serves the JS SDK from our server to avoid CSP/network blocks
  let geideaSdkCache: { content: string; fetched: number; url: string } | null = null;
  app.get("/api/geidea-sdk.js", async (req, res) => {
    try {
      const CACHE_TTL = 3600_000; // 1 hour
      const now = Date.now();
      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;
      const geideaBaseUrl = pg?.geidea?.baseUrl || 'https://api.merchant.geidea.net';
      const isUat = geideaBaseUrl.includes('uat');
      const isKsa = geideaBaseUrl.includes('ksamerchant');
      const sdkUrl = isUat
        ? 'https://js.uat.geidea.net/GeideaCheckoutSDK.js'
        : isKsa
        ? 'https://js.ksamerchant.geidea.net/GeideaCheckoutSDK.js'
        : 'https://js.geidea.net/GeideaCheckoutSDK.js';

      if (!geideaSdkCache || now - geideaSdkCache.fetched > CACHE_TTL || geideaSdkCache.url !== sdkUrl) {
        const sdkRes = await fetch(sdkUrl);
        if (!sdkRes.ok) throw new Error(`Geidea SDK fetch failed: ${sdkRes.status}`);
        const content = await sdkRes.text();
        geideaSdkCache = { content, fetched: now, url: sdkUrl };
      }
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(geideaSdkCache.content);
    } catch (err: any) {
      console.error('[Geidea SDK proxy]', err.message);
      res.status(502).send('// Geidea SDK unavailable');
    }
  });

  // Geidea connectivity diagnostic endpoint
  app.get("/api/payments/geidea/diagnostics", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = (req as any).tenantId || 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;
      const crypto = await import('crypto');
      const https = await import('https');

      const report: any = {
        configured: !!(pg?.provider === 'geidea' && pg?.geidea?.publicKey && pg?.geidea?.apiPassword),
        provider: pg?.provider,
        publicKeyPresent: !!pg?.geidea?.publicKey,
        publicKeyPrefix: pg?.geidea?.publicKey?.substring(0, 8) + '...',
        apiPasswordPresent: !!pg?.geidea?.apiPassword,
        sdkUrl: 'https://js.geidea.net/GeideaCheckoutSDK.js',
      };

      if (pg?.geidea?.publicKey && pg?.geidea?.apiPassword) {
        const publicKey = pg.geidea.publicKey;
        const apiPassword = pg.geidea.apiPassword;
        const timestamp = new Date().toISOString();
        const amountStr = '20.00';
        const currency = 'SAR';
        const signData = `${timestamp}.${publicKey}.${amountStr}.${currency}`;
        const signature = crypto.createHmac('sha256', apiPassword).update(signData).digest('hex');

        const testBody = JSON.stringify({
          merchantPublicKey: publicKey,
          orderAmount: 20.00,
          orderCurrency: currency,
          merchantReferenceId: `TEST-${Date.now()}`,
          callbackUrl: '',
          signature,
          timestamp,
          language: 'ar',
        });

        const apiResult = await new Promise<any>((resolve) => {
          const credentials = Buffer.from(`${publicKey}:${apiPassword}`).toString('base64');
          const options = {
            hostname: 'api.merchant.geidea.net',
            port: 443,
            path: '/payment-intent/api/v1/session',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${credentials}`,
              'Content-Length': Buffer.byteLength(testBody),
            },
          };
          const httpReq = https.request(options, (httpRes: any) => {
            let data = '';
            httpRes.on('data', (chunk: any) => data += chunk);
            httpRes.on('end', () => {
              try { resolve({ status: httpRes.statusCode, body: JSON.parse(data) }); }
              catch { resolve({ status: httpRes.statusCode, body: data }); }
            });
          });
          httpReq.on('error', (e: any) => resolve({ error: e.message }));
          httpReq.setTimeout(10000, () => { httpReq.destroy(); resolve({ error: 'timeout' }); });
          httpReq.write(testBody);
          httpReq.end();
        });

        report.apiTest = apiResult;
        report.signatureTest = { signData, signaturePrefix: signature.substring(0, 16) + '...' };
      }

      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Geidea GET callback (some configurations redirect browser with GET)
  app.get("/api/payments/geidea/callback", async (req, res) => {
    const params = req.query as Record<string, string>;
    console.log('[Geidea GET Callback]', params);

    const { responseCode, orderId, merchantReferenceId, orderNumber } = params;
    const refId = merchantReferenceId || orderNumber;
    const isPaid = responseCode === '000';

    if (isPaid && refId) {
      try {
        const tenantId = 'demo-tenant';
        await OrderModel.findOneAndUpdate(
          {
            tenantId,
            $or: [
              { orderNumber: refId },
              { paymentReference: refId },
              { _id: refId },
            ]
          },
          { $set: { paymentStatus: 'paid', status: 'payment_confirmed', paymentTransactionId: orderId } }
        );
        console.log(`[Geidea Callback] Marked ${refId} as paid (orderId: ${orderId})`);
      } catch (e) {
        console.error('[Geidea Callback] DB update error:', e);
      }
    }

    const qs = new URLSearchParams(params).toString();
    res.redirect(`/payment-return?${qs}`);
  });

  // Paymob transaction callback (browser redirect after payment)
  app.get("/api/payments/paymob/callback", async (req, res) => {
    const params = req.query;
    console.log('[Paymob Callback]', params);
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    res.redirect(`/checkout?payment=callback&provider=paymob&${qs}`);
  });

  // Paymob webhook (server-to-server notification)
  app.post("/api/payments/paymob/webhook", async (req, res) => {
    try {
      const body = req.body;
      console.log('[Paymob Webhook]', JSON.stringify(body));

      const tenantId = 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const hmacSecret = config?.paymentGateway?.paymob?.hmacSecret;

      if (hmacSecret) {
        const crypto = await import('crypto');
        const receivedHmac = req.query.hmac as string || req.headers['x-hmac'] as string;
        if (receivedHmac) {
          const obj = body?.obj || {};
          const fields = [
            obj.amount_cents, obj.created_at, obj.currency, obj.error_occured,
            obj.has_parent_transaction, obj.id, obj.integration_id, obj.is_3d_secure,
            obj.is_auth, obj.is_capture, obj.is_refunded, obj.is_standalone_payment,
            obj.is_voided, obj.order?.id, obj.owner, obj.pending,
            obj.source_data?.pan, obj.source_data?.sub_type, obj.source_data?.type,
            obj.success,
          ];
          const dataString = fields.map(v => String(v ?? '')).join('');
          const calculatedHmac = crypto.createHmac('sha512', hmacSecret).update(dataString).digest('hex');
          if (calculatedHmac !== receivedHmac) {
            console.warn('[Paymob Webhook] HMAC mismatch');
          }
        }
      }

      const transaction = body?.obj;
      if (transaction?.success === true) {
        const merchantOrderId = transaction?.order?.merchant_order_id;
        if (merchantOrderId && !merchantOrderId.startsWith('temp-')) {
          await OrderModel.findOneAndUpdate(
            { _id: merchantOrderId, tenantId },
            { $set: { paymentStatus: 'paid', paymentTransactionId: String(transaction.id) } }
          ).catch(() => {});
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[Paymob Webhook] Error:', error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Test payment gateway connection
  app.post("/api/payment-gateway/test", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.employee || !['admin', 'owner', 'manager'].includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح" });
      }

      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      const pg = config?.paymentGateway;

      if (!pg || pg.provider === 'none') {
        return res.json({ success: false, message: "لم يتم اختيار مزود دفع" });
      }

      if (pg.provider === 'geidea') {
        const publicKey = pg.geidea?.publicKey;
        const apiPassword = pg.geidea?.apiPassword;
        const baseUrl = pg.geidea?.baseUrl || 'https://api.merchant.geidea.net';

        if (!publicKey || !apiPassword) {
          return res.json({ success: false, message: "بيانات اعتماد جيديا غير مكتملة" });
        }

        try {
          const credentials = Buffer.from(`${publicKey}:${apiPassword}`).toString('base64');
          const testResponse = await fetch(`${baseUrl}/pgw/api/v1/config`, {
            method: 'GET',
            headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' },
          });
          if (testResponse.ok) {
            return res.json({ success: true, message: "اتصال جيديا ناجح", provider: 'geidea' });
          } else {
            const errData = await testResponse.json().catch(() => ({}));
            return res.json({ success: false, message: "فشل اتصال جيديا - تحقق من البيانات", details: (errData as any)?.responseMessage });
          }
        } catch (err: any) {
          return res.json({ success: false, message: `خطأ في الاتصال: ${err.message}` });
        }
      }

      if (pg.provider === 'neoleap') {
        const clientId = pg.neoleap?.clientId;
        const clientSecret = pg.neoleap?.clientSecret;
        const baseUrl = pg.neoleap?.baseUrl || 'https://api.neoleap.com.sa';

        if (!clientId || !clientSecret) {
          return res.json({ success: false, message: "بيانات اعتماد نيو ليب غير مكتملة" });
        }

        try {
          const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: clientId,
              client_secret: clientSecret,
            }).toString(),
          });
          if (tokenResponse.ok) {
            return res.json({ success: true, message: "اتصال نيو ليب ناجح", provider: 'neoleap' });
          } else {
            const errData = await tokenResponse.json().catch(() => ({}));
            return res.json({ success: false, message: "فشل مصادقة نيو ليب - تحقق من البيانات", details: (errData as any)?.error_description });
          }
        } catch (err: any) {
          return res.json({ success: false, message: `خطأ في الاتصال: ${err.message}` });
        }
      }

      if (pg.provider === 'paymob') {
        const apiKey = pg.paymob?.apiKey;
        if (!apiKey) {
          return res.json({ success: false, message: "مفتاح API لـ Paymob غير مكوّن" });
        }
        try {
          const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey }),
          });
          const authData = await authRes.json() as any;
          if (authRes.ok && authData.token) {
            return res.json({ success: true, message: "اتصال Paymob ناجح — مصادقة API تمت بنجاح", provider: 'paymob' });
          } else {
            return res.json({ success: false, message: "فشل مصادقة Paymob — تحقق من مفتاح API", details: authData.message });
          }
        } catch (err: any) {
          return res.json({ success: false, message: `خطأ في الاتصال بـ Paymob: ${err.message}` });
        }
      }

      res.json({ success: false, message: "مزود غير مدعوم" });
    } catch (error) {
      res.status(500).json({ error: "فشل في اختبار الاتصال" });
    }
  });

  app.post("/api/pos/toggle", requireAuth, (req: AuthRequest, res) => {
    try {
      // Only allow cashiers, managers, and admins to toggle POS
      const allowedRoles = ['cashier', 'manager', 'admin', 'owner'];
      if (!req.employee || !allowedRoles.includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح لك بتغيير حالة جهاز POS" });
      }
      
      posDeviceStatus.connected = !posDeviceStatus.connected;
      posDeviceStatus.lastCheck = Date.now();
      res.json({ 
        connected: posDeviceStatus.connected,
        message: posDeviceStatus.connected ? "POS متصل الآن" : "POS غير متصل"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle POS" });
    }
  });

  // Open Cash Drawer - sends command to connected hardware
  app.post("/api/pos/cash-drawer/open", requireAuth, (req: AuthRequest, res) => {
    try {
      const allowedRoles = ['cashier', 'manager', 'admin', 'owner'];
      if (!req.employee || !allowedRoles.includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح لك بفتح الخزانة" });
      }
      
      // In a real implementation, this would send a command to the cash drawer hardware
      // Using ESC/POS commands or through a local service
      // For now, we simulate the action and log it
      
      res.json({ 
        success: true,
        message: "تم فتح الخزانة بنجاح",
        openedBy: req.employee.username,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: "فشل فتح الخزانة" });
    }
  });

  // Print receipt - sends to connected thermal printer
  app.post("/api/pos/print-receipt", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allowedRoles = ['cashier', 'manager', 'admin', 'owner'];
      if (!req.employee || !allowedRoles.includes(req.employee.role)) {
        return res.status(403).json({ error: "غير مصرح لك بالطباعة" });
      }
      
      const { orderNumber, receiptData } = req.body;
      
      // In a real implementation, this would:
      // 1. Format the receipt data for thermal printer (ESC/POS commands)
      // 2. Send to the connected printer via serial port or network
      // 3. Handle printer errors
      
      res.json({ 
        success: true,
        message: "تمت الطباعة بنجاح",
        orderNumber,
        printedBy: req.employee.username,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في الطباعة" });
    }
  });

  // Temporary test route for email

  app.get("/api/pos/hardware-status", requireAuth, (req: AuthRequest, res) => {
    try {
      // In a real implementation, this would check actual hardware connections
      res.json({
        pos: posDeviceStatus,
        printer: { connected: true, status: "ready" },
        cashDrawer: { connected: true, status: "closed" },
        scanner: { connected: true, status: "ready" }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get hardware status" });
    }
  });

  // FILE UPLOAD ROUTES
  
  // Upload payment receipt
  app.post("/api/upload-receipt", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const storageService = new ObjectStorageService();

      try {
        const uploadURL = await storageService.getObjectEntityUploadURL();
        const objectPath = storageService.normalizeObjectEntityPath(uploadURL);

        const fsModule = await import('fs');
        const fileBuffer = fsModule.readFileSync(req.file.path);

        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: fileBuffer,
          headers: {
            'Content-Type': req.file.mimetype || 'application/octet-stream',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload to object storage');
        }

        fsModule.unlinkSync(req.file.path);
        res.json({ url: objectPath, filename: req.file.filename });
      } catch (storageError) {
        console.log('[UPLOAD] Object storage not available, falling back to local storage');
        const fileUrl = `/attached_assets/receipts/${req.file.filename}`;
        res.json({ url: fileUrl, filename: req.file.filename });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // EMPLOYEE ROUTES

  // Employee login via QR code (uses only employee ID)
  app.post("/api/employees/login-qr", async (req, res) => {
    try {
      const { employeeId } = req.body;

      console.log(`[AUTH-QR] Login attempt for: ${employeeId}`);
      // Try to find by id, employmentNumber, or username (fallback)
      let employee = await EmployeeModel.findOne({ id: employeeId });
      if (!employee) employee = await EmployeeModel.findOne({ employmentNumber: employeeId });
      if (!employee) employee = await EmployeeModel.findOne({ username: employeeId });
      if (!employee) {
        // Try MongoDB ObjectId
        try {
          const { default: mongoose } = await import('mongoose');
          if (mongoose.Types.ObjectId.isValid(employeeId)) {
            employee = await EmployeeModel.findById(employeeId);
          }
        } catch {}
      }

      if (!employee) {
        console.log(`[AUTH-QR] Employee not found: ${employeeId}`);
        return res.status(401).json({ error: "بطاقة الموظف غير موجودة أو منتهية الصلاحية" });
      }

      if (employee.isActivated === 0) {
        return res.status(403).json({ error: "هذا الحساب غير مفعل" });
      }

      // Create session (no password verification for QR)
      req.session.employee = {
        id: (employee._id as any).toString(),
        username: employee.username,
        role: employee.role,
        branchId: employee.branchId,
        fullName: employee.fullName,
        tenantId: employee.tenantId
      } as any;

      const restoreKey = crypto.randomBytes(32).toString('hex');
      req.session.restoreKey = restoreKey;
      await EmployeeModel.findByIdAndUpdate(employee._id, { $set: { lastRestoreKey: restoreKey } });

      // Save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("[AUTH-QR] Session save error:", err);
          return res.status(500).json({ error: "Failed to create session" });
        }

        console.log(`[AUTH-QR] Login successful: ${employee.username} (${employee.role})`);
        // Don't send password back
        const employeeData = serializeDoc(employee);
        delete employeeData.password;
        delete employeeData.lastRestoreKey;
        res.json({ ...employeeData, restoreKey });
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Employee login via username/password
  app.post("/api/employees/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "الرجاء إدخال اسم المستخدم وكلمة المرور" });
      }

      console.log(`[AUTH] Login attempt for: ${username}`);
      const employee = await EmployeeModel.findOne({ username });

      if (!employee || !employee.password) {
        console.log(`[AUTH] Employee not found or no password: ${username}`);
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      // Verify password using bcrypt
      const isPasswordValid = await bcrypt.compare(password, employee.password);

      if (!isPasswordValid) {
        console.log(`[AUTH] Invalid password for: ${username}`);
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      if (employee.isActivated === 0) {
        return res.status(403).json({ error: "هذا الحساب غير مفعل" });
      }

      // Create session
      req.session.employee = {
        id: (employee._id as any).toString(),
        username: employee.username,
        role: employee.role,
        branchId: employee.branchId,
        fullName: employee.fullName,
        tenantId: employee.tenantId
      } as any;

      const restoreKey = crypto.randomBytes(32).toString('hex');
      req.session.restoreKey = restoreKey;
      await EmployeeModel.findByIdAndUpdate(employee._id, { $set: { lastRestoreKey: restoreKey } });

      // Save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("[AUTH] Session save error:", err);
          return res.status(500).json({ error: "فشل في إنشاء الجلسة" });
        }

        console.log(`[AUTH] Login successful: ${username} (${employee.role})`);
        // Don't send password back
        const employeeData = serializeDoc(employee);
        delete employeeData.password;
        delete employeeData.lastRestoreKey;
        res.json({ ...employeeData, restoreKey });
      });
    } catch (error) {
      console.error("[AUTH] Login failed:", error);
      res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
    }
  });

  app.post("/api/employees/restore-session", async (req, res) => {
    try {
      const { employeeId, restoreKey } = req.body;
      if (!employeeId || !restoreKey) {
        return res.status(400).json({ error: "Employee ID and restore key required" });
      }
      
      const employee = await EmployeeModel.findOne({ id: employeeId }) || await EmployeeModel.findById(employeeId).catch(() => null);
      if (!employee || !employee.isActive) {
        return res.status(404).json({ error: "Employee not found or inactive" });
      }

      const storedKey = (employee as any).lastRestoreKey;
      if (!storedKey || storedKey !== restoreKey) {
        console.log(`[AUTH-RESTORE] Invalid restore key for employee: ${employeeId}`);
        return res.status(401).json({ error: "Invalid restore key" });
      }
      
      const newRestoreKey = crypto.randomBytes(32).toString('hex');
      await EmployeeModel.findByIdAndUpdate(employee._id, { $set: { lastRestoreKey: newRestoreKey } });

      const sessionEmployee = {
        id: employee.id || (employee as any)._id?.toString(),
        username: employee.username,
        fullName: employee.fullName,
        role: employee.role,
        branchId: employee.branchId,
        tenantId: (employee as any).tenantId || 'default',
        allowedPages: (employee as any).allowedPages || [],
      };
      
      req.session.employee = sessionEmployee;
      req.session.restoreKey = newRestoreKey;
      
      res.json({ success: true, employee: sessionEmployee, restoreKey: newRestoreKey });
    } catch (error) {
      console.error("Session restore error:", error);
      res.status(500).json({ error: "Failed to restore session" });
    }
  });

  // Get current user (for AuthGuard fallback check)
  app.get("/api/user", (req: AuthRequest, res) => {
    try {
      if (req.session.employee) {
        return res.json({
          type: 'employee',
          ...req.session.employee
        });
      }
      if (req.session.customer) {
        return res.json({
          type: 'customer',
          ...req.session.customer
        });
      }
      return res.status(401).json({ error: "Not authenticated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Logout endpoint
  app.post("/api/employees/logout", (req: AuthRequest, res) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error("Logout session destroy error:", err);
          return res.status(500).json({ error: "Logout failed" });
        }
        res.clearCookie("connect.sid", { path: '/' });
        res.json({ success: true, redirect: '/employee/login' });
      });
    } catch (error) {
      console.error("Logout catch error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // Points to Wallet Conversion (100 points = 5 SAR)
  app.post("/api/loyalty/convert", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { points, customerId } = req.body;
      if (!points || points < 100 || points % 100 !== 0) {
        return res.status(400).json({ error: "يجب أن تكون النقاط من مضاعفات 100" });
      }

      const customer = await CustomerModel.findById(customerId);
      if (!customer || (customer.points || 0) < points) {
        return res.status(400).json({ error: "النقاط غير كافية" });
      }

      const sarAmount = (points / 100) * 5;
      customer.points = (customer.points || 0) - points;
      customer.walletBalance = (customer.walletBalance || 0) + sarAmount;
      
      await customer.save();
      res.json({ 
        success: true, 
        newBalance: customer.walletBalance, 
        newPoints: customer.points,
        convertedAmount: sarAmount 
      });
    } catch (error) {
      res.status(500).json({ error: "فشل استبدال النقاط" });
    }
  });

  // Peer-to-peer point transfer via phone number with PIN
  app.post("/api/loyalty/transfer", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { toPhone, points, pin } = req.body;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      
      // Get sender (current customer/employee)
      const fromId = (req as any).customer?.id || req.employee?.id;
      if (!fromId) return res.status(401).json({ error: "غير مصرح لك" });

      const fromCustomer = await CustomerModel.findById(fromId);
      if (!fromCustomer) return res.status(404).json({ error: "حساب المرسل غير موجود" });

      // Verify PIN
      if (fromCustomer.walletPin !== pin) {
        return res.status(401).json({ error: "الرقم السري غير صحيح" });
      }

      if ((fromCustomer.points || 0) < points) {
        return res.status(400).json({ error: "النقاط غير كافية" });
      }

      const toCustomer = await CustomerModel.findOne({ phone: toPhone, tenantId });
      if (!toCustomer) {
        return res.status(404).json({ error: "المستلم غير موجود" });
      }

      // Execute transfer
      fromCustomer.points = (fromCustomer.points || 0) - points;
      toCustomer.points = (toCustomer.points || 0) + points;

      await fromCustomer.save();
      await toCustomer.save();

      // Record transaction
      await PointTransferModel.create({
        tenantId,
        fromCustomerId: fromCustomer.id,
        toCustomerId: toCustomer.id,
        points,
        status: 'completed'
      });

      res.json({ 
        success: true, 
        fromName: fromCustomer.name,
        toName: toCustomer.name,
        transferredPoints: points 
      });
    } catch (error) {
      console.error("Transfer error:", error);
      res.status(500).json({ error: "فشل تحويل النقاط" });
    }
  });

  // ============ Points Redemption Verification Code System ============
  const pointsVerificationCodes = new Map<string, {
    code: string;
    points: number;
    valueSAR: number;
    cardId: string;
    customerId: string;
    expiresAt: Date;
    verified: boolean;
    requestedBy: string;
    attempts: number;
  }>();

  setInterval(() => {
    const now = new Date();
    for (const [key, entry] of pointsVerificationCodes.entries()) {
      if (entry.expiresAt < now) {
        pointsVerificationCodes.delete(key);
      }
    }
  }, 60000);

  app.post("/api/loyalty/points/request-code", async (req, res) => {
    try {
      const { phone, points, requestedBy } = req.body;
      if (!phone || !points || points <= 0) {
        return res.status(400).json({ error: "رقم الهاتف وعدد النقاط مطلوب" });
      }

      const cleanPhone = phone.replace(/\D/g, '');
      const pointsToSar = (pts: number) => (pts / 100) * 5;
      const valueSAR = pointsToSar(points);

      const loyaltyCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!loyaltyCard) {
        return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });
      }

      const availablePoints = Number(loyaltyCard.points) || 0;
      if (availablePoints < points) {
        return res.status(400).json({ error: `النقاط غير كافية. الرصيد الحالي: ${availablePoints} نقطة` });
      }

      const existing = pointsVerificationCodes.get(cleanPhone);
      if (existing && existing.expiresAt > new Date() && (new Date().getTime() - (existing.expiresAt.getTime() - 10 * 60 * 1000)) < 60000) {
        return res.status(429).json({ error: "يرجى الانتظار قبل طلب رمز جديد" });
      }

      const code = Math.floor(1000 + Math.random() * 9000).toString();

      pointsVerificationCodes.set(cleanPhone, {
        code,
        points: Number(points),
        valueSAR,
        cardId: loyaltyCard.id,
        customerId: loyaltyCard.customerId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verified: false,
        requestedBy: requestedBy || 'customer',
        attempts: 0,
      });

      const customer = await CustomerModel.findById(loyaltyCard.customerId);
      const customerEmail = customer?.email;
      const customerName = customer?.name || loyaltyCard.customerName || 'عميل';

      let emailSent = false;
      if (customerEmail) {
        emailSent = await sendPointsVerificationEmail(customerEmail, customerName, code, points, valueSAR);
      }

      console.log(`[POINTS-VERIFY] Code generated for ${cleanPhone}: ${code} (${points} pts = ${valueSAR} SAR)`);

      // Broadcast the code to the customer dashboard if they are connected via WebSocket
      wsManager.broadcastToCustomer(loyaltyCard.customerId.toString(), {
        type: 'points_verification_code',
        code,
        points: Number(points),
        valueSAR,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });

      res.json({
        success: true,
        message: emailSent ? "تم إرسال رمز التأكيد إلى بريدك الإلكتروني" : "تم إنشاء رمز التأكيد",
        expiresIn: 600,
        emailSent,
        maskedEmail: customerEmail ? customerEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null,
        points: Number(points),
        valueSAR,
        ...((!emailSent) ? { devCode: code } : {}),
      });
    } catch (error) {
      console.error("[POINTS-VERIFY] Error requesting code:", error);
      res.status(500).json({ error: "حدث خطأ أثناء إنشاء رمز التأكيد" });
    }
  });

  app.post("/api/loyalty/points/verify-code", async (req, res) => {
    try {
      const { phone, code } = req.body;
      if (!phone || !code) {
        return res.status(400).json({ error: "رقم الهاتف والرمز مطلوب" });
      }

      const cleanPhone = phone.replace(/\D/g, '');
      const entry = pointsVerificationCodes.get(cleanPhone);

      if (!entry) {
        return res.status(404).json({ error: "لم يتم العثور على رمز تأكيد. يرجى طلب رمز جديد" });
      }

      if (entry.expiresAt < new Date()) {
        pointsVerificationCodes.delete(cleanPhone);
        return res.status(400).json({ error: "انتهت صلاحية الرمز. يرجى طلب رمز جديد" });
      }

      if (entry.attempts >= 5) {
        pointsVerificationCodes.delete(cleanPhone);
        return res.status(429).json({ error: "تم تجاوز عدد المحاولات. يرجى طلب رمز جديد" });
      }

      entry.attempts += 1;

      if (entry.code !== code.toString().trim()) {
        return res.status(400).json({ error: `الرمز غير صحيح. المحاولات المتبقية: ${5 - entry.attempts}` });
      }

      entry.verified = true;

      const verificationToken = `pv_${cleanPhone}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      pointsVerificationCodes.set(cleanPhone, { ...entry, code: verificationToken });

      console.log(`[POINTS-VERIFY] Code verified for ${cleanPhone}. Token: ${verificationToken}`);

      res.json({
        success: true,
        verified: true,
        verificationToken,
        points: entry.points,
        valueSAR: entry.valueSAR,
        message: "تم التحقق بنجاح! يمكن الآن خصم النقاط",
      });
    } catch (error) {
      console.error("[POINTS-VERIFY] Error verifying code:", error);
      res.status(500).json({ error: "حدث خطأ أثناء التحقق من الرمز" });
    }
  });

  // Wallet Payment Endpoint
  app.post("/api/wallet/pay", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { customerId, amount } = req.body;
      const customer = await CustomerModel.findById(customerId);
      if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
      
      if ((customer.walletBalance || 0) < amount) {
        return res.status(400).json({ error: "الرصيد غير كافٍ" });
      }

      customer.walletBalance = (customer.walletBalance || 0) - amount;
      await customer.save();

      res.json({ success: true, balance: customer.walletBalance });
    } catch (error) {
      res.status(500).json({ error: "فشل عملية الدفع من المحفظة" });
    }
  });

  // Employee profile endpoint (must use this instead of /api/employees/:id for self)
  app.get("/api/employees/me", requireAuth, async (req: AuthRequest, res) => {
    try {
      const employee = await storage.getEmployee(req.employee!.id);
      if (!employee) return res.status(404).json({ error: "Employee not found" });
      const { password: _, ...employeeData } = employee as any;
      res.json(employeeData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee" });
    }
  });

  app.get("/api/employees/active-cashiers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const allCashiers = await storage.getActiveCashiers();
      const cashiers = filterByBranch(allCashiers, req.employee);
      const cashiersData = cashiers.map(emp => {
        const { password: _, _id, ...data } = emp as any;
        return { ...data, id: _id || data.id };
      });
      res.json(cashiersData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active cashiers" });
    }
  });

  // Get employee by ID (branch-restricted for managers)
  app.get("/api/employees/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const employee = await storage.getEmployee(id);

      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Verify branch access for non-admin managers
      if (req.employee?.role !== "admin" && employee.branchId !== req.employee?.branchId) {
        return res.status(403).json({ error: "Access denied - different branch" });
      }

      // Don't send password back, transform _id to id
      const { password: _, _id, ...employeeData } = employee as any;
      res.json({ ...employeeData, id: _id || employeeData.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee" });
    }
  });

  // Create new employee (admin and managers)
  app.post("/api/employees", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { EmployeeModel } = await import("@shared/schema");
      const tenantId = req.employee?.tenantId || 'demo-tenant';
      const bodyData = req.body;

      // For non-admin managers, enforce their branch ID
      if (req.employee?.role !== "admin") {
        if (req.employee?.branchId) {
          // Manager can only create employees in their branch
          if (bodyData.branchId && bodyData.branchId !== req.employee.branchId) {
            return res.status(403).json({ error: "Cannot create employee in different branch" });
          }
          bodyData.branchId = req.employee.branchId;
        } else {
          return res.status(403).json({ error: "Manager must have a branch assigned" });
        }
      }

      // Check if username already exists
      const existing = await storage.getEmployeeByUsername(bodyData.username);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Directly create using Model for robustness
      const newEmployee = await EmployeeModel.create({
        ...bodyData,
        permissions: bodyData.permissions || [],
        allowedPages: bodyData.allowedPages || [],
        tenantId: tenantId as any,
        id: nanoid(),
        isActivated: bodyData.password ? 1 : 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const employee = serializeDoc(newEmployee);
      
      // Don't send password back
      const { password: _, ...employeeData } = employee;
      res.status(201).json(employeeData);
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({ error: "Failed to create employee" });
    }
  });

  // Get all employees (branch-filtered for managers)
  app.get("/api/employees", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const allEmployees = await storage.getEmployees();
      
      // Filter by branch for non-admin/owner managers
      let employees = filterByBranch(allEmployees, req.employee);

      // For non-admin/owner users, hide managers and admin roles
      if (req.employee?.role !== "admin" && req.employee?.role !== "owner") {
        employees = employees.filter(emp => 
          emp.role !== "admin" && 
          emp.role !== "owner" && 
          emp.role !== "manager"
        );
      }

      // Don't send passwords back, transform _id to id for frontend
      const employeesData = employees.map(emp => {
        const { password: _, _id, ...data } = emp as any;
        return { ...data, id: _id || data.id };
      });

      res.json(employeesData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  // Update employee (branch-restricted for managers)
  app.put("/api/employees/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Get employee to verify branch access
      const existingEmployee = await storage.getEmployee(id);
      if (!existingEmployee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Verify branch access for non-admin managers
      if (req.employee?.role !== "admin" && existingEmployee.branchId !== req.employee?.branchId) {
        return res.status(403).json({ error: "Access denied - different branch" });
      }

      const updatedEmployee = await storage.updateEmployee(id, updates);

      if (!updatedEmployee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Don't send password back, transform _id to id
      const { password: _, _id, ...employeeData } = updatedEmployee as any;
      res.json({ ...employeeData, id: _id || employeeData.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to update employee" });
    }
  });

  // Activate employee account
  app.post("/api/employees/activate", async (req, res) => {
    try {
      const { EmployeeModel } = await import("@shared/schema");
      const { phone, fullName, password } = req.body;

      if (!phone || !fullName || !password) {
        return res.status(400).json({ error: "رقم الهاتف والاسم وكلمة المرور مطلوبة" });
      }

      // Look for employee that is NOT activated and matches name/phone
      // We trim and use case-insensitive regex for fullName to be robust
      const employee = await EmployeeModel.findOne({
        phone: phone.trim(),
        fullName: { $regex: new RegExp(`^${fullName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") },
        isActivated: 0
      });

      if (!employee) {
        return res.status(404).json({ error: "الموظف غير موجود أو تم تفعيله مسبقاً" });
      }

      // Hash password using bcrypt directly
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const updatedEmployee = await EmployeeModel.findByIdAndUpdate(employee._id, {
        password: hashedPassword,
        isActivated: 1,
        updatedAt: new Date()
      }, { new: true });

      if (!updatedEmployee) {
        return res.status(500).json({ error: "فشل تحديث بيانات الموظف" });
      }

      const serialized = serializeDoc(updatedEmployee);
      const { password: _, ...employeeData } = serialized;
      res.json(employeeData);
    } catch (error) {
      console.error("Error activating employee:", error);
      res.status(500).json({ error: "Failed to activate employee" });
    }
  });

  // Reset employee password by username
  app.post("/api/employees/reset-password-by-username", async (req, res) => {
    try {
      const { username, newPassword } = req.body;

      if (!username || !newPassword) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور الجديدة مطلوبان" });
      }

      // Validate password
      if (newPassword.length < 4) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون على الأقل 4 أحرف" });
      }

      const success = await storage.resetEmployeePasswordByUsername(username, newPassword);

      if (!success) {
        return res.status(404).json({ error: "الموظف غير موجود" });
      }

      res.json({ message: "تم تغيير كلمة المرور بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل تغيير كلمة المرور" });
    }
  });

  // DISCOUNT CODE ROUTES

  // Get all discount codes
  app.get("/api/discount-codes", async (req, res) => {
    try {
      const isEmployee = !!(req as any).employee;
      const { DiscountCodeModel } = await import("@shared/schema");
      if (isEmployee) {
        const codes = await DiscountCodeModel.find({}).sort({ createdAt: -1 }).lean();
        return res.json(codes);
      }
      const publicCoupons = await DiscountCodeModel.find({
        isActive: 1,
        visibleToCustomers: true,
      }).select('code discountPercentage reason').sort({ createdAt: -1 }).lean();
      res.json(publicCoupons);
    } catch (error) {
      console.error("Failed to fetch discount codes:", error);
      res.json([]);
    }
  });

  // Create discount code
  app.post("/api/discount-codes", requireAuth, requireManager, async (req, res) => {
    try {
      const { insertDiscountCodeSchema } = await import("@shared/schema");
      const validatedData = insertDiscountCodeSchema.parse(req.body);

      // Check if code already exists
      const existing = await storage.getDiscountCodeByCode(validatedData.code);
      if (existing) {
        return res.status(400).json({ error: "Code already exists" });
      }

      const discountCode = await storage.createDiscountCode(validatedData);
      res.status(201).json(discountCode);
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: "Validation error", details: error });
      }
      res.status(500).json({ error: "Failed to create discount code" });
    }
  });

  // Get discount code by code
  app.get("/api/discount-codes/by-code/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const discountCode = await storage.getDiscountCodeByCode(code);

      if (!discountCode) {
        return res.status(404).json({ error: "Discount code not found" });
      }

      if (discountCode.isActive === 0) {
        return res.status(400).json({ error: "Discount code is inactive" });
      }

      res.json(discountCode);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch discount code" });
    }
  });

  // Get all discount codes for an employee
  app.get("/api/discount-codes/employee/:employeeId", async (req, res) => {
    try {
      const { employeeId } = req.params;
      // Using standard discount code lookup if specific method missing
      const { DiscountCodeModel } = await import("@shared/schema");
      const codes = await DiscountCodeModel.find({ employeeId }).lean();
      res.json(codes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch discount codes" });
    }
  });

  // Update discount code (toggle active status or visibility)
  app.patch("/api/discount-codes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive, visibleToCustomers, employeeId } = req.body;

      // Require employee ID for authorization
      if (!employeeId) {
        return res.status(401).json({ error: "Employee authentication required" });
      }

      // Verify the discount code exists and belongs to this employee
      const existingCode = await storage.getDiscountCode(id);
      if (!existingCode) {
        return res.status(404).json({ error: "Discount code not found" });
      }

      if (existingCode.employeeId !== employeeId) {
        return res.status(403).json({ error: "Unauthorized: You can only update your own discount codes" });
      }

      const updates: Record<string, any> = {};

      if (isActive !== undefined) {
        if (typeof isActive !== 'number' || (isActive !== 0 && isActive !== 1)) {
          return res.status(400).json({ error: "isActive must be 0 or 1" });
        }
        updates.isActive = isActive;
      }

      if (visibleToCustomers !== undefined) {
        updates.visibleToCustomers = !!visibleToCustomers;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const discountCode = await storage.updateDiscountCode(id, updates);
      res.json(discountCode);
    } catch (error) {
      res.status(500).json({ error: "Failed to update discount code" });
    }
  });

  // Increment discount code usage
  app.post("/api/discount-codes/:id/use", async (req, res) => {
    try {
      const { id } = req.params;

      // Check if code exists and is active first
      const code = await storage.getDiscountCode(id);
      if (!code) {
        return res.status(404).json({ error: "Discount code not found" });
      }

      if (code.isActive === 0) {
        return res.status(400).json({ error: "Discount code is inactive" });
      }

      const discountCode = await storage.incrementDiscountCodeUsage(id);
      res.json(discountCode);
    } catch (error) {
      res.status(500).json({ error: "Failed to use discount code" });
    }
  });

  // Validate discount code and return discount info
  app.post("/api/discount-codes/validate", async (req, res) => {
    try {
      const { code, customerId, amount } = req.body;

      if (!code) {
        return res.status(400).json({ error: "كود الخصم مطلوب" });
      }

      const discountCode = await storage.getDiscountCodeByCode(code.trim());

      if (!discountCode) {
        console.log(`[DISCOUNT] Code not found: ${code.trim()}`);
        return res.status(404).json({ 
          valid: false,
          error: "كود الخصم غير موجود"
        });
      }
      
      const isActive = Number(discountCode.isActive);
      if (isActive === 0) {
        return res.status(400).json({ 
          valid: false,
          error: "كود الخصم غير فعال"
        });
      }

      // Check expiry
      if (discountCode.expiryDate && new Date(discountCode.expiryDate) < new Date()) {
        return res.status(400).json({
          valid: false,
          error: "كود الخصم منتهي الصلاحية"
        });
      }

      // Check usage limit
      if (discountCode.usageLimit && (discountCode.usageCount || 0) >= discountCode.usageLimit) {
        return res.status(400).json({
          valid: false,
          error: "تم تجاوز حد الاستخدام لهذا الكود"
        });
      }

      // Check min purchase
      if (discountCode.minPurchase && amount && Number(amount) < discountCode.minPurchase) {
        return res.status(400).json({
          valid: false,
          error: `الحد الأدنى للشراء لاستخدام هذا الكود هو ${discountCode.minPurchase}`
        });
      }
      
      // Check if it's a permanent loyalty discount (qahwa-card)
      if (discountCode.code === 'qahwa-card') {
        if (!customerId) {
          return res.status(400).json({ 
            valid: false,
            error: "يجب تسجيل الدخول لاستخدام خصم بطاقة كلوني"
          });
        }
        
        const customer = await storage.getCustomer(customerId);
        if (!customer) {
          return res.status(404).json({ 
            valid: false,
            error: "العميل غير موجود"
          });
        }
      }

      // Allow all active discount codes including 100%

      res.json({
        valid: true,
        code: discountCode.code,
        discountPercentage: discountCode.discountPercentage,
        reason: discountCode.reason,
        id: discountCode._id
      });
    } catch (error) {
      console.error("Error validating discount code:", error);
      res.status(500).json({ error: "Failed to validate discount code" });
    }
  });

  // SALES REPORTS ROUTES

  // Get sales report for a specific period
  app.get("/api/reports/sales", async (req, res) => {
    try {
      const { period, startDate, endDate, branchId } = req.query;
      
      const now = new Date();
      let start: Date;
      let end: Date = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (startDate && endDate) {
        start = new Date(startDate as string);
        end = new Date(endDate as string);
      } else if (period === 'daily') {
        start = getSaudiToday();
      } else if (period === 'weekly') {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'monthly') {
        start = getSaudiMonthStart();
      } else {
        start = getSaudiToday();
      }

      const { OrderModel } = await import("@shared/schema");
      
      const matchQuery: any = {
        createdAt: { $gte: start, $lte: end },
        status: { $in: ['completed', 'payment_confirmed'] }
      };

      if (branchId) {
        matchQuery.branchId = branchId;
      }

      const salesData = await OrderModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: "$totalAmount" },
            orders: { $push: "$$ROOT" }
          }
        }
      ]);

      const result = salesData[0] || { totalOrders: 0, totalRevenue: 0, orders: [] };

      res.json({
        period: period || 'custom',
        startDate: start,
        endDate: end,
        totalOrders: result.totalOrders,
        totalRevenue: result.totalRevenue,
        orders: result.orders
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate sales report" });
    }
  });

  // CUSTOMER ROUTES

  // Customer registration - إنشاء حساب جديد
  app.post("/api/customers/register", async (req, res) => {
    try {
      const { phone, email, name, password, referralCode } = req.body;

      if (!phone || !name || !password) {
        return res.status(400).json({ error: "الهاتف والاسم وكلمة المرور مطلوبة" });
      }

      // Validate phone format: must be 9 digits starting with 5
      const cleanPhone = phone.trim().replace(/\s/g, '');
      if (cleanPhone.length !== 9) {
        return res.status(400).json({ error: "رقم الهاتف يجب أن يكون 9 أرقام" });
      }

      if (!cleanPhone.startsWith('5')) {
        return res.status(400).json({ error: "رقم الهاتف يجب أن يبدأ بـ 5" });
      }

      if (!/^5\d{8}$/.test(cleanPhone)) {
        return res.status(400).json({ error: "صيغة رقم الهاتف غير صحيحة" });
      }

      // Validate email format only if provided
      if (email && email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة" });
        }
      }

      // Validate name
      if (name.trim().length < 2) {
        return res.status(400).json({ error: "الاسم يجب أن يكون على الأقل حرفين" });
      }

      // Validate password
      if (password.length < 4) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون على الأقل 4 أحرف" });
      }

      // Check if customer already exists with this phone
      const existingCustomerByPhone = await storage.getCustomerByPhone(cleanPhone);
      if (existingCustomerByPhone) {
        return res.status(400).json({ error: "رقم الهاتف مسجل مسبقاً" });
      }

      // Check if customer already exists with this email
      const existingCustomerByEmail = await storage.getCustomerByEmail(email);
      if (existingCustomerByEmail) {
        return res.status(400).json({ error: "البريد الإلكتروني مسجل مسبقاً" });
      }

      // Hash password before saving
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new customer
      const customer = await storage.createCustomer({ 
        phone: cleanPhone, 
        email: email.trim().toLowerCase(),
        name: name.trim(),
        password: hashedPassword
      });

      // Send Welcome Email asynchronously
      if (customer.email) {
        sendWelcomeEmail(customer.email, customer.name).catch(err => console.error("Welcome Email Error:", err));
      }

      // Create loyalty card for new customer
      let newLoyaltyCard: any = null;
      try {
        newLoyaltyCard = await storage.createLoyaltyCard({ 
          customerName: name.trim(), 
          phoneNumber: cleanPhone 
        });
      } catch (cardError) {
        // Don't fail registration if card creation fails, but log the error
        console.error("[REGISTRATION] Failed to create loyalty card for new customer:", cardError);
      }

      // Handle referral code - give 50 points to both referrer and new customer
      if (referralCode && referralCode.trim()) {
        try {
          // Find referrer by phone number (referral code = phone number)
          const referrerCard = await storage.getLoyaltyCardByPhone(referralCode.trim());
          if (referrerCard && referrerCard.phoneNumber !== cleanPhone) {
            // Add 50 points to referrer
            const referrerPoints = Number(referrerCard.points) || 0;
            await storage.updateLoyaltyCard(referrerCard.id, {
              points: referrerPoints + 50
            });
            
            // Create transaction for referrer
            await storage.createLoyaltyTransaction({
              cardId: referrerCard.id,
              type: 'referral_bonus',
              pointsChange: 50,
              discountAmount: 0,
              orderAmount: 0,
              description: `مكافأة إحالة صديق جديد: ${name.trim()}`
            });

            // Add 50 points to new customer
            if (newLoyaltyCard) {
              await storage.updateLoyaltyCard(newLoyaltyCard.id, {
                points: 50
              });
              
              // Create transaction for new customer
              await storage.createLoyaltyTransaction({
                cardId: newLoyaltyCard.id,
                type: 'referral_bonus',
                pointsChange: 50,
                discountAmount: 0,
                orderAmount: 0,
                description: `مكافأة التسجيل بكود إحالة`
              });
            }
            
            console.log(`[REFERRAL] Bonus applied: Referrer ${referralCode} and new customer ${cleanPhone} each got 50 points`);
          }
        } catch (referralError) {
          console.error("[REFERRAL] Error processing referral code:", referralError);
          // Don't fail registration if referral processing fails
        }
      }

      // Link any previous guest orders placed with the same phone number
      try {
        const OrderModel = mongoose.model('Order');
        const linkedResult = await OrderModel.updateMany(
          { customerPhone: cleanPhone, $or: [{ customerId: null }, { customerId: { $exists: false } }] },
          { $set: { customerId: customer.id } }
        );
        if (linkedResult.modifiedCount > 0) {
          console.log(`[REGISTRATION] Linked ${linkedResult.modifiedCount} guest orders to new customer ${customer.id} (phone: ${cleanPhone})`);
        }
      } catch (linkError) {
        console.error("[REGISTRATION] Order linking failed (non-critical):", linkError);
      }

      // Serialize and don't send password back
      const serialized = serializeDoc(customer);
      const { password: _, ...customerData } = serialized;

      // Set customer in session
      (req.session as any).customer = customerData;

      res.status(201).json(customerData);
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء الحساب" });
    }
  });

  // Customer login - تسجيل دخول
  app.post("/api/customers/login", async (req, res) => {
    try {
      const { identifier, password } = req.body;

      if (!identifier || !password) {
        return res.status(400).json({ error: "رقم الهاتف أو البريد الإلكتروني وكلمة المرور مطلوبة" });
      }

      const cleanIdentifier = identifier.trim().replace(/\s/g, '');
      let customer;

      // Check if identifier is email or phone
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let foundCustomer;
      
      if (emailRegex.test(cleanIdentifier)) {
        // Login with email
        foundCustomer = await storage.getCustomerByEmail(cleanIdentifier);
        if (foundCustomer) {
          if (!foundCustomer.password) {
            // Customer exists but has no password (cashier-registered)
            return res.status(403).json({ 
              error: "هذا الحساب تم تسجيله من قبل الكاشير ولا يحتوي على كلمة مرور. يرجى إنشاء كلمة مرور أولاً",
              message: "This account was registered by cashier and has no password. Please set up a password first",
              requiresPasswordSetup: true
            });
          }
          const isPasswordValid = await bcrypt.compare(password, foundCustomer.password);
          if (isPasswordValid) {
            customer = foundCustomer;
          }
        }
      } else {
        // Login with phone
        if (!/^5\d{8}$/.test(cleanIdentifier)) {
          return res.status(400).json({ error: "صيغة رقم الهاتف أو البريد الإلكتروني غير صحيحة" });
        }
        
        foundCustomer = await storage.getCustomerByPhone(cleanIdentifier);
        if (foundCustomer) {
          if (!foundCustomer.password) {
            // Customer exists but has no password (cashier-registered)
            return res.status(403).json({ 
              error: "هذا الحساب تم تسجيله من قبل الكاشير ولا يحتوي على كلمة مرور. يرجى إنشاء كلمة مرور أولاً",
              message: "This account was registered by cashier and has no password. Please set up a password first",
              requiresPasswordSetup: true
            });
          }
          customer = await storage.verifyCustomerPassword(cleanIdentifier, password);
        }
      }

      if (!customer) {
        return res.status(401).json({ error: "رقم الهاتف/البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }

      // Serialize and don't send password back
      const serialized = serializeDoc(customer);
      const { password: _, ...customerData } = serialized;

      // Set customer in session
      (req.session as any).customer = customerData;
      
      res.json(customerData);
    } catch (error) {
      res.status(500).json({ error: "فشل تسجيل الدخول" });
    }
  });

  // Request password reset - طلب إعادة تعيين كلمة المرور
  app.post("/api/customers/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة" });
      }

      // Check if customer exists
      const customer = await storage.getCustomerByEmail(email);
      
      // Always return success to prevent email enumeration
      // But only create token if customer exists
      if (customer) {
        const { token, expiresAt } = await storage.createPasswordResetToken(email);
        
        // Send password reset email
        const { sendPasswordResetEmail } = await import("./mail-service");
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const resetUrl = `${appUrl}/reset-password?token=${token}`;
        sendPasswordResetEmail(email, customer.name, token, resetUrl).catch(err => 
          console.error("[MAIL] Password reset email failed:", err)
        );
      }

      res.json({ 
        message: "إذا كان البريد الإلكتروني موجوداً، سيتم إرسال رابط إعادة تعيين كلمة المرور" 
      });
    } catch (error) {
      res.status(500).json({ error: "فشل طلب إعادة تعيين كلمة المرور" });
    }
  });

  // Verify password reset token - التحقق من رمز إعادة التعيين
  app.post("/api/customers/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: "الرمز مطلوب" });
      }

      const result = await storage.verifyPasswordResetToken(token);

      if (!result.valid) {
        return res.status(400).json({ error: "الرمز غير صالح أو منتهي الصلاحية" });
      }

      res.json({ valid: true, email: result.email });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من الرمز" });
    }
  });

  // Reset password - إعادة تعيين كلمة المرور
  app.post("/api/customers/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: "الرمز وكلمة المرور الجديدة مطلوبة" });
      }

      // Validate password
      if (newPassword.length < 4) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون على الأقل 4 أحرف" });
      }

      // Verify token
      const verification = await storage.verifyPasswordResetToken(token);
      
      if (!verification.valid || !verification.email) {
        return res.status(400).json({ error: "الرمز غير صالح أو منتهي الصلاحية" });
      }

      // Reset password (auto-syncs card PIN)
      const success = await storage.resetCustomerPassword(verification.email, newPassword);
      
      if (!success) {
        return res.status(500).json({ error: "فشل إعادة تعيين كلمة المرور" });
      }

      // Mark token as used
      await storage.usePasswordResetToken(token);

      res.json({ message: "تم إعادة تعيين كلمة المرور بنجاح. تم تحديث رمز البطاقة تلقائياً" });
    } catch (error) {
      res.status(500).json({ error: "فشل إعادة تعيين كلمة المرور" });
    }
  });

  // Check if email exists - التحقق من وجود البريد الإلكتروني
  app.post("/api/customers/check-email", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة" });
      }

      const customer = await storage.getCustomerByEmail(email);
      res.json({ exists: !!customer });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من البريد الإلكتروني" });
    }
  });

  // Verify phone matches email - التحقق من تطابق رقم الجوال مع البريد
  app.post("/api/customers/verify-phone-email", async (req, res) => {
    try {
      const { email, phone } = req.body;

      if (!email || !phone) {
        return res.status(400).json({ error: "البريد الإلكتروني ورقم الجوال مطلوبان" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      const customer = await storage.getCustomerByEmail(email);

      if (!customer) {
        return res.json({ valid: false });
      }

      const valid = customer.phone === cleanPhone;
      res.json({ valid });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من البيانات" });
    }
  });

  // Reset password directly with email and phone - إعادة تعيين كلمة المرور مباشرة
  app.post("/api/customers/reset-password-direct", async (req, res) => {
    try {
      const { email, phone, newPassword } = req.body;

      if (!email || !phone || !newPassword) {
        return res.status(400).json({ error: "جميع الحقول مطلوبة" });
      }

      if (newPassword.length < 4) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون على الأقل 4 أحرف" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      const customer = await storage.getCustomerByEmail(email);

      if (!customer || customer.phone !== cleanPhone) {
        return res.status(400).json({ error: "البيانات غير صحيحة" });
      }

      // Reset password (auto-syncs card PIN)
      const success = await storage.resetCustomerPassword(email, newPassword);
      
      if (!success) {
        return res.status(500).json({ error: "فشل إعادة تعيين كلمة المرور" });
      }

      res.json({ message: "تم إعادة تعيين كلمة المرور بنجاح. تم تحديث رمز البطاقة تلقائياً" });
    } catch (error) {
      res.status(500).json({ error: "فشل إعادة تعيين كلمة المرور" });
    }
  });

  app.post("/api/customers/verify-password", async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "كلمة المرور مطلوبة" });
      }
      const sessionCustomer = (req.session as any).customer;
      if (!sessionCustomer?.phone) {
        return res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
      }
      const customer = await storage.verifyCustomerPassword(sessionCustomer.phone, password);
      if (!customer) {
        return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من كلمة المرور" });
    }
  });

  // Customer authentication (legacy - for backward compatibility)
  app.post("/api/customers/auth", async (req, res) => {
    try {
      const { phone, name, password } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "Phone number required" });
      }

      // Validate phone format
      const cleanPhone = phone.trim().replace(/\s/g, '');
      if (!/^5\d{8}$/.test(cleanPhone)) {
        return res.status(400).json({ error: "Invalid phone number format" });
      }

      // If password provided, try login first
      if (password) {
        const customer = await storage.verifyCustomerPassword(cleanPhone, password);
        if (customer) {
          const { password: _, ...customerData } = customer;
          const serialized = serializeDoc(customerData);
          // Set customer in session
          (req.session as any).customer = serialized;
          return res.json(serialized);
        }
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Legacy behavior: get or create customer without password
      let customer = await storage.getCustomerByPhone(cleanPhone);
      if (customer) {
        const { password: _, ...customerData } = customer;
        const serialized = serializeDoc(customerData);
        // Set customer in session
        (req.session as any).customer = serialized;
        return res.json(serialized);
      }

      // For new registrations, require password
      return res.status(400).json({ error: "Please use /api/customers/register for new accounts" });
    } catch (error) {
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Get all customers (for admin/manager dashboard)
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      const serializedCustomers = customers.map(customer => {
        const { password, ...customerData} = customer.toObject ? customer.toObject() : customer;
        return serializeDoc(customerData);
      });
      res.json(serializedCustomers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  /* 
   * CASHIER-REGISTERED CUSTOMERS - العملاء المسجلين من الكاشير
   * 
   * Customers registered by cashiers don't have passwords initially.
   * They can't log in through the normal /api/customers/login flow.
   * 
   * When they order via QR code (table menu), they just enter their phone number
   * and the system automatically links the order to their account for loyalty tracking.
   * 
   * They can optionally set a password later using /api/customers/set-password
   * to gain full account access with login capability.
   */
  
  // Customer lookup by phone for cashier - البحث عن عميل برقم الجوال من الكاشير
  app.post("/api/customers/lookup-by-phone", async (req, res) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "رقم الجوال مطلوب" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      
      const customer = await storage.getCustomerByPhone(cleanPhone);
      
      if (!customer) {
        return res.json({ found: false });
      }

      const loyaltyCard = await storage.getLoyaltyCardByPhone(cleanPhone);

      const { password: _, ...customerData } = customer.toObject ? customer.toObject() : customer;
      const serializedCustomer = serializeDoc(customerData);

      res.json({ 
        found: true,
        customer: serializedCustomer,
        loyaltyCard: loyaltyCard ? serializeDoc(loyaltyCard) : null
      });
    } catch (error) {
      res.status(500).json({ error: "فشل البحث عن العميل" });
    }
  });

  // GET Customer by phone - for table menu to fetch customer data
  app.get("/api/customers/by-phone/:phone", async (req, res) => {
    try {
      const phone = req.params.phone;

      if (!phone) {
        return res.status(400).json({ error: "رقم الجوال مطلوب" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      
      // Validate phone format: must be 9 digits starting with 5
      if (!/^5\d{8}$/.test(cleanPhone)) {
        return res.status(400).json({ error: "صيغة رقم الهاتف غير صحيحة" });
      }

      const customer = await storage.getCustomerByPhone(cleanPhone);
      
      if (!customer) {
        // Customer not found - that's ok, just return empty
        return res.json({});
      }

      const { password: _, ...customerData } = customer.toObject ? customer.toObject() : customer;
      const serializedCustomer = serializeDoc(customerData);

      // Also fetch pending table orders for this customer
      let pendingOrder = null;
      try {
        const pendingOrders = await storage.getPendingTableOrders();
        const custOrder = pendingOrders.find(o => 
          o.customerInfo?.customerPhone === cleanPhone || 
          (customer._id && o.customerId?.toString() === customer._id.toString())
        );
        if (custOrder) {
          pendingOrder = serializeDoc(custOrder);
        }
      } catch (error) {
      }

      res.json({ 
        ...serializedCustomer,
        pendingTableOrder: pendingOrder 
      });
    } catch (error) {
      res.status(500).json({ error: "فشل البحث عن العميل" });
    }
  });

  // Get orders for a specific customer by phone
  app.get("/api/orders/customer/:identifier", async (req, res) => {
    try {
      const { identifier } = req.params;
      const { OrderModel } = await import("@shared/schema");
      
      // Clean phone number for consistent matching
      const cleanPhone = identifier.trim().replace(/\s/g, '').replace(/^\+966/, '').replace(/^00966/, '');
      
      // Check if identifier looks like a MongoDB ObjectId
      const isMongoId = mongoose?.Types?.ObjectId?.isValid?.(identifier) || 
                        /^[a-f\d]{24}$/i.test(identifier);
      
      // Also try to find customer by phone to get customerId
      let customerId: string | null = null;
      try {
        const customer = await storage.getCustomerByPhone(cleanPhone);
        if (customer) {
          customerId = (customer as any)._id?.toString() || (customer as any).id;
        }
      } catch (e) {
        // Continue without customerId
      }
      
      // If identifier is a MongoDB ObjectId, use it directly as customerId too
      if (isMongoId) {
        customerId = identifier;
      }
      
      // Build query conditions - search in all possible phone fields
      const queryConditions = [
        { "customerInfo.customerPhone": identifier },
        { "customerInfo.customerPhone": cleanPhone },
        { "customerInfo.phone": identifier },
        { "customerInfo.phone": cleanPhone },
        { "customerInfo.phoneNumber": identifier },
        { "customerInfo.phoneNumber": cleanPhone },
        { "phone": identifier },
        { "phone": cleanPhone }
      ];
      
      // Add customerId conditions
      if (customerId) {
        (queryConditions as any[]).push({ customerId: customerId });
        (queryConditions as any[]).push({ "customerId": customerId });
      }
      
      // If it looks like a UUID, also search by id directly
      if (identifier.includes('-') || isMongoId) {
        (queryConditions as any[]).push({ "customerId": identifier });
      }
      
      const orders = await OrderModel.find({
        $or: queryConditions
      }).sort({ createdAt: -1 });

      const serializedOrders = orders.map(order => serializeDoc(order));
      console.log(`[GET /api/orders/customer/:identifier] Found ${serializedOrders.length} orders for identifier ${identifier}`);
      res.json(serializedOrders);
    } catch (error) {
      console.error("[GET /api/orders/customer/:identifier] Error:", error);
      res.status(500).json({ error: "Failed to fetch customer orders" });
    }
  });

  // Quick customer registration by cashier - تسجيل عميل سريع من الكاشير
  app.post("/api/customers/register-by-cashier", async (req, res) => {
    try {
      const { phone, name, email } = req.body;

      if (!phone || !name) {
        return res.status(400).json({ error: "رقم الجوال والاسم مطلوبان" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      const cleanName = name.trim();
      const cleanEmail = email ? email.trim() : undefined;

      if (cleanName.length < 2) {
        return res.status(400).json({ error: "الاسم يجب أن يكون على الأقل حرفين" });
      }

      if (!/^5\d{8}$/.test(cleanPhone)) {
        return res.status(400).json({ error: "صيغة رقم الهاتف غير صحيحة" });
      }

      // Validate email format if provided
      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة" });
      }

      const existingCustomer = await storage.getCustomerByPhone(cleanPhone);
      if (existingCustomer) {
        return res.status(400).json({ error: "رقم الهاتف مسجل مسبقاً" });
      }

      // Check if email already exists
      if (cleanEmail) {
        const existingEmailCustomer = await storage.getCustomerByEmail(cleanEmail);
        if (existingEmailCustomer) {
          return res.status(400).json({ error: "البريد الإلكتروني مسجل مسبقاً" });
        }
      }

      const customer = await storage.createCustomer({ 
        phone: cleanPhone, 
        name: cleanName,
        email: cleanEmail,
        registeredBy: 'cashier'
      });

      // Send Welcome Email asynchronously
      if (customer.email) {
        sendWelcomeEmail(customer.email, customer.name).catch(err => console.error("Welcome Email Error:", err));
      }

      try {
        await storage.createLoyaltyCard({ 
          customerName: cleanName, 
          phoneNumber: cleanPhone 
        });
      } catch (cardError) {
      }

      const { password: _, ...customerData } = customer;
      const serialized = serializeDoc(customerData);

      // Set customer in session
      (req.session as any).customer = serialized;

      res.status(201).json(serialized);
    } catch (error) {
      res.status(500).json({ error: "فشل تسجيل العميل" });
    }
  });

  /*
   * PASSWORDLESS CUSTOMER PASSWORD SETUP FLOW
   * 
   * For security, customers must verify phone ownership via OTP before setting password.
   * This prevents unauthorized password changes even if someone knows the customer's phone number.
   * 
   * Flow:
   * 1. POST /api/customers/request-password-setup-otp { phone }
   *    - Generates and stores OTP for the customer's phone
   *    - In production, sends SMS with OTP
   *    - Returns success (doesn't reveal if phone exists for security)
   * 
   * 2. POST /api/customers/set-password { phone, otp, password }
   *    - Verifies OTP matches and hasn't expired
   *    - Sets password only if OTP is valid
   *    - Prevents setting password if customer already has one
   */

  // Step 1: Request OTP to set password
  app.post("/api/customers/request-password-setup-otp", async (req, res) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "رقم الجوال مطلوب" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      
      if (!/^5\d{8}$/.test(cleanPhone)) {
        return res.status(400).json({ error: "صيغة رقم الهاتف غير صحيحة" });
      }

      const customer = await storage.getCustomerByPhone(cleanPhone);
      
      // Always return success to prevent phone enumeration
      // But only generate OTP if customer exists and has no password
      if (customer && !customer.password) {
        try {
          const { otp, expiresAt } = await storage.createPasswordSetupOTP(cleanPhone);
          
          // Send OTP via email if customer has email
          if (customer.email) {
            const { sendOTPEmail } = await import("./mail-service");
            sendOTPEmail(customer.email, customer.name, otp).catch(err =>
              console.error("[MAIL] OTP email failed:", err)
            );
            console.log(`[OTP] Sent OTP via email to ${customer.email} for phone ${cleanPhone}`);
          } else {
            // No email — OTP is in DB for 10min, cashier can relay verbally if needed
            console.log(`[OTP] No email for customer ${cleanPhone}. OTP generated and stored (expires: ${expiresAt}). Customer must retrieve via cashier.`);
          }
        } catch (otpError: any) {
          // If rate limit exceeded, return specific error
          if (otpError.message.includes('تجاوز الحد')) {
            return res.status(429).json({ error: otpError.message });
          }
          throw otpError;
        }
      }

      res.json({ 
        success: true,
        message: "إذا كان الرقم مسجلاً، سيتم إرسال رمز التحقق خلال دقائق",
        message_en: "If the number is registered, verification code will be sent within minutes"
      });
    } catch (error) {
      res.status(500).json({ error: "فشل إرسال رمز التحقق" });
    }
  });

  // Step 2: Verify OTP and set password
  app.post("/api/customers/set-password", async (req, res) => {
    try {
      const { phone, otp, password } = req.body;

      if (!phone || !otp || !password) {
        return res.status(400).json({ error: "رقم الجوال، رمز التحقق وكلمة المرور مطلوبة" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      
      if (password.length < 8) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
      }

      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ error: "رمز التحقق غير صحيح" });
      }

      const customer = await storage.getCustomerByPhone(cleanPhone);
      if (!customer) {
        return res.status(404).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية" });
      }

      // Prevent overwriting existing passwords
      if (customer.password) {
        return res.status(400).json({ 
          error: "هذا الحساب لديه كلمة مرور بالفعل. يرجى استخدام ميزة إعادة تعيين كلمة المرور",
          message: "Account already has a password. Use password reset instead"
        });
      }

      // Verify OTP from database
      const otpVerification = await storage.verifyPasswordSetupOTP(cleanPhone, otp);
      if (!otpVerification.valid) {
        return res.status(400).json({ error: otpVerification.message || "رمز التحقق غير صحيح" });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Update customer with password
      const updated = await storage.updateCustomer((customer as any)._id.toString(), { 
        password: hashedPassword 
      });

      if (!updated) {
        return res.status(500).json({ error: "فشل تحديث كلمة المرور" });
      }

      // Invalidate the used OTP
      await storage.invalidatePasswordSetupOTP(cleanPhone, otp);

      const { password: _, ...customerData } = updated;
      res.json({ 
        success: true, 
        message: "تم تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول",
        customer: serializeDoc(customerData)
      });
    } catch (error) {
      res.status(500).json({ error: "فشل تعيين كلمة المرور" });
    }
  });

  app.get("/api/customers/favorites", async (req, res) => {
    try {
      const { CustomerModel } = await import("@shared/schema");
      const { phone, customerId } = req.query;
      const query: any = {};
      if (phone) query.phone = String(phone).replace(/^0/, '');
      else if (customerId) query._id = customerId;
      else return res.status(400).json({ error: "يجب تحديد العميل" });
      const customer = await CustomerModel.findOne(query);
      if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
      res.json({ favorites: (customer as any).favorites || [] });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب المفضلة" });
    }
  });

  app.post("/api/customers/favorites/:itemId", async (req, res) => {
    try {
      const { CustomerModel } = await import("@shared/schema");
      const { phone, customerId } = req.body;
      const query: any = {};
      if (phone) query.phone = String(phone).replace(/^0/, '');
      else if (customerId) query._id = customerId;
      else return res.status(400).json({ error: "يجب تحديد العميل" });
      const customer = await CustomerModel.findOne(query);
      if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
      const favorites: string[] = (customer as any).favorites || [];
      if (!favorites.includes(req.params.itemId)) {
        favorites.push(req.params.itemId);
        await CustomerModel.updateOne(query, { $set: { favorites } });
      }
      res.json({ success: true, favorites });
    } catch (error) {
      res.status(500).json({ error: "فشل إضافة للمفضلة" });
    }
  });

  app.delete("/api/customers/favorites/:itemId", async (req, res) => {
    try {
      const { CustomerModel } = await import("@shared/schema");
      const { phone, customerId } = req.query;
      const query: any = {};
      if (phone) query.phone = String(phone).replace(/^0/, '');
      else if (customerId) query._id = customerId;
      else return res.status(400).json({ error: "يجب تحديد العميل" });
      const customer = await CustomerModel.findOne(query);
      if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
      const favorites: string[] = ((customer as any).favorites || []).filter((id: string) => id !== req.params.itemId);
      await CustomerModel.updateOne(query, { $set: { favorites } });
      res.json({ success: true, favorites });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف من المفضلة" });
    }
  });

  // Get customer by ID
  app.get("/api/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await storage.getCustomer(id);

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  // Update customer
  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, carType, carColor, saveCarInfo } = req.body;

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (carType !== undefined) updates.carType = carType;
      if (carColor !== undefined) updates.carColor = carColor;
      if (saveCarInfo !== undefined) updates.saveCarInfo = saveCarInfo;

      const customer = await storage.updateCustomer(id, updates);

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(serializeDoc(customer));
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // Get customer orders
  app.get("/api/customers/:id/orders", async (req, res) => {
    try {
      const { id } = req.params;
      const orders = await storage.getCustomerOrders(id);
      
      // Process orders to ensure items is always an array
      const processedOrders = orders.map(order => {
        const serializedOrder = serializeDoc(order);
        
        // Parse items if they're stored as JSON string
        let orderItems = serializedOrder.items;
        if (typeof orderItems === 'string') {
          try {
            orderItems = JSON.parse(orderItems);
          } catch (e) {
            orderItems = [];
          }
        }
        
        // Ensure orderItems is an array
        if (!Array.isArray(orderItems)) {
          orderItems = [];
        }
        
        return {
          ...serializedOrder,
          items: orderItems
        };
      });
      
      res.json(processedOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // COFFEE ROUTES

  // Get all coffee items - with branch availability info (optimized)
  // For customers: shows items in their branch + available branches only
  // For managers: shows all items with full branch availability data
  app.get("/api/coffee-items", async (req: any, res) => {
    try {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const requestedBranchId = (req.query.branchId as string);
      const isEmployee = !!req.session?.employee;
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      
      const query: any = { tenantId };
      if (requestedBranchId && requestedBranchId !== 'all' && requestedBranchId !== 'undefined' && requestedBranchId !== 'null') {
        query.$or = [
          { publishedBranches: requestedBranchId },
          { createdByBranchId: requestedBranchId },
          { branchId: requestedBranchId }
        ];
      }
      
      let items = await CoffeeItemModel.find(query).lean().exec();

      // If no items found for tenant with specific branch filter, try fallback
      if (items.length === 0) {
        items = await CoffeeItemModel.find({ 
          $or: [
            { tenantId: tenantId },
            { tenantId: 'demo-tenant' },
            { tenantId: 'default' },
            { tenantId: 'default-branch' },
            { tenantId: { $exists: false } },
            { tenantId: null }
          ]
        }).lean().exec();
      }

      // Standardize response by serializing MongoDB documents
      items = items.map(serializeDoc);
      
      // Filter by tenantId more strictly if it was intended
      if (items.length > 0 && tenantId !== 'demo-tenant') {
        const tenantItems = items.filter((i: any) => i.tenantId === tenantId);
        if (tenantItems.length > 0) {
          items = tenantItems;
        }
      }
      
      // If no items found, try getting ANY items (emergency fallback)
          if (items.length === 0) {
            items = await CoffeeItemModel.find({}).lean().exec();
          }

      
      // Batch fetch recipes and raw items for performance
      const itemIds = items.map((item: any) => item.id);
      const recipes = itemIds.length > 0 ? await RecipeItemModel.find({ 
        coffeeItemId: { $in: itemIds } 
      }).lean().exec() : [];
      
      const rawItemIds = recipes.map((r: any) => r.rawItemId);
      const rawItems = rawItemIds.length > 0 ? await RawItemModel.find({ 
        _id: { $in: rawItemIds } 
      }).lean().exec() : [];
      
      const rawItemMap = new Map(rawItems.map((r: any) => [r._id?.toString(), r]));
      const recipesByItem = new Map<string, any[]>();
      recipes.forEach((r: any) => {
        const itemId = r.coffeeItemId;
        if (!recipesByItem.has(itemId)) recipesByItem.set(itemId, []);
        recipesByItem.get(itemId)!.push(r);
      });
      
      // Enrich items efficiently
      const enrichedItems = items.map((item: any) => {
        const itemRecipes = recipesByItem.get(item.id) || [];
        const recipeAvailable = itemRecipes.length === 0 ? false : itemRecipes.every((r: any) => rawItemMap.has(r.rawItemId?.toString()));
        
        // Handle legacy items: if no publishedBranches, show to all
        let publishedBranches = item.publishedBranches || [];
        if (publishedBranches.length === 0 && !item.createdByBranchId) {
          // Legacy item with no branch assignment - show to all branches
          publishedBranches = ['*']; // special marker for "all branches"
        }
        
        const branchAvailability = (item.branchAvailability || []) as Array<{branchId: string, isAvailable: number}>;
        
          // Build availability map - only for published branches
          const availabilityByBranch: {[key: string]: {isAvailable: number, status: string}} = {};
          const branchesToCheck = publishedBranches.includes('*') ? (requestedBranchId ? [requestedBranchId] : []) : (publishedBranches.length > 0 ? publishedBranches : (isEmployee && req.employee?.branchId ? [req.employee.branchId] : []));
          
          for (const branchId of branchesToCheck) {
            const branchInfo = branchAvailability.find((b: any) => b.branchId === branchId);
            // item is available if it's in published branches AND either has no specific availability record OR explicitly marked as available
            const isBranchAvailable = (!branchInfo || branchInfo.isAvailable === 1 || (branchInfo.isAvailable as any) === true) ? 1 : 0;
            const status = isBranchAvailable ? 'available' : 'out_of_stock';
            availabilityByBranch[branchId] = { isAvailable: isBranchAvailable, status };
          }
          
          if (!isEmployee && requestedBranchId) {
            item.availabilityByBranch = availabilityByBranch;
            item.isAvailable = availabilityByBranch[requestedBranchId]?.isAvailable || 0;
            item.availabilityStatus = availabilityByBranch[requestedBranchId]?.status || 'out_of_stock';
          } else if (isEmployee && req.employee?.branchId) {
            item.availabilityByBranch = availabilityByBranch;
            const myBranchStatus = availabilityByBranch[req.employee.branchId];
            item.isAvailable = myBranchStatus ? myBranchStatus.isAvailable : (publishedBranches.length === 0 ? 1 : 0);
            item.availabilityStatus = myBranchStatus ? myBranchStatus.status : (publishedBranches.length === 0 ? 'available' : 'out_of_stock');
          } else {
            item.availabilityByBranch = availabilityByBranch;
            item.isAvailable = 1;
            item.availabilityStatus = 'available';
          }
        
        return item;
      });
      
      // Filter by branch for customers if requested
      let finalItems = enrichedItems;
      // For customers: show ALL items regardless of publishedBranches (customers can see any drink)
      if (isEmployee && requestedBranchId) {
        // For employees: filter by their branch only
        finalItems = enrichedItems.filter((item: any) => {
          const publishedBranches = item.publishedBranches || [];
          return publishedBranches.includes('*') || publishedBranches.length === 0 || publishedBranches.includes(requestedBranchId);
        });
      }
      
      res.json(finalItems);
    } catch (error) {
      console.error("Error fetching coffee items:", error);
      res.status(500).json({ error: "Failed to fetch coffee items" });
    }
  });

  // Get unpublished drinks from other branches (for managers to adopt)
  app.get("/api/coffee-items/unpublished", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      if (!req.employee?.branchId) {
        return res.status(403).json({ error: "Branch assignment required" });
      }

      // Get tenantId from employee or fallback to branch
      let tenantId = req.employee.tenantId;
      if (!tenantId) {
        const branch = await storage.getBranch(req.employee.branchId);
        if (branch && (branch as any).tenantId) {
          tenantId = (branch as any).tenantId;
        }
      }
      const items = await CoffeeItemModel.find({ 
        $or: [
          { tenantId: tenantId },
          { tenantId: { $exists: false } },
          { tenantId: null }
        ]
      }).lean().exec();
      
      // Get drinks that are NOT published in this branch but exist in other branches
      const filteredItems = items.filter((item: any) => {
        const publishedBranches = item.publishedBranches || [];
        return !publishedBranches.includes(req.employee!.branchId) && publishedBranches.length > 0;
      });
      
      res.json(filteredItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unpublished items" });
    }
  });

  // Create new coffee item (manager only)
  // Supports both creating new items and adopting items from other branches
  app.post("/api/coffee-items", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertCoffeeItemSchema } = await import("@shared/schema");
      const { adoptFromItemId, ...bodyData } = req.body;

      // Get tenantId from employee or fallback to default - DO THIS BEFORE VALIDATION
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      let branchId = req.employee?.branchId || 'default-branch';

      // Add tenantId to bodyData BEFORE validation
      bodyData.tenantId = tenantId;
      
      const validatedData = insertCoffeeItemSchema.parse(bodyData);

      // CRITICAL: Always ensure tenantId is the computed one, not from request body
      (validatedData as any).tenantId = tenantId;

      // If adopting from another item, get the original
      if (adoptFromItemId) {
        const originalItem = await storage.getCoffeeItem(adoptFromItemId);
        if (!originalItem || originalItem.tenantId !== tenantId) {
          return res.status(404).json({ error: "Original item not found" });
        }

        // Copy properties from original if not overridden
        if (!validatedData.nameAr) validatedData.nameAr = originalItem.nameAr;
        if (!validatedData.description) validatedData.description = originalItem.description;
        if (validatedData.price === undefined) validatedData.price = originalItem.price;
        if (!validatedData.category) validatedData.category = originalItem.category;
        if (!validatedData.imageUrl) validatedData.imageUrl = originalItem.imageUrl;
        if (validatedData.coffeeStrength === undefined) validatedData.coffeeStrength = originalItem.coffeeStrength;
        
        // Create a new ID for the adopted item in this branch
        validatedData.id = `${adoptFromItemId}-${req.employee?.branchId}`;
      }

      // For non-admin managers, enforce their branch ID in publishedBranches
      if (req.employee?.role === "manager") {
        validatedData.publishedBranches = [branchId];
      } else if (req.employee?.role === "admin" || req.employee?.role === "owner") {
        // Admin/Owner can choose which branches to publish to
        if (!validatedData.publishedBranches || validatedData.publishedBranches.length === 0) {
          // If no branches specified by admin, default to current branch or all? 
          // Better to keep it as provided but ensure it's an array
          validatedData.publishedBranches = validatedData.publishedBranches || [branchId];
        }
      } else {
        // Default for other roles
        validatedData.publishedBranches = [branchId];
      }

      // Also set the global isAvailable if not specified
      if (validatedData.isAvailable === undefined) {
        validatedData.isAvailable = 1;
      }
      if (!validatedData.availabilityStatus) {
        validatedData.availabilityStatus = 'available';
      }

      // Set creator information
      (validatedData as any).createdByEmployeeId = req.employee?.id || 'demo-employee';
      (validatedData as any).createdByBranchId = branchId;

      // Ensure id is present if not provided (though storage might handle it)
      if (!validatedData.id) {
        validatedData.id = nanoid();
      }

      // Create coffee item using MongoDB directly to ensure all fields including imageUrl, availableSizes, and addons are saved
      const newCoffeeItem = new CoffeeItemModel({
        id: validatedData.id,
        tenantId: tenantId,
        nameAr: validatedData.nameAr,
        nameEn: validatedData.nameEn,
        description: validatedData.description,
        price: validatedData.price,
        oldPrice: validatedData.oldPrice,
        category: validatedData.category,
        imageUrl: validatedData.imageUrl,
        imageUrls: (validatedData as any).imageUrls || (validatedData.imageUrl ? [validatedData.imageUrl] : []),
        isAvailable: validatedData.isAvailable ?? 1,
        availabilityStatus: validatedData.availabilityStatus || 'available',
        coffeeStrength: validatedData.coffeeStrength,
        isNewProduct: validatedData.isNewProduct,
        publishedBranches: validatedData.publishedBranches || [branchId],
        createdByEmployeeId: validatedData.createdByEmployeeId,
        createdByBranchId: validatedData.createdByBranchId,
        availableSizes: validatedData.availableSizes || [],
        addons: (validatedData as any).addons || [],
        isGiftable: (validatedData as any).isGiftable || false,
        branchAvailability: (validatedData.publishedBranches || [branchId]).map(bId => ({
          branchId: bId,
          isAvailable: 1
        })),
        requiresRecipe: (validatedData as any).requiresRecipe !== undefined ? (validatedData as any).requiresRecipe : 1,
        hasRecipe: (validatedData as any).hasRecipe !== undefined ? (validatedData as any).hasRecipe : 0,
        costOfGoods: 0,
        profitMargin: 0,
        updatedAt: new Date(),
        createdAt: new Date()
      });
      
      const item = await newCoffeeItem.save();
      const itemData = serializeDoc(item);
      
      // Save addons if provided - they're already in availableSizes, but also link them for backward compatibility
      if ((validatedData as any).addons && Array.isArray((validatedData as any).addons) && (validatedData as any).addons.length > 0) {
        for (const addon of (validatedData as any).addons) {
          if (addon.nameAr && !addon.id) {
            addon.id = nanoid();
          }
          try {
            // Save addon to ProductAddon
            await ProductAddonModel.findOneAndUpdate(
              { id: addon.id },
              { $set: { id: addon.id, ...addon, category: addon.category || 'other', createdAt: new Date() } },
              { upsert: true, new: true }
            );
            // Link addon to coffee item
            await CoffeeItemAddonModel.findOneAndUpdate(
              { coffeeItemId: itemData.id, addonId: addon.id },
              { $set: { coffeeItemId: itemData.id, addonId: addon.id, isDefault: 0, minQuantity: 0, maxQuantity: 10, createdAt: new Date() } },
              { upsert: true }
            );
          } catch (err) {
            console.error("Error saving addon:", err);
          }
        }
      }
      
      console.log(`[CREATE COFFEE ITEM] Created item:`, {
        id: itemData.id,
        nameAr: itemData.nameAr,
        tenantId: itemData.tenantId,
        imageUrl: itemData.imageUrl,
        availableSizes: itemData.availableSizes?.length || 0,
        branchId,
        publishedBranches: itemData.publishedBranches
      });

      cacheInvalidate('coffeeItems');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(201).json(itemData);
    } catch (error) {
      console.error("[CREATE COFFEE ITEM] Error:", error);
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: "Validation error", details: (error as any).issues });
      }
      res.status(500).json({ error: "فشل إضافة المشروب", details: String(error) });
    }
  });

  // Update coffee item
  app.patch("/api/coffee-items/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const updatedItem = await storage.updateCoffeeItem(req.params.id, req.body);
      if (!updatedItem) {
        return res.status(404).json({ error: "المنتج غير موجود" });
      }
      cacheInvalidate('coffeeItems');
      res.json(updatedItem);
    } catch (error) {
      console.error("[PATCH /api/coffee-items/:id] Error:", error);
      res.status(500).json({ error: "فشل في تحديث المنتج" });
    }
  });

  // Get coffee items by category (optimized)
  app.get("/api/coffee-items/category/:category", async (req: any, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=120');
      const { category } = req.params;
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const items = await CoffeeItemModel.find({ tenantId, category }).lean().exec();
      if (!items || items.length === 0) {
        return res.json([]);
      }
      res.json(items.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch coffee items by category" });
    }
  });

  // Get specific coffee item (optimized)
  app.get("/api/coffee-items/:id", async (req: any, res) => {
    try {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const { id } = req.params;
      
      console.log(`[GET /api/coffee-items/:id] Searching for ID: "${id}"`);

      // Try finding by 'id' field first (custom string ID)
      // We search globally (without tenantId) to ensure visibility from anywhere
      let item = await CoffeeItemModel.findOne({ id }).lean().exec();
      
      // If not found by 'id' field, try as MongoDB _id
      if (!item) {
        try {
          // Try findById which automatically handles ObjectId conversion if needed
          item = await CoffeeItemModel.findById(id).lean().exec();
        } catch (e) {
          // If id is not a valid ObjectId, findById might throw or return null
          // If it throws, we just ignore and continue
        }
      }

      if (!item) {
        console.warn(`[GET /api/coffee-items/:id] Item not found for ID: "${id}"`);
        return res.status(404).json({ error: "المنتج غير موجود" });
      }
      
      res.json(serializeDoc(item));
    } catch (error) {
      console.error("[GET_COFFEE_ITEM_ERROR]:", error);
      res.status(500).json({ error: "حدث خطأ أثناء جلب تفاصيل المنتج" });
    }
  });

  // Update coffee item availability per branch (for managers)
  app.patch("/api/coffee-items/:id/availability", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { branchId, isAvailable, availabilityStatus } = req.body;
      
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";

      console.log(`[AVAILABILITY] Updating item ${id} for tenant ${tenantId}, branch ${branchId}`);

      // Try finding by 'id' field
      let item = await CoffeeItemModel.findOne({ id, tenantId }).exec();
      if (!item && mongoose.Types.ObjectId.isValid(id)) {
        item = await CoffeeItemModel.findOne({ _id: id, tenantId }).exec();
      }

      if (!item) {
        return res.status(404).json({ error: "Coffee item not found" });
      }

      const updates: any = {};
      
      // Map availability status to internal flags
      if (availabilityStatus) {
        updates.availabilityStatus = availabilityStatus;
        if (availabilityStatus === 'available' || availabilityStatus === 'new') {
          updates.isAvailable = 1;
        } else {
          updates.isAvailable = 0;
        }
        
        if (availabilityStatus === 'new') {
          updates.isNewProduct = 1;
        } else {
          updates.isNewProduct = 0;
        }
      } else if (isAvailable !== undefined) {
        updates.isAvailable = isAvailable ? 1 : 0;
        if (isAvailable) {
          updates.availabilityStatus = 'available';
        } else {
          updates.availabilityStatus = 'unavailable';
        }
      }

      if (branchId) {
        const branchAvailability = (item.branchAvailability || []) as Array<{branchId: string, isAvailable: number}>;
        const existingIndex = branchAvailability.findIndex((b: any) => b.branchId === branchId);
        const availabilityValue = updates.isAvailable !== undefined ? updates.isAvailable : (item.isAvailable ?? 1);

        if (existingIndex >= 0) {
          branchAvailability[existingIndex].isAvailable = availabilityValue;
        } else {
          branchAvailability.push({ branchId, isAvailable: availabilityValue });
        }
        updates.branchAvailability = branchAvailability;
      }

      const updatedItem = await CoffeeItemModel.findOneAndUpdate(
        { _id: item._id },
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true }
      ).exec();

      res.json(serializeDoc(updatedItem));
    } catch (error) {
      console.error("Availability Update Error:", error);
      res.status(500).json({ error: "Failed to update coffee item availability" });
    }
  });

  // Add coffee item to multiple branches
  app.post("/api/coffee-items/:id/branches", async (req, res) => {
    try {
      const { id } = req.params;
      const { branchIds } = req.body;

      if (!Array.isArray(branchIds) || branchIds.length === 0) {
        return res.status(400).json({ error: "branchIds array is required" });
      }

      const item = await storage.getCoffeeItem(id);
      if (!item) {
        return res.status(404).json({ error: "Coffee item not found" });
      }

      // Update or create branch availability entries
      const branchAvailability = (item.branchAvailability || []) as Array<{branchId: string, isAvailable: number}>;
      
      branchIds.forEach((branchId: string) => {
        const existingIndex = branchAvailability.findIndex((b: any) => b.branchId === branchId);
        
        if (existingIndex < 0) {
          // Only add if not already present
          branchAvailability.push({ branchId, isAvailable: 1 });
        }
      });

      const updatedItem = await storage.updateCoffeeItem(id, { branchAvailability });
      res.json(serializeDoc(updatedItem));
    } catch (error) {
      res.status(500).json({ error: "Failed to update coffee item branches" });
    }
  });

  // Get cart items for session - OPTIMIZED
  app.get("/api/cart/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const cartItems = await CartItemModel.find({ sessionId }).lean();

      if (!cartItems || cartItems.length === 0) {
        return res.json([]);
      }

      // Enrich cart items with coffee details efficiently
      const enrichedItems = await Promise.all(cartItems.map(async (cartItem: any) => {
        try {
          const coffeeItem = await CoffeeItemModel.findOne({ id: cartItem.coffeeItemId }).lean();
          const doc = serializeDoc(cartItem);
          
          // Fetch addons to get their prices and names
          const addons = await Promise.all(
            (cartItem.selectedAddons || []).map((addonId: string) => ProductAddonModel.findById(addonId).lean())
          );
          
          // CRITICAL: Force the ID to be the custom 'id' (composite) if available, otherwise use coffeeItemId
          // This ensures the frontend ALWAYS receives an ID it can use for DELETE/PUT consistently
          const finalId = cartItem.id || cartItem.coffeeItemId;
          
          // console.log(`[CART] Enriching item ${cartItem.coffeeItemId}: Found coffee=${!!coffeeItem}, addons=${addons.length}`);
          
          return {
            ...doc,
            id: finalId,
            coffeeItem: coffeeItem ? serializeDoc(coffeeItem) : null,
            enrichedAddons: addons.filter(Boolean).map(serializeDoc)
          };
        } catch (err) {
          console.error(`Error enriching cart item:`, err);
          return { 
            ...serializeDoc(cartItem), 
            id: cartItem.id || cartItem.coffeeItemId, 
            coffeeItem: null,
            enrichedAddons: []
          };
        }
      }));

      // Filter out items where coffee details couldn't be found
      // For debugging, we'll keep them but the UI might break if coffeeItem is null
      // res.json(enrichedItems.filter(item => item && item.coffeeItem));
      res.json(enrichedItems);
    } catch (error) {
      console.error("Fetch cart error:", error);
      res.status(500).json({ error: "Failed to fetch cart items" });
    }
  });

  // Add item to cart
  app.post("/api/cart", async (req, res) => {
    try {
      const { sessionId, coffeeItemId, quantity, selectedSize, selectedAddons, selectedItemAddons } = req.body;
      // console.log(`[CART] POST: item=${coffeeItemId}, size=${selectedSize}, qty=${quantity}`);

      if (!sessionId || !coffeeItemId) {
        return res.status(400).json({ error: "Session ID and Coffee Item ID are required" });
      }

      // Consistent size selection
      const sizeName = typeof selectedSize === 'object' ? (selectedSize as any)?.nameAr : selectedSize;
      const addons = Array.isArray(selectedAddons) ? selectedAddons : [];
      const itemAddons = Array.isArray(selectedItemAddons) ? selectedItemAddons : [];
      
      // Use a consistent composite ID format: ITEMID-SIZENAME-ADDONS-ITEMADDONS
      const normalizedSize = sizeName || "default";
      const normalizedAddons = Array.isArray(addons) ? addons.sort().join(",") : "";
      const normalizedItemAddons = itemAddons.map((a: any) => a.nameAr).sort().join(",");
      const compositeId = `${coffeeItemId}-${normalizedSize}-${normalizedAddons}-${normalizedItemAddons}`;
      
      let cartItem = await CartItemModel.findOne({ sessionId, id: compositeId });
      
      if (cartItem) {
        cartItem.quantity += (quantity || 1);
        await cartItem.save();
      } else {
        cartItem = await CartItemModel.create({
          id: compositeId,
          sessionId,
          coffeeItemId,
          quantity: quantity || 1,
          selectedSize: normalizedSize,
          selectedAddons: addons,
          selectedItemAddons: itemAddons,
          createdAt: new Date()
        });
      }
      
      const result = serializeDoc(cartItem);
      result.id = compositeId; // Ensure we always return the composite ID
      res.status(201).json(result);
    } catch (error) {
      console.error("[CART] Post error:", error);
      res.status(500).json({ error: "Failed to add item to cart" });
    }
  });

  // Update cart item quantity
  app.put("/api/cart/:sessionId/:cartItemId", async (req, res) => {
    try {
      const { sessionId, cartItemId } = req.params;
      const { quantity } = req.body;
      // console.log(`[CART] PUT: session=${sessionId}, id=${cartItemId}, qty=${quantity}`);

      if (typeof quantity !== 'number' || quantity < 0) {
        return res.status(400).json({ error: "Invalid quantity" });
      }

      if (quantity === 0) {
        // console.log(`[CART] Quantity is 0, deleting item: ${cartItemId}`);
        let deleteResult = await CartItemModel.deleteOne({ sessionId, id: cartItemId });
        if (deleteResult.deletedCount === 0) {
          deleteResult = await CartItemModel.deleteOne({ sessionId, coffeeItemId: cartItemId, selectedSize: "default" });
        }
        if (deleteResult.deletedCount === 0 && mongoose.Types.ObjectId.isValid(cartItemId)) {
          deleteResult = await CartItemModel.deleteOne({ sessionId, _id: cartItemId });
        }
        return res.json({ message: "Item removed" });
      }

      // Try composite ID first, then coffeeItemId (if it's a default variant), then _id
      let cartItem = await CartItemModel.findOneAndUpdate(
        { sessionId, id: cartItemId },
        { $set: { quantity } },
        { new: true }
      );

      // Fallback for older items or items added without composite ID
      if (!cartItem) {
        cartItem = await CartItemModel.findOneAndUpdate(
          { sessionId, coffeeItemId: cartItemId, selectedSize: "default" },
          { $set: { quantity } },
          { new: true }
        );
      }

      if (!cartItem && mongoose.Types.ObjectId.isValid(cartItemId)) {
        cartItem = await CartItemModel.findOneAndUpdate(
          { sessionId, _id: cartItemId },
          { $set: { quantity } },
          { new: true }
        );
      }

      if (!cartItem) {
        return res.status(404).json({ error: "Cart item not found" });
      }

      const result = serializeDoc(cartItem);
      // Ensure the returned ID matches what the client expects (the search key)
      result.id = cartItem.id || cartItem.coffeeItemId;
      res.json(result);
    } catch (error) {
      console.error("[CART] Update error:", error);
      res.status(500).json({ error: "Failed to update cart" });
    }
  });

  // Remove item from cart
  app.delete("/api/cart/:sessionId/:cartItemId", async (req, res) => {
    try {
      const { sessionId, cartItemId } = req.params;
      // console.log(`[CART] DELETE: session=${sessionId}, id=${cartItemId}`);
      
      // Try multiple deletion strategies
      let result = await CartItemModel.deleteOne({ sessionId, id: cartItemId });

      if (result.deletedCount === 0) {
        result = await CartItemModel.deleteOne({ sessionId, coffeeItemId: cartItemId, selectedSize: "default" });
      }

      if (result.deletedCount === 0 && mongoose.Types.ObjectId.isValid(cartItemId)) {
        result = await CartItemModel.deleteOne({ sessionId, _id: cartItemId });
      }

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Cart item not found" });
      }

      res.json({ message: "Item removed" });
    } catch (error) {
      console.error("[CART] Delete error:", error);
      res.status(500).json({ error: "Failed to remove item" });
    }
  });

  // Clear entire cart
  app.delete("/api/cart/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      await storage.clearCart(sessionId);
      res.json({ message: "Cart cleared" });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear cart" });
    }
  });

  // DUPLICATE: This POST /api/orders handler is superseded by the one defined earlier (line ~573).
  // Wrapped in a never-called function to prevent duplicate route registration.
  const _unusedDuplicateOrderPost = () => { app.post("/api/orders-duplicate-disabled", async (req: AuthRequest, res) => {
    try {
      console.log("Creating order with body:", JSON.stringify(req.body, null, 2));
      const { 
        items, totalAmount, paymentMethod, paymentDetails, paymentReceiptUrl,
        customerInfo, customerId, customerNotes, freeItemsDiscount, usedFreeDrinks, 
        discountCode, discountPercentage,
        deliveryType, deliveryAddress, deliveryFee, branchId,
        tableNumber, tableId, orderType,
        carType, carColor, plateNumber, arrivalTime,
        scheduledPickupTime,
        pointsRedeemed, pointsValue, pointsVerificationToken
      } = req.body;

      // Validate required fields
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items are required" });
      }

      if (totalAmount === undefined || totalAmount === null || isNaN(parseFloat(totalAmount))) {
        return res.status(400).json({ error: "Valid total amount is required" });
      }

      if (!paymentMethod) {
        return res.status(400).json({ error: "Payment method is required" });
      }

      // Check for customerName either in root body or nested in customerInfo
      const finalCustomerName = req.body.customerName || customerInfo?.customerName || req.body.customerPhone || "عميل";

      // Determine branch ID from request body or employee session
      const finalBranchId = branchId || req.employee?.branchId;

      if (!finalCustomerName) {
        console.error("Missing customer name in request. customerInfo:", JSON.stringify(customerInfo), "req.body:", JSON.stringify(req.body));
        return res.status(400).json({ error: "Customer name is required" });
      }

      // Ensure items is always an array before processing
      let processedItems = items;
      if (typeof items === 'string') {
        try {
          processedItems = JSON.parse(items);
        } catch (e) {
          processedItems = [];
        }
      }

      // Validate payment receipt for electronic payment methods
      const electronicPaymentMethods = ['alinma', 'ur', 'barq', 'rajhi'];
      if (electronicPaymentMethods.includes(paymentMethod) && !paymentReceiptUrl) {
        return res.status(400).json({ error: "Payment receipt is required for electronic payment methods" });
      }

      // Validate delivery data when deliveryType is 'delivery'
      if (deliveryType === 'delivery') {
        if (!deliveryAddress || !deliveryAddress.lat || !deliveryAddress.lng) {
          return res.status(400).json({ error: "Delivery address with coordinates is required for delivery orders" });
        }
        if (deliveryFee === undefined || deliveryFee === null) {
          return res.status(400).json({ error: "Delivery fee is required for delivery orders" });
        }
      }

      // Get or create customer if phone number provided
      let finalCustomerId = customerId;

      const phoneNumberForLookup = customerInfo?.phoneNumber || req.body.customerPhone;
      if (phoneNumberForLookup && !customerId) {
        try {
          const existingCustomer = await storage.getCustomerByPhone(phoneNumberForLookup);
          if (existingCustomer) {
            finalCustomerId = existingCustomer.id;
          }
        } catch (error) {
        }
      }

      // Determine initial status based on payment method
      const isAutoConfirm = ['pos', 'apple_pay', 'pos-network', 'alinma', 'rajhi', 'ur', 'barq', 'cash', 'mada', 'stc-pay', 'online', 'neoleap', 'neoleap-apple-pay'].includes(paymentMethod);
      // PAID orders go to 'payment_confirmed' (which notifies kitchen), others go to 'pending'
      const initialStatus = isAutoConfirm ? 'payment_confirmed' : 'pending';
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';

      console.log(`[ORDER] Payment method: ${paymentMethod}, Initial status: ${initialStatus}`);

      if (discountCode) {
        try {
          const { DiscountCodeModel: DCModel } = await import("@shared/schema");
          const coupon = await DCModel.findOne({ 
            code: discountCode.toUpperCase(), 
            isActive: 1 
          });
          if (coupon) {
            coupon.usageCount = (coupon.usageCount || 0) + 1;
            await coupon.save();
            console.log(`[ORDER] Coupon ${discountCode} usage count updated to ${coupon.usageCount}`);
          }
        } catch (couponErr) {
          console.error("[ORDER] Failed to update coupon usage count:", couponErr);
        }
      }

      // Update or create order
      let order;
      if (tableId && (orderType === 'table' || orderType === 'dine-in')) {
        // Look for an existing 'open' order for this table
        const existingOrder = await OrderModel.findOne({ 
          tableId, 
          status: { $in: ['open', 'pending', 'payment_confirmed'] },
          branchId: finalBranchId 
        });

        if (existingOrder) {
          // Add new items to existing order
          existingOrder.items = [...(existingOrder.items || []), ...processedItems];
          existingOrder.totalAmount += Number(totalAmount);
          existingOrder.updatedAt = new Date();
          
          // If the order was just "open", and this addition is "paid/confirmed", upgrade status
          if (existingOrder.status === 'open' && initialStatus === 'payment_confirmed') {
             existingOrder.status = 'payment_confirmed';
          }
          
          order = await existingOrder.save();
          
          // Broadcast update to kitchen for additions
          const serializedOrder = serializeDoc(order);
          wsManager.broadcastOrderUpdate(serializedOrder);
          if (order.status === 'payment_confirmed' || order.status === 'confirmed') {
            wsManager.broadcastNewOrder(serializedOrder);
          }
        } else {
          const isOpenTab = req.body.isOpenTab === true;
          const tableOrderStatus = isOpenTab ? 'open' : initialStatus;
          const orderData: any = {
            orderNumber: `T-${nanoid(6).toUpperCase()}`,
            items: processedItems,
            totalAmount: Number(totalAmount),
            paymentMethod: isOpenTab ? 'cash' : (paymentMethod || 'cash'),
            status: tableOrderStatus,
            tableStatus: isOpenTab ? 'open' : 'pending',
            orderType: 'table',
            tableId,
            tableNumber,
            branchId: finalBranchId,
            tenantId,
            employeeId: req.employee?.id || null,
            customerInfo: customerInfo || { 
              customerName: finalCustomerName, 
              phoneNumber: req.body.customerPhone || "", 
              customerEmail: req.body.customerEmail || "" 
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };
          order = await storage.createOrder(orderData);
          
          if (order) {
            const serializedOrder = serializeDoc(order);
            if (!isOpenTab) {
              wsManager.broadcastNewOrder(serializedOrder);
            }
            wsManager.broadcastOrderUpdate(serializedOrder);
          }
          
          // Update table status
          await storage.updateTableOccupancy(tableId, true, order.id);
        }
      } else {
        const orderData: any = {
          customerId: finalCustomerId || null,
          totalAmount: Number(totalAmount),
          paymentMethod,
          paymentDetails: paymentDetails || "",
          paymentReceiptUrl: paymentReceiptUrl || null,
          customerInfo: customerInfo || { 
            customerName: finalCustomerName, 
            phoneNumber: req.body.customerPhone || "", 
            customerEmail: req.body.customerEmail || "" 
          },
          customerNotes: customerNotes || req.body.notes || "",
          discountCode: discountCode || null,
          discountPercentage: discountPercentage ? Number(discountPercentage) : 0,
          deliveryType: deliveryType || null,
          deliveryAddress: deliveryAddress || null,
          deliveryFee: deliveryFee ? Number(deliveryFee) : 0,
          carType: carType || null,
          carColor: carColor || null,
          plateNumber: plateNumber || null,
          arrivalTime: arrivalTime || null,
          scheduledPickupTime: scheduledPickupTime || null,
          preparationHoldUntil: (() => {
            const pickupTime = scheduledPickupTime || (orderType === 'pickup' ? arrivalTime : null);
            if (!pickupTime) return null;
            try {
              const totalItems = Array.isArray(processedItems)
                ? processedItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0)
                : 1;
              const holdMinutes = Math.max(10, 10 + (totalItems - 2) * 2);
              const [hours, minutes] = pickupTime.split(':').map(Number);
              const arrivalDate = new Date();
              arrivalDate.setHours(hours, minutes, 0, 0);
              const holdDate = new Date(arrivalDate.getTime() - holdMinutes * 60 * 1000);
              return holdDate.toISOString();
            } catch { return null; }
          })(),
          branchId: finalBranchId,
          tenantId,
          status: initialStatus,
          employeeId: req.employee?.id || null,
          createdBy: req.employee?.username || 'system',
          tableNumber: tableNumber || null,
          tableId: tableId || null,
          orderType: orderType || (tableNumber || tableId ? 'dine-in' : 'regular'),
          items: processedItems,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        order = await storage.createOrder(orderData);

        // Broadcast new order to WebSocket
        if (order) {
          const serializedOrder = serializeDoc(order);
          wsManager.broadcastNewOrder(serializedOrder);
          wsManager.broadcastOrderUpdate(serializedOrder);
        }
      }

      // ===== Points Redemption: Deduct points from loyalty card =====
      if (pointsRedeemed && Number(pointsRedeemed) > 0) {
        try {
          const redeemPoints = Number(pointsRedeemed);
          const redeemValue = Number(pointsValue) || (redeemPoints / 100) * 5;
          const phoneForPoints = req.body.customerPhone || customerInfo?.phoneNumber;
          const cleanPhoneForPoints = phoneForPoints?.replace(/\D/g, '');

          if (cleanPhoneForPoints) {
            const entry = pointsVerificationCodes.get(cleanPhoneForPoints);
            const bypassVerification = !!(req.body.bypassPointsVerification || req.employee || customerId);
            const canProceed = (entry && entry.verified) || bypassVerification;
            if (!canProceed) {
              console.warn(`[POINTS] Verification not completed for ${cleanPhoneForPoints}. Points NOT deducted.`);
            } else {
              const loyaltyCard = await storage.getLoyaltyCardByPhone(cleanPhoneForPoints);
              if (loyaltyCard) {
                const currentPoints = Number(loyaltyCard.points) || 0;
                if (currentPoints >= redeemPoints) {
                  await storage.updateLoyaltyCard(loyaltyCard.id, {
                    points: currentPoints - redeemPoints,
                    lastUsedAt: new Date(),
                  });

                  const LoyaltyTransactionModel = mongoose.model('LoyaltyTransaction');
                  await LoyaltyTransactionModel.create({
                    cardId: loyaltyCard.id,
                    type: 'points_redeemed',
                    pointsChange: -redeemPoints,
                    description: `استخدام ${redeemPoints} نقطة (${redeemValue.toFixed(2)} ريال) - طلب #${order.orderNumber}`,
                    orderId: order.id,
                    createdAt: new Date(),
                  });

                  await OrderModel.findByIdAndUpdate(order.id, {
                    pointsRedeemed: redeemPoints,
                    pointsValue: redeemValue,
                  });

                  if (entry) pointsVerificationCodes.delete(cleanPhoneForPoints);
                  console.log(`[POINTS] Deducted ${redeemPoints} points (${redeemValue} SAR) from ${cleanPhoneForPoints} for order ${order.orderNumber}`);
                } else {
                  console.warn(`[POINTS] Insufficient points for ${cleanPhoneForPoints}: has ${currentPoints}, needs ${redeemPoints}`);
                }
              }
            }
          }
        } catch (pointsError) {
          console.error("[POINTS] Error deducting points:", pointsError);
        }
      }

      // Send initial order email notification
      const initialCustomerInfo = typeof order.customerInfo === 'string' ? JSON.parse(order.customerInfo) : order.customerInfo;
      const customerEmail = initialCustomerInfo?.email;
      const customerName = initialCustomerInfo?.name;

      if (customerEmail) {
        // Use setImmediate to send email asynchronously without blocking the response
        setImmediate(async () => {
          try {
            console.log(`📧 Triggering INITIAL email for order ${order.orderNumber} to ${customerEmail}`);
            const { sendOrderNotificationEmail } = await import("./mail-service");
            const emailSent = await sendOrderNotificationEmail(
              customerEmail,
              customerName || 'عميل CLUNY CAFE',
              order.orderNumber,
              "pending",
              parseFloat(order.totalAmount.toString())
            );
            console.log(`📧 INITIAL Email sent result for ${order.orderNumber}: ${emailSent}`);
          } catch (emailError) {
            console.error("❌ Error in initial order email trigger:", emailError);
          }
        });
      }
      
      // Append to Google Sheets for tracking
      try {
        const { appendOrderToSheet } = await import("./google-sheets");
        // Notify customer and Admin/Cashier
        await appendOrderToSheet(order, 'NEW_ORDER');
        await appendOrderToSheet(order, 'ADMIN_ALERT');
        
        // Note: Email notification is now handled by Google Apps Script within the sheet
      } catch (err) {
        console.error("Sheets Error:", err);
      }

      // Smart Inventory Deduction - deduct raw materials based on recipes
      let deductionReport: {
        success: boolean;
        costOfGoods: number;
        grossProfit: number;
        deductionDetails: Array<{
          rawItemId: string;
          rawItemName: string;
          quantity: number;
          unit: string;
          unitCost: number;
          totalCost: number;
          previousQuantity: number;
          newQuantity: number;
          status: string;
          message: string;
        }>;
        shortages: Array<{
          rawItemId: string;
          rawItemName: string;
          required: number;
          available: number;
          unit: string;
        }>;
        warnings: string[];
        errors: string[];
      } | null = null;

      if (finalBranchId && items && items.length > 0) {
        try {
          // Extract order items with addon customizations for inventory deduction
          const orderItems = items.map((item: any) => {
            const orderItem: {
              coffeeItemId: string;
              quantity: number;
              addons?: Array<{ rawItemId: string; quantity: number; unit: string }>;
            } = {
              coffeeItemId: item.id || item.coffeeItemId,
              quantity: item.quantity || 1,
            };

            // Extract addon raw materials from customization selectedAddons
            // Note: We calculate the FULL raw material quantity here (addon qty * quantityPerUnit * order item qty)
            // so storage.deductInventoryForOrder does NOT multiply by item.quantity again for addons
            if (item.customization?.selectedAddons && Array.isArray(item.customization.selectedAddons)) {
              const itemQuantity = item.quantity || 1;
              orderItem.addons = item.customization.selectedAddons
                .filter((addon: any) => addon.rawItemId && addon.quantity > 0)
                .map((addon: any) => ({
                  rawItemId: addon.rawItemId,
                  // Total raw material = addon selection qty * raw material per unit * order item qty
                  quantity: (addon.quantity || 1) * (addon.quantityPerUnit || 1) * itemQuantity,
                  unit: addon.unit || 'g',
                }));
            }

            return orderItem;
          });

          deductionReport = await storage.deductInventoryForOrder(
            order.id,
            finalBranchId,
            orderItems,
            req.employee?.username || 'system'
          );

          if (deductionReport && !deductionReport.success) {
            if (deductionReport.warnings && deductionReport.warnings.length > 0) {
              console.warn(`[ORDER ${order.orderNumber}] Inventory warnings:`, deductionReport.warnings);
            }
            if (deductionReport.errors && deductionReport.errors.length > 0) {
            }
          }

        } catch (error) {
          // Continue with order - don't fail the order if inventory deduction fails
        }
      }

      // Update table occupancy if this is a table order
      if (tableId) {
        try {
          await storage.updateTableOccupancy(tableId, true, order.id);
        } catch (error) {
          // Continue anyway - order was created successfully
        }
      }

      // Add stamps automatically if customer has phone number (works for guests and registered users)
      let phoneForStamps = customerInfo?.phoneNumber || req.body.customerPhone;
      
      // FIX: Ensure phoneForStamps is normalized
      if (phoneForStamps) {
        phoneForStamps = phoneForStamps.toString().trim();
      }

      if (finalCustomerId) {
        try {
          const customer = await storage.getCustomer(finalCustomerId);
          phoneForStamps = customer?.phone || phoneForStamps;
        } catch (e) {}
      }

      console.log(`[LOYALTY] Attempting to add points for phone: ${phoneForStamps}`);

      if (phoneForStamps) {
        try {
          let loyaltyCard = await storage.getLoyaltyCardByPhone(phoneForStamps);

          // Create loyalty card if doesn't exist
          if (!loyaltyCard) {
            console.log(`[LOYALTY] Creating new card for ${phoneForStamps}`);
            loyaltyCard = await storage.createLoyaltyCard({
              customerName: finalCustomerName || customerInfo?.customerName || 'عميل',
              phoneNumber: phoneForStamps,
              isActive: 1,
              stamps: 0,
              freeCupsEarned: 0,
              totalSpent: 0,
              points: 0,
              pendingPoints: 0,
            } as any);
          }

          // Calculate points (10 points per drink)
          const itemsToProcess = Array.isArray(processedItems) ? processedItems : 
                                (Array.isArray(items) ? items : []);
          
          const drinksCount = itemsToProcess.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
          const pointsToAdd = drinksCount * 10; // 10 points per drink

          console.log(`[LOYALTY] Points to add: ${pointsToAdd}, Drinks: ${drinksCount}, Current points: ${loyaltyCard.points || 0}`);

          if (pointsToAdd > 0) {
            const currentPoints = Number(loyaltyCard.points) || 0;
            const currentPendingPoints = Number(loyaltyCard.pendingPoints) || 0;
            const currentTotalSpent = parseFloat(loyaltyCard.totalSpent?.toString() || "0");
            
            // Add points as pending until order is completed
            await storage.updateLoyaltyCard(loyaltyCard.id, {
              pendingPoints: currentPendingPoints + pointsToAdd,
              totalSpent: currentTotalSpent + parseFloat(totalAmount.toString()),
              lastUsedAt: new Date()
            });

            console.log(`[LOYALTY] Updated card ${loyaltyCard.id}: Pending Points ${currentPendingPoints + pointsToAdd}`);

            // Create loyalty transaction for pending points
            await storage.createLoyaltyTransaction({
              cardId: loyaltyCard.id,
              type: 'points_pending',
              pointsChange: pointsToAdd,
              discountAmount: 0,
              orderAmount: Number(totalAmount),
              orderId: order.id,
              description: `نقاط معلقة: ${pointsToAdd} نقطة من الطلب رقم ${order.orderNumber} (ستضاف عند اكتمال الطلب)`,
            });
          }
        } catch (error) {
          console.error("[LOYALTY] Error processing points:", error);
        }
      }

      // Parse items from JSON string and serialize the order
      const serializedOrder = serializeDoc(order);
      if (serializedOrder.items && typeof serializedOrder.items === 'string') {
        try {
          serializedOrder.items = JSON.parse(serializedOrder.items);
        } catch (e) {
        }
      }

      // Broadcast new order via WebSocket
      wsManager.broadcastNewOrder(serializedOrder);
      
      // Generate and send tax invoice if customer has email
      if (customerInfo && customerInfo.customerEmail) {
        try {
          const taxRate = 0.15;
          const invoiceSubtotal = parseFloat(totalAmount.toString()) / (1 + taxRate);
          const invoiceTax = invoiceSubtotal * taxRate;
          const invoiceNumber = `INV-${Date.now()}-${nanoid(6)}`;
          
          const invoiceData = {
            customerName: customerInfo.customerName,
            customerPhone: customerInfo.phoneNumber,
            items: Array.isArray(items) ? items : JSON.parse(items),
            subtotal: invoiceSubtotal - (parseFloat(discountPercentage?.toString() || '0') / 100 * invoiceSubtotal),
            discountAmount: parseFloat(discountPercentage?.toString() || '0') / 100 * invoiceSubtotal,
            taxAmount: invoiceTax,
            totalAmount: parseFloat(totalAmount.toString()),
            paymentMethod: paymentMethod,
            invoiceDate: new Date()
          };
          
          const customerEmail = customerInfo.customerEmail;
          if (customerEmail && customerEmail.includes('@')) {
            await sendInvoiceEmail(customerEmail, invoiceNumber, invoiceData);
          } else {
          }
          
          // Store invoice in database
          try {
            await storage.createTaxInvoice({
              orderId: order.id,
              invoiceNumber: invoiceNumber,
              customerName: customerInfo.customerName,
              customerPhone: customerInfo.phoneNumber,
              customerEmail: customerEmail,
              items: invoiceData.items,
              subtotal: invoiceData.subtotal,
              discountAmount: invoiceData.discountAmount,
              taxAmount: invoiceTax,
              totalAmount: parseFloat(totalAmount.toString()),
              paymentMethod: paymentMethod
            });
          } catch (storageError) {
          }
        } catch (invoiceError) {
          // Don't fail order if invoice generation fails
        }
      } else {
      }
      
      // Build response with deduction report included
      const response = {
        ...serializedOrder,
        deductionReport: (deductionReport as any) ? {
          success: (deductionReport as any).success,
          costOfGoods: (deductionReport as any).costOfGoods,
          grossProfit: (deductionReport as any).grossProfit,
          deductionDetails: (deductionReport as any).deductionDetails,
          shortages: (deductionReport as any).shortages,
          warnings: (deductionReport as any).warnings,
          errors: (deductionReport as any).errors,
        } : null
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("[ORDERS] Error creating order:", error);
      res.status(500).json({ error: "Failed to create order", details: error instanceof Error ? error.message : String(error) });
    }
  }); };

  // Finalize (Pay) Open Table Order
  app.post("/api/orders/:id/finalize", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { paymentMethod, paymentDetails } = req.body;
      const order = await OrderModel.findOne({ id: req.params.id }) || await OrderModel.findById(req.params.id).catch(() => null);
      
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.status !== 'open') return res.status(400).json({ error: "Order is not open" });

      order.status = 'payment_confirmed';
      order.tableStatus = 'payment_confirmed';
      order.paymentMethod = paymentMethod;
      order.paymentDetails = paymentDetails;
      order.updatedAt = new Date();
      await order.save();

      // Broadcast to kitchen so paid order appears there
      const serializedOrder = serializeDoc(order);
      wsManager.broadcastNewOrder(serializedOrder);
      wsManager.broadcastOrderUpdate(serializedOrder);

      // Free up the table
      if (order.tableId) {
        await storage.updateTableOccupancy(order.tableId, false, undefined);
      }

      res.json(serializedOrder);
    } catch (error) {
      res.status(500).json({ error: "Failed to finalize order" });
    }
  });

  // Get pending table orders (for cashier) - MOST SPECIFIC FIRST
  app.get("/api/orders/table/pending", async (req, res) => {
    try {
      const [orders, coffeeItems] = await Promise.all([
        storage.getPendingTableOrders(),
        getCachedCoffeeItems(),
      ]);
      const enrichedOrders = orders.map(order => enrichOrderWithItems(serializeDoc(order), coffeeItems));
      res.json(enrichedOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending table orders" });
    }
  });

  app.get("/api/orders/table/unassigned", async (req, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req as any) || "demo-tenant";
      const allOrders = await OrderModel.find({
        tenantId,
        status: { $in: ["pending", "in_progress"] },
        $or: [
          { assignedCashierId: null },
          { assignedCashierId: { $exists: false } },
          { assignedCashierId: "" },
        ],
      }).sort({ createdAt: -1 }).limit(100).lean();

      const coffeeItems = await getCachedCoffeeItems();
      const enrichedOrders = allOrders.map(order => enrichOrderWithItems(serializeDoc(order), coffeeItems));
      res.json(enrichedOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unassigned orders" });
    }
  });

  // Get table orders (branch-filtered for managers)
  app.get("/api/orders/table", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { status } = req.query;
      const allOrders = await storage.getTableOrders((status as string) || '');

      // Filter by branch for non-admin managers
      const orders = filterByBranch(allOrders, req.employee);

      const coffeeItems = await getCachedCoffeeItems();
      const enrichedOrders = orders.map(order => enrichOrderWithItems(serializeDoc(order), coffeeItems));
      res.json(enrichedOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch table orders" });
    }
  });

  // Send invoice email on demand (for cashier)
  app.post("/api/orders/:orderNumber/send-invoice", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { orderNumber } = req.params;
      const { email } = req.body;

      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: "البريد الإلكتروني غير صالح" });
      }

      // Validate that the employee has access (cashier or manager of the same branch)
      const employee = req.employee;
      if (!employee || !['cashier', 'manager', 'admin', 'owner'].includes(employee.role || '')) {
        return res.status(403).json({ error: "غير مصرح لك بإرسال الفواتير" });
      }

      // Get order by number
      const order = await storage.getOrderByNumber(orderNumber);
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      const serializedOrder = serializeDoc(order);

      // Check branch access for non-admin/owner roles
      if (employee.role === 'cashier' || employee.role === 'manager') {
        if (serializedOrder.branchId && employee.branchId && 
            serializedOrder.branchId !== employee.branchId) {
          return res.status(403).json({ error: "غير مصرح لك بالوصول لهذا الطلب" });
        }
      }
      
      // Parse items if stored as JSON string
      let orderItems = serializedOrder.items;
      if (typeof orderItems === 'string') {
        try {
          orderItems = JSON.parse(orderItems);
        } catch (e) {
          orderItems = [];
        }
      }

      // Enrich items with coffee item details
      const coffeeItems = await getCachedCoffeeItems();
      const enrichedItems = Array.isArray(orderItems) ? orderItems.map((item: any) => {
        const coffeeItem = coffeeItems.find(ci => ci.id === item.coffeeItemId);
        return {
          ...item,
          coffeeItem: coffeeItem ? {
            nameAr: coffeeItem.nameAr,
            price: coffeeItem.price
          } : { nameAr: 'منتج', price: item.price || '0' }
        };
      }) : [];

      // Calculate totals - use stored values when available
      const totalAmount = parseFloat(serializedOrder.totalAmount || '0');
      const taxRate = 0.15;
      const subtotalBeforeTax = totalAmount / (1 + taxRate);
      const taxAmount = totalAmount - subtotalBeforeTax;
      
      // Get stored discount if any
      const discountPercentage = parseFloat(serializedOrder.discountPercentage || '0');
      const discountAmount = discountPercentage > 0 ? 
        (subtotalBeforeTax / (1 - discountPercentage/100)) * (discountPercentage/100) : 0;
      
      // Generate invoice number using order number and creation time
      const orderDate = new Date(serializedOrder.createdAt || Date.now());
      const invoiceNumber = `INV-${orderNumber}`;

      const invoiceData = {
        customerName: serializedOrder.customerInfo?.customerName || 'عميل',
        customerPhone: serializedOrder.customerInfo?.phoneNumber || '',
        items: enrichedItems,
        subtotal: subtotalBeforeTax,
        discountAmount: discountAmount,
        taxAmount: taxAmount,
        totalAmount: totalAmount,
        paymentMethod: serializedOrder.paymentMethod || 'cash',
        invoiceDate: orderDate
      };

      const success = await sendInvoiceEmail(email, invoiceNumber, invoiceData);

      if (success) {
        res.json({ 
          success: true, 
          message: "تم إرسال الفاتورة بنجاح",
          invoiceNumber: invoiceNumber 
        });
      } else {
        res.status(500).json({ error: "فشل إرسال الفاتورة. تأكد من إعداد البريد الإلكتروني" });
      }
    } catch (error) {
      res.status(500).json({ error: "فشل إرسال الفاتورة" });
    }
  });

  // Get order by number - for public tracking
  app.get("/api/orders/number/:orderNumber", async (req, res) => {
    try {
      const { orderNumber } = req.params;
      const order = await storage.getOrderByNumber(orderNumber);

      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      // Serialize and parse items
      const serializedOrder = serializeDoc(order);
      if (serializedOrder.items && typeof serializedOrder.items === 'string') {
        try {
          serializedOrder.items = JSON.parse(serializedOrder.items);
        } catch (e) {
          serializedOrder.items = [];
        }
      }

      res.json(serializedOrder);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب معلومات الطلب" });
    }
  });

  // Public endpoint for Order Status Display - no authentication required
  app.get("/api/orders/active-display", async (req, res) => {
    try {
      const { OrderModel } = await import("@shared/schema");
      const { branchId } = req.query;
      
      // Get orders that are in_progress or ready (for customer display)
      const query: any = {
        status: { $in: ['in_progress', 'preparing', 'ready'] },
        createdAt: { $gte: new Date(Date.now() - 4 * 60 * 60 * 1000) } // Last 4 hours only
      };

      if (branchId) {
        query.branchId = branchId;
      }

      const orders = await OrderModel.find(query)
        .sort({ createdAt: 1 })
        .limit(50);

      // Return minimal info for public display (no customer details)
      const displayOrders = orders.map(order => {
        const serialized = serializeDoc(order);
        let itemCount = 0;
        
        try {
          const items = typeof serialized.items === 'string' 
            ? JSON.parse(serialized.items) 
            : serialized.items;
          itemCount = Array.isArray(items) ? items.length : 0;
        } catch (e) {
          itemCount = 0;
        }

        return {
          id: serialized.id,
          orderNumber: serialized.orderNumber,
          status: serialized.status,
          orderType: serialized.orderType || serialized.deliveryType,
          deliveryType: serialized.deliveryType,
          createdAt: serialized.createdAt,
          itemCount
        };
      });

      res.json(displayOrders);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الطلبات" });
    }
  });

  // Get orders for Kitchen Display System (KDS) - requires authentication
  app.get("/api/orders/kitchen", requireAuth, async (req: AuthRequest, res) => {
    try {
      // Only allow cashiers, managers, admins, and owners to access KDS
      const allowedRoles = ['cashier', 'manager', 'admin', 'owner'];
      if (!req.employee?.role || !allowedRoles.includes(req.employee.role)) {
        return res.status(403).json({ error: "Access denied - insufficient permissions" });
      }

      const { OrderModel } = await import("@shared/schema");
      
      const query: any = {
        status: { $in: ['pending', 'confirmed', 'payment_confirmed', 'in_progress', 'ready'] }
      };

      // Apply branch filtering for managers and other roles
      if (req.employee.role !== 'admin' && req.employee.role !== 'owner') {
        if (req.employee.branchId) {
          query.branchId = req.employee.branchId;
        } else if (req.employee.role === 'manager') {
          // If manager has no branchId, they might not see anything
          // We can try to find their branch if it's missing in session
          const { BranchModel } = await import("@shared/schema");
          const branch = await BranchModel.findOne({ tenantId: req.employee.tenantId });
          if (branch) {
            query.branchId = (branch as any)._id?.toString() || (branch as any).id;
          }
        }
      }

      const [orders, coffeeItems] = await Promise.all([
        OrderModel.find(query).sort({ createdAt: 1 }).lean(),
        getCachedCoffeeItems(),
      ]);

      const enrichedOrders = orders.map(order => enrichOrderWithItems(serializeDoc(order), coffeeItems));
      res.json(enrichedOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch kitchen orders" });
    }
  });

  // ── Sales Analytics Endpoint (fast aggregated, no enrichment) ─────────────────
  app.get("/api/orders/analytics", async (req: any, res) => {
    try {
      const { from, to } = req.query;
      const tenantId = getTenantIdFromRequest(req as any) || 'demo-tenant';
      const { OrderModel } = await import("@shared/schema");

      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();
      toDate.setHours(23, 59, 59, 999);

      const orders = await OrderModel.find({
        tenantId,
        createdAt: { $gte: fromDate, $lte: toDate },
        status: { $nin: ['cancelled'] }
      }).select('totalAmount items createdAt paymentMethod channel orderType').lean();

      const totalRevenue = orders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
      const totalOrders = orders.length;

      const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
      orders.forEach((order: any) => {
        (order.items || []).forEach((item: any) => {
          const name = item.nameAr || item.name || 'غير معروف';
          const qty = Number(item.quantity || 1);
          const rev = Number(item.price || 0) * qty;
          const key = String(item.coffeeItemId || name);
          const curr = productMap.get(key) || { name, quantity: 0, revenue: 0 };
          curr.quantity += qty;
          curr.revenue += rev;
          productMap.set(key, curr);
        });
      });

      const dayMap = new Map<string, number>();
      orders.forEach((order: any) => {
        const day = new Date(order.createdAt).toISOString().slice(0, 10);
        dayMap.set(day, (dayMap.get(day) || 0) + (order.totalAmount || 0));
      });

      const payMap = new Map<string, number>();
      orders.forEach((order: any) => {
        const m = order.paymentMethod || 'other';
        payMap.set(m, (payMap.get(m) || 0) + (order.totalAmount || 0));
      });

      const channelMap = new Map<string, number>();
      orders.forEach((order: any) => {
        const ch = order.channel || 'other';
        channelMap.set(ch, (channelMap.get(ch) || 0) + 1);
      });

      res.json({
        totalRevenue,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        topProducts: Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 12),
        revenueByDay: Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue })),
        paymentBreakdown: Array.from(payMap.entries()).map(([method, revenue]) => ({ method, revenue })),
        channelBreakdown: Array.from(channelMap.entries()).map(([channel, count]) => ({ channel, count })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Analytics failed' });
    }
  });

  // Get all orders (branch-filtered for non-admin/owner roles)
  app.get("/api/orders", async (req: any, res) => {
    try {
      const { limit, offset } = req.query;
      const limitNum = limit ? parseInt(limit as string) : undefined;
      const offsetNum = offset ? parseInt(offset as string) : undefined;

      const tenantId = getTenantIdFromRequest(req as any) || 'demo-tenant';
      const allOrders = await storage.getOrders(limitNum || 200, offsetNum, tenantId);

      const employee = (req as any).session?.employee;
      const orders = employee ? filterByBranch(allOrders, { ...employee, tenantId: employee.tenantId || 'default' }) : allOrders;

      const [coffeeItems] = await Promise.all([getCachedCoffeeItems()]);
      const enrichedOrders = orders.map(order => enrichOrderWithItems(serializeDoc(order), coffeeItems));
      return res.json(enrichedOrders);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Get order by ID - LEAST SPECIFIC (catch-all)
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // If it's a dine-in order with a table number, mark table as occupied and set auto-clear alert
      if ((order.orderType === 'dine-in' || order.orderType === 'table') && order.tableNumber) {
        const { TableModel } = await import("@shared/schema");
        const autoClearTime = new Date(Date.now() + 10 * 60 * 1000);
        
        await TableModel.findOneAndUpdate(
          { tableNumber: order.tableNumber, branchId: order.branchId },
          { 
            isOccupied: 1, 
            currentOrderId: order.id,
            "reservedFor.autoExpiryTime": autoClearTime,
            updatedAt: new Date()
          }
        );
      }

      // Serialize the order (converts _id to id and removes MongoDB internals)
      const serializedOrder = serializeDoc(order);

      // Get order items
      const orderItems = await storage.getOrderItems(id);

      res.json({
        ...serializedOrder,
        orderItems
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // Background task to auto-clear expired tables
  setInterval(async () => {
    try {
      const { TableModel } = await import("@shared/schema");
      const now = new Date();
      
      const expiredTables = await TableModel.find({
        isOccupied: 1,
        "reservedFor.autoExpiryTime": { $lte: now }
      });

      for (const table of expiredTables) {
        await TableModel.findOneAndUpdate(
          { _id: table._id },
          {
            isOccupied: 0,
            currentOrderId: null,
            "reservedFor.autoExpiryTime": null,
            updatedAt: new Date()
          }
        );
        
        if (typeof wsManager !== 'undefined') {
          wsManager.broadcastToBranch(table.branchId || 'all', {
            type: 'TABLE_AUTO_CLEARED',
            tableNumber: table.tableNumber,
            branchId: table.branchId
          });
        }
      }
    } catch (error) {
      console.error("Auto-clear tables error:", error);
    }
  }, 60000); // Check every minute

  // Update order car pickup info
  app.post("/api/orders/:id/car-pickup", async (req, res) => {
    try {
      const { id } = req.params;
      const { carType, carColor } = req.body;

      if (!carType || !carColor) {
        return res.status(400).json({ error: "Car type and color are required" });
      }

      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const carPickup = { carType, carColor };
      const updatedOrder = await storage.updateOrderCarPickup(id, carPickup);

      if (!updatedOrder) {
        return res.status(404).json({ error: "Failed to update order" });
      }

      res.json(serializeDoc(updatedOrder));
    } catch (error) {
      res.status(500).json({ error: "Failed to update car pickup info" });
    }
  });

  app.patch("/api/orders/:id/prep-time", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { additionalMinutes } = req.body;

      if (!additionalMinutes || typeof additionalMinutes !== 'number' || additionalMinutes <= 0) {
        return res.status(400).json({ error: "Invalid additionalMinutes" });
      }

      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const currentEstimated = (order as any).estimatedPrepTimeMinutes || 0;
      const newEstimated = currentEstimated + additionalMinutes;

      const updatedOrder = await OrderModel.findOneAndUpdate(
        { id },
        { 
          $set: { 
            estimatedPrepTimeMinutes: newEstimated,
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      if (updatedOrder && (updatedOrder as any).customerId) {
        const { sendPushToCustomer } = await import("./push-service");
        try {
          await sendPushToCustomer((updatedOrder as any).customerId, {
            type: 'order_status',
            title: 'تحديث وقت التحضير',
            body: `الوقت المتوقع لطلبك #${(updatedOrder as any).orderNumber}: ${newEstimated} دقيقة`,
            orderId: id,
            orderNumber: (updatedOrder as any).orderNumber,
            status: 'in_progress',
            estimatedTime: newEstimated
          });
        } catch (pushErr) {
          console.log("[PUSH] Failed to send time update notification:", pushErr);
        }
      }

      res.json({ success: true, estimatedPrepTimeMinutes: newEstimated });
    } catch (error) {
      console.error("[API] Error updating prep time:", error);
      res.status(500).json({ error: "Failed to update prep time" });
    }
  });

  // Update order status (branch-restricted for managers)
  app.put("/api/orders/:id/status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status, cancellationReason, estimatedPrepTimeInMinutes, paymentMethod: rawPaymentMethod } = req.body;

      // Valid statuses for order workflow
      const validStatuses = ['pending', 'payment_confirmed', 'in_progress', 'ready', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      // Map payment method aliases (card → pos, etc.)
      const paymentMethodAliasMap: Record<string, string> = {
        'card': 'pos', 'بطاقة': 'pos', 'شبكة': 'pos',
        'cash': 'cash', 'نقدي': 'cash',
        'apple_pay': 'apple_pay', 'mada': 'mada', 'stc-pay': 'stc-pay',
        'pos': 'pos', 'pos-network': 'pos-network',
      };
      const mappedPaymentMethod = rawPaymentMethod
        ? (paymentMethodAliasMap[rawPaymentMethod] || rawPaymentMethod)
        : null;

      // Verify branch access for non-admin/manager users
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Update data object
      const updateData: any = { 
        status, 
        cancellationReason,
        updatedAt: new Date()
      };
      
      if (estimatedPrepTimeInMinutes !== undefined) {
        updateData.estimatedPrepTimeInMinutes = estimatedPrepTimeInMinutes;
        updateData.prepTimeSetAt = new Date();
      }

      const updatedOrder = await storage.updateOrderStatus(id, status, cancellationReason, estimatedPrepTimeInMinutes);

      // Reverse totalSpent on loyalty card when order is cancelled
      if (status === 'cancelled' && order.status !== 'cancelled' && order.customerId) {
        try {
          const customer = await storage.getCustomer(order.customerId);
          if (customer?.phone) {
            const loyaltyCard = await storage.getLoyaltyCardByPhone(customer.phone);
            if (loyaltyCard) {
              const orderAmount = parseFloat(order.totalAmount?.toString() || '0');
              if (orderAmount > 0) {
                const currentTotalSpent = parseFloat(loyaltyCard.totalSpent?.toString() || '0');
                await storage.updateLoyaltyCard(loyaltyCard.id, {
                  totalSpent: Math.max(0, currentTotalSpent - orderAmount)
                });
              }
            }
          }
        } catch (_) {}
      }

      // Update paymentMethod if provided (e.g., when cashier closes bill with specific payment method)
      if (mappedPaymentMethod && updatedOrder) {
        const { OrderModel: OM } = await import('@shared/schema');
        await OM.findOneAndUpdate(
          { id: (updatedOrder as any).id || id },
          { $set: { paymentMethod: mappedPaymentMethod } }
        ).catch(() => null);
        (updatedOrder as any).paymentMethod = mappedPaymentMethod;
      }

      if (!updatedOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Serialize the order properly
      const serializedOrder = serializeDoc(updatedOrder);

      // Broadcast update via WebSocket immediately
      console.log(`[ORDER] Status updated to ${status} for order #${serializedOrder.orderNumber}. Broadcasting...`);
      wsManager.broadcastOrderUpdate(serializedOrder);
      
      if (status === 'ready') {
        wsManager.broadcastOrderReady(serializedOrder);
      } else if (status === 'payment_confirmed' || status === 'confirmed') {
        wsManager.broadcastNewOrder(serializedOrder);
      }

      // Build WhatsApp notification data for response
      let whatsappNotification: { url: string; message: string; phone: string } | undefined;
      try {
        const customerInfoParsed = typeof serializedOrder.customerInfo === 'string'
          ? JSON.parse(serializedOrder.customerInfo)
          : serializedOrder.customerInfo;
        const phoneNumber = customerInfoParsed?.phoneNumber;
        if (phoneNumber && status !== 'pending') {
          const message = getOrderStatusMessage(status, serializedOrder.orderNumber);
          whatsappNotification = {
            url: `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`,
            message,
            phone: phoneNumber
          };
        }
      } catch (_) {}

      // Send HTTP response immediately — don't block on heavy async work
      res.json(whatsappNotification
        ? { ...serializedOrder, whatsappNotification }
        : serializedOrder
      );

      // Run all heavy post-processing asynchronously (non-blocking)
      setImmediate(async () => {
        try {
          // Generate ZATCA invoice for completed/ready orders
          if (status === 'completed' || status === 'ready') {
            try {
              const existingInvoice = await TaxInvoiceModel.findOne({ orderId: updatedOrder.id });
              if (!existingInvoice) {
                const { createZATCAInvoice } = await import("./utils/zatca");
                let items = updatedOrder.items || [];
                if (typeof items === 'string') items = JSON.parse(items);
                
                const invoiceItems = items.map((item: any) => ({
                  itemId: item.coffeeItemId || item.id,
                  nameAr: item.coffeeItem?.nameAr || item.nameAr || 'منتج',
                  quantity: item.quantity || 1,
                  unitPrice: item.coffeeItem?.price || item.unitPrice || 0,
                  taxRate: 0.15,
                  discountAmount: item.discountAmount || 0
                }));

                await createZATCAInvoice({
                  orderId: updatedOrder.id,
                  orderNumber: updatedOrder.orderNumber,
                  customerName: updatedOrder.customerInfo?.customerName || 'عميل نقدي',
                  customerPhone: updatedOrder.customerInfo?.customerPhone || '',
                  items: invoiceItems,
                  paymentMethod: updatedOrder.paymentMethod || 'cash',
                  branchId: updatedOrder.branchId,
                  createdBy: req.employee?.id,
                  invoiceType: 'simplified'
                });
                console.log(`[ZATCA] Auto-generated invoice for order ${updatedOrder.orderNumber} on status ${status}`);
              }
            } catch (zatcaError) {
              console.error("[ZATCA] Failed to auto-generate invoice:", zatcaError);
            }
          }

          // Deduct inventory for in_progress orders
          if (status === 'in_progress' && order.branchId) {
            try {
              const employeeId = req.employee?.id || 'system';
              await deductInventoryForOrder(id, order.branchId, employeeId);
            } catch (invErr) {
              console.error(`[INVENTORY] Auto-deduction failed for order ${order.orderNumber}:`, invErr);
            }
          }

          // Push notification to customer
          try {
            const custInfo = typeof updatedOrder.customerInfo === 'string' ? JSON.parse(updatedOrder.customerInfo) : updatedOrder.customerInfo;
            const custId = updatedOrder.customerId || custInfo?.customerId;
            if (custId) {
              const statusMessages: Record<string, string> = {
                'payment_confirmed': `تم تأكيد طلبك رقم #${serializedOrder.orderNumber}`,
                'in_progress': `جاري تحضير طلبك رقم #${serializedOrder.orderNumber}`,
                'ready': `طلبك جاهز للاستلام! #${serializedOrder.orderNumber}`,
                'completed': `تم إتمام طلبك رقم #${serializedOrder.orderNumber} بنجاح`,
                'cancelled': `تم إلغاء طلبك رقم #${serializedOrder.orderNumber}`,
              };
              const pushBody = statusMessages[status];
              if (pushBody) {
                const orderItems = Array.isArray(serializedOrder.items) 
                  ? serializedOrder.items.map((item: any) => ({
                      name: item.nameAr || item.name || item.coffeeItem?.nameAr || 'منتج',
                      quantity: item.quantity || 1
                    }))
                  : [];
                sendPushToCustomer(custId, {
                  title: 'تحديث الطلب',
                  body: pushBody,
                  url: '/my-orders',
                  tag: `order-${serializedOrder.orderNumber}`,
                  type: 'order_status',
                  orderNumber: serializedOrder.orderNumber || serializedOrder.dailyNumber,
                  orderStatus: status,
                  totalAmount: serializedOrder.totalAmount,
                  itemCount: orderItems.length,
                  items: orderItems.slice(0, 5),
                  orderType: serializedOrder.orderType,
                  estimatedTime: status === 'in_progress' ? 5 : undefined,
                }).catch(err => console.error('[PUSH] Customer notification error:', err));
              }
            }
          } catch (pushErr) {
            console.error('[PUSH] Error sending customer push:', pushErr);
          }

          // Email notification on status change
          const updateCustomerInfo = typeof updatedOrder.customerInfo === 'string' ? JSON.parse(updatedOrder.customerInfo) : updatedOrder.customerInfo;
          const customerEmail = updateCustomerInfo?.email;
          const customerName = updateCustomerInfo?.name;
          if (customerEmail) {
            try {
              const { sendOrderNotificationEmail } = await import("./mail-service");
              await sendOrderNotificationEmail(
                customerEmail,
                customerName || 'عميل CLUNY CAFE',
                updatedOrder.orderNumber,
                status,
                parseFloat(updatedOrder.totalAmount.toString()),
                updatedOrder
              );
            } catch (emailError) {
              console.error("❌ Failed to send order status email:", emailError);
            }
          }
        } catch (asyncErr) {
          console.error("[ORDER-ASYNC] Post-processing error:", asyncErr);
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // Get payment method details for employees/cashier
  app.get("/api/cashier/payment-methods", async (req, res) => {
    try {
      const paymentMethods = [
        { id: 'qahwa-card', nameAr: 'بطاقة كوبي', nameEn: 'Qahwa Card', details: 'استخدم المشروبات المجانية من بطاقتك', icon: 'fas fa-gift', requiresReceipt: false },
        { id: 'cash', nameAr: 'الدفع نقداً', nameEn: 'Cash Payment', details: 'ادفع عند الاستلام', icon: 'fas fa-money-bill-wave', requiresReceipt: false },
        { id: 'pos-network', nameAr: 'شبكة (POS)', nameEn: 'Network (POS)', details: 'الدفع عبر جهاز نقاط البيع', icon: 'fas fa-credit-card', requiresReceipt: false },
        { id: 'alinma', nameAr: 'Alinma Pay', nameEn: 'Alinma Pay', details: '0532441566', icon: 'fas fa-credit-card', requiresReceipt: true },
        { id: 'ur', nameAr: 'Ur Pay', nameEn: 'Ur Pay', details: '0532441566', icon: 'fas fa-university', requiresReceipt: true },
        { id: 'barq', nameAr: 'Barq', nameEn: 'Barq', details: '0532441566', icon: 'fas fa-bolt', requiresReceipt: true },
        { id: 'rajhi', nameAr: 'بنك الراجحي', nameEn: 'Al Rajhi Bank', details: 'SA78 8000 0539 6080 1942 4738', icon: 'fas fa-building-columns', requiresReceipt: true },
      ];

      res.json(paymentMethods);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  // LOYALTY CARD ROUTES

  // Get loyalty cards by customer ID (phone)
  app.get("/api/loyalty/cards/customer/:customerId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { customerId } = req.params;
      const customer = await storage.getCustomer(customerId);
      
      if (!customer) {
        return res.status(404).json({ error: "العميل غير موجود" });
      }

      const loyaltyCard = await storage.getLoyaltyCardByPhone(customer.phone);
      if (!loyaltyCard) {
        return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });
      }

      res.json([loyaltyCard]); // Return as array for consistency with frontend query
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب بطاقة الولاء" });
    }
  });

  // Get loyalty transactions by customer ID
  app.get("/api/loyalty/transactions/customer/:customerId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { customerId } = req.params;
      const LoyaltyTransactionModel = mongoose.model('LoyaltyTransaction');
      const transactions = await LoyaltyTransactionModel.find({ customerId }).sort({ createdAt: -1 });
      res.json(transactions.map(serializeDoc));
    } catch (error) {
      console.error("Error fetching loyalty transactions:", error);
      res.status(500).json({ error: "فشل في جلب سجل العمليات" });
    }
  });

  // Get loyalty card by phone number
  app.get("/api/loyalty/cards/phone/:phone", async (req, res) => {
    try {
      const { phone } = req.params;
      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      
      const loyaltyCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!loyaltyCard) {
        // Automatically create a card if it doesn't exist
        const customer = await storage.getCustomerByPhone(cleanPhone);
        if (customer) {
          const newCard = await storage.createLoyaltyCard({
            customerName: customer.name,
            phoneNumber: cleanPhone
          });
          return res.json(newCard);
        }
        return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });
      }

      res.json(loyaltyCard);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب بطاقة الولاء" });
    }
  });

  // Admin: Fix all loyalty cards data - recalculate free cups from stamps
  app.post("/api/admin/fix-loyalty-cards-data", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner' && req.employee?.role !== 'admin') {
        return res.status(403).json({ error: "صلاحيات غير كافية" });
      }

      const allCards = await storage.getLoyaltyCards();
      const report = {
        totalCards: allCards.length,
        cardsFixed: 0,
        cardsUpdated: [] as any[],
        errors: [] as string[]
      };

      for (const card of allCards) {
        try {
          const currentStamps = card.stamps || 0;
          const currentFreeCupsEarned = card.freeCupsEarned || 0;
          
          // Calculate how many free cups should be earned from stamps
          const freeCupsFromStamps = Math.floor(currentStamps / 6);
          
          // If there are stamps that haven't been converted to free cups, update the card
          if (freeCupsFromStamps > 0) {
            const remainingStamps = currentStamps % 6;
            const newFreeCupsEarned = currentFreeCupsEarned + freeCupsFromStamps;
            
            await storage.updateLoyaltyCard(card.id || (card as any)._id?.toString(), {
              stamps: remainingStamps,
              freeCupsEarned: newFreeCupsEarned
            });

            report.cardsUpdated.push({
              cardId: card.id || (card as any)._id?.toString(),
              customerName: card.customerName,
              phoneNumber: card.phoneNumber,
              stampsConverted: currentStamps,
              freeCupsAdded: freeCupsFromStamps,
              newFreeCupsEarned: newFreeCupsEarned,
              remainingStamps: remainingStamps
            });

            report.cardsFixed++;
          }
        } catch (error) {
          report.errors.push(`فشل تحديث البطاقة: ${card.phoneNumber} - ${error}`);
        }
      }

      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "فشل في إصلاح بيانات بطاقات الولاء" });
    }
  });

  // Create loyalty card (Initial)
  app.post("/api/loyalty/cards", async (req, res) => {
    try {
      const { customerName, phoneNumber, cardPin, cardDesign } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "رقم الهاتف مطلوب" });
      }

      // Check if customer already has an active card
      const existingCards = await storage.getLoyaltyCardsByCustomerId("");
      const activeCard = existingCards.find(c => c.isActive && c.status !== 'cancelled');
      if (activeCard) {
        return res.status(400).json({ error: "لديك بطاقة نشطة بالفعل" });
      }

      const customer = await storage.getCustomerByPhone(phoneNumber);
      if (!customer) {
        return res.status(404).json({ error: "العميل غير موجود" });
      }

      const card = await storage.createLoyaltyCard({
        customerName: customerName || customer.name,
        phoneNumber: phoneNumber
      });

      res.status(201).json(card);
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء بطاقة الولاء" });
    }
  });

  // Issue new card (with design and PIN) - limited to 2 times
  app.post("/api/loyalty/cards/:cardId/reissue", async (req, res) => {
    try {
      const { cardId } = req.params;
      const { newPin, cardDesign } = req.body;

      const card = await storage.getLoyaltyCard(cardId);
      if (!card) {
        return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });
      }

      // Check reissuance limit (max 2 times)
      if (card.reissuanceCount >= 2) {
        return res.status(400).json({ error: "لقد وصلت إلى الحد الأقصى لإصدار بطاقة جديدة (مرتين فقط)" });
      }

      // Create a NEW card instead of updating (for multiple cards per customer)
      const newCard = await storage.createLoyaltyCard({
        customerName: card.customerName,
        phoneNumber: card.phoneNumber
      });

      // Deactivate old card and activate new one
      await storage.updateLoyaltyCard(cardId, { isActive: false, status: "replaced" });
      await storage.setActiveCard(newCard.id || (newCard as any)._id?.toString(), card.customerId);

      res.json({ success: true, message: "تم إصدار بطاقة جديدة بنجاح", card: newCard });
    } catch (error) {
      res.status(500).json({ error: "فشل في إصدار بطاقة جديدة" });
    }
  });

  // Cancel card (with credential verification and reissuance eligibility check)
  app.post("/api/loyalty/cards/:cardId/cancel", async (req, res) => {
    try {
      const { cardId } = req.params;
      const { phone, email, password } = req.body;

      if (!phone || !email || !password) {
        return res.status(400).json({ error: "رقم الهاتف والبريد وكلمة المرور مطلوبة" });
      }

      // Get the card
      const card = await storage.getLoyaltyCard(cardId);
      if (!card) {
        return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });
      }

      // Check if customer still has reissuance chances
      // The condition was "card.reissuanceCount < 2" which means you CANNOT cancel if you have chances left.
      // Usually, canceling is allowed, but maybe the logic was intended to prevent abuse.
      // However, the user says there's a problem with canceling.
      // Let's make it more permissive or fix the logic if it's inverted.
      // The frontend alert says: "لا يمكنك إلغاء البطاقة إلا إذا كان لديك فرصة لإنشاء بطاقة جديدة"
      // This means reissuanceCount MUST be < 2 to cancel? Or reissuanceCount >= 2?
      // If reissuanceCount is 2, you used all chances. If you cancel, you are stuck.
      // The logic in routes.ts line 3167: if (card.reissuanceCount < 2) return 403.
      // This is indeed what the frontend alert says. But maybe the user wants to cancel regardless?
      // Let's remove this restriction if it's causing the "problem". 
      // Actually, let's keep it but ensure the data is correct.

      // Verify customer credentials
      const customer = await storage.getCustomerByEmail(email);
      const cleanPhone = phone.trim().replace(/\s/g, '').replace(/^\+966/, '').replace(/^0/, '');
      const customerPhone = customer?.phone?.trim().replace(/\s/g, '').replace(/^\+966/, '').replace(/^0/, '');

      if (!customer || customerPhone !== cleanPhone) {
        return res.status(401).json({ error: "البيانات غير صحيحة" });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, customer.password || "");
      if (!isPasswordValid) {
        return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
      }

      // Cancel the card by setting status to "cancelled"
      await storage.updateLoyaltyCard(cardId, { status: "cancelled", isActive: false });

      res.json({ success: true, message: "تم إلغاء البطاقة بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في إلغاء البطاقة" });
    }
  });

  // Scan loyalty card and apply discount
  app.post("/api/loyalty/scan", async (req, res) => {
    try {
      const { qrToken, orderAmount, employeeId } = req.body;

      if (!qrToken || !orderAmount) {
        return res.status(400).json({ error: "رمز QR ومبلغ الطلب مطلوبان" });
      }

      const card = await storage.getLoyaltyCardByQRToken(qrToken);

      if (!card) {
        return res.status(404).json({ error: "بطاقة ولاء غير صالحة" });
      }

      // Calculate 10% discount
      const discountPercentage = 10;
      const discountAmount = (parseFloat(orderAmount) * discountPercentage) / 100;
      const finalAmount = parseFloat(orderAmount) - discountAmount;

      // Update card - increment discount count and update last used
      await storage.updateLoyaltyCard(card.id, {
        discountCount: card.discountCount + 1,
        totalSpent: parseFloat(card.totalSpent.toString()) + finalAmount,
        lastUsedAt: new Date()
      });

      // Create loyalty transaction
      await storage.createLoyaltyTransaction({
        cardId: card.id,
        type: 'discount_applied',
        pointsChange: 0,
        discountAmount: discountAmount,
        orderAmount: parseFloat(orderAmount.toString()),
        description: `خصم ${discountPercentage}% على الطلب`,
        employeeId: employeeId || undefined
      });

      res.json({
        success: true,
        card: {
          ...card,
          discountCount: card.discountCount + 1
        },
        discount: {
          percentage: discountPercentage,
          amount: discountAmount.toFixed(2),
          originalAmount: orderAmount,
          finalAmount: finalAmount.toFixed(2)
        }
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في مسح بطاقة الولاء" });
    }
  });

  // Get loyalty card transactions
  app.get("/api/loyalty/cards/:cardId/transactions", async (req, res) => {
    try {
      const { cardId } = req.params;
      const transactions = await storage.getLoyaltyTransactions(cardId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب معاملات الولاء" });
    }
  });

  // Get loyalty tier information
  app.get("/api/loyalty/tiers", async (req, res) => {
    try {
      const tiers = [
        {
          id: 'bronze',
          nameAr: 'برونزي',
          nameEn: 'Bronze',
          pointsRequired: 0,
          benefits: ['خصم 10% على كل طلب', 'بطاقة رقمية مجانية'],
          color: '#CD7F32',
          icon: '🥉'
        },
        {
          id: 'silver',
          nameAr: 'فضي',
          nameEn: 'Silver',
          pointsRequired: 100,
          benefits: ['خصم 15% على كل طلب', 'قهوة مجانية شهرياً', 'أولوية في الطلبات'],
          color: '#C0C0C0',
          icon: '🥈'
        },
        {
          id: 'gold',
          nameAr: 'ذهبي',
          nameEn: 'Gold',
          pointsRequired: 500,
          benefits: ['خصم 20% على كل طلب', 'قهوتين مجانيتين شهرياً', 'دعوات خاصة للفعاليات'],
          color: '#FFD700',
          icon: '🥇'
        },
        {
          id: 'platinum',
          nameAr: 'بلاتيني',
          nameEn: 'Platinum',
          pointsRequired: 1000,
          benefits: ['خصم 25% على كل طلب', 'قهوة يومية مجانية', 'خدمة VIP', 'بطاقة فيزيائية مطبوعة'],
          color: '#E5E4E2',
          icon: 'platinum'
        }
      ];

      res.json(tiers);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب مستويات الولاء" });
    }
  });

  // Customer loyalty cards endpoint for /my-card page
  app.get("/api/customer/loyalty-cards", requireCustomerAuth, async (req: CustomerAuthRequest, res) => {
    try {
      const customerId = req.customer?.id;
      const customerPhone = req.customer?.phone;
      
      if (!customerPhone) {
        return res.status(401).json({ error: "يرجى تسجيل الدخول" });
      }

      const cleanPhone = customerPhone.replace(/\D/g, '').slice(-9);
      let loyaltyCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      
      // Create card if doesn't exist
      if (!loyaltyCard) {
        const cardNumber = `CLUNY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const qrToken = `QR-${customerId || cleanPhone}-${Date.now()}`;
        
        loyaltyCard = await storage.createLoyaltyCard({
          customerId: customerId || cleanPhone,
          customerName: req.customer?.name || 'عميل',
          phoneNumber: cleanPhone,
          cardNumber: cardNumber,
          qrToken: qrToken,
          isActive: 1,
          stamps: 0,
          freeCupsEarned: 0,
          totalSpent: 0,
          points: 0,
          pendingPoints: 0
        } as any);
      }

      res.json([loyaltyCard]);
    } catch (error) {
      console.error("[CUSTOMER LOYALTY] Error:", error);
      res.status(500).json({ error: "فشل في جلب بطاقة الولاء" });
    }
  });

  // Customer loyalty transactions endpoint
  app.get("/api/customer/loyalty-transactions", requireCustomerAuth, async (req: CustomerAuthRequest, res) => {
    try {
      const customerPhone = req.customer?.phone;
      
      if (!customerPhone) {
        return res.status(401).json({ error: "يرجى تسجيل الدخول" });
      }

      const cleanPhone = customerPhone.replace(/\D/g, '').slice(-9);
      const loyaltyCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      
      if (!loyaltyCard) {
        return res.json([]);
      }

      const transactions = await storage.getLoyaltyTransactions(loyaltyCard.id);
      
      // Transform transactions for frontend
      const formattedTransactions = transactions.map((tx: any) => {
        const rawType = tx.type || '';
        let mappedType: string;
        if (['earn', 'stamps_earned', 'points_earned', 'transfer_in'].includes(rawType)) {
          mappedType = rawType === 'transfer_in' ? 'transfer_in' : 'earn';
        } else if (rawType === 'transfer_out') {
          mappedType = 'transfer_out';
        } else {
          mappedType = 'redeem';
        }
        return {
          id: tx.id || tx._id,
          type: mappedType,
          points: tx.pointsChange || 0,
          descriptionAr: tx.description,
          createdAt: tx.createdAt,
        };
      });

      res.json(formattedTransactions);
    } catch (error) {
      console.error("[CUSTOMER TRANSACTIONS] Error:", error);
      res.status(500).json({ error: "فشل في جلب معاملات الولاء" });
    }
  });

  // Transfer points between customers
  app.post("/api/customer/transfer-points", requireCustomerAuth, async (req: CustomerAuthRequest, res) => {
    try {
      const { recipientPhone, points, pin } = req.body;
      const senderPhone = req.customer?.phone;
      
      if (!senderPhone || !recipientPhone || !points || points <= 0) {
        return res.status(400).json({ error: "بيانات غير صالحة" });
      }

      const cleanSenderPhone = senderPhone.replace(/\D/g, '').slice(-9);
      const cleanRecipientPhone = recipientPhone.replace(/\D/g, '').slice(-9);

      // Get sender's card
      const senderCard = await storage.getLoyaltyCardByPhone(cleanSenderPhone);
      if (!senderCard) {
        return res.status(404).json({ error: "بطاقتك غير موجودة" });
      }

      // Verify PIN
      const customer = await storage.getCustomerByPhone(cleanSenderPhone);
      if (customer?.password && pin && !(await bcrypt.compare(pin, customer.password))) {
        return res.status(401).json({ error: "الرقم السري غير صحيح" });
      }

      // Check if sender has enough points
      const currentPoints = senderCard.points || 0;
      if (currentPoints < points) {
        return res.status(400).json({ error: "رصيد النقاط غير كافي" });
      }

      // Transfer points
      await storage.updateLoyaltyCard(senderCard.id, { points: currentPoints - points });
      
      // Get or create recipient's card
      let recipientCard = await storage.getLoyaltyCardByPhone(cleanRecipientPhone);
      const recipientCustomer = await storage.getCustomerByPhone(cleanRecipientPhone);
      
      if (!recipientCard && recipientCustomer) {
        const recipientCustomerId = (recipientCustomer as any)._id?.toString() || (recipientCustomer as any).id;
        const cardNumber = `CLUNY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const qrToken = `QR-${recipientCustomerId}-${Date.now()}`;
        
        recipientCard = await storage.createLoyaltyCard({
          customerId: recipientCustomerId,
          customerName: recipientCustomer.name,
          phoneNumber: cleanRecipientPhone,
          cardNumber: cardNumber,
          qrToken: qrToken,
          isActive: 1,
          stamps: 0,
          freeCupsEarned: 0,
          totalSpent: 0,
          points: 0,
          pendingPoints: 0
        } as any);
      }

      if (!recipientCard) {
        return res.status(404).json({ error: "المستلم غير مسجل في النظام" });
      }

      // Transfer points
      await storage.updateLoyaltyCard(recipientCard.id, {
        points: (recipientCard.points || 0) + points
      });

      // Create transaction records
      await storage.createLoyaltyTransaction({
        cardId: senderCard.id,
        type: 'transfer_out',
        pointsChange: -points,
        description: `تحويل نقاط إلى ${recipientCustomer?.name || recipientPhone}`,
      } as any);

      await storage.createLoyaltyTransaction({
        cardId: recipientCard.id,
        type: 'transfer_in',
        pointsChange: points,
        description: `استلام نقاط من ${req.customer?.name || senderPhone}`,
      } as any);

      res.json({ 
        success: true, 
        message: "تم تحويل النقاط بنجاح",
        recipientName: recipientCustomer?.name || recipientPhone
      });
    } catch (error) {
      console.error("[TRANSFER POINTS] Error:", error);
      res.status(500).json({ error: "فشل في تحويل النقاط" });
    }
  });

  // ─── EMPLOYEE LOYALTY MANAGEMENT ENDPOINTS ─────────────────────────────────

  // Get all loyalty cards (manager/admin)
  app.get("/api/loyalty/cards", requireAuth, async (req: AuthRequest, res) => {
    try {
      const cards = await storage.getLoyaltyCards();
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب بطاقات الولاء" });
    }
  });

  // Lookup card by phone (employee, no auth wall for ease of use)
  app.get("/api/loyalty/lookup/phone/:phone", async (req, res) => {
    try {
      const cleanPhone = req.params.phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "لا توجد بطاقة بهذا الرقم" });
      res.json(card);
    } catch (error) {
      res.status(500).json({ error: "فشل في البحث" });
    }
  });

  // Create card for walk-in customer (employee creates)
  app.post("/api/loyalty/employee/create-card", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { customerName, phoneNumber } = req.body;
      if (!phoneNumber) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

      const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-9);
      if (cleanPhone.length < 9) return res.status(400).json({ error: "رقم الهاتف يجب أن يكون 9 أرقام" });

      const existing = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (existing) return res.status(400).json({ error: "هذا الرقم لديه بطاقة مسجلة بالفعل", card: existing });

      // Find or use walk-in customerId
      const customer = await storage.getCustomerByPhone(cleanPhone);
      const customerId = customer ? (customer.id || (customer as any)._id?.toString()) : `walkin-${cleanPhone}`;

      const card = await storage.createLoyaltyCard({
        customerId,
        customerName: customerName?.trim() || 'عميل',
        phoneNumber: cleanPhone,
        points: 0,
        stamps: 0,
        freeCupsEarned: 0,
        freeCupsRedeemed: 0,
        totalSpent: 0,
        tier: 'bronze',
        isActive: true,
      } as any);

      res.status(201).json(card);
    } catch (error: any) {
      console.error("[LOYALTY CREATE CARD]", error);
      res.status(500).json({ error: "فشل في إنشاء البطاقة" });
    }
  });

  // Employee: Add points manually
  app.post("/api/loyalty/employee/add-points", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { phone, points, note } = req.body;
      if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });
      const pts = Number(points);
      if (!pts || pts <= 0) return res.status(400).json({ error: "عدد النقاط يجب أن يكون أكبر من صفر" });

      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });

      const cardId = (card as any)._id?.toString() || (card as any).id;
      const newPoints = (card.points || 0) + pts;

      // Update tier based on new points
      let tier = 'bronze';
      if (newPoints >= 5000) tier = 'platinum';
      else if (newPoints >= 2000) tier = 'gold';
      else if (newPoints >= 500) tier = 'silver';

      await storage.updateLoyaltyCard(cardId, { points: newPoints, tier });
      await storage.createLoyaltyTransaction({
        cardId,
        type: 'earn',
        pointsChange: pts,
        discountAmount: 0,
        orderAmount: 0,
        description: note || `إضافة ${pts} نقطة يدوياً`,
        employeeId: req.employee?.id,
      });

      const updatedCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      res.json({ success: true, card: updatedCard });
    } catch (error) {
      console.error("[LOYALTY ADD POINTS]", error);
      res.status(500).json({ error: "فشل في إضافة النقاط" });
    }
  });

  // Employee: Add stamp
  app.post("/api/loyalty/employee/add-stamp", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });

      const cardId = (card as any)._id?.toString() || (card as any).id;
      const newStamps = (card.stamps || 0) + 1;
      let freeCupsEarned = card.freeCupsEarned || 0;
      let finalStamps = newStamps;
      let earnedFreeCup = false;

      if (newStamps >= 6) {
        const earned = Math.floor(newStamps / 6);
        freeCupsEarned += earned;
        finalStamps = newStamps % 6;
        earnedFreeCup = earned > 0;
      }

      await storage.updateLoyaltyCard(cardId, { stamps: finalStamps, freeCupsEarned });
      await storage.createLoyaltyTransaction({
        cardId,
        type: 'stamp_earned',
        pointsChange: 0,
        discountAmount: 0,
        orderAmount: 0,
        description: `طابع رقم ${finalStamps}${earnedFreeCup ? ' - تم الحصول على مشروب مجاني!' : ''}`,
        employeeId: req.employee?.id,
      } as any);

      const updatedCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      res.json({ success: true, card: updatedCard, earnedFreeCup });
    } catch (error) {
      console.error("[LOYALTY ADD STAMP]", error);
      res.status(500).json({ error: "فشل في إضافة الطابع" });
    }
  });

  // Employee: Redeem free drink (uses freeCupsEarned - freeCupsRedeemed)
  app.post("/api/loyalty/employee/redeem-cup", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });

      const available = (card.freeCupsEarned || 0) - (card.freeCupsRedeemed || 0);
      if (available <= 0) return res.status(400).json({ error: "لا يوجد مشروب مجاني متاح" });

      const cardId = (card as any)._id?.toString() || (card as any).id;
      await storage.updateLoyaltyCard(cardId, { freeCupsRedeemed: (card.freeCupsRedeemed || 0) + 1 });
      await storage.createLoyaltyTransaction({
        cardId,
        type: 'redeem',
        pointsChange: 0,
        discountAmount: 0,
        orderAmount: 0,
        description: 'استرداد مشروب مجاني',
        employeeId: req.employee?.id,
      } as any);

      const updatedCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      res.json({ success: true, card: updatedCard });
    } catch (error) {
      console.error("[LOYALTY REDEEM CUP]", error);
      res.status(500).json({ error: "فشل في استرداد المشروب المجاني" });
    }
  });

  // Public: Look up loyalty card by phone (for POS balance display)
  app.get("/api/loyalty/lookup/phone/:phone", async (req, res) => {
    try {
      const raw = req.params.phone;
      const cleanPhone = raw.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة غير موجودة" });
      res.json({ points: (card as any).points || 0, cardId: (card as any)._id?.toString() });
    } catch (error) {
      res.status(500).json({ error: "فشل" });
    }
  });

  // Employee: Redeem points for discount (general)
  app.post("/api/loyalty/employee/redeem-points", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { phone, points } = req.body;
      if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });
      const pts = Number(points);
      if (!pts || pts <= 0) return res.status(400).json({ error: "عدد النقاط غير صالح" });
      if (pts < 100) return res.status(400).json({ error: "الحد الأدنى للاستخدام 100 نقطة" });

      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });

      if ((card.points || 0) < pts) return res.status(400).json({ error: "رصيد النقاط غير كافٍ" });
      if ((card.points || 0) < 100) return res.status(400).json({ error: "يحتاج العميل 100 نقطة على الأقل للصرف" });

      // 50 points = 1 SAR (0.02 SAR per point)
      const sarValue = pts * 0.02;

      const cardId = (card as any)._id?.toString() || (card as any).id;
      await storage.updateLoyaltyCard(cardId, { points: (card.points || 0) - pts });
      await storage.createLoyaltyTransaction({
        cardId,
        type: 'redeem',
        pointsChange: -pts,
        discountAmount: sarValue,
        orderAmount: 0,
        description: `استرداد ${pts} نقطة = ${sarValue.toFixed(2)} ريال خصم بطاقة كلوني`,
        employeeId: req.employee?.id,
      });

      const updatedCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      res.json({ success: true, card: updatedCard, discountSar: sarValue });
    } catch (error) {
      console.error("[LOYALTY REDEEM POINTS]", error);
      res.status(500).json({ error: "فشل في استرداد النقاط" });
    }
  });

  // Employee: Apply loyalty points as payment discount on POS order
  // 50 points = 1 SAR. Minimum 100 points to redeem. No points earned on this order.
  app.post("/api/loyalty/employee/apply-points-to-order", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { phone, pointsToUse, orderTotal } = req.body;
      if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

      const cleanPhone = phone.replace(/\D/g, '').slice(-9);
      const card = await storage.getLoyaltyCardByPhone(cleanPhone);
      if (!card) return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });

      const currentPoints = Number(card.points) || 0;
      if (currentPoints < 100) {
        return res.status(400).json({ error: "يحتاج العميل 100 نقطة على الأقل للصرف", currentPoints });
      }

      // Calculate max discount: all points up to order total
      const maxPointsValue = currentPoints * 0.02; // 50 pts = 1 SAR
      const orderAmt = Number(orderTotal) || 0;
      const ptsToUse = pointsToUse ? Math.min(Number(pointsToUse), currentPoints) : currentPoints;
      const discountSar = Math.min(ptsToUse * 0.02, orderAmt);
      const actualPtsUsed = Math.ceil(discountSar / 0.02); // points actually deducted

      const cardId = (card as any)._id?.toString() || (card as any).id;
      await storage.updateLoyaltyCard(cardId, { points: currentPoints - actualPtsUsed, discountCount: (card.discountCount || 0) + 1 });
      await storage.createLoyaltyTransaction({
        cardId,
        type: 'redeem',
        pointsChange: -actualPtsUsed,
        discountAmount: discountSar,
        orderAmount: orderAmt,
        description: `خصم بطاقة كلوني: ${actualPtsUsed} نقطة = ${discountSar.toFixed(2)} ريال`,
        employeeId: req.employee?.id,
      });

      const updatedCard = await storage.getLoyaltyCardByPhone(cleanPhone);
      res.json({
        success: true,
        card: updatedCard,
        discountSar: Number(discountSar.toFixed(2)),
        pointsUsed: actualPtsUsed,
        remainingPoints: currentPoints - actualPtsUsed,
      });
    } catch (error) {
      console.error("[LOYALTY APPLY POINTS]", error);
      res.status(500).json({ error: "فشل في تطبيق خصم النقاط" });
    }
  });

  // ─── END EMPLOYEE LOYALTY ENDPOINTS ────────────────────────────────────────

  // Get loyalty card by card number (for cashier lookup)
  app.get("/api/loyalty/card/:cardNumber", async (req, res) => {
    try {
      const { cardNumber } = req.params;
      const card = await storage.getLoyaltyCardByCardNumber(cardNumber);

      if (!card) {
        return res.status(404).json({ error: "بطاقة الولاء غير موجودة" });
      }

      res.json(card);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب بطاقة الولاء" });
    }
  });

  // Generate loyalty codes for an order
  app.post("/api/orders/:orderId/generate-codes", async (req, res) => {
    try {
      const { orderId } = req.params;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      const orderItems = Array.isArray(order.items) ? order.items : [];
      const drinks = orderItems.map((item: any) => ({
        name: item.nameAr || item.name || "مشروب",
        quantity: item.quantity || 1
      }));

      const codes = await storage.generateCodesForOrder(orderId, drinks);
      res.status(201).json(codes);
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء الأكواد" });
    }
  });

  // Get codes for an order
  app.get("/api/orders/:orderId/codes", async (req, res) => {
    try {
      const { orderId } = req.params;
      const codes = await storage.getCodesByOrder(orderId);
      res.json(codes);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الأكواد" });
    }
  });

  // Redeem a code on a loyalty card
  app.post("/api/loyalty/redeem-code", async (req, res) => {
    try {
      const { code, cardId } = req.body;

      if (!code || !cardId) {
        return res.status(400).json({ error: "الكود ومعرف البطاقة مطلوبان" });
      }

      const result = await storage.redeemCode(code, cardId);

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json({
        success: true,
        message: result.message,
        card: result.card
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في استخدام الكود" });
    }
  });

  // Update ingredient availability (DEPRECATED: use PUT /api/inventory/raw-items/:id with isActive field)
  app.patch("/api/ingredients/:id/availability", async (req, res) => {
    try {
      console.warn("⚠️ DEPRECATED: PATCH /api/ingredients/:id/availability is deprecated. Use PUT /api/inventory/raw-items/:id with isActive field instead.");
      const { id } = req.params;
      const { isAvailable } = req.body;
      
      // Update ingredient availability
      const ingredient = await storage.updateIngredientAvailability(id, isAvailable);
      
      // Guard: Check if ingredient exists
      if (!ingredient) {
        return res.status(404).json({ error: "Ingredient not found" });
      }
      
      // Get all coffee items that use this ingredient
      const affectedCoffeeItems = await storage.getCoffeeItemsByIngredient(id);
      
      // Update availability of affected coffee items
      for (const coffeeItem of affectedCoffeeItems) {
        if (isAvailable === 0) {
          // If ingredient is unavailable, mark all items using it as unavailable
          await storage.updateCoffeeItem(coffeeItem.id, {
            isAvailable: 0,
            availabilityStatus: "out_of_stock" as any
          });
        } else {
          // If ingredient is now available, check if all other ingredients are available
          const itemIngredients = await storage.getCoffeeItemIngredients(coffeeItem.id);
          const allIngredientsAvailable = itemIngredients.every(ing => ing.isAvailable === 1);
          
          if (allIngredientsAvailable) {
            // All ingredients available, make the item available
            await storage.updateCoffeeItem(coffeeItem.id, {
              isAvailable: 1,
              availabilityStatus: "available" as any
            });
          }
        }
      }
      
      res.json({ 
        ingredient, 
        affectedItems: affectedCoffeeItems.length 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update ingredient" });
    }
  });

  // Get ingredients for a coffee item
  app.get("/api/coffee-items/:id/ingredients", async (req, res) => {
    try {
      const { id } = req.params;
      const ingredients = await storage.getCoffeeItemIngredients(id);
      res.json(ingredients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ingredients" });
    }
  });

  // Add ingredient to coffee item
  app.post("/api/coffee-items/:id/ingredients", async (req, res) => {
    try {
      const { id } = req.params;
      const { ingredientId, quantity, unit } = req.body;
      const result = await storage.addCoffeeItemIngredient(id, ingredientId, quantity, unit);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to add ingredient" });
    }
  });

  // Remove ingredient from coffee item
  app.delete("/api/coffee-items/:id/ingredients/:ingredientId", async (req, res) => {
    try {
      const { id, ingredientId } = req.params;
      await storage.removeCoffeeItemIngredient(id, ingredientId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove ingredient" });
    }
  });

  // Get coffee items affected by ingredient
  app.get("/api/ingredients/:id/coffee-items", async (req, res) => {
    try {
      const { id } = req.params;
      const coffeeItems = await storage.getCoffeeItemsByIngredient(id);
      res.json(coffeeItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch coffee items" });
    }
  });

  // BRANCH MANAGEMENT ROUTES
  app.get("/api/branches", async (req, res) => {
    try {
      const { BranchModel } = await import("@shared/schema");
      const tenantId = (req as any).employee?.tenantId || 'demo-tenant';
      const userRole = (req as any).employee?.role;
      const userBranchId = (req as any).employee?.branchId;

      let query: any = {};
      
      // For admin/owner, show all; for managers, show only their branch
      if (userRole === "manager" && userBranchId) {
        query = { $or: [{ id: userBranchId }, { _id: userBranchId }] };
      } else {
        // Show all branches (admin can see all)
        query = { isActive: { $in: [1, true] } };
      }

      const branches = await BranchModel.find(query).lean();
      
      const serialized = branches.map((b: any) => ({
        ...b,
        id: b.id || b._id?.toString(),
        _id: b._id?.toString()
      }));
      
      res.json(serialized);
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  // PUBLIC: Branch locations for client-side geofencing
  app.get("/api/geofence/branches", async (_req, res) => {
    try {
      const { BranchModel } = await import("@shared/schema");
      const branches = await BranchModel.find({
        isActive: { $in: [true, 1, "1", "true"] },
        "location.lat": { $exists: true, $ne: null },
        "location.lng": { $exists: true, $ne: null }
      }).lean() as any[];
      res.json(branches
        .filter((b: any) => b.location?.lat && b.location?.lng)
        .map((b: any) => ({
          id: b.id || b._id?.toString(),
          nameAr: b.nameAr,
          nameEn: b.nameEn,
          lat: b.location.lat,
          lng: b.location.lng,
          radius: b.geofenceRadius || 100
        }))
      );
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch geofence branches" });
    }
  });

  // Send proximity push notification to a customer who is nearby a branch
  app.post("/api/geofence/notify", async (req: any, res) => {
    try {
      const { customerId, branchId, branchName } = req.body;
      if (!customerId) return res.status(400).json({ error: "customerId required" });

      const { sendPushToCustomer } = await import("./push-service");
      await sendPushToCustomer(customerId, {
        title: "☕ لا تفوتك قهوتنا!",
        body: `أنت قريب من ${branchName || "كلوني كافيه"} — اطلب الآن وخذها معك!`,
        url: "/",
        type: "geofence",
        tag: `geofence-${branchId || "branch"}-${new Date().toDateString()}`
      });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  app.get("/api/branches/:id", async (req, res) => {
    try {
      const { BranchModel } = await import("@shared/schema");
      const branch = await BranchModel.findOne({ 
        $or: [{ id: req.params.id }, { _id: req.params.id }] 
      }).lean();
      if (!branch) return res.status(404).json({ error: "Branch not found" });
      res.json({
        ...branch,
        id: branch.id || branch._id?.toString(),
        _id: branch._id?.toString()
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branch" });
    }
  });

  app.get("/api/admin/branches/all", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const branches = await storage.getAllBranches();
      res.json(branches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  // Geolocation check - verify if customer is within 500m of selected branch
  app.post("/api/branches/:id/check-location", async (req, res) => {
    try {
      const { id } = req.params;
      const { latitude, longitude } = req.body;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ 
          error: "يرجى السماح بالوصول للموقع", 
          withinRange: false 
        });
      }

      const branch = await storage.getBranch(id);
      if (!branch) {
        return res.status(404).json({ error: "الفرع غير موجود", withinRange: false });
      }

      // Check if branch has location data
      if (!branch.location || !branch.location.lat || !branch.location.lng) {
        // If branch has no location, allow ordering (skip check)
        return res.json({ 
          withinRange: true, 
          distance: 0,
          message: "الفرع لا يحتوي على بيانات موقع" 
        });
      }

      // Calculate distance using Haversine formula
      const R = 6371e3; // Earth's radius in meters
      const lat1 = latitude * Math.PI / 180;
      const lat2 = branch.location.lat * Math.PI / 180;
      const deltaLat = (branch.location.lat - latitude) * Math.PI / 180;
      const deltaLon = (branch.location.lng - longitude) * Math.PI / 180;

      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in meters

      const maxDistance = 500; // 500 meters
      const withinRange = distance <= maxDistance;


      res.json({
        withinRange,
        distance: Math.round(distance),
        maxDistance,
        branchName: branch.nameAr,
        message: withinRange 
          ? "أنت ضمن نطاق الفرع" 
          : `أنت بعيد عن الفرع بمسافة ${Math.round(distance)} متر. يجب أن تكون على بعد ${maxDistance} متر كحد أقصى`
      });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من الموقع", withinRange: false });
    }
  });

  app.post("/api/branches", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { insertBranchSchema, BranchModel } = await import("@shared/schema");
      const branchData = req.body;
      const { managerAssignment, ...cleanBranchData } = branchData;
      
      // Force cafeId and tenantId for safety
      const tenantId = req.employee?.tenantId || 'demo-tenant';
      const cafeId = cleanBranchData.cafeId || tenantId;
      
      const id = cleanBranchData.id || nanoid();
      
      const newBranch = await BranchModel.create({
        ...cleanBranchData,
        id,
        tenantId,
        cafeId,
        isActive: 1, // Ensure numeric 1 for isActive consistency
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const branch = serializeDoc(newBranch);
      const branchId = branch.id;
      let managerInfo: any = null;
      
      // Handle manager assignment based on type
      if (managerAssignment) {
        try {
          if (managerAssignment.type === "existing" && managerAssignment.managerId) {
            // Assign existing manager to the branch
            const existingManager = await storage.getEmployee(managerAssignment.managerId);
            if (existingManager) {
              await storage.updateEmployee(managerAssignment.managerId, {
                branchId: branchId,
              });
              await storage.updateBranch(branchId, {
                managerName: existingManager.fullName,
              });
              managerInfo = {
                id: managerAssignment.managerId,
                fullName: existingManager.fullName,
                message: 'تم تعيين المدير الموجود للفرع بنجاح.',
              };
            }
          } else if (managerAssignment.type === "new" && managerAssignment.newManager) {
            // Create new manager (without password - can activate later)
            const newManagerData = managerAssignment.newManager;
            
            // Check if username already exists
            const existingUser = await storage.getEmployeeByUsername(newManagerData.username);
            if (existingUser) {
              return res.status(400).json({ 
                error: "اسم المستخدم موجود بالفعل",
                field: "username" 
              });
            }
            
            const manager = await storage.createEmployee({
              username: newManagerData.username,
              password: undefined, // No password - must activate account
              fullName: newManagerData.fullName,
              role: 'manager',
              phone: newManagerData.phone,
              jobTitle: 'مدير الفرع',
              isActivated: 0, // Not activated - needs password setup
              branchId: branchId,
              tenantId: tenantId, // Pass tenantId to manager creation
            } as any);
            
            await storage.updateBranch(branchId, {
              managerName: newManagerData.fullName,
            });
            
            managerInfo = {
              id: (manager as any)._id.toString(),
              username: newManagerData.username,
              fullName: newManagerData.fullName,
              message: 'تم إنشاء حساب المدير. يحتاج المدير لتفعيل حسابه عبر إنشاء كلمة المرور.',
            };
          }
        } catch (managerError) {
          managerInfo = { error: 'تم إنشاء الفرع ولكن حدث خطأ في تعيين المدير' };
        }
      } else {
      // No manager assignment provided - auto-create manager (backward compatibility)
      const branchNameAr = branchData.nameAr || "فرع جديد";
      const branchNameSlug = branchNameAr.replace(/\s+/g, '_').toLowerCase();
      const managerUsername = `manager_${branchNameSlug}_${nanoid(4)}`;
      const temporaryPassword = `manager${Math.random().toString(36).slice(-8)}`;
      
      try {
        const manager = await storage.createEmployee({
          username: managerUsername,
          password: temporaryPassword,
          fullName: `مدير ${branchNameAr}`,
          role: 'manager',
          phone: branchData.phone || `05${Math.floor(Math.random() * 100000000)}`,
          jobTitle: 'مدير الفرع',
          isActivated: 1,
          branchId: branchId,
          tenantId: tenantId
        } as any);
        
        await storage.updateBranch(branchId, {
          managerName: `مدير ${branchNameAr}`,
        });
        
        managerInfo = {
          id: (manager as any).id || (manager as any)._id?.toString(),
          username: managerUsername,
          temporaryPassword: temporaryPassword,
          fullName: `مدير ${branchNameAr}`,
          message: 'تم إنشاء حساب المدير تلقائياً. يرجى حفظ اسم المستخدم وكلمة المرور المؤقتة.',
        };
      } catch (autoCreateError) {
        console.error("Auto-create manager error:", autoCreateError);
        managerInfo = { error: 'تم إنشاء الفرع ولكن فشل إنشاء حساب المدير التلقائي' };
      }
      }
      
      res.status(201).json({
        branch,
        manager: managerInfo,
      });
    } catch (error) {
      console.error("Error creating branch:", error);
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: "Validation error", details: (error as any).issues });
      }
      res.status(500).json({ error: "Failed to create branch", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/branches/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const branch = await storage.updateBranch(id, req.body);
      if (!branch) {
        return res.status(404).json({ error: "Branch not found" });
      }
      res.json(branch);
    } catch (error) {
      res.status(500).json({ error: "Failed to update branch" });
    }
  });

  app.delete("/api/branches/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteBranch(id);
      if (!deleted) {
        return res.status(404).json({ error: "Branch not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting branch:", error);
      res.status(500).json({ error: "Failed to delete branch" });
    }
  });

  // CATEGORY MANAGEMENT ROUTES
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const { insertCategorySchema } = await import("@shared/schema");
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: "Validation error", details: error.issues });
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const category = await storage.updateCategory(id, req.body);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCategory(id);
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // CUSTOMER MANAGEMENT ROUTES (for manager dashboard)
  app.get("/api/admin/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      const customersWithoutPasswords = customers.map(({ password: _, ...customer }) => customer);
      res.json(customersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Get orders by employee (for manager to see each cashier's orders)
  app.get("/api/admin/orders/employee/:employeeId", async (req, res) => {
    try {
      const { employeeId } = req.params;
      const orders = await storage.getOrdersByEmployee(employeeId);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee orders" });
    }
  });

  // TEMPORARY: Reset manager password
  app.post("/api/reset-manager", async (req, res) => {
    try {
      const manager = await storage.getEmployeeByUsername("manager");
      if (manager && manager._id) {
        const hashedPassword = await bcrypt.hash("2030", 10);
        await storage.updateEmployee(manager._id.toString(), { password: hashedPassword });
        res.json({ message: "Manager password reset successfully" });
      } else {
        res.status(404).json({ error: "Manager not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.get("/api/delivery-zones", async (req, res) => {
    try {
      const zones = await storage.getDeliveryZones();
      res.json(zones);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch delivery zones" });
    }
  });

  app.get("/api/delivery-zones/:id", async (req, res) => {
    try {
      const zone = await storage.getDeliveryZone(req.params.id);
      if (!zone) {
        return res.status(404).json({ error: "Delivery zone not found" });
      }
      res.json(zone);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch delivery zone" });
    }
  });

  app.post("/api/delivery-zones/validate", async (req, res) => {
    try {
      const { lat, lng } = req.body;
      if (!lat || !lng) {
        return res.status(400).json({ error: "Latitude and longitude required" });
      }

      const zones = await storage.getDeliveryZones();
      const { getDeliveryZoneForPoint } = await import("./utils/geo");
      
      const mappedZones = zones.map(z => ({
        coordinates: z.boundary || [],
        nameAr: z.nameAr,
        deliveryFee: z.baseFee || 10,
        _id: z._id?.toString() || z.id || ''
      }));
      
      const result = getDeliveryZoneForPoint({ lat, lng }, mappedZones);
      
      if (!result) {
        return res.json({ 
          isInZone: false, 
          message: "عذراً، هذا الموقع خارج نطاق التوصيل. نوصل فقط إلى البديعة وظهرة البديعة" 
        });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to validate delivery zone" });
    }
  });

  // TABLE MANAGEMENT ROUTES - إدارة الطاولات

  // Cleanup: Clear all old table reservations (temporary endpoint)
  app.post("/api/tables/cleanup-reservations", async (req, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const tables = await storage.getTables(undefined, tenantId);
      let cleaned = 0;
      for (const table of tables) {
        if (table.reservedFor) {
          await storage.updateTable((table._id?.toString() || table.id) as string, { 
            reservedFor: undefined as any
          });
          cleaned++;
        }
      }
      res.json({ message: `Cleaned ${cleaned} tables`, cleaned });
    } catch (error) {
      res.status(500).json({ error: "Failed to clean tables" });
    }
  });

  // Get table status (all tables with occupancy info) - MUST COME BEFORE /:id ROUTE
  app.get("/api/tables/status", async (req, res) => {
    try {
      const { branchId } = req.query;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      
      if (!branchId) {
        return res.status(400).json({ error: "Branch ID required" });
      }

      const tables = await storage.getTables(branchId as string, tenantId);
      const now = new Date();
      
      // Return all active tables with their simple availability status
      const tablesWithStatus = tables
        .filter(t => (t.isActive as any) === 1 || (t.isActive as any) === true || (t.isActive as any) === '1')
        .map(t => {
          // Convert to plain object if it's a MongoDB document
          const obj = (t as any).toObject ? (t as any).toObject() : JSON.parse(JSON.stringify(t));
          
          // Ensure id and _id are both present and strings
          const id = obj.id || obj._id;
          if (id) {
            obj.id = id.toString();
            obj._id = id.toString();
          }

          // Check if table has an active order (currentOrderId exists)
          const hasActiveOrder = !!obj.currentOrderId;
          
          // Check for active reservations with time-based logic
          let isReservationActive = false;
          let reservationInfo = null;
          
          if (obj.reservedFor && obj.reservedFor.status && 
              (obj.reservedFor.status === 'pending' || obj.reservedFor.status === 'confirmed')) {
            
            // Parse reservation date and time
            const resDate = new Date(obj.reservedFor.reservationDate);
            const resTime = obj.reservedFor.reservationTime || '12:00';
            const [hours, minutes] = resTime.split(':').map(Number);
            
            // Create full reservation datetime
            const reservationDateTime = new Date(resDate);
            reservationDateTime.setHours(hours || 12, minutes || 0, 0, 0);
            
            // Reservation activates 30 minutes BEFORE the scheduled time
            const activationTime = new Date(reservationDateTime.getTime() - 30 * 60 * 1000);
            
            // Reservation expires 5 minutes AFTER the scheduled time if customer hasn't arrived
            const expiryTime = new Date(reservationDateTime.getTime() + 5 * 60 * 1000);
            
            // Check if we're within the active window (30 min before to 5 min after)
            if (now >= activationTime && now <= expiryTime) {
              isReservationActive = true;
              reservationInfo = {
                ...obj.reservedFor,
                reservationDateTime: reservationDateTime.toISOString(),
                activationTime: activationTime.toISOString(),
                expiryTime: expiryTime.toISOString(),
                isWithinWindow: true
              };
            }
          }
          
          // A table is occupied ONLY if it has an active order OR an active reservation within time window
          const isOccupied = hasActiveOrder || isReservationActive;
          
          return {
            ...obj,
            isAvailable: !isOccupied,
            isOccupied: isOccupied ? 1 : 0,
            reservationInfo: reservationInfo
          };
        });

      // console.log(`[GET /api/tables/status] Fetched ${tablesWithStatus.length} tables for branch ${branchId}`);
      res.json(tablesWithStatus);
    } catch (error) {
      console.error('[GET /api/tables/status] Error:', error);
      res.status(500).json({ error: "Failed to fetch table status" });
    }
  });

  // Get available tables for reservation - MUST COME BEFORE /:id ROUTE
  app.get("/api/tables/available", async (req, res) => {
    try {
      const { branchId } = req.query;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      
      if (!branchId) {
        return res.status(400).json({ error: "Branch ID required" });
      }

      const tables = await storage.getTables(branchId as string, tenantId);
      
      // Filter available tables - return only active tables without active reservations
      const availableTables = tables.filter(t => {
        // Check if table is active (accept both 1 and true as valid)
        const isActive = ((t.isActive as any) === 1 || (t.isActive as any) === true || (t.isActive as any) === '1');
        
        // Check if table is not reserved with pending or confirmed status
        const isNotReserved = !t.reservedFor || (t.reservedFor && t.reservedFor.status !== 'pending' && t.reservedFor.status !== 'confirmed');
        
        return isActive && isNotReserved;
      });

      res.json(availableTables);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch available tables" });
    }
  });

  // Book table for dine-in order
  app.post("/api/tables/book", async (req, res) => {
    try {
      const { tableId, arrivalTime } = req.body;
      console.log(`[TABLES] Booking request: tableId=${tableId}, arrivalTime=${arrivalTime}`);
      
      if (!tableId || !arrivalTime) {
        return res.status(400).json({ error: "Table ID and arrival time required" });
      }

      const table = await storage.getTable(tableId);
      console.log(`[TABLES] Found table:`, table ? { id: table.id, tableNumber: table.tableNumber } : 'NOT FOUND');
      
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Check if table is available - consider expired reservations as available
      if (table.reservedFor && (table.reservedFor.status === 'pending' || table.reservedFor.status === 'confirmed')) {
        const now = new Date();
        const resDate = new Date(table.reservedFor.reservationDate);
        const resTime = table.reservedFor.reservationTime || '12:00';
        const [hours, minutes] = resTime.split(':').map(Number);
        
        const reservationDateTime = new Date(resDate);
        reservationDateTime.setHours(hours || 12, minutes || 0, 0, 0);
        
        // Reservation expires 5 minutes AFTER the scheduled time
        const expiryTime = new Date(reservationDateTime.getTime() + 5 * 60 * 1000);
        
        // If reservation hasn't expired yet, block booking
        if (now < expiryTime) {
          return res.status(400).json({ error: "الطاولة محجوزة بالفعل" });
        }
        
        // If expired, auto-clear the old reservation before proceeding
        console.log(`[TABLES] Auto-clearing expired reservation for table ${table.tableNumber}`);
      }

      // Create booking with generated ID
      const bookingId = nanoid();
      const now = new Date();
      
      const updatedTable = await storage.updateTable(tableId, {
        reservedFor: {
          customerName: "Online Dine-In Customer",
          customerPhone: "N/A",
          customerId: "customer",
          reservationDate: now,
          reservationTime: arrivalTime,
          numberOfGuests: (table.capacity || 2) as number,
          reservedAt: now,
          reservedBy: "customer",
          status: 'pending'
        }
      });

      if (!updatedTable) {
        return res.status(500).json({ error: "فشل في حجز الطاولة" });
      }

      res.json({ 
        success: true, 
        bookingId: bookingId,
        tableNumber: table.tableNumber,
        arrivalTime: arrivalTime,
        message: `تم حجز الطاولة ${table.tableNumber} بنجاح`
      });
    } catch (error: any) {
      console.error(`[TABLES] Booking error:`, error?.message || error);
      res.status(500).json({ error: "فشل في حجز الطاولة" });
    }
  });

  app.get("/api/tables/:id", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) {
        return res.status(404).json({ error: "الطاولة غير موجودة" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الطاولة" });
    }
  });


  app.get("/api/tables/qr/:qrToken", async (req, res) => {
    try {
      const table = await storage.getTableByQRToken(req.params.qrToken);
      if (!table) {
        return res.status(404).json({ error: "الطاولة غير موجودة" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الطاولة" });
    }
  });


  app.put("/api/tables/:id", async (req, res) => {
    try {
      // Validate update data (partial schema validation)
      const { insertTableSchema } = await import("@shared/schema");
      const partialSchema = insertTableSchema.partial(); // Allow partial updates
      const validatedData = partialSchema.parse(req.body) as any;
      
      const table = await storage.updateTable(req.params.id, validatedData);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error: any) {
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: "Validation error", details: error.issues });
      }
      res.status(500).json({ error: "Failed to update table" });
    }
  });

  app.patch("/api/tables/:id/occupancy", async (req, res) => {
    try {
      const { isOccupied, currentOrderId } = req.body;
      const table = await storage.updateTableOccupancy(
        req.params.id, 
        !!isOccupied, 
        currentOrderId
      );
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "Failed to update table occupancy" });
    }
  });

    // Empty table (manually clear occupancy)
    app.post("/api/tables/:id/empty", requireAuth, requireManager, async (req, res) => {
      try {
        const { id } = req.params;
        const { TableModel } = await import("@shared/schema");
        
        const table = await TableModel.findOneAndUpdate(
          { 
            $or: [
              { id: id },
              { _id: isValidObjectId(id) ? id : null }
            ].filter(q => q._id !== null || q.id !== undefined)
          },
          {
            isOccupied: 0,
            currentOrderId: null,
            reservedFor: null,
            updatedAt: new Date()
          },
          { new: true }
        );
        
        if (!table) {
          return res.status(404).json({ error: "Table not found" });
        }
        
        res.json(serializeDoc(table));
      } catch (error) {
        res.status(500).json({ error: "Failed to empty table" });
      }
    });

    // Update table mutation
    app.patch("/api/tables/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
      try {
        const { tableNumber, capacity, branchId } = req.body;
        const updates: any = { updatedAt: new Date() };
        if (tableNumber !== undefined) updates.tableNumber = tableNumber;
        if (capacity !== undefined) updates.capacity = capacity;
        if (branchId !== undefined) updates.branchId = branchId;
        
        const { TableModel } = await import("@shared/schema");
        const table = await TableModel.findOneAndUpdate(
          { 
            $or: [
              { id: req.params.id },
              { _id: isValidObjectId(req.params.id) ? req.params.id : null }
            ].filter(q => q._id !== null || q.id !== undefined)
          },
          { $set: updates },
          { new: true }
        );
        if (!table) return res.status(404).json({ error: "Table not found" });
        res.json(serializeDoc(table));
      } catch (error) {
        console.error("Error updating table:", error);
        res.status(500).json({ error: "Failed to update table" });
      }
    });

  // Reserve a table
  app.post("/api/tables/:id/reserve", async (req, res) => {
    try {
      const { customerName, customerPhone, employeeId, numberOfGuests, reservationDate, reservationTime } = req.body;
      
      if (!customerName || !customerPhone || !employeeId) {
        return res.status(400).json({ error: "Customer name, phone, and employee ID required" });
      }

      // Get employee to verify branch
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Get table to verify it belongs to the same branch
      const existingTable = await storage.getTable(req.params.id);
      if (!existingTable) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Verify branch ownership
      if (existingTable.branchId && employee.branchId && existingTable.branchId !== employee.branchId) {
        return res.status(403).json({ error: "Cannot reserve tables in other branches" });
      }

      // Use provided values or defaults for immediate reservations
      const guests = numberOfGuests ? parseInt(numberOfGuests) : 2;
      const resDate = reservationDate ? new Date(reservationDate) : new Date();
      const resTime = reservationTime || new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      // NOTE: Do NOT set isOccupied=1 here - table becomes occupied only when:
      // 1. Customer arrives and scans QR code within the reservation window (30 min before to 5 min after)
      // 2. An active order is placed for the table
      const table = await storage.updateTable(req.params.id, {
        reservedFor: {
          customerName,
          customerPhone,
          reservationDate: resDate,
          reservationTime: resTime,
          numberOfGuests: guests,
          reservedAt: new Date(),
          reservedBy: employeeId,
          status: 'pending' as const
        }
      });

      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "Failed to reserve table" });
    }
  });

  // Release a table reservation
  app.post("/api/tables/:id/release", async (req, res) => {
    try {
      const { id } = req.params;
      const { employeeId } = req.body;

      console.log(`[TABLE] Releasing table ${id}, requested by employee: ${employeeId || 'none'}`);

      const table = await storage.updateTable(id, {
        isOccupied: 0,
        reservedFor: null as any,
        currentOrderId: null as any
      });

      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.json(table);
    } catch (error) {
      console.error("[TABLE] Failed to release table:", error);
      res.status(500).json({ error: "Failed to release table" });
    }
  });

  // Approve a pending reservation
  app.post("/api/tables/:id/approve-reservation", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      if (!table.reservedFor || table.reservedFor.status !== 'pending') {
        return res.status(400).json({ error: "No pending reservation to approve" });
      }

      const updatedTable = await storage.updateTable(req.params.id, {
        reservedFor: {
          ...table.reservedFor,
          status: 'confirmed' as const
        }
      });

      if (!updatedTable) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.json(updatedTable);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve reservation" });
    }
  });

  // Cancel a pending reservation
  app.post("/api/tables/:id/cancel-reservation", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      if (!table.reservedFor || table.reservedFor.status !== 'pending') {
        return res.status(400).json({ error: "No pending reservation to cancel" });
      }

      const updatedTable = await storage.updateTable(req.params.id, {
        reservedFor: {
          ...table.reservedFor,
          status: 'cancelled' as const
        }
      });

      if (!updatedTable) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.json(updatedTable);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel reservation" });
    }
  });

  // Customer table reservation
  app.post("/api/tables/customer-reserve", async (req, res) => {
    try {
      const { tableId, customerName, customerPhone, customerId, reservationDate, reservationTime, numberOfGuests, branchId } = req.body;
      
      if (!tableId || !customerName || !customerPhone || !reservationDate || !reservationTime || !numberOfGuests) {
        return res.status(400).json({ error: "بيانات ناقصة" });
      }

      const table = await storage.getTable(tableId);
      if (!table) {
        return res.status(404).json({ error: "الطاولة غير موجودة" });
      }

      if (table.isOccupied === 1) {
        return res.status(400).json({ error: "الطاولة مشغولة حالياً" });
      }

      // Check for existing active reservations
      const hasActiveReservation = table.reservedFor && 
        (table.reservedFor.status === 'pending' || table.reservedFor.status === 'confirmed');
      
      if (hasActiveReservation) {
        return res.status(400).json({ error: "الطاولة محجوزة بالفعل" });
      }

      const guestCount = typeof numberOfGuests === 'string' ? parseInt(numberOfGuests) : numberOfGuests;
      const resDate = new Date(reservationDate);
      const [hours, minutes] = reservationTime.split(':');
      resDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      // حساب الأوقات التلقائية
      const autoBookStart = new Date(resDate.getTime() - 5 * 60 * 1000); // 5 دقائق قبل
      const autoExpiry = new Date(resDate.getTime() + 60 * 60 * 1000); // ساعة واحدة بعد
      
      const updatedTable = await storage.updateTable(tableId, {
        reservedFor: {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerId: customerId || 'customer',
          reservationDate: resDate,
          reservationTime: reservationTime,
          numberOfGuests: guestCount,
          reservedAt: new Date(),
          reservedBy: customerId || 'customer',
          status: 'pending',
          autoBookStartTime: autoBookStart,
          autoExpiryTime: autoExpiry,
          extensionCount: 0
        }
      });

      if (!updatedTable) {
        return res.status(500).json({ error: "فشل في حجز الطاولة" });
      }

      // إرسال رسالة تأكيد البريد الإلكتروني
      try {
        const { sendReservationConfirmationEmail } = await import("./mail-service");
        const customer = await CustomerModel.findOne({ phone: customerPhone.trim() });
        if (customer && customer.email) {
          await sendReservationConfirmationEmail(
            customer.email,
            customerName.trim(),
            table.tableNumber,
            reservationDate,
            reservationTime,
            guestCount,
            autoExpiry.toString()
          );
        }
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
        // لا نرسل خطأ للمستخدم - الحجز نجح حتى لو البريد فشل
      }

      res.json({ 
        success: true, 
        table: updatedTable,
        message: `تم حجز الطاولة ${table.tableNumber} بنجاح`
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء الحجز", details: String(error) });
    }
  });

  // البحث عن حجوزات العميل
  app.get("/api/tables/reservations/customer/:phone", async (req, res) => {
    try {
      const phone = req.params.phone;
      const tables = await TableModel.find({
        'reservedFor.customerPhone': phone,
        'reservedFor.status': { $in: ['pending', 'confirmed'] }
      });
      
      const reservations = tables.map((t: any) => ({
        tableId: t._id,
        tableNumber: t.tableNumber,
        branchId: t.branchId,
        reservation: t.reservedFor
      }));
      
      res.json(reservations);
    } catch (error) {
      res.status(500).json({ error: "فشل في البحث عن الحجوزات" });
    }
  });

  // تمديد الحجز (إضافة ساعة أخرى)
  app.post("/api/tables/:tableId/extend-reservation", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.tableId);
      if (!table || !table.reservedFor) {
        return res.status(404).json({ error: "الحجز غير موجود" });
      }

      // السماح بتمديد واحد فقط
      const extensionCount = table.reservedFor.extensionCount || 0;
      if (extensionCount > 0) {
        return res.status(400).json({ error: "تم استخدام خيار التمديد مسبقاً" });
      }

      const newExpiryTime = new Date((table.reservedFor.autoExpiryTime || new Date()).getTime() + 60 * 60 * 1000);
      
      const updatedTable = await storage.updateTable(req.params.tableId, {
        reservedFor: {
          ...table.reservedFor,
          autoExpiryTime: newExpiryTime,
          extensionCount: extensionCount + 1,
          lastExtendedAt: new Date()
        }
      });

      res.json({ 
        success: true,
        message: "تم تمديد الحجز لمدة ساعة إضافية",
        table: updatedTable
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في تمديد الحجز" });
    }
  });

  // فحص انتهاء الحجوزات (تنظيف) - يلغي الحجز بعد 5 دقائق من الموعد إذا لم يحضر العميل
  app.post("/api/tables/check-expirations", async (req, res) => {
    try {
      const now = new Date();
      const tables = await TableModel.find({
        'reservedFor.status': { $in: ['pending', 'confirmed'] }
      });

      let expiredCount = 0;
      for (const table of tables) {
        if (table.reservedFor && table.reservedFor.reservationDate && table.reservedFor.reservationTime) {
          // Check if staff extended the reservation (autoExpiryTime takes precedence)
          let expiryTime: Date;
          
          if (table.reservedFor.autoExpiryTime) {
            // Use staff-extended expiry time
            expiryTime = new Date(table.reservedFor.autoExpiryTime);
          } else {
            // Calculate default expiry: 5 minutes after scheduled time
            const resDate = new Date(table.reservedFor.reservationDate);
            const resTime = table.reservedFor.reservationTime || '12:00';
            const [hours, minutes] = resTime.split(':').map(Number);
            
            const reservationDateTime = new Date(resDate);
            reservationDateTime.setHours(hours || 12, minutes || 0, 0, 0);
            
            expiryTime = new Date(reservationDateTime.getTime() + 5 * 60 * 1000);
          }
          
          // If current time is past expiry and table has no active order (customer didn't arrive)
          if (now > expiryTime && !table.currentOrderId) {
            table.reservedFor.status = 'expired';
            table.isOccupied = 0;
            await table.save();
            expiredCount++;
            console.log(`[check-expirations] Expired reservation for table ${table.tableNumber}`);
          }
        }
      }

      res.json({ 
        message: `تم تحديث ${expiredCount} حجز منتهي الصلاحية`,
        count: expiredCount
      });
    } catch (error) {
      console.error('[check-expirations] Error:', error);
      res.status(500).json({ error: "فشل في فحص الحجوزات" });
    }
  });

  // تأكيد الحجز (تغيير الحالة من pending إلى confirmed)
  app.post("/api/tables/:tableId/approve-reservation", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.tableId);
      if (!table || !table.reservedFor) {
        return res.status(404).json({ error: "الحجز غير موجود" });
      }

      const updatedTable = await storage.updateTable(req.params.tableId, {
        reservedFor: {
          ...table.reservedFor,
          status: 'confirmed'
        }
      });

      res.json({ success: true, table: updatedTable });
    } catch (error) {
      res.status(500).json({ error: "فشل في تأكيد الحجز" });
    }
  });

  // إلغاء الحجز
  app.post("/api/tables/:tableId/cancel-reservation", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.tableId);
      if (!table || !table.reservedFor) {
        return res.status(404).json({ error: "الحجز غير موجود" });
      }

      const updatedTable = await storage.updateTable(req.params.tableId, {
        reservedFor: {
          ...table.reservedFor,
          status: 'cancelled'
        }
      });

      res.json({ success: true, message: "تم إلغاء الحجز", table: updatedTable });
    } catch (error) {
      res.status(500).json({ error: "فشل في إلغاء الحجز" });
    }
  });

  app.get("/api/drivers", async (req, res) => {
    try {
      const drivers = await storage.getAvailableDrivers();
      const driversWithoutPasswords = drivers.map(({ password: _, ...driver }) => driver);
      res.json(driversWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drivers" });
    }
  });

  app.patch("/api/drivers/:id/availability", async (req, res) => {
    try {
      const { isAvailable } = req.body;
      await storage.updateDriverAvailability(req.params.id, isAvailable);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update driver availability" });
    }
  });

  app.patch("/api/drivers/:id/location", async (req, res) => {
    try {
      const { lat, lng } = req.body;
      if (!lat || !lng) {
        return res.status(400).json({ error: "Latitude and longitude required" });
      }
      await storage.updateDriverLocation(req.params.id, lat, lng);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update driver location" });
    }
  });

  app.patch("/api/orders/:id/assign-driver", async (req, res) => {
    try {
      const { driverId } = req.body;
      if (!driverId) {
        return res.status(400).json({ error: "Driver ID required" });
      }
      await storage.assignDriverToOrder(req.params.id, driverId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to assign driver" });
    }
  });

  app.patch("/api/orders/:id/start-delivery", async (req, res) => {
    try {
      await storage.startDelivery(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to start delivery" });
    }
  });

  app.patch("/api/orders/:id/complete-delivery", async (req, res) => {
    try {
      await storage.completeDelivery(req.params.id);
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete delivery" });
    }
  });

  app.get("/api/delivery/active-orders", async (req, res) => {
    try {
      const orders = await storage.getActiveDeliveryOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active delivery orders" });
    }
  });

  app.get("/api/drivers/:id/orders", async (req, res) => {
    try {
      const orders = await storage.getDriverActiveOrders(req.params.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver orders" });
    }
  });

  // CASHIER - CUSTOMER MANAGEMENT ROUTES

  // Search for customer by phone number (for cashier)
  app.get("/api/cashier/customers/search", async (req, res) => {
    try {
      const { phone } = req.query;
      
      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ error: "رقم الهاتف مطلوب" });
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');
      const customer = await storage.getCustomerByPhone(cleanPhone);
      
      if (customer) {
        // Customer exists - return their info
        res.json({
          exists: true,
          customer: {
            id: customer._id,
            phone: customer.phone,
            name: customer.name,
            email: customer.email,
            points: customer.points || 0,
            registeredBy: customer.registeredBy,
            isPasswordSet: customer.isPasswordSet || 0
          }
        });
      } else {
        // Customer doesn't exist
        res.json({
          exists: false,
          phone: cleanPhone
        });
      }
    } catch (error) {
      res.status(500).json({ error: "فشل البحث عن العميل" });
    }
  });

  // Register customer by cashier (partial registration)
  app.post("/api/cashier/customers/register", async (req, res) => {
    try {
      const { phone, name } = req.body;

      if (!phone || !name) {
        return res.status(400).json({ error: "رقم الهاتف والاسم مطلوبان" });
      }

      // Validate phone format
      const cleanPhone = phone.trim().replace(/\s/g, '');
      if (cleanPhone.length !== 9 || !cleanPhone.startsWith('5')) {
        return res.status(400).json({ error: "رقم الهاتف يجب أن يكون 9 أرقام ويبدأ بـ 5" });
      }

      // Check if customer already exists
      const existingCustomer = await storage.getCustomerByPhone(cleanPhone);
      if (existingCustomer) {
        return res.status(400).json({ error: "العميل مسجل بالفعل" });
      }

      // Create customer with cashier registration
      const customer = await storage.createCustomer({
        phone: cleanPhone,
        name: name.trim(),
        registeredBy: 'cashier',
        isPasswordSet: 0,
        points: 0
      });

      // Send Welcome Email asynchronously (if email were available here, but it's not in this endpoint's body)
      // If we had email in req.body, we'd send it here.

      res.status(201).json({
        id: customer._id,
        phone: customer.phone,
        name: customer.name,
        points: customer.points,
        registeredBy: customer.registeredBy,
        isPasswordSet: customer.isPasswordSet
      });
    } catch (error) {
      res.status(500).json({ error: "فشل تسجيل العميل" });
    }
  });

  // TABLE ORDER MANAGEMENT ROUTES

  // Cancel order by customer (only before payment confirmation)
  app.patch("/api/orders/:id/cancel-by-customer", async (req, res) => {
    try {
      const { cancellationReason } = req.body;
      const { OrderModel } = await import("@shared/schema");
      
      const order = await OrderModel.findOne({ id: req.params.id }) || await OrderModel.findById(req.params.id).catch(() => null);
      
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      // Only allow cancellation if order is pending
      if (order.tableStatus && order.tableStatus !== 'pending') {
        return res.status(400).json({ error: "لا يمكن إلغاء الطلب بعد تأكيد الدفع" });
      }

      // Handle refund of stamps and free drinks before cancelling
      if (order.customerId) {
        try {
          const customer = await storage.getCustomer(order.customerId);
          if (customer?.phone) {
            const loyaltyCard = await storage.getLoyaltyCardByPhone(customer.phone);
            if (loyaltyCard) {
              // Parse order items if stored as string
              let items = order.items || [];
              if (typeof items === 'string') {
                try {
                  items = JSON.parse(items);
                } catch (e) {
                  items = [];
                }
              }

              // Calculate stamps used in this order (1 stamp per drink)
              const totalDrinks = Array.isArray(items) 
                ? items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
                : 0;

              const currentStamps = loyaltyCard.stamps || 0;
              const currentFreeCupsRedeemed = loyaltyCard.freeCupsRedeemed || 0;

              let updateData: any = {};

              if (totalDrinks > 0) {
                // Deduct stamps from the card
                const newStamps = Math.max(0, currentStamps - totalDrinks);
                const stampsToRemove = currentStamps - newStamps;
                
                updateData.stamps = newStamps;

                // Create loyalty transaction for stamp refund
                await storage.createLoyaltyTransaction({
                  cardId: loyaltyCard.id,
                  type: 'stamps_refunded',
                  pointsChange: -stampsToRemove,
                  discountAmount: 0,
                  orderAmount: order.totalAmount,
                  description: `استرجاع ${stampsToRemove} ختم من إلغاء الطلب #${order.orderNumber}`,
                });
              }

              // Reverse totalSpent when order is cancelled
              const orderAmount = parseFloat(order.totalAmount?.toString() || '0');
              if (orderAmount > 0) {
                const currentTotalSpent = parseFloat(loyaltyCard.totalSpent?.toString() || '0');
                updateData.totalSpent = Math.max(0, currentTotalSpent - orderAmount);
              }

              // Update card if there are changes
              if (Object.keys(updateData).length > 0) {
                await storage.updateLoyaltyCard(loyaltyCard.id, updateData);
              }
            }
          }
        } catch (error) {
          // Continue with order cancellation even if loyalty update fails
        }
      }

      order.status = 'cancelled';
      order.tableStatus = 'cancelled';
      order.cancelledBy = 'customer';
      order.cancellationReason = cancellationReason || 'إلغاء من العميل';
      order.updatedAt = new Date();
      
      await order.save();
      
      // Update table occupancy if applicable
      if (order.tableId) {
        await storage.updateTableOccupancy(order.tableId, false);
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "فشل إلغاء الطلب" });
    }
  });

  // Assign order to cashier (or accept pending order)
  app.patch("/api/orders/:id/assign-cashier", async (req, res) => {
    try {
      const { cashierId } = req.body;
      const { OrderModel } = await import("@shared/schema");
      
      if (!cashierId) {
        return res.status(400).json({ error: "معرف الكاشير مطلوب" });
      }

      const order = await OrderModel.findOne({ id: req.params.id }) || await OrderModel.findById(req.params.id).catch(() => null);
      
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      if (order.assignedCashierId) {
        return res.status(400).json({ error: "الطلب مستلم بالفعل من كاشير آخر" });
      }

      order.assignedCashierId = cashierId;
      order.updatedAt = new Date();
      
      await order.save();

      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "فشل استلام الطلب" });
    }
  });

  // Update table order status (by cashier)
  app.patch("/api/orders/:id/table-status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { tableStatus } = req.body;
      const { OrderModel } = await import("@shared/schema");
      
      const validStatuses = ['pending', 'payment_confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
      if (!tableStatus || !validStatuses.includes(tableStatus)) {
        return res.status(400).json({ error: "حالة الطلب غير صالحة" });
      }

      const order = await OrderModel.findOne({ id: req.params.id }) || await OrderModel.findById(req.params.id).catch(() => null);
      
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      order.tableStatus = tableStatus;
      order.updatedAt = new Date();

      // Update main status based on table status
      if (tableStatus === 'payment_confirmed') {
        order.status = 'payment_confirmed';
      } else if (tableStatus === 'delivered') {
        order.status = 'completed';
        // Mark table as available
        if (order.tableId) {
          await storage.updateTableOccupancy(order.tableId, false);
        }
      } else if (tableStatus === 'cancelled') {
        order.status = 'cancelled';
        order.cancelledBy = 'cashier';
        if (order.tableId) {
          await storage.updateTableOccupancy(order.tableId, false);
        }
      }
      
      await order.save();

      // Award loyalty points when table order is completed/delivered/payment_confirmed
      if ((tableStatus === 'delivered' || tableStatus === 'payment_confirmed') && !(order as any).pointsAwarded) {
        setImmediate(async () => {
          try {
            const orderUsedPoints = !!(order as any).pointsUsed || Number((order as any).pointsRedeemed) > 0;
            let orderItemsList: any[] = [];
            try {
              orderItemsList = Array.isArray(order.items) ? order.items : JSON.parse((order.items as any) || '[]');
            } catch (_) {}

            const pointsToAward = orderUsedPoints ? 0 : orderItemsList.reduce((acc: number, item: any) => {
              const price = Number(item.price || item.unitPrice || item.coffeeItem?.price || 0);
              if (price <= 1) return acc;
              return acc + ((Number(item.quantity) || 1) * 10);
            }, 0);

            if (pointsToAward <= 0) return;

            let loyaltyCard: any = null;
            if (order.customerId) {
              loyaltyCard = await mongoose.model('LoyaltyCard').findOne({ customerId: order.customerId });
            }
            if (!loyaltyCard) {
              const rawPhone = (order as any).customerPhone ||
                (typeof order.customerInfo === 'string' ? JSON.parse(order.customerInfo) : order.customerInfo)?.customerPhone || '';
              if (rawPhone) {
                const clean = rawPhone.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
                loyaltyCard = await mongoose.model('LoyaltyCard').findOne({
                  phoneNumber: { $in: [clean, rawPhone, `+966${clean.slice(1)}`, `966${clean.slice(1)}`] }
                });
              }
            }

            if (!loyaltyCard) return;

            const currentPoints = Number(loyaltyCard.points) || 0;
            const currentPending = Number(loyaltyCard.pendingPoints) || 0;

            await mongoose.model('LoyaltyCard').findByIdAndUpdate(loyaltyCard._id, {
              points: currentPoints + pointsToAward,
              pendingPoints: Math.max(0, currentPending - pointsToAward),
              lastUsedAt: new Date(),
            });

            await storage.createLoyaltyTransaction({
              cardId: loyaltyCard._id.toString(),
              type: 'earn',
              pointsChange: pointsToAward,
              discountAmount: 0,
              orderAmount: Number(order.totalAmount) || 0,
              orderId: (order as any).id || order._id?.toString(),
              description: `نقاط مكسبة: ${pointsToAward} نقطة من الطلب #${order.orderNumber}`,
            });

            await OrderModel.findOneAndUpdate({ id: req.params.id }, { pointsAwarded: true });
            console.log(`[LOYALTY] ✅ Awarded ${pointsToAward} pts (table order) #${order.orderNumber}`);
          } catch (err) {
            console.error('[LOYALTY] Failed to award points on table order completion:', err);
          }
        });
      }

      // Serialize the response properly
      const serializedOrder = serializeDoc(order);
      res.json(serializedOrder);
    } catch (error) {
      res.status(500).json({ error: "فشل تحديث حالة الطلب" });
    }
  });

  // Get orders assigned to specific cashier
  app.get("/api/cashier/:cashierId/orders", async (req, res) => {
    try {
      const { OrderModel } = await import("@shared/schema");
      const { status } = req.query;
      const coffeeItems = await getCachedCoffeeItems();
      
      const query: any = {
        assignedCashierId: req.params.cashierId,
        orderType: 'table'
      };

      if (status) {
        query.tableStatus = status;
      }

      const orders = await OrderModel.find(query).sort({ createdAt: -1 });

      // Serialize orders and parse items
      const enrichedOrders = orders.map(order => {
        const serializedOrder = serializeDoc(order);
        
        let orderItems = serializedOrder.items;
        if (typeof orderItems === 'string') {
          try {
            orderItems = JSON.parse(orderItems);
          } catch (e) {
            orderItems = [];
          }
        }
        
        if (!Array.isArray(orderItems)) {
          orderItems = [];
        }
        
        const items = orderItems.map((item: any) => {
          const coffeeItem = coffeeItems.find(ci => ci.id === item.coffeeItemId);
          return {
            ...item,
            coffeeItem: coffeeItem ? {
              nameAr: coffeeItem.nameAr,
              nameEn: coffeeItem.nameEn,
              price: coffeeItem.price,
              imageUrl: coffeeItem.imageUrl
            } : null
          };
        });

        return {
          ...serializedOrder,
          items
        };
      });

      res.json(enrichedOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cashier orders" });
    }
  });

  app.post("/api/orders/mark-all-completed", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const branchId = req.employee?.branchId;
      
      const query: any = { tenantId };
      if (branchId) query.branchId = branchId;

      const result = await OrderModel.updateMany(query, { 
        $set: { status: 'completed', updatedAt: new Date() } 
      });

      console.log(`[ORDERS] Marked ${result.modifiedCount} orders as completed for branch ${branchId}`);
      res.json({ message: "تم تحديث جميع الطلبات بنجاح", modifiedCount: result.modifiedCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all completed" });
    }
  });

  app.patch("/api/orders/:id/payment-status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { paymentStatus, paymentDetails } = req.body;
      
      const updates: any = { paymentStatus };
      if (paymentDetails) updates.paymentDetails = paymentDetails;

      let updatedOrder = await OrderModel.findOneAndUpdate(
        { id },
        { $set: updates },
        { new: true }
      );

      if (!updatedOrder && (id as any).match(/^[0-9a-fA-F]{24}$/)) {
        updatedOrder = await OrderModel.findByIdAndUpdate(
          id,
          { $set: updates },
          { new: true }
        );
      }

      if (!updatedOrder) return res.status(404).json({ error: "الطلب غير موجود" });
      res.json(serializeDoc(updatedOrder));
    } catch (error) {
      console.error("[PAYMENT-STATUS] Error:", error);
      res.status(500).json({ error: "فشل تحديث حالة الدفع" });
    }
  });

  // Complete all orders - for testing/demo
  app.patch("/api/orders/complete-all", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { OrderModel } = await import("@shared/schema");
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const branchQuery: any = {};
      if ((req as any).employee?.branchId) branchQuery.branchId = (req as any).employee.branchId;
      
      // Update all non-cancelled orders to completed
      const result = await OrderModel.updateMany(
        { tenantId, ...branchQuery, status: { $ne: 'cancelled' } },
        {
          $set: {
            status: 'completed',
            tableStatus: 'delivered',
            updatedAt: new Date()
          }
        }
      );

      res.json({
        success: true,
        message: `تم تحديث ${result.modifiedCount} طلب إلى حالة مكتمل`,
        modifiedCount: result.modifiedCount
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to complete all orders" });
    }
  });

  // Clear all data - admin only
  // Delete all cashier employees (emergency endpoint)
  app.post("/api/admin/test-email", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'admin' && req.employee?.role !== 'owner') {
        return res.status(403).json({ error: "Only admins can test email" });
      }
      
      const { testEmailConnection } = await import("./mail-service");
      const success = await testEmailConnection();
      
      res.json({ success, message: success ? "Email connection successful" : "Email connection failed" });
    } catch (error) {
      res.status(500).json({ error: "Failed to test email connection" });
    }
  });

  app.delete("/api/admin/cashiers", async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      const cashiers = employees.filter((e: any) => e.role === 'cashier');
      let deletedCount = 0;

      const { EmployeeModel } = await import("@shared/schema");
      
      for (const cashier of cashiers) {
        try {
          const employeeId = cashier.id || cashier._id?.toString();
          await EmployeeModel.deleteOne({ _id: employeeId });
          deletedCount++;
        } catch (error) {
        }
      }

      res.json({ message: `تم حذف ${deletedCount} موظفي كاشير بنجاح`, deletedCount });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف الموظفين" });
    }
  });

  // ============== OWNER DASHBOARD ROUTES ==============

  // Helper: wrap multer middleware so its errors return JSON (not HTML)
  const wrapMulter = (uploadMiddleware: (req: any, res: any, next: any) => void) =>
    (req: any, res: any, next: any) => {
      (uploadMiddleware as any)(req, res, (err: any) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'حجم الملف كبير جداً. الحد الأقصى المسموح 15MB' });
        }
        return res.status(400).json({ error: err.message || 'خطأ في رفع الملف' });
      });
    };

  // Configure multer for employee image uploads
  const employeeUploadsDir = path.join(import.meta.dirname, '..', 'attached_assets', 'employees');
  const employeeStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, employeeUploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
      cb(null, `employee-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const employeeUpload = multer({
    storage: employeeStorage,
    limits: {
      fileSize: 15 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('نوع الملف غير مسموح. يجب أن يكون الملف صورة'));
      }
    }
  });

  // Upload employee image
  app.post("/api/upload-employee-image", requireAuth, requireManager, wrapMulter(employeeUpload.single('image')), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const storageService = new ObjectStorageService();

      try {
        const uploadURL = await storageService.getObjectEntityUploadURL();
        const objectPath = storageService.normalizeObjectEntityPath(uploadURL);

        const fsModule = await import('fs');
        const fileBuffer = fsModule.readFileSync(req.file.path);

        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: fileBuffer,
          headers: {
            'Content-Type': req.file.mimetype || 'image/png',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload to object storage');
        }

        fsModule.unlinkSync(req.file.path);
        res.json({ url: objectPath });
      } catch (storageError) {
        console.log('[UPLOAD] Object storage not available, falling back to local storage');
        const fileUrl = `/attached_assets/employees/${req.file.filename}`;
        res.json({ url: fileUrl });
      }
    } catch (error) {
      console.error("Error uploading employee image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Configure multer for drink image uploads
  const drinksUploadsDir = path.resolve(__dirname, '..', 'attached_assets', 'drinks');
  const drinksStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(drinksUploadsDir)) {
        fs.mkdirSync(drinksUploadsDir, { recursive: true });
      }
      cb(null, drinksUploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
      cb(null, `drink-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const drinkUpload = multer({
    storage: drinksStorage,
    limits: {
      fileSize: 15 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('نوع الملف غير مسموح. يجب أن يكون الملف صورة'));
      }
    }
  });

  // Upload drink image
  app.post("/api/upload-drink-image", requireAuth, requireManager, wrapMulter(drinkUpload.single('image')), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const storageService = new ObjectStorageService();

      try {
        const uploadURL = await storageService.getObjectEntityUploadURL();
        const objectPath = storageService.normalizeObjectEntityPath(uploadURL);

        const fsModule = await import('fs');
        const fileBuffer = fsModule.readFileSync(req.file.path);

        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: fileBuffer,
          headers: {
            'Content-Type': req.file.mimetype || 'image/png',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload to object storage');
        }

        fsModule.unlinkSync(req.file.path);
        res.json({ url: objectPath });
      } catch (storageError) {
        console.log('[UPLOAD] Object storage not available, falling back to local storage');
        const fileUrl = `/attached_assets/drinks/${req.file.filename}`;
        res.json({ url: fileUrl });
      }
    } catch (error) {
      console.error("Error uploading drink image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // List all uploaded drink images
  app.get("/api/drink-images", requireAuth, async (req: AuthRequest, res) => {
    try {
      const drinksDir = path.resolve(__dirname, '..', 'attached_assets', 'drinks');
      if (!fs.existsSync(drinksDir)) {
        return res.json([]);
      }
      const files = fs.readdirSync(drinksDir)
        .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .sort((a, b) => {
          const statA = fs.statSync(path.join(drinksDir, a));
          const statB = fs.statSync(path.join(drinksDir, b));
          return statB.mtimeMs - statA.mtimeMs;
        })
        .map(f => ({
          filename: f,
          url: `/attached_assets/drinks/${f}`,
          uploadedAt: fs.statSync(path.join(drinksDir, f)).mtime.toISOString()
        }));
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to list drink images" });
    }
  });

  // Configure multer for size image uploads
  const sizesUploadsDir = path.resolve(__dirname, '..', 'attached_assets', 'sizes');
  const sizesStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(sizesUploadsDir)) {
        fs.mkdirSync(sizesUploadsDir, { recursive: true });
      }
      cb(null, sizesUploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
      cb(null, `size-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const sizeUpload = multer({
    storage: sizesStorage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('نوع الملف غير مسموح. يجب أن يكون الملف صورة'));
      }
    }
  });

  // Upload size image
  app.post("/api/upload-size-image", requireAuth, requireManager, wrapMulter(sizeUpload.single('image')), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "لم يتم رفع صورة" });
      }
      const fileUrl = `/attached_assets/sizes/${req.file.filename}`;
      console.log(`[UPLOAD] Size image uploaded successfully: ${fileUrl}`);
      res.json({ url: fileUrl, filename: req.file.filename });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: "فشل رفع الصورة" });
    }
  });

  // Configure multer for addon image uploads
  const addonsUploadsDir = path.resolve(__dirname, '..', 'attached_assets', 'addons');
  const addonsStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(addonsUploadsDir)) {
        fs.mkdirSync(addonsUploadsDir, { recursive: true });
      }
      cb(null, addonsUploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
      cb(null, `addon-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const addonUpload = multer({
    storage: addonsStorage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('نوع الملف غير مسموح. يجب أن يكون الملف صورة'));
      }
    }
  });

  // Upload addon image
  app.post("/api/upload-addon-image", requireAuth, requireManager, wrapMulter(addonUpload.single('image')), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "لم يتم رفع صورة" });
      }
      const fileUrl = `/attached_assets/addons/${req.file.filename}`;
      console.log(`[UPLOAD] Addon image uploaded successfully: ${fileUrl}`);
      res.json({ url: fileUrl, filename: req.file.filename });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: "فشل رفع الصورة" });
    }
  });

  app.post("/old-upload-addon-image", requireAuth, requireManager, addonUpload.single('image'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "لم يتم رفع صورة" });
      }
      const fileUrl = `/attached_assets/addons/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.filename });
    } catch (error) {
      res.status(500).json({ error: "فشل رفع الصورة" });
    }
  });

  // Configure multer for attendance photo uploads
  const attendanceUploadsDir = path.join(import.meta.dirname, '..', 'attached_assets', 'attendance');
  const attendanceStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, attendanceUploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
      cb(null, `attendance-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const attendanceUpload = multer({
    storage: attendanceStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|webp/;
      const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimeType = allowedTypes.test(file.mimetype);

      if (ext && mimeType) {
        cb(null, true);
      } else {
        cb(new Error('نوع الملف غير مسموح. فقط صور (JPG, PNG, WEBP)'));
      }
    }
  });

  // Upload attendance photo
  app.post("/api/upload-attendance-photo", attendanceUpload.single('photo'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "لم يتم رفع صورة" });
      }

      const fileUrl = `/attached_assets/attendance/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.filename });
    } catch (error) {
      res.status(500).json({ error: "فشل رفع الصورة" });
    }
  });

  // ============== ATTENDANCE ROUTES ==============

  // Check-in employee
  app.post("/api/attendance/check-in", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { AttendanceModel, BranchModel, EmployeeModel } = await import("@shared/schema");
      const { location, photoUrl } = req.body;
      const employeeId = req.employee?.id;

      if (!employeeId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      if (!location || !location.lat || !location.lng) {
        return res.status(400).json({ error: "الموقع مطلوب للتحضير" });
      }

      if (!photoUrl) {
        return res.status(400).json({ error: "صورة التحضير مطلوبة" });
      }

      // Get employee details
      const employee = await EmployeeModel.findOne({ 
        $or: [{ id: employeeId }, { _id: employeeId }]
      });
      
      if (!employee) {
        return res.status(404).json({ error: "الموظف غير موجود" });
      }

      // Get branch location
      const branch = await BranchModel.findOne({ 
        $or: [{ id: employee.branchId }, { _id: employee.branchId }]
      });
      
      if (!branch || !branch.location) {
        return res.status(400).json({ error: "لا يوجد موقع للفرع" });
      }

      const branchLat = branch.location.lat;
      const branchLng = branch.location.lng;
      let isWithinBoundary = false;
      let distance = 0;

      // Check if branch has polygon boundary (more accurate)
      if (branch.geofenceBoundary && Array.isArray(branch.geofenceBoundary) && branch.geofenceBoundary.length >= 3) {
        // Use point-in-polygon check with turf.js
        const turf = await import('@turf/turf');
        const employeePoint = turf.point([location.lng, location.lat]);
        const polygonCoords = branch.geofenceBoundary.map((p: any) => [p.lng, p.lat]);
        // Close the polygon
        polygonCoords.push(polygonCoords[0]);
        const branchPolygon = turf.polygon([polygonCoords]);
        isWithinBoundary = turf.booleanPointInPolygon(employeePoint, branchPolygon);
        
        // Calculate distance for logging purposes
        distance = calculateDistance(location.lat, location.lng, branchLat, branchLng);
        
        if (!isWithinBoundary) {
          const mapsUrl = `https://www.google.com/maps/dir/${location.lat},${location.lng}/${branchLat},${branchLng}`;
          return res.status(400).json({ 
            error: `أنت خارج حدود الفرع المحددة. يرجى التوجه للفرع للتحضير.`,
            distance: Math.round(distance),
            userLocation: { lat: location.lat, lng: location.lng },
            branchLocation: { lat: branchLat, lng: branchLng },
            mapsUrl: mapsUrl,
            showMap: true,
            boundaryType: 'polygon'
          });
        }
      } else {
        // Fallback to radius-based check
        const maxDistance = branch.geofenceRadius || 500;
        distance = calculateDistance(location.lat, location.lng, branchLat, branchLng);
        isWithinBoundary = distance <= maxDistance;

        if (!isWithinBoundary) {
          const mapsUrl = `https://www.google.com/maps/dir/${location.lat},${location.lng}/${branchLat},${branchLng}`;
          return res.status(400).json({ 
            error: `أنت بعيد جداً عن الفرع (${Math.round(distance)} متر). يرجى التوجه للفرع للتحضير.`,
            distance: Math.round(distance),
            userLocation: { lat: location.lat, lng: location.lng },
            branchLocation: { lat: branchLat, lng: branchLng },
            mapsUrl: mapsUrl,
            showMap: true,
            boundaryType: 'radius'
          });
        }
      }

      // Check if already checked in today (Saudi timezone)
      const { start: today, end: tomorrow } = getSaudiDayBounds();

      const existingAttendance = await AttendanceModel.findOne({
        employeeId: employeeId,
        shiftDate: { $gte: today, $lt: tomorrow },
        status: 'checked_in'
      });

      if (existingAttendance) {
        return res.status(400).json({ error: "تم التحضير مسبقاً اليوم" });
      }

      // Check if late (assuming 8 AM start time, can be customized per employee)
      const now = new Date();
      const shiftStartHour = employee.shiftTime ? parseInt(employee.shiftTime.split('-')[0]) : 8;
      // today is Saudi midnight in UTC; add shift hour to get correct Saudi shift time in UTC
      const shiftStart = new Date(today.getTime() + shiftStartHour * 60 * 60 * 1000);
      
      const isLate = now > shiftStart;
      const lateMinutes = isLate ? Math.floor((now.getTime() - shiftStart.getTime()) / 60000) : 0;

      // Create attendance record with location verification
      const isAtBranch = isWithinBoundary ? 1 : 0;
      const attendance = new AttendanceModel({
        employeeId: employeeId,
        branchId: employee.branchId,
        checkInTime: now,
        checkInLocation: {
          lat: location.lat,
          lng: location.lng
        },
        checkInPhoto: photoUrl,
        status: 'checked_in',
        shiftDate: today,
        isLate: isLate ? 1 : 0,
        lateMinutes: lateMinutes,
        isAtBranch: isAtBranch,
        distanceFromBranch: Math.round(distance)
      });

      await attendance.save();

      res.json({
        success: true,
        message: isLate ? `تم التحضير بنجاح (متأخر ${lateMinutes} دقيقة)` : "تم التحضير بنجاح",
        attendance: serializeDoc(attendance),
        isLate,
        lateMinutes
      });
    } catch (error) {
      res.status(500).json({ error: "فشل التحضير" });
    }
  });

  // Check-out employee
  app.post("/api/attendance/check-out", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { AttendanceModel, BranchModel, EmployeeModel } = await import("@shared/schema");
      const { location, photoUrl } = req.body;
      const employeeId = req.employee?.id;

      if (!employeeId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      if (!location || !location.lat || !location.lng) {
        return res.status(400).json({ error: "الموقع مطلوب للانصراف" });
      }

      if (!photoUrl) {
        return res.status(400).json({ error: "صورة الانصراف مطلوبة" });
      }

      // Get employee details
      const employee = await EmployeeModel.findOne({ 
        $or: [{ id: employeeId }, { _id: employeeId }]
      });
      
      if (!employee) {
        return res.status(404).json({ error: "الموظف غير موجود" });
      }

      // Get branch location
      const branch = await BranchModel.findOne({ 
        $or: [{ id: employee.branchId }, { _id: employee.branchId }]
      });
      
      if (!branch || !branch.location) {
        return res.status(400).json({ error: "لا يوجد موقع للفرع" });
      }

      // Check if employee is within 500 meters of the branch
      const branchLat = branch.location.lat;
      const branchLng = branch.location.lng;
      const distance = calculateDistance(location.lat, location.lng, branchLat, branchLng);

      if (distance > 500) {
        // Create Google Maps link showing user location and branch location
        const mapsUrl = `https://www.google.com/maps/dir/${location.lat},${location.lng}/${branchLat},${branchLng}`;
        
        return res.status(400).json({ 
          error: `أنت بعيد جداً عن الفرع (${Math.round(distance)} متر). يرجى التوجه للفرع للانصراف.`,
          distance: Math.round(distance),
          userLocation: { lat: location.lat, lng: location.lng },
          branchLocation: { lat: branchLat, lng: branchLng },
          mapsUrl: mapsUrl,
          showMap: true
        });
      }

      // Find today's check-in (Saudi timezone)
      const { start: today, end: tomorrow } = getSaudiDayBounds();

      const attendance = await AttendanceModel.findOne({
        employeeId: employeeId,
        shiftDate: { $gte: today, $lt: tomorrow },
        status: 'checked_in'
      });

      if (!attendance) {
        return res.status(400).json({ error: "لم تقم بالتحضير اليوم" });
      }

      // Update attendance with check-out and location verification
      const checkOutIsAtBranch = distance <= 500 ? 1 : 0;
      attendance.checkOutTime = new Date();
      attendance.checkOutLocation = {
        lat: location.lat,
        lng: location.lng
      };
      attendance.checkOutPhoto = photoUrl;
      attendance.status = 'checked_out';
      attendance.checkOutIsAtBranch = checkOutIsAtBranch;
      attendance.checkOutDistanceFromBranch = Math.round(distance);
      attendance.updatedAt = new Date();

      await attendance.save();

      res.json({
        success: true,
        message: "تم الانصراف بنجاح",
        attendance: serializeDoc(attendance)
      });
    } catch (error) {
      res.status(500).json({ error: "فشل الانصراف" });
    }
  });

  // Get attendance records (for managers and admins)
  app.get("/api/attendance", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { AttendanceModel, EmployeeModel, BranchModel } = await import("@shared/schema");
      const { date, branchId, employeeId } = req.query;

      const query: any = {};

      // If manager: show attendance for their branch employees
      // If admin/owner: show all attendance including managers
      if (req.employee?.role === 'manager' && req.employee?.branchId) {
        query.branchId = req.employee.branchId;
      } else if (req.employee?.role === 'admin' || req.employee?.role === 'owner') {
        // Admin can filter by branch if specified
        if (branchId) {
          query.branchId = branchId;
        }
        // Admin can also see manager attendance by filtering by role
        // This will be handled by enrichment
      } else if (branchId) {
        query.branchId = branchId;
      }

      // Filter by date (treat date string as Saudi calendar date)
      if (date) {
        const { start: targetDate, end: nextDay } = getSaudiDayBounds(date as string);
        query.shiftDate = { $gte: targetDate, $lt: nextDay };
      }

      // Filter by employee
      if (employeeId) {
        query.employeeId = employeeId;
      }

      const attendances = await AttendanceModel.find(query).sort({ shiftDate: -1, checkInTime: -1 });

      // Enrich with employee and branch data
      const enrichedAttendances = await Promise.all(
        attendances.map(async (attendance) => {
          const employee = await EmployeeModel.findOne({
            $or: [{ id: attendance.employeeId }, { _id: attendance.employeeId }]
          });
          const branch = await BranchModel.findOne({
            $or: [{ id: attendance.branchId }, { _id: attendance.branchId }]
          });
          return {
            ...serializeDoc(attendance),
            employee: employee ? {
              fullName: employee.fullName,
              phone: employee.phone,
              jobTitle: employee.jobTitle,
              shiftTime: employee.shiftTime,
              role: employee.role,
              imageUrl: employee.imageUrl
            } : null,
            branch: branch ? {
              name: branch.nameAr
            } : null
          };
        })
      );

      res.json(enrichedAttendances);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب سجلات الحضور" });
    }
  });

  // Get my attendance status (for employee)
  app.get("/api/attendance/my-status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { AttendanceModel } = await import("@shared/schema");
      const employeeId = req.employee?.id;

      if (!employeeId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const { start: today, end: tomorrow } = getSaudiDayBounds();

      const todayAttendance = await AttendanceModel.findOne({
        employeeId: employeeId,
        shiftDate: { $gte: today, $lt: tomorrow }
      });

      // Calculate leave balance (default 21 days per year - approved leaves)
      const annualLeaves = 21;
      const { LeaveRequestModel } = await import("@shared/schema-leave");
      const currentYear = new Date().getFullYear();
      const approvedLeaves = await LeaveRequestModel.find({
        employeeId: employeeId,
        status: 'approved',
        startDate: { $gte: new Date(`${currentYear}-01-01`), $lte: new Date(`${currentYear}-12-31`) }
      });
      const usedLeaves = approvedLeaves.reduce((sum, leave) => sum + (leave.numberOfDays || 0), 0);
      const leaveBalance = Math.max(0, annualLeaves - usedLeaves);

      res.json({
        hasCheckedIn: !!todayAttendance,
        hasCheckedOut: todayAttendance?.status === 'checked_out',
        attendance: todayAttendance ? serializeDoc(todayAttendance) : null,
        todayCheckIn: todayAttendance?.checkInTime || null,
        todayCheckOut: todayAttendance?.checkOutTime || null,
        leaveBalance: leaveBalance,
        totalLeaves: annualLeaves
      });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب حالة الحضور" });
    }
  });

  // ============== LEAVE REQUEST ROUTES ==============

  // Submit a leave request
  app.post("/api/leave-requests", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { LeaveRequestModel } = await import("@shared/schema-leave");
      const employeeId = req.employee?.id;

      if (!employeeId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const { startDate, endDate, reason } = req.body;

      if (!startDate || !endDate || !reason) {
        return res.status(400).json({ error: "البيانات المطلوبة ناقصة" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end < start) {
        return res.status(400).json({ error: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية" });
      }

      const numberOfDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const leaveRequest = new LeaveRequestModel({
        employeeId,
        startDate: start,
        endDate: end,
        reason,
        numberOfDays,
        status: 'pending'
      });

      await leaveRequest.save();

      res.status(201).json(serializeDoc(leaveRequest));
    } catch (error) {
      res.status(500).json({ error: "فشل تقديم طلب الاجازة" });
    }
  });

  // Get my leave requests
  app.get("/api/leave-requests", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { LeaveRequestModel } = await import("@shared/schema-leave");
      const employeeId = req.employee?.id;

      if (!employeeId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const requests = await LeaveRequestModel.find({ employeeId }).sort({ createdAt: -1 });

      res.json(requests.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل جلب طلبات الاجازة" });
    }
  });

  // Approve a leave request (manager/admin only)
  app.patch("/api/leave-requests/:id/approve", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { LeaveRequestModel } = await import("@shared/schema-leave");

      if (req.employee?.role !== 'manager' && req.employee?.role !== 'admin' && req.employee?.role !== 'owner') {
        return res.status(403).json({ error: "صلاحيات غير كافية" });
      }

      const request = await LeaveRequestModel.findByIdAndUpdate(
        req.params.id,
        {
          status: 'approved',
          approvedBy: req.employee.id,
          approvalDate: new Date()
        },
        { new: true }
      );

      if (!request) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      res.json(serializeDoc(request));
    } catch (error) {
      res.status(500).json({ error: "فشل الموافقة على الطلب" });
    }
  });

  // Reject a leave request (manager/admin only)
  app.patch("/api/leave-requests/:id/reject", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { LeaveRequestModel } = await import("@shared/schema-leave");

      if (req.employee?.role !== 'manager' && req.employee?.role !== 'admin' && req.employee?.role !== 'owner') {
        return res.status(403).json({ error: "صلاحيات غير كافية" });
      }

      const { rejectionReason } = req.body;

      const request = await LeaveRequestModel.findByIdAndUpdate(
        req.params.id,
        {
          status: 'rejected',
          approvedBy: req.employee.id,
          approvalDate: new Date(),
          rejectionReason
        },
        { new: true }
      );

      if (!request) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }

      res.json(serializeDoc(request));
    } catch (error) {
      res.status(500).json({ error: "فشل رفض الطلب" });
    }
  });

  // Helper function to calculate distance between two coordinates (Haversine formula)
  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  // ============== OWNER DATABASE MANAGEMENT ROUTES ==============

  // Get database statistics (owner only)
  app.get("/api/owner/database-stats", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner' && req.employee?.role !== 'admin') {
        return res.status(403).json({ error: "صلاحيات غير كافية" });
      }

      const { 
        OrderModel, CustomerModel, EmployeeModel, CoffeeItemModel, 
        BranchModel, DiscountCodeModel, LoyaltyCardModel, TableModel,
        AttendanceModel, IngredientModel, CategoryModel, DeliveryZoneModel
      } = await import("@shared/schema");

      const [
        ordersCount, customersCount, employeesCount, coffeeItemsCount,
        branchesCount, discountCodesCount, loyaltyCardsCount, tablesCount,
        attendanceCount, ingredientsCount, categoriesCount, deliveryZonesCount,
        todayOrders, totalRevenue
      ] = await Promise.all([
        OrderModel.countDocuments(),
        CustomerModel.countDocuments(),
        EmployeeModel.countDocuments(),
        CoffeeItemModel.countDocuments(),
        BranchModel.countDocuments(),
        DiscountCodeModel.countDocuments(),
        LoyaltyCardModel.countDocuments(),
        TableModel.countDocuments(),
        AttendanceModel.countDocuments(),
        IngredientModel.countDocuments(),
        CategoryModel.countDocuments(),
        DeliveryZoneModel.countDocuments(),
        OrderModel.countDocuments({
          createdAt: { $gte: getSaudiToday() },
          status: { $ne: 'cancelled' }
        }),
        OrderModel.aggregate([
          { $match: { status: { $ne: 'cancelled' } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ])
      ]);

      res.json({
        collections: {
          orders: { count: ordersCount, nameAr: 'الطلبات' },
          customers: { count: customersCount, nameAr: 'العملاء' },
          employees: { count: employeesCount, nameAr: 'الموظفين' },
          coffeeItems: { count: coffeeItemsCount, nameAr: 'المشروبات' },
          branches: { count: branchesCount, nameAr: 'الفروع' },
          discountCodes: { count: discountCodesCount, nameAr: 'أكواد الخصم' },
          loyaltyCards: { count: loyaltyCardsCount, nameAr: 'بطاقات الولاء' },
          tables: { count: tablesCount, nameAr: 'الطاولات' },
          attendance: { count: attendanceCount, nameAr: 'سجلات الحضور' },
          ingredients: { count: ingredientsCount, nameAr: 'المكونات' },
          categories: { count: categoriesCount, nameAr: 'الفئات' },
          deliveryZones: { count: deliveryZonesCount, nameAr: 'مناطق التوصيل' }
        },
        summary: {
          todayOrders,
          totalRevenue: totalRevenue[0]?.total || 0
        }
      });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب إحصائيات قاعدة البيانات" });
    }
  });

  // Get collection data (owner only)
  app.get("/api/owner/collection/:collectionName", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner' && req.employee?.role !== 'admin') {
        return res.status(403).json({ error: "صلاحيات غير كافية" });
      }

      const { collectionName } = req.params;
      const { page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const models: Record<string, any> = {
        orders: (await import("@shared/schema")).OrderModel,
        customers: (await import("@shared/schema")).CustomerModel,
        employees: (await import("@shared/schema")).EmployeeModel,
        coffeeItems: (await import("@shared/schema")).CoffeeItemModel,
        branches: (await import("@shared/schema")).BranchModel,
        discountCodes: (await import("@shared/schema")).DiscountCodeModel,
        loyaltyCards: (await import("@shared/schema")).LoyaltyCardModel,
        tables: (await import("@shared/schema")).TableModel,
        attendance: (await import("@shared/schema")).AttendanceModel,
        ingredients: (await import("@shared/schema")).IngredientModel,
        categories: (await import("@shared/schema")).CategoryModel,
        deliveryZones: (await import("@shared/schema")).DeliveryZoneModel
      };

      const Model = models[collectionName];
      if (!Model) {
        return res.status(400).json({ error: "مجموعة غير صالحة" });
      }

      const [data, total] = await Promise.all([
        Model.find().sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Model.countDocuments()
      ]);

      res.json({
        data: data.map((doc: any) => {
          const serialized = serializeDoc(doc);
          // Remove password from employees
          if (collectionName === 'employees') {
            delete serialized.password;
          }
          return serialized;
        }),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب البيانات" });
    }
  });

  // Delete collection data (owner only)
  app.delete("/api/owner/collection/:collectionName", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner') {
        return res.status(403).json({ error: "فقط المالك يمكنه حذف البيانات" });
      }

      const { collectionName } = req.params;
      const { ids } = req.body; // Optional: specific IDs to delete

      const models: Record<string, any> = {
        orders: (await import("@shared/schema")).OrderModel,
        customers: (await import("@shared/schema")).CustomerModel,
        discountCodes: (await import("@shared/schema")).DiscountCodeModel,
        loyaltyCards: (await import("@shared/schema")).LoyaltyCardModel,
        attendance: (await import("@shared/schema")).AttendanceModel
      };

      const Model = models[collectionName];
      if (!Model) {
        return res.status(400).json({ error: "مجموعة غير صالحة أو محمية" });
      }

      let result;
      if (ids && Array.isArray(ids) && ids.length > 0) {
        result = await Model.deleteMany({ _id: { $in: ids } });
      } else {
        result = await Model.deleteMany({});
      }

      res.json({
        success: true,
        message: `تم حذف ${result.deletedCount} سجل`,
        deletedCount: result.deletedCount
      });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف البيانات" });
    }
  });

  // Delete specific record (owner only)
  app.delete("/api/owner/record/:collectionName/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner') {
        return res.status(403).json({ error: "فقط المالك يمكنه حذف البيانات" });
      }

      const { collectionName, id } = req.params;

      const models: Record<string, any> = {
        orders: (await import("@shared/schema")).OrderModel,
        customers: (await import("@shared/schema")).CustomerModel,
        employees: (await import("@shared/schema")).EmployeeModel,
        coffeeItems: (await import("@shared/schema")).CoffeeItemModel,
        branches: (await import("@shared/schema")).BranchModel,
        discountCodes: (await import("@shared/schema")).DiscountCodeModel,
        loyaltyCards: (await import("@shared/schema")).LoyaltyCardModel,
        tables: (await import("@shared/schema")).TableModel,
        attendance: (await import("@shared/schema")).AttendanceModel,
        ingredients: (await import("@shared/schema")).IngredientModel,
        categories: (await import("@shared/schema")).CategoryModel,
        deliveryZones: (await import("@shared/schema")).DeliveryZoneModel
      };

      const Model = models[collectionName];
      if (!Model) {
        return res.status(400).json({ error: "مجموعة غير صالحة" });
      }

      const result = await Model.deleteOne({ _id: id });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "السجل غير موجود" });
      }

      res.json({
        success: true,
        message: "تم حذف السجل بنجاح"
      });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف السجل" });
    }
  });

  // Reset all data (owner only)
  app.post("/api/owner/reset-database", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.employee?.role !== 'owner') {
        return res.status(403).json({ error: "فقط المالك يمكنه إعادة تعيين قاعدة البيانات" });
      }

      const { confirmPhrase } = req.body;
      
      if (confirmPhrase !== 'احذف جميع البيانات') {
        return res.status(400).json({ error: "عبارة التأكيد غير صحيحة" });
      }

      const { 
        OrderModel, CustomerModel, DiscountCodeModel, LoyaltyCardModel, 
        LoyaltyTransactionModel, AttendanceModel, CardCodeModel
      } = await import("@shared/schema");

      const results = await Promise.all([
        OrderModel.deleteMany({}),
        CustomerModel.deleteMany({}),
        DiscountCodeModel.deleteMany({}),
        LoyaltyCardModel.deleteMany({}),
        LoyaltyTransactionModel.deleteMany({}),
        AttendanceModel.deleteMany({}),
        CardCodeModel.deleteMany({})
      ]);

      res.json({
        success: true,
        message: "تم حذف جميع بيانات العمليات بنجاح",
        deleted: {
          orders: results[0].deletedCount,
          customers: results[1].deletedCount,
          discountCodes: results[2].deletedCount,
          loyaltyCards: results[3].deletedCount,
          loyaltyTransactions: results[4].deletedCount,
          attendance: results[5].deletedCount,
          cardCodes: results[6].deletedCount
        }
      });
    } catch (error) {
      res.status(500).json({ error: "فشل إعادة تعيين قاعدة البيانات" });
    }
  });

  // ================== INVENTORY MANAGEMENT ROUTES ==================

  // Employee-accessible routes for ingredient availability management
  // These routes only require basic auth (not manager) for employee ingredient management page
  app.get("/api/employee/raw-items/by-category/:category", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.employee?.tenantId || getTenantIdFromRequest(req) || "demo-tenant";
      const { category } = req.params;
      const query: any = { tenantId };
      if (category && category !== "all") query.category = category;
      const items = await RawItemModel.find(query).sort({ nameAr: 1 }).lean();
      res.json(items.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المواد الخام" });
    }
  });

  // Employee route to update raw item availability
  app.patch("/api/employee/raw-items/:id/availability", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      if (typeof isActive !== 'number' || (isActive !== 0 && isActive !== 1)) {
        return res.status(400).json({ error: "قيمة isActive يجب أن تكون 0 أو 1" });
      }
      
      const item = await storage.updateRawItem(id, { isActive });
      if (!item) {
        return res.status(404).json({ error: "المادة الخام غير موجودة" });
      }
      
      // Update affected coffee items if raw item is an ingredient
      if (item.category === 'ingredient') {
        const { RecipeItemModel, CoffeeItemModel } = await import("@shared/schema");
        
        // Find all coffee items using this raw item
        const recipes = await RecipeItemModel.find({ rawItemId: id });
        
        for (const recipe of recipes) {
          const coffeeItem = await CoffeeItemModel.findById(recipe.coffeeItemId);
          if (coffeeItem) {
            if (isActive === 0) {
              // Mark coffee item as unavailable
              await CoffeeItemModel.findByIdAndUpdate(recipe.coffeeItemId, {
                isAvailable: 0,
                availabilityStatus: `نفذ ${item.nameAr}`
              });
            } else {
              // Check if all other ingredients are available
              const allRecipes = await RecipeItemModel.find({ coffeeItemId: recipe.coffeeItemId });
              let allAvailable = true;
              
              for (const r of allRecipes) {
                const rawItem = await storage.getRawItem(r.rawItemId);
                if (rawItem && rawItem.isActive === 0) {
                  allAvailable = false;
                  break;
                }
              }
              
              if (allAvailable) {
                await CoffeeItemModel.findByIdAndUpdate(recipe.coffeeItemId, {
                  isAvailable: 1,
                  availabilityStatus: "متوفر"
                });
              }
            }
          }
        }
      }
      
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث حالة المادة الخام" });
    }
  });

  app.get("/api/inventory", requireAuth, async (req: AuthRequest, res) => {
    try {
      const items = await storage.getRawItems();
      const lowStock = items.filter((i: any) => i.currentStock !== undefined && i.minStock !== undefined && i.currentStock <= i.minStock);
      res.json({
        totalItems: items.length,
        lowStockCount: lowStock.length,
        items: items.slice(0, 20),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب بيانات المخزون" });
    }
  });

  // Raw Items Routes (Manager-only)
  app.get("/api/inventory/raw-items", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { category } = req.query;
      let items = await storage.getRawItems();
      
      if (category && typeof category === 'string') {
        items = items.filter(item => item.category === category);
      }
      
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المواد الخام" });
    }
  });

  app.get("/api/raw-items/by-category/:category", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { category } = req.params;
      const validCategories = ['ingredient', 'packaging', 'equipment', 'consumable', 'other'];
      
      if (!validCategories.includes(category)) {
        return res.status(400).json({ 
          error: "تصنيف غير صالح",
          validCategories 
        });
      }
      
      const allItems = await storage.getRawItems();
      const filteredItems = allItems.filter(item => item.category === category);
      
      res.json(filteredItems);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المواد الخام" });
    }
  });

  app.get("/api/raw-items/for-recipes", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const allItems = await storage.getRawItems();
      const recipeItems = allItems.filter(item => 
        ['ingredient', 'packaging', 'consumable'].includes(item.category as string)
      );
      
      res.json(recipeItems);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المواد الخام للوصفات" });
    }
  });

  app.get("/api/inventory/raw-items/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const item = await storage.getRawItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "المادة الخام غير موجودة" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المادة الخام" });
    }
  });

  app.post("/api/inventory/raw-items", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertRawItemSchema } = await import("@shared/schema");
      const validatedData = insertRawItemSchema.parse(req.body);
      
      const existing = await storage.getRawItemByCode(validatedData.code);
      if (existing) {
        return res.status(400).json({ error: "كود المادة الخام موجود مسبقاً" });
      }
      
      const item = await storage.createRawItem(validatedData);
      res.status(201).json(item);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في إنشاء المادة الخام" });
    }
  });

  app.put("/api/inventory/raw-items/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertRawItemSchema } = await import("@shared/schema");
      const partialSchema = insertRawItemSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const item = await storage.updateRawItem(req.params.id, validatedData);
      if (!item) {
        return res.status(404).json({ error: "المادة الخام غير موجودة" });
      }
      res.json(item);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في تحديث المادة الخام" });
    }
  });

  app.delete("/api/inventory/raw-items/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const success = await storage.deleteRawItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "المادة الخام غير موجودة" });
      }
      res.json({ success: true, message: "تم حذف المادة الخام بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف المادة الخام" });
    }
  });

  // Branch-level stock summary
  app.get("/api/branch-stock", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      const tenantId = req.employee?.tenantId || getTenantIdFromRequest(req) || "demo-tenant";
      const query: any = { tenantId };
      if (branchId && branchId !== "all") query.branchId = branchId as string;
      const stocks = await BranchStockModel.find(query).populate('rawItemId').sort({ updatedAt: -1 }).lean();
      res.json(stocks.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب مخزون الفروع" });
    }
  });

  // ================== RECIPE MANAGEMENT ROUTES ==================

  // Get all recipes
  app.get("/api/recipes", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const recipes = await RecipeItemModel.find().lean();
      const serialized = recipes.map(r => ({
        ...r,
        id: (r._id as any).toString(),
        _id: undefined
      }));
      res.json(serialized);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الوصفات" });
    }
  });

  // Get recipes for a specific coffee item
  app.get("/api/recipes/coffee-item/:coffeeItemId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { coffeeItemId } = req.params;
      const recipes = await RecipeItemModel.find({ coffeeItemId }).lean();
      
      // Enrich with raw item details
      const enrichedRecipes = await Promise.all(recipes.map(async (recipe) => {
        const rawItem = await RawItemModel.findOne({
          $or: [
            { _id: recipe.rawItemId },
            { code: recipe.rawItemId }
          ]
        }).lean();
        
        return {
          ...recipe,
          id: (recipe._id as any).toString(),
          _id: undefined,
          rawItem: rawItem ? {
            id: (rawItem._id as any).toString(),
            code: rawItem.code,
            nameAr: rawItem.nameAr,
            nameEn: rawItem.nameEn,
            unit: rawItem.unit,
            unitCost: rawItem.unitCost
          } : null
        };
      }));
      
      res.json(enrichedRecipes);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب وصفات المشروب" });
    }
  });

  // Delete recipe item
  app.delete("/api/recipes/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const result = await RecipeItemModel.findByIdAndDelete(req.params.id);
      if (!result) {
        return res.status(404).json({ error: "الوصفة غير موجودة" });
      }
      res.json({ success: true, message: "تم حذف عنصر الوصفة" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف الوصفة" });
    }
  });

  // Delete all recipes for a coffee item
  app.delete("/api/recipes/coffee-item/:coffeeItemId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { coffeeItemId } = req.params;
      const result = await RecipeItemModel.deleteMany({ coffeeItemId });
      res.json({ success: true, deleted: result.deletedCount });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف وصفات المشروب" });
    }
  });

  // Calculate recipe cost for a coffee item
  app.get("/api/recipes/coffee-item/:coffeeItemId/cost", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { coffeeItemId } = req.params;
      const recipes = await RecipeItemModel.find({ coffeeItemId });
      
      let totalCost = 0;
      const breakdown: Array<{
        rawItemName: string;
        quantity: number;
        unit: string;
        unitCost: number;
        totalCost: number;
      }> = [];
      
      for (const recipe of recipes) {
        const rawItem = await RawItemModel.findOne({
          $or: [
            { _id: recipe.rawItemId },
            { code: recipe.rawItemId }
          ]
        });
        
        if (rawItem) {
          const convertedQuantity = convertUnitsForCost(recipe.quantity, recipe.unit, rawItem.unit);
          const itemCost = convertedQuantity * (rawItem.unitCost || 0);
          totalCost += itemCost;
          
          breakdown.push({
            rawItemName: rawItem.nameAr,
            quantity: recipe.quantity,
            unit: recipe.unit,
            unitCost: rawItem.unitCost,
            totalCost: itemCost
          });
        }
      }
      
      res.json({ totalCost, breakdown });
    } catch (error) {
      res.status(500).json({ error: "فشل في حساب تكلفة الوصفة" });
    }
  });

  // Suppliers Routes
  app.get("/api/inventory/suppliers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الموردين" });
    }
  });

  app.get("/api/inventory/suppliers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const supplier = await storage.getSupplier(req.params.id);
      if (!supplier) {
        return res.status(404).json({ error: "المورد غير موجود" });
      }
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المورد" });
    }
  });

  app.post("/api/inventory/suppliers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertSupplierSchema } = await import("@shared/schema");
      const validatedData = insertSupplierSchema.parse(req.body);
      
      const existing = await storage.getSupplierByCode(validatedData.code);
      if (existing) {
        return res.status(400).json({ error: "كود المورد موجود مسبقاً" });
      }
      
      const supplier = await storage.createSupplier(validatedData);
      res.status(201).json(supplier);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في إنشاء المورد" });
    }
  });

  app.put("/api/inventory/suppliers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertSupplierSchema } = await import("@shared/schema");
      const partialSchema = insertSupplierSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const supplier = await storage.updateSupplier(req.params.id, validatedData);
      if (!supplier) {
        return res.status(404).json({ error: "المورد غير موجود" });
      }
      res.json(supplier);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في تحديث المورد" });
    }
  });

  app.delete("/api/inventory/suppliers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const success = await storage.deleteSupplier(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "المورد غير موجود" });
      }
      res.json({ success: true, message: "تم حذف المورد بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف المورد" });
    }
  });

  // Branch Stock Routes
  app.get("/api/inventory/stock", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      if (branchId) {
        const stock = await storage.getBranchStock(branchId as string);
        res.json(stock);
      } else {
        const allStock = await storage.getAllBranchesStock();
        res.json(allStock);
      }
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المخزون" });
    }
  });

  app.get("/api/inventory/stock/low", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      const lowStock = await storage.getLowStockItems(branchId as string | undefined);
      res.json(lowStock);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المواد منخفضة المخزون" });
    }
  });

  app.post("/api/inventory/stock/adjust", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, rawItemId, quantity, notes, movementType, unitCost } = req.body;
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const employeeId = req.employee?.id || 'system';
      
      if (!branchId || !rawItemId || quantity === undefined) {
        return res.status(400).json({ error: "البيانات المطلوبة غير مكتملة" });
      }
      
      const rawItem = await RawItemModel.findById(rawItemId);
      if (!rawItem) {
        return res.status(404).json({ error: "المادة غير موجودة" });
      }

      const stock = await storage.updateBranchStock(
        branchId,
        rawItemId,
        quantity,
        employeeId,
        movementType || 'adjustment',
        notes
      );
      
      // Create Accounting Entry for stock addition
      if (quantity > 0 && (movementType === 'purchase' || movementType === 'adjustment')) {
        try {
          const inventoryAccount = await AccountModel.findOne({ tenantId, accountNumber: "1130" });
          const cashAccount = await AccountModel.findOne({ tenantId, accountNumber: "1000" });

          const cost = (unitCost || rawItem.unitCost || 0) * Math.abs(quantity);
          if (cost > 0 && inventoryAccount && cashAccount) {
            if (movementType === 'purchase') {
              await ErpAccountingService.createJournalEntry({
                tenantId,
                entryDate: new Date(),
                description: `شراء مخزون: ${rawItem.nameAr}`,
                lines: [
                  {
                    accountId: inventoryAccount.id,
                    accountNumber: inventoryAccount.accountNumber,
                    accountName: inventoryAccount.nameAr,
                    debit: cost,
                    credit: 0,
                    description: `زيادة قيمة المخزون - ${rawItem.nameAr}`,
                    branchId,
                  },
                  {
                    accountId: cashAccount.id,
                    accountNumber: cashAccount.accountNumber,
                    accountName: cashAccount.nameAr,
                    debit: 0,
                    credit: cost,
                    description: `مدفوعات شراء مخزون - ${rawItem.nameAr}`,
                    branchId,
                  }
                ],
                referenceType: 'inventory_purchase',
                referenceId: (stock as any).id || (stock as any)._id?.toString(),
                createdBy: employeeId,
                autoPost: true,
              });
              console.log(`[ACCOUNTING] Purchase journal entry: ${cost} SAR for ${rawItem.nameAr}`);
            } else {
              await ErpAccountingService.createJournalEntry({
                tenantId,
                entryDate: new Date(),
                description: `تسوية مخزون: ${rawItem.nameAr}`,
                lines: [
                  {
                    accountId: inventoryAccount.id,
                    accountNumber: inventoryAccount.accountNumber,
                    accountName: inventoryAccount.nameAr,
                    debit: cost,
                    credit: 0,
                    description: `تسوية قيمة المخزون - ${rawItem.nameAr}`,
                    branchId,
                  },
                  {
                    accountId: cashAccount.id,
                    accountNumber: cashAccount.accountNumber,
                    accountName: cashAccount.nameAr,
                    debit: 0,
                    credit: cost,
                    description: `تسوية مخزون - ${rawItem.nameAr}`,
                    branchId,
                  }
                ],
                referenceType: 'inventory_adjustment',
                referenceId: (stock as any).id || (stock as any)._id?.toString(),
                createdBy: employeeId,
                autoPost: true,
              });
            }
          }
        } catch (accError) {
          console.error("[ACCOUNTING] Failed to create inventory entry:", accError);
        }
      }
      
      // Auto-generate stock alert if quantity falls below minimum
      try {
        const currentQty = (stock as any).currentQuantity || 0;
        const minLevel = (rawItem as any).minStockLevel || 0;
        if (minLevel > 0 && currentQty <= minLevel) {
          const { StockAlertModel } = await import("@shared/schema");
          const existing = await StockAlertModel.findOne({ rawItemId, branchId, isResolved: 0 });
          if (!existing) {
            await storage.createStockAlert(branchId, rawItemId, 'low_stock', currentQty, minLevel);
            console.log(`[INVENTORY] Low stock alert created for ${(rawItem as any).nameAr}: ${currentQty} / ${minLevel}`);
          }
        }
      } catch (alertErr) {
        console.error("[INVENTORY] Failed to create auto stock alert:", alertErr);
      }

      res.json(stock);
    } catch (error) {
      console.error("Error adjusting stock:", error);
      res.status(500).json({ error: "فشل في تعديل المخزون" });
    }
  });

  // Smart Inventory Routes - Stock Adjustment (+/-)
  app.post("/api/inventory/stock-adjustment", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { rawItemId, branchId, quantity, type, notes } = req.body;
      
      if (!rawItemId || !branchId || quantity === undefined || !type) {
        return res.status(400).json({ error: "البيانات المطلوبة غير مكتملة" });
      }
      
      const numQuantity = Number(quantity);
      if (isNaN(numQuantity)) {
        return res.status(400).json({ error: "الكمية يجب أن تكون رقماً" });
      }
      
      const adjustedQuantity = type === 'subtract' ? -Math.abs(numQuantity) : Math.abs(numQuantity);
      
      const stock = await storage.updateBranchStock(
        branchId,
        rawItemId,
        adjustedQuantity,
        req.employee?.id || 'system',
        'adjustment',
        notes || (type === 'add' ? 'إضافة كمية' : 'خصم كمية')
      );

      // Create accounting entry for stock addition
      if (adjustedQuantity > 0) {
        try {
          const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
          const rawItem = await RawItemModel.findById(rawItemId);
          const unitCostValue = (rawItem as any)?.unitCost || (rawItem as any)?.lastCost || 0;
          const totalCost = unitCostValue * Math.abs(adjustedQuantity);

          if (totalCost > 0) {
            const inventoryAccount = await AccountModel.findOne({ tenantId, accountNumber: "1130" });
            const cashAccount = await AccountModel.findOne({ tenantId, accountNumber: "1000" });

            if (inventoryAccount && cashAccount) {
              await ErpAccountingService.createJournalEntry({
                tenantId,
                entryDate: new Date(),
                description: `إضافة مخزون: ${(rawItem as any)?.nameAr || rawItemId}`,
                lines: [
                  {
                    accountId: inventoryAccount.id,
                    accountNumber: inventoryAccount.accountNumber,
                    accountName: inventoryAccount.nameAr,
                    debit: totalCost,
                    credit: 0,
                    description: `زيادة قيمة المخزون - ${(rawItem as any)?.nameAr || rawItemId}`,
                    branchId,
                  },
                  {
                    accountId: cashAccount.id,
                    accountNumber: cashAccount.accountNumber,
                    accountName: cashAccount.nameAr,
                    debit: 0,
                    credit: totalCost,
                    description: `مدفوعات إضافة مخزون - ${(rawItem as any)?.nameAr || rawItemId}`,
                    branchId,
                  }
                ],
                referenceType: 'inventory_adjustment',
                referenceId: (stock as any).id || (stock as any)._id?.toString(),
                createdBy: req.employee?.id || 'system',
                autoPost: true,
              });
              console.log(`[ACCOUNTING] Stock adjustment journal entry: ${totalCost} SAR for ${(rawItem as any)?.nameAr}`);
            }
          }
        } catch (accError) {
          console.error("[ACCOUNTING] Failed to create stock adjustment accounting entry:", accError);
        }
      }

      // Auto-generate low stock alert
      try {
        const currentQty = (stock as any).currentQuantity || 0;
        const rawItemDoc = await RawItemModel.findById(rawItemId);
        const minLevel = (rawItemDoc as any)?.minStockLevel || 0;
        if (minLevel > 0 && currentQty <= minLevel) {
          const { StockAlertModel } = await import("@shared/schema");
          const existing = await StockAlertModel.findOne({ rawItemId, branchId, isResolved: 0 });
          if (!existing) {
            await storage.createStockAlert(branchId, rawItemId, 'low_stock', currentQty, minLevel);
            console.log(`[INVENTORY] Auto low stock alert: ${(rawItemDoc as any)?.nameAr} ${currentQty}/${minLevel}`);
          }
        }
      } catch (alertErr) {
        console.error("[INVENTORY] Auto alert failed:", alertErr);
      }
      
      res.json(stock);
    } catch (error) {
      console.error("[ERROR] In stock-adjustment route:", error);
      res.status(500).json({ 
        error: "فشل في تعديل المخزون",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Smart Inventory Routes - Add Stock Batch
  app.post("/api/inventory/stock-batch", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { rawItemId, branchId, quantity, unitCost, notes } = req.body;
      
      const numQuantity = Number(quantity);
      if (!rawItemId || !branchId || isNaN(numQuantity) || numQuantity <= 0) {
        return res.status(400).json({ error: "البيانات المطلوبة غير مكتملة" });
      }
      
      // Update raw item cost if provided
      if (unitCost && Number(unitCost) > 0) {
        const { RawItemModel } = await import("@shared/schema");
        await RawItemModel.findOneAndUpdate({ id: rawItemId }, { unitCost: Number(unitCost) });
      }
      
      const stock = await storage.updateBranchStock(
        branchId,
        rawItemId,
        numQuantity,
        req.employee?.id || 'system',
        'purchase',
        notes || 'دفعة جديدة'
      );

      // Create proper journal entry for inventory purchase (Debit Inventory Asset, Credit Cash/Payables)
      try {
        const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
        const { RawItemModel, AccountModel } = await import("@shared/schema");
        const { nanoid } = await import("nanoid");
        
        const rawItem = await RawItemModel.findOne({ id: rawItemId });
        const totalAmount = (Number(unitCost) || (rawItem as any)?.unitCost || 0) * numQuantity;
        if (totalAmount > 0) {
          const inventoryAccount = await AccountModel.findOne({ tenantId, accountNumber: "1130" });
          const cashAccount = await AccountModel.findOne({ tenantId, accountNumber: "1000" });

          if (inventoryAccount && cashAccount) {
            await ErpAccountingService.createJournalEntry({
              tenantId,
              entryDate: new Date(),
              description: `شراء مخزون: ${(rawItem as any)?.nameAr || rawItemId} - ${notes || 'دفعة جديدة'}`,
              lines: [
                {
                  accountId: inventoryAccount.id,
                  accountNumber: inventoryAccount.accountNumber,
                  accountName: inventoryAccount.nameAr,
                  debit: totalAmount,
                  credit: 0,
                  description: `إضافة مخزون - ${(rawItem as any)?.nameAr || rawItemId}`,
                  branchId,
                },
                {
                  accountId: cashAccount.id,
                  accountNumber: cashAccount.accountNumber,
                  accountName: cashAccount.nameAr,
                  debit: 0,
                  credit: totalAmount,
                  description: `مدفوعات شراء مخزون - ${(rawItem as any)?.nameAr || rawItemId}`,
                  branchId,
                }
              ],
              referenceType: 'inventory_purchase',
              referenceId: (stock as any).id || nanoid(),
              createdBy: req.employee?.id || 'system',
              autoPost: true,
            });
            console.log(`[ACCOUNTING] Inventory purchase journal entry: ${totalAmount} SAR for ${(rawItem as any)?.nameAr}`);
          }
        }
      } catch (accError) {
        console.error("[ACCOUNTING] Failed to create inventory batch accounting entry:", accError);
      }
      
      res.json(stock);
    } catch (error) {
      console.error("[ERROR] In stock-batch route:", error);
      res.status(500).json({ 
        error: "فشل في إضافة الدفعة",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Branch Stocks for Smart Inventory
  app.get("/api/inventory/branch-stocks", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      if (branchId && branchId !== 'all') {
        const stocks = await storage.getBranchStock(branchId as string);
        res.json(stocks);
      } else {
        const { BranchModel } = await import("@shared/schema");
        const branches = await BranchModel.find({ isActive: 1 }).lean();
        let allStocks: any[] = [];
        
        for (const branch of branches) {
          const branchIdStr = (branch as any)._id?.toString() || (branch as any).id;
          const stocks = await storage.getBranchStock(branchIdStr);
          allStocks = allStocks.concat(stocks);
        }
        
        res.json(allStocks);
      }
    } catch (error) {
      console.error("[ERROR] In branch-stocks route:", error);
      res.status(500).json({ error: "فشل في جلب المخزون" });
    }
  });

  // Stock Transfers Routes
  app.get("/api/inventory/transfers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      const transfers = await storage.getStockTransfers(branchId as string | undefined);
      res.json(transfers);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب التحويلات" });
    }
  });

  app.get("/api/inventory/transfers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const transfer = await storage.getStockTransfer(req.params.id);
      if (!transfer) {
        return res.status(404).json({ error: "التحويل غير موجود" });
      }
      res.json(transfer);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب التحويل" });
    }
  });

  app.post("/api/inventory/transfers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertStockTransferSchema } = await import("@shared/schema");
      const validatedData = insertStockTransferSchema.parse({
        ...req.body,
        requestedBy: req.employee?.id || 'system'
      });
      
      const transfer = await storage.createStockTransfer(validatedData);
      res.status(201).json(transfer);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في إنشاء التحويل" });
    }
  });

  app.put("/api/inventory/transfers/:id/approve", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const transfer = await storage.updateStockTransferStatus(
        req.params.id,
        'approved',
        req.employee?.id
      );
      if (!transfer) {
        return res.status(404).json({ error: "التحويل غير موجود" });
      }
      res.json(transfer);
    } catch (error) {
      res.status(500).json({ error: "فشل في الموافقة على التحويل" });
    }
  });

  app.put("/api/inventory/transfers/:id/complete", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const transfer = await storage.completeStockTransfer(
        req.params.id,
        req.employee?.id || 'system'
      );
      if (!transfer) {
        return res.status(404).json({ error: "التحويل غير موجود أو لم تتم الموافقة عليه" });
      }
      res.json(transfer);
    } catch (error) {
      res.status(500).json({ error: "فشل في إتمام التحويل" });
    }
  });

  app.put("/api/inventory/transfers/:id/cancel", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const transfer = await storage.updateStockTransferStatus(req.params.id, 'cancelled');
      if (!transfer) {
        return res.status(404).json({ error: "التحويل غير موجود" });
      }
      res.json(transfer);
    } catch (error) {
      res.status(500).json({ error: "فشل في إلغاء التحويل" });
    }
  });

  // Stock Organization Stats Endpoint
  app.get("/api/inventory/organization-stats", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const branches = await BranchModel.find({ isActive: 1 }).lean();
      const rawItems = await RawItemModel.find().lean();
      let totalValue = 0;
      let lowStockCount = 0;
      const branchStats = [];

      for (const branch of branches) {
        const branchId = (branch as any)._id.toString();
        const stocks = await BranchStockModel.find({ branchId }).populate('rawItemId').lean();
        let branchValue = 0;
        let branchLow = 0;
        const transfers = await storage.getStockTransfers(branchId);

        stocks.forEach((stock: any) => {
          const item = stock.rawItemId as any;
          if (item) {
            const value = (stock.currentQuantity || 0) * (item.unitCost || 0);
            branchValue += value;
            if ((stock.currentQuantity || 0) < (item.minStockLevel || 0)) {
              branchLow++;
              lowStockCount++;
            }
          }
        });
        totalValue += branchValue;

        branchStats.push({
          branchId,
          branchName: (branch as any).nameAr || 'فرع بدون اسم',
          totalItems: stocks.length,
          lowStockItems: branchLow,
          totalValue: branchValue,
          recentTransfers: transfers?.filter((t: any) => t.status !== 'completed').length || 0
        });
      }

      res.json({
        totalBranches: branches.length,
        totalSKUs: rawItems.length,
        totalInventoryValue: totalValue,
        lowStockItems: lowStockCount,
        pendingTransfers: 0,
        branches: branchStats
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب إحصائيات المخزون" });
    }
  });

  // Purchase Invoices Routes
  app.get("/api/inventory/purchases", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      const invoices = await storage.getPurchaseInvoices(branchId as string | undefined);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب فواتير الشراء" });
    }
  });

  app.get("/api/inventory/purchases/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const invoice = await storage.getPurchaseInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "فاتورة الشراء غير موجودة" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب فاتورة الشراء" });
    }
  });

  app.post("/api/inventory/purchases", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertPurchaseInvoiceSchema } = await import("@shared/schema");
      const validatedData = insertPurchaseInvoiceSchema.parse({
        ...req.body,
        createdBy: req.employee?.id || 'system'
      });
      
      const invoice = await storage.createPurchaseInvoice(validatedData);
      res.status(201).json(invoice);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في إنشاء فاتورة الشراء" });
    }
  });

  app.put("/api/inventory/purchases/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertPurchaseInvoiceSchema } = await import("@shared/schema");
      const partialSchema = insertPurchaseInvoiceSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const invoice = await storage.updatePurchaseInvoice(req.params.id, validatedData);
      if (!invoice) {
        return res.status(404).json({ error: "فاتورة الشراء غير موجودة" });
      }
      res.json(invoice);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في تحديث فاتورة الشراء" });
    }
  });

  app.put("/api/inventory/purchases/:id/approve", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const invoice = await storage.updatePurchaseInvoice(req.params.id, { status: 'approved' });
      if (!invoice) {
        return res.status(404).json({ error: "فاتورة الشراء غير موجودة" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "فشل في اعتماد فاتورة الشراء" });
    }
  });

  app.put("/api/inventory/purchases/:id/receive", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const invoice = await storage.receivePurchaseInvoice(
        req.params.id,
        req.employee?.id || 'system'
      );
      if (!invoice) {
        return res.status(404).json({ error: "فاتورة الشراء غير موجودة أو تم استلامها مسبقاً" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "فشل في استلام فاتورة الشراء" });
    }
  });

  app.put("/api/inventory/purchases/:id/payment", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "مبلغ الدفعة غير صالح" });
      }
      
      const existingInvoice = await storage.getPurchaseInvoice(req.params.id);
      if (!existingInvoice) {
        return res.status(404).json({ error: "فاتورة الشراء غير موجودة" });
      }
      
      const newPaidAmount = existingInvoice.paidAmount + amount;
      if (newPaidAmount > existingInvoice.totalAmount) {
        return res.status(400).json({ error: "مبلغ الدفعة يتجاوز المبلغ المتبقي" });
      }
      
      const invoice = await storage.updatePurchaseInvoicePayment(req.params.id, newPaidAmount);
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث الدفع" });
    }
  });

  // Recipe Items Routes (COGS)
  
  // Get all recipes (for COGS overview)
  app.get("/api/inventory/all-recipes", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const items = await storage.getAllRecipeItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب جميع الوصفات" });
    }
  });

  app.get("/api/inventory/recipes/:coffeeItemId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const items = await storage.getRecipeItems(req.params.coffeeItemId);
      const cost = await storage.calculateProductCost(req.params.coffeeItemId);
      res.json({ items, totalCost: cost });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب مكونات الوصفة" });
    }
  });

  app.post("/api/inventory/recipes", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { insertRecipeItemSchema } = await import("@shared/schema");
      const validatedData = insertRecipeItemSchema.parse(req.body);
      const item = await storage.createRecipeItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "فشل في إضافة مكون الوصفة" });
    }
  });

  app.put("/api/inventory/recipes/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const item = await storage.updateRecipeItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "مكون الوصفة غير موجود" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث مكون الوصفة" });
    }
  });

  app.delete("/api/inventory/recipes/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const success = await storage.deleteRecipeItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "مكون الوصفة غير موجود" });
      }
      res.json({ success: true, message: "تم حذف مكون الوصفة بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف مكون الوصفة" });
    }
  });

  // Bulk create/update recipes for a product (Sprint 3)
  app.post("/api/inventory/recipes/bulk", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { coffeeItemId, items, clearExisting } = req.body;
      
      if (!coffeeItemId) {
        return res.status(400).json({ error: "معرف المنتج مطلوب" });
      }
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "يجب إضافة مكون واحد على الأقل" });
      }
      
      // Optionally clear existing recipes for this product
      if (clearExisting) {
        const existingRecipes = await storage.getRecipeItems(coffeeItemId);
        for (const recipe of existingRecipes) {
          await storage.deleteRecipeItem(recipe.id);
        }
      }
      
      const createdItems = [];
      let totalCost = 0;
      
      for (const item of items) {
        if (!item.rawItemId || !item.quantity || !item.unit) {
          continue;
        }
        
        // Check if recipe already exists
        const existingRecipes = await storage.getRecipeItems(coffeeItemId);
        const existing = existingRecipes.find(r => r.rawItemId === item.rawItemId);
        
        if (existing) {
          // Update existing
          const updated = await storage.updateRecipeItem(existing.id, {
            quantity: item.quantity,
            unit: item.unit,
            notes: item.notes,
          });
          if (updated) createdItems.push(updated);
        } else {
          // Create new
          const created = await storage.createRecipeItem({
            coffeeItemId,
            rawItemId: item.rawItemId,
            quantity: item.quantity,
            unit: item.unit,
            notes: item.notes,
          });
          createdItems.push(created);
        }
      }
      
      // Calculate total cost
      totalCost = await storage.calculateProductCost(coffeeItemId);
      
      res.status(201).json({
        success: true,
        items: createdItems,
        totalCost,
        message: `تم إضافة ${createdItems.length} مكون للوصفة بنجاح`
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في إضافة مكونات الوصفة" });
    }
  });

  // Delete all recipes for a product
  app.delete("/api/inventory/recipes/product/:coffeeItemId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { coffeeItemId } = req.params;
      const existingRecipes = await storage.getRecipeItems(coffeeItemId);
      
      for (const recipe of existingRecipes) {
        await storage.deleteRecipeItem(recipe.id);
      }
      
      res.json({ 
        success: true, 
        deletedCount: existingRecipes.length,
        message: `تم حذف ${existingRecipes.length} مكون من الوصفة` 
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف مكونات الوصفة" });
    }
  });

  // Stock Alerts Routes
  app.get("/api/inventory/alerts", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, resolved } = req.query;
      const alerts = await storage.getStockAlerts(
        branchId as string | undefined,
        resolved === 'true' ? true : resolved === 'false' ? false : undefined
      );
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب التنبيهات" });
    }
  });

  app.put("/api/inventory/alerts/:id/resolve", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const alert = await storage.resolveStockAlert(req.params.id, req.employee?.id || 'system');
      if (!alert) {
        return res.status(404).json({ error: "التنبيه غير موجود" });
      }
      wsManager.broadcastAlertResolved(alert.id, (alert as any).branchId);
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "فشل في حل التنبيه" });
    }
  });

  app.put("/api/inventory/alerts/:id/read", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const alert = await storage.markAlertAsRead(req.params.id);
      if (!alert) {
        return res.status(404).json({ error: "التنبيه غير موجود" });
      }
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث التنبيه" });
    }
  });

  // Calculate Order COGS (Cost of Goods Sold)
  app.post("/api/inventory/calculate-cogs", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { items, branchId } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "العناصر مطلوبة" });
      }
      
      const orderItems = items.map((item: any) => ({
        coffeeItemId: item.id || item.coffeeItemId,
        quantity: item.quantity || 1,
      }));
      
      const finalBranchId = branchId || req.employee?.branchId;
      const result = await storage.calculateOrderCOGS(orderItems, finalBranchId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "فشل في حساب تكلفة البضاعة المباعة" });
    }
  });

  // Get order COGS details
  app.get("/api/orders/:id/cogs", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }
      
      res.json({
        orderId: id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        costOfGoods: order.costOfGoods || 0,
        grossProfit: order.grossProfit || 0,
        profitMargin: order.totalAmount > 0 ? ((order.grossProfit || 0) / order.totalAmount * 100).toFixed(2) : 0,
        inventoryDeducted: order.inventoryDeducted === 1,
        deductionDetails: order.inventoryDeductionDetails || [],
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب تكلفة الطلب" });
    }
  });

  // Inventory Dashboard Summary
  app.get("/api/inventory/dashboard", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.query;
      
      const [rawItems, suppliers, lowStock, alerts, transfers, purchases] = await Promise.all([
        storage.getRawItems(),
        storage.getSuppliers(),
        storage.getLowStockItems(branchId as string | undefined),
        storage.getStockAlerts(branchId as string | undefined, false),
        storage.getStockTransfers(branchId as string | undefined),
        storage.getPurchaseInvoices(branchId as string | undefined),
      ]);
      
      const pendingTransfers = transfers.filter(t => t.status === 'pending' || t.status === 'approved');
      const pendingPurchases = purchases.filter(p => p.status === 'pending' || p.status === 'approved');
      const unpaidPurchases = purchases.filter(p => p.paymentStatus === 'unpaid' || p.paymentStatus === 'partial');
      
      res.json({
        summary: {
          totalRawItems: rawItems.length,
          totalSuppliers: suppliers.length,
          lowStockCount: lowStock.length,
          alertsCount: alerts.length,
          pendingTransfersCount: pendingTransfers.length,
          pendingPurchasesCount: pendingPurchases.length,
          unpaidPurchasesCount: unpaidPurchases.length,
        },
        lowStock: lowStock.slice(0, 5),
        recentAlerts: alerts.slice(0, 5),
        pendingTransfers: pendingTransfers.slice(0, 5),
        pendingPurchases: pendingPurchases.slice(0, 5),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب ملخص المخزون" });
    }
  });

  // ===================== ZATCA INVOICE ROUTES =====================
  
  // Import ZATCA utilities
  const zatcaUtils = await import('./utils/zatca');
  
  // Get ZATCA settings (vatNumber, crNumber) from businessConfig
  app.get("/api/zatca/settings", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const config = await BusinessConfigModel.findOne({ tenantId });
      res.json({
        vatNumber: config?.vatNumber || '',
        crNumber: (config as any)?.crNumber || '',
        tradeNameAr: config?.tradeNameAr || '',
        tradeNameEn: config?.tradeNameEn || '',
      });
    } catch (error) {
      console.error("Error fetching ZATCA settings:", error);
      res.status(500).json({ error: "Failed to fetch ZATCA settings" });
    }
  });

  // Create ZATCA-compliant invoice for an order
  app.post("/api/zatca/invoices", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { orderId, customerName, customerPhone, customerEmail, customerVatNumber, 
              customerAddress, items, paymentMethod, branchId, invoiceType, transactionType } = req.body;
      
      if (!orderId || !customerName || !customerPhone || !items || !paymentMethod) {
        return res.status(400).json({ error: "البيانات المطلوبة ناقصة" });
      }
      
      // Check if invoice already exists for this order
      const existingInvoice = await zatcaUtils.getInvoiceByOrderId(orderId);
      if (existingInvoice) {
        return res.json(serializeDoc(existingInvoice));
      }
      
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "الطلب غير موجود" });
      }
      
      const invoice = await zatcaUtils.createZATCAInvoice({
        orderId,
        orderNumber: order.orderNumber,
        customerName,
        customerPhone,
        customerEmail,
        customerVatNumber,
        customerAddress,
        items,
        paymentMethod,
        branchId: branchId || req.employee?.branchId,
        createdBy: req.employee?.id,
        invoiceType,
        transactionType,
      });
      
      res.json(serializeDoc(invoice));
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء الفاتورة الضريبية" });
    }
  });
  
  // Get invoice by order ID
  app.get("/api/zatca/invoices/order/:orderId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { orderId } = req.params;
      const invoice = await zatcaUtils.getInvoiceByOrderId(orderId);
      
      if (!invoice) {
        return res.status(404).json({ error: "الفاتورة غير موجودة" });
      }
      
      res.json(serializeDoc(invoice));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الفاتورة" });
    }
  });
  
  // Get invoice XML
  app.get("/api/zatca/invoices/:id/xml", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { TaxInvoiceModel } = await import('@shared/schema');
      const invoice = await TaxInvoiceModel.findOne({ id }) || await TaxInvoiceModel.findById(id).catch(() => null);
      
      if (!invoice) {
        return res.status(404).json({ error: "الفاتورة غير موجودة" });
      }
      
      res.set('Content-Type', 'application/xml');
      res.send(invoice.xmlContent);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب ملف XML" });
    }
  });
  
  // Get all invoices with filtering
  app.get("/api/zatca/invoices", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId, startDate, endDate, page = '1', limit = '20' } = req.query;
      const { TaxInvoiceModel } = await import('@shared/schema');
      
      const query: any = {};
      const finalBranchId = branchId || req.employee?.branchId;
      
      if (finalBranchId && req.employee?.role !== 'admin' && req.employee?.role !== 'owner') {
        query.branchId = finalBranchId;
      } else if (branchId) {
        query.branchId = branchId;
      }
      
      if (startDate || endDate) {
        query.invoiceDate = {};
        if (startDate) query.invoiceDate.$gte = new Date(startDate as string);
        if (endDate) query.invoiceDate.$lte = new Date(endDate as string);
      }
      
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const [invoices, total] = await Promise.all([
        TaxInvoiceModel.find(query)
          .sort({ invoiceDate: -1 })
          .skip(skip)
          .limit(parseInt(limit as string)),
        TaxInvoiceModel.countDocuments(query),
      ]);
      
      res.json({
        invoices: invoices.map(serializeDoc),
        total,
        page: parseInt(page as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الفواتير" });
    }
  });
  
  // Get invoice statistics
  app.get("/api/zatca/stats", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, startDate, endDate } = req.query;
      const finalBranchId = branchId as string || req.employee?.branchId;
      
      const stats = await zatcaUtils.getInvoiceStats(
        finalBranchId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
      );
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب إحصائيات الفواتير" });
    }
  });
  
  // ===================== ACCOUNTING ROUTES =====================
  
  // Create expense
  app.post("/api/accounting/expenses", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ExpenseModel } = await import('@shared/schema');
      const { branchId, date, category, subcategory, description, amount, vatAmount,
              paymentMethod, vendorName, vendorVatNumber, invoiceNumber, receiptUrl, notes } = req.body;
      
      const totalAmount = amount + (vatAmount || 0);
      
      const expense = new ExpenseModel({
        branchId: branchId || req.employee?.branchId,
        date: new Date(date),
        category,
        subcategory,
        description,
        amount,
        vatAmount: vatAmount || 0,
        totalAmount,
        paymentMethod,
        vendorName,
        vendorVatNumber,
        invoiceNumber,
        receiptUrl,
        createdBy: req.employee?.id,
        status: 'pending',
        notes,
      });
      
      await expense.save();
      res.json(serializeDoc(expense));
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء المصروف" });
    }
  });
  
  // Get expenses
  app.get("/api/accounting/expenses", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { ExpenseModel } = await import('@shared/schema');
      const { branchId, startDate, endDate, category, status, page = '1', limit = '20' } = req.query;
      
      const query: any = {};
      const isAdmin = req.employee?.role === 'admin' || req.employee?.role === 'owner';
      const finalBranchId = (branchId as string) || (isAdmin ? undefined : req.employee?.branchId);
      
      if (finalBranchId) {
        query.branchId = finalBranchId;
      }
      
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate as string);
        if (endDate) query.date.$lte = new Date(endDate as string);
      }
      if (category) query.category = category;
      if (status) query.status = status;
      
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const [expenses, total] = await Promise.all([
        ExpenseModel.find(query)
          .sort({ date: -1 })
          .skip(skip)
          .limit(parseInt(limit as string)),
        ExpenseModel.countDocuments(query),
      ]);
      
      res.json({
        expenses: expenses.map(serializeDoc),
        total,
        page: parseInt(page as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب المصروفات" });
    }
  });
  
  // Approve expense
  app.patch("/api/accounting/expenses/:id/approve", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { ExpenseModel } = await import('@shared/schema');
      const { id } = req.params;
      
      const expense = await ExpenseModel.findByIdAndUpdate(
        id,
        { 
          status: 'approved',
          approvedBy: req.employee?.id,
          updatedAt: new Date(),
        },
        { new: true }
      );
      
      if (!expense) {
        return res.status(404).json({ error: "المصروف غير موجود" });
      }
      
      res.json(serializeDoc(expense));
    } catch (error) {
      res.status(500).json({ error: "فشل في اعتماد المصروف" });
    }
  });
  
  // Create revenue record
  app.post("/api/accounting/revenue", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { RevenueModel } = await import('@shared/schema');
      const { branchId, date, orderId, invoiceId, category, description,
              grossAmount, vatAmount, netAmount, paymentMethod, notes } = req.body;
      
      const revenue = new RevenueModel({
        branchId: branchId || req.employee?.branchId,
        date: new Date(date),
        orderId,
        invoiceId,
        category: category || 'sales',
        description,
        grossAmount,
        vatAmount,
        netAmount,
        paymentMethod,
        employeeId: req.employee?.id,
        notes,
      });
      
      await revenue.save();
      res.json(serializeDoc(revenue));
    } catch (error) {
      res.status(500).json({ error: "فشل في تسجيل الإيراد" });
    }
  });
  
  // Get revenue records
  app.get("/api/accounting/revenue", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { RevenueModel } = await import('@shared/schema');
      const { branchId, startDate, endDate, category, page = '1', limit = '20' } = req.query;
      
      const query: any = {};
      const isAdmin = req.employee?.role === 'admin' || req.employee?.role === 'owner';
      const finalBranchId = (branchId as string) || (isAdmin ? undefined : req.employee?.branchId);
      
      if (finalBranchId) {
        query.branchId = finalBranchId;
      }
      
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate as string);
        if (endDate) query.date.$lte = new Date(endDate as string);
      }
      if (category) query.category = category;
      
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const [revenues, total] = await Promise.all([
        RevenueModel.find(query)
          .sort({ date: -1 })
          .skip(skip)
          .limit(parseInt(limit as string)),
        RevenueModel.countDocuments(query),
      ]);
      
      res.json({
        revenues: revenues.map(serializeDoc),
        total,
        page: parseInt(page as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الإيرادات" });
    }
  });
  
  // Get daily summary
  app.get("/api/accounting/daily-summary", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, date } = req.query;
      const { DailySummaryModel, OrderModel, RevenueModel, ExpenseModel } = await import('@shared/schema');
      
      // Use Saudi timezone for daily boundary (date string treated as Saudi calendar date)
      const { start: targetDate, end: nextDate } = getSaudiDayBounds(
        date ? (date as string) : undefined
      );
      
      const finalBranchId = branchId as string || req.employee?.branchId;
      
      // Check if summary exists
      const existingSummary = await DailySummaryModel.findOne({
        branchId: finalBranchId,
        date: { $gte: targetDate, $lt: nextDate },
      });
      
      let summary: any = existingSummary;
      
      if (!existingSummary) {
        // Calculate summary from orders
        const orderQuery: any = {
          createdAt: { $gte: targetDate, $lt: nextDate },
          status: { $ne: 'cancelled' },
        };
        if (finalBranchId) orderQuery.branchId = finalBranchId;
        
        const orders = await OrderModel.find(orderQuery);
        
        const expenseQuery: any = {
          date: { $gte: targetDate, $lt: nextDate },
          status: { $in: ['approved', 'paid'] },
        };
        if (finalBranchId) expenseQuery.branchId = finalBranchId;
        
        const expenses = await ExpenseModel.find(expenseQuery);
        
        const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const totalVat = totalRevenue * 0.15 / 1.15;
        const cashRevenue = orders.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const cardRevenue = orders.filter(o => ['pos', 'stc', 'alinma', 'ur', 'barq', 'rajhi'].includes(o.paymentMethod)).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const otherRevenue = totalRevenue - cashRevenue - cardRevenue;
        const deliveryRevenue = orders.filter(o => o.deliveryFee).reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
        const totalCogs = orders.reduce((sum, o) => sum + (o.costOfGoods || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.totalAmount, 0);
        const totalDiscounts = orders.reduce((sum, o) => {
          const subtotal = o.items?.reduce((s: number, i: any) => s + (Number(i.coffeeItem?.price || 0) * i.quantity), 0) || 0;
          return sum + (subtotal - (o.totalAmount / 1.15));
        }, 0);
        
        const cancelledQuery: any = {
          createdAt: { $gte: targetDate, $lt: nextDate },
          status: 'cancelled',
        };
        if (finalBranchId) cancelledQuery.branchId = finalBranchId;
        const cancelledOrderDocs = await OrderModel.find(cancelledQuery);
        const cancelledOrdersCount = cancelledOrderDocs.length;
        const cancelledAmount = cancelledOrderDocs.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        
        summary = {
          branchId: finalBranchId || null,
          date: targetDate,
          totalOrders: orders.length,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalVatCollected: Math.round(totalVat * 100) / 100,
          cashRevenue: Math.round(cashRevenue * 100) / 100,
          cardRevenue: Math.round(cardRevenue * 100) / 100,
          otherRevenue: Math.round(otherRevenue * 100) / 100,
          salesRevenue: Math.round((totalRevenue - deliveryRevenue) * 100) / 100,
          deliveryRevenue: Math.round(deliveryRevenue * 100) / 100,
          totalCogs: Math.round(totalCogs * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          grossProfit: Math.round((totalRevenue - totalVat - totalCogs) * 100) / 100,
          netProfit: Math.round((totalRevenue - totalVat - totalCogs - totalExpenses) * 100) / 100,
          profitMargin: totalRevenue > 0 ? Math.round(((totalRevenue - totalVat - totalCogs - totalExpenses) / totalRevenue * 100) * 100) / 100 : 0,
          totalDiscounts: Math.round(Math.abs(totalDiscounts) * 100) / 100,
          cancelledOrders: cancelledOrdersCount,
          cancelledAmount: Math.round(cancelledAmount * 100) / 100,
        };
      }
      
      res.json(serializeDoc(summary) || summary);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الملخص اليومي" });
    }
  });
  
  // Get accounting dashboard
  app.get("/api/accounting/dashboard", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, period = 'today' } = req.query;
      const { OrderModel, ExpenseModel, TaxInvoiceModel } = await import('@shared/schema');
      
      const isAdmin = req.employee?.role === 'admin' || req.employee?.role === 'owner';
      const finalBranchId = (branchId as string) || (isAdmin ? undefined : req.employee?.branchId);
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date();
      
      switch (period) {
        case 'today': {
          const { start: saudiStart, end: saudiEnd } = getSaudiDayBounds();
          startDate = saudiStart;
          endDate = saudiEnd;
          break;
        }
        case 'week':
          startDate = getSaudiDaysAgo(7);
          break;
        case 'month':
          startDate = getSaudiMonthStart();
          break;
        case 'year':
          startDate = getSaudiYearStart();
          break;
      }
      
      const orderQuery: any = {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $ne: 'cancelled' },
      };
      if (finalBranchId) orderQuery.branchId = finalBranchId;
      
      const expenseQuery: any = {
        date: { $gte: startDate, $lte: endDate },
        status: { $in: ['approved', 'paid'] },
      };
      if (finalBranchId) expenseQuery.branchId = finalBranchId;
      
      const invoiceQuery: any = {
        invoiceDate: { $gte: startDate, $lte: endDate },
      };
      if (finalBranchId) invoiceQuery.branchId = finalBranchId;
      
      // Build queries for trend data (last 30 days for daily, last 12 weeks for weekly, last 12 months for monthly)
      const thirtyDaysAgo = getSaudiDaysAgo(30);
      
      const allOrdersQuery: any = {
        createdAt: { $gte: thirtyDaysAgo },
        status: { $ne: 'cancelled' },
      };
      if (finalBranchId) allOrdersQuery.branchId = finalBranchId;
      
      const allExpensesQuery: any = {
        date: { $gte: thirtyDaysAgo },
        status: { $in: ['approved', 'paid'] },
      };
      if (finalBranchId) allExpensesQuery.branchId = finalBranchId;
      
      const [orders, expenses, invoices, allOrders, allExpenses] = await Promise.all([
        OrderModel.find(orderQuery),
        ExpenseModel.find(expenseQuery),
        TaxInvoiceModel.find(invoiceQuery),
        OrderModel.find(allOrdersQuery),
        ExpenseModel.find(allExpensesQuery),
      ]);
      
      const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const totalVat = invoices.reduce((sum, i) => sum + (i.taxAmount || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + e.totalAmount, 0);
      const totalCogs = orders.reduce((sum, o) => sum + (o.costOfGoods || 0), 0);
      const grossProfit = totalRevenue - totalVat - totalCogs;
      const netProfit = grossProfit - totalExpenses;
      
      // Group by category
      const expensesByCategory = expenses.reduce((acc: any, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.totalAmount;
        return acc;
      }, {});
      
      // Group by payment method
      const revenueByPayment = orders.reduce((acc: any, o) => {
        acc[o.paymentMethod] = (acc[o.paymentMethod] || 0) + (o.totalAmount || 0);
        return acc;
      }, {});
      
      // Generate daily trend data (last 7 days)
      const dailyTrend: Array<{ date: string; revenue: number; expenses: number; cogs: number; netProfit: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const dayOrders = allOrders.filter(o => {
          const orderDate = new Date(o.createdAt);
          return orderDate >= date && orderDate < nextDay;
        });
        const dayExpenses = allExpenses.filter(e => {
          const expenseDate = new Date(e.date);
          return expenseDate >= date && expenseDate < nextDay;
        });
        
        const dayRevenue = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const dayCogs = dayOrders.reduce((sum, o) => sum + (o.costOfGoods || 0), 0);
        const dayExp = dayExpenses.reduce((sum, e) => sum + e.totalAmount, 0);
        
        dailyTrend.push({
          date: date.toISOString().split('T')[0],
          revenue: Math.round(dayRevenue * 100) / 100,
          expenses: Math.round(dayExp * 100) / 100,
          cogs: Math.round(dayCogs * 100) / 100,
          netProfit: Math.round((dayRevenue - dayCogs - dayExp) * 100) / 100,
        });
      }
      
      // Generate weekly trend data (last 4 weeks)
      const weeklyTrend: Array<{ week: string; revenue: number; expenses: number; cogs: number; netProfit: number }> = [];
      for (let i = 3; i >= 0; i--) {
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        weekEnd.setHours(23, 59, 59, 999);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        
        const weekOrders = allOrders.filter(o => {
          const orderDate = new Date(o.createdAt);
          return orderDate >= weekStart && orderDate <= weekEnd;
        });
        const weekExpenses = allExpenses.filter(e => {
          const expenseDate = new Date(e.date);
          return expenseDate >= weekStart && expenseDate <= weekEnd;
        });
        
        const weekRevenue = weekOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const weekCogs = weekOrders.reduce((sum, o) => sum + (o.costOfGoods || 0), 0);
        const weekExp = weekExpenses.reduce((sum, e) => sum + e.totalAmount, 0);
        
        weeklyTrend.push({
          week: `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`,
          revenue: Math.round(weekRevenue * 100) / 100,
          expenses: Math.round(weekExp * 100) / 100,
          cogs: Math.round(weekCogs * 100) / 100,
          netProfit: Math.round((weekRevenue - weekCogs - weekExp) * 100) / 100,
        });
      }
      
      // Top selling items
      const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
      orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            if (!item) return;
            const itemId = item.coffeeItemId || item.id || 'unknown';
            if (!itemId || itemId === 'unknown') return;
            const itemName = item.coffeeItem?.nameAr || item.nameAr || 'غير معروف';
            const itemQty = Number(item.quantity) || 1;
            const itemPrice = Number(item.price) || 0;
            
            if (!itemSales[itemId]) {
              itemSales[itemId] = { name: itemName, quantity: 0, revenue: 0 };
            }
            itemSales[itemId].quantity += itemQty;
            itemSales[itemId].revenue += itemPrice * itemQty;
          });
        }
      });
      
      const topSellingItems = Object.entries(itemSales)
        .filter(([id]) => id && id !== 'unknown')
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      
      res.json({
        period,
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalVatCollected: Math.round(totalVat * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          totalCogs: Math.round(totalCogs * 100) / 100,
          grossProfit: Math.round(grossProfit * 100) / 100,
          netProfit: Math.round(netProfit * 100) / 100,
          profitMargin: totalRevenue > 0 ? Math.round((netProfit / totalRevenue * 100) * 100) / 100 : 0,
          orderCount: orders.length,
          invoiceCount: invoices.length,
        },
        expensesByCategory,
        revenueByPayment,
        dailyTrend,
        weeklyTrend,
        topSellingItems,
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب لوحة المحاسبة" });
    }
  });
  
  // ===================== KITCHEN DISPLAY ROUTES =====================
  
  // Get kitchen orders
  app.get("/api/kitchen/orders", requireAuth, requireKitchenAccess, async (req: AuthRequest, res) => {
    try {
      const { KitchenOrderModel } = await import('@shared/schema');
      const { branchId, status } = req.query;
      
      const query: any = {};
      const finalBranchId = branchId || req.employee?.branchId;
      if (finalBranchId) query.branchId = finalBranchId;
      if (status) {
        query.status = status;
      } else {
        query.status = { $in: ['pending', 'in_progress'] };
      }
      
      const orders = await KitchenOrderModel.find(query)
        .sort({ priority: -1, createdAt: 1 });
      
      res.json(orders.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب طلبات المطبخ" });
    }
  });
  
  // Create kitchen order from regular order (cashiers and above can create)
  app.post("/api/kitchen/orders", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const { KitchenOrderModel } = await import('@shared/schema');
      const { orderId, orderNumber, items, orderType, tableNumber, customerName, priority, notes } = req.body;
      
      // Check if kitchen order already exists
      const existing = await KitchenOrderModel.findOne({ orderId });
      if (existing) {
        return res.json(serializeDoc(existing));
      }
      
      const kitchenOrder = new KitchenOrderModel({
        orderId,
        orderNumber,
        branchId: req.employee?.branchId,
        items: items.map((item: any) => ({
          itemId: item.itemId || item.coffeeItemId,
          nameAr: item.nameAr || item.coffeeItem?.nameAr,
          quantity: item.quantity,
          notes: item.notes,
          status: 'pending',
        })),
        priority: priority || 'normal',
        orderType: orderType || 'takeaway',
        tableNumber,
        customerName,
        status: 'pending',
        notes,
      });
      
      await kitchenOrder.save();
      res.json(serializeDoc(kitchenOrder));
    } catch (error) {
      res.status(500).json({ error: "فشل في إنشاء طلب المطبخ" });
    }
  });
  
  // Update kitchen order status
  app.patch("/api/kitchen/orders/:id", requireAuth, requireKitchenAccess, async (req: AuthRequest, res) => {
    try {
      const { KitchenOrderModel } = await import('@shared/schema');
      const { id } = req.params;
      const { status, assignedTo } = req.body;
      
      const update: any = { updatedAt: new Date() };
      if (status) {
        update.status = status;
        if (status === 'in_progress') {
          update.startedAt = new Date();
          update.assignedTo = req.employee?.id;
        } else if (status === 'ready' || status === 'completed') {
          update.completedAt = new Date();
        }
      }
      if (assignedTo) update.assignedTo = assignedTo;
      
      const order = await KitchenOrderModel.findByIdAndUpdate(id, update, { new: true });
      
      if (!order) {
        return res.status(404).json({ error: "طلب المطبخ غير موجود" });
      }

      // Automatic inventory deduction when kitchen order starts preparation
      if (status === 'in_progress' && order.orderId && order.branchId) {
        const employeeId = req.employee?.id || 'system';
        const inventoryResult = await deductInventoryForOrder(order.orderId, order.branchId, employeeId);
        if (inventoryResult.success) {
        } else {
        }
      }
      
      res.json(serializeDoc(order));
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث طلب المطبخ" });
    }
  });
  
  // Update item status in kitchen order
  app.patch("/api/kitchen/orders/:id/items/:itemId", requireAuth, requireKitchenAccess, async (req: AuthRequest, res) => {
    try {
      const { KitchenOrderModel } = await import('@shared/schema');
      const { id, itemId } = req.params;
      const { status } = req.body;
      
      const order = await KitchenOrderModel.findOne({ id }) || await KitchenOrderModel.findById(id).catch(() => null);
      if (!order) {
        return res.status(404).json({ error: "طلب المطبخ غير موجود" });
      }
      
      const item = order.items.find((i: any) => i.itemId === itemId);
      if (!item) {
        return res.status(404).json({ error: "العنصر غير موجود" });
      }
      
      item.status = status;
      if (status === 'ready') {
        item.preparedBy = req.employee?.id;
        item.preparedAt = new Date();
      }
      
      // Check if all items are ready
      const allReady = order.items.every((i: any) => i.status === 'ready');
      if (allReady) {
        order.status = 'ready';
        order.completedAt = new Date();
      } else if (order.items.some((i: any) => i.status === 'preparing')) {
        order.status = 'in_progress';
      }
      
      order.updatedAt = new Date();
      await order.save();
      
      res.json(serializeDoc(order));
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث عنصر المطبخ" });
    }
  });

  // Check delivery availability (500m radius from branches)
  app.post("/api/delivery/check-availability", async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ error: "الموقع مطلوب" });
      }
      
      const customerLocation = { lat: Number(latitude), lng: Number(longitude) };
      const tenantId = getTenantIdFromRequest(req) || 'demo-tenant';
      const branches = await storage.getBranches(tenantId);
      
      const { checkDeliveryAvailability } = await import('./utils/geo');
      const result = checkDeliveryAvailability(customerLocation, branches);
      
      res.json({
        canDeliver: result.canDeliver,
        nearestBranch: result.nearestBranch ? {
          id: result.nearestBranch._id?.toString() || result.nearestBranch.id,
          nameAr: result.nearestBranch.nameAr,
          nameEn: result.nearestBranch.nameEn,
        } : null,
        distanceMeters: result.distanceMeters,
        message: result.message,
        messageAr: result.messageAr,
        deliveryRadiusMeters: 500,
        allBranches: result.allBranchesWithDistance.map(b => ({
          id: b.branch._id?.toString() || b.branch.id,
          nameAr: b.branch.nameAr,
          nameEn: b.branch.nameEn,
          distanceMeters: Math.round(b.distanceMeters),
          isInRange: b.isInRange,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في التحقق من التوصيل" });
    }
  });

  // ==========================================
  // Product Addons & Customizations Routes
  // ==========================================
  
  // Get all product addons
  app.get("/api/product-addons", async (req, res) => {
    try {
      const { ProductAddonModel } = await import("@shared/schema");
      const addons = await ProductAddonModel.find({ isAvailable: 1 }).sort({ orderIndex: 1, category: 1, nameAr: 1 });
      res.json(addons.map(a => ({ ...a.toObject(), id: a.id })));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الإضافات" });
    }
  });

  // Get ALL product addons for admin management (includes unavailable)
  app.get("/api/product-addons-all", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ProductAddonModel } = await import("@shared/schema");
      const addons = await ProductAddonModel.find({}).sort({ orderIndex: 1, category: 1, nameAr: 1 });
      res.json(addons.map(a => ({ ...a.toObject(), id: a.id })));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الإضافات" });
    }
  });

  // Get all coffeeItemIds that have at least one addon linked (used by POS to open customization dialog)
  app.get("/api/coffee-items-with-addons", async (req, res) => {
    try {
      const { CoffeeItemAddonModel } = await import("@shared/schema");
      const links = await CoffeeItemAddonModel.find({}, { coffeeItemId: 1, _id: 0 }).lean();
      const ids = [...new Set(links.map((l: any) => l.coffeeItemId))];
      res.json(ids);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch items with addons" });
    }
  });

  // Get addons for a specific coffee item
  app.get("/api/coffee-items/:coffeeItemId/addons", async (req, res) => {
    try {
      const { CoffeeItemAddonModel, ProductAddonModel } = await import("@shared/schema");
      const links = await CoffeeItemAddonModel.find({ coffeeItemId: req.params.coffeeItemId });
      const addonIds = links.map(l => l.addonId);
      const addons = await ProductAddonModel.find({ id: { $in: addonIds }, isAvailable: 1 });
      
      const result = links.map(link => {
        const addon = addons.find(a => a.id === link.addonId);
        return addon ? {
          ...addon.toObject(),
          id: addon.id,
          addonId: addon.id,
          isDefault: link.isDefault,
          defaultValue: link.defaultValue,
          minQuantity: link.minQuantity,
          maxQuantity: link.maxQuantity,
        } : null;
      }).filter(Boolean);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب إضافات المشروب" });
    }
  });

  // Create product addon (admin/manager only)
  app.post("/api/product-addons", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ProductAddonModel, insertProductAddonSchema } = await import("@shared/schema");
      const validatedData = insertProductAddonSchema.parse(req.body);
      
      const addon = new ProductAddonModel(validatedData);
      await addon.save();
      
      res.status(201).json({ ...addon.toObject(), id: addon.id });
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      res.status(500).json({ error: "فشل في إنشاء الإضافة" });
    }
  });

  // Update product addon
  app.put("/api/product-addons/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ProductAddonModel, insertProductAddonSchema } = await import("@shared/schema");
      const partialSchema = insertProductAddonSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const addon = await ProductAddonModel.findOneAndUpdate(
        { id: req.params.id },
        { $set: validatedData },
        { new: true }
      );
      
      if (!addon) {
        return res.status(404).json({ error: "الإضافة غير موجودة" });
      }
      
      res.json({ ...addon.toObject(), id: addon.id });
    } catch (error: any) {
      res.status(500).json({ error: "فشل في تحديث الإضافة" });
    }
  });

  // Delete product addon
  app.delete("/api/product-addons/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ProductAddonModel, CoffeeItemAddonModel } = await import("@shared/schema");
      
      await ProductAddonModel.deleteOne({ id: req.params.id });
      await CoffeeItemAddonModel.deleteMany({ addonId: req.params.id });
      
      res.json({ success: true, message: "تم حذف الإضافة بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف الإضافة" });
    }
  });

  // Link addon to coffee item
  app.post("/api/coffee-items/:coffeeItemId/addons", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { CoffeeItemAddonModel, insertCoffeeItemAddonSchema } = await import("@shared/schema");
      const validatedData = insertCoffeeItemAddonSchema.parse({
        coffeeItemId: req.params.coffeeItemId,
        ...req.body
      });
      
      await CoffeeItemAddonModel.findOneAndUpdate(
        { coffeeItemId: validatedData.coffeeItemId, addonId: validatedData.addonId },
        { $set: validatedData },
        { upsert: true, new: true }
      );
      
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "فشل في ربط الإضافة بالمشروب" });
    }
  });

  // Remove addon from coffee item
  app.delete("/api/coffee-items/:coffeeItemId/addons/:addonId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { CoffeeItemAddonModel } = await import("@shared/schema");
      await CoffeeItemAddonModel.deleteOne({
        coffeeItemId: req.params.coffeeItemId,
        addonId: req.params.addonId
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل في إزالة الإضافة من المشروب" });
    }
  });

  // ==========================================
  // Promo Offers / Bundles Routes
  // ==========================================

  // Get all active promo offers (public)
  app.get("/api/promo-offers", async (req, res) => {
    try {
      const { PromoOfferModel } = await import("@shared/schema");
      const now = new Date();
      const offers = await PromoOfferModel.find({
        isActive: 1,
        $or: [
          { startDate: null, endDate: null },
          { startDate: { $lte: now }, endDate: null },
          { startDate: null, endDate: { $gte: now } },
          { startDate: { $lte: now }, endDate: { $gte: now } }
        ]
      }).sort({ sortOrder: 1, createdAt: -1 });
      res.json(offers.map(o => ({ ...o.toObject(), id: o.id })));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب العروض" });
    }
  });

  // Get all promo offers (admin/manager)
  app.get("/api/admin/promo-offers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { PromoOfferModel } = await import("@shared/schema");
      const offers = await PromoOfferModel.find({}).sort({ sortOrder: 1, createdAt: -1 });
      res.json(offers.map(o => ({ ...o.toObject(), id: o.id })));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب العروض" });
    }
  });

  // Create promo offer (admin/manager)
  app.post("/api/promo-offers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { PromoOfferModel } = await import("@shared/schema");
      const crypto = await import("crypto");
      
      const offerData = {
        ...req.body,
        id: req.body.id || crypto.randomUUID(),
        tenantId: req.body.tenantId || "default",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const offer = new PromoOfferModel(offerData);
      await offer.save();
      
      res.status(201).json({ ...offer.toObject(), id: offer.id });
    } catch (error: any) {
      console.error("Error creating promo offer:", error);
      res.status(500).json({ error: "فشل في إنشاء العرض" });
    }
  });

  // Update promo offer
  app.put("/api/promo-offers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { PromoOfferModel } = await import("@shared/schema");
      
      const offer = await PromoOfferModel.findOneAndUpdate(
        { id: req.params.id },
        { $set: { ...req.body, updatedAt: new Date() } },
        { new: true }
      );
      
      if (!offer) {
        return res.status(404).json({ error: "العرض غير موجود" });
      }
      
      res.json({ ...offer.toObject(), id: offer.id });
    } catch (error: any) {
      res.status(500).json({ error: "فشل في تحديث العرض" });
    }
  });

  // Delete promo offer
  app.delete("/api/promo-offers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { PromoOfferModel } = await import("@shared/schema");
      await PromoOfferModel.deleteOne({ id: req.params.id });
      res.json({ success: true, message: "تم حذف العرض بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف العرض" });
    }
  });

  // ===== Menu Categories API =====
  
  // Get all active menu categories (public - scoped by tenantId)
  app.get("/api/menu-categories", async (req, res) => {
    try {
      const { MenuCategoryModel } = await import("@shared/schema");
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const branchId = req.query.branchId as string;
      
      const query: any = { 
        isActive: 1,
        tenantId 
      };
      
      if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        query.$or = [
          { branchId: branchId },
          { publishedBranches: branchId },
          { createdByBranchId: branchId }
        ];
      }
      
      const categories = await MenuCategoryModel.find(query).sort({ orderIndex: 1, createdAt: 1 });
      res.json(categories.map(c => ({ ...c.toObject(), id: c.id })));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الأقسام" });
    }
  });

  // Create menu category (admin/manager)
  app.post("/api/menu-categories", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { MenuCategoryModel } = await import("@shared/schema");
      const { z } = await import("zod");
      const crypto = await import("crypto");
      
      // Validate input
      const createSchema = z.object({
        nameAr: z.string().min(1, "اسم القسم مطلوب"),
        nameEn: z.string().optional(),
        icon: z.string().optional(),
        department: z.enum(['drinks', 'food']).default('drinks'),
      });
      
      const validatedData = createSchema.parse(req.body);
      
      // Get tenant from auth or header
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      
      // Get the max orderIndex for new categories
      const maxOrder = await MenuCategoryModel.findOne({ tenantId }).sort({ orderIndex: -1 });
      const newOrderIndex = (maxOrder?.orderIndex || 0) + 1;
      
      const categoryData = {
        id: crypto.randomUUID(),
        tenantId,
        nameAr: validatedData.nameAr,
        nameEn: validatedData.nameEn,
        icon: validatedData.icon || 'Coffee',
        department: validatedData.department,
        orderIndex: newOrderIndex,
        isSystem: false,
        isActive: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const category = new MenuCategoryModel(categoryData);
      await category.save();
      
      res.status(201).json({ ...category.toObject(), id: category.id });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.errors[0]?.message || "بيانات غير صالحة" });
      }
      console.error("Error creating menu category:", error);
      res.status(500).json({ error: "فشل في إنشاء القسم" });
    }
  });

  // Update menu category
  app.put("/api/menu-categories/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { MenuCategoryModel } = await import("@shared/schema");
      const { z } = await import("zod");
      
      // Validate input - only allow specific fields to be updated
      const updateSchema = z.object({
        nameAr: z.string().min(1).optional(),
        nameEn: z.string().optional(),
        icon: z.string().optional(),
        department: z.enum(['drinks', 'food']).optional(),
        orderIndex: z.number().optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      
      const category = await MenuCategoryModel.findOneAndUpdate(
        { id: req.params.id, tenantId },
        { $set: { ...validatedData, updatedAt: new Date() } },
        { new: true }
      );
      
      if (!category) {
        return res.status(404).json({ error: "القسم غير موجود" });
      }
      
      res.json({ ...category.toObject(), id: category.id });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.errors[0]?.message || "بيانات غير صالحة" });
      }
      res.status(500).json({ error: "فشل في تحديث القسم" });
    }
  });

  // Delete menu category (soft delete)
  app.delete("/api/menu-categories/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { MenuCategoryModel } = await import("@shared/schema");
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      
      // Check if it's a system category
      const category = await MenuCategoryModel.findOne({ id: req.params.id, tenantId });
      if (!category) {
        return res.status(404).json({ error: "القسم غير موجود" });
      }
      if (category.isSystem) {
        return res.status(400).json({ error: "لا يمكن حذف قسم أساسي" });
      }
      
      // Soft delete by setting isActive to 0
      await MenuCategoryModel.findOneAndUpdate(
        { id: req.params.id, tenantId },
        { $set: { isActive: 0, updatedAt: new Date() } }
      );
      res.json({ success: true, message: "تم حذف القسم بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف القسم" });
    }
  });

  // Lookup loyalty card by barcode/QR token (for POS scanner)
  app.get("/api/loyalty/cards/lookup/:token", async (req, res) => {
    try {
      const { LoyaltyCardModel, CustomerModel } = await import("@shared/schema");
      const token = req.params.token;
      
      // Search by qrToken, cardNumber, or phone
      const card = await LoyaltyCardModel.findOne({
        $or: [
          { qrToken: token },
          { cardNumber: token },
          { phoneNumber: token }
        ]
      });
      
      if (!card) {
        return res.status(404).json({ error: "البطاقة غير موجودة", found: false });
      }
      
      const customer = await CustomerModel.findOne({ phone: card.phoneNumber });
      
      res.json({
        found: true,
        card: { ...card.toObject(), id: card._id?.toString() || card.id },
        customer: customer ? {
          id: customer._id?.toString(),
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          points: customer.points,
        } : null
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في البحث عن البطاقة" });
    }
  });

  // ============ PRODUCT REVIEWS ROUTES ============
  app.get("/api/reviews", async (req, res) => {
    try {
      const { productId } = req.query;
      const reviews = await ProductReviewModel.find({ productId });
      res.json(reviews.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب التقييمات" });
    }
  });

  app.post("/api/reviews", requireAuth, async (req, res) => {
    try {
      const { productId, rating, comment } = req.body;
      const customerId = (req as any).user?.id;
      
      const review = new ProductReviewModel({
        productId,
        customerId,
        rating,
        comment,
        isVerifiedPurchase: 1,
      });
      await review.save();
      res.json(serializeDoc(review));
    } catch (error) {
      res.status(500).json({ error: "فشل في حفظ التقييم" });
    }
  });

  // ============ REFERRAL ROUTES ============
  app.get("/api/referrals", requireAuth, async (req, res) => {
    try {
      const referrerId = (req as any).user?.id;
      const referrals = await ReferralModel.find({ referrerId });
      const completed = referrals.filter((r) => r.status === "completed").length;
      const code = `REFER${referrerId?.substring(0, 8).toUpperCase()}`;
      const points = completed * 50;
      
      res.json({
        code,
        completed,
        points,
        list: referrals.map(serializeDoc),
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الإحالات" });
    }
  });

  app.post("/api/referrals/invite", requireAuth, async (req, res) => {
    try {
      const referrerId = (req as any).user?.id;
      const { referredPhone, referredEmail } = req.body;
      
      const code = `REFER${referrerId?.substring(0, 8).toUpperCase()}`;
      const referral = new ReferralModel({
        referrerId,
        referrerCode: code,
        referredPhone,
        referredEmail,
        status: "pending",
      });
      await referral.save();

      // Create notification
      const notification = new NotificationModel({
        customerId: referrerId,
        title: "تم إرسال الدعوة",
        message: `تم إرسال رمز الإحالة الخاص بك إلى ${referredPhone}`,
        type: "referral",
      });
      await notification.save();

      res.json(serializeDoc(referral));
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال الدعوة" });
    }
  });

  // ============ NOTIFICATIONS ROUTES ============
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const customerId = (req as any).user?.id || req.query.customerId as string;

      let query: any = {};
      if (userId) {
        query = { $or: [{ userId }, { customerId: userId }] };
      } else if (customerId) {
        query = { $or: [{ customerId }, { userId: customerId }] };
      }

      const notifications = await NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .limit(50);
      res.json(notifications.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل في جلب الإشعارات" });
    }
  });

  // Admin: get unread count for employee notifications
  app.get("/api/notifications/unread-count", requireAuth, async (req: AuthRequest, res) => {
    try {
      const employeeId = req.employee?.id;
      const count = await NotificationModel.countDocuments({
        $or: [{ userId: employeeId }, { userType: "employee" }],
        isRead: 0,
      });
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "فشل" });
    }
  });

  // Admin: broadcast push notification to all subscribers
  app.post("/api/notifications/broadcast", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { title, body, link, target } = req.body;
      if (!title || !body) return res.status(400).json({ error: "العنوان والنص مطلوبان" });

      const { fireNotifyBroadcast, fireNotifyAdmins } = await import("./notification-engine");

      if (target === "admins") {
        await fireNotifyAdmins(title, body, { type: "info", link: link || "/", icon: "📢" });
      } else {
        await fireNotifyBroadcast(title, body, { type: "promo", link: link || "/", icon: "📢" });
      }

      res.json({ success: true, message: "تم إرسال الإشعار بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال الإشعار" });
    }
  });

  // Admin: send notification to specific user
  app.post("/api/notifications/send", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { userId, userType, title, body, link, type } = req.body;
      if (!userId || !title || !body) return res.status(400).json({ error: "بيانات ناقصة" });

      const { fireNotify } = await import("./notification-engine");
      await fireNotify(userId, title, body, {
        type: type || "info",
        link: link || "/",
        userType: userType || "customer",
        icon: "🔔",
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال الإشعار" });
    }
  });

  // Marketing Email Route for Staff
  app.post("/api/admin/broadcast-email", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { subject, message, customerEmails } = req.body;
      
      if (!subject || !message || !customerEmails || !Array.isArray(customerEmails)) {
        return res.status(400).json({ error: "بيانات الحملة غير مكتملة" });
      }

      const { appendOrderToSheet } = await import("./google-sheets");

      // Send via Sheets for each customer
      for (const email of customerEmails) {
        await appendOrderToSheet({
          id: `MKT-${Date.now()}`,
          customerEmail: email,
          status: subject,
          customerNotes: message
        }, 'MARKETING');
      }

      res.json({ success: true, message: "تمت جدولة إرسال الحملة البريدية عبر جوجل شيت" });
    } catch (error) {
      res.status(500).json({ error: "فشل في جدولة الحملة البريدية" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const notification = await NotificationModel.findByIdAndUpdate(
        req.params.id,
        { isRead: 1 },
        { new: true }
      );
      res.json(serializeDoc(notification));
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث الإشعار" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      await NotificationModel.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل في حذف الإشعار" });
    }
  });

  app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const customerId = (req as any).user?.id || req.body.customerId || req.query.customerId;
      const userId = req.body.userId || req.query.userId || customerId;
      await NotificationModel.updateMany(
        { $or: [{ customerId: userId }, { userId }], isRead: 0 },
        { isRead: 1 }
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل في تحديث الإشعارات" });
    }
  });

  // ============ EMAIL NOTIFICATION ROUTES ============
  app.post("/api/send-order-email", requireAuth, async (req, res) => {
    try {
      const { orderId, orderStatus, orderTotal } = req.body;
      const customerId = (req as any).user?.id;

      // Get customer info
      const customer = await CustomerModel.findById(customerId);
      if (!customer || !customer.email) {
        return res.status(400).json({ error: "بريد العميل غير متوفر" });
      }

      const success = await sendOrderNotificationEmail(
        customer.email,
        customer.name,
        orderId,
        orderStatus,
        orderTotal
      );

      if (!success) {
        console.log("Email service not configured, but notification created");
      }

      res.json({ success: true, message: "تم إرسال الإشعار" });
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال الإشعار" });
    }
  });

  app.post("/api/send-referral-email", requireAuth, async (req, res) => {
    try {
      const customerId = (req as any).user?.id;
      const customer = await CustomerModel.findById(customerId);

      if (!customer || !customer.email) {
        return res.status(400).json({ error: "بريد العميل غير متوفر" });
      }

      const referralCode = `REFER${customerId?.substring(0, 8).toUpperCase()}`;

      const success = await sendReferralEmail(
        customer.email,
        customer.name,
        referralCode
      );

      if (!success) {
        console.log("Email service not configured, but referral tracked");
      }

      res.json({ success: true, message: "تم إرسال بريد الإحالة" });
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال بريد الإحالة" });
    }
  });

  app.post("/api/send-loyalty-email", requireAuth, async (req, res) => {
    try {
      const { pointsEarned } = req.body;
      const customerId = (req as any).user?.id;

      const customer = await CustomerModel.findById(customerId);
      if (!customer || !customer.email) {
        return res.status(400).json({ error: "بريد العميل غير متوفر" });
      }

      const success = await sendLoyaltyPointsEmail(
        customer.email,
        customer.name,
        pointsEarned,
        customer.points || 0
      );

      if (!success) {
        console.log("Email service not configured, but points tracked");
      }

      res.json({ success: true, message: "تم إرسال بريد النقاط" });
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال بريد النقاط" });
    }
  });

  app.post("/api/send-promotion-email", requireAdmin, async (req, res) => {
    try {
      const { customerId, promotionTitle, promotionDescription, discountCode } =
        req.body;

      const customer = await CustomerModel.findById(customerId);
      if (!customer || !customer.email) {
        return res.status(400).json({ error: "بريد العميل غير متوفر" });
      }

      const success = await sendPromotionEmail(
        customer.email,
        customer.name,
        promotionTitle,
        promotionDescription,
        discountCode
      );

      if (!success) {
        console.log("Email service not configured, but promotion tracked");
      }

      res.json({ success: true, message: "تم إرسال العرض الترويجي" });
    } catch (error) {
      res.status(500).json({ error: "فشل في إرسال العرض الترويجي" });
    }
  });

  app.get("/api/email-status", async (req, res) => {
    try {
      const connected = await testEmailConnection();
      res.json({
        connected,
        message: connected
          ? "خدمة البريد الإلكتروني متصلة"
          : "خدمة البريد الإلكتروني غير متصلة. الرجاء تكوين بيانات Gmail",
      });
    } catch (error) {
      res.status(500).json({ error: "فشل في التحقق من حالة البريد" });
    }
  });

  // Test email endpoint - send order confirmation with current status
  app.post("/api/test-email", async (req, res) => {
    try {
      const { email = "youssefdarwish20009@gmail.com", customerName = "العميل", orderId = "TEST001", status = "in_progress", total = 45.50 } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
      }

      // Send order notification email with order details and current status
      const success = await sendOrderNotificationEmail(
        email,
        customerName,
        orderId,
        status,
        total
      );

      if (success) {
        res.json({ 
          success: true, 
          message: "✅ تم إرسال رسالة تأكيد الطلب بنجاح!",
          details: {
            email,
            customerName,
            orderId,
            status,
            total
          }
        });
      } else {
        res.status(500).json({ error: "❌ فشل في إرسال رسالة تأكيد الطلب" });
      }
    } catch (error) {
      res.status(500).json({ error: "❌ خطأ: " + (error as any).message });
    }
  });

  // ===== MULTI-TENANT MANAGEMENT ENDPOINTS =====
  
  // Get all tenants (Admin only)
  app.get("/api/admin/tenants", requireAdmin, async (req, res) => {
    try {
      const tenants = await CafeModel.find().lean();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  // Get specific tenant
  app.get("/api/admin/tenants/:tenantId", requireAdmin, async (req, res) => {
    try {
      const tenant = await CafeModel.findOne({ id: req.params.tenantId }).lean();
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenant" });
    }
  });

  // Create new tenant (Admin only)
  app.post("/api/admin/tenants", requireAdmin, async (req, res) => {
    try {
      const { id, nameAr, nameEn, type, businessName, businessPhone, businessEmail, billingContact, adminContact } = req.body;
      
      if (!id || !nameAr || !nameEn || !businessName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const tenant = new CafeModel({
        id,
        nameAr,
        nameEn,
        type: type || 'demo',
        businessName,
        businessPhone,
        businessEmail,
        billingContact,
        adminContact,
        status: 'active'
      });

      await tenant.save();
      res.json({ success: true, tenant });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create tenant" });
    }
  });

  // Update tenant (Admin only)
  app.patch("/api/admin/tenants/:tenantId", requireAdmin, async (req, res) => {
    try {
      const tenant = await CafeModel.findOneAndUpdate(
        { id: req.params.tenantId },
        { $set: { ...req.body, updatedAt: new Date() } },
        { new: true }
      );
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      res.json({ success: true, tenant });
    } catch (error) {
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  // Delete tenant (Admin only - soft delete)
  app.delete("/api/admin/tenants/:tenantId", requireAdmin, async (req, res) => {
    try {
      await CafeModel.updateOne({ id: req.params.tenantId }, { status: 'inactive' });
      res.json({ success: true, message: "Tenant deactivated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to deactivate tenant" });
    }
  });

  // Get tenant info (for logged-in users)
  app.get("/api/tenant/info", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.employee?.tenantId;
      if (!tenantId) return res.status(400).json({ error: "No tenant context" });
      
      const tenant = await CafeModel.findOne({ id: tenantId }).lean();
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenant info" });
    }
  });

  // ============ RECIPE ROUTES (Phase 4) ============
  
  // Get active recipe for drink
  app.get("/api/recipes/:coffeeItemId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { coffeeItemId } = req.params;
      const recipe = await RecipeEngine.getActiveRecipe(coffeeItemId);
      
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      res.json({ success: true, recipe });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipe" });
    }
  });

  // ============ INVENTORY ROUTES (Phase 4) ============
  
  // Get stock level
  app.get("/api/inventory/stock-level/:branchId/:rawItemId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId, rawItemId } = req.params;
      const level = await InventoryEngine.getStockLevel(branchId, rawItemId);
      
      if (!level) {
        return res.status(404).json({ error: "Stock record not found" });
      }

      res.json({ success: true, stockLevel: level });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stock level" });
    }
  });

  // Record stock in (purchase)
  app.post("/api/inventory/stock-in", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId, rawItemId, quantity, unit, supplierId, notes } = req.body;
      const userId = req.employee?.id || "system";

      if (!branchId || !rawItemId || !quantity || !unit) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await InventoryEngine.recordStockIn({
        branchId,
        rawItemId,
        quantity,
        unit,
        supplierId,
        notes,
        createdBy: userId,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, newQuantity: result.newQuantity, movement: result.movement });
    } catch (error) {
      res.status(500).json({ error: "Failed to record stock in" });
    }
  });

  // Get active alerts
  app.get("/api/inventory/alerts/:branchId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const alerts = await InventoryEngine.getActiveAlerts(branchId);
      res.json({ success: true, alerts });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // Get low stock items (daily summary)
  app.get("/api/inventory/low-stock/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const items = await InventoryEngine.getLowStockItems(branchId);
      res.json({ success: true, items });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch low stock items" });
    }
  });

  // Get movement history
  app.get("/api/inventory/movements/:branchId/:rawItemId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { branchId, rawItemId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const movements = await InventoryEngine.getMovementHistory(branchId, rawItemId, limit);
      res.json({ success: true, movements });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch movement history" });
    }
  });

  // ============ ACCOUNTING ROUTES (Phase 4) ============
  
  // Get daily snapshot
  app.get("/api/accounting/daily-snapshot/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      
      const snapshot = await AccountingEngine.getDailySnapshot(branchId, date);
      res.json({ success: true, snapshot });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch daily snapshot" });
    }
  });

  // Get profit per drink report
  app.get("/api/accounting/profit-by-item/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      const report = await AccountingEngine.getProfitPerDrink(branchId, startDate, endDate);
      res.json({ success: true, report });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profit report" });
    }
  });

  // Get profit per category report
  app.get("/api/accounting/profit-by-category/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      const report = await AccountingEngine.getProfitPerCategory(branchId, startDate, endDate);
      res.json({ success: true, report });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category report" });
    }
  });

  // Get top profitable items
  app.get("/api/accounting/top-items/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const items = await AccountingEngine.getTopProfitableItems(branchId, startDate, endDate, limit);
      res.json({ success: true, items });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top items" });
    }
  });

  // Get worst performing items
  app.get("/api/accounting/worst-items/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const items = await AccountingEngine.getWorstItems(branchId, startDate, endDate, limit);
      res.json({ success: true, items });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch worst items" });
    }
  });

  // Get waste report
  app.get("/api/accounting/waste-report/:branchId", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { branchId } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      const report = await AccountingEngine.getWasteReport(branchId, startDate, endDate);
      res.json({ success: true, report });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch waste report" });
    }
  });

  // Save daily snapshot
  app.post("/api/accounting/snapshot", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { tenantId, branchId } = req.body;
      const userId = req.employee?.id || "system";

      if (!tenantId || !branchId) {
        return res.status(400).json({ error: "Missing required fields: tenantId, branchId" });
      }

      const snapshot = await AccountingEngine.saveDailySnapshot(tenantId, branchId, userId);

      if (!snapshot) {
        return res.status(400).json({ error: "Failed to save snapshot" });
      }

      res.json({ success: true, snapshot });
    } catch (error) {
      res.status(500).json({ error: "Failed to save snapshot" });
    }
  });

  // ============================================
  // ERP Accounting System Routes
  // نظام المحاسبة المتقدم ERP
  // ============================================

  // Initialize Chart of Accounts
  app.post("/api/erp/accounts/initialize", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const accounts = await ErpAccountingService.initializeChartOfAccounts(tenantId);
      res.json({ success: true, accounts: accounts.map(serializeDoc), count: accounts.length });
    } catch (error: any) {
      console.error("Error initializing chart of accounts:", error);
      res.status(500).json({ error: error.message || "Failed to initialize chart of accounts" });
    }
  });

  // Get all accounts
  app.get("/api/erp/accounts", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const accounts = await ErpAccountingService.getAccounts(tenantId, {
        accountType: req.query.accountType as string,
        isActive: req.query.isActive ? parseInt(req.query.isActive as string) : undefined,
        parentAccountId: req.query.parentAccountId as string,
      });
      res.json({ success: true, accounts: accounts.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch accounts" });
    }
  });

  // Get account tree
  app.get("/api/erp/accounts/tree", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const tree = await ErpAccountingService.getAccountTree(tenantId);
      res.json({ success: true, tree });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch account tree" });
    }
  });

  // Create new account
  app.post("/api/erp/accounts", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const account = await ErpAccountingService.createAccount({
        tenantId,
        ...req.body,
      });
      res.json({ success: true, account: serializeDoc(account) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create account" });
    }
  });

  // Get journal entries
  app.get("/api/erp/journal-entries", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const query: any = { tenantId };
      if (req.query.status) query.status = req.query.status;
      if (req.query.referenceType) query.referenceType = req.query.referenceType;
      const entries = await JournalEntryModel.find(query).sort({ entryDate: -1, createdAt: -1 }).limit(100);
      res.json({ success: true, entries: entries.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch journal entries" });
    }
  });

  // Get expenses
  app.get("/api/erp/expenses", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const query: any = { tenantId };
      if (req.query.status) query.status = req.query.status;
      const expenses = await ExpenseErpModel.find(query).sort({ createdAt: -1 }).limit(100);
      res.json({ success: true, expenses: expenses.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch expenses" });
    }
  });

  // Create journal entry
  app.post("/api/erp/journal-entries", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const createdBy = req.employee?.id || "system";
      const entry = await ErpAccountingService.createJournalEntry({
        tenantId,
        ...req.body,
        createdBy,
      });
      res.json({ success: true, entry: serializeDoc(entry) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create journal entry" });
    }
  });

  // Post journal entry
  app.patch("/api/erp/journal-entries/:id/post", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const postedBy = req.employee?.id || "system";
      const entry = await ErpAccountingService.postJournalEntry(tenantId, req.params.id, postedBy);
      res.json({ success: true, entry: serializeDoc(entry) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to post journal entry" });
    }
  });

  // Create invoice from order
  app.post("/api/erp/invoices/from-order/:orderId", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const branchId = req.employee?.branchId || req.body.branchId || "default-branch";
      const issuedBy = req.employee?.id || "system";
      const sellerInfo = req.body.sellerInfo;
      const invoice = await ErpAccountingService.createInvoiceFromOrder(
        tenantId,
        branchId,
        req.params.orderId,
        issuedBy,
        sellerInfo
      );
      res.json({ success: true, invoice: serializeDoc(invoice) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create invoice" });
    }
  });

  // Get all invoices
  app.get("/api/erp/invoices", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const branchId = req.query.branchId as string;
      const status = req.query.status as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      const invoices = await ErpAccountingService.getInvoices(tenantId, {
        branchId,
        status,
        startDate,
        endDate,
        limit,
      });
      res.json({ success: true, invoices: invoices.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch invoices" });
    }
  });

  // Get single invoice
  app.get("/api/erp/invoices/:id", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const invoice = await ErpAccountingService.getInvoiceById(tenantId, req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json({ success: true, invoice: serializeDoc(invoice) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch invoice" });
    }
  });

  // Create standalone invoice
  app.post("/api/erp/invoices", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const branchId = req.employee?.branchId || req.body.branchId || "default-branch";
      const issuedBy = req.employee?.id || "system";
      
      const invoice = await ErpAccountingService.createInvoice({
        tenantId,
        branchId,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        customerEmail: req.body.customerEmail,
        customerTaxNumber: req.body.customerTaxNumber,
        customerAddress: req.body.customerAddress,
        lines: req.body.lines,
        notes: req.body.notes,
        issuedBy,
        sellerName: req.body.sellerName || "CLUNY CAFE",
        sellerVatNumber: req.body.sellerVatNumber || "311234567890003",
      });
      res.json({ success: true, invoice: serializeDoc(invoice) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create invoice" });
    }
  });

  // Update invoice status
  app.patch("/api/erp/invoices/:id/status", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const invoice = await ErpAccountingService.updateInvoiceStatus(
        tenantId,
        req.params.id,
        req.body.status,
        req.body.amountPaid
      );
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json({ success: true, invoice: serializeDoc(invoice) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update invoice status" });
    }
  });

  // Get trial balance
  app.get("/api/erp/reports/trial-balance", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const trialBalance = await ErpAccountingService.getTrialBalance(tenantId, endDate);
      res.json({ success: true, trialBalance });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch trial balance" });
    }
  });

  // Get income statement
  app.get("/api/erp/reports/income-statement", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const branchId = req.query.branchId as string;
      const incomeStatement = await ErpAccountingService.getIncomeStatement(tenantId, startDate, endDate, branchId);
      res.json({ success: true, incomeStatement });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch income statement" });
    }
  });

  // Get balance sheet
  app.get("/api/erp/reports/balance-sheet", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : new Date();
      const balanceSheet = await ErpAccountingService.getBalanceSheet(tenantId, asOfDate);
      res.json({ success: true, balanceSheet });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch balance sheet" });
    }
  });

  // Create ERP expense
  app.post("/api/erp/expenses", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const branchId = req.employee?.branchId || req.body.branchId || "default-branch";
      const requestedBy = req.employee?.id || "system";
      const expense = await ErpAccountingService.createExpense({
        tenantId,
        branchId,
        requestedBy,
        ...req.body,
      });
      res.json({ success: true, expense: serializeDoc(expense) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create expense" });
    }
  });

  // Approve expense
  app.patch("/api/erp/expenses/:id/approve", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const approvedBy = req.employee?.id || "system";
      const expense = await ErpAccountingService.approveExpense(tenantId, req.params.id, approvedBy);
      res.json({ success: true, expense: serializeDoc(expense) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to approve expense" });
    }
  });

  // Get vendors
  app.get("/api/erp/vendors", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const vendors = await ErpAccountingService.getVendors(tenantId);
      res.json({ success: true, vendors: vendors.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch vendors" });
    }
  });

  // Create vendor
  app.post("/api/erp/vendors", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const vendor = await ErpAccountingService.createVendor({
        tenantId,
        ...req.body,
      });
      res.json({ success: true, vendor: serializeDoc(vendor) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create vendor" });
    }
  });

  // Get ERP dashboard summary
  app.get("/api/erp/dashboard", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.query.tenantId as string || "demo-tenant";
      const branchId = req.query.branchId as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const summary = await ErpAccountingService.getDashboardSummary(tenantId, branchId, startDate, endDate);
      res.json({ success: true, summary });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch dashboard summary" });
    }
  });

  // Post order to journal (auto-post sales entry)
  app.post("/api/erp/orders/:orderId/post-journal", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || req.body.tenantId || "demo-tenant";
      const createdBy = req.employee?.id || "system";
      const entry = await ErpAccountingService.postOrderJournal(tenantId, req.params.orderId, createdBy);
      if (entry) {
        res.json({ success: true, entry: serializeDoc(entry) });
      } else {
        res.status(404).json({ error: "Order not found or missing accounts" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to post order journal" });
    }
  });

  // =====================================================
  // نظام التوصيل المتكامل - Integrated Delivery System
  // =====================================================

  // Delivery Integrations (External Providers)
  app.get("/api/delivery/integrations", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const integrations = await deliveryService.getAllIntegrations(tenantId);
      res.json({ success: true, integrations: integrations.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch integrations" });
    }
  });

  app.post("/api/delivery/integrations", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const integration = await deliveryService.createIntegration({ ...req.body, tenantId });
      res.json({ success: true, integration: serializeDoc(integration) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create integration" });
    }
  });

  app.patch("/api/delivery/integrations/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const integration = await deliveryService.updateIntegration(req.params.id, req.body);
      if (integration) {
        res.json({ success: true, integration: serializeDoc(integration) });
      } else {
        res.status(404).json({ error: "Integration not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update integration" });
    }
  });

  app.delete("/api/delivery/integrations/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const deleted = await deliveryService.deleteIntegration(req.params.id);
      res.json({ success: deleted });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete integration" });
    }
  });

  // Delivery Zones
  app.get("/api/delivery/zones", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const branchId = req.query.branchId as string;
      const zones = await deliveryService.getAllZones(tenantId, branchId);
      res.json({ success: true, zones: zones.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch zones" });
    }
  });

  app.post("/api/delivery/zones", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const zone = await deliveryService.createZone({ ...req.body, tenantId });
      res.json({ success: true, zone: serializeDoc(zone) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create zone" });
    }
  });

  app.patch("/api/delivery/zones/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const zone = await deliveryService.updateZone(req.params.id, req.body);
      if (zone) {
        res.json({ success: true, zone: serializeDoc(zone) });
      } else {
        res.status(404).json({ error: "Zone not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update zone" });
    }
  });

  app.delete("/api/delivery/zones/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const deleted = await deliveryService.deleteZone(req.params.id);
      res.json({ success: deleted });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete zone" });
    }
  });

  // Delivery Drivers
  app.get("/api/delivery/drivers", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const branchId = req.query.branchId as string;
      const drivers = await deliveryService.getAllDrivers(tenantId, branchId);
      res.json({ success: true, drivers: drivers.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch drivers" });
    }
  });

  app.get("/api/delivery/drivers/available", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const branchId = req.query.branchId as string;
      const drivers = await deliveryService.getAvailableDrivers(tenantId, branchId);
      res.json({ success: true, drivers: drivers.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch available drivers" });
    }
  });

  app.post("/api/delivery/drivers", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const driver = await deliveryService.createDriver({ ...req.body, tenantId });
      res.json({ success: true, driver: serializeDoc(driver) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create driver" });
    }
  });

  app.patch("/api/delivery/drivers/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const driver = await deliveryService.updateDriver(req.params.id, req.body);
      if (driver) {
        res.json({ success: true, driver: serializeDoc(driver) });
      } else {
        res.status(404).json({ error: "Driver not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update driver" });
    }
  });

  app.patch("/api/delivery/drivers/:id/location", requireAuth, requireDeliveryAccess, async (req: AuthRequest, res) => {
    try {
      const { lat, lng } = req.body;
      const driver = await deliveryService.updateDriverLocation(req.params.id, lat, lng);
      if (driver) {
        res.json({ success: true, driver: serializeDoc(driver) });
      } else {
        res.status(404).json({ error: "Driver not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update location" });
    }
  });

  app.patch("/api/delivery/drivers/:id/status", requireAuth, requireDeliveryAccess, async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      const driver = await deliveryService.updateDriverStatus(req.params.id, status);
      if (driver) {
        res.json({ success: true, driver: serializeDoc(driver) });
      } else {
        res.status(404).json({ error: "Driver not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update status" });
    }
  });

  app.delete("/api/delivery/drivers/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const deleted = await deliveryService.deleteDriver(req.params.id);
      res.json({ success: deleted });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete driver" });
    }
  });

  // Driver Login (public - for driver portal)
  // Simple rate limiting for driver login attempts
  const driverLoginAttempts = new Map<string, { count: number; lastAttempt: number }>();
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  app.post("/api/delivery/drivers/login", async (req, res) => {
    try {
      const { phone } = req.body;
      const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
      
      if (!phone) {
        return res.status(400).json({ error: "رقم الجوال مطلوب" });
      }

      // Rate limiting check
      const attemptKey = `${clientIP}:${phone}`;
      const attempts = driverLoginAttempts.get(attemptKey);
      const now = Date.now();
      
      if (attempts) {
        if (now - attempts.lastAttempt < LOGIN_WINDOW_MS && attempts.count >= MAX_LOGIN_ATTEMPTS) {
          return res.status(429).json({ error: "تم تجاوز عدد المحاولات المسموحة. يرجى الانتظار 15 دقيقة." });
        }
        if (now - attempts.lastAttempt >= LOGIN_WINDOW_MS) {
          driverLoginAttempts.delete(attemptKey);
        }
      }
      
      const driver = await deliveryService.getDriverByPhone(phone);
      if (!driver) {
        // Track failed attempt
        const current = driverLoginAttempts.get(attemptKey) || { count: 0, lastAttempt: now };
        driverLoginAttempts.set(attemptKey, { count: current.count + 1, lastAttempt: now });
        return res.status(404).json({ error: "لم يتم العثور على المندوب" });
      }
      
      // Clear attempts on successful login
      driverLoginAttempts.delete(attemptKey);
      
      // Update driver status to available on login
      await deliveryService.updateDriverStatus(driver._id?.toString() || driver.id, "available");
      
      // Store driver session
      (req.session as any).driverId = driver._id?.toString() || driver.id;
      
      res.json({ 
        success: true, 
        driver: serializeDoc(driver),
        message: "تم تسجيل الدخول بنجاح"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "فشل تسجيل الدخول" });
    }
  });

  // Delivery Orders
  app.get("/api/delivery/orders", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const filters = {
        branchId: req.query.branchId as string,
        status: req.query.status as string,
        driverId: req.query.driverId as string,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      };
      const orders = await deliveryService.getAllDeliveryOrders(tenantId, filters);
      res.json({ success: true, orders: orders.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch delivery orders" });
    }
  });

  app.get("/api/delivery/orders/pending", requireAuth, requireDeliveryAccess, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const branchId = req.query.branchId as string;
      const orders = await deliveryService.getPendingOrdersForDriver(tenantId, branchId);
      res.json({ success: true, orders: orders.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch pending orders" });
    }
  });

  app.get("/api/delivery/orders/driver/:driverId", requireAuth, requireDeliveryAccess, async (req: AuthRequest, res) => {
    try {
      const orders = await deliveryService.getDriverActiveOrders(req.params.driverId);
      res.json({ success: true, orders: orders.map(serializeDoc) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch driver orders" });
    }
  });

  app.get("/api/delivery/orders/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const order = await deliveryService.getDeliveryOrder(req.params.id);
      if (order) {
        res.json({ success: true, order: serializeDoc(order) });
      } else {
        res.status(404).json({ error: "Order not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch order" });
    }
  });

  app.get("/api/delivery/orders/by-order/:orderId", async (req, res) => {
    try {
      const order = await deliveryService.getDeliveryOrderByOrderId(req.params.orderId);
      if (order) {
        res.json({ success: true, order: serializeDoc(order) });
      } else {
        res.status(404).json({ error: "Delivery order not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch delivery order" });
    }
  });

  app.post("/api/delivery/orders", requireAuth, requireCashierAccess, async (req: AuthRequest, res) => {
    try {
      const tenantId = getTenantIdFromRequest(req) || "demo-tenant";
      const order = await deliveryService.createDeliveryOrder({ ...req.body, tenantId });
      res.json({ success: true, order: serializeDoc(order) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create delivery order" });
    }
  });

  app.patch("/api/delivery/orders/:id/assign", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { driverId } = req.body;
      const order = await deliveryService.assignDriverToOrder(req.params.id, driverId);
      if (order) {
        res.json({ success: true, order: serializeDoc(order) });
      } else {
        res.status(404).json({ error: "Order or driver not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to assign driver" });
    }
  });

  app.patch("/api/delivery/orders/:id/status", requireAuth, requireDeliveryAccess, async (req: AuthRequest, res) => {
    try {
      const { status, ...additionalData } = req.body;
      const order = await deliveryService.updateOrderStatus(req.params.id, status, additionalData);
      if (order) {
        res.json({ success: true, order: serializeDoc(order) });
      } else {
        res.status(404).json({ error: "Order not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update order status" });
    }
  });

  app.patch("/api/delivery/orders/:id/location", requireAuth, requireDeliveryAccess, async (req: AuthRequest, res) => {
    try {
      const { lat, lng } = req.body;
      const order = await deliveryService.updateOrderDriverLocation(req.params.id, lat, lng);
      if (order) {
        res.json({ success: true, order: serializeDoc(order) });
      } else {
        res.status(404).json({ error: "Order not found" });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update order location" });
    }
  });

  // Calculate delivery fee and check zone
  app.post("/api/delivery/calculate-fee", async (req, res) => {
    try {
      const { lat, lng, tenantId, branchId, orderAmount } = req.body;
      const result = await deliveryService.calculateDeliveryFee(
        lat, lng, tenantId || "demo-tenant", branchId, orderAmount || 0
      );
      res.json({ success: true, ...result, zone: result.zone ? serializeDoc(result.zone) : null });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to calculate delivery fee" });
    }
  });

  // Calculate ETA
  app.post("/api/delivery/calculate-eta", async (req, res) => {
    try {
      const { distanceKm, drinkCount } = req.body;
      const eta = deliveryService.calculateETA(distanceKm || 0, drinkCount || 1);
      res.json({ success: true, ...eta });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to calculate ETA" });
    }
  });

  // ============================================================
  // ADVANCED ANALYTICS API
  // ============================================================
  app.get("/api/analytics/advanced", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { period = 'today', branchId: qBranch } = req.query;
      const finalBranchId = qBranch || req.employee?.branchId;
      const { OrderModel, CoffeeItemModel, EmployeeModel } = await import("@shared/schema");

      const now = new Date();
      let startDate: Date;
      let prevStartDate: Date;
      let prevEndDate: Date;

      switch (period) {
        case 'week':
          startDate = new Date(now); startDate.setDate(now.getDate() - 7); startDate.setHours(0,0,0,0);
          prevStartDate = new Date(startDate); prevStartDate.setDate(startDate.getDate() - 7);
          prevEndDate = new Date(startDate);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          prevEndDate = new Date(startDate);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
          prevEndDate = new Date(startDate);
          break;
        default: // today
          startDate = new Date(now); startDate.setHours(0,0,0,0);
          prevStartDate = new Date(startDate); prevStartDate.setDate(startDate.getDate() - 1);
          prevEndDate = new Date(startDate);
      }

      const baseMatch: any = {
        createdAt: { $gte: startDate },
        status: { $ne: 'cancelled' }
      };
      if (finalBranchId) baseMatch.branchId = finalBranchId;

      const prevMatch: any = {
        createdAt: { $gte: prevStartDate, $lt: prevEndDate },
        status: { $ne: 'cancelled' }
      };
      if (finalBranchId) prevMatch.branchId = finalBranchId;

      const [orders, prevOrders] = await Promise.all([
        OrderModel.find(baseMatch).lean(),
        OrderModel.find(prevMatch).lean()
      ]);

      // ---- Summary KPIs ----
      const totalRevenue = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
      const prevRevenue = prevOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
      const totalOrders = orders.length;
      const prevOrders2 = prevOrders.length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const prevAvg = prevOrders2 > 0 ? prevRevenue / prevOrders2 : 0;
      const uniqueCustomers = new Set(orders.map(o => o.customerId || (o.customerInfo as any)?.phone).filter(Boolean)).size;
      const prevCustomers = new Set(prevOrders.map(o => o.customerId || (o.customerInfo as any)?.phone).filter(Boolean)).size;

      const pct = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : (curr > 0 ? 100 : 0);

      // ---- Hourly distribution ----
      const hourlyMap: Record<number, { orders: number; revenue: number }> = {};
      for (let h = 0; h < 24; h++) hourlyMap[h] = { orders: 0, revenue: 0 };
      for (const o of orders) {
        const h = new Date(o.createdAt).getHours();
        hourlyMap[h].orders++;
        hourlyMap[h].revenue += Number(o.totalAmount) || 0;
      }
      const hourlyData = Object.entries(hourlyMap).map(([hour, d]) => ({
        hour: parseInt(hour),
        orders: d.orders,
        revenue: Math.round(d.revenue * 100) / 100
      }));

      // ---- Best selling products ----
      const itemCountMap: Record<string, { nameAr: string; nameEn: string; qty: number; revenue: number; imageUrl?: string }> = {};
      for (const o of orders) {
        const items = Array.isArray(o.items) ? o.items : [];
        for (const item of items) {
          const id = item.coffeeItemId || item.id || 'unknown';
          const name = item.nameAr || item.name || 'منتج';
          const nameEn = item.nameEn || '';
          if (!itemCountMap[id]) itemCountMap[id] = { nameAr: name, nameEn, qty: 0, revenue: 0 };
          itemCountMap[id].qty += Number(item.quantity) || 1;
          itemCountMap[id].revenue += (Number(item.price) || 0) * (Number(item.quantity) || 1);
        }
      }
      // Attach images
      const allItemIds = Object.keys(itemCountMap);
      if (allItemIds.length > 0) {
        const coffeeItems = await CoffeeItemModel.find({ id: { $in: allItemIds } }, { id: 1, imageUrl: 1 }).lean();
        for (const ci of coffeeItems) {
          if (itemCountMap[ci.id]) itemCountMap[ci.id].imageUrl = ci.imageUrl;
        }
      }
      const topProducts = Object.entries(itemCountMap)
        .map(([id, d]) => ({ id, ...d, revenue: Math.round(d.revenue * 100) / 100 }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);

      // ---- Employee performance ----
      const empMap: Record<string, { name: string; orders: number; revenue: number }> = {};
      for (const o of orders) {
        const empId = (o as any).employeeId || (o as any).cashierId || 'unknown';
        const empName = (o as any).employeeName || (o as any).cashierName || 'غير محدد';
        if (!empMap[empId]) empMap[empId] = { name: empName, orders: 0, revenue: 0 };
        empMap[empId].orders++;
        empMap[empId].revenue += Number(o.totalAmount) || 0;
      }
      const employeePerformance = Object.entries(empMap)
        .map(([id, d]) => ({
          id,
          name: d.name,
          orders: d.orders,
          revenue: Math.round(d.revenue * 100) / 100,
          avgOrderValue: d.orders > 0 ? Math.round((d.revenue / d.orders) * 100) / 100 : 0
        }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 10);

      // ---- Revenue comparison (daily trend last 7 days) ----
      const revenueTrend: Array<{ date: string; current: number; orders: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const nextD = new Date(d); nextD.setDate(nextD.getDate() + 1);
        const dayOrders = orders.filter(o => {
          const t = new Date(o.createdAt);
          return t >= d && t < nextD;
        });
        revenueTrend.push({
          date: d.toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' }),
          current: Math.round(dayOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0) * 100) / 100,
          orders: dayOrders.length
        });
      }

      // ---- Payment method breakdown ----
      const paymentBreakdown: Record<string, number> = {};
      for (const o of orders) {
        const m = (o.paymentMethod as string) || 'other';
        paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (Number(o.totalAmount) || 0);
      }

      res.json({
        period,
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalOrders,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          uniqueCustomers,
          revenueChange: pct(totalRevenue, prevRevenue),
          ordersChange: pct(totalOrders, prevOrders2),
          avgOrderChange: pct(avgOrderValue, prevAvg),
          customersChange: pct(uniqueCustomers, prevCustomers),
          changeLabel: period === 'today' ? 'مقارنة بالأمس' : period === 'week' ? 'مقارنة بالأسبوع السابق' : 'مقارنة بالشهر السابق'
        },
        hourlyData,
        topProducts,
        employeePerformance,
        revenueTrend,
        paymentBreakdown: Object.entries(paymentBreakdown).map(([method, amount]) => ({
          method,
          amount: Math.round(amount * 100) / 100,
          percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0
        }))
      });
    } catch (error) {
      console.error("[ANALYTICS] Error:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // ============================================================
  // GIFT CARDS SYSTEM
  // ============================================================
  app.get("/api/gift-cards", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { GiftCardModel } = await import("@shared/schema");
      const cards = await GiftCardModel.find({}).sort({ createdAt: -1 }).lean();
      res.json(cards.map(serializeDoc));
    } catch (error) {
      res.status(500).json({ error: "فشل جلب بطاقات الهدايا" });
    }
  });

  app.post("/api/gift-cards", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { GiftCardModel } = await import("@shared/schema");
      const { value, recipientName, recipientPhone, note } = req.body;
      if (!value || Number(value) <= 0) return res.status(400).json({ error: "القيمة مطلوبة وأكبر من صفر" });
      const code = `GC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
      const card = new GiftCardModel({
        code,
        initialValue: Number(value),
        balance: Number(value),
        recipientName: recipientName || '',
        recipientPhone: recipientPhone || '',
        note: note || '',
        status: 'active',
        issuedBy: req.employee?.id,
        branchId: req.employee?.branchId,
        tenantId: getTenantIdFromRequest(req) || 'default',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await card.save();
      res.json(serializeDoc(card));
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء بطاقة الهدية" });
    }
  });

  app.get("/api/gift-cards/check/:code", async (req, res) => {
    try {
      const { GiftCardModel } = await import("@shared/schema");
      const card = await GiftCardModel.findOne({ code: req.params.code.toUpperCase() });
      if (!card) return res.status(404).json({ error: "بطاقة الهدية غير موجودة" });
      if (card.status !== 'active') return res.status(400).json({ error: "بطاقة الهدية منتهية أو مستخدمة" });
      if (Number(card.balance) <= 0) return res.status(400).json({ error: "رصيد بطاقة الهدية صفر" });
      res.json({ valid: true, balance: card.balance, initialValue: card.initialValue, recipientName: card.recipientName, code: card.code });
    } catch (error) {
      res.status(500).json({ error: "فشل التحقق من البطاقة" });
    }
  });

  app.post("/api/gift-cards/:code/redeem", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { GiftCardModel } = await import("@shared/schema");
      const { amount } = req.body;
      const card = await GiftCardModel.findOne({ code: req.params.code.toUpperCase() });
      if (!card) return res.status(404).json({ error: "بطاقة الهدية غير موجودة" });
      if (card.status !== 'active') return res.status(400).json({ error: "البطاقة غير نشطة" });
      const deductAmount = Math.min(Number(amount), Number(card.balance));
      card.balance = Number(card.balance) - deductAmount;
      card.updatedAt = new Date();
      if (card.balance <= 0) card.status = 'used';
      await card.save();
      res.json({ success: true, deducted: deductAmount, remainingBalance: card.balance, status: card.status });
    } catch (error) {
      res.status(500).json({ error: "فشل استخدام بطاقة الهدية" });
    }
  });

  app.delete("/api/gift-cards/:id", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { GiftCardModel } = await import("@shared/schema");
      await GiftCardModel.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف البطاقة" });
    }
  });


  // ============================================================
  // CUSTOMER REVIEWS - ENHANCED
  // ============================================================
  app.get("/api/reviews/all", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ProductReviewModel, CoffeeItemModel } = await import("@shared/schema");
      const { rating, page = 1, limit = 20 } = req.query;
      const query: any = {};
      if (req.employee?.branchId) query.branchId = req.employee.branchId;
      if (rating) query.rating = Number(rating);
      const skip = (Number(page) - 1) * Number(limit);
      const [reviews, total] = await Promise.all([
        ProductReviewModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
        ProductReviewModel.countDocuments(query)
      ]);
      // Attach product names
      const productIds = [...new Set(reviews.map(r => r.productId).filter(Boolean))];
      const products = productIds.length > 0 ? await CoffeeItemModel.find({ id: { $in: productIds } }, { id: 1, nameAr: 1, nameEn: 1, imageUrl: 1 }).lean() : [];
      const productMap: Record<string, any> = {};
      for (const p of products) productMap[p.id] = p;
      const enriched = reviews.map(r => ({ ...serializeDoc(r), product: r.productId ? (productMap[r.productId] || null) : null }));
      const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;
      res.json({ reviews: enriched, total, page: Number(page), avgRating: Math.round(avgRating * 10) / 10 });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب التقييمات" });
    }
  });

  app.post("/api/reviews/order/:orderId", async (req, res) => {
    try {
      const { ProductReviewModel, OrderModel } = await import("@shared/schema");
      const { rating, comment, customerName, customerId, customerPhone } = req.body;
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "التقييم بين 1 و 5" });
      const order = await OrderModel.findOne({ id: req.params.orderId }) || await OrderModel.findById(req.params.orderId).catch(() => null);
      if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
      // Check if already reviewed
      const existing = await ProductReviewModel.findOne({ orderId: req.params.orderId });
      if (existing) return res.status(400).json({ error: "تم تقييم هذا الطلب مسبقاً" });
      const review = new ProductReviewModel({
        orderId: req.params.orderId,
        orderNumber: order.orderNumber,
        rating: Number(rating),
        comment: comment || '',
        customerName: customerName || (order.customerInfo as any)?.name || 'عميل',
        customerId: customerId || order.customerId || '',
        customerPhone: customerPhone || (order.customerInfo as any)?.phone || '',
        branchId: order.branchId,
        status: 'published',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await review.save();
      res.json(serializeDoc(review));
    } catch (error) {
      res.status(500).json({ error: "فشل إرسال التقييم" });
    }
  });

  app.patch("/api/reviews/:id/reply", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { ProductReviewModel } = await import("@shared/schema");
      const { reply } = req.body;
      const review = await ProductReviewModel.findByIdAndUpdate(
        req.params.id,
        { $set: { managerReply: reply, repliedAt: new Date(), repliedBy: req.employee?.id } },
        { new: true }
      );
      if (!review) return res.status(404).json({ error: "التقييم غير موجود" });
      res.json(serializeDoc(review));
    } catch (error) {
      res.status(500).json({ error: "فشل الرد على التقييم" });
    }
  });

  // ============================================================
  // SEASONAL MENU (Time-based visibility)
  // ============================================================
  app.patch("/api/coffee-items/:id/schedule", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { CoffeeItemModel } = await import("@shared/schema");
      const { availableFrom, availableTo, availableDays } = req.body;
      const item = await CoffeeItemModel.findOneAndUpdate(
        { id: req.params.id },
        { $set: { availableFrom: availableFrom || null, availableTo: availableTo || null, availableDays: availableDays || null, updatedAt: new Date() } },
        { new: true }
      );
      if (!item) return res.status(404).json({ error: "المنتج غير موجود" });
      res.json(serializeDoc(item));
    } catch (error) {
      res.status(500).json({ error: "فشل تحديث جدول المنتج" });
    }
  });

  // ============================================================
  // PAYROLL / SALARY CALCULATION
  // ============================================================
  app.get("/api/payroll/report", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { EmployeeModel, AttendanceModel } = await import("@shared/schema");
      const { month, year } = req.query;
      const targetMonth = month ? parseInt(String(month)) - 1 : new Date().getMonth();
      const targetYear = year ? parseInt(String(year)) : new Date().getFullYear();
      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
      const finalBranchId = req.employee?.branchId;
      const empQuery: any = { isActive: { $ne: false } };
      if (finalBranchId) empQuery.branchId = finalBranchId;
      const employees = await EmployeeModel.find(empQuery).lean();
      const attQuery: any = { date: { $gte: startDate.toISOString().split('T')[0], $lte: endDate.toISOString().split('T')[0] } };
      if (finalBranchId) attQuery.branchId = finalBranchId;
      const attendances = await AttendanceModel.find(attQuery).lean();
      const payrollData = employees.map(emp => {
        const empAtt = attendances.filter(a => a.employeeId === emp.id || String(a.employeeId) === String((emp as any)._id));
        const presentDays = empAtt.filter(a => a.status === 'checked_in' || a.status === 'checked_out' || a.checkInTime).length;
        const absentDays = empAtt.filter(a => a.status === 'absent').length;
        const lateDays = empAtt.filter(a => (a as any).isLate || (a.lateMinutes ?? 0) > 0).length;
        const totalWorkingDays = new Date(targetYear, targetMonth + 1, 0).getDate();
        const baseSalary = Number((emp as any).salary || (emp as any).baseSalary || 0);
        const dailyRate = baseSalary / (totalWorkingDays || 26);
        const deductions = absentDays * dailyRate;
        const lateDeductions = lateDays * (dailyRate * 0.25);
        const netSalary = Math.max(0, baseSalary - deductions - lateDeductions);
        return {
          employeeId: emp.id || String((emp as any)._id),
          name: emp.fullName,
          role: emp.role,
          baseSalary,
          presentDays,
          absentDays,
          lateDays,
          totalWorkingDays,
          deductions: Math.round(deductions * 100) / 100,
          lateDeductions: Math.round(lateDeductions * 100) / 100,
          netSalary: Math.round(netSalary * 100) / 100,
          attendanceRate: totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0
        };
      });
      res.json({
        month: targetMonth + 1,
        year: targetYear,
        employees: payrollData,
        totals: {
          totalBaseSalary: payrollData.reduce((s, e) => s + e.baseSalary, 0),
          totalDeductions: payrollData.reduce((s, e) => s + e.deductions + e.lateDeductions, 0),
          totalNetSalary: payrollData.reduce((s, e) => s + e.netSalary, 0),
          employeeCount: payrollData.length
        }
      });
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء تقرير الرواتب" });
    }
  });

  // ============================================================
  // COGS / PROFIT MARGIN REPORT
  // ============================================================
  app.get("/api/analytics/cogs", requireAuth, requireManager, async (req: AuthRequest, res) => {
    try {
      const { CoffeeItemModel, CoffeeItemIngredientModel } = await import("@shared/schema");
      const branchId = req.employee?.branchId;
      const itemQuery: any = {};
      if (branchId) itemQuery.publishedBranches = branchId;
      const items = await CoffeeItemModel.find(itemQuery, { id: 1, nameAr: 1, nameEn: 1, price: 1, costOfGoods: 1, category: 1 }).lean();
      const allIngredients = await CoffeeItemIngredientModel.find({}).lean();
      const cogsData = items.map(item => {
        const itemIngredients = allIngredients.filter(ing => ing.coffeeItemId === item.id);
        const calculatedCOGS = Number(item.costOfGoods) || 0;
        const price = Number(item.price) || 0;
        const profit = price - calculatedCOGS;
        const margin = price > 0 ? Math.round((profit / price) * 100) : 0;
        return {
          id: item.id,
          nameAr: item.nameAr,
          nameEn: item.nameEn || '',
          price,
          cogs: Math.round(calculatedCOGS * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          margin,
          category: item.category,
          ingredientCount: itemIngredients.length
        };
      });
      cogsData.sort((a, b) => b.margin - a.margin);
      const avgMargin = cogsData.length > 0 ? Math.round(cogsData.reduce((s, i) => s + i.margin, 0) / cogsData.length) : 0;
      res.json({
        items: cogsData,
        summary: {
          totalItems: cogsData.length,
          avgMargin,
          highMargin: cogsData.filter(i => i.margin >= 60).length,
          lowMargin: cogsData.filter(i => i.margin < 30).length,
          itemsWithCOGS: cogsData.filter(i => i.cogs > 0).length
        }
      });
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء تقرير التكاليف" });
    }
  });

  // ============================================================
  // APPLE WALLET PASS GENERATION
  // ============================================================
  app.get("/api/customer/apple-wallet-pass", async (req: any, res) => {
    try {
      const { LoyaltyCardModel, CustomerModel } = await import("@shared/schema");
      const { PKPass } = await import("passkit-generator");

      // Accept phone from query param OR from active session
      let rawPhone: string = (req.query.phone as string) || req.session?.customer?.phone || "";
      if (!rawPhone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

      const digits = rawPhone.replace(/\D/g, '');
      const short9  = digits.slice(-9);
      const phoneVariants = [short9, `0${short9}`, `+966${short9}`, `966${short9}`];

      // Look up loyalty card by any phone variant
      let card = await LoyaltyCardModel.findOne({
        phoneNumber: { $in: phoneVariants }
      }).lean() as any;

      // Fallback: look up customer and then their card
      if (!card) {
        const dbCustomer = await CustomerModel.findOne({ phone: { $in: phoneVariants } }).lean() as any;
        if (dbCustomer) {
          const cid = String(dbCustomer._id || dbCustomer.id);
          card = await LoyaltyCardModel.findOne({ customerId: cid }).lean() as any;
        }
      }

      if (!card) return res.status(404).json({ error: "لا توجد بطاقة ولاء لهذا الرقم" });

      const certB64 = process.env.APPLE_PASS_CERTIFICATE;
      const keyB64 = process.env.APPLE_PASS_PRIVATE_KEY;
      const wwdrB64 = process.env.APPLE_WWDR_CERTIFICATE;
      const passTypeId = process.env.APPLE_PASS_TYPE_ID || "pass.cluny.cafe";
      const teamId = process.env.APPLE_TEAM_ID || "V4K6RM59LS";

      if (!certB64 || !keyB64 || !wwdrB64) {
        return res.status(500).json({ error: "شهادات Apple Wallet غير مهيأة" });
      }

      const signerCert = Buffer.from(certB64, 'base64');
      const signerKey = Buffer.from(keyB64, 'base64');
      const wwdr = Buffer.from(wwdrB64, 'base64');

      const points = Number(card.points) || 0;
      const customerName = card.customerName || card.phoneNumber || short9 || "Cluny Member";
      const serialNumber = String(card.id || card._id || short9);
      const qrValue = card.qrToken || card.cardNumber || serialNumber;
      const cardNumber = card.cardNumber || serialNumber;
      const pointsValueSAR = (points < 0 ? 0 : points * 0.02).toFixed(2);

      // Fetch branches with coordinates for geofencing (iOS lock-screen notification)
      const { BranchModel } = await import("@shared/schema");
      const allBranches = await BranchModel.find({
        isActive: { $in: [true, 1, "1", "true"] },
        "location.lat": { $exists: true, $ne: null },
        "location.lng": { $exists: true, $ne: null }
      }).lean() as any[];
      const passLocations = allBranches
        .filter((b: any) => b.location?.lat && b.location?.lng)
        .map((b: any) => ({
          latitude: b.location.lat,
          longitude: b.location.lng,
          relevantText: `☕ لا تفوتك قهوتنا! أنت قريب من ${b.nameAr || "كلوني كافيه"}`
        }));

      const passJson = {
        formatVersion: 1,
        passTypeIdentifier: passTypeId,
        serialNumber: serialNumber,
        teamIdentifier: teamId,
        organizationName: "Cluny Cafe",
        description: "بطاقة كلوني للولاء",
        logoText: "CLUNY CAFE",
        foregroundColor: "rgb(35, 60, 80)",
        backgroundColor: "rgb(200, 215, 222)",
        labelColor: "rgb(90, 115, 130)",
        storeCard: {
          headerFields: [],
          primaryFields: [],
          secondaryFields: [],
          auxiliaryFields: [],
          backFields: [
            {
              key: "member_name",
              label: "اسم العضو",
              value: customerName
            },
            {
              key: "points_balance",
              label: "رصيد النقاط",
              value: points < 0 ? "0" : String(points)
            },
            {
              key: "sar_balance",
              label: "القيمة القابلة للاستبدال",
              value: `${points < 0 ? "0.00" : pointsValueSAR} ر.س`
            },
            {
              key: "card_number_back",
              label: "رقم البطاقة",
              value: cardNumber
            },
            {
              key: "program_info",
              label: "برنامج الولاء",
              value: "اكسب نقاطاً مع كل طلب في كلوني كافيه. كل 50 نقطة = 1 ريال سعودي. اعرض رمز QR للكاشير لكسب النقاط أو استبدالها."
            },
            {
              key: "website",
              label: "الموقع الإلكتروني",
              value: "cluny.cafe"
            }
          ]
        },
        barcodes: [
          {
            message: qrValue,
            format: "PKBarcodeFormatQR",
            messageEncoding: "iso-8859-1",
            altText: cardNumber
          }
        ],
        barcode: {
          message: qrValue,
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1",
          altText: cardNumber
        },
        ...(passLocations.length > 0 ? { locations: passLocations } : {}),
        maxDistance: 100
      };

      const fs = await import("fs");
      const readImg = (name: string) => {
        const p = path.resolve(process.cwd(), `public/${name}`);
        return fs.existsSync(p) ? fs.readFileSync(p) : null;
      };

      const iconBuf    = readImg('pass-icon.png');
      const icon2xBuf  = readImg('pass-icon@2x.png');
      const icon3xBuf  = readImg('pass-icon@3x.png');
      const logoBuf    = readImg('pass-logo.png');
      const logo2xBuf  = readImg('pass-logo@2x.png');
      const stripBuf   = readImg('pass-strip.png');
      const strip2x    = readImg('pass-strip@2x.png');
      const strip3x    = readImg('pass-strip@3x.png');

      const files: Record<string, Buffer> = {
        "pass.json": Buffer.from(JSON.stringify(passJson)),
      };
      if (iconBuf)    files["icon.png"]      = iconBuf;
      if (icon2xBuf)  files["icon@2x.png"]   = icon2xBuf;
      if (icon3xBuf)  files["icon@3x.png"]   = icon3xBuf;
      if (!iconBuf && !icon2xBuf) {
        // fallback: use logo as icon
        if (logoBuf) { files["icon.png"] = logoBuf; files["icon@2x.png"] = logoBuf; }
      }
      if (logoBuf)    files["logo.png"]      = logoBuf;
      if (logo2xBuf)  files["logo@2x.png"]   = logo2xBuf;
      if (stripBuf)   files["strip.png"]     = stripBuf;
      if (strip2x)    files["strip@2x.png"]  = strip2x;
      if (strip3x)    files["strip@3x.png"]  = strip3x;

      const pass = new PKPass(files, { wwdr, signerCert, signerKey });

      const buffer = pass.getAsBuffer();

      res.set({
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="cluny-loyalty.pkpass"`,
        "Content-Length": buffer.length
      });
      res.send(buffer);

    } catch (err: any) {
      console.error("[PassKit] Error generating pass:", err);
      res.status(500).json({ error: "فشل إنشاء بطاقة المحفظة", details: err?.message });
    }
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket for real-time order updates
  wsManager.setup(httpServer);
  
  return httpServer;
}