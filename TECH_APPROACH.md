# camp-ai: Technical & Teaching Approach

**What We Are Doing, How It Works, and Why It Matters**  
*Document Version: 1.0 · Date: September 2026 · Status: Active Architecture & Strategy*

---

## 1. Executive Summary: What We Are Doing

**camp-ai** is a reusable, single-tenant **Retrieval-Augmented Generation (RAG) platform** purpose-built for colleges and universities.

Instead of building another generic chatbot that hallucinates or answers from the open internet, camp-ai builds a **private, authoritative institutional knowledge system**. 

- The college uploads its official curriculum, syllabus, teacher notes, exam regulations, and circulars.
- The platform indexes, OCRs, chunks, and embeds them into a secure, isolated database.
- Approved students ask academic and administrative questions and receive **strictly verified, source-cited answers** derived exclusively from official college materials.

> **Our Core Philosophy:**  
> *"Build the RAG system once. Deploy a completely independent, zero-cost instance for every college."*

---

## 2. The Problem We Are Solving

Colleges today face a dual challenge when adopting AI:

1. **Generic AI Hallucinates Academic Facts:**  
   Public AI models (ChatGPT, generic bots) do not know a college's specific syllabus, internal exam patterns, credit rules, or the latest circulars. When students ask syllabus-specific questions (e.g., *"What topics are in Unit 2 of our CS301 syllabus?"*), generic models produce convincing but inaccurate answers that lead to student confusion and academic failure.

2. **Data Privacy, Governance & Cost Barriers:**  
   Most multi-tenant SaaS tools mingle data from multiple institutions, introduce compliance risks, and require expensive monthly subscriptions (managed vector databases, paid API quotas, Redis clusters, heavy GPU infrastructure).

---

## 3. Our Teaching & Pedagogical Approach

camp-ai is not designed to replace professors or write essays for students. It is designed to be an **authoritative academic companion and teaching multiplier**:

### 3.1 Strict Syllabus & Curriculum Alignment
- Learning is grounded in the exact textbook editions, course units, lecture notes, and faculty-approved reading lists uploaded by the college.
- When a student asks about a topic (e.g., *"Explain Prim's algorithm as required in our Unit 3 syllabus"*), the system explains it within the scope and depth defined by the curriculum.

### 3.2 Evidence-First Learning with Verifiable Citations
- Every answer is accompanied by **document name, page number, and section title**.
- Students are trained to inspect the primary source rather than blindly trusting an AI response.
- By referencing real college documents, the assistant reinforces reading official texts and syllabus references.

### 3.3 Zero Tolerance for Academic Hallucinations ("Admit When Unknown")
- If a question cannot be answered from the institution's verified documents, the system **explicitly refuses to guess**:
  > *"I couldn't find this information in the college resources available to me."*
- It does not fall back to generic internet conjecture unless the college explicitly enables a separate, clearly labeled general knowledge mode.

### 3.4 Institutional Trust & Multilingual Accessibility
- **Multilingual Inclusivity:** The system supports both English and Hindi (including Hindi OCR and multilingual embeddings), ensuring students from diverse linguistic backgrounds can access course knowledge and official circulars equally.
- **Official Admin Governance:** College faculty and administration retain 100% control over what documents are active, updated, or archived.

---

## 4. The Technical Approach

To make this vision reliable, reproducible, and completely free to run for any institution, camp-ai follows a strict set of architectural principles:

```
                      +------------------------------------------+
                      |         camp-ai Central Codebase         |
                      |     (One Repository, Clean Adapters)     |
                      +------------------------------------------+
                                           |
                +--------------------------+--------------------------+
                |                                                     |
                v                                                     v
   ===========================                           ===========================
     College A Deployment                                  College B Deployment
     (Independent Docker Pod)                              (Independent Docker Pod)
   ===========================                           ===========================
     * FastAPI Web App & Worker                            * FastAPI Web App & Worker
     * PostgreSQL 16 + pgvector                            * PostgreSQL 16 + pgvector
     * Local Disk Storage                                  * Local Disk Storage
     * .env + college.yaml (Branding)                      * .env + college.yaml (Branding)
   ===========================                           ===========================
```

### 4.1 Single-Tenant by Design
- **No Shared Databases:** No shared runtime knowledge base, no cross-college `tenant_id` columns, and zero risk of cross-institutional data leaks.
- **One Compose Project = One College:** Each institution runs its own Docker Compose instance with its own database, vector index, and file storage.
- **Easy White-Labeling:** Deploying for a new college requires only copying the configuration template, providing their `.env` and `college.yaml` (name, colors, logo, departments), and running compose.

### 4.2 Ingestion & Processing Pipeline
When an administrator uploads a document (PDF, DOCX, TXT, or scanned notice photo):

