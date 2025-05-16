import { ProcessedItem, ProcessedUnit } from '@/types';

interface ItemCombo {
  mainItem: ProcessedItem;
  items: ProcessedItem[];
  winRate: number;
  frequency: number;
}

// Function to generate item combos (trios)
export const generateItemCombos = (allItems: ProcessedItem[], mainItem: ProcessedItem): ItemCombo[] => {
  if (!mainItem || !allItems || allItems.length < 2) {
    return [];
  }
  
  const combos: ItemCombo[] = [];
  
  // Get all units that use the main item
  const unitsWithMainItem = mainItem.unitsWithItem || [];
  if (unitsWithMainItem.length === 0) {
    return [];
  }
  
  // For each unit that uses the main item, find other items that pair well
  const pairingItems: Record<string, { item: ProcessedItem, count: number, totalWinRate: number }> = {};
  
  unitsWithMainItem.forEach(unit => {
    // Find all compositions where this unit appears with this item
    const popularComps = unit.relatedComps || [];
    popularComps.forEach(comp => {
      // For each comp, find this specific unit
      const thisUnit = comp.units.find(u => u.id === unit.id);
      if (!thisUnit || !thisUnit.items) {
        return;
      }
      
      // Check if this unit has the main item in this comp
      const hasMainItem = thisUnit.items.some(i => i.id === mainItem.id);
      if (!hasMainItem) {
        return;
      }
      
      // Get other items this unit has in this comp
      const otherItems = thisUnit.items.filter(i => i.id !== mainItem.id);
      otherItems.forEach(item => {
        if (!pairingItems[item.id]) {
          pairingItems[item.id] = {
            item,
            count: 0,
            totalWinRate: 0
          };
        }
        pairingItems[item.id].count += 1;
        pairingItems[item.id].totalWinRate += (comp.winRate || 0);
      });
    });
  });
  
  // Convert to array and sort by frequency
  const itemPairs = Object.values(pairingItems)
    .map(entry => ({
      item: entry.item,
      count: entry.count,
      avgWinRate: entry.count > 0 ? entry.totalWinRate / entry.count : 0
    }))
    .sort((a, b) => b.count - a.count);
  
  // Generate all possible pairs from top pairing items
  const topItems = itemPairs.slice(0, 5); // Take top 5 items for potential combos
  
  for (let i = 0; i < topItems.length; i++) {
    for (let j = i + 1; j < topItems.length; j++) {
      const item1 = topItems[i];
      const item2 = topItems[j];
      
      // Calculate the combined win rate and frequency
      const avgWinRate = (item1.avgWinRate + item2.avgWinRate) / 2;
      const totalFrequency = item1.count + item2.count;
      
      // Add to combos if it's a reasonable win rate
      if (avgWinRate > 0) {
        combos.push({
          mainItem,
          items: [mainItem, item1.item, item2.item],
          winRate: avgWinRate,
          frequency: totalFrequency
        });
      }
    }
  }
  
  // Sort by win rate
  return combos.sort((a, b) => b.winRate - a.winRate);
};

// Function to generate all combos for all items
export const generateAllItemCombos = (allItems: ProcessedItem[]): Record<string, ItemCombo[]> => {
  const allCombos: Record<string, ItemCombo[]> = {};
  
  allItems.forEach(item => {
    allCombos[item.id] = generateItemCombos(allItems, item);
  });
  
  return allCombos;
};
