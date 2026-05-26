# From POC to Product — Strategic Roadmap

**Status:** Draft v1 — strategic design, awaiting user review
**Date:** 2026-05-25
**Author:** so0osh (with Claude Opus 4.7)
**Project:** `kaye-budget-mgmt` → "Commitment Ledger" (working positioning)
**Resource model:** Solo founder, ~10 hrs/week, evenings & weekends, bootstrapped
**Horizon:** 12 months, monthly detail; year 2+ direction sketch only
**Style:** Recommended + 1–2 alternatives per major decision

---

## 1. Executive Summary

**Thesis.** Take the existing Hebrew-RTL ad-budget POC and sharpen it into a *vertical wedge* — **"the Commitment Ledger for marketing teams"** — riding on a *budget-engine core* that can later host additional verticals (sales, events, grants, project budgets) as presets. Stay Hebrew-first while the moat holds; expand to English by month 9.

**The unique angle (offensive moat, beyond Hebrew/RTL).** No SMB-priced tool treats *commitments* (reserved but not yet spent) as a first-class entity, AI-ingests invoices to auto-reconcile against those commitments, and answers "am I on track this month?" before showing any transactions. That three-feature combo is the defensible product story even in English markets.

**12-month gate map.**

| Quarter | Phase | Theme | Exit gate |
|---|---|---|---|
| Q1 | Foundation | Real backend, multi-tenant, first paying user | 1 paying customer (any tier), 99% uptime |
| Q2 | Differentiator | AI invoice ingest, pacing dashboard, reserves-first UX | 5–10 paying customers, demonstrable retention |
| Q3 | i18n + extensibility | English locale, CSV import/export, PayPal integration | 1 EN customer, ≥3 live PayPal connections, churn < 10%/mo |
| Q4 | Tier expansion | Agency tier, roles, public roadmap | 25 customers OR honest pivot decision |

**Headline target.** Conservative: 10 paying customers / ~$300 MRR by M12. Stretch: 25 customers / ~$1,000 MRR. The number matters less than the *gate decisions*: each quarter ends with a real continue/adjust/stop verdict.

**What this document is not.** It is not a guarantee, an implementation plan, or a substitute for talking to real customers. It is a defensible direction with explicit gates so that "this didn't work" becomes a fast learning, not a sunk-cost trap.

---

## 2. Source Prompt (Verbatim)

> Roadmap - From a small, internal single-user POC to a production grade product
>
> I developed this small solution to assist my wife in her job, make it simpler, easier, and more efficient to manage, track and visualize the dep's budget, moving from a tedious Excel pursuing, to a somewhat better approach, using this Google Sheets backed client, hosted on GitHub pages.
> I thought that maybe I can upgrade and upscale it to a real, commercial, yielding product.
>
> Your mission is to research, explore, investigate and brainstorm about the following points, considering to upgrade the currect solution to a professional level, compare different aspects, suggest missing stuff, recommend your best approach vision, and finally document everything (including this prompt verbatim) clearly, phased/gated, delivarable and realistic:
>
> - Transforming to a real backend and hosting, instead of a Google Sheets backed for data, like supabase, vercel, etc
> - Multi-org / multi-user robust, scalable, testable solution (conform to the SARP concept, or equivalents)
> - Global, word-wide, multi-language support
> - Potential target customers: private individuals, small businesses/SOHO, bigger? (also relevent to tiers)
> - Separate environment for max security? optional
> - Real-world business plan with realistic pricing tier, considering continuous support and feature requests (maybe including a free plan/trial/demo)
> - Generic solution vs self-customizable vs selectable flavors/presets vs tailored-on-demand (budget, sales, leads, marketing etc) - including a suitable branding of such a solution
> - Additional usable features, with real-world added value (import, export, print, forecast, integrations, AI-assisted, etc)
> - Review and compare real existing solutions, pros/cons, strengths & weaknesses - how can I compete and grab a slice of the demand?
> - Keeping it real - known/unknown pitfalls, risks, and how to address each (SWOT)
> - Summary and conclusion

---

## 3. Current State Baseline

**What exists today (as of v1.3.8):**

