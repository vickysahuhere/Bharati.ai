import sys
import unittest
from unittest.mock import patch, MagicMock

# Mock dependencies before importing backend modules if not installed on host
if "httpx" not in sys.modules:
    sys.modules["httpx"] = MagicMock()
    sys.modules["psycopg_pool"] = MagicMock()
if "psycopg" not in sys.modules:
    sys.modules["psycopg"] = MagicMock()
if "pydantic_settings" not in sys.modules:
    ps_mock = MagicMock()
    class DummyBaseSettings:
        def __init__(self, **kwargs):
            self.database_url = "postgresql://camp:camp123@localhost:5432/camp"
            self.secret_key = "dummy_secret_key"
            self.college_config = "/config/college.yaml"
            self.groq_api_key = "gsk_test"
            self.llm_model = "llama-3.3-70b-versatile"
            self.data_dir = "/data"
    ps_mock.BaseSettings = DummyBaseSettings
    sys.modules["pydantic_settings"] = ps_mock

# Import the pipeline components
from app.generation.pipeline import (
    handle_no_context,
    verify_grounding,
    generate_answer,
    NOT_FOUND_RESPONSE,
    OUT_OF_SCOPE_RESPONSE,
    IDENTITY_RESPONSE
)

class TestAntiHallucination(unittest.TestCase):

    def test_greetings_and_identity(self):
        # 1. Greetings
        res_hi = generate_answer("hello")
        self.assertTrue(res_hi["found"])
        self.assertIn("Hello! I am Bharti.ai", res_hi["answer"])
        self.assertEqual(res_hi["sources"], [])

        # 2. Identity
        res_who = generate_answer("who made you?")
        self.assertTrue(res_who["found"])
        self.assertIn("Vicky Sahu", res_who["answer"])
        self.assertEqual(res_who["sources"], [])

    def test_no_context_out_of_scope_rejection(self):
        # Out-of-scope non-college queries must be rejected with OUT_OF_SCOPE_RESPONSE
        queries = [
            "How do I bake a chocolate cake?",
            "Write a python script to sort an array",
            "Who won the cricket world cup 2023?",
            "Tell me about the latest hollywood movie",
            "What is the policy for quantum teleportation?"
        ]
        for q in queries:
            res = handle_no_context(q)
            self.assertFalse(res["found"], f"Query '{q}' should have found=False")
            self.assertEqual(res["answer"], OUT_OF_SCOPE_RESPONSE)
            self.assertEqual(res["sources"], [])

        # Nonsense query with college words (e.g. quantum teleportation in hostel) must safely refuse with found=False
        res_quantum = handle_no_context("What is the policy for quantum teleportation in campus hostel?")
        self.assertFalse(res_quantum["found"])
        self.assertIn("I'm sorry", res_quantum["answer"])
        self.assertEqual(res_quantum["sources"], [])

    def test_no_context_institutional_missing_info(self):
        # Institutional queries with no documents in DB must return NOT_FOUND_RESPONSE
        queries = [
            "What is the fee for BCA Semester 4 examination?",
            "When will admissions start for MBA in 2027?",
            "What is the syllabus for robotics unit 3?",
            "Who is the professor for advanced algorithms?"
        ]
        for q in queries:
            res = handle_no_context(q)
            self.assertFalse(res["found"], f"Query '{q}' should have found=False")
            self.assertEqual(res["answer"], NOT_FOUND_RESPONSE)
            self.assertEqual(res["sources"], [])

    def test_grounding_verifier_catches_fake_fees(self):
        chunks = [
            {
                "title": "BCA Course Guide",
                "content": "BCA is a 3-year undergraduate program covering Python, Database Systems, and Web Tech.",
                "section": "Overview"
            }
        ]
        
        # Valid answer strictly grounded
        grounded_answer = "BCA is a 3-year undergraduate program covering Python, Database Systems, and Web Tech [Source 1]."
        self.assertTrue(verify_grounding(grounded_answer, chunks))

        # Hallucinated answer with fabricated fee (₹75,000 not in context)
        fake_fee_answer = "The tuition fee for BCA is ₹75,000 per semester [Source 1]."
        self.assertFalse(verify_grounding(fake_fee_answer, chunks), "Should reject fabricated ₹75,000")

        fake_rs_answer = "The exam fee is Rs. 2,500 payable at the bank."
        self.assertFalse(verify_grounding(fake_rs_answer, chunks), "Should reject fabricated Rs. 2,500")

    def test_grounding_verifier_allows_grounded_fees(self):
        chunks = [
            {
                "title": "Fee Notice 2026",
                "content": "The annual examination fee for BCA is ₹4,500 and lab charges are Rs. 1,200.",
                "section": "Fees"
            }
        ]
        grounded_answer = "According to [Source 1], the annual exam fee is ₹4,500 with lab charges of Rs. 1,200."
        self.assertTrue(verify_grounding(grounded_answer, chunks))

    @patch("app.generation.pipeline.hybrid_search")
    def test_generate_answer_empty_chunks_never_calls_llm(self, mock_search):
        mock_search.return_value = []
        with patch("app.generation.pipeline.get_llm") as mock_get_llm:
            res = generate_answer("What is the hostel mess curfew?")
            mock_get_llm.assert_not_called()
            self.assertFalse(res["found"])
            self.assertEqual(res["answer"], NOT_FOUND_RESPONSE)

    @patch("app.generation.pipeline.hybrid_search")
    def test_generate_answer_suppresses_hallucinated_fees(self, mock_search):
        mock_search.return_value = [
            {
                "id": 1,
                "document_id": "doc1",
                "title": "Hostel Circular",
                "content": "Hostel rooms are allocated on first come first serve basis.",
                "page": 1,
                "section": "Rules",
                "domain": "notices"
            }
        ]
        mock_llm = MagicMock()
        mock_llm.generate.return_value = "The hostel fee is ₹45,000 per term [Source 1]."

        with patch("app.generation.pipeline.get_llm", return_value=mock_llm):
            with patch("app.generation.pipeline.get_settings") as mock_settings:
                mock_settings.return_value.groq_api_key = "gsk_test"
                res = generate_answer("What is the hostel fee?")
                # Grounding check must detect that ₹45,000 was fabricated and suppress it
                self.assertFalse(res["found"])
                self.assertEqual(res["answer"], NOT_FOUND_RESPONSE)
                self.assertEqual(res["sources"], [])

if __name__ == "__main__":
    unittest.main()
