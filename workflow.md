# Campus-AI Architecture & Workflow

This document explains the step-by-step workflow of how data flows through the Campus-AI platform.

## Architecture Overview
The system is divided into three main Docker containers:
1. **DB**: PostgreSQL with the `pgvector` extension (stores relational data and vector embeddings).
2. **API**: FastAPI backend (serves the frontend, handles chat, user auth, and file uploads).
3. **Worker**: A background Python process that watches the database for new files to process.

---

## Workflow 1: Document Ingestion (Admin)
When an administrator uploads a syllabus or notice, here is what happens:

1. **Upload (Frontend -> API)**: 
   The Admin fills out the form in `AdminPanel.jsx` (Title, Domain, Keywords, Semester) and uploads a PDF/JPEG.
2. **Save & Queue (API -> DB)**: 
   `documents.py` saves the file to the local disk, creates a database row for the document, and inserts a job into the `jobs` table (`ingest_version`).
3. **Worker Pickup (Worker)**: 
   The background `worker` container detects the new job and starts `ingestion.py`.
4. **Extraction & OCR**: 
   - If it's a valid PDF, `PyMuPDF (fitz)` extracts the text.
   - If it's a JPEG or a scanned PDF without embedded text, `pytesseract` runs Optical Character Recognition to extract the text.
5. **Chunking**: 
   The text is split into small "chunks" (about 500 words each) so the AI can read specific sections later.
6. **Embedding & Indexing (Worker -> DB)**: 
   `FastEmbed` converts every chunk into a mathematical vector (a long list of numbers). These vectors are saved into the `chunks` table in Postgres using bulk inserts for speed.

---

## Workflow 2: RAG Chat (Student)
When a student asks a question like "When are the exams?", here is what happens:

1. **Query (Frontend -> API)**: 
   `StudentChat.jsx` sends the question to the backend. It also passes along any selected filters (e.g., Domain = "Notices").
2. **Hybrid Search (API -> DB)**: 
   `search.py` takes the student's question and converts it into a vector. It asks Postgres to find chunks that match both:
   - **Semantic Meaning** (Vector Similarity via pgvector: `embedding <=> query_vector`)
   - **Keywords** (Full-Text Search on Document Title, Subject, and chunk text)
3. **Prompt Assembly (API)**: 
   `pipeline.py` takes the top 5 chunks returned from the database and formats them into a strict `SYSTEM_PROMPT`. 
4. **LLM Generation (API -> Groq)**: 
   `adapters.py` sends the prompt and the retrieved college chunks to the Groq LLM (e.g., `gpt-oss-20b`). The LLM reads the chunks and synthesizes a natural language answer.
5. **Response (API -> Frontend)**: 
   The generated answer, along with the cited source documents, is sent back to the React frontend, where `react-markdown` formats it beautifully for the student.
