import { describe, expect, it } from "bun:test";
import type { Event, InventoryItem, Recipe, Session } from "../../domain/models";
import {
	getNewSessionViewModel,
	getSessionDetailViewModel,
	getSessionListViewModel,
	renderNewSessionForm,
	renderNextSteps,
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
		expect(vm.sugarBreakFormatted).toBe("1.073");
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

	it("renders session detail with pH reading in stats, timeline, and modal", () => {
		const eventsWithPh: Event[] = [
			...mockEvents,
			{
				id: 104,
				session_id: 1,
				type: "ph_reading",
				timestamp: "2026-08-03T12:00:00.000Z",
				data: { ph: 3.65, note: "Must adjusted with bicarbonate" },
			},
		];

		const detailHtml = renderSessionDetail(
			mockSession,
			eventsWithPh,
			mockInventory,
		);

		// Current pH in stats bar
		expect(detailHtml).toContain("Current pH");
		expect(detailHtml).toContain("3.65");
		expect(detailHtml).toContain("Optimal (3.2–3.8)");

		// Timeline shows pH Reading
		expect(detailHtml).toContain("pH Reading");
		expect(detailHtml).toContain("pH 3.65");
		expect(detailHtml).toContain("Must adjusted with bicarbonate");

		// Modal options & container
		expect(detailHtml).toContain('<option value="ph_reading">pH Reading</option>');
		expect(detailHtml).toContain('id="ph-data-container"');
		expect(detailHtml).toContain('name="ph"');

		// In-range pH does not render guidance card
		expect(detailHtml).not.toContain('id="ph-guidance-card"');
	});

	it("renders pH guidance card with malic acid adjustment when pH is above 3.8", () => {
		const highPhEvents: Event[] = [
			...mockEvents,
			{
				id: 105,
				session_id: 1,
				type: "ph_reading",
				timestamp: "2026-08-20T12:00:00.000Z",
				data: { ph: 3.95 },
			},
		];

		const detailHtml = renderSessionDetail(
			mockSession,
			highPhEvents,
			mockInventory,
		);

		// Stats bar shows outside target
		expect(detailHtml).toContain("Outside target (3.2–3.8)");

		// pH guidance card is present
		expect(detailHtml).toContain('id="ph-guidance-card"');
		expect(detailHtml).toContain("optimal pH range for mead is <strong>3.2 to 3.8</strong>");
		expect(detailHtml).toContain("Why pH Matters During Aging");
		expect(detailHtml).toContain("Microbial Protection &amp; Sulfite Efficiency");
		expect(detailHtml).toContain("Flavor &amp; Balance");
		expect(detailHtml).toContain("Recommended Adjustment");
		expect(detailHtml).toContain("malic acid (<em>eplesyre</em>)");
		expect(detailHtml).toContain("1 gram of malic acid per liter of mead");
		expect(detailHtml).toContain("3.8 or below");
		expect(detailHtml).toContain("Log Malic Acid Addition");
	});

	it("renders pH guidance card with buffering adjustment when pH is below 3.2", () => {
		const lowPhEvents: Event[] = [
			...mockEvents,
			{
				id: 106,
				session_id: 1,
				type: "ph_reading",
				timestamp: "2026-08-20T12:00:00.000Z",
				data: { ph: 3.05 },
			},
		];

		const detailHtml = renderSessionDetail(
			mockSession,
			lowPhEvents,
			mockInventory,
		);

		// Stats bar shows outside target
		expect(detailHtml).toContain("Outside target (3.2–3.8)");

		// pH guidance card is present with low pH advisory
		expect(detailHtml).toContain('id="ph-guidance-card"');
		expect(detailHtml).toContain("pH Low (&lt; 3.2)");
		expect(detailHtml).toContain("too acidic for the yeast");
		expect(detailHtml).toContain("Key Impacts of a pH Below 3.2");
		expect(detailHtml).toContain("Yeast Stress &amp; Stalled Fermentation");
		expect(detailHtml).toContain("Harsh Taste");
		expect(detailHtml).toContain("How to Raise the pH Back to Safety");
		expect(detailHtml).toContain("Chalk (Calcium Carbonate / <em>Kritt</em>)");
		expect(detailHtml).toContain(
			"Potassium Bicarbonate or Baking Soda (<em>Natron</em>)",
		);
		expect(detailHtml).toContain("Log Buffer Addition");
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

	it("renders Next Steps card with Primary Care Tip and aeration prompt before 1/3 break", () => {
		const preBreakEvents: Event[] = [
			{
				id: 301,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.110 },
			},
			{
				id: 302,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-03T12:00:00.000Z",
				data: { sg: 1.090 },
			},
		];

		const detailHtml = renderSessionDetail(
			mockSession,
			preBreakEvents,
			mockInventory,
		);

		expect(detailHtml).toContain("Next Steps");
		expect(detailHtml).toContain("1/3 Sugar Break");
		expect(detailHtml).toContain("1.073");
		expect(detailHtml).toContain(
			"Current SG is 1.090. Remember to degas CO₂ and add your final nutrient dose before SG reaches 1.073.",
		);
		expect(detailHtml).toContain("Primary Care Tip (Days 1–5): Degas and swirl gently before adding nutrients or taking SG readings to release CO₂.");
		expect(detailHtml).toContain("Degas and aerate the batch daily before reaching this break");
		expect(detailHtml).toContain("Degassing &amp; Aeration Phase");
	});

	it("renders Next Steps card with Stop Aerating warning past 1/3 break", () => {
		const postBreakEvents: Event[] = [
			{
				id: 401,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.110 },
			},
			{
				id: 402,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-05T12:00:00.000Z",
				data: { sg: 1.060 }, // past 1.073
			},
		];

		const detailHtml = renderSessionDetail(
			mockSession,
			postBreakEvents,
			mockInventory,
		);

		expect(detailHtml).toContain("Next Steps");
		expect(detailHtml).toContain(
			"1/3 Sugar Break reached (1.073)! Stop aerating and keep the vessel sealed under an airlock.",
		);
		expect(detailHtml).toContain("Past 1/3 Sugar Break (1.073): Stop Aerating!");
		expect(detailHtml).toContain("Stop aerating once past the 1/3 break to prevent oxidation during aging");
		expect(detailHtml).toContain("Past 1/3 Sugar Break");
	});

	it("renders actionable Next Step alert with contextual gravity values matching specification", () => {
		// Scenario 1: Before break with current SG 1.085 and target break 1.073 (OG 1.110)
		const scenario1Events: Event[] = [
			{
				id: 501,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.110 },
			},
			{
				id: 502,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-03T12:00:00.000Z",
				data: { sg: 1.085 },
			},
		];
		const html1 = renderSessionDetail(mockSession, scenario1Events, mockInventory);
		expect(html1).toContain(
			"Current SG is 1.085. Remember to degas CO₂ and add your final nutrient dose before SG reaches 1.073.",
		);

		// Scenario 2: After break with break at 1.070 (OG 1.105)
		const scenario2Events: Event[] = [
			{
				id: 601,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.105 },
			},
			{
				id: 602,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-05T12:00:00.000Z",
				data: { sg: 1.065 },
			},
		];
		const html2 = renderSessionDetail(mockSession, scenario2Events, mockInventory);
		expect(html2).toContain(
			"1/3 Sugar Break reached (1.070)! Stop aerating and keep the vessel sealed under an airlock.",
		);
	});

	it("renders Next Steps partial directly using renderNextSteps", () => {
		const sessionInPrimary: Session = {
			...mockSession,
			status: "Primary Fermentation",
			is_sugar_break_reached: false,
		};
		const html = renderNextSteps(sessionInPrimary, "1.085", "1.073");
		expect(html).toContain("id=\"next-steps-card\"");
		expect(html).toContain("Next Steps");
		expect(html).toContain("Degassing &amp; Aeration Phase");
		expect(html).toContain("Current SG is 1.085. Remember to degas CO₂ and add your final nutrient dose before SG reaches 1.073.");
	});
});
