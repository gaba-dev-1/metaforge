import React from 'react';
import { motion } from 'framer-motion';

interface RegionFilterProps {
  regions: { id: string; name: string }[];
  activeRegion: string;
  onChange: (region: string) => void;
}

export default function RegionFilter({ regions, activeRegion, onChange }: RegionFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {regions.map(region => (
        <motion.button
          key={region.id}
          className={`px-3 py-1.5 rounded-lg backdrop-filter backdrop-blur-sm border ${
            activeRegion === region.id 
              ? 'bg-solar-flare text-void-core border-solar-flare' 
              : 'bg-brown-light/10 text-corona-light hover:bg-brown-light/20 border-solar-flare/20'
          }`}
          onClick={() => onChange(region.id)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          {region.name}
        </motion.button>
      ))}
    </div>
  );
}
