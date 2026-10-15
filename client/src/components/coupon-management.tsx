import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, ToggleLeft, ToggleRight, Ticket, Percent, Tag, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

interface ProductDiscountRule {
  productId: string;
  discountPercentage: number;
}

interface DiscountCode {
  id: string;
  _id?: string;
  code: string;
  discountPercentage: number;
  productDiscounts?: ProductDiscountRule[];
  reason: string;
  employeeId: string;
  isActive: number;
  usageCount?: number;
  usageLimit?: number | null;
  visibleToCustomers?: boolean;
  createdAt?: string;
}

interface CouponManagementProps {
  employeeId: string;
}

export function CouponManagement({ employeeId }: CouponManagementProps) {
  const { toast } = useToast();
  const tc = useTranslate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<DiscountCode | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productDiscountPercentage, setProductDiscountPercentage] = useState(10);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discountPercentage: 10,
    reason: "",
    visibleToCustomers: false,
    productDiscounts: [] as ProductDiscountRule[],
    usageLimit: "",
  });

  const { data: discountCodes = [], isLoading } = useQuery<DiscountCode[]>({
    queryKey: ['/api/discount-codes/employee', employeeId],
    enabled: !!employeeId,
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/coffee-items"],
    staleTime: 60000,
  });

  const saveCouponMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCoupon) {
        return await apiRequest('PATCH', `/api/discount-codes/${editingCoupon.id || editingCoupon._id}`, data);
      }
      return await apiRequest('POST', '/api/discount-codes', data);
    },
    onSuccess: () => {
      toast({
        title: editingCoupon ? tc("تم تحديث الكوبون", "Coupon updated") : tc("تم إنشاء الكوبون", "Coupon created"),
        description: editingCoupon ? tc("تم حفظ التعديلات", "Changes saved") : tc("تم إنشاء كود الخصم بنجاح", "Discount code created successfully"),
        className: "bg-green-600 text-white",
      });
      setIsAddDialogOpen(false);
      setEditingCoupon(null);
      setNewCoupon({ code: "", discountPercentage: 10, reason: "", visibleToCustomers: false, productDiscounts: [], usageLimit: "" });
      setSelectedProductId("");
      queryClient.invalidateQueries({ queryKey: ['/api/discount-codes/employee', employeeId] });
    },
    onError: (error: Error) => {
      toast({
        title: tc("خطأ", "Error"),
        description: error.message || tc("فشل في إنشاء كود الخصم", "Failed to create discount code"),
        variant: "destructive",
      });
    },
  });

  const deleteCouponMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/discount-codes/${id}`, { employeeId }),
    onSuccess: () => {
      toast({ title: tc("تم حذف الكوبون", "Coupon deleted") });
      queryClient.invalidateQueries({ queryKey: ['/api/discount-codes/employee', employeeId] });
    },
    onError: (error: Error) => toast({ title: tc("خطأ", "Error"), description: error.message, variant: "destructive" }),
  });

  const toggleCouponMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      return await apiRequest('PATCH', `/api/discount-codes/${id}`, { [field]: value, employeeId });
    },
    onSuccess: () => {
      toast({ title: tc("تم التحديث", "Updated"), description: tc("تم تحديث حالة الكوبون", "Coupon status updated") });
      queryClient.invalidateQueries({ queryKey: ['/api/discount-codes/employee', employeeId] });
    },
    onError: (error: Error) => {
      toast({ title: tc("خطأ", "Error"), description: error.message || tc("فشل في تحديث الكوبون", "Failed to update coupon"), variant: "destructive" });
    },
  });

  const handleSaveCoupon = () => {
    if (!newCoupon.code.trim()) {
      toast({ title: tc("خطأ", "Error"), description: tc("يرجى إدخال كود الخصم", "Please enter a discount code"), variant: "destructive" });
      return;
    }
    if ((!newCoupon.productDiscounts.length && newCoupon.discountPercentage <= 0) || newCoupon.discountPercentage > 100 || newCoupon.discountPercentage < 0) {
      toast({ title: tc("خطأ", "Error"), description: tc("نسبة الخصم يجب أن تكون بين 1 و 100", "Discount percentage must be between 1 and 100"), variant: "destructive" });
      return;
    }
    if (!newCoupon.reason.trim()) {
      toast({ title: tc("خطأ", "Error"), description: tc("يرجى إدخال سبب الخصم", "Please enter a discount reason"), variant: "destructive" });
      return;
    }
    saveCouponMutation.mutate({
      ...(editingCoupon ? {} : { code: newCoupon.code.toUpperCase() }),
      discountPercentage: newCoupon.discountPercentage,
      reason: newCoupon.reason.trim(),
      productDiscounts: newCoupon.productDiscounts,
      usageLimit: newCoupon.usageLimit ? Number(newCoupon.usageLimit) : null,
      visibleToCustomers: newCoupon.visibleToCustomers,
      employeeId,
    });
  };

  const addProductRule = () => {
    if (!selectedProductId) {
      toast({ title: tc("اختر منتجاً أولاً", "Choose a product first"), variant: "destructive" });
      return;
    }
    if (productDiscountPercentage <= 0 || productDiscountPercentage > 100) {
      toast({ title: tc("نسبة الخصم يجب أن تكون بين 1 و 100", "Discount must be between 1 and 100"), variant: "destructive" });
      return;
    }
    if (newCoupon.productDiscounts.some((rule) => rule.productId === selectedProductId)) {
      toast({ title: tc("تمت إضافة هذا المنتج بالفعل", "This product is already included"), variant: "destructive" });
      return;
    }
    setNewCoupon((current) => ({
      ...current,
      productDiscounts: [...current.productDiscounts, { productId: selectedProductId, discountPercentage: productDiscountPercentage }],
    }));
    setSelectedProductId("");
  };

  const startEditing = (coupon: DiscountCode) => {
    setEditingCoupon(coupon);
    setNewCoupon({
      code: coupon.code,
      discountPercentage: coupon.discountPercentage || 0,
      reason: coupon.reason || "",
      visibleToCustomers: !!coupon.visibleToCustomers,
      productDiscounts: coupon.productDiscounts || [],
      usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : "",
    });
    setIsAddDialogOpen(true);
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCoupon({ ...newCoupon, code });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          <span className="font-medium">{tc("أكواد الخصم الخاصة بك", "Your Discount Codes")}</span>
          <Badge variant="secondary">{discountCodes.length}</Badge>
        </div>
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              setEditingCoupon(null);
              setSelectedProductId("");
              setNewCoupon({ code: "", discountPercentage: 10, reason: "", visibleToCustomers: false, productDiscounts: [], usageLimit: "" });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button data-testid="button-add-coupon">
              <Plus className="w-4 h-4 ml-2" />
              {tc("إضافة كوبون", "Add Coupon")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingCoupon ? tc("تعديل كود الخصم", "Edit Discount Code") : tc("إنشاء كود خصم جديد", "Create New Discount Code")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">{tc("كود الخصم", "Discount Code")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    placeholder="WELCOME20"
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                    className="flex-1"
                    disabled={!!editingCoupon}
                    data-testid="input-coupon-code"
                  />
                  {!editingCoupon && <Button variant="outline" onClick={generateRandomCode} type="button">
                    {tc("توليد تلقائي", "Auto Generate")}
                  </Button>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentage">{tc("نسبة الخصم العامة (%)", "General discount (%)")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="percentage"
                    type="number"
                    min="1"
                    max="100"
                    value={newCoupon.discountPercentage}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discountPercentage: parseInt(e.target.value) || 0 })}
                    data-testid="input-coupon-percentage"
                  />
                  <Percent className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">{tc("تُطبق على كل المنتجات عند عدم اختيار منتجات محددة. عند إضافة منتجات، يطبق خصم كل منتج المحدد فقط.", "Applies to all products only when no products are selected. Once scoped, only each selected product's discount applies.")}</p>
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <div>
                  <Label>{tc("تحديد منتجات ونسبة مختلفة لكل منتج", "Choose products and a discount for each")}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{tc("المنتجات غير المحددة لن تحصل على خصم من هذا الكود.", "Products not selected will not receive this code's discount.")}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                  <select
                    value={selectedProductId}
                    onChange={(event) => setSelectedProductId(event.target.value)}
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    aria-label={tc("اختر المنتج", "Select product")}
                  >
                    <option value="">{tc("اختر منتجاً", "Select a product")}</option>
                    {products.map((product: any) => {
                      const productId = String(product.id || product._id || "");
                      const name = product.nameAr || product.nameEn || product.name || productId;
                      const alreadySelected = newCoupon.productDiscounts.some((rule) => rule.productId === productId);
                      return <option key={productId} value={productId} disabled={!productId || alreadySelected}>{name}</option>;
                    })}
                  </select>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={productDiscountPercentage}
                    onChange={(event) => setProductDiscountPercentage(Number(event.target.value) || 0)}
                    aria-label={tc("نسبة خصم المنتج", "Product discount percentage")}
                  />
                  <Button type="button" variant="outline" onClick={addProductRule} className="gap-1">
                    <Plus className="h-4 w-4" />{tc("إضافة", "Add")}
                  </Button>
                </div>
                {newCoupon.productDiscounts.length > 0 && (
                  <div className="space-y-2">
                    {newCoupon.productDiscounts.map((rule) => {
                      const product = products.find((item: any) => String(item.id || item._id || "") === rule.productId);
                      return (
                        <div key={rule.productId} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                          <span>{product?.nameAr || product?.nameEn || product?.name || rule.productId}</span>
                          <span className="flex items-center gap-2 font-semibold">
                            {rule.discountPercentage}% 
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-destructive"
                              onClick={() => setNewCoupon((current) => ({
                                ...current,
                                productDiscounts: current.productDiscounts.filter((item) => item.productId !== rule.productId),
                              }))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />{tc("إزالة", "Remove")}
                            </Button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="usage-limit">{tc("الحد الأقصى للاستخدام (اختياري)", "Usage limit (optional)")}</Label>
                <Input
                  id="usage-limit"
                  type="number"
                  min="1"
                  value={newCoupon.usageLimit}
                  onChange={(event) => setNewCoupon({ ...newCoupon, usageLimit: event.target.value })}
                  placeholder={tc("غير محدود", "Unlimited")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">{tc("سبب الخصم", "Discount Reason")}</Label>
                <Input
                  id="reason"
                  placeholder={tc("مثال: عرض الافتتاح، عميل مميز", "e.g. Opening offer, VIP customer")}
                  value={newCoupon.reason}
                  onChange={(e) => setNewCoupon({ ...newCoupon, reason: e.target.value })}
                  data-testid="input-coupon-reason"
                />
              </div>
              <div
                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${newCoupon.visibleToCustomers ? 'border-primary bg-primary/5' : 'border-dashed border-muted-foreground/30 bg-muted/30'}`}
                onClick={() => setNewCoupon({ ...newCoupon, visibleToCustomers: !newCoupon.visibleToCustomers })}
                data-testid="toggle-visible-to-customers"
              >
                <div className="flex items-center gap-3">
                  {newCoupon.visibleToCustomers ? (
                    <Eye className="w-5 h-5 text-primary" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-semibold text-sm">{tc("إظهار للعملاء", "Show to Customers")}</p>
                    <p className="text-xs text-muted-foreground">
                      {newCoupon.visibleToCustomers
                        ? tc('سيظهر هذا الكوبون في صفحة الدفع للعملاء', 'This coupon will appear on the checkout page for customers')
                        : tc('لن يظهر هذا الكوبون للعملاء (يُستخدم يدوياً فقط)', 'This coupon will not be visible to customers (manual use only)')}
                    </p>
                  </div>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors ${newCoupon.visibleToCustomers ? 'bg-primary' : 'bg-muted-foreground/30'} relative`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${newCoupon.visibleToCustomers ? 'left-5' : 'left-0.5'}`} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                {tc("إلغاء", "Cancel")}
              </Button>
              <Button
                onClick={handleSaveCoupon}
                disabled={saveCouponMutation.isPending}
                data-testid="button-confirm-create-coupon"
              >
                {saveCouponMutation.isPending ? tc("جاري الحفظ...", "Saving...") : editingCoupon ? tc("حفظ التعديلات", "Save changes") : tc("إنشاء", "Create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {discountCodes.length === 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="p-8 text-center">
            <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{tc("لم تقم بإنشاء أي أكواد خصم بعد", "You haven't created any discount codes yet")}</p>
            <p className="text-sm text-muted-foreground mt-1">{tc('اضغط على "إضافة كوبون" لإنشاء كود خصم جديد', 'Click "Add Coupon" to create a new discount code')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {discountCodes.map((code) => {
            const codeId = code.id || code._id || '';
            return (
              <Card key={codeId} className={`border ${code.isActive ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/10' : 'border-red-500/30 bg-red-50/50 dark:bg-red-950/10'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-primary" />
                      <span className="font-mono font-bold text-lg">{code.code}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {code.visibleToCustomers && (
                        <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] px-1.5 py-0.5 gap-0.5">
                          <Eye className="w-3 h-3" />
                          {tc("عام", "Public")}
                        </Badge>
                      )}
                      <Badge className={code.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {code.isActive ? tc('نشط', 'Active') : tc('معطل', 'Inactive')}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-muted-foreground" />
                      <span>{code.productDiscounts?.length ? tc("خصم حسب المنتج", "Product-specific discounts") : `${tc("خصم عام", "General discount")} ${code.discountPercentage}%`}</span>
                    </div>
                    {code.productDiscounts?.map((rule) => {
                      const product = products.find((item: any) => String(item.id || item._id || "") === rule.productId);
                      return (
                        <div key={rule.productId} className="flex justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{product?.nameAr || product?.nameEn || product?.name || rule.productId}</span>
                          <span className="shrink-0 font-semibold">{rule.discountPercentage}%</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{code.reason}</span>
                    </div>
                    {code.usageCount !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        {tc("تم الاستخدام:", "Used:")} {code.usageCount} {tc("مرة", "times")}
                        {code.usageLimit ? ` / ${code.usageLimit}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleCouponMutation.mutate({ id: codeId, field: 'isActive', value: code.isActive ? 0 : 1 })}
                      disabled={toggleCouponMutation.isPending}
                      data-testid={`button-toggle-coupon-${code.code}`}
                    >
                      {code.isActive ? <><ToggleRight className="w-4 h-4 ml-2" />{tc("تعطيل", "Disable")}</> : <><ToggleLeft className="w-4 h-4 ml-2" />{tc("تفعيل", "Enable")}</>}
                    </Button>
                    <Button
                      variant={code.visibleToCustomers ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleCouponMutation.mutate({ id: codeId, field: 'visibleToCustomers', value: !code.visibleToCustomers })}
                      disabled={toggleCouponMutation.isPending}
                      data-testid={`button-visibility-coupon-${code.code}`}
                    >
                      {code.visibleToCustomers ? <><EyeOff className="w-4 h-4 ml-2" />{tc("إخفاء", "Hide")}</> : <><Eye className="w-4 h-4 ml-2" />{tc("إظهار", "Show")}</>}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => startEditing(code)}
                      data-testid={`button-edit-coupon-${code.code}`}
                    >
                      <Pencil className="w-4 h-4 ml-2" />{tc("تعديل", "Edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (window.confirm(tc(`هل تريد حذف الكوبون ${code.code}؟`, `Delete coupon ${code.code}?`))) {
                          deleteCouponMutation.mutate(codeId);
                        }
                      }}
                      disabled={deleteCouponMutation.isPending}
                      data-testid={`button-delete-coupon-${code.code}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CouponManagement;
