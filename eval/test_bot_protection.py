import sys
import unittest
from unittest.mock import MagicMock

# Mock external modules if not in host environment
if "fastapi" not in sys.modules:
    fa = MagicMock()
    class DummyHTTPException(Exception):
        def __init__(self, status_code, detail, headers=None):
            self.status_code = status_code
            self.detail = detail
            self.headers = headers or {}
    fa.HTTPException = DummyHTTPException
    class DummyStatus:
        HTTP_400_BAD_REQUEST = 400
        HTTP_403_FORBIDDEN = 403
        HTTP_429_TOO_MANY_REQUESTS = 429
    fa.status = DummyStatus
    sys.modules["fastapi"] = fa

if "starlette" not in sys.modules:
    sys.modules["starlette"] = MagicMock()
if "starlette.middleware.base" not in sys.modules:
    sys.modules["starlette.middleware.base"] = MagicMock()
if "starlette.responses" not in sys.modules:
    sr = MagicMock()
    class DummyJSONResponse:
        def __init__(self, content, status_code=200):
            self.content = content
            self.status_code = status_code
            self.headers = {}
    class DummyPlainTextResponse:
        def __init__(self, content, media_type="text/plain"):
            self.content = content
            self.media_type = media_type
            self.headers = {}
    sr.JSONResponse = DummyJSONResponse
    sr.PlainTextResponse = DummyPlainTextResponse
    sys.modules["starlette.responses"] = sr

from app.core.bot_protection import (
    is_blocked_bot,
    get_client_ip,
    SlidingWindowRateLimiter,
    verify_honeypot,
    verify_query_payload,
    ROBOTS_TXT_CONTENT,
    chat_rate_limiter,
    auth_login_rate_limiter,
    auth_signup_rate_limiter,
)
from fastapi import HTTPException

class DummyRequest:
    def __init__(self, headers=None, client_host="192.168.1.50", method="POST", path="/api/chat/stream"):
        self.headers = headers or {}
        self.client = MagicMock()
        self.client.host = client_host
        self.method = method
        self.url = MagicMock()
        self.url.path = path


class TestBotProtection(unittest.TestCase):

    def test_is_blocked_bot(self):
        # Malicious scanners and abusive scrapers should be caught
        malicious_uas = [
            "sqlmap/1.6#stable",
            "Mozilla/5.0 (compatible; Nikto/2.1.6)",
            "masscan/1.0.4",
            "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
            "AhrefsBot/7.0",
            "SemrushBot/7~bl",
            "nmap scripting engine",
            "gobuster 3.1.0",
            "Acunetix Security Scanner",
            "havij 1.16",
        ]
        for ua in malicious_uas:
            self.assertTrue(is_blocked_bot(ua), f"Failed to identify bot UA: {ua}")

        # Legitimate browsers should NOT be blocked
        legitimate_uas = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:129.0) Gecko/20100101 Firefox/129.0",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
        ]
        for ua in legitimate_uas:
            self.assertFalse(is_blocked_bot(ua), f"Legitimate browser erroneously identified as bot: {ua}")

    def test_client_ip_resolution(self):
        # 1. Cloudflare header priority
        req_cf = DummyRequest(headers={"cf-connecting-ip": "203.0.113.195", "x-forwarded-for": "10.0.0.1"})
        self.assertEqual(get_client_ip(req_cf), "203.0.113.195")

        # 2. X-Forwarded-For resolution (first IP is the real client)
        req_xff = DummyRequest(headers={"x-forwarded-for": "198.51.100.42, 10.1.2.3, 172.16.0.5"})
        self.assertEqual(get_client_ip(req_xff), "198.51.100.42")

        # 3. Direct client fallback
        req_direct = DummyRequest(headers={}, client_host="192.0.2.1")
        self.assertEqual(get_client_ip(req_direct), "192.0.2.1")

    def test_sliding_window_rate_limiter(self):
        limiter = SlidingWindowRateLimiter(
            window_seconds=10.0,
            max_requests=3,
            burst_limit=2,
            burst_window=2.0,
            name="test"
        )
        test_ip = "192.0.2.99"
        req = DummyRequest(headers={}, client_host=test_ip)

        # 1st request: OK
        limiter.check(req)
        # 2nd request: OK
        limiter.check(req)

        # 3rd request within 2 seconds: burst limit exceeded!
        with self.assertRaises(HTTPException) as ctx:
            limiter.check(req)
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("Retry-After", ctx.exception.headers)

    def test_honeypot_traps_bots(self):
        # Legitimate humans leave the honeypot field None or empty
        try:
            verify_honeypot(None)
            verify_honeypot("")
            verify_honeypot("   ")
        except HTTPException:
            self.fail("verify_honeypot raised HTTPException on valid human submission")

        # Bots that auto-fill inputs get trapped and rejected
        with self.assertRaises(HTTPException) as ctx:
            verify_honeypot("http://spam-link-bot.com")
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Automated submission detected", ctx.exception.detail)

    def test_query_payload_guards(self):
        # 1. Valid query passes
        verify_query_payload("What is the admission procedure for BCA?", [])

        # 2. Empty query rejected
        with self.assertRaises(HTTPException) as ctx:
            verify_query_payload("   ")
        self.assertEqual(ctx.exception.status_code, 400)

        # 3. Giant DoS / Token-depletion query rejected (>1000 characters)
        giant_query = "A" * 1001
        with self.assertRaises(HTTPException) as ctx:
            verify_query_payload(giant_query)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("maximum allowed length", ctx.exception.detail)

        # 4. Oversized chat history rejected (>20 messages)
        oversized_history = [{"role": "user", "content": "hi"}] * 21
        with self.assertRaises(HTTPException) as ctx:
            verify_query_payload("Hello", oversized_history)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_auth_rate_limiters(self):
        test_ip = "198.51.100.77"
        auth_login_rate_limiter.reset_for_ip(test_ip)
        auth_signup_rate_limiter.reset_for_ip(test_ip)

        req = DummyRequest(headers={}, client_host=test_ip)

        # Auth login allows max 5 attempts before 429
        for _ in range(3):
            auth_login_rate_limiter.check(req)

        # Burst check: 4th rapid request within 10s triggers 429
        with self.assertRaises(HTTPException) as ctx:
            auth_login_rate_limiter.check(req)
        self.assertEqual(ctx.exception.status_code, 429)

    def test_robots_txt(self):
        self.assertIn("User-agent: *", ROBOTS_TXT_CONTENT)
        self.assertIn("Disallow: /api/", ROBOTS_TXT_CONTENT)
        self.assertIn("Disallow: /admin", ROBOTS_TXT_CONTENT)
        self.assertIn("User-agent: GPTBot", ROBOTS_TXT_CONTENT)
        self.assertIn("User-agent: Bytespider", ROBOTS_TXT_CONTENT)
        self.assertIn("User-agent: CCBot", ROBOTS_TXT_CONTENT)


if __name__ == "__main__":
    unittest.main()
