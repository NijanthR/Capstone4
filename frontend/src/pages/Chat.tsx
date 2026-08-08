import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, Trash2, BookOpen, X } from 'lucide-react';
import axios from 'axios';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTitle, setActiveTitle] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const title = localStorage.getItem('active_paper_title');
    setActiveTitle(title);

    if (title) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Hello! I've loaded **"${title}"** and I'm ready to answer your questions about it. What would you like to know?`,
        timestamp: new Date()
      }]);
    } else {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hello! I'm your AI Research Assistant. It looks like you haven't selected a paper yet. Please upload a PDF or select a paper from Search to start a contextual Q&A session.",
        timestamp: new Date()
      }]);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);
    setError('');

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const paperId = localStorage.getItem('active_paper_id');
      const paperTitle = localStorage.getItem('active_paper_title');
      const paperAuthors = localStorage.getItem('active_paper_authors');
      const response = await axios.post(`${baseUrl}/api/qa`, {
        query: currentInput,
        paper_id: paperId,
        paper_title: paperTitle,
        paper_authors: paperAuthors
      });

      const assistantMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: response.data.answer || "I couldn't find an answer to that question.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      setError('Failed to reach the AI assistant. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  };

  const clearChat = () => {
    const title = localStorage.getItem('active_paper_title');
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: title
        ? `Conversation cleared. I still have **"${title}"** loaded. Ask me anything!`
        : "Conversation cleared. Please select a paper to start a new session.",
      timestamp: new Date()
    }]);
    setError('');
  };

  const unloadPaper = () => {
    localStorage.removeItem('active_paper_id');
    localStorage.removeItem('active_paper_title');
    localStorage.removeItem('active_paper_authors');
    setActiveTitle(null);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "The active paper has been unloaded. Please upload or select a new paper to start a Q&A session.",
      timestamp: new Date()
    }]);
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div className="chat-bot-avatar">
            <Bot size={20} color="white" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>
              Research Assistant
            </div>
            {activeTitle ? (
              <div style={{
                fontSize: '0.75rem',
                color: '#818cf8',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '340px'
              }}>
                <BookOpen size={11} style={{ display: 'inline', marginRight: 4 }} />
                {activeTitle}
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                No paper selected
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeTitle && (
            <button
              onClick={unloadPaper}
              title="Unload Paper"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <X size={13} />
              Unload
            </button>
          )}
          <button
            onClick={clearChat}
            title="Clear Conversation"
            style={{
              padding: '8px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map(message => (
          <div
            key={message.id}
            className={`msg-row ${message.role === 'user' ? 'user' : ''}`}
          >
            <div className={`msg-avatar ${message.role === 'user' ? 'user-av' : 'bot'}`}>
              {message.role === 'user'
                ? <User size={16} color="#93c5fd" />
                : <Bot size={16} color="#a5b4fc" />
              }
            </div>
            <div className={`msg-bubble ${message.role === 'user' ? 'user' : 'bot'}`}>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
              <div className="msg-time">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {loading && (
          <div className="msg-row">
            <div className="msg-avatar bot">
              <Bot size={16} color="#a5b4fc" />
            </div>
            <div className="msg-bubble bot" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: '0.8rem', color: '#6366f1', marginBottom: 6, fontWeight: 500 }}>
                Searching your papers...
              </div>
              <div className="typing-dots">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="error-banner" style={{ margin: '0 0 8px' }}>
            <MessageSquare size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about the paper... (Enter to send, Shift+Enter for newline)"
            disabled={loading}
            rows={1}
            className="chat-input"
            style={{ flex: 1, minHeight: '46px', maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="send-btn"
          >
            <Send size={18} />
          </button>
        </form>
        <div style={{ fontSize: '0.7rem', color: '#334155', marginTop: 8, textAlign: 'center' }}>
          Context-aware answers powered by your uploaded research documents
        </div>
      </div>
    </div>
  );
}
