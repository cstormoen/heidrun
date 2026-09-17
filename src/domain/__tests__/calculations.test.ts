import { describe, expect, it } from "bun:test";
import {
	calculateABV,
	calculateFermentationProgress,
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

	describe("deriveSessionState ABV & Progress integration", () => {
		const baseSession: Session = {
			id: 1,
			recipe_id: 1,
			name: "Test Hydromel",
			created_at: "2026-08-01T12:00:00.000Z",
		};

		it("automatically computes Alternate ABV and progress on session derivation", () => {
			const events: Event[] = [
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
					timestamp: "2026-08-10T12:00:00.000Z",
					data: { sg: 1.000 },
				},
			];

			const derived = deriveSessionState(baseSession, events);
			expect(derived.original_sg).toBe(1.110);
			expect(derived.current_sg).toBe(1.000);
			expect(derived.abv).toBe(15.85);
			expect(derived.progress).toBe(100);
		});
	});
});
