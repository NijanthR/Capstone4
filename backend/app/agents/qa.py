from app.agents.router import AgentState
from app.services.rag import rag_service
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.config import settings

def qa_agent(state: AgentState) -> dict:
    """Answers follow-up questions using RAG."""
    query = state.get("query")
    if not query:
        query = state["messages"][-1].content
        
    pdf_path = state.get("pdf_path")
    retriever = rag_service.get_retriever(pdf_path)
    docs = retriever.invoke(query)
    
    context = "\n\n".join([doc.page_content for doc in docs])
    
    if not settings.API_KEY:
        return {"results": {"answer": "API Key missing. Please set API_KEY."}}
        
    llm = ChatOpenAI(
        model="nova-micro",
        api_key=settings.API_KEY,
        base_url=settings.BASE_URL
    )
    
    paper_title = state.get("paper_title")
    paper_authors = state.get("paper_authors")
    
    paper_info = ""
    if paper_title:
        paper_info += f"Active Research Paper Title: {paper_title}\n"
    if paper_authors:
        paper_info += f"Active Research Paper Authors: {paper_authors}\n"
        
    prompt = f"""
    You are an AI Research Assistant. Use the following context retrieved from the user's research papers to answer the question.
    If the context does not contain the answer, you can also use your general knowledge, but clearly state what is from the paper vs general knowledge.
    
    {paper_info}
    Context:
    {context}
    
    Question: {query}
    """
    
    response = llm.invoke([HumanMessage(content=prompt)])
    
    return {"results": {"answer": response.content}}
