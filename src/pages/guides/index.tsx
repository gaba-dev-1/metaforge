import React, { useState } from 'react';
import { Layout, Card } from '@/components/ui';
import { FeatureBanner, HeaderBanner } from '@/components/common';
import { BookOpen, Info, Star, ShoppingBag, Layers, Users, Activity, Shield } from 'lucide-react';
import guidesData from '../../mapping/guides.json';

export default function GuidesPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <Layout>
      <HeaderBanner />
      
      <div className="mt-8">
        <FeatureBanner title="TFT Game Mechanics Guide" />
        
        <Card className="mt-4 p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6">
            <div className="text-xl font-bold text-gold">
              Complete Guide to Teamfight Tactics
            </div>
            <div className="mt-2 lg:mt-0 flex items-center bg-brown-light/30 px-3 py-1.5 rounded-lg border border-gold/20">
              <BookOpen size={16} className="text-gold mr-2" />
              <span className="text-sm">Learning Resources</span>
            </div>
          </div>

          {/* Introduction */}
          <div className="mb-8 bg-brown-light/20 rounded-lg p-4">
            <p className="text-cream">
              This guide provides comprehensive information about the core mechanics in Teamfight Tactics. 
              Whether you're a beginner or looking to refine your knowledge, use this resource to understand 
              the fundamental systems that drive gameplay.
            </p>
          </div>

          {/* Champion Tiers */}
          <GuideSection
            icon={<Info size={20} />}
            title="Champion Tiers"
            isOpen={activeSection === 'champion_tiers'}
            toggleSection={() => toggleSection('champion_tiers')}
          >
            <div className="space-y-4">
              <p>{guidesData.champion_tiers.description}</p>
              
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gold mb-2">Pool Size per Champion</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-brown-light/40">
                        <th className="border border-gold/20 px-4 py-2 text-left">Champion Tier</th>
                        <th className="border border-gold/20 px-4 py-2 text-left">Pool Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(guidesData.champion_tiers.pool_size_per_champion).map(([tier, size]) => (
                        <tr key={tier} className="even:bg-brown-light/20">
                          <td className="border border-gold/20 px-4 py-2">{tier}★ Cost</td>
                          <td className="border border-gold/20 px-4 py-2">{size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-medium text-gold mb-2">Champion Drop Rates</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-brown-light/40">
                        <th className="border border-gold/20 px-4 py-2 text-left">Level</th>
                        {guidesData.champion_tiers.tiers.map(tier => (
                          <th key={tier} className="border border-gold/20 px-4 py-2 text-center">Tier {tier}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(guidesData.champion_tiers.drop_rates).map(([level, rates]) => (
                        <tr key={level} className="even:bg-brown-light/20">
                          <td className="border border-gold/20 px-4 py-2">{level.replace('level_', '')}</td>
                          {guidesData.champion_tiers.tiers.map(tier => (
                            <td key={tier} className="border border-gold/20 px-4 py-2 text-center">
                              {rates[tier as unknown as keyof typeof rates]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </GuideSection>

          {/* Champion Star Levels */}
          <GuideSection
            icon={<Star size={20} />}
            title="Champion Star Levels"
            isOpen={activeSection === 'champion_star_levels'}
            toggleSection={() => toggleSection('champion_star_levels')}
          >
            <div className="space-y-4">
              <p>{guidesData.champion_star_levels.description}</p>
              <p>{guidesData.champion_star_levels.combination_rules}</p>
              
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gold mb-2">Stat Scaling</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-brown-light/20 rounded-lg p-4">
                    <h4 className="font-medium text-gold-light mb-2">Attack Damage</h4>
                    <div className="space-y-2">
                      {Object.entries(guidesData.champion_star_levels.stat_scaling.attack_damage).map(([level, scaling]) => (
                        <div key={level} className="flex justify-between">
                          <span>{level.replace('_', ' ')}</span>
                          <span className="text-gold">{scaling}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-brown-light/20 rounded-lg p-4">
                    <h4 className="font-medium text-gold-light mb-2">Health</h4>
                    <div className="space-y-2">
                      {Object.entries(guidesData.champion_star_levels.stat_scaling.health).map(([level, scaling]) => (
                        <div key={level} className="flex justify-between">
                          <span>{level.replace('_', ' ')}</span>
                          <span className="text-gold">{scaling}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-sm italic">
                  {guidesData.champion_star_levels.stat_scaling.ability}
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-medium text-gold mb-2">Champion Upgrade Costs</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-brown-light/40">
                        <th className="border border-gold/20 px-4 py-2 text-left">Tier</th>
                        <th className="border border-gold/20 px-4 py-2 text-center">1★ Cost</th>
                        <th className="border border-gold/20 px-4 py-2 text-center">2★ Cost</th>
                        <th className="border border-gold/20 px-4 py-2 text-center">3★ Cost</th>
                        <th className="border border-gold/20 px-4 py-2 text-center">4★ Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(guidesData.champion_star_levels.costs).map(([tier, costs]) => (
                        <tr key={tier} className="even:bg-brown-light/20">
                          <td className="border border-gold/20 px-4 py-2">{tier.replace('tier_', '')}</td>
                          <td className="border border-gold/20 px-4 py-2 text-center">{costs['1_star']} 🪙</td>
                          <td className="border border-gold/20 px-4 py-2 text-center">{costs['2_star']} 🪙</td>
                          <td className="border border-gold/20 px-4 py-2 text-center">{costs['3_star']} 🪙</td>
                          <td className="border border-gold/20 px-4 py-2 text-center">{costs['4_star']} 🪙</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="mt-2 bg-brown-light/20 rounded-lg p-4">
                <h4 className="font-medium text-gold-light mb-2">Selling Champions</h4>
                <p>{guidesData.champion_star_levels.selling}</p>
              </div>
            </div>
          </GuideSection>

          {/* Champion Store */}
          <GuideSection
            icon={<ShoppingBag size={20} />}
            title="Champion Store"
            isOpen={activeSection === 'champion_store'}
            toggleSection={() => toggleSection('champion_store')}
          >
            <div className="space-y-4">
              <p>{guidesData.champion_store.description}</p>
              
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gold mb-2">Store Mechanics</h3>
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <ul className="space-y-2">
                    {guidesData.champion_store.mechanics.map((mechanic, index) => (
                      <li key={index} className="flex items-start">
                        <div className="w-2 h-2 rounded-full bg-gold mt-1.5 mr-2"></div>
                        <div>{mechanic}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div className="mt-2 bg-brown-light/20 rounded-lg p-4">
                <h4 className="font-medium text-gold-light mb-2">Special Mechanics</h4>
                <p>{guidesData.champion_store.special_mechanics}</p>
              </div>
            </div>
          </GuideSection>

          {/* Champion Items */}
          <GuideSection
            icon={<Layers size={20} />}
            title="Champion Items"
            isOpen={activeSection === 'champion_items'}
            toggleSection={() => toggleSection('champion_items')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-brown-light/20 rounded-lg p-4">
                <h4 className="font-medium text-gold-light mb-2">Inventory</h4>
                <p>{guidesData.champion_items.inventory}</p>
              </div>
              
              <div className="bg-brown-light/20 rounded-lg p-4">
                <h4 className="font-medium text-gold-light mb-2">Combination</h4>
                <p>{guidesData.champion_items.combination}</p>
              </div>
              
              <div className="bg-brown-light/20 rounded-lg p-4">
                <h4 className="font-medium text-gold-light mb-2">Selling</h4>
                <p>{guidesData.champion_items.selling}</p>
              </div>
              
              <div className="bg-brown-light/20 rounded-lg p-4">
                <h4 className="font-medium text-gold-light mb-2">Source</h4>
                <p>{guidesData.champion_items.source}</p>
              </div>
            </div>
          </GuideSection>

          {/* Champion Traits */}
          <GuideSection
            icon={<Users size={20} />}
            title="Champion Traits"
            isOpen={activeSection === 'champion_traits'}
            toggleSection={() => toggleSection('champion_traits')}
          >
            <div className="bg-brown-light/20 rounded-lg p-4">
              <p>{guidesData.champion_traits.description}</p>
            </div>
          </GuideSection>

          {/* Champion Roles */}
          <GuideSection
            icon={<Activity size={20} />}
            title="Champion Roles"
            isOpen={activeSection === 'champion_roles'}
            toggleSection={() => toggleSection('champion_roles')}
          >
            <div className="space-y-4">
              <p>{guidesData.champion_roles.description}</p>
              <p>{guidesData.champion_roles.purpose}</p>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(guidesData.champion_roles.types).map(([role, description]) => (
                  <div key={role} className="bg-brown-light/20 rounded-lg p-4">
                    <h4 className="font-medium text-gold-light mb-2">{formatRoleName(role)}</h4>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
              
              <div className="mt-2 bg-brown-light/30 rounded-lg p-4">
                <p>{guidesData.champion_roles.info}</p>
              </div>
            </div>
          </GuideSection>

          {/* Champion Statistics */}
          <GuideSection
            icon={<Activity size={20} />}
            title="Champion Statistics"
            isOpen={activeSection === 'champion_statistics'}
            toggleSection={() => toggleSection('champion_statistics')}
          >
            <div className="space-y-6">
              {Object.entries(guidesData.champion_statistics).map(([stat, info]) => {
                // Handle special case for attack_range with nested structure
                if (stat === "attack_range") {
                  return (
                    <div key={stat}>
                      <h3 className="text-lg font-medium text-gold mb-2">{formatStatName(stat)}</h3>
                      <div className="bg-brown-light/20 rounded-lg p-4">
                        <p className="mb-2">{(info as any).description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          <div className="bg-brown-light/30 rounded p-3">
                            <h4 className="text-sm font-medium text-gold-light mb-1">Melee</h4>
                            <p className="text-sm">{(info as any).melee}</p>
                          </div>
                          <div className="bg-brown-light/30 rounded p-3">
                            <h4 className="text-sm font-medium text-gold-light mb-1">Ranged</h4>
                            <p className="text-sm">{(info as any).ranged}</p>
                          </div>
                          <div className="bg-brown-light/30 rounded p-3">
                            <h4 className="text-sm font-medium text-gold-light mb-1">Abilities</h4>
                            <p className="text-sm">{(info as any).abilities}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Handle basic_attack with nested structure
                else if (stat === "basic_attack") {
                  return (
                    <div key={stat}>
                      <h3 className="text-lg font-medium text-gold mb-2">{formatStatName(stat)}</h3>
                      <div className="bg-brown-light/20 rounded-lg p-4">
                        <p className="mb-2">{(info as any).description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          {Object.entries((info as any)).map(([key, value]) => {
                            if (key !== "description") {
                              return (
                                <div key={key} className="bg-brown-light/30 rounded p-3">
                                  <h4 className="text-sm font-medium text-gold-light mb-1">{formatStatName(key)}</h4>
                                  <p className="text-sm">{value as string}</p>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Handle ability with nested structure
                else if (stat === "ability") {
                  return (
                    <div key={stat}>
                      <h3 className="text-lg font-medium text-gold mb-2">{formatStatName(stat)}</h3>
                      <div className="bg-brown-light/20 rounded-lg p-4">
                        <p className="mb-2">{(info as any).description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          {Object.entries((info as any)).map(([key, value]) => {
                            if (key !== "description" && key !== "damage_types") {
                              return (
                                <div key={key} className="bg-brown-light/30 rounded p-3">
                                  <h4 className="text-sm font-medium text-gold-light mb-1">{formatStatName(key)}</h4>
                                  <p className="text-sm">{value as string}</p>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                        <div className="mt-4 bg-brown-light/30 rounded p-3">
                          <h4 className="text-sm font-medium text-gold-light mb-1">Damage Types</h4>
                          <p className="text-sm">{(info as any).damage_types}</p>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Handle movement_speed with nested structure
                else if (stat === "movement_speed") {
                  return (
                    <div key={stat}>
                      <h3 className="text-lg font-medium text-gold mb-2">{formatStatName(stat)}</h3>
                      <div className="bg-brown-light/20 rounded-lg p-4">
                        <p className="mb-2">{(info as any).description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          {Object.entries((info as any)).map(([key, value]) => {
                            if (key !== "description") {
                              return (
                                <div key={key} className="bg-brown-light/30 rounded p-3">
                                  <h4 className="text-sm font-medium text-gold-light mb-1">{formatStatName(key)}</h4>
                                  <p className="text-sm">{value as string}</p>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Handle simple stats
                else {
                  return (
                    <div key={stat}>
                      <h3 className="text-lg font-medium text-gold mb-2">{formatStatName(stat)}</h3>
                      <div className="bg-brown-light/20 rounded-lg p-4">
                        <p>{info as string}</p>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </GuideSection>

          {/* Game Mechanics */}
          <GuideSection
            icon={<Shield size={20} />}
            title="Game Mechanics"
            isOpen={activeSection === 'game_mechanics'}
            toggleSection={() => toggleSection('game_mechanics')}
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <h4 className="font-medium text-gold-light mb-2">True Damage</h4>
                  <p>{guidesData.game_mechanics.true_damage}</p>
                </div>
                
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <h4 className="font-medium text-gold-light mb-2">Dodge</h4>
                  <p>{guidesData.game_mechanics.dodge}</p>
                </div>
                
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <h4 className="font-medium text-gold-light mb-2">Stealth</h4>
                  <p>{guidesData.game_mechanics.stealth}</p>
                </div>
                
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <h4 className="font-medium text-gold-light mb-2">Burn</h4>
                  <p>{guidesData.game_mechanics.burn}</p>
                </div>
                
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <h4 className="font-medium text-gold-light mb-2">Wound</h4>
                  <p>{guidesData.game_mechanics.wound}</p>
                </div>
                
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <h4 className="font-medium text-gold-light mb-2">Chill</h4>
                  <p>{guidesData.game_mechanics.chill}</p>
                </div>
                
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <h4 className="font-medium text-gold-light mb-2">Item Disable</h4>
                  <p>{guidesData.game_mechanics.item_disable}</p>
                </div>
                
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <h4 className="font-medium text-gold-light mb-2">Shred</h4>
                  <p>{guidesData.game_mechanics.shred}</p>
                </div>
                
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <h4 className="font-medium text-gold-light mb-2">Sunder</h4>
                  <p>{guidesData.game_mechanics.sunder}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gold mb-2">Crowd Control</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(guidesData.game_mechanics.crowd_control).map(([cc, description]) => (
                    <div key={cc} className="bg-brown-light/20 rounded-lg p-4">
                      <h4 className="font-medium text-gold-light mb-2">{formatCCName(cc)}</h4>
                      <p className="text-sm">{description}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-brown-light/20 rounded-lg p-4">
                <h4 className="font-medium text-gold-light mb-2">Bench</h4>
                <p>{guidesData.game_mechanics.bench}</p>
              </div>
            </div>
          </GuideSection>
        </Card>
      </div>
    </Layout>
  );
}

// Helper Components
interface GuideSectionProps {
  icon: React.ReactNode;
  title: string;
  isOpen: boolean;
  toggleSection: () => void;
  children: React.ReactNode;
}

function GuideSection({ icon, title, isOpen, toggleSection, children }: GuideSectionProps) {
  return (
    <div className="mb-6 border-b border-gold/30 pb-6">
      <div 
        className="flex justify-between items-center mb-4 cursor-pointer"
        onClick={toggleSection}
      >
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-brown-light/40 flex items-center justify-center mr-3">
            <div className="text-gold">
              {icon}
            </div>
          </div>
          <h2 className="text-xl font-bold text-gold">{title}</h2>
        </div>
        <button className="text-gold transition-transform">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 transform transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  );
}

// Formatting Helpers
function formatStatName(stat: string): string {
  return stat
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}

function formatRoleName(role: string): string {
  return role
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatCCName(cc: string): string {
  return cc
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}
