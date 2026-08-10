import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ResearchAI API"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./researchai.db")
    
    # LLM Settings
    API_KEY: str = os.getenv("API_KEY", "")
    BASE_URL: str = os.getenv("BASE_URL", "")
    TTS_MODEL: str = os.getenv("TTS_MODEL", "gpt-4o-mini-tts")
    STT_MODEL: str = os.getenv("STT_MODEL", "whisper-1")
    IMAGE_GENERATION_MODEL: str = os.getenv("IMAGE_GENERATION_MODEL", "imagen-4.0-fast-generate-001")
    
    # Search API Settings
    CORE_API_KEY: str = os.getenv("CORE_API_KEY", "")
    SEMANTIC_SCHOLAR_API_KEY: str = os.getenv("SEMANTIC_SCHOLAR_API_KEY", "")
    CROSSREF_EMAIL: str = os.getenv("CROSSREF_EMAIL", "test@example.com")
    
    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_db"

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")

settings = Settings()
