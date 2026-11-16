import time
import threading
from collections import defaultdict
from typing import Optional, List, Dict, Any
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, PlainTextResponse

# ---------------------------------------------------------------------------
# 1. Known Malicious Scanners, Attack Tools & Aggressive Crawlers
# ---------------------------------------------------------------------------
BLOCKED_USER_AGENTS = (
    # Vulnerability & attack scanners
    "sqlmap",
    "nikto",
    "masscan",
    "zgrab",
    "nmap",
    "gobuster",
    "dirbuster",
    "wprecon",
    "acunetix",
    "havij",
    "hydra",
    "netsparker",
    "metasploit",
    "shodan",
    "censys",
    # Aggressive / disrespectful scrapers
    "bytespider",
    "semrushbot",
    "ahrefsbot",
    "dotbot",
    "megaindex",
    "mj12bot",
    "petalbot",
)

def is_blocked_bot(user_agent: Optional[str]) -> bool:
    """Check if the User-Agent belongs to a known malicious scanner or aggressive scraper."""
    if not user_agent:
        return False
    ua_lower = user_agent.lower()
    return any(scanner in ua_lower for scanner in BLOCKED_USER_AGENTS)

# ---------------------------------------------------------------------------
# 2. IP Resolution (Cloudflare / Reverse Proxy Aware)
# ---------------------------------------------------------------------------
def get_client_ip(request: Request) -> str:
    """
    Extract the real client IP address, respecting Cloudflare and reverse proxies.
    """
    # Cloudflare real visitor IP
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()

    # Standard proxy forwarding (first IP is the original client)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first_ip = forwarded.split(",")[0].strip()
        if first_ip:
            return first_ip

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host.strip()

    return "127.0.0.1"

# ---------------------------------------------------------------------------
# 3. Sliding-Window & Burst Rate Limiter
# ---------------------------------------------------------------------------
class SlidingWindowRateLimiter:
    """
    Thread-safe, sliding-window rate limiter with burst protection and automatic memory cleanup.
    """
    def __init__(
        self,
        window_seconds: float,
        max_requests: int,
        burst_limit: Optional[int] = None,
        burst_window: float = 5.0,
        name: str = "rate_limit"
    ):
        self.window_seconds = window_seconds
        self.max_requests = max_requests
        self.burst_limit = burst_limit
        self.burst_window = burst_window
        self.name = name
        self._timestamps: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self._last_cleanup = time.time()

    def _cleanup_stale(self, now: float):
        if now - self._last_cleanup > 300: # Every 5 minutes
            cutoff = now - self.window_seconds
            for ip in list(self._timestamps.keys()):
                valid = [t for t in self._timestamps[ip] if t > cutoff]
                if valid:
                    self._timestamps[ip] = valid
                else:
                    self._timestamps.pop(ip, None)
            self._last_cleanup = now

    def check(self, request: Request):
        now = time.time()
        client_ip = get_client_ip(request)

        with self._lock:
            self._cleanup_stale(now)
            timestamps = self._timestamps[client_ip]

            # 1. Burst protection (e.g. max 5 requests within 5 seconds)
            if self.burst_limit is not None:
                burst_cutoff = now - self.burst_window
                recent_burst = [t for t in timestamps if t > burst_cutoff]
                if len(recent_burst) >= self.burst_limit:
                    retry_after = int(self.burst_window) or 1
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Too many rapid requests. Please wait {retry_after} seconds.",
                        headers={"Retry-After": str(retry_after)}
                    )

            # 2. Window protection (e.g. max 20 requests within 60 seconds)
            window_cutoff = now - self.window_seconds
            recent_window = [t for t in timestamps if t > window_cutoff]
            if len(recent_window) >= self.max_requests:
                retry_after = int(self.window_seconds - (now - recent_window[0])) if recent_window else int(self.window_seconds)
                retry_after = max(1, retry_after)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded ({self.max_requests} requests per {int(self.window_seconds)}s). Please wait before trying again.",
                    headers={"Retry-After": str(retry_after)}
                )

            recent_window.append(now)
            self._timestamps[client_ip] = recent_window

    def reset_for_ip(self, ip: str):
        """Reset limits for a specific IP (useful in unit tests)."""
        with self._lock:
            self._timestamps.pop(ip, None)


