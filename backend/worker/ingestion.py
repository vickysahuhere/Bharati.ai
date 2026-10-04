import json
import logging
import re
from datetime import datetime
from typing import Optional, List
import fitz  # PyMuPDF
from fastembed import TextEmbedding

from app.db.session import pool
from app.providers.storage import StorageProvider
from app.core.config import get_settings

logger = logging.getLogger(__name__)

MONTH_MAP = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
    'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9, 'oct': 10, 'october': 10,
    'nov': 11, 'november': 11, 'dec': 12, 'december': 12
}

DATE_REGEXES = [
    re.compile(r'\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2})\b'),
    re.compile(r'\b(\d{1,2}[-/\.]\d{1,2}[-/\.]20\d{2})\b'),
    re.compile(r'\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+20\d{2})\b', re.IGNORECASE),
    re.compile(r'\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+20\d{2})\b', re.IGNORECASE),
]

def extract_dates_from_text(text: str) -> List[str]:
    found = []
    for rgx in DATE_REGEXES:
        for match in rgx.findall(text):
            m_str = match.strip()
            if m_str not in found:
                found.append(m_str)
    return found[:12]

def parse_date_to_iso(date_str: str) -> Optional[str]:
    clean = re.sub(r'(st|nd|rd|th|,)', '', date_str).strip()
    m1 = re.match(r'^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$', clean)
    if m1:
        y, m, d = int(m1.group(1)), int(m1.group(2)), int(m1.group(3))
        if 1 <= m <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"
    m2 = re.match(r'^(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{4})$', clean)
    if m2:
        d, m, y = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
        if 1 <= m <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"
    m3 = re.match(r'^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$', clean)
    if m3:
        d, mon_str, y = int(m3.group(1)), m3.group(2).lower(), int(m3.group(3))
        m = MONTH_MAP.get(mon_str)
        if m and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"
    m4 = re.match(r'^([a-zA-Z]+)\s+(\d{1,2})\s+(\d{4})$', clean)
    if m4:
        mon_str, d, y = m4.group(1).lower(), int(m4.group(2)), int(m4.group(3))
        m = MONTH_MAP.get(mon_str)
        if m and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"
    return None

# Lazy-load to avoid initializing during import if not needed
embedding_model = None

def get_embed_model():
    global embedding_model
    if embedding_model is None:
        model_name = get_settings().embedding_model
        embedding_model = TextEmbedding(model_name=model_name)
    return embedding_model

storage = StorageProvider()

ROMAN_SEMESTERS = {
    'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8
}

def extract_semesters(text: str) -> List[int]:
    found = set()
    # 1. "Semester 1", "Sem 3", "Sem. 5", "Semester III"
    for m in re.finditer(r'\b(?:Semester|Sem\.?)\s*([1-8]|I|II|III|IV|V|VI|VII|VIII)\b', text, re.IGNORECASE):
        val = m.group(1).lower()
        if val in ROMAN_SEMESTERS:
            found.add(ROMAN_SEMESTERS[val])
        elif val.isdigit():
            found.add(int(val))
            
    # 2. "1st Semester", "3rd Sem", "5th Semester", "1st Sem"
    for m in re.finditer(r'\b([1-8])(?:st|nd|rd|th)?\s*(?:Semester|Sem)\b', text, re.IGNORECASE):
        found.add(int(m.group(1)))
        
    # 3. Course codes: "BCA-101", "BCA-302", "BCA-504", "MCA-101", "CS-301"
    for m in re.finditer(r'\b[A-Za-z]{2,5}[-_ ]?([1-8])\d{2}\b', text):
        found.add(int(m.group(1)))
        
    return sorted(list(found))

HEADING_KEYWORDS = [
    'semester', 'sem', 'datesheet', 'timetable', 'examination', 'guidelines',
    'rules', 'instructions', 'ordinance', 'admissions', 'eligibility', 'syllabus',
    'notification', 'notice', 'schedule'
]

PRIMARY_HEADING_KEYWORDS = [
    'datesheet', 'timetable', 'schedule', 'guidelines', 'rules', 'instructions',
    'semester 1', 'semester 2', 'semester 3', 'semester 4', 'semester 5', 'semester 6', 'semester 7', 'semester 8',
    'sem 1', 'sem 2', 'sem 3', 'sem 4', 'sem 5', 'sem 6', 'sem 7', 'sem 8'
]

HEADER_SKIP_PREFIXES = ('ref.', 'ref no', 'ref:', 'notification date:', 'department of', 'date:', 'academic session:')

