from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pydantic import BaseModel
from app.agents.graph import research_graph
import os
import shutil

router = APIRouter()

class SearchRequest(BaseModel):
    query: str

class QARequest(BaseModel):
    query: str

@router.post("/search")
def search_papers(request: SearchRequest):
    try:
        # Run the workflow
        initial_state = {
            "messages": [],
            "intent": "search",
            "query": request.query,
            "pdf_path": None,
            "is_own_research": False,
            "results": {}
        }
        
        final_state = research_graph.invoke(initial_state)
        return final_state["results"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
def upload_paper(
    file: UploadFile = File(...),
    is_own_research: bool = Form(False)
):
    try:
        # Save file temporarily
        os.makedirs("temp_uploads", exist_ok=True)
        file_path = f"temp_uploads/{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        intent = "upload_own" if is_own_research else "upload_public"
        
        initial_state = {
            "messages": [],
            "intent": intent,
            "query": None,
            "pdf_path": file_path,
            "is_own_research": is_own_research,
            "results": {}
        }
        
        final_state = research_graph.invoke(initial_state)
        
        # Clean up
        if os.path.exists(file_path):
            os.remove(file_path)
            
        return final_state["results"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SelectPaperRequest(BaseModel):
    pdf_url: str
    title: str | None = None

@router.post("/select_paper")
async def select_paper(request: SelectPaperRequest):
    import traceback
    file_path = None
    try:
        # 1. Download PDF
        import httpx
        os.makedirs("temp_uploads", exist_ok=True)
        # Generate safe filename from url or title
        safe_title = "".join(x for x in (request.title or "paper") if x.isalnum() or x in " -_")
        file_path = f"temp_uploads/{safe_title[:50]}.pdf"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        download_success = False
        async with httpx.AsyncClient(verify=False) as client:
            try:
                resp = await client.get(request.pdf_url, headers=headers, follow_redirects=True, timeout=30.0)
                if resp.status_code == 200:
                    with open(file_path, "wb") as f:
                        f.write(resp.content)
                    download_success = True
                else:
                    print(f"HTTPX download failed with status {resp.status_code}")
            except Exception as httpx_err:
                print(f"HTTPX download exception: {httpx_err}")
                
        # Fallback to requests if HTTPX failed
        if not download_success:
            import requests
            try:
                print("Trying fallback download with requests...")
                resp = requests.get(request.pdf_url, headers=headers, verify=False, timeout=30.0)
                if resp.status_code == 200:
                    with open(file_path, "wb") as f:
                        f.write(resp.content)
                    download_success = True
                else:
                    print(f"Requests download failed with status {resp.status_code}")
            except Exception as req_err:
                print(f"Requests download exception: {req_err}")
                
        if not download_success:
            raise HTTPException(status_code=400, detail="Failed to download PDF from the provided URL (Connection/HTTP error).")
            
        # 2. Invoke Graph (upload_public runs parse -> summarize)
        initial_state = {
            "messages": [],
            "intent": "upload_public",
            "query": None,
            "pdf_path": file_path,
            "is_own_research": False,
            "results": {}
        }
        
        final_state = research_graph.invoke(initial_state)
        
        # 3. Clean up
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            
        return final_state["results"]
    except Exception as e:
        traceback.print_exc()
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

@router.post("/qa")
def ask_question(request: QARequest):
    try:
        # QA runs isolated for follow-ups
        from app.agents.qa import qa_agent
        
        state = {
            "messages": [],
            "intent": "qa",
            "query": request.query,
            "pdf_path": None,
            "is_own_research": False,
            "results": {}
        }
        
        result = qa_agent(state)
        return result["results"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
