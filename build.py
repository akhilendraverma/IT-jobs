"""AI Jobs: collects AI jobs from companies' public job boards and writes docs/jobs.json.

Sources (public, no login, meant for showing a company's jobs elsewhere):
  Greenhouse  https://boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true
  Lever       https://api.lever.co/v0/postings/<slug>?mode=json
  Ashby       https://api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true

No personal data is collected. Every "Apply" link goes to the company's own job page.
Run:  python build.py
"""
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "docs" / "jobs.json"
SOURCES = ROOT / "sources.json"  # remembers which job board each company uses
UA = {"User-Agent": "AIJobsAggregator/1.0 (+https://github.com/akhilendraverma)", "Accept": "application/json"}


# ---------------------------------------------------------------- fetching
def get_json(url, timeout=25):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_greenhouse(slug):
    return get_json(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true").get("jobs", [])


def fetch_lever(slug):
    data = get_json(f"https://api.lever.co/v0/postings/{slug}?mode=json")
    if isinstance(data, dict):  # {"ok": false, ...} for unknown slugs
        raise urllib.error.HTTPError("", 404, "not found", None, None)
    return data


def fetch_ashby(slug):
    data = get_json(f"https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true")
    return [j for j in data.get("jobs", []) if j.get("isListed", True)]


FETCHERS = {"greenhouse": fetch_greenhouse, "lever": fetch_lever, "ashby": fetch_ashby}


# ---------------------------------------------------------------- cleaning
def text_of(raw):
    t = html.unescape(raw or "")
    t = re.sub(r"<(script|style)\b.*?</\1>", " ", t, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def snippet(raw, n=240):
    t = text_of(raw)
    if len(t) <= n:
        return t
    cut = t.rfind(" ", 0, n)
    return t[: cut if cut > n // 2 else n].rstrip(" ,.;:") + "…"


def day(value):
    if value in (None, ""):
        return ""
    try:
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value / 1000, timezone.utc).strftime("%Y-%m-%d")
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc).strftime("%Y-%m-%d")
    except Exception:
        return str(value)[:10]


def normalise(ats, j):
    """One job in our own small format."""
    if ats == "greenhouse":
        locs = [(j.get("location") or {}).get("name", "")] + [o.get("name", "") for o in j.get("offices") or []]
        return dict(title=j.get("title", ""), url=j.get("absolute_url", ""), locations=locs, remote_flag=False,
                    date=day(j.get("first_published") or j.get("updated_at")), salary="",
                    team=", ".join(d.get("name", "") for d in j.get("departments") or [] if d.get("name")),
                    text=j.get("content", ""))
    if ats == "lever":
        c = j.get("categories") or {}
        sal, rng = "", j.get("salaryRange") or {}
        if rng.get("min") and rng.get("max"):
            sal = f"{rng.get('currency', '')} {rng['min']:,}–{rng['max']:,} {(rng.get('interval') or '').replace('-', ' ')}".strip()
        return dict(title=j.get("text", ""), url=j.get("hostedUrl") or j.get("applyUrl", ""),
                    locations=[c.get("location", "")] + list(c.get("allLocations") or []),
                    remote_flag=j.get("workplaceType") == "remote", date=day(j.get("createdAt")), salary=sal,
                    team=c.get("team", ""), text=j.get("descriptionPlain") or j.get("description", ""))
    # ashby
    comp = j.get("compensation") or {}
    return dict(title=j.get("title", ""), url=j.get("jobUrl") or j.get("applyUrl", ""),
                locations=[j.get("location", "")] + [s.get("location", "") for s in j.get("secondaryLocations") or []],
                remote_flag=bool(j.get("isRemote")) or j.get("workplaceType") == "Remote", date=day(j.get("publishedAt")),
                salary=comp.get("compensationTierSummary") or comp.get("scrapeableCompensationSalarySummary") or "",
                team=j.get("department") or j.get("team") or "", text=j.get("descriptionPlain") or j.get("descriptionHtml", ""))


# ---------------------------------------------------------------- tagging
AI_ROLE = re.compile(
    r"\b(ai|a\.i\.|ml|mlops|llms?|genai|gen ?ai|nlp|machine learning|deep learning|artificial intelligence|computer vision|"
    r"data scien\w*|applied scien\w*|research scien\w*|generative|reinforcement learning|neural|perception|inference|"
    r"agentic|foundation models?|large language|speech recognition|robot\w*|research engineer|alignment|interpretab\w*)\b", re.I)

CATEGORIES = [
    ("Research", r"\bresearch(er)?\b"),
    ("Data", r"\bdata\b|analyst|analytics"),
    ("AI / ML Engineering", r"\b(machine learning|ml|mlops|ai|llms?|deep learning|inference|models?|nlp|computer vision|genai|agentic|scientist)\b"),
    ("Product & Design", r"\bproduct\b|design|\bux\b|\bui\b"),
    ("Sales & Marketing", r"sales|account (executive|manager)|business development|marketing|partner|\bgtm\b|go-to-market|solutions? (engineer|architect)|customer success|growth"),
    ("Software Engineering", r"engineer|developer|\bsre\b|devops|infrastructure|security|architect|programmer"),
]

REGIONS = {
    "Ireland": r"\b(ireland|dublin|cork|galway|limerick)\b",
    "UK": r"\b(united kingdom|uk|london|manchester|edinburgh|bristol|cambridge, (uk|england)|oxford|belfast)\b",
    "Europe": r"\b(europe|emea|eu|ireland|dublin|cork|united kingdom|uk|london|paris|france|berlin|munich|germany|amsterdam|netherlands|"
              r"zurich|switzerland|madrid|barcelona|spain|lisbon|portugal|warsaw|poland|stockholm|sweden|copenhagen|denmark|milan|italy|"
              r"brussels|belgium|vienna|austria|prague|czech|oslo|norway|helsinki|finland|tallinn|estonia|bucharest|romania|athens|greece)\b",
    "India": r"\b(india|bengaluru|bangalore|hyderabad|mumbai|delhi|new delhi|gurgaon|gurugram|noida|pune|chennai|kolkata|ahmedabad)\b",
    "USA": r"\b(united states|usa|us|u\.s\.|san francisco|sf|new york|nyc|seattle|boston|austin|los angeles|palo alto|mountain view|"
           r"menlo park|sunnyvale|san jose|washington,? dc|chicago|denver|atlanta|miami|bay area|"
           r",\s*(ca|ny|wa|tx|ma|il|ga|va|nj|nc|fl))\b",
    "Canada": r"\b(canada|toronto|montreal|vancouver|ottawa|waterloo)\b",
    "Asia-Pacific": r"\b(singapore|tokyo|japan|seoul|korea|sydney|melbourne|australia|hong kong|taipei|taiwan|apac)\b",
}


def tag(job, company):
    title = job["title"]
    where = " · ".join(dict.fromkeys(l.strip() for l in job["locations"] if l and l.strip()))
    remote = job["remote_flag"] or bool(re.search(r"\bremote\b", where, re.I))
    cat = next((name for name, rx in CATEGORIES if re.search(rx, title, re.I)), "Other roles")
    regions = [r for r, rx in REGIONS.items() if re.search(rx, where, re.I)]
    return {
        "t": title.strip(), "c": company["name"], "l": where or ("Remote" if remote else "Not stated"),
        "g": regions, "rm": remote, "k": cat, "ai": bool(AI_ROLE.search(title)), "d": job["date"],
        "s": job["salary"], "x": snippet(job["text"]), "u": job["url"],
    }


# ---------------------------------------------------------------- main
def collect(company, known):
    slug = company["slug"]
    order = [known[slug]] if slug in known else []
    order += [a for a in FETCHERS if a not in order]
    for ats in order:
        try:
            raw = FETCHERS[ats](slug)
        except urllib.error.HTTPError as e:
            if e.code in (404, 410, 400):
                continue
            return company, ats, None, f"{ats} error {e.code}"
        except Exception as e:
            return company, ats, None, f"{ats} error {e}"
        if not raw and ats != order[-1] and slug not in known:
            continue  # empty board on this system, try the next one
        jobs = []
        for j in raw:
            n = normalise(ats, j)
            if not n["title"] or not n["url"].startswith("http"):
                continue
            item = tag(n, company)
            if company.get("ai_company") or item["ai"]:
                jobs.append(item)
        return company, ats, jobs, None
    return company, None, None, "not found on Greenhouse, Lever or Ashby"


def build(companies):
    known = json.loads(SOURCES.read_text(encoding="utf-8")) if SOURCES.exists() else {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda c: collect(c, known), companies))
    jobs, summary, seen = [], [], set()
    for company, ats, found, err in results:
        if err:
            print(f"  ✗ {company['name']:<22} {err}")
            continue
        known[company["slug"]] = ats
        new = [j for j in found if j["u"] not in seen]
        seen.update(j["u"] for j in new)
        jobs += new
        summary.append({"name": company["name"], "n": len(new), "src": ats})
        print(f"  ✓ {company['name']:<22} {len(new):>4} jobs  ({ats})")
    jobs.sort(key=lambda j: (j["d"], j["t"]), reverse=True)
    return jobs, summary, known


def main():
    cfg = json.loads((ROOT / "companies.json").read_text(encoding="utf-8"))
    print(f"Collecting jobs from {len(cfg['companies'])} companies…")
    started = time.time()
    jobs, summary, known = build(cfg["companies"])
    if not jobs:
        print("No jobs collected (network problem?). Keeping the previous jobs.json.")
        sys.exit(1)
    OUT.parent.mkdir(exist_ok=True)
    data = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "count": len(jobs),
            "companies": sorted(summary, key=lambda s: -s["n"]), "jobs": jobs}
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    SOURCES.write_text(json.dumps(dict(sorted(known.items())), indent=1), encoding="utf-8")
    print(f"Saved {len(jobs)} jobs from {len(summary)} companies in {time.time() - started:.0f}s → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
