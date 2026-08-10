# ResearchAI: System Architecture Analysis & Literature Comparison Assistant

ResearchAI is a premium AI-powered workspace designed to help researchers parse, analyze, compare, and visually diagram system architectures directly from research papers. It features a unified document ingestion pipeline, database-backed metadata persistence, genuine literature similarity comparison, and intent-based diagram generation.

---

## 🚀 Key Features

### 1. Structural Paper Analysis (13 Fields)
When a document (PDF, DOCX, TXT, MD) is uploaded, the ingestion pipeline parses the content and extracts exactly 13 structural detail fields to use as the source of truth:
* **Research Topic** & **Problem Statement**
* **Objectives** & **Methodology**
* **Proposed Approach**
* **System Architecture & Workflow**
* **Components / Modules** & **Data Flow**
* **Algorithms / Models** & **Dataset Used**
* **Inputs & Outputs**
* **Quantitative/Qualitative Results** & **Key Findings**

### 2. Literature Comparison & Genuine Similarity Scores
* Searches databases like **arXiv** and **Semantic Scholar** using extracted keywords and titles.
* Computes **genuine similarity scores** (0-100%) between the uploaded paper's abstract and similar papers.
* Leverages sentence embeddings via **SentenceTransformer** (with a local Jaccard word-overlap fallback for offline or restricted environments).
* Renders a detailed peer-review comparison report detailing similarities and differences.

### 3. Pure Intent-Based Diagram Generation
* No cluttering "Generate Image" buttons. The system detects user intent from text prompts (e.g., *"Create a flowchart showing the component workflow"*).
* Generates schematic-style architecture diagrams **strictly grounded** in the components, modules, algorithms, and connections described in the research paper.

### 4. Interactive Workspace UI
* Modern dark-themed workspace built with micro-animations and smooth responsive styling.
* Integrates Web-speech APIs for voice synthesis responses and recording transcriptions.

---

## 🛠️ Technology Stack

### Backend
* **FastAPI**: Asynchronous high-performance web API framework.
* **LangGraph**: Orchestrates the multi-agent graph workflows (Parsing -> Analysis -> Comparison -> Novelty Reporting).
* **SQLAlchemy & SQLite**: Self-migrating database schema to cache structural architectures and comparisons.
* **ChromaDB**: Vector database for RAG document chunk retrievals.

### Frontend
* **React** + **Vite**: High-performance client-side rendering environment.
* **Vanilla CSS**: Curated color palettes, dark theme, and sleek layouts.
* **Lucide React**: Clean vector icon toolkit.

---

## ⚙️ Setup & Installation

### Prerequisites
* Python 3.10+
* Node.js 18+

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure environment variables. Create a `.env` file in the root backend directory:
   ```env
   DATABASE_URL=sqlite:///./researchai.db
   API_KEY=your_openai_or_custom_llm_api_key
   BASE_URL=your_custom_llm_endpoint_url
   TTS_MODEL=gpt-4o-mini-tts
   STT_MODEL=whisper-1
   IMAGE_GENERATION_MODEL=imagen-4.0-fast-generate-001
   ```
4. Run the FastAPI development server:
   ```bash
   python app/main.py
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```

---

## 📊 Ingestion Workflow Diagram

```
[ Upload PDF ]
      │
      ▼
[ pdf_parsing_agent ] ──► Extracts Text & Metadata
      │
      ▼
[ summarization_agent ] ──► Core 13-Field Extraction
      │
      ├─► [ Search Literature ] ──► arXiv / Semantic Scholar API
      │                                     │
      ├─► [ Similarity Scorer ] ◄───────────┘ (SentenceTransformer / Jaccard)
      │
      ▼
[ Save SQLite ] ──► Caches metadata under paper_id (temp_uploads file path)
      │
      ▼
[ UI Workspace ] ──► Renders Markdown Structured Summary & Comparisons
```
