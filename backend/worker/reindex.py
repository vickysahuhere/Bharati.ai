import logging
from app.db.session import pool
from app.core.config import get_settings
from app.providers.registry import get_embedder

logger = logging.getLogger(__name__)

def reindex_all_chunks(payload: dict):
    """
    Worker handler to re-calculate vector embeddings for all existing chunks.
    Useful when changing the embedding model or updating vector configs.
    """
    embedder = get_embedder()
    model_name = get_settings().embedding_model

    logger.info(f"Starting reindexing with model: {model_name}")

    with pool().connection() as conn:
        rows = conn.execute("SELECT id, content FROM chunks").fetchall()
        total = len(rows)

        for idx, (chunk_id, content) in enumerate(rows, start=1):
            if not content.strip():
                continue
            embedding = embedder.embed([content])[0]
            conn.execute(
                """
                UPDATE chunks 
                SET embedding = %s, embedding_model = %s 
                WHERE id = %s
                """,
                (embedding, model_name, chunk_id)
            )

        logger.info(f"Successfully reindexed {total} chunks.")
