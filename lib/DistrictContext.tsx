import React, { createContext, useContext, useState } from 'react';

// ─── Districts ────────────────────────────────────────────────────────────────
export const DISTRICTS = ['Bergama', 'Dikili', 'Aliağa', 'Kınık', 'Ayvalık'] as const;
export type District = (typeof DISTRICTS)[number];

// ─── Context shape ────────────────────────────────────────────────────────────
interface DistrictContextType {
  selectedDistrict: District;
  setSelectedDistrict: (district: District) => void;
}

const DistrictContext = createContext<DistrictContextType>({
  selectedDistrict: 'Bergama',
  setSelectedDistrict: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function DistrictProvider({ children }: { children: React.ReactNode }) {
  const [selectedDistrict, setSelectedDistrict] = useState<District>('Bergama');

  return (
    <DistrictContext.Provider value={{ selectedDistrict, setSelectedDistrict }}>
      {children}
    </DistrictContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDistrict() {
  return useContext(DistrictContext);
}

