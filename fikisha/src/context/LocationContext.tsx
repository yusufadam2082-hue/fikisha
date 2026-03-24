import { createContext, useContext, useState, type ReactNode } from 'react';

interface LocationContextType {
  deliveryAddress: string;
  setDeliveryAddress: (address: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

function getDefaultProfileAddress(): string {
  const rawAddresses = localStorage.getItem('fikisha_addresses');
  if (!rawAddresses) {
    return '';
  }

  try {
    const parsed = JSON.parse(rawAddresses) as Array<{ street?: string; city?: string; isDefault?: boolean }>;
    const defaultAddress = Array.isArray(parsed) ? parsed.find((address) => address.isDefault) : null;
    if (!defaultAddress?.street || !defaultAddress?.city) {
      return '';
    }

    return `${defaultAddress.street}, ${defaultAddress.city}`;
  } catch {
    return '';
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [deliveryAddress, setDeliveryAddress] = useState<string>(() => {
    return localStorage.getItem('fikisha_delivery_address') || getDefaultProfileAddress();
  });

  const handleSetAddress = (address: string) => {
    setDeliveryAddress(address);
    localStorage.setItem('fikisha_delivery_address', address);
  };

  return (
    <LocationContext.Provider value={{ deliveryAddress, setDeliveryAddress: handleSetAddress }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}