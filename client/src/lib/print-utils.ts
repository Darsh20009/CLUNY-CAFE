import QRCode from "qrcode";
import { VAT_RATE } from "@/lib/constants";
import brand from "@/lib/brand";

// ── ZATCA QR pre-generation cache ────────────────────────────────────────────
// Key: `zatca:${orderNumber}:${total}` → SVG string
// Populated by prewarmZatcaQr() when an order is created, so printing is instant.
const _zatcaQrCache = new Map<string, string>();

/**
 * Pre-generates the ZATCA QR code in the background as soon as an order is
 * created. By the time the cashier clicks "Print", the QR is already cached
 * and buildReceiptPreviewHtml() returns instantly.
 */
export function prewarmZatcaQr(data: {
  orderNumber: string | number;
  total: string | number;
  date?: string;
  vatNumber?: string;
}): void {
  const totalAmount = typeof data.total === 'number' ? data.total : parseFloat(String(data.total).replace(/[^0-9.-]/g, '')) || 0;
  const subtotalBeforeVat = totalAmount / (1 + VAT_RATE);
  const vat = totalAmount - subtotalBeforeVat;
  const invoiceTs = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
  const cacheKey = `zatca:${data.orderNumber}:${totalAmount.toFixed(2)}`;
  if (_zatcaQrCache.has(cacheKey)) return;
  const zatcaPayload = generateZATCAQRCode({
    sellerName: COMPANY_NAME,
    vatNumber: data.vatNumber || VAT_NUMBER,
    timestamp: invoiceTs,
    totalWithVat: totalAmount.toFixed(2),
    vatAmount: vat.toFixed(2),
  });
  QRCode.toString(zatcaPayload, { type: 'svg', width: 100, margin: 1, errorCorrectionLevel: 'M' })
    .then(svgStr => {
      const svg = svgStr.replace(/<\?xml[^?]*\?>/g, '').replace(/width="\d+"/, 'width="100"').replace(/height="\d+"/, 'height="100"');
      _zatcaQrCache.set(cacheKey, svg);
    })
    .catch(() => {});
}

/**
 * Formats an order number for employee display: #0042
 * Pads the numeric part to at least 4 digits with # prefix.
 */
export function fmtOrderNum(n: string | number): string {
  const str = String(n).trim();
  // Extract only digits for padding
  const digits = str.replace(/\D/g, '');
  if (!digits) return `#${str}`;
  return `#${digits.padStart(4, '0')}`;
}

interface OrderItem {
  coffeeItem: {
    nameAr: string;
    nameEn?: string;
    price: string;
  };
  quantity: number;
  selectedSize?: string;
  itemDiscount?: number;
  customization?: {
    selectedItemAddons?: Array<{ nameAr: string; nameEn?: string; price?: number }>;
    [key: string]: any;
  };
}

/** Returns the correct unit price for an order item.
 *  Prefers a top-level `price` field (stored in DB after our fix),
 *  falls back to coffeeItem.price so old orders still display correctly. */
function getItemUnitPrice(item: OrderItem): number {
  const stored = parseNumber((item as any).price ?? (item as any).unitPrice);
  if (stored > 0) return stored;
  return parseNumber(item.coffeeItem.price);
}

/** Returns the selected size label from top-level or inside customization (employee-cashier compat). */
function getItemSelectedSize(item: OrderItem): string | undefined {
  return item.selectedSize ?? (item as any).customization?.selectedSize ?? undefined;
}

/** Returns the addons array, checking both selectedItemAddons and legacy addons array. */
function getItemAddons(item: OrderItem): Array<{ nameAr: string }> {
  if (item.customization?.selectedItemAddons?.length) return item.customization.selectedItemAddons;
  const legacyAddons = (item as any).customization?.addons;
  if (Array.isArray(legacyAddons) && legacyAddons.length) {
    return legacyAddons.map((a: any) => ({ nameAr: a.nameAr || a.name || String(a) }));
  }
  return [];
}

interface TaxInvoiceData {
  orderNumber: string;
  invoiceNumber?: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  subtotal: string;
  discount?: {
    code: string;
    percentage: number;
    amount: string;
  };
  invoiceDiscount?: number | string;
  total: string;
  paymentMethod: string;
  splitPayment?: { cash: number; card: number };
  cashReceived?: number;
  employeeName: string;
  tableNumber?: string;
  orderType?: string;
  orderTypeName?: string;
  date: string;
  branchName?: string;
  branchAddress?: string;
  crNumber?: string;
  vatNumber?: string;
  carInfo?: { carType?: string; carColor?: string; plateNumber?: string };
  carColor?: string;
  plateNumber?: string;
  notes?: string;
}

interface PrintConfig {
  paperWidth?: '58mm' | '80mm';
  autoClose?: boolean;
  autoPrint?: boolean;
  showPrintButton?: boolean;
}

interface EmployeePrintData {
  employeeName: string;
  employeeId: string;
  employmentNumber: string;
  role: string;
  phone: string;
  branchName?: string;
  qrCode?: string;
}

interface KitchenOrderData {
  orderNumber: string;
  tableNumber?: string;
  items: OrderItem[];
  notes?: string;
  priority?: 'normal' | 'urgent';
  timestamp: string;
}

// ── iframe-based print queue (never touches the main page DOM during print) ──
let _printQueue: Array<{ html: string; paperWidth: string; isFullDoc: boolean }> = [];
let _isPrinting = false;
let _printWatchdog: ReturnType<typeof setTimeout> | null = null;

function _armPrintWatchdog() {
  if (_printWatchdog) clearTimeout(_printWatchdog);
  _printWatchdog = setTimeout(() => {
    if (_isPrinting) {
      console.warn('[Print] Watchdog: print job stuck >8s — resetting queue');
      _isPrinting = false;
      _printWatchdog = null;
      if (_printQueue.length > 0) setTimeout(_drainPrintQueue, 300);
    }
  }, 8000);
}

function _clearPrintWatchdog() {
  if (_printWatchdog) { clearTimeout(_printWatchdog); _printWatchdog = null; }
}

// Detect Android to apply Android-specific print fixes
const _isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
/** Export for components that need to skip iframe creation on Android */
export const isAndroidDevice = _isAndroid;

// Arabic-compatible font stack — works without network (system fonts)
const PRINT_FONT_STACK = "'Segoe UI', Tahoma, Arial, 'Helvetica Neue', sans-serif";

// ── Android-specific: print by injecting content into the main window ──────
// On Android WebView/Chrome, ANY hidden iframe (even position:fixed;top:-9999px)
// causes the browser to recalculate the page viewport based on the iframe's
// layout width. This shrinks the entire UI to match the narrow paper width.
// The ONLY reliable fix is to not create an iframe at all on Android.
// Instead we inject the print content directly into the parent document and
// call window.print() from there, using @media print CSS to isolate it.
const _ANDROID_OVERLAY_ID = '__cluny_android_print_layer';
const _ANDROID_STYLE_ID   = '__cluny_android_print_style';

function _printAndroid(fullHtml: string): Promise<void> {
  // Clean up any stale overlay from a previous failed print
  document.getElementById(_ANDROID_OVERLAY_ID)?.remove();
  document.getElementById(_ANDROID_STYLE_ID)?.remove();

  // ── 1. Extract @page rules (must live at top-level, outside @media print) ──
  const pageRuleMatches = fullHtml.match(/@page\s*\{[^}]*\}/g) || [];
  const pageRules = pageRuleMatches.join('\n');

  // ── 2. Extract all <style> content ──────────────────────────────────────────
  const styleChunks: string[] = [];
  const htmlNoPage = fullHtml.replace(/@page\s*\{[^}]*\}/g, '');
  htmlNoPage.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_m, css: string) => {
    // strip nested @page again just in case, keep everything else
    styleChunks.push(css.replace(/@page\s*\{[^}]*\}/g, ''));
    return '';
  });

  // ── 3. Extract <body> content ───────────────────────────────────────────────
  const bodyAttr = (fullHtml.match(/<body([^>]*)>/i) || ['', ''])[1];
  const bodyContent = (fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || ['', ''])[1];

  // ── 4. Inject a hidden overlay div with the print content ───────────────────
  const overlay = document.createElement('div');
  overlay.id = _ANDROID_OVERLAY_ID;
  // dir/lang from body tag if present
  if (/dir=["']?rtl/i.test(bodyAttr)) overlay.setAttribute('dir', 'rtl');
  if (/lang=["']?ar/i.test(bodyAttr)) overlay.setAttribute('lang', 'ar');
  overlay.innerHTML = bodyContent;
  // Invisible on screen; revealed only by @media print below
  overlay.style.cssText = 'display:none!important;position:absolute;top:0;left:0;z-index:-9999;';
  document.body.appendChild(overlay);

  // ── 5. Inject @media print styles that isolate the overlay ─────────────────
  const styleEl = document.createElement('style');
  styleEl.id = _ANDROID_STYLE_ID;
  styleEl.textContent = `
    /* @page outside @media so paper size applies to the print job */
    ${pageRules}

    @media print {
      /* hide every direct child of body except our overlay */
      body > *:not(#${_ANDROID_OVERLAY_ID}) {
        display: none !important;
        visibility: hidden !important;
      }
      /* show the overlay as if it were the body */
      #${_ANDROID_OVERLAY_ID} {
        display: block !important;
        visibility: visible !important;
        position: static !important;
        top: auto !important;
        left: auto !important;
        z-index: auto !important;
      }
      /* apply the original body-level styles to the overlay */
      ${styleChunks.join('\n')}
    }
  `;
  document.head.appendChild(styleEl);

  return new Promise<void>(resolve => {
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      document.getElementById(_ANDROID_OVERLAY_ID)?.remove();
      document.getElementById(_ANDROID_STYLE_ID)?.remove();
      resolve();
    };
    // afterprint fires on some Android builds — grab it if it fires
    window.addEventListener('afterprint', cleanup, { once: true });

    // Give the browser one paint cycle before calling print()
    requestAnimationFrame(() => {
      setTimeout(() => {
        try { window.print(); } catch { cleanup(); return; }
        // ── KEY FIX ─────────────────────────────────────────────────────────
        // On many Android builds (including EZPOS) afterprint never fires, so
        // waiting for it causes a 10-second hard freeze between print jobs.
        // Instead: resolve 500 ms after window.print() returns, regardless of
        // afterprint. If window.print() was synchronous (blocking), it has
        // already completed by the time we reach this line.
        setTimeout(cleanup, 500);
      }, 0);
    });
  });
}

function _buildFullDoc(html: string, paperWidth: string): string {
  // The iframe document gets its own viewport meta so Android treats it
  // as a device-width document and does NOT resize the parent page's viewport.
  return `<!DOCTYPE html><html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    @page { size: ${paperWidth} auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 4px; font-family: ${PRINT_FONT_STACK}; direction: rtl; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    img { max-width: 100%; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

/**
 * Direct HTML print — fast, accurate, no image conversion.
 * Uses browser's native rendering engine — Arabic text renders perfectly.
 *
 * Android strategy (NO iframe):
 *   On Android WebView/Chrome any hidden iframe — even one at top:-9999px —
 *   triggers a viewport recalculation that shrinks the parent page to the
 *   iframe's content width (~220–302 px). There is no CSS workaround.
 *   Solution: inject print content directly into the main document as a hidden
 *   div, reveal it only with @media print, and call window.print() from the
 *   parent. Zero iframes → zero viewport disturbance.
 *
 * Desktop/iOS strategy (iframe):
 *   Still uses a hidden iframe so desktop printing is completely isolated.
 */
async function _printDirectAsync(html: string, paperWidth: string, isFullDoc: boolean): Promise<void> {
  const fullHtml = isFullDoc ? html : _buildFullDoc(html, paperWidth);

  // ── Android: use no-iframe approach ─────────────────────────────────────────
  if (_isAndroid) {
    return _printAndroid(fullHtml);
  }

  // ── Desktop / iOS: hidden iframe approach ───────────────────────────────────
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  const renderWidth = paperWidth === '58mm' ? 220 : 302;
  iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${renderWidth}px;height:1px;border:none;opacity:0;pointer-events:none;overflow:hidden;`;
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    try { iframe.remove(); } catch {}
    _isPrinting = false;
    setTimeout(_drainPrintQueue, 300);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  const iframeWin = iframe.contentWindow;
  if (!iframeWin) {
    try { iframe.remove(); } catch {}
    _isPrinting = false;
    setTimeout(_drainPrintQueue, 300);
    return;
  }

  await new Promise(r => setTimeout(r, 20));

  return new Promise<void>(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setTimeout(() => { try { iframe.remove(); } catch {} resolve(); }, 200);
    };
    iframeWin.addEventListener('afterprint', finish, { once: true });
    setTimeout(finish, 2000);
    requestAnimationFrame(() => {
      setTimeout(() => { try { iframeWin.print(); } catch { finish(); } }, 0);
    });
  });
}

