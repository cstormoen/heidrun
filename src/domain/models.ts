export type Status = 'Planned' | 'Primary Fermentation' | 'Aging' | 'Bottled';
export type InventoryCategory = 'Honey & Sugars' | 'Yeast & Cultures' | 'Nutrients & Additives' | 'Fruits & Adjuncts';

export interface InventoryItem {
  id: number;
  name: string;
  category: InventoryCategory;
  quantity_on_hand: number;
  unit: string;
  cost_per_unit?: number;
  currency?: string;
  url?: string;
  created_at?: string;
}

/**
 * Converts quantity from one unit to another, favoring European metrics.
 * Supports: g, kg, mg, oz, lb, L, ml, tsp, tbsp, fl oz, packets.
 */
export function convertUnits(amount: number, fromUnit: string, toUnit: string): number {
  if (!fromUnit || !toUnit || fromUnit.toLowerCase() === toUnit.toLowerCase()) return amount;
  
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();
  
  // Base units for conversion: grams (for mass) and milliliters (for volume)
  let amountInBase = amount;
  let isMass = false;
  let isVolume = false;

  // Convert to base unit
  switch (from) {
    case 'kg': amountInBase = amount * 1000; isMass = true; break;
    case 'g': amountInBase = amount; isMass = true; break;
    case 'mg': amountInBase = amount / 1000; isMass = true; break;
    case 'oz': amountInBase = amount * 28.3495; isMass = true; break;
    case 'lb': amountInBase = amount * 453.592; isMass = true; break;
    case 'l': amountInBase = amount * 1000; isVolume = true; break;
    case 'ml': amountInBase = amount; isVolume = true; break;
    case 'tsp': amountInBase = amount * 4.92892; isVolume = true; break;
    case 'tbsp': amountInBase = amount * 14.7868; isVolume = true; break;
    case 'fl oz': amountInBase = amount * 29.5735; isVolume = true; break;
    case 'packets':
    case 'packet':
    case 'pkt':
      // Treat packets as a generic unit (e.g., yeast) that doesn't usually cross-convert
      return amount; 
    default:
      // Unknown unit, return as is (could be 'sticks', 'cubes')
      return amount;
  }

  // Convert from base to target
  let finalAmount = amountInBase;
  switch (to) {
    case 'kg': finalAmount = amountInBase / 1000; break;
    case 'g': finalAmount = amountInBase; break;
    case 'mg': finalAmount = amountInBase * 1000; break;
    case 'oz': finalAmount = amountInBase / 28.3495; break;
    case 'lb': finalAmount = amountInBase / 453.592; break;
    case 'l': finalAmount = amountInBase / 1000; break;
    case 'ml': finalAmount = amountInBase; break;
    case 'tsp': finalAmount = amountInBase / 4.92892; break;
    case 'tbsp': finalAmount = amountInBase / 14.7868; break;
    case 'fl oz': finalAmount = amountInBase / 29.5735; break;
  }

  return Number(finalAmount.toFixed(4)); // Keep it clean
}

export interface Event {
  id: number;
  session_id: number;
  type: 'sg_reading' | 'addition' | 'racking' | 'bottling';
  timestamp: string;
  data: any;
}

export interface Session {
  id: number;
  recipe_id: number;
  name: string;
  created_at: string;
  events?: Event[];
  // Derived fields
  status?: Status;
  current_sg?: number;
  original_sg?: number;
  abv?: number;
  progress?: number;
  age_days?: number;
  age_formatted?: string;
  start_date?: string;
}

export interface Recipe {
  id: number;
  name: string;
  description: string;
  target_sg: number;
  type: 'starter' | 'custom';
}

/**
 * Calculates ABV from Original Gravity and Final/Current Gravity
 */
export function calculateABV(og: number, fg: number): number {
  const normOg = og > 2 ? og / 1000 : og;
  const normFg = fg > 2 ? fg / 1000 : fg;
  return (normOg - normFg) * 131.25;
}

export function formatAge(ageMs: number): string {
  if (ageMs <= 0) return "0 hours";

  const MS_IN_HOUR = 1000 * 60 * 60;
  const MS_IN_DAY = MS_IN_HOUR * 24;
  const MS_IN_MONTH = MS_IN_DAY * 30.44; 
  const MS_IN_YEAR = MS_IN_DAY * 365.25;

  const years = Math.floor(ageMs / MS_IN_YEAR);
  const months = Math.floor((ageMs % MS_IN_YEAR) / MS_IN_MONTH);
  const days = Math.floor((ageMs % MS_IN_MONTH) / MS_IN_DAY);
  const hours = Math.floor((ageMs % MS_IN_DAY) / MS_IN_HOUR);

  const parts = [];

  if (years > 0) {
    parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    if (months > 0) {
      parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    }
  } else if (months > 0) {
    parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    if (days > 0) {
      parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    }
  } else if (days > 0) {
    parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) {
      parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    }
  } else {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}

/**
 * Derives the current state of a session based on its events
 */
export function deriveSessionState(session: Session, events: Event[]): Session {
  let status: Status = 'Planned';
  let og: number | undefined = undefined;
  let currentSg: number | undefined = undefined;
  
  // Sort events chronologically (oldest first)
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (const event of sortedEvents) {
    if (event.type === 'sg_reading') {
      let sg = event.data?.sg;
      if (sg !== undefined) {
        if (sg > 2) sg = sg / 1000; // Normalize 1110 to 1.110
        if (og === undefined) og = sg;
        currentSg = sg;
        if (status === 'Planned') status = 'Primary Fermentation';
      }
    }
    
    if (event.type === 'addition') {
      if (status === 'Planned') status = 'Primary Fermentation';
    }
    
    if (event.type === 'racking') {
      if (status !== 'Bottled') status = 'Aging';
    }
    
    if (event.type === 'bottling') {
      status = 'Bottled';
    }
  }

  let abv = 0;
  if (og !== undefined && currentSg !== undefined) {
    abv = calculateABV(og, currentSg);
  }

  let ageMs = 0;
  let firstEventDateStr = undefined;
  if (sortedEvents.length > 0) {
    firstEventDateStr = sortedEvents[0].timestamp;
    const firstEventDate = new Date(firstEventDateStr).getTime();
    ageMs = Math.max(0, Date.now() - firstEventDate);
  }

  return {
    ...session,
    events,
    status,
    original_sg: og,
    current_sg: currentSg,
    abv: Number(abv.toFixed(2)),
    age_days: Math.floor(ageMs / (1000 * 60 * 60 * 24)),
    age_formatted: formatAge(ageMs),
    start_date: firstEventDateStr
  };
}
