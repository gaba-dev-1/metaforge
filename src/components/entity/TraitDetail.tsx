import React from 'react';
import Link from 'next/link';
import { StatsPanel, UnitIcon, TraitIcon, PlacementDistribution } from '@/components/ui';
import unitsJson from '@/mapping/units.json';
import { ProcessedTrait } from '@/types';
import { getTierName, getEntityIcon } from '@/utils/paths';

export default function TraitDetail({ 
  entityData, 
  traitDetails, 
  traitType, 
  entityId 
}: { 
  entityData: ProcessedTrait | null, 
  traitDetails: any, 
  traitType: string, 
  entityId: string 
}) {
  if (!entityData) return null;

  // Prepare placement data for distribution chart
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

  return (
    <>
      {/* UPDATED: Larger trait icon with fill container */}
      <div className="flex items-center gap-4 border-b border-gold/30 pb-4 mb-6">
        <div className="w-12 h-12 flex items-center justify-center">
          <img 
            src={getEntityIcon(entityData, 'trait')} 
            alt={entityData.name} 
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/traits/default.png';
            }}
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gold">{entityData.name}</h1>
          <p className="text-sm text-cream/80">{traitType === 'origins' ? 'Origin' : 'Class'}</p>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {traitDetails?.description && (
            <div className="bg-brown-light/20 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gold mb-3">Description</h2>
              <p className="text-sm whitespace-pre-line">{traitDetails.description}</p>
            </div>
          )}
          
          {traitDetails?.tiers && traitDetails.tiers.length > 0 && (
            <div className="bg-brown-light/20 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gold mb-3">Trait Tiers</h2>
              <div className="space-y-2">
                {traitDetails.tiers.map((tier: { icon: string, units: number, value: string }, i: number) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded ${
                    entityData.tier > i ? 'bg-gold/20' : 'bg-brown-light/30'
                  }`}>
                    <div className="flex items-center gap-2">
                      <img 
                        src={`/assets/traits/${tier.icon || entityData.icon}`} 
                        alt={`Tier ${i+1}`} 
                        className="w-6 h-6"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/assets/traits/default.png';
                        }}
                      />
                      <span className="text-gold font-semibold">{tier.units} units {getTierName(i+1)}</span>
                    </div>
                    <p className="text-sm">{tier.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="bg-brown-light/20 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gold mb-3">Performance Stats</h2>
            <StatsPanel stats={{...entityData.stats, placementData}} />
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="bg-brown-light/20 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gold mb-3">Units with this Trait</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(unitsJson.units)
                .filter(([_, unit]) => {
                  // Type guard: Check if unit has traits
                  if (!unit || typeof unit !== 'object' || !('traits' in unit) || !unit.traits) return false;
                  
                  // Safely extract origins array
                  const origins = unit.traits.origin ? 
                    (Array.isArray(unit.traits.origin) ? unit.traits.origin : [unit.traits.origin]) 
                    : [];
                  
                  // Safely extract classes array
                  const classes = unit.traits.class ?
                    (Array.isArray(unit.traits.class) ? unit.traits.class : [unit.traits.class])
                    : [];
                  
                  return [...origins, ...classes].filter(Boolean).includes(entityId);
                })
                .map(([unitId, unit]) => ({
                  id: unitId,
                  name: unit.name,
                  icon: unit.icon,
                  cost: unit.cost
                }))
                // Sort by cost (descending) and then name
                .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name))
                .map((unit, i) => (
                  <Link href={`/entity/units/${unit.id}`} key={i}>
                    <div className="flex items-center gap-2 bg-brown-light/30 p-3 rounded hover:bg-brown-light/40">
                      <UnitIcon unit={unit} size="sm" />
                      <span className="text-base truncate">{unit.name}</span>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
          
          {entityData.relatedComps && entityData.relatedComps.length > 0 && (
            <div className="bg-brown-light/20 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gold mb-3">Top Compositions</h2>
              <div className="grid grid-cols-2 gap-3">
                {entityData.relatedComps.slice(0, 6).map((comp, i) => (
                  <Link href={`/entity/comps/${comp.id}`} key={i}>
                    <div className="bg-brown-light/30 p-3 rounded hover:bg-brown-light/40">
                      <div className="flex justify-center gap-1 mb-2">
                        {(comp.traits || []).slice(0, 3).map((trait, j) => (
                          <TraitIcon 
                            key={j} 
                            trait={trait} 
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
