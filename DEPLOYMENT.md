# Bharti.ai — Production Deployment & Packaging Guide

This guide explains how to package and deploy Bharti.ai for production both **with Docker** and **outside of Docker**, including deploying the frontend to **Vercel**.

---

## 🏛️ Architecture Overview

| Component | Technology | Best Production Host |
| :--- | :--- | :--- |
| **Frontend** | React + Vite (Brutalist UI) | **Vercel** / Netlify / Cloudflare |
| **Backend API** | FastAPI + Python 3.12 | **Render** / Railway / DigitalOcean VPS |
| **Worker (OCR & Vectors)** | PyTesseract + FastEmbed (BGE-Small) | **Render Background Worker** / Systemd Service |
| **Vector Database** | PostgreSQL 16 + pgvector | **Neon.tech** / Supabase / AWS RDS |

> [!NOTE]
> **Why can't the entire backend + worker run on Vercel alone?**
> Vercel is a serverless frontend platform. It does not allow background daemons (like our continuous ingestion worker), has strict 15-second execution limits that would timeout during heavy PDF OCR extraction, and cannot install system binaries (`tesseract-ocr` and `poppler-utils`). Therefore, the industry standard is to host the **Frontend on Vercel** and the **Backend + Database on Render/Railway/VPS**.

---

## 🚀 Part 1: Deploying the Frontend to Vercel (10 Minutes)

1. Push your code to a **GitHub** repository.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Set the **Root Directory** to `frontend`.
5. In **Framework Preset**, select **Vite**.
6. Set Build Command: `npm run build` and Output Directory: `dist`.
7. In `frontend/vercel.json`, replace `https://YOUR_BACKEND_URL` with your live backend domain (e.g. `https://bharti-ai-api.onrender.com`).
8. Click **Deploy**!
   Your Bharti.ai UI is now live on `https://your-app.vercel.app` with custom domains, automatic SSL, and global CDN!

---

## ⚙️ Part 2: Running Outside of Docker (Bare Metal / VPS / Cloud Server)

If you are deploying to an Ubuntu/Debian VPS (e.g. AWS EC2, DigitalOcean Droplet, Hetzner):

### Step 1: Install System Dependencies
```bash
sudo apt update && sudo apt install -y \
    python3.12 python3.12-venv python3-pip \
    tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin poppler-utils \
    postgresql-client
```

### Step 2: Set Up Python Virtual Environment
```bash
cd camp-ai/backend
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Create `.env` inside `backend/` or export variables:
```bash
DATABASE_URL="postgresql://user:password@db-host:5432/dbname"
GROQ_API_KEY="gsk_..."
EMBEDDING_MODEL="BAAI/bge-small-en-v1.5"
SECRET_KEY="generate_a_secure_random_key"
UPLOAD_DIR="/srv/camp/uploads"
```

### Step 4: Run Database Migrations
```bash
python -c "from app.db.migrate import run_migrations; run_migrations(384)"
```

### Step 5: Run API & Background Worker via Systemd (or PM2)

**API Service (`/etc/systemd/system/bharti-api.service`):**
```ini
[Unit]
Description=Bharti.ai API Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/camp-ai/backend
EnvironmentFile=/home/ubuntu/camp-ai/backend/.env
ExecStart=/home/ubuntu/camp-ai/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

**Worker Service (`/etc/systemd/system/bharti-worker.service`):**
```ini
[Unit]
Description=Bharti.ai Ingestion Worker
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/camp-ai/backend
EnvironmentFile=/home/ubuntu/camp-ai/backend/.env
ExecStart=/home/ubuntu/camp-ai/backend/venv/bin/python -m worker.main
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bharti-api
sudo systemctl enable --now bharti-worker
```

---

## 🛡️ Part 3: Deploying on Render / Railway (Zero-Ops Cloud Docker)

Since you already have production Dockerfiles:
1. Connect your GitHub repo to [Render.com](https://render.com) or [Railway.app](https://railway.app).
2. Provision a **PostgreSQL** instance with `pgvector` enabled (1 click in Render/Railway/Neon).
3. Create a **Web Service** for `backend/Dockerfile`:
   - Command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. Create a **Background Worker** for `backend/Dockerfile`:
   - Command: `python -m worker.main`
5. Supply environment variables (`DATABASE_URL`, `GROQ_API_KEY`, `SECRET_KEY`).
6. Point your Vercel frontend to this Render API URL.

---

## 🤖 Part 4: Anti-Bot & Abuse Protections (Built-In)

The backend includes active anti-bot defenses:
- **Cloudflare & Reverse Proxy IP Extraction:** Correctly reads `CF-Connecting-IP` and `X-Forwarded-For`.
- **Malicious Scanner Blocking:** Drops known vulnerability scanners (`sqlmap`, `nikto`, `masscan`, `gobuster`, etc.) with 403 Forbidden.
- **AI Crawler & Scraper Defense:** `robots.txt` disallows aggressive crawlers (`GPTBot`, `CCBot`, `Bytespider`, `ClaudeBot`) from scraping documents or internal endpoints.
- **Sliding-Window Rate Limiting:**
  - Chat Queries & SSE Streaming: Max 25 req/min, burst cap of 6 req/5s.
  - Auth Login: Max 5 attempts/min, burst cap of 3 req/10s (protects bcrypt from CPU-exhaustion).
  - Auth Signup: Max 3 signups/5 min.
- **Honeypot Traps:** Form submissions with filled honeypot fields are dropped immediately without consuming LLM credits or DB cycles.
- **Payload Guard:** Queries capped at 1,000 characters and chat histories capped at 20 messages to prevent token-depletion attacks.

---

## 🔒 Keeping Your Local Docker Environment Safe
Your local Docker setup inside `deploy/` remains untouched, safe, and ready to run at any time via:
```powershell
cd camp-ai/deploy
docker compose -p college-a up -d
```
All documents, credentials, and embeddings stay safe inside the local `pgdata` volume.
