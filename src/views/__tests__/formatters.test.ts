import { describe, expect, it } from "bun:test";
import {
	formatAbv,
	formatAge,
	formatCost,
	formatDateForDisplay,
	formatDateTimeForDisplay,
	formatInventoryQuantity,
	formatPh,
	formatQuantity,
	formatSg,
	formatTimelineDate,
	formatTimelineDay,
	formatUnitPrice,
} from "../formatters";

describe("formatters", () => {
	describe("formatDateForDisplay", () => {
		it("formats ISO date string as DD.MM.YYYY", () => {
			expect(formatDateForDisplay("2026-09-17T12:00:00Z")).toBe("17.09.2026");
		});

		it("handles undefined or empty gracefully", () => {
			expect(formatDateForDisplay(undefined)).toBe("");
			expect(formatDateForDisplay("")).toBe("");
			expect(formatDateForDisplay("invalid-date")).toBe("");
		});
	});

	describe("formatDateTimeForDisplay", () => {
		it("formats ISO date string as DD.MM.YYYY HH:MM", () => {
			const d = new Date("2026-09-08T17:00:00.000Z");
			const formatted = formatDateTimeForDisplay(d.toISOString());
			const dd = String(d.getDate()).padStart(2, "0");
			const mm = String(d.getMonth() + 1).padStart(2, "0");
			const yyyy = d.getFullYear();
			const hh = String(d.getHours()).padStart(2, "0");
			const min = String(d.getMinutes()).padStart(2, "0");
			expect(formatted).toBe(`${dd}.${mm}.${yyyy} ${hh}:${min}`);
		});

		it("handles undefined or empty gracefully", () => {
			expect(formatDateTimeForDisplay(undefined)).toBe("");
			expect(formatDateTimeForDisplay("")).toBe("");
			expect(formatDateTimeForDisplay("invalid-date")).toBe("");
		});
	});

	describe("formatTimelineDate", () => {
		it("formats date in no-NO lower-case format", () => {
			const formatted = formatTimelineDate("2026-09-17T12:00:00Z");
			expect(formatted).toMatch(/17\.?\s*sept?\.?\s*2026/i);
		});

		it("returns empty string on invalid date", () => {
			expect(formatTimelineDate("invalid")).toBe("");
		});
	});

	describe("formatTimelineDay", () => {
		it("returns Dag 1 for first event", () => {
			expect(
				formatTimelineDay("2026-08-01T12:00:00Z", "2026-08-01T12:00:00Z"),
			).toBe("Dag 1");
		});

		it("returns Dag 1 for same-day events", () => {
			expect(
				formatTimelineDay("2026-08-01T18:30:00Z", "2026-08-01T10:00:00Z"),
			).toBe("Dag 1");
		});

		it("calculates subsequent days accurately", () => {
			expect(
				formatTimelineDay("2026-08-02T10:00:00Z", "2026-08-01T10:00:00Z"),
			).toBe("Dag 2");
			expect(
				formatTimelineDay("2026-08-15T12:00:00Z", "2026-08-01T10:00:00Z"),
			).toBe("Dag 15");
		});

		it("defaults to Dag 1 if startDate is not provided or event is earlier", () => {
			expect(formatTimelineDay("2026-08-01T12:00:00Z")).toBe("Dag 1");
			expect(
				formatTimelineDay("2026-07-30T12:00:00Z", "2026-08-01T12:00:00Z"),
			).toBe("Dag 1");
		});

		it("returns empty string on invalid or missing date", () => {
			expect(formatTimelineDay("invalid")).toBe("");
			expect(formatTimelineDay(null)).toBe("");
			expect(formatTimelineDay(undefined)).toBe("");
		});
	});

	describe("formatAge", () => {
		it("formats milliseconds into readable string", () => {
			const hourMs = 1000 * 60 * 60;
			const dayMs = hourMs * 24;

			expect(formatAge(0)).toBe("0 timer");
			expect(formatAge(hourMs * 3)).toBe("3 timer");
			expect(formatAge(dayMs * 5 + hourMs * 2)).toBe("5 dager, 2 timer");
			expect(formatAge(dayMs * 35)).toBe("1 måned, 4 dager");
		});
	});

	describe("formatSg", () => {
		it("formats specific gravity with 3 decimal places", () => {
			expect(formatSg(1.085)).toBe("1.085");
			expect(formatSg(1.1)).toBe("1.100");
			expect(formatSg(1)).toBe("1.000");
		});

		it("returns placeholder when value is missing", () => {
			expect(formatSg(undefined)).toBe("---");
			expect(formatSg(null)).toBe("---");
			expect(formatSg(NaN)).toBe("---");
		});
	});

	describe("formatPh", () => {
		it("formats pH with 2 decimal places", () => {
			expect(formatPh(3.6)).toBe("3.60");
			expect(formatPh(3.456)).toBe("3.46");
			expect(formatPh(4)).toBe("4.00");
		});

		it("returns placeholder when value is missing", () => {
			expect(formatPh(undefined)).toBe("---");
			expect(formatPh(null)).toBe("---");
			expect(formatPh(NaN)).toBe("---");
		});
	});

	describe("formatAbv", () => {
		it("formats abv percentage", () => {
			expect(formatAbv(12.5)).toBe("12.5%");
			expect(formatAbv(undefined)).toBe("0%");
		});
	});

	describe("formatQuantity", () => {
		it("formats integer cleanly without decimals", () => {
			expect(formatQuantity(500)).toBe("500");
		});

		it("formats floating point without excessive trailing zeros", () => {
			expect(formatQuantity(1.5)).toBe("1.5");
			expect(formatQuantity(1.23456)).toBe("1.235");
		});
	});

	describe("formatInventoryQuantity", () => {
		it("formats inventory numbers with two decimals unless ends with .00", () => {
			expect(formatInventoryQuantity(5.0)).toBe("5");
			expect(formatInventoryQuantity(2.5)).toBe("2.50");
			expect(formatInventoryQuantity(0.75)).toBe("0.75");
		});
	});

	describe("formatUnitPrice & formatCost", () => {
		it("formats cost per unit string", () => {
			expect(formatUnitPrice(45, "NOK", "kg")).toBe("45 NOK / kg");
			expect(formatUnitPrice(undefined)).toBe("Ingen prisdata");
		});

		it("formats total cost string", () => {
			expect(formatCost(123.456, "NOK")).toBe("123.46 NOK");
		});
	});
});
