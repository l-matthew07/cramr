import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeLocation = 
  | 'country' 
  | 'cafe_la' | 'cafe_sf' | 'cafe_chicago' | 'cafe_ny' | 'cafe_vancouver' | 'cafe_toronto'
  | 'apt_la' | 'apt_sf' | 'apt_chicago' | 'apt_ny' | 'apt_vancouver' | 'apt_toronto';

export type ThemeCondition = 'auto' | 'sunny' | 'night' | 'rainy' | 'sunset' | 'sunrise';

interface ThemeState {
  location: ThemeLocation;
  condition: ThemeCondition;
  setLocation: (l: ThemeLocation) => void;
  setCondition: (c: ThemeCondition) => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      location: 'cafe_la',
      condition: 'auto',
      setLocation: (location) => set({ location }),
      setCondition: (condition) => set({ condition }),
    }),
    { name: 'cramr-theme-v2' }
  )
);

export function getBackgroundImage(location: ThemeLocation): string {
  switch (location) {
    case 'country': return '/country.png';
    case 'cafe_la': return '/cafe-la.png';
    case 'cafe_sf': return '/cafe-sf.png';
    case 'cafe_chicago': return '/cafe-chicago.png';
    case 'cafe_ny': return '/cafe-ny.png';
    case 'cafe_vancouver': return '/cafe-vancouver.png';
    case 'cafe_toronto': return '/cafe-toronto.png';
    case 'apt_la': return '/apt-la.png';
    case 'apt_sf': return '/apt-sf.png';
    case 'apt_chicago': return '/apt-chicago.png';
    case 'apt_ny': return '/cafe-ny.png'; // Fallback to cafe
    case 'apt_vancouver': return '/cafe-vancouver.png'; // Fallback to cafe
    case 'apt_toronto': return '/cafe-toronto.png'; // Fallback to cafe
    default: return '/cafe-la.png';
  }
}

export function resolveCondition(condition: ThemeCondition): Exclude<ThemeCondition, 'auto'> {
  if (condition !== 'auto') return condition;
  const hour = new Date().getHours();
  if (hour >= 17 && hour < 20) return 'sunset';
  if (hour >= 20 || hour < 6) return 'night';
  return 'sunny';
}

export function getThemeFilter(condition: ThemeCondition): string {
  const activeCondition = resolveCondition(condition);

  switch (activeCondition) {
    case 'night': return 'brightness(0.35) contrast(1.1) sepia(0.3) saturate(0.8) hue-rotate(180deg)';
    case 'rainy': return 'grayscale(0.45) brightness(0.8) blur(1px)';
    case 'sunset': return 'sepia(0.45) saturate(1.7) hue-rotate(-20deg) brightness(0.9)';
    case 'sunrise': return 'sepia(0.25) saturate(1.3) hue-rotate(-10deg) brightness(1.05)';
    default: return 'none'; // sunny
  }
}
