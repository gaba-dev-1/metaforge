import React from 'react';
import Link from 'next/link';
import { StatsPanel, UnitIcon, TraitIcon, ItemIcon, PlacementDistribution } from '@/components/ui';
import { ProcessedItem } from '@/types';
import { getEntityIcon } from '@/utils/paths';

// Item combo component
interface ItemComboProps {
  combo: {
    items: ProcessedItem[];
    winRate: number;
  };
}

const ItemCombo = ({ combo }: ItemComboProps) => (
  <div className="bg-brown-light/30 p-3 rounded hover:bg-brown-light/40">
    <div className="flex justify-center items-center gap-1">
      {combo.items.map((item, i) => (
        <Link href={`/entity/items/${item.id}`} key={i}>
          <div className="w-10 h-10 border border-gold/20 rounded bg-brown-light/40 flex items-center justify-center p-1">
            <ItemIcon item={item} size="sm" />
          </div>
        </Link>
      ))}
    </div>
    <div className="text-center mt-2 text-sm text-gold-light">
      {Math.min(combo.winRate, 100).toFixed(1)}% Win Rate
    </div>
  </div>
);

export default function ItemDetail({ 
    entityData, 
    itemDetails 
  }: { 
    entityData: ProcessedItem | null, 
    itemDetails: any 
  }) {
    if (!entityData) return null;
    
    // Generate placement data for PlacementDistribution
    const placementData = entityData.relatedComps ? 
      entityData.relatedComps.reduce((acc, comp) => {
        if (!comp.placementData) return acc;
        
        // Aggregate placement data from all related compositions
        comp.placementData.forEach(pd => {
          const existing = acc.find(a => a.placement === pd.placement);
          if (existing) {
            existing.count += pd.count;
          } else {
            acc.push({ ...pd });
          }
        });
        return acc;
      }, [] as Array<{ placement: number; count: number }>) : 
      undefined;

    // Get item combos
    const combos = entityData.combos || [];
    
    // Sort and cap best units data
    const bestUnits = entityData.unitsWithItem 
      ? entityData.unitsWithItem
          .sort((a, b) => (b.winRate || 0) - (a.winRate || 0))
          .map(unit => ({
            ...unit,
            winRate: Math.min(unit.winRate || 0, 100)
          }))
          .slice(0, 6)
      : [];

    return (
      <>
      <div className="flex items-center gap-4 border-b border-gold/30 pb-4 mb-6">
        <div className="w-12 h-12 flex items-center justify-center">
          <img 
            src={getEntityIcon(entityData, 'item')} 
            alt={entityData.name} 
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/items/default.png';
            }}
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gold">{entityData.name}</h1>
          {entityData.category && <p className="text-sm text-cream/80">{entityData.category.replace(/-/g, ' ')}</p>}
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {itemDetails?.description && (
            <div className="bg-brown-light/20 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gold mb-3">Description</h2>
              <p className="text-sm bg-brown-light/30 p-3 rounded whitespace-pre-line">{itemDetails.description}</p>
            </div>
          )}
          
          <div className="bg-brown-light/20 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gold mb-3">Performance Stats</h2>
            <StatsPanel stats={{
              ...entityData.stats, 
              placementData,
              // Clean up stats to prevent extreme values
              winRate: Math.min(entityData.stats?.winRate || 0, 100),
              top4Rate: Math.min(entityData.stats?.top4Rate || 0, 100)
            }} />
          </div>
          
          {/* Best Item Combos Section */}
          {combos.length > 0 && (
            <div className="bg-brown-light/20 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gold mb-3">Best Item Combinations</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {combos.slice(0, 3).map((combo, i) => (
                  <ItemCombo key={i} combo={combo} />
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="space-y-6">
          {bestUnits.length > 0 && (
            <div className="bg-brown-light/20 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gold mb-3">Best Units</h2>
              <div className="grid grid-cols-3 gap-3">
                {bestUnits.map((unit, i) => (
                  <Link href={`/entity/units/${unit.id}`} key={i}>
                    <div className="flex flex-col items-center gap-2 bg-brown-light/30 p-3 rounded hover:bg-brown-light/40">
                      <UnitIcon unit={unit} size="md" />
                      <div className="text-center">
                        <div className="text-sm font-medium truncate max-w-28">{unit.name}</div>
                        <div className="text-xs text-gold-light">
                          Win: {Math.min(unit.winRate || 0, 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          
          {entityData.relatedComps && entityData.relatedComps.length > 0 && (
            <div className="bg-brown-light/20 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gold mb-3">Top Compositions</h2>
              <div className="grid grid-cols-2 gap-3">
                {entityData.relatedComps.slice(0, 4).map((comp, i) => (
                  <Link href={`/entity/comps/${comp.id}`} key={i}>
                    <div className="bg-brown-light/30 p-3 rounded hover:bg-brown-light/40">
                      <div className="flex justify-center gap-1 mb-2">
                        {(comp.traits || []).slice(0, 3).map((trait, j) => (
                          <TraitIcon 
                            key={j} 
                            trait={{
                              ...trait,
                              tierIcon: trait.tierIcon,
                              icon: trait.icon || '/assets/traits/default.png'
                            }}
                            size="sm"
                          />
                        ))}
                      </div>
                      <div className="text-sm font-medium text-center truncate">{comp.name?.split('&')[0] || 'Comp'}</div>
                      <div className="text-xs text-center mt-2">
                        <span className="mr-2">Win: {Math.min(comp.winRate || 0, 100).toFixed(1)}%</span>
                        <span>Avg: {comp.avgPlacement?.toFixed(2)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
