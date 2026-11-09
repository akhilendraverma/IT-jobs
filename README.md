# IT Jobs

A free website that lists IT and tech jobs (software, data, cloud, security, QA, IT support, product and AI) from tech companies' own job boards.
"Apply" always opens the job on the company's own site. No sign-up, no cookies, no tracking: nothing about visitors is stored.

## How it works

- `build.py` reads each company's **public** job board (Greenhouse, Lever or Ashby: the systems companies use for their careers pages)
  and writes `docs/jobs.json`. It uses only Python's standard library.
- GitHub Actions runs it every morning (`.github/workflows/update-jobs.yml`) and saves the new list.
- GitHub Pages shows the website from the `docs` folder. Searching and filtering happen in the visitor's browser.

LinkedIn, Indeed and Glassdoor are **not** used: their terms forbid copying their listings automatically.

## Add or remove companies

Edit `companies.json`. For each company add its name and the **slug** from its careers page address:

| Careers page address | slug |
| --- | --- |
| `https://jobs.ashbyhq.com/openai` | `openai` |
| `https://boards.greenhouse.io/anthropic` or `job-boards.greenhouse.io/anthropic` | `anthropic` |
| `https://jobs.lever.co/mistral` | `mistral` |

Only IT and tech roles are kept (sales, HR, finance and similar roles are left out). To change which titles count, edit `IT_ROLE` and `NOT_IT` in `build.py`.
After each run, the Actions log shows ✓ or ✗ for every company, so you can fix a slug that isn't found.

## Run it on your PC (optional)

`python build.py` then open `docs/index.html` through a local server: `python -m http.server -d docs 8000` → http://localhost:8000
