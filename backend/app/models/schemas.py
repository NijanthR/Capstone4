from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from app.models.database import Base

class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class PaperMetadata(Base):
    __tablename__ = "paper_metadata"

    id = Column(String, primary_key=True, index=True) # Could be arxiv ID or custom ID
    title = Column(String, index=True)
    authors = Column(String)
    abstract = Column(Text)
    url = Column(String)
    source = Column(String) # arxiv, upload, etc.
    upload_timestamp = Column(DateTime, default=datetime.utcnow)
