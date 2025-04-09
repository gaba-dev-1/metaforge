import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Menu, X, TrendingUp, Search, Layers, Book, Newspaper, User, ChevronDown } from 'lucide-react';
import { REGIONS } from '@/utils/useTftData';
import { RegionDropdown } from './RegionDropdown';
import SearchBar from './SearchBar';

interface NavItem {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavDropdownProps {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  isActive: boolean;
  className?: string;
}

// Dropdown Component
function NavDropdown({ label, icon, items, isActive, className = '' }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        className={`flex items-center gap-2 px-3 py-2 rounded-md ${
          isActive ? "bg-gold/20 text-gold border-b-2 border-gold" : "text-cream hover:bg-gold/10"
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {icon && React.createElement(icon, { className: "h-4 w-4" })}
        <span className="hidden sm:block text-sm">{label}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {isOpen && (
        <div className="dropdown-content">
          <div className="py-1">
            {items.map((item, index) => (
              <Link
                key={index}
                href={item.href}
                className="block px-4 py-2 text-sm hover:bg-gold/10 text-cream"
                onClick={() => setIsOpen(false)}
              >
                <div className="flex items-center gap-2">
                  {item.icon && React.createElement(item.icon, { className: "h-4 w-4" })}
                  <span>{item.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Profile Icon Component
function ProfileIcon() {
  const router = useRouter();
  return (
    <button 
      onClick={() => router.push('/profile')}
      className="flex items-center justify-center w-8 h-8 rounded-full bg-brown-light/30 hover:bg-brown-light/50 text-cream ml-1"
    >
      <User size={16} />
    </button>
  );
}

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Define navigation items
  const statsAndTools: NavItem[] = [
    { name: "Meta Report", href: "/meta-report", icon: TrendingUp },
    { name: "Stats Explorer", href: "/stats-explorer", icon: Search },
    { name: "Team Builder", href: "/team-builder", icon: Layers }
  ];
  
  const resources: NavItem[] = [
    { name: "Guides", href: "/guides", icon: Book },
    { name: "News", href: "/news", icon: Newspaper }
  ];
  
  // Check if any items in a dropdown are active
  const isStatsActive = statsAndTools.some(item => router.pathname === item.href);
  const isResourcesActive = resources.some(item => router.pathname === item.href);

  return (
    <div className="min-h-screen bg-main-bg bg-cover bg-center bg-fixed flex flex-col">
      <div className="flex-grow flex flex-col min-h-screen bg-brown/80">
        {/* Desktop and Mobile Navbar */}
        <nav className="bg-brown/95 shadow-lg sticky top-0 z-50 border-b border-gold/40">
          <div className="max-w-7xl mx-auto px-2 sm:px-4">
            <div className="flex h-14 items-center justify-between">
              {/* Logo and title */}
              <Link href="/" className="flex items-center gap-2">
                <img 
                  src="/assets/app.png" 
                  alt="MetaForge" 
                  className="h-12 w-12" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/assets/traits/default.png';
                  }}
                />
                <span className="text-xl font-medium text-gold">MetaForge</span>
              </Link>
              
              {/* Desktop search */}
              <div className="hidden md:block w-64 lg:w-80">
                <SearchBar />
              </div>
              
              {/* Desktop navigation */}
              <div className="hidden md:flex gap-1 items-center">
                <NavDropdown 
                  label="Tools" 
                  icon={TrendingUp} 
                  items={statsAndTools} 
                  isActive={isStatsActive} 
                />
                
                <NavDropdown 
                  label="Resources" 
                  icon={Book} 
                  items={resources} 
                  isActive={isResourcesActive} 
                />
                
                <RegionDropdown />
                
                <ProfileIcon />
              </div>
              
              {/* Mobile menu button */}
              <div className="flex md:hidden">
                <button
                  type="button"
                  className="inline-flex items-center justify-center p-2 rounded-md text-cream hover:text-gold hover:bg-brown-light/30"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  <span className="sr-only">Open menu</span>
                  {mobileMenuOpen ? (
                    <X className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Menu className="block h-6 w-6" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Mobile menu panel */}
          <div className={`md:hidden ${mobileMenuOpen ? 'block' : 'hidden'}`}>
            <div className="px-2 pt-2 pb-3 space-y-1 border-t border-gold/20">
              <div className="flex items-center justify-between">
                <div className="px-3 py-2 font-medium text-cream">Tools</div>
              </div>
              {statsAndTools.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block px-3 py-2 rounded-md text-sm font-medium ${
                    router.pathname === item.href
                      ? 'text-gold bg-gold/10'
                      : 'text-cream hover:bg-brown-light/30'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    {item.icon && React.createElement(item.icon, { className: "h-4 w-4" })}
                    <span>{item.name}</span>
                  </div>
                </Link>
              ))}
              
              <div className="flex items-center justify-between mt-2">
                <div className="px-3 py-2 font-medium text-cream">Resources</div>
              </div>
              {resources.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block px-3 py-2 rounded-md text-sm font-medium ${
                    router.pathname === item.href
                      ? 'text-gold bg-gold/10'
                      : 'text-cream hover:bg-brown-light/30'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    {item.icon && React.createElement(item.icon, { className: "h-4 w-4" })}
                    <span>{item.name}</span>
                  </div>
                </Link>
              ))}
              
              <div className="px-3 py-2 border-t border-gold/20 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-cream">Region</span>
                  <RegionDropdown />
                </div>
              </div>
              
              <div className="px-3 py-2 border-t border-gold/20 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-cream">Profile</span>
                  <ProfileIcon />
                </div>
              </div>
            </div>
          </div>
        </nav>
        
        {/* Mobile search */}
        <div className="md:hidden px-4 py-2 bg-brown/90 border-b border-gold/30">
          <SearchBar />
        </div>
        
        <main className="max-w-7xl w-full mx-auto px-2 sm:px-4 py-6 sm:py-8">{children}</main>
        
        <footer className="bg-brown/95 py-4 border-t border-gold/30 text-center text-sm text-cream/70 mt-auto">
          <div className="max-w-7xl mx-auto px-4">
            <p>MetaForge is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
