# Bharati.ai (Bharti.ai) 🎓🏛️

> **The Intelligent Conversational Knowledge & RAG Platform for Bharati Vidyapeeth University.**  
> Proudly engineered by **Vicky Sahu**, Founder of [Maithil Studios](https://maithilstudios.vercel.app).

---

## 🌟 Highlights

- **⚡ Unified RAG Engine**: Real-time Reciprocal Rank Fusion (RRF) combining vector similarity (`pgvector`, `FastEmbed`) and full-text search (`tsvector`).
- **📑 Multi-Format Ingestion**: Native extraction and OCR for **PDFs**, **DOCX**, **TXT**, and **JPEG/PNG** scanned documents (with English + Hindi Tesseract support).
- **🎨 Neo-Brutalist ChatGPT-Grade Interface**: Structured markdown text viewer with keyword highlights, responsive tables, formatted bullet lists, and code blocks with 1-click copy.
- **🏷️ 100 Standardized Campus Keywords**: Fast-tagging system for course codes, syllabi, exam datesheets, and departments.
- **🔐 Automatic Credential-Based Access Control**: Unified login portal automatically routing students to the chat portal and staff to the admin console.
- **🔗 External Cloud Referencing**: Supports linking Google Drive / OneDrive sources alongside uploaded documents.

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, TailwindCSS, Lucide Icons, Remark-GFM
- **Backend API**: FastAPI, Python 3.12, Uvicorn
- **Background Worker**: Python, PyMuPDF, Python-Docx, PyTesseract, Poppler
- **Embeddings & LLM**: BAAI/BGE-Small (`FastEmbed`), Groq Llama 3 / GPT-OSS
- **Database**: PostgreSQL 16 + `pgvector`
- **Deployment**: Docker Compose, Vercel-ready frontend, Bare-Metal / Cloud VPS guides

---

## 🚀 Quick Start (Docker)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vickysahuhere/Bharati.ai.git
   cd Bharati.ai
   ```

2. **Configure Environment Secrets:**
   ```bash
   cd deploy
   cp .env.example .env
   # Add your GROQ_API_KEY and secure database credentials in deploy/.env
   ```

3. **Start the Software Stack:**
   ```bash
   docker compose -p college-a up -d --build
   ```

4. **Launch the Web Application:**
   * **Frontend Application:** [http://localhost:5173](http://localhost:5173)
   * **Interactive API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🌐 Production Deployment

Refer to [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full production deployment instructions:
- **Frontend on Vercel** using [`frontend/vercel.json`](./frontend/vercel.json)
- **Backend outside Docker** via Linux Systemd services or Cloud Docker (Render / Railway)

---

## 📜 Documentation

- [`workflow.md`](./workflow.md): Complete architecture, ingestion lifecycle, and RAG search pipeline.
- [`helper.md`](./helper.md): Operational troubleshooting and issue-to-file resolution guide.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md): Step-by-step production hosting guide.

---

## 👨‍💻 Creator & License

Built with ❤️ by **Vicky Sahu**  
Founder, [Maithil Studios](https://maithilstudios.vercel.app)
