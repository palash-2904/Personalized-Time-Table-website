// Input validation shared by the API routes. Each returns a cleaned value or throws {status, message}.
const bad = (message) => Object.assign(new Error(message), { status: 400 });
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

function classInput(b) {
  if (!b || typeof b !== "object") throw bad("Body must be an object");
  const name = String(b.name ?? "").trim();
  if (!name || name.length > 80) throw bad("name is required (max 80 chars)");
  if (!COLOR.test(b.color)) throw bad("color must be #rrggbb");
  if (!Array.isArray(b.days) || !b.days.length || !b.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    throw bad("days must be a non-empty list of 0-6 (Sun=0)");
  }
  if (!HM.test(b.start) || !HM.test(b.end)) throw bad("start/end must be HH:MM");
  if (b.end <= b.start) throw bad("end must be after start");
  if (!DATE.test(b.startDate)) throw bad("startDate must be YYYY-MM-DD");
  if (b.endDate != null && b.endDate !== "") {
    if (!DATE.test(b.endDate)) throw bad("endDate must be YYYY-MM-DD");
    if (b.endDate < b.startDate) throw bad("endDate must not be before startDate");
  }
  return {
    name, color: b.color, days: [...new Set(b.days)].sort(), start: b.start, end: b.end,
    startDate: b.startDate, endDate: b.endDate || null,
  };
}

function settingsInput(b) {
  const out = {};
  for (const k of ["eveningTime", "bedtime"]) {
    if (b?.[k] === undefined) continue;
    if (!HM.test(b[k])) throw bad(`${k} must be HH:MM`);
    out[k] = b[k];
  }
  return out;
}

function reviewInput(b) {
  if (typeof b?.classId !== "string" || !DATE.test(b?.date) || !Number.isInteger(b?.step) || b.step < 0 || b.step > 20) {
    throw bad("classId, date (YYYY-MM-DD) and step are required");
  }
  if (b.status != null && !["done", "skipped"].includes(b.status)) throw bad("status must be done, skipped or null");
  return { classId: b.classId, date: b.date, step: b.step, status: b.status ?? null };
}

function noteInput(b) {
  if (typeof b?.classId !== "string" || !DATE.test(b?.date)) throw bad("classId and date are required");
  const topic = String(b.topic ?? "").trim();
  if (topic.length > 300) throw bad("topic is too long (max 300)");
  return { classId: b.classId, date: b.date, topic };
}

module.exports = { classInput, settingsInput, reviewInput, noteInput };
