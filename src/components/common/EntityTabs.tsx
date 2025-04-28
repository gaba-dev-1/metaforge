import React, { useState } from 'react';
import { Filter, Search } from 'lucide-react';
import { FilterButtons } from '@/components/ui';

export type EntityType = 'units' | 'items' | 'traits' | 'comps';

export interface FilterOption {
  id: string;
  name: string;
}

export interface FilterState {
  all: boolean;
  [key: string]: boolean;
}

interface EntityTabsProps {
  activeTab: EntityType;
  onTabChange: (tab: EntityType) => void;
  filterOptions: FilterOption[];
  filterState: FilterState;
  onFilterChange: (id: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showConditionsButton?: boolean;
  showConditions?: boolean;
  onToggleConditions?: () => void;
  allowSearch?: boolean;
  className?: string;
}

export function EntityTabs({
  activeTab,
  onTabChange,
  filterOptions,
  filterState,
  onFilterChange,
  searchValue = '',
  onSearchChange,
  showConditionsButton = false,
  showConditions = false,
  onToggleConditions,
  allowSearch = true,
  className = ''
}: EntityTabsProps) {
  const entityTypes: { id: EntityType; name: string }[] = [
    { id: 'units', name: 'Units' },
    { id: 'items', name: 'Items' },
    { id: 'traits', name: 'Traits' },
    { id: 'comps', name: 'Comps' }
  ];

  return (
    <div className={`bg-brown/5 border border-gold/20 rounded-lg backdrop-blur-md p-0 ${className}`}>
      <div className="flex flex-col gap-0">

        {/* Tabs and Filters in one row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between p-2 border-b border-gold/20">
          {/* Tabs */}
          <div className="flex overflow-x-auto">
            {entityTypes.map(type => (
              <button 
                key={type.id} 
                onClick={() => onTabChange(type.id)}
                className={`px-4 py-2 font-medium ${
                  activeTab === type.id ? 'text-gold border-b-2 border-gold' : 'text-cream hover:text-gold'
                }`}
              >
                {type.name}
              </button>
            ))}
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3 overflow-x-auto mt-2 md:mt-0">
            {showConditionsButton && onToggleConditions && (
              <button 
                onClick={onToggleConditions}
                className={`px-3 py-1 flex items-center gap-1 rounded-full ${
                  showConditions ? 'bg-gold text-brown' : 'bg-brown-light/30 hover:bg-brown-light/50 text-cream'}`}
              >
                <Filter size={14} />
                <span className="text-xs">Conditions</span>
              </button>
            )}
            
            <FilterButtons 
              options={filterOptions}
              activeFilter={filterState}
              onChange={onFilterChange}
            />
          </div>
        </div>
        {/* Search Bar (Optional) */}
        {allowSearch && onSearchChange && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gold h-5 w-5" />
            <input
              type="text" 
              placeholder="Search table..." 
              value={searchValue}
              className="w-full pl-10 pr-4 py-2 bg-brown/60 focus:outline-none focus:border-gold rounded-t-lg"
              onChange={e => onSearchChange(e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Separate ConditionsPanel component for advanced filtering
interface ConditionConfig {
  id: string;
  label: string;
  options: FilterOption[];
  state: FilterState;
}

interface ConditionsPanelProps {
  conditions: ConditionConfig[];
  onConditionChange: (conditionId: string, optionId: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  className?: string;
}

export function ConditionsPanel({
  conditions,
  onConditionChange,
  searchValue = '',
  onSearchChange,
  className = ''
}: ConditionsPanelProps) {
  if (conditions.length === 0) return null;

  return (
    <div className={`bg-brown/5 border border-gold/20 rounded-lg backdrop-blur-md p-0 ${className}`}>
      {onSearchChange && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gold/60 h-4 w-4" />
          <input
            type="text"
            placeholder="Search conditions..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-brown-light/30 border border-gold/20 rounded text-sm focus:outline-none focus:border-gold"
          />
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 ml-2">
        {conditions.map((condition) => (
          <div key={condition.id} className="mb-2">
            <div className="text-sm text-gold-light mb-2">
              {condition.label}
            </div>
            {condition.options.length > 0 ? (
              <FilterButtons
                options={condition.options}
                activeFilter={condition.state}
                onChange={(optionId) => onConditionChange(condition.id, optionId)}
              />
            ) : (
              <div className="text-xs text-cream/50 italic">No options available</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
