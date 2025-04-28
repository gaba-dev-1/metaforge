import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { REGIONS } from '@/utils/useTftData';

export function RegionDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentRegion, setCurrentRegion] = useState('all');
  const [isMounted, setIsMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    setIsMounted(true);
    const savedRegion = localStorage.getItem('tft-region');
    if (savedRegion) setCurrentRegion(savedRegion);
  }, []);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const changeRegion = (regionId: string) => {
    localStorage.setItem('tft-region', regionId);
    window.location.reload();
  };
  
  if (!isMounted) return <div className="h-9 w-9 sm:w-16" />;
  
  const currentRegionName = REGIONS.find(r => r.id === currentRegion)?.name || 'All Regions';
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="flex items-center gap-1 px-2 sm:px-3 py-2 rounded-md text-cream hover:bg-gold/10"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:block text-sm">{currentRegionName}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {isOpen && (
        <div className="dropdown-content z-50 right-0 sm:right-auto">
          <div className="py-1">
            {REGIONS.map((region) => (
              <button
                key={region.id}
                className={`block w-full text-left px-4 py-2 text-sm ${
                  region.id === currentRegion ? "bg-gold/20 text-gold" : "hover:bg-gold/10 text-cream"
                }`}
                onClick={() => {
                  setIsOpen(false);
                  changeRegion(region.id);
                }}
              >
                {region.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
