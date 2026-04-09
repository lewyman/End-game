---
name: endgame-platform
version: 1.0.0
description: Visual pharmacology flashcards for nursing students
---

# Nursing Pharmacology Platform

Live at: https://endgame-platform.vercel.app

## Stack
- Frontend: Vite + React + Tailwind v4
- Backend: Vercel Serverless Functions (api/)
- Database: Supabase (PostgreSQL)

## API Endpoints
- GET /api/drugs - List all drugs
- GET /api/drugs/:slug - Get drug detail with content blocks
- POST /api/login - User login
- POST /api/signup - User signup
- POST /api/educator - AI Medical Educator (Groq + Google TTS)
- GET /api/health - Health check

## AI Educator
The /api/educator endpoint uses:
- Groq API (llama-3.3-70b-versatile) for chat completion
- Google Cloud TTS for audio synthesis
Required env vars: GROQ_API_KEY, GOOGLE_APPLICATION_CREDENTIALS

## Deploy
Push to main triggers production deploy. Pull latest from Vercel dashboard.
