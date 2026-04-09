import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Coffee, ArrowRight, ArrowLeft, CheckCircle, XCircle, Plus, Edit2, Trash2, Sparkles, Upload, ImageIcon, X, FlaskConical, AlertTriangle, Library } from "lucide-react";
import { ImageLibraryModal } from "@/components/ImageLibraryModal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getCoffeeImage } from "@/lib/coffee-data-clean";
import { nanoid } from "nanoid";
import { Checkbox } from "@/components/ui/checkbox";
import type { CoffeeItem, Employee, Ingredient, RawItem, RecipeItem, Branch } from "@shared/schema";
import { MobileBottomNav } from "@/components/MobileBottomNav";

interface RecipeIngredient {
  rawItemId: string;
  rawItem?: RawItem;
  quantity: number;
  unit: string;
}

interface BranchAvailability {
  branchId: string;
  isAvailable: number;
}

const UNIFIED_CATEGORIES = [
  { id: 'hot',        nameAr: 'مشروبات ساخنة' },
  { id: 'cold',       nameAr: 'مشروبات باردة' },
  { id: 'desserts',   nameAr: 'حلا والكيك'    },
  { id: 'bakery',     nameAr: 'المخبوزات'      },
  { id: 'sandwiches', nameAr: 'الساندوتشات'   },
];
const UNIFIED_CATEGORY_IDS = UNIFIED_CATEGORIES.map(c => c.id);
const LEGACY_FOOD_CATEGORIES = ['food', 'bakery', 'desserts', 'cake', 'croissant', 'sandwiches'];
const LEGACY_DRINK_CATEGORIES = ['hot', 'cold', 'specialty', 'drinks', 'basic', 'additional_drinks'];

interface MenuCategory {
  id: string;
  nameAr: string;
  nameEn?: string;
  icon?: string;
  department: 'drinks' | 'food';
  orderIndex: number;
}

