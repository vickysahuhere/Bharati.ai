import json
from pathlib import Path
from app.retrieval.search import hybrid_search

def run_eval():
    eval_file = Path(__file__).parent / "eval_questions.json"
    if not eval_file.exists():
        print("No eval_questions.json found.")
        return

    questions = json.loads(eval_file.read_text())
    total = len(questions)
    hits = 0
    correct_refusals = 0
    refusal_total = 0

    print(f"--- Starting RAG Retrieval Evaluation ({total} test questions) ---\n")

    for item in questions:
        q_id = item["id"]
        q_text = item["question"]
        expected_title = item.get("expected_document_title")
        should_be_found = item.get("should_be_found", True)

        chunks = hybrid_search(query=q_text, knowledge_domain=item.get("domain"), top_k=5)

        if not should_be_found:
            refusal_total += 1
            if len(chunks) == 0:
                correct_refusals += 1
                print(f"[PASS] Q{q_id}: Correctly refused unanswerable question.")
            else:
                print(f"[FAIL] Q{q_id}: Should have refused, but returned {len(chunks)} chunks.")
        else:
            titles = [c["title"] for c in chunks]
            if expected_title in titles:
                hits += 1
                print(f"[PASS] Q{q_id}: Found '{expected_title}' in top-{len(chunks)} results.")
            else:
                print(f"[FAIL] Q{q_id}: '{expected_title}' not in top results. Got: {titles}")

    hit_rate = (hits / (total - refusal_total)) * 100 if (total - refusal_total) > 0 else 0
    refusal_acc = (correct_refusals / refusal_total) * 100 if refusal_total > 0 else 100

    print("\n--- Evaluation Summary ---")
    print(f"Hit@5 Rate: {hit_rate:.1f}%")
    print(f"Not-Found Precision: {refusal_acc:.1f}%")

if __name__ == "__main__":
    run_eval()
