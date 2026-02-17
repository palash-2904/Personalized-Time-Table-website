// script.js
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORAGE_KEY = "studyplan_saved_plans_v1";

  const planForm = $("#planForm");
  const subjectsBody = $("#subjectsBody");
  const addSubjectBtn = $("#addSubjectBtn");
  const resetBtn = $("#resetBtn");
  const saveBtn = $("#saveBtn");
  const generateTopBtn = $("#generateTopBtn");
  const seeExampleBtn = $("#seeExampleBtn");

  const formErrors = $("#formErrors");
  const previewPill = $("#previewPill");

  const sumHours = $("#sumHours");
  const sumSubjects = $("#sumSubjects");
  const sumNext = $("#sumNext");

  const weekHead = $("#weekHead");
  const weekGrid = $("#weekGrid");

  const savedPlansList = $("#savedPlansList");
  const savedEmptyNote = $("#savedEmptyNote");

  const yearEl = $("#year");

  const statSubjects = $("#statSubjects");
  const statHours = $("#statHours");
  const statDays = $("#statDays");

  const menuBtn = $("#menuBtn");
  const navLinks = $("#navLinks");

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  // Your settings
const STUDY_WINDOW_START = "19:00"; // 7 pm
const STUDY_WINDOW_END = "01:00";   // 1 am (next day)
const BEDTIME = "02:00";            // 2 am

// Spaced repetition offsets
const REVIEW_OFFSETS_MIN = [0, 60];        // immediate, within 1 hour
const REVIEW_OFFSETS_DAYS = [2, 6];        // after 2 days, after 6 days

