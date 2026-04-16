import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  History,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  Package,
  Loader2,
  RefreshCw,
  Calendar,
  Trash2,
  ShoppingCart
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface StockMovement {
  id: string;
  branchId: string;
  rawItemId: string;
  movementType: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  rawItem?: {
    nameAr: string;
    code: string;
    unit: string;
  };
  branch?: {
    nameAr: string;
  };
}

interface Branch {
  id?: string;
  nameAr: string;
}

const movementTypeConfig: Record<string, { label: string; icon: typeof ArrowUp; color: string; direction: "in" | "out" | "neutral" }> = {
  purchase: { label: "شراء", icon: ArrowUp, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", direction: "in" },
  sale: { label: "بيع", icon: ArrowDown, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", direction: "out" },
  transfer_in: { label: "تحويل وارد", icon: ArrowUp, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", direction: "in" },
  transfer_out: { label: "تحويل صادر", icon: ArrowDown, color: "bg-accent text-accent dark:bg-accent dark:text-accent", direction: "out" },
  adjustment: { label: "تعديل", icon: ArrowRightLeft, color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", direction: "neutral" },
  waste: { label: "تالف", icon: ArrowDown, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", direction: "out" },
  return: { label: "إرجاع", icon: ArrowUp, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", direction: "in" },
};

const unitLabels: Record<string, string> = {
  kg: "كيلوجرام",
  g: "جرام",
  liter: "لتر",
  ml: "ملليلتر",
  piece: "قطعة",
  box: "صندوق",
  bag: "كيس",
};

export default function InventoryMovementsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: movements = [], isLoading } = useQuery<StockMovement[]>({
    queryKey: ["/api/inventory/movements"],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.nameAr || id;

  const filteredMovements = movements.filter((movement) => {
    const matchesSearch = 
      (movement.rawItem?.nameAr?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (movement.rawItem?.code?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesBranch = branchFilter === "all" || movement.branchId === branchFilter;
    const matchesType = typeFilter === "all" || movement.movementType === typeFilter;
    
    return matchesSearch && matchesBranch && matchesType;
  });

  const inMovements = movements.filter(m => movementTypeConfig[m.movementType]?.direction === "in").length;
  const outMovements = movements.filter(m => movementTypeConfig[m.movementType]?.direction === "out").length;
  const saleMovements = movements.filter(m => m.movementType === 'sale').length;
  const wasteMovements = movements.filter(m => m.movementType === 'waste').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <History className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">حركات المخزون</h1>
            <p className="text-muted-foreground text-sm">سجل جميع حركات المخزون (شراء، بيع، تحويل، تعديل)</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/inventory/movements"] })}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 ml-2" />
          تحديث
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الحركات</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movements.length}</div>
            <p className="text-xs text-muted-foreground">حركة مخزون</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">حركات واردة</CardTitle>
            <ArrowUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{inMovements}</div>
            <p className="text-xs text-muted-foreground">شراء وتحويل وارد</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مبيعات</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{saleMovements}</div>
            <p className="text-xs text-muted-foreground">خصم من الطلبات</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">هدر/تالف</CardTitle>
            <Trash2 className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{wasteMovements}</div>
            <p className="text-xs text-muted-foreground">مواد تالفة</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالمادة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
                data-testid="input-search-movements"
              />
            </div>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-branch-filter">
                <SelectValue placeholder="الفرع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id as string}>
                    {branch.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
                <SelectValue placeholder="نوع الحركة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                {Object.entries(movementTypeConfig).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">المادة</TableHead>
                  <TableHead className="text-right">الفرع</TableHead>
                  <TableHead className="text-right">الكمية</TableHead>
                  <TableHead className="text-right">قبل</TableHead>
                  <TableHead className="text-right">بعد</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>لا توجد حركات مخزون</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((movement) => {
                    const config = movementTypeConfig[movement.movementType] || movementTypeConfig.adjustment;
                    const MovementIcon = config.icon;
                    
                    return (
                      <TableRow key={movement.id} data-testid={`row-movement-${movement.id}`}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(movement.createdAt), "dd/MM/yyyy HH:mm", { locale: ar })}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${config.color} flex items-center gap-1 w-fit`}>
                            <MovementIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{movement.rawItem?.nameAr}</div>
                            <div className="text-sm text-muted-foreground font-mono">{movement.rawItem?.code}</div>
                          </div>
                        </TableCell>
                        <TableCell>{movement.branch?.nameAr || getBranchName(movement.branchId)}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${
                            config.direction === "in" ? "text-green-600" : 
                            config.direction === "out" ? "text-red-600" : ""
                          }`}>
                            {config.direction === "in" ? "+" : config.direction === "out" ? "-" : ""}
                            {movement.quantity}
                          </span>
                          <span className="text-muted-foreground mr-1">
                            {unitLabels[movement.rawItem?.unit || ""] || movement.rawItem?.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{movement.previousQuantity}</TableCell>
                        <TableCell className="font-medium">{movement.newQuantity}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {movement.notes || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
