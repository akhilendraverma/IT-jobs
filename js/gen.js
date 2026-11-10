/* Generated questions: the right answer is worked out in code, so it is always correct,
   and every test gets fresh numbers. Each generator returns {q, code?, correct, wrongs, explain}. */
(() => {
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => U.shuffle(a);
  const G = (topic, sub, level, name, fn) => PREP.gens.push({ topic, sub, level, name, fn });
  const fmtPct = (x) => { const v = Math.round(x * 1000) / 10; return (Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)) + "%"; };
  const n = (x) => x.toLocaleString("en-IE");

  // ================================================================ UNIX
  const RWX = (d) => (d & 4 ? "r" : "-") + (d & 2 ? "w" : "-") + (d & 1 ? "x" : "-");
  const sym = (o, g, w) => "-" + RWX(o) + RWX(g) + RWX(w);
  const MODES = [[7, 5, 5], [7, 5, 0], [7, 0, 0], [6, 4, 4], [6, 4, 0], [6, 0, 0], [7, 7, 5], [7, 5, 4], [6, 6, 4], [7, 4, 4], [4, 4, 4], [7, 1, 1], [6, 2, 0], [5, 5, 5]];
  const near = ([o, g, w]) => [[g, o, w], [o, w, g], [o ^ 1, g, w], [o, g ^ 1, w], [o, g, w ^ 1], [o, g ^ 2, w], [w, g, o]];

  G("unix", "files", 1, "chmod-to-symbolic", () => {
    const m = pick(MODES);
    return { q: `Which permissions does \`chmod ${m.join("")} report.sh\` set?`, correct: sym(...m), wrongs: near(m).map((x) => sym(...x)),
      explain: `Each digit is read 4 + write 2 + execute 1, for owner, group and others: ${m.map((d) => `${d} = ${RWX(d)}`).join(", ")}.` };
  });
  G("unix", "files", 2, "symbolic-to-octal", () => {
    const m = pick(MODES);
    return { q: `\`ls -l\` shows \`${sym(...m)}\` for a file. What is that in octal (the number you would pass to chmod)?`, correct: m.join(""), wrongs: near(m).map((x) => x.join("")),
      explain: `Add 4 for r, 2 for w and 1 for x in each group of three: ${[0, 1, 2].map((i) => `${RWX(m[i])} = ${m[i]}`).join(", ")}.` };
  });

  const DAYS = [["*", "every day"], ["1-5", "Monday to Friday"], ["0", "every Sunday"], ["6", "every Saturday"], ["1", "every Monday"]];
  G("unix", "shell", 2, "cron", () => {
    if (Math.random() < 0.25) {
      const k = pick([5, 10, 15, 20, 30]);
      return { q: "When does this cron job run?", code: `*/${k} * * * * /opt/scripts/check.sh`, correct: `Every ${k} minutes, all day, every day`,
        wrongs: [`Once a day at 00:${String(k).padStart(2, "0")}`, `At ${k} minutes past every hour`, `Every ${k} hours, every day`], explain: "`*/k` in the minute field means every k minutes; the other fields are `*` (every hour, day, month and weekday)." };
    }
    const m = pick([0, 15, 30, 45]), h = R(0, 23), [dow, when] = pick(DAYS), hh = String(h).padStart(2, "0"), mm = String(m).padStart(2, "0");
    const others = DAYS.filter((d) => d[0] !== dow).map((d) => d[1]);
    const wrongs = [`At ${hh}:${mm} ${pick(others)}`, `Every ${m || 60} minutes during hour ${h}, ${when}`, `At ${hh}:${mm} on day ${dow === "*" ? 1 : dow.split("-")[0] || 1} of every month`];
    if (m <= 23 && m !== h) wrongs.unshift(`At ${String(m).padStart(2, "0")}:${hh} ${when}`);
    return { q: "When does this cron job run?", code: `${m} ${h} * * ${dow} /opt/scripts/report.sh`, correct: `At ${hh}:${mm} ${when}`, wrongs,
      explain: `The five fields are minute (${m}), hour (${h}), day of month (*), month (*) and day of week (${dow}). Day of week 0 is Sunday and 1-5 is Monday to Friday.` };
  });

  const SERVICES = ["payment", "login", "orders", "search", "api"];
  const MSGS = ["timeout calling bank", "user signed in", "cache refreshed", "slow response 2100ms", "retrying request", "order created", "token expired", "disk check done"];
  function logFile() {
    const levels = ["INFO", "INFO", "WARN", "ERROR"];
    const lines = Array.from({ length: R(5, 8) }, (_, i) => ({ t: `10:0${i}:${String(R(0, 59)).padStart(2, "0")}`, lvl: pick(levels), svc: pick(SERVICES), msg: pick(MSGS) }));
    if (!lines.some((l) => l.lvl === "ERROR")) lines[R(0, lines.length - 1)].lvl = "ERROR";
    return { lines, text: lines.map((l) => `2026-11-10 ${l.t} ${l.lvl} ${l.svc} ${l.msg}`).join("\n") };
  }
  const numWrongs = (c, extra) => [c + 1, c - 1, c + 2, ...extra].filter((x) => x >= 0 && x !== c);
  G("unix", "text", 1, "grep-count", () => {
    const f = logFile(), c = f.lines.filter((l) => l.lvl === "ERROR").length;
    return { q: "app.log contains the lines below. What does `grep -c ERROR app.log` print?", code: f.text, correct: String(c), wrongs: numWrongs(c, [f.lines.length]).map(String),
      explain: "`-c` prints the number of matching lines, not the lines themselves." };
  });
  G("unix", "text", 2, "grep-v-wc", () => {
    const f = logFile(), c = f.lines.filter((l) => l.lvl !== "INFO").length;
    return { q: "app.log contains the lines below. What does `grep -v INFO app.log | wc -l` print?", code: f.text, correct: String(c), wrongs: numWrongs(c, [f.lines.length - c, f.lines.length]).map(String),
      explain: "`grep -v` keeps the lines that do NOT match, and `wc -l` counts them." };
  });
  G("unix", "text", 2, "awk-uniq", () => {
    const f = logFile(), c = new Set(f.lines.map((l) => l.svc)).size;
    return { q: "app.log contains the lines below. What does this pipeline print?", code: f.text + "\n\n$ awk '{print $4}' app.log | sort | uniq | wc -l", correct: String(c), wrongs: numWrongs(c, [f.lines.length]).map(String),
      explain: "Field 4 is the service name. sort + uniq leaves one line per distinct service, and wc -l counts them." };
  });
  G("unix", "text", 2, "head-tail", () => {
    const f = logFile(), k = R(2, Math.min(4, f.lines.length - 1)), want = f.lines[k - 1];
    const fmt = (l) => `2026-11-10 ${l.t} ${l.lvl} ${l.svc} ${l.msg}`;
    return { q: `app.log contains the lines below. What does \`head -n ${k} app.log | tail -n 1\` print?`, code: f.text, correct: fmt(want),
      wrongs: [f.lines[k - 2], f.lines[k], f.lines[0], f.lines[f.lines.length - 1]].filter((l) => l && l !== want).map(fmt),
      explain: `head -n ${k} keeps the first ${k} lines; tail -n 1 keeps the last of those, which is line ${k}.` };
  });
  G("unix", "text", 3, "sort-lexical", () => {
    const nums = shuffle([R(2, 9), R(10, 19), R(100, 199), R(20, 99)]);
    const lex = [...nums].map(String).sort(), numeric = [...nums].sort((a, b) => a - b);
    const useN = Math.random() < 0.5, cmd = useN ? "sort -n sizes.txt | head -1" : "sort sizes.txt | head -1", ans = useN ? String(numeric[0]) : lex[0];
    return { q: "sizes.txt contains the numbers below, one per line. What does the command print?", code: nums.join("\n") + `\n\n$ ${cmd}`, correct: ans,
      wrongs: [...new Set([lex[0], String(numeric[0]), String(numeric[numeric.length - 1]), lex[lex.length - 1], String(nums[0])])].filter((x) => x !== ans),
      explain: "Plain `sort` compares text character by character (so \"100\" comes before \"9\"); `sort -n` compares numbers." };
  });
  G("unix", "shell", 2, "exit-status", () => {
    const f = logFile(), word = pick(["ERROR", "WARN", "FATAL", "timeout", "Timeout"]), found = f.text.includes(word);
    return { q: `app.log contains the lines below. What does \`grep -q ${word} app.log; echo $?\` print?`, code: f.text, correct: found ? "0" : "1", wrongs: [found ? "1" : "0", "2", String(f.lines.length)],
      explain: `grep -q prints nothing and exits 0 if a line matches, 1 if none match (2 means an error). grep is case-sensitive, so \"${word}\" ${found ? "is" : "is not"} found.` };
  });

  // ================================================================ SQL
  const NAMES = ["Asha", "Brian", "Chen", "Deepa", "Eoin", "Fatima", "Gopal", "Hannah", "Ivan", "Jia", "Kofi", "Lena"];
  const DEPTS = ["Support", "Engineering", "Sales"];
  function empTable(withZero = false) {
    const names = shuffle(NAMES).slice(0, R(6, 8));
    const salaries = shuffle(Array.from({ length: 20 }, (_, i) => 30000 + i * 3000)).slice(0, names.length);
    const rows = names.map((nm, i) => ({ id: i + 1, name: nm, dept: DEPTS[i % 3 === 0 ? 0 : R(0, 2)], salary: salaries[i], bonus: pick([null, null, 1000, 2000, 3000, 5000, withZero ? 0 : 1500]) }));
    if (!rows.some((r) => r.bonus === null)) rows[0].bonus = null;
    if (withZero && !rows.some((r) => r.bonus === 0)) rows[rows.length - 1].bonus = 0;
    const show = (v) => (v === null ? "NULL" : String(v));
    const w = { id: 3, name: 8, dept: 12, salary: 7, bonus: 6 };
    const line = (cells) => cells.map((c, i) => String(c).padEnd(Object.values(w)[i])).join(" ").trimEnd();
    const text = "employees\n" + line(Object.keys(w)) + "\n" + rows.map((r) => line([r.id, r.name, r.dept, r.salary, show(r.bonus)])).join("\n");
    return { rows, text };
  }
  G("sql", "basics", 1, "count-where", () => {
    const t = empTable(), x = pick([45000, 50000, 60000, 66000]), c = t.rows.filter((r) => r.salary > x).length;
    return { q: "Using the table below, what does this query return?", code: `${t.text}\n\nSELECT COUNT(*) FROM employees WHERE salary > ${x};`, correct: String(c),
      wrongs: numWrongs(c, [t.rows.length - c, t.rows.length]).map(String), explain: `${c} employees earn more than ${x}.` };
  });
  G("sql", "agg", 2, "count-col-nulls", () => {
    const t = empTable(), c = t.rows.filter((r) => r.bonus !== null).length;
    return { q: "Using the table below, what does this query return?", code: `${t.text}\n\nSELECT COUNT(bonus) FROM employees;`, correct: String(c),
      wrongs: numWrongs(c, [t.rows.length, t.rows.length - c]).map(String), explain: "COUNT(column) skips NULLs. COUNT(*) would count every row." };
  });
  G("sql", "agg", 2, "avg-nulls", () => {
    const t = empTable(), vals = t.rows.map((r) => r.bonus).filter((v) => v !== null);
    if (vals.length < 2) return null;
    const sum = vals.reduce((a, b) => a + b, 0), avg = sum / vals.length, avgAll = sum / t.rows.length;
    const f = (x) => (Math.round(x * 100) / 100).toFixed(2);
    return { q: "Using the table below, what does this query return?", code: `${t.text}\n\nSELECT AVG(bonus) FROM employees;`, correct: f(avg),
      wrongs: [f(avgAll), String(sum), "NULL", f(avg + 500)], explain: `AVG ignores NULLs: ${sum} ÷ ${vals.length} non-NULL values = ${f(avg)}. Treating NULL as 0 would give ${f(avgAll)}.` };
  });
  G("sql", "agg", 2, "group-having", () => {
    const t = empTable(), counts = {};
    t.rows.forEach((r) => (counts[r.dept] = (counts[r.dept] || 0) + 1));
    const k = pick([2, 3]), c = Object.values(counts).filter((v) => v >= k).length;
    return { q: "Using the table below, how many rows does this query return?", code: `${t.text}\n\nSELECT dept, COUNT(*)\nFROM employees\nGROUP BY dept\nHAVING COUNT(*) >= ${k};`, correct: String(c),
      wrongs: numWrongs(c, [Object.keys(counts).length, t.rows.length]).map(String),
      explain: `Department sizes: ${Object.entries(counts).map(([d, v]) => `${d} ${v}`).join(", ")}. ${c} of them have at least ${k} employees.` };
  });
  G("sql", "agg", 1, "max-where", () => {
    const t = empTable(), d = pick([...new Set(t.rows.map((r) => r.dept))]), vals = t.rows.filter((r) => r.dept === d).map((r) => r.salary);
    const c = Math.max(...vals), all = t.rows.map((r) => r.salary);
    return { q: "Using the table below, what does this query return?", code: `${t.text}\n\nSELECT MAX(salary) FROM employees WHERE dept = '${d}';`, correct: String(c),
      wrongs: [Math.max(...all), Math.min(...vals), vals.reduce((a, b) => a + b, 0), c + 3000].filter((x) => x !== c).map(String), explain: `The ${d} salaries are ${vals.join(", ")}; the largest is ${c}.` };
  });
  G("sql", "basics", 2, "distinct-count", () => {
    const t = empTable(), c = new Set(t.rows.map((r) => r.dept)).size;
    return { q: "Using the table below, what does this query return?", code: `${t.text}\n\nSELECT COUNT(DISTINCT dept) FROM employees;`, correct: String(c), wrongs: numWrongs(c, [t.rows.length]).map(String),
      explain: "COUNT(DISTINCT dept) counts each different department once." };
  });
  G("sql", "adv", 2, "order-offset", () => {
    const t = empTable(), sorted = [...t.rows].sort((a, b) => b.salary - a.salary);
    return { q: "Using the table below, what does this query return?", code: `${t.text}\n\nSELECT name FROM employees\nORDER BY salary DESC\nLIMIT 1 OFFSET 1;`, correct: sorted[1].name,
      wrongs: [sorted[0].name, sorted[2].name, sorted[sorted.length - 1].name], explain: `Sorted by salary (highest first): ${sorted.slice(0, 3).map((r) => `${r.name} ${r.salary}`).join(", ")}… OFFSET 1 skips the first row, so the second-highest is returned.` };
  });
  G("sql", "basics", 3, "null-compare", () => {
    const t = empTable(true), c = t.rows.filter((r) => r.bonus !== null && r.bonus !== 0).length, nulls = t.rows.filter((r) => r.bonus === null).length;
    return { q: "Using the table below, what does this query return?", code: `${t.text}\n\nSELECT COUNT(*) FROM employees WHERE bonus <> 0;`, correct: String(c),
      wrongs: numWrongs(c, [c + nulls, t.rows.length]).map(String), explain: `Comparing NULL with <> gives UNKNOWN, so the ${nulls} NULL row(s) are not counted along with the zero bonuses. Use \`bonus <> 0 OR bonus IS NULL\` to include them.` };
  });
  G("sql", "joins", 3, "left-join-rows", () => {
    const t = empTable(), extra = pick(["Research", "Legal", "Finance"]), depts = [...new Set(t.rows.map((r) => r.dept)), extra];
    const left = t.rows.length + 1, inner = t.rows.length;
    const code = `${t.text}\n\ndepartments\nname\n${depts.join("\n")}\n\nSELECT d.name, e.name\nFROM departments d\nLEFT JOIN employees e ON e.dept = d.name;`;
    return { q: "Using the tables below, how many rows does this query return?", code, correct: String(left), wrongs: [String(inner), String(depts.length), String(left + 1)],
      explain: `Every employee matches one department (${inner} rows), plus one row for ${extra}, which has no employees, with NULL for e.name.` };
  });

  // ================================================================ AWS
  const ip2n = (s) => s.split(".").reduce((a, o) => a * 256 + Number(o), 0);
  const n2ip = (v) => [24, 16, 8, 0].map((s) => Math.floor(v / 2 ** s) % 256).join(".");
  G("aws", "net", 2, "subnet-usable", () => {
    const p = R(20, 28), size = 2 ** (32 - p);
    return { q: `How many IP addresses can you assign to resources in an AWS subnet with a /${p} CIDR block?`, correct: n(size - 5), wrongs: [n(size), n(size - 2), n(size - 1)],
      explain: `A /${p} has 2^${32 - p} = ${n(size)} addresses. AWS reserves 5 in every subnet (network, VPC router, DNS, future use, broadcast), leaving ${n(size - 5)}.` };
  });
  G("aws", "net", 2, "ip-in-cidr", () => {
    const p = pick([22, 23, 24, 25, 26]), size = 2 ** (32 - p), base = Math.floor(ip2n(`10.${R(0, 30)}.${R(0, 255)}.0`) / size) * size;
    const cidr = `${n2ip(base)}/${p}`, inside = n2ip(base + R(1, size - 2));
    const outs = [base + size + R(0, 50), base - R(1, 200), base + size * 2 + R(0, 9), base + size * 4].filter((v) => v > 0).map(n2ip);
    return { q: `Which IP address is inside the subnet ${cidr}?`, correct: inside, wrongs: outs,
      explain: `${cidr} covers ${n2ip(base)} to ${n2ip(base + size - 1)} (${n(size)} addresses).` };
  });
  G("aws", "net", 3, "subnets-fit", () => {
    const a = pick([16, 18, 20, 22]), b = a + R(2, 6), c = 2 ** (b - a);
    return { q: `How many /${b} subnets can you create inside a /${a} VPC?`, correct: n(c), wrongs: [n(c * 2), n(c / 2), n(b - a)],
      explain: `Each extra bit of prefix halves the block: 2^(${b} − ${a}) = ${n(c)}.` };
  });
  const AV = [99.5, 99.9, 99.95, 99.99];
  const pctS = (v) => `${(Math.round(v * 1000) / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
  G("aws", "ops", 2, "availability-series", () => {
    const k = R(2, 3), parts = Array.from({ length: k }, () => pick(AV)), total = parts.reduce((a, p) => a * (p / 100), 1) * 100;
    const ans = pctS(total);
    const wrongs = [pctS(Math.min(...parts)), pctS(parts.reduce((a, b) => a + b, 0) / k), pctS(Math.max(...parts)), pctS(total - 0.1)].filter((w) => w !== ans);
    return { q: `A request passes through ${k} components in series with availabilities of ${parts.map((p) => p + "%").join(", ")}. What is the overall availability (approximately)?`, correct: ans, wrongs: [...new Set(wrongs)],
      explain: `For components in series, multiply the availabilities: ${parts.map((p) => (p / 100).toString()).join(" × ")} ≈ ${ans}. The whole is less available than its weakest part.` };
  });
  G("aws", "ops", 2, "availability-parallel", () => {
    const [p, k] = pick([[99, 2], [99, 3], [99.5, 2], [99.9, 2], [98, 2], [95, 2], [95, 3]]), total = (1 - (1 - p / 100) ** k) * 100;
    const ans = `${(Math.round(total * 10000) / 10000).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;
    return { q: `You run ${k} independent instances in different Availability Zones, each ${p}% available, and the service works if any one is up. What is its availability?`, correct: ans,
      wrongs: [...new Set([pctS(p), pctS((p / 100) ** k * 100), pctS(Math.min(100, p + 0.5))])].filter((w) => w !== ans),
      explain: `All ${k} must fail together: (1 − ${p / 100})^${k} = ${((1 - p / 100) ** k).toExponential(1)}, so availability ≈ ${ans}.` };
  });
  G("aws", "ops", 2, "downtime-budget", () => {
    const p = pick([99, 99.5, 99.9, 99.95, 99.99]), days = pick([30, 365]), mins = days * 24 * 60 * (1 - p / 100);
    const f = (m) => (m >= 120 ? `about ${(m / 60).toFixed(1)} hours` : `about ${m.toFixed(m < 10 ? 1 : 0)} minutes`);
    return { q: `A service has a ${p}% availability target. How much downtime does that allow over ${days} days?`, correct: f(mins), wrongs: [...new Set([f(mins * 10), f(mins / 10), f(mins * 2)])],
      explain: `${days} days × 24 × 60 = ${n(days * 1440)} minutes; ${(100 - p).toFixed(2).replace(/0+$/, "")}% of that is ${mins.toFixed(1)} minutes.` };
  });

  // ================================================================ AI
  const CM_ASK = [["precision", (c) => c.tp / (c.tp + c.fp), "TP ÷ (TP + FP)"], ["recall", (c) => c.tp / (c.tp + c.fn), "TP ÷ (TP + FN)"],
    ["accuracy", (c) => (c.tp + c.tn) / (c.tp + c.tn + c.fp + c.fn), "(TP + TN) ÷ total"], ["F1 score", (c) => { const p = c.tp / (c.tp + c.fp), r = c.tp / (c.tp + c.fn); return (2 * p * r) / (p + r); }, "2 × P × R ÷ (P + R)"],
    ["specificity", (c) => c.tn / (c.tn + c.fp), "TN ÷ (TN + FP)"]];
  G("ai", "eval", 2, "confusion-matrix", () => {
    const c = { tp: R(20, 90), fp: R(5, 40), fn: R(5, 40), tn: R(50, 300) };
    const [name, fn, formula] = pick(CM_ASK), ans = fmtPct(fn(c));
    const wrongs = [...new Set(CM_ASK.filter((x) => x[0] !== name).map((x) => fmtPct(x[1](c))))].filter((w) => w !== ans);
    return { q: `A fraud model's results on a test set are shown below. What is its ${name}?`, code: `                 Predicted fraud   Predicted OK\nActually fraud   TP = ${c.tp}           FN = ${c.fn}\nActually OK      FP = ${c.fp}           TN = ${c.tn}`,
      correct: ans, wrongs, explain: `${name[0].toUpperCase() + name.slice(1)} = ${formula} = ${ans}.` };
  });
  G("ai", "ml", 1, "split-sizes", () => {
    const N = pick([5000, 10000, 20000, 50000, 120000]), [a, b, c] = pick([[70, 15, 15], [80, 10, 10], [60, 20, 20]]), which = pick(["training", "validation", "test"]);
    const size = { training: (N * a) / 100, validation: (N * b) / 100, test: (N * c) / 100 }[which];
    return { q: `You split ${n(N)} rows into training, validation and test sets in the ratio ${a}/${b}/${c}. How many rows are in the ${which} set?`, correct: n(size),
      wrongs: [...new Set([(N * a) / 100, (N * b) / 100, N - size, (N * (b + c)) / 100, size * 2].filter((x) => x !== size))].map(n), explain: `${which[0].toUpperCase() + which.slice(1)} = ${({ training: a, validation: b, test: c })[which]}% of ${n(N)} = ${n(size)}.` };
  });
  G("ai", "eval", 2, "kfold", () => {
    const k = pick([4, 5, 10]), N = k * R(2, 40) * 100, fold = N / k;
    return { q: `You run ${k}-fold cross-validation on ${n(N)} rows. In each round, how many rows are used for training?`, correct: n(N - fold), wrongs: [n(fold), n(N), n(N - 2 * fold)],
      explain: `Each fold is ${n(fold)} rows. In each round one fold is held out for validation and the other ${k - 1} (${n(N - fold)} rows) are used for training.` };
  });
  G("ai", "eval", 1, "baseline-accuracy", () => {
    const pos = R(1, 9) * 10, total = pick([1000, 2000, 5000]), acc = (total - pos) / total;
    return { q: `A data set has ${n(total)} transactions, of which ${pos} are fraud. A model that always predicts "not fraud" has what accuracy?`, correct: fmtPct(acc),
      wrongs: [...new Set([fmtPct(pos / total), "50%", fmtPct(acc - 0.05), "0%"])].filter((w) => w !== fmtPct(acc)),
      explain: `It is right on all ${n(total - pos)} normal transactions: ${n(total - pos)} ÷ ${n(total)} = ${fmtPct(acc)}, yet its recall for fraud is 0%. That's why accuracy misleads on imbalanced data.` };
  });
  G("ai", "genai", 2, "token-cost", () => {
    const inP = pick([1, 2.5, 3, 5]), outP = inP * pick([4, 5]), calls = pick([1000, 5000, 20000]), tin = pick([800, 1500, 2000, 4000]), tout = pick([200, 300, 500]);
    const cost = calls * ((tin * inP) / 1e6 + (tout * outP) / 1e6), f = (x) => "$" + x.toFixed(2);
    return { q: `An API charges $${inP} per million input tokens and $${outP} per million output tokens. Each request uses ${n(tin)} input and ${n(tout)} output tokens. What do ${n(calls)} requests cost?`,
      correct: f(cost), wrongs: [...new Set([f((calls * (tin + tout) * inP) / 1e6), f((calls * (tin + tout) * outP) / 1e6), f(cost * 10), f(cost / 10)])].filter((w) => w !== f(cost)),
      explain: `Per request: ${n(tin)} × $${inP}/1M + ${n(tout)} × $${outP}/1M = $${((tin * inP + tout * outP) / 1e6).toFixed(5)}. × ${n(calls)} = ${f(cost)}.` };
  });
  G("ai", "genai", 2, "dot-similarity", () => {
    const v = () => [R(-2, 3), R(-2, 3), R(-2, 3)], a = v(), b = v(), c = v();
    const dot = (x, y) => x.reduce((s, xi, i) => s + xi * y[i], 0), ab = dot(a, b), ac = dot(a, c);
    if (ab === ac) return null;
    const best = ab > ac ? "B" : "C";
    return { q: `Using dot product as the similarity score, which document is more similar to the query?`, code: `query = [${a.join(", ")}]\ndoc B = [${b.join(", ")}]\ndoc C = [${c.join(", ")}]`,
      correct: `Doc ${best} (score ${Math.max(ab, ac)})`, wrongs: [`Doc ${best === "B" ? "C" : "B"} (score ${Math.min(ab, ac)})`, "They are equally similar", `Doc ${best === "B" ? "C" : "B"} (score ${Math.max(ab, ac)})`],
      explain: `query·B = ${ab} and query·C = ${ac}. With normalised embeddings, the dot product equals cosine similarity, and higher means more similar.` };
  });

  /** Make one generated question, retrying until the options are valid. */
  PREP.makeGen = (g) => {
    for (let i = 0; i < 30; i++) {
      const r = g.fn();
      if (!r) continue;
      const wrongs = [...new Set(r.wrongs.map(String))].filter((w) => w !== String(r.correct)).slice(0, 3);
      if (wrongs.length < 3) continue;
      return { id: `gen:${g.name}:${Math.random().toString(36).slice(2, 8)}`, topic: g.topic, sub: g.sub, level: g.level, q: r.q, code: r.code || "", correct: String(r.correct), wrongs, explain: r.explain, gen: true };
    }
    return null;
  };
})();