function addTopicRow(prefill = {}) {
  const topicsBody = document.getElementById("topicsBody");
  const row = document.createElement("div");
  row.className = "subjects__row";
  row.setAttribute("role", "row");

  const course = document.createElement("input");
  course.type = "text";
  course.placeholder = "e.g., Computer Systems";
  course.value = prefill.course || "";
  course.dataset.field = "course";

  const topic = document.createElement("input");
  topic.type = "text";
  topic.placeholder = "e.g., Local memory and cache";
  topic.value = prefill.topic || "";
  topic.dataset.field = "topic";

  const lectureAt = document.createElement("input");
  lectureAt.type = "datetime-local";
  lectureAt.value = prefill.lectureAt || "";
  lectureAt.dataset.field = "lectureAt";

  const minutes = document.createElement("input");
  minutes.type = "number";
  minutes.min = "5";
  minutes.max = "120";
  minutes.value = prefill.minutes != null ? String(prefill.minutes) : "15";
  minutes.dataset.field = "minutes";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "icon-x";
  removeBtn.setAttribute("aria-label", "Remove topic");
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(course);
  row.appendChild(topic);
  row.appendChild(lectureAt);
  row.appendChild(minutes);
  row.appendChild(removeBtn);

  topicsBody.appendChild(row);
}
function collectTopics() {
  const topicsBody = document.getElementById("topicsBody");
  const rows = Array.from(topicsBody.querySelectorAll(".subjects__row"));
  return rows
    .map((row) => {
      const get = (k) => row.querySelector(`[data-field="${k}"]`);
      return {
        course: (get("course")?.value || "").trim(),
        topic: (get("topic")?.value || "").trim(),
        lectureAt: get("lectureAt")?.value || "",
        minutes: Number(get("minutes")?.value || 15)
      };
    })
    .filter((t) => t.course && t.topic && t.lectureAt);
}


  function init() {
    yearEl.textContent = String(new Date().getFullYear());

    buildWeekHeader();
    buildEmptyWeekGrid();

    // start with 3 subjects
    addSubjectRow({ name: "CS", difficulty: 4, priority: 5, topics: 10 });
    addSubjectRow({ name: "Math", difficulty: 5, priority: 4, topics: 12 });
    addSubjectRow({ name: "Chem", difficulty: 3, priority: 3, topics: 8 });

    renderSavedPlans();

    attachEvents();
    updateHeroStats();
    addTopicRow({
    course: "Computer Systems",
    topic: "Local memory and cache",
    lectureAt: "", // user fills
    minutes: 15
});

  }

  function attachEvents() {
    const addTopicBtn = document.getElementById("addTopicBtn");
    addTopicBtn.addEventListener("click", () => addTopicRow());
    addSubjectBtn.addEventListener("click", () => addSubjectRow());

    resetBtn.addEventListener("click", () => {
      planForm.reset();
      formErrors.textContent = "";
      subjectsBody.innerHTML = "";
      buildEmptyWeekGrid();
      previewPill.textContent = "Not generated";
      setSummary({ hours: 0, subjects: 0, next: "None" });

      addSubjectRow();
      updateHeroStats();
      scrollToId("create-plan");
    });

    planForm.addEventListener("submit", (e) => {
      e.preventDefault();
      generateTimetableFromForm();
    });

    saveBtn.addEventListener("click", () => {
      formErrors.textContent = "";
      const data = collectFormData();
      const validation = validateData(data);
      if (!validation.ok) {
        showErrors(validation.errors);
        return;
      }

      const planName = (data.planName || "").trim() || suggestPlanName(data);
      const saved = loadSavedPlans();

      const id = cryptoRandomId();
      saved.unshift({
        id,
        name: planName,
        createdAt: new Date().toISOString(),
        data
      });

      saveSavedPlans(saved);
      renderSavedPlans();
      formErrors.textContent = "Saved.";
      setTimeout(() => (formErrors.textContent = ""), 1500);
    });

    generateTopBtn.addEventListener("click", () => {
      scrollToId("create-plan");
      generateTimetableFromForm();
    });

    seeExampleBtn.addEventListener("click", () => {
      // Fill a reasonable example quickly
      $("#hoursPerWeek").value = "14";
      $("#startDate").valueAsDate = new Date();
      const exam = new Date();
      exam.setDate(exam.getDate() + 21);
      $("#examDate").valueAsDate = exam;

      $("#timeStart").value = "18:00";
      $("#timeEnd").value = "21:00";
      $("#sessionsPerDay").value = "2";

      // select Mon Wed Fri
      $$('input[name="days"]').forEach((cb) => {
        cb.checked = cb.value === "Mon" || cb.value === "Wed" || cb.value === "Fri";
      });

      subjectsBody.innerHTML = "";
      addSubjectRow({ name: "Data Structures", difficulty: 5, priority: 5, topics: 14 });
      addSubjectRow({ name: "Security", difficulty: 4, priority: 4, topics: 10 });
      addSubjectRow({ name: "Chem Lab", difficulty: 3, priority: 3, topics: 6 });

      updateHeroStats();
      generateTimetableFromForm();
      scrollToId("create-plan");
    });

    // Smooth scroll for nav links
    $$(".nav__link").forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href");
        if (href && href.startsWith("#")) {
          e.preventDefault();
          scrollToId(href.slice(1));
          closeMobileMenu();
        }
      });
    });

    // Mobile menu toggle
    menuBtn.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", String(isOpen));
      menuBtn.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!target) return;
      if (navLinks.classList.contains("is-open")) {
        const inNav = navLinks.contains(target);
        const inBtn = menuBtn.contains(target);
        if (!inNav && !inBtn) closeMobileMenu();
      }
    });

    // Keep hero stats updated on input changes
    planForm.addEventListener("input", updateHeroStats);
    planForm.addEventListener("change", updateHeroStats);
  }

  function closeMobileMenu() {
    navLinks.classList.remove("is-open");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Open menu");
  }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildWeekHeader() {
    weekHead.innerHTML = "";
    DAYS.forEach((d) => {
      const cell = document.createElement("div");
      cell.textContent = d;
      weekHead.appendChild(cell);
    });
  }

  function buildEmptyWeekGrid() {
    weekGrid.innerHTML = "";
    DAYS.forEach(() => {
      const col = document.createElement("div");
      col.className = "day-col";
      weekGrid.appendChild(col);
    });
  }

  function addSubjectRow(prefill = {}) {
    const row = document.createElement("div");
    row.className = "subjects__row";
    row.setAttribute("role", "row");

    const name = document.createElement("input");
    name.type = "text";
    name.placeholder = "e.g., Math";
    name.value = prefill.name || "";

    const difficulty = document.createElement("select");
    for (let i = 1; i <= 5; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      difficulty.appendChild(opt);
    }
    difficulty.value = String(prefill.difficulty || 3);

    const priority = document.createElement("select");
    for (let i = 1; i <= 5; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      priority.appendChild(opt);
    }
    priority.value = String(prefill.priority || 3);

    const topics = document.createElement("input");
    topics.type = "number";
    topics.min = "0";
    topics.max = "999";
    topics.placeholder = "0";
    topics.value = prefill.topics != null ? String(prefill.topics) : "";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "icon-x";
    removeBtn.setAttribute("aria-label", "Remove subject");
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      row.remove();
      updateHeroStats();
    });

    // Store field markers so we can collect easily
    name.dataset.field = "subjectName";
    difficulty.dataset.field = "difficulty";
    priority.dataset.field = "priority";
    topics.dataset.field = "topics";

    row.appendChild(name);
    row.appendChild(difficulty);
    row.appendChild(priority);
    row.appendChild(topics);
    row.appendChild(removeBtn);

    subjectsBody.appendChild(row);
    updateHeroStats();
  }

  function collectFormData() {
    const hoursPerWeek = Number($("#hoursPerWeek").value);
    const planName = $("#planName").value;

    const startDate = $("#startDate").value;
    const examDate = $("#examDate").value;

    const timeStart = $("#timeStart").value;
    const timeEnd = $("#timeEnd").value;

    const breakEvery = Number($("#breakEvery").value || 0);
    const breakLength = Number($("#breakLength").value || 0);

    const sessionsPerDay = Number($("#sessionsPerDay").value || 2);

    const days = $$('input[name="days"]:checked').map((cb) => cb.value);

    const subjects = $$(".subjects__row", subjectsBody)
      .map((row) => {
        const fields = $$("[data-field]", row);
        const get = (key) => fields.find((f) => f.dataset.field === key);

        return {
          name: (get("subjectName")?.value || "").trim(),
          difficulty: Number(get("difficulty")?.value || 3),
          priority: Number(get("priority")?.value || 3),
          topics: Number(get("topics")?.value || 0)
        };
      })
      .filter((s) => s.name.length > 0);

    return {
      hoursPerWeek,
      planName,
      startDate,
      examDate,
      timeStart,
      timeEnd,
      breakEvery,
      breakLength,
      sessionsPerDay,
      days,
      subjects
    };
  }
