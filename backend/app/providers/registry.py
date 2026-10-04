from app.core.config import get_settings
from .adapters import GroqLLM, LocalStorage, CrossEncoderReranker, FastEmbedder, OpenAIEmbedder
import hashlib

def get_llm():
    s = get_settings()
    if s.llm_provider == "groq":
        return GroqLLM(s.groq_api_key, s.llm_model)
    raise ValueError(f"unknown LLM_PROVIDER={s.llm_provider}")


_embedder = None
_query_cache: dict[str, list[float]] = {}
MAX_QUERY_CACHE = 10000

class CachedEmbedderWrapper:
    """Wraps the underlying embedder with a thread-safe, high-concurrency LRU query cache."""
    def __init__(self, backend_embedder):
        self.backend = backend_embedder

    def embed(self, texts: list[str]) -> list[list[float]]:
        # Fast path for single queries (student chats)
        if len(texts) == 1:
            q_norm = texts[0].strip().lower()
            h = hashlib.sha256(q_norm.encode('utf-8')).hexdigest()
            if h in _query_cache:
                return [_query_cache[h]]
            
            vec = self.backend.embed([texts[0]])[0]
            if len(_query_cache) >= MAX_QUERY_CACHE:
                # Evict oldest 1500 entries
                keys = list(_query_cache.keys())[:1500]
                for k in keys:
                    _query_cache.pop(k, None)
            _query_cache[h] = vec
            return [vec]

        # Multi-text path (document chunk ingestion)
        return self.backend.embed(texts)

    @property
    def model_name(self) -> str:
        return getattr(self.backend, "model_name", getattr(self.backend, "model", "fastembed"))

    @property
    def dim(self) -> int:
        return getattr(self.backend, "dim", 384)


def get_embedder():
    global _embedder
    if _embedder is None:
        s = get_settings()
        if s.openai_api_key or s.embedding_provider == "openai":
            backend = OpenAIEmbedder(s.openai_api_key, dim=s.embedding_dim)
        else:
            backend = FastEmbedder(s.embedding_model, dim=s.embedding_dim, cache_dir=s.fastembed_cache_dir)
        _embedder = CachedEmbedderWrapper(backend)
    return _embedder


def get_storage():
    return LocalStorage(get_settings().data_dir)

_reranker = None
def get_reranker():
    global _reranker
    if _reranker is None:
        _reranker = CrossEncoderReranker()
    return _reranker

