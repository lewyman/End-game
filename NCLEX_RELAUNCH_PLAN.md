# Bio-Sync Academy NCLEX Relaunch Plan

## Strategic Summary

**Lead with NCLEX, monetize with MAIA.** Replace the current dark, confusing NCLEX generator (buried inside Clinical Tools) with a dedicated, free-to-use question bank that's instant and unlimited. MAIA becomes a contextual premium layer — not a nav item, but a floating AI tutor accessible everywhere.

**Core insight:** Nursing students search "NCLEX practice questions" — not "nursing AI tutor." Give them what they want for free. Monetize the premium: deeper explanations, fresh AI questions, and unlimited pathways.

---

## Architecture Changes

### Navigation Restructure (6 items)
```
NCLEX Practice    ← Lead attraction, free question bank, instant
Pathways          ← Linear Duolingo courses, sticky retention
Clinical Reference ← Tools (DDI, Dosing, Cascade, Decision) + Procedures library
Drug Cards        ← FDA drug search, redesigned for usability
Learn & Community ← Blog (SEO) + Community forum (future engagement)
Pricing           ← Plan comparison
```

### MAIA: Nowhere in Nav, Everywhere in Product
- **Floating bubble** — bottom-right corner on every page. Slide-out chat panel. Like Intercom/help widget.
- **Contextual in NCLEX** — "Explain this deeper with MAIA" button after each question. Feeds question + answer + rationale as context.
- **Contextual in Pathways** — "Stuck? Ask MAIA" on any step. Gets current lesson content as context.
- **Dedicated `/maia` page** — full tutoring sessions. Not in main nav. Linked from floating panel + account CTAs.
- **Pro gate** — free users get 3 MAIA explanations/day across all contexts. Pro gets unlimited.

### Homepage
- **Signed-out:** "Unlimited Free NCLEX Practice" hero → topic input → instant bank question → after 5 questions, soft gate "Create free account to track progress"
- **Signed-in:** Redirect to `/nclex` as default view
- Social proof stats, 3-step how-it-works

---

## Phase 0: Refactor for Maintainability (FOUNDATION)

**Why:** The current codebase has "first-draft" problems that make every change risky:
- `ClinicalTools.tsx` is 836 lines with 6 tools + NCLEX all in one file
- `server.ts` is massive — auth, billing, AI, pathways, clinical, drugs all in one file
- No shared hooks, no extracted API layer, hardcoded theme values scattered everywhere
- Every AI edit risks breaking 3 unrelated things

**Principle:** Each file does one thing, stays under ~300 lines, follows the same structure as its siblings.

### 0A. Server Refactor (no visual changes)

Split `server.ts` into route modules that each export a Hono router:

```
server/
├── index.ts                     ← main Hono app, mounts route modules
├── routes/
│   ├── auth.ts                  ← Google OAuth + session
│   ├── nclex.ts                 ← NCLEX question gen + attempts
│   ├── drugs.ts                 ← drug directory + drug cards
│   ├── clinical.ts              ← DDI, dosing, cascade, decision
│   ├── tools.ts                 ← generated tool CRUD
│   ├── pathways.ts              ← pathway CRUD + player
│   ├── procedures.ts            ← procedures library
│   ├── files.ts                 ← file upload + manage
│   ├── billing.ts               ← Stripe checkout + webhook + sync
│   ├── admin.ts                 ← admin dashboard + review
│   ├── community.ts             ← community forum
│   ├── blog.ts                  ← blog serving
│   └── educator.ts              ← MAIA chat endpoint
├── lib/
│   ├── maia.ts                  ← MAIA prompt + Zo Ask helper
│   ├── nclex-bank.ts            ← question bank read/write/serve (NEW)
│   ├── auth-helpers.ts          ← getCurrentUser, authorizeAi, tier helpers
│   ├── openfda.ts               ← FDA API calls
│   └── storage.ts               ← JSON file read/write/ensureDir helpers
└── middleware/
    └── usage-tracking.ts        ← rate limiting + daily quotas
```

**Pattern for route modules:**
```ts
// server/routes/nclex.ts
import { Hono } from "hono";
const app = new Hono();

app.post("/api/nclex/attempts", async (c) => { ... });
app.get("/api/nclex/attempts", async (c) => { ... });

export default app;
```

**Pattern for mounting in index.ts:**
```ts
import nclexRoutes from "./routes/nclex";
app.route("/", nclexRoutes);
```

### 0B. Frontend Architecture Cleanup

