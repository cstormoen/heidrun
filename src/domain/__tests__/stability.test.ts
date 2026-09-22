import { describe, expect, it } from "bun:test";
import {
	calculateEstimatedBatchVolume,
	checkChemicalStabilization,
	checkGravityStability,
	deriveSessionState,
	type Event,
	type InventoryItem,
	type Session,
} from "../models";

describe("Gravity Stability (is_gravity_stable)", () => {
	const baseSession: Session = {
		id: 1,
		name: "Test Mead",
		recipe_id: 1,
		created_at: "2026-08-01T00:00:00.000Z",
	};

	it("returns false when there are fewer than 2 SG readings", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.100 },
			},
		];
		expect(checkGravityStability(events)).toBe(false);

		const derived = deriveSessionState(baseSession, events);
		expect(derived.is_gravity_stable).toBe(false);
		expect(derived.status).toBe("Primary Fermentation");
	});

	it("returns false when two identical SG readings are less than 7 days apart", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.000 },
			},
			{
				id: 2,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-04T12:00:00.000Z", // 3 days later
				data: { sg: 1.000 },
			},
		];
		expect(checkGravityStability(events)).toBe(false);

		const derived = deriveSessionState(baseSession, events);
		expect(derived.is_gravity_stable).toBe(false);
		expect(derived.status).toBe("Primary Fermentation");
	});

	it("returns false when readings are 7+ days apart but SG values differ", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.050 },
			},
			{
				id: 2,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-09T12:00:00.000Z", // 8 days later
				data: { sg: 1.020 },
			},
		];
		expect(checkGravityStability(events)).toBe(false);

		const derived = deriveSessionState(baseSession, events);
		expect(derived.is_gravity_stable).toBe(false);
		expect(derived.status).toBe("Primary Fermentation");
	});

	it("returns true when two identical SG readings are logged >= 7 days apart and transitions status to Aging", () => {
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
				timestamp: "2026-08-15T12:00:00.000Z",
				data: { sg: 1000 }, // Normalized to 1.000
			},
			{
				id: 3,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-22T12:00:00.000Z", // 7 days later
				data: { sg: 1.000 },
			},
		];
		expect(checkGravityStability(events)).toBe(true);

		const derived = deriveSessionState(baseSession, events);
		expect(derived.is_gravity_stable).toBe(true);
		expect(derived.status).toBe("Aging");
	});

	it("handles intermediate readings correctly and ensures stability across the entire window", () => {
		// Day 1: 1.010, Day 4: 1.005, Day 8: 1.010 -> not stable because intermediate was different
		const unsteadyEvents: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.010 },
			},
			{
				id: 2,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-04T12:00:00.000Z",
				data: { sg: 1.005 },
			},
			{
				id: 3,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-09T12:00:00.000Z", // 8 days after day 1
				data: { sg: 1.010 },
			},
		];
		expect(checkGravityStability(unsteadyEvents)).toBe(false);

		// Consistent intermediate readings
		const steadyEvents: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.000 },
			},
			{
				id: 2,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-04T12:00:00.000Z",
				data: { sg: 1.000 },
			},
			{
				id: 3,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-08T12:00:00.000Z", // 7 days after day 1
				data: { sg: 1.000 },
			},
		];
		expect(checkGravityStability(steadyEvents)).toBe(true);
	});

	it("preserves Bottled status even if gravity is stable", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.000 },
			},
			{
				id: 2,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-08T12:00:00.000Z",
				data: { sg: 1.000 },
			},
			{
				id: 3,
				session_id: 1,
				type: "bottling",
				timestamp: "2026-08-10T12:00:00.000Z",
				data: {},
			},
		];
		const derived = deriveSessionState(baseSession, events);
		expect(derived.is_gravity_stable).toBe(true);
		expect(derived.status).toBe("Bottled");
	});
});

