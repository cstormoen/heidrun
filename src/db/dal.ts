import { Database } from "bun:sqlite";
import type { Session, Recipe, Event, InventoryItem } from "../domain/models";
import { convertUnits } from "../domain/models";
// Initialize SQLite database
const dbPath = process.env.DB_PATH || "mjod.sqlite";
const db = new Database(dbPath);

// Enable foreign keys
db.run("PRAGMA foreign_keys = ON;");

// Initialize schema if not exists
const schema = await Bun.file("src/db/schema.sql").text();
db.exec(schema);

export const DAL = {
  getRecipes: (): Recipe[] => {
    return db.query("SELECT * FROM recipes").all() as Recipe[];
  },

  getRecipeById: (id: number): Recipe | null => {
    return db.query("SELECT * FROM recipes WHERE id = $id").get({ $id: id }) as Recipe | null;
  },

  createSession: (recipeId: number, name: string): Session => {
    const query = db.query("INSERT INTO sessions (recipe_id, name) VALUES ($recipeId, $name) RETURNING *");
    return query.get({ $recipeId: recipeId, $name: name }) as Session;
  },

  getSessions: (): Session[] => {
    return db.query("SELECT * FROM sessions ORDER BY created_at DESC").all() as Session[];
  },

  getSessionById: (id: number): Session | null => {
    return db.query("SELECT * FROM sessions WHERE id = $id").get({ $id: id }) as Session | null;
  },

  updateSessionName: (id: number, name: string): void => {
    db.run("UPDATE sessions SET name = $name WHERE id = $id", {
      $id: id,
      $name: name
    });
  },

  getEventsForSession: (sessionId: number): Event[] => {
    const rawEvents = db.query("SELECT * FROM events WHERE session_id = $sessionId ORDER BY timestamp ASC").all({ $sessionId: sessionId }) as any[];
    return rawEvents.map(e => ({
      ...e,
      data: e.data ? JSON.parse(e.data) : null
    }));
  },

  getEventById: (id: number): Event | null => {
    const e = db.query("SELECT * FROM events WHERE id = $id").get({ $id: id }) as any;
    if (!e) return null;
    return {
      ...e,
      data: e.data ? JSON.parse(e.data) : null
    };
  },

  addEvent: (sessionId: number, type: string, data: any = null, timestamp?: string): Event => {
    // Deduct inventory if it's an addition and uses inventory
    if (type === 'addition' && data?.inventory_item_id && data?.quantity_used) {
      const invItem = DAL.getInventoryItemById(data.inventory_item_id);
      if (invItem) {
        const qtyToDeduct = convertUnits(data.quantity_used, data.unit || invItem.unit, invItem.unit);
        DAL.updateInventoryQuantity(invItem.id, -qtyToDeduct);
      }
    }

    const dataStr = data ? JSON.stringify(data) : null;
    let query;
    let params: any = { $sessionId: sessionId, $type: type, $data: dataStr };
    
    if (timestamp) {
      query = db.query("INSERT INTO events (session_id, type, data, timestamp) VALUES ($sessionId, $type, $data, $timestamp) RETURNING *");
      params.$timestamp = timestamp;
    } else {
      query = db.query("INSERT INTO events (session_id, type, data) VALUES ($sessionId, $type, $data) RETURNING *");
    }
    
    const rawEvent = query.get(params) as any;
    return {
      ...rawEvent,
      data: rawEvent.data ? JSON.parse(rawEvent.data) : null
    };
  },

  deleteEvent: (eventId: number): void => {
    const ev = DAL.getEventById(eventId);
    if (ev && ev.type === 'addition' && ev.data?.inventory_item_id && ev.data?.quantity_used) {
      // Refund inventory
      const invItem = DAL.getInventoryItemById(ev.data.inventory_item_id);
      if (invItem) {
        const qtyToRefund = convertUnits(ev.data.quantity_used, ev.data.unit || invItem.unit, invItem.unit);
        DAL.updateInventoryQuantity(invItem.id, qtyToRefund);
      }
    }

    db.run("DELETE FROM events WHERE id = $eventId", { $eventId: eventId });
  },

  updateEventData: (id: number, data: any): void => {
    db.run("UPDATE events SET data = $data WHERE id = $id", {
      $id: id,
      $data: JSON.stringify(data)
    });
  },

  updateEvent: (id: number, data: any, timestamp: string): void => {
    const oldEv = DAL.getEventById(id);
    // If it's a linked addition, and quantity changed, adjust inventory
    if (oldEv && oldEv.type === 'addition' && oldEv.data?.inventory_item_id && data?.inventory_item_id) {
       const oldQty = oldEv.data.quantity_used || 0;
       const newQty = data.quantity_used || 0;
       if (oldQty !== newQty) {
          const invItem = DAL.getInventoryItemById(data.inventory_item_id);
          if (invItem) {
             const oldBase = convertUnits(oldQty, oldEv.data.unit || invItem.unit, invItem.unit);
             const newBase = convertUnits(newQty, data.unit || invItem.unit, invItem.unit);
             const diff = newBase - oldBase;
             DAL.updateInventoryQuantity(invItem.id, -diff);
          }
       }
    }
    db.run("UPDATE events SET data = $data, timestamp = $timestamp WHERE id = $id", {
      $id: id,
      $data: JSON.stringify(data),
      $timestamp: timestamp
    });
  },

  getInventoryItems: (): InventoryItem[] => {
    return db.query("SELECT * FROM inventory ORDER BY category, name").all() as InventoryItem[];
  },

  getInventoryItemById: (id: number): InventoryItem | null => {
    return db.query("SELECT * FROM inventory WHERE id = $id").get({ $id: id }) as InventoryItem | null;
  },

  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'created_at'>): InventoryItem => {
    const query = db.query(`
      INSERT INTO inventory (name, category, quantity_on_hand, unit, cost_per_unit, currency, url)
      VALUES ($name, $category, $quantity, $unit, $cost, $currency, $url) RETURNING *
    `);
    return query.get({
      $name: item.name,
      $category: item.category,
      $quantity: item.quantity_on_hand,
      $unit: item.unit,
      $cost: item.cost_per_unit || null,
      $currency: item.currency || null,
      $url: item.url || null
    }) as InventoryItem;
  },

  updateInventoryItem: (id: number, item: Partial<InventoryItem>): void => {
    const existing = DAL.getInventoryItemById(id);
    if (!existing) return;
    
    db.run(`
      UPDATE inventory 
      SET name = $name, category = $category, quantity_on_hand = $quantity, unit = $unit, cost_per_unit = $cost, currency = $currency, url = $url
      WHERE id = $id
    `, {
      $id: id,
      $name: item.name !== undefined ? item.name : existing.name,
      $category: item.category !== undefined ? item.category : existing.category,
      $quantity: item.quantity_on_hand !== undefined ? item.quantity_on_hand : existing.quantity_on_hand,
      $unit: item.unit !== undefined ? item.unit : existing.unit,
      $cost: item.cost_per_unit !== undefined ? item.cost_per_unit : existing.cost_per_unit,
      $currency: item.currency !== undefined ? item.currency : existing.currency,
      $url: item.url !== undefined ? item.url : existing.url,
    });
  },

  deleteInventoryItem: (id: number): void => {
    db.run("DELETE FROM inventory WHERE id = $id", { $id: id });
  },

  updateInventoryQuantity: (id: number, delta: number): void => {
    db.run("UPDATE inventory SET quantity_on_hand = quantity_on_hand + $delta WHERE id = $id", {
      $id: id,
      $delta: delta
    });
  }
};
