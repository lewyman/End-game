This file provides guidance when working with code in this repository. The README.md should ALWAYS serve as an accurate, comprehensive piece of documentation for this project. It should describe the broader goals and purpose of this repository along with the technical implementation details. If any aspect of the project changes, the README.md should be updated to reflect that.

# Project Notes

<!-- Documentation for this specific project goes here. This will include both an articulation of what this project aims to accomplish as well as technical details about how it works. This means explaining the purpose of the project as a whole along with an overview of the design choices. -->

---

# Documentation

This is a **Zo Site** - a web application running on a user's Zo computer that combines:
- **Backend**: Bun + Hono server with API routes
- **Frontend**: React + Vite with client-side routing, shadcn/ui components, and Tailwind CSS 4
- **Single Process**: Vite runs in middleware mode (no separate dev server)

## Architecture

### File Structure

```
.
├── server.ts              # Main server (Hono + Vite middleware)
├── index.html             # HTML entry point for React
├── vite.config.ts         # Vite configuration
├── package.json           # Dependencies and scripts
├── zosite.json            # Zo deployment config (ports, env vars)
├── public/                # Static assets (images, fonts, favicon)
│   ├── favicon.svg        # Site favicon (replace with your own)
│   └── images/
│       └── pegasus.png    # Example image (loaded via <img src="/images/pegasus.png">)
├── backend-lib/
│   └── zo-api.ts         # Helper for calling Zo API
└── src/
    ├── main.tsx          # React entry point
    ├── App.tsx           # Router setup
    ├── styles.css        # Global styles
    └── pages/            # Page components
```

### Development vs Production

**Development Mode** (`bun run dev`):
- Single Bun process running `server.ts`
- Vite in middleware mode transforms files on-the-fly
- API routes: `/api/*` handled by Hono
- React app: served via Vite transforms (HMR disabled, use `bun --hot` for server restart)
- Client-side routing: any non-API, non-file route falls back to `index.html`
- **Environment**: Site runs at an internal authenticated URL accessible only to you (private site on your Zo computer)

**Production Mode** (`bun run prod`):
- Builds React app to `dist/` using Vite
- Bun serves static files from `dist/` via `hono/bun` serveStatic
- API routes still handled by Hono
- SPA fallback: all non-API routes serve `dist/index.html`
- **Environment**: Site is published and accessible to anyone on the internet at a public URL

NEVER use the scripts `bun run dev` or `bun run prod`. The Zo system handles running the site in the correct mode based on context. All process management of the server is handled by Zo. Never restart or stop the server manually.

## Viewing, Verification, and Debugging (agent-browser)

The `agent-browser` CLI tool lets you preview, navigate, and debug the site running at `http://localhost:$PORT` (PORT is set by Zo). Use it to verify UI changes, debug routing, or capture screenshots.

Core workflow:
1. Navigate to the site:
   ```bash
   agent-browser open http://localhost:$PORT
   ```
2. Snapshot the page to get interactive element refs:
   ```bash
   agent-browser snapshot -i
   ```
3. Interact with elements:
   ```bash
   agent-browser click @e1
   agent-browser fill @e2 "text"
   agent-browser hover @e3
   agent-browser get text @e1
   ```
4. Re-snapshot after page changes to get updated refs.

Taking screenshots:
```bash
agent-browser screenshot
agent-browser screenshot --full-page
agent-browser screenshot --filename debug.png
```

For the full list of commands and options, run:
```bash
agent-browser --help
```

Note: Do not tell the user to visit localhost; they already have access via the Zo preview iframe.

## Key Technologies

### ⚠️ IMPORTANT: This is BUN + HONO (NOT Node.js + Express)

This application uses:
- **Bun** as the runtime (NOT Node.js)
- **Hono** as the web framework (NOT Express)

Do not use Express patterns. Use Hono equivalents. For file system operations, see the section below.

### Bun Runtime
- JavaScript runtime (NOT Node.js or Deno)
- Use `bun add <package>` to install dependencies
- Built-in TypeScript support
- Built-in SQLite via `import { Database } from "bun:sqlite"`
- Process spawning: `Bun.spawn()` for running commands

### File System Operations

Bun has native APIs for file I/O but uses Node.js APIs for directory operations. Use the correct API for each operation:

