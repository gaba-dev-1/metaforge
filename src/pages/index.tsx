import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Layout, Card, FilterButtons, LoadingState, ErrorMessage } from '@/components/ui';
import { useTftData } from '@/utils/useTftData';
import { TrendingUp, Search, Layers, Grid3x3, ChevronDown, ChevronUp, Book, Newspaper, User } from 'lucide-react';
import traitsJson from '@/mapping/traits.json';
import unitsJson from '@/mapping/units.json';
import itemsJson from '@/mapping/items.json';
import { StatsCarousel } from '@/components/common/StatsCarousel';
import { HeaderBanner } from '@/components/common/HeaderBanner';
import { FeatureBanner, FeatureCard, FeatureCardsContainer } from '@/components/common/FeatureBanner';
import { getEntityIcon, DEFAULT_ICONS } from '@/utils/paths';

// Define types with required 'all' property
type FilterType = 'units' | 'items' | 'traits';
interface FilterValue {
  all: boolean;
  [key: string]: boolean;
}

interface EntityGridProps {
  entities: Array<{
    id: string;
    name: string;
    icon: string;
    cost?: number;
    category?: string;
  }>;
  type: 'units' | 'items' | 'traits';
}

const EntityGrid = ({ entities, type }: EntityGridProps) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
    {entities.map((entity, i) => (
      <Link key={i} href={`/entity/${type}/${entity.id}`}>
        <div className="flex flex-col items-center p-2 bg-brown-light/20 rounded-lg hover:bg-brown-light/40 transition-all duration-300">
          {type === 'units' && (
            <div className="relative">
              <img 
                src={`/assets/units/${entity.icon}`} 
                alt={entity.name} 
                className="w-12 h-12 rounded-full border-2 object-cover transition-transform duration-300 hover:scale-110" 
                style={{ 
                  borderColor: ['#9aa4af', '#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e74c3c'][(entity.cost || 1) - 1] 
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = DEFAULT_ICONS.unit;
                }}
              />
            </div>
          )}
          {type === 'items' && (
            <img 
              src={`/assets/items/${entity.icon}`} 
              alt={entity.name} 
              className="w-11 h-11 object-contain transition-transform duration-300 hover:scale-110" 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = DEFAULT_ICONS.item;
              }}
            />
          )}
          {type === 'traits' && (
            <img 
              src={getEntityIcon(entity, 'trait')} 
              alt={entity.name} 
              className="w-12 h-12 object-contain transition-transform duration-300 hover:scale-110" 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = DEFAULT_ICONS.trait;
              }}
            />
          )}
          <span className="text-xs mt-1 truncate w-full text-center">{entity.name}</span>
        </div>
      </Link>
    ))}
  </div>
);

