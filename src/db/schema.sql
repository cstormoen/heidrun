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
  type TEXT NOT NULL CHECK (type IN ('sg_reading', 'addition', 'racking', 'bottling', 'ph_reading', 'comment')),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  data TEXT, -- JSON field for extra details (e.g., {"sg": 1.100}, {"ingredient": "yeast"})
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Insert some starter recipes
INSERT INTO recipes (name, description, target_sg, type) 
SELECT 'Tradisjonell mjød', '<strong>Tradisjonell mjød</strong> (Mål-OG: 1.110 | ~14 % ABV) Ren honningvin med milde florale aromaer. Krever <strong>~1,8 kg honning per 5 L</strong>, Lalvin D-47 gjær og trinnvis gjærnæringstilsats (SNA).', 1.110, 'starter'
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE name IN ('Traditional Mead', 'Tradisjonell mjød'));

INSERT INTO recipes (name, description, target_sg, type) 
SELECT 'Melomel (Fruktmjød)', '<strong>Melomel (Fruktmjød)</strong> (Mål-OG: 1.120 | ~15 % ABV) Frisk mjød gjæret med bær. Restsødme balanserer fruktsyren. Krever <strong>~2,0 kg honning + 1–1,5 kg bær/frukt per 5 L</strong> med Lalvin 71B gjær.', 1.120, 'starter'
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE name IN ('Melomel (Fruit Mead)', 'Melomel (Fruktmjød)'));

CREATE TABLE IF NOT EXISTS inventory (
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
