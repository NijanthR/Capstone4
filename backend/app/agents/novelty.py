from app.agents.router import AgentState
import asyncio
import re
import json
from app.agents.search import fetch_all_sources, deduplicate_results
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from app.core.config import settings

def novelty_check_agent(state: AgentState) -> dict:
    """Extracts paper architecture details and checks for existing similar papers based on title/keywords."""
    import json
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
    
    # 1. Extract the title of the uploaded paper
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

    # 2. Extract the 13 required fields in JSON format
    extract_prompt = f"""
    You are an expert research analyst. Analyze the following research paper text (first 10000 characters) and extract its structural architecture details.
    
    You must extract details for the following 13 fields:
    1. topic: Research Topic
    2. problem_statement: Problem Statement
    3. objectives: Objectives
    4. methodology: Methodology
    5. proposed_approach: Proposed Approach
    6. system_architecture: Detailed System Architecture and Workflow description
    7. components: List of Components and Modules
    8. data_flow: Detailed Data Flow details
    9. algorithms: Algorithms/Models used
    10. dataset: Dataset details
    11. inputs_outputs: Detailed Inputs and Outputs
    12. results: Quantitative/Qualitative Results
    13. key_findings: Key Findings
    
    Also extract the abstract of the paper (if not explicitly mentioned, summarize the first paragraph as abstract) under "abstract".
    
    Return your response as a valid JSON object matching the keys listed above (topic, problem_statement, objectives, methodology, proposed_approach, system_architecture, components, data_flow, algorithms, dataset, inputs_outputs, results, key_findings, abstract).
    Return ONLY the raw JSON block without any markdown wrapping (no ```json or ```).
    
    Paper text:
    {text[:12000]}
    """
    try:
        response = llm.invoke([HumanMessage(content=extract_prompt)])
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        extracted_analysis = json.loads(content)
    except Exception as e:
        print(f"Error during detailed paper analysis in novelty check: {e}")
        extracted_analysis = {
            "topic": "Not extracted", "problem_statement": "Not extracted", "objectives": "Not extracted",
            "methodology": "Not extracted", "proposed_approach": "Not extracted", "system_architecture": "Not extracted",
            "components": "Not extracted", "data_flow": "Not extracted", "algorithms": "Not extracted",
            "dataset": "Not extracted", "inputs_outputs": "Not extracted", "results": "Not extracted",
            "key_findings": "Not extracted", "abstract": text[:500]
        }
        
    # 3. Extract keywords for topic search query
    keyword_prompt = f"""
    Analyze the following research paper text and generate one clean, concise search query (1-5 words, no punctuation, numbers, or quotes) that represents the core topic and methodology. 
    
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

    # 4. Search across multiple sources concurrently
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
        
    unique_papers = deduplicate_results(all_papers)
    
    # 5. Check for and prioritize exact title match
    def normalize_title_local(t):
        return re.sub(r'[^a-z0-9]', '', t.lower().strip())
        
    norm_extracted = normalize_title_local(extracted_title)
    exact_matches = []
    other_papers = []
    
    for p in unique_papers:
        title = p.get("title", "")
        norm_p = normalize_title_local(title)
        if norm_extracted and norm_p and (norm_extracted in norm_p or norm_p in norm_extracted):
            exact_matches.append(p)
        else:
            other_papers.append(p)
            
    sorted_papers = exact_matches + other_papers
    similar_papers = []
    for p in sorted_papers[:4]:
        similar_papers.append({
            "title": p.get("title", ""),
            "authors": p.get("authors", []),
            "abstract": p.get("abstract", ""),
            "pdf_url": p.get("pdf_url", ""),
            "source": p.get("source", "Unknown")
        })
            
    # Combine results
    current_results = state.get("results", {}) or {}
    current_results["extracted_title"] = extracted_title
    current_results["extracted_authors"] = results.get("extracted_authors", "")
    current_results["extracted_analysis"] = extracted_analysis
    current_results["similar_papers"] = similar_papers
    
    return {"results": current_results}

def similarity_analysis_agent(state: AgentState) -> dict:
    """Calculates genuine similarity scores and performs comparison analysis."""
    from app.services.paper_helper import calculate_similarity_scores
    
    results = state.get("results", {})
    text = results.get("pdf_text", "")
    similar_papers = results.get("similar_papers", [])
    extracted_title = results.get("extracted_title", "")
    extracted_analysis = results.get("extracted_analysis", {})
    
    if not text or not similar_papers:
        # Fallback comparison if search failed
        current_results = state.get("results", {}) or {}
        current_results["similarity_analysis"] = "No similar existing papers found in the databases to compare with."
        return {"results": current_results}
        
    # Calculate genuine similarity scores using embeddings
    similar_papers = calculate_similarity_scores(text, extracted_title, similar_papers)
        
    llm = ChatOpenAI(
        model="nova-micro",
        api_key=settings.API_KEY,
        base_url=settings.BASE_URL
    )    
    
    comparison_prompt = f"""
    You are an expert peer reviewer. Compare the following uploaded research paper with these similar existing papers.
    Analyze methodology, contributions, similarities, differences, and gaps.
    
    Uploaded Paper Title: {extracted_title}
    Uploaded Abstract: {extracted_analysis.get("abstract")}
    Uploaded Architecture: {extracted_analysis.get("system_architecture")}
    
    Similar Papers (with calculated genuine similarity scores):
    {json.dumps(similar_papers, indent=2)}
    
    CRITICAL INSTRUCTION: Check if the uploaded paper itself is already published. If one of the similar papers has a similarity score of 100 or has the same or a very similar title and authors/abstract as the uploaded paper, it means this paper is ALREADY PUBLISHED. In your analysis, clearly state if the uploaded paper is a duplicate/exact match of an already published paper.
    
    Provide a detailed similarity analysis, referencing the similarity scores. Explain similarities and differences in topic, methodology, architecture, datasets, results, and technical concepts.
    """
    
    response = llm.invoke([HumanMessage(content=comparison_prompt)])
    
    current_results = state.get("results", {}) or {}
    current_results["similar_papers"] = similar_papers
    current_results["similarity_analysis"] = response.content
    return {"results": current_results}

def novelty_report_agent(state: AgentState) -> dict:
    """Generates the final Novelty Report in Markdown format and saves paper metadata to SQLite."""
    from app.services.paper_helper import save_paper_metadata
    
    results = state.get("results", {})
    analysis = results.get("similarity_analysis", "")
    pdf_path = state.get("pdf_path")
    extracted_title = results.get("extracted_title", "")
    extracted_authors = results.get("extracted_authors", "")
    extracted_analysis = results.get("extracted_analysis", {})
    similar_papers = results.get("similar_papers", [])
    
    llm = ChatOpenAI(
        model="nova-micro",
        api_key=settings.API_KEY,
        base_url=settings.BASE_URL
    )
    
    report_prompt = f"""
    Based on this similarity analysis, generate a final Novelty Report in clean markdown.
    
    Include:
    1. Overall Novelty Score (an integer from 0 to 100)
    2. Novel Contributions (bullet points of what is new/original)
    3. Duplicate Ideas / Known Techniques (bullet points of what is standard or already done in previous papers)
    4. Research Gaps (bullet points of gaps in literature)
    5. Suggestions for Improvement (bullet points of how the paper can be made more novel/original)
    
    CRITICAL INSTRUCTION: If the similarity analysis indicates that the uploaded paper is a duplicate or an exact match of an already published paper (e.g. 100% similarity score with a paper), the Overall Novelty Score MUST be 0.
    
    In your report, also append a clearly formatted Literature Comparison section that lists each similar paper, its similarity score (e.g. "Paper A — 87% Similarity"), and a brief breakdown of major similarities and differences.
    
    Analysis:
    {analysis}
    
    Return only the clean markdown report.
    """
    
    response = llm.invoke([HumanMessage(content=report_prompt)])
    markdown_report = response.content.strip()
    
    # Extract the novelty score integer from the markdown text to save in DB if needed, or just save the report
    # Let's try to extract score using regex or default to 70
    score_match = re.search(r'(?i)novelty\s+score\s*:\s*(\d+)', markdown_report)
    overall_score = int(score_match.group(1)) if score_match else 70
    if "already published" in analysis.lower() or "duplicate" in analysis.lower() or any(p.get("similarity_score") == 100 for p in similar_papers):
        overall_score = 0
        
    # Save the metadata and analysis in SQLite database
    save_paper_metadata(
        paper_id=pdf_path,
        title=extracted_title,
        authors=extracted_authors,
        abstract=extracted_analysis.get("abstract", ""),
        source="upload_own",
        extracted_analysis=extracted_analysis,
        comparison_results=similar_papers
    )
    
    current_results = state.get("results", {}) or {}
    current_results["novelty_report"] = markdown_report
    return {"results": current_results}