function windowDurationMinutes(startHHMM, endHHMM) {
  const s = timeToMinutes(startHHMM);
  const e = timeToMinutes(endHHMM);

  // crosses midnight
  if (e <= s) return (24 * 60 - s) + e;

  // normal same-day window
  return e - s;
}

  function validateData(data) {
    const errors = [];

    if (!Number.isFinite(data.hoursPerWeek) || data.hoursPerWeek <= 0) {
      errors.push("Enter total study hours per week (a number greater than 0).");
    }
    if (!data.startDate) errors.push("Choose a start date.");
    if (!data.examDate) errors.push("Choose an exam date.");

    if (data.startDate && data.examDate) {
      const s = new Date(data.startDate);
      const e = new Date(data.examDate);
      if (e < s) errors.push("Exam date must be after start date.");
    }

    if (!data.timeStart || !data.timeEnd) {
      errors.push("Choose a daily time window start and end.");
    } 
    else{
        const duration = windowDurationMinutes(data.timeStart, data.timeEnd);
        if (duration < 30) errors.push("Daily window should be at least 30 minutes.");

    }

    if (!Array.isArray(data.days) || data.days.length === 0) {
      errors.push("Choose at least one preferred study day.");
    }

    if (!Array.isArray(data.subjects) || data.subjects.length === 0) {
      errors.push("Add at least one subject (with a name).");
    }

    if (!Number.isFinite(data.sessionsPerDay) || data.sessionsPerDay < 1 || data.sessionsPerDay > 3) {
      errors.push("Sessions per day must be between 1 and 3.");
    }

    return { ok: errors.length === 0, errors };
  }

  function showErrors(errors) {
    formErrors.textContent = errors.join(" ");
    previewPill.textContent = "Not generated";
  }

  function generateTimetableFromForm() {
    formErrors.textContent = "";
    const data = collectFormData();
    const validation = validateData(data);
    if (!validation.ok) {
      showErrors(validation.errors);
      return;
    }

    const schedule = makeMockSchedule(data);
    renderSchedule(schedule, data.days);

    previewPill.textContent = "Generated";
    setSummary({
      hours: schedule.totalHours,
      subjects: data.subjects.length,
      next: schedule.nextSession || "None"
    });
  }

