"""IT Jobs: collects IT and tech jobs from companies' public job boards and writes docs/jobs.json.

Sources (public, no login, meant for showing a company's jobs elsewhere):
  Greenhouse  https://boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true
  Lever       https://api.lever.co/v0/postings/<slug>?mode=json
  Ashby       https://api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true
  Workday     the job list a company's own myworkdayjobs.com careers page loads (no official feed)

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
UA = {"User-Agent": "ITJobsAggregator/1.0 (+https://github.com/akhilendraverma)", "Accept": "application/json"}


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


# Workday has no official public feed. We read the same job list the company's own careers
# page loads in a browser: once a day, a page at a time, with a short pause between requests.
def post_json(url, body, timeout=25):
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"),
                                 headers={**UA, "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def workday_parts(address):
    """https://statestreet.wd1.myworkdayjobs.com/en-US/Global/job/... -> (base, api)"""
    m = re.match(r"https?://([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com/(?:[a-z]{2}-[A-Z]{2}/)?([^/?#]+)", address.strip())
    if not m:
        raise ValueError(f"not a Workday address: {address}")
    tenant, wd, site = m.groups()
    host = f"https://{tenant}.{wd}.myworkdayjobs.com"
    return f"{host}/{site}", f"{host}/wday/cxs/{tenant}/{site}"


def workday_date(posted):
    """'Posted Today' / 'Posted Yesterday' / 'Posted 3 Days Ago' / 'Posted 30+ Days Ago' -> YYYY-MM-DD"""
    from datetime import timedelta
    t = (posted or "").lower()
    n = 0 if "today" in t else 1 if "yesterday" in t else int(re.search(r"(\d+)", t).group(1)) if re.search(r"\d+", t) else None
    return "" if n is None else (datetime.now(timezone.utc) - timedelta(days=n)).strftime("%Y-%m-%d")


def fetch_workday(address, keep, max_pages=150, pause=0.4):
    base, api = workday_parts(address)
    found, offset, total = [], 0, None
    for _ in range(max_pages):
        page = post_json(f"{api}/jobs", {"appliedFacets": {}, "limit": 20, "offset": offset, "searchText": ""})
        posts = page.get("jobPostings") or []
        if total is None:
            total = page.get("total") or 0
        found += [p for p in posts if p.get("title") and p.get("externalPath")]
        offset += 20
        if not posts or offset >= total:
            break
        time.sleep(pause)
    wanted = [p for p in found if keep(p["title"])]

    def detail(p):
        info = {}
        try:
            info = get_json(f"{api}{p['externalPath']}").get("jobPostingInfo") or {}
            time.sleep(pause)
        except Exception:
            pass
        locs = [info.get("location") or p.get("locationsText", "")] + list(info.get("additionalLocations") or [])
        return {"title": p["title"], "url": info.get("externalUrl") or f"{base}{p['externalPath']}", "locations": locs,
                "remote": "remote" in (info.get("remoteType") or "").lower(), "date": info.get("startDate") or workday_date(p.get("postedOn")),
                "text": info.get("jobDescription", "")}

    with ThreadPoolExecutor(max_workers=3) as pool:
        return list(pool.map(detail, wanted))


# ---------------------------------------------------------------- cleaning
def text_of(raw):
    t = html.unescape(raw or "")
    t = re.sub(r"<(script|style)\b.*?</\1>", " ", t, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def snippet(raw, n=200):
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
    if ats == "workday":
        return dict(title=j["title"], url=j["url"], locations=j["locations"], remote_flag=j["remote"], date=day(j["date"]),
                    salary="", team="", text=j["text"])
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

IT_ROLE = re.compile(
    r"engineer|developer|programmer|software|devops|\bsre\b|site reliability|cloud|infrastructure|platform|security|cyber|"
    r"\bdata\b|analytics|business intelligence|\bbi\b|database|\bdba\b|systems? analyst|business analyst|machine learning|\bml\b|"
    r"\bqa\b|quality assurance|\btest|sdet|automation|help ?desk|service desk|desktop support|technical support|sysadmin|"
    r"system administrator|network|architect|technical program|technical project|\btpm\b|product manager|product owner|"
    r"product designer|\bux\b|\bui\b|scrum|mobile|\bios\b|android|front[- ]?end|back[- ]?end|full[- ]?stack|\bweb\b|"
    r"firmware|embedded|solutions? (engineer|architect|consultant)|implementation|salesforce|\bsap\b|\berp\b|(?-i:\bIT\b)", re.I)
NOT_IT = re.compile(
    r"recruit|talent|sourcer|account executive|account manager|sales development|business development|counsel|legal|"
    r"accountant|payroll|executive assistant|mechanical|civil|chemical|manufacturing|facilities|construction|"
    r"office manager|marketing manager|content (writer|marketing)", re.I)

CATEGORIES = [
    ("AI / ML", r"machine learning|\bml\b|mlops|\bai\b|llms?|deep learning|nlp|computer vision|genai|generative|"
                r"research (scientist|engineer)|applied scien|inference|interpretab|alignment"),
    ("Security", r"security|cyber|infosec|\bsoc\b|penetration|appsec|identity"),
    ("Data", r"\bdata\b|analytics|analyst|business intelligence|\bbi\b|database|\bdba\b"),
    ("DevOps & Cloud", r"devops|\bsre\b|site reliability|cloud|infrastructure|platform engineer|kubernetes|systems? engineer|network"),
    ("QA & Testing", r"\bqa\b|quality|\btest|sdet"),
    ("IT Support", r"help ?desk|service desk|desktop|technical support|support engineer|sysadmin|system administrator|(?-i:\bIT\b)"),
    ("Product & Design", r"product (manager|owner|designer|lead)|design|\bux\b|\bui\b|program manager|project manager|scrum"),
    ("Solutions & Consulting", r"solutions?|sales engineer|implementation|consultant|customer engineer|forward deployed"),
    ("Software Engineering", r"engineer|developer|programmer|software|front[- ]?end|back[- ]?end|full[- ]?stack|mobile|\bios\b|android|"
                             r"\bweb\b|architect|firmware|embedded"),
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
    cat = next((name for name, rx in CATEGORIES if re.search(rx, title, re.I)), "Other IT roles")
    regions = [r for r, rx in REGIONS.items() if re.search(rx, where, re.I)]
    return {
        "t": title.strip(), "c": company["name"], "l": where or ("Remote" if remote else "Not stated"),
        "g": regions, "rm": remote, "k": cat, "ai": bool(AI_ROLE.search(title)), "d": job["date"],
        "s": job["salary"], "x": snippet(job["text"]), "u": job["url"],
    }


# ---------------------------------------------------------------- main
def is_it(title):
    return bool((IT_ROLE.search(title) or AI_ROLE.search(title)) and not NOT_IT.search(title))


def collect(company, known):
    if company.get("workday"):
        try:
            raw = fetch_workday(company["workday"], is_it)
        except Exception as e:
            return company, "workday", None, f"workday error {e}"
        jobs = [tag(normalise("workday", j), company) for j in raw]
        return company, "workday", [j for j in jobs if j["u"].startswith("http")], None
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
            if is_it(item["t"]):
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
        if company.get("slug"):
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