```
src/
├── components/
│   ├── layout/
│   │   ├── NavBar.tsx           ← extracted from App.tsx
│   │   ├── MobileNav.tsx        ← extracted from App.tsx
│   │   └── MaiaFloatingBubble.tsx  ← NEW, bottom-right floating chat
│   ├── nclex/
│   │   ├── QuestionCard.tsx     ← question + options + submit
│   │   ├── OptionButton.tsx     ← single answer option
│   │   ├── DifficultySelector.tsx
│   │   ├── ProgressPanel.tsx    ← right/wrong/score sidebar
│   │   └── QuestionHistory.tsx  ← previous questions scrollable list
│   ├── clinical/
│   │   ├── DdiChecker.tsx       ← extracted from ClinicalTools
│   │   ├── DosingHelper.tsx     ← extracted from ClinicalTools
│   │   ├── CascadeGraph.tsx     ← extracted from ClinicalTools
│   │   ├── DecisionTool.tsx     ← extracted from ClinicalTools
│   │   ├── ToolBuilder.tsx      ← extracted from ClinicalTools
│   │   └── GeneratedToolRenderer.tsx
│   ├── drug-cards/
│   │   ├── DrugDirectory.tsx    ← sidebar search list
│   │   ├── DrugCardMain.tsx     ← main card content
│   │   ├── SectionRenderer.tsx  ← FDA section accordion/display
│   │   └── QuickFacts.tsx       ← NEW, at-a-glance summary card
│   ├── ui/                      ← keep existing shadcn components
│   ├── EducatorChat.tsx         ← existing, keep
│   ├── AuthGate.tsx             ← existing, keep
│   └── theme-provider.tsx       ← existing, keep
├── pages/
│   ├── NclexPage.tsx            ← NEW, dedicated NCLEX page (lead feature)
│   ├── ClinicalReference.tsx    ← NEW, tools + procedures hub
│   ├── DrugCardsPage.tsx        ← slim wrapper around DrugCard components
│   ├── LearnPage.tsx            ← NEW, blog + community hub
│   ├── Pathways.tsx             ← existing
│   ├── PathwayPlayer.tsx        ← existing
│   ├── Procedures.tsx           ← existing
│   ├── BlogList.tsx             ← existing
│   ├── Community.tsx            ← existing
│   ├── MaiaPage.tsx             ← NEW, full MAIA chat (linked, not in nav)
│   ├── Pricing.tsx              ← existing
│   ├── Account.tsx              ← existing
│   └── Home.tsx                 ← slimmed down landing page
├── hooks/
│   ├── useNclexSession.ts       ← NCLEX state machine (NEW)
│   ├── useDrugCard.ts           ← drug card fetch + filter logic
│   ├── useClinicalTool.ts       ← generic tool runner
│   └── useScrollSpy.ts          ← for Drug Cards sidebar nav (NEW)
├── lib/
│   ├── api.ts                   ← ALL fetch calls centralized (NEW)
│   ├── auth.tsx                 ← existing, keep
│   ├── utils.ts                 ← existing, keep
│   └── nclex.ts                 ← NCLEX client helpers (NEW)
└── styles/
    └── theme.ts                 ← theme tokens exported as object (NEW)
```

**The AI-friendly pattern for every feature:**
1. **Hook** in `hooks/useX.ts` — owns all state, calls `lib/api.ts` for fetches, returns data + actions
2. **Components** in `components/x/` — pure UI, receive props from the hook, zero API calls
3. **Page** in `pages/XPage.tsx` — thin wrapper: calls hook, passes to components
4. **Route module** in `server/routes/x.ts` — all related endpoints, exported as Hono router

**Why this matters for AI maintenance:**
- "Fix the difficulty selector" → open one 40-line component, not an 836-line file
- Server routes are isolated — changing billing never touches NCLEX
- Adding a new clinical tool follows the same pattern as existing ones
- The centralized API layer (`lib/api.ts`) means changing an endpoint requires one edit
- Every component file is under 300 lines — fits in a single AI read without pagination

---

## Phase 1: NCLEX Generator + Question Bank (PRIORITY)

### 1A. Question Bank Infrastructure

**Data model:**
```
data/nclex-bank/
├── pharmacology.json       (~150 questions)
├── med-surg.json            (~150 questions)
├── fundamentals.json        (~100 questions)
├── maternal-child.json      (~100 questions)
├── mental-health.json       (~100 questions)
├── pediatrics.json          (~100 questions)
├── prioritization.json      (~100 questions)
├── index.json              (topic → file mappings, total counts, lastGenerated)
├── ratings.json            (per-question thumbs up/down, quality scores)
└── served.json             (per-question serve counts, last served date)
```

