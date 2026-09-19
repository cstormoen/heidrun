CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  target_sg REAL,
  type TEXT NOT NULL CHECK (type IN ('starter', 'custom')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sg_reading', 'addition', 'racking', 'bottling', 'ph_reading')),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  data TEXT, -- JSON field for extra details (e.g., {"sg": 1.100}, {"ingredient": "yeast"})
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Insert some starter recipes
INSERT INTO recipes (name, description, target_sg, type) 
SELECT 'Traditional Mead', '<strong>Traditional Mead</strong> (Target OG: 1.110 | ~14% ABV) Pure honey wine with delicate floral aromatics. Requires <strong>~1.8 kg honey per 5 L</strong>, Lalvin D-47 yeast, and a staggered nutrient schedule (SNA).', 1.110, 'starter'
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE name = 'Traditional Mead');

INSERT INTO recipes (name, description, target_sg, type) 
SELECT 'Melomel (Fruit Mead)', '<strong>Melomel / Fruit Mead</strong> (Target OG: 1.120 | ~15% ABV) Vibrant mead fermented with berries. Residual sweetness balances fruit acidity. Requires <strong>~2.0 kg honey + 1–1.5 kg fruit per 5 L</strong> with Lalvin 71B yeast.', 1.120, 'starter'
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE name = 'Melomel (Fruit Mead)');

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Honey & Sugars', 'Yeast & Cultures', 'Nutrients & Additives', 'Fruits & Adjuncts')),
  quantity_on_hand REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  cost_per_unit REAL,
  currency TEXT,
  url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
