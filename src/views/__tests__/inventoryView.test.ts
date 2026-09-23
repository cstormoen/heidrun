import { describe, expect, it } from "bun:test";
import type { Event, InventoryItem } from "../../domain/models";
import {
	getPantryViewModel,
	renderIngredientsUsedSection,
	renderPantryView,
	summarizeInventoryUsage,
} from "../inventoryView";

describe("inventoryView", () => {
	const mockHoney: InventoryItem = {
		id: 1,
		name: "Wildflower Honey",
		category: "Honning og sukker",
		quantity_on_hand: 5,
		unit: "kg",
		cost_per_unit: 100,
		currency: "NOK",
	};

	const mockYeast: InventoryItem = {
		id: 2,
		name: "Lalvin D47",
		category: "Gjær og kulturer",
		quantity_on_hand: 3,
		unit: "packets",
		cost_per_unit: 35,
		currency: "NOK",
	};

	const inventoryMap = new Map<number, InventoryItem>([
		[1, mockHoney],
		[2, mockYeast],
	]);

	describe("summarizeInventoryUsage", () => {
		it("aggregates linked additions with unit conversions and costs", () => {
			const events: Event[] = [
				{
					id: 101,
					session_id: 1,
					type: "addition",
					timestamp: "2026-09-01T10:00:00Z",
					data: {
						inventory_item_id: 1,
						quantity_used: 1500,
						unit: "g", // 1500g = 1.5kg
					},
				},
				{
					id: 102,
					session_id: 1,
					type: "addition",
					timestamp: "2026-09-02T10:00:00Z",
					data: {
						inventory_item_id: 1,
						quantity_used: 500,
						unit: "g", // 500g = 0.5kg (total 2kg)
					},
				},
				{
					id: 103,
					session_id: 1,
					type: "addition",
					timestamp: "2026-09-01T10:00:00Z",
					data: {
						inventory_item_id: 2,
						quantity_used: 1,
						unit: "packets",
					},
				},
				{
					id: 104,
					session_id: 1,
					type: "addition",
					timestamp: "2026-09-03T10:00:00Z",
					data: {
						ingredient: "Cinnamon Stick",
						quantity_used: 2,
						unit: "pcs",
						note: "Ceylon",
					},
				},
			];

			const summary = summarizeInventoryUsage(events, inventoryMap);

			expect(summary.linkedGroups.length).toBe(2);
			const honeyGroup = summary.linkedGroups.find((g) => g.invItem.id === 1);
			expect(honeyGroup).toBeDefined();
			expect(honeyGroup?.totalQty).toBe(2); // 1.5kg + 0.5kg
			expect(honeyGroup?.cost).toBe(200); // 2kg * 100 NOK

			const yeastGroup = summary.linkedGroups.find((g) => g.invItem.id === 2);
			expect(yeastGroup).toBeDefined();
			expect(yeastGroup?.totalQty).toBe(1);
			expect(yeastGroup?.cost).toBe(35);

			expect(summary.totalCost).toBe(235);

			expect(summary.unlinkedItems.length).toBe(1);
			expect(summary.unlinkedItems[0].ingredient).toBe("Cinnamon Stick");
		});
	});

	describe("renderIngredientsUsedSection", () => {
		it("renders HTML card with linked items and link form for unlinked items", () => {
			const events: Event[] = [
				{
					id: 101,
					session_id: 1,
					type: "addition",
					timestamp: "2026-09-01T10:00:00Z",
					data: {
						inventory_item_id: 1,
						quantity_used: 2,
						unit: "kg",
					},
				},
				{
					id: 102,
					session_id: 1,
					type: "addition",
					timestamp: "2026-09-02T10:00:00Z",
					data: {
						ingredient: "Vanilla Bean",
						quantity_used: 1,
						unit: "pod",
					},
				},
			];

			const summary = summarizeInventoryUsage(events, inventoryMap);
			const html = renderIngredientsUsedSection(
				summary,
				[mockHoney, mockYeast],
				1,
			);

			expect(html).toContain("Råvarer brukt");
			expect(html).toContain("Wildflower Honey");
			expect(html).toContain("2 kg");
			expect(html).toContain("Estimert råvarekostnad: 200.00 NOK");
			expect(html).toContain("Vanilla Bean");
			expect(html).toContain("Koble til vare fra stabburet:");
		});

		it("returns empty string when no additions are present", () => {
			const summary = summarizeInventoryUsage([], inventoryMap);
			const html = renderIngredientsUsedSection(summary, [], 1);
			expect(html).toBe("");
		});
	});

	describe("getPantryViewModel & renderPantryView", () => {
		it("prepares pantry view model grouped by category", () => {
			const vm = getPantryViewModel([mockHoney, mockYeast]);
			expect(vm.hasItems).toBe(true);
			expect(vm.categories.length).toBe(4);

			const honeyCat = vm.categories.find(
				(c) => c.category === "Honning og sukker",
			);
			expect(honeyCat?.items.length).toBe(1);
			expect(honeyCat?.items[0].item.name).toBe("Wildflower Honey");
			expect(honeyCat?.items[0].quantityFormatted).toBe("5");
			expect(honeyCat?.items[0].unitPriceFormatted).toBe("100 NOK / kg");
		});

		it("renders pantry HTML view", () => {
			const html = renderPantryView([mockHoney, mockYeast]);
			expect(html).toContain("Stabbur");
			expect(html).toContain("Wildflower Honey");
			expect(html).toContain("Lalvin D47");
			expect(html).toContain("Legg til vare");
			expect(html).toContain("add_inventory_modal");
		});
	});
});

