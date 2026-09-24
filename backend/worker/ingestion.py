import json
import logging
import fitz  # PyMuPDF
from fastembed import TextEmbedding

from app.db.session import pool
from app.providers.storage import StorageProvider
from app.core.config import get_settings

logger = logging.getLogger(__name__)

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
        file_path = str(storage.get_path(file_key))
        
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
            if valid_chunks:
                embeddings = list(model.embed([c["content"] for c in valid_chunks]))
                
                insert_data = []
                for idx, (chunk_dict, embedding) in enumerate(zip(valid_chunks, embeddings)):
                    insert_data.append((
                        doc_id, ver_id, idx, chunk_dict["content"], chunk_dict["page"], 
                        embedding.tolist(), model_name
                    ))
                    
                conn.cursor().executemany(
                    """
                    INSERT INTO chunks (document_id, version_id, chunk_index, content, page, embedding, embedding_model)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    insert_data
                )
                
            # Mark success
            conn.execute(
                "UPDATE document_versions SET status='indexed', is_active=true WHERE id=%s",
                (ver_id,)
            )
            
        except Exception as e:
            logger.error(f"Ingestion failed for version {ver_id}: {e}")
            try:
                with pool().connection() as err_conn:
                    err_conn.execute(
                        "UPDATE document_versions SET status='failed', error=%s WHERE id=%s",
                        (str(e), ver_id)
                    )
            except Exception:
                pass
            raise e
