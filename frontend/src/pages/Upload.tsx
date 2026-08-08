import React, { useState, useCallback } from 'react';
import { Upload as UploadIcon, CheckCircle, FileText, AlertCircle, CloudUpload, MessageSquare } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
      const data = response.data;
      setResults(data);
      if (data.paper_id) localStorage.setItem('active_paper_id', data.paper_id);
      if (data.extracted_title) localStorage.setItem('active_paper_title', data.extracted_title);
      if (data.extracted_authors) localStorage.setItem('active_paper_authors', data.extracted_authors);
    } catch (err) {
      console.error(err);
      setError('Failed to process paper. Ensure the backend is running and the Gemini API key is configured.');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  return (
    <div className="max-w-3xl mx-auto py-6">
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-icon">
          <CloudUpload size={20} style={{ color: '#34d399' }} />
        </div>
        <div>
          <h1 className="page-title">Upload PDF</h1>
          <p style={{ fontSize: '0.82rem', color: '#475569', marginTop: 2 }}>
            Summarize any paper or run a novelty check on your own research
          </p>
        </div>
      </div>

      {!results ? (
        <form onSubmit={handleUpload}>
          <div className="glass-card-elevated" style={{ padding: '32px' }}>
            {/* Drop Zone */}
            <div
              className={`drop-zone ${file ? 'has-file' : ''} ${isDragging ? 'has-file' : ''}`}
              onClick={() => document.getElementById('file-upload')?.click()}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            >
              <div className="drop-zone-icon">
                {file
                  ? <CheckCircle size={28} style={{ color: '#34d399' }} />
                  : <CloudUpload size={28} style={{ color: '#818cf8' }} />
                }
              </div>

              {file ? (
                <>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                    {file.name}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#34d399' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB · PDF ready to upload
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                    Drag &amp; drop your PDF here
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#475569' }}>
                    or click to browse files
                  </p>
                </>
              )}

              <input
                id="file-upload"
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>

            {/* Own research toggle */}
            <div
              className={`checkbox-card ${isOwnResearch ? 'border-indigo-500' : ''}`}
              style={{ marginTop: '24px' }}
              onClick={() => setIsOwnResearch(v => !v)}
            >
              <input
                type="checkbox"
                id="own-research"
                checked={isOwnResearch}
                onChange={e => setIsOwnResearch(e.target.checked)}
                className="custom-checkbox"
                onClick={e => e.stopPropagation()}
              />
              <label htmlFor="own-research" style={{ cursor: 'pointer' }}>
                <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 4, fontSize: '0.92rem' }}>
                  This is my own unpublished research
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>
                  Enable this to run the <strong style={{ color: '#a78bfa' }}>Novelty Check</strong> workflow — we'll search existing literature and generate a detailed novelty report comparing your work against published papers.
                </div>
              </label>
            </div>

            {error && (
              <div className="error-banner" style={{ marginTop: '20px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Submit */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }}>
              <button
                type="submit"
                disabled={!file || loading}
                className="btn-primary"
                style={{ opacity: (!file || loading) ? 0.5 : 1, cursor: (!file || loading) ? 'not-allowed' : 'pointer' }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: 15, height: 15,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    Processing...
                  </>
                ) : (
                  <>
                    <UploadIcon size={16} />
                    {isOwnResearch ? 'Run Novelty Check' : 'Analyze &amp; Summarize'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="success-banner">
            <CheckCircle size={20} style={{ flexShrink: 0, color: '#34d399' }} />
            <span>Analysis complete!</span>
          </div>

          {isOwnResearch ? (
            <>
              <div className="summary-box">
                <h2 style={{
                  fontSize: '1.05rem', fontWeight: 700, color: '#e2e8f0',
                  marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <AlertCircle size={18} style={{ color: '#c084fc' }} />
                  Novelty Report
                </h2>
                <pre className="summary-text">{results.novelty_report}</pre>
              </div>

              {results.similar_papers && results.similar_papers.length > 0 && (
                <div className="summary-box">
                  <h2 style={{
                    fontSize: '1.05rem', fontWeight: 700, color: '#e2e8f0',
                    marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <FileText size={18} style={{ color: '#818cf8' }} />
                    Related &amp; Similar Papers Found
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {results.similar_papers.map((paper: any, idx: number) => (
                      <div key={idx} className="paper-card">
                        <h3 className="paper-title" style={{ fontSize: '0.92rem' }}>{paper.title}</h3>
                        <p className="paper-meta">
                          {paper.authors && paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown Authors'}
                          {paper.source && ` • ${paper.source}`}
                        </p>
                        {paper.abstract && (
                          <p className="paper-abstract">{paper.abstract}</p>
                        )}
                        {paper.pdf_url && (
                          <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer" className="link-btn">
                            <FileText size={13} />
                            View PDF
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="summary-box">
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>
                Structured Summary
              </h2>
              <pre className="summary-text">{results.summary}</pre>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setResults(null)}
              className="btn-secondary"
              style={{ fontSize: '0.85rem' }}
            >
              <UploadIcon size={15} />
              Upload Another
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
      )}
    </div>
  );
}
