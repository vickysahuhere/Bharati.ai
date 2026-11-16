from typing import List, Dict, Any, Optional
import json
import re
from app.db.session import pool
from app.providers.registry import get_embedder

def hybrid_search(
    query: str,
    knowledge_domain: Optional[str] = None,
    department: Optional[str] = None,
    semester: Optional[int] = None,
    subject: Optional[str] = None,
    top_k: int = 5,
    min_score: float = 0.01,
    rrf_k: int = 60
) -> List[Dict[str, Any]]:
    """
    Executes hybrid search combining HNSW vector similarity and tsvector full-text search with RRF.
    """
    with pool().connection() as conn:
        has_chunks = conn.execute("SELECT 1 FROM chunks LIMIT 1").fetchone()
        if not has_chunks:
            return []

    try:
        embedder = get_embedder()
        query_vector = embedder.embed([query])[0]
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Vector embedding failed, will use pure text search: {e}")
        query_vector = None
    
    # Base filter clauses for document status, version status, and optional metadata
    where_clauses = [
        "dv.is_active = true",
        "dv.status = 'indexed'",
        "d.deleted_at IS NULL"
    ]
    params: list = []
    
    if knowledge_domain:
        where_clauses.append("d.knowledge_domain = %s")
        params.append(knowledge_domain)
    if department:
        where_clauses.append("(d.department IS NULL OR d.department = %s)")
        params.append(department)
    if semester:
        where_clauses.append("(d.semester IS NULL OR d.semester = %s OR (c.metadata->'semesters' IS NOT NULL AND c.metadata->'semesters' @> %s::jsonb))")
        params.append(semester)
        params.append(json.dumps([semester]))
    if subject:
        where_clauses.append("(d.subject IS NULL OR d.subject = %s)")
        params.append(subject)

    where_sql = " AND ".join(where_clauses)
    
    fetch_k = top_k * 4
    
    # 1. Vector Search Query
    vec_params = [query_vector] + params + [query_vector, top_k * 2]
    vec_sql = f"""
        SELECT 
            c.id, c.document_id, c.version_id, c.chunk_index, c.content, c.page, c.section, c.metadata,
            d.title, d.knowledge_domain, d.source_url,
            d.department, d.semester, d.subject, d.document_type,
            dv.effective_date, dv.expiration_date,
            1 - (c.embedding <=> %s::vector) AS score
        FROM chunks c
        JOIN document_versions dv ON c.version_id = dv.id
        JOIN documents d ON c.document_id = d.id
        WHERE {where_sql}
        ORDER BY c.embedding <=> %s::vector ASC
        LIMIT %s
    """

    # 2. Full-Text Search Query (indexed content + document metadata + chunk section)
    fts_stop_words = {
        'what', 'whats', 'is', 'the', 'for', 'a', 'an', 'in', 'on', 'at', 'to', 'of',
        'with', 'by', 'are', 'was', 'were', 'tell', 'me', 'about', 'can', 'you', 'give',
        'do', 'does', 'have', 'has'
    }
    raw_words = re.findall(r'[a-zA-Z0-9]+', query.lower())
    content_words = [w for w in raw_words if w not in fts_stop_words]
    fts_clean_query = " ".join(content_words) if content_words else query

    fts_params = [fts_clean_query] + params + [fts_clean_query, top_k * 2]
    fts_sql = f"""
        SELECT 
            c.id, c.document_id, c.version_id, c.chunk_index, c.content, c.page, c.section, c.metadata,
            d.title, d.knowledge_domain, d.source_url,
            d.department, d.semester, d.subject, d.document_type,
            dv.effective_date, dv.expiration_date,
            ts_rank_cd(
                c.tsv || to_tsvector('simple', coalesce(d.title, '') || ' ' || coalesce(d.subject, '') || ' ' || coalesce(d.department, '') || ' ' || coalesce(c.section, '')),
                plainto_tsquery('simple', %s)
            ) AS score
        FROM chunks c
        JOIN document_versions dv ON c.version_id = dv.id
        JOIN documents d ON c.document_id = d.id
        WHERE {where_sql} AND (
            c.tsv || to_tsvector('simple', coalesce(d.title, '') || ' ' || coalesce(d.subject, '') || ' ' || coalesce(d.department, '') || ' ' || coalesce(c.section, ''))
        ) @@ plainto_tsquery('simple', %s)
        ORDER BY score DESC
        LIMIT %s
    """

    chunk_scores: Dict[int, Dict[str, Any]] = {}

    with pool().connection() as conn:
        # Fetch vector results
        if query_vector is not None:
            try:
                vec_rows = conn.execute(vec_sql, vec_params).fetchall()
                for rank, row in enumerate(vec_rows, start=1):
                    chunk_id = row[0]
                    rrf_score = 1.0 / (rrf_k + rank)
                    chunk_scores[chunk_id] = {
                        "id": chunk_id,
                        "document_id": str(row[1]),
                        "version_id": str(row[2]),
                        "chunk_index": row[3],
                        "content": row[4],
                        "page": row[5],
                        "section": row[6],
                        "metadata": row[7] if isinstance(row[7], dict) else {},
                        "title": row[8],
                        "domain": row[9],
                        "source_url": row[10],
                        "department": row[11],
                        "semester": row[12],
                        "subject": row[13],
                        "document_type": row[14],
                        "effective_date": row[15].isoformat() if row[15] else None,
                        "expiration_date": row[16].isoformat() if row[16] else None,
                        "vec_score": row[17],
                        "fts_score": 0.0,
                        "rrf_score": rrf_score
                    }
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Vector search failed: {e}")

        # Fetch FTS results
        try:
            fts_rows = conn.execute(fts_sql, fts_params).fetchall()
            for rank, row in enumerate(fts_rows, start=1):
                chunk_id = row[0]
                rrf_score = 1.0 / (rrf_k + rank)
                if chunk_id in chunk_scores:
                    chunk_scores[chunk_id]["fts_score"] = row[17]
                    chunk_scores[chunk_id]["rrf_score"] += rrf_score
                else:
                    chunk_scores[chunk_id] = {
                        "id": chunk_id,
                        "document_id": str(row[1]),
                        "version_id": str(row[2]),
                        "chunk_index": row[3],
                        "content": row[4],
                        "page": row[5],
                        "section": row[6],
                        "metadata": row[7] if isinstance(row[7], dict) else {},
                        "title": row[8],
                        "domain": row[9],
                        "source_url": row[10],
                        "department": row[11],
                        "semester": row[12],
                        "subject": row[13],
                        "document_type": row[14],
                        "effective_date": row[15].isoformat() if row[15] else None,
                        "expiration_date": row[16].isoformat() if row[16] else None,
                        "vec_score": 0.0,
                        "fts_score": row[17],
                        "rrf_score": rrf_score
                    }
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"FTS search failed: {e}")

    # Reciprocal Rank Fusion (RRF) algorithm:
    sorted_chunks = sorted(chunk_scores.values(), key=lambda x: x["rrf_score"], reverse=True)
    
    # Filter out irrelevant chunks before reranking
    # A candidate chunk must have:
    # 1. An actual full-text keyword match (fts_score > 0), OR
    # 2. A genuine vector similarity (vec_score >= min_vec_threshold)
    min_vec_threshold = min_score
    filtered = [
        c for c in sorted_chunks 
        if c.get("fts_score", 0) > 0 or c.get("vec_score", 0) >= min_vec_threshold
    ]
    
    # RERANKING & SCORING
    if filtered:
        try:
            from app.providers.registry import get_reranker
            reranker = get_reranker()
            texts = [c["content"] for c in filtered]
            scores = reranker.rerank(query, texts)
            
            reranked = []
            for c, s in zip(filtered, scores):
                c["rerank_score"] = s
                # Balance vector/FTS rank with keyword precision so vector relevance is not discarded
                c["final_score"] = (c.get("rrf_score", 0.0) * 10.0) + (s * 0.8)
                
                # Zero-hallucination pruning:
                # If a chunk has zero FTS match AND zero token overlap AND vector similarity is mediocre,
                # it is purely irrelevant noise and would confuse the LLM into hallucinating.
                if c.get("fts_score", 0) <= 0 and s <= 0.0 and c.get("vec_score", 0) < min_score:
                    continue
                reranked.append(c)
                
            filtered = reranked
            filtered.sort(key=lambda x: x.get("final_score", 0.0), reverse=True)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Reranking failed: {e}")

    # Confidence gate: If no chunks survived or top candidate is ungrounded noise, return empty
    if not filtered:
        return []

    top_chunk = filtered[0]
    top_fts = top_chunk.get("fts_score", 0.0)
    top_vec = top_chunk.get("vec_score", 0.0)
    top_rerank = top_chunk.get("rerank_score", 0.0)

    # Require at least one reliable signal on the top result
    if top_fts <= 0 and top_vec < min_score and top_rerank < 0.10:
        return []

    # SIBLING CHUNK EXPANSION:
    # If the user is querying datesheet, timetable, schedule, syllabus, or multiple semesters,
    # and the top result belongs to a verified confident document, include sibling chunks
    # so all semesters (Sem 1, 3, 5) and tables in that document are provided in full.
    if filtered:
        top_version_id = filtered[0]["version_id"]
        q_lower = query.lower()
        needs_full_doc = any(kw in q_lower for kw in [
            'datesheet', 'date sheet', 'timetable', 'schedule', 'exam', 
            'semester', 'sem', 'all', 'routine', 'syllabus', 'fee', 'structure'
        ])
        
        is_confident = (top_fts > 0 or top_vec >= min_score or top_rerank >= 0.15)
        if needs_full_doc and is_confident:
            with pool().connection() as conn:
                try:
                    sibling_rows = conn.execute(
                        """
                        SELECT 
                            c.id, c.document_id, c.version_id, c.chunk_index, c.content, c.page, c.section, c.metadata,
                            d.title, d.knowledge_domain, d.source_url,
                            d.department, d.semester, d.subject, d.document_type,
                            dv.effective_date, dv.expiration_date
                        FROM chunks c
                        JOIN document_versions dv ON c.version_id = dv.id
                        JOIN documents d ON c.document_id = d.id
                        WHERE c.version_id = %s
                        ORDER BY c.page ASC, c.chunk_index ASC
                        LIMIT 10
                        """,
                        (top_version_id,)
                    ).fetchall()

                    existing_ids = {c["id"] for c in filtered}
                    top_score = filtered[0].get("final_score", 1.0)
                    for row in sibling_rows:
                        cid = row[0]
                        if cid not in existing_ids:
                            filtered.append({
                                "id": cid,
                                "document_id": str(row[1]),
                                "version_id": str(row[2]),
                                "chunk_index": row[3],
                                "content": row[4],
                                "page": row[5],
                                "section": row[6],
                                "metadata": row[7] if isinstance(row[7], dict) else {},
                                "title": row[8],
                                "domain": row[9],
                                "source_url": row[10],
                                "department": row[11],
                                "semester": row[12],
                                "subject": row[13],
                                "document_type": row[14],
                                "effective_date": row[15].isoformat() if row[15] else None,
                                "expiration_date": row[16].isoformat() if row[16] else None,
                                "vec_score": 0.5,
                                "fts_score": 0.5,
                                "rrf_score": 0.5,
                                "rerank_score": 0.5,
                                "final_score": top_score * 0.95
                            })
                            existing_ids.add(cid)
                    return filtered[:10]
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f"Sibling expansion failed: {e}")

    return filtered[:top_k]
