import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit2, Trash2, ChefHat } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/ui/states";

interface RecipeFormData {
  coffeeItemId: string;
  nameAr: string;
  nameEn?: string;
  ingredients: Array<{ rawItemId: string; quantity: number; unit: string }>;
}

interface RecipeWithCost {
  id: string;
  coffeeItemId: string;
  nameAr: string;
  ingredients: Array<{ rawItemId: string; quantity: number; unit: string }>;
  totalCost?: number;
}

export default function RecipesManagement() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState<RecipeFormData>({
    coffeeItemId: "",
    nameAr: "",
    nameEn: "",
    ingredients: [{ rawItemId: "", quantity: 0, unit: "g" }],
  });

  const { data: recipes = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/recipes"],
  });

  // Fetch cost for each recipe
  const { data: recipeCosts = {} } = useQuery({
    queryKey: ["/api/recipes/costs"],
    queryFn: async () => {
      const costs: Record<string, number> = {};
      for (const recipe of recipes) {
        try {
          const res = await apiRequest("GET", `/api/recipes/coffee-item/${recipe.coffeeItemId}/cost`);
          const data = await res.json();
          costs[recipe.id] = data.totalCost || 0;
        } catch (e) {
          costs[recipe.id] = 0;
        }
      }
      return costs;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: RecipeFormData) => {
      const response = await apiRequest("POST", "/api/recipes", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "✅ Recipe created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setFormData({ coffeeItemId: "", nameAr: "", nameEn: "", ingredients: [{ rawItemId: "", quantity: 0, unit: "g" }] });
      setIsCreateOpen(false);
    },
    onError: () => toast({ title: "❌ Failed to create recipe", variant: "destructive" }),
  });

  const handleAddIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, { rawItemId: "", quantity: 0, unit: "g" }],
    });
  };

  const handleRemoveIngredient = (idx: number) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== idx),
    });
  };

  const handleSubmit = async () => {
    if (!formData.coffeeItemId || !formData.nameAr) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Recipe Management</h1>
            <p className="text-sm text-muted-foreground">PHASE 1: Cost calculation enabled</p>
          </div>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-recipe">
              <Plus className="w-4 h-4" /> New Recipe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Recipe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Coffee Item ID</Label>
                <Input
                  placeholder="item-espresso"
                  value={formData.coffeeItemId}
                  onChange={(e) => setFormData({ ...formData, coffeeItemId: e.target.value })}
                  data-testid="input-coffeeItemId"
                />
              </div>

              <div>
                <Label>Name (Arabic)</Label>
                <Input
                  placeholder="إسبريسو"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  data-testid="input-nameAr"
                />
              </div>

              <div>
                <Label>Name (English)</Label>
                <Input
                  placeholder="Espresso"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  data-testid="input-nameEn"
                />
              </div>

              <div className="space-y-3">
                <Label className="block">Ingredients</Label>
                {formData.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Raw item ID"
                      value={ing.rawItemId}
                      onChange={(e) => {
                        const newIng = [...formData.ingredients];
                        newIng[idx].rawItemId = e.target.value;
                        setFormData({ ...formData, ingredients: newIng });
                      }}
                      className="flex-1"
                      data-testid={`input-ingredient-rawItemId-${idx}`}
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={ing.quantity}
                      onChange={(e) => {
                        const newIng = [...formData.ingredients];
                        newIng[idx].quantity = parseFloat(e.target.value);
                        setFormData({ ...formData, ingredients: newIng });
                      }}
                      className="w-24"
                      data-testid={`input-ingredient-quantity-${idx}`}
                    />
                    <Input
                      placeholder="Unit"
                      value={ing.unit}
                      onChange={(e) => {
                        const newIng = [...formData.ingredients];
                        newIng[idx].unit = e.target.value;
                        setFormData({ ...formData, ingredients: newIng });
                      }}
                      className="w-20"
                      data-testid={`input-ingredient-unit-${idx}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveIngredient(idx)}
                      data-testid={`button-remove-ingredient-${idx}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={handleAddIngredient} className="w-full" data-testid="button-add-ingredient">
                  <Plus className="w-4 h-4 mr-2" /> Add Ingredient
                </Button>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="flex-1" data-testid="button-cancel">
                  Cancel
                </Button>
                <Button onClick={handleSubmit} className="flex-1" disabled={createMutation.isPending} data-testid="button-create">
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {recipes && recipes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe: any) => (
            <Card key={recipe.id} data-testid={`card-recipe-${recipe.id}`}>
              <CardHeader>
                <CardTitle className="text-lg">{recipe.nameAr}</CardTitle>
                {recipe.nameEn && <p className="text-sm text-secondary-foreground">{recipe.nameEn}</p>}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-xs text-secondary-foreground">Cost per Unit</p>
                    <p className="text-xl font-bold" data-testid={`text-cost-${recipe.id}`}>
                      {recipe.totalCost?.toFixed(2) || "N/A"} SAR
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium mb-2">Ingredients</p>
                    <ul className="text-xs space-y-1">
                      {recipe.ingredients?.map((ing: any, idx: number) => (
                        <li key={idx} data-testid={`text-ingredient-${recipe.id}-${idx}`}>
                          • {ing.quantity} {ing.unit}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" data-testid={`button-edit-${recipe.id}`}>
                      <Edit2 className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No recipes found" description="Create your first recipe to get started" />
      )}
    </div>
  );
}
