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

def extract_and_chunk(file_path: str, mime_type: str, chunk_size: int = 500, overlap: int = 50) -> list[dict]:
    chunks = []
    file_path_str = str(file_path)
    
    if mime_type and mime_type.startswith('image/'):
        from PIL import Image
        import pytesseract
        img = Image.open(file_path_str)
        text = pytesseract.image_to_string(img, lang='eng+hin')
        words = text.split()
        i = 0
        while i < len(words):
            chunks.append({"content": " ".join(words[i:i + chunk_size]), "page": 1})
            i += chunk_size - overlap
        return chunks

    # Handle plain text files
    if file_path_str.endswith('.txt') or (mime_type and mime_type.startswith('text/')):
        with open(file_path_str, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()
        words = text.split()
        i = 0
        while i < len(words):
            chunks.append({"content": " ".join(words[i:i + chunk_size]), "page": 1})
            i += chunk_size - overlap
        return chunks

    # Handle Microsoft Word (.docx) documents
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
        words = full_text.split()
        i = 0
        page_approx = 1
        while i < len(words):
            chunks.append({"content": " ".join(words[i:i + chunk_size]), "page": page_approx})
            i += chunk_size - overlap
            if len(chunks) % 2 == 0:
                page_approx += 1
        return chunks
        
    doc = fitz.open(file_path)
    current_chunk = []
    current_page = 1
    
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
            blocks = [{"text": page_text}]
        else:
            raw_blocks = page.get_text("blocks")
            # Sort top to bottom, left to right
            raw_blocks.sort(key=lambda b: (b[1], b[0]))
            blocks = [{"text": b[4]} for b in raw_blocks if b[6] == 0]
            
        for b in blocks:
            block_text = b["text"].strip()
            if not block_text:
                continue
                
            block_words = block_text.split()
            
            # If block is huge, split it
            if len(block_words) > chunk_size:
                if current_chunk:
                    chunks.append({"content": " ".join(current_chunk), "page": current_page})
                    current_chunk = []
                
                i = 0
                while i < len(block_words):
                    chunks.append({"content": " ".join(block_words[i:i + chunk_size]), "page": actual_page_num})
                    i += chunk_size - overlap
            else:
                # If adding block exceeds size, flush
                if len(current_chunk) + len(block_words) > chunk_size:
                    chunks.append({"content": " ".join(current_chunk), "page": current_page})
                    # New chunk starts with overlap from previous
                    current_chunk = current_chunk[-overlap:] + block_words
                    current_page = actual_page_num
                else:
                    if not current_chunk:
                        current_page = actual_page_num
                    current_chunk.extend(block_words)
                    
    if len(current_chunk) > overlap:
        chunks.append({"content": " ".join(current_chunk), "page": current_page})
        
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
            
            # 1 & 2. Extraction and Chunking
            chunks = extract_and_chunk(file_path, mime_type)
            
            # 3. Embedding and Indexing
            model = get_embed_model()
            model_name = get_settings().embedding_model
            
            valid_chunks = [c for c in chunks if c["content"].strip()]
            all_doc_dates = []
            if valid_chunks:
                embeddings = list(model.embed([c["content"] for c in valid_chunks]))
                
                insert_data = []
                for idx, (chunk_dict, embedding) in enumerate(zip(valid_chunks, embeddings)):
                    chunk_text = chunk_dict["content"]
                    chunk_dates = extract_dates_from_text(chunk_text)
                    for d in chunk_dates:
                        if d not in all_doc_dates:
                            all_doc_dates.append(d)
                    
                    chunk_meta = {
                        "page": chunk_dict["page"],
                        "dates": chunk_dates
                    }
                    
                    insert_data.append((
                        doc_id, ver_id, idx, chunk_text, chunk_dict["page"], 
                        json.dumps(chunk_meta), embedding.tolist(), model_name
                    ))
                    
                conn.cursor().executemany(
                    """
                    INSERT INTO chunks (document_id, version_id, chunk_index, content, page, metadata, embedding, embedding_model)
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s)
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

            # Mark success
            conn.execute(
                "UPDATE document_versions SET status='indexed', is_active=true, error=NULL WHERE id=%s",
                (ver_id,)
            )
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
