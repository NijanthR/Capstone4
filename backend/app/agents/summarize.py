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
    for page in doc:
        text += page.get_text()
        
    # Chunking
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_text(text)
    
    docs = [Document(page_content=chunk, metadata={"source": pdf_path}) for chunk in chunks]
    
    # Add to ChromaDB
    rag_service.add_documents(docs)
    
    return {"results": {"pdf_text": text}}

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
    
    return {"results": {"summary": response.content}}
