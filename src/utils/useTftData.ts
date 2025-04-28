import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useCallback } from 'react';
import axios from 'axios';
import traitsJson from '@/mapping/traits.json';
import { ensureIconPath, getEntityIcon } from '@/utils/paths';
import { 
  ProcessedData, 
  TierList,
  Region,
  ErrorState,
  BaseStats,
  Composition,
  ProcessedUnit,
  ProcessedItem,
  ProcessedTrait,
  ItemCombo
} from '@/types';

export const REGIONS: Region[] = [
  { id: 'all', name: 'All Regions' },
  { id: 'NA', name: 'North America' },
  { id: 'EUW', name: 'Europe West' },
  { id: 'KR', name: 'Korea' },
  { id: 'BR', name: 'Brazil' },
  { id: 'JP', name: 'Japan' }
];

export enum HighlightType {
  TopWinner = 'top_winner',
  MostConsistent = 'most_consistent',
  MostPlayed = 'most_played',
  FlexiblePick = 'flexible_pick',
  PocketPick = 'pocket_pick'
}

export enum EntityType {
  Unit = 'unit',
  Trait = 'trait',
  Item = 'item',
  Comp = 'comp'
}

export interface HighlightEntity {
  entityType: EntityType;
  entity: any;
  title: string;
  value: string;
  detail: string;
  image: string;
  link: string;
  category?: string;
  variant?: string;
}

export interface HighlightGroup {
  type: HighlightType;
  title: string;
  unitVariants: HighlightEntity[];
  traitVariants: HighlightEntity[];
  itemVariants: HighlightEntity[];
  compVariants: HighlightEntity[];
  getPreferredVariant(entityType: string): HighlightEntity | null;
}

// Updated pagination interface
export interface PaginationState {
  page: number;
  limit: number;
  totalPages: number;
  totalItems: number;
}