export default function Home() {
  const { isLoading, data, error, handleRetry } = useTftData();
  const [activeTab, setActiveTab] = useState<FilterType>('units');
  const [filters, setFilters] = useState<Record<FilterType, FilterValue>>({ 
    units: { all: true }, 
    items: { all: true }, 
    traits: { all: true, origin: false, class: false } 
  });
  const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(false);
  
  // Process data before conditional returns
  const allUnits = useMemo(() => 
    Object.entries(unitsJson.units as Record<string, any>)
      .map(([id, unit]) => ({ id, name: unit.name, icon: unit.icon, cost: unit.cost }))
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
  , []);
  
  const allTraitsData = { ...traitsJson.origins, ...traitsJson.classes };
  
  const allTraits = useMemo(() => 
    Object.entries(allTraitsData as Record<string, any>)
      .map(([id, trait]) => ({
        id, 
        name: trait.name, 
        icon: trait.icon,
        type: id in traitsJson.origins ? 'Origin' : 'Class'
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  , []);
  
  const allItems = useMemo(() => 
    Object.entries(itemsJson.items as Record<string, any>)
      .filter(([_, item]) => item.category !== 'component' && item.category !== 'tactician')
      .map(([id, item]) => ({ id, name: item.name, icon: item.icon, category: item.category }))
      .sort((a, b) => a.name.localeCompare(b.name))
  , []);

  // Filter options
  const costFilters = useMemo(() => 
    Array.from(new Set(allUnits.map(unit => unit.cost)))
      .sort()
      .map(cost => ({ id: cost.toString(), name: `${cost} 🪙` }))
  , [allUnits]);
  
  const categoryFilters = useMemo(() => 
    Array.from(new Set(allItems.map(item => item.category)))
      .filter(Boolean)
      .map(category => ({ id: category, name: category.replace(/-/g, ' ') }))
  , [allItems]);
  
  const traitTypeFilters = [
    { id: 'origin', name: 'Origins' },
    { id: 'class', name: 'Classes' }
  ];
  
  // Filtered entities
  const filteredUnits = useMemo(() => 
    allUnits.filter(unit => {
      const costKey = unit.cost?.toString();
      return filters.units.all || (costKey && costKey in filters.units && filters.units[costKey]);
    })
  , [allUnits, filters.units]);
  
  const filteredItems = useMemo(() => 
    allItems.filter(item => 
      filters.items.all || 
      (item.category && item.category in filters.items && filters.items[item.category])
    )
  , [allItems, filters.items]);
  
  const filteredTraits = useMemo(() => 
    allTraits.filter(trait => 
      filters.traits.all || 
      ('origin' in filters.traits && filters.traits.origin && trait.type === 'Origin') ||
      ('class' in filters.traits && filters.traits.class && trait.type === 'Class')
    )
  , [allTraits, filters.traits]);
  
  if (isLoading) return (
    <Layout>
      <LoadingState message="Loading TFT data..." />
    </Layout>
  );

  if (error) return (
    <Layout>
      <div className="mt-6">
        <ErrorMessage 
          message={error.message} 
          onRetry={handleRetry} 
        />
      </div>
    </Layout>
  );

  // Toggle filter handler
  const toggleFilter = (type: FilterType, filterId: string): void => {
    if (filterId === 'all') {
      setFilters({...filters, [type]: { all: true }});
    } else {
      const newTypeFilters: FilterValue = {...filters[type], all: false};
      
      if (newTypeFilters[filterId]) {
        newTypeFilters[filterId] = false;
        // Check if any filter is still active
        const hasActiveFilters = Object.entries(newTypeFilters)
          .some(([key, value]) => key !== 'all' && value);
          
        if (!hasActiveFilters) {
          newTypeFilters.all = true;
        }
      } else {
        newTypeFilters[filterId] = true;
      }
      
      setFilters({...filters, [type]: newTypeFilters});
    }
  };
  
  return (
    <Layout>
      {/* Header Banner */}
      <HeaderBanner />
      
      {/* Stats Carousel */}
      <StatsCarousel />
    
      {/* First Feature Section */}
      <div className="mt-10">
        <FeatureBanner title="Tools for Tacticians" />
        <div className="mt-2">
          <FeatureCardsContainer>
            <FeatureCard 
              title="Meta Report"
              icon={<TrendingUp size={30} />}
              description="Discover current best strategies" 
              linkTo="/meta-report"
            />
            <FeatureCard 
              title="Stats Explorer"
              icon={<Search size={30} />}
              description="Analyze performance with detailed stats"
              linkTo="/stats-explorer"
            />
            <FeatureCard 
              title="Team Builder"
              icon={<Layers size={30} />}
              description="Plan & craft winning compositions"
              linkTo="/team-builder"
            />
          </FeatureCardsContainer>
        </div>
      </div>
      
      {/* Second Feature Section */}
      <div className="mt-10">
        <FeatureBanner title="Resources & Community" />
        <div className="mt-2">
          <FeatureCardsContainer>
            <FeatureCard 
              title="Strategy Guides"
              icon={<Book size={30} />}
              description="Learn from top players and climb the ladder" 
              linkTo="/guides"
            />
            <FeatureCard 
              title="Latest News"
              icon={<Newspaper size={30} />}
              description="Stay updated with patches and game changes"
              linkTo="/news"
            />
            <FeatureCard 
              title="Player Profile"
              icon={<User size={30} />}
              description="Track your stats and match history"
              linkTo="/profile"
            />
          </FeatureCardsContainer>
        </div>
      </div>
        
      {/* Collections Section */}
      <div className="mt-10">
        <FeatureBanner title="TFT Collection Database" />
        <Card className="mt-2 transition-colors backdrop-blur-md bg-brown/5 border border-gold/30 rounded-lg p-2 shadow-lg hover:bg-brown/50 hover:border-gold/50 cursor-pointer">
          <div 
            className="flex flex-col items-center cursor-pointer pt-2 px-2"
            onClick={() => setIsCollectionsExpanded(!isCollectionsExpanded)}
          >
            {/* Hexagon with hover effect - UPDATED BORDER COLOR TO GOLD */}
            <div className="feature-hex-container">
              <svg 
                className="feature-hex-svg" 
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polygon 
                  points="50,0 100,25 100,75 50,100 0,75 0,25" 
                  fill="hsla(27, 69.90%, 14.30%, 0.94)"
                  stroke="rgba(182, 141, 64, 0.7)" 
                  strokeWidth="1.5"
                />
              </svg>
              
              <div className="feature-hex-content">
                <Grid3x3 
                  size={28}
                  className={`transition-transform duration-500 ${isCollectionsExpanded ? 'rotate-180' : ''}`}
                />
                <div className="feature-hex-glow">
                  <Grid3x3 size={28} />
                </div>
              </div>
            </div>
            <h3 className="text-lg text-gold mb-2">Collections</h3>
            <div className="text-xs text-cream/70 mb-2 transition-colors">
              Discover all available units, items, and traits.
            </div>
            <div className="mt-4 flex justify-center">
              {isCollectionsExpanded ? 
                <ChevronUp className="text-gold animate-bounce" size={30} /> : 
                <ChevronDown className="text-gold animate-bounce" size={30} />
              }
            </div>
          </div>
          
          {/* Collections content with animation */}
          <div 
            className={`transition-all duration-500 ease-in-out overflow-hidden ${
              isCollectionsExpanded ? 'max-h-[2000px] opacity-100 mt-2' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="border-b border-gold/30 pb-3 mb-4">
              <div className="border-b border-gold/30 flex flex-col sm:flex-row justify-between items-center">
                <div className="flex">
                  {(['units', 'items', 'traits'] as const).map((tab) => (
                    <button
                      key={tab}
                      className={`px-4 py-2 transition-all duration-300 ${activeTab === tab ? 'text-gold border-b-2 border-gold' : 'text-cream-dark hover:text-cream'}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="py-2 px-4 overflow-x-auto w-full sm:w-auto">
                  {activeTab === 'units' && (
                    <FilterButtons 
                      options={costFilters} 
                      activeFilter={filters.units}
                      onChange={(id) => toggleFilter('units', id)}
                    />
                  )}
                  {activeTab === 'items' && (
                    <FilterButtons 
                      options={categoryFilters} 
                      activeFilter={filters.items}
                      onChange={(id) => toggleFilter('items', id)}
                    />
                  )}
                  {activeTab === 'traits' && (
                    <FilterButtons 
                      options={traitTypeFilters} 
                      activeFilter={filters.traits}
                      onChange={(id) => toggleFilter('traits', id)}
                    />
                  )}
                </div>
              </div>
            </div>
            
            <div className="transition-opacity duration-500 ease-in-out overflow-x-auto">
              {activeTab === 'units' && <EntityGrid entities={filteredUnits} type="units" />}
              {activeTab === 'items' && <EntityGrid entities={filteredItems} type="items" />}
              {activeTab === 'traits' && <EntityGrid entities={filteredTraits} type="traits" />}
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
