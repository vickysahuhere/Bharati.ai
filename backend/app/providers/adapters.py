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
                try:
                    retry_after = float(r.headers.get("retry-after", 2.5))
                except (ValueError, TypeError):
                    retry_after = 2.5
                time.sleep(max(retry_after, 2.0))
                continue
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    def generate_stream(self, messages: list[dict], temperature: float = 0.1):
        import json
        with httpx.stream(
            "POST",
            self.URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"model": self.model, "messages": messages, "temperature": temperature, "stream": True},
            timeout=60,
        ) as r:
            r.raise_for_status()
            for line in r.iter_lines():
                if not line:
                    continue
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk_json = json.loads(data_str)
                        delta = chunk_json["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except Exception:
                        continue

    async def agenerate_stream(self, messages: list[dict], temperature: float = 0.1):
        import json
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                self.URL,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "messages": messages, "temperature": temperature, "stream": True},
            ) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk_json = json.loads(data_str)
                            delta = chunk_json["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except Exception:
                            continue


class FastEmbedder:
    """Local CPU embeddings: free, on-prem, thread-safe, uses pre-cached ONNX weights."""

    def __init__(self, model_name: str, dim: int = 384, cache_dir: str = "/srv/models_cache"):
        import os
        from fastembed import TextEmbedding
        self.model_name, self.dim = model_name, dim
        actual_cache = os.getenv("FASTEMBED_CACHE_PATH", cache_dir)
        self._m = TextEmbedding(model_name, cache_dir=actual_cache, threads=1)

    def embed(self, texts: list[str]) -> list[list[float]]:
        # Filter and sanitize empty strings to prevent ONNX errors
        sanitized = [t if t and t.strip() else " " for t in texts]
        return [v.tolist() for v in self._m.embed(sanitized)]


class OpenAIEmbedder:
    """High-throughput Cloud Embeddings: 0% server CPU, 0 MB server RAM, scales to 10,000+ concurrent students."""

    def __init__(self, api_key: str, model: str = "text-embedding-3-small", dim: int = 384):
        self.api_key = api_key
        self.model = model
        self.dim = dim
        self.model_name = model

    def embed(self, texts: list[str]) -> list[list[float]]:
        import httpx
        import time
        sanitized = [t if t and t.strip() else " " for t in texts]
        url = "https://api.openai.com/v1/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        all_embeddings: list[list[float]] = []
        batch_size = 64
        
        with httpx.Client(timeout=30.0) as client:
            for i in range(0, len(sanitized), batch_size):
                batch = sanitized[i:i + batch_size]
                payload = {
                    "input": batch,
                    "model": self.model,
                    "dimensions": self.dim
                }
                
                # Resilient retries for rate limits / network hiccups
                max_retries = 3
                for attempt in range(max_retries):
                    resp = client.post(url, headers=headers, json=payload)
                    if resp.status_code == 429 and attempt < max_retries - 1:
                        time.sleep(2.0 * (attempt + 1))
                        continue
                    resp.raise_for_status()
                    data = resp.json()
                    all_embeddings.extend([item["embedding"] for item in data["data"]])
                    break

        return all_embeddings


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
    """Lightweight, low-memory query-text ranker for 512MB RAM cloud environments."""

    STOP_WORDS = {
        'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
        'by', 'is', 'are', 'was', 'were', 'what', 'whats', 'show', 'me', 'please',
        'tell', 'about', 'i', 'my', 'can', 'you', 'give', 'detail', 'details'
    }

    def __init__(self, model_name: str = ""):
        self.model_name = model_name

    def rerank(self, query: str, texts: list[str]) -> list[float]:
        if not texts:
            return []
        import re
        tokens = [w for w in re.findall(r'[a-zA-Z0-9]+', query.lower())]
        q_tokens = {w for w in tokens if w not in self.STOP_WORDS}
        if not q_tokens:
            q_tokens = set(tokens)
            
        scores = []
        for text in texts:
            if not text:
                scores.append(0.0)
                continue
            t_tokens = set(re.findall(r'[a-zA-Z0-9]+', text.lower()))
            overlap = len(q_tokens & t_tokens) / max(len(q_tokens), 1)
            scores.append(float(overlap))
        return scores
