import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { nanoid } from "nanoid";
import type { IProductAddon } from "@shared/schema";

const CATEGORIES = [
  { value: "sugar", labelAr: "سكر", labelEn: "Sugar" },
  { value: "milk", labelAr: "حليب", labelEn: "Milk" },
  { value: "shot", labelAr: "شوت", labelEn: "Shot" },
  { value: "syrup", labelAr: "شراب", labelEn: "Syrup" },
  { value: "topping", labelAr: "توبينج", labelEn: "Topping" },
  { value: "size", labelAr: "حجم", labelEn: "Size" },
  { value: "flavor", labelAr: "نكهة", labelEn: "Flavor" },
  { value: "other", labelAr: "أخرى", labelEn: "Other" },
];

const SINGLE_SELECT_BY_DEFAULT = ["sugar", "milk", "size"];

const CATEGORY_COLORS: Record<string, string> = {
  sugar: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  milk: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  shot: "bg-red-500/20 text-red-400 border-red-500/30",
  syrup: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  topping: "bg-green-500/20 text-green-400 border-green-500/30",
  size: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  flavor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  other: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

interface AddonFormData {
  id: string;
  nameAr: string;
  nameEn: string;
  category: string;
  price: number;
  isAvailable: number;
  isSingleSelect: boolean;
  orderIndex: number;
  menuCategory: string;
}

const emptyForm = (): AddonFormData => ({
  id: nanoid(8),
  nameAr: "",
  nameEn: "",
  category: "other",
  price: 0,
  isAvailable: 1,
  isSingleSelect: false,
  orderIndex: 0,
  menuCategory: "",
});

export default function AdminProductAddons() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<AddonFormData | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");

  const { data: addons = [], isLoading } = useQuery<IProductAddon[]>({
    queryKey: ["/api/product-addons-all"],
    queryFn: async () => {
      const res = await fetch("/api/product-addons-all");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: AddonFormData) =>
      apiRequest("POST", "/api/product-addons", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-addons-all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-addons"] });
      setDialogOpen(false);
      toast({ title: "تم إنشاء الإضافة بنجاح" });
    },
    onError: () => toast({ title: "فشل في إنشاء الإضافة", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AddonFormData> }) =>
      apiRequest("PUT", `/api/product-addons/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-addons-all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-addons"] });
      setDialogOpen(false);
      toast({ title: "تم تحديث الإضافة" });
    },
    onError: () => toast({ title: "فشل في تحديث الإضافة", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/product-addons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-addons-all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-addons"] });
      setDeleteId(null);
      toast({ title: "تم حذف الإضافة" });
    },
    onError: () => toast({ title: "فشل في حذف الإضافة", variant: "destructive" }),
  });

  const toggleSingleSelect = (addon: IProductAddon) => {
    updateMutation.mutate({
      id: (addon as any).id,
      data: { isSingleSelect: !(addon as any).isSingleSelect } as any,
    });
  };

  const toggleAvailable = (addon: IProductAddon) => {
    updateMutation.mutate({
      id: (addon as any).id,
      data: { isAvailable: addon.isAvailable === 1 ? 0 : 1 } as any,
    });
  };

  const openCreate = () => {
    setEditingAddon(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (addon: IProductAddon) => {
    setEditingAddon({
      id: (addon as any).id,
      nameAr: addon.nameAr,
      nameEn: addon.nameEn || "",
      category: (addon as any).category || "other",
      price: addon.price,
      isAvailable: addon.isAvailable,
      isSingleSelect: (addon as any).isSingleSelect || false,
      orderIndex: addon.orderIndex || 0,
      menuCategory: (addon as any).menuCategory || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingAddon) return;
    if (!editingAddon.nameAr.trim()) {
      toast({ title: "الاسم بالعربي مطلوب", variant: "destructive" });
      return;
    }
    const isNew = !addons.some((a: any) => a.id === editingAddon.id);
    if (isNew) {
      createMutation.mutate(editingAddon);
    } else {
      updateMutation.mutate({ id: editingAddon.id, data: editingAddon });
    }
  };

  const filteredAddons = filterCat === "all"
    ? addons
    : addons.filter((a: any) => a.category === filterCat);

  const grouped: Record<string, IProductAddon[]> = {};
  filteredAddons.forEach((a: any) => {
    const cat = a.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  });

  return (
    <div className="min-h-screen bg-[#0d0a08] p-6 text-white" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="button-back">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">إدارة الإضافات العامة</h1>
            <p className="text-sm text-gray-400">أضف وعدّل الإضافات التي تظهر للعملاء عند الطلب</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={filterCat === "all" ? "default" : "outline"}
              onClick={() => setFilterCat("all")}
              className="text-xs"
            >
              الكل ({addons.length})
            </Button>
            {CATEGORIES.map(cat => {
              const count = addons.filter((a: any) => a.category === cat.value).length;
              if (count === 0) return null;
              return (
                <Button
                  key={cat.value}
                  size="sm"
                  variant={filterCat === cat.value ? "default" : "outline"}
                  onClick={() => setFilterCat(cat.value)}
                  className="text-xs"
                  data-testid={`filter-${cat.value}`}
                >
                  {cat.labelAr} ({count})
                </Button>
              );
            })}
          </div>
          <Button onClick={openCreate} className="gap-2" data-testid="button-add-addon">
            <Plus className="w-4 h-4" />
            إضافة جديدة
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center text-gray-400 py-12">جاري التحميل...</div>
        ) : addons.length === 0 ? (
          <div className="text-center text-gray-400 py-12 border border-dashed border-gray-700 rounded-xl">
            <p className="text-lg mb-2">لا توجد إضافات بعد</p>
            <p className="text-sm">اضغط على "إضافة جديدة" لإنشاء أول إضافة</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, items]) => {
              const catInfo = CATEGORIES.find(c => c.value === cat);
              const catColor = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
              const anySingleSelect = items.some((a: any) => a.isSingleSelect);
              const isDefaultSingleSelect = SINGLE_SELECT_BY_DEFAULT.includes(cat);
              return (
                <div key={cat} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Badge className={`border ${catColor} text-xs px-2 py-0.5`}>
                      {catInfo?.labelAr || cat}
                    </Badge>
                    {(anySingleSelect || isDefaultSingleSelect) && (
                      <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-2 py-0.5">
                        اختر واحد فقط
                      </span>
                    )}
                    {isDefaultSingleSelect && !anySingleSelect && (
                      <span className="text-xs text-muted-foreground">(مفعّل افتراضياً لهذه الفئة)</span>
                    )}
                  </div>
                  <div className="rounded-xl border border-white/5 overflow-hidden">
                    {items.map((addon: any, idx) => (
                      <div
                        key={addon.id}
                        className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? "border-t border-white/5" : ""} ${addon.isAvailable === 0 ? "opacity-50" : ""}`}
                        data-testid={`addon-row-${addon.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{addon.nameAr}</p>
                          {addon.nameEn && <p className="text-xs text-gray-400">{addon.nameEn}</p>}
                          {addon.menuCategory && (
                            <p className="text-xs text-gray-500">قسم: {addon.menuCategory}</p>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-primary shrink-0">
                          {addon.price > 0 ? `${addon.price} ر.س` : "مجاني"}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-gray-400 ml-1">اختر واحد</span>
                          <Switch
                            checked={addon.isSingleSelect === true || SINGLE_SELECT_BY_DEFAULT.includes(addon.category)}
                            disabled={SINGLE_SELECT_BY_DEFAULT.includes(addon.category) || updateMutation.isPending}
                            onCheckedChange={() => !SINGLE_SELECT_BY_DEFAULT.includes(addon.category) && toggleSingleSelect(addon)}
                            data-testid={`switch-single-select-${addon.id}`}
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-gray-400 ml-1">متاح</span>
                          <Switch
                            checked={addon.isAvailable === 1}
                            onCheckedChange={() => toggleAvailable(addon)}
                            disabled={updateMutation.isPending}
                            data-testid={`switch-available-${addon.id}`}
                          />
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7 shrink-0"
                          onClick={() => openEdit(addon)}
                          data-testid={`button-edit-${addon.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7 shrink-0 text-red-400 hover:text-red-300"
                          onClick={() => setDeleteId(addon.id)}
                          data-testid={`button-delete-${addon.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#1a1410] border-primary/20 text-white max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingAddon && addons.some((a: any) => a.id === editingAddon.id) ? "تعديل الإضافة" : "إضافة جديدة"}
            </DialogTitle>
          </DialogHeader>
          {editingAddon && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>الاسم بالعربي *</Label>
                <Input
                  value={editingAddon.nameAr}
                  onChange={e => setEditingAddon({ ...editingAddon, nameAr: e.target.value })}
                  className="bg-[#0d0a08] border-primary/20"
                  placeholder="مثال: سكر بني"
                  data-testid="input-addon-name-ar"
                />
              </div>
              <div className="space-y-1.5">
                <Label>الاسم بالإنجليزي</Label>
                <Input
                  value={editingAddon.nameEn}
                  onChange={e => setEditingAddon({ ...editingAddon, nameEn: e.target.value })}
                  className="bg-[#0d0a08] border-primary/20"
                  placeholder="e.g. Brown Sugar"
                  data-testid="input-addon-name-en"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>الفئة</Label>
                  <Select
                    value={editingAddon.category}
                    onValueChange={val => setEditingAddon({ ...editingAddon, category: val })}
                  >
                    <SelectTrigger className="bg-[#0d0a08] border-primary/20" data-testid="select-addon-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.labelAr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>السعر (ر.س)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editingAddon.price}
                    onChange={e => setEditingAddon({ ...editingAddon, price: parseFloat(e.target.value) || 0 })}
                    className="bg-[#0d0a08] border-primary/20"
                    data-testid="input-addon-price"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>قسم القائمة (اختياري)</Label>
                <Input
                  value={editingAddon.menuCategory}
                  onChange={e => setEditingAddon({ ...editingAddon, menuCategory: e.target.value })}
                  className="bg-[#0d0a08] border-primary/20"
                  placeholder="اتركه فارغاً ليظهر لجميع الأصناف"
                  data-testid="input-addon-menu-category"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3">
                <div>
                  <p className="font-medium text-sm">اختر واحد فقط</p>
                  <p className="text-xs text-gray-400">
                    {SINGLE_SELECT_BY_DEFAULT.includes(editingAddon.category)
                      ? "مفعّل تلقائياً لهذه الفئة ولا يمكن تغييره"
                      : "عند التفعيل، لا يمكن للعميل اختيار أكثر من عنصر واحد من هذه الفئة"}
                  </p>
                </div>
                <Switch
                  checked={editingAddon.isSingleSelect || SINGLE_SELECT_BY_DEFAULT.includes(editingAddon.category)}
                  disabled={SINGLE_SELECT_BY_DEFAULT.includes(editingAddon.category)}
                  onCheckedChange={val => setEditingAddon({ ...editingAddon, isSingleSelect: val })}
                  data-testid="switch-form-single-select"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3">
                <p className="font-medium text-sm">متاح للعملاء</p>
                <Switch
                  checked={editingAddon.isAvailable === 1}
                  onCheckedChange={val => setEditingAddon({ ...editingAddon, isAvailable: val ? 1 : 0 })}
                  data-testid="switch-form-available"
                />
              </div>
              <div className="space-y-1.5">
                <Label>ترتيب الظهور</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingAddon.orderIndex}
                  onChange={e => setEditingAddon({ ...editingAddon, orderIndex: parseInt(e.target.value) || 0 })}
                  className="bg-[#0d0a08] border-primary/20"
                  data-testid="input-addon-order"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">إلغاء</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-addon"
            >
              {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-[#1a1410] border-red-500/20 text-white max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف الإضافة</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-400 py-2">هل تريد حذف هذه الإضافة؟ لن يمكن استعادتها.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
