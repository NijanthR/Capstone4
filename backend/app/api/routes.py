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
