from app.agents.router import AgentState
from app.services.rag import rag_service
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.config import settings

def qa_agent(state: AgentState) -> dict:
    """Answers follow-up questions using RAG, literature search, and optional image generation."""
    import json
    from app.models.database import SessionLocal
    from app.models.schemas import PaperMetadata
    from langchain_core.messages import HumanMessage
    query = state.get("query")
    if not query:
        if state.get("messages"):
            query = state["messages"][-1].content
        else:
            query = ""
            
    pdf_path = state.get("pdf_path")
    context = ""
    try:
        retriever = rag_service.get_retriever(pdf_path)
        if retriever:
            docs = retriever.invoke(query)
            context = "\n\n".join([doc.page_content for doc in docs])
    except Exception as rag_err:
        print(f"RAG retrieval failed (using cached database metadata only): {rag_err}")
        context = ""

    if not settings.API_KEY:
        return {"results": {"answer": "{\"answer\": \"API Key missing. Please set API_KEY.\", \"image_prompt\": null}"}}
        
    # 1. Fetch paper metadata and extracted architecture from SQLite
    db = SessionLocal()
    paper_meta = None
    try:
        if pdf_path:
            paper_meta = db.query(PaperMetadata).filter(PaperMetadata.id == pdf_path).first()
    except Exception as db_err:
        print(f"Error querying PaperMetadata in QA agent: {db_err}")
    finally:
        db.close()

    extracted_info = ""
    comparison_info = ""
    paper_title = state.get("paper_title") or (paper_meta.title if paper_meta else None)
    paper_authors = state.get("paper_authors") or (paper_meta.authors if paper_meta else None)
    
    if paper_meta:
        try:
            if paper_meta.extracted_analysis:
                analysis_data = json.loads(paper_meta.extracted_analysis)
                extracted_info = f"""
=== ARCHITECTURE & CORE DETAIL SOURCE OF TRUTH (FROM THE RESEARCH PAPER) ===
Title: {paper_meta.title}
Authors: {paper_meta.authors}
Research Topic: {analysis_data.get('topic')}
Problem Statement: {analysis_data.get('problem_statement')}
Objectives: {analysis_data.get('objectives')}
Methodology: {analysis_data.get('methodology')}
Proposed Approach: {analysis_data.get('proposed_approach')}
System Architecture & Workflow: {analysis_data.get('system_architecture')}
Components / Modules: {analysis_data.get('components')}
Data Flow: {analysis_data.get('data_flow')}
Algorithms & Models: {analysis_data.get('algorithms')}
Dataset: {analysis_data.get('dataset')}
Inputs & Outputs: {analysis_data.get('inputs_outputs')}
Results: {analysis_data.get('results')}
Key Findings: {analysis_data.get('key_findings')}
"""
            if paper_meta.comparison_results:
                comp_data = json.loads(paper_meta.comparison_results)
                comparison_info = f"""
=== LITERATURE COMPARISON DETAILS ===
{json.dumps(comp_data, indent=2)}
"""
        except Exception as json_err:
            print(f"Error parsing SQLite metadata in QA: {json_err}")

    paper_info = ""
    if paper_title:
        paper_info += f"Active Research Paper Title: {paper_title}\n"
    if paper_authors:
        paper_info += f"Active Research Paper Authors: {paper_authors}\n"
        
    llm = ChatOpenAI(
        model="nova-micro",
        api_key=settings.API_KEY,
        base_url=settings.BASE_URL
    )
    
    prompt = f"""
    You are an AI Research Assistant. Use the following context, extracted system architecture details, and literature comparison information to answer the user's question.
    
    {paper_info}
    
    {extracted_info}
    
    {comparison_info}
    
    Additional Chunk Context:
    {context}
    
    User Question: {query}
    
    CRITICAL INSTRUCTIONS:
    1. INTENT-BASED IMAGE GENERATION:
       Analyze the User Question and determine if the user is explicitly requesting a diagram, flowchart, schematic, workflow diagram, system architecture diagram, or visual illustration.
       - If they are NOT requesting an image/diagram, you MUST set the "image_prompt" field to null. Do NOT generate an image prompt.
       - If they are requesting an image/diagram, you MUST formulate a detailed description/prompt for an image generator (like DALL-E) and place it in the "image_prompt" field. The image prompt should specify: a clean, professional schematic style diagram, vector art, dark mode/light mode theme corresponding to the system architecture. In the "answer" field, write a brief explanation of what the diagram illustrates.
    
    2. ARCHITECTURE ACCURACY:
       Any generated image prompt or architectural explanation MUST be strictly grounded in the actual methodology, components, modules, algorithms, data flow, inputs, and outputs described in the research paper (refer to the ARCHITECTURE & CORE DETAIL SOURCE OF TRUTH). Do not invent components or connections that are not supported by the paper. The user's query determines the style, format, and level of detail of the diagram, but the paper determines the technical relationships.
       
    3. Return your response as a valid JSON object matching this schema:
    {{
      "answer": "<markdown formatted text answer or brief explanation for the diagram>",
      "image_prompt": "<detailed image generation prompt, or null if no diagram is requested>"
    }}
    Return ONLY the raw JSON block. Do not wrap it in markdown code blocks like ```json.
    """
    
    response = llm.invoke([HumanMessage(content=prompt)])
    return {"results": {"answer": response.content}}
