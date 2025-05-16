import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LeaderboardEntry } from '@/types/auth';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface TopPlayersProps {
  players: LeaderboardEntry[];
  isLoading: boolean;
}

type SortField = 'rank' | 'leaguePoints' | 'wins' | 'losses';
type SortDirection = 'asc' | 'desc';

export default function TopPlayers({ players, isLoading }: TopPlayersProps) {
  const [sort, setSort] = useState<SortField>('rank');
  const [direction, setDirection] = useState<SortDirection>('asc');
  
  // Sort the players
  const sortedPlayers = [...players].sort((a, b) => {
    const aVal = a[sort];
    const bVal = b[sort];
    
    if (direction === 'asc') {
      return aVal - bVal;
    } else {
      return bVal - aVal;
    }
  });
  
  // Handle sort change
  const handleSort = (field: SortField) => {
    if (field === sort) {
      setDirection(direction === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field);
      setDirection(field === 'rank' ? 'asc' : 'desc');
    }
  };
  
  // Get the tier color
  const getTierColor = (tier: string) => {
    const colors = {
      IRON: "text-gray-400",
      BRONZE: "text-amber-700",
      SILVER: "text-gray-300",
      GOLD: "text-gold",
      PLATINUM: "text-teal-400",
      DIAMOND: "text-blue-400",
      MASTER: "text-purple-400",
      GRANDMASTER: "text-red-400",
      CHALLENGER: "text-solar-flare"
    };
    
    return colors[tier as keyof typeof colors] || "text-gold";
  };
  
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="border border-solar-flare/20 rounded-lg p-4 backdrop-filter backdrop-blur-sm bg-brown/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-5 w-5 bg-brown-light/30 rounded"></div>
                <div className="h-5 w-40 bg-brown-light/30 rounded"></div>
              </div>
              <div className="flex gap-4">
                <div className="h-5 w-16 bg-brown-light/30 rounded"></div>
                <div className="h-5 w-16 bg-brown-light/30 rounded"></div>
                <div className="h-5 w-16 bg-brown-light/30 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (!players.length) {
    return (
      <div className="text-center py-8 border border-solar-flare/20 rounded-lg p-6 backdrop-filter backdrop-blur-sm bg-brown/10">
        <p className="text-corona-light">No players found</p>
        <p className="text-corona-light/70 text-sm mt-2">Try selecting a different region</p>
      </div>
    );
  }
  
  // Columns for table header
  const columns = [
    { id: 'rank', name: 'LP' },
    { id: 'leaguePoints', name: 'Total' },
    { id: 'wins', name: 'Wins' },
    { id: 'losses', name: 'Losses' }
  ];
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.2, 0.8, 0.2, 1]
      }
    }
  };

  return (
    <div>
      {/* Table header with proper side margins */}
      <div className="border-b border-solar-flare/30 mb-4 pb-2 px-4">
        <div className="flex items-center justify-between">
          <div className="w-2/5 text-corona-light font-medium">Player</div>
          <div className="w-3/5 flex gap-2 md:gap-4">
            {columns.map(column => (
              <button 
                key={column.id} 
                className={`flex items-center justify-end w-1/4 ${
                  sort === column.id ? 'text-gold' : 'text-corona-light/70'
                }`}
                onClick={() => handleSort(column.id as SortField)}
              >
                {column.name}
                {sort === column.id && (
                  direction === 'asc' ? 
                    <ArrowUp className="ml-1 h-3 w-3" /> : 
                    <ArrowDown className="ml-1 h-3 w-3" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Player rows with glass styling */}
      <motion.div 
        className="space-y-2"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {sortedPlayers.map((player, index) => (
          <motion.div 
            key={`${player.summonerId}-${index}`}
            className="border border-solar-flare/20 rounded-lg p-4 backdrop-filter backdrop-blur-sm bg-brown/10 hover:bg-brown/20 transition-colors"
            variants={itemVariants}
          >
            <div className="flex items-center justify-between">
              <div className="w-2/5 flex items-center gap-2 pl-2">
                <div className="w-8 text-center font-medium text-corona-light">
                  {player.rank}
                </div>
                <div>
                  <div className="font-medium truncate max-w-xs text-corona-light">
                    {player.summonerName || "Unknown"}
                    {player.tagLine && (
                      <span className="text-xs text-corona-light/70 ml-1">
                        #{player.tagLine}
                      </span>
                    )}
                  </div>
                  <div className={`text-xs font-medium ${getTierColor(player.tier)}`}>
                    {player.tier} {player.division}
                  </div>
                </div>
              </div>
              
              <div className="w-3/5 flex gap-2 md:gap-4 text-sm pr-2">
                <div className="w-1/4 text-right font-medium text-gold">
                  {player.leaguePoints}
                </div>
                <div className="w-1/4 text-right text-amber-400">
                  {player.wins}
                </div>
                <div className="w-1/4 text-right text-emerald-400">
                  {player.losses}
                </div>
                <div className="w-1/4 text-right text-corona-light">
                  {player.wins + player.losses > 0 
                    ? Math.round((player.wins / (player.wins + player.losses)) * 100)
                    : 0}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
