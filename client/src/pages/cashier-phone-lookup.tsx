import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ICustomer, ILoyaltyCard } from "@shared/schema";

interface SearchCustomerProps {
  setSearchPhone: (phone: string) => void;
  searchPhone: string;
}

const SearchCustomer: React.FC<SearchCustomerProps> = ({ setSearchPhone, searchPhone }) => {
  const [phoneNumber, setPhoneNumber] = useState("");

  const { data: loyaltyCard, isLoading: isLoadingCard, error: cardError } = useQuery<ILoyaltyCard>({
    queryKey: [`/api/loyalty/cards/phone/${searchPhone}`],
    enabled: !!searchPhone && searchPhone.length === 9,
  });

  const { data: customers = [] } = useQuery<ICustomer[]>({
    queryKey: ["/api/customers"],
    enabled: false,
  });

  const handleSearch = () => {
    const cleanPhone = phoneNumber.trim().replace(/\s/g, '');

    if (cleanPhone.length !== 9) {
      toast({
        variant: "destructive",
        title: "رقم هاتف غير صحيح",
        description: "يرجى إدخال رقم هاتف مكون من 9 أرقام",
      });
      return;
    }

    if (!cleanPhone.startsWith('5')) {
      toast({
        variant: "destructive",
        title: "رقم هاتف غير صحيح",
        description: "يجب أن يبدأ رقم الهاتف بالرقم 5",
      });
      return;
    }

    if (!/^5\d{8}$/.test(cleanPhone)) {
      toast({
        variant: "destructive",
        title: "رقم هاتف غير صحيح",
        description: "صيغة رقم الهاتف غير صحيحة (مثال: 512345678)",
      });
      return;
    }

    setSearchPhone(cleanPhone);
  };

  return (
    <div className="flex items-center gap-4">
      <Input
        type="tel"
        placeholder="أدخل رقم الهاتف (5xxxxxxxx)"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleSearch()}
        className="bg-[#1a1410] border-amber-500/30 text-white pr-10 text-right"
        dir="ltr"
        data-testid="input-phone"
        maxLength={9}
      />
      <Button onClick={handleSearch} className="bg-background0 hover:bg-primary text-black">
        بحث
      </Button>
    </div>
  );
};

export default SearchCustomer;