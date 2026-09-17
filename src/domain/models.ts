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
  is_gravity_stable?: boolean;
  is_chemically_stabilized?: boolean;
  backsweetening_events?: BacksweeteningEvent[];
  current_sg?: number;
  original_sg?: number;
  abv?: number;
  progress?: number;
  age_days?: number;
  age_formatted?: string;
  start_date?: string;
}

export interface BacksweeteningEvent {
  id: number;
  timestamp: string;
  date_formatted: string;
  ingredient: string;
  quantity_used?: number;
  unit?: string;
  note?: string;
  measured_sg_before?: number;
  measured_sg_after?: number;
  measured_sg_delta?: number;
  estimated_sg_delta?: number;
}

export interface Recipe {
  id: number;
  name: string;
  description: string;
  target_sg: number;
  type: 'starter' | 'custom';
}

/**
 * Calculates alcohol percentage using the Alternate ABV Formula:
 * ABV = ((76.08 * (OG - FG)) / (1.775 - OG)) * (FG / 0.794)
 *
 * Optimized for high sugar density, changed fluid viscosity, and ethanol concentration in mead.
 */
export function calculateABV(og: number, fg: number): number {
  if (isNaN(og) || isNaN(fg)) return 0;
  const normOg = og > 2 ? og / 1000 : og;
  const normFg = fg > 2 ? fg / 1000 : fg;

  if (normOg <= normFg || 1.775 - normOg === 0) {
    return 0;
  }

  const abv = ((76.08 * (normOg - normFg)) / (1.775 - normOg)) * (normFg / 0.794);
  return Math.max(0, abv);
}

/**
 * Calculates Fermentation Progress (%) based on gravity drop relative to target Final Gravity:
 * Progress % = ((OG - Current SG) / (OG - Target FG)) * 100
 */
export function calculateFermentationProgress(
  og: number,
  currentSg: number,
  targetFg: number = 1.000
): number {
  if (isNaN(og) || isNaN(currentSg) || isNaN(targetFg)) return 0;
  const normOg = og > 2 ? og / 1000 : og;
  const normCurrent = currentSg > 2 ? currentSg / 1000 : currentSg;
  const normTargetFg = targetFg > 2 ? targetFg / 1000 : targetFg;

  const totalExpectedDrop = normOg - normTargetFg;
  if (totalExpectedDrop <= 0) return 0;

  const actualDrop = normOg - normCurrent;
  const progress = (actualDrop / totalExpectedDrop) * 100;
  return Math.max(0, Number(progress.toFixed(1)));
}


import { formatAge, formatDateForDisplay } from "../views/formatters";
export { formatAge, formatDateForDisplay };

// 7 days in milliseconds required to confirm gravity stability
export const GRAVITY_STABILITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Checks if gravity has remained stable over at least 7 days (two identical SG readings)
 */
