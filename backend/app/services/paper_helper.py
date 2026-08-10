import json
import re
from app.models.database import SessionLocal
from app.models.schemas import PaperMetadata
from app.agents.search import get_embedder, cosine_sim

def normalize_title(t):
    if not t:
        return ""
    return re.sub(r'[^a-z0-9]', '', t.lower().strip())

def save_paper_metadata(paper_id: str, title: str, authors: str, abstract: str, source: str, extracted_analysis: dict, comparison_results: list):
    """Saves or updates PaperMetadata in the SQLite database."""
    db = SessionLocal()
    try:
        # Check if record already exists
        record = db.query(PaperMetadata).filter(PaperMetadata.id == paper_id).first()
        if not record:
            record = PaperMetadata(id=paper_id)
            db.add(record)
            
        record.title = title
        record.authors = authors
        record.abstract = abstract
        record.source = source
        record.extracted_analysis = json.dumps(extracted_analysis)
        record.comparison_results = json.dumps(comparison_results)
        
        db.commit()
        print(f"Successfully saved metadata for paper: {title} ({paper_id})")
    except Exception as e:
        print(f"Error saving paper metadata to SQLite: {e}")
        db.rollback()
    finally:
        db.close()

def calculate_text_similarity_heuristic(text1: str, text2: str) -> int:
    """Fallback text similarity scorer based on Jaccard word overlap excluding common stop words."""
    if not text1 or not text2:
        return 0
        
    words1 = set(re.findall(r'\w+', text1.lower()))
    words2 = set(re.findall(r'\w+', text2.lower()))
    if not words1 or not words2:
        return 0
        
    intersection = words1.intersection(words2)
    # Exclude common stopwords to compute a more genuine score
    stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with", "by", "of", "is", "are", "was", "were", "this", "that", "these", "those", "we", "our", "paper", "proposed", "results", "method", "system", "using", "based", "from", "as", "it", "its", "which", "can", "have", "has", "be", "an", "not", "this", "that"}
    filtered_intersection = intersection - stopwords
    filtered_words1 = words1 - stopwords
    filtered_words2 = words2 - stopwords
    
    if not filtered_words1 or not filtered_words2:
        return 0
        
    jaccard = len(filtered_intersection) / len(filtered_words1.union(filtered_words2))
    
    # Map Jaccard similarity (normally in range 0.02 - 0.35) to 0 - 100%
    if jaccard > 0.35:
        score = int(85 + (jaccard - 0.35) * 100)
    elif jaccard > 0.05:
        score = int(15 + (jaccard - 0.05) * 230)
    else:
        score = int(jaccard * 300)
        
    return max(0, min(100, score))

def calculate_similarity_scores(uploaded_text: str, uploaded_title: str, similar_papers: list) -> list:
    """Calculates genuine similarity scores (0-100) using SentenceTransformer or Jaccard overlap fallback."""
    embedder = get_embedder()
    
    # 1. Get uploaded paper's abstract or first 3000 characters
    uploaded_abstract = uploaded_text[:3000]
    
    # Try to find abstract using regex
    match = re.search(r'(?i)abstract[\s\S]*?(?=\n\s*(?:introduction|1\b))', uploaded_text)
    if match:
        uploaded_abstract = match.group(0)[:3000]
        
    norm_uploaded_title = normalize_title(uploaded_title)
    
    # Check if embedder is loaded properly
    use_embeddings = embedder and embedder != "fallback"
    
    for paper in similar_papers:
        # 1. Prioritize exact title matches
        norm_paper_title = normalize_title(paper.get("title", ""))
        if norm_uploaded_title and norm_paper_title and norm_uploaded_title == norm_paper_title:
            paper["similarity_score"] = 100
            continue
            
        paper_abstract = paper.get("abstract", "")
        
        # 2. Try embedding cosine similarity
        if use_embeddings and paper_abstract:
            try:
                uploaded_emb = embedder.encode(uploaded_abstract)
                paper_emb = embedder.encode(paper_abstract)
                sim = cosine_sim(uploaded_emb, paper_emb)
                
                # Scale cosine similarity from range [0.1, 0.8] to [10, 95] to make it feel natural
                if sim > 0.8:
                    score = int(90 + (sim - 0.8) * 50)
                elif sim > 0.2:
                    score = int(30 + (sim - 0.2) * 100)
                else:
                    score = int(max(0.0, sim) * 150)
                
                paper["similarity_score"] = max(0, min(100, score))
                continue
            except Exception as e:
                print(f"Error calculating embedding similarity, falling back to heuristic: {e}")
                
        # 3. Fallback to Jaccard word-overlap heuristic
        if paper_abstract:
            paper["similarity_score"] = calculate_text_similarity_heuristic(uploaded_abstract, paper_abstract)
        else:
            paper["similarity_score"] = 50 # Default fallback if abstract is missing
            
    return similar_papers