def clean_title(title: str) -> str:
    cleaned = re.sub(r'^[0-9\.\-\:\#\*\s]+', '', title).strip()
    # Strip leading "OFFICIAL NOTIFICATION:" if present for clean display
    cleaned = re.sub(r'^OFFICIAL NOTIFICATION:\s*', '', cleaned, flags=re.IGNORECASE).strip()
    return cleaned[:100]

def detect_section_title(lines: List[str], fallback_page_num: int = 1) -> str:
    candidate_lines = []
    for line in lines[:15]:
        line_clean = line.strip()
        if not line_clean or len(line_clean) < 4 or len(line_clean) > 130:
            continue
        line_lower = line_clean.lower()
        if any(line_lower.startswith(p) for p in HEADER_SKIP_PREFIXES):
            continue
        candidate_lines.append(line_clean)
        
    # 1. First priority: lines matching primary keywords (semester, datesheet, timetable, guidelines, rules)
    for line in candidate_lines:
        line_lower = line.lower()
        if any(kw in line_lower for kw in PRIMARY_HEADING_KEYWORDS):
            return clean_title(line)
            
    # 2. Second priority: any line with general heading keywords
    for line in candidate_lines:
        line_lower = line.lower()
        if any(kw in line_lower for kw in HEADING_KEYWORDS):
            return clean_title(line)
            
    # 3. Third priority: Markdown headings or all-caps lines
    for line in candidate_lines[:8]:
        if line.startswith('#'):
            return clean_title(line.lstrip('#').strip())
        if line.isupper() and 6 <= len(line) <= 90:
            return clean_title(line)
            
    # 4. Fallback to first valid candidate line
    if candidate_lines:
        return clean_title(candidate_lines[0])
            
    return f"Page {fallback_page_num} Overview"

