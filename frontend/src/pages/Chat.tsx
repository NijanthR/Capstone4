import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, Trash2 } from 'lucide-react';
import axios from 'axios';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I am your AI Research Assistant. You can ask me questions about any research papers you have uploaded. How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const title = localStorage.getItem('active_paper_title');
    const id = localStorage.getItem('active_paper_id');
    setActiveTitle(title);
    setActiveId(id);
    
    if (title) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hello! I am your AI Research Assistant. I've loaded the paper: "${title}". You can ask me any questions about it!`,
          timestamp: new Date()
        }
      ]);
    } else {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: "Hello! I am your AI Research Assistant. It looks like you haven't uploaded or selected a paper recently. Please upload a PDF or select a paper from Search so that I can answer questions using its context.",
          timestamp: new Date()
        }
      ]);
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

    setMessages((prev) => [...prev, userMessage]);
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

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      setError('Failed to reach the AI assistant. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    const title = localStorage.getItem('active_paper_title');
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: title 
          ? `Hello! I am your AI Research Assistant. I've loaded the paper: "${title}". You can ask me any questions about it!`
          : "Hello! I am your AI Research Assistant. It looks like you haven't uploaded or selected a paper recently. Please upload a PDF or select a paper from Search so that I can answer questions using its context.",
        timestamp: new Date()
      }
    ]);
    setError('');
  };

  const unloadPaper = () => {
    localStorage.removeItem('active_paper_id');
    localStorage.removeItem('active_paper_title');
    localStorage.removeItem('active_paper_authors');
    setActiveTitle(null);
    setActiveId(null);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: "Hello! I am your AI Research Assistant. The active paper has been unloaded. Please upload a PDF or select a paper from Search to start a new Q&A session.",
        timestamp: new Date()
      }
    ]);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-12rem)] bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3 max-w-[70%]">
          <div className="p-2 bg-primary-100 text-primary-600 rounded-lg flex-shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Research Assistant Chat</h1>
            {activeTitle ? (
              <p className="text-xs text-primary-600 font-semibold truncate" title={activeTitle}>
                Chatting about: {activeTitle}
              </p>
            ) : (
              <p className="text-xs text-gray-500">Retrieves context from your uploaded papers</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {activeTitle && (
            <button
              onClick={unloadPaper}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-500 rounded-lg hover:bg-gray-100 transition duration-150 border border-gray-200 font-medium"
              title="Unload Paper"
            >
              Unload Paper
            </button>
          )}
          <button
            onClick={clearChat}
            className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 transition duration-150"
            title="Clear Conversation"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 max-w-[85%] ${
              message.role === 'user' ? 'ml-auto flex-row-reverse space-x-reverse' : ''
            }`}
          >
            <div
              className={`p-2 rounded-lg flex-shrink-0 ${
                message.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {message.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>
            
            <div
              className={`p-4 rounded-2xl shadow-sm ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white rounded-tr-none'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              <span
                className={`text-[10px] mt-2 block text-right ${
                  message.role === 'user' ? 'text-primary-200' : 'text-gray-400'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-start space-x-3 max-w-[85%]">
            <div className="p-2 bg-gray-200 text-gray-600 rounded-lg flex-shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="p-4 bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2">
              <span className="text-sm text-gray-500 animate-pulse">Assistant is searching your papers...</span>
              <div className="flex space-x-1">
                <div className="w-2.5 h-2.5 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2.5 h-2.5 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2.5 h-2.5 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-200 bg-white flex items-center space-x-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the papers you uploaded..."
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm disabled:bg-gray-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:opacity-50 text-white rounded-xl shadow transition duration-150"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
