// Pure scheduling logic. Works in the browser (window.Scheduler) and in Node (require).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Scheduler = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const parseHM = (s) => {
    const [h, m] = String(s).split(":").map(Number);
    return h * 60 + m;
  };
  // Local date + minutes-from-midnight (overflow rolls into the next day).
  const atMinutes = (day, min) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, min);

  const DEFAULT_SETTINGS = { eveningTime: "18:00", bedtime: "23:00" };

  // The revision ladder. `when` is "class-end" | "evening" | "bedtime" | "day".
  const STEPS = [
    { id: 0, label: "Right after class", when: "class-end", days: 0, minutes: 10, technique: "recall" },
    { id: 1, label: "Evening review", when: "evening", days: 0, minutes: 15, technique: "teach" },
    { id: 2, label: "Before sleep", when: "bedtime", days: 0, minutes: 10, technique: "questions" },
    { id: 3, label: "After 2 days", when: "day", days: 2, minutes: 15, technique: "answer" },
    { id: 4, label: "After 4 days", when: "day", days: 4, minutes: 15, technique: "blank" },
    { id: 5, label: "After 7 days", when: "day", days: 7, minutes: 20, technique: "test" },
    { id: 6, label: "After 2 weeks", when: "day", days: 14, minutes: 20, technique: "teach" },
    { id: 7, label: "After 1 month", when: "day", days: 30, minutes: 20, technique: "final" },
  ];

  const TECHNIQUES = {
    recall: {
      name: "Brain dump (active recall)",
      steps: [
        "Close your notes and book.",
        "Write or say everything you remember from the class, in any order.",
        "Open your notes and mark what you missed or got wrong.",
      ],
    },
    teach: {
      name: "Teach a 6-year-old",
      steps: [
        "Explain the main idea out loud to an imaginary 6-year-old.",
        "Use plain words and one everyday analogy. No jargon.",
        "Wherever you stumble or hand-wave is a gap. Go fix it, then explain again.",
      ],
    },
    questions: {
      name: "Make your own questions",
      steps: [
        "Write 3-5 exam-style questions about today's class. Prefer why and how over what.",
        "Write the answers on the back or on another page.",
        "These become your quiz for the next review.",
      ],
    },
    answer: {
      name: "Answer your questions",
      steps: [
        "Take the questions you wrote after class.",
        "Answer each one from memory before checking.",
        "Re-learn anything you missed, then write one new, harder question.",
      ],
    },
    blank: {
      name: "Blank page + teach",
      steps: [
        "Start from a blank page with only the topic as a title.",
        "Draw or write everything you can: definitions, diagrams, examples.",
        "Teach it aloud, then compare with your notes and patch the gaps.",
      ],
    },
    test: {
      name: "Practice test",
      steps: [
        "Do problems or past questions on this topic with no notes.",
        "Mix in your earlier self-made questions.",
        "Mark mistakes and note the reason for each.",
      ],
    },
    final: {
      name: "Full recall test",
      steps: [
        "Self-test on the whole topic cold, mixed with other topics from this course.",
        "If you still miss a lot, schedule an extra review this week.",
        "If you nail it, the memory is consolidated. Keep a short test before exams.",
      ],
    },
  };

  function occursOn(cls, day) {
    if (!cls.days.includes(day.getDay())) return false;
    const key = ymd(day);
    if (cls.startDate && key < cls.startDate) return false;
    if (cls.endDate && key > cls.endDate) return false;
    return true;
  }

  function reviewKey(classId, date, step) {
    return `${classId}|${date}|${step}`;
  }

  // The 8 reviews that follow one class occurrence.
  function reviewsFor(cls, date, settings) {
    const s = { ...DEFAULT_SETTINGS, ...settings };
    const day = parseYmd(date);
    const classEnd = atMinutes(day, parseHM(cls.end));
    const eveningMin = parseHM(s.eveningTime);

    // Evening review never lands before the class is over (+45 min to travel/eat).
    let evening = atMinutes(day, eveningMin);
    const earliestEvening = new Date(classEnd.getTime() + 45 * 60000);
    if (evening < earliestEvening) evening = earliestEvening;

    // Bedtime after midnight (e.g. 01:00) belongs to the same "night".
    let bedMin = parseHM(s.bedtime);
    if (bedMin < 360) bedMin += 1440;
    let bed = atMinutes(day, bedMin - 20);
    const earliestBed = new Date(evening.getTime() + (STEPS[1].minutes + 30) * 60000);
    if (bed < earliestBed) bed = earliestBed;

    return STEPS.map((st) => {
      let due;
      if (st.when === "class-end") due = classEnd;
      else if (st.when === "evening") due = evening;
      else if (st.when === "bedtime") due = bed;
      else due = atMinutes(addDays(day, st.days), eveningMin);
      return {
        key: reviewKey(cls.id, date, st.id),
        classId: cls.id,
        className: cls.name,
        color: cls.color,
        date,
        step: st.id,
        label: st.label,
        technique: st.technique,
        minutes: st.minutes,
        due,
        end: new Date(due.getTime() + st.minutes * 60000),
      };
    });
  }

  // Class sessions with start in [from, to).
  function classSessions(classes, from, to) {
    const out = [];
    for (let day = new Date(from); day < to; day = addDays(day, 1)) {
      for (const cls of classes) {
        if (!occursOn(cls, day)) continue;
        out.push({
          key: `${cls.id}|${ymd(day)}`,
          classId: cls.id,
          className: cls.name,
          color: cls.color,
          date: ymd(day),
          start: atMinutes(day, parseHM(cls.start)),
          end: atMinutes(day, parseHM(cls.end)),
        });
      }
    }
    return out;
  }

  // Reviews with due time in [from, to), sorted by time.
  function reviewsBetween(classes, settings, from, to) {
    const out = [];
    const maxLag = STEPS[STEPS.length - 1].days + 1;
    for (let day = addDays(from, -maxLag); day < to; day = addDays(day, 1)) {
      for (const cls of classes) {
        if (!occursOn(cls, day)) continue;
        for (const r of reviewsFor(cls, ymd(day), settings)) {
          if (r.due >= from && r.due < to) out.push(r);
        }
      }
    }
    return out.sort((a, b) => a.due - b.due);
  }

  // Ebbinghaus-style retention R = exp(-t/S); each review multiplies stability S.
  function retentionCurve(reviewDays, horizonDays, baseStability = 1, gain = 2.4) {
    const points = [];
    let s = baseStability;
    let last = 0;
    let r0 = 1;
    const marks = reviewDays.filter((d) => d <= horizonDays);
    for (let t = 0; t <= horizonDays; t += 0.25) {
      const nextMark = marks.find((m) => m <= t && m > last);
      if (nextMark !== undefined) {
        r0 = 1;
        s *= gain;
        last = nextMark;
      }
      points.push([t, r0 * Math.exp(-(t - last) / s)]);
    }
    return points;
  }

  return {
    STEPS, TECHNIQUES, DEFAULT_SETTINGS,
    ymd, parseYmd, addDays, parseHM, atMinutes, pad,
    occursOn, reviewKey, reviewsFor, classSessions, reviewsBetween, retentionCurve,
  };
});
