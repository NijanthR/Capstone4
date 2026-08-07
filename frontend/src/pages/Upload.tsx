import React, { useState } from 'react';
import { Upload as UploadIcon, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isOwnResearch, setIsOwnResearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    
    setLoading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_own_research', String(isOwnResearch));
    
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await axios.post(`${baseUrl}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResults(response.data);
    } catch (err) {
      console.error(err);
      setError('Failed to process paper. Ensure the backend is running and Gemini API key is configured.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
        <UploadIcon className="mr-3 text-primary-600" />
        Upload PDF
      </h1>
      
      {!results ? (
        <form onSubmit={handleUpload} className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <div className="mb-8 border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:bg-gray-50 transition cursor-pointer"
               onClick={() => document.getElementById('file-upload')?.click()}>
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 font-medium">Click to select PDF or drag and drop</p>
            <p className="text-sm text-gray-500 mt-1">{file ? file.name : "No file selected"}</p>
            <input 
              id="file-upload" 
              type="file" 
              accept=".pdf" 
              className="hidden" 
              onChange={(e) => setFile(e.target.files?.[0] || null)} 
            />
          </div>
          
          <div className="flex items-center mb-8 bg-blue-50 p-4 rounded-lg">
            <input 
              type="checkbox" 
              id="own-research" 
              checked={isOwnResearch} 
              onChange={(e) => setIsOwnResearch(e.target.checked)}
              className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500" 
            />
            <label htmlFor="own-research" className="ml-3 text-gray-700 font-medium">
              This is my own unpublished research
              <p className="text-sm text-gray-500 font-normal mt-1">Select this to run the Novelty Check workflow against existing literature.</p>
            </label>
          </div>
          
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={!file || loading}
              className="px-8 py-2 bg-white text-black border-2 border-black rounded-xl hover:bg-gray-100 transition text-sm font-medium disabled:opacity-50 flex justify-center items-center"
            >
              {loading ? 'processing...' : 'next'}
            </button>
          </div>
          
          {error && <div className="mt-4 text-red-600 text-center">{error}</div>}
        </form>
      ) : (
        <div className="space-y-8">
          <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center text-green-700">
            <CheckCircle className="w-6 h-6 mr-3" />
            <span className="font-semibold">Analysis Complete!</span>
          </div>
          
          {isOwnResearch ? (
            <div className="space-y-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                  <AlertCircle className="w-6 h-6 mr-2 text-purple-600" />
                  Novelty Report
                </h2>
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-gray-700">
                    {results.novelty_report}
                  </pre>
                </div>
              </div>

              {results.similar_papers && results.similar_papers.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h2 className="text-2xl font-bold mb-4 flex items-center text-gray-900">
                    <FileText className="w-6 h-6 mr-2 text-primary-600" />
                    Related & Similar Papers Found
                  </h2>
                  <div className="space-y-4">
                    {results.similar_papers.map((paper: any, idx: number) => (
                      <div key={idx} className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50/50 transition">
                        <h3 className="font-semibold text-gray-900">{paper.title}</h3>
                        <p className="text-xs text-gray-500 mb-2">
                          {paper.authors && paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown Authors'}
                          {paper.source && ` • Source: ${paper.source}`}
                        </p>
                        {paper.abstract && (
                          <p className="text-sm text-gray-600 line-clamp-3 mb-3 leading-relaxed">{paper.abstract}</p>
                        )}
                        {paper.pdf_url && (
                          <a 
                            href={paper.pdf_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center text-primary-600 hover:text-primary-800 text-sm font-medium"
                          >
                            View PDF
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold mb-4">Structured Summary</h2>
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-gray-700">
                  {results.summary}
                </pre>
              </div>
            </div>
          )}
          
          <div className="flex gap-4">
            <button 
              onClick={() => setResults(null)}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-800 font-medium transition"
            >
              Upload Another
            </button>
            <button 
              onClick={() => navigate('/chat')}
              className="ml-auto px-8 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg hover:shadow-xl transition text-sm font-medium"
            >
              Start Chatting about this paper
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
