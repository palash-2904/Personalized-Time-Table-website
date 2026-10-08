// SQLite storage (built-in node:sqlite). All functions are synchronous.
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

function open(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
      days TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reviews (
      class_id TEXT NOT NULL, date TEXT NOT NULL, step INTEGER NOT NULL,
      status TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (class_id, date, step)
    );
    CREATE TABLE IF NOT EXISTS notes (
      class_id TEXT NOT NULL, date TEXT NOT NULL, topic TEXT NOT NULL,
      PRIMARY KEY (class_id, date)
    );
  `);

  const q = (sql) => db.prepare(sql);
  const rowToClass = (r) => ({
    id: r.id, name: r.name, color: r.color, days: JSON.parse(r.days),
    start: r.start_time, end: r.end_time, startDate: r.start_date, endDate: r.end_date,
  });

  return {
    getState() {
      const reviews = {}, notes = {}, settings = {};
      for (const r of q("SELECT * FROM reviews").all()) reviews[`${r.class_id}|${r.date}|${r.step}`] = r.status;
      for (const n of q("SELECT * FROM notes").all()) notes[`${n.class_id}|${n.date}`] = n.topic;
      for (const s of q("SELECT * FROM settings").all()) settings[s.key] = s.value;
      return {
        classes: q("SELECT * FROM classes ORDER BY created_at, id").all().map(rowToClass),
        settings, reviews, notes,
      };
    },
    getClass(id) {
      const r = q("SELECT * FROM classes WHERE id = ?").get(id);
      return r ? rowToClass(r) : null;
    },
    upsertClass(c) {
      q(`INSERT INTO classes (id,name,color,days,start_time,end_time,start_date,end_date,created_at)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, days=excluded.days,
           start_time=excluded.start_time, end_time=excluded.end_time,
           start_date=excluded.start_date, end_date=excluded.end_date`)
        .run(c.id, c.name, c.color, JSON.stringify(c.days), c.start, c.end, c.startDate, c.endDate ?? null, new Date().toISOString());
      return this.getClass(c.id);
    },
    deleteClass(id) {
      db.exec("BEGIN");
      try {
        q("DELETE FROM reviews WHERE class_id = ?").run(id);
        q("DELETE FROM notes WHERE class_id = ?").run(id);
        const res = q("DELETE FROM classes WHERE id = ?").run(id);
        db.exec("COMMIT");
        return res.changes > 0;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    setSetting(key, value) {
      q("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
    },
    setReview(classId, date, step, status) {
      if (status == null) q("DELETE FROM reviews WHERE class_id=? AND date=? AND step=?").run(classId, date, step);
      else q(`INSERT INTO reviews (class_id,date,step,status,updated_at) VALUES (?,?,?,?,?)
              ON CONFLICT(class_id,date,step) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at`)
        .run(classId, date, step, status, new Date().toISOString());
    },
    setNote(classId, date, topic) {
      if (!topic) q("DELETE FROM notes WHERE class_id=? AND date=?").run(classId, date);
      else q(`INSERT INTO notes (class_id,date,topic) VALUES (?,?,?)
              ON CONFLICT(class_id,date) DO UPDATE SET topic=excluded.topic`).run(classId, date, topic);
    },
    close() { db.close(); },
  };
}

module.exports = { open };
