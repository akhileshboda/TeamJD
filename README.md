# Team JD

A custom website and no-code dashboard for competition-prep coach Jake Dedert, built so his leads stop going cold.

![Jake's dashboard: editing a service with a live preview of the public page](docs/case-study/dashboard-service-editor.png)

**[Read the full case study →](docs/case-study.md)**

| | |
|---|---|
| **Client** | Jake Dedert, Team JD (Adelaide) |
| **Role** | Solo: requirements, design, full-stack build, hosting, docs |
| **When** | Interview July 2025 · build February to October 2026 |
| **Stack** | React + Vite, Node + Express, Cloudflare (Tunnel, R2, Turnstile), Resend, PM2 on Oracle Cloud |
| **Tests** | 435 (176 server, 259 client) |

## The problem

In the requirements interview, Jake described a lead flow that leaked at every step:

- For six months his replies to applicants went to junk folders, and almost nobody noticed.
- His booking link let people schedule a call without filling in his application, so he'd get on calls with no idea who the person was.
- While he was overseas, four applications sat unseen for 4–5 days. Two of those people signed with other coaches.

His old website, in his words, "could disappear tomorrow and it would have zero impact on the business."

## What I built

- **Find Your Fit**, a short questionnaire that points visitors to the right service, plus a gate that sends Competition Prep applicants through Jake's application form before they can take a spot in his calendar.
- **Email that arrives**: enquiries sent from a verified domain with SPF and DKIM, with Turnstile and layered rate limits to keep spam out.
- **A dashboard Jake runs himself**: photos, results, services, prices, FAQs and site settings, with drafts, publishing and a live preview. Sign-in is a six-digit email code, so there's no password to forget.
- **A media pipeline** that turns phone uploads and Dropbox drops into WebP and H.264 on Cloudflare R2.
- **Search and AI-crawler output** rendered on the server for a React app, fed from the same content Jake edits.
- **A plain-English changelog** inside the dashboard, so Jake can see what changed and when.

The original plan was a one-month WordPress site. The [case study](docs/case-study.md) covers why that changed, the decisions and trade-offs, how the work was run, and what I'd do differently.

## Repository

| Path | What's there |
|---|---|
| [`site/`](site) | The application. [`site/README.md`](site/README.md) covers local setup, architecture, deployment and the guide for Jake. |
| [`docs/`](docs) | The case study, project charter, Gantt chart and setup notes |
| [`requirements/`](requirements) | Transcript of the requirements interview |

To run it locally:

```bash
cd site
npm install
cp .env.example .env   # fill in the values you need
npm run dev
```
