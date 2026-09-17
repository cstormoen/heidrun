import { describe, expect, it } from "bun:test";
import {
	formatAbv,
	formatAge,
	formatCost,
	formatDateForDisplay,
	formatInventoryQuantity,
	formatQuantity,
	formatSg,
	formatTimelineDate,
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

	describe("formatTimelineDate", () => {
		it("formats date in en-GB lower-case format", () => {
			const formatted = formatTimelineDate("2026-09-17T12:00:00Z");
			expect(formatted).toMatch(/17 sept?\.? 2026/i);
		});

		it("returns empty string on invalid date", () => {
			expect(formatTimelineDate("invalid")).toBe("");
		});
	});

	describe("formatAge", () => {
		it("formats milliseconds into readable string", () => {
			const hourMs = 1000 * 60 * 60;
			const dayMs = hourMs * 24;

			expect(formatAge(0)).toBe("0 hours");
			expect(formatAge(hourMs * 3)).toBe("3 hours");
			expect(formatAge(dayMs * 5 + hourMs * 2)).toBe("5 days, 2 hours");
			expect(formatAge(dayMs * 35)).toBe("1 month, 4 days");
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
			expect(formatUnitPrice(undefined)).toBe("No cost data");
		});

		it("formats total cost string", () => {
			expect(formatCost(123.456, "NOK")).toBe("123.46 NOK");
		});
	});
});
