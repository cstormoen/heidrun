import { describe, expect, it } from "bun:test";
import { DAL } from "../dal";

describe("DAL session operations", () => {
	it("creates and deletes a session, removing associated events", () => {
		const session = DAL.createSession(1, "Test Batch For Deletion");
		expect(session.id).toBeDefined();

		// Add an event
		DAL.addEvent(session.id, "sg_reading", { sg: 1.100 }, new Date().toISOString());
		const eventsBefore = DAL.getEventsForSession(session.id);
		expect(eventsBefore.length).toBe(1);

		// Delete session
		const deleted = DAL.deleteSession(session.id);
		expect(deleted).toBe(true);

		// Verify session is gone
		const fetched = DAL.getSessionById(session.id);
		expect(fetched).toBeNull();

		// Verify events are gone
		const eventsAfter = DAL.getEventsForSession(session.id);
		expect(eventsAfter.length).toBe(0);
	});

	it("refunds inventory when deleting a session with linked additions", () => {
		// Create inventory item
		const inv = DAL.addInventoryItem({
			name: "Test Delete Honning",
			category: "Honning og sukker",
			quantity_on_hand: 10,
			unit: "kg",
		});

		const session = DAL.createSession(1, "Test Batch With Inventory");
		// Add an addition event that uses 2 kg
		const event = DAL.addEvent(
			session.id,
			"addition",
			{ ingredient: "Honning", inventory_item_id: inv.id, quantity_used: 2, unit: "kg" },
			new Date().toISOString(),
		);

		// Inventory before deletion should be 8 kg
		const invBefore = DAL.getInventoryItemById(inv.id);
		expect(invBefore?.quantity_on_hand).toBe(8);

		// Delete the session
		DAL.deleteSession(session.id);

		// Inventory should now be refunded to 10 kg
		const invAfter = DAL.getInventoryItemById(inv.id);
		expect(invAfter?.quantity_on_hand).toBe(10);

		// Cleanup inventory
		DAL.deleteInventoryItem(inv.id);
	});

	it("returns false when deleting a non-existent session", () => {
		const deleted = DAL.deleteSession(999999);
		expect(deleted).toBe(false);
	});
});
