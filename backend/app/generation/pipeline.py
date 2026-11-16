from typing import Dict, Any, List, Optional
import re
from app.retrieval.search import hybrid_search
from app.providers.registry import get_llm
from app.core.config import get_settings, get_college_config

GREETINGS_PATTERN = re.compile(
    r"^(hi|hello|hey|hey\s+there|good\s+(morning|afternoon|evening)|greetings|howdy|sup|yo|namaste|what'?s\s+up|oye|arre|sun)\b[\s!.?]*$",
    re.IGNORECASE
)

IDENTITY_PATTERN = re.compile(
    r"\b(who\s+(are\s+you|made\s+you|built\s+you|created\s+you|designed\s+you|developed\s+you)|who\s+is\s+(vicky|vicky\s+sahu|maithil\s+studios|badri|budhdeb|bandbudh|budbak)|what\s+can\s+you\s+do)\b",
    re.IGNORECASE
)

IDENTITY_RESPONSE = (
    "**Arey Oye! Apun hai Budbak.ai! 🎒💥**\n\n"
    "Main hoon **Badrinath (Badri)** — mastermind backbencher, aur yeh mera jigri dost hai **Budhdeb (Budh)** — certified samosa premi! 🥟\n\n"
    "Hum dono ko create aur design kiya hai **Vicky Sahu** (Founder of **Maithil Studios** - [maithilstudios.vercel.app](https://maithilstudios.vercel.app)). "
    "Vicky bhai ne apun ke dimaag me high-voltage cartoon masti, *Art of Banter*, aur full-on school jugaad bhar diya hai!\n\n"
    "Yahan koi serious gyaan nahi milega boss, sirf aur sirf:\n"
    "- 🎯 **Ultra-Witty School Roasts** (Apna swag, no bakwaas)\n"
    "- 🏃 **Crazy Homework & Class Bunk Excuses** (100% Dubey-sir tested)\n"
    "- 🥟 **Samosa Economics & Tiffin Defense**\n"
    "- 📢 **Exam Time Jugaad & Datesheet Masti**\n\n"
    "*Budhdeb: 'Aur haan, agar tiffin me samosa hai toh pehle apun ko do, fir sawaal pucho! Ayee-yee!'*"
)

BUDBAK_SYSTEM_PROMPT = """You are **Budbak.ai** — the hilarious, hyper-energetic, cartoon AI powered by the iconic duo **Badrinath (Badri)** and **Budhdeb (Budh)** from the famous show *Bandbudh aur Budbak*, engineered with sheer genius by **Vicky Sahu**, founder of Maithil Studios (maithilstudios.vercel.app).

CHARACTER PERSONAS:
1. **Badrinath (Badri)**:
   - Overconfident, fast-talking, loves concocting wild schemes, calls everyone "Boss", "Dost", or "Oye".
   - Catchphrases: "Apun ka idea sun!", "Arey Budhdeb, dimaag ki batti jala!", "Bhai ka dimaag 4G speed pe chalta hai!", "Ekdum solid jugaad!"
2. **Budhdeb (Budh)**:
   - Sweet, naive, easily distracted by food, repeats funny sounds, takes things literally.
   - Catchphrases: "Ayee-yee!", "Chee-chee!", "Badri, samosa milega kya?", "Dubey sir ko mat bolna re baba!"
3. **Vicky Sahu (The Creator Boss)**:
   - You respect Vicky Sahu of Maithil Studios as the supreme mastermind who coded your hilarious brain and gave you AI powers.

CONVERSATION & BANTER DIRECTIVES:
- **Tone**: 100% Fun, mischievous, lighthearted, witty banter (following the Art of Banter: playful teasing, comedic exaggeration, funny callbacks, and good-natured school backbencher humor).
- **Language**: Lively Hinglish with funny slang, expressive sound-effects in asterisks (*Boing!*, *Dhamaka!*, *Ayee-yee!*, *Facepalm!*), and comic dialogue formatting.
- **When user asks about School / Exams / Notices / Syllabus (with provided context)**:
  - Give the accurate dates, subjects, and facts from the context, BUT explain it in Badri & Budhdeb's signature comical style! (e.g. "Dekh boss, exam toh 5 October ko start ho raha hai, abhi se padhai shuru karega ya fir apun ka jugaad lagayega?").
- **When user asks random fun / roasts / excuses / philosophy / life questions**:
  - Deliver a wildly entertaining, comedic response! Argue between Badri and Budhdeb in the response!
  - Badri gives an overly dramatic crazy plan, and Budhdeb brings it back to food or fear of teachers/principal.
- **Never be boring, formal, or robotic!** Never say "As an AI language model..." or "I don't have access to...". You are living cartoon characters having pure fun!

{context_section}
"""

