import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import type { Order } from "@shared/schema";
import { useRef, useEffect } from "react";
import SarIcon from "@/components/sar-icon";
import { printTaxInvoice } from "@/lib/print-utils";

interface ReceiptInvoiceProps {
  order: Order;
  variant?: "button" | "auto";
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً",
  pos: "جهاز نقاط البيع",
  delivery: "الدفع عند التوصيل",
  stc: "STC Pay",
  alinma: "الإنماء باي",
  ur: "يور باي",
  barq: "برق",
  rajhi: "الراجحي",
  "qahwa-card": "بطاقة قهوة",
  card: "بطاقة ائتمانية",
  apple_pay: "Apple Pay",
  geidea: "بطاقة إلكترونية",
  loyalty_points: "نقاط الولاء",
};

export function ReceiptInvoice({ order, variant = "button" }: ReceiptInvoiceProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const getItemsArray = (): any[] => {
    try {
      if (!order || !order.items) return [];
      const items = order.items;
      if (Array.isArray(items)) return items;
      if (typeof items === "string") {
        try {
          const parsed = JSON.parse(items);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      if (typeof items === "object" && items !== null) return Object.values(items);
      return [];
    } catch {
      return [];
    }
  };

  const items = getItemsArray();

  if (!order || !order.orderNumber) return null;

  const doPrint = async () => {
    const rawItems = getItemsArray();
    await printTaxInvoice({
      orderNumber: order.orderNumber,
      customerName: order.customerName || "",
      customerPhone: order.customerPhone || "",
      items: rawItems.map((item: any) => {
        const selectedAddons = item.customization?.selectedItemAddons || [];
        const addonsPrice = selectedAddons.reduce(
          (s: number, a: any) => s + (Number(a.price) || 0),
          0
        );
        return {
          coffeeItem: {
            nameAr: item.nameAr || item.coffeeItem?.nameAr || item.name || "",
            nameEn: item.nameEn || item.coffeeItem?.nameEn || "",
            price: String(
              Number(item.price || item.coffeeItem?.price || 0) + addonsPrice
            ),
          },
          quantity: Number(item.quantity) || 1,
          addons: selectedAddons.map((a: any) => ({
            nameAr: a.nameAr || "",
            price: Number(a.price) || 0,
          })),
        };
      }),
      subtotal: String((Number(order.totalAmount) / 1.15).toFixed(2)),
      total: String(order.totalAmount || 0),
      paymentMethod:
        PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod || "",
      employeeName: (order as any).employeeName || "",
      tableNumber: (order as any).tableNumber || undefined,
      orderType: order.orderType as any,
      date: order.createdAt ? String(order.createdAt) : new Date().toISOString(),
      vatNumber: "311234567890003",
    });
  };

  useEffect(() => {
    if (variant === "auto" && order?.id) {
      const t = setTimeout(() => { doPrint(); }, 800);
      return () => clearTimeout(t);
    }
  }, [variant, order?.id]);

  const generatePDF = async () => {
    if (!invoiceRef.current) return;
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write('<html><body>');
      printWindow.document.write(invoiceRef.current.outerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div
        ref={invoiceRef}
        style={{ direction: "rtl" }}
        className="bg-white rounded-none p-6 max-w-[80mm] mx-auto text-black text-[11px]"
        data-testid="invoice-preview"
      >
        <div className="text-center mb-3 pb-2 border-b border-black">
          <p
            className="font-bold text-black"
            style={{
              fontFamily: "'Cinzel', Georgia, serif",
              fontSize: 26,
              lineHeight: 1,
              letterSpacing: 6,
              textTransform: "uppercase",
            }}
          >
            CLUNY
          </p>
          <p
            className="font-bold text-black"
            style={{
              fontFamily: "'Cairo', sans-serif",
              fontSize: 14,
              letterSpacing: 3,
              lineHeight: 1.3,
              marginTop: 2,
              direction: "rtl",
            }}
          >
            كـلـونـي
          </p>
          <div className="flex items-center justify-center gap-2 my-[4px]">
            <span className="flex-1 h-px bg-black max-w-[36px]" />
            <span className="text-[9px] text-black" style={{ fontFamily: "'Cinzel', Georgia, serif", letterSpacing: 2 }}>cafe</span>
            <span className="w-1 h-1 rounded-full bg-black inline-block" />
            <span className="text-[9px] font-bold text-black" style={{ fontFamily: "'Cairo', sans-serif" }}>كافيه</span>
            <span className="flex-1 h-px bg-black max-w-[36px]" />
          </div>
          <p className="text-[8px] opacity-50 mt-1">فاتورة ضريبية مبسطة · Simplified Tax Invoice</p>
        </div>

        <div className="grid grid-cols-2 gap-1 mb-2 pb-2 border-b border-dashed border-black/20">
          <div className="space-y-0.5">
            <div className="flex justify-between gap-1">
              <span className="opacity-60">رقم الطلب:</span>
              <span className="font-mono font-bold">#{order.orderNumber.replace(/^ORD#|^ORD-/i, "")}</span>
            </div>
            <div className="flex justify-between gap-1">
              <span className="opacity-60">التاريخ:</span>
              <span>{new Date(order.createdAt).toLocaleDateString("ar-SA")}</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between gap-1">
              <span className="opacity-60">الوقت:</span>
              <span>{new Date(order.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {(order as any).tableNumber && (
              <div className="flex justify-between gap-1">
                <span className="opacity-60">الطاولة:</span>
                <span className="font-bold">#{(order as any).tableNumber}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-2 pb-2 border-b border-dashed border-black/20 space-y-0.5">
          <div className="flex justify-between gap-1">
            <span className="opacity-60">الرقم الضريبي:</span>
            <span className="font-mono font-bold" dir="ltr">311234567890003</span>
          </div>
          {order.customerName && (
            <div className="flex justify-between gap-1">
              <span className="opacity-60">العميل:</span>
              <span className="font-medium">{order.customerName}</span>
            </div>
          )}
        </div>

        <table className="w-full mb-2" style={{ fontSize: 10 }}>
          <thead>
            <tr className="border-b border-black">
              <th className="text-right py-1">المنتج</th>
              <th className="text-center py-1 w-8">كمية</th>
              <th className="text-left py-1 w-14">المجموع</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item: any, index: number) => {
              const inlineAddons = item.customization?.selectedItemAddons || [];
              const itemNameAr = item.nameAr || item.coffeeItem?.nameAr || item.name || "";
              const itemNameEn = item.nameEn || item.coffeeItem?.nameEn || "";
              const unitPrice = Number(item.price || item.coffeeItem?.price || 0);
              const addonsPrice = inlineAddons.reduce(
                (s: number, a: any) => s + (Number(a.price) || 0),
                0
              );
              const lineTotal = (unitPrice + addonsPrice) * (item.quantity || 1);
              return (
                <tr key={index}>
                  <td className="py-1 text-right">
                    <div className="font-medium">{itemNameAr}</div>
                    {itemNameEn && itemNameEn !== itemNameAr && (
                      <div className="text-[8px] text-gray-400">{itemNameEn}</div>
                    )}
                    {inlineAddons.length > 0 && (
                      <div className="text-[8px] text-gray-500">
                        + {inlineAddons.map((a: any) => a.nameAr).join("، ")}
                      </div>
                    )}
                  </td>
                  <td className="py-1 text-center">{item.quantity || 1}</td>
                  <td className="py-1 text-left font-medium">{lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-t border-black pt-1.5 space-y-0.5 mb-2">
          <div className="flex justify-between">
            <span className="opacity-60">المجموع الفرعي:</span>
            <span>{(Number(order.totalAmount) / 1.15).toFixed(2)} <SarIcon /></span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">ضريبة القيمة المضافة (15%):</span>
            <span>{(Number(order.totalAmount) - Number(order.totalAmount) / 1.15).toFixed(2)} <SarIcon /></span>
          </div>
          <div className="flex justify-between text-sm font-black border-t border-black mt-1 pt-1">
            <span>الإجمالي شامل الضريبة:</span>
            <span>{Number(order.totalAmount).toFixed(2)} <SarIcon /></span>
          </div>
          <div className="flex justify-between pt-0.5 text-[10px]">
            <span className="opacity-60">طريقة الدفع:</span>
            <span className="font-bold">{PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}</span>
          </div>
        </div>

        <div className="text-center pt-2 border-t border-black text-[9px] space-y-0.5">
          <p className="font-bold">شكراً لزيارتكم · Thank you</p>
          <p className="font-bold tracking-tight text-amber-800">www.cluny.cafe</p>
          <p className="opacity-50">جميع الأسعار شاملة ضريبة القيمة المضافة 15%</p>
        </div>
      </div>

      {variant === "button" && (
        <div className="flex gap-2 w-full no-print">
          <Button
            onClick={doPrint}
            className="flex-1 bg-primary hover:bg-primary/90"
            data-testid="button-print-invoice"
          >
            <Printer className="ml-2 h-4 w-4" />
            طباعة الفاتورة
          </Button>
          <Button
            onClick={generatePDF}
            variant="outline"
            className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300"
            data-testid="button-download-invoice"
          >
            <Download className="ml-2 h-4 w-4" />
            تحميل PDF
          </Button>
        </div>
      )}
    </div>
  );
}
