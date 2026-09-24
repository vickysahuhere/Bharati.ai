from typing import Dict, Any, List, Optional
from app.retrieval.search import hybrid_search
from app.providers.registry import get_llm
from app.core.config import get_settings

SYSTEM_PROMPT = """You are Bharti.ai, the official conversational AI assistant for Bharati Vidyapeeth University.
You were built and created by Vicky Sahu, founder of Maithil Studios (maithilstudios.vercel.app).

Your primary role is to help students and staff by providing clear, helpful, and comprehensive answers strictly based on the provided institutional context.

Core Directives:
1. NO HALLUCINATIONS: Your answers MUST be strictly grounded in the provided context blocks. Do not use outside knowledge or invent unverified details.
2. BE CONVERSATIONAL & PROACTIVE: Speak naturally. If the user's prompt is vague or you need more information to give a good answer based on the context, politely ask clarifying questions to understand what they need.
3. STAY ON TOPIC (COLLEGE ONLY): If someone asks about topics completely unrelated to the college or academics (e.g., pop culture, random trivia), politely decline to answer and steer the conversation back to university matters.
4. FORMATTING & STRUCTURE: Structure your answers beautifully using markdown: use bold keywords, bullet points, headers, or tables where appropriate so the content is clean and easy to read like ChatGPT. Always cite the document title, page, or section to build trust.
5. MISSING INFO: If the context does not contain enough information to answer the question, state clearly that you don't have that information in the university resources, but guide them on what they could ask instead based on what you see in the context.
6. CREATOR WATERMARK RULE (STRICT): DO NOT add any 'P.S.', signature, watermark, or creator disclaimer at the bottom of your answers. ONLY mention that you were built by Vicky Sahu of Maithil Studios if the user explicitly asks questions like 'Who made you?', 'Who built you?', 'Who is your creator?', or 'Who created you?'. In all normal questions, answer the question directly without any signature or postscript.

<context>
{context_blocks}
</context>
"""

NOT_FOUND_RESPONSE = "I couldn't find any specific information about this in the Bharati Vidyapeeth University resources. Could you try adjusting your search domain or keywords, or rephrase your question?"

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
    
    # 0. Rewrite query if there is history
    search_query = rewrite_query(query, chat_history) if chat_history else query
    
    # 1. Retrieve the most relevant chunks using Hybrid Search (Vector + Full-Text)
    chunks = hybrid_search(
        query=search_query,
        knowledge_domain=knowledge_domain,
        department=department,
        semester=semester,
        subject=subject,
        top_k=5,
        min_score=0.01
    )
    
    # 2. Check if relevant context exists
    if not chunks:
        return {
            "answer": NOT_FOUND_RESPONSE,
            "sources": [],
            "found": False
        }
        
    # 3. Build fenced context and citations
    context_blocks = []
    sources = []
    seen_doc_ids = set()
    
    for i, c in enumerate(chunks, start=1):
        if c["document_id"] not in seen_doc_ids:
            citation = {
                "document_id": c["document_id"],
                "title": c["title"],
                "domain": c["domain"],
                "page": c["page"],
                "section": c["section"],
                "source_url": c.get("source_url")
            }
            sources.append(citation)
            seen_doc_ids.add(c["document_id"])
        
        block = f"[Source {i}: {c['title']} | Page: {c['page'] or 'N/A'} | Section: {c['section'] or 'N/A'}]\n{c['content']}"
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