| Operation | API | Example |
|-----------|-----|---------|
| Read file | `Bun.file()` | `await Bun.file("data.json").text()` |
| Write file | `Bun.write()` | `await Bun.write("out.txt", content)` |
| File exists | `Bun.file().exists()` | `await Bun.file("x.txt").exists()` |
| Read directory | `node:fs/promises` | `await readdir("./posts")` |
| Create directory | `node:fs/promises` | `await mkdir("dir", { recursive: true })` |
| Glob files | `Bun Glob` | `new Glob("**/*.md").scan(".")` |

**⚠️ Common Mistakes to Avoid:**

```ts
// ❌ WRONG - These do NOT exist:
Bun.readdir()        // No such API
Bun.readdirSync()    // No such API
Bun.mkdir()          // No such API
fs.readFileSync()    // Works but slower than Bun.file()

// ✅ CORRECT patterns:
import { readdir, mkdir } from "node:fs/promises";

// Reading a file
const content = await Bun.file("config.json").json();

// Writing a file
await Bun.write("output.txt", "Hello");

// Listing directory contents
const files = await readdir("./posts");

// Creating a directory
await mkdir("./uploads", { recursive: true });

// Finding files by pattern
import { Glob } from "bun";
const glob = new Glob("**/*.md");
for await (const file of glob.scan("./posts")) {
  console.log(file);
}
```

### Hono Framework
- Lightweight web framework designed for Bun
- Documentation: https://honojs.dev/llms-small.txt
- Import from `hono` for core, `hono/bun` for Bun-specific features like `serveStatic`

**Serving Static Files (Bun-specific):**

```ts
import { serveStatic } from 'hono/bun'

app.use('/static/*', serveStatic({ root: './' }))
app.use('/favicon.ico', serveStatic({ path: './favicon.ico' }))
app.get('*', serveStatic({ path: './static/fallback.txt' }))

// You can reach outside the project root to files in the user's workspace
app.get('/workspace-file', serveStatic({ path: '../some/dir/file.txt' }))
app.get('/absolute-file', serveStatic({ path: '/home/user/file.txt' }))

// Custom MIME types
app.get('/media/*', serveStatic({
  mimes: {
    m3u8: 'application/vnd.apple.mpegurl',
    ts: 'video/mp2t',
  },
}))
```

**Hono Routing:**

```ts
// REST API endpoints
app.get('/', (c) => c.json({ items: [] }))
app.post('/', (c) => c.json({ created: true }, 201))
app.get('/:id', (c) => c.json({ id: c.req.param('id') }))

// Middleware
import { basicAuth } from 'hono/basic-auth'
app.use('/admin/*', basicAuth({ username: 'admin', password: 'secret' }))

// Multiple middlewares are processed in order
app.use(logger())
app.use('/posts/*', cors())
app.post('/posts/*', basicAuth())
```

### React + Vite
- React for UI components
- Vite handles bundling and transforms
- Dependencies installed via `bun add` (NOT CDN imports) - all packages bundled by Vite
- React Router for client-side routing
- **Styling**: Tailwind CSS 4 configured with `@tailwindcss/vite` plugin
- **UI Components**: shadcn/ui already set up and configured - components can be added via `bunx shadcn@latest add <component-name>`
- **Icons**: Lucide React icons included and ready to use

## Common Tasks

### Adding API Routes

Add routes in `server.ts` before the Vite middleware:

```ts
app.get("/api/example", async (c) => {
  return c.json({ data: "example" });
});
```

### Adding React Components

Create components in `src/`:

```tsx
// src/components/MyComponent.tsx
import React from "react";

export default function MyComponent() {
  return <div>Hello</div>;
}
```

Add routes in `src/App.tsx`:

```tsx
import MyPage from "./pages/MyPage";

<Routes>
  <Route path="/my-page" element={<MyPage />} />
</Routes>
```

### Calling Zo API from Backend

Use the helper in `backend-lib/zo-api.ts`:

```ts
import { callZo } from "./backend-lib/zo-api";

app.post("/api/ask-zo", async (c) => {
  const { question } = await c.req.json();

  const result = await callZo(question, {
    outputFormat: {
      type: "object",
      properties: { answer: { type: "string" } },
      required: ["answer"]
    }
  });

  return c.json(result);
});
```

