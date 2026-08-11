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
      const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
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

  const renderNoveltyReport = () => {
    if (!results || !results.novelty_report) return null;

    let report: any = null;
    try {
      let cleanText = results.novelty_report.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.substring(7);
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.substring(3);
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      report = JSON.parse(cleanText.trim());
    } catch (e) {
      return (
        <div className="summary-box">
          <h2 style={{
            fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <AlertCircle size={18} style={{ color: '#c084fc' }} />
            Novelty Report
          </h2>
          <pre className="summary-text" style={{ whiteSpace: 'pre-wrap' }}>{results.novelty_report}</pre>
        </div>
      );
    }

    const getReportField = (obj: any, possibleKeys: string[]) => {
      if (!obj) return [];
      for (const key of possibleKeys) {
        if (obj[key] !== undefined) return obj[key];
        const lowerKey = key.toLowerCase();
        const snakeKey = key.toLowerCase().replace(/ /g, '_');
        if (obj[lowerKey] !== undefined) return obj[lowerKey];
        if (obj[snakeKey] !== undefined) return obj[snakeKey];
      }
      for (const k of Object.keys(obj)) {
        const lk = k.toLowerCase();
        for (const pk of possibleKeys) {
          const lpk = pk.toLowerCase();
          if (lk.includes(lpk) || lpk.includes(lk)) return obj[k];
        }
      }
      return [];
    };

    const getReportScore = (obj: any) => {
      if (!obj) return 0;
      const val = getReportField(obj, ["Overall Novelty Score", "novelty_score", "score"]);
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    const score = getReportScore(report);
    const contributions = getReportField(report, ["Novel Contributions", "contributions"]);
    const duplicates = getReportField(report, ["Duplicate Ideas", "duplicates"]);
    const gaps = getReportField(report, ["Research Gaps", "gaps"]);
    const suggestions = getReportField(report, ["Suggestions for Improvement", "suggestions", "improvements"]);

    const contributionsList = Array.isArray(contributions) ? contributions : (contributions ? [contributions] : []);
    const duplicatesList = Array.isArray(duplicates) ? duplicates : (duplicates ? [duplicates] : []);
    const gapsList = Array.isArray(gaps) ? gaps : (gaps ? [gaps] : []);
    const suggestionsList = Array.isArray(suggestions) ? suggestions : (suggestions ? [suggestions] : []);

    let scoreColor = '#10b981'; // Green
    let scoreLabel = 'High Novelty';
    if (score < 30) {
      scoreColor = '#ef4444'; // Red
      scoreLabel = 'Low Novelty';
    } else if (score < 70) {
      scoreColor = '#f59e0b'; // Amber
      scoreLabel = 'Moderate Novelty';
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Score & Summary Card */}
        <div className="summary-box" style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{
            position: 'relative',
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            background: `conic-gradient(${scoreColor} ${score * 3.6}deg, rgba(99,102,241,0.08) 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 0 20px ${scoreColor}15`
          }}>
            <div style={{
              position: 'absolute',
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              background: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column'
            }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{score}</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>Score</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: '220px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Overall Novelty Score
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: `${scoreColor}15`,
                color: scoreColor,
                border: `1px solid ${scoreColor}30`
              }}>
                {scoreLabel}
              </span>
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
              {score === 0
                ? "This paper appears to match a published work exactly. Novelty is flagged as 0%."
                : `This research paper exhibits a novelty score of ${score}%. See detailed findings below.`}
            </p>
          </div>
        </div>

        {/* List of sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Duplicate Ideas */}
          {duplicatesList.length > 0 && (
            <div className="summary-box" style={{ borderLeft: '4px solid #ef4444', paddingLeft: '20px' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <AlertCircle size={16} />
                Similarities &amp; Duplicate Ideas
              </h4>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                {duplicatesList.map((item: string, i: number) => (
                  <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'flex-start', lineHeight: 1.5 }}>
                    <span style={{ color: '#ef4444', marginTop: '4px' }}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Novel Contributions */}
          <div className="summary-box" style={{ borderLeft: '4px solid #10b981', paddingLeft: '20px' }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <CheckCircle size={16} style={{ color: '#10b981' }} />
              Key Novel Contributions
            </h4>
            {contributionsList.length > 0 ? (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                {contributionsList.map((item: string, i: number) => (
                  <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'flex-start', lineHeight: 1.5 }}>
                    <span style={{ color: '#10b981', marginTop: '4px' }}>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No unique novel contributions highlighted.</p>
            )}
          </div>

          {/* Research Gaps */}
          <div className="summary-box" style={{ borderLeft: '4px solid #6366f1', paddingLeft: '20px' }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#6366f1', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <FileText size={16} style={{ color: '#6366f1' }} />
              Research Gaps Identified
            </h4>
            {gapsList.length > 0 ? (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                {gapsList.map((item: string, i: number) => (
                  <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'flex-start', lineHeight: 1.5 }}>
                    <span style={{ color: '#6366f1', fontWeight: 'bold', marginTop: '1px' }}>→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No major research gaps identified.</p>
            )}
          </div>

          {/* Suggestions */}
          <div className="summary-box" style={{ borderLeft: '4px solid #a855f7', paddingLeft: '20px' }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#a855f7', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <MessageSquare size={16} style={{ color: '#a855f7' }} />
              Suggestions for Improvement
            </h4>
            {suggestionsList.length > 0 ? (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                {suggestionsList.map((item: string, i: number) => (
                  <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'flex-start', lineHeight: 1.5 }}>
                    <span style={{ color: '#a855f7', fontWeight: 'bold', marginTop: '1px' }}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No specific recommendations provided.</p>
            )}
          </div>

        </div>
      </div>
    );
  };

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
              {renderNoveltyReport()}

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
