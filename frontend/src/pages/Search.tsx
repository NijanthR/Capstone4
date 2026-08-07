import React, { useState } from 'react';
import { Search as SearchIcon, FileText, ExternalLink } from 'lucide-react';
import axios from 'axios';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    
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

  return (
    <div className="max-w-4xl mx-auto py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
        <SearchIcon className="mr-3 text-primary-600" />
        Search Research Papers
      </h1>
      
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
      
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg mb-6">{error}</div>}
      
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
                    className="ml-auto px-8 py-2 bg-white text-black border-2 border-black rounded-xl hover:bg-gray-100 transition text-sm font-medium"
                  >
                    next
                  </button>
                </div>
              </div>
            ))}
            {results.length === 0 && !error && (
              <div className="text-center text-gray-500 py-10">Enter a query to discover papers.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