# Pre-configured tier limiters
chat_rate_limiter = SlidingWindowRateLimiter(
    window_seconds=60.0,
    max_requests=25,
    burst_limit=6,
    burst_window=5.0,
    name="chat"
)

auth_login_rate_limiter = SlidingWindowRateLimiter(
    window_seconds=60.0,
    max_requests=5,
    burst_limit=3,
    burst_window=10.0,
    name="auth_login"
)

auth_signup_rate_limiter = SlidingWindowRateLimiter(
    window_seconds=300.0, # 5-minute window
    max_requests=3,
    burst_limit=2,
    burst_window=30.0,
    name="auth_signup"
)


# ---------------------------------------------------------------------------
# 4. Honeypot Validation
# ---------------------------------------------------------------------------
def verify_honeypot(hp_field: Optional[str]):
    """
    Honeypot form field check:
    Legitimate human users cannot see or interact with the hidden honeypot field.
    Automated bots scrape HTML and indiscriminately fill out all inputs.
    If filled, we immediately reject to protect CPU and LLM credits.
    """
    if hp_field and hp_field.strip():
        # Raised as bad request to stop bot execution immediately
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Automated submission detected."
        )


# ---------------------------------------------------------------------------
# 5. Payload Guard (Anti-Denial-of-Service / Anti-Token-Exhaustion)
# ---------------------------------------------------------------------------
MAX_QUERY_LENGTH = 1000
MAX_HISTORY_MESSAGES = 20
MAX_HISTORY_MESSAGE_LENGTH = 1500

def verify_query_payload(query: str, chat_history: Optional[List[Dict[str, Any]]] = None):
    """
    Protect embedding model, Postgres pgvector, and LLM context window against
    massive prompt-injection or memory-exhaustion payloads sent by bots.
    """
    if not query or not query.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Query cannot be empty.")

    if len(query) > MAX_QUERY_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Query exceeds maximum allowed length of {MAX_QUERY_LENGTH} characters."
        )

    if chat_history and len(chat_history) > MAX_HISTORY_MESSAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chat history exceeds maximum limit of {MAX_HISTORY_MESSAGES} messages."
        )

    if chat_history:
        for msg in chat_history:
            content = msg.get("content", "")
            if isinstance(content, str) and len(content) > MAX_HISTORY_MESSAGE_LENGTH:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="One or more historical messages exceed allowable length."
                )


# ---------------------------------------------------------------------------
# 6. Global Bot Protection Middleware & Security Headers
# ---------------------------------------------------------------------------
class BotProtectionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        user_agent = request.headers.get("user-agent", "").strip()

        # 1. Block known scanner & abusive crawler user agents
        if is_blocked_bot(user_agent):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Access forbidden: Automated agent blocked."}
            )

        # 2. Block blank User-Agent on state-altering or generation API endpoints
        if request.method in ("POST", "PUT", "DELETE") and request.url.path.startswith("/api/"):
            if not user_agent:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"detail": "User-Agent header required."}
                )

        response = await call_next(request)

        # 3. Inject standard security & anti-indexing headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Prevent search engines and AI scrapers from indexing API endpoints
        if request.url.path.startswith("/api/"):
            response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"

        return response


# ---------------------------------------------------------------------------
# 7. Robots.txt Content
# ---------------------------------------------------------------------------
ROBOTS_TXT_CONTENT = """# robots.txt for camp-ai
User-agent: *
Disallow: /api/
Disallow: /admin
Disallow: /login
Disallow: /signup

# Disallow aggressive AI training bots from scraping institutional documents
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Diffbot
Disallow: /
"""
