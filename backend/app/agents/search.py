import asyncio
import httpx

# Patch requests to enforce a default timeout of 10s (prevents third-party libraries like arxiv from hanging indefinitely)
import requests
import os
os.environ["USE_TF"] = "0"

if not hasattr(requests.Session, "_patched"):
    requests.Session._patched = True
    _original_request = requests.Session.request
    def _patched_request(self, method, url, *args, **kwargs):
        if 'timeout' not in kwargs:
            kwargs['timeout'] = 10.0
        return _original_request(self, method, url, *args, **kwargs)
    requests.Session.request = _patched_request


import arxiv
import re
from datetime import datetime
from ddgs import DDGS
from urllib.parse import quote
from app.agents.router import AgentState
from app.core.config import settings

# Load sentence transformer lazily for semantic similarity
_embedder = None
def get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            # Use a lightweight model for speed
            _embedder = SentenceTransformer('all-MiniLM-L6-v2')
        except Exception as e:
            print(f"Failed to load sentence-transformers: {e}")
            _embedder = "fallback"
    return _embedder

def cosine_sim(a, b):
    import numpy as np
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def search_arxiv_sync(query):
    client = arxiv.Client(num_retries=0)
    search = arxiv.Search(query=query, max_results=50, sort_by=arxiv.SortCriterion.Relevance)
    results = []
    for r in client.results(search):
        pdf_url = r.pdf_url
        if pdf_url:
            pdf_url = pdf_url.replace("http://", "https://")
            
        results.append({
            "title": r.title,
            "authors": [a.name for a in r.authors],
            "year": r.published.year if r.published else datetime.now().year,
            "abstract": r.summary,
            "pdf_url": pdf_url or "",
            "source": "arXiv",
            "citation": 0,
            "doi": r.doi or ""
        })
    return results

def search_ddg_sync(query):
    results = []
    try:
        search_query = f"{query} filetype:pdf"
        allowed_domains = ["arxiv.org", "openreview.net", "aclanthology.org", "thecvf.com", "pmlr.compiler", "neurips.cc"]
        forbidden_domains = ["linkedin.com", "youtube.com", "medium.com", "github.com"]
        
        with DDGS() as ddgs:
            for r in ddgs.text(search_query, max_results=60):
                href = r.get("href", "").lower()
                
                # Must not contain forbidden domains
                if any(fd in href for fd in forbidden_domains):
                    continue
                    
                # Strict PDF filter: must be a PDF URL or from a trusted domain
                is_pdf = is_pdf_url(href)
                is_trusted = any(domain in href for domain in allowed_domains)
                
                if not (is_pdf or is_trusted):
                    continue
                    
                results.append({
                    "title": r.get("title", ""),
                    "authors": ["Web Author"],
                    "year": datetime.now().year,
                    "abstract": r.get("body", ""),
                    "pdf_url": r.get("href", ""),
                    "source": "DuckDuckGo",
                    "citation": 0,
                    "doi": ""
                })
    except Exception as e:
        print(f"DDG Error: {e}")
    return results

async def search_semantic_scholar(query, client):
    encoded_query = quote(query)
    url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={encoded_query}&limit=30&fields=title,authors,abstract,openAccessPdf,citationCount,year,externalIds"
    headers = {}
    if settings.SEMANTIC_SCHOLAR_API_KEY:
        headers["x-api-key"] = settings.SEMANTIC_SCHOLAR_API_KEY
    try:
        response = await client.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            results = []
            for item in data.get("data", []):
                pdf = item.get("openAccessPdf")
                pdf_url = pdf.get("url") if pdf else ""
                
                # Strict PDF filter
                if not pdf_url:
                    continue
                    
                doi = item.get("externalIds", {}).get("DOI", "")
                
                results.append({
                    "title": item.get("title", ""),
                    "authors": [a.get("name", "") for a in item.get("authors", [])],
                    "year": item.get("year") or datetime.now().year,
                    "abstract": item.get("abstract") or "",
                    "pdf_url": pdf_url,
                    "source": "Semantic Scholar",
                    "citation": item.get("citationCount", 0) or 0,
                    "doi": doi
                })
            return results
    except Exception as e:
        print(f"Semantic Scholar Error: {e}")
    return []

async def enrich_paper(p, client, headers):
    if p["source"] in ["arXiv", "DuckDuckGo"] and p["title"]:
        try:
            # Query by title
            encoded_title = quote(p["title"])
            url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={encoded_title}&limit=1&fields=citationCount,externalIds"
            res = await client.get(url, headers=headers, timeout=3.0)
            if res.status_code == 200:
                data = res.json()
                items = data.get("data", [])
                if items:
                    p["citation"] = items[0].get("citationCount", 0) or 0
                    if not p.get("doi"):
                        p["doi"] = items[0].get("externalIds", {}).get("DOI", "")
        except Exception as e:
            # Silently pass to keep it fast
            pass
    return p

async def enrich_metadata(papers, client):
    """Enrich arXiv and DDG papers with citation counts from Semantic Scholar concurrently."""
    headers = {}
    if settings.SEMANTIC_SCHOLAR_API_KEY:
        headers["x-api-key"] = settings.SEMANTIC_SCHOLAR_API_KEY
        
    tasks = [enrich_paper(p, client, headers) for p in papers]
    return await asyncio.gather(*tasks)

async def fetch_all_sources(query):
    print("fetch_all_sources start")
    async with httpx.AsyncClient(timeout=15.0) as client:
        print("s2_task start")
        s2_task = search_semantic_scholar(query, client)
        
        print("arxiv_task start")
        arxiv_task = asyncio.wait_for(asyncio.to_thread(search_arxiv_sync, query), timeout=15.0)
        
        print("ddg_task start")
        ddg_task = asyncio.wait_for(asyncio.to_thread(search_ddg_sync, query), timeout=15.0)
        
        print("awaiting gather...")
        results = await asyncio.gather(
            s2_task, arxiv_task, ddg_task,
            return_exceptions=True
        )
        print("gather finished!")
        
        # Flatten and filter out exceptions
        all_papers = []
        for res in results:
            if isinstance(res, list):
                all_papers.extend(res)
                
        # Enrich metadata
        all_papers = await enrich_metadata(all_papers, client)
        return all_papers

def deduplicate_results(results):
    seen_titles = set()
    unique = []
    for r in results:
        title_lower = r.get("title", "").lower().strip()
        # Basic normalization to avoid slight variations
        norm_title = re.sub(r'[^a-z0-9]', '', title_lower)
        if not norm_title or norm_title in seen_titles:
            continue
        seen_titles.add(norm_title)
        unique.append(r)
    return unique

def is_pdf_url(url: str) -> bool:
    if not url:
        return False
    url_lower = url.lower()
    clean_url = url_lower.split('?')[0].split('#')[0]
    return clean_url.endswith(".pdf") or "/pdf/" in url_lower or "/pdf?" in url_lower

def search_agent(state: AgentState) -> dict:
    """Search for research papers across multiple APIs."""
    query = state.get("query")
    if not query:
        if state.get("messages"):
            query = state["messages"][-1].content
        else:
            query = ""
    
    # Run the async fetching loop synchronously
    all_papers = asyncio.run(fetch_all_sources(query))
    
    # Allow only PDF formats
    pdf_papers = [p for p in all_papers if is_pdf_url(p.get("pdf_url"))]
    
    # Deduplicate
    unique_papers = deduplicate_results(pdf_papers)
    
    if not unique_papers:
        return {"results": {"search_results": [], "message": "No publicly accessible PDF research papers were found for this query."}}
        
    return {"results": {"search_results": unique_papers}}

