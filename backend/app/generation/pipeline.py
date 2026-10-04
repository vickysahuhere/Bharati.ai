from typing import Dict, Any, List, Optional
import re
from app.retrieval.search import hybrid_search
from app.providers.registry import get_llm
from app.core.config import get_settings

GREETINGS_PATTERN = re.compile(
    r"^(hi|hello|hey|hey\s+there|good\s+(morning|afternoon|evening)|greetings|howdy|sup|yo|namaste|what'?s\s+up|who\s+are\s+you|who\s+made\s+you|thanks|thank\s+you|bye|goodbye)\b[\s!.?]*$",
    re.IGNORECASE
)

SYSTEM_PROMPT = """You are Bharti.ai, the official conversational AI assistant for Bharati Vidyapeeth University.
You were built and created by Vicky Sahu, founder of Maithil Studios (maithilstudios.vercel.app).

Your primary role is to help students, faculty, and visitors by providing clear, highly informative, and authoritative answers strictly based on the provided institutional context.

Core Directives:
1. STRICT TRUTH & FIDELITY: Your answers MUST be grounded in the provided context blocks. Do not hallucinate, speculate, or fabricate unverified details.
2. TEMPORAL & SCHEDULE REASONING:
   - Pay special attention to dates, validity periods, examination timetables, shift timings, room numbers, and deadlines.
   - When asked about datesheets, schedules, or timelines, format your answer clearly with structured tables or bullet lists including: Subject/Course, Exam Date, Timing, Room/Venue, and Course Code.
   - SEMESTER DISCRIMINATION: When the user asks about a specific semester (e.g., BCA Semester 1, Semester 3, or Semester 5), strictly provide the timetable and details for that requested semester. Do NOT mix up subjects from other semesters. If the user asks for all semesters, group each semester under its own clear heading and table.
   - Explicitly mention the validity period or issue date of the notice/schedule if available.
   - If an event is upcoming or past based on dates, inform the user clearly.
3. CONVERSATIONAL & PROACTIVE: Speak warmly and professionally. If the user asks about an exam or syllabus, highlight important exam rules, reporting times, required documents (admit cards, ID cards), and rules on electronic devices mentioned in the context.
4. HONEST CONTEXT REPORTING: If the context document is about a different topic than the question (for example, if a document was misnamed or contains technical logs instead of academic dates), clearly explain what the document actually contains instead of making up answers.
5. BEAUTIFUL STRUCTURE: Use Markdown formatting extensively: headers, tables, bold text, and clean spacing.
6. CITATIONS: Attribute key facts to the specific source document and page number.
7. CREATOR WATERMARK RULE (STRICT): DO NOT add any 'P.S.', signature, watermark, or creator disclaimer at the bottom of your answers. ONLY mention that you were built by Vicky Sahu of Maithil Studios if the user explicitly asks 'Who made you?', 'Who built you?', or similar questions.
8. DOMAIN ISOLATION & ZERO HALLUCINATION (STRICT):
   - You are strictly an institutional campus AI assistant for Bharati Vidyapeeth University.
   - You must ONLY answer questions directly concerning the college (such as admissions, programs, fee structures, syllabus, examinations, datesheets, faculty, campus life, and university regulations).
   - If the user asks an out-of-scope question unrelated to the university or academic life (such as cooking recipes, e.g. "How do I bake a chocolate cake?", general pop culture, movie reviews, sports trivia, non-college coding or general questions), you MUST refuse politely and firmly:
     "I'm sorry, but I am the college AI assistant dedicated exclusively to Bharati Vidyapeeth University information (admissions, courses, fees, exams, and campus guidelines). I cannot answer questions outside the college domain."
   - If the user asks an institutional question about the college, but the specific answer is NOT found in the provided context blocks, you must reply:
     "I'm sorry, but I don't have that information in the college database. Please contact the administration."

<context>
{context_blocks}
</context>
"""

NOT_FOUND_RESPONSE = "I'm sorry, but I don't have that information in the college database. Please contact the administration."

REWRITE_PROMPT = """Given the following conversation history and the user's latest message, rewrite the latest message into a standalone, detailed search query that can be used to search a knowledge base.
If the latest message is already standalone and does not refer to previous context, just return the latest message exactly as is.
DO NOT answer the question, just return the standalone search query.

Conversation History:
{history}

Latest Message:
{query}

Standalone Query:"""

