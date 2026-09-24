import { describe, expect, it } from "bun:test";
import {
	Status,
	deriveSessionState,
	type Event,
	getFiningState,
	type InventoryItem,
	isChitosanText,
	isKieselsolText,
	type Session,
} from "../models";

describe("Clarification & Fining Detection", () => {
	it("recognizes Kieselsol and Super-Kleer Part 1 in ingredient names, inventory, or notes", () => {
		expect(isKieselsolText("Kieselsol")).toBe(true);
		expect(isKieselsolText("Super-Kleer Part 1 (Kieselsol [-])")).toBe(true);
		expect(isKieselsolText("Super-Kleer Part A")).toBe(true);
		expect(isKieselsolText("Silica Sol addition")).toBe(true);
		expect(isKieselsolText("Fining Agent 1")).toBe(true);
		expect(isKieselsolText("Honey")).toBe(false);
		expect(isKieselsolText("Chitosan")).toBe(false);
	});

	it("recognizes Chitosan and Super-Kleer Part 2 in ingredient names, inventory, or notes", () => {
		expect(isChitosanText("Chitosan")).toBe(true);
		expect(isChitosanText("Super-Kleer Part 2 (Chitosan [+])")).toBe(true);
		expect(isChitosanText("Super-Kleer Part B")).toBe(true);
		expect(isChitosanText("Fining Agent 2")).toBe(true);
		expect(isChitosanText("Campden")).toBe(false);
		expect(isChitosanText("Kieselsol")).toBe(false);
	});
});

