import chromadb
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
        
        # Initialize ChromaDB client
        self.chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        
        # Initialize Langchain Chroma Wrapper
        self.vector_store = Chroma(
            client=self.chroma_client,
            collection_name="research_papers",
            embedding_function=self.embeddings,
        )

    def add_documents(self, chunks: list[Document]):
        """Add document chunks to vector store"""
        if self.embeddings:
            self.vector_store.add_documents(chunks)
        else:
            print("Warning: API_KEY not set. Cannot embed documents.")

    def get_retriever(self, pdf_path: str = None):
        """Get retriever for QA"""
        search_kwargs = {"k": 15}
        if pdf_path:
            search_kwargs["filter"] = {"source": pdf_path}
        return self.vector_store.as_retriever(search_kwargs=search_kwargs)

rag_service = RAGService()
