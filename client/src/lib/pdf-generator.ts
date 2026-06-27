import type { Order } from "@shared/schema";
import type { PaymentMethod } from "@shared/schema";

interface CartItem {
  coffeeItemId: string;
  quantity: number;
  coffeeItem?: {
    nameAr: string;
    nameEn: string | null;
    price: string;
  };
}

declare global {
  interface Window {
    html2canvas?: any;
    jsPDF?: any;
  }
}

export const loadPDFLibraries = async (): Promise<void> => {
  // jspdf is not available in this environment; using browser print fallback
};

export const generatePDF = async (
  order: Order,
  cartItems: CartItem[],
  paymentMethod: PaymentMethod
): Promise<Blob> => {
  const paymentMethodNames: Record<string, string> = {
    cash: 'الدفع نقداً',
    pos: 'جهاز نقاط البيع (POS)',
    delivery: 'الدفع عند التوصيل',
    stc: 'STC Pay',
    alinma: 'Alinma Pay',
    ur: 'Ur Pay',
    barq: 'Barq',
    rajhi: 'بنك الراجحي',
    'qahwa-card': 'بطاقة كوبي (مجاني)'
  };

  const paymentDetails: Record<string, string> = {
    cash: 'الدفع عند الاستلام',
    pos: 'الدفع عبر جهاز POS',
    delivery: 'ادفع عند استلام الطلب',
    stc: '+966532441566',
    alinma: '+966532441566',
    ur: '+966532441566',
    barq: '+966532441566',
    rajhi: 'SA78 8000 0539 6080 1942 4738',
    'qahwa-card': 'مشروب مجاني من بطاقة الولاء'
  };

  const html = `
    <html dir="rtl">
    <head>
      <meta charset="utf-8"/>
      <title>فاتورة CLUNY CAFE</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #000; direction: rtl; }
        h1 { color: #B8860B; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
        th { background: #f8f9fa; }
        .total { font-size: 18px; font-weight: bold; text-align: center; margin: 20px 0; }
        .footer { text-align: center; margin-top: 40px; color: #8B6F47; }
      </style>
    </head>
    <body>
      <h1>CLUNY CAFE</h1>
      <p style="text-align:center">فاتورة استلام الطلب</p>
      <p>رقم الطلب: <strong>${order.orderNumber}</strong></p>
      <p>التاريخ: ${new Date(order.createdAt).toLocaleDateString('ar-SA')}</p>
      <p>الوقت: ${new Date(order.createdAt).toLocaleTimeString('ar-SA')}</p>
      <table>
        <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr></thead>
        <tbody>
          ${cartItems.map(item => `
            <tr>
              <td>${item.coffeeItem?.nameAr || 'غير محدد'}</td>
              <td style="text-align:center">${item.quantity}</td>
              <td style="text-align:center">${item.coffeeItem?.price || '0'} ريال</td>
              <td style="text-align:center">${(parseFloat(item.coffeeItem?.price || '0') * item.quantity).toFixed(2)} ريال</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="total">الإجمالي: ${order.totalAmount} ريال</div>
      <p>طريقة الدفع: ${paymentMethodNames[paymentMethod] || paymentMethod}</p>
      <p>التفاصيل: ${paymentDetails[paymentMethod] || ''}</p>
      <div class="footer">
        <p>شكراً لاختياركم CLUNY CAFE</p>
        <p>"لكل لحظة قهوة ، لحظة نجاح"</p>
        <p>www.cluny.cafe | +966532441566</p>
      </div>
    </body>
    </html>
  `;

  return new Blob([html], { type: 'text/html' });
};