### Static Assets

There are two ways to include static assets like images, fonts, or JSON data:

#### Option 1: The `public/` Folder (Recommended for Most Cases)

Place files in the `public/` directory. They're served at the root URL path and work identically in dev and production.

```
public/
├── favicon.svg
├── images/
│   ├── logo.png
│   └── hero.jpg
├── fonts/
│   └── custom.woff2
└── og-image.jpg
```

Reference them with absolute paths:

```tsx
<img src="/images/logo.png" alt="Logo" />
<link rel="icon" href="/favicon.svg" />
```

In production, Vite copies the `public/` folder contents to `dist/` automatically.

**Use `public/` for**: favicons, Open Graph images, downloadable files, fonts, any asset that needs a stable/predictable URL.

#### Option 2: Import in Components (Bundled Assets)

Import assets directly in your React components. Vite handles bundling, optimization, and cache-busting via content hashes.

```tsx
// Images
import heroImage from '@/assets/hero.png';

function Hero() {
  return <img src={heroImage} alt="Hero" />;
}

// JSON data
import config from '@/data/config.json';

function Settings() {
  return <div>App version: {config.version}</div>;
}

// SVG as component (with ?react suffix)
import Logo from '@/assets/logo.svg?react';

function Header() {
  return <Logo className="h-8 w-8" />;
}
```

Place imported assets in `src/assets/` or alongside components:

```
src/
├── assets/
│   ├── hero.png
│   └── logo.svg
├── data/
│   └── config.json
└── components/
    └── Header.tsx
```

**Use imports for**: component-specific images, icons used in JSX, JSON configuration, any asset that benefits from bundling/tree-shaking.

#### Serving Files from the Workspace

For files outside the project (e.g., user's workspace files), create an API route:

```ts
app.get("/myfile", async (c) => {
  const file = Bun.file("/path/to/file");
  return new Response(file);
});
```

### Database

This application is database-agnostic and doesn't include a database by default. For most use cases, SQLite is recommended.

**Using Bun's Built-in SQLite:**

```ts
import { Database } from "bun:sqlite";

// Create/open database
const db = new Database("mydb.sqlite");

// Create table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  )
`);

// Insert data
const insert = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
insert.run("John Doe", "john@example.com");

// Query data
const query = db.query("SELECT * FROM users WHERE name = ?");
const users = query.all("John Doe");

// Close when done
db.close();
```

**In a Hono route:**

```ts
app.get("/api/users", (c) => {
  const db = new Database("mydb.sqlite");
  const users = db.query("SELECT * FROM users").all();
  db.close();
  return c.json({ users });
});

