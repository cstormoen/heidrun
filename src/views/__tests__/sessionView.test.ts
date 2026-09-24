import { describe, expect, it } from "bun:test";
import {
	type Event,
	type InventoryItem,
	type Recipe,
	type Session,
	Status,
} from "../../domain/models";
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
		expect(listHtml).toContain("Dine brygg");
		expect(listHtml).toContain("Test Batch");
	});

	it("renders new session form HTML correctly", () => {
		const formHtml = renderNewSessionForm(mockRecipes);
		expect(formHtml).toContain("Start nytt brygg");
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
		expect(detailHtml).toContain("Gjæringskurve");
		expect(detailHtml).toContain("Fermaid O");
		expect(detailHtml).toContain("Logg");
		expect(detailHtml).toContain('id="event-history-title"');
		expect(detailHtml).toContain(
			'hx-swap="innerHTML show:#event-history-title:top focus-scroll:false"',
		);
		expect(detailHtml).toContain("Råvarer brukt");
		expect(detailHtml).toContain("Loggfør hendelse");
		// Ingredients Used should be rendered below Event History
		expect(detailHtml.indexOf("Råvarer brukt")).toBeGreaterThan(
			detailHtml.indexOf("Logg"),
		);
		// Timeline renders days since start
		expect(detailHtml).toContain("Dag 1");
		expect(detailHtml).toContain("Dag 2");
		expect(detailHtml).toContain("Dag 15");
		// Not stabilized by default, should render locked guidance
		expect(detailHtml).toContain("Ettersøting (Låst)");

		// Edit button is in timeline
		expect(detailHtml).toContain('title="Rediger hendelse"');

		// Delete button is inside the event modal, not duplicated per timeline item
		const deleteMatches = [...detailHtml.matchAll(/title="Slett hendelse"/g)];
		expect(deleteMatches.length).toBe(1);
		expect(detailHtml).toContain('id="event-delete-btn"');
		expect(detailHtml).toMatch(
			/<dialog id="event_modal"[\s\S]*?id="event-delete-btn"/,
		);
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
		expect(detailHtml).toContain("Nåværende pH");
		expect(detailHtml).toContain("3.65");
		expect(detailHtml).not.toContain("Optimal (3.2–3.8)");

		// Timeline shows pH Reading
		expect(detailHtml).toContain("pH-måling");
		expect(detailHtml).toContain("pH 3.65");
		expect(detailHtml).toContain("Must adjusted with bicarbonate");

		// Modal options & container
		expect(detailHtml).toContain('<option value="ph_reading">pH-måling</option>');
		expect(detailHtml).toContain('id="ph-data-container"');
		expect(detailHtml).toContain('name="ph"');

		// In-range pH does not render guidance card
		expect(detailHtml).not.toContain('id="ph-guidance-card"');
	});

	it("renders session detail with Comment in timeline and modal", () => {
		const eventsWithComment: Event[] = [
			...mockEvents,
			{
				id: 106,
				session_id: 1,
				type: "comment",
				timestamp: "2026-08-10T14:00:00.000Z",
				data: { note: "Carboy smelled distinctly of clover honey and citrus" },
			},
		];

		const detailHtml = renderSessionDetail(
			mockSession,
			eventsWithComment,
			mockInventory,
		);

		// Timeline displays comment text and note
		expect(detailHtml).toContain("Carboy smelled distinctly of clover honey and citrus");
		expect(detailHtml).toContain('<option value="comment">Kommentar</option>');
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
		expect(detailHtml).toContain("Utenfor målområde (3,2–3,8)");

		// pH guidance card is present
		expect(detailHtml).toContain('id="ph-guidance-card"');
		expect(detailHtml).toContain("optimale pH-området for mjød er <strong>3,2 til 3,8</strong>");
		expect(detailHtml).toContain("Hvorfor pH er viktig under modning");
		expect(detailHtml).toContain("Mikrobiell beskyttelse &amp; sulfitteffektivitet");
		expect(detailHtml).toContain("Smak &amp; balanse");
		expect(detailHtml).toContain("Anbefalt justering");
		expect(detailHtml).toContain("eplesyre (malic acid)");
		expect(detailHtml).toContain("1 gram eplesyre per liter mjød");
		expect(detailHtml).toContain("3,8 eller lavere");
		expect(detailHtml).toContain("Loggfør eplesyretilsetning");
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
		expect(detailHtml).toContain("Utenfor målområde (3,2–3,8)");

		// pH guidance card is present with low pH advisory
		expect(detailHtml).toContain('id="ph-guidance-card"');
		expect(detailHtml).toContain("pH lav (&lt; 3,2)");
		expect(detailHtml).toContain("for surt for gjæren");
		expect(detailHtml).toContain("Viktige konsekvenser ved pH under 3,2");
		expect(detailHtml).toContain("Gjærstress &amp; stagnert gjæring");
		expect(detailHtml).toContain("Skarp smak");
		expect(detailHtml).toContain("Hvordan heve pH tilbake til trygt nivå");
		expect(detailHtml).toContain("Kritt (Kalsiumkarbonat)");
		expect(detailHtml).toContain(
			"Kaliumbikarbonat eller natron",
		);
		expect(detailHtml).toContain("Loggfør buffertilsetning");
	});

	it("renders session card with Aging (Modning) and Chemically Stabilized badge", () => {
		const cardHtml = renderSessionCard({
			...mockSession,
			status: Status.Aging,
			is_chemically_stabilized: true,
			current_sg: 1.000,
			abv: 14.2,
			age_formatted: "30 dager",
		});
		expect(cardHtml).toContain("Modning");
		expect(cardHtml).toContain("Kjemisk stabilisert");
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
		expect(detailHtml).toContain("Kjemisk stabilisert");
		expect(detailHtml).toContain("Ettersøting");
		expect(detailHtml).toContain("Loggfør ettersøting");
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

		expect(detailHtml).toContain("Neste steg");
		expect(detailHtml).toContain("1/3-sukkerbrudd");
		expect(detailHtml).toContain("1.073");
		expect(detailHtml).toContain(
			"Nåværende SG er 1.090. Husk å røre ut CO₂ og tilsette siste dose gjærnæring før 1/3 av sukkeret er utgjæret (SG 1.073).",
		);
		expect(detailHtml).toContain("Tips for primærgjæring (Dag 1–5): Rør forsiktig for å frigjøre CO₂ før du tilsetter næring eller måler spesifikk tetthet (SG).");
		expect(detailHtml).toContain("Luft og avgass brygget daglig før 1/3 av sukkeret er utgjæret");
		expect(detailHtml).toContain("Målgrense");
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

		expect(detailHtml).toContain("Neste steg");
		expect(detailHtml).toContain(
			"1/3 av sukkeret er utgjæret (SG 1.073)! Stopp all lufting og hold karet forseglet med gjærlås.",
		);
		expect(detailHtml).toContain("1/3 av sukkeret er utgjæret (SG 1.073): Stopp lufting!");
		expect(detailHtml).toContain("Stopp lufting etter dette punktet for å forhindre oksidering under modning");
		expect(detailHtml).toContain('aria-label="1/3-sukkerbrudd nådd"');
		expect(detailHtml).toContain("text-warning");
		expect(detailHtml).not.toMatch(/<div class="stat-desc[^>]*">\s*Break reached\s*<\/div>/);
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
			"Nåværende SG er 1.085. Husk å røre ut CO₂ og tilsette siste dose gjærnæring før 1/3 av sukkeret er utgjæret (SG 1.073).",
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
			"1/3 av sukkeret er utgjæret (SG 1.070)! Stopp all lufting og hold karet forseglet med gjærlås.",
		);
	});

	it("renders Next Steps partial directly using renderNextSteps", () => {
		const sessionInPrimary: Session = {
			...mockSession,
			status: Status.PrimaryFermentation,
			is_sugar_break_reached: false,
		};
		const html = renderNextSteps(sessionInPrimary, "1.085", "1.073");
		expect(html).toContain("id=\"next-steps-card\"");
		expect(html).toContain("Neste steg");
		expect(html).toContain("Nåværende SG er 1.085. Husk å røre ut CO₂ og tilsette siste dose gjærnæring før 1/3 av sukkeret er utgjæret (SG 1.073).");
	});

	it("renders dynamic compaction days remaining in Next Steps during sediment compacting", () => {
		const sessionCompactingPlural: Session = {
			...mockSession,
			status: Status.Aging,
			fining_state: {
				stage: "sediment_compacting",
				days_compacting: 3,
				days_remaining_to_compact: 11,
				compaction_progress_pct: 21,
				sediment_phase: "loose",
				safe_to_siphon: false,
				status_label: "Bunnfall bunnfeller – løst lag (Dag 4 av 14)",
			},
		};
		const htmlPlural = renderNextSteps(sessionCompactingPlural, "1.000", "1.073");
		expect(htmlPlural).toContain("Vent 11 dager til (til dag 14 er fullført):");
		expect(htmlPlural).toContain("Heverting anbefales når bunnfallet er fast komprimert for å unngå å dra med gjær i flaskene.");

		const sessionCompactingSingular: Session = {
			...mockSession,
			status: Status.Aging,
			fining_state: {
				stage: "sediment_compacting",
				days_compacting: 13,
				days_remaining_to_compact: 1,
				compaction_progress_pct: 93,
				sediment_phase: "compacting",
				safe_to_siphon: false,
				status_label: "Bunnfall komprimeres (Dag 14 av 14)",
			},
		};
		const htmlSingular = renderNextSteps(sessionCompactingSingular, "1.000", "1.073");
		expect(htmlSingular).toContain("Vent 1 dag til (til dag 14 er fullført):");

		const sessionCompactingHoursPlural: Session = {
			...mockSession,
			status: Status.Aging,
			fining_state: {
				stage: "sediment_compacting",
				days_compacting: 12,
				days_remaining_to_compact: 2,
				hours_remaining_to_compact: 36,
				compaction_progress_pct: 86,
				sediment_phase: "compacting",
				safe_to_siphon: false,
				status_label: "Bunnfall komprimeres (Dag 13 av 14)",
			},
		};
		const htmlHoursPlural = renderNextSteps(sessionCompactingHoursPlural, "1.000", "1.073");
		expect(htmlHoursPlural).toContain("Vent 36 timer til (til dag 14 er fullført):");

		const sessionCompactingHoursSingular: Session = {
			...mockSession,
			status: Status.Aging,
			fining_state: {
				stage: "sediment_compacting",
				days_compacting: 13,
				days_remaining_to_compact: 1,
				hours_remaining_to_compact: 1,
				compaction_progress_pct: 99,
				sediment_phase: "compacting",
				safe_to_siphon: false,
				status_label: "Bunnfall komprimeres (Dag 14 av 14)",
			},
		};
		const htmlHoursSingular = renderNextSteps(sessionCompactingHoursSingular, "1.000", "1.073");
		expect(htmlHoursSingular).toContain("Vent 1 time til (til dag 14 er fullført):");
	});

	it("renders fining status badges on session cards", () => {
		const sessionCompacting: Session = {
			...mockSession,
			status: Status.Aging,
			fining_state: {
				stage: "sediment_compacting",
				days_compacting: 3,
				days_remaining_to_compact: 11,
				compaction_progress_pct: 21,
				sediment_phase: "loose",
				safe_to_siphon: false,
				status_label: "Bunnfall bunnfeller – løst lag (Dag 4 av 14)",
			},
		};
		const cardHtml = renderSessionCard(sessionCompacting);
		expect(cardHtml).toContain("Bunnfall komprimeres (Dag 4/14)");

		const sessionCompacted: Session = {
			...mockSession,
			status: Status.Aging,
			fining_state: {
				stage: "sediment_compacted",
				days_compacting: 14,
				days_remaining_to_compact: 0,
				compaction_progress_pct: 100,
				sediment_phase: "compacted",
				safe_to_siphon: true,
				status_label: "Kompakt bunnfall – trygt å heverte",
			},
		};
		const cardHtml2 = renderSessionCard(sessionCompacted);
		expect(cardHtml2).toContain("Kompakt bunnfall");
	});

	it("renders collapsible cards (Next Steps, Fermentation Curve) using details and collapse classes", () => {
		const detailHtml = renderSessionDetail(
			mockSession,
			mockEvents,
			mockInventory,
		);

		// Next Steps card is collapsible
		expect(detailHtml).toContain('<details class="collapse collapse-arrow');
		expect(detailHtml).toContain('id="next-steps-card"');
		expect(detailHtml).toContain('<summary class="collapse-title');
		expect(detailHtml).toContain('Neste steg');
		expect(detailHtml).toContain('<div class="collapse-content">');

		// Fermentation Curve card is collapsible
		expect(detailHtml).toContain('id="fermentation-curve-card"');
		expect(detailHtml).toContain('Gjæringskurve');

		// Backsweetening Guidance is collapsible
		expect(detailHtml).toContain('id="backsweetening-guidance-card"');

		// Clarification & Fining is collapsible
		expect(detailHtml).toContain('id="clarification-fining-card"');

		// Ingredients Used is collapsible
		expect(detailHtml).toContain('id="ingredients-used-card"');
	});

	it("renders Est. Volume stat and backsweetening batch volume when honey and OG are logged", () => {
		const honeyPantry: InventoryItem[] = [
			{
				id: 1,
				name: "Wildflower Honey",
				category: "Honey & Sugars",
				quantity_on_hand: 10,
				unit: "kg",
			},
			{
				id: 2,
				name: "Campden",
				category: "Nutrients & Additives",
				quantity_on_hand: 50,
				unit: "g",
			},
			{
				id: 3,
				name: "Sorbistat",
				category: "Nutrients & Additives",
				quantity_on_hand: 50,
				unit: "g",
			},
		];

		const batchEvents: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "addition",
				timestamp: "2026-08-01T10:00:00.000Z",
				data: { inventory_item_id: 1, quantity_used: 3.3, unit: "kg" },
			},
			{
				id: 2,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.110 },
			},
			{
				id: 3,
				session_id: 1,
				type: "addition",
				timestamp: "2026-08-20T12:00:00.000Z",
				data: { inventory_item_id: 2, quantity_used: 1, unit: "g" },
			},
			{
				id: 4,
				session_id: 1,
				type: "addition",
				timestamp: "2026-08-20T12:05:00.000Z",
				data: { inventory_item_id: 3, quantity_used: 2, unit: "g" },
			},
		];

		const html = renderSessionDetail(mockSession, batchEvents, honeyPantry);
		expect(html).toContain("Estimert volum");
		expect(html).toContain("~9.0 L");
		expect(html).toContain("Beregnet bryggvolum: <strong class=\"text-secondary\">~9.0 L</strong>");
	});

	it("renders delete button in the edit session name modal", () => {
		const html = renderSessionDetail(mockSession, mockEvents, mockInventory);
		expect(html).toContain('id="edit_session_name_modal"');
		expect(html).toContain('id="delete-session-btn"');
		expect(html).toContain(`hx-delete="/sessions/${mockSession.id}"`);
		expect(html).toContain("Slett");
	});
});

