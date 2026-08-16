import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, ArrowUp, ArrowDown } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/ui/states";

export default function StockMovementsPage() {
  const [selectedBranch, setSelectedBranch] = useState("branch-1");
  const [selectedItem, setSelectedItem] = useState("");
  const [limit, setLimit] = useState("50");

  const { data: movements = [], isLoading } = useQuery<any[]>({
    queryKey: [
      `/api/inventory/movements/${selectedBranch}/${selectedItem || "all"}`,
      parseInt(limit),
    ],
    enabled: !!selectedBranch && !!selectedItem,
  });

  if (isLoading) return <LoadingState />;

  const getMovementIcon = (type: string) => {
    return type === "in" ? (
      <ArrowUp className="w-4 h-4 text-green-600" />
    ) : (
      <ArrowDown className="w-4 h-4 text-red-600" />
    );
  };

  const getMovementColor = (type: string) => {
    return type === "in" ? "text-green-600" : "text-red-600";
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Package className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Stock Movements</h1>
      </div>

      {/* Filters */}
      <Card data-testid="card-filters">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Branch ID</Label>
              <Input
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                placeholder="branch-1"
                data-testid="input-branch"
              />
            </div>
            <div>
              <Label>Item ID</Label>
              <Input
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                placeholder="coffee-beans"
                data-testid="input-item"
              />
            </div>
            <div>
              <Label>Limit</Label>
              <Input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                min="10"
                max="500"
                data-testid="input-limit"
              />
            </div>
            <div className="flex items-end">
              <p className="text-xs text-secondary-foreground">
                Showing movements for: {selectedItem || "select item"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card data-testid="card-movements">
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedItem ? (
            movements && movements.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement: any, idx: number) => (
                      <TableRow key={idx} data-testid={`row-movement-${idx}`}>
                        <TableCell className="text-sm">
                          {new Date(movement.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMovementIcon(movement.type)}
                            <span className={getMovementColor(movement.type)}>
                              {movement.type === "in" ? "Stock In" : "Stock Out"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{movement.quantity}</TableCell>
                        <TableCell>{movement.unit}</TableCell>
                        <TableCell className="text-right">
                          {movement.unitCost?.toFixed(2) || "N/A"} SAR
                        </TableCell>
                        <TableCell className={`text-right font-bold ${getMovementColor(movement.type)}`}>
                          {(movement.quantity * (movement.unitCost || 0)).toFixed(2)} SAR
                        </TableCell>
                        <TableCell className="text-sm text-secondary-foreground max-w-xs">
                          {movement.notes || movement.reason || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                title="No movements found"
                description={`No stock movements for ${selectedItem} in the selected period`}
              />
            )
          ) : (
            <EmptyState
              title="Select an item"
              description="Please select a raw item to view its movement history"
            />
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {selectedItem && movements.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card data-testid="card-total-in">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-secondary-foreground">Total Stock In</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600" data-testid="text-total-in">
                {movements
                  .filter((m: any) => m.type === "in")
                  .reduce((sum: number, m: any) => sum + m.quantity, 0)}{" "}
                {movements[0]?.unit}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-out">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-secondary-foreground">Total Stock Out</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600" data-testid="text-total-out">
                {movements
                  .filter((m: any) => m.type === "out")
                  .reduce((sum: number, m: any) => sum + m.quantity, 0)}{" "}
                {movements[0]?.unit}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-cost">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-secondary-foreground">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="text-total-cost">
                {movements
                  .reduce((sum: number, m: any) => sum + m.quantity * (m.unitCost || 0), 0)
                  .toFixed(2)}{" "}
                SAR
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
