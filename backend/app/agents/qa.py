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
        
    retriever = rag_service.get_retriever()
    docs = retriever.invoke(query)
    
    context = "\n\n".join([doc.page_content for doc in docs])
    
    if not settings.API_KEY:
        return {"results": {"answer": "API Key missing. Please set API_KEY."}}
        
    llm = ChatOpenAI(
        model="nova-micro",
        api_key=settings.API_KEY,
        base_url=settings.BASE_URL
    )
    
    prompt = f"""
    You are an AI Research Assistant. Use the following context retrieved from the user's research papers to answer the question.
    If the context does not contain the answer, you can also use your general knowledge, but clearly state what is from the paper vs general knowledge.
    
    Context:
    {context}
    
    Question: {query}
    """
    
    response = llm.invoke([HumanMessage(content=prompt)])
    
    return {"results": {"answer": response.content}}
