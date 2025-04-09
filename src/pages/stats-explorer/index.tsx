import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useTftData } from '@/utils/useTftData';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { UnitIcon, Card, Layout, LoadingState, ErrorMessage } from '@/components/ui';
import { FeatureBanner, HeaderBanner, StatsCarousel, EntityTabs, ConditionsPanel } from '@/components/common';
import type { EntityType, FilterState } from '@/components/common';
import unitsJson from '@/mapping/units.json';
import itemsJson from '@/mapping/items.json';
import traitsJson from '@/mapping/traits.json';
import { parseCompTraits } from '@/utils/dataProcessing';
import { getEntityIcon, DEFAULT_ICONS } from '@/utils/paths';
import { BaseStats, ProcessedDisplayTrait } from '@/types';

// Interface for named entities with common properties
interface NamedEntity {
  name: string;
  [key: string]: any;
}

// TraitMapEntity for trait specific data
interface TraitMapEntity extends NamedEntity {
  id: string;
  traitId: string;
  tier: number;
  numUnits: number;
  icon: string;
  tierIcon?: string;
  count: number;
}

// ProcessedEntity for display data with added properties
interface ProcessedEntity extends BaseStats {
  avgPlacement: number;
  winRate: number;
  top4Rate: number;
  displayIcon?: string;
  tierIcon?: string;
  placementSum?: number;
  winRateSum?: number;
  top4RateSum?: number;
  cost?: number;
  category?: string;
  tier?: number;
  traits?: any[];
  originalUnits?: any[]; // Added property for comp filtering
  units?: any[]; // Added property for comp filtering
}

// Sort field types
type SortField = 'count' | 'avgPlacement' | 'winRate' | 'top4Rate';
type SortDirection = 'asc' | 'desc';

