import { useState, useMemo, useEffect } from 'react';
import { Layout, Card, UnitIcon, ItemIcon } from '@/components/ui';
import { FeatureBanner, HeaderBanner, StatsCarousel, EntityTabs, MetaHighlightCard } from '@/components/common';
import type { EntityType, FilterState } from '@/components/common';
import { useTftData, useTierLists, HighlightType, EntityType as HighlightEntityType } from '@/utils/useTftData';
import Link from 'next/link';
import { Trophy, Star, Medal, Users, Shield } from 'lucide-react';
import { parseCompTraits } from '@/utils/dataProcessing';
import { getEntityIcon, DEFAULT_ICONS } from '@/utils/paths';
import { BaseStats } from '@/types';
import itemsJson from '@/mapping/items.json';
import traitsJson from '@/mapping/traits.json';

export default function MetaReport() {
  const { data, isLoading, error, handleRetry, highlights } = useTftData();
  const tierLists = useTierLists();
  const [activeTab, setActiveTab] = useState<EntityType>('units');
  const [filter, setFilter] = useState<FilterState>({ all: true });

  // Reset filter when changing tabs
  useEffect(() => {
    setFilter({ all: true });
  }, [activeTab]);

  // Get category options based on active tab
  const categoryOptions = useMemo(() => {
    switch(activeTab) {
      case 'units':
        return [1, 2, 3, 4, 5].map(cost => ({ id: String(cost), name: `${cost} 🪙` }));
      case 'items':
        const categories = new Set<string>();
        Object.values(itemsJson.items).forEach(item => {
          if (item.category && !['component', 'tactician'].includes(item.category)) {
            categories.add(item.category);
          }
        });
        return Array.from(categories).map(category => ({
          id: category,
          name: category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        }));
      case 'traits':
        return [{ id: 'origin', name: 'Origins' }, { id: 'class', name: 'Classes' }];
      case 'comps':
        return [
          { id: 'fast9', name: 'Fast 9' },
          { id: 'reroll', name: 'Reroll' },
          { id: 'standard', name: 'Standard' }
        ];
      default:
        return [];
    }
  }, [activeTab]);

  // Helper functions for filtering
  const isOriginTrait = (traitId: string): boolean => (
    Object.keys(traitsJson.origins).includes(traitId)
  );
  
  const getCompType = (comp: any): string => {
    if (!comp.units) return 'standard';
    const highCostUnits = comp.units.filter((u: any) => u.cost >= 4).length >= 3;
    const lowCostUnits = comp.units.filter((u: any) => u.cost <= 2).length >= 4;
    return highCostUnits ? 'fast9' : lowCostUnits ? 'reroll' : 'standard';
  };

  // Filter entities based on current filter
  const filterEntity = (entity: any): boolean => {
    if (filter.all) return true;
    
    switch(activeTab) {
      case 'units':
        return entity.cost && filter[String(entity.cost)];
      case 'items':
        return entity.category && filter[entity.category];
      case 'traits':
        const isOrigin = isOriginTrait(entity.id);
        return (isOrigin && filter.origin) || (!isOrigin && filter.class);
      case 'comps':
        return filter[getCompType(entity)];
      default:
        return true;
    }
  };

  // Apply filters to tier list
  const filteredTierList = useMemo(() => {
    if (!tierLists || filter.all) return tierLists;
    
    const result = {...tierLists};
    const list = result[activeTab as keyof typeof result];
    
    Object.keys(list).forEach(tier => {
      list[tier as keyof typeof list] = list[tier as keyof typeof list].filter(filterEntity);
    });
    
    return result;
  }, [tierLists, filter, activeTab]);

  // Filter highlights
  const filteredHighlights = useMemo(() => {
    if (!highlights || filter.all) return highlights;
    
    return highlights.map(group => {
      const filtered = {...group};
      const variantKey = `${activeTab}Variants` as keyof typeof filtered;
      
      if (Array.isArray(filtered[variantKey])) {
        // Cast to any[] for filtering, then back to any to avoid type errors
        const filteredArray = (filtered[variantKey] as any[])
          .filter(variant => filterEntity(variant.entity));
        filtered[variantKey] = filteredArray as any;
      }
      
      return filtered;
    });
  }, [highlights, filter, activeTab]);

  // Toggle filter
  const toggleFilter = (id: string) => {
    if (id === 'all') {
      setFilter({ all: true });
    } else {
      // Use destructuring to create a new object without the 'all' property
      const { all, ...newFilter } = filter;
      
      // Toggle the selected filter
      newFilter[id] = !newFilter[id];
      
      // If no filters are active, enable 'all'
      if (!Object.values(newFilter).some(Boolean)) {
        setFilter({ all: true });
      } else {
        // Otherwise use the new filters with all: false
        setFilter({ ...newFilter, all: false });
      }
    }
  };

  // Render entity icon
  const renderEntityIcon = (item: BaseStats): JSX.Element => {
    switch(activeTab) {
      case 'units':
        return <UnitIcon unit={item} size="lg" />;
      case 'items':
        return <ItemIcon item={item} size="lg" />;
      case 'traits':
        return (
          <img 
            src={getEntityIcon(item, 'trait')} 
            alt={item.name} 
            className="w-16 h-16 object-contain" 
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = DEFAULT_ICONS.trait;
            }}
          />
        );
      default:
        const displayTraits = parseCompTraits(item.name, (item as any).traits || []);
        return (
          <div className="flex gap-1 flex-wrap justify-center w-full">
            {displayTraits.map((trait: any, i: number) => (
              <img 
                key={i} 
                src={getEntityIcon(trait, 'trait')} 
                alt={trait.name} 
                className="w-10 h-10" 
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = DEFAULT_ICONS.trait;
                }}
              />
            ))}
          </div>
        );
    }
  };

  // Loading and error states
  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold mx-auto"></div>
            <p className="mt-4 text-cream/80">Loading meta data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="mt-6">
          <Card>
            <div className="text-center py-8">
              <div className="text-red-400 mb-2">Error loading data</div>
              <p className="text-cream/80 mb-4">{error.message}</p>
              <button onClick={handleRetry} className="px-4 py-2 bg-brown-light/50 hover:bg-brown-light/70 text-cream rounded-md">
                Retry
              </button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!filteredTierList) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold mx-auto"></div>
            <p className="mt-4 text-cream/80">Analyzing meta data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Tier styles for display
  const tierStyles = [
    { tier: 'S', bgColor: 'bg-gradient-to-r from-gold to-gold/80', textColor: 'text-cream-dark', shadow: 'shadow-inner shadow-gold/20' },
    { tier: 'A', bgColor: 'bg-gradient-to-r from-gold/70 to-gold/50', textColor: 'text-cream-dark', shadow: 'shadow-inner shadow-gold/10' },
    { tier: 'B', bgColor: 'bg-gradient-to-r from-gold/40 to-gold/20', textColor: 'text-cream-dark', shadow: '' },
    { tier: 'C', bgColor: 'bg-gradient-to-r from-gold/20 to-gold/5', textColor: 'text-cream-dark', shadow: '' }
  ];

  // Highlight types
  const standardHighlights = [
    { type: HighlightType.TopWinner, title: "Best Winrate", icon: <Trophy className="text-gold h-5 w-5" /> },
    { type: HighlightType.MostConsistent, title: "Most Consistent", icon: <Medal className="text-gold h-5 w-5" /> },
    { type: HighlightType.MostPlayed, title: "Most Played", icon: <Users className="text-gold h-5 w-5" /> },
    { type: HighlightType.FlexiblePick, title: "Most Flexible", icon: <Shield className="text-gold h-5 w-5" /> },
    { type: HighlightType.PocketPick, title: "Pocket Pick", icon: <Star className="text-gold h-5 w-5" /> }
  ];

  return (
    <Layout>
      <HeaderBanner />
      <StatsCarousel />
      
      <div className="mt-8">
        <FeatureBanner title="Meta Report - Highlights & Strategies" />
        <EntityTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          filterOptions={categoryOptions}
          filterState={filter}
          onFilterChange={toggleFilter}
          allowSearch={false}
          className="mt-1"
        />
      </div>
      
      <div className="mb-10 mt-6 flex flex-col lg:flex-row gap-6">
        {/* Tier List */}
        <div className="lg:w-4/6">
          <Card className="p-0 overflow-hidden h-full backdrop-filter backdrop-blur-md bg-brown/5 border border-gold/30">
            <div className="flex items-center justify-center py-4 bg-brown/60 border-b border-gold/30">
              <Trophy size={22} className="text-gold mr-3" />
              <h2 className="text-xl text-gold">Tier List</h2>
            </div>
            
            <div className="mt-4 w-full">
              {tierStyles.map(({ tier, bgColor, textColor, shadow }) => (
                <div key={tier} className="flex w-full border-t border-b border-gold/20">
                  <div className={`${bgColor} ${shadow} w-24 min-w-[6rem] flex items-center justify-center font-bold text-2xl ${textColor} border-r border-brown/20`}>
                    {tier}
                  </div>
                  <div className="flex flex-wrap bg-brown-light/20 w-full">
                    {filteredTierList[activeTab as keyof typeof filteredTierList][tier as keyof typeof filteredTierList.units]?.map((item, i) => (
                      <Link href={`/entity/${activeTab}/${item.id}`} key={i} className="w-24 h-24">
                        <div className="h-full w-full flex items-center justify-center hover:bg-brown-light/50 transition-all p-2 text-cream">
                          {renderEntityIcon(item)}
                        </div>
                      </Link>
                    ))}
                    {filteredTierList[activeTab as keyof typeof filteredTierList][tier as keyof typeof filteredTierList.units]?.length === 0 && (
                      <div className="h-24 w-full flex items-center justify-center text-cream/50 text-sm">
                        No {activeTab} in this tier
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Meta Highlights */}
        <div className="lg:w-2/6 flex flex-col gap-1">
          {standardHighlights.map((highlight, i) => {
            const highlightData = filteredHighlights?.find(h => h.type === highlight.type);
            const highlightEntity = highlightData?.getPreferredVariant(activeTab);
            
            return (
              <div key={i} className="h-full">
                <MetaHighlightCard 
                  highlight={highlightEntity || null}
                  title={highlight.title}
                  icon={highlight.icon}
                />
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
