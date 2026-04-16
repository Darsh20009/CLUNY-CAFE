import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Customer } from "@shared/schema";
import { customerStorage } from "@/lib/customer-storage";
import { useGeofencing } from "@/hooks/useGeofencing";

interface CustomerContextType {
  customer: Customer | null;
  setCustomer: (customer: Customer | null) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomerState] = useState<Customer | null>(() => {
    const profile = customerStorage.getProfile();
    // For backward compatibility, also check the old key if profile is null
    if (!profile) {
      const stored = localStorage.getItem("qahwa-customer");
      return stored ? JSON.parse(stored) : null;
    }
    return profile as unknown as Customer;
  });

  const setCustomer = (newCustomer: Customer | null) => {
    setCustomerState(newCustomer);
    if (newCustomer) {
      // Sync with customerStorage
      if (!customerStorage.getProfile()) {
        customerStorage.registerCustomer(newCustomer.name, newCustomer.phone);
      }
      
      localStorage.setItem("qahwa-customer", JSON.stringify(newCustomer));
      localStorage.setItem("currentCustomer", JSON.stringify(newCustomer));
    } else {
      customerStorage.logout();
      localStorage.removeItem("qahwa-customer");
      localStorage.removeItem("currentCustomer");
    }
  };

  const logout = () => {
    setCustomer(null);
    localStorage.removeItem("customer-phone");
    localStorage.removeItem("customer-id");
  };

  const isAuthenticated = !!customer;

  // Start geofencing when customer is logged in
  const customerId = (customer as any)?._id || (customer as any)?.id || undefined;
  useGeofencing(customerId);

  return (
    <CustomerContext.Provider value={{ customer, setCustomer, logout, isAuthenticated }}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error("useCustomer must be used within CustomerProvider");
  }
  return context;
}