function makeMockSchedule(data) {
  const topics = collectTopics();

  // If no topics provided, fall back to old subject-based mock
  if (!topics.length) {
    return makeSubjectOnlyFallback(data);
  }

  const events = [];
  for (const t of topics) {
    const lecture = parseDateTimeLocal(t.lectureAt);
    if (!lecture) continue;

    // 1) right after lecture
    events.push(buildEvent(t, "Right after lecture", lecture, t.minutes));

    // 2) within 1 hour
    events.push(buildEvent(t, "Within 1 hour", addMinutes(lecture, 60), t.minutes));

    // 3) before sleeping (snapped to your study window end if bedtime is outside)
    const beforeSleepTarget = computeBeforeSleep(lecture);
    events.push(buildEvent(t, "Before sleeping", beforeSleepTarget, t.minutes));

    // 4) +2 days
    events.push(buildEvent(t, "+2 days", addDays(lecture, 2), t.minutes));

    // 5) +6 days
    events.push(buildEvent(t, "+6 days", addDays(lecture, 6), t.minutes));
  }

  // Snap every event into the allowed study window (7 pm to 1 am)
  const snapped = events.map((e) => {
    const snappedStart = snapIntoStudyWindow(e.start);
    return { ...e, start: snappedStart, end: addMinutes(snappedStart, e.minutes) };
  });

  // Build display items grouped by day label for the week grid
  const items = snapped
    .sort((a, b) => a.start - b.start)
    .map((e) => ({
      day: dayLabelFromDate(e.start),
      title: `${e.course}: ${e.topic}`,
      meta: `${formatTime(e.start)} to ${formatTime(e.end)} • ${e.tag}`,
      type: "study"
    }));

  const totalHours = Math.max(1, Math.round(data.hoursPerWeek || 1));
  const next = items[0] ? `${items[0].day} ${items[0].meta.split(" to ")[0]}` : null;

  return {
    totalHours,
    items,
    nextSession: next
  };
}
function buildEvent(t, tag, start, minutes) {
  return { course: t.course, topic: t.topic, tag, start, end: addMinutes(start, minutes), minutes };
}

function parseDateTimeLocal(dtLocal) {
  // dtLocal is like "2026-02-16T10:00"
  const d = new Date(dtLocal);
  return isNaN(d.getTime()) ? null : d;
}