function _drainPrintQueue() {
  if (_isPrinting || _printQueue.length === 0) return;
  _isPrinting = true;
  _armPrintWatchdog();
  const { html, paperWidth, isFullDoc } = _printQueue.shift()!;
  _printDirectAsync(html, paperWidth, isFullDoc)
    .catch(err => console.warn('[Print] Error:', err))
    .finally(() => {
      _clearPrintWatchdog();
      _isPrinting = false;
      if (_printQueue.length > 0) setTimeout(_drainPrintQueue, 80);
    });
}

/**
 * Write a full HTML document into an already-open popup window and auto-print it.
 * If the popup is null (blocked), falls back to the iframe queue.
 */
function _printInPopup(win: Window | null, html: string, delayMs: number): void {
  if (!win || win.closed) {
    // Popup was blocked — fall back to iframe queue
    _printQueue.push({ html, paperWidth: '80mm', isFullDoc: true });
    _drainPrintQueue();
    return;
  }
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch {
    // cross-origin or other write error — silently ignore
  }
  setTimeout(() => {
    try { win.print(); } catch {}
    // Close the popup after printing (or after 3 s if afterprint never fires)
    const close = () => { try { if (!win.closed) win.close(); } catch {} };
    win.addEventListener('afterprint', close, { once: true });
    setTimeout(close, 3000);
  }, delayMs);
}

function openPrintWindow(html: string, _title: string, config: PrintConfig = {}): Window | null {
  const { paperWidth = '80mm' } = config;

  // MANDATORY on every platform: printing must always happen in the
  // background via the print queue. A popup-window print path (with a
  // "طباعة" button) used to exist for autoPrint=false callers, but a popup
  // is exactly the kind of "something opens around the screen" behavior
  // that must never happen on a POS/kiosk device — so this now always
  // takes the background queue path regardless of the autoPrint flag.
  const isFullDoc = /<html[\s>]/i.test(html);
  _printQueue.push({ html, paperWidth, isFullDoc });
  _drainPrintQueue();
  return null;
}

// Export for direct use from manual print buttons (user gesture context)
export function printHtmlInPage(html: string, paperWidth: string = '80mm'): void {
  // receipt-invoice sends raw HTML fragments (not full documents)
  _printQueue.push({ html, paperWidth, isFullDoc: false });
  _drainPrintQueue();
}

/**
 * Print a canvas PNG via a hidden iframe — same pipeline used by printTaxInvoice.
 * Shared helper for shift reports and refund receipts.
 */
