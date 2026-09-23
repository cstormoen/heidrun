export enum Status {
  Planned = 'Planlagt',
  PrimaryFermentation = 'Primærgjæring',
  Aging = 'Modning',
  Bottled = 'Flasket',
}

export type InventoryCategory =
  | 'Honning og sukker'
  | 'Gjær og kulturer'
  | 'Gjærnæring og tilsetninger'
  | 'Frukt, bær og krydder'
  | 'Honey & Sugars'
  | 'Yeast & Cultures'
  | 'Nutrients & Additives'
  | 'Fruits & Adjuncts';

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

  // Convert to base unit
  switch (from) {
    case 'kg': amountInBase = amount * 1000; break;
    case 'g': amountInBase = amount;   break;
    case 'mg': amountInBase = amount / 1000;   break;
    case 'oz': amountInBase = amount * 28.3495;   break;
    case 'lb': amountInBase = amount * 453.592;   break;
    case 'l': amountInBase = amount * 1000;  break;
    case 'ml': amountInBase = amount;  break;
    case 'tsp': amountInBase = amount * 4.92892; break;
    case 'tbsp': amountInBase = amount * 14.7868; break;
    case 'fl oz': amountInBase = amount * 29.5735; break;
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
  type: 'sg_reading' | 'addition' | 'racking' | 'bottling' | 'ph_reading' | 'comment';
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
  is_racked?: boolean;
  backsweetening_events?: BacksweeteningEvent[];
  fining_state?: FiningState;
  current_sg?: number;
  current_ph?: number;
  is_ph_out_of_range?: boolean;
  original_sg?: number;
  estimated_batch_volume?: number;
  sugar_break_sg?: number;
  is_sugar_break_reached?: boolean;
  abv?: number;
  progress?: number;
  age_days?: number;
  age_formatted?: string;
  start_date?: string;
}

export type FiningStage =
  | 'none'
  | 'kieselsol_added'
  | 'chitosan_ready'
  | 'chitosan_overdue'
  | 'sediment_compacting'
  | 'sediment_compacted';

export type SedimentPhase = 'none' | 'loose' | 'compacting' | 'compacted';