export default function StatsExplorer() {
  const router = useRouter();
  const { data, isLoading, error, handleRetry } = useTftData();
  const [search, setSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<EntityType>('units');
  const [sort, setSort] = useState<SortField>('count');
  const [dir, setDir] = useState<SortDirection>('desc');
  const [showCond, setShowCond] = useState<boolean>(false);
  const [condSearch, setCondSearch] = useState<string>('');
  const [filters, setFilters] = useState<Record<string, FilterState>>({ 
    cost: { all: true }, 
    category: { all: true }, 
    tier: { all: true },
    compType: { all: true } // Added filter for compositions
  });
  const [conds, setConds] = useState<Record<string, FilterState>>({ 
    item: { all: true }, 
    unit: { all: true }, 
    trait: { all: true } 
  });

  const tiers = [
    { id: '1', name: 'Bronze' }, 
    { id: '2', name: 'Silver' },
    { id: '3', name: 'Gold' }, 
    { id: '4', name: 'Diamond' }
  ];

  // Process options for condition filters
  const options = useMemo(() => {
    if (!data?.compositions) return { item: [], unit: [], trait: [] };
    
    // Process traits with tier info
    const traitMap = new Map<string, TraitMapEntity>();
    data.compositions.forEach(comp => comp.traits.forEach(trait => {
      const key = `${trait.id}:${trait.tier}`;
      if (!traitMap.has(key)) {
        traitMap.set(key, { 
          id: key, 
          name: `${trait.numUnits} ${trait.name}`, 
          traitId: trait.id, 
          tier: trait.tier, 
          numUnits: trait.numUnits,
          icon: trait.icon, 
          tierIcon: trait.tierIcon, 
          count: 0
        });
      }
      traitMap.get(key)!.count += comp.count ?? 0;
    }));
    
    // Filter by search term
    const match = (e: NamedEntity): boolean => !condSearch || e.name.toLowerCase().includes(condSearch.toLowerCase());
    
    return {
      trait: Array.from(traitMap.values())
        .filter(match)
        .sort((a, b) => b.tier - a.tier || b.count - a.count)
        .slice(0, 15),
      
      item: Object.entries(itemsJson.items)
        .filter(([_, i]) => i.category !== 'component' && match(i))
        .slice(0, 15)
        .map(([id, i]) => ({ id, name: i.name, icon: i.icon })),
      
      unit: Object.entries(unitsJson.units)
        .filter(([_, u]) => match(u))
        .slice(0, 15)
        .map(([id, u]) => ({ id, name: u.name, icon: u.icon, cost: u.cost }))
    };
  }, [data, condSearch]);

  // Prepare filter options
  const filterOpts = useMemo(() => ({
    cost: [1, 2, 3, 4, 5].map(c => ({ id: String(c), name: `${c} 🪙` })),
    category: Array.from(
      new Set(Object.values(itemsJson.items).map(i => i.category).filter(Boolean))
    ).map(c => ({ id: c, name: c.replace(/-/g, ' ') })),
    tier: tiers,
    compType: [
      { id: 'fast9', name: 'Fast 9' },
      { id: 'reroll', name: 'Reroll' },
      { id: 'standard', name: 'Standard' }
    ]
  }), []);

  // Get current filter options based on active tab
  const currentFilterOptions = useMemo(() => {
    if (activeTab === 'units') return filterOpts.cost;
    if (activeTab === 'items') return filterOpts.category;
    if (activeTab === 'traits') return filterOpts.tier;
    if (activeTab === 'comps') return filterOpts.compType;
    return [];
  }, [activeTab, filterOpts]);

  // Current filter state based on active tab
  const currentFilterState = useMemo(() => {
    if (activeTab === 'units') return filters.cost;
    if (activeTab === 'items') return filters.category;
    if (activeTab === 'traits') return filters.tier;
    if (activeTab === 'comps') return filters.compType;
    return { all: true };
  }, [activeTab, filters]);

  // Prepare conditions for ConditionsPanel
  const conditionConfigs = useMemo(() => {
    const configs = [];
    
    // Always show all three condition types for all tabs
    configs.push({
      id: 'unit',
      label: 'Units',
      options: options.unit,
      state: conds.unit
    });
    
    configs.push({
      id: 'item',
      label: 'Items',
      options: options.item,
      state: conds.item
    });
    
    configs.push({
      id: 'trait',
      label: 'Traits',
      options: options.trait,
      state: conds.trait
    });
    
    return configs;
  }, [conds, options]);

  // Fixed toggle filter function with proper type handling
  const toggleFilter = useCallback((id: string) => {
    // Determine filter type based on active tab
    const type = activeTab === 'units' ? 'cost' : 
                activeTab === 'items' ? 'category' : 
                activeTab === 'traits' ? 'tier' :
                activeTab === 'comps' ? 'compType' : '';
    
    if (!type) return; // Skip if no valid type
    
    setFilters(prevState => {
      const state = {...prevState};
      
      if (id === 'all') {
        return {...state, [type]: { all: true }};
      }
      
      // Create a new filter object that matches FilterState interface
      const newFilter: FilterState = { all: false };
      
      // Copy existing selected filters except 'all'
      Object.entries(state[type]).forEach(([key, value]) => {
        if (key !== 'all') {
          newFilter[key] = value;
        }
      });
      
      // Toggle the selected filter
      newFilter[id] = !newFilter[id];
      
      // If no filters are active, enable 'all'
      if (!Object.entries(newFilter).some(([key, value]) => key !== 'all' && value)) {
        newFilter.all = true;
      }
      
      return { ...state, [type]: newFilter };
    });
  }, [activeTab]);

  // Toggle condition filter
  const toggleCondition = useCallback((condType: string, id: string) => {
    setConds(prevState => {
      const state = {...prevState};
      
      if (id === 'all') {
        return {...state, [condType]: { all: true }};
      }
      
      // Create a new filter object that matches FilterState interface
      const newFilter: FilterState = { all: false };
      
      // Copy existing selected filters except 'all'
      Object.entries(state[condType]).forEach(([key, value]) => {
        if (key !== 'all') {
          newFilter[key] = value;
        }
      });
      
      // Toggle the selected filter
      newFilter[id] = !newFilter[id];
      
      // If no filters are active, enable 'all'
      if (!Object.entries(newFilter).some(([key, value]) => key !== 'all' && value)) {
        newFilter.all = true;
      }
      
      return { ...state, [condType]: newFilter };
    });
  }, []);

  // Check if a trait is an origin
  function isOriginTrait(id: string): boolean {
    return Object.keys(traitsJson.origins).includes(id);
  }

  // Process data with filtering
  const data_processed = useMemo(() => {
    if (!data?.compositions?.length) {
      return { units: [], items: [], traits: [], comps: [] };
    }
    
    // Process each entity type
    const process = (type: EntityType): ProcessedEntity[] => {
      const entities: Record<string, any> = {};
      
      data.compositions.forEach(comp => {
        // Check conditions with AND logic
        let valid = true;
        
        if (!conds.unit.all && ['traits', 'items', 'comps'].includes(type)) {
          // Check if ALL selected units are in this comp
          const selectedUnitIds = Object.keys(conds.unit).filter(id => conds.unit[id] && id !== 'all');
          valid = selectedUnitIds.every(unitId => 
            comp.units.some(u => u.id === unitId));
        }
        
        if (valid && !conds.item.all && ['traits', 'units', 'comps'].includes(type)) {
          // Check if ALL selected items are in this comp
          const selectedItemIds = Object.keys(conds.item).filter(id => conds.item[id] && id !== 'all');
          valid = selectedItemIds.every(itemId => 
            comp.units.some(u => (u.items || []).some(i => i.id === itemId)));
        }
        
        if (valid && !conds.trait.all && ['units', 'items', 'comps'].includes(type)) {
          // Check if ALL selected traits are in this comp
          const selectedTraitKeys = Object.keys(conds.trait).filter(id => conds.trait[id] && id !== 'all');
          valid = selectedTraitKeys.every(traitKey => {
            const [traitId, tierStr] = traitKey.split(':');
            const tier = parseInt(tierStr);
            return comp.traits.some(t => t.id === traitId && t.tier === tier);
          });
        }
        
        if (!valid) return;
        
        // Handle different entity types
        if (type === 'units') {
          // Process units
          comp.units.forEach(unit => {
            if (!unit?.id) return;
            
            if (!entities[unit.id]) {
              entities[unit.id] = { 
                ...unit, 
                count: 0, 
                winRateSum: 0, 
                top4RateSum: 0, 
                placementSum: 0
              };
            }
            
            // Update stats
            entities[unit.id].count += comp.count ?? 0;
            entities[unit.id].placementSum += (comp.avgPlacement ?? 0) * (comp.count ?? 0);
            entities[unit.id].winRateSum += ((comp.winRate ?? 0) / 100) * (comp.count ?? 0);
            entities[unit.id].top4RateSum += ((comp.top4Rate ?? 0) / 100) * (comp.count ?? 0);
          });
        } 
        else if (type === 'items') {
          // Process items
          comp.units.forEach(unit => {
            (unit.items || []).forEach(item => {
              if (!item?.id) return;
              
              if (!entities[item.id]) {
                entities[item.id] = { 
                  ...item, 
                  count: 0, 
                  winRateSum: 0, 
                  top4RateSum: 0, 
                  placementSum: 0
                };
              }
              
              // Update stats
              entities[item.id].count += comp.count ?? 0;
              entities[item.id].placementSum += (comp.avgPlacement ?? 0) * (comp.count ?? 0);
              entities[item.id].winRateSum += ((comp.winRate ?? 0) / 100) * (comp.count ?? 0);
              entities[item.id].top4RateSum += ((comp.top4Rate ?? 0) / 100) * (comp.count ?? 0);
            });
          });
        }
        else if (type === 'traits') {
          // Process traits
          comp.traits.forEach(trait => {
            if (!trait?.id) return;
            
            // Handle trait tiers for filtering
            const tierLevel = trait.tier || 0;
            
            if (!filters.tier.all && !filters.tier[tierLevel.toString()]) {
              return; // Skip if tier doesn't match filter
            }
            
            // Generate trait key including tier
            const entityKey = `${trait.id}:${tierLevel}`;
            
            // Get tier icon
            let displayIcon: string | undefined;
            const traitData = traitsJson.origins[trait.id as keyof typeof traitsJson.origins] || 
                      traitsJson.classes[trait.id as keyof typeof traitsJson.classes];
            
            if (traitData) {
              const traitName = traitData.name?.toLowerCase().replace(/\s+/g, '');
              const tierNames = ['bronze', 'silver', 'gold', 'diamond'];
              if (tierLevel > 0 && tierLevel <= tierNames.length) {
                displayIcon = `/assets/traits/${traitName}_${tierNames[tierLevel-1]}.png`;
              }
            }
            
            if (!entities[entityKey]) {
              entities[entityKey] = { 
                ...trait, 
                id: trait.id, // Keep the trait ID without tier for linking
                count: 0, 
                winRateSum: 0, 
                top4RateSum: 0, 
                placementSum: 0,
                displayIcon: displayIcon
              };
            }
            
            // Update stats
            entities[entityKey].count += comp.count ?? 0;
            entities[entityKey].placementSum += (comp.avgPlacement ?? 0) * (comp.count ?? 0);
            entities[entityKey].winRateSum += ((comp.winRate ?? 0) / 100) * (comp.count ?? 0);
            entities[entityKey].top4RateSum += ((comp.top4Rate ?? 0) / 100) * (comp.count ?? 0);
          });
        }
        else if (type === 'comps') {
          // Process compositions
          if (!comp?.id) return;
          
          if (!entities[comp.id]) {
            entities[comp.id] = { 
              ...comp, 
              count: 0, 
              winRateSum: 0, 
              top4RateSum: 0, 
              placementSum: 0,
              // Store comp units for filtering
              compUnits: comp.units
            };
          }
          
          // Update stats
          entities[comp.id].count += comp.count ?? 0;
          entities[comp.id].placementSum += (comp.avgPlacement ?? 0) * (comp.count ?? 0);
          entities[comp.id].winRateSum += ((comp.winRate ?? 0) / 100) * (comp.count ?? 0);
          entities[comp.id].top4RateSum += ((comp.top4Rate ?? 0) / 100) * (comp.count ?? 0);
        }
      });
      
      // Process entities and return final results
      return Object.values(entities)
        .filter(e => e.count > 0)
        .map(e => ({
          id: e.id,
          name: e.name,
          icon: e.icon,
          count: e.count,
          avgPlacement: (e.placementSum || 0) / (e.count || 1),
          winRate: ((e.winRateSum || 0) / (e.count || 1)) * 100,
          top4Rate: ((e.top4RateSum || 0) / (e.count || 1)) * 100,
          displayIcon: e.displayIcon,
          tierIcon: e.tierIcon,
          cost: e.cost,
          category: e.category,
          tier: e.tier,
          traits: e.traits,
          compUnits: e.compUnits // Store comp units without type conflict
        }));
    };
    
    // Search function
    const match = (e: NamedEntity): boolean => !search || e.name.toLowerCase().includes(search.toLowerCase());
    
    // Sort function
    const sortFn = (a: ProcessedEntity, b: ProcessedEntity): number => {
      const av = a[sort] || 0, bv = b[sort] || 0;
      return dir === 'asc' ? av - bv : bv - av;
    };
    
    // Filter function for units
    const isUnitEntity = (e: ProcessedEntity): boolean => {
      return activeTab === 'units' && (filters.cost.all || 
        (e.cost !== undefined && filters.cost[e.cost.toString()]));
    };
    
    // Filter function for items
    const isItemEntity = (e: ProcessedEntity): boolean => {
      return activeTab === 'items' && (filters.category.all || 
        (e.category !== undefined && filters.category[e.category]));
    };
    
    // Fixed comp type filtering
    const isCompEntity = (e: any): boolean => {
      if (activeTab !== 'comps') return true;
      
      // If all filters are selected, show all comps
      if (filters.compType.all) return true;
      
      // Handle custom comp filtering logic using stored compUnits
      const units = e.compUnits || [];
      
      // Count units by cost
      const highCostUnits = units.filter((u: any) => u.cost >= 4).length >= 3;
      const lowCostUnits = units.filter((u: any) => u.cost <= 2).length >= 4;
      
      // Determine composition style
      const compStyle = highCostUnits ? 'fast9' : lowCostUnits ? 'reroll' : 'standard';
      
      // Check if the composition style is selected in filters
      return !!filters.compType[compStyle];
    };
    
    // Process and filter each entity type
    return {
      units: process('units')
        .filter(u => match(u) && isUnitEntity(u))
        .sort(sortFn),
      
      items: process('items')
        .filter(i => match(i) && isItemEntity(i))
        .sort(sortFn),
      
      traits: process('traits').filter(match).sort(sortFn),
      comps: process('comps').filter(e => match(e) && isCompEntity(e)).sort(sortFn)
    };
  }, [data, filters, conds, search, sort, dir, activeTab]);

  // Column definitions
  const columns = [
    { id: 'count', name: 'Frequency' },
    { id: 'avgPlacement', name: 'Avg Place' },
    { id: 'winRate', name: 'Win %' },
    { id: 'top4Rate', name: 'Top 4 %' }
  ];

  if (isLoading) return (
    <Layout>
      <LoadingState message="Loading stats data..." />
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

  return (
    <Layout>
      {/* Header Banner */}
      <HeaderBanner />

      {/* Stats Carousel */}
      <StatsCarousel />
      
      <div className="mt-8">
        <FeatureBanner title="Stats Explorer - Performance Metrics" />
        
        {/* Unified Entity Tabs Component */}
        <EntityTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          filterOptions={currentFilterOptions}
          filterState={currentFilterState}
          onFilterChange={toggleFilter}
          searchValue={search}
          onSearchChange={setSearch}
          showConditionsButton={true}
          showConditions={showCond}
          onToggleConditions={() => setShowCond(!showCond)}
          className="mt-1"
        />
        
        {/* Conditions Panel */}
        {showCond && (
          <ConditionsPanel
            conditions={conditionConfigs}
            onConditionChange={toggleCondition}
            searchValue={condSearch}
            onSearchChange={setCondSearch}
            className="mt-1"
          />
        )}

        {/* Data Table with clean styling */}
        <Card className="mt-1 p-0 overflow-hidden backdrop-filter backdrop-blur-md bg-brown/5 border border-gold/30">
          <div className="stats-table-container">
            <table className="w-full border-collapse stats-table">
              <thead>
                <tr className="bg-brown-light/30 text-gold text-sm">
                  <th className="px-4 py-3 text-left sticky top-0 bg-brown z-10" style={{width:'40%'}}>
                    {activeTab === 'comps' ? 'Comp' : activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(0, -1).slice(1)}
                  </th>
                  {columns.map(col => (
                    <th 
                      key={col.id} 
                      className="px-4 py-3 text-center cursor-pointer sticky top-0 bg-brown z-10"
                      style={{width: '15%'}}
                      onClick={() => {
                        setDir(sort === col.id ? (dir === 'asc' ? 'desc' : 'asc') : 'desc');
                        setSort(col.id as SortField);
                      }}
                    >
                      <div className="flex items-center justify-center">
                        <span>{col.name}</span>
                        <span className="w-4 ml-1 flex justify-center">
                          {sort === col.id ? 
                            (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : 
                            null
                          }
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data_processed[activeTab].map((item, idx) => (
                  <tr 
                    key={idx} 
                    className="border-t border-gold/10 cursor-pointer hover:bg-gold/10"
                    onClick={() => router.push(`/entity/${activeTab}/${item.id}`)}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        {activeTab === 'units' && <UnitIcon unit={item} size="md" />}
                        {activeTab === 'items' && (
                          <img 
                            src={getEntityIcon(item, 'item')} 
                            alt={item.name} 
                            className="w-10 h-10 object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = DEFAULT_ICONS.item;
                            }}
                          />
                        )}
                        {activeTab === 'traits' && (
                          <img 
                            src={!filters.tier.all && item.displayIcon ? item.displayIcon : getEntityIcon(item, 'trait')} 
                            alt={item.name} 
                            className="w-8 h-8"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = DEFAULT_ICONS.trait;
                            }}
                          />
                        )}
                        {activeTab === 'comps' && item.traits && (
                          <div className="flex gap-1">
                            {parseCompTraits(item.name, item.traits).map((trait: ProcessedDisplayTrait, j: number) => (
                              <img 
                                key={j} 
                                src={getEntityIcon(trait, 'trait')} 
                                alt={trait.name} 
                                className="w-6 h-6"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = DEFAULT_ICONS.trait;
                                }}
                              />
                            ))}
                          </div>
                        )}
                        <div className="font-medium">{item.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">{item.count}</td>
                    <td className="px-4 py-2 text-center">{item.avgPlacement?.toFixed(2)}</td>
                    <td className="px-4 py-2 text-center">{item.winRate?.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-center">{item.top4Rate?.toFixed(1)}%</td>
                  </tr>
                ))}
                {data_processed[activeTab].length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-cream/60">
                      No data available with current filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
