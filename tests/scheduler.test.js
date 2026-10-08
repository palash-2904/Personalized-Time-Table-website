const test = require("node:test");
const assert = require("node:assert");
const S = require("../public/scheduler.js");

const ds = { id: "c1", name: "Data Structures", color: "#4f46e5", days: [2, 4], start: "12:30", end: "14:00", startDate: "2026-01-01" };
const settings = { eveningTime: "18:00", bedtime: "23:00" };
const fmt = (d) => `${S.ymd(d)} ${S.pad(d.getHours())}:${S.pad(d.getMinutes())}`;

test("a Tuesday class yields the full 8-step ladder", () => {
  const r = S.reviewsFor(ds, "2026-02-03", settings); // a Tuesday
  assert.deepStrictEqual(r.map((x) => fmt(x.due)), [
    "2026-02-03 14:00", "2026-02-03 18:00", "2026-02-03 22:40",
    "2026-02-05 18:00", "2026-02-07 18:00", "2026-02-10 18:00",
    "2026-02-17 18:00", "2026-03-05 18:00",
  ]);
});

test("evening review is pushed after a late class", () => {
  const late = { ...ds, start: "17:00", end: "19:00" };
  const r = S.reviewsFor(late, "2026-02-03", settings);
  assert.strictEqual(fmt(r[1].due), "2026-02-03 19:45");
  assert.ok(r[2].due > r[1].end);
});

test("bedtime after midnight stays on the same night", () => {
  const r = S.reviewsFor(ds, "2026-02-03", { ...settings, bedtime: "01:00" });
  assert.strictEqual(fmt(r[2].due), "2026-02-04 00:40");
});

test("class sessions respect weekdays and date bounds", () => {
  const from = S.parseYmd("2026-02-02"), to = S.parseYmd("2026-02-09");
  const s = S.classSessions([ds], from, to);
  assert.deepStrictEqual(s.map((x) => x.date), ["2026-02-03", "2026-02-05"]);
  assert.strictEqual(S.classSessions([{ ...ds, endDate: "2026-02-03" }], from, to).length, 1);
});

test("reviewsBetween picks up reviews from classes taught weeks earlier", () => {
  const from = S.parseYmd("2026-03-05"), to = S.parseYmd("2026-03-06");
  const r = S.reviewsBetween([ds], settings, from, to);
  assert.ok(r.some((x) => x.date === "2026-02-03" && x.step === 7));
});

test("retention drops between reviews and resets on review", () => {
  const pts = S.retentionCurve([0, 2, 4], 10);
  const at = (t) => pts.find((p) => p[0] === t)[1];
  assert.ok(at(1.75) < at(0.25));
  assert.ok(at(2) > at(1.75));
});