app.post("/api/users", async (c) => {
  const { name, email } = await c.req.json();
  const db = new Database("mydb.sqlite");

  try {
    const insert = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
    insert.run(name, email);
    db.close();
    return c.json({ success: true }, 201);
  } catch (error) {
    db.close();
    return c.json({ error: "Failed to create user" }, 400);
  }
});
```

## Scripts

- `bunx tsc --noEmit` - Type check

## Important Notes

### Server-Side vs Client-Side

- **Server code**: `server.ts`, `backend-lib/` - runs on Bun
- **Client code**: `src/` - runs in browser, bundled by Vite
- Install ALL dependencies via `bun add` (React, etc.) - Vite bundles them

### Environment Variables

- `NODE_ENV=production` switches to production mode
- `ZO_CLIENT_IDENTITY_TOKEN` required for calling Zo API
- Access server vars via `process.env.VAR_NAME` in server code
- Access client vars prefixed with `VITE_` via `import.meta.env.VITE_VAR_NAME` in React code

### File System Access

The server runs on the user's Zo computer and can:
- Read/write any file on the system
- Execute commands via `Bun.spawn()`
- Access local databases

### Configuration

`zosite.json` defines:
```json
{
  "name": "My Site",
  "local_port": 12345,
  "entrypoint": "bun run dev",
  "publish": {
    "label": "My Site",
    "type": "http",
    "entrypoint": "bun run prod",
    "published_port": 12346,
    "env": {
      "NODE_ENV": "production",
      "ZO_CLIENT_IDENTITY_TOKEN": "none"
    }
  }
}
```

- Top-level `env`: Environment variables for **development mode**
- `publish.env`: Environment variables for **production mode**
- Variables prefixed with `VITE_` are exposed to client-side code via Vite
- `PORT` environment variable is automatically set to match `local_port` (or `published_port` in production)

### ⚠️ IMPORTANT: Do Not Edit `zosite.json` System Fields

**The `zosite.json` file is auto-generated by Zo. Most fields should not be manually edited.**

- `local_port` and `published_port` are assigned by the system when the site is created
- Ports are chosen using a hash-based algorithm to avoid conflicts
- The Zo system manages process lifecycle, tunneling, and URL routing based on these ports
- Editing ports or entrypoints will break the site's preview URL and publish functionality

**Safe to edit:**
- `name` - The display name for the site
- `env` and `publish.env` - Add or modify environment variables as needed

**Never edit:**
- `local_port`, `published_port` - System-assigned ports
- `entrypoint`, `publish.entrypoint` - Managed startup commands
- `label`, `type` - Service configuration

**Private vs Public Access:**
- **Private (default)**: Sites run in dev mode behind authentication. Only you can access them via the preview iframe in Zo. This is the normal development experience.
- **Public (published)**: Publishing creates a shareable URL that anyone on the internet can access without authentication.

To publish your site publicly, use the **Publish button** in the Zo UI or explicitly ask Zo to publish it (e.g., "publish this site", "make it public").

## Deployment

The site exports `{ fetch, port }` from `server.ts` for Zo's deployment system. The same code runs in both dev and production - mode is controlled by `NODE_ENV`.

## Authentication

Bio-Sync Academy uses a Zo-hosted Google OAuth flow, not Clerk or Supabase auth.

- Frontend login page: `/login`
- OAuth start endpoint: `/api/auth/google`
- OAuth callback endpoint: `/api/auth/google/callback`
- Session storage: signed, HttpOnly `biosync_session` cookie created by `server.ts`
- Current-user endpoint: `/api/auth/me`
- Logout endpoint: `/api/auth/logout`

Required Zo service secrets:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- Optional: `BIOSYNC_AUTH_SECRET` for stable session signing across service restarts

Google OAuth Authorized redirect URI:

```text
https://bio-sync-academy-crusius.zocomputer.io/api/auth/google/callback
```

# Bio-Sync Academy

Bio-Sync Academy is a nursing education platform featuring MAIA — an AI-powered pharmacology tutor that helps nursing students master drug classes, NCLEX-style questions, and clinical reasoning.

**Live URL:** https://academy.endgameenhancements.com

---

## What MAIA Does

- Explains drug classes, mechanisms, side effects, contraindications, and nursing considerations
- Generates NCLEX-style practice questions with rationales
- Provides real-time clinical decision support (educational use only — not a substitute for clinical judgment)
- Uses Google Gemini 3.1 Pro as the underlying AI model

---

## Pricing

| Plan | Price | Daily Messages | Access |
|------|-------|---------------|--------|
| **Free** | $0 | 2/day | Basic MAIA |
| **Pro** | $18/month | 20/day | Full MAIA |
| **Pro Annual** | $129/year | 20/day | Full MAIA |
| **Guest** | — | 5/day | MAIA without account |

- Guest users identified by IP; no login required
- Upgrade links on `/pricing`; success/cancel pages at `/billing-success` and `/billing-cancel`
- Stripe webhook handles automatic plan upgrades: `POST /api/stripe-webhook`

---

## Account & Billing

**Account page** (`/account`):
- View current plan and subscription status
- Verify account status with Stripe (syncs subscription from Stripe if manual override was applied)
- Cancel subscription button → calls `/api/cancel-subscription` → sets `cancel_at_period_end: true`
- Shows plan limits and usage

**Stripe integration**:
- Requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Zo service secrets
- Webhook endpoint: `POST /api/stripe-webhook` — auto-upgrades accounts on `checkout.session.completed`
- Verify button calls `/api/billing/sync-subscription` — searches Stripe by email if no customer ID stored
- Billing portal button opens Stripe Customer Portal for the user

**Known accounts:**
- Owner/admin: `crusius00@gmail.com` — Pro by default (manually assigned, not auto-upgraded)
- Admin only: `chad.l.lewis@endgameenhancements.com`, `christian.c.lewis@endgameenhancements.com` — Admin panel access but Free tier by default
- Paid subscriber: `lewygirl97@gmail.com` — Pro, active subscription

---

## MAIA Configuration

| Tier | Model | Daily Limit |
|------|-------|------------|
| Free | `google/gemini-3.1-pro-preview` | 2 messages |
| Pro | `google/gemini-3.1-pro-preview` | 20 messages |
| Guest | `google/gemini-3.1-pro-preview` | 5 messages |

Set via env vars: `MAIA_PRO_MODEL` (model), `PRO_MAIA_DAILY_LIMIT` / `FREE_MAIA_DAILY_LIMIT` / `GUEST_DAILY_LIMIT` (daily quotas).

**Zo token priority** (for Zo Ask API calls):
1. `ZO_API_KEY` — permanent, never expires (used in production)
2. `ZO_CLIENT_IDENTITY_TOKEN` — short-lived fallback
3. `ZO_HOST_SERVICE_JWT` / `ZO_MCPO_API_KEY` — not used by Zo Ask

---

## Authentication

Zo-hosted Google OAuth — no Clerk or Supabase auth.

- Login page: `/login`
- OAuth start: `GET /api/auth/google`
- OAuth callback: `GET /api/auth/google/callback`
- Session: signed `HttpOnly` cookie (`biosync_session`)
- Current user: `GET /api/auth/me`
- Logout: `POST /api/auth/logout`

Required secrets: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`