```text
[Upload] 
   │
   ▼
[Content Sniffing & Validation] (Safe storage keys, reject malicious types)
   │
   ▼
[Text Extraction] (PyMuPDF native extraction)
   │
   ├─► [Text Found] ────────────────────────┐
   └─► [Scanned/Image/Low Text] ──► [OCR]   │ (Tesseract with eng + hin)
                                       │    │
   ┌───────────────────────────────────┘    │
   ▼                                        ▼
[Structure-Aware Chunking] (300-500 tokens, preserving headings & page numbers)
   │
   ▼
[Local Embedding Generation] (FastEmbed multilingual model on CPU)
   │
   ▼
[Storage & Indexing] (Chunks & Vectors to pgvector + GIN tsvector)
   │
   ▼
[Mark Status: Indexed]
```

### 4.3 Hybrid Retrieval Engine
Academic queries include both semantic meaning (*"how does CPU scheduling work"*) and exact terminology (*"CS301 Unit 2 exam date 2026"*). camp-ai employs **Hybrid Retrieval**:

1. **Dense Vector Search:** High-dimensional cosine similarity via **pgvector (HNSW)** capturing semantic concepts.
2. **Sparse Full-Text Search:** PostgreSQL **tsvector + GIN index** matching exact codes, dates, and names.
3. **Reciprocal Rank Fusion (RRF):** Blends the rankings from both searches into a unified candidate pool.
4. **Metadata & Expiration Filtering:** Automatically filters out outdated versions, expired circulars, or documents outside the student's scope.
5. **Threshold Gating:** If the best candidate score is below the confidence threshold, LLM generation is skipped entirely, protecting students from hallucinated answers and conserving API rate limits.

### 4.4 Generation & Prompt Hardening
- **Prompt Fencing:** Retrieved chunks are injected into the prompt as strict, delimited data blocks. The system prompt instructs the LLM that context is data, never instructions (defending against prompt injection in student-uploaded or untrusted files).
- **Attribution & Citations:** The model must cite the source document and page number for every factual statement.

### 4.5 The Free-to-Run Technology Stack
Every core component was intentionally chosen to eliminate operational costs for colleges:

| Layer | Component | Why It Was Chosen |
|---|---|---|
| **API & Monolith** | Python + FastAPI | High-performance, clean async I/O, rich AI/RAG ecosystem. |
| **Relational & Vector DB** | PostgreSQL 16 + pgvector | Eliminates the need for separate Pinecone/Qdrant servers. Everything lives in one database. |
| **Full-Text Search** | Postgres `tsvector` + GIN | Zero external search engines (no Elastic/MeiliSearch needed). |
| **Background Jobs** | Postgres `jobs` with `SKIP LOCKED` | Asynchronous queue with zero extra Redis/Celery dependency. |
| **Embeddings** | FastEmbed (MiniLM-L12-v2) | Runs locally on CPU, free, zero API calls, keeps data private. |
| **LLM Inference** | Groq Free Tier / Gemini API | Ultra-fast token generation with free-tier accessibility. |
| **OCR** | Tesseract + Poppler | Free, open-source scanned document extraction with Hindi support. |
| **Frontend** | React / Next.js | Modern, responsive student chat and administrative console. |

---

## 5. Security, Governance & User Flow

A college assistant must maintain institutional integrity:

1. **One-Time Admin Approval Gate:**  
   Students register with their Roll Number, Department, and Semester. An account remains `pending` until verified and approved by the college owner/admin. No unverified user can call the AI endpoints.
2. **Backend-Enforced Authorization:**  
   Security is enforced at the API route level with cryptographic session tokens. The LLM never makes authorization decisions.
3. **Document Versioning:**  
   When a syllabus or notice is updated, uploading a new version deactivates the old one. The AI will never cite obsolete rules.

---

## 6. Implementation Milestones

- **M0: Scaffold (Complete)**  
  Docker Compose setup, FastAPI app, Postgres with pgvector, configuration loader, and health checks.
- **M1: Auth & Ingestion Pipeline (Next)**  
  Student signup portal, admin approval workflow, file upload, Tesseract OCR fallback, chunking, and local FastEmbed worker.
- **M2: Hybrid Retrieval & Citation Engine**  
  Vector + full-text search, RRF merging, prompt construction, Groq LLM integration, and strict citation formatting.
- **M3: User Interfaces**  
  Clean student chat UI (branded per college) and administrative control dashboard.
- **M4: Evaluation Harness & Deployment Hardening**  
  Automated retrieval evaluation on 30–50 real syllabus questions, backup scripts, and deployment templates.

---

## 7. Summary: The Value We Deliver

By marrying a **rigorous pedagogical approach** (syllabus grounding, transparent source citations, zero hallucination) with a **lean, single-tenant technical architecture** (PostgreSQL + pgvector, local embeddings, zero-cost stack), camp-ai empowers universities to deploy their own private AI assistant without compromising on student trust, data ownership, or institutional budget.