export function useTftData(page: number = 1, limit: number = 20) {
  const [currentRegion, setCurrentRegion] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('tft-region') || 'all' : 'all';
  });
  
  const [matchCount, setMatchCount] = useState(0);
  const [isChangingRegion, setIsChangingRegion] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState>({ hasError: false });
  const [pagination, setPagination] = useState<PaginationState | null>(null);

  // UPDATED: Fetch from compositions endpoint with pagination
  const { data, isLoading, refetch, error: fetchError } = useQuery({
    queryKey: ['tft-compositions', currentRegion, page, limit],
    queryFn: async () => {
      try {
        setErrorState({ hasError: false });
        
        // Only request essential fields to reduce payload size
        const fields = [
          'id', 'name', 'icon', 'count', 'avgPlacement', 'winRate', 
          'top4Rate', 'traits', 'units', 'placementData'
        ].join(',');
        
        const response = await axios.get<ProcessedData>(
          `/api/tft/compositions?region=${currentRegion}&page=${page}&limit=${limit}&fields=${fields}`
        );
        
        // Update match count
        setMatchCount(response.data.summary?.totalGames || 0);
        
        // Update pagination state if available
        if (response.data.pagination) {
          setPagination(response.data.pagination as PaginationState);
        }
        
        // Update region status if available in the response
        if (response.data.region) {
          REGIONS.forEach(region => {
            if (region.id !== 'all' && region.id === response.data.region) {
              region.status = 'active';
            }
          });
        }
        
        return response.data;
      } catch (error) {
        setErrorState({
          hasError: true,
          error: {
            type: (error as any).response?.status >= 500 ? 'server' : 'network',
            message: (error as Error).message || 'Failed to fetch composition data',
            statusCode: (error as any).response?.status,
            timestamp: new Date()
          },
          retryFn: refetch
        });
        return null;
      }
    },
    staleTime: 300000,
    refetchOnWindowFocus: false
  });

  // Get summary data (without compositions) to save bandwidth
  const { data: summaryData } = useQuery({
    queryKey: ['tft-summary', currentRegion],
    queryFn: async () => {
      try {
        const response = await axios.get<ProcessedData>(
          `/api/tft/compositions?region=${currentRegion}&summary=true`
        );
        return response.data;
      } catch (error) {
        console.error('Failed to fetch summary data:', error);
        return null;
      }
    },
    staleTime: 300000,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tft-region', currentRegion);
    }
  }, [currentRegion]);

  const changeRegion = useCallback((region: string) => {
    if (region === currentRegion) return;
    setIsChangingRegion(true);
    setCurrentRegion(region);
    setTimeout(() => setIsChangingRegion(false), 100);
  }, [currentRegion]);

  const getRegionStatus = useCallback((regionId: string) => {
    if (regionId === 'all') return 'active';
    return REGIONS.find(r => r.id === regionId)?.status || 'active';
  }, []);

  const handleRetry = useCallback(() => {
    if (errorState.retryFn) errorState.retryFn();
    else refetch();
  }, [errorState, refetch]);

  // Generate highlights based on data - use summary data when available to avoid large data processing
  const highlights = useMemo(() => {
    // Prioritize using summary data's topComps if available
    const dataToUse = summaryData?.summary?.topComps?.length 
      ? { compositions: summaryData.summary.topComps } 
      : data;
      
    if (!dataToUse?.compositions?.length) return [];

    // Helper function to check if a trait is origin
    const isOriginTrait = (traitId: string) => {
      return Object.keys(traitsJson.origins).includes(traitId);
    };

    // Helper function to create comp variants by type
    const createCompVariantsByType = (
      sortFn: (a: any, b: any) => number, 
      detailFn: (comp: any) => string
    ) => {
      // Generic function to categorize comps
      const categorizeComps = (comps: any[]) => {
        // Fast 9 comps (lots of high cost units)
        const fast9Comps = comps
          .filter(comp => comp.units && comp.units.filter((u: any) => u.cost >= 4).length >= 3)
          .sort(sortFn)
          .slice(0, 1);
          
        // Reroll comps (lots of low cost units)
        const rerollComps = comps
          .filter(comp => comp.units && comp.units.filter((u: any) => u.cost <= 2).length >= 4)
          .sort(sortFn)
          .slice(0, 1);
          
        // Standard comps (neither fast 9 nor reroll)
        const standardComps = comps
          .filter(comp => {
            if (!comp.units) return false;
            const highCostCount = comp.units.filter((u: any) => u.cost >= 4).length;
            const lowCostCount = comp.units.filter((u: any) => u.cost <= 2).length;
            return highCostCount < 3 && lowCostCount < 4;
          })
          .sort(sortFn)
          .slice(0, 1);
          
        return [...fast9Comps, ...rerollComps, ...standardComps];
      };

      // Create a list of all comp categories
      const categorizedComps = categorizeComps(dataToUse.compositions);
      
      // Convert to HighlightEntity format
      return categorizedComps.map(comp => {
        // Determine comp type
        let variant = 'Overall';
        if (comp.units) {
          const highCostUnits = comp.units.filter((u: any) => u.cost >= 4).length >= 3;
          const lowCostUnits = comp.units.filter((u: any) => u.cost <= 2).length >= 4;
          variant = highCostUnits ? 'Fast 9' : lowCostUnits ? 'Reroll' : 'Standard';
        }
        
        return {
          entityType: EntityType.Comp,
          entity: comp,
          title: "Best Comp",
          value: comp.name,
          detail: detailFn(comp),
          image: comp.traits?.[0]?.tierIcon || (comp.traits?.[0]?.icon ? 
            ensureIconPath(comp.traits[0].icon, 'trait') : ''),
          link: `/entity/comps/${comp.id}`,
          variant
        };
      });
    };

    // Group units by cost for easier filtering
    const unitsByCost: Record<number, any[]> = {
      1: [], 2: [], 3: [], 4: [], 5: []
    };
    
    dataToUse.compositions.forEach(comp => {
      comp.units.forEach(unit => {
        if (unit.cost >= 1 && unit.cost <= 5) {
          if (!unitsByCost[unit.cost].find(u => u.id === unit.id)) {
            unitsByCost[unit.cost].push(unit);
          }
        }
      });
    });
    
    // Group items by category
    const itemsByCategory: Record<string, any[]> = {};
    dataToUse.compositions.forEach(comp => {
      comp.units.forEach(unit => {
        (unit.items || []).forEach(item => {
          if (!item.category) return;
          
          if (!itemsByCategory[item.category]) {
            itemsByCategory[item.category] = [];
          }
          
          if (!itemsByCategory[item.category].find(i => i.id === item.id)) {
            itemsByCategory[item.category].push(item);
          }
        });
      });
    });
    
    // Create sorted arrays of entities
    const allUnits = Object.values(unitsByCost).flat();
    const allTraits = dataToUse.compositions.flatMap(comp => comp.traits).filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
    const allItems = Object.values(itemsByCategory).flat();
    
    // Sort entities
    const sortedUnits = [...allUnits].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
    const sortedTraits = [...allTraits].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
    const sortedItems = [...allItems].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
    const sortedComps = [...dataToUse.compositions].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));

    // Create populated highlight groups with only first few items
    return [
      // TOP WINNER HIGHLIGHTS - just keep first few entries
      {
        type: HighlightType.TopWinner,
        title: "Best Winrate",
        unitVariants: sortedUnits.slice(0, 3).map(unit => ({
          entityType: EntityType.Unit,
          entity: unit,
          title: "Best Winrate",
          value: unit.name,
          detail: `${(unit.winRate ?? 0).toFixed(1)}% win rate`,
          image: ensureIconPath(unit.icon, 'unit'),
          link: `/entity/units/${unit.id}`,
          variant: 'Overall'
        })),
        traitVariants: sortedTraits.slice(0, 3).map(trait => ({
          entityType: EntityType.Trait,
          entity: trait,
          title: "Best Winrate",
          value: trait.name,
          detail: `${(trait.winRate ?? 0).toFixed(1)}% win rate`,
          image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
          link: `/entity/traits/${trait.id}`,
          variant: 'Overall'
        })),
        itemVariants: sortedItems.slice(0, 3).map(item => ({
          entityType: EntityType.Item,
          entity: item,
          title: "Best Winrate",
          value: item.name,
          detail: `${(item.winRate ?? 0).toFixed(1)}% win rate`,
          image: ensureIconPath(item.icon, 'item'),
          link: `/entity/items/${item.id}`,
          variant: 'Overall'
        })),
        compVariants: sortedComps.slice(0, 3).map(comp => ({
          entityType: EntityType.Comp,
          entity: comp,
          title: "Best Winrate",
          value: comp.name,
          detail: `${(comp.winRate ?? 0).toFixed(1)}% win rate`,
          image: comp.traits?.[0]?.tierIcon || (comp.traits?.[0]?.icon ? 
            ensureIconPath(comp.traits[0].icon, 'trait') : ''),
          link: `/entity/comps/${comp.id}`,
          variant: 'Overall'
        })),
        getPreferredVariant(entityType: string): HighlightEntity | null {
          if (entityType === 'units') return this.unitVariants[0] || null;
          if (entityType === 'traits') return this.traitVariants[0] || null;
          if (entityType === 'items') return this.itemVariants[0] || null;
          if (entityType === 'comps') return this.compVariants[0] || null;
          return null;
        }
      },
      
      // MOST CONSISTENT HIGHLIGHTS - reduced number of variants to save memory
      {
        type: HighlightType.MostConsistent,
        title: "Most Consistent",
        unitVariants: sortedUnits
          .sort((a, b) => (a.avgPlacement ?? 0) - (b.avgPlacement ?? 0))
          .slice(0, 3)
          .map(unit => ({
            entityType: EntityType.Unit,
            entity: unit,
            title: "Most Consistent",
            value: unit.name,
            detail: `${(unit.avgPlacement ?? 0).toFixed(2)} avg place`,
            image: ensureIconPath(unit.icon, 'unit'),
            link: `/entity/units/${unit.id}`,
            variant: 'Overall'
          })),
        traitVariants: sortedTraits
          .sort((a, b) => (a.avgPlacement ?? 0) - (b.avgPlacement ?? 0))
          .slice(0, 3)
          .map(trait => ({
            entityType: EntityType.Trait,
            entity: trait,
            title: "Most Consistent",
            value: trait.name,
            detail: `${(trait.avgPlacement ?? 0).toFixed(2)} avg place`,
            image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
            link: `/entity/traits/${trait.id}`,
            variant: 'Overall'
          })),
        itemVariants: sortedItems
          .sort((a, b) => (a.avgPlacement ?? 0) - (b.avgPlacement ?? 0))
          .slice(0, 3)
          .map(item => ({
            entityType: EntityType.Item,
            entity: item,
            title: "Most Consistent",
            value: item.name,
            detail: `${(item.avgPlacement ?? 0).toFixed(2)} avg place`,
            image: ensureIconPath(item.icon, 'item'),
            link: `/entity/items/${item.id}`,
            variant: 'Overall'
          })),
        compVariants: sortedComps
          .sort((a, b) => (a.avgPlacement ?? 0) - (b.avgPlacement ?? 0))
          .slice(0, 3)
          .map(comp => ({
            entityType: EntityType.Comp,
            entity: comp,
            title: "Most Consistent",
            value: comp.name,
            detail: `${(comp.avgPlacement ?? 0).toFixed(2)} avg place`,
            image: comp.traits?.[0]?.tierIcon || (comp.traits?.[0]?.icon ? 
              ensureIconPath(comp.traits[0].icon, 'trait') : ''),
            link: `/entity/comps/${comp.id}`,
            variant: 'Overall'
          })),
        getPreferredVariant(entityType: string): HighlightEntity | null {
          if (entityType === 'units') return this.unitVariants[0] || null;
          if (entityType === 'traits') return this.traitVariants[0] || null;
          if (entityType === 'items') return this.itemVariants[0] || null;
          if (entityType === 'comps') return this.compVariants[0] || null;
          return null;
        }
      },
      
      // MOST PLAYED HIGHLIGHTS - reduced number of variants
      {
        type: HighlightType.MostPlayed,
        title: "Most Played",
        unitVariants: sortedUnits
          .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
          .slice(0, 3)
          .map(unit => ({
            entityType: EntityType.Unit,
            entity: unit,
            title: "Most Played",
            value: unit.name,
            detail: `${unit.count ?? 0} appearances`,
            image: ensureIconPath(unit.icon, 'unit'),
            link: `/entity/units/${unit.id}`,
            variant: 'Overall'
          })),
        traitVariants: sortedTraits
          .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
          .slice(0, 3)
          .map(trait => ({
            entityType: EntityType.Trait,
            entity: trait,
            title: "Most Played",
            value: trait.name,
            detail: `${trait.count ?? 0} appearances`,
            image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
            link: `/entity/traits/${trait.id}`,
            variant: 'Overall'
          })),
        itemVariants: sortedItems
          .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
          .slice(0, 3)
          .map(item => ({
            entityType: EntityType.Item,
            entity: item,
            title: "Most Played",
            value: item.name,
            detail: `${item.count ?? 0} appearances`,
            image: ensureIconPath(item.icon, 'item'),
            link: `/entity/items/${item.id}`,
            variant: 'Overall'
          })),
        compVariants: sortedComps
          .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
          .slice(0, 3)
          .map(comp => ({
            entityType: EntityType.Comp,
            entity: comp,
            title: "Most Played",
            value: comp.name,
            detail: `${comp.count ?? 0} appearances`,
            image: comp.traits?.[0]?.tierIcon || (comp.traits?.[0]?.icon ? 
              ensureIconPath(comp.traits[0].icon, 'trait') : ''),
            link: `/entity/comps/${comp.id}`,
            variant: 'Overall'
          })),
        getPreferredVariant(entityType: string): HighlightEntity | null {
          if (entityType === 'units') return this.unitVariants[0] || null;
          if (entityType === 'traits') return this.traitVariants[0] || null;
          if (entityType === 'items') return this.itemVariants[0] || null;
          if (entityType === 'comps') return this.compVariants[0] || null;
          return null;
        }
      }
      // Omitting other highlight types to reduce memory consumption
    ];
  }, [data, summaryData]);

  return {
    data,
    isLoading: isLoading || isChangingRegion,
    currentRegion,
    changeRegion,
    matchCount,
    regions: REGIONS,
    refetch,
    errorState,
    getRegionStatus,
    error: fetchError,
    handleRetry,
    highlights,
    pagination,
    page,
    limit
  };
}