describe("Chemical Stabilization (is_chemically_stabilized)", () => {
	const baseSession: Session = {
		id: 2,
		name: "Stabilization Test Batch",
		recipe_id: 1,
		created_at: "2026-08-01T00:00:00.000Z",
	};

	const mockInventory: InventoryItem[] = [
		{
			id: 10,
			name: "Campden Tablets",
			category: "Nutrients & Additives",
			quantity_on_hand: 50,
			unit: "g",
		},
		{
			id: 11,
			name: "Sorbistat-K (Potassium Sorbate)",
			category: "Nutrients & Additives",
			quantity_on_hand: 50,
			unit: "g",
		},
		{
			id: 12,
			name: "Fermaid O",
			category: "Nutrients & Additives",
			quantity_on_hand: 100,
			unit: "g",
		},
	];

	it("returns false when no additions are logged or only nutrients are added", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 2,
				type: "addition",
				timestamp: "2026-08-02T12:00:00.000Z",
				data: {
					inventory_item_id: 12, // Fermaid O
					quantity_used: 5,
					unit: "g",
				},
			},
		];
		expect(checkChemicalStabilization(events, mockInventory)).toBe(false);

		const derived = deriveSessionState(baseSession, events, mockInventory);
		expect(derived.is_chemically_stabilized).toBe(false);
	});

	it("returns false if ONLY sulfite (Campden) is added without sorbate", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 2,
				type: "addition",
				timestamp: "2026-08-15T12:00:00.000Z",
				data: {
					ingredient: "Campden",
					quantity_used: 1,
					unit: "g",
				},
			},
		];
		expect(checkChemicalStabilization(events)).toBe(false);

		const derived = deriveSessionState(baseSession, events);
		expect(derived.is_chemically_stabilized).toBe(false);
	});

	it("returns false if ONLY sorbate (Sorbistat) is added without sulfite", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 2,
				type: "addition",
				timestamp: "2026-08-15T12:00:00.000Z",
				data: {
					ingredient: "Potassium Sorbate",
					quantity_used: 1.5,
					unit: "g",
				},
			},
		];
		expect(checkChemicalStabilization(events)).toBe(false);

		const derived = deriveSessionState(baseSession, events);
		expect(derived.is_chemically_stabilized).toBe(false);
	});

	it("returns true when both Campden and Sorbistat are added via separate events (linked to inventory)", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 2,
				type: "addition",
				timestamp: "2026-08-15T12:00:00.000Z",
				data: {
					inventory_item_id: 10, // Campden Tablets
					quantity_used: 1,
					unit: "g",
				},
			},
			{
				id: 2,
				session_id: 2,
				type: "addition",
				timestamp: "2026-08-15T12:05:00.000Z",
				data: {
					inventory_item_id: 11, // Sorbistat-K
					quantity_used: 1.5,
					unit: "g",
				},
			},
		];
		expect(checkChemicalStabilization(events, mockInventory)).toBe(true);

		const derived = deriveSessionState(baseSession, events, mockInventory);
		expect(derived.is_chemically_stabilized).toBe(true);
	});

	it("returns true when stabilizer ingredients are logged in a single combined addition event", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 2,
				type: "addition",
				timestamp: "2026-08-15T12:00:00.000Z",
				data: {
					ingredient: "Campden & Potassium Sorbate",
					quantity_used: 2.5,
					unit: "g",
					note: "Full chemical stabilization before backsweetening",
				},
			},
		];
		expect(checkChemicalStabilization(events)).toBe(true);

		const derived = deriveSessionState(baseSession, events);
		expect(derived.is_chemically_stabilized).toBe(true);
	});
});