export interface FiningState {
  stage: FiningStage;
  kieselsol_event?: Event;
  chitosan_event?: Event;
  kieselsol_time?: string;
  chitosan_time?: string;
  hours_since_kieselsol?: number;
  hours_until_chitosan_window?: number;
  hours_remaining_in_chitosan_window?: number;
  days_compacting?: number;
  days_remaining_to_compact?: number;
  compaction_progress_pct?: number;
  sediment_phase: SedimentPhase;
  safe_to_siphon: boolean;
  status_label: string;
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

/**
 * Calculates the 1/3 Sugar Break point:
 * Sugar Break SG = OG - ((OG - Target FG) / 3)
 *
 * For example, with OG = 1.110 and Target FG = 1.000,
 * the 1/3 sugar break occurs at 1.073.
 */
export function calculateOneThirdSugarBreak(
  og: number,
  targetFg: number = 1000
): number {
  if (Number.isNaN(og) || Number.isNaN(targetFg)) return 0;
  const normOg = og > 2 ? og / 1000 : og;
  const normTargetFg = targetFg > 2 ? targetFg / 1000 : targetFg;

  const totalExpectedDrop = normOg - normTargetFg;
  if (totalExpectedDrop <= 0) return 0;

  const breakSg = normOg - totalExpectedDrop / 3;
  return Number(breakSg.toFixed(3));
}


import { formatAge, formatDateForDisplay, formatDateTimeForDisplay } from "../views/formatters";
export { formatAge, formatDateForDisplay, formatDateTimeForDisplay };

// Optimal pH range for mead
export const OPTIMAL_PH_MIN = 3.2;
export const OPTIMAL_PH_MAX = 3.8;

// 7 days in milliseconds required to confirm gravity stability
export const GRAVITY_STABILITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeSg(value: number): number {
  if (Number.isNaN(value)) return value;
  return value > 2 ? value / 1000 : value;
}

function buildInventoryMap(inventoryList?: InventoryItem[]): Map<number, InventoryItem> {
  const invMap = new Map<number, InventoryItem>();
  if (!inventoryList) return invMap;

  for (const item of inventoryList) {
    invMap.set(item.id, item);
  }

  return invMap;
}

function getEventText(event: Event, inventoryMap: Map<number, InventoryItem>): string {
  const invName = event.data?.inventory_item_id && inventoryMap.has(event.data.inventory_item_id)
    ? inventoryMap.get(event.data.inventory_item_id)!.name
    : '';

  return [invName, event.data?.ingredient, event.data?.note]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const SULFITE_PATTERNS = [
  /campden|metabisulfite|metabisulphite|k-?meta|\bsulfite\b|\bsulphite\b/i,
];

const SORBATE_PATTERNS = [
  /sorbistat|potassium\s*sorbate|k-?sorbate|\bsorbate\b/i,
];

const SWEETENER_PATTERNS = [
  /honning|honey|sugar|sukker|sirup|syrup|ettersøt|backsweeten|sweet|søt/i,
];

function findLatestReadingBefore<T extends { time: number }>(readings: T[], targetTime: number): T | undefined {
  for (let i = readings.length - 1; i >= 0; i--) {
    if (readings[i].time <= targetTime) {
      return readings[i];
    }
  }

  return undefined;
}

function findEarliestReadingAfter<T extends { time: number }>(readings: T[], targetTime: number): T | undefined {
  for (let i = 0; i < readings.length; i++) {
    if (readings[i].time > targetTime) {
      return readings[i];
    }
  }

  return undefined;
}

// Shared helpers are intentionally kept small and pure so derivation functions can stay readable.

/**
 * Checks if gravity has remained stable over at least 7 days (two identical SG readings)
 */
export function checkGravityStability(events: Event[]): boolean {
  const sgEvents = events
    .filter(e => e.type === 'sg_reading' && e.data?.sg !== undefined)
    .map(e => {
      const sg = normalizeSg(e.data.sg);
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
  const invMap = buildInventoryMap(inventoryList);
  const additionEvents = events.filter(e => e.type === 'addition');

  const isSulfiteText = (text: string) => matchesAny(text, SULFITE_PATTERNS);
  const isSorbateText = (text: string) => matchesAny(text, SORBATE_PATTERNS);

  let hasSulfite = false;
  let hasSorbate = false;

  for (const event of additionEvents) {
    const combinedText = getEventText(event, invMap);

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
 * Returns timestamp of chemical stabilization (when both sulfite and sorbate were added), or null if not stabilized
 */
export function getStabilizationTime(
  events: Event[],
  inventoryList?: InventoryItem[]
): number | null {
  const invMap = buildInventoryMap(inventoryList);
  const isSulfiteText = (text: string) => matchesAny(text, SULFITE_PATTERNS);
  const isSorbateText = (text: string) => matchesAny(text, SORBATE_PATTERNS);

  let lastSulfiteTime: number | null = null;
  let lastSorbateTime: number | null = null;

  for (const e of events) {
    if (e.type !== "addition") continue;
    const combinedText = getEventText(e, invMap);

    const t = new Date(e.timestamp).getTime();
    if (isSulfiteText(combinedText)) {
      if (lastSulfiteTime === null || t > lastSulfiteTime) lastSulfiteTime = t;
    }
    if (isSorbateText(combinedText)) {
      if (lastSorbateTime === null || t > lastSorbateTime) lastSorbateTime = t;
    }
  }

  if (lastSulfiteTime === null || lastSorbateTime === null) {
    return null;
  }

  return Math.max(lastSulfiteTime, lastSorbateTime);
}

/**
 * Calculates estimated initial batch volume in Liters based on honey/sugars added vs Original Gravity.
 * Rule of thumb: 1 kg honey contributes ~300 gravity points per liter of must.
 */
export function calculateEstimatedBatchVolume(
  events: Event[],
  inventoryList?: InventoryItem[],
  og?: number,
  upToTimestamp?: number | null
): number | undefined {
  if (!og || og <= 1.01) return undefined;

  const invMap = buildInventoryMap(inventoryList);
  let initialSugarGrams = 0;

  for (const e of events) {
    if (e.type !== "addition") continue;
    const t = new Date(e.timestamp).getTime();
    if (upToTimestamp !== undefined && upToTimestamp !== null && t >= upToTimestamp) {
      continue;
    }

    const invItem = e.data?.inventory_item_id ? invMap.get(e.data.inventory_item_id) : undefined;
    const isSugar =
      invItem?.category === "Honey & Sugars" ||
      /honning|honey|sugar|sukker/i.test(invItem?.name || e.data?.ingredient || "");
    if (isSugar && e.data?.quantity_used) {
      initialSugarGrams += convertUnits(e.data.quantity_used, e.data.unit || invItem?.unit || "g", "g");
    }
  }

  if (initialSugarGrams <= 0) return undefined;

  const ogPoints = (og - 1) * 1000;
  const calculatedVol = (initialSugarGrams / 1000 * 300) / ogPoints;
  if (calculatedVol >= 2 && calculatedVol <= 60) {
    return Number(calculatedVol.toFixed(1));
  }

  return undefined;
}

/**
 * Finds backsweetening addition events logged after chemical stabilization and calculates measured & estimated SG changes
 */
export function getBacksweeteningEvents(
  events: Event[],
  inventoryList?: InventoryItem[],
  og?: number,
): BacksweeteningEvent[] {
  const stabilizationTime = getStabilizationTime(events, inventoryList);
  if (stabilizationTime === null) {
    return [];
  }

  const invMap = buildInventoryMap(inventoryList);
  const isSulfiteText = (text: string) => matchesAny(text, SULFITE_PATTERNS);
  const isSorbateText = (text: string) => matchesAny(text, SORBATE_PATTERNS);

  const estimatedVol = calculateEstimatedBatchVolume(events, inventoryList, og, stabilizationTime);
  const batchVolumeLiters = estimatedVol ?? 10.0;

  // Sorted SG readings
  const sgReadings = events
    .filter((e) => e.type === "sg_reading" && e.data?.sg !== undefined)
    .map((e) => {
      const sg = normalizeSg(e.data.sg);
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
    const combinedText = getEventText(e, invMap);

    if (isSulfiteText(combinedText) || isSorbateText(combinedText)) continue;

    const isSweetener =
      invItem?.category === "Honey & Sugars" ||
      matchesAny(combinedText, SWEETENER_PATTERNS);

    if (!isSweetener) continue;

    const sgBeforeEvent = findLatestReadingBefore(sgReadings, t);
    const sgAfterEvent = findEarliestReadingAfter(sgReadings, t);
    const sgBefore = sgBeforeEvent?.sg;
    const sgAfter = sgAfterEvent?.sg;

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
 * Recognizes Kieselsol (Component 1 [-]) addition text
 */
export function isKieselsolText(text: string): boolean {
  return /kieselsol|silica\s*sol|super-?kleer\s*(?:part\s*(?:1|a)|k\.?c\.?\s*1|\b1\b)|fining\s*(?:agent\s*)?1/i.test(text);
}

/**
 * Recognizes Chitosan (Component 2 [+]) addition text (supports English and Norwegian kitosan)
 */
export function isChitosanText(text: string): boolean {
  return /(?:ch|k)itosan|super-?kleer\s*(?:part\s*(?:2|b)|k\.?c\.?\s*2|\b2\b)|fining\s*(?:agent\s*)?2/i.test(text);
}

/**
 * Analyzes addition events to track two-component fining schedule and sediment compaction countdown
 */
export function getFiningState(
  events: Event[],
  inventoryList?: InventoryItem[],
  nowMs: number = Date.now()
): FiningState {
  const invMap = buildInventoryMap(inventoryList);

  const additions = events.filter(e => e.type === 'addition');
  let latestKieselsol: Event | undefined;
  let latestChitosan: Event | undefined;

  for (const e of additions) {
    const invName = (e.data?.inventory_item_id && invMap.has(e.data.inventory_item_id))
      ? invMap.get(e.data.inventory_item_id)!.name
      : '';
    const ingredient = e.data?.ingredient || '';
    const note = e.data?.note || '';

    const specificText = `${ingredient} ${note}`.trim();
    const fullText = `${invName} ${ingredient} ${note}`.trim();

    let isKieselsol = false;
    let isChitosan = false;

    // First check specific text (custom ingredient name or addition note)
    // to correctly distinguish individual steps when linked to combo inventory items
    // (such as "Super-Kleer (Kieselsol & Kitosan)")
    const specificKieselsol = isKieselsolText(specificText);
    const specificChitosan = isChitosanText(specificText);

    if (specificKieselsol && !specificChitosan) {
      isKieselsol = true;
    } else if (specificChitosan && !specificKieselsol) {
      isChitosan = true;
    } else {
      isKieselsol = isKieselsolText(fullText);
      isChitosan = isChitosanText(fullText);
    }

    if (isKieselsol) {
      if (!latestKieselsol || new Date(e.timestamp).getTime() >= new Date(latestKieselsol.timestamp).getTime()) {
        latestKieselsol = e;
      }
    }
    if (isChitosan) {
      if (!latestChitosan || new Date(e.timestamp).getTime() >= new Date(latestChitosan.timestamp).getTime()) {
        latestChitosan = e;
      }
    }
  }

  if (!latestKieselsol && !latestChitosan) {
    return {
      stage: 'none',
      sediment_phase: 'none',
      safe_to_siphon: false,
      status_label: 'Ikke startet',
    };
  }

  // If Chitosan is present, sediment compaction countdown is active
  if (latestChitosan) {
    const chitosanTime = new Date(latestChitosan.timestamp).getTime();
    const elapsedMs = Math.max(0, nowMs - chitosanTime);
    const daysCompacting = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, 14 - daysCompacting);
    const progressPct = Math.min(100, Math.round((daysCompacting / 14) * 100));

    let sedimentPhase: SedimentPhase;
    let stage: FiningStage;
    let safeToSiphon: boolean;
    let statusLabel: string;

    if (daysCompacting >= 14) {
      stage = 'sediment_compacted';
      sedimentPhase = 'compacted';
      safeToSiphon = true;
      statusLabel = 'Kompakt bunnfall – trygt å heverte';
    } else if (daysCompacting >= 7) {
      stage = 'sediment_compacting';
      sedimentPhase = 'compacting';
      safeToSiphon = false;
      statusLabel = `Bunnfall komprimeres (Dag ${daysCompacting + 1} av 14)`;
    } else {
      stage = 'sediment_compacting';
      sedimentPhase = 'loose';
      safeToSiphon = false;
      statusLabel = `Bunnfall bunnfeller – løst lag (Dag ${daysCompacting + 1} av 14)`;
    }

    return {
      stage,
      kieselsol_event: latestKieselsol,
      chitosan_event: latestChitosan,
      kieselsol_time: latestKieselsol?.timestamp,
      chitosan_time: latestChitosan.timestamp,
      days_compacting: daysCompacting,
      days_remaining_to_compact: daysRemaining,
      compaction_progress_pct: progressPct,
      sediment_phase: sedimentPhase,
      safe_to_siphon: safeToSiphon,
      status_label: statusLabel,
    };
  }

  // Kieselsol added, awaiting Chitosan
  const kieselsolTime = new Date(latestKieselsol!.timestamp).getTime();
  const elapsedHours = Math.max(0, (nowMs - kieselsolTime) / (1000 * 60 * 60));
  const hoursSince = Number(elapsedHours.toFixed(1));

  if (elapsedHours < 12) {
    const hoursUntil = Number(Math.max(0, 12 - elapsedHours).toFixed(1));
    return {
      stage: 'kieselsol_added',
      kieselsol_event: latestKieselsol,
      kieselsol_time: latestKieselsol!.timestamp,
      hours_since_kieselsol: hoursSince,
      hours_until_chitosan_window: hoursUntil,
      sediment_phase: 'none',
      safe_to_siphon: false,
      status_label: `Venter på Chitosan (Vinduet åpner om ${hoursUntil} t)`,
    };
  } else if (elapsedHours <= 24) {
    const hoursRemaining = Number(Math.max(0, 24 - elapsedHours).toFixed(1));
    return {
      stage: 'chitosan_ready',
      kieselsol_event: latestKieselsol,
      kieselsol_time: latestKieselsol!.timestamp,
      hours_since_kieselsol: hoursSince,
      hours_remaining_in_chitosan_window: hoursRemaining,
      sediment_phase: 'none',
      safe_to_siphon: false,
      status_label: `Tilsett Chitosan nå (${hoursRemaining} t igjen av vinduet)`,
    };
  } else {
    return {
      stage: 'chitosan_overdue',
      kieselsol_event: latestKieselsol,
      kieselsol_time: latestKieselsol!.timestamp,
      hours_since_kieselsol: hoursSince,
      sediment_phase: 'none',
      safe_to_siphon: false,
      status_label: `Chitosan-tilsetning forsinket (${hoursSince} t har gått)`,
    };
  }
}

// Derivation functions are grouped here because they combine the helpers above into session-aware results.

function deriveSessionMetrics(
  events: Event[],
  inventoryList?: InventoryItem[],
  nowMs: number = Date.now()
): {
  sortedEvents: Event[];
  status: Status;
  og: number | undefined;
  currentSg: number | undefined;
  currentPh: number | undefined;
  isRacked: boolean;
  isGravityStable: boolean;
  isChemicallyStabilized: boolean;
  backsweeteningEvents: BacksweeteningEvent[];
  finingState: FiningState;
} {
  let status: Status = Status.Planned;
  let og: number | undefined = undefined;
  let currentSg: number | undefined = undefined;
  let currentPh: number | undefined = undefined;
  let isRacked = false;

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const event of sortedEvents) {
    if (event.type === 'sg_reading') {
      let sg = event.data?.sg;
      if (sg !== undefined) {
        sg = normalizeSg(sg);
        if (og === undefined) og = sg;
        currentSg = sg;
        if (status === Status.Planned) status = Status.PrimaryFermentation;
      }
    }

    if (event.type === 'ph_reading') {
      const ph = event.data?.ph;
      if (ph !== undefined && !isNaN(Number(ph))) {
        currentPh = Number(ph);
      }
    }

    if (event.type === 'addition') {
      if (status === Status.Planned) status = Status.PrimaryFermentation;
    }

    if (event.type === 'racking') {
      isRacked = true;
      if (status !== Status.Bottled) status = Status.Aging;
    }

    if (event.type === 'bottling') {
      status = Status.Bottled;
    }
  }

  const isGravityStable = checkGravityStability(sortedEvents);
  const isChemicallyStabilized = checkChemicalStabilization(sortedEvents, inventoryList);
  const stabilizationTime = isChemicallyStabilized
    ? getStabilizationTime(sortedEvents, inventoryList)
    : null;
  const estimatedBatchVolume = calculateEstimatedBatchVolume(
    sortedEvents,
    inventoryList,
    og,
    stabilizationTime
  );
  const backsweeteningEvents = isChemicallyStabilized
    ? getBacksweeteningEvents(sortedEvents, inventoryList, og)
    : [];
  const finingState = getFiningState(sortedEvents, inventoryList, nowMs);

  if (isGravityStable && status !== Status.Bottled) {
    status = Status.Aging;
  }

  return {
    sortedEvents,
    status,
    og,
    estimatedBatchVolume,
    currentSg,
    currentPh,
    isRacked,
    isGravityStable,
    isChemicallyStabilized,
    backsweeteningEvents,
    finingState,
  };
}

/**
 * Derives the current state of a session based on its events and inventory items
 */
export function deriveSessionState(
  session: Session,
  events: Event[],
  inventoryList?: InventoryItem[],
  nowMs: number = Date.now()
): Session {
  const {
    sortedEvents,
    status,
    og,
    estimatedBatchVolume,
    currentSg,
    currentPh,
    isRacked,
    isGravityStable,
    isChemicallyStabilized,
    backsweeteningEvents,
    finingState,
  } = deriveSessionMetrics(events, inventoryList, nowMs);

  let abv = 0;
  let progress: number | undefined = undefined;
  let sugarBreakSg: number | undefined = undefined;
  let isSugarBreakReached: boolean | undefined = undefined;

  if (og !== undefined) {
    sugarBreakSg = calculateOneThirdSugarBreak(og, 1.000);
    if (currentSg !== undefined) {
      abv = calculateABV(og, currentSg);
      progress = calculateFermentationProgress(og, currentSg);
      if (sugarBreakSg > 0) {
        isSugarBreakReached = currentSg <= sugarBreakSg;
      }
    }
  }

  let ageMs = 0;
  let firstEventDateStr: string | undefined;
  if (sortedEvents.length > 0) {
    firstEventDateStr = sortedEvents[0].timestamp;
    const firstEventDate = new Date(firstEventDateStr).getTime();
    ageMs = Math.max(0, nowMs - firstEventDate);
  }

  return {
    ...session,
    events,
    status,
    is_gravity_stable: isGravityStable,
    is_chemically_stabilized: isChemicallyStabilized,
    is_racked: isRacked,
    backsweetening_events: backsweeteningEvents,
    fining_state: finingState,
    original_sg: og,
    estimated_batch_volume: estimatedBatchVolume,
    current_sg: currentSg,
    current_ph: currentPh,
    is_ph_out_of_range: currentPh !== undefined ? currentPh < OPTIMAL_PH_MIN || currentPh > OPTIMAL_PH_MAX : undefined,
    sugar_break_sg: sugarBreakSg,
    is_sugar_break_reached: isSugarBreakReached,
    abv: Number(abv.toFixed(2)),
    progress,
    age_days: Math.floor(ageMs / (1000 * 60 * 60 * 24)),
    age_formatted: formatAge(ageMs),
    start_date: firstEventDateStr
  };
}
