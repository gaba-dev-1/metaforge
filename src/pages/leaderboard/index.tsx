import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Layout from '@/components/ui/Layout';
import { Search, RefreshCw, Trophy } from 'lucide-react';
import RegionFilter from '@/components/leaderboard/RegionFilter';
import TopPlayers from '@/components/leaderboard/TopPlayers';
import { LeaderboardEntry } from '@/types/auth';
import { StatsCarousel } from '@/components/common/StatsCarousel';
import { HeaderBanner } from '@/components/common/HeaderBanner';

export default function LeaderboardPage() {
  const [activeRegion, setActiveRegion] = useState('na1');
  const [search, setSearch] = useState('');
  
  // Available regions
  const regions = [
    { id: 'na1', name: 'NA' },
    { id: 'euw1', name: 'EUW' },
    { id: 'kr', name: 'KR' },
    { id: 'br1', name: 'BR' },
    { id: 'jp1', name: 'JP' },
    { id: 'eun1', name: 'EUNE' },
    { id: 'la1', name: 'LAN' },
    { id: 'la2', name: 'LAS' },
    { id: 'tr1', name: 'TR' },
    { id: 'ru', name: 'RU' },
    { id: 'oc1', name: 'OCE' }
  ];
  
  // Query leaderboard data
  const {
    data: leaderboard,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', activeRegion],
    queryFn: async () => {
      const response = await fetch(`/api/tft/leaderboard?region=${activeRegion}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch leaderboard data');
      }
      
      return response.json();
    },
    staleTime: 300000, // 5 minutes
    retry: 2
  });
  
  // Filter players by search
  const filteredPlayers = leaderboard && search
    ? leaderboard.filter(player => 
        player.summonerName.toLowerCase().includes(search.toLowerCase()) ||
        (player.tagLine && player.tagLine.toLowerCase().includes(search.toLowerCase())))
    : leaderboard || [];

  return (
    <Layout>
      {/* Header Banner */}
      <HeaderBanner />
      
      {/* Stats Carousel */}
      <StatsCarousel />
      <div className="mt-8">
        {/* Banner with background like homepage */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-eclipse-shadow to-void-core opacity-90 z-0 rounded-xl"></div>
          <div className="absolute inset-0 bg-[url('/assets/bg.jpg')] bg-cover bg-center opacity-20 z-0 rounded-xl"></div>
          <div className="absolute inset-0 rounded-xl border border-solar-flare/30 z-10"></div>
          
          <div className="relative z-20 px-6 py-8 flex flex-col items-center text-center">
            <h1 className="text-3xl md:text-3xl mb-2 text-gold-light font-bold">
              <span className="text-solar-flare">TFT</span> Leaderboard
            </h1>
            <p className="text-corona/50 max-w-lg mx-auto">
              Discover the top ranked players across all regions and see who's dominating the meta.
            </p>
          </div>
        </div>
        
        {/* Main content with glass styling */}
        <motion.div 
          className="backdrop-filter backdrop-blur-md bg-eclipse-shadow/20 border border-solar-flare/30 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-6">
            <RegionFilter 
              regions={regions} 
              activeRegion={activeRegion} 
              onChange={setActiveRegion} 
            />
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <div className="relative w-full md:w-64">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="text-corona-light/50 h-4 w-4" />
              </div>
              <input
                type="text"
                placeholder="Search players..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-brown-light/10 backdrop-filter backdrop-blur-sm border border-solar-flare/20 rounded-md text-sm focus:outline-none focus:border-solar-flare/60 text-corona-light"
              />
            </div>
            
            <motion.button 
              className="flex items-center gap-1 text-corona-light/70 hover:text-gold text-sm px-3 py-1 rounded-md hover:bg-brown-light/10 border border-solar-flare/20"
              onClick={() => refetch()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </motion.button>
          </div>
          
          {isError ? (
            <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <div className="text-red-400 mb-2">Error loading leaderboard</div>
              <p className="text-corona-light/80">{(error instanceof Error) ? error.message : 'Failed to load leaderboard'}</p>
              <button 
                onClick={() => refetch()} 
                className="mt-2 px-3 py-1 bg-solar-flare/70 hover:bg-solar-flare text-void-core rounded-md flex items-center gap-1 text-sm"
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <TopPlayers 
              players={filteredPlayers} 
              isLoading={isLoading} 
            />
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
