# AI Sales Worker — Render.com Deployment Guide

## Overview

This guide walks you through deploying the AI Sales Worker to **Render.com** via **GitHub**. After deployment, your CEO can access the dashboard on any smartphone browser.

---

## Prerequisites

1. **GitHub account** — https://github.com
2. **Render.com account** — https://render.com (free starter plan works)
3. **Git installed on your machine** — https://git-scm.com/downloads

---

## Step 1: Prepare the Project for GitHub

The project is already configured for Render deployment. Key files:

| File | Purpose |
|------|---------|
| `server.js` | Express server with `0.0.0.0` bind, `process.env.PORT`, `/health` endpoint |
| `src/db.js` | SQLite DB with `process.env.DB_PATH` support |
| `src/middleware.js` | Auth that adapts: localhost-exempt in dev, API-key required in production |
| `.gitignore` | Excludes `node_modules`, `.env`, database files |
| `render.yaml` | Render Blueprint for auto-deploy configuration |
| `package.json` | Node.js project with `engines` field |

---

## Step 2: Create a GitHub Repository

1. Go to https://github.com/new
2. Repository name: `ai-sales-worker`
3. Description: `AI Digital Worker - Sales Lead Follow-up for Hong Kong SMEs`
4. **Private** (recommended — contains business logic)
5. **Do NOT** initialize with README, .gitignore, or license (we have our own)
6. Click **Create repository**

---

## Step 3: Initialize Git Locally and Push

Open a terminal in the project directory and run:

```bash
# Navigate to project folder
cd ai-sales-worker

# Initialize git repository
git init

# Add all project files (respecting .gitignore)
git add .

# First commit
git commit -m "Initial commit: AI Sales Worker v1.0 - Render-ready"

# Add your GitHub remote (replace YOUR-USERNAME)
git remote add origin https://github.com/YOUR-USERNAME/ai-sales-worker.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 4: Create a Render Web Service

1. Log into https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Connect your GitHub account if not already connected
4. Select the `ai-sales-worker` repository
5. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `ai-sales-worker` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Plan** | Starter (free) or Standard ($7/mo for persistent disk) |

6. **Add Environment Variables** before deploying:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Required for production mode |
| `API_KEY` | `your-secret-api-key` | Change from default! Used for API auth |
| `SKIP_AUTH` | `true` | Set to `true` for open demo; `false` to require API key |
| `CORS_ALLOWED_ORIGINS` | `https://ai-sales-worker.onrender.com` | Your Render URL (add after first deploy) |
| `DB_PATH` | _(optional)_ | Only needed if using persistent disk on paid plan |

7. Click **Create Web Service**

Render will automatically:
- Clone your repo from GitHub
- Run `npm install` (including `better-sqlite3` native compilation)
- Start `node server.js`
- Monitor the `/health` endpoint

---

## Step 5: Configure CORS After First Deploy

After Render assigns your URL (e.g. `https://ai-sales-worker.onrender.com`):

1. Go to your Render service → **Environment** tab
2. Update `CORS_ALLOWED_ORIGINS` to include your Render URL:
   ```
   https://ai-sales-worker.onrender.com
   ```
3. Render will auto-redeploy with the new env var

---

## Step 6: Access on Smartphone

Open your CEO's smartphone browser and navigate to:

```
https://ai-sales-worker.onrender.com
```

The dashboard is mobile-responsive and works on iPhone/Android browsers.

---

## Important Notes

### Authentication Modes

| Mode | SKIP_AUTH | Who can access |
|------|-----------|---------------|
| **Open Demo** | `true` | Anyone with the URL (good for CEO demo) |
| **API-Key Required** | `false` | Only requests with valid `X-API-Key` header |

> ⚠️ The dashboard UI loads without API key (static files bypass auth middleware). But all `/api` calls require the key when `SKIP_AUTH=false`. For a CEO demo, set `SKIP_AUTH=true`.

### SQLite on Render

- **Free/Starter plan**: SQLite works, but data is **NOT persistent** across deploys. Each deploy recreates the container. Demo seed data will reload each time.
- **Standard plan ($7/mo)**: You can add a **Persistent Disk** (1GB minimum). Set `DB_PATH` to the disk mount path (e.g. `/opt/render/project/data/sales-worker.db`) and data survives deploys.
- For the CEO demo, the free plan is fine — seed data auto-loads on each deploy.

### Auto-Deploy

Render auto-deploys whenever you push to the `main` branch on GitHub. To disable:
- Render dashboard → your service → **Settings** → toggle off **Auto-Deploy**

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails on `better-sqlite3` | Make sure Node >= 18 is used. Render default is Node 18+. Check `engines` in package.json. |
| CORS errors on browser | Add your Render URL to `CORS_ALLOWED_ORIGINS` env var. |
| 401 Unauthorized on API calls | Set `SKIP_AUTH=true` for demo, or send `X-API-Key` header. |
| Database empty after redeploy | Free plan doesn't persist data. Upgrade to Standard plan + Persistent Disk. |
| Health check failing | Ensure `/health` returns 200. Check Render logs for startup errors. |
| App crashes on start | Check Render logs. Common issue: missing `PORT` env var (Render provides it automatically). |

---

## Quick Deploy Checklist

- [ ] Project files committed and pushed to GitHub
- [ ] Render web service created and connected to GitHub repo
- [ ] `NODE_ENV=production` set in Render env vars
- [ ] `API_KEY` set to a strong secret key
- [ ] `SKIP_AUTH=true` set for demo mode
- [ ] `CORS_ALLOWED_ORIGINS` set to your Render URL
- [ ] `/health` endpoint responding 200
- [ ] Dashboard loads on smartphone browser
- [ ] All 4 tabs work: Dashboard, Pipeline, Conversations, Settings
- [ ] CEO Demo Mode walkthrough tested on mobile

---

## File Changes for Render (Summary)

### server.js
- `PORT` uses `process.env.PORT || 3000`
- `HOST` uses `process.env.HOST || '0.0.0.0'` (required for Render)
- `/health` endpoint added for Render health checks
- `CORS_ALLOWED_ORIGINS` env var adds production origins
- Graceful shutdown on SIGTERM/SIGINT (Render sends SIGTERM)
- Production-aware startup message

### src/db.js
- `DB_PATH` uses `process.env.DB_PATH` or local fallback
- Data directory creation uses `path.dirname(DB_PATH)` (works for any path)

### src/middleware.js
- Auth adapts: localhost-exempt in dev, API-key required in production
- `SKIP_AUTH=true` env var bypasses auth entirely (for open demo)
- `isProduction` flag from `NODE_ENV`

### package.json
- Added `engines: { node: ">=18.0.0" }` for Render compatibility

### New files
- `.gitignore` — excludes node_modules, data/*.db, .env
- `render.yaml` — Render Blueprint for auto-deploy configuration
