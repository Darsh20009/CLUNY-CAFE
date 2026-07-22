import type { Order } from "@shared/schema";
import type { PaymentMethod } from "@shared/schema";
import QRCode from "qrcode";

interface CartItem {
  coffeeItemId: string;
  quantity: number;
  coffeeItem?: {
    nameAr: string;
    nameEn: string | null;
    price: string;
  };
}

const paymentMethodNames: Record<string, string> = {
  cash: 'نقدي',
  pos: 'شبكة',
  'pos-network': 'شبكة',
  card: 'شبكة',
  network: 'شبكة',
  delivery: 'الدفع عند التوصيل',
  stc: 'STC Pay',
  alinma: 'Alinma Pay',
  ur: 'Ur Pay',
  barq: 'Barq',
  rajhi: 'بنك الراجحي',
  mada: 'تحويل بنكي (مدى)',
  bank_transfer: 'تحويل بنكي',
  apple_pay: 'Apple Pay',
  'neoleap-apple-pay': 'Apple Pay',
  'paymob-apple-pay': 'Apple Pay',
  geidea: 'بطاقة ائتمان',
  paymob: 'بطاقة ائتمان',
  'paymob-card': 'بطاقة ائتمان',
  split: 'نقدي + شبكة',
  'qahwa-card': 'بطاقة ولاء',
  'qirox-card': 'بطاقة ولاء',
  loyalty: 'بطاقة ولاء',
};

const paymentDetails: Record<string, string> = {
  cash: 'دفع نقدي',
  pos: 'جهاز نقاط البيع',
  'pos-network': 'جهاز نقاط البيع',
  card: 'جهاز نقاط البيع',
  delivery: 'ادفع عند استلام الطلب',
  stc: '+966566507666',
  alinma: '+966566507666',
  ur: '+966566507666',
  barq: '+966566507666',
  rajhi: 'SA78 8000 0539 6080 1942 4738',
  mada: 'تحويل بنكي',
  bank_transfer: 'تحويل بنكي',
  apple_pay: 'Apple Pay',
  'neoleap-apple-pay': 'Apple Pay',
  'paymob-apple-pay': 'Apple Pay',
  geidea: 'بطاقة ائتمان إلكترونية',
  paymob: 'بطاقة ائتمان إلكترونية',
  'paymob-card': 'بطاقة ائتمان إلكترونية',
  split: 'دفع مختلط',
  'qahwa-card': 'مشروب مجاني من بطاقة الولاء',
  'qirox-card': 'بطاقة ولاء',
  loyalty: 'بطاقة ولاء',
};

