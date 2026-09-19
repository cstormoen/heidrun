import { describe, expect, it } from "bun:test";
import {
	calculateABV,
	calculateFermentationProgress,
	calculateOneThirdSugarBreak,
	deriveSessionState,
	type Event,
	type Session,
} from "../models";

describe("Brewing Calculations", () => {
	describe("Alternate ABV Formula", () => {
		it("calculates accurate ABV for a typical mead gravity drop", () => {
			// Formula: ((76.08 * (OG - FG)) / (1.775 - OG)) * (FG / 0.794)
			// OG: 1.110, FG: 1.000
			// (76.08 * 0.11 / 0.665) * (1.000 / 0.794) = 12.58466 * 1.2594458 = 15.85%
			const abv = calculateABV(1.110, 1.000);
			expect(abv).toBeCloseTo(15.85, 2);
		});

		it("calculates accurate ABV for light styles / hydromels", () => {
			// OG: 1.045, FG: 1.000
			// (76.08 * 0.045 / 0.730) * (1.000 / 0.794) = 4.68986 * 1.259446 = 5.91%
			const abv = calculateABV(1.045, 1.000);
			expect(abv).toBeCloseTo(5.91, 2);
		});

		it("normalizes integer hydrometer points (e.g. 1110 and 1000)", () => {
			const abvPoints = calculateABV(1110, 1000);
			const abvDecimals = calculateABV(1.110, 1.000);
			expect(abvPoints).toBeCloseTo(abvDecimals, 4);
		});

		it("returns 0 when FG >= OG or no alcohol has been produced", () => {
			expect(calculateABV(1.110, 1.110)).toBe(0);
			expect(calculateABV(1.080, 1.100)).toBe(0);
		});

		it("handles NaN or invalid inputs safely", () => {
			expect(calculateABV(NaN, 1.000)).toBe(0);
			expect(calculateABV(1.100, NaN)).toBe(0);
		});
	});

	describe("Fermentation Progress (%)", () => {
		it("calculates 0% progress at initial gravity", () => {
			expect(calculateFermentationProgress(1.100, 1.100, 1.000)).toBe(0);
		});

		it("calculates 50% progress at the midpoint", () => {
			expect(calculateFermentationProgress(1.100, 1.050, 1.000)).toBe(50);
		});

		it("calculates 100% progress at target final gravity", () => {
			expect(calculateFermentationProgress(1.100, 1.000, 1.000)).toBe(100);
		});

		it("supports custom target FG", () => {
			// OG: 1.120, Target FG: 1.020, Current: 1.070
			// (1.120 - 1.070) / (1.120 - 1.020) = 0.050 / 0.100 = 50%
			expect(calculateFermentationProgress(1.120, 1.070, 1.020)).toBe(50);
		});

		it("normalizes hydrometer points in progress calculation", () => {
			expect(calculateFermentationProgress(1100, 1050, 1000)).toBe(50);
		});

		it("returns 0 if OG <= Target FG or invalid numbers", () => {
			expect(calculateFermentationProgress(1.000, 1.000, 1.000)).toBe(0);
			expect(calculateFermentationProgress(NaN, 1.050, 1.000)).toBe(0);
		});
	});

	describe("1/3 Sugar Break Calculation", () => {
		it("calculates accurate 1/3 sugar break point for typical mead (OG: 1.110 -> 1.073)", () => {
			// For OG 1.110 and target FG 1.000:
			// Expected drop = 0.110
			// 1/3 drop = 0.110 / 3 = 0.036666...
			// Break point = 1.110 - 0.036666... = 1.073333... -> 1.073
			const breakSg = calculateOneThirdSugarBreak(1.110, 1.000);
			expect(breakSg).toBe(1.073);
		});

		it("defaults target FG to 1.000 when omitted", () => {
			expect(calculateOneThirdSugarBreak(1.110)).toBe(1.073);
		});

		it("normalizes integer hydrometer points (e.g. 1110 and 1000)", () => {
			expect(calculateOneThirdSugarBreak(1110, 1000)).toBe(1.073);
		});

		it("calculates correctly for different starting gravities and target FGs", () => {
			// OG 1.090, target FG 1.000 -> drop 0.090 / 3 = 0.030 -> 1.060
			expect(calculateOneThirdSugarBreak(1.090, 1.000)).toBe(1.060);
			// OG 1.120, target FG 1.015 -> drop 0.105 / 3 = 0.035 -> 1.085
			expect(calculateOneThirdSugarBreak(1.120, 1.015)).toBe(1.085);
		});

		it("returns 0 if OG <= Target FG or invalid numbers", () => {
			expect(calculateOneThirdSugarBreak(1.000, 1.000)).toBe(0);
			expect(calculateOneThirdSugarBreak(0.990, 1.000)).toBe(0);
			expect(calculateOneThirdSugarBreak(NaN, 1.000)).toBe(0);
			expect(calculateOneThirdSugarBreak(1.110, NaN)).toBe(0);
		});
	});

	describe("deriveSessionState ABV & Progress integration", () => {
		const baseSession: Session = {
			id: 1,
			recipe_id: 1,
			name: "Test Hydromel",
			created_at: "2026-08-01T12:00:00.000Z",
		};

		it("automatically computes Alternate ABV, progress, and 1/3 sugar break on session derivation", () => {
			const eventsPreBreak: Event[] = [
				{
					id: 1,
					session_id: 1,
					type: "sg_reading",
					timestamp: "2026-08-01T12:00:00.000Z",
					data: { sg: 1.110 },
				},
				{
					id: 2,
					session_id: 1,
					type: "sg_reading",
					timestamp: "2026-08-03T12:00:00.000Z",
					data: { sg: 1.090 },
				},
			];

			const derivedPre = deriveSessionState(baseSession, eventsPreBreak);
			expect(derivedPre.original_sg).toBe(1.110);
			expect(derivedPre.current_sg).toBe(1.090);
			expect(derivedPre.sugar_break_sg).toBe(1.073);
			expect(derivedPre.is_sugar_break_reached).toBe(false);

			const eventsPostBreak: Event[] = [
				...eventsPreBreak,
				{
					id: 3,
					session_id: 1,
					type: "sg_reading",
					timestamp: "2026-08-10T12:00:00.000Z",
					data: { sg: 1.000 },
				},
			];

			const derivedPost = deriveSessionState(baseSession, eventsPostBreak);
			expect(derivedPost.original_sg).toBe(1.110);
			expect(derivedPost.current_sg).toBe(1.000);
			expect(derivedPost.sugar_break_sg).toBe(1.073);
			expect(derivedPost.is_sugar_break_reached).toBe(true);
			expect(derivedPost.abv).toBe(15.85);
			expect(derivedPost.progress).toBe(100);
		});

		it("tracks the latest pH reading as current_ph", () => {
			const eventsWithPh: Event[] = [
				{
					id: 1,
					session_id: 1,
					type: "ph_reading",
					timestamp: "2026-08-01T12:00:00.000Z",
					data: { ph: 3.8 },
				},
				{
					id: 2,
					session_id: 1,
					type: "ph_reading",
					timestamp: "2026-08-05T12:00:00.000Z",
					data: { ph: 3.45 },
				},
			];

			const derived = deriveSessionState(baseSession, eventsWithPh);
			expect(derived.current_ph).toBe(3.45);
			expect(derived.is_ph_out_of_range).toBe(false);
		});

		it("correctly identifies when pH is outside the optimal range (3.2 - 3.8)", () => {
			const highPhEvents: Event[] = [
				{
					id: 1,
					session_id: 1,
					type: "ph_reading",
					timestamp: "2026-08-01T12:00:00.000Z",
					data: { ph: 3.95 },
				},
			];
			const derivedHigh = deriveSessionState(baseSession, highPhEvents);
			expect(derivedHigh.is_ph_out_of_range).toBe(true);

			const lowPhEvents: Event[] = [
				{
					id: 2,
					session_id: 1,
					type: "ph_reading",
					timestamp: "2026-08-01T12:00:00.000Z",
					data: { ph: 3.05 },
				},
			];
			const derivedLow = deriveSessionState(baseSession, lowPhEvents);
			expect(derivedLow.is_ph_out_of_range).toBe(true);
		});
	});
});
