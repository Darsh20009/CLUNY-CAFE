import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Coffee, ArrowRight, User, Phone, Loader, CheckCircle } from "lucide-react";
import SarIcon from "@/components/sar-icon";

interface CartItem {
  item: {
    id: string;
    nameAr: string;
    price: number;
  };
  quantity: number;
}

interface PendingOrder {
  id: string;
  orderNumber?: string;
  status?: string;
  totalAmount?: number;
}

export default function TableCheckout() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/table-checkout/:tableId/:tableNumber");
  const { toast } = useToast();
  
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [isLoggedInCustomer, setIsLoggedInCustomer] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);

  const tableId = params?.tableId;
  const tableNumber = params?.tableNumber;

  // Auto-fill customer data if logged in
  useEffect(() => {
    const savedPhone = localStorage.getItem("customer-phone");
    const savedName = localStorage.getItem("customer-name");
    const customerId = localStorage.getItem("customer-id");

    if (savedPhone && savedName && customerId) {
      setCustomerPhone(savedPhone);
      setCustomerName(savedName);
      setIsLoggedInCustomer(true);
    }
  }, []);
  
  const rawCart = JSON.parse(sessionStorage.getItem(`cart_${tableId}`) || "[]");
  const cart: CartItem[] = rawCart.map((ci: any) => {
    if (ci.item) return ci;
    if (ci.coffeeItem) return { ...ci, item: ci.coffeeItem };
    return ci;
  }).filter((ci: any) => ci.item);
  const branchId = sessionStorage.getItem(`branchId_${tableId}`) || "";

  const getTotalPrice = () => {
    return cart.reduce((total, ci) => total + ci.item.price * ci.quantity, 0);
  };

  // Search for customer by phone
  const handlePhoneChange = async (phone: string) => {
    setCustomerPhone(phone);
    setPendingOrder(null);
    
    // Only search if phone has 9 digits (complete)
    if (phone.trim().length === 9) {
      setIsSearchingCustomer(true);
      try {
        const response = await fetch(`/api/customers/by-phone/${phone.trim()}`);
        if (response.ok) {
          const customer = await response.json();
          if (customer) {
            // Set customer name from either field
            const name = customer.name || customer.fullName;
            if (name) {
              setCustomerName(name);
              toast({
                title: "تم العثور على العميل",
                description: `مرحباً ${name}`,
              });
            }
            
            // Check for pending table order
            if (customer.pendingTableOrder) {
              setPendingOrder(customer.pendingTableOrder);
              toast({
                title: "لديك طلب معلق!",
                description: "يمكنك متابعة طلبك السابق أو إنشاء طلب جديد",
              });
            }
          }
        }
      } catch (error) {
        console.error("Error searching customer:", error);
      } finally {
        setIsSearchingCustomer(false);
      }
    }
  };

  const handleSubmitOrder = async () => {
    if (!customerName || customerName.trim() === "") {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال الاسم",
        variant: "destructive",
      });
      return;
    }

    if (!customerPhone || customerPhone.trim() === "") {
      toast({
        title: "خطأ",
        description: "رقم الجوال مطلوب",
        variant: "destructive",
      });
      return;
    }

    if (customerPhone.trim().length !== 9) {
      toast({
        title: "خطأ",
        description: "رقم الجوال يجب أن يكون 9 أرقام",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const orderData = {
        items: cart.map((ci) => ({
          id: ci.item.id,
          nameAr: ci.item.nameAr,
          price: ci.item.price,
          quantity: ci.quantity,
        })),
        totalAmount: getTotalPrice(),
        paymentMethod: "cash",
        status: "pending",
        orderType: "dine-in",
        tableNumber: tableNumber,
        tableId: tableId,
        branchId: branchId,
        tableStatus: "pending",
        customerInfo: {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
        },
      };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "فشل في إنشاء الطلب");
      }
      
      const order = await response.json();

      sessionStorage.removeItem(`cart_${tableId}`);
      sessionStorage.removeItem(`branchId_${tableId}`);

      toast({
        title: "تم إرسال الطلب بنجاح",
        description: "طلبك قيد المراجعة من قبل الكاشير. سيتم إعلامك بالتحديثات",
        duration: 7000,
        className: "bg-green-600 text-white border-green-700",
      });

      // Small delay before navigation to show the toast
      setTimeout(() => {
        navigate(`/table-order-tracking/${order.id}`);
      }, 500);
    } catch (error) {
      console.error("Error submitting order:", error);
      toast({
        title: "خطأ في إرسال الطلب",
        description: "حدث خطأ أثناء إرسال طلبك. يرجى المحاولة مرة أخرى أو التواصل مع الموظفين",
        variant: "destructive",
        duration: 8000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tableId || !tableNumber || cart.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Coffee className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">لا توجد عناصر في السلة</h2>
            <p className="text-muted-foreground mb-4">الرجاء إضافة عناصر للسلة أولاً</p>
            <Button onClick={() => navigate("/")}>العودة للصفحة الرئيسية</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col justify-center">
        <div className="mb-8 text-center bg-gradient-to-br from-amber-50 to-orange-100 p-8 rounded-2xl shadow-lg">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4 shadow-md">
            <Coffee className="w-10 h-10 text-accent" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-2">
            إتمام الطلب
          </h1>
          <p className="text-slate-700 font-semibold text-lg">
            طاولة رقم {tableNumber}
          </p>
        </div>

        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">ملخص الطلب</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cart.map((ci, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{ci.item.nameAr}</p>
                    <p className="text-sm text-muted-foreground">الكمية: {ci.quantity}</p>
                  </div>
                  <p className="font-bold text-lg text-foreground">
                    {(ci.item.price * ci.quantity).toFixed(2)} <SarIcon />
                  </p>
                </div>
              ))}
              
              <div className="flex justify-between items-center pt-4 border-t-2 border-primary/20">
                <span className="text-xl font-bold text-foreground">الإجمالي</span>
                <span className="text-2xl font-bold text-primary">
                  {getTotalPrice().toFixed(2)} <SarIcon />
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg bg-white border-2">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100">
            <CardTitle className="text-2xl text-slate-800">معلوماتك</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {isLoggedInCustomer && (
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">عميل مسجل</p>
                  <p className="text-sm text-green-700">تم ملء بيانات حسابك تلقائياً</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base flex items-center gap-2 font-semibold text-slate-700">
                <User className="w-5 h-5 text-accent" />
                الاسم *
              </Label>
              <Input
                id="name"
                placeholder="أدخل اسمك"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={isLoggedInCustomer}
                className="text-lg h-14 bg-white border-2 border-slate-300 focus:border-primary text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
                data-testid="input-name"
                autoFocus={!isLoggedInCustomer}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base flex items-center gap-2 font-semibold text-slate-700">
                <Phone className="w-5 h-5 text-accent" />
                رقم الجوال *
              </Label>
              <div className="relative">
                <Input
                  id="phone"
                  placeholder="5xxxxxxxx"
                  value={customerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  maxLength={9}
                  disabled={isSearchingCustomer || isLoggedInCustomer}
                  className="text-lg h-14 bg-white border-2 border-slate-300 focus:border-primary text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  data-testid="input-phone"
                />
                {isSearchingCustomer && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Loader className="w-5 h-5 text-accent animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {pendingOrder && (
              <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded-lg">
                <p className="text-sm text-blue-800 font-semibold mb-2">لديك طلب معلق:</p>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/table-order-tracking/${pendingOrder.id}`)}
                  className="w-full mb-2 text-blue-600 border-blue-300"
                  data-testid="button-track-pending-order"
                >
                  متابعة الطلب السابق
                </Button>
                <p className="text-xs text-blue-700">أو استمر بإنشاء طلب جديد أدناه</p>
              </div>
            )}

            <div className="bg-background border-2 border-primary p-5 rounded-lg">
              <p className="text-base text-slate-800 text-center font-semibold">
                سيتم الدفع عند الكاشير
              </p>
            </div>

            <Button
              onClick={handleSubmitOrder}
              disabled={isSubmitting}
              className="w-full h-14 text-lg font-bold shadow-lg"
              data-testid="button-submit-order"
            >
              {isSubmitting ? "جاري الإرسال..." : (
                <>
                  إرسال الطلب الجديد
                  <ArrowRight className="mr-2 w-5 h-5" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