describe("Fining Schedule & Sediment Compaction Countdown (getFiningState)", () => {
	const baseDate = new Date("2026-09-01T12:00:00.000Z").getTime();

	const mockInventory: InventoryItem[] = [
		{
			id: 20,
			name: "Super-Kleer K.C. - Kieselsol (Part 1)",
			category: "Nutrients & Additives",
			quantity_on_hand: 50,
			unit: "ml",
		},
		{
			id: 21,
			name: "Super-Kleer K.C. - Chitosan (Part 2)",
			category: "Nutrients & Additives",
			quantity_on_hand: 50,
			unit: "ml",
		},
	];

	it("returns stage 'none' when no fining additions are logged", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "addition",
				timestamp: "2026-09-01T12:00:00.000Z",
				data: { ingredient: "Fermaid O", quantity_used: 4, unit: "g" },
			},
		];
		const state = getFiningState(events, mockInventory, baseDate);
		expect(state.stage).toBe("none");
		expect(state.sediment_phase).toBe("none");
		expect(state.safe_to_siphon).toBe(false);
	});

	it("identifies Kieselsol addition and calculates countdown before 12h window opens", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "addition",
				timestamp: "2026-09-01T12:00:00.000Z",
				data: {
					inventory_item_id: 20,
					quantity_used: 15,
					unit: "ml",
				},
			},
		];

		// 4 hours after Kieselsol addition
		const now4h = baseDate + 4 * 60 * 60 * 1000;
		const state4h = getFiningState(events, mockInventory, now4h);

		expect(state4h.stage).toBe("kieselsol_added");
		expect(state4h.hours_since_kieselsol).toBe(4);
		expect(state4h.hours_until_chitosan_window).toBe(8);
		expect(state4h.sediment_phase).toBe("none");
		expect(state4h.safe_to_siphon).toBe(false);
		expect(state4h.kieselsol_event).toBeDefined();
	});

	it("identifies when the 12–24h Chitosan window is open", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "addition",
				timestamp: "2026-09-01T12:00:00.000Z",
				data: {
					ingredient: "Kieselsol (Super-Kleer Part 1)",
					quantity_used: 15,
					unit: "ml",
				},
			},
		];

		// 16 hours after Kieselsol addition
		const now16h = baseDate + 16 * 60 * 60 * 1000;
		const state16h = getFiningState(events, undefined, now16h);

		expect(state16h.stage).toBe("chitosan_ready");
		expect(state16h.hours_since_kieselsol).toBe(16);
		expect(state16h.hours_remaining_in_chitosan_window).toBe(8);
		expect(state16h.safe_to_siphon).toBe(false);
	});

	it("identifies when the 12–24h Chitosan window is overdue (>24h)", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "addition",
				timestamp: "2026-09-01T12:00:00.000Z",
				data: {
					ingredient: "Kieselsol",
					quantity_used: 15,
					unit: "ml",
				},
			},
		];

		// 30 hours after Kieselsol addition
		const now30h = baseDate + 30 * 60 * 60 * 1000;
		const state30h = getFiningState(events, undefined, now30h);

		expect(state30h.stage).toBe("chitosan_overdue");
		expect(state30h.hours_since_kieselsol).toBe(30);
		expect(state30h.safe_to_siphon).toBe(false);
	});

	it("tracks sediment compaction countdown when Chitosan is added (Days 0–6: loose sediment bed)", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "addition",
				timestamp: "2026-09-01T12:00:00.000Z",
				data: { ingredient: "Kieselsol", quantity_used: 15, unit: "ml" },
			},
			{
				id: 2,
				session_id: 1,
				type: "addition",
				timestamp: "2026-09-02T04:00:00.000Z", // 16 hours later
				data: { ingredient: "Chitosan", quantity_used: 50, unit: "ml" },
			},
		];

		const chitosanTime = new Date("2026-09-02T04:00:00.000Z").getTime();
		// Day 3 of compaction
		const nowDay3 = chitosanTime + 3 * 24 * 60 * 60 * 1000 + 3600000;
		const stateDay3 = getFiningState(events, undefined, nowDay3);

		expect(stateDay3.stage).toBe("sediment_compacting");
		expect(stateDay3.sediment_phase).toBe("loose");
		expect(stateDay3.days_compacting).toBe(3);
		expect(stateDay3.days_remaining_to_compact).toBe(11);
		expect(stateDay3.hours_remaining_to_compact).toBe(263);
		expect(stateDay3.compaction_progress_pct).toBe(Math.round((3 / 14) * 100));
		expect(stateDay3.safe_to_siphon).toBe(false);
		expect(stateDay3.status_label).toContain("Dag 4 av 14");
	});

	it("tracks compaction progress during days 7–13 (compacting phase)", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "addition",
				timestamp: "2026-09-01T12:00:00.000Z",
				data: { ingredient: "Kieselsol", quantity_used: 15, unit: "ml" },
			},
			{
				id: 2,
				session_id: 1,
				type: "addition",
				timestamp: "2026-09-02T04:00:00.000Z",
				data: { ingredient: "Chitosan", quantity_used: 50, unit: "ml" },
			},
		];

		const chitosanTime = new Date("2026-09-02T04:00:00.000Z").getTime();
		// Day 9 of compaction
		const nowDay9 = chitosanTime + 9 * 24 * 60 * 60 * 1000;
		const stateDay9 = getFiningState(events, undefined, nowDay9);

		expect(stateDay9.stage).toBe("sediment_compacting");
		expect(stateDay9.sediment_phase).toBe("compacting");
		expect(stateDay9.days_compacting).toBe(9);
		expect(stateDay9.days_remaining_to_compact).toBe(5);
		expect(stateDay9.hours_remaining_to_compact).toBe(120);
		expect(stateDay9.safe_to_siphon).toBe(false);
		expect(stateDay9.status_label).toContain("Dag 10 av 14");
	});

	it("confirms tight sediment bed compaction at Day 14+ and marks safe to siphon", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "addition",
				timestamp: "2026-09-01T12:00:00.000Z",
				data: { ingredient: "Kieselsol", quantity_used: 15, unit: "ml" },
			},
			{
				id: 2,
				session_id: 1,
				type: "addition",
				timestamp: "2026-09-02T04:00:00.000Z",
				data: { ingredient: "Chitosan", quantity_used: 50, unit: "ml" },
			},
		];

		const chitosanTime = new Date("2026-09-02T04:00:00.000Z").getTime();
		// Day 14 of compaction
		const nowDay14 = chitosanTime + 14 * 24 * 60 * 60 * 1000 + 10000;
		const stateDay14 = getFiningState(events, undefined, nowDay14);

		expect(stateDay14.stage).toBe("sediment_compacted");
		expect(stateDay14.sediment_phase).toBe("compacted");
		expect(stateDay14.days_compacting).toBe(14);
		expect(stateDay14.days_remaining_to_compact).toBe(0);
		expect(stateDay14.hours_remaining_to_compact).toBe(0);
		expect(stateDay14.compaction_progress_pct).toBe(100);
		expect(stateDay14.safe_to_siphon).toBe(true);
		expect(stateDay14.status_label).toContain("trygt å heverte");
	});

	it("correctly distinguishes Kieselsol and Chitosan when using combo pack inventory item with notes", () => {
		const comboInventory: InventoryItem[] = [
			{
				id: 6,
				name: "Super-Kleer (Kieselsol & Kitosan)",
				category: "Nutrients & Additives",
				quantity_on_hand: 2,
				unit: "pk",
			},
		];

		const events: Event[] = [
			{
				id: 39,
				session_id: 1,
				type: "addition",
				timestamp: "2026-09-08T17:00:00.000Z",
				data: {
					inventory_item_id: 6,
					note: "Kieselsol",
					quantity_used: 1,
					unit: "pk",
				},
			},
			{
				id: 40,
				session_id: 1,
				type: "addition",
				timestamp: "2026-09-09T20:00:00.000Z",
				data: {
					inventory_item_id: 6,
					note: "Kitosan",
					quantity_used: 1,
					unit: "pk",
				},
			},
		];

		const state = getFiningState(events, comboInventory, new Date("2026-09-10T12:00:00.000Z").getTime());

		expect(state.kieselsol_time).toBe("2026-09-08T17:00:00.000Z");
		expect(state.chitosan_time).toBe("2026-09-09T20:00:00.000Z");
		expect(state.kieselsol_event?.id).toBe(39);
		expect(state.chitosan_event?.id).toBe(40);
	});
});