function _printCanvasImage(imgSrc: string, paperWidth: '58mm' | '80mm' = '80mm'): void {
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>
    @page { size: ${paperWidth} auto; margin: 0; }
    html,body { margin:0; padding:0; background:#fff; }
    img { width: ${paperWidth}; display: block; margin: 0; padding: 0; }
  </style></head><body><img src="${imgSrc}" /></body></html>`;

  // On Android: use the no-iframe path to avoid viewport shrinkage.
  // We need to wait for the image inside the overlay to load first.
  if (_isAndroid) {
    _printAndroid(fullHtml).catch(() => {});
    return;
  }

  // Desktop / iOS: hidden iframe
  const printFrame = document.createElement('iframe');
  printFrame.setAttribute('aria-hidden', 'true');
  printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:302px;height:1px;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(printFrame);
  const pdoc = printFrame.contentDocument || printFrame.contentWindow?.document;
  if (!pdoc) { try { printFrame.remove(); } catch {} return; }
  pdoc.open();
  pdoc.write(fullHtml);
  pdoc.close();
  const img = pdoc.querySelector('img') as HTMLImageElement | null;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    setTimeout(() => { try { printFrame.remove(); } catch {} }, 200);
  };
  const doPrint = () => {
    printFrame.contentWindow?.addEventListener('afterprint', finish, { once: true });
    setTimeout(finish, 5000);
    requestAnimationFrame(() => {
      setTimeout(() => { try { printFrame.contentWindow?.print(); } catch { finish(); } }, 0);
    });
  };
  if (img && !img.complete) {
    img.onload = () => setTimeout(doPrint, 100);
    img.onerror = () => setTimeout(doPrint, 100);
  } else {
    setTimeout(doPrint, 200);
  }
}

/**
 * Print a shift / Z-report to the configured thermal printer.
 * Falls back to browser print (PDF dialog) only when mode='browser'.
 * `p` is the period/shift object from the shift bar or Z-report.
 */
export async function printShiftThermal(p: {
  periodLabel?: string;
  isOngoing?: boolean;
  windowStart?: string;
  windowEnd?: string;
  totalOrders: number;
  totalSales: number;
  totalCash?: number;
  totalCard?: number;
  totalCashSales?: number;
  totalCardSales?: number;
  paymentBreakdown?: Record<string, number>;
  productsByCategory?: Array<{ categoryNameAr: string; items: Array<{ nameAr: string; quantity: number }> }>;
  // Z-report / manual shift fields
  shiftNumber?: string;
  employeeName?: string;
  openedAt?: string;
  closedAt?: string;
  reportTitle?: string;
}, bizName = 'CLUNY CAFE'): Promise<void> {
  const { loadPrinterSettings, buildShiftReportEscPos, buildShiftReportCanvas, thermalPrint } = await import('./thermal-printer');
  const ps = loadPrinterSettings();

  const fmtT = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '';
  const fmtD = (iso?: string) => iso ? new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

  const startIso = p.openedAt || p.windowStart;
  const endIso   = p.closedAt  || p.windowEnd;
  const totalCash = p.totalCash ?? p.totalCashSales ?? (p.paymentBreakdown?.cash ?? 0);
  const totalCard = p.totalCard ?? p.totalCardSales ?? ((p.paymentBreakdown?.card ?? 0) + (p.paymentBreakdown?.network ?? 0));
  const totalLoyalty = p.paymentBreakdown?.loyalty ?? 0;

  const opts = {
    shopName: bizName,
    reportTitle: p.reportTitle ?? (p.shiftNumber ? 'تقرير Z — إغلاق الوردية' : (p.isOngoing ? 'تقرير وردية جارية' : 'تقرير وردية مكتملة')),
    shiftNumber: p.shiftNumber,
    dateLabel: fmtD(startIso),
    periodLabel: p.periodLabel,
    fromTime: fmtT(startIso),
    toTime: p.isOngoing ? 'جارية...' : fmtT(endIso),
    cashierName: p.employeeName,
    totalOrders: p.totalOrders || 0,
    totalSales: p.totalSales || 0,
    totalCash,
    totalCard,
    totalLoyalty,
    productsByCategory: p.productsByCategory,
    paperWidth: ps.paperWidth as '58mm' | '80mm',
  };

  const escData = await buildShiftReportEscPos(opts);
  const result = await thermalPrint(escData, '', ps.paperWidth as '58mm' | '80mm');

  if (!result.success) {
    // Thermal failed — fall back: Canvas → PNG → iframe (same pipeline as receipts)
    const canvas = await buildShiftReportCanvas(opts);
    const imgSrc = canvas.toDataURL('image/png');
    _printCanvasImage(imgSrc, ps.paperWidth as '58mm' | '80mm');
  }
}

/**
 * Print a refund / credit-note receipt to the configured thermal printer.
 * Falls back to browser print (Canvas → PNG → iframe) when thermal is unavailable.
 */
export async function printRefundThermal(opts: {
  shopName?: string;
  refundId: string;
  originalOrderNumber: string | number;
  items: Array<{ nameAr: string; nameEn?: string; quantity: number; unitPrice: number; subtotal: number }>;
  refundAmount: number;
  paymentMethod: 'cash' | 'card' | 'split';
  cashAmount?: number;
  cardAmount?: number;
  reason: string;
  employeeName?: string;
  date: string;
  originalPaymentMethod?: string;
}): Promise<void> {
  const { loadPrinterSettings, buildRefundEscPos, buildRefundCanvas, thermalPrint } = await import('./thermal-printer');
  const ps = loadPrinterSettings();

  const refundOpts = {
    shopName: opts.shopName || COMPANY_NAME,
    refundId: opts.refundId,
    originalOrderNumber: opts.originalOrderNumber,
    items: opts.items,
    refundAmount: opts.refundAmount,
    paymentMethod: opts.paymentMethod,
    cashAmount: opts.cashAmount,
    cardAmount: opts.cardAmount,
    reason: opts.reason,
    employeeName: opts.employeeName,
    date: opts.date,
    originalPaymentMethod: opts.originalPaymentMethod,
    paperWidth: ps.paperWidth as '58mm' | '80mm',
  };

  // Try hardware thermal first
  if (ps.enabled && ps.mode !== 'browser') {
    try {
      const escData = await buildRefundEscPos(refundOpts);
      const result = await thermalPrint(escData, '', ps.paperWidth as '58mm' | '80mm');
      if (result.success) return;
    } catch (e) {
      console.warn('[printRefundThermal] Hardware print failed:', e);
    }
  }

  // Browser print fallback: Canvas → PNG → iframe
  const canvas = await buildRefundCanvas(refundOpts);
  _printCanvasImage(canvas.toDataURL('image/png'), ps.paperWidth as '58mm' | '80mm');
}

export async function printEmployeeCard(data: EmployeePrintData): Promise<void> {
  let qrCodeSvg = "";
  if (data.qrCode) {
    try {
      const svgStr = await QRCode.toString(data.qrCode, { type: 'svg', width: 100, margin: 1, errorCorrectionLevel: 'M' });
      qrCodeSvg = svgStr.replace(/<\?xml[^?]*\?>/g, '').replace(/width="\d+"/, 'width="100"').replace(/height="\d+"/, 'height="100"');
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  }

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>بطاقة الموظف - ${data.employeeName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Tahoma, Arial, 'Segoe UI', sans-serif; background: #fff; color: #000; direction: rtl; }
    .card { margin: 20px auto; padding: 24px; border: 2px solid #333; border-radius: 12px; }
    .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 16px; margin-bottom: 16px; }
    .company-name { font-size: 20px; font-weight: 700; color: #b45309; }
    .employee-title { font-size: 12px; color: #666; margin-top: 4px; }
    .employee-name { font-size: 18px; font-weight: 700; margin: 16px 0 8px; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #eee; }
    .info-label { color: #666; }
    .info-value { font-weight: 600; }
    .qr-section { text-align: center; margin-top: 16px; padding-top: 16px; border-top: 2px dashed #333; }
    .qr-section img { width: 100px; height: 100px; }
    .qr-note { font-size: 10px; color: #888; margin-top: 8px; }
    @media print { body { margin: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="company-name">CLUNY CAFE</div>
      <div class="employee-title">بطاقة تعريف الموظف</div>
    </div>
    <div class="employee-name">${data.employeeName}</div>
    <div class="info-row"><span class="info-label">رقم الموظف:</span><span class="info-value">${data.employmentNumber}</span></div>
    <div class="info-row"><span class="info-label">المنصب:</span><span class="info-value">${data.role}</span></div>
    <div class="info-row"><span class="info-label">الجوال:</span><span class="info-value">${data.phone}</span></div>
    ${data.branchName ? `<div class="info-row"><span class="info-label">الفرع:</span><span class="info-value">${data.branchName}</span></div>` : ''}
    ${qrCodeSvg ? `
    <div class="qr-section">
      ${qrCodeSvg}
      <div class="qr-note">امسح للتسجيل السريع</div>
    </div>
    ` : ''}
  </div>
</body>
</html>
  `;
  openPrintWindow(html, `بطاقة الموظف - ${data.employeeName}`, { paperWidth: '80mm', autoPrint: true, showPrintButton: true });
}

export async function printKitchenOrder(data: KitchenOrderData): Promise<void> {
  const itemsHtml = data.items.map(item => `
    <div style="padding: 8px 0; border-bottom: 1px dashed #ccc; display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="flex: 1; padding-left: 8px; font-size: 16px;">
        ${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}
      </div>
      <div style="font-size: 24px; font-weight: 700; background: #000; color: #fff; padding: 4px 12px; border-radius: 8px; flex-shrink: 0;">x${item.quantity}</div>
    </div>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>طلب المطبخ - ${data.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Tahoma, Arial, 'Segoe UI', sans-serif; background: #fff; color: #000; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ticket { margin: 0 auto; padding: 16px; }
    .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
    .order-number { font-size: 28px; font-weight: 700; }
    .urgent { background: #dc2626; color: #fff; padding: 4px 12px; border-radius: 4px; display: inline-block; margin-top: 8px; animation: blink 1s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .table-info { font-size: 20px; font-weight: 700; color: #b45309; margin-top: 8px; }
    .timestamp { font-size: 12px; color: #666; }
    .items { margin: 16px 0; }
    .notes { background: #fef3c7; padding: 12px; border-radius: 8px; margin-top: 12px; font-size: 14px; }
    .notes-label { font-weight: 700; color: #92400e; }
    @media print { body { margin: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      <div class="order-number">${fmtOrderNum(data.orderNumber)}</div>
      ${data.priority === 'urgent' ? '<div class="urgent">عاجل!</div>' : ''}
      ${data.tableNumber ? `<div class="table-info">طاولة ${data.tableNumber}</div>` : ''}
      <div class="timestamp">${data.timestamp}</div>
    </div>
    <div class="items">${itemsHtml}</div>
    ${data.notes ? `<div class="notes"><span class="notes-label">ملاحظات:</span> ${data.notes}</div>` : ''}
  </div>
</body>
</html>
  `;
  openPrintWindow(html, `طلب المطبخ - ${data.orderNumber}`, { paperWidth: '80mm', autoPrint: true, autoClose: true, showPrintButton: false });
}

const VAT_NUMBER = "312718675800003";
const COMPANY_NAME = "CLUNY CAFE";
const COMPANY_NAME_EN = "CLUNY CAFE";
const COMPANY_CR = "7025559423";
const COMPANY_WEBSITE = "cluny.cafe";
const DEFAULT_BRANCH = "";
const DEFAULT_ADDRESS = "";

function generateZATCAQRCode(data: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: string;
  vatAmount: string;
}): string {
  const tlv = (tag: number, value: string): Uint8Array => {
    const encoder = new TextEncoder();
    const valueBytes = encoder.encode(value);
    const result = new Uint8Array(2 + valueBytes.length);
    result[0] = tag;
    result[1] = valueBytes.length;
    result.set(valueBytes, 2);
    return result;
  };

  const sellerNameTLV = tlv(1, data.sellerName);
  const vatNumberTLV = tlv(2, data.vatNumber);
  const timestampTLV = tlv(3, data.timestamp);
  const totalWithVatTLV = tlv(4, data.totalWithVat);
  const vatAmountTLV = tlv(5, data.vatAmount);

  const combined = new Uint8Array(
    sellerNameTLV.length + vatNumberTLV.length + timestampTLV.length + 
    totalWithVatTLV.length + vatAmountTLV.length
  );

  let offset = 0;
  combined.set(sellerNameTLV, offset); offset += sellerNameTLV.length;
  combined.set(vatNumberTLV, offset); offset += vatNumberTLV.length;
  combined.set(timestampTLV, offset); offset += timestampTLV.length;
  combined.set(totalWithVatTLV, offset); offset += totalWithVatTLV.length;
  combined.set(vatAmountTLV, offset);

  let binary = '';
  combined.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function parseNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

function renderItemName(nameAr: string, nameEn?: string): string {
  if (!nameEn || nameEn.trim() === '' || nameEn.trim() === nameAr.trim()) {
    return `<span style="font-weight:600;">${nameAr}</span>`;
  }
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
    <span style="direction:ltr;text-align:left;font-size:10px;color:#444;flex:1;word-break:break-word;">${nameEn}</span>
    <span style="direction:rtl;text-align:right;font-weight:600;flex:1;word-break:break-word;">${nameAr}</span>
  </div>`;
}

export async function printUnifiedReceipt(data: TaxInvoiceData): Promise<void> {
  // Delegate to the fully featured printTaxInvoice which handles two separate print jobs
  await printTaxInvoice(data, { autoPrint: true });
}

/**
 * Fast Canvas 2D receipt → ESC/POS bytes.
 * Same engine as kitchen tickets — no html2canvas, no PNG conversion, instant.
 * QR codes generated in parallel before rendering begins.
 */
async function _buildFastCustomerEscPos(
  data: TaxInvoiceData,
  orderTypeThermal: string,
  paperWidth: '58mm' | '80mm',
  feedLines: number,
): Promise<Uint8Array> {
  const { buildReceiptBitmapEscPos } = await import('./thermal-printer');

  const totalAmount = parseNumber(data.total);
  const subtotalBeforeVat = totalAmount / (1 + VAT_RATE);
  const vatAmount = totalAmount - subtotalBeforeVat;
  const disc = data.invoiceDiscount ? parseNumber(data.invoiceDiscount) : 0;

  const invoiceTs = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
  const { date: fmtDate, time: fmtTime } = formatDate(data.date);

  const zatcaPayload = generateZATCAQRCode({
    sellerName: COMPANY_NAME,
    vatNumber: data.vatNumber || VAT_NUMBER,
    timestamp: invoiceTs,
    totalWithVat: totalAmount.toFixed(2),
    vatAmount: vatAmount.toFixed(2),
  });

  // Generate both QR codes in parallel — ~50ms total
  // Use plain daily-number in tracking URL so the QR has no %23 encoding issues
  const trackingNum = String(data.orderNumber).replace(/\D/g, '') || String(data.orderNumber);
  const [trackingQr, zatcaQr] = await Promise.all([
    (async () => {
      try {
        const url = `${window.location.origin}/track/${trackingNum}`;
        return await QRCode.toDataURL(url, { width: 180, margin: 1, errorCorrectionLevel: 'M' });
      } catch { return ''; }
    })(),
    (async () => {
      try {
        return await QRCode.toDataURL(zatcaPayload, { width: 140, margin: 1, errorCorrectionLevel: 'M' });
      } catch { return ''; }
    })(),
  ]);

  const payLabel = (() => {
    const m = (data.paymentMethod || '').toLowerCase();
    if (m === 'cash') return 'نقدي';
    if (m === 'apple_pay' || m === 'paymob-apple-pay' || m === 'neoleap-apple-pay') return 'Apple Pay';
    if (m === 'stc-pay' || m === 'stc_pay') return 'STC Pay';
    if (m === 'mada') return 'مدى';
    if (m === 'card' || m === 'network' || m === 'pos' || m === 'pos-network') return 'شبكة';
    if (m === 'loyalty' || m.includes('qirox') || m.includes('qahwa') || m === 'loyalty-card') return 'بطاقة ولاء';
    if (m === 'geidea' || m === 'paymob-card' || m === 'paymob') return 'بطاقة ائتمان';
    if (m === 'bank_transfer' || m === 'rajhi' || m === 'alinma') return 'تحويل بنكي';
    if (m === 'split') return 'نقدي + شبكة';
    return data.paymentMethod || 'غير محدد';
  })();

  return buildReceiptBitmapEscPos({
    shopName: COMPANY_NAME,
    vatNumber: data.vatNumber || VAT_NUMBER,
    branchName: data.branchName || undefined,
    orderNumber: data.orderNumber,
    orderDate: `${fmtDate} · ${fmtTime}`,
    cashierName: data.employeeName || '—',
    customerName: data.customerName && data.customerName !== 'عميل نقدي' ? data.customerName : undefined,
    tableNumber: data.tableNumber,
    orderType: orderTypeThermal || undefined,
    items: data.items.map(item => ({
      name: item.coffeeItem.nameAr,
      nameEn: (item.coffeeItem as any).nameEn || '',
      qty: item.quantity,
      price: getItemUnitPrice(item),
      addons: [
        ...(getItemSelectedSize(item) ? [`الحجم: ${getItemSelectedSize(item)}`] : []),
        ...getItemAddons(item).map((a: any) => a.nameAr),
      ].filter(Boolean),
    })),
    subtotal: subtotalBeforeVat,
    vat: vatAmount,
    total: totalAmount,
    discount: disc > 0 ? disc : undefined,
    splitPayment: data.splitPayment,
    paymentMethod: payLabel,
    ...(data.cashReceived ? { cashReceived: data.cashReceived } : {}),
    logoDataUrl: '/cluny-logo-invoice.png',
    trackingQrDataUrl: trackingQr || undefined,
    zatcaQrDataUrl: zatcaQr || undefined,
    paperWidth,
    feedLines,
  });
}

/**
 * Fast section-specific print: customer receipt only, kitchen ticket only, or both.
 * Routes through thermal printer when configured — falls back to browser HTML print.
 */
export async function printReceiptSection(
  data: TaxInvoiceData,
  section: 'customer' | 'kitchen' | 'both' = 'customer',
): Promise<void> {
  // ── Try thermal path first (ESC/POS) ─────────────────────────────────────
  try {
    const {
      loadPrinterSettings, thermalPrint,
      buildEscPosKitchenTicketBitmap, getProfilesForRole, thermalPrintWithProfile,
    } = await import('./thermal-printer');
    const ps = loadPrinterSettings();

    if (ps.enabled && ps.mode !== 'browser') {
      const orderTypeStr = (data.orderTypeName || (data.orderType as string) || '');
      const orderTypeThermal =
        orderTypeStr === 'dine_in'    || orderTypeStr === 'dine-in'   ? 'محلي' :
        orderTypeStr === 'takeaway'   || orderTypeStr === 'pickup'    ? 'سفري' :
        orderTypeStr === 'delivery'                                    ? 'توصيل' :
        orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup' ? 'استلام بالسيارة' :
        orderTypeStr || 'محلي';

      const carNote = (orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup')
        ? [
            data.carInfo?.carType,
            data.carInfo?.carColor || data.carColor,
            (data.carInfo?.plateNumber || data.plateNumber) ? `لوحة: ${data.carInfo?.plateNumber || data.plateNumber}` : '',
          ].filter(Boolean).join(' | ')
        : undefined;

      const receiptProfiles = getProfilesForRole('receipt');
      const kitchenProfiles = getProfilesForRole('kitchen');

      // ── Customer copy — Canvas 2D bitmap (instant, same engine as kitchen tickets) ──
      if (section === 'customer' || section === 'both') {
        const escData = await _buildFastCustomerEscPos(data, orderTypeThermal, ps.paperWidth as '58mm' | '80mm', ps.feedLines ?? 4);

        if (receiptProfiles.length > 0) {
          for (const profile of receiptProfiles) {
            await thermalPrintWithProfile(escData, profile);
          }
        } else {
          await thermalPrint(escData, '', ps.paperWidth);
        }
      }

      // ── Kitchen ticket ────────────────────────────────────────────────────
      if (section === 'kitchen' || section === 'both') {
        if (section === 'both') await new Promise(r => setTimeout(r, 1200));
        const kitchenEsc = await buildEscPosKitchenTicketBitmap({
          orderNumber: data.orderNumber,
          tableNumber: data.tableNumber,
          orderType: orderTypeThermal,
          cashierName: data.employeeName || '—',
          items: data.items.map(item => ({
            name: item.coffeeItem.nameAr,
            nameEn: (item.coffeeItem as any).nameEn || '',
            qty: item.quantity,
            addons: [
              ...(getItemSelectedSize(item) ? [`الحجم: ${getItemSelectedSize(item)}`] : []),
              ...getItemAddons(item).map((a: any) => a.nameAr),
            ],
          })),
          notes: [carNote, data.notes].filter(Boolean).join(' | ') || undefined,
          paperWidth: ps.paperWidth,
        });

        if (kitchenProfiles.length > 0) {
          for (const profile of kitchenProfiles) {
            await thermalPrintWithProfile(kitchenEsc, profile);
          }
        } else {
          await thermalPrint(kitchenEsc, '', ps.paperWidth);
        }
      }

      return; // thermal done ✓
    }
  } catch (e) {
    console.warn('[printReceiptSection] Thermal error, falling back to browser:', e);
  }

  // ── Browser HTML fallback ─────────────────────────────────────────────────
  // printReceiptSection is only called from user-initiated button presses,
  // never from auto-print. Browser print is acceptable here (user accepted it).
  if (section === 'customer' || section === 'both') {
    const customerHtml = await buildReceiptPreviewHtml(data);
    _printQueue.push({ html: customerHtml, paperWidth: '80mm', isFullDoc: true });
  }
  if (section === 'kitchen' || section === 'both') {
    const kitchenHtml = buildEmployeeReceiptPreviewHtml(data);
    _printQueue.push({ html: kitchenHtml, paperWidth: '80mm', isFullDoc: true });
  }
  _drainPrintQueue();
}

/**
 * Opens a side-by-side preview window with Customer + Kitchen receipts,
 * each with its own "Print" button. No auto-print — purely for review.
 */
export async function openReceiptPreviewWindow(data: TaxInvoiceData): Promise<void> {
  const customerHtml = await buildReceiptPreviewHtml(data);
  const kitchenHtml = buildEmployeeReceiptPreviewHtml(data);

  // ── MANDATORY on every platform: NEVER open a popup window / visible iframe ──
  // Any popup or on-screen iframe (Android WebView especially, but also
  // desktop/iOS edge cases) can trigger the viewport-shrink bug or a
  // blocked/blank window. Printing must always happen fully in the
  // background — no new window ever opens around the POS screen. Both
  // receipts print directly via the same no-iframe path used everywhere else.
  await _printDirectAsync(customerHtml, '80mm', true);
  await new Promise(r => setTimeout(r, 300));
  await _printDirectAsync(kitchenHtml, '80mm', true);
  return;
}

export async function printBulkEmployeeInvoices(orders: any[]): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
    .invoice-page { width: 80mm; padding: 10px; border-bottom: 2px dashed #000; page-break-after: always; }
    .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 10px; }
    .content { margin-top: 10px; }
    .row { display: flex; justify-content: space-between; margin: 5px 0; }
    .total { font-weight: bold; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
  </style>
</head>
<body>
  ${orders.map(order => {
    const d = new Date(order.createdAt);
    const dateStr = d.toLocaleDateString('ar-SA');
    const timeStr = d.toLocaleTimeString('ar-SA');
    return `
    <div class="invoice-page">
      <div class="header">
        <h3>ملخص طلب موظف</h3>
        <div>رقم الطلب: ${fmtOrderNum(order.orderNumber)}</div>
        <div>التاريخ: ${dateStr} ${timeStr}</div>
      </div>
      <div class="content">
        ${(order.items || []).map((item: any) => `
          <div class="row">
            <span>${item.name || item.coffeeItem?.nameAr}</span>
            <span>${item.quantity}</span>
          </div>
        `).join('')}
        <div class="row total">
          <span>الإجمالي:</span>
          <span>${order.totalAmount} ر.س</span>
        </div>
      </div>
    </div>
    `;
  }).join('')}
</body>
</html>
  `;
  openPrintWindow(html, `Bulk Employee Invoices`, { paperWidth: '80mm', autoPrint: true });
}

function formatDate(dateStr: string): { date: string; time: string } {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return { date: dateStr, time: '' };
    }
    return {
      date: d.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      time: d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    };
  } catch {
    return { date: dateStr, time: '' };
  }
}

