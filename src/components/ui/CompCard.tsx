import React from 'react';
import Link from 'next/link';
import { parseCompTraits } from '@/utils/dataProcessing';
import { Composition, ProcessedDisplayTrait } from '@/types';

interface CompCardProps {
  comp: Composition | null;
}

export default function CompCard({ comp }: CompCardProps) {
  if (!comp) return null;
  
  const displayTraits = parseCompTraits(comp.name, comp.traits || []);
  
  return (
    <Link href={`/entity/comps/${comp.id}`}>
      <div className="bg-brown-light/30 p-3 rounded hover:bg-brown-light/40">
        <div className="flex justify-center gap-1 mb-2">
          {displayTraits.map((trait: ProcessedDisplayTrait, i: number) => (
            <img 
              key={i} 
              src={trait.tierIcon || trait.icon} 
              alt={trait.name} 
              className="w-6 h-6" 
            />
          ))}
        </div>
        {/* Improved truncation for long comp names */}
        <div className="text-sm font-medium text-center truncate w-full max-w-full">{comp.name || 'Comp'}</div>
        <div className="text-xs text-center mt-2">
          <span className="mr-2">Win: {comp.winRate?.toFixed(1)}%</span>
          <span>Avg: {comp.avgPlacement?.toFixed(2)}</span>
        </div>
      </div>
    </Link>
  );
}
