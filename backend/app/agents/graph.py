from langgraph.graph import StateGraph, END
from app.agents.router import AgentState, supervisor_router, route_based_on_intent
from app.agents.search import search_agent
from app.agents.summarize import pdf_parsing_agent, summarization_agent
from app.agents.qa import qa_agent
from app.agents.novelty import novelty_check_agent, similarity_analysis_agent, novelty_report_agent

def build_graph():
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("supervisor", supervisor_router)
    workflow.add_node("search_agent", search_agent)
    workflow.add_node("upload_agent_public", pdf_parsing_agent)
    workflow.add_node("upload_agent_own", pdf_parsing_agent) # Reuse parser for now
    workflow.add_node("summarization_agent", summarization_agent)
    workflow.add_node("qa_agent", qa_agent)
    workflow.add_node("novelty_check_agent", novelty_check_agent)
    workflow.add_node("similarity_analysis_agent", similarity_analysis_agent)
    workflow.add_node("novelty_report_agent", novelty_report_agent)
    
    # Add edges
    workflow.set_entry_point("supervisor")
    
    # Conditional routing from supervisor
    workflow.add_conditional_edges("supervisor", route_based_on_intent)
    
    # WF1: Search -> (User selects paper to download, handled by API) -> Parse -> Summarize
    # In graph, we just end after search. The next API call will trigger parsing.
    workflow.add_edge("search_agent", END)
    
    # WF2: Upload Public -> Parse -> Summarize -> QA (optional, handled by next call)
    workflow.add_edge("upload_agent_public", "summarization_agent")
    workflow.add_edge("summarization_agent", END)
    workflow.add_edge("qa_agent", END) # Called directly by API for follow-ups
    
    # WF3: Upload Own -> Parse -> Novelty Check -> Similarity -> Report
    workflow.add_edge("upload_agent_own", "novelty_check_agent")
    workflow.add_edge("novelty_check_agent", "similarity_analysis_agent")
    workflow.add_edge("similarity_analysis_agent", "novelty_report_agent")
    workflow.add_edge("novelty_report_agent", END)
    
    return workflow.compile()

research_graph = build_graph()
