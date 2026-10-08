// Data layer. Uses the server API when reachable, otherwise falls back to localStorage.
// Both backends expose the same interface so the UI doesn't care which one it has.
(function () {
  const LS_KEY = "cognifyx_state_v2";
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `c_${Date.now()}_${Math.random().toString(16).slice(2)}`);

  function remote() {
    const call = async (method, path, body) => {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      return res.status === 204 ? null : res.json();
    };
    return {
      mode: "server",
      load: () => call("GET", "api/state"),
      saveClass: (c) => (c.id ? call("PUT", `api/classes/${c.id}`, c) : call("POST", "api/classes", c)),
      deleteClass: (id) => call("DELETE", `api/classes/${id}`),
      saveSettings: (s) => call("PUT", "api/settings", s),
      setReview: (classId, date, step, status) => call("PUT", "api/reviews", { classId, date, step, status }),
      setNote: (classId, date, topic) => call("PUT", "api/notes", { classId, date, topic }),
    };
  }

  function local() {
    const read = () => {
      try {
        const s = JSON.parse(localStorage.getItem(LS_KEY));
        if (s && Array.isArray(s.classes)) return s;
      } catch { /* fall through */ }
      return { classes: [], settings: {}, reviews: {}, notes: {} };
    };
    const write = (s) => localStorage.setItem(LS_KEY, JSON.stringify(s));
    const update = (fn) => { const s = read(); const r = fn(s); write(s); return r; };
    return {
      mode: "local",
      load: async () => read(),
      saveClass: async (c) => update((s) => {
        const clean = { ...c, endDate: c.endDate || null };
        if (!clean.id) { clean.id = uid(); s.classes.push(clean); }
        else { const i = s.classes.findIndex((x) => x.id === clean.id); if (i >= 0) s.classes[i] = clean; else s.classes.push(clean); }
        return clean;
      }),
      deleteClass: async (id) => update((s) => {
        s.classes = s.classes.filter((c) => c.id !== id);
        for (const k of Object.keys(s.reviews)) if (k.startsWith(id + "|")) delete s.reviews[k];
        for (const k of Object.keys(s.notes)) if (k.startsWith(id + "|")) delete s.notes[k];
      }),
      saveSettings: async (patch) => update((s) => { Object.assign(s.settings, patch); return s.settings; }),
      setReview: async (classId, date, step, status) => update((s) => {
        const k = `${classId}|${date}|${step}`;
        if (status) s.reviews[k] = status; else delete s.reviews[k];
      }),
      setNote: async (classId, date, topic) => update((s) => {
        const k = `${classId}|${date}`;
        if (topic) s.notes[k] = topic; else delete s.notes[k];
      }),
    };
  }

  async function connect() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch("api/state", { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok && (res.headers.get("content-type") || "").includes("json")) return remote();
    } catch { /* no server */ }
    return local();
  }

  window.Api = { connect };
})();