function addMinutes(date, mins) {
  const d = new Date(date.getTime());
  d.setMinutes(d.getMinutes() + mins);
  return d;
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function computeBeforeSleep(lectureDate) {
  // bedtime is 2:00 AM, but study window ends 1:00 AM
  // so "before sleeping" becomes the latest usable time in the study window on the same night
  const endMin = timeToMinutes(STUDY_WINDOW_END); // 01:00
  const bedMin = timeToMinutes(BEDTIME);          // 02:00

  // pick latest time you can study that night
  const chosenMin = bedMin <= endMin ? bedMin : endMin;

  const night = new Date(lectureDate.getTime());
  night.setHours(0, 0, 0, 0);
  // if bedtime (or window end) is after midnight, that is technically next day time
  // since we want "same night", set to next day at chosenMin
  night.setDate(night.getDate() + 1);
  night.setMinutes(chosenMin);
  night.setHours(Math.floor(chosenMin / 60), chosenMin % 60, 0, 0);

  return night;
}

function snapIntoStudyWindow(date) {
  // Allowed window: 7:00 PM to 1:00 AM (crosses midnight)
  const startMin = timeToMinutes(STUDY_WINDOW_START); // 1140
  const endMin = timeToMinutes(STUDY_WINDOW_END);     // 60

  // Convert current time to minutes from 0:00
  const curMin = date.getHours() * 60 + date.getMinutes();

  // Window crosses midnight: valid if curMin >= startMin OR curMin <= endMin
  const inWindow = curMin >= startMin || curMin <= endMin;
  if (inWindow) return date;

  const snapped = new Date(date.getTime());

  // If it is daytime, push to 7 pm same day
  if (curMin < startMin) {
    snapped.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    return snapped;
  }

  // If it is after 1 am but before 7 pm, also push to 7 pm same day
  snapped.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  return snapped;
}

function dayLabelFromDate(date) {
  // Map JS day to Mon..Sun
  const js = date.getDay(); // 0 Sun ... 6 Sat
  const map = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
  return map[js];
}

function formatTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
function makeSubjectOnlyFallback(data) {
  // keep it simple: create empty schedule if no topics
  return {
    totalHours: Math.max(1, Math.round(data.hoursPerWeek || 1)),
    items: [],
    nextSession: null
  };
}


  function renderSchedule(schedule, chosenDays) {
    // rebuild grid columns
    buildEmptyWeekGrid();

    // Fill columns by day
    const cols = $$(".day-col", weekGrid);
    const dayToIndex = {};
    DAYS.forEach((d, i) => (dayToIndex[d] = i));

    for (const item of schedule.items) {
      const idx = dayToIndex[item.day];
      if (idx == null) continue;

      const col = cols[idx];

      // If the day is not selected, still show but faded? Here we only add items for selected days.
      if (!chosenDays.includes(item.day)) continue;

      const block = document.createElement("div");
      block.className = item.type === "break" ? "block block--break" : "block";

      const title = document.createElement("div");
      title.className = "block__title";
      title.textContent = item.title;

      const meta = document.createElement("div");
      meta.className = "block__meta";
      meta.textContent = item.meta;

      block.appendChild(title);
      block.appendChild(meta);
      col.appendChild(block);
    }

    updateHeroStats();
  }

  function setSummary({ hours, subjects, next }) {
    sumHours.textContent = String(hours);
    sumSubjects.textContent = String(subjects);
    sumNext.textContent = String(next);
  }

  function updateHeroStats() {
    const data = collectFormData();
    statSubjects.textContent = String(data.subjects.length);
    statHours.textContent = String(Number.isFinite(data.hoursPerWeek) ? data.hoursPerWeek : 0);
    statDays.textContent = String(data.days.length);
  }

  function timeToMinutes(hhmm) {
    const [h, m] = String(hhmm).split(":").map((x) => Number(x));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    return h * 60 + m;
  }

  function minutesToTime(mins) {
    const m = Math.max(0, mins);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  function loadSavedPlans() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveSavedPlans(plans) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }

  function renderSavedPlans() {
    const plans = loadSavedPlans();
    savedPlansList.innerHTML = "";

    if (!plans.length) {
      savedEmptyNote.style.display = "block";
      return;
    }
    savedEmptyNote.style.display = "none";

    for (const p of plans) {
      const card = document.createElement("div");
      card.className = "card";

      const top = document.createElement("div");
      top.className = "saved-card__top";

      const left = document.createElement("div");
      const title = document.createElement("h3");
      title.className = "saved-card__title";
      title.textContent = p.name || "Untitled plan";

      const meta = document.createElement("div");
      meta.className = "saved-card__meta";
      meta.textContent = `Created: ${formatDate(p.createdAt)}`;

      left.appendChild(title);
      left.appendChild(meta);

      const tag = document.createElement("span");
      tag.className = "pill";
      tag.textContent = `${(p.data?.subjects || []).length} subjects`;

      top.appendChild(left);
      top.appendChild(tag);

      const actions = document.createElement("div");
      actions.className = "saved-card__actions";

      const loadBtn = document.createElement("button");
      loadBtn.className = "btn btn--primary";
      loadBtn.type = "button";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () => {
        applyPlanToForm(p.data);
        generateTimetableFromForm();
        scrollToId("create-plan");
      });

      const renameBtn = document.createElement("button");
      renameBtn.className = "btn";
      renameBtn.type = "button";
      renameBtn.textContent = "Rename";
      renameBtn.addEventListener("click", () => {
        const newName = prompt("New plan name:", p.name || "");
        if (newName == null) return;
        const trimmed = newName.trim();
        if (!trimmed) return;

        const current = loadSavedPlans();
        const idx = current.findIndex((x) => x.id === p.id);
        if (idx >= 0) {
          current[idx].name = trimmed;
          saveSavedPlans(current);
          renderSavedPlans();
        }
      });

      const delBtn = document.createElement("button");
      delBtn.className = "btn";
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => {
        const ok = confirm(`Delete "${p.name || "Untitled plan"}"?`);
        if (!ok) return;

        const current = loadSavedPlans().filter((x) => x.id !== p.id);
        saveSavedPlans(current);
        renderSavedPlans();
      });

      actions.appendChild(loadBtn);
      actions.appendChild(renameBtn);
      actions.appendChild(delBtn);

      card.appendChild(top);
      card.appendChild(actions);

      savedPlansList.appendChild(card);
    }
  }

  function applyPlanToForm(data) {
    if (!data) return;

    $("#hoursPerWeek").value = data.hoursPerWeek != null ? String(data.hoursPerWeek) : "";
    $("#planName").value = data.planName || "";
    $("#startDate").value = data.startDate || "";
    $("#examDate").value = data.examDate || "";

    $("#timeStart").value = data.timeStart || "18:00";
    $("#timeEnd").value = data.timeEnd || "21:00";

    $("#breakEvery").value = data.breakEvery != null ? String(data.breakEvery) : "50";
    $("#breakLength").value = data.breakLength != null ? String(data.breakLength) : "10";

    $("#sessionsPerDay").value = data.sessionsPerDay != null ? String(data.sessionsPerDay) : "2";

    // days
    $$('input[name="days"]').forEach((cb) => {
      cb.checked = Array.isArray(data.days) ? data.days.includes(cb.value) : false;
    });

    // subjects
    subjectsBody.innerHTML = "";
    if (Array.isArray(data.subjects) && data.subjects.length) {
      for (const s of data.subjects) addSubjectRow(s);
    } else {
      addSubjectRow();
    }

    updateHeroStats();
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return "Unknown";
    }
  }

  function suggestPlanName(data) {
    const subj = (data.subjects || []).slice(0, 2).map((s) => s.name).join(", ");
    const base = subj ? `Plan: ${subj}` : "My Study Plan";
    return base.slice(0, 40);
  }

  function cryptoRandomId() {
    // small helper that works even if crypto is not available
    try {
      const arr = new Uint32Array(2);
      crypto.getRandomValues(arr);
      return `p_${arr[0].toString(16)}${arr[1].toString(16)}`;
    } catch {
      return `p_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    }
  }

  init();
})();
