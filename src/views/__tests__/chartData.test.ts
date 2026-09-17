import { describe, expect, it } from "bun:test";
import { calculateABV, type Event } from "../../domain/models";
import { buildFermentationChartData, normalizeSg } from "../chartData";

describe("chartData", () => {
	describe("normalizeSg", () => {
		it("normalizes integer hydrometer points (e.g. 1110 -> 1.110)", () => {
			expect(normalizeSg(1110)).toBe(1.11);
			expect(normalizeSg(1.09)).toBe(1.09);
		});
	});

	describe("buildFermentationChartData", () => {
		it("returns empty datasets when startDate is missing", () => {
			const result = buildFermentationChartData([]);
			expect(result.sgData).toEqual([]);
			expect(result.abvData).toEqual([]);
			expect(result.annotations).toEqual([]);
		});

		it("processes SG readings and milestone annotations chronologically", () => {
			const startDate = "2026-09-01T10:00:00Z";
			const events: Event[] = [
				{
					id: 1,
					session_id: 10,
					type: "sg_reading",
					timestamp: "2026-09-01T10:00:00Z",
					data: { sg: 1.11 },
				},
				{
					id: 2,
					session_id: 10,
					type: "addition",
					timestamp: "2026-09-03T10:00:00Z",
					data: { note: "Nutrient dose" },
				},
				{
					id: 3,
					session_id: 10,
					type: "sg_reading",
					timestamp: "2026-09-05T10:00:00Z",
					data: { sg: 1.05 },
				},
				{
					id: 4,
					session_id: 10,
					type: "bottling",
					timestamp: "2026-09-10T10:00:00Z",
					data: {},
				},
			];

			const result = buildFermentationChartData(events, startDate);

			expect(result.sgData.length).toBe(2);
			expect(result.sgData[0]).toEqual({ x: 0, y: 1.11 });
			expect(result.sgData[1]).toEqual({ x: 4, y: 1.05 });

			expect(result.abvData.length).toBe(2);
			expect(result.abvData[0].y).toBe(0);
			expect(result.abvData[1].y).toBeCloseTo(Number(calculateABV(1.11, 1.05).toFixed(2)), 2);

			expect(result.annotations.length).toBe(2);
			expect(result.annotations[0].label.content).toBe("Addition");
			expect(result.annotations[0].xMin).toBe(2);
			expect(result.annotations[1].label.content).toBe("Bottled");
			expect(result.annotations[1].xMin).toBe(9);
		});
	});
});