def rewrite_query(query: str, chat_history: List[Dict[str, str]]) -> str:
    if not chat_history:
        return query
        
    settings = get_settings()
    if not settings.groq_api_key:
        return query
        
    history_text = ""
    for msg in chat_history[-4:]:  # Use last 4 messages for context
        role = "User" if msg["role"] == "user" else "Assistant"
        history_text += f"{role}: {msg['content']}\n"
        
    messages = [
        {"role": "system", "content": "You are a query rewriter. Output only the rewritten query, nothing else."},
        {"role": "user", "content": REWRITE_PROMPT.format(history=history_text, query=query)}
    ]
    
    try:
        llm = get_llm()
        rewritten = llm.generate(messages, temperature=0.0).strip()
        # Remove quotes if the LLM adds them
        if rewritten.startswith('"') and rewritten.endswith('"'):
            rewritten = rewritten[1:-1]
        return rewritten
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Query rewrite failed: {e}")
        return query

def generate_answer(
    query: str,
    knowledge_domain: Optional[str] = None,
    department: Optional[str] = None,
    semester: Optional[int] = None,
    subject: Optional[str] = None,
    chat_history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Core RAG (Retrieval-Augmented Generation) Pipeline.
    1. Fetches relevant document chunks from the Postgres database.
    2. Formats them into a strict System Prompt.
    3. Sends the prompt + chat history to the Groq LLM.
    4. Returns the AI's response and citations (sources).
    """
    
    # 0. Check for conversational greetings / small talk - bypass document search completely!
    clean_query = query.strip()
    if GREETINGS_PATTERN.match(clean_query):
        settings = get_settings()
        if settings.groq_api_key:
            greeting_prompt = """You are Bharti.ai, the official AI assistant for Bharati Vidyapeeth University.
You were built and created by Vicky Sahu, founder of Maithil Studios (maithilstudios.vercel.app).
If the user greets you or says hi/hello/hey, reply warmly, introduce yourself briefly, and invite them to ask about admissions, examination datesheets, courses, syllabus, and fee structures.
Keep the greeting friendly, concise, and helpful."""
            msgs = [{"role": "system", "content": greeting_prompt}]
            if chat_history:
                for msg in chat_history[-4:]:
                    msgs.append({"role": msg["role"], "content": msg["content"]})
            msgs.append({"role": "user", "content": query})
            try:
                llm = get_llm()
                ans = llm.generate(msgs, temperature=0.3)
                return {
                    "answer": ans,
                    "sources": [],
                    "found": True
                }
            except Exception:
                pass
        return {
            "answer": "Hello! I am Bharti.ai, the official assistant for Bharati Vidyapeeth University. How can I help you today with admissions, exam datesheets, syllabus, or fee structures?",
            "sources": [],
            "found": True
        }

    # 1. Rewrite query if there is history
    search_query = rewrite_query(query, chat_history) if chat_history else query
    
    # 2. Retrieve the most relevant chunks using Hybrid Search (Vector + Full-Text)
    chunks = hybrid_search(
        query=search_query,
        knowledge_domain=knowledge_domain,
        department=department,
        semester=semester,
        subject=subject,
        top_k=5,
        min_score=0.15
    )
    
    # 2. Check if relevant context exists
    if not chunks:
        settings = get_settings()
        if settings.groq_api_key:
            greeting_prompt = """You are Bharti.ai, the official AI assistant for Bharati Vidyapeeth University.
You were built and created by Vicky Sahu, founder of Maithil Studios (maithilstudios.vercel.app).

Strict Directives:
1. DOMAIN ISOLATION (ZERO OUT-OF-SCOPE HALLUCINATION):
   - You are exclusively a campus assistance AI for Bharati Vidyapeeth University.
   - You must NEVER answer out-of-scope questions unrelated to the university or academic life (such as cooking recipes, e.g. "How do I bake a chocolate cake?", gaming, pop culture, non-college coding, or general trivia).
   - If the user asks an out-of-scope question, you MUST refuse:
     "I'm sorry, but I am the college AI assistant dedicated exclusively to Bharati Vidyapeeth University information (admissions, courses, fees, exams, and campus guidelines). I cannot answer questions outside the college domain."
2. ZERO HALLUCINATION / MISSING INFO:
   - If the user asks an institutional college question but official records for that specific query are not yet in the database, reply:
     "I'm sorry, but I don't have that information in the college database. Please contact the administration."
3. GREETINGS & IDENTITY:
   - If the user is greeting you (e.g. "hi", "hello", "hey", "good morning"), reply warmly, introduce yourself as Bharti.ai, and let them know you can help with Bharati Vidyapeeth admissions, courses, fees, exam notifications, syllabus, and college procedures.
   - If the user asks who made you, who created you, or about Maithil Studios, tell them you were created by Vicky Sahu of Maithil Studios.
- Keep responses clean, concise, polite, and well-formatted."""
            fallback_msgs = [
                {"role": "system", "content": greeting_prompt}
            ]
            if chat_history:
                for msg in chat_history[-4:]:
                    fallback_msgs.append({"role": msg["role"], "content": msg["content"]})
            fallback_msgs.append({"role": "user", "content": query})
            try:
                llm = get_llm()
                ans = llm.generate(fallback_msgs, temperature=0.3)
                return {
                    "answer": ans,
                    "sources": [],
                    "found": False
                }
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Conversational fallback failed: {e}")

        return {
            "answer": NOT_FOUND_RESPONSE,
            "sources": [],
            "found": False
        }
        
    # 3. Build fenced context and citations
    context_blocks = []
    sources = []
    seen_cite_keys = set()
    
    for i, c in enumerate(chunks, start=1):
        cite_key = (c["document_id"], c.get("page"), c.get("section"))
        if cite_key not in seen_cite_keys:
            citation = {
                "document_id": c["document_id"],
                "title": c["title"],
                "domain": c["domain"],
                "page": c["page"],
                "section": c["section"],
                "source_url": c.get("source_url"),
                "effective_date": c.get("effective_date"),
                "expiration_date": c.get("expiration_date"),
                "department": c.get("department"),
                "semester": c.get("semester")
            }
            sources.append(citation)
            seen_cite_keys.add(cite_key)
        
        valid_from = c.get("effective_date") or "Published"
        valid_to = c.get("expiration_date") or "Ongoing"
        meta = c.get("metadata") or {}
        dates_list = meta.get("dates", [])
        dates_str = ", ".join(dates_list[:6]) if dates_list else "None specified"
        dept = c.get("department") or "University-wide"
        
        chunk_sems = meta.get("semesters") or []
        if chunk_sems:
            sem = f"Semesters: {', '.join(str(s) for s in chunk_sems)}"
        elif c.get("semester"):
            sem = f"Semester {c['semester']}"
        else:
            sem = "All Semesters"
            
        sec = f" | Section: {c['section']}" if c.get("section") else ""
        doc_type = (c.get("document_type") or c.get("domain") or "Official Notice").upper()

        block = (
            f"[Source {i}: {c['title']} | Type: {doc_type} | Dept: {dept} | {sem}{sec} | "
            f"Validity Period: {valid_from} to {valid_to} | Key Dates: {dates_str} | Page {c['page'] or 1}]\n"
            f"{c['content']}"
        )
        context_blocks.append(block)
        
    formatted_context = "\n\n".join(context_blocks)
    
    # 4. Prepare LLM Messages
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(context_blocks=formatted_context)}
    ]
    
    if chat_history:
        for msg in chat_history[-6:]:  # include up to last 6 messages
            messages.append({"role": msg["role"], "content": msg["content"]})
            
    messages.append({"role": "user", "content": query})
    
    # 5. Call LLM (with fallback if GROQ_API_KEY is not set)
    settings = get_settings()
    if not settings.groq_api_key:
        summary_text = "**[Offline Mode - No LLM API Key]**\n\nI found the following relevant information in the college documents:\n\n"
        for c in chunks[:5]:
            summary_text += f"**From '{c['title']}'** (Page {c['page'] or 'N/A'}, Section {c['section'] or 'N/A'}):\n> {c['content']}\n\n"
        return {
            "answer": summary_text,
            "sources": sources,
            "found": True
        }
        
    try:
        llm = get_llm()
        answer = llm.generate(messages, temperature=0.1)

        # If the answer is an out-of-scope refusal, general small-talk, or not-found, do not display sources
        ans_lower = answer.lower()
        if (
            NOT_FOUND_RESPONSE.lower() in ans_lower or
            "cannot answer questions outside the college domain" in ans_lower or
            "dedicated exclusively to bharati vidyapeeth" in ans_lower or
            "how can i assist you with bharati" in ans_lower or
            "how can i help you with bharati" in ans_lower
        ):
            sources = []

        return {
            "answer": answer,
            "sources": sources,
            "found": True
        }
    except Exception as e:
        return {
            "answer": f"Retrieved relevant documents, but encountered an issue generating full response: {str(e)}",
            "sources": sources,
            "found": True
        }
