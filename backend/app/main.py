import sys
import os
# Add the parent 'backend' directory to Python path so absolute imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["USE_TF"] = "0"

# Patch requests to enforce a default timeout of 10s (prevents third-party libraries like arxiv from hanging indefinitely)
import requests
if not hasattr(requests.Session, "_patched"):
    requests.Session._patched = True
    _original_request = requests.Session.request
    def _patched_request(self, method, url, *args, **kwargs):
        if 'timeout' not in kwargs:
            kwargs['timeout'] = 10.0
        return _original_request(self, method, url, *args, **kwargs)
    requests.Session.request = _patched_request



import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.models.database import engine, Base
from app.models import schemas

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to ResearchAI API"}

from app.api import routes
app.include_router(routes.router, prefix="/api")

if __name__ == "__main__":
    print("Starting ResearchAI API server...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