**Question schema:**
```json
{
  "id": "nclex_pharm_001",
  "type": "mcq",
  "topic": "Beta-Blockers",
  "difficulty": "medium",
  "categories": ["Pharmacological Therapy", "Physiological Integrity"],
  "bodySystems": ["Cardiovascular"],
  "stem": "A nurse is caring for a patient receiving metoprolol...",
  "options": [
    {"id": "A", "text": "Check apical pulse for 1 full minute"},
    {"id": "B", "text": "Administer with a full glass of milk"},
    {"id": "C", "text": "Monitor blood glucose every 4 hours"},
    {"id": "D", "text": "Position patient in Trendelenburg"}
  ],
  "correctAnswers": ["A"],
  "rationale": "Beta-blockers can cause bradycardia...",
  "optionRationales": {
    "A": "Correct. Beta-blockers decrease heart rate...",
    "B": "Incorrect. Metoprolol absorption is not affected...",
    "C": "Incorrect. While beta-blockers can mask hypoglycemia...",
    "D": "Incorrect. Trendelenburg is not indicated..."
  },
  "quality": 0.85,
  "timesServed": 12,
  "timesRatedUp": 9,
  "timesRatedDown": 3,
  "generatedAt": "2026-06-09T00:00:00Z",
  "lastServedAt": "2026-06-09T12:00:00Z"
}
```

**API endpoints:**
- `GET /api/nclex/question?topic=X&difficulty=Y` — serve from bank (instant)
- `GET /api/nclex/bank/stats` — total questions, by category, quality scores
- `POST /api/nclex/question/generate` — Pro-only fresh AI question (uses existing Gemini pipeline)
- `POST /api/nclex/question/rate` — `{ questionId, rating: "up"|"down" }`
- `POST /api/nclex/bank/generate` — admin batch generation endpoint
- `GET /api/nclex/attempts` — existing, keep as-is
- `POST /api/nclex/attempts` — existing, keep as-is

**Serving logic:**
1. User requests question by topic + difficulty
2. Query bank for matching questions, sorted by least recently served to this user
3. Filter out questions the user has already seen in this session (tracked client-side + server-side)
4. If no bank match, fall back to AI generation (free tier) or prompt for topic refinement
5. After serving, increment `timesServed` and update `lastServedAt`

### 1B. Batch Generate Initial Bank (500-800 questions)

Script at `scripts/generate-nclex-bank.ts`:
- Hit Zo Ask API 10-15 times in parallel per category
- Each prompt requests 5-10 questions in a batch
- Parse, validate, sanitize, deduplicate
- Write to `data/nclex-bank/*.json`
- Generate 50-100 per category → 500-800 total
- Estimated cost: ~$15-25 in AI credits for initial bank

