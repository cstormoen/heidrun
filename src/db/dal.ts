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

// Ensure events table schema includes 'ph_reading' and 'comment' in CHECK constraint
try {
  const eventsTable = db.query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'events'").get() as { sql: string } | null;
  if (eventsTable && eventsTable.sql && (!eventsTable.sql.includes("'ph_reading'") || !eventsTable.sql.includes("'comment'"))) {
    db.run("PRAGMA foreign_keys = OFF;");
    db.run(`
      CREATE TABLE events_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('sg_reading', 'addition', 'racking', 'bottling', 'ph_reading', 'comment')),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        data TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
    `);
    db.run("INSERT INTO events_new (id, session_id, type, timestamp, data) SELECT id, session_id, type, timestamp, data FROM events;");
    db.run("DROP TABLE events;");
    db.run("ALTER TABLE events_new RENAME TO events;");
    db.run("PRAGMA foreign_keys = ON;");
  }
} catch (err) {
  console.error("Migration error for events table:", err);
}

// Migrate inventory categories and recipes to Norwegian
try {
  const invTable = db.query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'inventory'").get() as { sql: string } | null;
  if (invTable && invTable.sql && !invTable.sql.includes("'Honning og sukker'")) {
    db.run("PRAGMA foreign_keys = OFF;");
    db.run("DROP TABLE IF EXISTS inventory_new;");
    db.run(`
      CREATE TABLE inventory_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('Honning og sukker', 'Gjær og kulturer', 'Gjærnæring og tilsetninger', 'Frukt, bær og krydder')),
        quantity_on_hand REAL NOT NULL DEFAULT 0,
        unit TEXT NOT NULL,
        cost_per_unit REAL,
        currency TEXT,
        url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.run(`
      INSERT INTO inventory_new (id, name, category, quantity_on_hand, unit, cost_per_unit, currency, url, created_at)
      SELECT 
        id, 
        name, 
        CASE category
          WHEN 'Honey & Sugars' THEN 'Honning og sukker'
          WHEN 'Yeast & Cultures' THEN 'Gjær og kulturer'
          WHEN 'Nutrients & Additives' THEN 'Gjærnæring og tilsetninger'
          WHEN 'Fruits & Adjuncts' THEN 'Frukt, bær og krydder'
          ELSE category
        END, 
        quantity_on_hand, 
        unit, 
        cost_per_unit, 
        currency, 
        url, 
        created_at 
      FROM inventory;
    `);
    db.run("DROP TABLE inventory;");
    db.run("ALTER TABLE inventory_new RENAME TO inventory;");
    db.run("PRAGMA foreign_keys = ON;");
  }

  // Update starter recipes if in English
  db.run(`
    UPDATE recipes 
    SET name = 'Tradisjonell mjød', 
        description = '<strong>Tradisjonell mjød</strong> (Mål-OG: 1.110 | ~14 % ABV) Ren honningvin med milde florale aromaer. Krever <strong>~1,8 kg honning per 5 L</strong>, Lalvin D-47 gjær og trinnvis gjærnæringstilsats (SNA).' 
    WHERE name = 'Traditional Mead';
  `);
  db.run(`
    UPDATE recipes 
    SET name = 'Melomel (Fruktmjød)', 
        description = '<strong>Melomel (Fruktmjød)</strong> (Mål-OG: 1.120 | ~15 % ABV) Frisk mjød gjæret med bær. Restsødme balanserer fruktsyren. Krever <strong>~2,0 kg honning + 1–1,5 kg bær/frukt per 5 L</strong> med Lalvin 71B gjær.' 
    WHERE name = 'Melomel (Fruit Mead)';
  `);
} catch (err) {
  console.error("Migration error for inventory/recipes tables:", err);
}

export const DAL = {
  getRecipes: (): Recipe[] => {
    return db.query("SELECT * FROM recipes ORDER BY id ASC").all() as Recipe[];
  },

  getRecipeById: (id: number): Recipe | null => {
    return db.query("SELECT * FROM recipes WHERE id = $id").get({ $id: id }) as Recipe | null;
  },

  createRecipe: (data: {
    name: string;
    description?: string | null;
    target_sg?: number | null;
  }): Recipe => {
    const query = db.query(
      "INSERT INTO recipes (name, description, target_sg, type) VALUES ($name, $description, $target_sg, 'custom') RETURNING *"
    );
    return query.get({
      $name: data.name,
      $description: data.description ?? null,
      $target_sg: data.target_sg ?? null,
    }) as Recipe;
  },

  updateRecipe: (
    id: number,
    data: {
      name?: string;
      description?: string | null;
      target_sg?: number | null;
    }
  ): Recipe | null => {
    const existing = DAL.getRecipeById(id);
    if (!existing || existing.type !== "custom") {
      return null;
    }
    const name = data.name !== undefined ? data.name : existing.name;
    const description =
      data.description !== undefined ? data.description : existing.description;
    const target_sg =
      data.target_sg !== undefined ? data.target_sg : existing.target_sg;

    db.run(
      "UPDATE recipes SET name = $name, description = $description, target_sg = $target_sg WHERE id = $id AND type = 'custom'",
      {
        $id: id,
        $name: name,
        $description: description ?? null,
        $target_sg: target_sg ?? null,
      }
    );
    return DAL.getRecipeById(id);
  },

  deleteRecipe: (id: number): boolean => {
    const existing = DAL.getRecipeById(id);
    if (!existing || existing.type !== "custom") {
      return false;
    }
    db.run("UPDATE sessions SET recipe_id = NULL WHERE recipe_id = $id", {
      $id: id,
    });
    db.run("DELETE FROM recipes WHERE id = $id AND type = 'custom'", {
      $id: id,
    });
    return true;
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

  deleteSession: (id: number): boolean => {
    const session = DAL.getSessionById(id);
    if (!session) return false;

    const events = DAL.getEventsForSession(id);
    for (const ev of events) {
      DAL.deleteEvent(ev.id);
    }

    db.run("DELETE FROM sessions WHERE id = $id", {
      $id: id,
    });
    return true;
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

  updateEvent: (id: number, data: any, timestamp: string, type?: string): void => {
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
    if (type) {
      db.run("UPDATE events SET data = $data, timestamp = $timestamp, type = $type WHERE id = $id", {
        $id: id,
        $data: JSON.stringify(data),
        $timestamp: timestamp,
        $type: type
      });
    } else {
      db.run("UPDATE events SET data = $data, timestamp = $timestamp WHERE id = $id", {
        $id: id,
        $data: JSON.stringify(data),
        $timestamp: timestamp
      });
    }
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
