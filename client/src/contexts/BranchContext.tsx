import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

interface Branch {
  id: string;
  nameAr: string;
  nameEn?: string;
  address?: string;
  city?: string;
  phone?: string;
  location?: { lat: number; lng: number };
  isOnline?: boolean | number;
  isActive?: boolean | number;
  allowOnlineOrders?: boolean | number;
  allowCarOrders?: boolean | number;
  allowTableOrders?: boolean | number;
  imageUrl?: string;
  openHours?: string;
}

interface BranchContextValue {
  selectedBranchId: string | null;
  selectedBranch: Branch | null;
  branches: Branch[];
  branchesLoading: boolean;
  selectBranch: (branchId: string | null) => void;
  showBranchSelector: boolean;
  setShowBranchSelector: (v: boolean) => void;
}

const BranchContext = createContext<BranchContextValue>({
  selectedBranchId: null,
  selectedBranch: null,
  branches: [],
  branchesLoading: false,
  selectBranch: () => {},
  showBranchSelector: false,
  setShowBranchSelector: () => {},
});

const STORAGE_KEY = "qirox-selected-branch";

export function BranchProvider({ children }: { children: ReactNode }) {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [showBranchSelector, setShowBranchSelector] = useState(false);

  const { data: branches = [], isLoading: branchesLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (branchesLoading || branches.length === 0) return;

    if (branches.length === 1) {
      const only = branches[0];
      setSelectedBranchId(only.id);
      try { localStorage.setItem(STORAGE_KEY, only.id); } catch {}
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    const stillExists = stored && branches.some(b => b.id === stored);
    if (!stillExists) {
      setShowBranchSelector(true);
    }
  }, [branches, branchesLoading]);

  const selectBranch = (branchId: string | null) => {
    setSelectedBranchId(branchId);
    setShowBranchSelector(false);
    try {
      if (branchId) localStorage.setItem(STORAGE_KEY, branchId);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const selectedBranch = branches.find(b => b.id === selectedBranchId) || null;

  return (
    <BranchContext.Provider value={{
      selectedBranchId,
      selectedBranch,
      branches,
      branchesLoading,
      selectBranch,
      showBranchSelector,
      setShowBranchSelector,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
