const test = require("node:test");
const assert = require("node:assert");
const { open } = require("../server/db");
const { createServer } = require("../server/server");

async function withServer(fn) {
  const db = open(":memory:");
  const server = createServer(db);
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, body: text && res.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text };
  };
  try { await fn(call); } finally { server.close(); db.close(); }
}

const cls = { name: "Data Structures", color: "#4f46e5", days: [2, 4], start: "12:30", end: "14:00", startDate: "2026-02-01", endDate: null };

test("class CRUD, reviews, notes and cascade delete", () => withServer(async (call) => {
  const created = await call("POST", "/api/classes", cls);
  assert.strictEqual(created.status, 201);
  const id = created.body.id;

  assert.strictEqual((await call("PUT", `/api/classes/${id}`, { ...cls, name: "DSA" })).body.name, "DSA");
  assert.strictEqual((await call("PUT", "/api/reviews", { classId: id, date: "2026-02-03", step: 1, status: "done" })).status, 204);
  assert.strictEqual((await call("PUT", "/api/notes", { classId: id, date: "2026-02-03", topic: "Heaps" })).status, 204);
  await call("PUT", "/api/settings", { bedtime: "23:30" });

  let state = (await call("GET", "/api/state")).body;
  assert.strictEqual(state.classes.length, 1);
  assert.strictEqual(state.reviews[`${id}|2026-02-03|1`], "done");
  assert.strictEqual(state.notes[`${id}|2026-02-03`], "Heaps");
  assert.strictEqual(state.settings.bedtime, "23:30");

  await call("PUT", "/api/reviews", { classId: id, date: "2026-02-03", step: 1, status: null });
  assert.deepStrictEqual((await call("GET", "/api/state")).body.reviews, {});

  assert.strictEqual((await call("DELETE", `/api/classes/${id}`)).status, 204);
  state = (await call("GET", "/api/state")).body;
  assert.deepStrictEqual([state.classes, state.notes], [[], {}]);
}));

test("validation and error handling", () => withServer(async (call) => {
  assert.strictEqual((await call("POST", "/api/classes", { ...cls, end: "10:00" })).status, 400);
  assert.strictEqual((await call("POST", "/api/classes", { ...cls, days: [9] })).status, 400);
  assert.strictEqual((await call("PUT", "/api/reviews", { classId: "nope", date: "2026-02-03", step: 0, status: "done" })).status, 404);
  assert.strictEqual((await call("PUT", "/api/settings", { bedtime: "late" })).status, 400);
  assert.strictEqual((await call("GET", "/api/nothing")).status, 404);
}));

test("static files served, traversal blocked", () => withServer(async (call) => {
  assert.strictEqual((await call("GET", "/scheduler.js")).status, 200);
  assert.strictEqual((await call("GET", "/..%2fpackage.json")).status, 403);
}));
