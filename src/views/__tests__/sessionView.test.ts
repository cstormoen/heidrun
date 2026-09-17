import { describe, expect, it } from "bun:test";
import type { Event, InventoryItem, Recipe, Session } from "../../domain/models";
import {
	getNewSessionViewModel,
	getSessionDetailViewModel,
	getSessionListViewModel,
	renderNewSessionForm,
	renderSessionCard,
	renderSessionDetail,
	renderSessionList,
} from "../sessionView";

describe("sessionView module", () => {
	const mockSession: Session = {
		id: 1,
		name: "Test Batch",
		recipe_id: 10,
		start_date: "2026-08-01T12:00:00.000Z",
		created_at: "2026-08-01T12:00:00.000Z",
	};

	const mockRecipes: Recipe[] = [
		{
			id: 10,
			name: "Traditional Mead",
			description: 'Classic recipe with "wildflower" honey',
			ingredients: [],
			instructions: "Mix and ferment",
		},
	];

	const mockEvents: Event[] = [
		{
			id: 101,
			session_id: 1,
			type: "sg_reading",
			timestamp: "2026-08-01T12:00:00.000Z",
			data: { sg: 1.11 },
		},
		{
			id: 102,
			session_id: 1,
			type: "sg_reading",
			timestamp: "2026-08-15T12:00:00.000Z",
			data: { sg: 1.01 },
		},
		{
			id: 103,
			session_id: 1,
			type: "addition",
			timestamp: "2026-08-02T12:00:00.000Z",
			data: {
				inventory_item_id: 5,
				quantity_used: 10,
				unit: "g",
			},
		},
	];

	const mockInventory: InventoryItem[] = [
		{
			id: 5,
			name: "Fermaid O",
			category: "Nutrients & Additives",
			quantity_on_hand: 90,
			unit: "g",
			cost_per_unit: 0.5,
			currency: "NOK",
		},
	];

	it("prepares session list view model", () => {
		const vm = getSessionListViewModel([mockSession]);
		expect(vm.sessions.length).toBe(1);
		expect(vm.sessions[0].name).toBe("Test Batch");
	});

	it("prepares new session view model with escaped descriptions", () => {
		const vm = getNewSessionViewModel(mockRecipes);
		expect(vm.recipes.length).toBe(1);
		expect(vm.recipes[0].name).toBe("Traditional Mead");
		expect(vm.recipes[0].safeDescription).toContain("&quot;wildflower&quot;");
	});

	it("prepares session detail view model with chart data and inventory usage", () => {
		const vm = getSessionDetailViewModel(
			mockSession,
			mockEvents,
			mockInventory,
		);
		expect(vm.session.name).toBe("Test Batch");
		expect(vm.ogFormatted).toBe("1.110");
		expect(vm.currentSgFormatted).toBe("1.010");
		expect(vm.chartBundle.sgData.length).toBe(2);
		expect(vm.inventoryUsage.linkedGroups.length).toBe(1);
		expect(vm.inventoryUsage.totalCost).toBe(5);
	});

	it("renders session card HTML correctly", () => {
		const cardHtml = renderSessionCard({
			...mockSession,
			status: "Fermenting",
			current_sg: 1.05,
			abv: 8.5,
			age_formatted: "14 days",
		});
		expect(cardHtml).toContain("Test Batch");
		expect(cardHtml).toContain("Fermenting");
		expect(cardHtml).toContain("1.050");
		expect(cardHtml).toContain("8.5%");
	});

	it("renders session list HTML correctly", () => {
		const listHtml = renderSessionList([mockSession]);
		expect(listHtml).toContain("Your Batches");
		expect(listHtml).toContain("Test Batch");
	});

	it("renders new session form HTML correctly", () => {
		const formHtml = renderNewSessionForm(mockRecipes);
		expect(formHtml).toContain("Start New Batch");
		expect(formHtml).toContain("Traditional Mead");
		expect(formHtml).toContain("&quot;wildflower&quot;");
	});

	it("renders session detail HTML with stats, events, and ingredients", () => {
		const detailHtml = renderSessionDetail(
			mockSession,
			mockEvents,
			mockInventory,
		);
		expect(detailHtml).toContain("Test Batch");
		expect(detailHtml).toContain("Fermentation Curve");
		expect(detailHtml).toContain("Fermaid O");
		expect(detailHtml).toContain("Event History");
		expect(detailHtml).toContain("Ingredients Used");
		expect(detailHtml).toContain("Log Event");
		// Ingredients Used should be rendered below Event History
		expect(detailHtml.indexOf("Ingredients Used")).toBeGreaterThan(
			detailHtml.indexOf("Event History"),
		);
		// Timeline renders days since start
		expect(detailHtml).toContain("Day 1");
		expect(detailHtml).toContain("Day 2");
		expect(detailHtml).toContain("Day 15");
		// Not stabilized by default, should render locked guidance
		expect(detailHtml).toContain("Backsweetening Guidance (Locked)");
		expect(detailHtml).toContain("Stabilization Required");
	});

	it("renders session card with Aging (Modning) and Chemically Stabilized badge", () => {
		const cardHtml = renderSessionCard({
			...mockSession,
			status: "Aging",
			is_chemically_stabilized: true,
			current_sg: 1.000,
			abv: 14.2,
			age_formatted: "30 days",
		});
		expect(cardHtml).toContain("Aging (Modning)");
		expect(cardHtml).toContain("Chemically Stabilized");
	});

	it("renders session detail with Unlocked Backsweetening Guidance when chemically stabilized", () => {
		const stabilizedEvents: Event[] = [
			...mockEvents,
			{
				id: 201,
				session_id: 1,
				type: "addition",
				timestamp: "2026-08-20T12:00:00.000Z",
				data: {
					ingredient: "Campden and Potassium Sorbate",
					quantity_used: 2,
					unit: "g",
				},
			},
		];

		const detailHtml = renderSessionDetail(
			mockSession,
			stabilizedEvents,
			mockInventory,
		);
		expect(detailHtml).toContain("Chemically Stabilized");
		expect(detailHtml).toContain("Backsweetening Guidance (Ettersøting)");
		expect(detailHtml).toContain("Unlocked &amp; Safe");
		expect(detailHtml).toContain("Log Backsweetening");
	});
});
