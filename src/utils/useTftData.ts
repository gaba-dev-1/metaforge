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

export function useTftData() {
  const [currentRegion, setCurrentRegion] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('tft-region') || 'all' : 'all';
  });
  
  const [matchCount, setMatchCount] = useState(0);
  const [isChangingRegion, setIsChangingRegion] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState>({ hasError: false });

  // UPDATED: Fetch from compositions endpoint directly
  const { data, isLoading, refetch, error: fetchError } = useQuery({
    queryKey: ['tft-compositions', currentRegion],
    queryFn: async () => {
      try {
        setErrorState({ hasError: false });
        const response = await axios.get<ProcessedData>(`/api/tft/compositions?region=${currentRegion}`);
        
        // Update match count
        setMatchCount(response.data.summary?.totalGames || 0);
        
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

  // Generate highlights based on data
  const highlights = useMemo(() => {
    if (!data?.compositions?.length) return [];

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
      const categorizedComps = categorizeComps(data.compositions);
      
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
    
    data.compositions.forEach(comp => {
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
    data.compositions.forEach(comp => {
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
    const allTraits = data.compositions.flatMap(comp => comp.traits).filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
    const allItems = Object.values(itemsByCategory).flat();
    
    // Sort entities
    const sortedUnits = [...allUnits].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
    const sortedTraits = [...allTraits].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
    const sortedItems = [...allItems].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
    const sortedComps = [...data.compositions].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));

    // Create populated highlight groups
    return [
      // TOP WINNER HIGHLIGHTS
      {
        type: HighlightType.TopWinner,
        title: "Best Winrate",
        unitVariants: [
          ...sortedUnits.slice(0, 3).map(unit => ({
            entityType: EntityType.Unit,
            entity: unit,
            title: "Best Winrate",
            value: unit.name,
            detail: `${(unit.winRate ?? 0).toFixed(1)}% win rate`,
            image: ensureIconPath(unit.icon, 'unit'),
            link: `/entity/units/${unit.id}`,
            variant: 'Overall'
          })),
          ...Object.entries(unitsByCost).flatMap(([cost, units]) => {
            if (!units.length) return [];
            const topUnit = [...units].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0];
            return [{
              entityType: EntityType.Unit,
              entity: topUnit,
              title: "Best Winrate",
              value: topUnit.name,
              detail: `${(topUnit.winRate ?? 0).toFixed(1)}% win rate`,
              image: ensureIconPath(topUnit.icon, 'unit'),
              link: `/entity/units/${topUnit.id}`,
              category: cost,
              variant: `${cost} 🪙`
            }];
          })
        ],
        traitVariants: [
          ...sortedTraits.slice(0, 3).map(trait => ({
            entityType: EntityType.Trait,
            entity: trait,
            title: "Best Winrate",
            value: trait.name,
            detail: `${(trait.winRate ?? 0).toFixed(1)}% win rate`,
            image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
            link: `/entity/traits/${trait.id}`,
            variant: 'Overall'
          })),
          ...sortedTraits
            .filter(trait => isOriginTrait(trait.id))
            .slice(0, 2)
            .map(trait => ({
              entityType: EntityType.Trait,
              entity: trait,
              title: "Best Winrate",
              value: trait.name,
              detail: `${(trait.winRate ?? 0).toFixed(1)}% win rate`,
              image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
              link: `/entity/traits/${trait.id}`,
              variant: 'Origin'
            })),
          ...sortedTraits
            .filter(trait => !isOriginTrait(trait.id))
            .slice(0, 2)
            .map(trait => ({
              entityType: EntityType.Trait,
              entity: trait,
              title: "Best Winrate",
              value: trait.name,
              detail: `${(trait.winRate ?? 0).toFixed(1)}% win rate`,
              image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
              link: `/entity/traits/${trait.id}`,
              variant: 'Class'
            }))
        ],
        itemVariants: [
          ...sortedItems.slice(0, 3).map(item => ({
            entityType: EntityType.Item,
            entity: item,
            title: "Best Winrate",
            value: item.name,
            detail: `${(item.winRate ?? 0).toFixed(1)}% win rate`,
            image: ensureIconPath(item.icon, 'item'),
            link: `/entity/items/${item.id}`,
            variant: 'Overall'
          })),
          ...Object.entries(itemsByCategory).flatMap(([category, items]) => {
            if (!items.length) return [];
            const bestItem = [...items].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0];
            if (!bestItem) return [];
            
            const displayCategory = category.replace(/-/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase());
            
            return [{
              entityType: EntityType.Item,
              entity: bestItem,
              title: "Best Winrate",
              value: bestItem.name,
              detail: `${(bestItem.winRate ?? 0).toFixed(1)}% win rate`,
              image: ensureIconPath(bestItem.icon, 'item'),
              link: `/entity/items/${bestItem.id}`,
              category: category,
              variant: displayCategory
            }];
          })
        ],
        compVariants: [
          ...sortedComps.slice(0, 3).map(comp => ({
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
          ...createCompVariantsByType(
            (a, b) => (b.winRate ?? 0) - (a.winRate ?? 0),
            comp => `${(comp.winRate ?? 0).toFixed(1)}% win rate`
          )
        ],
        getPreferredVariant(entityType: string): HighlightEntity | null {
          if (entityType === 'units') return this.unitVariants[0] || null;
          if (entityType === 'traits') return this.traitVariants[0] || null;
          if (entityType === 'items') return this.itemVariants[0] || null;
          if (entityType === 'comps') return this.compVariants[0] || null;
          return null;
        }
      },
      
      // MOST CONSISTENT HIGHLIGHTS 
      {
        type: HighlightType.MostConsistent,
        title: "Most Consistent",
        unitVariants: [
          ...sortedUnits
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
          ...Object.entries(unitsByCost).flatMap(([cost, units]) => {
            if (!units.length) return [];
            const bestUnit = [...units].sort((a, b) => (a.avgPlacement ?? 0) - (b.avgPlacement ?? 0))[0];
            return [{
              entityType: EntityType.Unit,
              entity: bestUnit,
              title: "Most Consistent",
              value: bestUnit.name,
              detail: `${(bestUnit.avgPlacement ?? 0).toFixed(2)} avg place`,
              image: ensureIconPath(bestUnit.icon, 'unit'),
              link: `/entity/units/${bestUnit.id}`,
              category: cost,
              variant: `${cost} 🪙`
            }];
          })
        ],
        traitVariants: [
          ...sortedTraits
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
          ...sortedTraits
            .filter(trait => isOriginTrait(trait.id))
            .sort((a, b) => (a.avgPlacement ?? 0) - (b.avgPlacement ?? 0))
            .slice(0, 2)
            .map(trait => ({
              entityType: EntityType.Trait,
              entity: trait,
              title: "Most Consistent",
              value: trait.name,
              detail: `${(trait.avgPlacement ?? 0).toFixed(2)} avg place`,
              image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
              link: `/entity/traits/${trait.id}`,
              variant: 'Origin'
            })),
          ...sortedTraits
            .filter(trait => !isOriginTrait(trait.id))
            .sort((a, b) => (a.avgPlacement ?? 0) - (b.avgPlacement ?? 0))
            .slice(0, 2)
            .map(trait => ({
              entityType: EntityType.Trait,
              entity: trait,
              title: "Most Consistent",
              value: trait.name,
              detail: `${(trait.avgPlacement ?? 0).toFixed(2)} avg place`,
              image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
              link: `/entity/traits/${trait.id}`,
              variant: 'Class'
            }))
        ],
        itemVariants: [
          ...sortedItems
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
          ...Object.entries(itemsByCategory).flatMap(([category, items]) => {
            if (!items.length) return [];
            const bestItem = [...items].sort((a, b) => (a.avgPlacement ?? 0) - (b.avgPlacement ?? 0))[0];
            if (!bestItem) return [];
            
            const displayCategory = category.replace(/-/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase());
            
            return [{
              entityType: EntityType.Item,
              entity: bestItem,
              title: "Most Consistent",
              value: bestItem.name,
              detail: `${(bestItem.avgPlacement ?? 0).toFixed(2)} avg place`,
              image: ensureIconPath(bestItem.icon, 'item'),
              link: `/entity/items/${bestItem.id}`,
              category: category,
              variant: displayCategory
            }];
          })
        ],
        compVariants: [
          ...sortedComps
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
          ...createCompVariantsByType(
            (a, b) => (a.avgPlacement ?? 0) - (b.avgPlacement ?? 0),
            comp => `${(comp.avgPlacement ?? 0).toFixed(2)} avg place`
          )
        ],
        getPreferredVariant(entityType: string): HighlightEntity | null {
          if (entityType === 'units') return this.unitVariants[0] || null;
          if (entityType === 'traits') return this.traitVariants[0] || null;
          if (entityType === 'items') return this.itemVariants[0] || null;
          if (entityType === 'comps') return this.compVariants[0] || null;
          return null;
        }
      },
      
      // MOST PLAYED HIGHLIGHTS
      {
        type: HighlightType.MostPlayed,
        title: "Most Played",
        unitVariants: [
          ...sortedUnits
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
          ...Object.entries(unitsByCost).flatMap(([cost, units]) => {
            if (!units.length) return [];
            const mostPlayedUnit = [...units].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0];
            return [{
              entityType: EntityType.Unit,
              entity: mostPlayedUnit,
              title: "Most Played",
              value: mostPlayedUnit.name,
              detail: `${mostPlayedUnit.count ?? 0} appearances`,
              image: ensureIconPath(mostPlayedUnit.icon, 'unit'),
              link: `/entity/units/${mostPlayedUnit.id}`,
              category: cost,
              variant: `${cost} 🪙`
            }];
          })
        ],
        traitVariants: [
          ...sortedTraits
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
          ...sortedTraits
            .filter(trait => isOriginTrait(trait.id))
            .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
            .slice(0, 2)
            .map(trait => ({
              entityType: EntityType.Trait,
              entity: trait,
              title: "Most Played",
              value: trait.name,
              detail: `${trait.count ?? 0} appearances`,
              image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
              link: `/entity/traits/${trait.id}`,
              variant: 'Origin'
            })),
          ...sortedTraits
            .filter(trait => !isOriginTrait(trait.id))
            .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
            .slice(0, 2)
            .map(trait => ({
              entityType: EntityType.Trait,
              entity: trait,
              title: "Most Played",
              value: trait.name,
              detail: `${trait.count ?? 0} appearances`,
              image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
              link: `/entity/traits/${trait.id}`,
              variant: 'Origin'
            }))
        ],
        itemVariants: [
          ...sortedItems
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
          ...Object.entries(itemsByCategory).flatMap(([category, items]) => {
            if (!items.length) return [];
            const mostPlayedItem = [...items].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0];
            if (!mostPlayedItem) return [];
            
            const displayCategory = category.replace(/-/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase());
            
            return [{
              entityType: EntityType.Item,
              entity: mostPlayedItem,
              title: "Most Played",
              value: mostPlayedItem.name,
              detail: `${mostPlayedItem.count ?? 0} appearances`,
              image: ensureIconPath(mostPlayedItem.icon, 'item'),
              link: `/entity/items/${mostPlayedItem.id}`,
              category,
              variant: displayCategory
            }];
          })
        ],
        compVariants: [
          ...sortedComps
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
          ...createCompVariantsByType(
            (a, b) => (b.count ?? 0) - (a.count ?? 0),
            comp => `${comp.count ?? 0} appearances`
          )
        ],
        getPreferredVariant(entityType: string): HighlightEntity | null {
          if (entityType === 'units') return this.unitVariants[0] || null;
          if (entityType === 'traits') return this.traitVariants[0] || null;
          if (entityType === 'items') return this.itemVariants[0] || null;
          if (entityType === 'comps') return this.compVariants[0] || null;
          return null;
        }
      },
      
      // MOST FLEXIBLE HIGHLIGHTS
      {
        type: HighlightType.FlexiblePick,
        title: "Most Flexible",
        unitVariants: [
          ...sortedUnits
            .filter(unit => (unit.relatedComps?.length ?? 0) >= 3)
            .sort((a, b) => (b.relatedComps?.length ?? 0) - (a.relatedComps?.length ?? 0))
            .slice(0, 3)
            .map(unit => ({
              entityType: EntityType.Unit,
              entity: unit,
              title: "Most Flexible",
              value: unit.name,
              detail: `Fits in ${unit.relatedComps?.length ?? 0} comps`,
              image: ensureIconPath(unit.icon, 'unit'),
              link: `/entity/units/${unit.id}`,
              variant: 'Overall'
            })),
          ...Object.entries(unitsByCost).flatMap(([cost, units]) => {
            if (!units.length) return [];
            const flexibleUnit = [...units]
              .filter(unit => (unit.relatedComps?.length ?? 0) >= 2)
              .sort((a, b) => (b.relatedComps?.length ?? 0) - (a.relatedComps?.length ?? 0))[0];
            
            if (!flexibleUnit) return [];
            
            return [{
              entityType: EntityType.Unit,
              entity: flexibleUnit,
              title: "Most Flexible",
              value: flexibleUnit.name,
              detail: `Fits in ${flexibleUnit.relatedComps?.length ?? 0} comps`,
              image: ensureIconPath(flexibleUnit.icon, 'unit'),
              link: `/entity/units/${flexibleUnit.id}`,
              category: cost,
              variant: `${cost} 🪙`
            }];
          })
        ],
        traitVariants: [
          ...sortedTraits
            .filter(trait => (trait.relatedComps?.length ?? 0) >= 2)
            .sort((a, b) => (b.relatedComps?.length ?? 0) - (a.relatedComps?.length ?? 0))
            .slice(0, 3)
            .map(trait => ({
              entityType: EntityType.Trait,
              entity: trait,
              title: "Most Flexible",
              value: trait.name,
              detail: `Used in ${trait.relatedComps?.length ?? 0} comps`,
              image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
              link: `/entity/traits/${trait.id}`,
              variant: 'Overall'
            })),
          ...sortedTraits
            .filter(trait => isOriginTrait(trait.id) && (trait.relatedComps?.length ?? 0) >= 2)
            .sort((a, b) => (b.relatedComps?.length ?? 0) - (a.relatedComps?.length ?? 0))
            .slice(0, 2)
            .map(trait => ({
              entityType: EntityType.Trait,
              entity: trait,
              title: "Most Flexible",
              value: trait.name,
              detail: `Used in ${trait.relatedComps?.length ?? 0} comps`,
              image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
              link: `/entity/traits/${trait.id}`,
              variant: 'Origin'
            })),
          ...sortedTraits
            .filter(trait => !isOriginTrait(trait.id) && (trait.relatedComps?.length ?? 0) >= 2)
            .sort((a, b) => (b.relatedComps?.length ?? 0) - (a.relatedComps?.length ?? 0))
            .slice(0, 2)
            .map(trait => ({
              entityType: EntityType.Trait,
              entity: trait,
              title: "Most Flexible",
              value: trait.name,
              detail: `Used in ${trait.relatedComps?.length ?? 0} comps`,
              image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
              link: `/entity/traits/${trait.id}`,
              variant: 'Class'
            }))
        ],
        itemVariants: [
          ...sortedItems
            .filter(item => (item.unitsWithItem?.length ?? 0) >= 2)
            .sort((a, b) => (b.unitsWithItem?.length ?? 0) - (a.unitsWithItem?.length ?? 0))
            .slice(0, 3)
            .map(item => ({
              entityType: EntityType.Item,
              entity: item,
              title: "Most Flexible",
              value: item.name,
              detail: `Used on ${item.unitsWithItem?.length ?? 0} units`,
              image: ensureIconPath(item.icon, 'item'),
              link: `/entity/items/${item.id}`,
              variant: 'Overall'
            })),
          ...Object.entries(itemsByCategory).flatMap(([category, items]) => {
            if (!items.length) return [];
            
            const flexibleItem = [...items]
              .filter(item => (item.unitsWithItem?.length ?? 0) >= 2)
              .sort((a, b) => (b.unitsWithItem?.length ?? 0) - (a.unitsWithItem?.length ?? 0))[0];
              
            if (!flexibleItem) return [];
            
            const displayCategory = category.replace(/-/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase());
            
            return [{
              entityType: EntityType.Item,
              entity: flexibleItem,
              title: "Most Flexible",
              value: flexibleItem.name,
              detail: `Used on ${flexibleItem.unitsWithItem?.length ?? 0} units`,
              image: ensureIconPath(flexibleItem.icon, 'item'),
              link: `/entity/items/${flexibleItem.id}`,
              category,
              variant: displayCategory
            }];
          })
        ],
        compVariants: [
          ...sortedComps
            .filter(comp => (comp.traits?.length ?? 0) >= 3)
            .sort((a, b) => (b.traits?.length ?? 0) - (a.traits?.length ?? 0))
            .slice(0, 3)
            .map(comp => ({
              entityType: EntityType.Comp,
              entity: comp,
              title: "Most Flexible",
              value: comp.name,
              detail: `${comp.traits?.length ?? 0} active traits`,
              image: comp.traits?.[0]?.tierIcon || (comp.traits?.[0]?.icon ? 
                ensureIconPath(comp.traits[0].icon, 'trait') : ''),
              link: `/entity/comps/${comp.id}`,
              variant: 'Overall'
            })),
          ...createCompVariantsByType(
            (a, b) => (b.traits?.length ?? 0) - (a.traits?.length ?? 0),
            comp => `${comp.traits?.length ?? 0} active traits`
          )
        ],
        getPreferredVariant(entityType: string): HighlightEntity | null {
          if (entityType === 'units') return this.unitVariants[0] || null;
          if (entityType === 'traits') return this.traitVariants[0] || null;
          if (entityType === 'items') return this.itemVariants[0] || null;
          if (entityType === 'comps') return this.compVariants[0] || null;
          return null;
        }
      },
      
      // POCKET PICK HIGHLIGHTS
      {
        type: HighlightType.PocketPick,
        title: "Pocket Pick",
        unitVariants: [
          ...sortedUnits
            .filter(unit => (unit.winRate ?? 0) > 52 && (unit.playRate ?? 0) < 15)
            .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
            .slice(0, 3)
            .map(unit => ({
              entityType: EntityType.Unit,
              entity: unit,
              title: "Pocket Pick",
              value: unit.name,
              detail: `${(unit.winRate ?? 0).toFixed(1)}% win • ${(unit.playRate ?? 0).toFixed(1)}% play`,
              image: ensureIconPath(unit.icon, 'unit'),
              link: `/entity/units/${unit.id}`,
              variant: 'Overall'
            })),
          ...Object.entries(unitsByCost).flatMap(([cost, units]) => {
            const pocketPicks = units.filter(unit => 
              (unit.winRate ?? 0) > 52 && 
              (unit.playRate ?? 0) < Math.min(25, units.length > 5 ? 15 : 30)
            );
            
            if (!pocketPicks.length) return [];
            
            const bestPocketPick = [...pocketPicks]
              .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0];
              
            return [{
              entityType: EntityType.Unit,
              entity: bestPocketPick,
              title: "Pocket Pick",
              value: bestPocketPick.name,
              detail: `${(bestPocketPick.winRate ?? 0).toFixed(1)}% win • ${(bestPocketPick.playRate ?? 0).toFixed(1)}% play`,
              image: ensureIconPath(bestPocketPick.icon, 'unit'),
              link: `/entity/units/${bestPocketPick.id}`,
              category: cost,
              variant: `${cost} 🪙`
            }];
          })
        ],
        traitVariants: [
          ...sortedTraits
            .filter(trait => (trait.winRate ?? 0) > 52 && (trait.playRate ?? 0) < 15)
            .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
            .slice(0, 3)
            .map(trait => ({
              entityType: EntityType.Trait,
              entity: trait,
              title: "Pocket Pick",
              value: trait.name,
              detail: `${(trait.winRate ?? 0).toFixed(1)}% win • ${(trait.playRate ?? 0).toFixed(1)}% play`,
              image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
              link: `/entity/traits/${trait.id}`,
              variant: 'Overall'
            })),
          ...sortedTraits
            .filter(trait => isOriginTrait(trait.id) && (trait.winRate ?? 0) > 52 && (trait.playRate ?? 0) < 15)
            .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
            .slice(0, 2)
            .map(trait => ({
              entityType: EntityType.Trait,
              entity: trait,
              title: "Pocket Pick",
              value: trait.name,
              detail: `${(trait.winRate ?? 0).toFixed(1)}% win • ${(trait.playRate ?? 0).toFixed(1)}% play`,
              image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
              link: `/entity/traits/${trait.id}`,
              variant: 'Origin'
            })),
          ...sortedTraits
            .filter(trait => !isOriginTrait(trait.id) && (trait.winRate ?? 0) > 52 && (trait.playRate ?? 0) < 15)
            .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
            .slice(0, 2)
            .map(trait => ({
              entityType: EntityType.Trait,
              entity: trait,
              title: "Pocket Pick",
              value: trait.name,
              detail: `${(trait.winRate ?? 0).toFixed(1)}% win • ${(trait.playRate ?? 0).toFixed(1)}% play`,
              image: trait.tierIcon || ensureIconPath(trait.icon, 'trait'),
              link: `/entity/traits/${trait.id}`,
              variant: 'Class'
            }))
        ],
        itemVariants: [
          ...sortedItems
            .filter(item => (item.winRate ?? 0) > 52 && (item.playRate ?? 0) < 15)
            .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
            .slice(0, 3)
            .map(item => ({
              entityType: EntityType.Item,
              entity: item,
              title: "Pocket Pick",
              value: item.name,
              detail: `${(item.winRate ?? 0).toFixed(1)}% win • ${(item.playRate ?? 0).toFixed(1)}% play`,
              image: ensureIconPath(item.icon, 'item'),
              link: `/entity/items/${item.id}`,
              variant: 'Overall'
            })),
          ...Object.entries(itemsByCategory).flatMap(([category, items]) => {
            const pocketPicks = items.filter(item => 
              (item.winRate ?? 0) > 50 && 
              (item.playRate ?? 0) < Math.min(20, items.length > 5 ? 15 : 30)
            );
            
            if (!pocketPicks.length) return [];
            
            const bestPocketPick = [...pocketPicks]
              .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0];
              
            if (!bestPocketPick) return [];
            
            const displayCategory = category.replace(/-/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase());
            
            return [{
              entityType: EntityType.Item,
              entity: bestPocketPick,
              title: "Pocket Pick",
              value: bestPocketPick.name,
              detail: `${(bestPocketPick.winRate ?? 0).toFixed(1)}% win • ${(bestPocketPick.playRate ?? 0).toFixed(1)}% play`,
              image: ensureIconPath(bestPocketPick.icon, 'item'),
              link: `/entity/items/${bestPocketPick.id}`,
              category,
              variant: displayCategory
            }];
          })
        ],
        compVariants: [
          ...sortedComps
            .filter(comp => (comp.winRate ?? 0) > 52 && (comp.playRate ?? 0) < 8)
            .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
            .slice(0, 3)
            .map(comp => ({
              entityType: EntityType.Comp,
              entity: comp,
              title: "Pocket Pick",
              value: comp.name,
              detail: `${(comp.winRate ?? 0).toFixed(1)}% win • ${(comp.playRate ?? 0).toFixed(1)}% play`,
              image: comp.traits?.[0]?.tierIcon || (comp.traits?.[0]?.icon ? 
                ensureIconPath(comp.traits[0].icon, 'trait') : ''),
              link: `/entity/comps/${comp.id}`,
              variant: 'Overall'
            })),
          ...createCompVariantsByType(
            (a, b) => {
              // For pocket picks, we want high winrate but low playrate
              // First check if one is a pocket pick and the other isn't
              const aIsPocket = (a.winRate ?? 0) > 52 && (a.playRate ?? 0) < 10;
              const bIsPocket = (b.winRate ?? 0) > 52 && (b.playRate ?? 0) < 10;
              
              if (aIsPocket && !bIsPocket) return -1;
              if (!aIsPocket && bIsPocket) return 1;
              
              // If both or neither are pocket picks, go by winrate
              return (b.winRate ?? 0) - (a.winRate ?? 0);
            },
            comp => `${(comp.winRate ?? 0).toFixed(1)}% win • ${(comp.playRate ?? 0).toFixed(1)}% play`
          )
        ],
        getPreferredVariant(entityType: string): HighlightEntity | null {
          if (entityType === 'units') return this.unitVariants[0] || null;
          if (entityType === 'traits') return this.traitVariants[0] || null;
          if (entityType === 'items') return this.itemVariants[0] || null;
          if (entityType === 'comps') return this.compVariants[0] || null;
          return null;
        }
      }
    ];
  }, [data]);

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
    highlights
  };
}

export function useEntityData(type: string, id: string) {
  const { data } = useTftData();
  
  if (!data || !id) return null;
  
  if (type === 'comps') {
    return data.compositions.find(comp => comp.id === id);
  }
  
  // For other entity types, we'll search through compositions
  let entity: any;
  let relatedComps: Composition[] = [];
  
  if (type === 'units') {
    // Find the unit in any composition
    data.compositions.forEach(comp => {
      const foundUnit = comp.units.find(unit => unit.id === id);
      if (foundUnit) {
        entity = foundUnit;
        // Add this comp to related comps if it contains the unit
        relatedComps.push(comp);
      }
    });
  } 
  else if (type === 'traits') {
    // Find the trait in any composition
    data.compositions.forEach(comp => {
      const foundTrait = comp.traits.find(trait => trait.id === id);
      if (foundTrait) {
        entity = foundTrait;
        // Add this comp to related comps if it contains the trait
        relatedComps.push(comp);
      }
    });
  } 
  else if (type === 'items') {
    // Find the item in any unit in any composition
    data.compositions.forEach(comp => {
      comp.units.forEach(unit => {
        if (!unit.items) return;
        
        const foundItem = unit.items.find(item => item.id === id);
        if (foundItem) {
          entity = foundItem;
          // Add this comp to related comps if it contains the item
          relatedComps.push(comp);
        }
      });
    });
    
    // Find units that use this item
    const unitsWithItem: any[] = [];
    data.compositions.forEach(comp => {
      comp.units.forEach(unit => {
        if (!unit.items) return;
        
        const hasItem = unit.items.some(item => item.id === id);
        if (hasItem) {
          // Check if this unit is already in the list
          const existingUnit = unitsWithItem.find(u => u.id === unit.id);
          if (existingUnit) {
            existingUnit.count += comp.count || 1;
          } else {
            unitsWithItem.push({
              id: unit.id,
              name: unit.name,
              icon: unit.icon,
              cost: unit.cost,
              count: comp.count || 1,
              winRate: comp.winRate || 0,
              avgPlacement: comp.avgPlacement || 0,
              relatedComps: [comp]
            });
          }
        }
      });
    });
    
    // Calculate stats for the returned entity
    if (entity && unitsWithItem.length > 0) {
      entity.unitsWithItem = unitsWithItem
        .map(unit => ({
          ...unit,
          winRate: unit.winRate * 100,
        }))
        .sort((a, b) => b.count - a.count);
    }
  }
  
  if (!entity) return null;
  
  // Calculate stats based on related comps
  const totalGames = relatedComps.reduce((sum, comp) => sum + (comp.count || 1), 0);
  const avgPlacement = relatedComps.reduce((sum, comp) => 
    sum + ((comp.avgPlacement ?? 0) * (comp.count || 1)), 0) / (totalGames || 1);
  const winRate = relatedComps.reduce((sum, comp) => 
    sum + ((comp.winRate ?? 0) * (comp.count || 1)), 0) / (totalGames || 1);
  const top4Rate = relatedComps.reduce((sum, comp) => 
    sum + ((comp.top4Rate ?? 0) * (comp.count || 1)), 0) / (totalGames || 1);
  
  // Return the entity with calculated stats
  return {
    ...entity,
    relatedComps,
    stats: { 
      count: totalGames, 
      avgPlacement, 
      winRate, 
      top4Rate 
    }
  };
}

export function useTierLists() {
  const { data } = useTftData();
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
  
  // Extract unique entities from compositions
  const extractEntities = (type: string): any[] => {
    if (!data.compositions) return [];
    
    if (type === 'units') {
      // Extract unique units from all compositions
      const units: Record<string, any> = {};
      data.compositions.forEach(comp => {
        comp.units.forEach(unit => {
          if (!units[unit.id]) {
            units[unit.id] = {...unit, count: 0, playRate: 0};
          }
          units[unit.id].count += comp.count || 1;
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
          (unit.items || []).forEach(item => {
            if (!items[item.id]) {
              items[item.id] = {...item, count: 0, playRate: 0};
            }
            items[item.id].count += comp.count || 1;
          });
        });
      });
      
      // Calculate playRate for each item
      const totalItems = Object.values(items).reduce((sum: number, item: any) => sum + item.count, 0);
      Object.values(items).forEach(item => {
        item.playRate = (item.count / totalItems) * 100;
      });
      
      return Object.values(items);
    }
    
    if (type === 'traits') {
      // Extract unique traits from all compositions
      const traits: Record<string, any> = {};
      data.compositions.forEach(comp => {
        comp.traits.forEach(trait => {
          if (!traits[trait.id]) {
            traits[trait.id] = {...trait, count: 0, playRate: 0};
          }
          traits[trait.id].count += comp.count || 1;
        });
      });
      
      // Calculate playRate for each trait
      const totalTraits = Object.values(traits).reduce((sum: number, trait: any) => sum + trait.count, 0);
      Object.values(traits).forEach(trait => {
        trait.playRate = (trait.count / totalTraits) * 100;
      });
      
      return Object.values(traits);
    }
    
    return data.compositions;
  };
  
  return {
    units: createTierList(extractEntities('units')),
    items: createTierList(extractEntities('items')),
    traits: createTierList(extractEntities('traits')),
    comps: createTierList(data.compositions)
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