export default function EmployeeMenuManagement() {
 const [, setLocation] = useLocation();
 const [employee, setEmployee] = useState<Employee | null>(null);
 const managementType = new URLSearchParams(window.location.search).get('type') === 'food' ? 'food' : 'drinks';
 const isFood = managementType === 'food';
 const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
 const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
 const [editingItem, setEditingItem] = useState<CoffeeItem | null>(null);
 const [editableSizes, setEditableSizes] = useState<Array<{nameAr: string; price: number}>>([]);
 const [editableAddons, setEditableAddons] = useState<Array<{nameAr: string; nameEn?: string; price: number; imageUrl?: string; category?: string; section?: string; isSingleSelect?: boolean}>>([]);
 const [addEditableAddons, setAddEditableAddons] = useState<Array<{nameAr: string; nameEn?: string; price: number; imageUrl?: string; category?: string; section?: string; isSingleSelect?: boolean}>>([]);
 const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
 const [isImageLibraryOpen, setIsImageLibraryOpen] = useState(false);
 const [imageLibraryContext, setImageLibraryContext] = useState<'add' | 'edit' | 'add-addon' | 'edit-addon'>('add');
  const [editingAddonImageIdx, setEditingAddonImageIdx] = useState<number>(-1);
 const [addImageUrls, setAddImageUrls] = useState<string[]>([]);
 const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
 const { toast } = useToast();
 const queryClient = useQueryClient();
 const [selectedIngredients, setSelectedIngredients] = useState<Array<{ingredientId: string, name: string, quantity: number, unit: string}>>([]);
 const [recipeItems, setRecipeItems] = useState<RecipeIngredient[]>([]);
 const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
 const [editingRecipeItem, setEditingRecipeItem] = useState<CoffeeItem | null>(null);
 const [addStep, setAddStep] = useState<1 | 2>(1);
 const [selectedCategory, setSelectedCategory] = useState<string>('hot');
 const [selectedCoffeeStrength, setSelectedCoffeeStrength] = useState<string>("classic");
 const [selectedBranches, setSelectedBranches] = useState<BranchAvailability[]>([]);
 const [skipRecipeConfirmOpen, setSkipRecipeConfirmOpen] = useState(false);
 const [step1Data, setStep1Data] = useState<{
   nameAr: string;
   nameEn: string;
   description: string;
   category: string;
   price: string;
   oldPrice: string;
   coffeeStrength: string;
   imageUrl?: string;
   imageUrls?: string[];
   branchAvailability?: BranchAvailability[];
   isGiftable?: boolean;
   availableSizes?: any[];
   addons?: any[];
 } | null>(null);
 
 const [sizeImages, setSizeImages] = useState<{[key: string]: string}>({});
 const [sizeFileInputs, setSizeFileInputs] = useState<{[key: string]: HTMLInputElement | null}>({});
 const [addonImages, setAddonImages] = useState<{[key: string]: string}>({});
 const [addonFileInputs, setAddonFileInputs] = useState<{[key: string]: HTMLInputElement | null}>({});
 const [addonFreeStatus, setAddonFreeStatus] = useState<{[key: string]: boolean}>({});

 useEffect(() => {
 const storedEmployee = localStorage.getItem("currentEmployee");
 if (storedEmployee) {
 setEmployee(JSON.parse(storedEmployee));
 } else {
 setLocation("/employee/gateway");
 }
 }, [setLocation]);

  const { data: coffeeItems = [], isLoading, refetch } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: menuCategories = [] } = useQuery<MenuCategory[]>({
    queryKey: ["/api/menu-categories"],
  });

  useEffect(() => {
    if (menuCategories.length > 0) {
      const firstCat = menuCategories[0];
      if (firstCat) setSelectedCategory(firstCat.id);
    }
  }, [menuCategories, isFood]);

 const { data: ingredients = [] } = useQuery<Ingredient[]>({
 queryKey: ["/api/ingredients"],
 });

 const { data: rawItems = [] } = useQuery<RawItem[]>({
   queryKey: ["/api/inventory/raw-items"],
   enabled: employee?.role === "manager",
 });

 const { data: allRecipes = [] } = useQuery<RecipeItem[]>({
   queryKey: ["/api/inventory/all-recipes"],
   enabled: employee?.role === "manager",
 });

 const { data: branches = [] } = useQuery<Branch[]>({
   queryKey: ["/api/branches"],
   enabled: employee?.role === "manager",
 });

 const calculateRecipeCost = (items: RecipeIngredient[]) => {
   if (items.length === 0) return { totalCost: 0, breakdown: [] };
   
   const breakdown: Array<{name: string, quantity: number, unit: string, unitCost: number, cost: number}> = [];
   let totalCost = 0;
   
   for (const item of items) {
     const rawItem = rawItems.find(r => r.id === item.rawItemId);
     if (rawItem) {
       const ingUnit = item.unit.toLowerCase();
       const rawUnit = rawItem.unit.toLowerCase();
       
       let convertedQuantity = item.quantity;
       
       if (rawUnit === 'kg' && ingUnit === 'g') {
         convertedQuantity = item.quantity / 1000;
       } else if (rawUnit === 'g' && ingUnit === 'kg') {
         convertedQuantity = item.quantity * 1000;
       } else if ((rawUnit === 'liter' || rawUnit === 'l') && ingUnit === 'ml') {
         convertedQuantity = item.quantity / 1000;
       } else if ((rawUnit === 'ml') && (ingUnit === 'liter' || ingUnit === 'l')) {
         convertedQuantity = item.quantity * 1000;
       }
       
       const itemCost = convertedQuantity * rawItem.unitCost;
       totalCost += itemCost;
       breakdown.push({
         name: rawItem.nameAr,
         quantity: item.quantity,
         unit: item.unit,
         unitCost: rawItem.unitCost,
         cost: itemCost
       });
     }
   }
   
   return { totalCost, breakdown };
 };

 const getProductRecipeCount = (coffeeItemId: string) => {
   return allRecipes.filter(r => r.coffeeItemId === coffeeItemId).length;
 };

 const getProductCOGS = (coffeeItemId: string) => {
   const productRecipes = allRecipes.filter(r => r.coffeeItemId === coffeeItemId);
   let totalCost = 0;
   for (const recipe of productRecipes) {
     const rawItem = rawItems.find(r => r.id === recipe.rawItemId);
     if (rawItem) {
       totalCost += recipe.quantity * rawItem.unitCost;
     }
   }
   return totalCost;
 };

 const calculatePreviewCost = () => {
   if (selectedIngredients.length === 0) return { totalCost: 0, breakdown: [], unmatched: [] };
   
   const breakdown: Array<{name: string, quantity: number, unit: string, unitCost: number, cost: number, rawUnit: string}> = [];
   const unmatched: string[] = [];
   let totalCost = 0;
   
   for (const ing of selectedIngredients) {
     const matchedRawItem = rawItems.find(ri => 
       ri.nameAr === ing.name || 
       ri.nameEn?.toLowerCase() === ing.name.toLowerCase()
     );
     
     if (matchedRawItem) {
       const ingUnit = ing.unit.toLowerCase();
       const rawUnit = matchedRawItem.unit.toLowerCase();
       
       let convertedQuantity = ing.quantity;
       
       if (rawUnit === 'kg' && ingUnit === 'g') {
         convertedQuantity = ing.quantity / 1000;
       } else if (rawUnit === 'g' && ingUnit === 'kg') {
         convertedQuantity = ing.quantity * 1000;
       } else if ((rawUnit === 'liter' || rawUnit === 'l') && ingUnit === 'ml') {
         convertedQuantity = ing.quantity / 1000;
       } else if ((rawUnit === 'ml') && (ingUnit === 'liter' || ingUnit === 'l')) {
         convertedQuantity = ing.quantity * 1000;
       }
       
       const itemCost = convertedQuantity * matchedRawItem.unitCost;
       totalCost += itemCost;
       breakdown.push({
         name: ing.name,
         quantity: ing.quantity,
         unit: ing.unit,
         unitCost: matchedRawItem.unitCost,
         rawUnit: matchedRawItem.unit,
         cost: itemCost
       });
     } else {
       unmatched.push(ing.name);
     }
   }
   
   return { totalCost, breakdown, unmatched };
 };

 const createItemMutation = useMutation({
 mutationFn: async (payload: { 
   itemData: any; 
   ingredientsList: Array<{ingredientId: string, quantity: number, unit: string}>;
   recipeList?: RecipeIngredient[];
 }) => {
   const { itemData, ingredientsList, recipeList } = payload;
   const res = await apiRequest("POST", "/api/coffee-items", itemData);
   const createdItem = await res.json();
   
   const newItemId = createdItem.id;
   
   // Create recipe items (new system using RawItems)
   if (newItemId && recipeList && recipeList.length > 0) {
     await apiRequest("POST", "/api/inventory/recipes/bulk", {
       coffeeItemId: newItemId,
       items: recipeList.map(r => ({
         rawItemId: r.rawItemId,
         quantity: r.quantity,
         unit: r.unit
       })),
       clearExisting: true
     });
   }
   
   // Legacy: Also create old-style ingredients if provided
   if (newItemId && ingredientsList.length > 0) {
     for (const ing of ingredientsList) {
       await apiRequest("POST", `/api/coffee-items/${newItemId}/ingredients`, {
         ingredientId: ing.ingredientId,
         quantity: ing.quantity,
         unit: ing.unit
       });
     }
   }
   
   return createdItem;
 },
 onSuccess: async () => {
   // Force a fresh refetch of all relevant data
   await Promise.all([
     queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] }),
     queryClient.invalidateQueries({ queryKey: ["/api/inventory/all-recipes"] }),
     refetch()
   ]);
   
   setIsAddDialogOpen(false);
   setSelectedIngredients([]);
   setRecipeItems([]);
   setSelectedBranches([]);
   setAddImageUrls([]);
   setAddStep(1);
   setStep1Data(null);
   setSelectedCategory("hot");
   setSelectedCoffeeStrength("classic");
   toast({
     title: "تم إضافة المشروب",
     description: "تم إضافة المشروب بنجاح إلى القائمة",
   });
 },
 onError: (error: any) => {
   toast({
     variant: "destructive",
     title: "فشل إضافة المشروب",
     description: error.message || "حدث خطأ أثناء إضافة المشروب",
   });
 },
 });

 const bulkRecipeMutation = useMutation({
   mutationFn: async (payload: { coffeeItemId: string; items: RecipeIngredient[]; clearExisting?: boolean }) => {
     const res = await apiRequest("POST", "/api/inventory/recipes/bulk", {
       coffeeItemId: payload.coffeeItemId,
       items: payload.items.map(r => ({
         rawItemId: r.rawItemId,
         quantity: r.quantity,
         unit: r.unit
       })),
       clearExisting: payload.clearExisting ?? true
     });
     return await res.json();
   },
   onSuccess: () => {
     queryClient.invalidateQueries({ queryKey: ["/api/inventory/all-recipes"] });
     setIsRecipeDialogOpen(false);
     setEditingRecipeItem(null);
     setRecipeItems([]);
     toast({
       title: "تم حفظ الوصفة",
       description: "تم حفظ مكونات الوصفة بنجاح",
     });
   },
   onError: (error: any) => {
     toast({
       variant: "destructive",
       title: "فشل حفظ الوصفة",
       description: error.message || "حدث خطأ أثناء حفظ الوصفة",
     });
   },
 });

 const updateAvailabilityMutation = useMutation({
 mutationFn: async ({ id, isAvailable, availabilityStatus }: { id: string; isAvailable?: number; availabilityStatus?: string }) => {
   // Get branchId from employee if available
   const branchId = employee?.branchId;
   
   const response = await fetch(`/api/coffee-items/${id}/availability`, {
     method: "PATCH",
     headers: {
       "Content-Type": "application/json",
     },
     credentials: 'include',
     body: JSON.stringify({ isAvailable, availabilityStatus, branchId }),
   });
 
 if (!response.ok) {
 throw new Error("Failed to update availability");
 }
 
 return response.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] });
 toast({
 title: "تم التحديث بنجاح",
 description: "تم تحديث حالة توفر المشروب",
 });
 },
 onError: () => {
 toast({
 title: "خطأ",
 description: "فشل تحديث حالة توفر المشروب",
 variant: "destructive",
 });
 },
 });

 const updateItemMutation = useMutation({
 mutationFn: async (data: { id: string; updates: any }) => {
 const res = await apiRequest("PUT", `/api/coffee-items/${data.id}`, data.updates);
 return await res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] });
 setIsEditDialogOpen(false);
 setEditingItem(null);
 toast({
 title: "تم التحديث",
 description: "تم تحديث المشروب بنجاح",
 });
 },
 onError: (error: any) => {
 toast({
 variant: "destructive",
 title: "فشل التحديث",
 description: error.message || "حدث خطأ أثناء تحديث المشروب",
 });
 },
 });

 const deleteItemMutation = useMutation({
 mutationFn: async (id: string) => {
   const res = await apiRequest("DELETE", `/api/coffee-items/${id}`);
   if (!res.ok) {
     const errorData = await res.json();
     throw new Error(errorData.error || "فشل في حذف المشروب");
   }
   return await res.json();
 },
 onSuccess: async () => {
   await queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] });
   if (typeof refetch === 'function') {
     await refetch();
   }
   setDeletingItemId(null);
   toast({
     title: "تم الحذف",
     description: "تم حذف المشروب بنجاح",
   });
 },
 onError: (error: any) => {
   setDeletingItemId(null);
   toast({
     variant: "destructive",
     title: "فشل الحذف",
     description: error.message || "حدث خطأ أثناء حذف المشروب. قد يكون المشروب مرتبطاً بطلبات حالية.",
   });
 },
 });

 const toggleNewProductMutation = useMutation({
 mutationFn: async ({ id, isNewProduct }: { id: string; isNewProduct: number }) => {
 const res = await apiRequest("PUT", `/api/coffee-items/${id}`, { isNewProduct });
 return await res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] });
 toast({
 title: "تم التحديث",
 description: "تم تحديث حالة المنتج الجديد",
 });
 },
 onError: (error: any) => {
 toast({
 variant: "destructive",
 title: "فشل التحديث",
 description: error.message || "حدث خطأ أثناء التحديث",
 });
 },
 });

 const handleToggleAvailability = (item: CoffeeItem) => {
 const newAvailability = item.isAvailable === 1 ? 0 : 1;
 updateAvailabilityMutation.mutate({ id: item.id, isAvailable: newAvailability });
 };

 const handleStatusChange = (id: string, status: string) => {
 updateAvailabilityMutation.mutate({ 
 id, 
 availabilityStatus: status 
 });
 };

 const handleStep1Submit = async (e: React.FormEvent<HTMLFormElement>) => {
   e.preventDefault();
   const formData = new FormData(e.currentTarget);
   
   const nameAr = formData.get("nameAr") as string;
   const price = formData.get("price") as string;
   
   if (!nameAr || !selectedCategory || !price) {
     toast({
       title: "خطأ",
       description: "يرجى ملء جميع الحقول المطلوبة",
       variant: "destructive"
     });
     return;
   }
   
   setStep1Data({
     nameAr,
     nameEn: formData.get("nameEn") as string || "",
     description: formData.get("description") as string || "",
     category: selectedCategory,
     price,
     oldPrice: formData.get("oldPrice") as string || "",
     coffeeStrength: selectedCoffeeStrength,
     imageUrl: addImageUrls[0] || step1Data?.imageUrl,
    imageUrls: addImageUrls.length > 0 ? addImageUrls : (step1Data?.imageUrls || []),
     branchAvailability: selectedBranches.length > 0 ? selectedBranches : undefined,
     isGiftable: false, // Default value, will be updated by UI if needed
     availableSizes: step1Data?.availableSizes || [],
     addons: addEditableAddons.filter(a => a.nameAr.trim()),
   });
   setAddStep(2);
 };

 const handleToggleBranch = (branchId: string, checked: boolean) => {
   if (checked) {
     setSelectedBranches([...selectedBranches, { branchId, isAvailable: 1 }]);
   } else {
     setSelectedBranches(selectedBranches.filter(b => b.branchId !== branchId));
   }
 };

 const handleConfirmSkipRecipe = () => {
   setSkipRecipeConfirmOpen(false);
   handleSkipIngredientsActual();
 };

 const handleSkipIngredientsActual = () => {
   if (!step1Data) return;
   
   const itemId = nanoid(10);
   const itemData = {
     id: itemId,
     nameAr: step1Data.nameAr,
     nameEn: step1Data.nameEn || undefined,
     description: step1Data.description,
     price: parseFloat(step1Data.price),
     oldPrice: step1Data.oldPrice ? parseFloat(step1Data.oldPrice) : undefined,
     category: step1Data.category,
     coffeeStrength: step1Data.coffeeStrength || "classic",
     imageUrl: step1Data.imageUrl,
     isAvailable: 1,
     availabilityStatus: "available",
     isNewProduct: 0,
     isGiftable: step1Data.isGiftable || false,
     availableSizes: step1Data.availableSizes || [],
     addons: (step1Data as any).addons || [],
     branchAvailability: step1Data.branchAvailability,
     hasRecipe: 0,
     requiresRecipe: 0,
   };

   createItemMutation.mutate({
     itemData,
     ingredientsList: [],
     recipeList: []
   });
 };

 const handleStep2Submit = () => {
   if (!step1Data) return;
   
   const itemId = nanoid(10);
   const hasRecipeItems = recipeItems.length > 0 || selectedIngredients.length > 0;
   
   const itemData = {
     id: itemId,
     nameAr: step1Data.nameAr,
     nameEn: step1Data.nameEn || undefined,
     description: step1Data.description,
     price: parseFloat(step1Data.price),
     oldPrice: step1Data.oldPrice ? parseFloat(step1Data.oldPrice) : undefined,
     category: step1Data.category,
     coffeeStrength: step1Data.coffeeStrength || "classic",
     imageUrl: step1Data.imageUrl,
     isAvailable: 1,
     availabilityStatus: "available",
     isNewProduct: 0,
     isGiftable: step1Data.isGiftable || false,
     availableSizes: step1Data.availableSizes || [],
     addons: (step1Data as any).addons || [],
     branchAvailability: step1Data.branchAvailability,
     hasRecipe: hasRecipeItems ? 1 : 0,
     requiresRecipe: 1,
   };

   createItemMutation.mutate({
     itemData,
     ingredientsList: selectedIngredients.map(ing => ({
       ingredientId: ing.ingredientId,
       quantity: ing.quantity,
       unit: ing.unit
     })),
     recipeList: recipeItems
   });
 };

 const handleSkipIngredients = () => {
   if (!step1Data) return;
   
   // Show confirmation dialog for admin override
   if (employee?.role === "manager") {
     setSkipRecipeConfirmOpen(true);
     return;
   }
   
   // Non-managers can skip directly
   handleSkipIngredientsActual();
 };

  const handleOpenRecipeEditor = (item: CoffeeItem) => {
   setEditingRecipeItem(item);
   // Load existing recipes for this item with rawItem reference
   const existingRecipes = allRecipes.filter(r => r.coffeeItemId === item.id);
   setRecipeItems(existingRecipes.map(r => {
     const raw = rawItems.find(ri => ri.id === r.rawItemId);
     return {
       rawItemId: r.rawItemId,
       rawItem: raw,
       quantity: r.quantity,
       unit: r.unit || raw?.unit || 'g' // Use stored unit or fallback to rawItem's unit
     };
   }));
   setIsRecipeDialogOpen(true);
 };

 const handleSaveRecipe = () => {
   if (!editingRecipeItem) return;
   
   if (recipeItems.length === 0) {
     toast({
       title: "خطأ",
       description: "يجب إضافة مكون واحد على الأقل للوصفة",
       variant: "destructive"
     });
     return;
   }
   
   bulkRecipeMutation.mutate({
     coffeeItemId: editingRecipeItem.id,
     items: recipeItems,
     clearExisting: true
   });
 };

 const handleSubmitEditItem = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 if (!editingItem) return;
 
 const formData = new FormData(e.currentTarget);
 

   const updates = {
     nameAr: formData.get("nameAr") as string,
     nameEn: formData.get("nameEn") as string || undefined,
     description: formData.get("description") as string,
     price: parseFloat(formData.get("price") as string),
     oldPrice: formData.get("oldPrice") ? parseFloat(formData.get("oldPrice") as string) : undefined,
     category: formData.get("category") as string,
     imageUrl: editImageUrls.length > 0 ? editImageUrls[0] : editingItem.imageUrl,
    imageUrls: editImageUrls.length > 0 ? editImageUrls : ((editingItem as any).imageUrls || []),
    addons: editableAddons,
     availableSizes: editableSizes,
   };

   updateItemMutation.mutate({ id: editingItem.id, updates });
 };

 const handleEdit = (item: CoffeeItem) => {
 setEditingItem(item);
 setEditableSizes(item.availableSizes || []);
 setEditableAddons(item.addons || []);
setEditImageUrls((item as any).imageUrls || (item.imageUrl ? [item.imageUrl] : []));
 setIsEditDialogOpen(true);
 };

 const handleDelete = (id: string) => {
 setDeletingItemId(id);
 };

 const confirmDelete = () => {
 if (deletingItemId) {
 deleteItemMutation.mutate(deletingItemId);
 }
 };

 const handleToggleNewProduct = (item: CoffeeItem) => {
 const newValue = item.isNewProduct === 1 ? 0 : 1;
 toggleNewProductMutation.mutate({ id: item.id, isNewProduct: newValue });
 };

 const legacyCategoryNames: Record<string, string> = {
 basic: "قهوة أساسية",
 hot: "قهوة ساخنة",
 cold: "قهوة باردة",
 specialty: "مشروبات إضافية",
 drinks: "المشروبات",
 desserts: "الحلويات",
 food: "المأكولات",
 bakery: "المخبوزات",
 };

 const dynamicCategoryIds = menuCategories.map(c => c.id);
 const dynamicCategoryNames: Record<string, string> = Object.fromEntries(
   menuCategories.map(c => [c.id, c.nameAr])
 );
 const unifiedCategoryNames: Record<string, string> = Object.fromEntries(
   UNIFIED_CATEGORIES.map(c => [c.id, c.nameAr])
 );
 const categoryNames: Record<string, string> = { ...legacyCategoryNames, ...unifiedCategoryNames, ...dynamicCategoryNames };

 const allowedCategories = [...UNIFIED_CATEGORY_IDS, ...LEGACY_FOOD_CATEGORIES, ...LEGACY_DRINK_CATEGORIES, ...dynamicCategoryIds];

 const filteredItems = coffeeItems.filter(item => allowedCategories.includes(item.category) || true);

 const categorizedItems = filteredItems.reduce((acc, item) => {
 if (!acc[item.category]) {
 acc[item.category] = [];
 }
 acc[item.category].push(item);
 return acc;
 }, {} as Record<string, CoffeeItem[]>);

 if (!employee) {
 return null;
 }

 return (
 <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background p-4 pb-20 sm:pb-4">
 {/* Header */}
         <div className="max-w-7xl mx-auto mb-6">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="flex items-center gap-3">
         <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center flex-shrink-0">
         <Coffee className="w-6 h-6 text-white" />
         </div>
         <div>
         <h1 className="text-2xl font-bold text-accent">إدارة القائمة</h1>
         <p className="text-gray-400 text-sm">تحديث حالة توفر المنتجات</p>
         </div>
         </div>
         <div className="flex flex-wrap gap-2">
 {employee?.role === "manager" && (
 <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
  setIsAddDialogOpen(open);
  if (open) {
    // Initialize step1Data when opening the dialog
    setStep1Data({
      nameAr: '',
      nameEn: '',
      description: '',
      category: 'hot',
      price: '0',
      oldPrice: '0',
      coffeeStrength: 'classic',
      availableSizes: [],
      addons: [],
      isGiftable: false
    });
    setAddStep(1);
  } else {
    setAddStep(1);
    setStep1Data(null);
    setSelectedIngredients([]);
    setAddImageUrls([]);
    setAddEditableAddons([]);
    setSelectedCategory("hot");
    setSelectedCoffeeStrength("classic");
  }
}}>
 <DialogTrigger asChild>
 <Button
 className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
 data-testid="button-add-item"
 >
 <Plus className="w-4 h-4 ml-2" />
 {isFood ? 'إضافة صنف جديد' : 'إضافة مشروب جديد'}
 </Button>
 </DialogTrigger>
 <DialogContent className="bg-[#2d1f1a] border-primary/20 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="text-accent">
   <div className="flex flex-col gap-3">
     <span>إضافة مشروب جديد</span>
     <div className="flex items-center gap-2 text-sm font-normal">
       <span className={`px-3 py-1 rounded-full ${addStep === 1 ? 'bg-background0 text-white' : 'bg-gray-600 text-gray-300'}`}>
         1. المعلومات الأساسية
       </span>
       <ArrowLeft className="w-4 h-4 text-gray-400" />
       <span className={`px-3 py-1 rounded-full ${addStep === 2 ? 'bg-background0 text-white' : 'bg-gray-600 text-gray-300'}`}>
         2. المكونات والوصفة
       </span>
     </div>
   </div>
 </DialogTitle>
 </DialogHeader>

 {addStep === 1 ? (
 <form onSubmit={handleStep1Submit} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="nameAr" className="text-gray-300">الاسم بالعربية *</Label>
 <Input
 id="nameAr"
 name="nameAr"
 required
 defaultValue={step1Data?.nameAr || ""}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-name-ar"
 />
 </div>
 <div>
 <Label htmlFor="nameEn" className="text-gray-300">الاسم بالإنجليزية</Label>
 <Input
 id="nameEn"
 name="nameEn"
 defaultValue={step1Data?.nameEn || ""}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-name-en"
 />
 </div>
 </div>

 <div>
 <Label htmlFor="description" className="text-gray-300">الوصف *</Label>
 <Textarea
 id="description"
 name="description"
 required
 defaultValue={step1Data?.description || ""}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-description"
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <Label htmlFor="category" className="text-gray-300">القسم *</Label>
                       <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                         <SelectTrigger className="bg-[#1a1410] border-primary/30 text-white" data-testid="select-category">
                           <SelectValue placeholder="اختر القسم" />
                         </SelectTrigger>
                         <SelectContent className="bg-[#2d1f1a] border-primary/20 text-white">
                           {UNIFIED_CATEGORIES.map(cat => (
                             <SelectItem key={cat.id} value={cat.id}>{cat.nameAr}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="flex items-center space-x-2 space-x-reverse pt-8">
                       <Switch 
                         id="isGiftable" 
                         checked={step1Data?.isGiftable || false}
                         onCheckedChange={(checked) => setStep1Data(prev => prev ? ({ ...prev, isGiftable: checked }) : null)}
                       />
                       <Label htmlFor="isGiftable" className="text-gray-300">قابل للإهداء</Label>
                     </div>
                   </div>

                   <div>
                   <Label htmlFor="price" className="text-gray-300">السعر (ريال) *</Label>
 <Input
 id="price"
 name="price"
 type="number"
 step="0.01"
 min="0"
 required
 defaultValue={step1Data?.price || ""}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-price"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="oldPrice" className="text-gray-300">السعر القديم (ريال)</Label>
 <Input
 id="oldPrice"
 name="oldPrice"
 type="number"
 step="0.01"
 min="0"
 defaultValue={step1Data?.oldPrice || ""}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-old-price"
 />
 </div>
<div>
 <Label className="text-gray-300">صور المشروب (حتى 5 صور)</Label>
 <div className="mt-2 space-y-2">
   <div className="flex flex-wrap gap-2">
     {addImageUrls.map((url, idx) => (
       <div key={idx} className="relative w-20 h-20">
         <img src={url.startsWith('/') ? url : ("/" + url)} alt={"صورة " + (idx+1)} className="w-full h-full object-cover rounded-lg border border-primary/30" />
         <button type="button" onClick={() => setAddImageUrls(addImageUrls.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-600 rounded-full w-5 h-5 flex items-center justify-center">
           <X className="w-3 h-3 text-white" />
         </button>
         {idx === 0 && <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-primary/80 text-white rounded-b-lg">رئيسية</span>}
       </div>
     ))}
     {addImageUrls.length < 5 && (
       <button type="button" onClick={() => { setImageLibraryContext("add"); setIsImageLibraryOpen(true); }} className="w-20 h-20 border-2 border-dashed border-primary/30 rounded-lg flex flex-col items-center justify-center text-accent/60 hover:text-accent hover:border-accent/50 transition-colors">
         <Plus className="w-5 h-5" />
         <span className="text-[10px] mt-1">إضافة</span>
       </button>
     )}
   </div>
   {addImageUrls.length === 0 && <p className="text-gray-500 text-xs">اختر صوراً من المكتبة. الصورة الأولى ستكون الرئيسية</p>}
 </div>
</div>
 </div>

 <div>
 <Label htmlFor="coffeeStrength" className="text-gray-300">قوة القهوة</Label>
 <Select value={selectedCoffeeStrength} onValueChange={setSelectedCoffeeStrength}>
 <SelectTrigger className="bg-[#1a1410] border-primary/30 text-white" data-testid="select-coffee-strength">
 <SelectValue placeholder="اختر قوة القهوة" />
 </SelectTrigger>
 <SelectContent className="bg-[#2d1f1a] border-primary/20 text-white">
 <SelectItem value="mild">خفيفة (1-4)</SelectItem>
 <SelectItem value="classic">كلاسيكية/العادي</SelectItem>
 <SelectItem value="medium">متوسطة (4-8)</SelectItem>
 <SelectItem value="strong">قوية (8-12)</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Inline Addons Section */}
<div className="space-y-2">
  <Label className="text-gray-300">الإضافات المتاحة (مع السعر)</Label>
  <div className="space-y-2">
    {addEditableAddons.map((addon, idx) => (
      <div key={idx} className="space-y-1.5 p-2 rounded-lg bg-[#1a1410]/50 border border-primary/10">
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => { setEditingAddonImageIdx(idx); setImageLibraryContext("add-addon"); setIsImageLibraryOpen(true); }}
            className="w-10 h-10 rounded-lg border-2 border-dashed border-primary/30 flex items-center justify-center shrink-0 overflow-hidden hover:border-accent/50 transition-colors"
            data-testid={"button-add-addon-img-" + idx}
          >
            {addon.imageUrl ? <img src={addon.imageUrl.startsWith('/') ? addon.imageUrl : '/' + addon.imageUrl} className="w-full h-full object-cover rounded-lg" alt="" /> : <Plus className="w-3 h-3 text-gray-500" />}
          </button>
          <Input
            type="text"
            placeholder="اسم الإضافة"
            value={addon.nameAr}
            onChange={(e) => { const next = [...addEditableAddons]; next[idx] = { ...next[idx], nameAr: e.target.value }; setAddEditableAddons(next); }}
            className="bg-[#1a1410] border-primary/30 text-white flex-1"
            data-testid={"input-add-addon-name-" + idx}
          />
          <Input
            type="number"
            placeholder="السعر"
            value={addon.price}
            onChange={(e) => { const next = [...addEditableAddons]; next[idx] = { ...next[idx], price: parseFloat(e.target.value) || 0 }; setAddEditableAddons(next); }}
            className="bg-[#1a1410] border-primary/30 text-white w-20"
            data-testid={"input-add-addon-price-" + idx}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAddEditableAddons(addEditableAddons.filter((_, i) => i !== idx))}
            className="border-red-500/30 text-red-500 shrink-0"
            data-testid={"button-remove-addon-" + idx}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            type="text"
            placeholder="العنوان / القسم (مثال: الحجم، النكهات) — اختياري"
            value={addon.section || ''}
            onChange={(e) => { const next = [...addEditableAddons]; next[idx] = { ...next[idx], section: e.target.value }; setAddEditableAddons(next); }}
            className="bg-[#1a1410] border-primary/20 text-white/70 text-xs h-7 flex-1"
            data-testid={"input-add-addon-section-" + idx}
          />
          <button
            type="button"
            onClick={() => { const next = [...addEditableAddons]; next[idx] = { ...next[idx], isSingleSelect: !next[idx].isSingleSelect }; setAddEditableAddons(next); }}
            className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${addon.isSingleSelect ? 'bg-accent/20 border-accent text-accent' : 'bg-transparent border-primary/20 text-gray-500'}`}
            data-testid={"button-add-addon-single-" + idx}
          >
            <span>{addon.isSingleSelect ? '✓' : '○'}</span>
            <span>اختر واحد</span>
          </button>
        </div>
      </div>
    ))}
  </div>
  <Button
    type="button"
    size="sm"
    variant="outline"
    onClick={() => setAddEditableAddons([...addEditableAddons, { nameAr: '', price: 0, imageUrl: '', category: 'other', section: '', isSingleSelect: false }])}
    className="border-green-500/30 text-green-400 w-full"
    data-testid="button-add-addon"
  >
    <Plus className="w-4 h-4 ml-1" />
    إضافة إضافة
  </Button>
</div>

{employee?.role === "manager" && branches.length > 0 && (
   <div>
     <Label className="text-gray-300">متوفر في الفروع</Label>
     <p className="text-gray-500 text-xs mb-2">اختر الفروع التي سيتوفر فيها هذا المنتج (اتركه فارغاً للتوفر في جميع الفروع)</p>
     <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto bg-[#1a1410] p-3 rounded-lg border border-primary/20">
       {branches.filter((b: any) => b.isActive === 1 || b.isActive === "1").map((branch: any) => {
         const branchId = branch.id;
         const isSelected = selectedBranches.some(sb => sb.branchId === branchId);
         return (
           <div key={branchId} className="flex items-center gap-2">
             <Checkbox
               id={`branch-${branchId}`}
               checked={isSelected}
               onCheckedChange={(checked) => handleToggleBranch(branchId, !!checked)}
               className="border-primary/50"
               data-testid={`checkbox-branch-${branchId}`}
             />
             <label htmlFor={`branch-${branchId}`} className="text-gray-300 text-sm cursor-pointer">
               {branch.nameAr}
             </label>
           </div>
         );
       })}
     </div>
   </div>
 )}

 <div className="flex justify-end gap-2">
 <Button
 type="button"
 variant="outline"
 onClick={() => { setIsAddDialogOpen(false); setAddImageUrls([]); setAddEditableAddons([]); setSelectedIngredients([]); setRecipeItems([]); setSelectedBranches([]); setAddStep(1); setStep1Data(null); setSelectedCategory("hot"); setSelectedCoffeeStrength("classic"); }}
 className="border-gray-600 text-gray-300"
 data-testid="button-cancel"
 >
 إلغاء
 </Button>
 <Button
 type="submit"
  className="bg-gradient-to-r from-amber-500 to-amber-700"
 data-testid="button-next"
 >
 "التالي: إضافة المكونات"
 <ArrowLeft className="w-4 h-4 mr-2" />
 </Button>
 </div>
 </form>
 ) : (
 <div className="space-y-4">
   <div className="bg-[#1a1410] p-4 rounded-lg border border-primary/20">
     <p className="text-gray-400 text-sm mb-1">المشروب:</p>
     <p className="text-accent font-bold text-lg">{step1Data?.nameAr}</p>
     <p className="text-gray-500 text-sm">{step1Data?.category && categoryNames[step1Data.category as keyof typeof categoryNames]} • {step1Data?.price} ريال</p>
   </div>

   <div className="border-t border-primary/20 pt-4">
     <Label className="text-gray-300 text-lg flex items-center gap-2">
       <FlaskConical className="w-5 h-5" />
       وصفة المنتج (المواد الخام)
     </Label>
     <p className="text-gray-500 text-sm mb-3">اختر المواد الخام اللازمة لتحضير المشروب مع الكميات</p>
     
     {employee?.role === "manager" && rawItems.length > 0 ? (
       <>
         <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
           {rawItems.filter(r => r.isActive === 1).map((raw) => {
             const isSelected = recipeItems.some(s => s.rawItemId === raw.id);
             const selected = recipeItems.find(s => s.rawItemId === raw.id);
             
             return (
               <div key={raw.id} className="flex items-center gap-3 p-2 bg-[#1a1410] rounded-lg border border-primary/10">
                 <Checkbox
                   id={`raw-step2-${raw.id}`}
                   checked={isSelected}
                   onCheckedChange={(checked) => {
                     if (checked) {
                       setRecipeItems([...recipeItems, {
                         rawItemId: raw.id,
                         rawItem: raw,
                         quantity: 10,
                         unit: raw.unit
                       }]);
                     } else {
                       setRecipeItems(recipeItems.filter(s => s.rawItemId !== raw.id));
                     }
                   }}
                   className="border-primary/50"
                   data-testid={`checkbox-raw-${raw.id}`}
                 />
                 <label htmlFor={`raw-step2-${raw.id}`} className="text-gray-300 flex-1 cursor-pointer">
                   <span>{raw.nameAr}</span>
                   <span className="text-gray-500 text-xs mr-2">({raw.unitCost.toFixed(2)} ريال/{raw.unit})</span>
                 </label>
                 {isSelected && (
                   <div className="flex items-center gap-2">
                     <Input
                       type="number"
                       min="0.1"
                       step="0.1"
                       value={selected?.quantity || 10}
                       onChange={(e) => {
                         setRecipeItems(recipeItems.map(s =>
                           s.rawItemId === raw.id ? { ...s, quantity: parseFloat(e.target.value) || 0 } : s
                         ));
                       }}
                       className="w-20 bg-[#2d1f1a] border-primary/30 text-white text-center"
                       data-testid={`input-qty-raw-${raw.id}`}
                     />
                     <Select
                       value={selected?.unit || raw.unit}
                       onValueChange={(value) => {
                         setRecipeItems(recipeItems.map(s =>
                           s.rawItemId === raw.id ? { ...s, unit: value } : s
                         ));
                       }}
                     >
                       <SelectTrigger className="w-20 bg-[#2d1f1a] border-primary/30 text-white" data-testid={`select-unit-raw-${raw.id}`}>
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="bg-[#2d1f1a] border-primary/20 text-white">
                         <SelectItem value="g">جرام</SelectItem>
                         <SelectItem value="ml">مل</SelectItem>
                         <SelectItem value="kg">كجم</SelectItem>
                         <SelectItem value="liter">لتر</SelectItem>
                         <SelectItem value="piece">قطعة</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                 )}
               </div>
             );
           })}
         </div>
         
         {recipeItems.length > 0 && (
           <div className="flex flex-wrap gap-2 mb-2">
             {recipeItems.map((item) => {
               const raw = rawItems.find(r => r.id === item.rawItemId);
               return (
                 <Badge key={item.rawItemId} className="bg-green-500/20 text-green-400 border border-green-500/30">
                   {raw?.nameAr}: {item.quantity} {item.unit}
                   <button
                     type="button"
                     onClick={() => setRecipeItems(recipeItems.filter(s => s.rawItemId !== item.rawItemId))}
                     className="mr-1 hover:text-red-400"
                   >
                     <X className="w-3 h-3" />
                   </button>
                 </Badge>
               );
             })}
           </div>
         )}

         {recipeItems.length > 0 && (
           <div className="bg-gradient-to-r from-background to-background p-4 rounded-lg border border-green-500/30 mt-3" data-testid="recipe-cost-preview">
             {(() => {
               const { totalCost, breakdown } = calculateRecipeCost(recipeItems);
               const sellingPrice = step1Data?.price ? parseFloat(step1Data.price) : 0;
               const grossProfit = sellingPrice - totalCost;
               const profitMargin = sellingPrice > 0 ? ((grossProfit / sellingPrice) * 100) : 0;
               
               return (
                 <>
                   <div className="flex items-center justify-between mb-3">
                     <span className="text-gray-300 font-medium flex items-center gap-2">
                       <FlaskConical className="w-4 h-4 text-green-400" />
                       تكلفة الوصفة التقديرية
                     </span>
                   </div>
                   
                   {breakdown.length > 0 && (
                     <div className="space-y-1 mb-3 text-sm">
                       {breakdown.map((item, idx) => (
                         <div key={idx} className="flex justify-between text-gray-400">
                           <span>{item.name} ({item.quantity} {item.unit})</span>
                           <span>{item.cost.toFixed(2)} ريال</span>
                         </div>
                       ))}
                     </div>
                   )}
                   
                   <div className="border-t border-green-500/20 pt-3 space-y-2">
                     <div className="flex justify-between items-center">
                       <span className="text-gray-300">تكلفة الوصفة (COGS):</span>
                       <span className="text-green-400 font-bold" data-testid="text-recipe-cost">{totalCost.toFixed(2)} ريال</span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-gray-300">سعر البيع:</span>
                       <span className="text-white font-bold">{sellingPrice.toFixed(2)} ريال</span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-gray-300">هامش الربح:</span>
                       <span className={`font-bold ${grossProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-profit-margin">
                         {grossProfit.toFixed(2)} ريال ({profitMargin.toFixed(1)}%)
                       </span>
                     </div>
                   </div>
                 </>
               );
             })()}
           </div>
         )}
         
         {recipeItems.length === 0 && (
           <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
             <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
             <div>
               <p className="text-yellow-400 text-sm font-medium">تنبيه: لم يتم إضافة وصفة</p>
               <p className="text-yellow-500/80 text-xs">المنتجات بدون وصفة لن يتم خصمها من المخزون عند البيع.</p>
             </div>
           </div>
         )}
       </>
     ) : (
       <div className="bg-gray-800/50 rounded-lg p-4 text-center">
         <p className="text-gray-400 text-sm">الوصفات متاحة للمديرين فقط</p>
         <p className="text-gray-500 text-xs mt-1">أو لا توجد مواد خام متاحة</p>
       </div>
     )}
   </div>

   <div className="flex justify-between gap-2">
     <Button
       type="button"
       variant="outline"
       onClick={() => setAddStep(1)}
       className="border-primary/30 text-accent"
       data-testid="button-back-step"
     >
       <ArrowRight className="w-4 h-4 ml-2" />
       السابق
     </Button>
     <div className="flex gap-2">
       <Button
         type="button"
         variant="outline"
         onClick={handleSkipIngredients}
         disabled={createItemMutation.isPending}
         className="border-gray-600 text-gray-300"
         data-testid="button-skip"
       >
         {createItemMutation.isPending ? "جاري الإضافة..." : "تخطي المكونات"}
       </Button>
       <Button
         type="button"
         onClick={handleStep2Submit}
         disabled={createItemMutation.isPending || (recipeItems.length === 0 && selectedIngredients.length === 0)}
         className="bg-gradient-to-r from-green-500 to-green-700"
         data-testid="button-submit"
       >
         {createItemMutation.isPending ? "جاري الإضافة..." : "إضافة المشروب"}
       </Button>
     </div>
   </div>
 </div>
 )}
 </DialogContent>
 </Dialog>
 )}
 <Button
 variant="outline"
 onClick={() => setLocation("/employee/ingredients")}
 className="border-primary/50 text-accent hover:bg-background0 hover:text-white"
 data-testid="button-ingredients"
 >
 إدارةالمكونات
 </Button>
 <Button
 variant="outline"
 onClick={() => setLocation("/employee/dashboard")}
 className="border-primary/50 text-accent hover:bg-background0 hover:text-white"
 data-testid="button-back"
 >
 <ArrowRight className="w-4 h-4 ml-2" />
 العودةللوحةالتحكم
 </Button>
 </div>
 </div>
 </div>

 {/* Content */}
 <div className="max-w-7xl mx-auto space-y-6">
 {isLoading ? (
 <div className="text-center text-accent py-12">
 <Coffee className="w-12 h-12 animate-spin mx-auto mb-4" />
 <p>{isFood ? 'جاري تحميل المأكولات...' : 'جاري تحميل المشروبات...'}</p>
 </div>
 ) : (
 Object.entries(categorizedItems).map(([category, items]) => (
 <Card key={category} className="bg-[#2d1f1a] border-primary/20">
 <CardHeader>
 <CardTitle className="text-accent text-right text-xl">
 {categoryNames[category as keyof typeof categoryNames] || category}
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {items.map((item) => (
 <div
 key={item.id}
 className="flex items-center justify-between p-4 bg-[#1a1410] rounded-lg border border-primary/10 hover:border-primary/30 transition-all"
 data-testid={`item-${item.id}`}
 >
 <div className="flex items-center gap-4 flex-1">
 <img
 src={item.imageUrl ? (item.imageUrl.startsWith('/') ? item.imageUrl : `/${item.imageUrl}`) : getCoffeeImage(item.id)}
 alt={item.nameAr}
 className="w-16 h-16 rounded-lg object-cover"
 onError={(e) => {
 e.currentTarget.src = getCoffeeImage(item.id);
 }}
 data-testid={`img-${item.id}`}
 />
 <div className="flex-1">
 <h3 className="text-lg font-bold text-accent" data-testid={`text-name-${item.id}`}>
 {item.nameAr}
 </h3>
 <p className="text-gray-400 text-sm">{item.nameEn}</p>
 <div className="flex items-center gap-2 mt-1">
 <span className="text-accent font-bold" data-testid={`text-price-${item.id}`}>
 {parseFloat(String(item.price)).toFixed(2)} ريال
 </span>
 {item.coffeeStrength && item.coffeeStrength !== "classic" && (
 <Badge variant="outline" className="text-xs border-primary/30 text-gray-400">
 {item.coffeeStrength === "strong" && "قوي"}
 {item.coffeeStrength === "medium" && "متوسط"}
 {item.coffeeStrength === "mild" && "خفيف"}
 </Badge>
 )}
 </div>
 </div>
 </div>

 <div className="flex items-center gap-4">
 <div className="text-right flex flex-col gap-2">
 <Badge
 className={
 item.availabilityStatus === 'available' ? "bg-green-500" :
 item.availabilityStatus === 'out_of_stock' ? "bg-red-500" :
 item.availabilityStatus === 'coming_soon' ? "bg-blue-500" :
 "bg-background0"
 }
 data-testid={`badge-status-${item.id}`}
 >
 {item.availabilityStatus === 'available' && (
 <>
 <CheckCircle className="w-4 h-4 ml-1" />
 متوفر
 </>
 )}
 {item.availabilityStatus === 'out_of_stock' && (
 <>
 <XCircle className="w-4 h-4 ml-1" />
 نفذت الكمية 
 </>
 )}
 {item.availabilityStatus === 'coming_soon' && (
 <>
 <Coffee className="w-4 h-4 ml-1" />
 قريباً
 </>
 )}
 {item.availabilityStatus === 'temporarily_unavailable' && (
 <>
 <XCircle className="w-4 h-4 ml-1" />
 غير متوفر مؤقتاً
 </>
 )}
 </Badge>
 
 <select
 value={item.availabilityStatus || 'available'}
 onChange={(e) => handleStatusChange(item.id, e.target.value)}
 disabled={updateAvailabilityMutation.isPending}
 className="bg-[#1a1410] border border-primary/30 rounded-lg px-3 py-1 text-sm text-accent"
 data-testid={`select-status-${item.id}`}
 >
 <option value="available"> متوفر</option>
 <option value="out_of_stock"> نفذت الكمية </option>
 <option value="temporarily_unavailable">⏸ غير متوفر مؤقتاً</option>
 <option value="coming_soon"> قريباً</option>
 </select>
 </div>

 {employee?.role === "manager" && (
 <div className="flex flex-col gap-2">
 <div className="flex items-center gap-2">
   {getProductRecipeCount(item.id) > 0 ? (
     <Badge className="bg-green-600/20 text-green-400 border-green-500/30 text-xs">
       <FlaskConical className="w-3 h-3 ml-1" />
       {getProductRecipeCount(item.id)} مكون
     </Badge>
   ) : (
     <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 text-xs">
       بدون وصفة
     </Badge>
   )}
 </div>
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleToggleNewProduct(item)}
 className={`${
 item.isNewProduct === 1
 ? "bg-yellow-500 border-yellow-500 text-white"
 : "border-primary/30 text-accent"
 }`}
 disabled={toggleNewProductMutation.isPending}
 data-testid={`button-toggle-new-${item.id}`}
 >
 <Sparkles className="w-4 h-4 ml-1" />
 {item.isNewProduct === 1 ? "منتج جديد" : "جديد؟"}
 </Button>
 <div className="flex gap-1">
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleOpenRecipeEditor(item)}
 className="border-green-500/30 text-green-400 hover:bg-green-600 hover:text-white flex-1"
 data-testid={`button-recipe-${item.id}`}
 >
 <FlaskConical className="w-4 h-4" />
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleEdit(item)}
 className="border-blue-500/30 text-blue-500 hover:bg-blue-500 hover:text-white flex-1"
 data-testid={`button-edit-${item.id}`}
 >
 <Edit2 className="w-4 h-4" />
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleDelete(item.id)}
 className="border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white flex-1"
 data-testid={`button-delete-${item.id}`}
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 </div>
 </div>
 )}
 </div>
 </div>
 ))}
 </CardContent>
 </Card>
 ))
 )}
 </div>

 {/* Edit Dialog */}
 <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
 <DialogContent className="bg-[#2d1f1a] border-primary/20 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="text-accent">تعديل المشروب</DialogTitle>
 </DialogHeader>
 {editingItem && (
 <form onSubmit={handleSubmitEditItem} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="edit-nameAr" className="text-gray-300">الاسم بالعربية *</Label>
 <Input
 id="edit-nameAr"
 name="nameAr"
 defaultValue={editingItem.nameAr}
 required
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-name-ar"
 />
 </div>
 <div>
 <Label htmlFor="edit-nameEn" className="text-gray-300">الاسم بالإنجليزية</Label>
 <Input
 id="edit-nameEn"
 name="nameEn"
 defaultValue={editingItem.nameEn}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-name-en"
 />
 </div>
 </div>

 <div>
 <Label htmlFor="edit-description" className="text-gray-300">الوصف *</Label>
 <Textarea
 id="edit-description"
 name="description"
 defaultValue={editingItem.description}
 required
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-description"
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="edit-category" className="text-gray-300">القسم *</Label>
 <Select name="category" defaultValue={editingItem.category} required>
 <SelectTrigger className="bg-[#1a1410] border-primary/30 text-white" data-testid="select-edit-category">
 <SelectValue placeholder="اختر القسم" />
 </SelectTrigger>
 <SelectContent className="bg-[#2d1f1a] border-primary/20 text-white">
 {UNIFIED_CATEGORIES.map(cat => (
   <SelectItem key={cat.id} value={cat.id}>{cat.nameAr}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label htmlFor="edit-price" className="text-gray-300">السعر (ريال) *</Label>
 <Input
 id="edit-price"
 name="price"
 type="number"
 step="0.01"
 min="0"
 defaultValue={editingItem.price}
 required
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-price"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="edit-oldPrice" className="text-gray-300">السعر القديم (ريال)</Label>
 <Input
 id="edit-oldPrice"
 name="oldPrice"
 type="number"
 step="0.01"
 min="0"
 defaultValue={editingItem.oldPrice}
 className="bg-[#1a1410] border-primary/30 text-white"
 data-testid="input-edit-old-price"
 />
 </div>
<div>
<Label className="text-gray-300">صور المشروب (حتى 5 صور)</Label>
<div className="mt-2 space-y-2">
  <div className="flex flex-wrap gap-2">
    {editImageUrls.map((url, idx) => (
      <div key={idx} className="relative w-16 h-16">
        <img src={url.startsWith('/') ? url : ("/" + url)} alt={"صورة " + (idx+1)} className="w-full h-full object-cover rounded-lg border border-primary/30" />
        <button type="button" onClick={() => setEditImageUrls(editImageUrls.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-600 rounded-full w-4 h-4 flex items-center justify-center">
          <X className="w-3 h-3 text-white" />
        </button>
        {idx === 0 && <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-primary/80 text-white rounded-b-lg">رئيسية</span>}
      </div>
    ))}
    {editImageUrls.length < 5 && (
      <button type="button" onClick={() => { setImageLibraryContext("edit"); setIsImageLibraryOpen(true); }} className="w-16 h-16 border-2 border-dashed border-primary/30 rounded-lg flex flex-col items-center justify-center text-accent/60 hover:text-accent hover:border-accent/50 transition-colors">
        <Plus className="w-4 h-4" />
        <span className="text-[10px] mt-1">إضافة</span>
      </button>
    )}
  </div>
  {editImageUrls.length === 0 && <p className="text-gray-500 text-xs">اختر صوراً من المكتبة. الصورة الأولى ستكون الرئيسية</p>}
</div>
</div>
 </div>

 {/* Editable Sizes */}
 <div className="space-y-2">
   <Label className="text-gray-300">الأحجام المتاحة</Label>
   <div className="space-y-2">
     {editableSizes.map((size, idx) => (
       <div key={idx} className="flex gap-2 items-end">
         <Input
           type="text"
           placeholder="اسم الحجم"
           value={size.nameAr}
           onChange={(e) => {
             const newSizes = [...editableSizes];
             newSizes[idx].nameAr = e.target.value;
             setEditableSizes(newSizes);
           }}
           className="bg-[#1a1410] border-primary/30 text-white flex-1"
           data-testid={`input-edit-size-name-${idx}`}
         />
         <Input
           type="number"
           placeholder="السعر"
           value={size.price}
           onChange={(e) => {
             const newSizes = [...editableSizes];
             newSizes[idx].price = parseFloat(e.target.value) || 0;
             setEditableSizes(newSizes);
           }}
           className="bg-[#1a1410] border-primary/30 text-white w-24"
           data-testid={`input-edit-size-price-${idx}`}
         />
         <Button
           type="button"
           size="sm"
           variant="outline"
           onClick={() => setEditableSizes(editableSizes.filter((_, i) => i !== idx))}
           className="border-red-500/30 text-red-500"
           data-testid={`button-delete-size-${idx}`}
         >
           <X className="w-4 h-4" />
         </Button>
       </div>
     ))}
   </div>
   <Button
     type="button"
     size="sm"
     variant="outline"
     onClick={() => setEditableSizes([...editableSizes, {nameAr: '', price: 0}])}
     className="border-green-500/30 text-green-400 w-full"
     data-testid="button-add-edit-size"
   >
     <Plus className="w-4 h-4 ml-1" />
     إضافة حجم
   </Button>
 </div>

 {/* Editable Addons */}
 <div className="space-y-2">
   <Label className="text-gray-300">الإضافات المتاحة</Label>
   <div className="space-y-2">
     {editableAddons.map((addon, idx) => (
       <div key={idx} className="space-y-1.5 p-2 rounded-lg bg-[#1a1410]/50 border border-primary/10">
         <div className="flex gap-2 items-center">
           <button
             type="button"
             onClick={() => { setEditingAddonImageIdx(idx); setImageLibraryContext("edit-addon"); setIsImageLibraryOpen(true); }}
             className="w-10 h-10 rounded-lg border-2 border-dashed border-primary/30 flex items-center justify-center shrink-0 overflow-hidden hover:border-accent/50 transition-colors"
             data-testid={`button-edit-addon-img-${idx}`}
           >
             {addon.imageUrl ? <img src={addon.imageUrl.startsWith('/') ? addon.imageUrl : '/' + addon.imageUrl} className="w-full h-full object-cover rounded-lg" alt="" /> : <Plus className="w-3 h-3 text-gray-500" />}
           </button>
           <Input
             type="text"
             placeholder="اسم الإضافة"
             value={addon.nameAr}
             onChange={(e) => {
               const newAddons = [...editableAddons];
               newAddons[idx] = { ...newAddons[idx], nameAr: e.target.value };
               setEditableAddons(newAddons);
             }}
             className="bg-[#1a1410] border-primary/30 text-white flex-1"
             data-testid={`input-edit-addon-name-${idx}`}
           />
           <Input
             type="number"
             placeholder="السعر"
             value={addon.price}
             onChange={(e) => {
               const newAddons = [...editableAddons];
               newAddons[idx] = { ...newAddons[idx], price: parseFloat(e.target.value) || 0 };
               setEditableAddons(newAddons);
             }}
             className="bg-[#1a1410] border-primary/30 text-white w-20"
             data-testid={`input-edit-addon-price-${idx}`}
           />
           <Button
             type="button"
             size="sm"
             variant="outline"
             onClick={() => setEditableAddons(editableAddons.filter((_, i) => i !== idx))}
             className="border-red-500/30 text-red-500 shrink-0"
             data-testid={`button-delete-addon-${idx}`}
           >
             <X className="w-4 h-4" />
           </Button>
         </div>
         <div className="flex gap-2 items-center">
           <Input
             type="text"
             placeholder="العنوان / القسم (مثال: الحجم، النكهات) — اختياري"
             value={addon.section || ''}
             onChange={(e) => {
               const newAddons = [...editableAddons];
               newAddons[idx] = { ...newAddons[idx], section: e.target.value };
               setEditableAddons(newAddons);
             }}
             className="bg-[#1a1410] border-primary/20 text-white/70 text-xs h-7 flex-1"
             data-testid={`input-edit-addon-section-${idx}`}
           />
           <button
             type="button"
             onClick={() => {
               const newAddons = [...editableAddons];
               newAddons[idx] = { ...newAddons[idx], isSingleSelect: !newAddons[idx].isSingleSelect };
               setEditableAddons(newAddons);
             }}
             className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${addon.isSingleSelect ? 'bg-accent/20 border-accent text-accent' : 'bg-transparent border-primary/20 text-gray-500'}`}
             data-testid={`button-edit-addon-single-${idx}`}
           >
             <span>{addon.isSingleSelect ? '✓' : '○'}</span>
             <span>اختر واحد</span>
           </button>
         </div>
       </div>
     ))}
   </div>
   <Button
     type="button"
     size="sm"
     variant="outline"
     onClick={() => setEditableAddons([...editableAddons, {nameAr: '', price: 0, imageUrl: '', category: 'other', section: ''}])}
     className="border-green-500/30 text-green-400 w-full"
     data-testid="button-add-edit-addon"
   >
     <Plus className="w-4 h-4 ml-1" />
     إضافة إضافة
   </Button>
 </div>

 <div className="flex justify-end gap-2">
 <Button
 type="button"
 variant="outline"
 onClick={() => {
 setIsEditDialogOpen(false);
 setEditingItem(null);
 setEditImageUrls([]);
 }}
 className="border-gray-600 text-gray-300"
 data-testid="button-edit-cancel"
 >
 إلغاء
 </Button>
 <Button
 type="submit"
 disabled={updateItemMutation.isPending}
 className="bg-gradient-to-r from-blue-500 to-blue-700"
 data-testid="button-edit-submit"
 >
 {updateItemMutation.isPending ? "جاري التحديث..." : "تحديث المشروب"}
 </Button>
 </div>
 </form>
 )}
 </DialogContent>
 </Dialog>

 {/* Recipe Editor Dialog */}
 <Dialog open={isRecipeDialogOpen} onOpenChange={(open) => {
   setIsRecipeDialogOpen(open);
   if (!open) {
     setEditingRecipeItem(null);
     setRecipeItems([]);
   }
 }}>
   <DialogContent className="bg-[#2d1f1a] border-green-500/20 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
     <DialogHeader>
       <DialogTitle className="text-green-400 flex items-center gap-2">
         <FlaskConical className="w-5 h-5" />
         تعديل وصفة: {editingRecipeItem?.nameAr}
       </DialogTitle>
     </DialogHeader>
     
     <div className="space-y-4 py-4">
       <div className="bg-[#1a1410] p-3 rounded-lg border border-green-500/20">
         <p className="text-gray-400 text-sm">سعر البيع: <span className="text-accent font-bold">{editingRecipeItem?.price} ريال</span></p>
       </div>
       
       <div>
         <Label className="text-gray-300 text-lg">اختر المواد الخام للوصفة</Label>
         <p className="text-gray-500 text-sm mb-3">حدد الكميات المستخدمة في تحضير المنتج</p>
         
         <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
           {rawItems.filter(r => r.isActive === 1).map((raw) => {
             const isSelected = recipeItems.some(s => s.rawItemId === raw.id);
             const selected = recipeItems.find(s => s.rawItemId === raw.id);
             
             return (
               <div key={raw.id} className="flex items-center gap-3 p-2 bg-[#1a1410] rounded-lg border border-primary/10">
                 <Checkbox
                   id={`recipe-edit-${raw.id}`}
                   checked={isSelected}
                   onCheckedChange={(checked) => {
                     if (checked) {
                       setRecipeItems([...recipeItems, {
                         rawItemId: raw.id,
                         rawItem: raw,
                         quantity: 10,
                         unit: raw.unit
                       }]);
                     } else {
                       setRecipeItems(recipeItems.filter(s => s.rawItemId !== raw.id));
                     }
                   }}
                   className="border-green-500/50"
                   data-testid={`checkbox-recipe-edit-${raw.id}`}
                 />
                 <label htmlFor={`recipe-edit-${raw.id}`} className="text-gray-300 flex-1 cursor-pointer">
                   <span>{raw.nameAr}</span>
                   <span className="text-gray-500 text-xs mr-2">({raw.unitCost.toFixed(2)} ريال/{raw.unit})</span>
                 </label>
                 {isSelected && (
                   <div className="flex items-center gap-2">
                     <Input
                       type="number"
                       min="0.1"
                       step="0.1"
                       value={selected?.quantity || 10}
                       onChange={(e) => {
                         setRecipeItems(recipeItems.map(s =>
                           s.rawItemId === raw.id ? { ...s, quantity: parseFloat(e.target.value) || 0 } : s
                         ));
                       }}
                       className="w-20 bg-[#2d1f1a] border-green-500/30 text-white text-center"
                       data-testid={`input-recipe-qty-${raw.id}`}
                     />
                     <Select
                       value={selected?.unit || raw.unit}
                       onValueChange={(value) => {
                         setRecipeItems(recipeItems.map(s =>
                           s.rawItemId === raw.id ? { ...s, unit: value } : s
                         ));
                       }}
                     >
                       <SelectTrigger className="w-20 bg-[#2d1f1a] border-green-500/30 text-white" data-testid={`select-recipe-unit-${raw.id}`}>
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="bg-[#2d1f1a] border-primary/20 text-white">
                         <SelectItem value="g">جرام</SelectItem>
                         <SelectItem value="ml">مل</SelectItem>
                         <SelectItem value="kg">كجم</SelectItem>
                         <SelectItem value="liter">لتر</SelectItem>
                         <SelectItem value="piece">قطعة</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                 )}
               </div>
             );
           })}
         </div>
         
         {recipeItems.length > 0 && (
           <div className="bg-gradient-to-r from-background to-background p-4 rounded-lg border border-green-500/30 mt-3">
             {(() => {
               const { totalCost, breakdown } = calculateRecipeCost(recipeItems);
               const sellingPrice = editingRecipeItem?.price ? parseFloat(String(editingRecipeItem.price)) : 0;
               const grossProfit = sellingPrice - totalCost;
               const profitMargin = sellingPrice > 0 ? ((grossProfit / sellingPrice) * 100) : 0;
               
               return (
                 <>
                   <div className="flex items-center justify-between mb-3">
                     <span className="text-gray-300 font-medium flex items-center gap-2">
                       <FlaskConical className="w-4 h-4 text-green-400" />
                       تكلفة الوصفة
                     </span>
                   </div>
                   
                   {breakdown.length > 0 && (
                     <div className="space-y-1 mb-3 text-sm">
                       {breakdown.map((item, idx) => (
                         <div key={idx} className="flex justify-between text-gray-400">
                           <span>{item.name} ({item.quantity} {item.unit})</span>
                           <span>{item.cost.toFixed(2)} ريال</span>
                         </div>
                       ))}
                     </div>
                   )}
                   
                   <div className="border-t border-green-500/20 pt-3 space-y-2">
                     <div className="flex justify-between items-center">
                       <span className="text-gray-300">تكلفة الوصفة (COGS):</span>
                       <span className="text-green-400 font-bold">{totalCost.toFixed(2)} ريال</span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-gray-300">سعر البيع:</span>
                       <span className="text-white font-bold">{sellingPrice.toFixed(2)} ريال</span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-gray-300">هامش الربح:</span>
                       <span className={`font-bold ${grossProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                         {grossProfit.toFixed(2)} ريال ({profitMargin.toFixed(1)}%)
                       </span>
                     </div>
                   </div>
                 </>
               );
             })()}
           </div>
         )}
       </div>
       
       <div className="flex justify-end gap-2">
         <Button
           type="button"
           variant="outline"
           onClick={() => {
             setIsRecipeDialogOpen(false);
             setEditingRecipeItem(null);
             setRecipeItems([]);
           }}
           className="border-gray-600 text-gray-300"
           data-testid="button-recipe-cancel"
         >
           إلغاء
         </Button>
         <Button
           type="button"
           onClick={handleSaveRecipe}
           disabled={bulkRecipeMutation.isPending || recipeItems.length === 0}
           className="bg-gradient-to-r from-green-500 to-green-700"
           data-testid="button-recipe-save"
         >
           {bulkRecipeMutation.isPending ? "جاري الحفظ..." : "حفظ الوصفة"}
         </Button>
       </div>
     </div>
   </DialogContent>
 </Dialog>

 {/* Delete Confirmation */}
 <AlertDialog open={!!deletingItemId} onOpenChange={() => setDeletingItemId(null)}>
 <AlertDialogContent className="bg-[#2d1f1a] border-red-500/20 text-white">
 <AlertDialogHeader>
 <AlertDialogTitle className="text-red-500">تأكيد الحذف</AlertDialogTitle>
 <AlertDialogDescription className="text-gray-300">
 هل أنت متأكد من حذف هذا المشروب؟ لا يمكن التراجع عن هذا الإجراء.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel
 className="bg-transparent border-gray-600 text-gray-300"
 data-testid="button-delete-cancel"
 >
 إلغاء
 </AlertDialogCancel>
 <AlertDialogAction
 onClick={confirmDelete}
 disabled={deleteItemMutation.isPending}
 className="bg-gradient-to-r from-red-500 to-red-700 text-white"
 data-testid="button-delete-confirm"
 >
 {deleteItemMutation.isPending ? "جاري الحذف..." : "حذف"}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>

 {/* Skip Recipe Confirmation Dialog */}
 <AlertDialog open={skipRecipeConfirmOpen} onOpenChange={setSkipRecipeConfirmOpen}>
   <AlertDialogContent className="bg-[#2d1f1a] border-primary/20 text-white">
     <AlertDialogHeader>
       <AlertDialogTitle className="text-accent">تأكيد إنشاء منتج بدون وصفة</AlertDialogTitle>
       <AlertDialogDescription className="text-gray-300">
         أنت على وشك إنشاء منتج بدون وصفة. هذا يعني أن:
         <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
           <li>لن يتم خصم المخزون تلقائياً عند البيع</li>
           <li>لن يمكن حساب تكلفة المنتج بدقة</li>
           <li>لن يكون المنتج "جاهز للبيع" بالكامل</li>
         </ul>
         <p className="mt-3 text-accent">يمكنك إضافة الوصفة لاحقاً من قائمة المنتجات.</p>
       </AlertDialogDescription>
     </AlertDialogHeader>
     <AlertDialogFooter>
       <AlertDialogCancel
         className="bg-transparent border-gray-600 text-gray-300"
         data-testid="button-skip-recipe-cancel"
       >
         الرجوع لإضافة الوصفة
       </AlertDialogCancel>
       <AlertDialogAction
         onClick={handleConfirmSkipRecipe}
         className="bg-gradient-to-r from-amber-600 to-amber-700 text-white"
         data-testid="button-skip-recipe-confirm"
       >
         إنشاء بدون وصفة
       </AlertDialogAction>
     </AlertDialogFooter>
   </AlertDialogContent>
 </AlertDialog>
<ImageLibraryModal
  open={isImageLibraryOpen}
  onClose={() => setIsImageLibraryOpen(false)}
  onSelect={(url) => {
    if (imageLibraryContext === "add") {
      setAddImageUrls(prev => prev.length < 5 ? [...prev, url] : prev);
    } else if (imageLibraryContext === "edit") {
      setEditImageUrls(prev => prev.length < 5 ? [...prev, url] : prev);
    } else if (imageLibraryContext === "add-addon" && editingAddonImageIdx >= 0) {
      setAddEditableAddons(prev => prev.map((a, i) => i === editingAddonImageIdx ? { ...a, imageUrl: url } : a));
    } else if (imageLibraryContext === "edit-addon" && editingAddonImageIdx >= 0) {
      setEditableAddons(prev => prev.map((a, i) => i === editingAddonImageIdx ? { ...a, imageUrl: url } : a));
    }
    setIsImageLibraryOpen(false);
  }}
/>
 <MobileBottomNav employeeRole={employee?.role} />
 </div>
 );
}