export function useEntityData(type: string, id: string) {
  // For single entity fetching, we'll use a direct API call to get the entity
  // This helps avoid loading the entire compositions list
  const { data, isLoading, error } = useQuery({
    queryKey: ['entity', type, id],
    queryFn: async () => {
      try {
        if (type === 'comps') {
          // Use the new dedicated endpoint for single composition
          const response = await axios.get(`/api/tft/composition/${id}`);
          return response.data;
        } else {
          // For other entity types, we need a different approach
          // This is just a basic implementation - we'd need to build proper endpoints
          const response = await axios.get(`/api/tft/entities/${type}?id=${id}`);
          return response.data;
        }
      } catch (err) {
        console.error(`Failed to fetch ${type} entity:`, err);
        return null;
      }
    },
    staleTime: 300000
  });
  
  return data;
}

export function useTierLists() {
  const { data } = useTftData(1, 100); // Use pagination to get a reasonable amount of data
  if (!data) return null;
  
  const calculateScore = (entity: BaseStats) => {
    return ((entity.winRate ?? 0) * 0.6) + 
           ((entity.playRate ?? 0) * 0.3) - 
           ((entity.avgPlacement ?? 5) * 0.1);
  };
  
  const createTierList = <T extends BaseStats>(items: T[]): TierList => {
    const sorted = [...items].sort((a, b) => calculateScore(b) - calculateScore(a));
    
    if (items.length <= 4) {
      return {
        S: sorted.slice(0, 1),
        A: sorted.slice(1, 2),
        B: sorted.slice(2, 3),
        C: sorted.slice(3)
      };
    }
    
    const total = sorted.length;
    return {
      S: sorted.slice(0, Math.max(1, Math.floor(total * 0.15))),
      A: sorted.slice(Math.floor(total * 0.15), Math.floor(total * 0.4)),
      B: sorted.slice(Math.floor(total * 0.4), Math.floor(total * 0.7)),
      C: sorted.slice(Math.floor(total * 0.7))
    };
  };
  
  // Extract unique entities from compositions - limit quantity to prevent memory issues
  const extractEntities = (type: string): any[] => {
    if (!data.compositions) return [];
    
    if (type === 'units') {
      // Extract unique units from compositions
      const units: Record<string, any> = {};
      data.compositions.forEach(comp => {
        comp.units.slice(0, 8).forEach(unit => { // Limit to 8 units per comp
          if (!units[unit.id]) {
            units[unit.id] = {...unit, count: 0, playRate: 0};
          }
          units[unit.id].count += comp.count || 0;
        });
      });
      
      // Calculate playRate for each unit
      const totalCompositions = data.compositions.reduce((sum, comp) => sum + (comp.count || 1), 0);
      Object.values(units).forEach(unit => {
        unit.playRate = (unit.count / totalCompositions) * 100;
      });
      
      return Object.values(units);
    }
    
    if (type === 'items') {
      // Extract unique items from all compositions
      const items: Record<string, any> = {};
      data.compositions.forEach(comp => {
        comp.units.forEach(unit => {
          (unit.items || []).slice(0, 3).forEach(item => { // Limit to 3 items per unit
            if (!items[item.id]) {
              items[item.id] = {...item, count: 0, playRate: 0};
            }
            items[item.id].count += comp.count ?? 0;
          });
        });
      });
      
      // Calculate playRate for each item
      const totalItems = Object.values(items).reduce((sum: number, item: any) => sum + item.count, 0);
      Object.values(items).forEach(item => {
        item.playRate = (item.count / totalItems) * 100;
      });
      
      return Object.values(items).slice(0, 50); // Limit to top 50 items
    }
    
    if (type === 'traits') {
      // Extract unique traits from all compositions
      const traits: Record<string, any> = {};
      data.compositions.forEach(comp => {
        comp.traits.slice(0, 6).forEach(trait => { // Limit to 6 traits per comp
          if (!traits[trait.id]) {
            traits[trait.id] = {...trait, count: 0, playRate: 0};
          }
          traits[trait.id].count += comp.count || 0;
        });
      });
      
      // Calculate playRate for each trait
      const totalTraits = Object.values(traits).reduce((sum: number, trait: any) => sum + trait.count, 0);
      Object.values(traits).forEach(trait => {
        trait.playRate = (trait.count / totalTraits) * 100;
      });
      
      return Object.values(traits);
    }
    
    return data.compositions.slice(0, 50); // Limit to top 50 compositions
  };
  
  return {
    units: createTierList(extractEntities('units')),
    items: createTierList(extractEntities('items')),
    traits: createTierList(extractEntities('traits')),
    comps: createTierList(data.compositions.slice(0, 50)) // Limit to top 50 compositions
  };
}

