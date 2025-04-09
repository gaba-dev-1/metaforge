import React from 'react';
import Link from 'next/link';
import { getEntityIcon, DEFAULT_ICONS } from '@/utils/paths';
import { HighlightEntity, EntityType } from '@/utils/useTftData';
import { parseCompTraits } from '@/utils/dataProcessing';

interface MetaHighlightCardProps {
  highlight: HighlightEntity | null;
  title: string;
  icon: React.ReactNode;
}

export function MetaHighlightCard({
  highlight,
  title,
  icon
}: MetaHighlightCardProps) {
  if (!highlight) {
    return (
      <div className="h-full border border-gold/30 rounded-lg bg-brown/5 backdrop-filter backdrop-blur-md transition-all min-h-[120px]">
        <div className="flex items-center justify-center py-2 px-3 bg-brown/60 border-b border-gold/30 rounded-lg">
          <div className="flex items-center justify-center gap-2">
            {icon}
            <h3 className="text-gold text-base">{title}</h3>
          </div>
        </div>
        <div className="relative h-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <p className="text-sm text-cream/70">No data available</p>
          </div>
        </div>
      </div>
    );
  }

  const displayTitle = highlight.variant && highlight.variant !== 'Overall' ? 
    `${title}: ${highlight.variant}` : 
    title;

  const renderEntityImage = () => {
    if (highlight.entityType === EntityType.Unit) {
      return (
        <div className="w-12 h-12 rounded-full border-2 border-gold/30 overflow-hidden flex-shrink-0">
          <img 
            src={getEntityIcon(highlight.entity, 'unit')} 
            alt={highlight.value} 
            className="w-full h-full object-cover" 
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = DEFAULT_ICONS.unit;
            }}
          />
        </div>
      );
    }
    
    if (highlight.entityType === EntityType.Item) {
      return (
        <img 
          src={getEntityIcon(highlight.entity, 'item')} 
          alt={highlight.value} 
          className="w-12 h-12 object-contain" 
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = DEFAULT_ICONS.item;
          }}
        />
      );
    }
    
    if (highlight.entityType === EntityType.Trait) {
      return (
        <img 
          src={getEntityIcon(highlight.entity, 'trait')} 
          alt={highlight.value} 
          className="w-12 h-12 object-contain" 
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = DEFAULT_ICONS.trait;
          }}
        />
      );
    }
    
    if (highlight.entityType === EntityType.Comp) {
      return (
        <div className="flex gap-1 flex-wrap justify-center ml-2">
          {parseCompTraits(highlight.entity.name, highlight.entity.traits || []).map((trait: any, i: number) => {
            return (
              <img 
                key={i} 
                src={getEntityIcon(trait, 'trait')} 
                alt={trait.name} 
                className="w-8 h-8" 
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = DEFAULT_ICONS.trait;
                }}
              />
            );
          })}
        </div>
      );
    }
    
    return (
      <div className="w-12 h-12 bg-brown-light/50 rounded-full flex items-center justify-center">
        {icon}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col border border-gold/30 rounded-lg bg-brown/5 backdrop-filter backdrop-blur-md transition-all min-h-[120px]">
      <div className="flex items-center justify-center py-2 px-3 rounded-lg bg-brown/60 border-b border-gold/30">
        <div className="flex items-center justify-center gap-2">
          {icon}
          <h3 className="text-gold text-base">{displayTitle}</h3>
        </div>
      </div>
      <Link href={highlight.link} className="flex-1 relative">
        <div className="absolute inset-0 hover:bg-brown/50 hover:border-gold/50 transition-all ease-in-out">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3">
            <div className="flex-shrink-0">
              {renderEntityImage()}
            </div>
            <div className="min-w-0">
              <div className="font-medium truncate">{highlight.value}</div>
              <div className="text-xs text-cream/70 truncate">{highlight.detail}</div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