// PDF generation using browser print API
export const generatePDF = async (
  order: Order,
  cartItems: CartItem[],
  paymentMethod: PaymentMethod
): Promise<Blob> => {
  const websiteUrl = 'https://cluny.cafe';
  const qrCodeDataURL = await QRCode.toDataURL(websiteUrl, {
    width: 120,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' }
  });

  const itemRows = cartItems.map(item => `
    <tr>
      <td style="padding:10px;border:1px solid #ddd;">${item.coffeeItem?.nameAr || 'غير محدد'}</td>
      <td style="padding:10px;text-align:center;border:1px solid #ddd;">${item.quantity}</td>
      <td style="padding:10px;text-align:center;border:1px solid #ddd;">${item.coffeeItem?.price || '0'} ريال</td>
      <td style="padding:10px;text-align:center;border:1px solid #ddd;">${(parseFloat(item.coffeeItem?.price || '0') * item.quantity).toFixed(2)} ريال</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة - CLUNY CAFE</title>
  <style>
    body { font-family: Arial, sans-serif; direction: rtl; padding: 40px; color: #000; font-size: 14px; line-height: 1.6; }
    h1 { color: #B8860B; text-align: center; font-size: 36px; margin: 0; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #D4AF37; padding-bottom: 20px; margin-bottom: 30px; background: linear-gradient(135deg, #FFF8DC, #FFFBEB); padding: 20px; border-radius: 12px; }
    .section { background: linear-gradient(135deg, #FFF8DC, #FFFBEB); padding: 20px; border-radius: 12px; border: 2px solid #D4AF37; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f8f9fa; padding: 12px; border: 1px solid #ddd; font-weight: bold; text-align: right; }
    .total { font-size: 18px; font-weight: bold; color: #D4AF37; }
    .footer { text-align: center; border-top: 4px solid #D4AF37; padding-top: 20px; margin-top: 30px; color: #8B6F47; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="flex:1;text-align:center;">
      <h1>CLUNY CAFE</h1>
      <p style="color:#8B6F47;font-size:16px;margin:8px 0;">تجربة قهوة استثنائية</p>
      <p style="color:#666;font-style:italic;">"لكل لحظة قهوة ، لحظة نجاح"</p>
    </div>
    <div style="text-align:center;padding:0 20px;">
      <img src="${qrCodeDataURL}" alt="QR Code" style="width:100px;height:100px;border:2px solid #D4AF37;border-radius:8px;" />
      <p style="margin:8px 0 0;color:#8B6F47;font-size:11px;">امسح للوصول للموقع</p>
    </div>
  </div>

  <div class="section">
    <h2 style="color:#D4AF37;text-align:center;margin-top:0;">فاتورة استلام الطلب</h2>
    <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
      <span style="font-weight:bold;color:#8B6F47;">اسم العميل:</span>
      <span style="font-weight:bold;color:#D4AF37;">${(order.customerInfo as any)?.customerName || 'غير محدد'}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
      <span style="font-weight:bold;color:#8B6F47;">رقم الطلب:</span>
      <span style="font-weight:bold;">${order.orderNumber}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
      <span style="font-weight:bold;color:#8B6F47;">التاريخ:</span>
      <span>${new Date(order.createdAt).toLocaleDateString('ar-SA')}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span style="font-weight:bold;color:#8B6F47;">الوقت:</span>
      <span>${new Date(order.createdAt).toLocaleTimeString('ar-SA')}</span>
    </div>
  </div>

  <h3 style="color:#D4AF37;">تفاصيل الطلب</h3>
  <table>
    <thead>
      <tr>
        <th>المنتج</th><th style="text-align:center;">الكمية</th><th style="text-align:center;">السعر</th><th style="text-align:center;">المجموع</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="section" style="display:flex;justify-content:space-between;">
    <span style="font-weight:bold;font-size:18px;">إجمالي المبلغ:</span>
    <span class="total">${order.totalAmount} ريال</span>
  </div>

  <div class="section">
    <h3 style="color:#D4AF37;margin-top:0;">طريقة الدفع</h3>
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <span style="font-weight:bold;">الطريقة:</span>
      <span>${paymentMethodNames[paymentMethod] || paymentMethod}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span style="font-weight:bold;">التفاصيل:</span>
      <span>${paymentDetails[paymentMethod] || ''}</span>
    </div>
  </div>

  <div class="footer">
    <p style="font-size:18px;font-weight:bold;color:#B8860B;">شكراً لاختياركم CLUNY CAFE</p>
    <p style="font-style:italic;">"لكل لحظة قهوة ، لحظة نجاح"</p>
    <p style="font-size:12px;color:#888;">${new Date().toLocaleDateString('ar-SA')} | ${new Date().toLocaleTimeString('ar-SA')}</p>
  </div>

  <div style="text-align:center;margin-top:20px;">
    <button onclick="window.print()" style="background:#D4AF37;color:#fff;border:none;padding:12px 30px;font-size:16px;border-radius:8px;cursor:pointer;">طباعة / حفظ PDF</button>
  </div>
</body>
</html>`;

  return new Blob([html], { type: 'text/html' });
};

// Open print window with the PDF content
export const printOrderPDF = async (
  order: Order,
  cartItems: CartItem[],
  paymentMethod: PaymentMethod
): Promise<void> => {
  const blob = await generatePDF(order, cartItems, paymentMethod);
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    };
  }
};

// Declare global types for backward compatibility
declare global {
  interface Window {
    html2canvas?: any;
    jsPDF?: any;
  }
}

export const loadPDFLibraries = async (): Promise<void> => {
  // No-op: PDF generation now uses browser print API
};
