import React, { useState } from 'react';
import { Search as SearchIcon, FileText, ExternalLink, ArrowLeft, MessageSquare, CheckCircle, Loader } from 'lucide-react';
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
      const data = response.data;
      setSummary(data);
      if (data.paper_id) localStorage.setItem('active_paper_id', data.paper_id);
      if (data.extracted_title) localStorage.setItem('active_paper_title', data.extracted_title);
      if (data.extracted_authors) localStorage.setItem('active_paper_authors', data.extracted_authors);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.detail || err.message || 'Failed to download and process the selected paper.';
      setError(errMsg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6">
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-icon">
          <SearchIcon size={20} style={{ color: '#818cf8' }} />
        </div>
        <div>
          <h1 className="page-title">Search Papers</h1>
          <p style={{ fontSize: '0.82rem', color: '#475569', marginTop: 2 }}>
            Powered by arXiv, Semantic Scholar &amp; web search
          </p>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <FileText size={16} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {processing ? (
        <div className="processing-card">
          <div className="spinner" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>
            Analyzing &amp; Indexing Paper
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#818cf8', fontWeight: 600, marginBottom: 12 }}>
            "{processingTitle}"
          </p>
          <p style={{ fontSize: '0.82rem', color: '#475569', maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>
            Downloading PDF, splitting into chunks, indexing for chat support, and generating a structured summary...
          </p>
        </div>
      ) : summary ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="success-banner">
            <CheckCircle size={20} style={{ flexShrink: 0, color: '#34d399' }} />
            <span>Workflow complete — <strong>"{processingTitle}"</strong> has been summarized and indexed for chat!</span>
          </div>

          <div className="summary-box">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>
              Structured Summary
            </h2>
            <pre className="summary-text">{summary.summary}</pre>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setSummary(null)}
              className="btn-secondary"
              style={{ fontSize: '0.85rem' }}
            >
              <ArrowLeft size={15} />
              Back to Search
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="btn-green"
              style={{ marginLeft: 'auto', fontSize: '0.85rem' }}
            >
              <MessageSquare size={15} />
              Start Chatting
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ marginBottom: '28px' }}>
            <div className="search-input-wrap">
              <SearchIcon size={18} className="search-icon-left" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Enter research topic, keywords, or authors..."
                className="search-input"
              />
              <button
                type="submit"
                disabled={loading}
                className="search-btn"
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                    Searching...
                  </span>
                ) : 'Search'}
              </button>
            </div>
          </form>

          {/* Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {loading ? (
              <>
                <div style={{
                  textAlign: 'center', padding: '20px',
                  color: '#6366f1', fontWeight: 600, fontSize: '0.9rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
                }}>
                  <div style={{
                    width: 18, height: 18, border: '2px solid rgba(99,102,241,0.3)',
                    borderTopColor: '#6366f1', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Searching across arXiv, Semantic Scholar &amp; DuckDuckGo...
                </div>
                {[1, 2, 3].map(i => (
                  <div key={i} className="paper-card" style={{ padding: '24px' }}>
                    <div className="skeleton" style={{ height: 22, width: '75%', marginBottom: 12 }} />
                    <div className="skeleton" style={{ height: 14, width: '30%', marginBottom: 16 }} />
                    <div className="skeleton" style={{ height: 13, width: '100%', marginBottom: 6 }} />
                    <div className="skeleton" style={{ height: 13, width: '85%', marginBottom: 16 }} />
                    <div className="skeleton" style={{ height: 32, width: 100 }} />
                  </div>
                ))}
              </>
            ) : (
              <>
                {results.map((paper, idx) => (
                  <div key={idx} className="paper-card">
                    <h2 className="paper-title">{paper.title}</h2>
                    <p className="paper-meta">
                      {paper.authors ? paper.authors.join(', ') : 'Unknown Authors'}
                      {paper.published ? ` • ${new Date(paper.published).toLocaleDateString()}` : ''}
                    </p>
                    <p className="paper-abstract">{paper.abstract}</p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      {paper.source && (
                        <span className="source-badge">{paper.source}</span>
                      )}
                      {paper.pdf_url && (
                        <a href={paper.pdf_url} target="_blank" rel="noreferrer" className="link-btn">
                          <FileText size={13} />
                          PDF
                        </a>
                      )}
                      {paper.entry_id && (
                        <a
                          href={`https://arxiv.org/abs/${paper.entry_id.split('/').pop()}`}
                          target="_blank"
                          rel="noreferrer"
                          className="link-btn"
                        >
                          <ExternalLink size={13} />
                          arXiv
                        </a>
                      )}
                      {paper.pdf_url && (
                        <button
                          onClick={() => handleNext(paper)}
                          className="next-btn"
                        >
                          Analyze &amp; Index →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {results.length === 0 && (
                  <div style={{
                    textAlign: 'center', padding: '60px 20px',
                    color: '#334155'
                  }}>
                    <SearchIcon size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                    <p style={{ fontWeight: 500 }}>Enter a query to discover papers</p>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
