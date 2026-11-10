/* IT Interview Prep: shared registry and helpers. Question banks call PREP.topic(...). */
window.PREP = {
  topics: [],
  questions: [],
  challenges: [],
  gens: [],
  /**
   * meta: {id, name, short, color, icon, blurb, subs: {key: {name, tip, link}}}
   * rows: [sub, level(1 basic, 2 intermediate, 3 advanced), question, correct, [wrong, ...], explanation, code?]
   * The correct option is always written first; options are shuffled when shown.
   */
  topic(meta, rows) {
    this.topics.push(meta);
    rows.forEach((r, i) => {
      const [sub, level, q, correct, wrongs, explain, code] = r;
      this.questions.push({ id: `${meta.id}-${i + 1}`, topic: meta.id, sub, level, q, correct, wrongs, explain, code: code || "" });
    });
  },
  /** Add more questions to a topic that already exists. */
  more(topicId, rows) {
    const start = this.questions.filter((q) => q.topic === topicId).length;
    rows.forEach((r, i) => {
      const [sub, level, q, correct, wrongs, explain, code] = r;
      this.questions.push({ id: `${topicId}-${start + i + 1}`, topic: topicId, sub, level, q, correct, wrongs, explain, code: code || "" });
    });
  },
  challenge(c) { this.challenges.push(c); },
};

window.U = {
  pick: (a) => a[Math.floor(Math.random() * a.length)],
  shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  E: (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  /** `inline code` in question text */
  fmt: (s) => U.E(s).replace(/`([^`]+)`/g, "<code>$1</code>"),
  store: {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  },
  /** deep equality that ignores object key order; numbers compared to 6 decimal places */
  equal(a, b) {
    if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-6;
    if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => U.equal(x, b[i]));
    if (a && b && typeof a === "object" && typeof b === "object") {
      const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
      return U.equal(ka, kb) && ka.every((k) => U.equal(a[k], b[k]));
    }
    return a === b;
  },
  show(v) { try { return JSON.stringify(v); } catch { return String(v); } },
};
