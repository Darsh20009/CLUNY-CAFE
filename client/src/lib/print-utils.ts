import QRCode from "qrcode";

function clunyHeader(subtitle?: string): string {
  return `
    <div style="text-align: center; padding: 6px 0 12px;">
      <div style="font-size: 34px; font-weight: 700; color: #000; letter-spacing: 8px; text-transform: uppercase; line-height: 1;">CLUNY</div>
      <div style="font-size: 18px; font-weight: 700; color: #000; letter-spacing: 4px; line-height: 1.3; direction: rtl; margin-top: 2px;">كـلـونـي</div>
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin: 5px 0 2px;">
        <span style="flex: 1; height: 1px; background: #000; max-width: 45px; display: block;"></span>
        <span style="font-size: 10px; color: #000; letter-spacing: 3px;">cafe</span>
        <span style="width: 4px; height: 4px; background: #000; border-radius: 50%; display: inline-block;"></span>
        <span style="font-size: 10px; color: #000; letter-spacing: 2px; direction: rtl;">كافيه</span>
        <span style="flex: 1; height: 1px; background: #000; max-width: 45px; display: block;"></span>
      </div>
      ${subtitle ? `<div style="font-size: 10px; color: #555; margin-top: 4px; direction: rtl;">${subtitle}</div>` : ''}
    </div>
  `;
}

interface OrderItem {
  coffeeItem: {
    nameAr: string;
    nameEn?: string;
    price: string;
  };
  quantity: number;
  itemDiscount?: number;
  addons?: Array<{ nameAr: string; price: number }>;
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
  serviceFee?: number;
  loyaltyDiscount?: number;
  paymentMethod: string;
  splitCash?: number;
  splitCard?: number;
  employeeName: string;
  tableNumber?: string;
  orderType?: 'dine_in' | 'takeaway' | 'delivery';
  orderTypeName?: string;
  date: string;
  branchName?: string;
  branchAddress?: string;
  crNumber?: string;
  vatNumber?: string;
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

const SYSTEM_FONTS = `'Segoe UI', Tahoma, 'Arial Unicode MS', Arial, sans-serif`;

// ── Window-based printing — opens a real visible tab so content renders correctly ────
function openPrintWindow(html: string, _title: string, config: PrintConfig = {}): void {
  const { paperWidth = '80mm', autoPrint = true, showPrintButton = false } = config;

  // Remove ALL @import lines — Google Fonts cause blank pages because the font
  // network request never completes before window.print() fires.
  // The regex matches the full @import statement including any URL with semicolons inside.
  let cleanHtml = html
    .replace(/@import\s+url\([^)]*\)\s*;?\s*/gi, '')
    .replace(/@import\s+['"][^'"]*['"]\s*;?\s*/gi, '');

  const injectedStyles = `
    <style>
      * { font-family: ${SYSTEM_FONTS} !important; }
      body { font-family: ${SYSTEM_FONTS} !important; direction: rtl; }
      @media print {
        @page { size: ${paperWidth} auto; margin: 0; }
        body { margin: 0; padding: 0; }
        .no-print { display: none !important; }
      }
    </style>
  `;

  // Auto-print after 900ms — enough time for layout to complete with system fonts
  const autoPrintScript = autoPrint ? `
    <script>
      window.addEventListener('load', function() {
        setTimeout(function() { window.print(); }, 900);
      });
    <\/script>
  ` : '';

  // Always show a manual print button as backup
  const toolbarHtml = `
    <div class="no-print" style="position:sticky;top:0;z-index:9999;background:#fff;border-bottom:2px dashed #ccc;padding:10px 16px;display:flex;gap:8px;align-items:center;justify-content:center;">
      <button onclick="window.print()" style="padding:10px 28px;font-size:15px;font-family:${SYSTEM_FONTS};background:#b45309;color:#fff;border:none;border-radius:8px;cursor:pointer;">
        🖨️ طباعة
      </button>
      <button onclick="window.close()" style="padding:10px 20px;font-size:14px;font-family:${SYSTEM_FONTS};background:#6b7280;color:#fff;border:none;border-radius:8px;cursor:pointer;">
        ✕ إغلاق
      </button>
    </div>
  `;

  let modifiedHtml = cleanHtml.replace('</head>', `${injectedStyles}${autoPrintScript}</head>`);
  modifiedHtml = modifiedHtml.replace('<body>', `<body>${toolbarHtml}`);