describe("deriveSessionState fining integration", () => {
	const baseSession: Session = {
		id: 5,
		name: "Fining Test Batch",
		recipe_id: 1,
		created_at: "2026-08-01T00:00:00.000Z",
	};

	it("automatically populates fining_state on derived session", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 5,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.100 },
			},
			{
				id: 2,
				session_id: 5,
				type: "sg_reading",
				timestamp: "2026-08-20T12:00:00.000Z",
				data: { sg: 1.000 },
			},
			{
				id: 3,
				session_id: 5,
				type: "sg_reading",
				timestamp: "2026-08-27T12:00:00.000Z",
				data: { sg: 1.000 },
			},
			{
				id: 4,
				session_id: 5,
				type: "addition",
				timestamp: "2026-08-28T10:00:00.000Z",
				data: { ingredient: "Kieselsol (Super-Kleer Part 1)", quantity_used: 15, unit: "ml" },
			},
			{
				id: 5,
				session_id: 5,
				type: "addition",
				timestamp: "2026-08-29T02:00:00.000Z", // 16 hours later
				data: { ingredient: "Chitosan (Super-Kleer Part 2)", quantity_used: 50, unit: "ml" },
			},
		];

		const now = new Date("2026-09-08T02:00:00.000Z").getTime(); // 10 days of compaction
		const derived = deriveSessionState(baseSession, events, undefined, now);

		expect(derived.status).toBe(Status.Aging);
		expect(derived.is_gravity_stable).toBe(true);
		expect(derived.fining_state).toBeDefined();
		expect(derived.fining_state?.stage).toBe("sediment_compacting");
		expect(derived.fining_state?.days_compacting).toBe(10);
		expect(derived.fining_state?.sediment_phase).toBe("compacting");
		expect(derived.fining_state?.safe_to_siphon).toBe(false);
	});
});
