import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.search import search_agent

state = {
    "query": "generative adversarial networks"
}

print("Running search_agent...")
res = search_agent(state)
results = res.get("results", {}).get("search_results", [])
print(f"Total deduplicated and verified PDF papers: {len(results)}")
breakdown = {}
for r in results:
    src = r.get("source", "Unknown")
    breakdown[src] = breakdown.get(src, 0) + 1
print("Source Breakdown:", breakdown)
for idx, r in enumerate(results[:5]):
    print(f" {idx+1}. Title: {r.get('title')}\n    URL: {r.get('pdf_url')}\n    Source: {r.get('source')}")
