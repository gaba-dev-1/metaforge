import React from 'react';
import { Card } from '@/components/ui';
import { Tag, Award, FileBarChart } from 'lucide-react';
import { useTftData } from '@/utils/useTftData';

export function HeaderBanner() {
  const { matchCount, currentRegion } = useTftData();
  
  return (
    <Card className="h-auto py-2 px-3 sm:px-4 sm:p-3 mt-4 -mb-2 border border-gold/40">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-md text-cream/90">
          TFT {currentRegion !== 'all' ? `${currentRegion} ` : ''}latest matches
        </div>
        
        <div className="flex flex-wrap justify-start sm:justify-end gap-1.5 overflow-x-auto">
          <div className="inline-flex items-center bg-brown-light/30 px-2 py-1 rounded-lg border border-gold/20">
            <Tag size={14} className="text-gold mr-1.5" />
            <span className="text-xs whitespace-nowrap">Patch 14.1</span>
          </div>
          
          <div className="inline-flex items-center bg-brown-light/30 px-2 py-1 rounded-lg border border-gold/20">
            <Award size={14} className="text-gold mr-1.5" />
            <p className="text-xs whitespace-nowrap">Last update: 1min</p>
          </div>
          
          <div className="inline-flex items-center bg-brown-light/30 px-2 py-1 rounded-lg border border-gold/20">
            <FileBarChart size={14} className="text-gold mr-1.5" />
            <p className="text-xs whitespace-nowrap">
              1000+ matches
              {currentRegion !== 'all' && ` (${currentRegion})`}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