export function checkGravityStability(events: Event[]): boolean {
  const sgEvents = events
    .filter(e => e.type === 'sg_reading' && e.data?.sg !== undefined)
    .map(e => {
      let sg = e.data.sg;
      if (sg > 2) sg = sg / 1000;
      return {
        sg: Number(sg.toFixed(3)),
        time: new Date(e.timestamp).getTime(),
      };
    })
    .sort((a, b) => a.time - b.time);

  if (sgEvents.length < 2) return false;

  for (let i = 0; i < sgEvents.length; i++) {
    for (let j = i + 1; j < sgEvents.length; j++) {
      const timeDiff = sgEvents[j].time - sgEvents[i].time;
      if (timeDiff >= GRAVITY_STABILITY_WINDOW_MS) {
        if (sgEvents[i].sg === sgEvents[j].sg) {
          let allIntermediateMatch = true;
          for (let k = i + 1; k < j; k++) {
            if (sgEvents[k].sg !== sgEvents[i].sg) {
              allIntermediateMatch = false;
              break;
            }
          }
          if (allIntermediateMatch) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Checks if both stabilizer ingredients (sulfite + sorbate) have been logged via addition events
 */
export function checkChemicalStabilization(events: Event[], inventoryList?: InventoryItem[]): boolean {
  const invMap = new Map<number, InventoryItem>();
  if (inventoryList) {
    for (const item of inventoryList) {
      invMap.set(item.id, item);
    }
  }

  let hasSulfite = false;
  let hasSorbate = false;

  const additionEvents = events.filter(e => e.type === 'addition');

  const isSulfiteText = (text: string) => 
    /campden|metabisulfite|metabisulphite|k-?meta|\bsulfite\b|\bsulphite\b/i.test(text);

  const isSorbateText = (text: string) => 
    /sorbistat|potassium\s*sorbate|k-?sorbate|\bsorbate\b/i.test(text);

  for (const e of additionEvents) {
    let combinedText = '';
    if (e.data?.inventory_item_id && invMap.has(e.data.inventory_item_id)) {
      combinedText += ' ' + invMap.get(e.data.inventory_item_id)!.name;
    }
    if (e.data?.ingredient) {
      combinedText += ' ' + e.data.ingredient;
    }
    if (e.data?.note) {
      combinedText += ' ' + e.data.note;
    }

    if (isSulfiteText(combinedText)) {
      hasSulfite = true;
    }
    if (isSorbateText(combinedText)) {
      hasSorbate = true;
    }
  }

  return hasSulfite && hasSorbate;
}

/**
 * Finds backsweetening addition events logged after chemical stabilization and calculates measured & estimated SG changes
 */
export function getBacksweeteningEvents(
  events: Event[],
  inventoryList?: InventoryItem[],
  og?: number,
): BacksweeteningEvent[] {
  const invMap = new Map<number, InventoryItem>();
  if (inventoryList) {
    for (const item of inventoryList) {
      invMap.set(item.id, item);
    }
  }

  const isSulfiteText = (text: string) =>
    /campden|metabisulfite|metabisulphite|k-?meta|\bsulfite\b|\bsulphite\b/i.test(text);

  const isSorbateText = (text: string) =>
    /sorbistat|potassium\s*sorbate|k-?sorbate|\bsorbate\b/i.test(text);

  let lastSulfiteTime: number | null = null;
  let lastSorbateTime: number | null = null;

  for (const e of events) {
    if (e.type !== "addition") continue;
    let combinedText = "";
    if (e.data?.inventory_item_id && invMap.has(e.data.inventory_item_id)) {
      combinedText += " " + invMap.get(e.data.inventory_item_id)!.name;
    }
    if (e.data?.ingredient) {
      combinedText += " " + e.data.ingredient;
    }
    if (e.data?.note) {
      combinedText += " " + e.data.note;
    }

    const t = new Date(e.timestamp).getTime();
    if (isSulfiteText(combinedText)) {
      if (lastSulfiteTime === null || t > lastSulfiteTime) lastSulfiteTime = t;
    }
    if (isSorbateText(combinedText)) {
      if (lastSorbateTime === null || t > lastSorbateTime) lastSorbateTime = t;
    }
  }

  if (lastSulfiteTime === null || lastSorbateTime === null) {
    return [];
  }

  const stabilizationTime = Math.max(lastSulfiteTime, lastSorbateTime);

  // Approximate initial batch volume in Liters based on honey added vs target OG
  let initialSugarGrams = 0;
  for (const e of events) {
    if (e.type !== "addition") continue;
    const t = new Date(e.timestamp).getTime();
    if (t < stabilizationTime) {
      const invItem = e.data?.inventory_item_id ? invMap.get(e.data.inventory_item_id) : undefined;
      const isSugar =
        invItem?.category === "Honey & Sugars" ||
        /honning|honey|sugar|sukker/i.test(invItem?.name || e.data?.ingredient || "");
      if (isSugar && e.data?.quantity_used) {
        initialSugarGrams += convertUnits(e.data.quantity_used, e.data.unit || invItem?.unit || "g", "g");
      }
    }
  }

  let batchVolumeLiters = 10.0;
  if (og && og > 1.01 && initialSugarGrams > 0) {
    const ogPoints = (og - 1) * 1000;
    const calculatedVol = (initialSugarGrams / 1000 * 300) / ogPoints;
    if (calculatedVol >= 2 && calculatedVol <= 60) {
      batchVolumeLiters = calculatedVol;
    }
  }

  // Sorted SG readings
  const sgReadings = events
    .filter((e) => e.type === "sg_reading" && e.data?.sg !== undefined)
    .map((e) => {
      let sg = e.data.sg;
      if (sg > 2) sg = sg / 1000;
      return {
        sg: Number(sg.toFixed(3)),
        time: new Date(e.timestamp).getTime(),
      };
    })
    .sort((a, b) => a.time - b.time);

  const backsweeteningAdditions: BacksweeteningEvent[] = [];

  for (const e of events) {
    if (e.type !== "addition") continue;
    const t = new Date(e.timestamp).getTime();
    if (t < stabilizationTime) continue;

    const invItem = e.data?.inventory_item_id ? invMap.get(e.data.inventory_item_id) : undefined;
    let combinedText = "";
    if (invItem) combinedText += " " + invItem.name;
    if (e.data?.ingredient) combinedText += " " + e.data.ingredient;
    if (e.data?.note) combinedText += " " + e.data.note;

    if (isSulfiteText(combinedText) || isSorbateText(combinedText)) continue;

    const isSweetener =
      invItem?.category === "Honey & Sugars" ||
      /honning|honey|sugar|sukker|sirup|syrup|ettersøt|backsweeten|sweet|søt/i.test(combinedText);

    if (!isSweetener) continue;

    // Find latest SG reading before this addition
    let sgBefore: number | undefined = undefined;
    for (let i = sgReadings.length - 1; i >= 0; i--) {
      if (sgReadings[i].time <= t) {
        sgBefore = sgReadings[i].sg;
        break;
      }
    }

    // Find earliest SG reading after this addition
    let sgAfter: number | undefined = undefined;
    for (let i = 0; i < sgReadings.length; i++) {
      if (sgReadings[i].time > t) {
        sgAfter = sgReadings[i].sg;
        break;
      }
    }

    let measuredDelta: number | undefined = undefined;
    if (sgBefore !== undefined && sgAfter !== undefined) {
      measuredDelta = Number((sgAfter - sgBefore).toFixed(3));
    }

    let estimatedDelta: number | undefined = undefined;
    if (e.data?.quantity_used) {
      const grams = convertUnits(e.data.quantity_used, e.data.unit || invItem?.unit || "g", "g");
      const est = grams / (batchVolumeLiters * 3500);
      estimatedDelta = Number(est.toFixed(3));
    }

    const ingredientName = invItem?.name || e.data?.ingredient || "Sweetener";

    backsweeteningAdditions.push({
      id: e.id,
      timestamp: e.timestamp,
      date_formatted: formatDateForDisplay(e.timestamp),
      ingredient: ingredientName,
      quantity_used: e.data?.quantity_used,
      unit: e.data?.unit || invItem?.unit,
      note: e.data?.note,
      measured_sg_before: sgBefore,
      measured_sg_after: sgAfter,
      measured_sg_delta: measuredDelta,
      estimated_sg_delta: estimatedDelta,
    });
  }

  return backsweeteningAdditions;
}

/**
 * Derives the current state of a session based on its events and inventory items
 */
export function deriveSessionState(session: Session, events: Event[], inventoryList?: InventoryItem[]): Session {
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

  const isGravityStable = checkGravityStability(sortedEvents);
  const isChemicallyStabilized = checkChemicalStabilization(sortedEvents, inventoryList);
  const backsweeteningEvents = isChemicallyStabilized
    ? getBacksweeteningEvents(sortedEvents, inventoryList, og)
    : [];

  // If gravity has stabilized over the required window and batch isn't bottled, primary is finished -> transition to Aging
  if (isGravityStable && status !== 'Bottled') {
    status = 'Aging';
  }

  let abv = 0;
  let progress: number | undefined = undefined;
  if (og !== undefined && currentSg !== undefined) {
    abv = calculateABV(og, currentSg);
    progress = calculateFermentationProgress(og, currentSg);
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
    is_gravity_stable: isGravityStable,
    is_chemically_stabilized: isChemicallyStabilized,
    backsweetening_events: backsweeteningEvents,
    original_sg: og,
    current_sg: currentSg,
    abv: Number(abv.toFixed(2)),
    progress,
    age_days: Math.floor(ageMs / (1000 * 60 * 60 * 24)),
    age_formatted: formatAge(ageMs),
    start_date: firstEventDateStr
  };
}