- Single-page vanilla-JS app (~1,400 LOC in `app.js`, ~240 LOC in `sheets-api.js`).
- Data store: a single Google Sheet with six tabs — `budget` (תקציב), `transactions` (תנועות), `suppliers` (ספקים), `statuses` (סטטוסים), `reserves` (שמורות), `departments` (מחלקות).
- Auth: Google Identity Services OAuth2, single-user — whoever owns the Sheet signs in.
- Hosting: GitHub Pages, `/static` from `main` branch. No build step. CDN-loaded Chart.js, flatpickr, GIS.
- UX: Hebrew RTL throughout. Collapsible sections, dept filter, supplier combobox, charge/credit toggle, duplicate detection, flatpickr Hebrew date picker.
- Validation: end user (the founder's wife) actively uses it for real departmental ad-budget tracking. The commitment → reconciliation flow is *user-validated*, not speculative.

**What we keep.** The data model (it's already vertical and useful), the Hebrew/RTL UI patterns, the reserves concept, the supplier+department duality, the charge/credit toggle, the duplicate-detection heuristic, Chart.js for visuals, flatpickr for date entry.

**What we throw away or replace.**

- Google Sheets as data store → real Postgres (Section 6).
- GIS single-user OAuth → multi-tenant auth provider (Section 7).
- `seedSheets()` boot-time tab creation → DB migrations.
- Direct browser-to-Sheets calls → typed API layer.
- Zero tests → meaningful test pyramid (unit on engine, e2e on critical flows).

**What we add but don't have yet.** Multi-user, organizations, billing, AI ingest, pacing dashboard, exports, i18n, integrations, observability, error tracking, support workflows, marketing surface (website, docs, pricing page).

**Realistic LOC trajectory.** Today: ~2,300 LOC frontend, 0 backend. M12 target: ~6–10k LOC frontend, ~3–5k LOC backend (assuming Supabase handles auth/RLS/storage). AI tooling (Claude Code, Copilot) is a meaningful force-multiplier for the solo/weekend model — without it this roadmap would not be realistic.

---

## 4. Strategic Thesis

**Two layers, one product.**

```
┌──────────────────────────────────────────────────────┐
│  Vertical Preset: "Commitment Ledger for Marketing"  │  ← what we sell
│  (terminology, default categories, dashboards, demos) │
├──────────────────────────────────────────────────────┤
│  Budget Engine (core)                                 │  ← what we build
│  fiscal years · budgets · reserves (commitments) ·    │
│  transactions (with types) · counterparties ·         │
│  dimensions (depts/categories) · audit trail          │
└──────────────────────────────────────────────────────┘
```

The **engine** is budget-agnostic: same primitives serve marketing spend, sales pipeline budgets, event budgets, project/grant budgets. The **vertical preset** is a thin layer of defaults, terminology, demo data, and curated dashboards that makes the product feel native to one persona.

**Why this dual structure (and not just "be generic"):**

- **Generic budget tools fail in SMB.** "Budget app" describes nothing. Buyers buy solutions to specific pains. Marketers don't search for "budget management"; they search for "track ad spend vs budget."
- **Single-vertical SaaS hits a ceiling.** Owning one niche works for years, but if you ever want a second product, having to rewrite the engine is fatal. Build the engine right *once*, ship verticals on top.
- **The transaction-type idea you raised maps cleanly to this.** `reserve_fulfillment` and `ad_hoc` are engine concepts. A future "Sales Commitment" preset uses the same engine primitives but renames them ("pipeline reserves" / "deal-line allocations").

**Beachhead choice — recommended: Israeli SMB marketing teams.**

- Hebrew + RTL is a real defensive moat (incumbents can copy but won't bother for the TAM).
- Warm network: real end user is a working marketer; her peer network is the first 10 customers.
- In-timezone support; pricing in NIS reduces FX friction.
- Alternatives considered: Global EN-first generic (impossible solo, drops the moat), pure i18n-first niche (too much engineering before revenue).

**Expansion order (year 2+ sketch):**

1. EN locale for the marketing preset → UK/US SMB marketing teams.
2. Second vertical preset — likely *event budgets* or *grant/non-profit budgets* (both share the reserve-heavy data shape).
3. Optional white-label for accountants/agencies who manage budgets for multiple end-clients.

---

## 5. Product Architecture (Logical)

### Engine entities

| Entity | Description | Notes |
|---|---|---|
| `Organization` | The tenant. One paying customer = one org. | Owns billing, members, settings, locale. |
| `Member` | A user's role within an org. | Roles: `owner`, `admin`, `editor`, `viewer`. RLS scoped by `org_id`. |
| `FiscalPeriod` | Replaces today's `budget` row. | Supports non-calendar FY (e.g. Apr–Mar). |
| `Budget` | Opening budget for an `(org, period, dimension)` tuple. | Multiple budgets per period — one per department or rollup. |
| `Reserve` | Committed but not-yet-spent amount. | First-class. Reconciled via reserve-fulfillment transactions. |
| `Transaction` | Single spend or credit event. | Has a `type` enum (see below). |
| `Counterparty` | Supplier/vendor/payee. | Optional category alongside dept link (per founder note). |
| `Dimension` | Department / category / cost-center label. | Generalized "department" from the POC. |
| `Attachment` | Invoice/receipt/PDF/image. | Storage in Supabase Storage; AI-ingest reads from here. |
| `AuditEvent` | Every mutation. | Append-only; required for finance trust. |

### Reserve accounting model (Model B — "envelope")

A reserve is treated as a **sub-budget / envelope**, not as a soft promise. When a reserve is created, its `planned` amount is conceptually carved out of the budget's available pool. Spend transactions tied to that reserve live *inside* the reserve's accounting — they do not separately decrement the main budget.

**Reserve fields**
- `planned` — initial committed amount.
- `consumed` — sum of fulfillment transactions; **locked** (only changeable via a `credit` event).
- `remaining = planned − consumed`.
- `status` ∈ {`active`, `exhausted`, `released`, `transferred`}.
- Invariant: `planned ≥ consumed` at all times.

**Budget derived values** (per dimension × fiscal period)
- `opening_amount` — initial allocation.
- `committed = Σ active_reserves.remaining`
- `ad_hoc_spent = Σ non-reserve transactions on this budget`
- `reserve_spent = Σ reserves.consumed`
- `total_spent = ad_hoc_spent + reserve_spent`
- `available = opening_amount − committed − total_spent`

**Key invariant (no double-counting):** when a `reserve_fulfillment` transaction is posted, the budget's `available` is unchanged — value just shifts from `committed` to `reserve_spent`. The user-visible budget bar should *not* move on reserve reconciliation, only the reserve's own internal bar moves.

### Transaction types

Transactions are *money movements*. They are append-only and locked once posted; reversal happens via a paired `credit` event, never via edit/delete.

- `reserve_fulfillment` — links to a `Reserve`. Decrements `Reserve.remaining`, increments `Reserve.consumed`. Does **not** touch the main budget directly.
- `ad_hoc` — direct spend on a budget. Decrements `available`.
- `credit` — refund / makegood / vendor credit. Targets either a reserve (restores `remaining`, decreases `consumed`) or a budget directly. Always audited.

### Reserve operations (distinct from transactions)

Reserve operations are *allocation changes* — no money leaves the org. They live in their own event stream alongside transactions so the spend ledger stays clean.

- `amend` — change `planned` up or down. Allowed any time `status = active`. Invariant: `planned ≥ consumed`. Audited with actor, timestamp, optional reason. **This is the right primitive for "invoice came in higher than the original commitment"** — preserves original number in audit history, no silent edits.
- `release` — return `remaining` to the parent budget's `available`. Consumed portion stays locked. Reserve becomes `released`.
- `transfer` — move `remaining` from one reserve to another. Consumed portions of both reserves stay locked.

### Resolving "invoice amount > reserve remaining" during AI ingest

When the M4 AI ingest matches an invoice to a reserve and the invoice amount exceeds `remaining`, the UI surfaces three labeled choices (default = amend, since real-world data says scope creep is the most common cause):

1. **Amend the reserve** *(default)* — `ReserveOperation: amend` raises `planned` to match the invoice; then a single clean `reserve_fulfillment` transaction posts. Audit log records both the AI suggestion and the user's choice + optional reason.
2. **Split the spend** — `reserve_fulfillment` for the remaining amount (exhausts the reserve) + `ad_hoc` for the overflow. Use when overflow truly represents a different category.
3. **Reject the match** — AI was wrong; cancel the suggested link.

The system never silently amends or splits. The pre-selected default reduces clicks; the audit trail makes the choice transparent.

### Vertical-preset surface

A preset is a record of: default terminology (HE/EN), default `Dimension` set, default `Counterparty` categories, default dashboard layout, default demo data, optional onboarding flow. **Marketing preset** ships at v2. Adding a new preset = ~1–2 weekends, no engine change.

### Decisions deferred (per founder direction)

- Exact `Counterparty.category` taxonomy.
- Whether `Dimension` is a tree or a flat list.
- Whether multi-currency lives at engine or preset level (probably engine, Phase 3).
- Custom fields per org — *not* in Y1 scope.

---

## 6. Tech Stack & Hosting

### Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **SvelteKit** (alt: keep vanilla-JS, alt: Next.js) | Smallest bundle, file-based routing, built-in i18n stories, smoother learning curve than React. Keeps RTL handling clean. |
| Hosting (frontend) | **Cloudflare Pages** (alt: Vercel) | Free tier is genuinely free; egress not charged; works fine for static + edge functions. |
| Backend platform | **Supabase** | Postgres + Auth + Storage + Row-Level Security in one. Free tier covers Phase 1–2; ~$25/mo Pro tier covers Phase 3–4. |
| ORM / DB access | **`postgres.js`** or Supabase JS client + generated types | Avoid heavy ORMs at this scale. Lean on SQL + RLS. |
| Auth | Supabase Auth (email magic link + Google OAuth) | Eliminates a whole problem domain for solo dev. |
| File storage | Supabase Storage | Invoices/receipts. Signed URLs, RLS on bucket. |
| AI ingest | **Anthropic API (Claude Haiku 4.5)** | Cheap, fast, vision-capable. Server-side only — never expose key to client. |
| Email | Resend or Postmark | Cheap, reliable, good DX. |
| Payments | **Paddle** (alt: Stripe) | Paddle = merchant-of-record, handles VAT/sales-tax globally — meaningful for solo with EU/IL customers. Stripe is more flexible but tax becomes your problem. |
| Error tracking | Sentry (free tier) | Non-negotiable. |
| Analytics | Plausible or PostHog free | Privacy-respecting; the audience cares. |

### Alternative stacks considered

- **"Stay vanilla-JS + Supabase REST"** — minimizes migration cost but locks you into the current `app.js` structure, which is already at the edge of solo-maintainable at 1,400 LOC. Reject.
- **"Self-host Postgres on a VPS"** — saves ~$25/mo but adds backups, security patching, monitoring, and TLS to your weekend workload. Reject for Y1.
- **"Firebase"** — works but the data model (Firestore documents) fits poorly with budget/ledger semantics. Real SQL aggregations are core to the product. Reject.

### Migration order (matters for keeping the existing user happy)

1. Set up Supabase project, define schema, export current Sheets data → Postgres via one-time script.
2. Replace `sheets-api.js` with a thin `supabase-api.js` exposing the same shape — keep `app.js` unchanged for one commit.
3. Then refactor `app.js` to use the new types and remove Sheets-specific code.
4. Only after that, introduce the framework (SvelteKit) — *not* before. Two big migrations in one PR is the classic solo-founder trap.

### Cost envelope (Y1, conservative)

- Supabase Pro: $25/mo from M6 onward → ~$175 in Y1.
- Domain: ~$15.
- Anthropic API for AI ingest: ~$5–25/mo depending on volume → ~$100 in Y1.
- Email: free tier likely sufficient → $0–10/mo.
- Cloudflare Pages: $0.
- Sentry/Plausible: free tier → $0.
- Misc (design assets, fonts, occasional contractor for landing-page polish): ~$200.

**Total Y1 infra & tools: ~$500–700.** A real but absorbable bootstrap budget.

---

## 7. Multi-Tenancy, Security, Environments

### "SARP concept"

The original prompt asked about "conforming to the SARP concept, or equivalents." SARP isn't a widely recognized acronym in the SaaS architecture canon (it may be a local/translated term). The standard equivalents for what's usually meant by this — *Secure, Auditable, Reliable, Performant* or *Scalable, Available, Reliable, Performant* — are addressed below explicitly:

- **Secure:** RLS on every table; auth on every endpoint; secrets never in the client; quarterly access review.
- **Auditable:** append-only `AuditEvent` table; every mutation logged with actor + before/after; exportable.
- **Reliable:** automated daily backups (Supabase handles); restoration procedure documented and tested *once before M6*.
- **Performant:** every list endpoint paginated; expensive aggregates materialized or cached; client-side query budget < 200ms p95 on the dashboard.
- **Scalable:** RLS-based multi-tenancy on a single Postgres scales comfortably to several thousand orgs; no premature sharding.
- **Testable:** unit tests on engine logic (reserve reconciliation math), Playwright e2e on critical flows (sign-up, create budget, ingest invoice).

### Multi-tenancy model — recommended: Row-Level Security with `org_id`

Every tenant-owned table has an `org_id` column. RLS policies restrict reads/writes to rows where `org_id` matches the user's active org. One Postgres instance, one schema, all tenants. Simple, well-understood, cheap.

**Alternatives:**

- **Schema-per-tenant.** Stronger isolation but ops overhead is real (migrations × N schemas, backups, monitoring). Only justified for regulated customers. Defer to Phase 4+ as a paid "Isolated Tier" if demand emerges.
- **Database-per-tenant.** Maximum isolation, maximum cost. Reject in Y1.

### "Separate environment for max security" — recommended treatment

Make it a **paid feature on the top tier**, not a Y1 default:

- **Standard tier (default):** shared Supabase project, RLS isolation, region: EU (Frankfurt) for GDPR comfort.
- **Isolated tier (Phase 4+ only, on request):** dedicated Supabase project, dedicated storage bucket, optional region pinning (e.g. Israel-adjacent). Charge meaningfully ($199+/mo) — this is sales-led, not self-serve.

Don't build the Isolated tier on spec. Build it when a real prospect asks and is willing to prepay.

### Environments

- **`local`** — your dev machine, against a local Supabase or a personal dev project.
- **`staging`** — separate Supabase project, deployed from `main` branch on push, used for pre-release smoke tests.
- **`prod`** — separate Supabase project, deployed from a `release` branch on tag.

Three environments is the minimum for solo SaaS. Skipping staging is how you ship a broken migration to your only paying customer.

### Compliance posture (Y1)

- GDPR-friendly defaults: data deletion endpoint, export endpoint, clear DPA available on request.
- No SOC 2 / ISO27001 in Y1 — too expensive ($15–40k) for the revenue target. Document the security practices in a public "Trust" page; that's enough for SMB self-serve.

---

## 8. Internationalization

### Phasing

| Phase | State | Effort |
|---|---|---|
| M1–M5 | Hebrew-only (current). Strings live in markup. | None. |
| M6 | Extract strings into a JSON catalog (`he.json`). Wire i18n library. | ~1 weekend. |
| M7–M8 | Add `en.json`. All net-new strings added bilingually. Locale switcher in user settings. | ~2 weekends incremental. |
| M9 | Locale-aware dates (flatpickr already supports), currencies (Intl.NumberFormat), number formats. | ~1 weekend. |
| Y2 | Additional locales by demand (likely AR, RU, ES, FR — Israel has large communities in each). | TBD. |

### Recommended library

**`i18next`** with the SvelteKit integration (alt: framework-native solution if SvelteKit's gets richer). Reasons: mature, well-documented, good plural rules, supports lazy-loading per locale.

### RTL as a first-class concern

RTL is *not* an i18n afterthought. The current app handles it well in CSS. The rule: every new UI component must be built and visually tested in both LTR and RTL before merge. Chart libraries (Chart.js) have edge cases — known and documented in the current codebase already.

### Translation source-of-truth

Founder maintains HE strings; AI-assisted EN translations for v1 EN release (Claude can do this well); proper localization service (e.g. Crowdin community tier) only if/when AR or FR ships.

---

## 9. Target Customers & Personas

### Y1 target personas (in priority order)

**P1 — Solo marketer / in-house marketing lead at a 5–30 person company.**
- Manages $5k–50k monthly ad spend across 2–10 vendors.
- Today: Excel + reminders + email threads with finance.
- Pain: doesn't know mid-month whether they're on track; double-bills slip through; finance asks for reports they don't have time to make.
- Pays from marketing budget, no procurement gauntlet at this size.

**P2 — Marketing team lead at a 30–150 person company.**
- 2–6 marketers, each owning a channel or geography.
- Today: shared Excel/Google Sheet, ad-hoc, manager nags for updates.
- Pain: visibility, role separation, attribution to campaigns.
- Buys at the team-tier price.

**P3 — Small agency managing client budgets.**
- 5–25 staff, 3–30 active clients with separate budgets.
- Today: client folder per project in spreadsheets, monthly burn-rate emails.
- Pain: multi-client switching, per-client P&L, agency-side reporting.
- Buys at the agency-tier price; high LTV if retained.

### Explicitly *not* a Y1 target

- **Private individuals / personal finance.** YNAB/Monarch/Mint own this. Different product, different pricing physics, different support tone. Different *brand*. Rejecting this is a strategic act.
- **Enterprise marketing departments (>200 people).** Allocadia/Plannuh own this. Sales-led, $30k+ deals, RFP gauntlets, procurement, security questionnaires. Wrong fit for solo founder.
- **Finance/FP&A as primary persona.** Float/Pry/Finmark own this. Different vocabulary, different stakeholders.

### Persona-to-tier mapping

| Persona | Tier | ARPU |
|---|---|---|
| P1 Solo marketer | Solo | $9–15/mo |
| P2 Marketing team | Team | $29–49/mo |
| P3 Agency | Agency | $79–149/mo |

---

## 10. Pricing Tiers

### Recommended pricing (Y1)

| Tier | Price (USD) | Price (NIS) | Includes |
|---|---|---|---|
| **Free** | $0 | ₪0 | 1 user, 1 budget, 1 fiscal year, 50 transactions/month, 5 reserves, no AI ingest, community support only |
| **Solo** | $12/mo or $120/yr | ₪45/mo or ₪450/yr | 1 user, unlimited budgets/transactions, AI ingest (20/mo), email support |
| **Team** | $39/mo or $390/yr | ₪149/mo or ₪1,490/yr | Up to 5 users, role separation, AI ingest (200/mo), priority email |
| **Agency** | $99/mo or $990/yr | ₪379/mo or ₪3,790/yr | Up to 20 users, multi-client switcher, white-label option (Y2), AI ingest (1,000/mo), Slack/Discord support |
| **Isolated** (Phase 4+) | $299+/mo | ₪1,149+/mo | Dedicated infra, custom region, contractual SLA, dedicated onboarding |

**Annual discount:** 2 months free (16.7% off), which lifts cash-flow significantly and reduces churn.

**Israel pricing logic.** Use ~3.8× ratio for psychological round numbers; absorb the small currency drift. Pricing in NIS removes friction for Israeli SMBs that resist USD card billing.

**Trials & demo:**

- **14-day free trial** of any paid tier, no credit card required. Convert to paid via in-app upgrade.
- **Free tier** is a permanent fallback — keeps the funnel open after trial.
- **Live demo data** available in trial mode so prospects see the product full, not empty.

### Alternatives considered

- **Freemium-only (no trial).** Simpler but loses prospects who want full-product trial.
- **Trial-only (no free tier).** Higher conversion rate per signup but kills word-of-mouth and discovery.
- **One-time purchase / lifetime deal.** Rejected: support load is perpetual, revenue isn't.
- **Per-user pricing inside Team/Agency.** Rejected for simplicity in Y1. Revisit if churn analysis shows you're under-pricing larger teams.

### Pricing-sensitive observations

- **AI ingest meters are the natural upsell vector.** Cost-per-ingest is real (~$0.01–0.05). Don't give unlimited at any tier; users will dump entire inbox archives the first day.
- **Annual billing is the cash-flow lifeline for a solo bootstrapper.** Push it visibly but not aggressively.
- **Don't undercut yourself.** $12 for a *business* product is already on the low side. Israeli founders often under-price; this matters.

---

## 11. Business Model & Support

**Self-serve SaaS.** No sales calls in Y1, no demo bookings, no quotes. Pricing public, sign-up frictionless.

**Support tiers:**

- **Free:** community Discord/forum, FAQ, no direct response SLA.
- **Solo / Team:** email support, best-effort response within 1 business day.
- **Agency:** Slack/Discord shared channel, response within 4 business hours during your timezone.
- **Isolated:** contractual SLA, dedicated point of contact (you, in Y1).

**Feature request handling:**

- Public roadmap (GitHub Projects or Productboard free tier or just a Notion page) — voting allowed.
- "I will build it" decisions made monthly. Default answer is "logged, no commitment."
- Bug fixes: triaged within 48h on paid tiers; community on free.

**Content / acquisition:**

- One landing page (`commitment-ledger.com` or similar — final name TBD per Section 12).
- One blog post per month minimum, in HE for Y1; bilingual once EN ships. Topics: marketing-budget tactics, not product fluff.
- LinkedIn presence (founder voice), Israeli SMB marketing Slack/WhatsApp communities, Hebrew Product Hunt equivalents.
- No paid ads in Y1 — burn-rate doesn't justify CAC > $50.

**Logo customer / case study target:** by M6, secure one published case study from a real Israeli marketing team. This is the single highest-leverage marketing artifact.

**Burnout safeguards (a real business risk for solo):**

- Hard cap: never work more than the planned 10–15 hrs/week. Going to 30 is how you implode by M8.
- One full off-week per quarter, deliberately scheduled.
- Find one trusted second-opinion human (peer/mentor) for quarterly gate decisions — don't make stop/go calls alone in your head.

---

## 12. Branding & Positioning

### Positioning statement

> **"The Commitment Ledger for marketing teams.**
> Track what you've promised to spend — not just what you've spent.
> Drop in an invoice; we'll reconcile it. See in three seconds whether you're on track this month."

### Brand name — candidates

The product needs a real English-pronounceable name that travels. The Hebrew positioning is a *tagline*, not the brand.

| Candidate | Pros | Cons |
|---|---|---|
| **Pledger** | Direct semantic fit ("pledge" = commitment); brandable | `.com` likely taken; risk of religious connotation in some markets |
| **Earmark** | Native English term for reserved budget; meaningful to finance buyers | Less playful; harder to own at SEO |
| **Plinth** | Short, unique, evokes "foundation/base" | Obscure; needs marketing investment to define |
| **Tabit** | Tab → ledger, "-it" makes it actionable; clean .com possible | Generic-sounding |
| **Commit** (+ qualifier) | Direct, modern; e.g. "Commit Budget" | Too generic; overlap with git/dev tools |
| **Reserva** | Latin-root, international, evokes the unique data primitive | Already a hotel-tech name in some markets |
| **Pacelane / Pacely** | Plays on the pacing-first UX | Slightly cute; less serious |

**Recommended approach:** generate ~30 candidates, check `.com` + Israeli/EU/US trademark databases, validate pronunciation in HE/EN with 5 friends, then pick. Don't commit to a name in this doc — the action is "spend one weekend in M3 doing this work properly."

**Brand tone:** competent, calm, slightly dry. Not "fun!" — finance-adjacent buyers distrust fun. Look at how Float, Pry, and Linear talk; aim for that register.

**Visual identity (cheap path):** Inter/Manrope for type; a calm two-color palette (a deep blue + one accent — *not* every-SaaS-purple); one signature illustration style. Use a paid Dribbble/Fiverr designer for 1 day in M3 — ~$200, well spent.

**Hebrew brand handling:** keep the EN brand globally; HE tagline beneath it on Hebrew pages. Don't transliterate the brand into Hebrew letters — it looks cheap.

---

## 13. Feature Roadmap (Themes)

Listed as themes, not items. Each theme is a *quarterly* commitment; specific implementation lives in implementation plans, not here.

| Theme | Quarter | Headline value |
|---|---|---|
| **Backend migration & multi-tenant** | Q1 | Real product, real customers possible |
| **Auto-import (PDF/image ingest + AI categorize)** | Q2 | Headline differentiator; demoable in 30 seconds; unifies all "transaction-entry-without-typing" pathways |
| **Pacing-first dashboard** | Q2 | Reframes the product from ledger to answer engine |
| **Reserves-first UX** | Q2 | Makes the unique data model visible |
| **i18n & English locale** | Q3 | Expands TAM beyond Israel |
| **CSV import / Excel export / print-friendly views** | Q3 | Removes the last "but my Excel does X" objection; extends the Auto-import pipeline to bulk file sources |
| **First payment-platform integration (PayPal)** | Q3 | Transactions stream in automatically, AI categorizes — pitch becomes "you don't enter transactions, we do" |
| **Agency tier features** | Q4 | Multi-client switcher, per-client P&L |
| **Roles & permissions** | Q4 | Unblocks Team tier sales above 3 users |
| **Public roadmap + community** | Q4 | Marketing channel + retention tool |

### The "Auto-import" feature family — long-arc view

A single conceptual feature with many input pipes, all funneling into one confidence-scored review queue. Built incrementally across Y1 and Y2:

| Stage | When | Pipe | Notes |
|---|---|---|---|
| Stage 1 | M4 (Y1 Q2) | PDF/image invoice upload | Vision-model extraction; user confirms before commit. |
| Stage 2 | M8 (Y1 Q3) | CSV/Excel statement upload | Column-mapping wizard; AI-categorize each row. |
| Stage 3 | M9 (Y1 Q3) | **PayPal** API connection | First live transaction feed; OAuth + polling. |
| Stage 4 | Y2 Q1 | **Aggregator** (Salt Edge or Tink) | Wraps Israeli banks + EU/US banks; license-by-proxy. Charge per connection. |
| Stage 5 | Y2 Q2 | Stripe-merchant connection | For users whose product runs on Stripe — see fees & refunds in budget. |
| Stage 6 | Y2 Q3+ | Israeli credit-card aggregators (CAL/Isracard/Max) where APIs allow | Selective; some require business-account scopes. |
| Stage 7 | Y3 | Direct AISP licensing (Israel) | Strategic fork — eliminates aggregator fees, becomes a moat. Only if revenue justifies ~$30–60k regulatory cost. |

**Unifying mechanism:** every stage produces *candidate transactions* with a confidence score and a vendor-name guess. AI categorize step adds department/category suggestions based on user's historical patterns. User reviews from a single inbox-style queue. One UI, many pipes.

**Explicit non-target in Y1–Y2:** Bit / PayBox — closed consumer P2P APIs with no third-party read access at time of writing. Revisit only if their API posture changes.

### Notable items *not* in Y1

- Forecasting beyond "projected EOM" trendline (real Monte-Carlo / scenario modeling is Y2+).
- Native ad-platform integrations (Google Ads / Meta / LinkedIn API ingest) — too much OAuth + rate-limit + support surface.
- Direct Israeli bank API connections — requires AISP licensing; deferred to Y3 strategic fork.
- Bit / PayBox connections — closed consumer P2P APIs; not feasible third-party.
- Mobile apps — responsive web is enough for the buyer's workflow.
- Workflow approvals (PO → approval → reconciliation) — Phase 5+ if Agency demand emerges.
- Custom fields per org — explicit non-goal; presets cover the common cases.

---

## 13.5 Integration Partner Landscape (Reference)

Captured so future-you doesn't have to re-research. Honest difficulty assessment per source.

| Source | Difficulty | License needed? | Path / notes |
|---|---|---|---|
| **CSV/Excel statement upload** | Easy | No | Universal. Foundation that every other integration *also* reduces to internally. M8. |
| **PayPal merchant API** | Medium | No | OAuth + transactions endpoint. Solo-doable, 1–2 weekends. M9. |
| **Stripe (merchant data source)** | Medium | No | Same shape as PayPal. Useful for users whose own revenue runs through Stripe — fees/refunds visible in budget. Y2 Q2. |
| **Israeli credit-card networks (CAL / Isracard / Max)** | Medium-hard | Varies | Some have business-account APIs; consumer-card data usually requires an aggregator. Y2 Q3+, selective. |
| **Israeli banks direct (Hapoalim, Leumi, Discount, Mizrahi, etc.)** | Hard | **AISP license required** | Israel's Open Banking mandates bank APIs, but the *consumer* of those APIs must be a licensed Account Information Service Provider. Real regulatory burden (~$30–60k). Defer to Y3 strategic fork. |
| **International aggregator: Salt Edge** | Medium (technical), they hold license | License-by-proxy | Covers Israeli + EU + US banks under one SDK. Per-connection cost (~$0.20–$3/mo). Recommended Y2 path. |
| **International aggregator: Tink** | Medium | License-by-proxy | EU-strong, weaker Israel coverage. Alternative to Salt Edge. |
| **International aggregator: Plaid** | Medium | License-by-proxy | US-strong, no Israel coverage. Useful only after meaningful US traction. |
| **Bit (Mizrahi-Tefahot)** | Not feasible | N/A | Closed P2P consumer app. No public third-party read API at time of writing. Watch for changes. |
| **PayBox (Discount)** | Not feasible | N/A | Same shape as Bit. Closed app. |
| **Google Ads / Meta Ads / LinkedIn Ads API** | Hard | OAuth complexity, not licensing | Real value (spend attribution to campaigns) but OAuth + rate-limits + schema-drift + per-platform support burden. Y2+ only if customer demand is loud. |
| **Accounting tools (QuickBooks / Xero / iCount / Greeninvoice)** | Medium | No | Bidirectional opportunity — pull invoices, push reconciled transactions. Strategic partnership angle. Y2+. |

**Architectural rule:** every integration normalizes to the same internal *CandidateTransaction* type (vendor, amount, date, currency, raw memo, source, confidence). One review queue, one categorization model, many pipes. This is what keeps the Auto-import feature family from fragmenting into N disconnected UIs.

**Support-burden reality check:** bank/card connection breakage is the #1 operational pain reported by aggregator-based products (auth-method rotations, MFA changes, account re-issues). Customers call *you*, not the bank or the aggregator. Plan for ~20% of Agency-tier support load to be integration-related once Stage 4 ships.

---

## 14. Competitive Landscape

| Tool | Category | Strength | Weakness | Why they don't eat us |
|---|---|---|---|---|
| **YNAB** | Personal finance | Best-in-class envelope budgeting, devoted community | Personal-only; no vendor/PO concept; no multi-user-business pricing | They're personal; pivoting to B2B marketing would alienate their base |
| **Monarch Money** | Personal finance | Slick UI, post-Mint home | Same as above; consumer-only | Different ICP entirely |
| **Lunch Money** | Personal finance, indie | Solo-built, proof that one person can ship a great budget tool | Personal-only, US-centric | Inspiration, not competition |
| **Float** | SMB cash flow | Excellent cash-flow forecasting, accountant-channel | Not marketing-specific; UK/US focus; accountant-mediated | Different jobs-to-be-done; we don't compete on cash-flow modeling |
| **Pry / Finmark / Causal** | Startup FP&A modeling | Powerful scenario modeling | Modeling > tracking; not commitment-aware; pricier | Different buyer (CFO/founder, not marketing lead) |
| **Allocadia / Plannuh / Hive9 / Uptempo** | Enterprise marketing budget | Real marketing-budget tools, deep features | Enterprise-only, $30k–$200k/yr, sales-led, terrible SMB UX | Wrong altitude; they refuse to chase $99/mo customers |
| **QuickBooks / Xero "budgets"** | GL-attached budgeting | Already in every accountant's workflow | Accountant-first; marketers don't live here; no commitment concept | We're a complement, not a replacement; integration target later |
| **Brex Budgets / Ramp** | Spend management cards | Real-time card-level visibility | Tied to their card product; not ledger-first; US-only | Different category — they manage cards, we manage the plan |
| **Notion / Airtable + templates** | DIY workaround | Infinitely customizable | No domain logic; you build everything; no reconciliation engine | Customers who chose Notion are choosing flexibility over fit — different psychographic |
| **Excel + accountant** (real incumbent) | Spreadsheet | Free, flexible, what people know | Error-prone, no pacing, no AI ingest, no audit trail, version chaos | Direct competitor in awareness terms; we win on time-saved + confidence |

### Hebrew-market specifics

- **Israeli accounting/invoicing SaaS** (e.g. iCount, Cardcom, Greeninvoice / חשבונית ירוקה) — invoicing/billing tools, not budget tracking. Adjacent, not competing. Integration partners later.
- **Hebrew Excel + accountant** — by far the dominant incumbent. The roadmap fundamentally competes against this, not against named SaaS.

### How we compete

- **Against Excel:** "Stop reconciling. Stop chasing duplicates. Open it and know."
- **Against personal-finance apps:** "You're a business. You have vendors, departments, fiscal years, and an accountant. They aren't built for you."
- **Against enterprise marketing tools:** "You don't need a six-month onboarding. Pay $39, start today."
- **Against FP&A modeling tools:** "We don't model the future. We track the present commitments. Buy both if you want."

---

## 15. Risks & SWOT

### SWOT

**Strengths**

- Real working POC validated by a real end user — not a deck.
- Hebrew/RTL moat that English-first competitors can't profitably copy.
- AI ingest is *cheap to build now* (frontier-model inference costs collapsed); was a $50k engineering project two years ago.
- Founder is in-domain (close to real marketing-team workflow via daily-life observation).
- Solo = fast decisions, no committee overhead.

**Weaknesses**

- ~10 hrs/week — slow ship cadence; every theme takes a real quarter.
- Single point of failure: founder gets sick, the company stops.
- No design partner or co-founder for sanity-checking direction.
- No marketing/sales background (assumption — confirm with founder).
- Zero tests in current codebase; tech debt to address before scale.
- Brand and naming not yet decided.

**Opportunities**

- AI ingestion is a once-per-decade GTM wave; first SMB-priced tool with it in a niche wins meaningful share.
- Israeli SMB SaaS penetration is below US/EU — room to grow at home before competing abroad.
- "Commitment ledger" terminology is unclaimed at the SMB tier.
- Remote work normalized distributed marketing teams needing shared budget visibility.

**Threats**

- A funded competitor (Float, Pry, or an Allocadia spin-off) adds an AI-ingest + commitment view at SMB pricing — probability low in Y1, rising in Y2.
- Google deprecates GIS or Sheets API → forces faster migration off Sheets. Mitigation: leave Sheets in Q1 anyway.
- Supabase or Vercel pricing pivot — low probability, mitigatable (Postgres is portable).
- AI ingest accuracy issues create support burden out of proportion to revenue. Mitigation: confidence-scored extraction; user always confirms before commit.
- Founder burnout — *highest-probability killer*. Mitigation: hard time-budget, quarterly off-weeks, mentor relationship.

### Named pitfalls (and explicit mitigations)

| Pitfall | Mitigation |
|---|---|
| **Building for one user (founder's wife)** | Quarterly gate requires N unrelated paying customers. M3 gate: 1 unrelated. M6: 5. |
| **Feature creep before PMF** | Each quarter has a *theme*, not a list. Out-of-theme requests go to backlog, not to M-N. |
| **Hebrew-only ceiling** | EN locale in Q3 with explicit M9 gate. Don't delay past Q3. |
| **Pricing too low (Israeli founder tendency)** | Bench-mark against Float/Pry/YNAB *before* launch. Solo tier ≥ $12; never lower. |
| **Free-tier abuse** | Hard caps (50 tx/mo, 1 budget). Free is for evaluation, not real workloads. |
| **AI hallucinations on invoice ingest** | Always show extracted fields for confirm; show confidence; never auto-commit without review. |
| **Single-customer dependency on logos / case studies** | Aim for 3 case-study candidates by M6; don't quote one customer's logo on the homepage. |
| **Conflict of interest with founder's wife as customer-zero** | Be explicit: she's a design partner, not the product roadmap. Decisions must work for unrelated P1s too. |
| **Support burden scaling faster than revenue** | Tier-gate Slack/Discord; canned answers; in-app help; FAQ before email. |
| **GitHub Pages → real hosting migration breaks SEO** | One-time migration in Q1 with redirects from the GH-Pages URL set up properly. |
| **Solo legal / tax exposure** | One conversation with an Israeli tax accountant by M3, before first paid customer. Probably register as עוסק פטור at start, עוסק מורשה once revenue justifies. |
| **Bank-integration support burden** (Y2+) | Connection breakage from auth/MFA rotations is the #1 operational pain of aggregator-based products. Mitigations: route to a dedicated support queue, build automated reconnect prompts, set customer expectations on the integration pricing page ("rare but possible disconnections — we'll alert you"). Don't take this on before Y1 retention is proven. |
| **Israeli AISP licensing fork** (Y3) | Becoming a directly-licensed Account Information Service Provider in Israel is a real strategic decision (~6 months, ~$30–60k legal/compliance). Don't drift into it — make a deliberate go/no-go decision based on Y2 aggregator economics and Israeli MRR concentration. |
| **PII/regulatory sensitivity rises with bank data** | Y1 security posture (RLS + Supabase defaults) is fine for budget data. Once bank/card transactions flow in (Y2), add field-level encryption for account numbers/last-4s and revisit data-retention policy. Don't bolt on later under regulatory pressure. |

---

## 16. 12-Month Phased Plan (Monthly Detail)

Each month has: one **main deliverable**, the **exit criterion**, and an explicit **non-goal**. The "non-goal" line is the most important — it's what keeps scope from creeping.

### Q1 — Foundation (M1–M3)

**Month 1 — Backend & schema migration.**
- Deliverable: Supabase project live; schema mirrors current Sheet model + new entities (Org, Member, AuditEvent); one-shot data export from existing Sheet → Postgres.
- Exit: existing single-user app works against Supabase with no Sheets dependency.
- Non-goal: framework rewrite, new features, new UI.

**Month 2 — Multi-tenancy & auth.**
- Deliverable: Supabase Auth (magic link + Google); Org + Member with RLS; invite flow; founder's wife and one unrelated friendly user share an Org and can both use the app.
- Exit: two users in one Org, RLS verified by attempted cross-org reads failing.
- Non-goal: billing, paid tiers, public sign-up.

**Month 3 — Production polish + first paying customer + branding sprint.**
- Deliverable: public sign-up flow; Paddle integration for Solo tier; landing page on real domain; brand name + logo locked; first unrelated paying customer onboarded (price discovery, possibly manual).
- Exit: 1 paying customer (any amount, even discounted founder-level pricing).
- Non-goal: AI features, pacing dashboard, agency tier.

**Q1 GATE (end of M3):**
- Continue if: ≥1 unrelated paying customer; founder's energy still good; product working without weekly emergencies.
- Adjust if: no paying customer but strong qualitative signal — extend Q1 by 1 month before deciding.
- Stop if: no paying customer + no clear path + founder exhausted — write it up as a learning, ship the engine open-source, move on.

### Q2 — Differentiator (M4–M6)

**Month 4 — AI invoice ingest v1.**
- Deliverable: upload PDF/image → Claude vision extracts vendor + amount + date + category guess → user confirms → transaction created with attachment linked. Confidence-scored.
- When the extracted amount exceeds a matched reserve's `remaining`, surface the three-option resolution (**amend** default / split / reject) per §5. Audit log captures the AI suggestion + the human choice.
- Exit: founder + 1 paying customer routinely use it for real invoices; <5% incorrect-after-confirm rate.
- Non-goal: ingest from email, bulk upload, OCR perfection.

**Month 5 — Pacing-first dashboard.**
- Deliverable: redesigned default home view: burn-rate, projected end-of-period, traffic-light (green/amber/red), top vendors by YTD, top reserves nearing exhaustion.
- Exit: 3+ customers report the dashboard is "what they open first."
- Non-goal: customizable dashboards, drag-and-drop widgets.

**Month 6 — Reserves-first UX elevation.**
- Deliverable: reserves are a primary nav item (not buried); reserve detail page shows `planned` / `consumed` / `remaining` with a clear bar; AI ingest auto-suggests matching reserves on confirmation; reservation lifecycle (`active` → `exhausted` / `released` / `transferred`) is visible.
- **UI cue for the Model-B no-double-counting invariant:** when a `reserve_fulfillment` transaction is posted, the *main budget bar does not move* — only the reserve's internal bar shifts. This is a small visible signal that reinforces the "envelope" mental model and prevents the "wait, did that get counted twice?" question from the user.
- Reserve operations surfaced as first-class user actions: **amend** (with confirm + optional reason), **release**, **transfer-to-another-reserve**. Each emits an audited event distinct from transactions.
- Exit: 5–10 paying customers; 1 published case study underway.
- Non-goal: workflow approvals on reserve creation.

**Q2 GATE (end of M6):**
- Continue if: 5+ paying, week-2 retention >70%, case study materializing.
- Adjust if: retention < 60% — pause new features, do 10 customer interviews, focus M7 on retention root cause.
- Stop if: cannot retain users despite the headline features working — niche may be wrong; reassess.

### Q3 — i18n + Extensibility (M7–M9)

**Month 7 — i18n infrastructure + EN locale.**
- Deliverable: all strings externalized; HE + EN catalogs; locale switcher; locale-aware date/number/currency formatting.
- Exit: founder demonstrates the same workflow end-to-end in EN with no missed strings.
- Non-goal: additional locales, marketing-site i18n.

**Month 8 — CSV import / Excel export / print views.**
- Deliverable: CSV import wizard (column mapping, dry-run preview, error reporting); Excel export of any list view; print-optimized stylesheet for monthly report.
- Exit: a new user can migrate 1 fiscal year from Excel in under 30 minutes.
- Non-goal: native bank-feed integration.

**Month 9 — First payment-platform integration (PayPal) + EN launch.**
- Deliverable: **PayPal merchant API** OAuth flow + transaction polling + auto-categorize via the same AI pipeline used for invoice ingest; transactions land in the unified Auto-import review queue. Marketing-site EN version. Product Hunt launch in EN.
- Exit: 1 EN-speaking paying customer; total paying customers ≥ 15; ≥3 customers actively using a live PayPal connection.
- Alternatives if PayPal feasibility blocks (e.g. account-verification gating): Stripe-merchant feed (same shape, different API), or doubled-down CSV-statement importer for top 3 Israeli banks.
- Non-goal: Israeli bank direct APIs (defer to Y2 via aggregator), Google Ads / Meta Ads API integration (defer to Y2), AISP licensing (defer to Y3).

**Q3 GATE (end of M9):**
- Continue if: 1+ EN customer, no major churn from HE customers during the EN expansion.
- Adjust if: EN traction zero — focus Q4 entirely on HE deepening rather than EN.
- Stop signal: continuing churn > 15%/mo despite Phase 2 features — fundamental ICP problem; consider a real pivot.

### Q4 — Tier expansion (M10–M12)

**Month 10 — Agency tier MVP.**
- Deliverable: multi-client (sub-organization) switcher inside an Agency org; per-client budgets/reserves; per-client report; agency-level rollup view.
- Exit: first Agency-tier prospect onboarded (paying or piloting).
- Non-goal: white-label, agency-side billing-to-clients automation (Y2).

**Month 11 — Roles, permissions, audit polish.**
- Deliverable: `viewer` / `editor` / `admin` / `owner` enforced via RLS; in-app audit log view; org-level setting page polished.
- Exit: a Team-tier customer reports specific reason their team uses it that requires roles.
- Non-goal: SSO, SCIM, enterprise IAM.

**Month 12 — Public roadmap, community, retrospective.**
- Deliverable: public roadmap page with voting; community Discord live; in-app changelog widget; written Y1 retrospective + Y2 directional sketch.
- Exit: Y1 gate decisions made for Y2 (see below).
- Non-goal: any new product features. M12 is a deliberate "stabilize and reflect" month.

**Q4 GATE / YEAR-END (end of M12):**
- Conservative success: 10+ paying customers, ~$300+ MRR, < 10%/mo churn, founder still energized.
- Stretch success: 25+ customers, $1,000+ MRR, one published case study, one EN customer.
- Continue decisions: (a) Y2 themes (second vertical preset? mobile? integrations deepening?), (b) whether to seek a co-founder/contractor, (c) whether to remain solo-bootstrapped or take small funding.
- Honest-stop trigger: < 5 paying customers and < $150 MRR with declining qualitative signal — write up as learning, decide whether to open-source or sunset.

### Buffer / reality factor

The plan above assumes ~10 hrs/week × 4 weeks = ~40 productive hours per month. Real-world: subtract ~25% for life, illness, holidays, motivation dips, and external context-switching costs. The plan should feel ~75% achievable in isolation; that's the *right* tension.

---

## 17. Conclusion & Open Questions

### Conclusion

The path from "internal Hebrew POC for one user" to "small, profitable, defensible vertical SaaS" is realistic at the solo / evenings-and-weekends pace **if** the scope discipline of vertical wedge + engine architecture is preserved, **if** quarterly gates trigger honest stop/adjust decisions, and **if** the AI-ingest + reserves-first + pacing-first feature triplet is shipped before chasing competitors' surface features. The Hebrew/RTL moat is the *defensive* asset; the Commitment-Ledger positioning is the *offensive* one. Together they form a coherent product story that survives both an Israeli-only outcome and an English-expansion outcome.

The doc is opinionated by design (per founder request) — recommended options are clearly named, alternatives are sketched. None of the gates assume success; each has an explicit stop signal. The biggest risk is not market or technology — it is solo-founder burnout, which is why time-budget discipline, quarterly off-weeks, and a mentor relationship are listed alongside the technical milestones.

### Top 5 decisions deferred

1. **Brand name.** Final selection during M3 brand sprint.
2. **Exact `Counterparty` taxonomy** (categories alongside departments).
3. **First integration target in M9** — bank-CSV vs. accountant-tool vs. ad-platform. Decide at M7 based on customer interviews.
4. **Whether to seek a co-founder / contractor in Y2.** Defer to M12 retrospective.
5. **Israeli legal entity structure** (עוסק פטור → עוסק מורשה → חברה). Defer to first accountant conversation in M3.

### Top 6 hypotheses to validate, not assume

1. SMB marketing teams will name "commitment / reserve tracking" as a real pain in unprompted interviews.
2. Israeli SMBs will pay ~₪149/mo for a marketing budget tool.
3. AI invoice ingest accuracy will be high enough to drive retention rather than support tickets.
4. The Hebrew/RTL moat is real enough to slow imitators to a usable lead time.
5. Solo / evenings-and-weekends is sustainable for 12 consecutive months without a co-founder.
6. **Auto-import accuracy** (PDF + bank-feed + AI categorize combined) is high enough to drive *expansion revenue* — customers upgrade tiers to get higher monthly ingest limits — rather than producing support tickets that erode margin.

Each hypothesis maps to specific gate criteria. None are taken on faith.

---

**End of design v1.** Next step on approval: invoke `superpowers:writing-plans` to produce a concrete implementation plan for **Phase 1 (M1–M3 Foundation)** only — the rest of the year is intentionally less detailed until Q1 outcomes are known.