  // Open a real visible window — hidden iframes skip layout & produce blank output
  const printWin = window.open('', '_blank', 'width=900,height=750,scrollbars=yes');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(modifiedHtml);
    printWin.document.close();
  } else {
    // Popup blocked — use blob URL fallback
    const blob = new Blob([modifiedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export async function printEmployeeCard(data: EmployeePrintData): Promise<void> {
  let qrCodeUrl = "";
  if (data.qrCode) {
    try {
      qrCodeUrl = await QRCode.toDataURL(data.qrCode, {
        width: 120,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'M'
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  }

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>بطاقة الموظف - ${data.employeeName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; background: #fff; color: #000; direction: rtl; }
    .card { width: 80mm; margin: 20px auto; padding: 24px; border: 2px solid #333; border-radius: 12px; }
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
      <div style="font-family: 'Cinzel', 'Georgia', serif; font-size: 22px; font-weight: 700; color: #000; letter-spacing: 5px; text-transform: uppercase;">CLUNY</div>
      <div style="font-family: 'Cairo', sans-serif; font-size: 13px; font-weight: 700; color: #000; letter-spacing: 3px; direction: rtl;">كـلـونـي</div>
      <div style="font-size: 10px; color: #000; letter-spacing: 2px; margin-top: 2px;">cafe · كافيه</div>
      <div class="employee-title">بطاقة تعريف الموظف</div>
    </div>
    <div class="employee-name">${data.employeeName}</div>
    <div class="info-row"><span class="info-label">رقم الموظف:</span><span class="info-value">${data.employmentNumber}</span></div>
    <div class="info-row"><span class="info-label">المنصب:</span><span class="info-value">${data.role}</span></div>
    <div class="info-row"><span class="info-label">الجوال:</span><span class="info-value">${data.phone}</span></div>
    ${data.branchName ? `<div class="info-row"><span class="info-label">الفرع:</span><span class="info-value">${data.branchName}</span></div>` : ''}
    ${qrCodeUrl ? `
    <div class="qr-section">
      <img src="${qrCodeUrl}" alt="QR Code" />
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
  <title>طلب المطبخ - ${data.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; background: #fff; color: #000; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ticket { width: 80mm; margin: 0 auto; padding: 16px; }
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
      <div class="order-number">${data.orderNumber}</div>
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

const TAX_RATE = 0.15;
const VAT_NUMBER = "311234567890003";
const COMPANY_NAME = "CLUNY CAFE";
const COMPANY_NAME_EN = "CLUNY CAFE";
const COMPANY_CR = "";
const DEFAULT_BRANCH = "الفرع الرئيسي";
const DEFAULT_ADDRESS = "الرياض، المملكة العربية السعودية";

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

  const totalAmount = parseNumber(data.total);
  const { date: formattedDate, time: formattedTime } = formatDate(data.date);

  const subtotalBeforeTax = totalAmount / (1 + TAX_RATE);
  const vatAmount = totalAmount - subtotalBeforeTax;

  const invoiceTimestamp = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
  const zatcaData = generateZATCAQRCode({
    sellerName: COMPANY_NAME,
    vatNumber: data.vatNumber || VAT_NUMBER,
    timestamp: invoiceTimestamp,
    totalWithVat: totalAmount.toFixed(2),
    vatAmount: vatAmount.toFixed(2)
  });

  let qrCodeUrl = "";
  try {
    qrCodeUrl = await QRCode.toDataURL(zatcaData, {
      width: 150,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
  }

  const itemsHtml = data.items.map(item => `
    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #eee; align-items: flex-start;">
      <div style="flex: 1; padding-left: 4px;">
        ${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}
      </div>
      <div style="width: 40px; text-align: center; flex-shrink: 0;">x${item.quantity}</div>
      <div style="width: 70px; text-align: left; flex-shrink: 0;">${(parseNumber(item.coffeeItem.price) * item.quantity).toFixed(2)}</div>
    </div>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إيصال المبيعات والتحضير - ${data.orderNumber}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; margin: 0; padding: 0; color: #000; background: #fff; }
    .customer-copy { width: 80mm; padding: 10px; margin: 0 auto; }
    .kitchen-copy { width: 80mm; padding: 10px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
    .label { background: #000; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 14px; font-weight: bold; margin-bottom: 10px; display: inline-block; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
    .total { font-weight: bold; font-size: 16px; border-top: 2px solid #000; padding-top: 5px; margin-top: 10px; }
    .footer { text-align: center; margin-top: 15px; font-size: 11px; color: #666; }
    .qr-container { text-align: center; margin-top: 10px; }
    .qr-container img { width: 120px; height: 120px; }
    @media print {
      @page { size: 80mm auto; margin: 0; }
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
      .customer-copy {
        page-break-after: always;
        break-after: page;
      }
    }
  </style>
</head>
<body>
  <!-- نسخة العميل (الفاتورة الضريبية) — الطابعة تقص بعدها تلقائياً -->
  <div class="customer-copy">
    <div class="header">
      <div class="label">إيصال العميل (فاتورة ضريبية)</div>
      ${clunyHeader()}
      <div style="font-size: 14px; font-weight: bold; color: #b45309; margin-bottom: 5px;">www.cluny.cafe</div>
      <div style="font-size: 12px;">الرقم الضريبي: ${data.vatNumber || VAT_NUMBER}</div>
      ${(data.crNumber || COMPANY_CR) ? `<div style="font-size: 12px;">السجل التجاري: ${data.crNumber || COMPANY_CR}</div>` : ''}
      <div style="font-size: 14px; font-weight: bold; margin-top: 4px;">رقم الطلب: #${String(data.orderNumber).replace(/^ORD#|^ORD-/i, '')}</div>
      <div style="font-size: 11px;">التاريخ: ${formattedDate} ${formattedTime}</div>
    </div>

    <div style="margin-bottom: 10px; font-size: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
      <div>العميل: ${data.customerName || 'عميل نقدي'}</div>
      ${data.customerPhone ? `<div>الجوال: ${data.customerPhone}</div>` : ''}
      ${data.tableNumber ? `<div>طاولة: ${data.tableNumber}</div>` : ''}
      <div>الموظف: ${data.employeeName}</div>
    </div>

    <div class="items">${itemsHtml}</div>

    <div class="totals" style="margin-top: 10px;">
      <div class="row">
        <span>المجموع (غير شامل الضريبة):</span>
        <span>${subtotalBeforeTax.toFixed(2)} ر.س</span>
      </div>
      <div class="row">
        <span>ضريبة القيمة المضافة (15%):</span>
        <span>${vatAmount.toFixed(2)} ر.س</span>
      </div>
      <div class="row total">
        <span>الإجمالي شامل الضريبة:</span>
        <span>${totalAmount.toFixed(2)} ر.س</span>
      </div>
      <div class="row" style="margin-top: 5px; font-size: 11px;">
        <span>طريقة الدفع:</span>
        <span>${data.paymentMethod === 'cash' ? 'نقدي' : data.paymentMethod === 'card' ? 'شبكة' : data.paymentMethod === 'split' ? 'مجزأ' : data.paymentMethod}</span>
      </div>
      ${data.paymentMethod === 'split' && (data.splitCash != null || data.splitCard != null) ? `
      <div class="row" style="font-size: 10px; color: #555;">
        <span>نقدي: ${Number(data.splitCash ?? 0).toFixed(2)} | شبكة: ${Number(data.splitCard ?? 0).toFixed(2)}</span>
      </div>` : ''}
    </div>

    ${qrCodeUrl ? `
    <div class="qr-container">
      <img src="${qrCodeUrl}" alt="ZATCA QR" />
      <div style="font-size: 10px;">امسح للتحقق من الفاتورة</div>
    </div>
    ` : ''}

    <div class="footer">
      <div style="font-weight: bold; margin-bottom: 4px;">www.cluny.cafe</div>
      شكراً لزيارتكم!
    </div>
  </div>

  <!-- نسخة الموظف (التحضير) — تُطبع تلقائياً بعد القص -->
  <div class="kitchen-copy">
    <div class="header">
      <div class="label" style="background: #444;">إيصال الموظف (التحضير)</div>
      <div style="font-size: 28px; font-weight: bold; margin: 8px 0;">#${String(data.orderNumber).replace(/^ORD#|^ORD-/i, '')}</div>
      ${data.tableNumber ? `<div style="font-size: 18px; font-weight: bold; color: #b45309; border: 2px solid #b45309; padding: 3px 8px; margin-top: 5px; display: inline-block;">طاولة: ${data.tableNumber}</div>` : ''}
      <div style="font-size: 11px; color: #555; margin-top: 6px;">الموظف: ${data.employeeName}</div>
    </div>
    <div class="items">
      ${data.items.map(item => `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; align-items: flex-start;">
          <div style="flex: 1; padding-left: 8px;">
            <div style="font-size: 17px;">${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}</div>
            ${(item.addons && item.addons.length > 0) ? `<div style="font-size: 13px; color: #555; margin-top: 3px;">${item.addons.map((a: any) => `+ ${a.nameAr}`).join(' &bull; ')}</div>` : ''}
          </div>
          <div style="font-size: 26px; font-weight: bold; border: 2px solid #000; padding: 2px 10px; border-radius: 4px; flex-shrink: 0;">x${item.quantity}</div>
        </div>
      `).join('')}
    </div>
    <div style="text-align: center; margin-top: 12px; font-weight: bold; color: #000; font-size: 12px; border-top: 1px dashed #000; padding-top: 8px;">يرجى التحقق من الأصناف قبل التسليم</div>
  </div>
</body>
</html>
  `;
  openPrintWindow(html, `Unified Receipt - ${data.orderNumber}`, { paperWidth: '80mm', autoPrint: true });
}

export async function printBulkEmployeeInvoices(orders: any[]): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Cairo', sans-serif; direction: rtl; }
    .invoice-page { width: 80mm; padding: 10px; border-bottom: 2px dashed #000; page-break-after: always; margin: 0 auto; }
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
        <div>رقم الطلب: ${order.orderNumber}</div>
        <div>التاريخ: ${dateStr} ${timeStr}</div>
      </div>
      <div class="content">
        ${(order.items || []).map((item: any) => {
          const addons = item.customization?.selectedItemAddons || [];
          const addonsLine = addons.length > 0
            ? `<div style="font-size:11px;color:#555;margin-right:8px;">${addons.map((a: any) => `+ ${a.nameAr}`).join(' • ')}</div>`
            : '';
          return `
          <div class="row">
            <span>${item.name || item.coffeeItem?.nameAr}${addonsLine}</span>
            <span>${item.quantity}</span>
          </div>`;
        }).join('')}
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

export async function printTaxInvoice(data: TaxInvoiceData): Promise<void> {

  // ─── STEP 1: Compute values ──────────────────────────────────────────────────
  const totalAmount = parseNumber(data.total);

  const codeDiscountAmount = data.discount ? parseNumber(data.discount.amount) : 0;
  const invDiscountAmount = parseNumber(data.invoiceDiscount);
  const itemDiscountsTotal = data.items.reduce((sum, item) => sum + parseNumber(item.itemDiscount), 0);

  const subtotalBeforeTax = totalAmount / (1 + TAX_RATE);
  const vatAmount = totalAmount - subtotalBeforeTax;

  const totalDiscounts = codeDiscountAmount + invDiscountAmount + itemDiscountsTotal;
  const subtotalBeforeAllDiscounts = subtotalBeforeTax + (totalDiscounts / (1 + TAX_RATE));

  const displayInvoiceNumber = data.invoiceNumber || `#${String(data.orderNumber).replace(/^ORD#|^ORD-/i, '')}`;
  const { date: formattedDate, time: formattedTime } = formatDate(data.date);
  const displayBranchName = data.branchName || DEFAULT_BRANCH;
  const displayBranchAddress = data.branchAddress || DEFAULT_ADDRESS;

  // ─── STEP 3: Generate QR codes (async, window is already open) ──────────────
  const invoiceTimestamp = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
  const zatcaData = generateZATCAQRCode({
    sellerName: COMPANY_NAME,
    vatNumber: data.vatNumber || VAT_NUMBER,
    timestamp: invoiceTimestamp,
    totalWithVat: totalAmount.toFixed(2),
    vatAmount: vatAmount.toFixed(2)
  });

  let qrCodeUrl = "";
  try {
    qrCodeUrl = await QRCode.toDataURL(zatcaData, {
      width: 180,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
  }

  // Generate tracking QR code
  const trackingUrl = `${window.location.origin}/tracking/${data.orderNumber}`;
  let trackingQrUrl = "";
  try {
    trackingQrUrl = await QRCode.toDataURL(trackingUrl, {
      width: 120,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error("Error generating tracking QR:", error);
  }

  const itemsHtml = data.items.map(item => {
    const unitPrice = parseNumber(item.coffeeItem.price);
    const lineTotal = unitPrice * item.quantity;
    const itemDiscount = parseNumber(item.itemDiscount);
    const lineAfterDiscount = lineTotal - itemDiscount;
    const addonsHtml = (item.addons && item.addons.length > 0)
      ? `<div style="font-size:9px;color:#555;margin-top:2px;padding-right:4px;">
          ${item.addons.map(a => `+ ${a.nameAr}${a.price > 0 ? ` (${a.price.toFixed(2)})` : ''}`).join(' &bull; ')}
        </div>`
      : '';
    return `
      <tr>
        <td style="padding:3px 2px;">${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}${itemDiscount > 0 ? ` <span style="color:#16a34a;font-size:9px;">(-${itemDiscount.toFixed(2)})</span>` : ''}${addonsHtml}</td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:center;">${unitPrice.toFixed(2)}</td>
        <td style="text-align:left;">${lineAfterDiscount.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const orderTypeLabel = data.orderTypeName || (data.orderType === 'dine_in' ? 'محلي' : data.orderType === 'takeaway' ? 'سفري' : data.orderType === 'delivery' ? 'توصيل' : '');

  const invoiceHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>فاتورة ضريبية - ${displayInvoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; background: #fff; color: #000; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .customer-section { width: 80mm; padding: 8px; margin: 0 auto; }
    .kitchen-section { width: 80mm; padding: 8px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
    .company { font-size: 20px; font-weight: 700; }
    .subtitle { font-size: 11px; color: #555; }
    .vat-num { font-size: 10px; font-family: monospace; direction: ltr; color: #333; }
    .invoice-num-block { text-align: center; margin: 8px 0; padding: 8px; background: #f0f0f0; border-radius: 6px; border: 1.5px solid #ccc; }
    .invoice-num-label { font-size: 10px; color: #666; margin-bottom: 2px; }
    .invoice-num-value { font-size: 22px; font-weight: 700; letter-spacing: 1px; color: #000; font-family: monospace; direction: ltr; }
    .info { font-size: 11px; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dashed #ccc; }
    .info-row { display: flex; justify-content: space-between; padding: 2px 0; }
    .info-label { color: #666; }
    .info-val { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 6px; }
    thead tr { border-bottom: 1.5px solid #000; }
    th { padding: 4px 2px; font-weight: 700; font-size: 10px; }
    th:first-child { text-align: right; }
    th:nth-child(2) { text-align: center; width: 30px; }
    th:nth-child(3) { text-align: center; width: 45px; }
    th:last-child { text-align: left; width: 55px; }
    td { padding: 3px 2px; }
    td:first-child { text-align: right; font-weight: 500; }
    td:nth-child(2) { text-align: center; }
    td:nth-child(3) { text-align: center; }
    td:last-child { text-align: left; font-weight: 500; }
    tr { border-bottom: 1px solid #eee; }
    .totals { border-top: 1.5px solid #000; padding-top: 6px; font-size: 11px; }
    .t-row { display: flex; justify-content: space-between; padding: 2px 0; }
    .t-row.grand { font-size: 14px; font-weight: 700; background: #f0f0f0; padding: 6px 8px; border-radius: 4px; margin-top: 4px; }
    .t-row.discount { color: #16a34a; }
    .payment { display: flex; justify-content: space-between; font-size: 11px; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; margin: 6px 0; }
    .payment .val { font-weight: 700; }
    .qr { text-align: center; margin: 8px 0; }
    .qr img { width: 110px; height: 110px; }
    .qr-note { font-size: 9px; color: #888; margin-top: 2px; }
    .footer { text-align: center; font-size: 10px; color: #666; border-top: 1px dashed #ccc; padding-top: 6px; margin-top: 6px; }
    .footer b { color: #000; }
    .emp-header { text-align: center; font-size: 13px; font-weight: 700; background: #000; color: #fff; padding: 4px; border-radius: 4px; margin-bottom: 8px; }
    .emp-order { font-size: 28px; font-weight: 700; text-align: center; margin: 6px 0; }
    .emp-type { text-align: center; font-size: 14px; font-weight: 600; background: #f0f0f0; padding: 4px; border-radius: 4px; margin-bottom: 8px; }
    .emp-items { font-size: 12px; }
    .emp-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #ddd; align-items: center; }
    .emp-item-name { font-weight: 600; flex: 1; font-size: 16px; }
    .emp-item-qty { font-size: 20px; font-weight: 700; background: #000; color: #fff; padding: 2px 12px; border-radius: 4px; min-width: 44px; text-align: center; }
    .emp-total { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; margin-top: 8px; padding-top: 6px; border-top: 1.5px solid #000; }
    .emp-info { font-size: 10px; color: #666; text-align: center; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #ccc; }
    @media print {
      @page { size: 80mm auto; margin: 0; }
      body { margin: 0; }
      .no-print { display: none !important; }
      .customer-section {
        page-break-after: always;
        break-after: page;
      }
    }
  </style>
</head>
<body>
  <!-- نسخة العميل (الفاتورة الضريبية) — الطابعة تقص بعدها تلقائياً -->
  <div class="customer-section">
    <div class="header">
      ${clunyHeader()}
      <div class="subtitle">فاتورة ضريبية مبسطة</div>
      <div class="vat-num">VAT: ${data.vatNumber || VAT_NUMBER}</div>
      ${(data.crNumber || COMPANY_CR) ? `<div class="vat-num">CR: ${data.crNumber || COMPANY_CR}</div>` : ''}
    </div>

    <div class="invoice-num-block">
      <div class="invoice-num-label">رقم الطلب</div>
      <div class="invoice-num-value">${displayInvoiceNumber}</div>
    </div>

    <div class="info">
      <div class="info-row"><span class="info-label">التاريخ:</span><span class="info-val">${formattedDate} ${formattedTime}</span></div>
      ${data.customerName && data.customerName !== 'عميل نقدي' ? `<div class="info-row"><span class="info-label">العميل:</span><span class="info-val">${data.customerName}</span></div>` : ''}
      ${data.tableNumber ? `<div class="info-row"><span class="info-label">طاولة:</span><span class="info-val">${data.tableNumber}</span></div>` : ''}
      ${orderTypeLabel ? `<div class="info-row"><span class="info-label">نوع الطلب:</span><span class="info-val">${orderTypeLabel}</span></div>` : ''}
    </div>

    <table>
      <thead><tr><th>الصنف</th><th>ك</th><th>السعر</th><th>المجموع</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="totals">
      ${totalDiscounts > 0 ? `<div class="t-row discount"><span>الخصومات:</span><span>-${(totalDiscounts / (1 + TAX_RATE)).toFixed(2)} ر.س</span></div>` : ''}
      ${data.loyaltyDiscount ? `<div class="t-row discount"><span>🃏 خصم بطاقة كلوني:</span><span>-${Number(data.loyaltyDiscount).toFixed(2)} ر.س</span></div>` : ''}
      <div class="t-row"><span>قبل الضريبة:</span><span>${subtotalBeforeTax.toFixed(2)} ر.س</span></div>
      <div class="t-row"><span>ضريبة القيمة المضافة 15%:</span><span>${vatAmount.toFixed(2)} ر.س</span></div>
      <div class="t-row grand"><span>الإجمالي:</span><span>${totalAmount.toFixed(2)} ر.س</span></div>
    </div>

    ${data.paymentMethod === 'split' && (data.splitCash != null || data.splitCard != null) ? `
    <div class="payment">
      <span>الدفع: مجزأ</span>
      <span class="val">نقدي: ${Number(data.splitCash ?? 0).toFixed(2)} | شبكة: ${Number(data.splitCard ?? 0).toFixed(2)}</span>
    </div>` : `
    <div class="payment"><span>الدفع:</span><span class="val">${
      data.paymentMethod === 'cash' ? 'نقدي' :
      data.paymentMethod === 'card' ? 'شبكة' :
      data.paymentMethod === 'split' ? 'مجزأ' : data.paymentMethod}</span></div>`}

    ${qrCodeUrl ? `
    <div class="qr">
      <img src="${qrCodeUrl}" alt="ZATCA QR" />
      <div class="qr-note">رمز التحقق - ZATCA</div>
    </div>
    ` : ''}

    <div class="footer">
      <div><b>شكراً لزيارتكم</b></div>
      <div>الأسعار شاملة ضريبة القيمة المضافة 15%</div>
      <div>فاتورة إلكترونية</div>
    </div>
  </div>

  <!-- نسخة الموظف (التحضير) — تُطبع تلقائياً بعد القص -->
  <div class="kitchen-section">
    <div class="emp-header">نسخة الموظف - ملخص الطلب</div>
    <div class="emp-order">${displayInvoiceNumber}</div>
    ${orderTypeLabel ? `<div class="emp-type">${orderTypeLabel}${data.tableNumber ? ' — طاولة ' + data.tableNumber : ''}</div>` : (data.tableNumber ? `<div class="emp-type">طاولة ${data.tableNumber}</div>` : '')}

    <div class="emp-items">
      ${data.items.map(item => `
        <div class="emp-item">
          <div style="flex:1;">
            <div class="emp-item-name">${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}</div>
            ${(item.addons && item.addons.length > 0) ? `<div style="font-size:12px;color:#555;margin-top:2px;">${item.addons.map((a: any) => `+ ${a.nameAr}`).join(' &bull; ')}</div>` : ''}
          </div>
          <span class="emp-item-qty">x${item.quantity}</span>
        </div>
      `).join('')}
    </div>

    <div class="emp-total"><span>الإجمالي:</span><span>${totalAmount.toFixed(2)} ر.س</span></div>

    <div class="emp-info">
      <div>الكاشير: ${data.employeeName} | ${formattedTime}</div>
    </div>
  </div>
</body>
</html>
  `;

  // ─── STEP 4: Send to iframe-based printer (no popup needed) ─────────────────
  openPrintWindow(invoiceHtml, `فاتورة ضريبية - ${displayInvoiceNumber}`, { paperWidth: '80mm', autoPrint: true });
}

export async function printCustomerPickupReceipt(data: TaxInvoiceData & { deliveryType?: string; deliveryTypeAr?: string }): Promise<void> {

  const orderTrackingUrl = `${window.location.origin}/order/${data.orderNumber}`;

  let qrCodeUrl = "";
  try {
    qrCodeUrl = await QRCode.toDataURL(orderTrackingUrl, {
      width: 150,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M'
    });
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
  <title>إيصال استلام - ${data.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; background: #fff; color: #000; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
      ${clunyHeader('إيصال الاستلام')}
      <div class="order-badge">
        <div class="order-number">#${String(data.orderNumber).replace(/^ORD#|^ORD-/i, '')}</div>
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
      ${data.items.map(item => `
        <div class="item-row">
          <div class="item-name" style="flex:1;">${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}</div>
          <span class="item-qty">x${item.quantity}</span>
        </div>
      `).join('')}
    </div>

    <div class="total-section">
      <p style="font-size: 14px; color: #92400e;">الإجمالي المدفوع</p>
      <p class="total-amount">${data.total} ر.س</p>
      <p style="font-size: 12px; color: #666; margin-top: 4px;">${data.paymentMethod === 'split' ? 'مجزأ' : data.paymentMethod === 'cash' ? 'نقدي' : data.paymentMethod === 'card' ? 'شبكة' : data.paymentMethod}</p>
      ${data.paymentMethod === 'split' && (data.splitCash != null || data.splitCard != null) ? `<p style="font-size:10px;color:#888;">نقدي: ${Number(data.splitCash ?? 0).toFixed(2)} | شبكة: ${Number(data.splitCard ?? 0).toFixed(2)}</p>` : ''}
    </div>

    <div class="qr-section">
      <p class="qr-title">امسح لتتبع طلبك</p>
      ${qrCodeUrl ? `<div class="qr-container"><img src="${qrCodeUrl}" alt="Order Tracking QR" /></div>` : ''}
      <p class="qr-note">أو زر الرابط: cluny.com/order/${data.orderNumber}</p>
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
  <title>نسخة الكاشير - ${data.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; background: #fff; color: #000; direction: rtl; }
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
      <div class="order-number">#${String(data.orderNumber).replace(/^ORD#|^ORD-/i, '')}</div>
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
        return `
        <div class="item-row" style="align-items:flex-start;">
          <div style="flex:1;">${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}<span style="font-size:11px;color:#555;"> x${item.quantity}</span></div>
          <span style="flex-shrink:0;">${(price * item.quantity).toFixed(2)}</span>
        </div>
        `;
      }).join('')}
    </div>

    <div class="totals">
      <div class="total-row"><span>المجموع الفرعي:</span><span>${data.subtotal} ر.س</span></div>
      ${data.discount ? `<div class="total-row" style="color: green;"><span>الخصم (${data.discount.percentage}%):</span><span>-${data.discount.amount} ر.س</span></div>` : ''}
      <div class="total-row total-grand"><span>الإجمالي:</span><span>${totalAmount.toFixed(2)} ر.س</span></div>
      <div class="total-row"><span>طريقة الدفع:</span><span>${data.paymentMethod === 'split' ? 'مجزأ' : data.paymentMethod === 'cash' ? 'نقدي' : data.paymentMethod === 'card' ? 'شبكة' : data.paymentMethod}${data.paymentMethod === 'split' && data.splitCash != null ? ` (نقدي: ${Number(data.splitCash).toFixed(2)} | شبكة: ${Number(data.splitCard ?? 0).toFixed(2)})` : ''}</span></div>
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
  await printTaxInvoice(data);
  setTimeout(async () => {
    await printCustomerPickupReceipt(data);
  }, 500);
  setTimeout(async () => {
    await printCashierReceipt(data);
  }, 1000);
}

export async function printSimpleReceipt(data: TaxInvoiceData): Promise<void> {

  const itemsHtml = data.items.map(item => {
    const unitPrice = parseNumber(item.coffeeItem.price);
    const lineTotal = unitPrice * item.quantity;
    const addonsHtml = (item.addons && item.addons.length > 0)
      ? `<div style="font-size:12px;color:#555;margin-top:2px;">${item.addons.map((a: any) => `+ ${a.nameAr}${a.price > 0 ? ` (${Number(a.price).toFixed(2)})` : ''}`).join(' • ')}</div>`
      : '';
    return `
      <tr style="border-bottom: 1px solid #e5e5e5;">
        <td style="padding: 8px 4px;">${renderItemName(item.coffeeItem.nameAr, item.coffeeItem.nameEn)}${addonsHtml}</td>
        <td style="padding: 8px 4px; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px 4px; text-align: left;">${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const trackingUrl = `${window.location.origin}/tracking?order=${data.orderNumber}`;
  let trackingQRCode = "";
  try {
    trackingQRCode = await QRCode.toDataURL(trackingUrl, {
      width: 100,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error("Error generating tracking QR code:", error);
  }

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إيصال - ${data.orderNumber}</title>
  <style>

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Cairo', sans-serif;
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
      ${clunyHeader('فاتورة مبيعات')}
    </div>

    <div class="order-num-block">
      <div class="order-num-label">رقم الطلب</div>
      <div class="order-num-value">#${String(data.orderNumber).replace(/^ORD#|^ORD-/i, '')}</div>
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
      ${data.serviceFee ? `
      <div class="total-row" style="color: #555;">
        <span>رسوم الخدمة:</span>
        <span>${data.serviceFee.toFixed(2)} ريال</span>
      </div>
      ` : ''}
      <div class="total-row grand">
        <span>الإجمالي:</span>
        <span>${data.total} ريال</span>
      </div>
      <div class="total-row" style="margin-top: 12px;">
        <span>طريقة الدفع:</span>
        <span><strong>${data.paymentMethod === 'split' ? 'مجزأ' : data.paymentMethod === 'cash' ? 'نقدي' : data.paymentMethod === 'card' ? 'شبكة' : data.paymentMethod}${data.paymentMethod === 'split' && data.splitCash != null ? ` (نقدي: ${Number(data.splitCash).toFixed(2)} | شبكة: ${Number(data.splitCard ?? 0).toFixed(2)})` : ''}</strong></span>
      </div>
    </div>

    ${trackingQRCode ? `
    <div style="text-align: center; padding: 16px 0; border-top: 2px dashed #333; margin-top: 16px;">
      <p style="font-size: 12px; color: #666; margin-bottom: 8px;">امسح لتتبع طلبك</p>
      <img src="${trackingQRCode}" alt="تتبع الطلب" style="width: 80px; height: 80px;" />
      <p style="font-size: 10px; color: #888; margin-top: 4px;">رقم الطلب: ${data.orderNumber}</p>
    </div>
    ` : ''}

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

  // autoPrint: false — the popup opens automatically with the receipt content and a
  // prominent "طباعة" button. The user clicks it when ready. This prevents the OS
  // print dialog from auto-firing, which would freeze all browser tabs on some OS/browser combos.
  openPrintWindow(receiptHtml, `إيصال - ${data.orderNumber}`, { 
    paperWidth: '80mm', 
    autoPrint: false, 
    showPrintButton: true 
  });
}

/**
 * Generate and download a customer-facing PDF invoice using html2canvas + jsPDF.
 * No popup needed — triggers a direct browser file download.
 */
export async function downloadInvoicePDF(data: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ coffeeItem: { nameAr: string; nameEn?: string; price: string }; quantity: number }>;
  subtotal: string;
  total: string;
  paymentMethod: string;
  date: string;
  branchName?: string;
  branchAddress?: string;
}): Promise<void> {
  const [{ jsPDF }, html2canvas] = await Promise.all([
    import('jspdf'),
    import('html2canvas').then(m => m.default),
  ]);

  const totalAmount = parseNumber(data.total);
  const subtotalBeforeTax = totalAmount / (1 + TAX_RATE);
  const vatAmount = totalAmount - subtotalBeforeTax;
  const { date: formattedDate, time: formattedTime } = formatDate(data.date);
  const branchName = data.branchName || DEFAULT_BRANCH;
  const branchAddress = data.branchAddress || DEFAULT_ADDRESS;
  const orderNum = String(data.orderNumber).replace(/^ORD#|^ORD-/i, '');

  const invoiceTimestamp = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
  const zatcaData = generateZATCAQRCode({
    sellerName: COMPANY_NAME,
    vatNumber: VAT_NUMBER,
    timestamp: invoiceTimestamp,
    totalWithVat: totalAmount.toFixed(2),
    vatAmount: vatAmount.toFixed(2),
  });

  let qrCodeUrl = '';
  try {
    qrCodeUrl = await QRCode.toDataURL(zatcaData, {
      width: 160, margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    });
  } catch {}

  const itemsRows = data.items.map(item => {
    const price = parseNumber(item.coffeeItem.price);
    const lineTotal = price * item.quantity;
    const nameAr = item.coffeeItem.nameAr || '';
    return `
      <tr>
        <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${nameAr}</td>
        <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
        <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:center;">${price.toFixed(2)}</td>
        <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:left;">${lineTotal.toFixed(2)}</td>
      </tr>`;
  }).join('');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Cairo',Arial,sans-serif; direction:rtl; background:#fff; color:#000; width:210mm; }
    .page { width:210mm; min-height:297mm; padding:16mm 14mm; }
    .header { text-align:center; border-bottom:3px solid #1a2c1a; padding-bottom:12px; margin-bottom:16px; }
    .brand-en { font-size:32px; font-weight:700; letter-spacing:8px; color:#1a2c1a; }
    .brand-ar { font-size:16px; font-weight:700; letter-spacing:3px; color:#1a2c1a; margin-top:2px; }
    .brand-sub { font-size:11px; color:#888; letter-spacing:2px; margin-top:2px; }
    .invoice-box { background:#f8f9f0; border:2px solid #1a2c1a; border-radius:8px; padding:10px 14px; margin:12px 0; }
    .invoice-title { font-size:14px; color:#666; }
    .invoice-num { font-size:28px; font-weight:700; color:#1a2c1a; font-family:monospace; }
    .meta { display:flex; justify-content:space-between; font-size:11px; color:#555; margin-top:8px; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:12px 0; font-size:12px; }
    .info-card { background:#f5f5f5; border-radius:6px; padding:8px 10px; }
    .info-label { color:#888; font-size:10px; margin-bottom:2px; }
    .info-value { font-weight:700; color:#111; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin:12px 0; }
    thead tr { background:#1a2c1a; color:#fff; }
    th { padding:8px 4px; font-weight:600; }
    th:first-child { text-align:right; padding-right:8px; }
    th:nth-child(2) { text-align:center; width:40px; }
    th:nth-child(3) { text-align:center; width:65px; }
    th:last-child { text-align:left; width:70px; }
    tbody tr:nth-child(even) { background:#fafafa; }
    .totals { border-top:2px solid #1a2c1a; padding-top:10px; font-size:12px; margin-top:4px; }
    .t-row { display:flex; justify-content:space-between; padding:4px 0; }
    .t-row.grand { font-size:16px; font-weight:700; background:#1a2c1a; color:#fff; padding:8px 12px; border-radius:6px; margin-top:8px; }
    .t-vat { color:#888; font-size:11px; }
    .pay-badge { display:inline-block; background:#1a2c1a; color:#fff; border-radius:20px; padding:4px 14px; font-size:12px; font-weight:700; margin:10px 0; }
    .qr-section { text-align:center; margin-top:16px; border-top:1px dashed #ccc; padding-top:12px; }
    .qr-section img { width:100px; height:100px; }
    .qr-note { font-size:9px; color:#888; margin-top:4px; }
    .vat-row { font-size:10px; color:#888; margin-top:8px; text-align:center; }
    .footer { text-align:center; margin-top:20px; padding-top:12px; border-top:1px dashed #ccc; font-size:11px; color:#666; }
    .footer b { color:#1a2c1a; font-size:14px; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="brand-en">CLUNY</div>
    <div class="brand-ar">كـلـونـي</div>
    <div class="brand-sub">cafe · كافيه</div>
    <div style="font-size:11px;color:#888;margin-top:6px;">${branchName} · ${branchAddress}</div>
  </div>

  <div class="invoice-box">
    <div class="invoice-title">فاتورة ضريبية مبسطة</div>
    <div class="invoice-num">#${orderNum}</div>
    <div class="meta">
      <span>${formattedDate} ${formattedTime}</span>
      <span>الرقم الضريبي: ${VAT_NUMBER}</span>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <div class="info-label">اسم العميل</div>
      <div class="info-value">${data.customerName || 'عميل'}</div>
    </div>
    <div class="info-card">
      <div class="info-label">رقم الجوال</div>
      <div class="info-value">${data.customerPhone || '—'}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>الصنف</th>
        <th>الكمية</th>
        <th>السعر</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <div class="totals">
    <div class="t-row t-vat"><span>المجموع قبل الضريبة:</span><span>${subtotalBeforeTax.toFixed(2)} ر.س</span></div>
    <div class="t-row t-vat"><span>ضريبة القيمة المضافة 15%:</span><span>${vatAmount.toFixed(2)} ر.س</span></div>
    <div class="t-row grand"><span>الإجمالي شامل الضريبة</span><span>${totalAmount.toFixed(2)} ر.س</span></div>
  </div>

  <div><span class="pay-badge">طريقة الدفع: ${data.paymentMethod}</span></div>

  ${qrCodeUrl ? `
  <div class="qr-section">
    <img src="${qrCodeUrl}" alt="ZATCA QR" />
    <div class="qr-note">رمز التحقق الضريبي — ZATCA Compliant</div>
  </div>` : ''}

  <div class="vat-row">الأسعار شاملة ضريبة القيمة المضافة 15% · فاتورة إلكترونية متوافقة مع هيئة الزكاة والضريبة والجمارك</div>

  <div class="footer">
    <b>شكراً لزيارتكم!</b><br>
    <span>www.cluny.cafe</span>
  </div>
</div>
</body>
</html>`;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:794px;background:#fff;z-index:-1;';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await new Promise(r => setTimeout(r, 300));
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    let yOffset = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();
    while (yOffset < pdfHeight) {
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -yOffset, pdfWidth, pdfHeight);
      yOffset += pageHeight;
    }

    pdf.save(`فاتورة-${orderNum}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}