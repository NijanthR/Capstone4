from app.agents.search import search_agent
from app.agents.router import AgentState

state = {
    "messages": [],
    "query": "Transformer models",
    "intent": "search",
    "pdf_path": None,
    "is_own_research": False,
    "results": {}
}

result = search_agent(state)
papers = result.get("results", {}).get("search_results", [])
message = result.get("results", {}).get("message", "")

if message:
    print(message)
    
for p in papers:
    print(f"Title: {p['title']}")
    print(f"Source: {p['source']}")
    print(f"URL: {p['pdf_url']}")
    print(f"Score: {p.get('score', 0):.2f}")
    print("-" * 40)