export function useEntityFilter<T extends Record<string, any>>(
  entities: T[], 
  initialFilters: Record<string, Record<string, boolean>> = {}
) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  
  const toggleFilter = (type: string, filterId: string): void => {
    setFilters(prevState => {
      const newState = {...prevState};
      
      if (filterId === 'all') {
        return {...newState, [type]: { all: true }};
      }
    
      // Create a new object without the 'all' property
      const filterGroup = {...(newState[type] || { all: true })};
      delete filterGroup.all;
    
      filterGroup[filterId] = !filterGroup[filterId];
    
      const hasActiveFilters = Object.entries(filterGroup)
        .some(([key, value]) => key !== 'all' && value);
    
      return {
        ...newState, 
        [type]: hasActiveFilters ? filterGroup : { all: true }
      };
    });
  };
  
  const filteredEntities = useMemo(() => {
    if (!entities) return [];
    
    return entities.filter(entity => {
      if (search && typeof entity.name === 'string' && 
          !entity.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      
      for (const filterType in filters) {
        const filterGroup = filters[filterType];
        
        if (filterGroup.all) continue;
        
        const entityVal = entity[filterType];
        if (entityVal !== undefined) {
          const strVal = String(entityVal);
          if (!filterGroup[strVal]) return false;
        }
      }
      
      return true;
    });
  }, [entities, search, filters]);
  
  return {
    search,
    setSearch,
    filters,
    toggleFilter,
    filteredEntities
  };
}