### 1C. New NCLEX Page (`/nclex`)

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│  NCLEX Practice  [Easy] [Medium] [Hard]  [⏱ Timed]  │
│  Topic: _________________________  [New Question]     │
├──────────────────────┬─────────────────────────────────┤
│                      │                                 │
│   QUESTION AREA     │   PROGRESS PANEL               │
│   (main card)       │   ✅ 42  ❌ 18  📊 70%         │
│                      │   [Reset] [Share]               │
│   Options A-D       │                                 │
│                      │   PREVIOUS QUESTIONS            │
│   [Submit Answer]   │   ├─ Beta-Blockers ✅           │
│                      │   ├─ Insulin Safety ❌         │
│   Rationale area    │   ├─ Digoxin Toxicity ✅        │
│   (after submit)    │   └─ ACE Inhibitors ✅          │
│                      │                                 │
│   [Explain deeper   │   SESSION STATS                 │
│    with MAIA →]     │   By topic breakdown            │
│                      │                                 │
├──────────────────────┴─────────────────────────────────┤
│  💡 How it works: Pick topic → Answer → Learn → Repeat │
└────────────────────────────────────────────────────────┘
```

**Features:**
- Difficulty selector: Easy / Medium / Hard (visible, works)
- Timed mode toggle: 60s countdown per question (Pro Plus+)
- Tutor mode toggle: detailed option rationales after submit (Pro Plus+)
- Body system + NCLEX category filters (Max tier)
- Progress panel: right/wrong count, percentage, session topic breakdown
- Previous questions sidebar: scrollable, shows Q stem + correct/incorrect + rationale on click
- Thumbs up/down on each question after answering
- Sessions auto-save to `/api/nclex/attempts`
- Clear "Reset Session" button with confirmation
- Share score button (copy/social)

**Free vs Pro:**
| Feature | Free | Pro |
|---------|------|-----|
| Bank questions | Unlimited | Unlimited |
| Fresh AI questions | 0/day | 10/day |
| MAIA explanations | 3/day | Unlimited |
| Difficulty selector | ✅ | ✅ |
| Tutor mode | ❌ | ✅ |
| Timed mode | ❌ | ✅ |
| Body system filters | ❌ | ❌ (Max) |
| NCLEX category filters | ❌ | ❌ (Max) |

### 1D. Anti-Contradiction System

Send last 3 question topic+stem pairs as context to AI when generating:
```json
{
  "previousQuestions": [
    "Topic: Beta-Blockers | Q: A nurse is administering metoprolol...",
    "Topic: Insulin | Q: Which insulin has the most rapid onset..."
  ]
}
```
The prompt instructs: "Do not generate a question that contradicts information in the previous questions."

### 1E. Onboarding Overlay

First visit to `/nclex` shows a 3-step tooltip overlay:
1. "Pick a topic or keep 'comprehensive'" → highlights topic input
2. "Read the question and select your answer" → highlights question card
3. "Review the rationale and keep practicing" → highlights rationale area
"Dismiss" button. Shown once, stored in localStorage.

---

## Phase 2: Clinical Reference (Tools + Procedures)

### 2A. New Route: `/clinical-reference`

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│  Clinical Reference                                    │
│                                                        │
│  [🔧 Tools] [📋 Procedures]                            │
│                                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │   DDI   │ │ Dosing  │ │Cascade  │ │Decision │    │
│  │ Checker │ │ Helper  │ │ Graph   │ │  Tool   │    │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│                                                        │
│  ┌─────────┐                                           │
│  │  AI Tool │  [Generated tools grid]                  │
│  │ Builder  │                                          │
│  └─────────┘                                           │
└────────────────────────────────────────────────────────┘
```

### 2B. Fixes Needed
- **FDA search failure:** Likely openFDA API change or rate limit. Add error handling + retry + fallback messaging.
- **Text editing lock in AI Tool Builder:** Add "Edit" button on generated tools that opens the modify panel pre-filled with the current description. Currently overwrites; instead, make it truly additive.
- **Tool generation failure:** Add logging, error propagation, and user-friendly messages.

### 2C. Procedures Library
- Keep existing routes: `/procedures` and `/procedures/:id`
- Add a redirect from `/procedures` → `/clinical-reference?tab=procedures` or keep standalone
- Ensure search + category filtering works
- Already well-implemented, just needs the nav grouping

---

## Phase 3: Drug Cards Redesign

### Current Issues
- Massive accordion list of FDA sections — hard to scan
- No way to quickly find specific information
- Dark theme makes tables hard to read
- Route/form filtering is confusing
- Overall "terrible for usability"

### Redesign
**Layout:**
```
┌────────────────────┬──────────────────────────────────┐
│ DRUG DIRECTORY     │  DRUG CARD: Metoprolol           │
│ (searchable list) │                                    │
│                    │  ┌──────────────────────────────┐ │
│ 🔍 Search...      │  │ Quick Facts                   │ │
│                    │  │ Generic | Brand | Class        │ │
│ ├─ Metformin      │  │ Route | Form | Pregnancy Cat  │ │
│ ├─ Metoprolol ✓  │  └──────────────────────────────┘ │
│ ├─ Midazolam      │                                    │
│ └─ ...            │  SIDEBAR NAV (scrollspy)          │
│                    │  ├─ Indications & Usage           │
│                    │  ├─ Dosage & Administration       │
│                    │  ├─ Contraindications             │
│                    │  ├─ Boxed Warning ⚠              │
│                    │  ├─ Adverse Reactions             │
│                    │  ├─ Drug Interactions             │
│                    │  ├─ Mechanism of Action           │
│                    │  ├─ Pregnancy                     │
│                    │  └─ Nursing Considerations (NEW)  │
│                    │                                    │
│                    │  [View Full FDA Label ↗]         │
│                    │  [Ask MAIA about this drug →]    │
└────────────────────┴──────────────────────────────────┘
```