Authorized redirect URI:
```
https://bio-sync-academy-crusius.zocomputer.io/api/auth/google/callback
```

**Admin emails** (Admin button visible in nav): `crusius00@gmail.com`, `chad.l.lewis@endgameenhancements.com`, `christian.c.lewis@endgameenhancements.com`

---

## File Structure

```
.
├── server.ts              # Bun + Hono server + Vite middleware
├── index.html             # React entry point
├── vite.config.ts         # Vite + Tailwind CSS 4
├── package.json
├── zosite.json            # Zo publish config
├── public/                # Static assets
└── src/
    ├── main.tsx           # React bootstrap
    ├── App.tsx            # Router + AuthProvider
    ├── styles.css         # Global styles
    ├── lib/
    │   └── auth.tsx       # Auth context + useAuth hook
    ├── components/
    │   └── EducatorChat.tsx  # MAIA chat UI (tier selector removed — tier from account.plan)
    └── pages/
        ├── Home.tsx
        ├── Pricing.tsx
        ├── Login.tsx
        ├── Educator.tsx
        ├── BillingSuccess.tsx
        ├── BillingCancel.tsx
        ├── Account.tsx
        ├── Admin.tsx
        └── AdminDashboard.tsx
```

---

## Environment Variables (zosite.json → publish.env)

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `production` for published site |
| `ZO_CLIENT_IDENTITY_TOKEN` | Short-lived Zo API token (fallback) |
| `ZO_API_KEY` | Permanent Zo API token (primary) |
| `MAIA_PRO_MODEL` | Model name for Pro tier (default: `google/gemini-3.1-pro-preview`) |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth app client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth app client secret |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

---

## Development

- **Dev**: `bun run dev` — runs at internal Zo preview URL (private, auth-gated)
- **Publish**: `publish_site` tool — rebuilds and publishes to public URL
- **Build**: `bun run build` — clears Vite cache, runs Vite build, produces `dist/`
- **Debug**: Use `agent-browser` to preview at `http://localhost:$PORT`

Never run `bun run dev` or `bun run prod` manually — Zo manages process lifecycle. Use the **Publish button** or ask Zo to publish.

---

## Key Files

- `server.ts` — all backend logic (auth, MAIA proxy, Stripe billing, user data storage)
- `src/components/EducatorChat.tsx` — chat UI; no tier selector; always uses `account.plan` for routing
- `src/pages/Account.tsx` — account status, verify button, cancel subscription
- `src/pages/Pricing.tsx` — pricing cards with Stripe checkout links
- `data/users/` — JSON files keyed by Google sub (stores email, plan, stripeCustomerId, etc.)
- `data/billing/` — Stripe price cache (monthly/yearly products + payment links)