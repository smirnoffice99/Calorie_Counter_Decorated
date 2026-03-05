CREATE TABLE IF NOT EXISTS diet_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    calories REAL NOT NULL,
    carbs REAL NOT NULL,
    protein REAL NOT NULL,
    fat REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diet_logs_user_date ON diet_logs(user_id, date);