def extract_and_chunk(file_path: str, mime_type: str, chunk_size: int = 500, overlap: int = 50) -> list[dict]:
    chunks = []
    file_path_str = str(file_path)
    
    # 1. Handle Images (OCR)
    if mime_type and mime_type.startswith('image/'):
        from PIL import Image
        import pytesseract
        img = Image.open(file_path_str)
        text = pytesseract.image_to_string(img, lang='eng+hin')
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        sec = detect_section_title(lines, 1)
        sems = extract_semesters(text)
        words = text.split()
        if len(words) <= chunk_size + 60:
            chunks.append({"content": text, "page": 1, "section": sec, "semesters": sems})
        else:
            i = 0
            while i < len(words):
                slice_text = " ".join(words[i:i + chunk_size])
                chunks.append({
                    "content": slice_text, 
                    "page": 1, 
                    "section": sec, 
                    "semesters": extract_semesters(slice_text)
                })
                i += chunk_size - overlap
        return chunks

    # 2. Handle Plain Text files
    if file_path_str.endswith('.txt') or (mime_type and mime_type.startswith('text/')):
        with open(file_path_str, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        current_chunk_blocks = []
        current_words_count = 0
        current_section = None
        
        for p in paragraphs:
            p_lines = [l.strip() for l in p.split('\n') if l.strip()]
            p_sec = detect_section_title(p_lines, 1)
            p_words = p.split()
            
            if current_chunk_blocks and (current_words_count + len(p_words) > chunk_size or (p_sec != current_section and any(kw in p_lines[0].lower() for kw in HEADING_KEYWORDS))):
                block_content = "\n\n".join(current_chunk_blocks)
                chunks.append({
                    "content": block_content,
                    "page": 1,
                    "section": current_section or "Main Section",
                    "semesters": extract_semesters(block_content)
                })
                current_chunk_blocks = []
                current_words_count = 0
                
            if not current_chunk_blocks:
                current_section = p_sec
            current_chunk_blocks.append(p)
            current_words_count += len(p_words)
            
        if current_chunk_blocks:
            block_content = "\n\n".join(current_chunk_blocks)
            chunks.append({
                "content": block_content,
                "page": 1,
                "section": current_section or "Main Section",
                "semesters": extract_semesters(block_content)
            })
        return chunks

    # 3. Handle Microsoft Word (.docx) documents
    if file_path_str.endswith('.docx') or (mime_type and 'wordprocessingml' in mime_type):
        import docx
        doc = docx.Document(file_path_str)
        blocks = []
        for p in doc.paragraphs:
            if p.text.strip():
                blocks.append(p.text.strip())
        for table in doc.tables:
            for row in table.rows:
                row_str = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_str:
                    blocks.append(row_str)
        
        full_text = "\n\n".join(blocks)
        doc_lines = [b for b in blocks if len(b) < 120]
        sec = detect_section_title(doc_lines, 1)
        words = full_text.split()
        if len(words) <= chunk_size + 60:
            chunks.append({"content": full_text, "page": 1, "section": sec, "semesters": extract_semesters(full_text)})
        else:
            i = 0
            page_approx = 1
            while i < len(words):
                slice_text = " ".join(words[i:i + chunk_size])
                slice_lines = [l.strip() for l in slice_text.split('\n') if l.strip()]
                slice_sec = detect_section_title(slice_lines, page_approx)
                chunks.append({
                    "content": slice_text,
                    "page": page_approx,
                    "section": slice_sec,
                    "semesters": extract_semesters(slice_text)
                })
                i += chunk_size - overlap
                if len(chunks) % 2 == 0:
                    page_approx += 1
        return chunks
        
    # 4. Handle PDF Documents (Page & Section-Aware)
    doc = fitz.open(file_path)
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        actual_page_num = page_num + 1
        
        text = page.get_text()
        if len(text.strip()) < 50:
            import pytesseract
            from PIL import Image
            page_text = ""
            for img_info in page.get_images(full=True):
                xref = img_info[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                import io
                img = Image.open(io.BytesIO(image_bytes))
                page_text += pytesseract.image_to_string(img, lang='eng+hin') + "\n"
            blocks = [{"text": page_text.strip()}]
        else:
            raw_blocks = page.get_text("blocks")
            # Sort top to bottom, left to right
            raw_blocks.sort(key=lambda b: (b[1], b[0]))
            blocks = [{"text": b[4].strip()} for b in raw_blocks if b[6] == 0 and b[4].strip()]
            
        if not blocks:
            continue

        # Extract structured Markdown tables if PyMuPDF table detection is available
        table_md_blocks = []
        if hasattr(page, "find_tables"):
            try:
                tabs = page.find_tables()
                if tabs and getattr(tabs, "tables", None):
                    for tab in tabs.tables:
                        df_rows = tab.extract()
                        if df_rows and len(df_rows) >= 2:
                            header = [str(c or "").replace("\n", " ").strip() for c in df_rows[0]]
                            if any(header):
                                md_lines = [
                                    "| " + " | ".join(header) + " |",
                                    "| " + " | ".join(["---"] * len(header)) + " |"
                                ]
                                for row in df_rows[1:]:
                                    clean_cells = [str(c or "").replace("\n", " ").strip() for c in row]
                                    if any(clean_cells):
                                        md_lines.append("| " + " | ".join(clean_cells) + " |")
                                table_md_blocks.append("\n".join(md_lines))
            except Exception as e:
                logger.debug(f"Table detection skipped or not supported on page {actual_page_num}: {e}")
            
        page_lines = [line.strip() for b in blocks for line in b["text"].split("\n") if line.strip()]
        page_section = detect_section_title(page_lines, actual_page_num)
        page_full_text = "\n\n".join(b["text"] for b in blocks)
        if table_md_blocks:
            page_full_text = page_full_text + "\n\n### Official Schedule Tables:\n" + "\n\n".join(table_md_blocks)
        page_words = page_full_text.split()
        
        if not page_words:
            continue
            
        # Treat each page as a semantic container:
        # If the page fits within chunk_size (+ margin), keep it intact as a complete chunk!
        if len(page_words) <= chunk_size + 60:
            semesters = extract_semesters(page_full_text)
            chunks.append({
                "content": page_full_text,
                "page": actual_page_num,
                "section": page_section,
                "semesters": semesters
            })
        else:
            # Multi-chunk page if page is huge
            i = 0
            part = 1
            while i < len(page_words):
                chunk_slice = " ".join(page_words[i:i + chunk_size])
                semesters = extract_semesters(chunk_slice)
                sub_sec = f"{page_section} (Part {part})" if part > 1 else page_section
                chunks.append({
                    "content": chunk_slice,
                    "page": actual_page_num,
                    "section": sub_sec,
                    "semesters": semesters
                })
                i += chunk_size - overlap
                part += 1
                
    return chunks

def ingest_version(payload: dict):
    doc_id = payload['document_id']
    ver_id = payload['version_id']
    
    with pool().connection() as conn:
        conn.execute("UPDATE document_versions SET status='processing' WHERE id=%s", (ver_id,))
        
        row = conn.execute(
            "SELECT file_key FROM document_versions WHERE id=%s", (ver_id,)
        ).fetchone()
        
        if not row:
            raise ValueError(f"Version {ver_id} not found")
            
        file_key = row[0]
        file_path_obj = storage.ensure_file_on_disk(file_key, conn)
        if not file_path_obj.exists() or file_path_obj.stat().st_size == 0:
            raise FileNotFoundError(f"File {file_key} is not found on disk or in the database. Please re-upload this document.")
        file_path = str(file_path_obj)
        
        try:
            # Clear old chunks for idempotency
            conn.execute("DELETE FROM chunks WHERE version_id = %s", (ver_id,))
            
            import mimetypes
            mime_type, _ = mimetypes.guess_type(file_path)
            
            # 1 & 2. Extraction and Chunking (Page & Section-Aware)
            chunks = extract_and_chunk(file_path, mime_type)
            
            # 3. Embedding and Indexing
            model = get_embed_model()
            model_name = get_settings().embedding_model
            
            valid_chunks = [c for c in chunks if c["content"].strip()]
            all_doc_dates = []
            all_doc_semesters = set()
            
            if valid_chunks:
                embeddings = list(model.embed([c["content"] for c in valid_chunks]))
                
                insert_data = []
                for idx, (chunk_dict, embedding) in enumerate(zip(valid_chunks, embeddings)):
                    chunk_text = chunk_dict["content"]
                    chunk_dates = extract_dates_from_text(chunk_text)
                    for d in chunk_dates:
                        if d not in all_doc_dates:
                            all_doc_dates.append(d)
                            
                    chunk_semesters = chunk_dict.get("semesters", [])
                    for s in chunk_semesters:
                        all_doc_semesters.add(s)
                        
                    chunk_section = chunk_dict.get("section")
                    
                    chunk_meta = {
                        "page": chunk_dict["page"],
                        "section": chunk_section,
                        "dates": chunk_dates,
                        "semesters": chunk_semesters
                    }
                    
                    insert_data.append((
                        doc_id, ver_id, idx, chunk_text, chunk_dict["page"], chunk_section,
                        json.dumps(chunk_meta), embedding.tolist(), model_name
                    ))
                    
                conn.cursor().executemany(
                    """
                    INSERT INTO chunks (document_id, version_id, chunk_index, content, page, section, metadata, embedding, embedding_model)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                    """,
                    insert_data
                )
                
            # Auto-populate effective_date and expiration_date if not explicitly set
            iso_dates = sorted([iso for d in all_doc_dates if (iso := parse_date_to_iso(d))])
            if iso_dates:
                conn.execute(
                    """
                    UPDATE document_versions 
                    SET effective_date = COALESCE(effective_date, %s::date),
                        expiration_date = COALESCE(expiration_date, %s::date)
                    WHERE id = %s
                    """,
                    (iso_dates[0], iso_dates[-1], ver_id)
                )

            # Smart document-level semester resolution:
            # If multiple distinct semesters exist across document chunks (e.g. Sem 1, 3, 5),
            # clear documents.semester to NULL so it acts as an institutional multi-semester circular!
            if len(all_doc_semesters) > 1:
                conn.execute(
                    "UPDATE documents SET semester = NULL WHERE id = %s",
                    (doc_id,)
                )
            elif len(all_doc_semesters) == 1:
                single_sem = list(all_doc_semesters)[0]
                conn.execute(
                    "UPDATE documents SET semester = COALESCE(semester, %s) WHERE id = %s",
                    (single_sem, doc_id)
                )

            # Mark success
            conn.execute(
                "UPDATE document_versions SET status='indexed', is_active=true, error=NULL, file_data=NULL WHERE id=%s",
                (ver_id,)
            )
            # Purge temporary file from local disk to prevent storage bloat
            try:
                storage.delete(file_key)
            except Exception:
                pass

            try:
                conn.execute(
                    "UPDATE jobs SET status='done', last_error=NULL WHERE kind='ingest_version' AND payload->>'version_id'=%s",
                    (str(ver_id),)
                )
            except Exception:
                pass
            
        except Exception as e:
            logger.error(f"Ingestion failed for version {ver_id}: {e}")
            try:
                with pool().connection() as err_conn:
                    err_conn.execute(
                        "UPDATE document_versions SET status='failed', error=%s WHERE id=%s",
                        (str(e), ver_id)
                    )
                    err_conn.execute(
                        "UPDATE jobs SET status='failed', last_error=%s WHERE kind='ingest_version' AND payload->>'version_id'=%s",
                        (str(e), str(ver_id))
                    )
            except Exception:
                pass
            raise e
