from app.agents.router import AgentState
import arxiv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from app.core.config import settings

def novelty_check_agent(state: AgentState) -> dict:
    """Checks for existing similar papers based on the uploaded paper's text."""
    results = state.get("results", {})
    text = results.get("pdf_text", "")
    
    if not text:
        return {"results": {"error": "No text found for novelty check"}}
        
    # In a real scenario, we'd extract keywords first using LLM. Let's do a simple extraction.
    if not settings.API_KEY:
        return {"results": {"error": "API Key missing for keyword extraction"}}
        
    llm = ChatOpenAI(
        model="nova-micro",
        api_key=settings.API_KEY,
        base_url=settings.BASE_URL
    )
    
    keyword_prompt = f"Extract 3 main search queries (keywords) from this paper text to search on arXiv:\n\n{text[:2000]}"
    keyword_response = llm.invoke([HumanMessage(content=keyword_prompt)])
    
    keywords = keyword_response.content.strip().split('\n')
    
    # Search arxiv for similar papers
    client = arxiv.Client()
    similar_papers = []
    
    for query in keywords[:1]: # Just use the first query for simplicity
        search = arxiv.Search(query=query.replace("-", ""), max_results=3, sort_by=arxiv.SortCriterion.Relevance)
        for r in client.results(search):
            similar_papers.append({
                "title": r.title,
                "authors": [a.name for a in r.authors],
                "abstract": r.summary,
                "pdf_url": r.pdf_url
            })
            
    # Combine results
    current_results = state.get("results", {})
    current_results["similar_papers"] = similar_papers
    
    return {"results": current_results}

def similarity_analysis_agent(state: AgentState) -> dict:
    """Compares uploaded paper with similar papers."""
    results = state.get("results", {})
    text = results.get("pdf_text", "")
    similar_papers = results.get("similar_papers", [])
    
    if not text or not similar_papers:
        return {"results": {"error": "Missing data for similarity analysis"}}
        
    llm = ChatOpenAI(
        model="nova-micro",
        api_key=settings.API_KEY,
        base_url=settings.BASE_URL
    )    
    comparison_prompt = f"""
    Compare the following uploaded research paper (first 5000 chars) with these similar existing papers.
    Analyze methodology, contributions, and gaps.
    
    Uploaded Paper:
    {text[:5000]}
    
    Similar Papers:
    {similar_papers}
    
    Provide a detailed similarity analysis.
    """
    
    response = llm.invoke([HumanMessage(content=comparison_prompt)])
    
    current_results = state.get("results", {})
    current_results["similarity_analysis"] = response.content
    return {"results": current_results}

def novelty_report_agent(state: AgentState) -> dict:
    """Generates the final novelty score report."""
    results = state.get("results", {})
    analysis = results.get("similarity_analysis", "")
    
    llm = ChatOpenAI(
        model="nova-micro",
        api_key=settings.API_KEY,
        base_url=settings.BASE_URL
    )
    
    report_prompt = f"""
    Based on this similarity analysis, generate a final Novelty Report.
    Format it as JSON or structured Markdown with:
    - Overall Novelty Score (0-100%)
    - Novel Contributions
    - Duplicate Ideas
    - Research Gaps
    - Suggestions for Improvement
    
    Analysis:
    {analysis}
    """
    
    response = llm.invoke([HumanMessage(content=report_prompt)])
    
    current_results = state.get("results", {})
    current_results["novelty_report"] = response.content
    return {"results": current_results}
