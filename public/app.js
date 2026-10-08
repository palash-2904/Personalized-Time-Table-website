(function () {
  const S = window.Scheduler;
  const $ = (sel) => document.querySelector(sel);

  const COLORS = ["#4f46e5", "#0e9f6e", "#e11d48", "#d97706", "#0891b2", "#9333ea", "#475569", "#db2777"];
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const OVERDUE_DAYS = 7;

  let api, state;
  let view = "today";
  let weekOffset = 0;

  // ---------- helpers ----------
  function fill(el, ...kids) { el.replaceChildren(...kids.flat().filter(Boolean)); }
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  const hm = (d) => `${S.pad(d.getHours())}:${S.pad(d.getMinutes())}`;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const settings = () => ({ ...S.DEFAULT_SETTINGS, ...state.settings });
  const topicFor = (classId, date) => state.notes[`${classId}|${date}`] || "";
  const statusOf = (r) => state.reviews[r.key];

  function showError(e) {
    const b = $("#banner");
    b.textContent = e.message || String(e);
    b.hidden = false;
    setTimeout(() => (b.hidden = true), 6000);
  }
  async function run(fn) {
    try { await fn(); } catch (e) { showError(e); }
  }
  async function reload() {
    state = await api.load();
    state.settings ||= {};
    render();
  }

  // ---------- actions ----------
  async function setReviewStatus(r, status) {
    await run(async () => {
      await api.setReview(r.classId, r.date, r.step, status);
      if (status) state.reviews[r.key] = status; else delete state.reviews[r.key];
      render();
    });
  }
  async function saveTopic(classId, date, topic) {
    await run(async () => {
      topic = topic.trim();
      await api.setNote(classId, date, topic);
      if (topic) state.notes[`${classId}|${date}`] = topic; else delete state.notes[`${classId}|${date}`];
      // Don't re-render the whole view: the user may be typing in another field.
    });
  }

  // ---------- dialogs ----------
  const dialog = () => $("#dialog");
  function openDialog(...content) {
    const d = dialog();
    d.replaceChildren(...content.filter(Boolean));
    if (!d.open) d.showModal();
  }
  const closeDialog = () => dialog().close();

  function openReview(r) {
    const tech = S.TECHNIQUES[r.technique];
    const status = statusOf(r);
    openDialog(
      h("h3", {}, `${r.className}: ${r.label}`),
      h("p", { class: "muted small" }, `${r.due.toDateString()} · ${hm(r.due)} · about ${r.minutes} min`),
      topicFor(r.classId, r.date) && h("p", {}, h("b", {}, "Covered: "), topicFor(r.classId, r.date)),
      h("h3", {}, tech.name),
      h("ol", {}, tech.steps.map((s) => h("li", {}, s))),
      h("div", { class: "dialog__actions" },
        h("button", { class: "btn", onclick: closeDialog }, "Close"),
        status
          ? h("button", { class: "btn", onclick: () => { setReviewStatus(r, null); closeDialog(); } }, "Undo")
          : h("button", { class: "btn", onclick: () => { setReviewStatus(r, "skipped"); closeDialog(); } }, "Skip"),
        status !== "done" && h("button", { class: "btn btn--primary", onclick: () => { setReviewStatus(r, "done"); closeDialog(); } }, "Mark done")
      )
    );
  }

  function openClassForm(existing) {
    const c = existing || { name: "", color: COLORS[state.classes.length % COLORS.length], days: [], start: "09:00", end: "10:00", startDate: S.ymd(new Date()), endDate: "" };
    const err = h("p", { class: "form__error", role: "alert" });
    const name = h("input", { type: "text", maxlength: 80, value: c.name, placeholder: "e.g. Data Structures", required: true });
    const start = h("input", { type: "time", value: c.start, required: true });
    const end = h("input", { type: "time", value: c.end, required: true });
    const startDate = h("input", { type: "date", value: c.startDate, required: true });
    const endDate = h("input", { type: "date", value: c.endDate || "" });
    const colorInputs = COLORS.map((col) => h("input", { type: "radio", name: "color", value: col, checked: col === c.color, "aria-label": col }));
    const dayInputs = DAY_ORDER.map((d) => h("input", { type: "checkbox", value: String(d), checked: c.days.includes(d) }));

    const form = h("form", { class: "view", novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      const payload = {
        id: c.id, name: name.value.trim(),
        color: (colorInputs.find((i) => i.checked) || colorInputs[0]).value,
        days: dayInputs.filter((i) => i.checked).map((i) => Number(i.value)),
        start: start.value, end: end.value, startDate: startDate.value, endDate: endDate.value || null,
      };
      const problem = !payload.name ? "Give the class a name."
        : !payload.days.length ? "Pick at least one day."
        : !payload.start || !payload.end ? "Set a start and end time."
        : payload.end <= payload.start ? "End time must be after start time."
        : !payload.startDate ? "Pick a start date."
        : payload.endDate && payload.endDate < payload.startDate ? "End date can't be before start date." : "";
      if (problem) { err.textContent = problem; return; }
      try {
        await api.saveClass(payload);
        closeDialog();
        await reload();
      } catch (ex) { err.textContent = ex.message; }
    } },
      h("h3", {}, existing ? "Edit class" : "Add class"),
      h("label", { class: "field" }, h("span", {}, "Name"), name),
      h("div", { class: "field" }, h("span", {}, "Colour"),
        h("div", { class: "swatches" }, colorInputs.map((i) => h("label", {}, i, h("span", { style: `background:${i.value}` }))))),
      h("div", { class: "field" }, h("span", {}, "Days"),
        h("div", { class: "daypick" }, dayInputs.map((i) => h("label", {}, i, h("span", {}, DAY_NAMES[Number(i.value)]))))),
      h("div", { class: "grid" },
        h("label", { class: "field" }, h("span", {}, "Starts"), start),
        h("label", { class: "field" }, h("span", {}, "Ends"), end)),
      h("div", { class: "grid" },
        h("label", { class: "field" }, h("span", {}, "First class on"), startDate),
        h("label", { class: "field" }, h("span", {}, "Last class on (optional)"), endDate)),
      err,
      h("div", { class: "dialog__actions" },
        h("button", { type: "button", class: "btn", onclick: closeDialog }, "Cancel"),
        h("button", { type: "submit", class: "btn btn--primary" }, existing ? "Save" : "Add class"))
    );
    openDialog(form);
    name.focus();
  }

  // ---------- views ----------
  function emptyState() {
    return h("div", { class: "card empty" },
      h("p", {}, "No classes yet. Add your weekly timetable and Cognifyx will schedule every revision for you."),
      h("button", { class: "btn btn--primary", onclick: () => openClassForm() }, "Add your first class"));
  }

  function reviewRow(r, late) {
    const status = statusOf(r);
    const topic = topicFor(r.classId, r.date);
    return h("div", { class: "row" + (status ? " is-done" : "") },
      h("input", { class: "check", type: "checkbox", checked: status === "done", "aria-label": `Mark ${r.label} for ${r.className} done`,
        onchange: (e) => setReviewStatus(r, e.target.checked ? "done" : null) }),
      h("span", { class: "row__time" }, late ? `${DAY_NAMES[r.due.getDay()]}` : hm(r.due)),
      h("span", { class: "dot", style: `background:${r.color}` }),
      h("div", { class: "row__main" },
        h("div", { class: "row__title" }, `${r.className} · ${r.label}`),
        h("div", { class: "muted small" }, [topic, S.TECHNIQUES[r.technique].name, `${r.minutes} min`].filter(Boolean).join(" · "))),
      status === "skipped" && h("span", { class: "tag" }, "skipped"),
      late && !status && h("span", { class: "tag tag--late" }, "overdue"),
      h("button", { class: "btn btn--sm", onclick: () => openReview(r) }, "How"));
  }

  function renderToday(el) {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = S.addDays(today, 1);
    if (!state.classes.length) return fill(el, h("h2", {}, "Today"), emptyState());

    const sessions = S.classSessions(state.classes, today, tomorrow);
    const todays = S.reviewsBetween(state.classes, settings(), today, tomorrow);
    const overdue = S.reviewsBetween(state.classes, settings(), S.addDays(today, -OVERDUE_DAYS), today).filter((r) => !statusOf(r));
    const finished = todays.filter((r) => statusOf(r)).length;

    fill(el, 
      h("div", { class: "view__head" },
        h("div", {}, h("h2", {}, "Today"), h("div", { class: "muted" }, now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }))),
        h("div", { class: "muted" }, todays.length ? `${finished} of ${todays.length} reviews done` : "")),

      sessions.length > 0 && h("div", { class: "card" }, h("h3", {}, "Classes today"),
        h("div", { class: "rows" }, sessions.map((s) => {
          const input = h("input", { class: "topic-input", type: "text", maxlength: 300, value: topicFor(s.classId, s.date),
            placeholder: "What did this class cover? (shows up in your reviews)", "aria-label": `Topic for ${s.className}`,
            onchange: () => saveTopic(s.classId, s.date, input.value) });
          return h("div", { class: "row" },
            h("span", { class: "row__time" }, hm(s.start)), h("span", { class: "dot", style: `background:${s.color}` }),
            h("div", { class: "row__main" }, h("div", { class: "row__title" }, `${s.className}`, h("span", { class: "muted small" }, ` until ${hm(s.end)}`)), input));
        }))),

      overdue.length > 0 && h("div", { class: "card" }, h("h3", {}, "Catch up"),
        h("div", { class: "rows" }, overdue.map((r) => reviewRow(r, true)))),

      h("div", { class: "card" }, h("h3", {}, "Reviews due today"),
        todays.length ? h("div", { class: "rows" }, todays.map((r) => reviewRow(r, false)))
          : h("p", { class: "muted" }, "Nothing scheduled for today. Reviews appear after each class and then over the following month."))
    );
  }

  function layoutLanes(events) {
    // events: {start, end} in minutes; returns lane index and lane count per event (cluster-based).
    const sorted = events.slice().sort((a, b) => a.start - b.start || b.end - a.end);
    let cluster = [], clusterEnd = -1, lanes = [];
    const flush = () => { for (const e of cluster) e.lanes = lanes.length; cluster = []; lanes = []; };
    for (const e of sorted) {
      if (e.start >= clusterEnd) flush();
      let lane = lanes.findIndex((end) => end <= e.start);
      if (lane === -1) { lane = lanes.length; lanes.push(0); }
      lanes[lane] = e.end;
      e.lane = lane;
      cluster.push(e);
      clusterEnd = Math.max(clusterEnd, e.end);
    }
    flush();
  }

  function renderWeek(el) {
    const today = startOfDay(new Date());
    const monday = S.addDays(today, -((today.getDay() + 6) % 7) + weekOffset * 7);
    const next = S.addDays(monday, 7);
    const days = Array.from({ length: 7 }, (_, i) => S.addDays(monday, i));
    const MIN_LEN = 28; // minutes; keeps short reviews clickable

    const items = [
      ...S.classSessions(state.classes, monday, next).map((s) => ({ kind: "class", s, start: s.start, end: s.end })),
      ...S.reviewsBetween(state.classes, settings(), monday, next).map((r) => ({ kind: "review", r, start: r.due, end: r.end })),
    ].map((it) => {
      const mins = (d) => d.getHours() * 60 + d.getMinutes();
      const day = days.findIndex((d) => S.ymd(d) === S.ymd(it.start));
      return { ...it, day, start_m: mins(it.start), end_m: Math.max(mins(it.end), mins(it.start) + MIN_LEN), };
    });

    const minM = Math.min(8 * 60, ...items.map((i) => i.start_m));
    const maxM = Math.max(22 * 60, ...items.map((i) => i.end_m));
    const startH = Math.floor(minM / 60), endH = Math.min(24, Math.ceil(maxM / 60));
    const PX = 44, height = (endH - startH) * PX;
    const y = (m) => ((m - startH * 60) / 60) * PX;

    const cols = days.map((d, i) => {
      const col = h("div", { class: "week__col" + (S.ymd(d) === S.ymd(today) ? " is-today" : ""), style: `height:${height}px;background-size:100% ${PX}px` });
      const evs = items.filter((it) => it.day === i).map((it) => ({ ...it, start: it.start_m, end: it.end_m, ref: it }));
      layoutLanes(evs);
      for (const e of evs) {
        const it = e.ref, w = 100 / e.lanes;
        const pos = `top:${y(e.start)}px;height:${y(e.end) - y(e.start) - 1}px;left:calc(${e.lane * w}% + 1px);width:calc(${w}% - 2px);`;
        if (it.kind === "class") {
          col.append(h("button", { class: "ev ev--class", style: pos + `background:${it.s.color}`, title: `${it.s.className} ${hm(it.s.start)}-${hm(it.s.end)}`,
            onclick: () => openClassForm(state.classes.find((c) => c.id === it.s.classId)) }, it.s.className));
        } else {
          const done = statusOf(it.r);
          col.append(h("button", { class: "ev ev--review" + (done ? " is-done" : ""), style: pos + `border-color:${it.r.color}`, title: `${it.r.className}: ${it.r.label}`,
            onclick: () => openReview(it.r) }, `${it.r.className} · ${it.r.label}`));
        }
      }
      return col;
    });

    const hours = h("div", { class: "week__hours", style: `height:${height}px` },
      Array.from({ length: endH - startH + 1 }, (_, i) => h("span", { style: `top:${i * PX}px` }, i === 0 ? "" : `${S.pad(startH + i)}:00`)));
    const label = `${monday.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${S.addDays(monday, 6).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

    fill(el, 
      h("div", { class: "view__head" }, h("h2", {}, "Week"),
        h("div", { class: "weeknav" },
          h("button", { class: "btn btn--sm", "aria-label": "Previous week", onclick: () => { weekOffset--; render(); } }, "‹"),
          h("span", { class: "muted" }, label),
          h("button", { class: "btn btn--sm", "aria-label": "Next week", onclick: () => { weekOffset++; render(); } }, "›"),
          h("button", { class: "btn btn--sm", onclick: () => { weekOffset = 0; render(); } }, "This week"))),
      state.classes.length ? h("div", { class: "card weekwrap" }, h("div", { class: "week" },
        h("div", { class: "week__head" }),
        days.map((d) => h("div", { class: "week__head" + (S.ymd(d) === S.ymd(today) ? " is-today" : "") }, `${DAY_NAMES[d.getDay()]} ${d.getDate()}`)),
        hours, cols)) : emptyState(),
      h("p", { class: "muted small" }, "Solid blocks are classes; outlined blocks are revision sessions. Click either for details.")
    );
  }

  function renderClasses(el) {
    fill(el, 
      h("div", { class: "view__head" }, h("div", {}, h("h2", {}, "Classes"), h("div", { class: "muted" }, "Your weekly timetable. Revisions are planned from this.")),
        h("button", { class: "btn btn--primary", onclick: () => openClassForm() }, "+ Add class")),
      state.classes.length ? h("div", { class: "card" }, h("div", { class: "rows" }, state.classes.map((c) =>
        h("div", { class: "row" }, h("span", { class: "dot", style: `background:${c.color}` }),
          h("div", { class: "row__main" }, h("div", { class: "row__title" }, c.name),
            h("div", { class: "muted small" }, `${DAY_ORDER.filter((d) => c.days.includes(d)).map((d) => DAY_NAMES[d]).join(", ")} · ${c.start}–${c.end}${c.endDate ? ` · until ${c.endDate}` : ""}`)),
          h("button", { class: "btn btn--sm", onclick: () => openClassForm(c) }, "Edit"),
          h("button", { class: "btn btn--sm btn--danger", onclick: () => {
            if (confirm(`Delete "${c.name}" and its revision history?`)) run(async () => { await api.deleteClass(c.id); await reload(); });
          } }, "Delete"))))) : emptyState()
    );
  }

  function curveSvg() {
    const W = 640, H = 220, P = { l: 36, r: 12, t: 12, b: 28 }, DAYS = 45;
    const x = (t) => P.l + (t / DAYS) * (W - P.l - P.r), yy = (r) => P.t + (1 - r) * (H - P.t - P.b);
    const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${yy(p[1]).toFixed(1)}`).join(" ");
    const reviewed = S.retentionCurve([0.25, 0.5, 2, 4, 7, 14, 30], DAYS);
    const plain = S.retentionCurve([], DAYS);
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "curve");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Memory retention over 45 days: without review it collapses within days; with the revision ladder it stays high.");
    const add = (tag, attrs, text) => { const n = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text) n.textContent = text; svg.append(n); };
    for (const r of [0, 0.5, 1]) { add("line", { x1: P.l, x2: W - P.r, y1: yy(r), y2: yy(r), stroke: "currentColor", "stroke-opacity": ".12" }); add("text", { x: 4, y: yy(r) + 4 }, `${r * 100}%`); }
    for (const d of [0, 7, 14, 30, 45]) add("text", { x: x(d), y: H - 8, "text-anchor": "middle" }, `${d}d`);
    add("path", { d: path(plain), fill: "none", stroke: "#98a2b3", "stroke-width": 2, "stroke-dasharray": "5 4" });
    add("path", { d: path(reviewed), fill: "none", stroke: "var(--accent)", "stroke-width": 2.5 });
    return svg;
  }

  function renderMethod(el) {
    const s = settings();
    const timeField = (label, key, hint) => {
      const input = h("input", { type: "time", value: s[key], onchange: () => {
        if (!input.value) return;
        run(async () => { await api.saveSettings({ [key]: input.value }); state.settings[key] = input.value; });
      } });
      return h("label", { class: "field" }, h("span", {}, label), input, h("span", { class: "muted small", style: "margin-top:4px" }, hint));
    };
    fill(el, 
      h("h2", {}, "Method"),
      h("div", { class: "card" }, h("h3", {}, "Why spaced revision works"),
        h("p", { class: "muted" }, "Memory fades fast right after learning (the forgetting curve). Each timely, effortful recall resets the decay and makes the memory last longer, so the gaps between reviews can grow."),
        curveSvg(),
        h("p", { class: "muted small" }, "Illustrative model: dashed = no review, solid = Cognifyx ladder. Real retention varies by person and material.")),
      h("div", { class: "card" }, h("h3", {}, "Your schedule"),
        h("div", { class: "grid" },
          timeField("Evening review at", "eveningTime", "Daily slot for the evening and later reviews."),
          timeField("Bedtime", "bedtime", "The pre-sleep review is placed 20 min before."))),
      h("div", { class: "card" }, h("h3", {}, "The revision ladder"),
        h("ul", { class: "ladder" }, S.STEPS.map((st) =>
          h("li", {}, h("b", {}, st.label), h("span", { class: "muted" }, `${S.TECHNIQUES[st.technique].name} · ${st.minutes} min`))))),
      h("div", { class: "card" }, h("h3", {}, "The techniques"),
        Object.values(S.TECHNIQUES).map((t) => h("div", { style: "margin-top:10px" }, h("b", {}, t.name), h("ol", { class: "muted small" }, t.steps.map((x) => h("li", {}, x))))))
    );
  }

  const renderers = { today: renderToday, week: renderWeek, classes: renderClasses, method: renderMethod };
  function render() {
    for (const [name, fn] of Object.entries(renderers)) {
      const el = $(`#view-${name}`);
      el.hidden = name !== view;
      if (name === view) fn(el);
    }
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === view)));
  }

  async function init() {
    document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => { view = b.dataset.view; render(); }));
    api = await window.Api.connect();
    const badge = $("#modeBadge");
    badge.textContent = api.mode === "server" ? "Synced" : "Local only";
    badge.title = api.mode === "server" ? "Saved to the Cognifyx server database" : "No server found. Data is stored in this browser only.";
    badge.classList.toggle("is-synced", api.mode === "server");
    state = await api.load();
    state.settings ||= {};
    render();
    setInterval(() => { if (view === "today" && !dialog().open && !document.activeElement?.matches("input")) render(); }, 60000);
  }
  init().catch(showError);
})();
