from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Response
from pydantic import BaseModel
from app.agents.graph import research_graph
from app.core.config import settings
import os
import shutil
import httpx


router = APIRouter()

active_pdf_path = None

class TTSRequest(BaseModel):
    text: str
    voice: str | None = None

@router.post("/audio/tts")
async def text_to_speech(request: TTSRequest):
    if not settings.API_KEY:
        raise HTTPException(status_code=400, detail="API key is missing.")
    try:
        headers = {"Authorization": f"Bearer {settings.API_KEY}"}
        payload = {
            "model": settings.TTS_MODEL,
            "input": request.text,
            "voice": request.voice or "alloy"
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.BASE_URL}/audio/speech",
                json=payload,
                headers=headers,
                timeout=30.0
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=f"TTS error: {resp.text}")
        return Response(content=resp.content, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/audio/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not settings.API_KEY:
        raise HTTPException(status_code=400, detail="API key is missing.")
    try:
        audio_bytes = await file.read()
        headers = {"Authorization": f"Bearer {settings.API_KEY}"}
        files = {
            'file': (file.filename or 'speech.webm', audio_bytes, file.content_type or 'audio/webm')
        }
        data = {
            'model': settings.STT_MODEL
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.BASE_URL}/audio/transcriptions",
                headers=headers,
                files=files,
                data=data,
                timeout=60.0
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=f"STT error: {resp.text}")
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SearchRequest(BaseModel):
    query: str

class QARequest(BaseModel):
    query: str
    paper_id: str | None = None
    paper_title: str | None = None
    paper_authors: str | None = None

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
        # Save file temporarily with a unique name to prevent collisions
        import uuid
        os.makedirs("temp_uploads", exist_ok=True)
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        unique_filename = f"{uuid.uuid4().hex}{ext}"
        file_path = f"temp_uploads/{unique_filename}"
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        intent = "upload_own" if is_own_research else "upload_public"
        
        global active_pdf_path
        active_pdf_path = file_path
        
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
            
        results = final_state.get("results", {}) or {}
        results["paper_id"] = file_path
        if not results.get("extracted_title"):
            results["extracted_title"] = os.path.splitext(file.filename)[0]
        if not results.get("extracted_authors"):
            results["extracted_authors"] = ""
        return results
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
        # Generate safe filename from url or title, appending a UUID to ensure uniqueness
        import uuid
        safe_title = "".join(x for x in (request.title or "paper") if x.isalnum() or x in " -_")
        file_path = f"temp_uploads/{safe_title[:40]}_{uuid.uuid4().hex[:8]}.pdf"
        
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
        global active_pdf_path
        active_pdf_path = file_path

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
            
        results = final_state.get("results", {}) or {}
        results["paper_id"] = file_path
        if not results.get("extracted_title"):
            results["extracted_title"] = request.title or "Selected Paper"
        if not results.get("extracted_authors"):
            results["extracted_authors"] = ""
        return results
    except Exception as e:
        traceback.print_exc()
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

@router.post("/qa")
async def ask_question(request: QARequest):
    try:
        # QA runs isolated for follow-ups
        from app.agents.qa import qa_agent
        
        pdf_path = request.paper_id or active_pdf_path
        
        state = {
            "messages": [],
            "intent": "qa",
            "query": request.query,
            "pdf_path": pdf_path,
            "paper_title": request.paper_title,
            "paper_authors": request.paper_authors,
            "is_own_research": False,
            "results": {}
        }
        
        result = qa_agent(state)
        content = result["results"].get("answer", "")
        
        import json
        answer_text = ""
        image_url = None
        
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        try:
            parsed = json.loads(content)
            answer_text = parsed.get("answer", "")
            image_prompt = parsed.get("image_prompt", None)
            
            if image_prompt:
                # Try calling Navigate Labs AI image generator
                try:
                    headers = {"Authorization": f"Bearer {settings.API_KEY}"}
                    payload = {
                        "model": settings.IMAGE_GENERATION_MODEL,
                        "prompt": image_prompt,
                        "n": 1,
                        "size": "1024x1024"
                    }
                    async with httpx.AsyncClient() as client:
                        resp = await client.post(
                            f"{settings.BASE_URL}/images/generations",
                            headers=headers,
                            json=payload,
                            timeout=60.0
                        )
                    if resp.status_code == 200:
                        resp_data = resp.json()
                        b64_data = resp_data.get("data", [{}])[0].get("b64_json")
                        if b64_data:
                            image_url = f"data:image/png;base64,{b64_data}"
                        else:
                            image_url = resp_data.get("data", [{}])[0].get("url")
                    else:
                        print(f"Custom image generation failed with status {resp.status_code}: {resp.text}")
                        raise RuntimeError("Failed to generate image via Navigate Labs AI API")
                except Exception as img_err:
                    print(f"Error during custom image generation: {img_err}. Falling back to Pollinations AI.")
                    import urllib.parse
                    encoded_prompt = urllib.parse.quote(image_prompt)
                    image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=768&nologo=true"
        except Exception as json_err:
            print(f"Failed to parse QA response as JSON: {json_err}. Raw content: {content}")
            answer_text = content
            
        return {"answer": answer_text, "image_url": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
