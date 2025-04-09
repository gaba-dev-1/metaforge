import React from 'react';

interface PlacementDistributionProps {
  placementData?: Array<{ placement: number; count: number; }>;
}

function PlacementDistribution({ placementData }: PlacementDistributionProps) {
  if (!placementData || placementData.length === 0) return null;
  
  // Calculate total count for percentages
  const totalGames = placementData.reduce((sum, p) => sum + p.count, 0);
  const placementPercentages = placementData.map(p => ({
    ...p,
    percentage: ((p.count / totalGames) * 100).toFixed(1)
  }));

  return (
    <div className="mt-2 pt-3 border-t border-gold/20">
      <div className="flex flex-col space-y-2">
        {/* Visual chart for all 8 placements */}
        <div className="w-full bg-brown-light/10 rounded-lg p-3">
          <div className="flex items-end space-x-1">
            {Array.from({ length: 8 }, (_, i) => {
              const placement = i + 1;
              // Find the placement data or use a default
              const placementData = placementPercentages.find(p => p.placement === placement) || 
                { placement, count: 0, percentage: '0.0' };
              
              const percentage = parseFloat(placementData.percentage);
              const height = `${Math.max(4, (percentage / 100) * 120)}px`;
              
              // Color scheme based on placement
              let barColor;
              let textColor;
              
              switch(placement) {
                case 1: 
                  barColor = 'bg-gradient-to-t from-gold to-amber-500/80';
                  textColor = 'text-gold';
                  break;
                case 2: 
                  barColor = 'bg-gradient-to-t from-gray-300 to-gray-200';
                  textColor = 'text-gray-200';
                  break;
                case 3: 
                  barColor = 'bg-gradient-to-t from-amber-700 to-amber-600';
                  textColor = 'text-amber-400';
                  break;
                default: 
                  barColor = 'bg-gradient-to-t from-cream-dark/40 to-cream-dark/30';
                  textColor = 'text-cream';
              }

              return (
                <div key={placement} className="flex-1 flex flex-col items-center">
                  <div className="text-xs text-cream/70 mb-1">{percentage}%</div>
                  <div 
                    className={`w-full rounded-t ${barColor}`} 
                    style={{ height }}
                  ></div>
                  <div className={`text-xs font-medium mt-1 ${textColor}`}>
                    #{placement}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatsPanelProps {
  stats: {
    count?: number;
    avgPlacement?: number;
    winRate?: number;
    top4Rate?: number;
    placementData?: Array<{ placement: number; count: number; }>;
    totalGames?: number; // Total number of games analyzed
    [key: string]: any;
  } | null;
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  if (!stats) return null;
  
  // Calculate per-lobby frequency if totalGames is available
  const totalGames = stats.totalGames || 0;
  const perLobbyFrequency = totalGames > 0 
    ? ((stats.count || 0) / totalGames * 8).toFixed(1)
    : '-';
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-box">
          <div className="text-sm text-cream/80">Frequency</div>
          <div className="text-base font-medium">
            {totalGames > 0 ? `${perLobbyFrequency}/8` : stats.count || 0}
          </div>
        </div>
        <div className="stat-box">
          <div className="text-sm text-cream/80">Avg Place</div>
          <div className="text-base font-medium">{stats.avgPlacement?.toFixed(2) || '-'}</div>
        </div>
        <div className="stat-box">
          <div className="text-sm text-cream/80">Win Rate</div>
          <div className="text-base font-medium">{stats.winRate?.toFixed(1) || '0'}%</div>
        </div>
        <div className="stat-box">
          <div className="text-sm text-cream/80">Top 4</div>
          <div className="text-base font-medium">{stats.top4Rate?.toFixed(1) || '0'}%</div>
        </div>
      </div>
      
      {stats.placementData && <PlacementDistribution placementData={stats.placementData} />}
    </div>
  );
}

// Export PlacementDistribution component
export { PlacementDistribution };