**Key changes:**
- Replace accordion lists with scrollspy sidebar — click jumps to section
- Add "Quick Facts" card at top — key info at a glance
- Add "Nursing Considerations" as an AI-generated section (cached, generated on first view)
- Tables rendered inline (not hidden behind "Expand to view")
- Lighter background for table rows to improve contrast
- Route/form filters as chips at top of card, not buried in sidebar

---

## Phase 4: Learn & Community (Blog + Forum)

### 4A. New Route: `/learn`

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│  Learn & Community                                     │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │  📚 Study Guides                                  │ │
│  │  [Beta-Blockers] [Diuretics] [ACE Inhibitors]    │ │
│  │  [Anticoagulants] [Insulin] [Drug Calculations]  │ │
│  │  [View all guides →]                             │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │  💬 Nursing Community                             │ │
│  │  Join discussions with fellow nursing students    │ │
│  │  [Browse Discussions →]                          │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### 4B. Blog
- Existing blog posts are good content — keep them
- Add category pages (Pharmacology, Med-Surg, NCLEX Tips, etc.)
- Add related posts at bottom of each article
- Add "Ask MAIA about this topic" CTA at end of each post

### 4C. Community
- Keep existing Community component but hide it behind blog prominence
- As user base grows, add pinned threads, weekly NCLEX question discussions
- Link from blog posts: "Discuss this topic in the community →"

---

## Phase 5: Quality of Life + Polish

### 5A. Theme Lightening
Current: `#080810` background, low-contrast text
→ `#0a0a18` background, bump foreground contrast, lighter muted text
- `--background`: `oklch(0.12 0.02 260)` → `oklch(0.15 0.02 260)`
- `--card`: `oklch(0.15 0.02 260)` → `oklch(0.18 0.02 260)`
- `--muted-foreground`: `oklch(0.62 0.03 240)` → `oklch(0.70 0.03 240)`
- `--border`: `oklch(0.28 0.03 260)` → `oklch(0.35 0.03 260)`

### 5B. Multi-File Upload
- Change `<input>` from single to `multiple`
- Batch upload sequentially with progress indicator
- Show "Uploading 3 of 5..." with progress bar

### 5C. Floating MAIA Bubble
- Create `src/components/MaiaFloatingBubble.tsx`
- Position: fixed bottom-right, z-50
- Click opens slide-out panel (400px wide, full height, animate in from right)
- Panel contains `EducatorChat` component with context from current page
- If on NCLEX page: passes current question context
- If on Pathways page: passes current lesson context
- Pro gate: 3 free explanations/day, then upgrade prompt

### 5D. Routing Cleanup
- Add to `App.tsx`:
  - `/nclex` → new NCLEX page
  - `/clinical-reference` → new combined Clinical Reference page
  - `/learn` → new Learn & Community hub
  - `/maia` → full MAIA chat page
- Remove from nav: MAIA as standalone, separate Clinical Tools tabs
- Keep existing routes working (redirect old paths to new ones)

---

## Implementation Order

1. **Phase 0A: Server Refactor** — split server.ts into route modules (safest first, no visuals change)
2. **Phase 0B: Frontend Architecture** — extract hooks, API layer, NavBar, theme tokens
3. **Phase 1A-1C: Question Bank + NCLEX Page** — infrastructure + new `/nclex` page
4. **Phase 1D: Batch Generate Bank** — run generation script to populate 500-800 questions
5. **Phase 1E: Onboarding + Anti-Contradiction** — polish NCLEX UX
6. **Phase 2: Clinical Reference** — group tools + procedures under `/clinical-reference`
7. **Phase 3: Drug Cards Redesign** — new scrollspy layout
8. **Phase 4: Learn & Community** — blog + forum hub under `/learn`
9. **Phase 5C: Floating MAIA Bubble** — contextual everywhere
10. **Phase 5A-5B: Theme + Multi-upload + Polish** — visual cleanup + file upload improvements

---

## Cost Estimate

| Item | Cost |
|------|------|
| Initial question bank generation (800 Qs) | ~$20-30 AI credits |
| Monthly bank refresh (100-200 new Qs) | ~$5-10 AI credits |
| Free user serving bank questions | $0 (reads from disk) |
| Pro user fresh AI questions | ~$0.02/question |
| MAIA explanations (Pro) | ~$0.01-0.03/explanation |
| **Net:** Platform becomes cheaper to run while offering more to free users |

---

## Success Metrics

- Free users answering 50+ NCLEX questions per session (currently impossible)
- Question load time < 100ms (currently 2-5s with AI generation)
- MAIA upsell rate from NCLEX explain button
- New signup conversion from free question bank
- Reduced churn from pathways users (sticky content)