describe("Backsweetening Tracking & SG Delta Approximation", () => {
	const mockPantry: InventoryItem[] = [
		{
			id: 1,
			name: "Wildflower Honey",
			category: "Honey & Sugars",
			quantity_on_hand: 5,
			unit: "kg",
		},
		{
			id: 2,
			name: "Campden",
			category: "Nutrients & Additives",
			quantity_on_hand: 10,
			unit: "g",
		},
		{
			id: 3,
			name: "Sorbistat",
			category: "Nutrients & Additives",
			quantity_on_hand: 10,
			unit: "g",
		},
	];

	const baseSession: Session = {
		id: 10,
		name: "Backsweeten Batch",
		recipe_id: 1,
		created_at: "2026-08-01T00:00:00.000Z",
	};

	it("identifies backsweetening events logged after chemical stabilization and computes measured and estimated SG deltas", () => {
		const events: Event[] = [
			// Initial must
			{
				id: 1,
				session_id: 10,
				type: "addition",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: {
					inventory_item_id: 1,
					quantity_used: 3.3,
					unit: "kg",
				},
			},
			{
				id: 2,
				session_id: 10,
				type: "sg_reading",
				timestamp: "2026-08-01T12:30:00.000Z",
				data: { sg: 1.110 },
			},
			// Ferments dry
			{
				id: 3,
				session_id: 10,
				type: "sg_reading",
				timestamp: "2026-08-20T12:00:00.000Z",
				data: { sg: 1.000 },
			},
			// Stabilizers added
			{
				id: 4,
				session_id: 10,
				type: "addition",
				timestamp: "2026-08-31T12:00:00.000Z",
				data: {
					inventory_item_id: 2, // Campden
					quantity_used: 1,
					unit: "g",
				},
			},
			{
				id: 5,
				session_id: 10,
				type: "addition",
				timestamp: "2026-08-31T12:05:00.000Z",
				data: {
					inventory_item_id: 3, // Sorbistat
					quantity_used: 2,
					unit: "g",
				},
			},
			// Pre-backsweeten SG reading
			{
				id: 6,
				session_id: 10,
				type: "sg_reading",
				timestamp: "2026-09-03T16:00:00.000Z",
				data: { sg: 1.000 },
			},
			// Backsweetening addition
			{
				id: 7,
				session_id: 10,
				type: "addition",
				timestamp: "2026-09-03T17:00:00.000Z",
				data: {
					inventory_item_id: 1,
					quantity_used: 0.358,
					unit: "kg",
					note: "Ettersøting (Backsweetening)",
				},
			},
			// Post-backsweeten SG reading
			{
				id: 8,
				session_id: 10,
				type: "sg_reading",
				timestamp: "2026-09-06T12:00:00.000Z",
				data: { sg: 1.005 },
			},
		];

		const derived = deriveSessionState(baseSession, events, mockPantry);

		expect(derived.is_chemically_stabilized).toBe(true);
		expect(derived.backsweetening_events).toBeDefined();
		expect(derived.backsweetening_events?.length).toBe(1);

		const bs = derived.backsweetening_events![0];
		expect(bs.ingredient).toBe("Wildflower Honey");
		expect(bs.quantity_used).toBe(0.358);
		expect(bs.unit).toBe("kg");
		expect(bs.note).toBe("Ettersøting (Backsweetening)");

		// Measured SG change: 1.000 -> 1.005 = +0.005
		expect(bs.measured_sg_before).toBe(1.000);
		expect(bs.measured_sg_after).toBe(1.005);
		expect(bs.measured_sg_delta).toBe(0.005);

		// Estimated SG impact (~0.011 based on 358g in ~9L batch)
		expect(bs.estimated_sg_delta).toBeGreaterThan(0.008);
		expect(bs.estimated_sg_delta).toBeLessThan(0.015);

		// Estimated batch volume derived from 3.3 kg honey and 1.110 OG
		expect(derived.estimated_batch_volume).toBe(9.0);
	});
});

describe("Batch Volume Calculation (calculateEstimatedBatchVolume)", () => {
	const mockPantry: InventoryItem[] = [
		{ id: 1, name: "Wildflower Honey", category: "Honey & Sugars", quantity_on_hand: 5, unit: "kg" },
	];

	it("calculates volume accurately based on honey mass and OG", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "addition",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { inventory_item_id: 1, quantity_used: 3.0, unit: "kg" },
			},
		];
		// (3.0 kg * 300) / 95 = 9.47 -> 9.5 L
		const vol = calculateEstimatedBatchVolume(events, mockPantry, 1.095);
		expect(vol).toBe(9.5);
	});

	it("returns undefined if OG is missing or too low", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "addition",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { inventory_item_id: 1, quantity_used: 3.0, unit: "kg" },
			},
		];
		expect(calculateEstimatedBatchVolume(events, mockPantry, undefined)).toBeUndefined();
		expect(calculateEstimatedBatchVolume(events, mockPantry, 1.005)).toBeUndefined();
	});

	it("returns undefined if no honey or sugar was added", () => {
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "sg_reading",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { sg: 1.100 },
			},
		];
		expect(calculateEstimatedBatchVolume(events, mockPantry, 1.100)).toBeUndefined();
	});

	it("excludes sugar additions logged after stabilization", () => {
		const stabilizationTime = new Date("2026-08-15T12:00:00.000Z").getTime();
		const events: Event[] = [
			{
				id: 1,
				session_id: 1,
				type: "addition",
				timestamp: "2026-08-01T12:00:00.000Z",
				data: { inventory_item_id: 1, quantity_used: 3.0, unit: "kg" },
			},
			{
				id: 2,
				session_id: 1,
				type: "addition",
				timestamp: "2026-08-20T12:00:00.000Z", // After stabilization
				data: { inventory_item_id: 1, quantity_used: 1.0, unit: "kg" },
			},
		];
		const vol = calculateEstimatedBatchVolume(events, mockPantry, 1.095, stabilizationTime);
		expect(vol).toBe(9.5); // Still calculated on 3.0 kg, not 4.0 kg
	});
});
