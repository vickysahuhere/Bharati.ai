# Campus-AI Troubleshooting & Helper Guide

If you encounter issues while running or modifying the Campus-AI platform, use this guide to quickly locate the relevant files and systems.

## 1. Database & Schema Issues
**Symptoms**: Missing columns, failed database connections, or tables not existing.
**Where to look**: 
- `backend/app/db/session.py`: Handles PostgreSQL connection pooling.
- `deploy/docker-compose.yml`: Configures the `pgvector` database container.

## 2. Document Upload & Ingestion (Admin)
**Symptoms**: Uploads failing, status stuck on "UPLOADED" or "PROCESSING", files not being read.
**Where to look**:
- `backend/app/api/documents.py`: The API endpoint that receives the file, saves it, and queues the background job.
- `backend/worker/ingestion.py`: The background worker that actually opens the PDF/Image, runs OCR (`pytesseract`), chunks the text, creates vector embeddings, and saves them to the DB.
- `backend/app/providers/storage.py`: Handles saving the physical files to the local disk.

## 3. RAG Search & Context Retrieval
**Symptoms**: The AI says "I couldn't find this information", or it finds the wrong documents.
**Where to look**:
- `backend/app/retrieval/search.py`: Contains the `hybrid_search` SQL query. This file controls how vector similarity (pgvector) and Full-Text Search (keyword matching) are combined to find relevant chunks.

## 4. LLM Generation & Prompts
**Symptoms**: The AI hallucinates, is too brief, or throws Groq API errors (like 404 or 429).
**Where to look**:
- `backend/app/generation/pipeline.py`: Contains the `SYSTEM_PROMPT` and the logic that stitches the retrieved chunks together before sending them to the LLM. 
- `backend/app/providers/adapters.py`: Contains the `GroqLLM` class where the physical HTTP request to the Groq API is made (including retry logic).
- `deploy/.env`: Check if `LLM_MODEL` or `GROQ_API_KEY` are correct.

## 5. Frontend UI / React 
**Symptoms**: Chat not rendering markdown, Enter key not working, Admin panel tabs broken.
**Where to look**:
- `frontend/src/components/StudentChat.jsx`: The main chat interface for sending messages and rendering markdown.
- `frontend/src/components/AdminPanel.jsx`: The dashboard for approving users, uploading files, and testing the AI.
- `frontend/src/App.jsx`: Main routing and layout.

## 6. Docker / Deployment
**Symptoms**: Containers won't start, or Python code changes aren't reflecting.
**Where to look**:
- `deploy/docker-compose.yml`: Defines the `db`, `api`, and `worker` services.
- **Important Note**: If you change Python code in `backend/`, you MUST run `docker compose up -d --build` for the changes to take effect!