/** Build a visual HTML receipt for preview — image-free, instant print */
export async function buildReceiptPreviewHtml(data: TaxInvoiceData): Promise<string> {
  const totalAmount = parseNumber(data.total);
  const subtotalBeforeVat = totalAmount / (1 + VAT_RATE);
  const vat = totalAmount - subtotalBeforeVat;
  const disc = data.invoiceDiscount ? parseNumber(data.invoiceDiscount) : 0;
  const { date: fmtDate, time: fmtTime } = formatDate(data.date);
  const orderNumDisplay = String(data.orderNumber).replace(/\D/g, '').padStart(4, '0') || data.orderNumber;

  const orderTypeStr = (data.orderTypeName || (data.orderType as string) || '');
  const orderTypeLabel =
    orderTypeStr === 'dine_in'   || orderTypeStr === 'dine-in'   ? 'محلي' :
    orderTypeStr === 'takeaway'  || orderTypeStr === 'pickup'     ? 'سفري' :
    orderTypeStr === 'delivery'                                   ? 'توصيل' :
    orderTypeStr === 'car_pickup'|| orderTypeStr === 'car-pickup' ? '🚗 سيارة' :
    orderTypeStr;

    // ZATCA QR — inline SVG (zero network, zero image-load wait)
  // Uses pre-warmed cache if available (generated in background when order was created)
  const invoiceTs = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
  const zatcaPayload = generateZATCAQRCode({
    sellerName: COMPANY_NAME,
    vatNumber: data.vatNumber || VAT_NUMBER,
    timestamp: invoiceTs,
    totalWithVat: totalAmount.toFixed(2),
    vatAmount: vat.toFixed(2),
  });
  const cacheKey = `zatca:${data.orderNumber}:${totalAmount.toFixed(2)}`;
  let zatcaQrSvg = _zatcaQrCache.get(cacheKey) || '';
  if (!zatcaQrSvg) {
    try {
      const svgStr = await QRCode.toString(zatcaPayload, { type: 'svg', width: 100, margin: 1, errorCorrectionLevel: 'M' });
      zatcaQrSvg = svgStr.replace(/<\?xml[^?]*\?>/g, '').replace(/width="\d+"/, 'width="100"').replace(/height="\d+"/, 'height="100"');
      _zatcaQrCache.set(cacheKey, zatcaQrSvg);
    } catch {}
  }

  const totalQty = data.items.reduce((s, i) => s + (i.quantity || 1), 0);

  const solidLine = `<div style="border-top:2px solid #111;margin:0 10px;"></div>`;
  const dashLine  = `<div style="border-top:1px dashed #bbb;margin:8px 10px;"></div>`;

  // Items — name RIGHT, price LEFT, separator after each item
  const itemsHtml = data.items.map(item => {
    const up = getItemUnitPrice(item);
    const itemDisc = parseNumber(item.itemDiscount);
    const lineTotal = item.quantity * up - itemDisc;
    const addons = getItemAddons(item).map((a: any) => a.nameAr).join('، ');
    const sz = getItemSelectedSize(item);
    const extra = [sz ? `الحجم: ${sz}` : '', addons ? `+ ${addons}` : ''].filter(Boolean).join(' · ');
    return `
      <div style="padding:6px 10px 0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:13px;line-height:1.7;">
          <span style="direction:ltr;flex-shrink:0;white-space:nowrap;font-weight:600;">﷼ ${lineTotal.toFixed(2)}</span>
          <span style="text-align:right;">
            ${item.coffeeItem.nameAr} &times;${item.quantity}
            ${extra ? `<br/><span style="font-size:11px;color:#666;">${extra}</span>` : ''}
            ${itemDisc > 0 ? `<br/><span style="font-size:11px;color:#16a34a;">خصم -﷼${itemDisc.toFixed(2)}</span>` : ''}
          </span>
        </div>
      </div>
      <div style="border-top:1px dashed #bbb;margin:6px 10px 0;"></div>`;
  }).join('');

  // Car info row (if car pickup)
  const isCarPickup = orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup';
  const carInfoHtml = isCarPickup ? (() => {
    const carType  = data.carInfo?.carType  || '';
    const carColor = data.carInfo?.carColor || data.carColor || '';
    const plate    = data.carInfo?.plateNumber || data.plateNumber || '';
    const parts = [carColor, carType, plate ? `لوحة: ${plate}` : ''].filter(Boolean);
    return parts.length ? `
    <div style="margin:0 10px 4px;background:#fef9c3;border:1px solid #fbbf24;border-radius:6px;padding:7px 10px;font-size:12px;font-weight:700;text-align:center;">
      🚗 ${parts.join(' | ')}
    </div>` : '';
  })() : '';

  // Payment method label in Arabic
  const pmLabel =
    data.paymentMethod === 'cash'   ? 'نقدي' :
    data.paymentMethod === 'card'   ? 'شبكة' :
    data.paymentMethod === 'split'  ? 'مقسّم' :
    data.paymentMethod === 'qahwa-card' ? 'بطاقة كلوني' :
    (data.paymentMethod || 'نقدي');

  const pmIcon =
    data.paymentMethod === 'cash'   ? '💵' :
    data.paymentMethod === 'card'   ? '💳' :
    data.paymentMethod === 'split'  ? '⇄' :
    data.paymentMethod === 'qahwa-card' ? '🎴' : '💵';

  const loyaltyHtml = (data as any).loyaltyPoints ? `
  <div style="margin:0 8px 6px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:6px 10px;text-align:center;font-size:11px;color:#166534;font-weight:700;">
    ⭐ +${(data as any).loyaltyPoints} نقطة أضيفت لرصيدك
  </div>` : '';

  // ── رأس كلوني الكلاسيكي (شعار متباعد الحروف + كـلـونـي + فاصل cafe · كافيه) ──
  const clunyHeaderHtml = `
    <div style="text-align:center;padding:6px 0 10px;">
      <div style="font-size:32px;font-weight:700;color:#000;letter-spacing:8px;text-transform:uppercase;line-height:1;">CLUNY</div>
      <div style="font-size:17px;font-weight:700;color:#000;letter-spacing:4px;line-height:1.3;direction:rtl;margin-top:2px;">كـلـونـي</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin:5px 0 2px;">
        <span style="flex:1;height:1px;background:#000;max-width:45px;display:block;"></span>
        <span style="font-size:10px;color:#000;letter-spacing:3px;">cafe</span>
        <span style="width:4px;height:4px;background:#000;border-radius:50%;display:inline-block;"></span>
        <span style="font-size:10px;color:#000;letter-spacing:2px;direction:rtl;">كافيه</span>
        <span style="flex:1;height:1px;background:#000;max-width:45px;display:block;"></span>
      </div>
    </div>`;

  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Cairo',Tahoma,Arial,sans-serif;direction:rtl;background:#d6d6d6;display:flex;justify-content:center;align-items:flex-start;padding:24px 10px;min-height:100vh;color:#000;}
.paper{background:#fff;width:302px;padding:12px 12px 10px;box-shadow:0 2px 8px rgba(0,0,0,.18),0 8px 32px rgba(0,0,0,.12);}
.label{background:#000;color:#fff;padding:2px 8px;border-radius:4px;font-size:13px;font-weight:bold;margin-bottom:8px;display:inline-block;}
.header{text-align:center;border-bottom:1px solid #000;padding-bottom:10px;margin-bottom:10px;}
.website{font-size:13px;font-weight:bold;color:#b45309;margin-bottom:4px;}
.head-line{font-size:11.5px;margin:2px 0;}
.order-line{font-size:13px;font-weight:bold;margin-top:4px;}
.info-block{margin-bottom:10px;font-size:12px;border-bottom:1px dashed #ccc;padding-bottom:6px;}
.info-block div{padding:1px 0;}
.item-row{display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border-bottom:1px dashed #eee;font-size:12.5px;}
.item-name{flex:1;text-align:right;font-weight:600;}
.item-extra{font-size:10.5px;color:#666;margin-top:2px;font-weight:400;}
.item-disc{font-size:10.5px;color:#16a34a;margin-top:2px;}
.item-price{width:60px;text-align:left;flex-shrink:0;direction:ltr;}
.totals{margin-top:10px;}
.row{display:flex;justify-content:space-between;margin:4px 0;font-size:12.5px;}
.row span:last-child{direction:ltr;}
.total{font-weight:bold;font-size:16px;border-top:2px solid #000;padding-top:6px;margin-top:8px;}
.split-row{font-size:11px;color:#555;margin:2px 0;}
.change-box{background:#f0fdf4;border:1px solid #86efac;border-radius:6px;margin:8px 0 2px;padding:6px 10px;}
.change-row{display:flex;justify-content:space-between;font-size:11.5px;color:#166534;}
.change-row span:last-child{direction:ltr;font-weight:700;}
.car-box{margin:8px 0 4px;background:#fef9c3;border:1px solid #fbbf24;border-radius:6px;padding:6px 10px;font-size:11.5px;font-weight:700;text-align:center;}
.notes-box{margin:8px 0 4px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:6px 10px;font-size:11.5px;line-height:1.7;}
.loyalty-box{margin:8px 0 4px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:6px 10px;text-align:center;font-size:11px;color:#166534;font-weight:700;}
.qr-container{text-align:center;margin-top:10px;}
.footer{text-align:center;margin-top:12px;font-size:11px;color:#666;}
@media print{
  @page{size:80mm auto;margin:0;}
  body{background:#fff!important;padding:0!important;display:block!important;}
  .paper{width:80mm!important;box-shadow:none!important;}
}
</style></head><body><div class="paper">

  <!-- ══ رأس الفاتورة ══ -->
  <div class="header">
    <div class="label">إيصال العميل (فاتورة ضريبية)</div>
    ${clunyHeaderHtml}
    <div class="website">${brand.website}</div>
    <div class="head-line">الرقم الضريبي: ${data.vatNumber || VAT_NUMBER}</div>
    <div class="order-line">رقم الطلب: #${orderNumDisplay}</div>
    <div class="head-line" style="direction:ltr;">${fmtDate} ${fmtTime}</div>
  </div>

  <!-- ══ بيانات الطلب ══ -->
  <div class="info-block">
    <div>${orderTypeLabel ? `نوع الطلب: ${orderTypeLabel}` : ''}</div>
    ${data.tableNumber ? `<div>طاولة: ${data.tableNumber}</div>` : ''}
    ${data.employeeName ? `<div>الموظف: ${data.employeeName}</div>` : ''}
  </div>

  <!-- ══ الأصناف ══ -->
  ${data.items.map(item => {
    const up = getItemUnitPrice(item);
    const itemDisc = parseNumber(item.itemDiscount);
    const lineTotal = item.quantity * up - itemDisc;
    const addons = getItemAddons(item).map((a: any) => a.nameAr).join('، ');
    const sz = getItemSelectedSize(item);
    const extra = [sz ? `الحجم: ${sz}` : '', addons ? `+ ${addons}` : ''].filter(Boolean).join(' · ');
    return `<div class="item-row">
      <div class="item-name">
        ${item.coffeeItem.nameAr} &times;${item.quantity}
        ${extra ? `<div class="item-extra">${extra}</div>` : ''}
        ${itemDisc > 0 ? `<div class="item-disc">خصم -﷼${itemDisc.toFixed(2)}</div>` : ''}
      </div>
      <div class="item-price">${lineTotal.toFixed(2)}</div>
    </div>`;
  }).join('')}

  <!-- ══ الحساب ══ -->
  <div class="totals">
    <div class="row"><span>المجموع (غير شامل الضريبة):</span><span>${subtotalBeforeVat.toFixed(2)} ر.س</span></div>
    <div class="row"><span>ضريبة القيمة المضافة (15%):</span><span>${vat.toFixed(2)} ر.س</span></div>
    ${disc > 0 ? `<div class="row" style="color:#16a34a;"><span>الخصم:</span><span>-${disc.toFixed(2)} ر.س</span></div>` : ''}
    <div class="row total"><span>الإجمالي شامل الضريبة:</span><span>${totalAmount.toFixed(2)} ر.س</span></div>
    <div class="row" style="margin-top:5px;font-size:11px;"><span>طريقة الدفع:</span><span>${pmIcon} ${pmLabel}</span></div>
    ${data.splitPayment ? `
    <div class="split-row row">${data.splitPayment.cash > 0 ? `<span>نقدي: ${data.splitPayment.cash.toFixed(2)}</span>` : '<span></span>'}${data.splitPayment.card > 0 ? `<span>شبكة: ${data.splitPayment.card.toFixed(2)}</span>` : ''}</div>` : ''}
    ${(data.cashReceived && data.cashReceived > 0 && !data.splitPayment) ? `
    <div class="change-box">
      <div class="change-row"><span>المبلغ المستلم:</span><span>${data.cashReceived.toFixed(2)} ر.س</span></div>
      <div class="change-row" style="font-weight:900;font-size:13px;margin-top:2px;"><span>الباقي للعميل:</span><span>${Math.max(0, data.cashReceived - totalAmount).toFixed(2)} ر.س</span></div>
    </div>` : ''}
  </div>

  <!-- ══ بيانات السيارة ══ -->
  ${carInfoHtml}

  <!-- ══ ملاحظات ══ -->
  ${(data as any).notes ? `<div class="notes-box"><strong>ملاحظات:</strong> ${(data as any).notes}</div>` : ''}

  <!-- ══ كود QR ZATCA ══ -->
  ${zatcaQrSvg ? `<div class="qr-container">${zatcaQrSvg}<div style="font-size:10px;margin-top:4px;">امسح للتحقق من الفاتورة</div></div>` : ''}

  <!-- ══ نقاط الولاء ══ -->
  ${(data as any).loyaltyPoints ? `<div class="loyalty-box">⭐ +${(data as any).loyaltyPoints} نقطة أضيفت لرصيدك</div>` : ''}

  <!-- ══ التذييل ══ -->
  <div class="footer">
    <div style="font-weight:bold;margin-bottom:4px;">${brand.website}</div>
    شكراً لزيارتكم!
  </div>

</div></body></html>`;
}

/** Build a visual HTML preview for the employee/kitchen copy — to be shown alongside the customer preview */
export function buildEmployeeReceiptPreviewHtml(data: TaxInvoiceData): string {
  const { date: fmtDate, time: fmtTime } = formatDate(data.date);
  const orderNumDisplay = String(data.orderNumber).replace(/\D/g, '').padStart(4, '0') || data.orderNumber;

  const orderTypeStr = (data.orderTypeName || (data.orderType as string) || '');
  const orderTypeLabel =
    orderTypeStr === 'dine_in' || orderTypeStr === 'dine-in'
      ? (data.tableNumber ? `محلي — طاولة رقم ${data.tableNumber}` : 'محلي')
      : orderTypeStr === 'takeaway' || orderTypeStr === 'pickup' ? 'سفري'
      : orderTypeStr === 'delivery' ? 'توصيل'
      : orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup' ? 'استلام بالسيارة'
      : orderTypeStr;

  const itemsHtml = data.items.map((item) => {
    const addons = getItemAddons(item).map((a: any) => a.nameAr).join(' &bull; ');
    const sz2 = getItemSelectedSize(item);
    return `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;align-items:flex-start;">
        <div style="flex:1;padding-left:8px;">
          <div style="font-size:17px;font-weight:600;">${item.coffeeItem.nameAr}</div>
          ${sz2 ? `<div style="font-size:13px;color:#2563eb;margin-top:3px;">الحجم: ${sz2}</div>` : ''}
          ${addons ? `<div style="font-size:13px;color:#555;margin-top:3px;">+ ${addons}</div>` : ''}
        </div>
        <div style="font-size:26px;font-weight:bold;border:2px solid #000;padding:2px 10px;border-radius:4px;flex-shrink:0;">x${item.quantity}</div>
      </div>`;
  }).join('');

  const carType  = (data as any).carInfo?.carType  || '';
  const carColor = (data as any).carInfo?.carColor || (data as any).carColor || '';
  const carPlate = (data as any).carInfo?.plateNumber || (data as any).plateNumber || '';
  const carParts = [carColor, carType, carPlate ? `لوحة: ${carPlate}` : ''].filter(Boolean);

  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Cairo',Tahoma,Arial,sans-serif;direction:rtl;background:#d6d6d6;display:flex;justify-content:center;align-items:flex-start;padding:24px 10px;min-height:100vh;color:#000;}
.paper{background:#fff;width:302px;padding:12px 12px 10px;box-shadow:0 2px 8px rgba(0,0,0,.18),0 8px 32px rgba(0,0,0,.12);}
.label{color:#fff;padding:2px 8px;border-radius:4px;font-size:13px;font-weight:bold;margin-bottom:8px;display:inline-block;}
.header{text-align:center;border-bottom:1px solid #000;padding-bottom:10px;margin-bottom:10px;}
.order-num{font-size:28px;font-weight:bold;margin:8px 0;}
.table-badge{font-size:16px;font-weight:bold;color:#b45309;border:2px solid #b45309;padding:3px 8px;margin-top:5px;display:inline-block;}
.emp-line{font-size:11px;color:#555;margin-top:6px;}
.car-box{margin:10px 0;background:#fef9c3;border:1px solid #fbbf24;border-radius:6px;padding:6px 10px;font-size:12px;font-weight:700;text-align:center;}
.notes-box{margin-top:12px;background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.7;}
.footer-note{text-align:center;margin-top:12px;font-weight:bold;font-size:12px;border-top:1px dashed #000;padding-top:8px;}
@media print{
  @page{size:80mm auto;margin:0;}
  body{background:#fff!important;padding:0!important;display:block!important;}
  .paper{width:80mm!important;box-shadow:none!important;}
}
</style></head><body><div class="paper">

  <!-- ══ رأس الفاتورة ══ -->
  <div class="header">
    <div class="label" style="background:#444;">إيصال الموظف (التحضير)</div>
    <div class="order-num">#${orderNumDisplay}</div>
    ${orderTypeLabel ? `<div style="font-size:13px;font-weight:700;color:#333;">${orderTypeLabel}</div>` : ''}
    ${data.tableNumber && !(orderTypeStr === 'dine_in' || orderTypeStr === 'dine-in') ? `<div class="table-badge">طاولة: ${data.tableNumber}</div>` : ''}
    <div class="emp-line">الموظف: ${data.employeeName || '—'} &nbsp;|&nbsp; ${fmtTime} — ${fmtDate}</div>
  </div>

  <!-- ══ الأصناف ══ -->
  <div class="items">${itemsHtml}</div>

  <!-- ══ بيانات السيارة ══ -->
  ${carParts.length ? `<div class="car-box">🚗 ${carParts.join(' | ')}</div>` : ''}

  <!-- ══ ملاحظات ══ -->
  ${(data as any).notes ? `
  <div class="notes-box">
    <div style="font-weight:900;color:#92400e;margin-bottom:4px;">⚠ ملاحظات العميل:</div>
    <div style="font-weight:700;">${(data as any).notes}</div>
  </div>` : ''}

  <div class="footer-note">يرجى التحقق من الأصناف قبل التسليم</div>

</div></body></html>`;
}

export async function printTaxInvoice(data: TaxInvoiceData, config: PrintConfig = {}): Promise<void> {
  const shouldAutoPrint = config.autoPrint !== undefined ? config.autoPrint : true;

  // ── ESC/POS Thermal printing — Canvas 2D bitmap (instant, same engine as kitchen tickets) ──
  if (shouldAutoPrint) {
    try {
      const { loadPrinterSettings, buildEscPosKitchenTicketBitmap, thermalPrint } = await import('./thermal-printer');
      const printerSettings = loadPrinterSettings();

      if (printerSettings.enabled && printerSettings.mode !== 'browser') {

        // ── Order type label for kitchen ticket ───────────────────────────────
        const orderTypeStr = (data.orderTypeName || (data.orderType as string) || '');
        const orderTypeThermal =
          orderTypeStr === 'dine_in' || orderTypeStr === 'dine-in' ? 'محلي' :
          orderTypeStr === 'takeaway' || orderTypeStr === 'pickup' ? 'سفري' :
          orderTypeStr === 'delivery' ? 'توصيل' :
          orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup' ? 'استلام بالسيارة' :
          orderTypeStr || 'محلي';

        // ── Car info note for kitchen ticket (car pickup) ─────────────────────
        const carType    = data.carInfo?.carType    || '';
        const carColor   = data.carInfo?.carColor   || data.carColor   || '';
        const carPlate   = data.carInfo?.plateNumber || data.plateNumber || '';
        const carNote = (orderTypeStr === 'car_pickup' || orderTypeStr === 'car-pickup')
          ? [carType, carColor, carPlate ? `لوحة: ${carPlate}` : ''].filter(Boolean).join(' | ')
          : undefined;

        // ── Build receipt via Canvas 2D (instant — same engine as kitchen tickets) ──
        const escData = await _buildFastCustomerEscPos(
          data,
          orderTypeThermal,
          printerSettings.paperWidth as '58mm' | '80mm',
          printerSettings.feedLines ?? 4,
        );

        const customerCopies = Math.max(1, Math.min(5, printerSettings.customerCopies || 1));
        const kitchenCopies = Math.max(1, Math.min(5, printerSettings.kitchenCopies || 1));

        // ── Multi-printer profile routing ──────────────────────────────────────
        const { getProfilesForRole, thermalPrintWithProfile } = await import('./thermal-printer');
        const receiptProfiles = getProfilesForRole('receipt');
        const kitchenProfiles = getProfilesForRole('kitchen');

        // Print customer receipt — use role-specific profiles if configured, else fallback to primary
        let result = { success: false, mode: 'error', error: '' } as any;
        if (receiptProfiles.length > 0) {
          for (const profile of receiptProfiles) {
            for (let i = 0; i < customerCopies; i++) {
              if (i > 0) await new Promise(r => setTimeout(r, 1200));
              result = await thermalPrintWithProfile(escData, profile);
            }
          }
          result.success = true; // at least one profile attempted
        } else {
          result = await thermalPrint(escData, '', printerSettings.paperWidth);
          for (let i = 1; i < customerCopies && result.success; i++) {
            await new Promise(r => setTimeout(r, 1200));
            result = await thermalPrint(escData, '', printerSettings.paperWidth);
          }
        }

        if (result.success || receiptProfiles.length > 0) {
          if (printerSettings.autoKitchenCopy || kitchenProfiles.length > 0) {
            const kitchenEsc = await buildEscPosKitchenTicketBitmap({
              orderNumber: data.orderNumber,
              tableNumber: data.tableNumber,
              orderType: orderTypeThermal,
              cashierName: data.employeeName || '—',
              items: data.items.map(item => ({
                name: item.coffeeItem.nameAr,
                nameEn: (item.coffeeItem as any).nameEn || '',
                qty: item.quantity,
                addons: [
                  ...(getItemSelectedSize(item) ? [`الحجم: ${getItemSelectedSize(item)}`] : []),
                  ...getItemAddons(item).map((a: any) => a.nameAr),
                ],
              })),
              notes: [carNote, data.notes].filter(Boolean).join(' | ') || undefined,
              paperWidth: printerSettings.paperWidth,
            });
            await new Promise(r => setTimeout(r, 1200));
            if (kitchenProfiles.length > 0) {
              // Route kitchen copies to kitchen-role printers
              for (const profile of kitchenProfiles) {
                for (let i = 0; i < kitchenCopies; i++) {
                  if (i > 0) await new Promise(r => setTimeout(r, 1200));
                  await thermalPrintWithProfile(kitchenEsc, profile);
                }
              }
            } else if (printerSettings.autoKitchenCopy) {
              // Fallback: kitchen copies to primary printer
              for (let i = 0; i < kitchenCopies; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 1400));
                await thermalPrint(kitchenEsc, '', printerSettings.paperWidth);
              }
            }
          }
          return;
        }

        const errMsg = result.error || 'فشلت الطباعة الحرارية';
        console.error('[PrintTaxInvoice] Hardware print failed — mode:', printerSettings.mode, '— error:', errMsg);
        if (typeof window !== 'undefined' && (window as any).__qiroxPrintError !== undefined) {
          (window as any).__qiroxPrintError(errMsg);
        } else {
          window.dispatchEvent(new CustomEvent('qirox:print-error', { detail: { error: errMsg, mode: printerSettings.mode } }));
        }
        return;
      }
    } catch (e) {
      console.warn('[PrintTaxInvoice] Thermal print error:', e);
      // On Android, window.print() blocks the entire UI thread — NEVER use it
      // as a fallback. Dispatch an error event so the POS can show a toast.
      if (_isAndroid) {
        window.dispatchEvent(new CustomEvent('qirox:print-error', {
          detail: { error: 'فشل الاتصال بالطابعة — تحقق من إعدادات الطابعة الحرارية', mode: 'thermal' }
        }));
        return;
      }
    }
  }

  const displayInvoiceNumber = fmtOrderNum(data.orderNumber);

  // ── Build HTML receipts (fast, no image conversion) ───────────────────────
  const customerHtml = await buildReceiptPreviewHtml(data);
  const employeeHtml = buildEmployeeReceiptPreviewHtml(data);

  // ── Helper: print one HTML document ───────────────────────────────────────
  const printOneHtml = (html: string): Promise<void> => _printDirectAsync(html, '80mm', true);

  if (shouldAutoPrint) {
    // ── Android guard ────────────────────────────────────────────────────────
    // window.print() on Android WebView blocks the JS thread synchronously,
    // freezing the entire POS UI for the duration of the print job.
    // All Android printing MUST go through the thermal ESC/POS path above.
    // If we reach here on Android it means thermal failed or is not configured —
    // dispatch an error instead of freezing the screen.
    if (_isAndroid) {
      window.dispatchEvent(new CustomEvent('qirox:print-error', {
        detail: { error: 'يرجى ضبط الطابعة الحرارية في إعدادات الطباعة', mode: 'browser' }
      }));
      return;
    }

    const { loadPrinterSettings } = await import('./thermal-printer');
    const ps = loadPrinterSettings();
    const customerCopies = Math.max(1, Math.min(5, ps.customerCopies || 1));
    const kitchenCopies  = ps.autoKitchenCopy ? Math.max(1, Math.min(5, ps.kitchenCopies || 1)) : 0;

    // Desktop / iOS: print sequentially
    for (let i = 0; i < customerCopies; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 150));
      await printOneHtml(customerHtml);
    }
    for (let i = 0; i < kitchenCopies; i++) {
      await new Promise(r => setTimeout(r, 150));
      await printOneHtml(employeeHtml);
    }
  } else {
    // MANDATORY on every platform (Android, desktop, iOS): never open a
    // popup window or visible iframe for a manual preview/print action —
    // a popup can be blank/blocked, or trigger the viewport-shrink bug on
    // Android WebView. Both receipts print directly in the background;
    // no new window is ever allowed to appear around the POS screen.
    await printOneHtml(customerHtml);
    await new Promise(r => setTimeout(r, 300));
    await printOneHtml(employeeHtml);
  }
}

export async function printCustomerPickupReceipt(data: TaxInvoiceData & { deliveryType?: string; deliveryTypeAr?: string }): Promise<void> {
  const _trackNum = String(data.orderNumber).replace(/\D/g, '') || String(data.orderNumber);
  const orderTrackingUrl = `${window.location.origin}/track/${_trackNum}`;
  
  let qrCodeSvg = "";
  try {
    const svgStr = await QRCode.toString(orderTrackingUrl, { type: 'svg', width: 100, margin: 1, errorCorrectionLevel: 'M' });
    qrCodeSvg = svgStr.replace(/<\?xml[^?]*\?>/g, '').replace(/width="\d+"/, 'width="100"').replace(/height="\d+"/, 'height="100"');
  } catch (error) {
    console.error("Error generating order tracking QR:", error);
  }

  const { date: formattedDate, time: formattedTime } = formatDate(data.date);
  const deliveryTypeAr = data.deliveryTypeAr || (data.deliveryType === 'dine-in' ? 'في الكافيه' : data.deliveryType === 'delivery' ? 'توصيل' : 'استلام');

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>إيصال استلام - ${data.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff; color: #000; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .receipt { max-width: 80mm; margin: 0 auto; padding: 16px; }
    .header { text-align: center; border-bottom: 3px solid #b45309; padding-bottom: 16px; margin-bottom: 16px; }
    .company-name { font-size: 28px; font-weight: 700; color: #b45309; }
    .order-badge { display: inline-block; background: #fef3c7; border: 2px solid #b45309; padding: 12px 24px; border-radius: 12px; margin: 16px 0; }
    .order-number { font-size: 32px; font-weight: 700; color: #b45309; }
    .order-type { display: inline-block; background: ${data.deliveryType === 'dine-in' ? '#8b5cf6' : data.deliveryType === 'delivery' ? '#10b981' : '#3b82f6'}; color: white; padding: 8px 16px; border-radius: 20px; font-size: 16px; font-weight: 600; margin-top: 8px; }
    .section { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed #ccc; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .items-section { background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .item-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .item-row:last-child { border-bottom: none; }
    .item-name { font-weight: 600; }
    .item-qty { background: #000; color: #fff; padding: 2px 10px; border-radius: 12px; font-size: 14px; }
    .total-section { background: #fef3c7; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 16px; }
    .total-amount { font-size: 28px; font-weight: 700; color: #b45309; }
    .qr-section { text-align: center; padding: 16px; border: 2px dashed #b45309; border-radius: 12px; background: #fffbeb; }
    .qr-title { font-size: 14px; font-weight: 600; color: #92400e; margin-bottom: 8px; }
    .qr-container img { width: 120px; height: 120px; }
    .qr-note { font-size: 11px; color: #666; margin-top: 8px; }
    .footer { text-align: center; padding-top: 16px; font-size: 12px; color: #666; }
    @media print { body { margin: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1 class="company-name">${COMPANY_NAME}</h1>
      <p style="color: #666; font-size: 14px;">إيصال الاستلام</p>
      <div class="order-badge">
        <div class="order-number">${fmtOrderNum(data.orderNumber)}</div>
      </div>
      <div class="order-type">${deliveryTypeAr}</div>
    </div>

    <div class="section">
      <div class="info-row">
        <span>العميل:</span>
        <span style="font-weight: 600;">${data.customerName}</span>
      </div>
      <div class="info-row">
        <span>التاريخ:</span>
        <span>${formattedDate} - ${formattedTime}</span>
      </div>
      ${data.tableNumber ? `
      <div class="info-row">
        <span>الطاولة:</span>
        <span style="font-weight: 700; font-size: 18px;">${data.tableNumber}</span>
      </div>
      ` : ''}
    </div>

    <div class="items-section">
      ${data.items.map(item => {
        const addons = getItemAddons(item).map((a: any) => a.nameAr).join('، ');
        return `
        <div class="item-row" style="align-items:flex-start;">
          <div class="item-name" style="flex:1;">
            ${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}
            ${addons ? `<div style="font-size:11px;color:#92400e;margin-top:2px;">+ ${addons}</div>` : ''}
          </div>
          <span class="item-qty">x${item.quantity}</span>
        </div>`;
      }).join('')}
    </div>

    <div class="total-section">
      <p style="font-size: 14px; color: #92400e;">الإجمالي المدفوع</p>
      <p class="total-amount">${data.total} ر.س</p>
      <p style="font-size: 12px; color: #666; margin-top: 4px;">${data.paymentMethod}</p>
    </div>

    <div class="footer">
      <p style="font-weight: 600;">شكراً لزيارتكم</p>
      <p>نتمنى لكم تجربة ممتعة</p>
      <p style="margin-top: 8px;">@CLUNY CAFE</p>
    </div>
  </div>
</body>
</html>
  `;

  openPrintWindow(receiptHtml, `إيصال استلام - ${data.orderNumber}`, { paperWidth: '80mm', autoPrint: true, showPrintButton: true });
}

export async function printCashierReceipt(data: TaxInvoiceData & { deliveryType?: string; deliveryTypeAr?: string }): Promise<void> {
  const { date: formattedDate, time: formattedTime } = formatDate(data.date);
  const deliveryTypeAr = data.deliveryTypeAr || (data.deliveryType === 'dine-in' ? 'في الكافيه' : data.deliveryType === 'delivery' ? 'توصيل' : 'استلام');
  const totalAmount = parseNumber(data.total);

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>نسخة الكاشير - ${data.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff; color: #000; direction: rtl; }
    .receipt { max-width: 80mm; margin: 0 auto; padding: 12px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
    .title { font-size: 14px; font-weight: 700; background: #000; color: #fff; padding: 4px 12px; display: inline-block; margin-bottom: 8px; }
    .order-number { font-size: 24px; font-weight: 700; }
    .order-type { font-size: 14px; font-weight: 600; color: #666; }
    .section { margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed #999; font-size: 12px; }
    .info-row { display: flex; justify-content: space-between; padding: 3px 0; }
    .items { font-size: 12px; }
    .item-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ccc; }
    .totals { font-size: 12px; margin-top: 12px; }
    .total-row { display: flex; justify-content: space-between; padding: 3px 0; }
    .total-grand { font-size: 16px; font-weight: 700; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
    .signature { margin-top: 24px; border-top: 1px solid #000; padding-top: 8px; }
    .signature-line { border-bottom: 1px solid #000; height: 30px; margin-top: 12px; }
    .footer { text-align: center; font-size: 10px; color: #666; margin-top: 12px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <span class="title">نسخة الكاشير</span>
      <div class="order-number">${fmtOrderNum(data.orderNumber)}</div>
      <div class="order-type">${deliveryTypeAr}</div>
    </div>

    <div class="section">
      <div class="info-row"><span>التاريخ:</span><span>${formattedDate}</span></div>
      <div class="info-row"><span>الوقت:</span><span>${formattedTime}</span></div>
      <div class="info-row"><span>الكاشير:</span><span>${data.employeeName}</span></div>
      <div class="info-row"><span>العميل:</span><span>${data.customerName}</span></div>
      <div class="info-row"><span>الجوال:</span><span>${data.customerPhone}</span></div>
      ${data.tableNumber ? `<div class="info-row"><span>الطاولة:</span><span>${data.tableNumber}</span></div>` : ''}
    </div>

    <div class="items">
      ${data.items.map(item => {
        const price = parseNumber(item.coffeeItem.price);
        const addons = getItemAddons(item).map((a: any) => a.nameAr).join('، ');
        return `
        <div class="item-row" style="align-items:flex-start;">
          <div style="flex:1;">
            ${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}<span style="font-size:11px;color:#555;"> x${item.quantity}</span>
            ${addons ? `<div style="font-size:10px;color:#777;margin-top:2px;">+ ${addons}</div>` : ''}
          </div>
          <span style="flex-shrink:0;">${(price * item.quantity).toFixed(2)}</span>
        </div>
        `;
      }).join('')}
    </div>

    <div class="totals">
      <div class="total-row"><span>المجموع الفرعي:</span><span>${data.subtotal} ر.س</span></div>
      ${data.discount ? `<div class="total-row" style="color: green;"><span>الخصم (${data.discount.percentage}%):</span><span>-${data.discount.amount} ر.س</span></div>` : ''}
      <div class="total-row total-grand"><span>الإجمالي:</span><span>${totalAmount.toFixed(2)} ر.س</span></div>
      <div class="total-row"><span>طريقة الدفع:</span><span>${data.paymentMethod}</span></div>
      ${data.splitPayment ? `
      ${data.splitPayment.cash > 0 ? `<div class="total-row" style="font-size:11px;font-weight:600;"><span>💵 نقدي:</span><span>${data.splitPayment.cash.toFixed(2)} ر.س</span></div>` : ''}
      ${data.splitPayment.card > 0 ? `<div class="total-row" style="font-size:11px;font-weight:600;"><span>💳 شبكة:</span><span>${data.splitPayment.card.toFixed(2)} ر.س</span></div>` : ''}` : ''}
      ${(data.cashReceived && data.cashReceived > 0 && !data.splitPayment) ? `
      <div class="total-row" style="font-size:11px;"><span>المبلغ المستلم:</span><span>${data.cashReceived.toFixed(2)} ر.س</span></div>
      <div class="total-row" style="font-size:11px;color:#16a34a;font-weight:700;"><span>↩ الباقي:</span><span>${Math.max(0, data.cashReceived - totalAmount).toFixed(2)} ر.س</span></div>` : ''}
    </div>

    <div class="signature">
      <p style="font-size: 11px;">توقيع العميل (للدفع بالبطاقة):</p>
      <div class="signature-line"></div>
    </div>

    <div class="footer">
      <p>تم الحفظ في ${formattedTime} - ${formattedDate}</p>
    </div>
  </div>
</body>
</html>
  `;

  openPrintWindow(receiptHtml, `نسخة الكاشير - ${data.orderNumber}`, { paperWidth: '80mm', autoPrint: true, showPrintButton: true });
}

export async function printAllReceipts(data: TaxInvoiceData & { deliveryType?: string; deliveryTypeAr?: string }): Promise<void> {
  // Try thermal printer (WebUSB) first
  try {
    const { loadPrinterSettings, buildEscPosReceipt, buildEscPosKitchenTicketBitmap, thermalPrint } = await import('./thermal-printer');
    const printerSettings = loadPrinterSettings();

    if (printerSettings.enabled && printerSettings.autoPrint) {
      const { date: fmtDate, time: fmtTime } = formatDate(data.date);
      const dateStr = `${fmtDate} ${fmtTime}`;
      const totalAmount = parseNumber(data.total);
      const subtotalBeforeTax = totalAmount / (1 + VAT_RATE);
      const vatAmount = totalAmount - subtotalBeforeTax;

      const orderTypeLabel = data.orderTypeName || (data.orderType === 'dine_in' ? 'محلي' : data.orderType === 'takeaway' ? 'سفري' : data.orderType === 'delivery' ? 'توصيل' : data.deliveryTypeAr || '');

      // Build ESC/POS receipt
      const escData = buildEscPosReceipt({
        shopName: COMPANY_NAME,
        vatNumber: data.vatNumber || VAT_NUMBER,
        branchName: data.branchName,
        address: data.branchAddress,
        orderNumber: data.orderNumber,
        date: dateStr,
        cashierName: data.employeeName,
        customerName: data.customerName !== 'عميل نقدي' ? data.customerName : undefined,
        tableNumber: data.tableNumber,
        orderType: orderTypeLabel || undefined,
        items: data.items.map(item => ({
          name: item.coffeeItem.nameAr,
          qty: item.quantity,
          price: parseNumber(item.coffeeItem.price),
          addons: getItemAddons(item).map((a: any) => a.nameAr),
        })),
        subtotal: subtotalBeforeTax,
        vat: vatAmount,
        total: totalAmount,
        discount: data.invoiceDiscount ? parseNumber(data.invoiceDiscount) : undefined,
        paymentMethod: data.paymentMethod,
        paperWidth: printerSettings.paperWidth,
        feedLines: printerSettings.feedLines,
        arabicEncoding: printerSettings.arabicEncoding,
      });

      // pass empty fallbackHtml so browser fallback does nothing here —
      // we handle browser printing separately with the new format below
      const result = await thermalPrint(escData, '', printerSettings.paperWidth);
      console.log('[PrintAllReceipts] Result:', result.mode, result.success);

      if (result.mode === 'webusb' || result.mode === 'network') {
        // Hardware print succeeded — handle kitchen copy if needed
        if (result.mode === 'webusb' && printerSettings.autoKitchenCopy) {
          await new Promise(r => setTimeout(r, 1200));
          const kitchenEsc = await buildEscPosKitchenTicketBitmap({
            orderNumber: data.orderNumber,
            tableNumber: data.tableNumber,
            orderType: orderTypeLabel || undefined,
            cashierName: data.employeeName,
            items: data.items.map(item => ({
              name: item.coffeeItem.nameAr,
              qty: item.quantity,
              addons: getItemAddons(item).map((a: any) => a.nameAr),
            })),
            notes: data.notes || undefined,
            paperWidth: printerSettings.paperWidth,
          });
          const { thermalPrint: tp2 } = await import('./thermal-printer');
          await tp2(kitchenEsc, '', printerSettings.paperWidth);
        }
        return; // Hardware handled it — done
      }
      // mode === 'browser' or 'error': fall through to new-format HTML printing below
    }
  } catch (e) {
    console.error('[PrintAllReceipts] Thermal printer error, falling back:', e);
  }

  // Browser fallback — use the new ZATCA-compliant tax invoice format
  await printUnifiedReceipt(data as any);
}

export async function printSimpleReceipt(data: TaxInvoiceData): Promise<void> {
  const itemsHtml = data.items.map(item => {
    const unitPrice = parseNumber(item.coffeeItem.price);
    const lineTotal = unitPrice * item.quantity;
    const addons = getItemAddons(item).map((a: any) => a.nameAr).join('، ');
    return `
      <tr style="border-bottom: 1px solid #e5e5e5;">
        <td style="padding: 8px 4px;">
          ${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}
          ${addons ? `<div style="font-size:11px;color:#666;margin-top:2px;">+ ${addons}</div>` : ''}
        </td>
        <td style="padding: 8px 4px; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px 4px; text-align: left;">${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  // No tracking QR — removed to keep printing instant (no image loading)

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>إيصال - ${data.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: Tahoma, Arial, 'Segoe UI', sans-serif;
      background: #fff;
      color: #000;
      direction: rtl;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .receipt {
      max-width: 80mm;
      margin: 0 auto;
      padding: 16px;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px dashed #333;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    
    .company-name { font-size: 24px; font-weight: 700; }
    .company-name-en { font-size: 14px; color: #666; }
    .order-num-block { text-align: center; margin: 12px 0; padding: 10px; background: #f0f0f0; border-radius: 6px; border: 1.5px solid #ccc; }
    .order-num-label { font-size: 11px; color: #666; margin-bottom: 4px; }
    .order-num-value { font-size: 26px; font-weight: 700; letter-spacing: 1px; color: #000; font-family: monospace; direction: ltr; }
    
    .section {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px dashed #ccc;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 14px;
    }
    
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { padding: 8px 4px; font-weight: 700; border-bottom: 2px solid #333; }
    th:first-child { text-align: right; }
    th:nth-child(2) { text-align: center; }
    th:last-child { text-align: left; }
    
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-row.grand { font-size: 18px; font-weight: 700; border-top: 2px solid #333; padding-top: 12px; }
    
    .footer { text-align: center; padding-top: 16px; border-top: 2px dashed #333; }
    
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1 class="company-name">${COMPANY_NAME}</h1>
      <p class="company-name-en">${COMPANY_NAME_EN}</p>
      <p style="margin-top: 8px; font-size: 12px;">فاتورة مبيعات</p>
    </div>

    <div class="order-num-block">
      <div class="order-num-label">رقم الطلب</div>
      <div class="order-num-value">${fmtOrderNum(data.orderNumber)}</div>
    </div>

    <div class="section">
      <div class="info-row">
        <span>التاريخ:</span>
        <span>${data.date}</span>
      </div>
      <div class="info-row">
        <span>العميل:</span>
        <span>${data.customerName}</span>
      </div>
      <div class="info-row">
        <span>الجوال:</span>
        <span>${data.customerPhone}</span>
      </div>
      ${data.tableNumber ? `
      <div class="info-row">
        <span>الطاولة:</span>
        <span>${data.tableNumber}</span>
      </div>
      ` : ''}
      <div class="info-row">
        <span>الكاشير:</span>
        <span>${data.employeeName}</span>
      </div>
    </div>

    <div class="section">
      <table>
        <thead>
          <tr>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>السعر</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <div>
      <div class="total-row">
        <span>المجموع الفرعي:</span>
        <span>${data.subtotal} ريال</span>
      </div>
      ${data.discount ? `
      <div class="total-row" style="color: #16a34a;">
        <span>الخصم (${data.discount.code} - ${data.discount.percentage}%):</span>
        <span>-${data.discount.amount} ريال</span>
      </div>
      ` : ''}
      <div class="total-row grand">
        <span>الإجمالي:</span>
        <span>${data.total} ريال</span>
      </div>
      <div class="total-row" style="margin-top: 12px;">
        <span>طريقة الدفع:</span>
        <span><strong>${data.paymentMethod}</strong></span>
      </div>
    </div>


    <div class="footer">
      <p>شكراً لزيارتكم</p>
      <p style="font-size: 12px; color: #666;">نتمنى لكم تجربة ممتعة</p>
      <p style="margin-top: 12px; font-size: 12px;">تابعونا على وسائل التواصل الاجتماعي</p>
      <p style="font-family: monospace;">@CLUNY CAFE</p>
    </div>
  </div>

</body>
</html>
  `;

  openPrintWindow(receiptHtml, `إيصال - ${data.orderNumber}`, { 
    paperWidth: '80mm', 
    autoPrint: true, 
    showPrintButton: true 
  });
}
