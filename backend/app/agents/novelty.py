from app.agents.router import AgentState
import asyncio
import re
import json
from app.agents.search import fetch_all_sources, deduplicate_results
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from app.core.config import settings

def novelty_check_agent(state: AgentState) -> dict:
    """Checks for existing similar papers based on the uploaded paper's text."""
    results = state.get("results", {})
    text = results.get("pdf_text", "")
    
    if not text:
        return {"results": {"error": "No text found for novelty check"}}
        
    if not settings.API_KEY:
        return {"results": {"error": "API Key missing for keyword extraction"}}
        
    llm = ChatOpenAI(
        model="nova-micro",
        api_key=settings.API_KEY,
        base_url=settings.BASE_URL
    )
    
    # 1. Extract the title of the uploaded paper (or reuse if already extracted)
    extracted_title = results.get("extracted_title")
    if not extracted_title:
        title_prompt = f"""
        Analyze the following research paper text and extract the exact title of the paper.
        Return ONLY the title, with no extra labels, quotes, or punctuation.
        
        Paper Text (start):
        {text[:2000]}
        
        Title:
        """
        try:
            title_response = llm.invoke([HumanMessage(content=title_prompt)])
            extracted_title = title_response.content.strip().replace('"', '').replace("'", "")
        except Exception as e:
            print(f"Error extracting title: {e}")
            extracted_title = ""
        
    # 2. Extract keywords for topic search query
    keyword_prompt = f"""
    Analyze the following research paper text and generate one clean, concise search query (1-5 words, no punctuation, numbers, or quotes) that represents the core topic and methodology. 
    This query will be used to search for existing literature on arXiv and Semantic Scholar.
    
    Paper Text (start):
    {text[:3000]}
    
    Search query:
    """
    try:
        keyword_response = llm.invoke([HumanMessage(content=keyword_prompt)])
        search_query = keyword_response.content.strip().replace('"', '').replace("'", "")
    except Exception as e:
        print(f"Error generating search query: {e}")
        search_query = extracted_title or "machine learning"

    # 3. Search across multiple sources using both queries concurrently
    async def run_searches():
        tasks = []
        if extracted_title:
            tasks.append(fetch_all_sources(extracted_title))
        if search_query and search_query != extracted_title:
            tasks.append(fetch_all_sources(search_query))
            
        if not tasks:
            return []
            
        results_list = await asyncio.gather(*tasks, return_exceptions=True)
        flat_results = []
        for r in results_list:
            if isinstance(r, list):
                flat_results.extend(r)
        return flat_results

    try:
        all_papers = asyncio.run(run_searches())
    except Exception as e:
        print(f"Error in search fetch for novelty check: {e}")
        all_papers = []
        
    # Deduplicate results
    unique_papers = deduplicate_results(all_papers)
    
    # 4. Check for and prioritize exact title match
    def normalize_title(t):
        return re.sub(r'[^a-z0-9]', '', t.lower().strip())
        
    norm_extracted = normalize_title(extracted_title)
    
    exact_matches = []
    other_papers = []
    
    for p in unique_papers:
        title = p.get("title", "")
        norm_p = normalize_title(title)
        # Check for near-exact or substring matching
        if norm_extracted and norm_p and (norm_extracted in norm_p or norm_p in norm_extracted):
            exact_matches.append(p)
        else:
            other_papers.append(p)
            
    # Combine lists so exact matches are evaluated first
    sorted_papers = exact_matches + other_papers
    
    similar_papers = []
    # Take the top 4 most relevant papers
    for p in sorted_papers[:4]:
        similar_papers.append({
            "title": p.get("title", ""),
            "authors": p.get("authors", []),
            "abstract": p.get("abstract", ""),
            "pdf_url": p.get("pdf_url", ""),
            "source": p.get("source", "Unknown")
        })
            
    # Combine results
    current_results = state.get("results", {})
    current_results["extracted_title"] = extracted_title
    current_results["similar_papers"] = similar_papers
    
    return {"results": current_results}

def similarity_analysis_agent(state: AgentState) -> dict:
    """Compares uploaded paper with similar papers."""
    results = state.get("results", {})
    text = results.get("pdf_text", "")
    similar_papers = results.get("similar_papers", [])
    extracted_title = results.get("extracted_title", "")
    
    if not text or not similar_papers:
        return {"results": {"error": "Missing data for similarity analysis"}}
        
    llm = ChatOpenAI(
        model="nova-micro",
        api_key=settings.API_KEY,
        base_url=settings.BASE_URL
    )    
    comparison_prompt = f"""
    You are an expert peer reviewer. Compare the following uploaded research paper with these similar existing papers.
    Analyze methodology, contributions, and gaps.
    
    Uploaded Paper Title (extracted): {extracted_title}
    Uploaded Paper (first 5000 chars):
    {text[:5000]}
    
    Similar Papers:
    {similar_papers}
    
    CRITICAL INSTRUCTION: Check if the uploaded paper itself is already published. If one of the similar papers has the same or a very similar title and authors/abstract as the uploaded paper, it means this paper is ALREADY PUBLISHED. In your analysis, clearly state if the uploaded paper is a duplicate/exact match of an already published paper.
    
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
    Format it as a valid JSON object.
    
    Format requirements:
    Return a JSON object with the following keys:
    - "Overall Novelty Score": (an integer from 0 to 100 representing the score)
    - "Novel Contributions": (list of strings)
    - "Duplicate Ideas": (list of strings)
    - "Research Gaps": (list of strings)
    - "Suggestions for Improvement": (list of strings)
    
    CRITICAL INSTRUCTION: If the similarity analysis indicates that the uploaded paper is a duplicate or an exact match of an already published paper, the Overall Novelty Score MUST be 0. In this case, under Duplicate Ideas, state that this is an existing published paper, and list its publication details from the similar papers.
    
    Analysis:
    {analysis}
    
    Return ONLY the valid JSON block.
    """
    
    response = llm.invoke([HumanMessage(content=report_prompt)])
    
    # Strip markdown code block wrapping if present
    content = response.content.strip()
    if content.startswith("```json"):
        content = content[7:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()
    
    try:
        # Validate and format JSON nicely
        parsed = json.loads(content)
        formatted_content = json.dumps(parsed, indent=2)
    except Exception as e:
        # Fallback to raw content if parsing fails
        formatted_content = content
        
    current_results = state.get("results", {})
    current_results["novelty_report"] = formatted_content
    return {"results": current_results}



