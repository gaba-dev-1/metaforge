import React, { useState, useEffect } from 'react';
import { Layout, Card } from '@/components/ui';
import { FeatureBanner, HeaderBanner } from '@/components/common';
import { Calendar, Tag, Clock, FileBarChart } from 'lucide-react';
import newsData from '../../mapping/news.json';

export default function NewsPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <Layout>
      <HeaderBanner />
      
      <div className="mt-8">
        <FeatureBanner title={`Patch Notes: ${newsData.patch} ${newsData.name}`} />
        
        <Card className="mt-4 p-6">
          {/* Header Information */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 border-b border-gold/30 pb-4">
            <div className="flex items-center mb-4 lg:mb-0">
              <div className="text-2xl font-bold text-gold">
                Set {newsData.set}: {newsData.name}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="bg-brown-light/30 px-3 py-1.5 rounded-lg border border-gold/20 flex items-center">
                <Tag size={16} className="text-gold mr-2" />
                <span className="text-sm">Patch {newsData.patch}</span>
              </div>
              <div className="bg-brown-light/30 px-3 py-1.5 rounded-lg border border-gold/20 flex items-center">
                <Calendar size={16} className="text-gold mr-2" />
                <span className="text-sm">{newsData.release_date}</span>
              </div>
            </div>
          </div>

          {/* UI Updates */}
          <PatchSection 
            title="UI Updates" 
            isOpen={activeSection === 'ui_updates'} 
            toggleSection={() => toggleSection('ui_updates')}
          >
            {/* Team Planner Upgrades */}
            {newsData.ui_updates.team_planner_upgrades && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gold mb-2">Team Planner Upgrades</h3>
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <ul className="space-y-2">
                    {Object.entries(newsData.ui_updates.team_planner_upgrades).map(([key, value]) => (
                      <li key={key} className="flex items-start">
                        <div className="w-2 h-2 rounded-full bg-gold mt-1.5 mr-2"></div>
                        <div>
                          <span className="font-medium">{key.replace(/_/g, ' ')}</span>: {value}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Double Up */}
            {newsData.ui_updates.double_up && (
              <div>
                <h3 className="text-lg font-medium text-gold mb-2">Double Up</h3>
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <div className="mb-4">
                    <span className="font-medium">Status</span>: {newsData.ui_updates.double_up.status}
                  </div>
                  
                  <div className="mb-4">
                    <div className="font-medium mb-2">Features:</div>
                    <ul className="space-y-2 ml-4">
                      {newsData.ui_updates.double_up.features.map((feature, index) => (
                        <li key={index} className="flex items-start">
                          <div className="w-2 h-2 rounded-full bg-gold mt-1.5 mr-2"></div>
                          <div>{feature}</div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Teamwork Cannon */}
                  {newsData.ui_updates.double_up.teamwork_cannon && (
                    <div className="mb-4">
                      <h4 className="text-base font-medium text-gold-light mb-2">Teamwork Cannon</h4>
                      <div className="bg-brown-light/30 rounded p-3">
                        <div className="mb-2">
                          <span className="text-sm font-medium">Replaces</span>: {newsData.ui_updates.double_up.teamwork_cannon.replaces}
                        </div>
                        <div className="mb-2">
                          <div className="text-sm font-medium mb-1">Item Trading:</div>
                          <div className="text-sm">{newsData.ui_updates.double_up.teamwork_cannon.item_trading}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium mb-1">Unit Trading:</div>
                          <div className="text-sm">{newsData.ui_updates.double_up.teamwork_cannon.unit_trading}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Gift Armory */}
                  {newsData.ui_updates.double_up.gift_armory && (
                    <div className="mb-4">
                      <h4 className="text-base font-medium text-gold-light mb-2">Gift Armory</h4>
                      <div className="bg-brown-light/30 rounded p-3">
                        <ul className="space-y-1">
                          {newsData.ui_updates.double_up.gift_armory.changes.map((change, index) => (
                            <li key={index} className="flex items-start">
                              <div className="w-2 h-2 rounded-full bg-gold mt-1 mr-2"></div>
                              <div className="text-sm">{change}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Additional Double Up Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {newsData.ui_updates.double_up.pve_rounds && (
                      <div className="bg-brown-light/30 rounded p-3">
                        <div className="text-sm font-medium mb-1">PVE Rounds:</div>
                        <div className="text-sm">{newsData.ui_updates.double_up.pve_rounds}</div>
                      </div>
                    )}
                    
                    {newsData.ui_updates.double_up.reinforcement && (
                      <div className="bg-brown-light/30 rounded p-3">
                        <div className="text-sm font-medium mb-1">Reinforcement:</div>
                        <div className="text-sm">{newsData.ui_updates.double_up.reinforcement}</div>
                      </div>
                    )}
                  </div>

                  {/* Disabled Augments */}
                  {newsData.ui_updates.double_up.disabled_augments && (
                    <div className="mt-4">
                      <h4 className="text-base font-medium text-gold-light mb-2">Disabled Augments</h4>
                      <div className="bg-brown-light/30 rounded p-3">
                        <div className="flex flex-wrap gap-2">
                          {newsData.ui_updates.double_up.disabled_augments.map((augment, index) => (
                            <span key={index} className="bg-brown-light/50 px-2 py-1 rounded text-xs">
                              {augment}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </PatchSection>

          {/* Set Mechanic */}
          <PatchSection 
            title="Set Mechanic" 
            isOpen={activeSection === 'set_mechanic'} 
            toggleSection={() => toggleSection('set_mechanic')}
          >
            <div className="bg-brown-light/20 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gold mb-2">Hacks</h3>
              <div className="mb-4">
                <div className="text-sm mb-2">{newsData.set_mechanic.hacks.description}</div>
                <div className="text-sm font-medium mt-2">Frequency:</div>
                <div className="text-sm">{newsData.set_mechanic.hacks.frequency}</div>
              </div>
            </div>
          </PatchSection>

          {/* Class Emblem Upgrades */}
          <PatchSection 
            title="Class Emblem Upgrades" 
            isOpen={activeSection === 'class_emblem_upgrades'} 
            toggleSection={() => toggleSection('class_emblem_upgrades')}
          >
            <div className="bg-brown-light/20 rounded-lg p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(newsData.class_emblem_upgrades).map(([emblem, effect]) => (
                  <div key={emblem} className="bg-brown-light/30 rounded p-3">
                    <div className="font-medium text-gold-light mb-1">{formatEmblemName(emblem)}</div>
                    <div className="text-sm">{effect}</div>
                  </div>
                ))}
              </div>
            </div>
          </PatchSection>

          {/* Opening Encounters */}
          <PatchSection 
            title="Opening Encounters" 
            isOpen={activeSection === 'opening_encounters'} 
            toggleSection={() => toggleSection('opening_encounters')}
          >
            <div className="bg-brown-light/20 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {newsData.opening_encounters.map((encounter, index) => (
                  <div key={index} className="bg-brown-light/30 rounded p-3 flex items-start">
                    <div className="mr-3 font-medium text-gold-light min-w-16">{encounter.character}</div>
                    <div className="flex-1">
                      <div className="text-sm mb-1">{encounter.effect}</div>
                      <div className="text-xs text-cream/70">Chance: {encounter.chance}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PatchSection>

          {/* Hacked Encounters */}
          <PatchSection 
            title="Hacked Encounters" 
            isOpen={activeSection === 'hacked_encounters'} 
            toggleSection={() => toggleSection('hacked_encounters')}
          >
            <div className="bg-brown-light/20 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {newsData.hacked_encounters.map((encounter, index) => (
                  <div key={index} className="bg-brown-light/30 rounded p-3 flex items-start">
                    <div className="mr-3 font-medium text-gold-light min-w-24">{encounter.type}</div>
                    <div className="flex-1">
                      <div className="text-sm mb-1">{encounter.effect}</div>
                      <div className="text-xs text-cream/70">Chance: {encounter.chance}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PatchSection>

          {/* Augment Changes */}
          <PatchSection 
            title="Augment Changes" 
            isOpen={activeSection === 'augment_changes'} 
            toggleSection={() => toggleSection('augment_changes')}
          >
            <div className="space-y-6">
              {/* Removed Augments */}
              <div>
                <h3 className="text-lg font-medium text-gold mb-2">Removed Augments</h3>
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {newsData.augment_changes.removed_augments.map((augment, index) => (
                      <span key={index} className="bg-brown-light/40 px-2 py-1 rounded text-xs">
                        {augment}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Returning Augments */}
              <div>
                <h3 className="text-lg font-medium text-gold mb-2">Returning Augments</h3>
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {newsData.augment_changes.returning_augments.map((augment, index) => (
                      <span key={index} className="bg-brown-light/40 px-2 py-1 rounded text-xs">
                        {augment}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Adjusted Silver Augments */}
              <AugmentChangesSection 
                title="Adjusted Silver Augments" 
                changes={newsData.augment_changes.adjusted_silver} 
              />

              {/* Adjusted Gold Augments */}
              <AugmentChangesSection 
                title="Adjusted Gold Augments" 
                changes={newsData.augment_changes.adjusted_gold} 
              />

              {/* Adjusted Prismatic Augments */}
              <AugmentChangesSection 
                title="Adjusted Prismatic Augments" 
                changes={newsData.augment_changes.adjusted_prismatic} 
              />

              {/* Trait Emblem Augments */}
              <div>
                <h3 className="text-lg font-medium text-gold mb-2">Trait Emblem Augments</h3>
                <div className="bg-brown-light/20 rounded-lg p-4">
                  <div className="space-y-4">
                    {Object.entries(newsData.augment_changes.trait_emblem_augments).map(([type, description]) => (
                      <div key={type} className="bg-brown-light/30 rounded p-3">
                        <div className="font-medium text-gold-light mb-1">{formatEmblemName(type)}</div>
                        <div className="text-sm">{description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </PatchSection>

          {/* Item Changes */}
          <PatchSection 
            title="Item Changes" 
            isOpen={activeSection === 'item_changes'} 
            toggleSection={() => toggleSection('item_changes')}
          >
            <div className="bg-brown-light/20 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(newsData.item_changes).map(([item, changes]) => (
                  <div key={item} className="bg-brown-light/30 rounded p-3">
                    <div className="font-medium text-gold-light mb-2">{formatItemName(item)}</div>
                    <div className="space-y-1">
                      {Object.entries(changes).map(([stat, value]) => (
                        <div key={stat} className="text-sm flex">
                          <div className="min-w-32 font-medium">{formatStatName(stat)}:</div>
                          <div>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PatchSection>

          {/* Bug Fixes */}
          {newsData.bug_fixes && (
            <PatchSection 
              title="Bug Fixes" 
              isOpen={activeSection === 'bug_fixes'} 
              toggleSection={() => toggleSection('bug_fixes')}
            >
              <div className="bg-brown-light/20 rounded-lg p-4">
                <ul className="space-y-2">
                  {Object.entries(newsData.bug_fixes).map(([bug, fix]) => (
                    <li key={bug} className="flex items-start">
                      <div className="w-2 h-2 rounded-full bg-gold mt-1.5 mr-2"></div>
                      <div>
                        <span className="font-medium">{formatBugName(bug)}</span>: {fix}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </PatchSection>
          )}
        </Card>
      </div>
    </Layout>
  );
}

// Helper Components
interface PatchSectionProps {
  title: string;
  isOpen: boolean;
  toggleSection: () => void;
  children: React.ReactNode;
}

function PatchSection({ title, isOpen, toggleSection, children }: PatchSectionProps) {
  return (
    <div className="mb-6 border-b border-gold/30 pb-6">
      <div 
        className="flex justify-between items-center mb-4 cursor-pointer"
        onClick={toggleSection}
      >
        <h2 className="text-xl font-bold text-gold">{title}</h2>
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

interface AugmentChangesSectionProps {
  title: string;
  changes: Record<string, string | string[]>;
}

function AugmentChangesSection({ title, changes }: AugmentChangesSectionProps) {
  return (
    <div>
      <h3 className="text-lg font-medium text-gold mb-2">{title}</h3>
      <div className="bg-brown-light/20 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(changes).map(([augment, change]) => (
            <div key={augment} className="bg-brown-light/30 rounded p-3">
              <div className="font-medium text-gold-light mb-1">{formatAugmentName(augment)}</div>
              {Array.isArray(change) ? (
                <ul className="space-y-1 text-sm">
                  {change.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 mr-1.5"></div>
                      <div>{item}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm">{change}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Formatting Helpers
function formatEmblemName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/emblem/i, '')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

function formatItemName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatStatName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}

function formatAugmentName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .replace(/ i+$/, (match) => match.toUpperCase());
}

function formatBugName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}
