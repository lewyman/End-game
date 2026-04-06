# Nursing Pharmacology (Netlify Edition)

Full-stack nursing pharmacology learning platform, migrated from Zo to Netlify for team collaboration.

## Architecture

```
Frontend (Vite + React) → deployed to Netlify CDN
Backend (Netlify Functions + Supabase) → serverless API
Database (PostgreSQL) → Supabase managed database
Images (Cloudinary) → cloud image hosting (optional)
```

## Setup Steps

### 1. Supabase Database

1. Create account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to SQL Editor → New query
4. Paste contents of `supabase-schema.sql` and run
5. Copy your **Project URL** and **Service Role Key** (Settings → API)

### 2. Netlify Setup

1. Fork/push this repo to your GitHub
2. Go to [app.netlify.com](https://app.netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect your GitHub repo
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
   - Functions directory: `netlify/functions`

### 3. Environment Variables

In Netlify dashboard → Site settings → Environment variables, add:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
FRONTEND_URL=https://your-site-name.netlify.app
```

### 4. Add Team Members

1. Add team members to the **GitHub repo** (Settings → Manage access)
2. They can push changes → Netlify auto-deploys
3. No Netlify accounts needed for team members

### 5. Migrate Data from SQLite

If migrating from Zo SQLite database:

```bash
# Export SQLite data to JSON
duckdb /path/to/content.db -c "COPY (SELECT * FROM drugs) TO 'drugs.json' (ARRAY);"
duckdb /path/to/content.db -c "COPY (SELECT * FROM content_blocks) TO 'blocks.json' (ARRAY);"

# Import to Supabase using their JS client or dashboard CSV import
```

## Project Structure

```
├── frontend/           # React app (Vite)
│   ├── src/
│   │   ├── pages/     # Page components
│   │   ├── components/# Shared components
│   │   └── data/      # Drug data (JSON)
│   ├── public/        # Static assets
│   └── dist/         # Build output
├── netlify/
│   └── functions/
│       └── api.ts    # Serverless API
├── netlify.toml      # Netlify config
└── supabase-schema.sql # Database schema
```

## Development

```bash
# Install dependencies
npm install
cd frontend && npm install

# Run locally
npm run dev

# Build for production
npm run build
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drugs` | List all drugs |
| GET | `/api/drugs/:slug` | Get drug details |
| POST | `/api/login` | User login |
| POST | `/api/signup` | User signup |
| POST | `/api/admin/drugs` | Create drug (admin) |
| PUT | `/api/admin/drugs/:slug` | Update drug |
| DELETE | `/api/admin/drugs/:slug` | Delete drug |

## Next Steps

1. [ ] Set up Cloudinary for image uploads (or use Supabase Storage)
2. [ ] Configure Stripe webhooks for payments (if using premium)
3. [ ] Add analytics (Plausible or Google Analytics)
4. [ ] Set up custom domain

## Team Access

Your team only needs GitHub access:
- Push changes to `main` branch → auto-deploys
- Create PRs for code review
- No Netlify dashboard access required

---

**Originally built on Zo Computer** | **Migrated for team collaboration**
# Wed Apr  1 04:05:22 UTC 2026
# Bio-Sync Academy Deployment
# Trigger deployment after making repo public
Mon Apr  6 01:40:43 UTC 2026 - Trigger deploy
