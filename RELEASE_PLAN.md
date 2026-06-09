# Bio-Sync Academy — Pre-Launch Plan
**Last Updated:** May 12, 2026

---

## What We Built

Bio-Sync Academy is a nursing pharmacology AI learning platform with:
- Drug Cards powered by openFDA (134,616 FDA products)
- MAIA — AI study assistant with free/pro tier
- Clinical Tools: DDI Checker, Dosing Helper, Cascade Graph
- Zo Space hosted at https://bio-sync-academy-crusius.zocomputer.io

---

## Current Tech Stack

| Feature | Implementation |
|---------|---------------|
| Frontend | React + Vite + Tailwind, hosted on Zo |
| Backend | Hono/Bun, same server (port 54104) |
| AI — Free | Ollama / Mistral (local, zero credits) |
| AI — Pro | Zo API MiniMax (~$0.002/message) |
| Drug Data | openFDA NDC API (free, no key) |
| Auth | Local JSON sessions |
| Payments | Stripe (not yet wired to UI) |
| OAuth | Google (not yet wired to UI) |

---

## Tier Structure

### Free Tier
- Ollama/Mistral (local CPU — no credits)
- All clinical tools (DDI, Dosing, Cascade)
- Full drug card directory (134,616 FDA products)
- Full conversation memory
- **Cost to you:** $0/month

### Pro Tier — $9.99/month
- Zo API MiniMax (faster, cloud-powered)
- Priority queue (when implemented)
- **Cost to you:** ~$2-4/month at light usage

---

## What's Done ✅

### Core Features
- [x] Drug Cards directory with search, expand/collapse, route/form filters
- [x] Drug card detail with all FDA label fields
- [x] FDA table markup rendering (Dosage & Administration, etc.)
- [x] Drug interaction tables formatted as HTML tables
- [x] Load more + Load all FDA entries
- [x] Drug name, NDC, form, route, brand name from directory
- [x] MAIA chat with conversation history (last ~20 messages)
- [x] Free tier = Ollama/Mistral (streaming)
- [x] Pro tier = Zo API MiniMax (streaming)
- [x] Model selector in chat UI (free/pro toggle)

### Clinical Tools
- [x] DDI Checker — openFDA interactions + Ollama reasoning
- [x] Dosing Helper — RxNorm drug lookup + Ollama reasoning
- [x] Cascade Graph — metabolism chain + Ollama reasoning
- [x] All three tools use Ollama in free tier, Zo in pro

---

## What Needs To Be Done Before Launch 🚨

### Critical — Do First

#### 1. Google OAuth (Login)
- **Status:** Not wired to UI
- **Where:** `/login` route serves Zo's auth page
- **What to do:**
  - Go to https://console.cloud.google.com
  - Create OAuth 2.0 Client ID
  - Add redirect URI: `https://bio-sync-academy-crusius.zocomputer.io/api/auth/google/callback`
  - Paste client ID + secret into Zo Settings → Secrets
- **Effort:** 15 minutes
- **Note:** Can use personal Google account now, migrate to business account later

#### 2. Stripe (Payments)
- **Status:** Not wired to UI
- **Where:** `/api/webhook/stripe` exists but no buy button in UI
- **What to do:**
  - Get Stripe API keys from https://dashboard.stripe.com
  - Paste keys into Zo Settings → Secrets
  - Create a $9.99/month Pro payment link in Stripe
  - Wire buy button to open Stripe payment link
- **Effort:** 30 minutes
- **Note:** Can use personal Stripe now, migrate to business account at $1K/mo

### Nice to Have — Do Before Spending Money on Marketing

- [ ] Improve MAIA prompt injection (nursing-specific system prompt)
- [ ] Implement request queue system for Ollama (manage concurrent load)
- [ ] Build a `/about` page
- [ ] Build a `/contact` page
- [ ] Add favicon and OG image
- [ ] Add meta tags for SEO
- [ ] Implement session persistence (currently local JSON, works but fragile)
- [ ] Rate limiting on API endpoints
- [ ] Analytics (page views, Pro conversions)

---

## Migration Plan (When to Move to Business Accounts)

| Milestone | Action |
|-----------|--------|
| Launch | Personal Google OAuth + Personal Stripe |
| $500/mo | Nothing changes |
| $1,000/mo | Create business Google Cloud account → new OAuth credentials → swap in Zo secrets |
| $1,000/mo | Create business Stripe account → recreate payment link → swap API keys in Zo |

**Migration is seamless** — the site and database don't change, only the credentials. Users keep their access.

---

## Ollama Load Testing

| Concurrency | Response Time |
|-------------|---------------|
| 1 user | 11.15s |
| 2 concurrent | 13.43s each |
| 3 concurrent | 18.19s each |

At 3 concurrent users, Ollama is at ~60% CPU on 4 cores. A queue system would help manage spikes.

---

## OpenFDA Drug Data Coverage

- 134,616 total FDA NDC products
- Good coverage for prescription drugs (warfarin, morphine, metformin, lisinopril)
- OTC drugs have Drug Facts sections (acetaminophen, ibuprofen)
- Controlled substances (Krokodil/desomorphine): NOT in openFDA — no合法 pharmaceutical source exists for this
- Illicit/非处方 drugs won't appear in any legitimate drug API

---

## Credit Costs (Zo Pro Tier)

- MiniMax M2.7: ~$0.002/message
- GPT-5.4-mini: ~$0.003/message
- 1 user, 50 messages/day for 30 days = $3/month
- 10 Pro users, 50 messages/day = $30/month
- 100 Pro users, 50 messages/day = $300/month

At $9.99/user/month, you profit at every level.

---

## Pricing Summary

| Tier | Price | AI | Tools | Drug Data |
|------|-------|-----|-------|-----------|
| Free | $0 | Ollama/Mistral (local) | 3 tools | All FDA |
| Pro | $9.99/mo | MiniMax (Zo) | 3 tools + priority | All FDA |

---

## Files

- `/home/workspace/bio-sync-academy/` — main project
- `/home/workspace/bio-sync-academy/server.ts` — API routes
- `/home/workspace/bio-sync-academy/src/pages/DrugCards.tsx` — drug directory UI
- `/home/workspace/bio-sync-academy/src/pages/ClinicalTools.tsx` — DDI/Dosing/Cascade
- `/home/workspace/bio-sync-academy/src/components/EducatorChat.tsx` — MAIA chat
- `/home/workspace/bio-sync-academy/scripts/build-drug-index.py` — FDA index builder
- `/home/workspace/scripts/run-ollama.sh` — Ollama startup script
- Zo service: `bio-sync-academy` (port 54104)
- Ollama service: `ollama` (localhost:11434)