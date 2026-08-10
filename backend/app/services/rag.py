import os
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from app.core.config import settings

class RAGService:
    def __init__(self):
        # We will use OpenAI Embeddings pointing to the custom base_url
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small", 
            api_key=settings.API_KEY, 
            base_url=settings.BASE_URL
        ) if settings.API_KEY else None
        
        # Initialize Chroma vector store if embeddings are set
        if self.embeddings:
            try:
                self.vector_store = Chroma(
                    persist_directory=settings.CHROMA_PERSIST_DIR,
                    embedding_function=self.embeddings
                )
                print(f"Loaded Chroma DB from {settings.CHROMA_PERSIST_DIR}")
            except Exception as e:
                print(f"Error initializing Chroma DB: {e}")
                self.vector_store = None
        else:
            self.vector_store = None
            print("Warning: API_KEY not set. Chroma DB will not be initialized.")

    def add_documents(self, chunks: list[Document]):
        """Add document chunks to vector store"""
        if self.vector_store:
            try:
                self.vector_store.add_documents(chunks)
                print(f"Added {len(chunks)} chunks to Chroma DB.")
            except Exception as e:
                print(f"Error adding documents to Chroma DB: {e}")
        else:
            print("Warning: API_KEY not set or Chroma DB not initialized. Cannot embed documents.")

    def get_retriever(self, pdf_path: str = None):
        """Get retriever for QA"""
        if not self.vector_store:
            print("Warning: Vector store not initialized. Returning None.")
            return None
            
        search_kwargs = {"k": 15}
        if pdf_path:
            # Chroma DB uses dict-based metadata filtering
            search_kwargs["filter"] = {"source": pdf_path}
        return self.vector_store.as_retriever(search_kwargs=search_kwargs)

rag_service = RAGService()

