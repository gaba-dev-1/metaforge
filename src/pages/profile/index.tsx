import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import Layout from '@/components/ui/Layout';
import { Clock, Trophy, Settings, RefreshCw, User } from 'lucide-react';
import { useAuth } from '@/utils/auth/AuthContext';
import { PlayerStats as PlayerStatsType, MatchHistoryEntry } from '@/types/auth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { motion } from 'framer-motion';
import LoginButton from '@/components/auth/LoginButton';

// User Profile Component
const RiotUserProfile = ({ user, isLoading }: { user: any; isLoading: boolean }) => {
  if (isLoading) {
    return (
      <div className="flex items-center space-x-4 animate-pulse">
        <div className="w-24 h-24 bg-brown-light/30 rounded-full"></div>
        <div className="flex-1">
          <div className="h-5 bg-brown-light/30 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-brown-light/30 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-corona-light">
        User data not available
      </div>
    );
  }

  return (
    <motion.div 
      className="flex flex-col md:flex-row items-center md:items-start gap-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Profile Icon */}
      <div className="flex-shrink-0">
        <div className="relative">
          <img 
            src={user.profileIconId ? `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/${user.profileIconId}.png` : '/assets/app.png'} 
            alt="Profile Icon" 
            className="w-24 h-24 rounded-full border-2 border-solar-flare/50 object-cover bg-brown-dark/50"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/assets/app.png';
            }}
          />
          {user.summonerLevel && (
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gold/90 text-brown-dark text-xs font-semibold px-2 py-0.5 rounded-full border border-brown-light">
              {user.summonerLevel}
            </div>
          )}
        </div>
      </div>
      
      {/* User Info */}
      <div className="flex flex-col text-center md:text-left">
        <h1 className="text-2xl md:text-3xl font-display text-gold flex flex-wrap items-center gap-2 justify-center md:justify-start">
          {user.gameName}
          <span className="text-sm md:text-base text-corona-light/70 font-normal">#{user.tagLine}</span>
        </h1>
        
        <div className="flex flex-wrap gap-2 mt-2 justify-center md:justify-start">
          {user.region && (
            <div className="bg-brown-light/30 px-2 py-1 rounded-md text-xs text-corona-light/90">
              Region: {user.region}
            </div>
          )}
          {user.puuid && (
            <div className="bg-brown-light/30 px-2 py-1 rounded-md text-xs text-corona-light/90 max-w-xs overflow-hidden text-ellipsis">
              PUUID: {user.puuid.substring(0, 8)}...
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Player Stats Component
const PlayerStats = ({ stats, isLoading }: { stats: PlayerStatsType | null; isLoading: boolean }) => {
  if (isLoading) {
    return (
      <div className="border border-solar-flare/30 rounded-lg p-4 bg-brown/20 animate-pulse backdrop-filter backdrop-blur-md">
        <div className="h-5 bg-brown-light/30 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-brown-light/30 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="border border-solar-flare/30 rounded-lg p-4 backdrop-filter backdrop-blur-md bg-brown/10">
        <p className="text-corona-light/70 text-center">No ranked stats available</p>
      </div>
    );
  }

  // Determine rank color
  const getRankColor = (tier: string) => {
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

  const rankColor = getRankColor(stats.tier);

  return (
    <div className="border border-solar-flare/30 rounded-lg p-4 backdrop-filter backdrop-blur-md bg-brown/10">
      <div className="flex flex-col md:flex-row items-center md:items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <h3 className={`text-xl font-semibold ${rankColor}`}>
            {stats.tier} {stats.rank}
          </h3>
          <div className="bg-brown-light/30 px-2 py-1 rounded text-corona-light/90">
            {stats.leaguePoints} LP
          </div>
        </div>
        
        {stats.hotStreak && (
          <div className="bg-gold/20 px-3 py-1 rounded-md text-gold text-sm flex items-center">
            <span className="mr-1">Hot Streak</span>
            <span className="text-lg">🔥</span>
          </div>
        )}
      </div>
      
      <motion.div 
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
      >
        <motion.div 
          className="backdrop-filter backdrop-blur-sm bg-brown-light/20 p-3 rounded-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-sm text-corona-light/80">Win Rate</div>
          <div className="text-lg font-medium text-solar-flare">{stats.winRate.toFixed(1)}%</div>
        </motion.div>
        
        <motion.div 
          className="backdrop-filter backdrop-blur-sm bg-brown-light/20 p-3 rounded-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="text-sm text-corona-light/80">Wins</div>
          <div className="text-lg font-medium text-emerald-400">{stats.wins}</div>
        </motion.div>
        
        <motion.div 
          className="backdrop-filter backdrop-blur-sm bg-brown-light/20 p-3 rounded-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-sm text-corona-light/80">Losses</div>
          <div className="text-lg font-medium text-amber-400">{stats.losses}</div>
        </motion.div>
        
        <motion.div 
          className="backdrop-filter backdrop-blur-sm bg-brown-light/20 p-3 rounded-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="text-sm text-corona-light/80">Games</div>
          <div className="text-lg font-medium text-corona-light">{stats.wins + stats.losses}</div>
        </motion.div>
      </motion.div>
      
      {stats.miniSeries && (
        <div className="mt-4 border-t border-solar-flare/20 pt-4">
          <div className="text-sm text-corona-light/80 mb-2">Promotion Series</div>
          <div className="flex gap-2 justify-center">
            {stats.miniSeries.progress.split('').map((result, index) => {
              let bgColor = "bg-brown-light/30";
              let textColor = "text-corona-light";
              
              if (result === 'W') {
                bgColor = "bg-green-800/50";
                textColor = "text-green-300";
              } else if (result === 'L') {
                bgColor = "bg-red-900/50";
                textColor = "text-red-300";
              }
              
              return (
                <div 
                  key={index} 
                  className={`${bgColor} ${textColor} w-8 h-8 flex items-center justify-center rounded-md`}
                >
                  {result === 'W' ? 'W' : result === 'L' ? 'L' : '−'}
                </div>
              );
            })}
          </div>
          <div className="text-xs text-corona-light/60 text-center mt-2">
            {stats.miniSeries.wins} wins / {stats.miniSeries.losses} losses
          </div>
        </div>
      )}
    </div>
  );
};

// Match History Component
const MatchHistory = ({ matches, isLoading }: { matches: MatchHistoryEntry[]; isLoading: boolean }) => {
  if (isLoading) {
    return (
      <div className="flex flex-col space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border border-solar-flare/30 rounded-lg p-4 backdrop-filter backdrop-blur-md bg-brown/20 animate-pulse">
            <div className="h-5 bg-brown-light/30 rounded w-1/4 mb-2"></div>
            <div className="h-8 bg-brown-light/30 rounded w-3/4 mb-2"></div>
            <div className="h-5 bg-brown-light/30 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="text-center py-8 border border-solar-flare/20 rounded-lg p-6 backdrop-filter backdrop-blur-md bg-brown/10">
        <p className="text-corona-light/70">No match history available</p>
        <p className="text-corona-light/50 text-sm mt-2">Play some games to see your match history here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {matches.map((match, index) => (
        <motion.div 
          key={match.matchId}
          className={`border ${match.placement === 1 ? 'border-gold/50' : match.placement <= 4 ? 'border-solar-flare/30' : 'border-brown-light/30'} 
                      rounded-lg p-4 backdrop-filter backdrop-blur-sm bg-brown/10 hover:bg-brown/20 transition-colors`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.4 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {/* Left side - Placement and Date */}
            <div className="flex items-center gap-4">
              <div className={`font-bold text-3xl ${
                match.placement === 1 ? "text-gold border-gold" : 
                match.placement <= 4 ? "text-corona-light border-corona-light" : 
                "text-corona-light/50 border-corona-light/50"
              } border-r pr-4`}>
                #{match.placement}
              </div>
              
              <div className="flex flex-col">
                <span className="text-corona-light/80 text-sm">{new Date(match.gameCreation).toLocaleDateString()}</span>
                <span className="text-corona-light/60 text-xs">{Math.floor(match.gameDuration / 60)} min</span>
              </div>
            </div>
            
            {/* Middle - Game Details */}
            <div className="flex flex-wrap gap-2 mx-auto md:mx-0">
              {match.augments.slice(0, 3).map((augment, i) => (
                <div key={i} className="backdrop-filter backdrop-blur-sm bg-brown-light/30 p-1 rounded-md">
                  <span className="text-xs text-corona-light">{augment.replace('TFT7_Augment_', '').replace('TFT8_Augment_', '').replace('TFT9_Augment_', '')}</span>
                </div>
              ))}
            </div>
            
            {/* Right side - Traits & Units */}
            <div className="flex gap-3">
              <div className="flex flex-wrap gap-1 justify-end">
                {match.traits.filter(t => t.style >= 1).slice(0, 3).map((trait, i) => (
                  <div key={i} className="relative group">
                    <img 
                      src={`/assets/traits/${trait.name.toLowerCase()}_${
                        ['bronze', 'silver', 'gold', 'diamond'][trait.style - 1] || 'bronze'
                      }.png`}
                      alt={trait.name} 
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/assets/traits/default.png';
                      }}
                    />
                    <div className="absolute -top-1 -right-1 bg-solar-flare/80 text-xs rounded-full w-3 h-3 flex items-center justify-center">
                      {trait.numUnits}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-wrap gap-1 justify-end">
                {match.units.sort((a, b) => b.tier - a.tier).slice(0, 4).map((unit, i) => (
                  <div key={i} className="relative">
                    <div className="w-6 h-6 rounded-full border overflow-hidden"
                      style={{ borderColor: ['#9aa4af', '#2ecc71', '#3498db', '#9b59b6', '#f1c40f'][(unit.rarity || 0)] || '#9aa4af' }}>
                      <img 
                        src={`/assets/units/${unit.characterId.toLowerCase()}.png`} 
                        alt={unit.characterId} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/assets/units/default.png';
                        }}
                      />
                      
                      {/* Star level indicator */}
                      {unit.tier > 1 && (
                        <div className="absolute bottom-0 right-0 bg-solar-flare/90 rounded-full w-3 h-3 flex items-center justify-center text-[8px]">
                          {unit.tier}★
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// LoginCTA component to show when not authenticated
const LoginCTA = () => {
  return (
    <div className="mt-10">
      {/* Banner */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-eclipse-shadow to-void-core opacity-90 z-0 rounded-xl"></div>
        <div className="absolute inset-0 bg-[url('/assets/bg.jpg')] bg-cover bg-center opacity-20 z-0 rounded-xl"></div>
        <div className="absolute inset-0 rounded-xl border border-solar-flare/30 z-10"></div>
        
        <div className="relative z-20 px-6 py-8 flex flex-col items-center text-center">
          <User className="text-solar-flare h-12 w-12 mb-3" />
          <h1 className="text-3xl md:text-4xl font-display mb-2 text-white">
            <span className="text-solar-flare">Your</span> TFT Profile
          </h1>
          <p className="text-corona-light/90 max-w-lg mx-auto mb-6">
            Sign in with your Riot account to view your stats, match history, and climb the leaderboard.
          </p>
          
          <LoginButton 
            label="Sign in with Riot" 
            size="lg" 
            variant="primary"
          />
        </div>
      </div>
      
      {/* Preview section */}
      <motion.div 
        className="backdrop-filter backdrop-blur-md bg-eclipse-shadow/20 border border-solar-flare/30 rounded-xl p-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h2 className="text-2xl font-display text-solar-flare mb-4">Track Your TFT Journey</h2>
        <p className="text-corona-light/90 mb-6 max-w-xl mx-auto">
          Sign in to access your complete match history, view your ranked stats, and see how you compare to the best players in your region.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="backdrop-filter backdrop-blur-sm bg-brown-light/10 p-4 rounded-lg border border-solar-flare/20">
            <Trophy className="h-8 w-8 text-gold mx-auto mb-2" />
            <h3 className="text-lg text-corona-light">Track Your Progress</h3>
            <p className="text-sm text-corona-light/70">View your ranked stats and climb history</p>
          </div>
          
          <div className="backdrop-filter backdrop-blur-sm bg-brown-light/10 p-4 rounded-lg border border-solar-flare/20">
            <Clock className="h-8 w-8 text-gold mx-auto mb-2" />
            <h3 className="text-lg text-corona-light">Match History</h3>
            <p className="text-sm text-corona-light/70">Analyze your recent games and performances</p>
          </div>
          
          <div className="backdrop-filter backdrop-blur-sm bg-brown-light/10 p-4 rounded-lg border border-solar-flare/20">
            <Settings className="h-8 w-8 text-gold mx-auto mb-2" />
            <h3 className="text-lg text-corona-light">Detailed Analytics</h3>
            <p className="text-sm text-corona-light/70">Get insights on your playstyle and strengths</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// UserProfile component to show when authenticated
const UserProfile = () => {
  const { auth } = useAuth();
  const [activeTab, setActiveTab] = useState<'matches' | 'stats'>('matches');
  
  // Query player stats - hooks must be at the top level and unconditional
  const {
    data: playerStats,
    isLoading: isLoadingStats,
    isError: isErrorStats,
    error: statsError,
    refetch: refetchStats
  } = useQuery<PlayerStatsType>({
    queryKey: ['playerStats', auth.user?.summonerId],
    queryFn: async () => {
      if (!auth.user?.summonerId) {
        throw new Error('Summoner ID not found');
      }
      
      const response = await fetch(`/api/tft/player/stats?summonerId=${auth.user.summonerId}&region=${auth.user.region || 'na1'}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch player stats');
      }
      
      return response.json();
    },
    enabled: !!auth.user?.summonerId && auth.isAuthenticated,
    staleTime: 300000, // 5 minutes
    retry: 1
  });
  
  // Query match history - hooks must be at the top level and unconditional
  const {
    data: matchHistory,
    isLoading: isLoadingMatches,
    isError: isErrorMatches,
    error: matchesError,
    refetch: refetchMatches
  } = useQuery<MatchHistoryEntry[]>({
    queryKey: ['matchHistory', auth.user?.puuid],
    queryFn: async () => {
      if (!auth.user?.puuid) {
        throw new Error('PUUID not found');
      }
      
      const response = await fetch(`/api/tft/player/matches?puuid=${auth.user.puuid}&region=${auth.user.region || 'americas'}&count=10`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch match history');
      }
      
      return response.json();
    },
    enabled: !!auth.user?.puuid && auth.isAuthenticated,
    staleTime: 300000, // 5 minutes
    retry: 1
  });
  
  return (
    <div className="mt-8">
      {/* Banner */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-eclipse-shadow to-void-core opacity-90 z-0 rounded-xl"></div>
        <div className="absolute inset-0 bg-[url('/assets/bg.jpg')] bg-cover bg-center opacity-20 z-0 rounded-xl"></div>
        <div className="absolute inset-0 rounded-xl border border-solar-flare/30 z-10"></div>
        
        <div className="relative z-20 px-6 py-8 flex flex-col items-center text-center">
          <User className="text-solar-flare h-10 w-10 mb-2" />
          <h1 className="text-3xl md:text-4xl font-display mb-2 text-white">
            <span className="text-solar-flare">Your</span> TFT Profile
          </h1>
        </div>
      </div>
      
      {/* Profile Header */}
      <motion.div 
        className="backdrop-filter backdrop-blur-md bg-eclipse-shadow/30 border border-solar-flare/30 rounded-xl p-6 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <RiotUserProfile user={auth.user} isLoading={auth.isLoading} />
      </motion.div>
      
      {/* Stats Section */}
      <div className="mb-6">
        <PlayerStats 
          stats={playerStats || null} 
          isLoading={isLoadingStats} 
        />
        
        {isErrorStats && (
          <div className="mt-4 p-4 backdrop-filter backdrop-blur-md bg-red-900/20 border border-red-700/50 rounded-lg">
            <div className="text-red-400 mb-2">Error loading player stats</div>
            <p className="text-corona-light/80">{(statsError instanceof Error) ? statsError.message : 'Failed to load player stats'}</p>
            <button 
              onClick={() => refetchStats()} 
              className="mt-2 px-3 py-1 bg-solar-flare/70 hover:bg-solar-flare text-void-core rounded-md flex items-center gap-1 text-sm"
            >
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Tabs */}
      <div className="mt-6 border-b border-solar-flare/30">
        <div className="flex flex-wrap -mb-px">
          <button
            className={`mr-2 inline-block p-4 rounded-t-lg ${
              activeTab === 'matches'
                ? 'text-solar-flare border-b-2 border-solar-flare'
                : 'text-corona-light hover:text-solar-flare/70 hover:border-solar-flare/30 border-b-2 border-transparent'
            }`}
            onClick={() => setActiveTab('matches')}
          >
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              Match History
            </div>
          </button>
          <button
            className={`mr-2 inline-block p-4 rounded-t-lg ${
              activeTab === 'stats'
                ? 'text-solar-flare border-b-2 border-solar-flare'
                : 'text-corona-light hover:text-solar-flare/70 hover:border-solar-flare/30 border-b-2 border-transparent'
            }`}
            onClick={() => setActiveTab('stats')}
          >
            <div className="flex items-center">
              <Trophy className="mr-2 h-4 w-4" />
              Performance
            </div>
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'matches' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl text-corona-light font-display">Recent Matches</h2>
              <button 
                className="flex items-center text-corona-light/70 hover:text-gold text-sm gap-1 px-3 py-1 rounded-md hover:bg-brown-light/10 border border-solar-flare/20"
                onClick={() => refetchMatches()}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
            
            {isErrorMatches ? (
              <div className="p-4 backdrop-filter backdrop-blur-md bg-red-900/20 border border-red-700/50 rounded-lg">
                <div className="text-red-400 mb-2">Error loading match history</div>
                <p className="text-corona-light/80">{(matchesError instanceof Error) ? matchesError.message : 'Failed to load match history'}</p>
                <button 
                  onClick={() => refetchMatches()} 
                  className="mt-2 px-3 py-1 bg-solar-flare/70 hover:bg-solar-flare text-void-core rounded-md flex items-center gap-1 text-sm"
                >
                  <RefreshCw size={14} />
                  <span>Retry</span>
                </button>
              </div>
            ) : (
              <MatchHistory 
                matches={matchHistory || []} 
                isLoading={isLoadingMatches} 
              />
            )}
          </>
        )}
        
        {activeTab === 'stats' && (
          <div className="text-center py-8 border border-solar-flare/20 rounded-lg p-6 backdrop-filter backdrop-blur-md bg-brown/10">
            <Settings className="h-12 w-12 mx-auto text-corona-light/40 mb-2" />
            <p className="text-corona-light">
              Detailed statistics coming soon...
            </p>
            <p className="text-corona-light/70 text-sm mt-2">
              We're working on advanced analytics for your TFT performance. Check back soon!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function ProfilePage() {
  const { auth } = useAuth();
  const router = useRouter();
  
  // Main render with conditional content based on auth state
  return (
    <Layout>
      {!auth.isAuthenticated && !auth.isLoading ? (
        <LoginCTA />
      ) : (
        auth.isAuthenticated && <UserProfile />
      )}
    </Layout>
  );
}
