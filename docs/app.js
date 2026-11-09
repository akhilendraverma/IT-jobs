/* IT Jobs: search and filters, all in the browser. No cookies, no tracking. */
(() => {
  const $ = (s) => document.querySelector(s);
  const E = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PAGE = 40;
  const REGIONS = ["Ireland", "UK", "Europe", "India", "USA", "Canada", "Asia-Pacific"];
  let all = [], shown = PAGE;
  const st = { q: "", r: "", k: "", co: "", d: "", ai: false };

  // ---- state in the address bar, so a search can be shared
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    Object.assign(st, { q: h.get("q") || "", r: h.get("r") || "", k: h.get("k") || "", co: h.get("co") || "", d: h.get("d") || "", ai: h.get("ai") === "1" });
  }
  function writeHash() {
    const h = new URLSearchParams();
    for (const [k, v] of Object.entries(st)) if (v) h.set(k, v === true ? "1" : v);
    const s = h.toString();
    history.replaceState(null, "", s ? "#" + s : location.pathname + location.search);
  }

  // ---- dates
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ageDays = (d) => (d ? Math.round((today - new Date(d + "T00:00:00")) / 864e5) : 9999);
  function when(d) {
    if (!d) return "";
    const n = ageDays(d);
    if (n <= 0) return "Today";
    if (n === 1) return "Yesterday";
    if (n < 31) return `${n} days ago`;
    return new Date(d + "T00:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
  }

  // ---- filtering
  function matches(j, skip) {
    if (skip !== "r" && st.r && !(st.r === "Remote" ? j.rm : j.g.includes(st.r))) return false;
    if (st.k && j.k !== st.k) return false;
    if (st.co && j.c !== st.co) return false;
    if (st.ai && !j.ai) return false;
    if (st.d && ageDays(j.d) > Number(st.d)) return false;
    if (st.q) {
      const hay = j._s;
      for (const w of st.q.toLowerCase().split(/\s+/).filter(Boolean)) if (!hay.includes(w)) return false;
    }
    return true;
  }
  function hi(text) {
    let out = E(text);
    for (const w of st.q.split(/\s+/).filter((x) => x.length > 1)) {
      out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"), "<mark>$1</mark>");
    }
    return out;
  }

  // ---- drawing
  function drawRegions() {
    const pool = all.filter((j) => matches(j, "r"));
    const count = (r) => pool.filter((j) => (r === "Remote" ? j.rm : j.g.includes(r))).length;
    $("#regions").innerHTML = [["", "Everywhere", pool.length], ...REGIONS.map((r) => [r, r, count(r)]), ["Remote", "Remote", count("Remote")]]
      .filter(([v, , n]) => n > 0 || v === "" || v === st.r).map(([v, label, n]) => `<button type="button" class="chip ${st.r === v ? "on" : ""}" data-r="${E(v)}">${E(label)}<small>${n.toLocaleString("en-IE")}</small></button>`).join("");
  }
  function draw() {
    writeHash();
    drawRegions();
    const hits = all.filter((j) => matches(j));
    $("#count").textContent = hits.length ? `${hits.length.toLocaleString("en-IE")} job${hits.length === 1 ? "" : "s"} found` : "";
    const list = $("#list");
    list.innerHTML = "";
    if (!hits.length) {
      list.innerHTML = '<div class="empty"><b>No jobs match.</b><br>Try fewer words or clear some filters.</div>';
      $("#more").hidden = true;
      return;
    }
    const tpl = $("#card").content;
    const frag = document.createDocumentFragment();
    for (const j of hits.slice(0, shown)) {
      const n = tpl.cloneNode(true);
      n.querySelector(".title").innerHTML = hi(j.t);
      n.querySelector(".company").textContent = j.c;
      n.querySelector(".where").innerHTML = hi(j.l);
      n.querySelector(".tags").innerHTML = [`<span class="tag">${E(j.k)}</span>`, j.ai ? '<span class="tag ai">AI / ML role</span>' : "",
        j.rm ? '<span class="tag remote">Remote</span>' : "", j.s ? `<span class="tag pay">${E(j.s)}</span>` : ""].join("");
      n.querySelector(".snip").textContent = j.x;
      n.querySelector(".when").textContent = when(j.d);
      const a = n.querySelector(".apply");
      a.href = j.u;
      a.textContent = `Apply on ${j.c.length > 18 ? "company site" : j.c} ↗`;
      a.title = "Opens the job on the company's own website";
      frag.append(n);
    }
    list.append(frag);
    $("#more").hidden = hits.length <= shown;
    $("#more").textContent = `Show more jobs (${(hits.length - shown).toLocaleString("en-IE")} more)`;
  }

  function set(changes) { Object.assign(st, changes); shown = PAGE; draw(); }

  // ---- start
  async function start() {
    readHash();
    let data;
    try {
      const r = await fetch("jobs.json?v=" + Date.now().toString(36).slice(0, -4), { cache: "no-cache" });
      data = await r.json();
    } catch {
      $("#stats").textContent = "Jobs could not be loaded. Please try again later.";
      return;
    }
    all = data.jobs.map((j) => ({ ...j, _s: `${j.t} ${j.c} ${j.l} ${j.k}`.toLowerCase() }));
    const upd = new Date(data.updated.replace("Z", ":00Z"));
    const live = data.companies.filter((c) => c.n > 0);
    $("#stats").innerHTML = `<b>${data.count.toLocaleString("en-IE")}</b> jobs from <b>${live.length}</b> companies · updated ${upd.toLocaleDateString("en-IE", { day: "numeric", month: "short" })}, ${upd.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}`;
    $("#sources").textContent = `Companies included: ${live.map((c) => c.name).join(", ")}.`;

    const cats = [...new Set(all.map((j) => j.k))].sort((a, b) => (a === "Other IT roles") - (b === "Other IT roles") || a.localeCompare(b));
    $("#cat").innerHTML += cats.map((c) => `<option>${E(c)}</option>`).join("");
    $("#co").innerHTML += live.map((c) => c.name).sort((a, b) => a.localeCompare(b)).map((c) => `<option>${E(c)}</option>`).join("");

    $("#q").value = st.q; $("#cat").value = st.k; $("#co").value = st.co; $("#days").value = st.d; $("#ai").checked = st.ai;
    let timer;
    $("#q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => set({ q: $("#q").value.trim() }), 200); });
    $("#search").addEventListener("submit", (e) => { e.preventDefault(); set({ q: $("#q").value.trim() }); $("#count").scrollIntoView({ behavior: "smooth", block: "start" }); });
    $("#cat").onchange = () => set({ k: $("#cat").value });
    $("#co").onchange = () => set({ co: $("#co").value });
    $("#days").onchange = () => set({ d: $("#days").value });
    $("#ai").onchange = () => set({ ai: $("#ai").checked });
    $("#regions").addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) set({ r: b.dataset.r }); });
    $("#reset").onclick = () => { $("#q").value = ""; $("#cat").value = ""; $("#co").value = ""; $("#days").value = ""; $("#ai").checked = false; set({ q: "", r: "", k: "", co: "", d: "", ai: false }); };
    $("#more").onclick = () => { shown += PAGE; draw(); };
    draw();
  }
  start();
})();
