import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCoffeeImage } from "@/lib/coffee-data-clean";
import QRCodeComponent from "@/components/qr-code";
import { ArrowLeft, Coffee, Star, Sparkles, Grid3X3, Layers, Tv, QrCode, Zap, Palette, ShoppingCart, Film, BookOpen, Flame } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AddToCartModal } from "@/components/add-to-cart-modal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

interface CoffeeItem {
 id: string;
 nameAr: string;
 nameEn: string | null;
 description: string;
 price: string;
 oldPrice: string | null;
 category: string;
 imageUrl: string | null;
 isAvailable: number;
}

export default function MenuView() {
 const [, setLocation] = useLocation();
 const { toast } = useToast();
 const [viewMode, setViewMode] = useState<'elegant' | 'showcase' | 'grid' | 'mosaic' | 'waterfall' | 'tv-display' | 'window-display' | 'cinema' | 'magazine' | 'neon'>('elegant');
 const [currentIndex, setCurrentIndex] = useState(0);
 const [isAutoPlay, setIsAutoPlay] = useState(true);
 const [selectedItemForCart, setSelectedItemForCart] = useState<any>(null);
 const [isModalOpen, setIsModalOpen] = useState(false);

 // Fetch coffee items
 const { data: coffeeItems = [], isLoading } = useQuery<CoffeeItem[]>({
 queryKey: ["/api/coffee-items"],
 });

 // Auto-play functionality for all views
 useEffect(() => {
 if (!isAutoPlay || coffeeItems.length === 0) return;

 const interval = setInterval(() => {
 setCurrentIndex((prev) => (prev + 1) % coffeeItems.length);
 }, 6000);

 return () => clearInterval(interval);
 }, [isAutoPlay, coffeeItems.length]);

 // Clamp currentIndex when coffeeItems changes
 useEffect(() => {
 if (coffeeItems.length > 0) {
 setCurrentIndex(prev => Math.min(prev, coffeeItems.length - 1));
 } else {
 setCurrentIndex(0);
 }
 }, [coffeeItems.length]);


 // Group coffee items by category for organized display
 const groupedItems = coffeeItems.reduce((acc, item) => {
 if (!acc[item.category]) {
 acc[item.category] = [];
 }
 acc[item.category].push(item);
 return acc;
 }, {} as Record<string, CoffeeItem[]>);

 const categoryTitles: Record<string, string> = {
 "basic": "القهوة الأساسية",
 "hot": "المشروبات الساخنة", 
 "cold": "المشروبات الباردة"
 };


 if (isLoading) {
 return (
 <div className="min-h-screen bg-gradient-to-br from-amber-50 via-primary/5 to-amber-100 flex items-center justify-center">
 <div className="text-center">
 <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
 <p className="text-primary text-xl font-semibold">جاري تحميل القائمة الفاخرة...</p>
 </div>
 </div>
 );
 }

 const currentItem = coffeeItems[currentIndex];

 return (
 <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-amber-50 via-primary/5 to-amber-100">
 {/* Luxury Background Effects */}
 <div className="absolute inset-0 pointer-events-none overflow-hidden">
 <div className="absolute top-20 left-20 w-96 h-96 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-300/15 via-transparent to-transparent rounded-full blur-3xl animate-pulse"></div>
 <div className="absolute bottom-20 right-20 w-80 h-80 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-300/10 via-transparent to-transparent rounded-full blur-3xl animate-pulse delay-1000"></div>
 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-200/5 via-transparent to-transparent rounded-full blur-3xl"></div>
 </div>

 {/* Header Controls - Mobile Responsive */}
 <div className="relative z-50 p-3 md:p-6 space-y-4">
 {/* Title Section */}
 <div className="flex justify-between items-center">
 <div className="bg-card/90 backdrop-blur-xl rounded-2xl px-4 md:px-6 py-2 md:py-3 border border-primary/20 shadow-xl">
 <h1 className="font-amiri text-lg md:text-2xl font-bold text-primary">قائمة القهوة الفاخرة</h1>
 </div>
 
 <Button 
 onClick={() => setLocation("/menu")} 
 variant="outline"
 size="sm"
 className="bg-card/90 backdrop-blur-xl border-primary/20 hover:bg-primary/10"
 data-testid="button-back"
 >
 <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 ml-2" />
 <span className="hidden sm:inline">العودة</span>
 </Button>
 </div>

 {/* View Mode Selector - Mobile Responsive */}
 <div className="bg-card/90 backdrop-blur-xl rounded-2xl p-2 border border-primary/20 shadow-xl">
 <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1 sm:gap-2">
 <Button
 variant={viewMode === 'elegant' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => {setViewMode('elegant'); setCurrentIndex(0);}}
 className="flex items-center justify-center space-x-1 space-x-reverse text-xs sm:text-sm"
 data-testid="button-elegant"
 >
 <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
 <span className="hidden sm:inline">عرض أنيق</span>
 </Button>
 <Button
 variant={viewMode === 'showcase' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('showcase')}
 className="flex items-center justify-center space-x-1 space-x-reverse text-xs sm:text-sm"
 data-testid="button-showcase"
 >
 <Layers className="w-3 h-3 sm:w-4 sm:h-4" />
 <span className="hidden sm:inline">عرض شامل</span>
 </Button>
 <Button
 variant={viewMode === 'grid' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('grid')}
 className="flex items-center justify-center space-x-1 space-x-reverse text-xs sm:text-sm"
 data-testid="button-grid"
 >
 <Grid3X3 className="w-3 h-3 sm:w-4 sm:h-4" />
 <span className="hidden sm:inline">شبكة</span>
 </Button>
 <Button
 variant={viewMode === 'mosaic' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('mosaic')}
 className="flex items-center justify-center space-x-1 space-x-reverse text-xs sm:text-sm"
 data-testid="button-mosaic"
 >
 <Palette className="w-3 h-3 sm:w-4 sm:h-4" />
 <span className="hidden sm:inline">فسيفساء</span>
 </Button>
 <Button
 variant={viewMode === 'waterfall' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('waterfall')}
 className="flex items-center justify-center space-x-1 space-x-reverse text-xs sm:text-sm"
 data-testid="button-waterfall"
 >
 <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
 <span className="hidden sm:inline">شلال</span>
 </Button>
 <Button
 variant={viewMode === 'tv-display' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('tv-display')}
 className="flex items-center justify-center space-x-1 space-x-reverse text-xs sm:text-sm"
 data-testid="button-tv"
 >
 <Tv className="w-3 h-3 sm:w-4 sm:h-4" />
 <span className="hidden sm:inline">تلفزيوني</span>
 </Button>
 <Button
 variant={viewMode === 'window-display' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('window-display')}
 className="flex items-center justify-center space-x-1 space-x-reverse text-xs sm:text-sm"
 data-testid="button-window"
 >
 <QrCode className="w-3 h-3 sm:w-4 sm:h-4" />
 <span className="hidden sm:inline">النافذة</span>
 </Button>
 <Button
 variant={viewMode === 'cinema' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('cinema')}
 className="flex items-center justify-center space-x-1 space-x-reverse text-xs sm:text-sm"
 data-testid="button-cinema"
 >
 <Film className="w-3 h-3 sm:w-4 sm:h-4" />
 <span className="hidden sm:inline">سينما</span>
 </Button>
 <Button
 variant={viewMode === 'magazine' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('magazine')}
 className="flex items-center justify-center space-x-1 space-x-reverse text-xs sm:text-sm"
 data-testid="button-magazine"
 >
 <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
 <span className="hidden sm:inline">مجلة</span>
 </Button>
 <Button
 variant={viewMode === 'neon' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('neon')}
 className="flex items-center justify-center space-x-1 space-x-reverse text-xs sm:text-sm"
 data-testid="button-neon"
 >
 <Flame className="w-3 h-3 sm:w-4 sm:h-4" />
 <span className="hidden sm:inline">نيون</span>
 </Button>
 </div>
 </div>
 </div>

 {/* Main Content */}
 <div className="relative z-10 pb-20">
 {viewMode === 'elegant' && currentItem && (
 <div className="flex items-center justify-center min-h-[80vh] px-6">
 <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
 {/* Coffee Image Section */}
 <div className="relative group">
 <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-orange-600/20 rounded-3xl blur-2xl animate-pulse"></div>
 <div className="relative bg-card/95 backdrop-blur-xl rounded-3xl p-8 border-2 border-primary/30 shadow-2xl group-hover:shadow-primary/20 transition-all duration-700">
 <div className="relative overflow-hidden rounded-2xl">
 <img 
 src={currentItem.imageUrl || getCoffeeImage(currentItem.id)}
 alt={currentItem.nameAr}
 className="w-full h-96 object-cover transition-all duration-700 group-hover:scale-105"
 data-testid="img-current-drink"
 onError={(e) => {
 e.currentTarget.src = "/images/default-coffee.png";
 }}
 />
 <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent"></div>
 </div>
 </div>
 </div>

 {/* Coffee Details Section */}
 <div className="space-y-8">
 <div>
 <h2 className="font-amiri text-5xl font-bold text-primary mb-4 leading-tight">
 {currentItem.nameAr}
 </h2>
 <p className="text-xl text-muted-foreground leading-relaxed">
 {currentItem.description}
 </p>
 </div>

 <div className="flex items-center justify-between">
 <div className="space-y-2">
 <div className="flex items-center space-x-3 space-x-reverse">
 <span className="text-4xl font-bold text-primary">{currentItem.price}</span>
 <span className="text-2xl text-muted-foreground">ريال</span>
 </div>
 </div>

 <div className="flex items-center space-x-2 space-x-reverse">
 {Array.from({length: 5}).map((_, i) => (
 <Star key={i} className="w-6 h-6 text-accent fill-amber-400" />
 ))}
 </div>
 </div>

 {/* Category Badge */}
 <div className="inline-flex items-center px-6 py-3 bg-primary/10 border border-primary/30 rounded-full">
 <Coffee className="w-5 h-5 text-primary ml-2" />
 <span className="text-primary font-semibold">
 {categoryTitles[currentItem.category] || currentItem.category}
 </span>
 </div>
                <Button
                  onClick={() => {
                    setSelectedItemForCart(currentItem);
                    setIsModalOpen(true);
                  }}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 py-4 text-lg rounded-2xl shadow-lg"
                  data-testid="button-add-to-cart"
                >
                  <ShoppingCart className="w-5 h-5 ml-2" />
                  إضافة إلى السلة
                </Button>
 </div>
 </div>
 </div>
 )}

 {viewMode === 'showcase' && currentItem && (
 <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
 <div className="max-w-4xl w-full text-center space-y-12">
 {/* Featured Item */}
 <div className="relative group">
 <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-orange-600/30 rounded-full blur-3xl animate-pulse"></div>
 <div className="relative bg-card/95 backdrop-blur-xl rounded-full p-12 border-2 border-primary/40 shadow-2xl">
 <img 
 src={currentItem.imageUrl || getCoffeeImage(currentItem.id)}
 alt={currentItem.nameAr}
 className="w-80 h-80 object-cover rounded-full mx-auto group-hover:scale-105 transition-all duration-700"
 data-testid="img-showcase-drink"
 onError={(e) => {
 e.currentTarget.src = "/images/default-coffee.png";
 }}
 />
 </div>
 </div>

 <div className="space-y-6">
 <h2 className="font-amiri text-6xl font-bold text-primary">
 {currentItem.nameAr}
 </h2>
 <p className="text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
 {currentItem.description}
 </p>
 <div className="text-5xl font-bold text-primary">
 {currentItem.price} <span className="text-3xl">ريال</span>
 </div>
 </div>
 </div>
 </div>
 )}

 {viewMode === 'grid' && currentItem && (
 <div className="px-6">
 <div className="max-w-4xl mx-auto h-screen flex items-center justify-center">
 <Card className="group cursor-pointer transform transition-all duration-500 hover:scale-105 bg-card/95 backdrop-blur-xl border-2 border-primary/20 hover:border-primary/40 rounded-3xl overflow-hidden shadow-2xl hover:shadow-3xl w-full max-w-2xl">
 <div className="relative overflow-hidden">
 <img 
 src={currentItem.imageUrl || getCoffeeImage(currentItem.id)}
 alt={currentItem.nameAr}
 className="w-full h-96 object-cover transition-all duration-500 group-hover:scale-110"
 onError={(e) => {
 e.currentTarget.src = "/images/default-coffee.png";
 }}
 />
 <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent"></div>
 </div>
 <div className="p-8 space-y-6">
 <h3 className="font-amiri text-4xl font-bold text-primary text-center">
 {currentItem.nameAr}
 </h3>
 <p className="text-xl text-muted-foreground leading-relaxed text-center">
 {currentItem.description}
 </p>
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-3 space-x-reverse">
 <span className="text-4xl font-bold text-primary">{currentItem.price}</span>
 <span className="text-2xl text-muted-foreground">ريال</span>
 </div>
 <div className="flex items-center space-x-2 space-x-reverse">
 {Array.from({length: 5}).map((_, i) => (
 <Star key={i} className="w-6 h-6 text-accent fill-amber-400" />
 ))}
 </div>
 </div>
 </div>
 </Card>
 </div>
 </div>
 )}

 {/* New Creative Display Modes */}
 
 {/* Mosaic View */}
 {viewMode === 'mosaic' && currentItem && (
 <div className="px-6">
 <div className="max-w-6xl mx-auto h-screen flex items-center justify-center">
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-8 w-full">
 {/* Large Featured Item */}
 <div className="col-span-2 lg:col-span-2 group relative overflow-hidden rounded-3xl shadow-2xl transition-all duration-500 cursor-pointer" style={{ minHeight: '500px' }}>
 <img 
 src={currentItem.imageUrl || getCoffeeImage(currentItem.id)}
 alt={currentItem.nameAr}
 className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
 onError={(e) => {
 e.currentTarget.src = "/images/default-coffee.png";
 }}
 />
 <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
 <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
 <h3 className="font-amiri text-4xl font-bold mb-4">{currentItem.nameAr}</h3>
 <p className="text-xl opacity-90 mb-4">{currentItem.description}</p>
 <div className="flex items-center justify-between">
 <span className="text-3xl font-bold">{currentItem.price} ريال</span>
 <div className="flex items-center space-x-1 space-x-reverse">
 {Array.from({length: 5}).map((_, i) => (
 <Star key={i} className="w-5 h-5 text-accent fill-amber-400" />
 ))}
 </div>
 </div>
 </div>
 </div>
 
 {/* QR Code Section */}
 <div className="flex flex-col justify-center space-y-6">
 <QRCodeComponent 
 url="https://www.cluny.cafe"
 size="lg"
 title="امسح للطلب"
 className="w-full"
 />
 <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-2xl p-4 text-center">
 <p className="text-lg font-bold">
 لكل لحظة قهوة ، لحظة نجاح
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Waterfall View */}
 {viewMode === 'waterfall' && currentItem && (
 <div className="px-6">
 <div className="max-w-4xl mx-auto h-screen flex items-center justify-center">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full">
 {/* Flowing Card Design */}
 <Card className="group cursor-pointer bg-card/95 backdrop-blur-xl border-2 border-primary/20 hover:border-primary/40 rounded-3xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-500">
 <div className="relative overflow-hidden">
 <img 
 src={currentItem.imageUrl || getCoffeeImage(currentItem.id)}
 alt={currentItem.nameAr}
 className="w-full h-80 object-cover transition-all duration-500 group-hover:scale-105"
 onError={(e) => {
 e.currentTarget.src = "/images/default-coffee.png";
 }}
 />
 <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent"></div>
 </div>
 <div className="p-8 space-y-6">
 <h3 className="font-amiri text-3xl font-bold text-primary">
 {currentItem.nameAr}
 </h3>
 <p className="text-muted-foreground text-lg leading-relaxed">
 {currentItem.description}
 </p>
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-3 space-x-reverse">
 <span className="text-3xl font-bold text-primary">{currentItem.price}</span>
 <span className="text-xl text-muted-foreground">ريال</span>
 </div>
 <div className="flex items-center space-x-1 space-x-reverse">
 {Array.from({length: 5}).map((_, i) => (
 <Star key={i} className="w-5 h-5 text-accent fill-amber-400" />
 ))}
 </div>
 </div>
 </div>
 </Card>
 
 {/* Info and QR Section */}
 <div className="flex flex-col justify-center space-y-8">
 <div className="text-center space-y-4">
 <h1 className="font-amiri text-5xl font-bold text-primary">
 CLUNY CAFE
 </h1>
 <p className="text-xl text-muted-foreground">
 أجود أنواع القهوة العربية الأصيلة
 </p>
 </div>
 
 <QRCodeComponent 
 url="https://www.cluny.cafe"
 size="lg"
 title="امسح للطلب"
 className="w-full"
 />
 
 <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-2xl p-6 text-center">
 <p className="text-xl font-bold">
 لكل لحظة قهوة ، لحظة نجاح
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* TV Display View */}
 {viewMode === 'tv-display' && (
 <div className="px-6">
 <div className="max-w-8xl mx-auto">
 <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-screen">
 
 {/* Main Featured Section */}
 <div className="lg:col-span-3">
 {currentItem && (
 <div className="h-full flex flex-col justify-center">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
 {/* Large Image */}
 <div className="relative group">
 <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-orange-600/30 rounded-3xl blur-2xl animate-pulse"></div>
 <div className="relative bg-card/95 backdrop-blur-xl rounded-3xl p-8 border-2 border-primary/30 shadow-2xl">
 <img 
 src={currentItem.imageUrl || getCoffeeImage(currentItem.id)}
 alt={currentItem.nameAr}
 className="w-full h-96 object-cover rounded-2xl transition-all duration-700 group-hover:scale-105"
 onError={(e) => {
 e.currentTarget.src = "/images/default-coffee.png";
 }}
 />
 </div>
 </div>

 {/* Product Details */}
 <div className="space-y-8">
 <div>
 <h2 className="font-amiri text-6xl font-bold text-primary mb-6 leading-tight">
 {currentItem.nameAr}
 </h2>
 <p className="text-2xl text-muted-foreground leading-relaxed mb-8">
 {currentItem.description}
 </p>
 </div>

 <div className="space-y-4">
 <div className="text-6xl font-bold text-primary">
 {currentItem.price} <span className="text-4xl">ريال</span>
 </div>
 </div>

 <div className="flex items-center space-x-3 space-x-reverse">
 {Array.from({length: 5}).map((_, i) => (
 <Star key={i} className="w-8 h-8 text-accent fill-amber-400" />
 ))}
 </div>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Sidebar with QR Code */}
 <div className="lg:col-span-1 flex flex-col justify-center space-y-8">
 <QRCodeComponent 
 url="https://www.cluny.cafe"
 size="lg"
 title="امسح للطلب الآن"
 className="w-full"
 />
 
 {/* Current Item Info */}
 <div className="space-y-4">
 <h3 className="font-amiri text-2xl font-bold text-primary text-center">
 المشروب الحالي
 </h3>
 {currentItem && (
 <div className="bg-card/80 backdrop-blur-xl rounded-xl p-4 border border-primary/20 text-center space-y-3">
 <h4 className="font-amiri font-bold text-primary text-lg">{currentItem.nameAr}</h4>
 <p className="text-muted-foreground text-sm">{currentItem.description}</p>
 <div className="text-primary font-bold text-xl">{currentItem.price} ريال</div>
 <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg p-3">
 <p className="text-sm font-bold">
 لكل لحظة قهوة ، لحظة نجاح
 </p>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Window Display View - QR Camera Style */}
 {viewMode === 'window-display' && (
 <div className="px-3 md:px-6">
 <div className="max-w-7xl mx-auto h-screen flex flex-col justify-center">
 {/* Camera View Container */}
 <div className="bg-black/90 backdrop-blur-xl rounded-3xl p-4 md:p-8 border-4 border-primary/50 shadow-2xl">
 
 {/* Camera Header */}
 <div className="flex items-center justify-between mb-6 px-2">
 <div className="flex items-center space-x-2 space-x-reverse text-white">
 <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
 <span className="text-sm font-medium">وجّه الكاميرا نحو الرمز للطلب</span>
 <span className="text-lg"></span>
 </div>
 <div className="text-primary text-sm font-bold">CLUNY CAFE</div>
 </div>

 {/* Main Camera View - Always Side by Side */}
 <div className="grid grid-cols-2 gap-3 md:gap-8 items-center min-h-[400px] md:min-h-[500px]">
 
 {/* QR Code Section */}
 <div className="text-center space-y-3 md:space-y-6 p-2 md:p-4">
 <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-xl">
 <QRCodeComponent 
 url="https://www.cluny.cafe"
 size="lg"
 title="امسح للطلب"
 showURL={false}
 className="w-full"
 />
 </div>
 
 <div className="space-y-2 md:space-y-4">
 <h1 className="font-amiri text-lg md:text-4xl font-bold text-white">
 CLUNY CAFE
 </h1>
 <p className="text-xs md:text-xl text-gray-300">
 أجود أنواع القهوة العربية الأصيلة
 </p>
 <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl md:rounded-2xl p-2 md:p-4">
 <p className="text-xs md:text-lg font-bold">
 لكل لحظة قهوة ، لحظة نجاح
 </p>
 </div>
 </div>
 </div>

 {/* Current Drink Display */}
 <div className="flex justify-center p-2 md:p-4">
 {currentItem && (
 <div className="bg-card/95 backdrop-blur-xl border-2 border-primary/30 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl w-full">
 <div className="relative">
 <img 
 src={currentItem.imageUrl || getCoffeeImage(currentItem.id)}
 alt={currentItem.nameAr}
 className="w-full h-32 md:h-64 object-cover"
 onError={(e) => {
 e.currentTarget.src = "/images/default-coffee.png";
 }}
 />
 <div className="absolute inset-0 bg-gradient-to-t from-primary/40 via-transparent to-transparent"></div>
 {/* Price Tag Overlay */}
 <div className="absolute top-2 right-2 bg-primary text-white px-2 py-1 md:px-4 md:py-2 rounded-full">
 <span className="text-xs md:text-lg font-bold">{currentItem.price} ريال</span>
 </div>
 </div>
 
 <div className="p-3 md:p-6 space-y-2 md:space-y-4">
 <h3 className="font-amiri text-sm md:text-2xl font-bold text-primary text-center">
 {currentItem.nameAr}
 </h3>
 <p className="text-xs md:text-base text-muted-foreground text-center line-clamp-2">
 {currentItem.description}
 </p>
 <div className="flex items-center justify-center space-x-1 space-x-reverse">
 {Array.from({length: 5}).map((_, i) => (
 <Star key={i} className="w-3 h-3 md:w-5 md:h-5 text-accent fill-amber-400" />
 ))}
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Camera Footer */}
 <div className="flex items-center justify-center mt-4 md:mt-6 px-2">
 <div className="flex items-center space-x-4 space-x-reverse text-white/70">
 <div className="w-2 h-2 bg-green-500 rounded-full"></div>
 <span className="text-xs md:text-sm">جاهز للمسح</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

        {/* Cinema View */}
        {viewMode === 'cinema' && currentItem && (
          <div className="min-h-[85vh] flex flex-col mx-4 md:mx-6 rounded-3xl overflow-hidden border border-primary/20 shadow-2xl">
            {/* Spotlight Hero */}
            <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black/80">
              <div className="absolute inset-0 overflow-hidden">
                <img src={currentItem.imageUrl || getCoffeeImage(currentItem.id)} alt="" className="w-full h-full object-cover blur-xl scale-110 opacity-25" onError={(e) => { e.currentTarget.src = "/images/default-coffee.png"; }} />
              </div>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_40%,_transparent_30%,_black_100%)]" />
              <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 px-6 py-14 max-w-5xl w-full">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-full bg-primary/40 blur-3xl scale-110 animate-pulse" />
                  <div className="relative w-60 h-60 rounded-full overflow-hidden border-4 border-primary/70 shadow-2xl shadow-primary/40 ring-8 ring-white/5">
                    <img src={currentItem.imageUrl || getCoffeeImage(currentItem.id)} alt={currentItem.nameAr} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = "/images/default-coffee.png"; }} />
                  </div>
                  <div className="absolute -top-3 -left-3 w-12 h-12 bg-primary rotate-45 shadow-lg shadow-primary/50 flex items-center justify-center">
                    <Star className="w-5 h-5 text-white -rotate-45 fill-white" />
                  </div>
                </div>
                <div className="text-white text-center lg:text-right space-y-5">
                  <div className="inline-block px-4 py-1 border border-primary/50 rounded-full text-primary text-sm tracking-widest uppercase">
                    {categoryTitles[currentItem.category] || currentItem.category}
                  </div>
                  <h2 className="font-amiri text-5xl lg:text-7xl font-bold leading-tight drop-shadow-lg">{currentItem.nameAr}</h2>
                  <p className="text-xl text-white/60 max-w-lg leading-relaxed">{currentItem.description}</p>
                  <div className="flex items-center gap-4 justify-center lg:justify-start">
                    <span className="text-5xl font-bold text-primary">{currentItem.price}</span>
                    <span className="text-2xl text-white/50">ريال</span>
                  </div>
                  <button onClick={() => { setSelectedItemForCart(currentItem); setIsModalOpen(true); }} className="px-8 py-3 bg-primary text-white font-bold rounded-full shadow-lg shadow-primary/40 hover:bg-primary/90 transition-all flex items-center gap-2 mx-auto lg:mx-0">
                    <ShoppingCart className="w-5 h-5" /> إضافة للسلة
                  </button>
                </div>
              </div>
            </div>
            {/* Film strip */}
            <div className="bg-black border-t-2 border-primary/30 py-4 px-4 overflow-x-auto">
              <div className="flex gap-3 w-max items-center">
                <div className="flex flex-col gap-1.5">
                  {Array.from({length: 4}).map((_, i) => (<div key={i} className="w-3 h-3 rounded-sm bg-white/20" />))}
                </div>
                {coffeeItems.map((item, idx) => (
                  <div key={item.id} onClick={() => setCurrentIndex(idx)} className={`relative shrink-0 w-24 h-24 rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-300 ${idx === currentIndex ? 'border-primary scale-110 shadow-lg shadow-primary/40' : 'border-white/10 opacity-50 hover:opacity-90'}`}>
                    <img src={item.imageUrl || getCoffeeImage(item.id)} alt={item.nameAr} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = "/images/default-coffee.png"; }} />
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-center text-[9px] py-1 truncate px-1">{item.nameAr}</div>
                  </div>
                ))}
                <div className="flex flex-col gap-1.5">
                  {Array.from({length: 4}).map((_, i) => (<div key={i} className="w-3 h-3 rounded-sm bg-white/20" />))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Magazine View */}
        {viewMode === 'magazine' && currentItem && (
          <div className="min-h-[85vh] px-4 md:px-6 flex flex-col gap-8">
            <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-primary/20 min-h-[480px] flex flex-col lg:flex-row">
              <div className="relative lg:w-[55%] min-h-[280px] overflow-hidden">
                <img src={currentItem.imageUrl || getCoffeeImage(currentItem.id)} alt={currentItem.nameAr} className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.src = "/images/default-coffee.png"; }} />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background lg:hidden" />
              </div>
              <div className="relative lg:w-[45%] flex flex-col justify-center p-8 bg-background/95 backdrop-blur-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-primary/40" />
                  <span className="text-primary text-xs tracking-[0.3em] uppercase font-bold">{categoryTitles[currentItem.category] || currentItem.category}</span>
                  <div className="h-px flex-1 bg-primary/40" />
                </div>
                <h2 className="font-amiri text-4xl lg:text-6xl font-black text-foreground leading-tight mb-4">{currentItem.nameAr}</h2>
                <p className="text-muted-foreground text-lg leading-relaxed mb-8 border-r-4 border-primary pr-4">{currentItem.description}</p>
                <div className="flex items-end gap-4 mb-8">
                  <div className="bg-primary text-white px-6 py-3 rounded-2xl">
                    <span className="text-3xl font-black">{currentItem.price}</span>
                    <span className="text-lg mr-1">ريال</span>
                  </div>
                  <div className="flex gap-1">{Array.from({length: 5}).map((_, i) => (<Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />))}</div>
                </div>
                <button onClick={() => { setSelectedItemForCart(currentItem); setIsModalOpen(true); }} className="flex items-center gap-2 bg-foreground text-background font-bold px-8 py-3 rounded-full w-fit hover:bg-primary hover:text-white transition-all duration-300 shadow-lg">
                  <ShoppingCart className="w-5 h-5" /> أطلب الآن
                </button>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-8 h-1 bg-primary rounded-full" />
                <h3 className="font-amiri text-2xl font-bold text-foreground">المزيد من القائمة</h3>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {coffeeItems.filter((_, i) => i !== currentIndex).slice(0, 8).map((item, idx) => (
                  <div key={item.id} onClick={() => setCurrentIndex(coffeeItems.indexOf(item))} className="group cursor-pointer">
                    <div className={`relative overflow-hidden shadow-md transition-all duration-300 group-hover:shadow-xl ${idx % 3 === 0 ? 'rounded-3xl' : idx % 3 === 1 ? 'rounded-tr-3xl rounded-bl-3xl' : 'rounded-tl-3xl rounded-br-3xl'}`}>
                      <img src={item.imageUrl || getCoffeeImage(item.id)} alt={item.nameAr} className="w-full h-36 object-cover group-hover:scale-105 transition-all duration-500" onError={(e) => { e.currentTarget.src = "/images/default-coffee.png"; }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-0 inset-x-0 p-3">
                        <p className="text-white font-bold text-sm">{item.nameAr}</p>
                        <p className="text-primary text-xs font-bold">{item.price} ريال</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-r from-primary via-primary/80 to-amber-600 rounded-3xl p-6 flex items-center justify-between gap-6 flex-wrap">
              <div className="text-white">
                <h4 className="font-amiri text-3xl font-black mb-1">CLUNY CAFE</h4>
                <p className="text-white/80 text-lg">لكل لحظة قهوة ، لحظة نجاح</p>
              </div>
              <div className="bg-white rounded-2xl p-3">
                <QRCodeComponent url="https://www.cluny.cafe" size="sm" title="اطلب الآن" />
              </div>
            </div>
          </div>
        )}

        {/* Neon View */}
        {viewMode === 'neon' && currentItem && (
          <div className="min-h-[85vh] bg-[#080c10] rounded-3xl mx-4 md:mx-6 overflow-hidden relative border border-primary/20 shadow-2xl shadow-primary/10">
            <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'linear-gradient(#2D9B6E22 1px, transparent 1px), linear-gradient(90deg, #2D9B6E22 1px, transparent 1px)', backgroundSize: '40px 40px'}} />
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-[80px]" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-cyan-500/15 rounded-full blur-[80px]" />
            <div className="absolute top-1/2 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-[60px]" />
            <div className="relative z-10 p-6 md:p-10 flex flex-col lg:flex-row gap-10 min-h-[85vh]">
              <div className="lg:w-1/2 flex flex-col items-center justify-center gap-6">
                <div className="relative">
                  <div className="absolute inset-0 blur-2xl bg-primary/30 scale-105" style={{clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)'}} />
                  <div className="relative w-64 h-72 overflow-hidden" style={{clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)'}}>
                    <img src={currentItem.imageUrl || getCoffeeImage(currentItem.id)} alt={currentItem.nameAr} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = "/images/default-coffee.png"; }} />
                  </div>
                </div>
                <div className="flex gap-3 flex-wrap justify-center max-w-xs">
                  {coffeeItems.slice(0, 6).map((item, idx) => (
                    <div key={item.id} onClick={() => setCurrentIndex(idx)} className={`w-12 h-12 rounded-lg overflow-hidden cursor-pointer border transition-all duration-300 ${idx === currentIndex ? 'border-primary shadow-md shadow-primary/60 scale-110' : 'border-white/10 opacity-40 hover:opacity-80'}`}>
                      <img src={item.imageUrl || getCoffeeImage(item.id)} alt={item.nameAr} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = "/images/default-coffee.png"; }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:w-1/2 flex flex-col justify-center gap-6 text-right">
                <div className="inline-flex self-end items-center gap-2 px-4 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary text-sm">
                  <Coffee className="w-4 h-4" />
                  {categoryTitles[currentItem.category] || currentItem.category}
                </div>
                <h2 className="font-amiri text-5xl lg:text-7xl font-black text-white leading-tight" style={{textShadow: '0 0 20px #2D9B6E, 0 0 40px #2D9B6E66'}}>
                  {currentItem.nameAr}
                </h2>
                <div className="h-px w-full bg-gradient-to-l from-primary via-cyan-400 to-transparent" />
                <p className="text-white/50 text-lg leading-relaxed">{currentItem.description}</p>
                <div className="self-end border border-primary/50 rounded-2xl px-6 py-4 bg-primary/10">
                  <span className="text-4xl font-black text-primary" style={{textShadow: '0 0 15px #2D9B6E'}}>{currentItem.price}</span>
                  <span className="text-white/40 text-xl mr-2">ريال</span>
                </div>
                <div className="flex gap-2 self-end">
                  {Array.from({length: 5}).map((_, i) => (<Star key={i} className="w-6 h-6 fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_#f59e0b]" />))}
                </div>
                <button onClick={() => { setSelectedItemForCart(currentItem); setIsModalOpen(true); }} className="self-end flex items-center gap-2 px-8 py-3 rounded-full font-bold text-white border border-primary/60 bg-primary/20 hover:bg-primary/40 transition-all duration-300" style={{boxShadow: '0 0 15px #2D9B6E55'}}>
                  <ShoppingCart className="w-5 h-5" /> أضف للسلة
                </button>
                <div className="self-end bg-white/5 border border-primary/20 rounded-2xl p-3">
                  <QRCodeComponent url="https://www.cluny.cafe" size="sm" title="امسح للطلب" />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      <AddToCartModal
        item={selectedItemForCart as any}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddToCart={(item) => {
          toast({
            title: "تمت الإضافة",
            description: `تم إضافة ${item.name} إلى السلة`,
          });
        }}
      />
 </div>
 );
}