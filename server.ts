import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("pomodoro.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/sessions", (req, res) => {
    const { date } = req.query;
    try {
      if (date) {
        // Fetch sessions for a specific date
        const sessions = db.prepare("SELECT * FROM sessions WHERE date(completed_at) = date(?) ORDER BY completed_at DESC").all(date);
        res.json(sessions);
      } else {
        // Fetch today's sessions by default if no date provided
        const sessions = db.prepare("SELECT * FROM sessions WHERE date(completed_at) = date('now') ORDER BY completed_at DESC").all();
        res.json(sessions);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // Get all dates that have sessions
  app.get("/api/sessions/dates", (req, res) => {
    try {
      const dates = db.prepare("SELECT DISTINCT date(completed_at) as date FROM sessions ORDER BY date DESC").all();
      res.json(dates.map(d => d.date));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch session dates" });
    }
  });

  app.post("/api/sessions", (req, res) => {
    const { task_name, duration_minutes } = req.body;
    if (!task_name) {
      return res.status(400).json({ error: "Task name is required" });
    }
    try {
      const info = db.prepare("INSERT INTO sessions (task_name, duration_minutes) VALUES (?, ?)").run(task_name, duration_minutes);
      res.json({ id: info.lastInsertRowid, task_name, duration_minutes });
    } catch (error) {
      res.status(500).json({ error: "Failed to save session" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
