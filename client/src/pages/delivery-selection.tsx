import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useCartStore } from '@/lib/cart-store';
import { useToast } from '@/hooks/use-toast';
import { Store, MapPin, ArrowRight, Phone, Map, Coffee, AlertCircle, Loader2, Navigation, Clock, Check, Car, Bookmark, Palette } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';

interface Branch {
  id: string;
  nameAr: string;
  nameEn?: string;
  address: string;
  phone: string;
  city: string;
  location?: {
    lat: number;
    lng: number;
    // legacy field names — handled via helper
    latitude?: number;
    longitude?: number;
  };
  isActive: number;
  mapsUrl?: string;
}

// Normalize location coords regardless of field naming (lat/lng vs latitude/longitude)
function getBranchCoords(branch: Branch): { lat: number; lng: number } | null {
  const loc = branch.location;
  if (!loc) return null;
  const lat = loc.lat ?? loc.latitude;
  const lng = loc.lng ?? loc.longitude;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

// Normalize phone number to Saudi format for tel: links
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('966')) return `+${digits}`;
  if (digits.startsWith('0')) return `+966${digits.slice(1)}`;
  return `+966${digits}`;
}

// Open Google Maps directions in the best available app
function openDirections(lat: number, lng: number) {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const url = isIOS
    ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

interface Table {
  id: string;
  tableNumber: string;
  capacity: number;
  branchId: string;
  isActive: number;
  isAvailable?: boolean;
  isOccupied?: boolean | number;
}

export default function DeliverySelectionPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { setDeliveryInfo, cartItems } = useCartStore();
  const { toast } = useToast();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Set SEO metadata
  useEffect(() => {
    document.title = `${t("nav.branch_selection")} - CLUNY CAFE`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', t("delivery.subtitle"));
  }, [t]);
  const [dineIn, setDineIn] = useState<boolean>(false);
  const [carPickup, setCarPickup] = useState<boolean>(false);
  const [saveCarInfo, setSaveCarInfo] = useState<boolean>(false);
  const [carInfo, setCarInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('cluny_saved_car');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { model: parsed.model || '', color: parsed.color || '', plateNumber: parsed.plateNumber || '' };
      }
    } catch {}
    return { model: '', color: '', plateNumber: '' };
  });
  const [hasSavedCar] = useState(() => {
    try { return !!localStorage.getItem('cluny_saved_car'); } catch { return false; }
  });
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{withinRange: boolean; distance: number; message: string} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [availableTables, setAvailableTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [arrivalTime, setArrivalTime] = useState<string>('');
  const [loadingTables, setLoadingTables] = useState(false);
  const [bookedTable, setBookedTable] = useState<{ tableNumber: string; bookingId: string } | null>(null);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLocationError('');
          setIsGettingLocation(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError(t("delivery.location_error"));
          setIsGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError(t("delivery.browser_error"));
    }
  }, []);

  // Check distance when branch is selected and we have user location
  useEffect(() => {
    if (selectedBranchId && userLocation) {
      checkLocationProximity();
    } else {
      setLocationStatus(null);
    }
  }, [selectedBranchId, userLocation]);

  // Fetch all tables when dine-in is selected
  useEffect(() => {
    if (dineIn && selectedBranchId) {
      fetchAvailableTables();
    } else {
      setAvailableTables([]);
      setSelectedTableId('');
      setBookedTable(null);
    }
  }, [dineIn, selectedBranchId]);

  // Book table when both table and arrival time are selected (only if not already booked)
  useEffect(() => {
    if (selectedTableId && arrivalTime && dineIn && !bookedTable) {
      bookTable();
    }
  }, [selectedTableId, arrivalTime, dineIn, bookedTable]);

  const fetchAvailableTables = async () => {
    setLoadingTables(true);
    try {
      const response = await fetch(`/api/tables/status?branchId=${selectedBranchId}`);
      const data = await response.json();
      
    const tables = Array.isArray(data) ? data : [];
    
    // Process tables to ensure they have the expected structure and filter active ones
    const processedTables = tables
      .filter((t: any) => t && (t.isActive === 1 || t.isActive === true || t.isActive === undefined))
      .map((t: any) => {
        // Handle MongoDB document structure (sometimes data is nested in $__)
        // We look for _doc or use the object itself
        const actualData = t._doc || t;
        
        // Ensure id is present
        const id = actualData.id;
        
        return {
          ...actualData,
          id: id,
          // Use isAvailable from server (computed correctly from isOccupied)
          // Server returns isAvailable=true if table is not occupied
          isAvailable: actualData.isAvailable !== undefined ? actualData.isAvailable : (actualData.isOccupied === 0),
          isOccupied: actualData.isOccupied !== undefined ? actualData.isOccupied : 0
        };
      })
      .filter((t: any) => t.id); // Ensure only tables with valid IDs are shown
    
    setAvailableTables(processedTables);
    } catch (error) {
      console.error('Error fetching tables:', error);
      toast({
        title: t("product.error"),
        description: t("delivery.loading_tables_error") || "Failed to load tables",
        variant: 'destructive',
      });
    } finally {
      setLoadingTables(false);
    }
  };

  const bookTable = async () => {
    try {
      const response = await fetch('/api/tables/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: selectedTableId,
          arrivalTime: arrivalTime,
          branchId: selectedBranchId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: t("product.error"),
          description: data.error || t("delivery.booking_error") || 'Failed to book table',
          variant: 'destructive',
        });
        // Don't clear selections on error - user can try again or adjust arrival time
        return;
      }

      // Update booked table state with the response
      setBookedTable({
        tableNumber: data.tableNumber,
        bookingId: data.bookingId
      });

      toast({
        title: t("product.saved"),
        description: data.message || t("delivery.booking_success") || 'Table booked successfully',
      });
    } catch (error) {
      // Keep selections - allow retry with same selections
    }
  };

  const checkLocationProximity = async () => {
    if (!selectedBranchId || !userLocation) return;

    setIsCheckingLocation(true);
    try {
      const response = await fetch(`/api/branches/${selectedBranchId}/check-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude
        })
      });
      
      const data = await response.json();
      setLocationStatus(data);
    } catch (error) {
      console.error('Error checking location:', error);
      setLocationStatus(null);
    } finally {
      setIsCheckingLocation(false);
    }
  };

  const refreshLocation = () => {
    if (navigator.geolocation) {
      setIsGettingLocation(true);
      setLocationError('');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLocationError('');
          setIsGettingLocation(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError(t("delivery.location_error"));
          setIsGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  // Fetch branches (already filtered by backend to only active branches)
  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  // Auto-skip this page if there's only one branch
  useEffect(() => {
    if (!isLoading && branches.length === 1 && cartItems && cartItems.length > 0) {
      const b = branches[0];
      setDeliveryInfo({
        type: 'pickup',
        branchId: b.id,
        branchName: (b as any).nameAr,
        branchAddress: (b as any).address,
        deliveryFee: 0,
      });
      setLocation('/checkout');
    }
  }, [isLoading, branches, cartItems]);

  const handleContinue = () => {
    // Validate cart is not empty
    if (!cartItems || cartItems.length === 0) {
      toast({
        title: t("cart.empty_title"),
        description: t("cart.empty_desc"),
        variant: 'destructive',
      });
      setLocation('/menu');
      return;
    }

    if (!selectedBranchId) {
      toast({
        title: t("product.error"),
        description: t("delivery.select_branch_error") || 'Please select a branch',
        variant: 'destructive',
      });
      return;
    }

    // Distance check removed per user request to allow all orders
    console.log("Allowing order regardless of distance");

    // If location couldn't be checked (no GPS or error), show warning but allow proceed
    if (!userLocation && locationError) {
      toast({
        title: t("product.error"),
        description: t("delivery.location_warning") || 'Could not verify location. Please ensure you are near the branch.',
        variant: 'default',
      });
    }
    
    const branch = branches.find(b => b.id === selectedBranchId);
    if (!branch) return;

    if (carPickup) {
      if (!carInfo.model || !carInfo.color || !carInfo.plateNumber) {
        toast({
          title: t("product.error"),
          description: "يرجى إدخال جميع بيانات السيارة",
          variant: 'destructive',
        });
        return;
      }
      if (saveCarInfo) {
        try { localStorage.setItem('cluny_saved_car', JSON.stringify(carInfo)); } catch {}
      } else {
        try { localStorage.removeItem('cluny_saved_car'); } catch {}
      }
    }

    // Validate dine-in reservation if selected
    if (dineIn) {
      // Check if table is selected OR already booked
      const hasTableSelection = selectedTableId || (bookedTable && bookedTable.tableNumber);

      if (!hasTableSelection) {
        toast({
          title: t("product.error"),
          description: t("delivery.select_table_error") || 'Please select a table',
          variant: 'destructive',
        });
        return;
      }

      if (!arrivalTime) {
        toast({
          title: t("product.error"),
          description: t("delivery.select_arrival_error") || 'Please enter arrival time',
          variant: 'destructive',
        });
        return;
      }
    }

    setDeliveryInfo({
      type: carPickup ? 'car-pickup' : (dineIn ? 'dine-in' : 'pickup'),
      branchId: branch.id,
      branchName: branch.nameAr,
      branchAddress: branch.address,
      dineIn: dineIn,
      carPickup: carPickup,
      carInfo: carPickup ? {
        carType: carInfo.model,
        carColor: carInfo.color,
        plateNumber: carInfo.plateNumber
      } : undefined,
      tableId: selectedTableId || undefined,
      tableNumber: bookedTable?.tableNumber || undefined,
      arrivalTime: arrivalTime || undefined,
      deliveryFee: 0,
    });
    
    setLocation('/checkout');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">{t("delivery.title")}</h1>
          <p className="text-muted-foreground">
            {t("delivery.subtitle")}
          </p>
        </div>

        {/* Branch Selection */}
        <Card className="mb-6">
          <CardContent className="p-6">
              <Label htmlFor="branch-select" className="text-base font-semibold mb-4 block">
                <MapPin className="w-4 h-4 inline-block ml-2" />
                {t("delivery.select_branch")}
              </Label>
              
              {isLoading ? (
                <p className="text-muted-foreground">{t("delivery.loading_branches") || "Loading..."}</p>
              ) : branches.length === 0 ? (
                <p className="text-muted-foreground">{t("delivery.no_branches") || "No branches available"}</p>
              ) : (
                <>
                  <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                    <SelectTrigger className="w-full" data-testid="select-branch">
                      <SelectValue placeholder={t("delivery.select_branch")} />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          <div className="flex flex-col items-start gap-1" dir="rtl">
                            <span className="font-semibold">{branch.nameAr}</span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span>{branch.address}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              <span dir="ltr">{branch.phone}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Selected Branch Details */}
                  {selectedBranchId && (() => {
                    const selectedBranch = branches.find(b => b.id === selectedBranchId);
                    if (!selectedBranch) return null;
                    
                    return (
                      <div className="mt-4 space-y-3">
                        {/* Branch Info Card */}
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 mt-1 text-primary shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{t("delivery.address")}</p>
                              <p className="text-sm text-muted-foreground">{selectedBranch.address}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Phone className="w-4 h-4 mt-1 text-primary shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{t("delivery.phone")}</p>
                              <p className="text-sm text-muted-foreground" dir="ltr">{selectedBranch.phone}</p>
                            </div>
                          </div>
                        </div>

                        {/* Location Status */}
                        {isCheckingLocation || isGettingLocation ? (
                          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            <AlertDescription className="text-blue-800 dark:text-blue-200">
                              {t("delivery.check_location")}
                            </AlertDescription>
                          </Alert>
                        ) : locationError ? (
                          <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                            <AlertDescription dir="rtl" className="flex items-center justify-between gap-2">
                              <span className="text-yellow-800 dark:text-yellow-200">{locationError}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={refreshLocation}
                                data-testid="button-refresh-location"
                              >
                                <Navigation className="w-4 h-4 ml-1" />
                                {t("delivery.update_location")}
                              </Button>
                            </AlertDescription>
                          </Alert>
                        ) : locationStatus ? (
                          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                            <MapPin className="w-4 h-4 text-blue-600" />
                            <AlertDescription dir="rtl" className="text-blue-800 dark:text-blue-200">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span>
                                  {locationStatus.withinRange 
                                    ? t("delivery.within_range", { distance: locationStatus.distance })
                                    : t("delivery.out_of_range", { distance: locationStatus.distance })}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={refreshLocation}
                                  data-testid="button-refresh-location-2"
                                >
                                  <Navigation className="w-4 h-4 ml-1" />
                                  {t("delivery.update")}
                                </Button>
                              </div>
                            </AlertDescription>
                          </Alert>
                        ) : null}

                        {/* Map Preview Link */}
                        {(() => {
                          const coords = getBranchCoords(selectedBranch);
                          if (!coords) return null;
                          return (
                            <button
                              onClick={() => openDirections(coords.lat, coords.lng)}
                              className="w-full block rounded-lg overflow-hidden border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                              data-testid="link-branch-map-preview"
                            >
                              <div className="flex flex-col items-center justify-center p-8 gap-3">
                                <div className="p-4 rounded-full bg-primary/10">
                                  <Navigation className="w-8 h-8 text-primary" />
                                </div>
                                <div className="text-center">
                                  <p className="font-medium">{t("delivery.view_on_map")}</p>
                                  <p className="text-sm text-muted-foreground">{t("delivery.google_maps")}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })()}


                        {false && <>
                          {/* Dine-In Option */}
                        <Card className="bg-accent/5">
                          <CardContent className="p-4 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                                  <Coffee className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <Label htmlFor="dine-in" className="text-base font-semibold cursor-pointer">
                                    {t("delivery.dine_in")}
                                  </Label>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {t("delivery.dine_in_desc")}
                                  </p>
                                </div>
                              </div>
                              <Checkbox 
                                id="dine-in"
                                checked={dineIn} 
                                onCheckedChange={(checked) => {
                                  setDineIn(checked as boolean);
                                  if (checked) setCarPickup(false);
                                }}
                                data-testid="checkbox-dine-in"
                                className="ml-2"
                              />
                            </div>

                            {/* Table Selection */}
                            {dineIn && (
                              <div className="space-y-3 pt-3 border-t">
                                {loadingTables ? (
                                  <div className="text-center py-6">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">{t("delivery.loading_tables")}</p>
                                  </div>
                                ) : availableTables.length === 0 ? (
                                  <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                                    <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                                      {t("delivery.no_tables")}
                                    </AlertDescription>
                                  </Alert>
                                ) : (
                                  <>
                                    <div>
                                      <Label className="text-sm font-semibold">{t("delivery.select_table")}</Label>
                                      <Select 
                                        value={selectedTableId} 
                                        onValueChange={(value) => {
                                          setSelectedTableId(value);
                                        }}
                                      >
                                        <SelectTrigger className="w-full mt-2" data-testid="select-table">
                                          <SelectValue placeholder={t("delivery.select_table")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableTables.map((table) => {
                                            const tableId = table.id;
                                            if (!tableId) {
                                              console.error('[ERROR] Table missing id:', table);
                                              return null;
                                            }
                                            // Use isAvailable directly from server data (it's computed from isOccupied)
                                            const isAvailable = !!table.isAvailable;
                                            const statusText = isAvailable ? t("delivery.available") : t("delivery.occupied");
                                            return (
                                              <SelectItem key={tableId} value={tableId} disabled={!isAvailable} data-testid={`table-option-${table.tableNumber}`}>
                                                <span>{t("delivery.table_label", { number: table.tableNumber, capacity: table.capacity || 4 })} {statusText}</span>
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                      {selectedTableId && (
                                        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                          {t("delivery.table_success")}
                                        </p>
                                      )}
                                    </div>

                                    <div>
                                      <Label htmlFor="arrival-time" className="text-sm font-semibold">
                                        {t("delivery.arrival_time")}
                                      </Label>
                                      <Input
                                        id="arrival-time"
                                        type="time"
                                        value={arrivalTime}
                                        onChange={(e) => setArrivalTime(e.target.value)}
                                        data-testid="input-arrival-time"
                                        className="mt-2"
                                      />
                                    </div>

                                    {bookedTable && (
                                      <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                                        <Check className="w-4 h-4 text-green-600" />
                                        <AlertDescription className="text-green-800 dark:text-green-200">
                                          {t("delivery.booking_success")}
                                        </AlertDescription>
                                      </Alert>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Car Pickup Option */}
                        <Card 
                          className={`cursor-pointer transition-all duration-200 ${carPickup ? 'border-purple-500 bg-purple-500/5 ring-1 ring-purple-500/30' : 'bg-accent/5 hover-elevate'}`}
                          onClick={() => { setCarPickup(!carPickup); if (!carPickup) setDineIn(false); }}
                          data-testid="card-car-pickup"
                        >
                          <CardContent className="p-4 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1">
                                <div className={`p-3 rounded-xl shrink-0 transition-colors ${carPickup ? 'bg-purple-500/20' : 'bg-muted'}`}>
                                  <Car className={`w-6 h-6 ${carPickup ? 'text-purple-500' : 'text-muted-foreground'}`} />
                                </div>
                                <div className="flex-1">
                                  <p className={`text-base font-bold ${carPickup ? 'text-purple-600 dark:text-purple-400' : ''}`}>
                                    استلام من السيارة
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-0.5">
                                    استلم طلبك وأنت في سيارتك دون الحاجة للنزول
                                  </p>
                                  {hasSavedCar && !carPickup && (
                                    <p className="text-xs text-purple-500 mt-1 flex items-center gap-1">
                                      <Bookmark className="w-3 h-3" />
                                      لديك سيارة محفوظة
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${carPickup ? 'border-purple-500 bg-purple-500' : 'border-muted-foreground/30'}`}>
                                {carPickup && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>

                            {carPickup && (
                              <div className="space-y-4 pt-4 border-t border-purple-500/20" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-2">
                                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                                    <Car className="w-3.5 h-3.5 text-purple-500" />
                                    نوع السيارة
                                  </Label>
                                  <div className="grid grid-cols-4 gap-2">
                                    {['تويوتا', 'هيونداي', 'نيسان', 'كيا', 'شيفروليه', 'فورد', 'هوندا', 'مرسيدس'].map((brand) => (
                                      <button
                                        key={brand}
                                        type="button"
                                        onClick={() => setCarInfo({ ...carInfo, model: brand })}
                                        className={`p-2 rounded-lg text-xs font-medium text-center border transition-all ${
                                          carInfo.model === brand 
                                            ? 'border-purple-500 bg-purple-500/15 text-purple-600 dark:text-purple-400' 
                                            : 'border-border bg-background hover-elevate'
                                        }`}
                                        data-testid={`btn-car-brand-${brand}`}
                                      >
                                        {brand}
                                      </button>
                                    ))}
                                  </div>
                                  <Input
                                    value={carInfo.model}
                                    onChange={(e) => setCarInfo({ ...carInfo, model: e.target.value })}
                                    placeholder="أو اكتب نوع السيارة..."
                                    data-testid="input-car-model"
                                    className="mt-1"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                                    <Palette className="w-3.5 h-3.5 text-purple-500" />
                                    لون السيارة
                                  </Label>
                                  <div className="flex gap-2 flex-wrap">
                                    {[
                                      { name: 'أبيض', hex: '#FFFFFF', border: true },
                                      { name: 'أسود', hex: '#1a1a1a', border: false },
                                      { name: 'فضي', hex: '#C0C0C0', border: true },
                                      { name: 'رمادي', hex: '#808080', border: false },
                                      { name: 'أحمر', hex: '#DC2626', border: false },
                                      { name: 'أزرق', hex: '#2563EB', border: false },
                                      { name: 'بني', hex: '#92400E', border: false },
                                      { name: 'ذهبي', hex: '#D4A017', border: false },
                                    ].map((color) => (
                                      <button
                                        key={color.name}
                                        type="button"
                                        onClick={() => setCarInfo({ ...carInfo, color: color.name })}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                          carInfo.color === color.name 
                                            ? 'border-purple-500 ring-1 ring-purple-500/30' 
                                            : 'border-border hover-elevate'
                                        }`}
                                        data-testid={`btn-car-color-${color.name}`}
                                      >
                                        <span 
                                          className={`w-3.5 h-3.5 rounded-full shrink-0 ${color.border ? 'border border-border' : ''}`}
                                          style={{ backgroundColor: color.hex }}
                                        />
                                        {color.name}
                                      </button>
                                    ))}
                                  </div>
                                  <Input
                                    value={carInfo.color}
                                    onChange={(e) => setCarInfo({ ...carInfo, color: e.target.value })}
                                    placeholder="أو اكتب اللون..."
                                    data-testid="input-car-color"
                                    className="mt-1"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="car-plate" className="text-sm font-semibold">
                                    رقم اللوحة
                                  </Label>
                                  <Input
                                    id="car-plate"
                                    placeholder="مثال: أ ب ج 1234"
                                    value={carInfo.plateNumber}
                                    onChange={(e) => setCarInfo({ ...carInfo, plateNumber: e.target.value })}
                                    data-testid="input-car-plate"
                                    className="text-center font-mono text-lg tracking-widest"
                                    dir="ltr"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="arrival-time-car" className="text-sm font-semibold flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-purple-500" />
                                    وقت الوصول المتوقع
                                  </Label>
                                  <Input
                                    id="arrival-time-car"
                                    type="time"
                                    value={arrivalTime}
                                    onChange={(e) => setArrivalTime(e.target.value)}
                                    data-testid="input-arrival-time-car"
                                  />
                                </div>

                                <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                                  <Checkbox
                                    id="save-car-info"
                                    checked={saveCarInfo}
                                    onCheckedChange={(checked) => setSaveCarInfo(checked as boolean)}
                                    data-testid="checkbox-save-car"
                                    className="border-purple-500/50"
                                  />
                                  <Label htmlFor="save-car-info" className="text-sm cursor-pointer flex items-center gap-1.5 flex-1">
                                    <Bookmark className="w-3.5 h-3.5 text-purple-500" />
                                    حفظ بيانات السيارة للطلبات القادمة
                                  </Label>
                                </div>

                                {carInfo.model && carInfo.color && carInfo.plateNumber && (
                                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                    <p className="text-xs text-muted-foreground mb-2">ملخص السيارة:</p>
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 rounded-lg bg-purple-500/20">
                                        <Car className="w-5 h-5 text-purple-500" />
                                      </div>
                                      <div>
                                        <p className="font-bold text-sm">{carInfo.model} - {carInfo.color}</p>
                                        <p className="text-xs text-muted-foreground font-mono tracking-wider" dir="ltr">{carInfo.plateNumber}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        </>}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {(() => {
                            const coords = getBranchCoords(selectedBranch);
                            if (!coords) return null;
                            return (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => openDirections(coords.lat, coords.lng)}
                                data-testid="button-navigate-to-branch"
                              >
                                <Navigation className="w-4 h-4 ml-2" />
                                <span>{t("delivery.navigate")}</span>
                              </Button>
                            );
                          })()}
                          {selectedBranch.mapsUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => window.open(selectedBranch.mapsUrl, '_blank', 'noopener,noreferrer')}
                              data-testid="button-view-map-branch"
                            >
                              <Map className="w-4 h-4 ml-2" />
                              <span>{t("delivery.view_on_map") || "الخريطة"}</span>
                            </Button>
                          )}
                          {selectedBranch.phone && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => window.location.href = normalizePhone(selectedBranch.phone).replace('+', 'tel:+')}
                              data-testid="button-call-branch"
                            >
                              <Phone className="w-4 h-4 ml-2" />
                              <span>{t("delivery.call")}</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>

        {/* Continue Button */}
        <Button
          onClick={handleContinue}
          className="w-full"
          size="lg"
          disabled={!selectedBranchId || isLoading || isCheckingLocation}
          data-testid="button-continue"
        >
          <span>
            {isCheckingLocation ? t("delivery.check_location") : t("delivery.continue")}
          </span>
          {!isCheckingLocation && <ArrowRight className="w-5 h-5 mr-2" />}
          {isCheckingLocation && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
        </Button>
      </div>
    </div>
  );
}
