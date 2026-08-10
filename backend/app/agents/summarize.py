from app.agents.router import AgentState
from app.services.rag import rag_service
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.config import settings
import fitz # PyMuPDF
from langchain_core.documents import Document

def pdf_parsing_agent(state: AgentState) -> dict:
    """Parses a PDF, DOCX, or TXT file, chunks it, and adds to Chroma."""
    pdf_path = state.get("pdf_path")
    if not pdf_path:
        return {"results": {"error": "No file path provided"}}
        
    text = ""
    ext = pdf_path.lower().split('.')[-1]
    
    if ext == "pdf":
        doc = fitz.open(pdf_path)
        try:
            for page in doc:
                text += page.get_text()
        finally:
            doc.close()
    elif ext == "docx":
        import zipfile
        import xml.etree.ElementTree as ET
        try:
            with zipfile.ZipFile(pdf_path) as z:
                xml_content = z.read('word/document.xml')
                root = ET.fromstring(xml_content)
                namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                paragraphs = []
                for para in root.findall('.//w:p', namespaces):
                    texts = [node.text for node in para.findall('.//w:t', namespaces) if node.text]
                    if texts:
                        paragraphs.append("".join(texts))
                text = "\n".join(paragraphs)
        except Exception as docx_err:
            print(f"Error parsing DOCX: {docx_err}")
            return {"results": {"error": f"Failed to parse DOCX: {str(docx_err)}"}}
    elif ext in ["txt", "md"]:
        try:
            with open(pdf_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except Exception as txt_err:
            print(f"Error parsing TXT: {txt_err}")
            return {"results": {"error": f"Failed to parse TXT: {str(txt_err)}"}}
    else:
        try:
            with open(pdf_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except:
            return {"results": {"error": f"Unsupported file format: {ext}"}}
        
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
    """Generates structured summary, extracts system architecture, compares with literature, and persists metadata."""
    import asyncio
    import json
    from app.agents.search import fetch_all_sources, deduplicate_results
    from app.services.paper_helper import save_paper_metadata, calculate_similarity_scores

    results = state.get("results", {})
    text = results.get("pdf_text", "")
    extracted_title = results.get("extracted_title", "")
    extracted_authors = results.get("extracted_authors", "")
    pdf_path = state.get("pdf_path")

    if not text:
        return {"results": {"error": "No text found for summarization"}}
        
    if not settings.API_KEY:
        return {"results": {"summary": "API Key missing. Please set API_KEY."}}
        
    llm = ChatOpenAI(
        model="nova-micro",
        api_key=settings.API_KEY,
        base_url=settings.BASE_URL
    )

    # 1. Step 1: Detailed Extraction of the 13 required fields in JSON format
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
        analysis_data = json.loads(content)
    except Exception as e:
        print(f"Error during detailed paper analysis: {e}")
        # Fallback empty structure
        analysis_data = {
            "topic": "Not extracted", "problem_statement": "Not extracted", "objectives": "Not extracted",
            "methodology": "Not extracted", "proposed_approach": "Not extracted", "system_architecture": "Not extracted",
            "components": "Not extracted", "data_flow": "Not extracted", "algorithms": "Not extracted",
            "dataset": "Not extracted", "inputs_outputs": "Not extracted", "results": "Not extracted",
            "key_findings": "Not extracted", "abstract": text[:500]
        }

    # 2. Step 2: Fetch similar papers for comparison
    search_query = extracted_title or analysis_data.get("topic") or "machine learning"
    similar_papers = []
    try:
        all_papers = asyncio.run(fetch_all_sources(search_query))
        unique_papers = deduplicate_results(all_papers)
        # Take up to 4 similar papers
        for p in unique_papers[:4]:
            similar_papers.append({
                "title": p.get("title", ""),
                "authors": p.get("authors", []),
                "abstract": p.get("abstract", ""),
                "pdf_url": p.get("pdf_url", ""),
                "source": p.get("source", "Unknown")
            })
    except Exception as search_err:
        print(f"Error searching similar papers: {search_err}")

    # 3. Step 3: Calculate genuine similarity scores using sentence embeddings
    similar_papers = calculate_similarity_scores(text, extracted_title, similar_papers)

    # 4. Step 4: Call LLM to compare similarities/differences
    comparison_prompt = f"""
    You are an expert peer reviewer. Compare the uploaded research paper with the following similar papers.
    For each paper, analyze similarities and differences in topic, methodology, architecture, datasets, results, and technical concepts.
    
    Uploaded Paper Title: {extracted_title}
    Uploaded Abstract: {analysis_data.get("abstract")}
    Uploaded Architecture: {analysis_data.get("system_architecture")}
    
    Similar Papers:
    {json.dumps(similar_papers, indent=2)}
    
    Generate a detailed comparison report in markdown. Group the papers and display them in order of their similarity_score (e.g. "Paper A — 87% Similarity").
    For each compared paper:
    1. Display similarity score clearly (e.g. `### Title — 87% Similarity`)
    2. Provide bullet points explaining major similarities and differences.
    
    Return only the markdown text.
    """
    try:
        comp_response = llm.invoke([HumanMessage(content=comparison_prompt)])
        comparison_report = comp_response.content.strip()
    except Exception as e:
        print(f"Error during comparison generation: {e}")
        comparison_report = "Error generating literature comparison report."

    # 5. Step 5: Save metadata and analysis in SQLite database
    save_paper_metadata(
        paper_id=pdf_path,
        title=extracted_title,
        authors=extracted_authors,
        abstract=analysis_data.get("abstract", ""),
        source="upload_public",
        extracted_analysis=analysis_data,
        comparison_results=similar_papers
    )

    # 6. Step 6: Formulate beautiful final markdown response
    unified_report = f"""# Detailed Research Analysis & Literature Comparison

## 1. Research Paper Analysis

* **Topic**: {analysis_data.get("topic")}
* **Problem Statement**: {analysis_data.get("problem_statement")}
* **Objectives**: {analysis_data.get("objectives")}
* **Methodology**: {analysis_data.get("methodology")}
* **Proposed Approach**: {analysis_data.get("proposed_approach")}
* **System Architecture & Workflow**: {analysis_data.get("system_architecture")}
* **Components / Modules**: {analysis_data.get("components")}
* **Data Flow**: {analysis_data.get("data_flow")}
* **Algorithms & Models**: {analysis_data.get("algorithms")}
* **Dataset**: {analysis_data.get("dataset")}
* **Inputs & Outputs**: {analysis_data.get("inputs_outputs")}
* **Results**: {analysis_data.get("results")}
* **Key Findings**: {analysis_data.get("key_findings")}

---

## 2. Literature Comparison

{comparison_report}
"""

    current_results = state.get("results", {}) or {}
    current_results["summary"] = unified_report
    return {"results": current_results}