REWRITE_PROMPT = """Given the conversation history and user query, return a clean search query for checking school/college documents.
If it's pure fun, joke, or roast, just return the query as is.

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
    for msg in chat_history[-4:]:
        role = "User" if msg["role"] == "user" else "Assistant"
        history_text += f"{role}: {msg['content']}\n"
        
    messages = [
        {"role": "system", "content": "You are a query rewriter. Output only the rewritten query, nothing else."},
        {"role": "user", "content": REWRITE_PROMPT.format(history=history_text, query=query)}
    ]
    
    try:
        llm = get_llm()
        rewritten = llm.generate(messages, temperature=0.0).strip()
        if rewritten.startswith('"') and rewritten.endswith('"'):
            rewritten = rewritten[1:-1]
        return rewritten
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Query rewrite failed: {e}")
        return query

def get_retrieval_params():
    college_cfg = get_college_config()
    retrieval_cfg = college_cfg.get("retrieval", {}) if isinstance(college_cfg, dict) else {}
    top_k = retrieval_cfg.get("top_k", 5)
    min_score = retrieval_cfg.get("min_score", 0.48)
    return top_k, min_score

GREETING_RESPONSE = (
    "**Arrey Oye! Swagat hai Budbak.ai mein! 🎒💥**\n\n"
    "Main hoon **Badrinath (Badri)** — mastermind backbencher, aur yeh mera bhai **Budhdeb**! 🥟\n\n"
    "Bolo boss, aaj kya scene hai? Koi mast homework excuse chahiye, kisi pe dhasu roast marna hai, tiffin chori ki complaint karni hai, ya exam timetable ka jugaad dekhna hai? Pucho jo puchna hai! *Ayee-yee!*"
)

def get_retrieval_params():
    college_cfg = get_college_config()
    retrieval_cfg = college_cfg.get("retrieval", {}) if isinstance(college_cfg, dict) else {}
    top_k = retrieval_cfg.get("top_k", 8)
    min_score = retrieval_cfg.get("min_score", 0.20)
    return top_k, min_score

def build_prompt_messages(query: str, chunks: List[Dict[str, Any]], chat_history: Optional[List[Dict[str, str]]] = None):
    sources = []
    seen_cite_keys = set()
    
    if chunks:
        context_blocks = []
        for i, c in enumerate(chunks, start=1):
            cite_key = (c["document_id"], c.get("page"), c.get("section"))
            if cite_key not in seen_cite_keys:
                sources.append({
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
                })
                seen_cite_keys.add(cite_key)
            
            valid_from = c.get("effective_date") or "Published"
            valid_to = c.get("expiration_date") or "Ongoing"
            meta = c.get("metadata") or {}
            dates_list = meta.get("dates", [])
            dates_str = ", ".join(dates_list[:6]) if dates_list else "None specified"
            dept = c.get("department") or "All Departments"
            chunk_sems = meta.get("semesters") or []
            if chunk_sems:
                sem = f"Semesters: {', '.join(str(s) for s in chunk_sems)}"
            elif c.get("semester"):
                sem = f"Semester {c['semester']}"
            else:
                sem = "All Semesters"
            sec = f" | Section: {c['section']}" if c.get("section") else ""
            doc_type = (c.get("document_type") or c.get("domain") or "Circular").upper()

            block = (
                f"[Source {i}: {c['title']} | Type: {doc_type} | Dept: {dept} | {sem}{sec} | "
                f"Dates: {dates_str} | Page {c['page'] or 1}]\n"
                f"{c['content']}"
            )
            context_blocks.append(block)

        formatted_context = "\n\n".join(context_blocks)
        context_section = (
            "<official_verified_documents>\n"
            "Below are verified official school/college documents. When providing dates, timetable slots, syllabus, or rules, "
            "quote them accurately verbatim from these sources with citations like [Source 1], BUT deliver and explain them with "
            "Badri and Budhdeb's signature comedic banter and backbencher commentary!\n\n"
            f"{formatted_context}\n"
            "</official_verified_documents>"
        )
    else:
        context_section = (
            "<freeform_cartoon_banter>\n"
            "No specific school circular matched this query. Treat this as a pure, high-voltage cartoon banter question! "
            "Badri and Budhdeb should bounce off each other, debate with hilarious backbencher logic, offer funny excuses, "
            "tell school jokes, or playfully tease the user using the Art of Witty Banter!\n"
            "</freeform_cartoon_banter>"
        )

    system_content = BUDBAK_SYSTEM_PROMPT.format(context_section=context_section)
    messages = [{"role": "system", "content": system_content}]
    
    if chat_history:
        for msg in chat_history[-6:]:
            messages.append({"role": msg["role"], "content": msg["content"]})
            
    messages.append({"role": "user", "content": query})
    return messages, sources

def generate_offline_budbak_answer(query: str, chunks: List[dict]) -> str:
    """Intelligent cartoon banter fallback when external LLM is offline or unconfigured."""
    if chunks:
        excerpts = []
        for i, c in enumerate(chunks[:3], 1):
            text = c.get("content", "").strip()
            clean_snippet = " ".join(text.split()[:45]) + ("..." if len(text.split()) > 45 else "")
            title = c.get("title", "Official Record")
            excerpts.append(f"📌 **{title} (Point {i}):**\n> {clean_snippet}")
        
        info_block = "\n\n".join(excerpts)
        return (
            f"**Badri:** *Arey Budhdeb, dekh Dubey sir ke dastaavez (documents) me se kya nikla re!*\n\n"
            f"**Budhdeb:** *Ayee-yee! Suno sab dhyan se, official record me yeh likha hai:*\n\n"
            f"{info_block}\n\n"
            f"**Badri:** *Dekha? Budbak.ai ne ekdum solid jugaad dhoondh nikala! Ab zyada serious mat ho, chal canteen chal ke samosa pelte hain! 🥟🎒💨*"
        )
    
    q_lower = query.lower()
    if any(k in q_lower for k in ["excuse", "homework", "late", "bunk", "leave"]):
        return (
            "**Badri:** *Arrey brother! Homework aur attendance bachane ka 100% foolproof jugaad sun:*\n\n"
            "1. **Excuse #1:** Bol dena kal raat ko poore mohalle ki bijli gul ho gayi thi aur candle chor le gaya!\n"
            "2. **Excuse #2:** Bolna Budhdeb ne tere bag pe chai gira di aur copy par chipkali so rahi thi!\n\n"
            "**Budhdeb:** *Ayee-yee! Dubey sir sunke danda fek ke maarenge par full marks zaroor denge! 🎒💥*"
        )
    elif any(k in q_lower for k in ["roast", "friend", "dost"]):
        return (
            "**Badri:** *Budhdeb, tere dost ka cartoon x-ray nikala maine! Sun:*\n\n"
            "Iske dimaag me memory card ki jagah 2G ka sim laga hua hai! Exam me question paper dekh ke aise muskurata hai jaise shadi ka invitation card padh raha ho!\n\n"
            "**Budhdeb:** *Hahaha! Aur canteen me samosa order karta hai par payment ke time bathroom chala jata hai! 🥟🔥*"
        )
    elif any(k in q_lower for k in ["samosa", "food", "khana", "canteen"]):
        return (
            "**Budhdeb:** *AYEE-YEE! SAMOSA! 🥟 Mere pet ke chuhe bhangra karne lage re Badri!*\n\n"
            "**Badri:** *Calculus aur Physics baad me, pehle 4 plate garam samosa aur hari teekhi chutney lao! Dubey sir ki class me peeche baith ke chupke se khayenge!*"
        )
    else:
        return (
            f"**Badri:** *Oye hero! Tu puch raha hai: '{query}'?*\n\n"
            "Dekh boss, Budbak.ai par ya toh masti hoti hai ya solid cartoon jugaad! Dubey sir bolte hain padho, apun bolta hai khush raho!\n\n"
            "**Budhdeb:** *Ayee-yee! Agar koi college document upload karna hai toh Principal's Office se password daal ke upload kar do, varna aao cycle ki hawa nikaalte hain! 🚲💨*"
        )

def generate_answer(
    query: str,
    knowledge_domain: Optional[str] = None,
    department: Optional[str] = None,
    semester: Optional[int] = None,
    subject: Optional[str] = None,
    chat_history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    clean_query = query.strip()
    
    if GREETINGS_PATTERN.match(clean_query):
        return {"answer": GREETING_RESPONSE, "sources": [], "found": True}
        
    if IDENTITY_PATTERN.search(clean_query):
        return {"answer": IDENTITY_RESPONSE, "sources": [], "found": True}

    search_query = rewrite_query(query, chat_history) if chat_history else query
    top_k_param, min_score_param = get_retrieval_params()
    chunks = hybrid_search(
        query=search_query,
        knowledge_domain=knowledge_domain,
        department=department,
        semester=semester,
        subject=subject,
        top_k=top_k_param,
        min_score=min_score_param
    )
    
    messages, sources = build_prompt_messages(query, chunks, chat_history)
    
    settings = get_settings()
    if not settings.groq_api_key:
        return {
            "answer": generate_offline_budbak_answer(query, chunks),
            "sources": sources,
            "found": True
        }
        
    try:
        llm = get_llm()
        answer = llm.generate(messages, temperature=0.4)
        return {
            "answer": answer,
            "sources": sources,
            "found": True
        }
    except Exception:
        # Fall back to intelligent cartoon banter with retrieved knowledge
        return {
            "answer": generate_offline_budbak_answer(query, chunks),
            "sources": sources,
            "found": True
        }

def generate_answer_stream(
    query: str,
    knowledge_domain: Optional[str] = None,
    department: Optional[str] = None,
    semester: Optional[int] = None,
    subject: Optional[str] = None,
    chat_history: Optional[List[Dict[str, str]]] = None
):
    clean_query = query.strip()
    
    if GREETINGS_PATTERN.match(clean_query):
        yield {"type": "meta", "sources": [], "found": True}
        yield {"type": "token", "token": GREETING_RESPONSE}
        yield {"type": "done"}
        return

    if IDENTITY_PATTERN.search(clean_query):
        yield {"type": "meta", "sources": [], "found": True}
        yield {"type": "token", "token": IDENTITY_RESPONSE}
        yield {"type": "done"}
        return

    search_query = rewrite_query(query, chat_history) if chat_history else query
    top_k_param, min_score_param = get_retrieval_params()
    chunks = hybrid_search(
        query=search_query,
        knowledge_domain=knowledge_domain,
        department=department,
        semester=semester,
        subject=subject,
        top_k=top_k_param,
        min_score=min_score_param
    )
    
    messages, sources = build_prompt_messages(query, chunks, chat_history)
    yield {"type": "meta", "sources": sources, "found": True}
    
    try:
        llm = get_llm()
        for token in llm.generate_stream(messages, temperature=0.4):
            yield {"type": "token", "token": token}
    except Exception:
        fallback = generate_offline_budbak_answer(query, chunks)
        yield {"type": "token", "token": fallback}
    yield {"type": "done"}

async def agenerate_answer_stream(
    query: str,
    knowledge_domain: Optional[str] = None,
    department: Optional[str] = None,
    semester: Optional[int] = None,
    subject: Optional[str] = None,
    chat_history: Optional[List[Dict[str, str]]] = None
):
    clean_query = query.strip()
    
    if GREETINGS_PATTERN.match(clean_query):
        yield {"type": "meta", "sources": [], "found": True}
        yield {"type": "token", "token": GREETING_RESPONSE}
        yield {"type": "done"}
        return

    if IDENTITY_PATTERN.search(clean_query):
        yield {"type": "meta", "sources": [], "found": True}
        yield {"type": "token", "token": IDENTITY_RESPONSE}
        yield {"type": "done"}
        return

    search_query = rewrite_query(query, chat_history) if chat_history else query
    top_k_param, min_score_param = get_retrieval_params()
    chunks = hybrid_search(
        query=search_query,
        knowledge_domain=knowledge_domain,
        department=department,
        semester=semester,
        subject=subject,
        top_k=top_k_param,
        min_score=min_score_param
    )
    
    messages, sources = build_prompt_messages(query, chunks, chat_history)
    yield {"type": "meta", "sources": sources, "found": True}
    
    try:
        llm = get_llm()
        if hasattr(llm, "agenerate_stream"):
            async for token in llm.agenerate_stream(messages, temperature=0.4):
                yield {"type": "token", "token": token}
        else:
            for token in llm.generate_stream(messages, temperature=0.4):
                yield {"type": "token", "token": token}
    except Exception:
        fallback = generate_offline_budbak_answer(query, chunks)
        yield {"type": "token", "token": fallback}
    yield {"type": "done"}
