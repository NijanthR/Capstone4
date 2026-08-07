from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from app.core.config import settings

# Define the state of the graph
class AgentState(TypedDict):
    messages: Sequence[BaseMessage]
    intent: str
    query: str | None
    pdf_path: str | None
    is_own_research: bool | None
    results: dict | None

class RouterDecision(BaseModel):
    intent: str = Field(description="The user's intent. Must be one of: 'search', 'upload_public', 'upload_own'")

def supervisor_router(state: AgentState) -> dict:
    # If intent is already explicitly set (e.g., from api routes), respect it
    if state.get("intent") in ["upload_public", "upload_own", "search"]:
        return {"intent": state["intent"]}

    if settings.API_KEY:
        llm = ChatOpenAI(
            model="nova-micro",
            api_key=settings.API_KEY,
            base_url=settings.BASE_URL
        )
        structured_llm = llm.with_structured_output(RouterDecision)
        
        user_input = state['messages'][-1].content if state.get('messages') else state.get('query', '')
        
        prompt = f"""You are the Supervisor Router for ResearchAI.
        Decide whether the user wants to:
        1. search for papers ('search')
        2. upload and summarize a public paper ('upload_public')
        3. upload their own unpublished research for a novelty check ('upload_own')
        
        User input: {user_input}
        
        You must return a valid JSON object matching the requested schema. If the input is just a keyword or ambiguous, assume the intent is 'search'.
        """
        
        try:
            decision = structured_llm.invoke(prompt)
            intent = decision.intent
        except Exception as e:
            print(f"Router LLM Error (falling back to search): {e}")
            intent = "search"
            
        return {"intent": intent}
    
    # Fallback default
    return {"intent": "search"}

def route_based_on_intent(state: AgentState) -> str:
    if state["intent"] == "search":
        return "search_agent"
    elif state["intent"] == "upload_public":
        return "upload_agent_public"
    elif state["intent"] == "upload_own":
        return "upload_agent_own"
    return END

# We will build the full graph in another module once all agents are defined.
