/* IT Interview Prep: pages, assessment flow, report, progress and coding challenges. */
(() => {
  const { E, fmt, shuffle, store } = U;
  const $ = (s, el = document) => el.querySelector(s);
  const app = $("#app");
  const HIST = "itprep-history-v1", SOLVED = "itprep-solved-v1", DRAFT = "itprep-code-";
  const LEVELS = { 1: "Basic", 2: "Intermediate", 3: "Advanced" };
  const LANG = { python: "Python", javascript: "JavaScript", sql: "SQL" };
  const topicOf = (id) => PREP.topics.find((t) => t.id === id);
  const pct = (c, n) => (n ? Math.round((c / n) * 100) : 0);
  const rating = (p) => (p >= 80 ? ["Strong", "good"] : p >= 60 ? ["Good", "ok"] : p >= 40 ? ["Developing", "warn"] : ["Needs focus", "bad"]);
  let quiz = null, leave = null;

  // ---------------------------------------------------------------- router
  const routes = { "": home, assess: setup, quiz: quizPage, report: reportPage, progress: progressPage, code: codeList, challenge: challengePage, about };
  function router() {
    if (leave) { leave(); leave = null; }
    const [page, arg] = location.hash.replace(/^#\/?/, "").split("/");
    (routes[page] || home)(arg ? decodeURIComponent(arg) : "");
    document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#/" + (page || "")));
    window.scrollTo(0, 0);
  }
  addEventListener("hashchange", router);

  // ---------------------------------------------------------------- home
  function bestFor(topic) {
    const h = store.get(HIST, []).filter((r) => r.perTopic[topic]);
    return h.length ? Math.max(...h.map((r) => pct(r.perTopic[topic].c, r.perTopic[topic].n))) : null;
  }
  function home() {
    const solved = Object.keys(store.get(SOLVED, {})).length;
    const tests = store.get(HIST, []).length;
    app.innerHTML = `
      <section class="hero">
        <div>
          <h1>Get ready for your <span>IT interview</span></h1>
          <p class="lead">Take an assessment in ${PREP.topics.length} areas, from UNIX and SQL to DevOps and SRE. Get a report on where to focus, and practise coding problems that run right in your browser.</p>
          <div class="cta"><a class="btn" href="#/assess">Start an assessment</a><a class="btn ghost" href="#/code">Coding challenges</a></div>
          <p class="small muted">Free · no sign-up · ${PREP.questions.length} questions · ${PREP.challenges.length} coding challenges · your results stay on this device</p>
        </div>
        <div class="hero-card">
          <div class="stat"><b>${tests}</b><span>assessments taken</span></div>
          <div class="stat"><b>${solved}</b><span>challenges solved</span></div>
          <a class="small" href="#/progress">See my progress →</a>
        </div>
      </section>
      <h2 class="sec">Choose a topic</h2>
      <div class="topics">${PREP.topics.map((t) => {
        const best = bestFor(t.id), n = PREP.questions.filter((q) => q.topic === t.id).length;
        return `<a class="topic" href="#/assess/${t.id}" style="--c:${t.color}"><span class="ticon">${t.icon}</span>
          <b>${E(t.name)}</b><span class="tblurb">${E(t.blurb)}</span>
          <span class="tmeta">${n} questions${PREP.gens.some((g) => g.topic === t.id) ? " + unlimited practice" : ""}${best === null ? "" : ` · best <b>${best}%</b>`}</span></a>`;
      }).join("")}</div>
      <section class="split">
        <a class="feature" href="#/assess"><span class="ficon">🧭</span><b>Full skills check</b><span>Mix several topics in one test and get a single report showing your strongest and weakest areas.</span></a>
        <a class="feature" href="#/code"><span class="ficon">⌨️</span><b>HackerRank-style coding</b><span>Solve problems in Python, JavaScript or SQL. Your code is checked against visible and hidden tests.</span></a>
        <a class="feature" href="#/progress"><span class="ficon">📊</span><b>Track your progress</b><span>See your scores over time and practise only your focus areas.</span></a>
      </section>
      <div id="promos"></div>`;
    promos();
  }
  async function promos() {
    try {
      const ads = (await (await fetch("ads.json", { cache: "no-cache" })).json()).ads || [];
      const box = $("#promos");
      if (!box || !ads.length) return;
      box.innerHTML = `<h2 class="sec">Also from us</h2><div class="promo-grid">${ads.map((a) => `<a class="promo" href="${E(a.url)}" target="_blank" rel="sponsored noopener">
        <span class="promo-label">Advertisement</span>${a.image ? `<img class="${a.book ? "book" : ""}" src="${E(a.image)}" alt="" loading="lazy">` : ""}
        <span class="promo-text"><span class="promo-kicker">${E(a.kicker)}</span><strong>${E(a.title)}</strong><span>${E(a.text)}</span></span>
        <span class="promo-cta">${E(a.cta)} ↗</span></a>`).join("")}</div>`;
    } catch {}
  }

  // ---------------------------------------------------------------- assessment setup
  function setup(preset) {
    const last = store.get("itprep-setup", { topics: [], per: 10, level: "all", mode: "test", timed: false });
    const chosen = new Set(preset ? [preset] : last.topics.length ? last.topics : []);
    app.innerHTML = `
      <h1>Start an assessment</h1>
      <p class="lead">Pick the topics for your interview. You'll get a report by topic and sub-topic, with what to study next.</p>
      <form id="setup" class="panel">
        <div class="row-h"><h3>1. Topics</h3><span><button type="button" class="link" id="all">Select all</button> · <button type="button" class="link" id="none">Clear</button></span></div>
        <div class="chips">${PREP.topics.map((t) => `<label class="chip-check" style="--c:${t.color}"><input type="checkbox" name="t" value="${t.id}" ${chosen.has(t.id) ? "checked" : ""}><span>${t.icon} ${E(t.short)}</span></label>`).join("")}</div>
        <div class="grid3">
          <label><h3>2. Questions per topic</h3><select name="per">${[5, 10, 20, 999].map((n) => `<option value="${n}" ${last.per == n ? "selected" : ""}>${n === 999 ? "All questions" : n}</option>`).join("")}</select></label>
          <label><h3>3. Level</h3><select name="level"><option value="all">All levels</option>${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}" ${last.level == k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
          <label><h3>4. Mode</h3><select name="mode"><option value="test" ${last.mode === "test" ? "selected" : ""}>Test: answers shown at the end</option><option value="practice" ${last.mode === "practice" ? "selected" : ""}>Practice: see each answer straight away</option></select></label>
        </div>
        <label class="tick"><input type="checkbox" name="timed" ${last.timed ? "checked" : ""}> Timed: 60 seconds per question, like a real screening test</label>
        <p class="err" id="err"></p>
        <div class="actions"><button class="btn" type="submit">Start →</button><span class="muted small" id="count"></span></div>
      </form>`;
    const f = $("#setup");
    const update = () => {
      const ts = [...f.querySelectorAll("[name=t]:checked")].map((x) => x.value);
      const n = pool(ts, f.level.value).length;
      const g = ts.some((t) => PREP.gens.some((x) => x.topic === t));
      $("#count").textContent = ts.length ? `About ${Number(f.per.value) >= 999 ? n : Math.min(n + (g ? 999 : 0), ts.length * Number(f.per.value))} questions from ${ts.length} topic${ts.length > 1 ? "s" : ""}${g ? ", including freshly generated ones" : ""}` : "";
    };
    f.addEventListener("change", update); update();
    $("#all").onclick = () => { f.querySelectorAll("[name=t]").forEach((x) => (x.checked = true)); update(); };
    $("#none").onclick = () => { f.querySelectorAll("[name=t]").forEach((x) => (x.checked = false)); update(); };
    f.onsubmit = (e) => {
      e.preventDefault();
      const opts = { topics: [...f.querySelectorAll("[name=t]:checked")].map((x) => x.value), per: Number(f.per.value), level: f.level.value, mode: f.mode.value, timed: f.timed.checked };
      if (!opts.topics.length) { $("#err").textContent = "Choose at least one topic."; return; }
      store.set("itprep-setup", opts);
      const qs = [];
      for (const t of opts.topics) qs.push(...buildFor(t, opts.level, opts.per));
      if (!qs.length) { $("#err").textContent = "No questions match that level for these topics. Try All levels."; return; }
      begin(shuffle(qs), opts);
    };
  }
  /** Questions for one topic: a mix of written questions and freshly generated ones (where the topic has generators). */
  function buildFor(topic, level, per, subs) {
    const okLevel = (x) => level === "all" || x.level == level;
    const okSub = (x) => !subs || subs.has(`${x.topic}.${x.sub}`);
    const written = PREP.questions.filter((q) => q.topic === topic && okLevel(q) && okSub(q));
    const gens = PREP.gens.filter((g) => g.topic === topic && okLevel(g) && okSub(g));
    if (!gens.length) return pickBalanced(written, per);
    const nGen = per >= 999 ? 15 : Math.min(Math.round(per * 0.4) || 1, per), nWritten = per >= 999 ? written.length : Math.max(per - nGen, 0);
    const out = pickBalanced(written, nWritten);
    const order = shuffle(gens);
    for (let i = 0; out.length < (per >= 999 ? written.length + nGen : per) && i < nGen + per; i++) {
      const q = PREP.makeGen(order[i % order.length]);
      if (q) out.push(q);
    }
    return out;
  }
  const pool = (topics, level) => PREP.questions.filter((q) => topics.includes(q.topic) && (level === "all" || q.level == level));
  /** Pick n questions spread across sub-topics, so the report covers each area. */
  function pickBalanced(qs, n) {
    const bySub = {};
    shuffle(qs).forEach((q) => (bySub[q.sub] = bySub[q.sub] || []).push(q));
    const lists = shuffle(Object.values(bySub)), out = [];
    while (out.length < n && lists.some((l) => l.length)) for (const l of lists) if (l.length && out.length < n) out.push(l.shift());
    return shuffle(out);
  }
  function begin(qs, opts) {
    quiz = {
      opts, i: 0, started: Date.now(), answers: [],
      qs: qs.map((q) => ({ ...q, options: shuffle([q.correct, ...q.wrongs]) })),
      deadline: opts.timed ? Date.now() + qs.length * 60000 : null,
    };
    location.hash = "#/quiz";
  }

  // ---------------------------------------------------------------- quiz
  function quizPage() {
    if (!quiz) { location.hash = "#/assess"; return; }
    let timer = null;
    leave = () => clearInterval(timer);
    const draw = () => {
      const q = quiz.qs[quiz.i], t = topicOf(q.topic), done = quiz.answers[quiz.i];
      app.innerHTML = `
        <div class="quiz">
          <div class="qtop">
            <span class="tag" style="--c:${t.color}">${t.icon} ${E(t.short)} · ${E(t.subs[q.sub].name)}</span>
            <span class="muted">${LEVELS[q.level]}</span>
            <span class="spacer"></span>
            ${quiz.deadline ? '<span class="clock" id="clock"></span>' : ""}
            <span class="muted">Question <b>${quiz.i + 1}</b> of ${quiz.qs.length}</span>
          </div>
          <div class="bar"><span style="width:${(quiz.i / quiz.qs.length) * 100}%"></span></div>
          <h2 class="question">${fmt(q.q)}</h2>
          ${q.code ? `<pre class="code">${E(q.code)}</pre>` : ""}
          <div class="options">${q.options.map((o, k) => `<button class="opt" data-k="${k}"><span class="key">${"ABCD"[k]}</span><span>${fmt(o)}</span></button>`).join("")}</div>
          <div id="feedback"></div>
          <div class="actions qnav">
            <button class="btn ghost" id="skip">${quiz.i === quiz.qs.length - 1 ? "Finish" : "Skip"}</button>
            <span class="spacer"></span>
            <button class="link" id="quit">End test now</button>
          </div>
        </div>`;
      const opts = [...app.querySelectorAll(".opt")];
      const choose = (k) => {
        if (quiz.answers[quiz.i]) return;
        const chosen = q.options[k], ok = chosen === q.correct;
        quiz.answers[quiz.i] = { qid: q.id, chosen, ok };
        if (quiz.opts.mode === "practice") {
          opts.forEach((b, j) => { b.disabled = true; if (q.options[j] === q.correct) b.classList.add("right"); else if (j === k) b.classList.add("wrong"); });
          $("#feedback").innerHTML = `<div class="explain ${ok ? "good" : "bad"}"><b>${ok ? "Correct." : "Not quite."}</b> ${fmt(q.explain)}</div>`;
          $("#skip").textContent = quiz.i === quiz.qs.length - 1 ? "See my report →" : "Next question →";
          $("#skip").classList.remove("ghost");
        } else next();
      };
      opts.forEach((b) => (b.onclick = () => choose(Number(b.dataset.k))));
      $("#skip").onclick = () => next();
      $("#quit").onclick = () => { if (confirm("End the test now? Unanswered questions count as wrong.")) finish(); };
      document.onkeydown = (e) => {
        if (!location.hash.startsWith("#/quiz")) { document.onkeydown = null; return; }
        const k = "abcd".indexOf(e.key.toLowerCase());
        if (k >= 0 && k < opts.length) choose(k);
        else if (e.key === "Enter" && quiz.answers[quiz.i]) next();
      };
      void done;
    };
    const next = () => { if (quiz.i < quiz.qs.length - 1) { quiz.i++; draw(); } else finish(); };
    const tick = () => {
      const el = $("#clock"); if (!quiz || !quiz.deadline || !el) return;
      const left = Math.max(0, quiz.deadline - Date.now());
      el.textContent = `⏱ ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
      el.classList.toggle("low", left < 60000);
      if (!left) { clearInterval(timer); alert("Time is up! Here is your report."); finish(); }
    };
    draw();
    if (quiz.deadline) { tick(); timer = setInterval(tick, 500); }
  }

  function finish() {
    document.onkeydown = null;
    const rec = { id: Date.now().toString(36), date: new Date().toISOString(), mode: quiz.opts.mode, timed: quiz.opts.timed, secs: Math.round((Date.now() - quiz.started) / 1000), perTopic: {}, perSub: {}, perLevel: {}, answers: [] };
    quiz.qs.forEach((q, i) => {
      const a = quiz.answers[i] || { qid: q.id, chosen: null, ok: false };
      if (q.gen) a.snap = { q: q.q, code: q.code, correct: q.correct, explain: q.explain };
      rec.answers.push(a);
      const add = (o, k) => { o[k] = o[k] || { c: 0, n: 0 }; o[k].n++; if (a.ok) o[k].c++; };
      add(rec.perTopic, q.topic); add(rec.perSub, `${q.topic}.${q.sub}`); add(rec.perLevel, q.level);
    });
    rec.c = rec.answers.filter((a) => a.ok).length; rec.n = rec.answers.length;
    const h = store.get(HIST, []); h.unshift(rec); store.set(HIST, h.slice(0, 40));
    quiz = null;
    location.hash = "#/report/" + rec.id;
  }

  // ---------------------------------------------------------------- report
  function reportPage(id) {
    const rec = store.get(HIST, []).find((r) => r.id === id);
    if (!rec) { app.innerHTML = '<p class="muted">Report not found. It may have been cleared from this browser.</p>'; return; }
    const total = pct(rec.c, rec.n), [label, cls] = rating(total);
    const topics = Object.entries(rec.perTopic).map(([t, s]) => ({ t: topicOf(t), p: pct(s.c, s.n), ...s })).filter((x) => x.t).sort((a, b) => a.p - b.p);
    const subs = Object.entries(rec.perSub).map(([k, s]) => { const [t, sub] = k.split("."); const T = topicOf(t); return T && { T, sub, info: T.subs[sub], p: pct(s.c, s.n), ...s }; }).filter(Boolean);
    const focus = subs.filter((s) => s.p < 70).sort((a, b) => a.p - b.p || b.n - a.n);
    const strong = subs.filter((s) => s.p >= 80 && s.n >= 2).sort((a, b) => b.p - a.p);
    const qById = Object.fromEntries(PREP.questions.map((q) => [q.id, q]));
    const verdict = total >= 80 ? "You're interview-ready in these areas. Keep practising the coding challenges and polish any weaker sub-topics below."
      : total >= 60 ? "A solid base. Close the gaps in your focus areas below and you'll be in good shape."
      : total >= 40 ? "You know the basics. Spend time on the focus areas below, then retake the test."
      : "Start with the focus areas below: revise each one, then use practice mode to learn as you go.";
    app.innerHTML = `
      <div class="report">
        <div class="score-card ${cls}">
          <div class="ring" style="--p:${total}"><b>${total}%</b></div>
          <div><p class="kicker">Your result · ${new Date(rec.date).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" })}</p>
            <h1>${label}</h1><p>${rec.c} of ${rec.n} correct in ${Math.floor(rec.secs / 60)} min ${rec.secs % 60} s${rec.timed ? " (timed)" : ""}. ${verdict}</p></div>
        </div>

        <h2 class="sec">Results by topic</h2>
        <div class="bars">${topics.map((x) => { const [l, c] = rating(x.p); return `<div class="brow"><span class="bname">${x.t.icon} ${E(x.t.name)}</span>
          <span class="btrack"><span class="bfill ${c}" style="width:${Math.max(x.p, 2)}%"></span></span><span class="bval">${x.p}%</span><span class="pill ${c}">${l}</span></div>`; }).join("")}</div>

        <div class="cols2">
          <div class="panel">
            <h2>🎯 Focus on these next</h2>
            ${focus.length ? `<ol class="focus">${focus.slice(0, 8).map((s) => `<li><b>${E(s.T.short)}: ${E(s.info.name)}</b> <span class="pill ${rating(s.p)[1]}">${s.c}/${s.n}</span>
              <p>${fmt(s.info.tip)}</p><a href="${E(s.info.link)}" target="_blank" rel="noopener">Study guide ↗</a></li>`).join("")}</ol>
              <button class="btn" id="drill">Practise my focus areas</button>`
              : "<p>No weak areas in this test: everything scored 70% or more. Try a harder level or more topics.</p>"}
          </div>
          <div class="panel">
            <h2>💪 Your strengths</h2>
            ${strong.length ? `<ul class="strong">${strong.slice(0, 8).map((s) => `<li>${s.T.icon} <b>${E(s.T.short)}</b>: ${E(s.info.name)} <span class="pill good">${s.p}%</span></li>`).join("")}</ul>` : "<p class=\"muted\">Strengths appear here once you score 80% or more in a sub-topic (with at least 2 questions).</p>"}
            <h3>By difficulty</h3>
            <ul class="strong">${Object.entries(rec.perLevel).map(([l, s]) => `<li>${LEVELS[l]} <span class="pill ${rating(pct(s.c, s.n))[1]}">${s.c}/${s.n}</span></li>`).join("")}</ul>
            <p class="small muted">Interview tip: aim for 80%+ on Basic and Intermediate questions in the main skills of the job description.</p>
          </div>
        </div>

        <div class="actions noprint"><a class="btn ghost" href="#/assess">New assessment</a><button class="btn ghost" id="print">Print / save as PDF</button><a class="btn ghost" href="#/code">Try coding challenges</a></div>

        <h2 class="sec">Review your answers</h2>
        <div class="review">${rec.answers.map((a, i) => { const q = qById[a.qid] || a.snap; if (!q) return ""; return `<details class="rv ${a.ok ? "ok" : "no"}">
          <summary><span class="mark">${a.ok ? "✓" : "✗"}</span> <span>${i + 1}. ${fmt(q.q)}</span></summary>
          ${q.code ? `<pre class="code">${E(q.code)}</pre>` : ""}
          <p>Your answer: <b>${a.chosen ? fmt(a.chosen) : "not answered"}</b></p>${a.ok ? "" : `<p>Correct answer: <b>${fmt(q.correct)}</b></p>`}
          <p class="muted">${fmt(q.explain)}</p></details>`; }).join("")}</div>
        <div id="promos" class="noprint"></div>
      </div>`;
    promos();
    $("#print").onclick = () => window.print();
    const drill = $("#drill");
    if (drill) drill.onclick = () => {
      const keys = new Set(focus.map((s) => `${s.T.id}.${s.sub}`));
      const qs = shuffle([...new Set(focus.map((s) => s.T.id))].flatMap((t) => buildFor(t, "all", 12, keys))).slice(0, 30);
      begin(qs, { topics: [...new Set(focus.map((s) => s.T.id))], per: 0, level: "all", mode: "practice", timed: false });
    };
  }

  // ---------------------------------------------------------------- progress
  function progressPage() {
    const h = store.get(HIST, []), solved = store.get(SOLVED, {});
    const rows = PREP.topics.map((t) => {
      const runs = h.filter((r) => r.perTopic[t.id]).map((r) => pct(r.perTopic[t.id].c, r.perTopic[t.id].n));
      return { t, runs, best: runs.length ? Math.max(...runs) : null, latest: runs.length ? runs[0] : null };
    });
    app.innerHTML = `
      <h1>My progress</h1>
      <p class="lead">Saved only in this browser. Nothing is sent anywhere.</p>
      <div class="panel"><h2>Topics</h2>
        <table class="tbl"><thead><tr><th>Topic</th><th>Tests</th><th>Latest</th><th>Best</th><th>Trend (oldest → newest)</th><th></th></tr></thead><tbody>
        ${rows.map(({ t, runs, best, latest }) => `<tr><td>${t.icon} ${E(t.name)}</td><td>${runs.length}</td>
          <td>${latest === null ? "–" : `<span class="pill ${rating(latest)[1]}">${latest}%</span>`}</td><td>${best === null ? "–" : best + "%"}</td>
          <td><span class="spark">${runs.slice(0, 10).reverse().map((p) => `<i style="height:${Math.max(p, 4)}%" class="${rating(p)[1]}" title="${p}%"></i>`).join("")}</span></td>
          <td><a href="#/assess/${t.id}">Test →</a></td></tr>`).join("")}</tbody></table></div>
      <div class="panel"><h2>Past assessments</h2>
        ${h.length ? `<ul class="hist">${h.map((r) => { const p = pct(r.c, r.n); return `<li><a href="#/report/${r.id}">${new Date(r.date).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" })}</a>
          <span>${Object.keys(r.perTopic).map((t) => topicOf(t)?.short).filter(Boolean).join(", ")}</span><span class="pill ${rating(p)[1]}">${p}%</span></li>`; }).join("")}</ul>` : '<p class="muted">No assessments yet. <a href="#/assess">Take your first one</a>.</p>'}
      </div>
      <div class="panel"><h2>Coding challenges</h2><p>${Object.keys(solved).length} of ${PREP.challenges.length} solved.</p></div>
      <p><button class="link danger" id="wipe">Clear all my saved results and code</button></p>`;
    $("#wipe").onclick = () => {
      if (!confirm("Delete all saved results, solved challenges and code drafts from this browser?")) return;
      Object.keys(localStorage).filter((k) => k.startsWith("itprep-")).forEach((k) => localStorage.removeItem(k));
      progressPage();
    };
  }

  // ---------------------------------------------------------------- coding challenges
  function codeList() {
    const solved = store.get(SOLVED, {});
    const f = store.get("itprep-codefilter", { lang: "", level: "" });
    const draw = () => {
      const list = PREP.challenges.filter((c) => (!f.lang || c.langs.includes(f.lang)) && (!f.level || c.level === f.level));
      $("#clist").innerHTML = list.map((c) => `<a class="crow" href="#/challenge/${c.id}">
        <span class="cstate">${solved[c.id] ? "✅" : "○"}</span>
        <span class="cname"><b>${E(c.title)}</b><span class="muted">${E(c.topic)}</span></span>
        <span class="langs">${c.langs.map((l) => `<span class="lang ${l}">${LANG[l]}</span>`).join("")}</span>
        <span class="lvl ${c.level.toLowerCase()}">${c.level}</span></a>`).join("") || '<p class="muted">No challenges match.</p>';
    };
    app.innerHTML = `
      <h1>Coding challenges</h1>
      <p class="lead">Write code, press <b>Run</b> to try the sample tests, then <b>Submit</b> to check against the hidden tests too, just like HackerRank. Everything runs in your browser.</p>
      <div class="filters">
        <select id="fl"><option value="">All languages</option>${Object.entries(LANG).map(([k, v]) => `<option value="${k}" ${f.lang === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <select id="fv"><option value="">All levels</option>${["Easy", "Medium", "Hard"].map((v) => `<option ${f.level === v ? "selected" : ""}>${v}</option>`).join("")}</select>
        <span class="muted small">${Object.keys(solved).length} of ${PREP.challenges.length} solved</span>
      </div>
      <div id="clist" class="clist"></div>
      <div id="promos"></div>`;
    promos();
    $("#fl").onchange = (e) => { f.lang = e.target.value; store.set("itprep-codefilter", f); draw(); };
    $("#fv").onchange = (e) => { f.level = e.target.value; store.set("itprep-codefilter", f); draw(); };
    draw();
  }

  function challengePage(id) {
    const c = PREP.challenges.find((x) => x.id === id);
    if (!c) { location.hash = "#/code"; return; }
    let lang = store.get("itprep-lang", "python");
    if (!c.langs.includes(lang)) lang = c.langs[0];
    const isSql = lang === "sql";
    const visible = isSql ? 1 : Math.min(3, c.tests.length);
    const examples = isSql ? "" : `<h3>Examples</h3>${c.examples.map(([i, o]) => `<pre class="code small">Input:  ${E(i)}\nOutput: ${E(o)}</pre>`).join("")}`;
    app.innerHTML = `
      <div class="ide">
        <section class="problem">
          <a href="#/code" class="small">← All challenges</a>
          <h1>${E(c.title)}</h1>
          <p><span class="lvl ${c.level.toLowerCase()}">${c.level}</span> <span class="muted">${E(c.topic)}</span></p>
          <p>${fmt(c.text)}</p>
          ${examples}
          ${isSql ? `<h3>Tables</h3><pre class="code small">${E(c.tables)}</pre><p class="small muted">The database is SQLite. Your query is checked on this data and on a hidden data set.</p><div id="preview"></div>` : `<p class="small muted">Write the function <code>${E(c.fn[lang])}</code>. ${visible} sample tests are shown; ${c.tests.length - visible} more ${c.tests.length - visible === 1 ? "is" : "are"} hidden.</p>`}
        </section>
        <section class="editor-wrap">
          <div class="etop">
            <select id="lang">${c.langs.map((l) => `<option value="${l}" ${l === lang ? "selected" : ""}>${LANG[l]}</option>`).join("")}</select>
            <span class="spacer"></span>
            <button class="link" id="reset">Reset code</button>
            <button class="link" id="sol">Show a solution</button>
          </div>
          <div class="editor"><pre class="gutter" id="gutter"></pre><textarea id="code" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></div>
          <div class="actions"><button class="btn ghost" id="run">▶ Run</button><button class="btn" id="submit">Submit</button><span class="muted small" id="status">Ctrl + Enter runs your code</span></div>
          <div id="out" class="out"></div>
        </section>
      </div>`;
    const ta = $("#code"), gut = $("#gutter");
    const key = () => DRAFT + c.id + "-" + lang;
    const lines = () => { gut.textContent = Array.from({ length: ta.value.split("\n").length }, (_, i) => i + 1).join("\n"); gut.scrollTop = ta.scrollTop; };
    const load = () => { ta.value = store.get(key(), null) ?? c.starter[lang]; lines(); };
    load();
    ta.addEventListener("input", () => { store.set(key(), ta.value); lines(); });
    ta.addEventListener("scroll", () => (gut.scrollTop = ta.scrollTop));
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const s = ta.selectionStart, ind = lang === "python" ? "    " : "  ";
        ta.setRangeText(ind, s, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input"));
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(false); }
      else if (e.key === "Enter") {
        const s = ta.selectionStart, line = ta.value.slice(0, s).split("\n").pop(), ind = line.match(/^\s*/)[0] + (/[:{(\[]\s*$/.test(line) ? (lang === "python" ? "    " : "  ") : "");
        e.preventDefault(); ta.setRangeText("\n" + ind, s, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input"));
      }
    });
    $("#lang").onchange = (e) => { store.set("itprep-lang", e.target.value); challengePage(id); };
    $("#reset").onclick = () => { if (confirm("Replace your code with the starter code?")) { ta.value = c.starter[lang]; ta.dispatchEvent(new Event("input")); } };
    $("#sol").onclick = () => {
      if (!confirm("Show a model solution? Try it yourself first: it's the best interview practice.")) return;
      $("#out").innerHTML = `<h3>A model solution</h3><pre class="code">${E(c.solution[lang])}</pre><p class="small muted">There are many correct answers. Compare the approach, then try writing it again from memory.</p>`;
    };
    if (lang === "python") RUN.pyLoad();
    if (isSql) sqlPreview(c);

    let busy = false;
    async function run(all) {
      if (busy) return; busy = true;
      const status = $("#status"), out = $("#out");
      status.textContent = lang === "python" ? "Running… (the first run downloads Python, about 10 MB)" : "Running…";
      $("#run").disabled = $("#submit").disabled = true;
      try {
        if (isSql) await runSqlChallenge(c, ta.value, all, out);
        else await runCodeChallenge(c, lang, ta.value, all ? c.tests.length : visible, out);
      } finally { busy = false; $("#run").disabled = $("#submit").disabled = false; status.textContent = "Ctrl + Enter runs your code"; }
    }
    $("#run").onclick = () => run(false);
    $("#submit").onclick = () => run(true);
  }

  async function runCodeChallenge(c, lang, code, count, out) {
    const tests = c.tests.slice(0, count);
    const res = await (lang === "python" ? RUN.runPy : RUN.runJs)(code, c.fn[lang], tests.map((t) => t[0]));
    const logs = res.logs ? (Array.isArray(res.logs) ? res.logs.join("\n") : res.logs) : "";
    if (res.error) { out.innerHTML = `<div class="verdict bad">Error</div><pre class="code err">${E(res.error)}</pre>${logs ? `<h3>Output</h3><pre class="code">${E(logs)}</pre>` : ""}`; return; }
    const rows = tests.map(([args, exp], i) => ({ i, args, exp, r: res.results[i], ok: !res.results[i].error && U.equal(res.results[i].value, exp), hidden: i >= Math.min(3, c.tests.length) }));
    const passed = rows.filter((r) => r.ok).length, all = count === c.tests.length;
    if (all && passed === rows.length) markSolved(c, lang);
    out.innerHTML = `<div class="verdict ${passed === rows.length ? "good" : "bad"}">${passed === rows.length ? (all ? "🎉 Accepted: all tests passed" : "Sample tests passed. Now press Submit to run the hidden tests.") : `${passed} of ${rows.length} tests passed`}</div>
      <div class="tests">${rows.map((t) => `<details class="test ${t.ok ? "ok" : "no"}" ${!t.ok && !t.hidden ? "open" : ""}>
        <summary>${t.ok ? "✓" : "✗"} Test ${t.i + 1}${t.hidden ? " (hidden)" : ""} <span class="muted small">${t.r.ms != null ? t.r.ms.toFixed(1) + " ms" : ""}</span></summary>
        ${t.hidden ? `<p class="small muted">${t.ok ? "Passed." : "Hidden test failed. Think about edge cases: empty input, duplicates, negatives, ties."}</p>` : `
        <pre class="code small">Input:    ${E(t.args.map(U.show).join(", "))}\nExpected: ${E(U.show(t.exp))}\nGot:      ${E(t.r.error ? "Error: " + t.r.error : U.show(t.r.value))}</pre>`}</details>`).join("")}</div>
      ${logs ? `<h3>Your printed output</h3><pre class="code">${E(logs)}</pre>` : ""}`;
  }

  async function runSqlChallenge(c, query, all, out) {
    let html = "";
    let okAll = true;
    for (let d = 0; d < (all ? c.data.length : 1); d++) {
      let mine, want;
      try {
        [mine, want] = await Promise.all([RUN.runSql(c.schema, c.data[d], query), RUN.runSql(c.schema, c.data[d], c.solution.sql)]);
      } catch (e) { out.innerHTML = `<div class="verdict bad">${E(e.message)}</div>`; return; }
      const ok = RUN.sameRows(mine, want, c.ordered);
      okAll = okAll && ok;
      html += `<details class="test ${ok ? "ok" : "no"}" ${!ok && d === 0 ? "open" : ""}><summary>${ok ? "✓" : "✗"} ${d === 0 ? "Sample data" : "Hidden data set"}</summary>
        ${mine.error ? `<pre class="code err">${E(mine.error)}</pre>` : d === 0 ? `<div class="cols2 tight"><div><h4>Your result</h4>${table(mine)}</div><div><h4>Expected</h4>${table(want)}</div></div>` : `<p class="small muted">${ok ? "Passed." : "Your query gives different rows on other data. Avoid hard-coding values; check joins, NULLs and ties."}</p>`}
        ${!ok && !mine.error && d === 0 && c.ordered ? '<p class="small muted">Row order matters for this challenge.</p>' : ""}</details>`;
    }
    if (all && okAll) markSolved(c, "sql");
    out.innerHTML = `<div class="verdict ${okAll ? "good" : "bad"}">${okAll ? (all ? "🎉 Accepted: correct on both data sets" : "Correct on the sample data. Now press Submit to check the hidden data set.") : "Not quite yet"}</div>${html}`;
  }
  function table(r) {
    if (!r || r.error) return "";
    if (!r.columns.length) return '<p class="small muted">No rows.</p>';
    return `<div class="tblwrap"><table class="tbl small"><thead><tr>${r.columns.map((h) => `<th>${E(h)}</th>`).join("")}</tr></thead><tbody>${r.rows.slice(0, 50).map((row) => `<tr>${row.map((v) => `<td>${v === null ? '<span class="muted">NULL</span>' : E(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${r.rows.length > 50 ? `<p class="small muted">…and ${r.rows.length - 50} more rows</p>` : ""}`;
  }
  async function sqlPreview(c) {
    const box = $("#preview");
    try {
      const names = ["departments", "employees", "customers", "orders"];
      const parts = await Promise.all(names.map((n) => RUN.runSql(c.schema, c.data[0], `SELECT * FROM ${n};`)));
      box.innerHTML = `<h3>Sample data</h3>${names.map((n, i) => `<details><summary>${n} (${parts[i].rows.length} rows)</summary>${table(parts[i])}</details>`).join("")}`;
    } catch (e) { box.innerHTML = `<p class="err small">${E(e.message)}</p>`; }
  }
  function markSolved(c, lang) {
    const s = store.get(SOLVED, {}); s[c.id] = { lang, date: new Date().toISOString() }; store.set(SOLVED, s);
  }

  // ---------------------------------------------------------------- about
  function about() {
    app.innerHTML = `<div class="prose">
      <h1>About IT Interview Prep</h1>
      <p class="lead">Free practice for IT job interviews: support, testing, development, DevOps and SRE roles.</p>
      <h2>How the assessment works</h2>
      <ul><li>Questions are tagged by topic, sub-topic and level (Basic, Intermediate, Advanced).</li>
        <li>Each test spreads its questions across sub-topics, so the report can tell you exactly where to focus.</li>
        <li>Sub-topics under 70% become <b>focus areas</b>, with a study tip and a link to good free material. One click builds a practice test from just those areas.</li></ul>
      <h2>How the coding challenges work</h2>
      <ul><li>Python runs with Pyodide and SQL with SQLite (sql.js), both compiled to WebAssembly, and JavaScript runs in a Web Worker: all inside your browser. Your code is never uploaded.</li>
        <li>Run checks the sample tests. Submit also runs hidden tests (for SQL, a second hidden data set), so hard-coded answers won't pass.</li></ul>
      <h2>Your data</h2>
      <p>There are no accounts, cookies or tracking. Results and code drafts are kept in your browser's local storage on this device only; you can delete them from <a href="#/progress">My progress</a>.</p>
      <h2>Disclaimer</h2>
      <p class="small muted">Questions are written for practice and may not match any particular employer's interview. Product names belong to their owners. Python, JavaScript and SQL engines are loaded from the jsDelivr CDN.</p>
    </div>`;
  }

  router();
})();
