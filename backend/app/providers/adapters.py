from pathlib import Path
import httpx


class GroqLLM:
    URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str, model: str):
        self.api_key, self.model = api_key, model

    def generate(self, messages: list[dict], temperature: float = 0.1) -> str:
        import time
        max_retries = 3
        for attempt in range(max_retries):
            r = httpx.post(
                self.URL,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "messages": messages, "temperature": temperature},
                timeout=60,
            )
            if r.status_code == 429 and attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]


class FastEmbedder:
    """Local CPU embeddings: free, no rate limits, college text never leaves the box."""

    def __init__(self, model_name: str, dim: int):
        from fastembed import TextEmbedding
        self.model_name, self.dim = model_name, dim
        self._m = TextEmbedding(model_name)

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [v.tolist() for v in self._m.embed(texts)]


class LocalStorage:
    def __init__(self, root: str):
        self.root = Path(root) / "files"
        self.root.mkdir(parents=True, exist_ok=True)

    def _p(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if not str(p).startswith(str(self.root.resolve())):
            raise ValueError("bad key")
        return p

    def put(self, key: str, data: bytes) -> None:
        p = self._p(key); p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(data)

    def get(self, key: str) -> bytes:
        return self._p(key).read_bytes()

    def delete(self, key: str) -> None:
        self._p(key).unlink(missing_ok=True)


class CrossEncoderReranker:
    def __init__(self, model_name: str = "BAAI/bge-reranker-v2-m3"):
        from sentence_transformers import CrossEncoder
        self.model_name = model_name
        # Use CPU by default or let sentence_transformers pick device
        self.model = CrossEncoder(model_name)

    def rerank(self, query: str, texts: list[str]) -> list[float]:
        if not texts:
            return []
        pairs = [[query, text] for text in texts]
        scores = self.model.predict(pairs)
        # convert numpy array to list of floats
        return [float(s) for s in scores]
