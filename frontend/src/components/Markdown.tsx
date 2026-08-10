import React from 'react';

interface MarkdownProps {
  text: string;
}

export default function Markdown({ text }: MarkdownProps) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let currentTableRows: string[][] = [];
  let isTable = false;
  
  const parseInlineStyles = (line: string): React.ReactNode[] => {
    // Replace **text** with <strong>text</strong>
    const parts = line.split(/\*\*([\s\S]*?)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} style={{ color: '#e2e8f0', fontWeight: 700 }}>{part}</strong>;
      }
      return part;
    });
  };

  const renderTable = (rows: string[][], key: number) => {
    if (rows.length === 0) return null;
    
    // First row is header
    const headers = rows[0].map(cell => cell.trim());
    // Filter out separator rows like | --- | --- |
    const dataRows = rows.slice(1).filter(row => {
      return !row.every(cell => cell.trim().match(/^-+$/) || cell.trim() === '');
    });
    
    return (
      <div key={key} className="table-container" style={{ overflowX: 'auto', margin: '14px 0', border: '1px solid var(--border-default)', borderRadius: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-default)' }}>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: '10px 14px', fontWeight: 600, color: '#e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: ri === dataRows.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '10px 14px', color: 'var(--bubble-bot-text)' }}>{cell.trim()}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  let elementKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Table detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      isTable = true;
      const cells = trimmed.split('|').slice(1, -1);
      currentTableRows.push(cells);
      continue;
    } else {
      if (isTable) {
        elements.push(renderTable(currentTableRows, elementKey++));
        currentTableRows = [];
        isTable = false;
      }
    }

    // Header detection
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={elementKey++} style={{ fontSize: '1rem', fontWeight: 700, margin: '18px 0 8px', color: '#e2e8f0' }}>
          {parseInlineStyles(trimmed.substring(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={elementKey++} style={{ fontSize: '1.15rem', fontWeight: 800, margin: '22px 0 10px', color: '#e2e8f0', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
          {parseInlineStyles(trimmed.substring(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={elementKey++} style={{ fontSize: '1.35rem', fontWeight: 900, margin: '24px 0 12px', color: '#6366f1' }}>
          {parseInlineStyles(trimmed.substring(2))}
        </h1>
      );
      continue;
    }

    // List detection
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <ul key={elementKey++} style={{ margin: '6px 0', paddingLeft: '20px', listStyleType: 'disc' }}>
          <li style={{ margin: '4px 0', color: 'var(--bubble-bot-text)' }}>
            {parseInlineStyles(trimmed.substring(2))}
          </li>
        </ul>
      );
      continue;
    }

    // Numbered list detection
    const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      elements.push(
        <ol key={elementKey++} style={{ margin: '6px 0', paddingLeft: '20px', listStyleType: 'decimal' }}>
          <li style={{ margin: '4px 0', color: 'var(--bubble-bot-text)' }}>
            {parseInlineStyles(numMatch[2])}
          </li>
        </ol>
      );
      continue;
    }

    // Image detection: ![alt](url)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const alt = imgMatch[1];
      const url = imgMatch[2];
      elements.push(
        <div key={elementKey++} className="markdown-image-wrapper" style={{ margin: '14px 0', textAlign: 'center' }}>
          <img
            src={url}
            alt={alt}
            style={{ maxWidth: '100%', borderRadius: '12px', border: '1px solid var(--border-default)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
            loading="lazy"
          />
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '6px', fontStyle: 'italic' }}>{alt}</div>
        </div>
      );
      continue;
    }

    // Empty lines
    if (trimmed === '') {
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={elementKey++} style={{ margin: '8px 0', lineHeight: 1.65, color: 'var(--bubble-bot-text)' }}>
        {parseInlineStyles(line)}
      </p>
    );
  }

  if (isTable && currentTableRows.length > 0) {
    elements.push(renderTable(currentTableRows, elementKey++));
  }

  return <div className="markdown-content">{elements}</div>;
}
