// Zero-dependency HTTP server: static frontend + JSON API backed by SQLite.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { open } = require("./db");
const v = require("./validate");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon",
};
const MAX_BODY = 100 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Body too large"), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(Object.assign(new Error("Invalid JSON"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

function createServer(db) {
  const send = (res, status, body) => {
    const data = body === undefined ? "" : JSON.stringify(body);
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(data);
  };

  async function api(req, res, url) {
    const parts = url.pathname.split("/").filter(Boolean).slice(1); // drop "api"
    const [resource, id] = parts;
    const m = req.method;

    if (resource === "state" && m === "GET") return send(res, 200, db.getState());
    if (resource === "classes") {
      if (m === "POST" && !id) {
        const c = v.classInput(await readBody(req));
        return send(res, 201, db.upsertClass({ ...c, id: crypto.randomUUID() }));
      }
      if (m === "PUT" && id) {
        if (!db.getClass(id)) return send(res, 404, { error: "Class not found" });
        return send(res, 200, db.upsertClass({ ...v.classInput(await readBody(req)), id }));
      }
      if (m === "DELETE" && id) return db.deleteClass(id) ? send(res, 204) : send(res, 404, { error: "Class not found" });
    }
    if (resource === "settings" && m === "PUT") {
      const s = v.settingsInput(await readBody(req));
      for (const [k, val] of Object.entries(s)) db.setSetting(k, val);
      return send(res, 200, db.getState().settings);
    }
    if (resource === "reviews" && m === "PUT") {
      const r = v.reviewInput(await readBody(req));
      if (!db.getClass(r.classId)) return send(res, 404, { error: "Class not found" });
      db.setReview(r.classId, r.date, r.step, r.status);
      return send(res, 204);
    }
    if (resource === "notes" && m === "PUT") {
      const n = v.noteInput(await readBody(req));
      if (!db.getClass(n.classId)) return send(res, 404, { error: "Class not found" });
      db.setNote(n.classId, n.date, n.topic);
      return send(res, 204);
    }
    return send(res, 404, { error: "Not found" });
  }

  function serveStatic(req, res, url) {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(req.method === "HEAD" ? undefined : buf);
    });
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      try { await api(req, res, url); }
      catch (e) {
        if (!e.status) console.error(e);
        if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : "Server error" });
      }
    } else serveStatic(req, res, url);
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const db = open(process.env.DB_PATH || path.join(__dirname, "..", "data", "cognifyx.db"));
  createServer(db).listen(port, () => console.log(`Cognifyx running at http://localhost:${port}`));
}
