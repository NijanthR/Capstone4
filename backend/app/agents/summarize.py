from app.agents.router import AgentState
from app.services.rag import rag_service
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.config import settings
import fitz # PyMuPDF
from langchain_core.documents import Document

def pdf_parsing_agent(state: AgentState) -> dict:
    """Parses a PDF, chunks it, and adds to Chroma."""
    pdf_path = state.get("pdf_path")
    if not pdf_path:
        return {"results": {"error": "No PDF path provided"}}
        
    doc = fitz.open(pdf_path)
    text = ""
    try:
        for page in doc:
            text += page.get_text()
    finally:
        doc.close()
        
    # Chunking
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_text(text)
    
    docs = [Document(page_content=chunk, metadata={"source": pdf_path}) for chunk in chunks]
    
    # Add to ChromaDB
    rag_service.add_documents(docs)
    
    # Extract title and authors
    extracted_title = ""
    extracted_authors = ""
    if settings.API_KEY:
        try:
            llm = ChatOpenAI(
                model="nova-micro",
                api_key=settings.API_KEY,
                base_url=settings.BASE_URL
            )
            metadata_prompt = f"""
            Analyze the following research paper text and extract:
            1. The exact title of the paper.
            2. The authors of the paper (as a single clean string of names separated by commas).
            
            Return ONLY a valid JSON object with the keys "title" and "authors". Do not include any markdown formatting like ```json or ```.
            
            Paper Text (start):
            {text[:2000]}
            """
            response = llm.invoke([HumanMessage(content=metadata_prompt)])
            content = response.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            elif content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            try:
                import json
                meta = json.loads(content)
                extracted_title = meta.get("title", "").strip().replace('"', '').replace("'", "")
                extracted_authors = meta.get("authors", "").strip()
                if isinstance(extracted_authors, list):
                    extracted_authors = ", ".join(extracted_authors)
            except Exception as json_err:
                print(f"JSON parsing error for metadata: {json_err}")
                extracted_title = content
                extracted_authors = ""
        except Exception as e:
            print(f"Error extracting metadata in parser: {e}")
            
    return {"results": {
        "pdf_text": text, 
        "extracted_title": extracted_title, 
        "extracted_authors": extracted_authors
    }}

def summarization_agent(state: AgentState) -> dict:
    """Generates structured summary from parsed PDF."""
    results = state.get("results", {})
    text = results.get("pdf_text", "")
    
    if not text:
        return {"results": {"error": "No text found for summarization"}}
        
    if not settings.API_KEY:
        return {"results": {"summary": "API Key missing. Please set API_KEY."}}
        
    llm = ChatOpenAI(
        model="nova-micro",
        api_key=settings.API_KEY,
        base_url=settings.BASE_URL
    )
    
    prompt = f"""
    Please provide a structured summary of the following research paper. Include:
    - Title
    - Authors
    - Abstract
    - Problem Statement
    - Proposed Method
    - Dataset Used
    - Results
    - Advantages
    - Limitations
    - Future Work
    
    Paper text (first 10000 chars):
    {text[:10000]}
    """
    
    response = llm.invoke([HumanMessage(content=prompt)])
    
    current_results = state.get("results", {}) or {}
    current_results["summary"] = response.content
    return {"results": current_results}
