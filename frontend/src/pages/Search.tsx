import React, { useState } from 'react';
import { Search as SearchIcon, FileText, ExternalLink, ArrowLeft, MessageSquare, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [processing, setProcessing] = useState(false);
  const [processingTitle, setProcessingTitle] = useState('');
  const [summary, setSummary] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    setSummary(null);
    
    try {
      // Use local FastAPI backend via env
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await axios.post(`${baseUrl}/api/search`, { query });
      setResults(response.data.search_results || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch research papers. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async (paper: any) => {
    if (!paper.pdf_url) return;
    
    setProcessing(true);
    setProcessingTitle(paper.title || 'Selected Paper');
    setError('');
    
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await axios.post(`${baseUrl}/api/select_paper`, {
        pdf_url: paper.pdf_url,
        title: paper.title
      });
      setSummary(response.data);
    } catch (err) {
      console.error(err);
      setError('Failed to download and process the selected paper.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
        <SearchIcon className="mr-3 text-primary-600" />
        Search Research Papers
      </h1>
      
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg mb-6">{error}</div>}

      {processing ? (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-600 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyzing & Indexing Paper</h2>
          <p className="text-gray-600 font-medium max-w-md mx-auto mb-4">"{processingTitle}"</p>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">We are downloading this PDF, splitting it into chunks, indexing it into the database for chat support, and generating a structured summary...</p>
        </div>
      ) : summary ? (
        <div className="space-y-8">
          <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center text-green-700">
            <CheckCircle className="w-6 h-6 mr-3 flex-shrink-0" />
            <span className="font-semibold">Workflow Complete: "{processingTitle}" has been fully summarized and indexed!</span>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Structured Summary</h2>
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed text-sm">
                {summary.summary}
              </pre>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => setSummary(null)}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-800 font-medium transition flex items-center text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Search
            </button>
            <button 
              onClick={() => navigate('/chat')}
              className="ml-auto px-8 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg hover:shadow-xl transition text-sm font-medium flex items-center"
            >
              <MessageSquare className="w-4 h-4 mr-2" /> Start Chatting about this paper
            </button>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={handleSearch} className="mb-10">
            <div className="relative flex items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter research topic, keywords, or authors..."
                className="w-full px-6 py-4 rounded-xl border border-gray-300 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-2 px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>
          
          <div className="space-y-6">
            {loading ? (
              <>
                <div className="text-center py-6 flex flex-col items-center justify-center text-gray-500">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mb-4"></div>
                  <p className="text-base font-medium animate-pulse text-primary-700">Searching across arXiv, Semantic Scholar & DuckDuckGo...</p>
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="space-y-2 mb-4">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    </div>
                    <div className="h-8 bg-gray-200 rounded w-24"></div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {results.map((paper, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">{paper.title}</h2>
                    <p className="text-sm text-gray-500 mb-4">{paper.authors ? paper.authors.join(', ') : 'Unknown Authors'}{paper.published ? ` • ${new Date(paper.published).toLocaleDateString()}` : ''}</p>
                    <p className="text-gray-700 text-sm line-clamp-3 mb-4">{paper.abstract}</p>
                    
                    <div className="flex gap-4 items-center">
                      {paper.pdf_url && (
                        <a href={paper.pdf_url} target="_blank" rel="noreferrer" className="text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center">
                          <FileText className="w-4 h-4 mr-1" /> View PDF
                        </a>
                      )}
                      {paper.entry_id && (
                        <a href={`https://arxiv.org/abs/${paper.entry_id.split('/').pop()}`} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center">
                          <ExternalLink className="w-4 h-4 mr-1" /> arXiv Page
                        </a>
                      )}
                      {paper.source && (
                        <span className="text-gray-500 text-sm font-medium flex items-center">
                          Source: {paper.source}
                        </span>
                      )}
                      <button 
                        onClick={() => handleNext(paper)}
                        className="ml-auto px-8 py-2 bg-white text-black border-2 border-black rounded-xl hover:bg-gray-100 transition text-sm font-medium"
                      >
                        next
                      </button>
                    </div>
                  </div>
                ))}
                {results.length === 0 && (
                  <div className="text-center text-gray-500 py-10">Enter a query to discover papers.</div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
