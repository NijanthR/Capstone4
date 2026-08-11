import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Trash2, BookOpen, X,
  Mic, MicOff, Paperclip, Volume2, VolumeX, Sparkles, AlertCircle
} from 'lucide-react';
import axios from 'axios';
import Markdown from '../components/Markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  imageUrl?: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  
  // Custom Workspace States
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Voice Synthesis & Recognition States
  const [isAutoSpeak, setIsAutoSpeak] = useState(() => {
    return localStorage.getItem('auto_speak') === 'true';
  });
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    localStorage.setItem('auto_speak', String(isAutoSpeak));
  }, [isAutoSpeak]);

  useEffect(() => {
    const title = localStorage.getItem('active_paper_title');
    setActiveTitle(title);

    if (title) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Hello! I've loaded **"${title}"** and I'm ready to answer your questions about it. 

You can ask me questions via text or voice, generate system diagrams, or compare it against existing research!`,
        timestamp: new Date()
      }]);
    } else {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hello! I'm your AI Research Assistant. You can search for papers, upload a PDF/DOCX/TXT file directly in the chat, ask questions using text or voice, and generate system diagrams/flowcharts.",
        timestamp: new Date()
      }]);
    }

    return () => {
      window.speechSynthesis.cancel();
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, interimTranscript]);

  // ── Voice synthesis ───────────────────────────────────────────
  const speak = async (text: string, msgId: string) => {
    window.speechSynthesis.cancel();
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (speakingMsgId === msgId) {
      setSpeakingMsgId(null);
      return;
    }
    
    // Clean text to read out (strip markdown urls and tables)
    const cleanText = text
      .replace(/!\[.*?\]\(.*?\)/g, '') // remove images
      .replace(/\[.*?\]\(.*?\)/g, '')  // remove links
      .replace(/\|/g, ' ')             // remove table dividers
      .replace(/\*\*|__/g, '')         // remove bold markdown
      .trim();

    try {
      setSpeakingMsgId(msgId);
      const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
      const response = await axios.post(`${baseUrl}/api/audio/tts`, {
        text: cleanText
      }, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setSpeakingMsgId(null);
        URL.revokeObjectURL(audioUrl);
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
        }
      };
      
      audio.onerror = () => {
        setSpeakingMsgId(null);
        URL.revokeObjectURL(audioUrl);
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
        }
      };
      
      activeAudioRef.current = audio;
      await audio.play();
    } catch (err) {
      console.error('Custom TTS failed, falling back to Web Speech API:', err);
      // Fallback
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.onend = () => setSpeakingMsgId(null);
      utterance.onerror = () => setSpeakingMsgId(null);
      setSpeakingMsgId(msgId);
      window.speechSynthesis.speak(utterance);
    }
  };

  // ── Voice transcription ───────────────────────────────────────
  // ── Voice transcription (MediaRecorder & Whisper) ─────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      let options = { mimeType: 'audio/webm' };
      let mediaRecorder: MediaRecorder;
      
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        // Fallback for browsers that don't support audio/webm
        try {
          mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/ogg' });
        } catch (e2) {
          mediaRecorder = new MediaRecorder(stream);
        }
      }
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        setIsRecording(false);
        setLoading(true);
        setError('');
        
        // Stop all tracks to release microphone lock
        stream.getTracks().forEach(track => track.stop());
        
        try {
          const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
          const formData = new FormData();
          
          let ext = 'webm';
          if (mimeType.includes('wav')) ext = 'wav';
          else if (mimeType.includes('mp4')) ext = 'mp4';
          else if (mimeType.includes('ogg')) ext = 'ogg';
          else if (mimeType.includes('mpeg')) ext = 'mp3';
          
          formData.append('file', audioBlob, `speech.${ext}`);
          
          const response = await axios.post(`${baseUrl}/api/audio/transcribe`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          
          if (response.data && response.data.text) {
            setInput(prev => prev + (prev ? ' ' : '') + response.data.text.trim());
          } else {
            setError('Could not transcribe speech.');
          }
        } catch (err: any) {
          console.error('Transcription error:', err);
          setError('Failed to transcribe audio using Whisper API.');
        } finally {
          setLoading(false);
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setError('');
      mediaRecorder.start();
    } catch (err: any) {
      console.error('Microphone recording error:', err);
      setError('Could not access microphone.');
    }
  };

  const stopRecording = (_submit = false) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    audioChunksRef.current = [];
  };

  // ── Send Message Q&A / Image Generation ────────────────────────
  const handleSend = async (e?: React.FormEvent, forceImage = false) => {
    if (e) e.preventDefault();
    
    const queryText = input.trim();
    if (!queryText && !forceImage) return;

    // Reset voice recording if active
    if (isRecording) stopRecording(false);

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: queryText || (forceImage ? "Generate a diagram showing how the components interact." : "Please analyze this research paper."),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = queryText;
    setInput('');
    setLoading(true);
    setError('');

    try {
      const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
      const paperId = localStorage.getItem('active_paper_id');
      const paperTitle = localStorage.getItem('active_paper_title');
      const paperAuthors = localStorage.getItem('active_paper_authors');

      const response = await axios.post(`${baseUrl}/api/qa`, {
        query: currentInput || "Generate a technical architecture diagram representing this research paper.",
        paper_id: paperId,
        paper_title: paperTitle,
        paper_authors: paperAuthors,
        is_image_request: forceImage
      });

      const assistantMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: response.data.answer || "I've processed your request.",
        imageUrl: response.data.image_url || undefined,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Auto Readout Response if enabled
      if (isAutoSpeak && response.data.answer) {
        speak(response.data.answer, assistantMessage.id);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to reach the AI assistant. Make sure the backend is running.');
    } finally {
      setLoading(false);
      // Reset input textarea height
      if (inputRef.current) {
        inputRef.current.style.height = '46px';
      }
    }
  };

  // ── Document Upload ──────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    const allowedExtensions = ['pdf', 'docx', 'txt', 'md'];
    const ext = uploadedFile.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      setError('Unsupported file format. Please upload PDF, DOCX, or TXT.');
      return;
    }
    
    setUploading(true);
    setLoading(true);
    setError('');
    
    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: `Uploaded file: **${uploadedFile.name}**`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    const formData = new FormData();
    formData.append('file', uploadedFile);
    formData.append('is_own_research', 'false');
    
    try {
      const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
      const response = await axios.post(`${baseUrl}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = response.data;
      // Save metadata
      if (data.paper_id) localStorage.setItem('active_paper_id', data.paper_id);
      if (data.extracted_title) {
        localStorage.setItem('active_paper_title', data.extracted_title);
        setActiveTitle(data.extracted_title);
      }
      if (data.extracted_authors) localStorage.setItem('active_paper_authors', data.extracted_authors);
      
      const summaryText = `### Structured Summary for "${data.extracted_title || uploadedFile.name}"\n\n${data.summary}`;
        
      const assistantMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: summaryText,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      if (isAutoSpeak) {
        speak(`${data.extracted_title || 'Document'} uploaded and analyzed successfully.`, assistantMessage.id);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to upload and analyze document. Ensure the backend is running.');
    } finally {
      setUploading(false);
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  };

  const clearChat = () => {
    window.speechSynthesis.cancel();
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setSpeakingMsgId(null);
    const title = localStorage.getItem('active_paper_title');
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: title
        ? `Conversation cleared. I still have **"${title}"** loaded. Ask me anything!`
        : "Conversation cleared. Ask anything about your papers or search to get started.",
      timestamp: new Date()
    }]);
    setError('');
  };

  const unloadPaper = () => {
    window.speechSynthesis.cancel();
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setSpeakingMsgId(null);
    localStorage.removeItem('active_paper_id');
    localStorage.removeItem('active_paper_title');
    localStorage.removeItem('active_paper_authors');
    setActiveTitle(null);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "The active paper has been unloaded. You can upload another file or search for new papers.",
      timestamp: new Date()
    }]);
  };

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
              Research Assistant Workspace
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
                No active document loaded
              </div>
            )}
          </div>
        </div>

        {/* Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Readout Toggle */}
          <button
            onClick={() => setIsAutoSpeak(!isAutoSpeak)}
            title={isAutoSpeak ? "Disable auto speech readout" : "Enable auto speech readout"}
            style={{
              padding: '8px',
              background: isAutoSpeak ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isAutoSpeak ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '8px',
              color: isAutoSpeak ? '#818cf8' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            {isAutoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {activeTitle && (
            <button
              onClick={unloadPaper}
              title="Unload active document"
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
            title="Clear Chat History"
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

      {/* Messages Window */}
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
            
            <div className={`msg-bubble ${message.role === 'user' ? 'user' : 'bot'}`} style={{ position: 'relative', paddingRight: message.role === 'assistant' ? '35px' : '15px' }}>
              
              {/* Markdown Content Rendering */}
              <Markdown text={message.content} />
              
              {/* Generated Image Display */}
              {message.imageUrl && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <img
                    src={message.imageUrl}
                    alt="Research Visualization"
                    onClick={() => setZoomImageUrl(message.imageUrl || null)}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '260px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-default)',
                      cursor: 'zoom-in',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      transition: 'transform 0.2s'
                    }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#818cf8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={11} /> Click image to expand diagram
                  </div>
                </div>
              )}

              {/* TTS Speak Control button for bot messages */}
              {message.role === 'assistant' && (
                <button
                  onClick={() => speak(message.content, message.id)}
                  title={speakingMsgId === message.id ? "Stop voice readout" : "Listen to response"}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: speakingMsgId === message.id ? '#818cf8' : 'rgba(255,255,255,0.15)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <Volume2 size={15} />
                </button>
              )}

              <div className="msg-time">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Loading / Processing Indicator */}
        {loading && (
          <div className="msg-row">
            <div className="msg-avatar bot">
              <Bot size={16} color="#a5b4fc" />
            </div>
            <div className="msg-bubble bot" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: '0.8rem', color: '#6366f1', marginBottom: 6, fontWeight: 500 }}>
                {uploading ? 'Analyzing research paper structures...' : 'Analyzing RAG context & sources...'}
              </div>
              <div className="typing-dots">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        )}

        {/* Recording Visualizer Overlay inside the chat */}
        {isRecording && (
          <div className="msg-row user">
            <div className="msg-avatar user-av">
              <User size={16} color="#93c5fd" />
            </div>
            <div className="msg-bubble user" style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99,102,241,0.25)', padding: '12px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#818cf8', fontWeight: 600 }}>
                <Mic size={14} className="mic-recording" style={{ borderRadius: '50%', padding: 2 }} />
                <span>Transcribing Voice Chat...</span>
              </div>
              {interimTranscript && (
                <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: '#cbd5e1', fontStyle: 'italic' }}>
                  "{interimTranscript}"
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="error-banner" style={{ margin: '0' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input controls & text area */}
      <div className="chat-input-area">
        {/* Recording and Upload State Info Bar */}
        {isRecording && (
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '10px', alignItems: 'center' }}>
            <button
              onClick={() => stopRecording(true)}
              className="btn-green"
              style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: '8px' }}
            >
              Finish &amp; Send
            </button>
            <button
              onClick={cancelRecording}
              className="btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              Cancel
            </button>
          </div>
        )}



        {/* Input Bar */}
        <form onSubmit={e => handleSend(e)} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          
          {/* 1. Direct File Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload research paper (PDF, DOCX, TXT)"
            disabled={loading}
            className="theme-toggle"
            style={{ width: '42px', height: '42px', borderRadius: '10px' }}
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {/* 2. Microphone Transcription Button */}
          <button
            type="button"
            onClick={isRecording ? () => stopRecording(false) : startRecording}
            title={isRecording ? "Stop voice chat" : "Voice chat"}
            disabled={loading}
            className={`theme-toggle ${isRecording ? 'mic-recording' : ''}`}
            style={{ width: '42px', height: '42px', borderRadius: '10px' }}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>



          {/* 4. Chat Text Area */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Listening to your voice..." : "Ask anything about the paper, compare it, or request diagrams..."}
            disabled={loading}
            rows={1}
            className="chat-input"
            style={{ flex: 1, minHeight: '42px', maxHeight: '120px', padding: '10px 14px' }}
          />

          {/* 5. Send Text Button */}
          <button
            type="submit"
            disabled={(!input.trim() && !isRecording) || loading}
            className="send-btn"
            style={{ width: '42px', height: '42px', padding: 0 }}
          >
            <Send size={16} />
          </button>
        </form>
        
        <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: 8, textAlign: 'center' }}>
          Voice Chat, Visual Diagrams (Pollinations AI) &amp; Literature Comparisons fully integrated in one workspace
        </div>
      </div>

      {/* Full-Screen Zoom Image Modal */}
      {zoomImageUrl && (
        <div
          onClick={() => setZoomImageUrl(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(10,11,20,0.96)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
            padding: '20px',
            backdropFilter: 'blur(8px)'
          }}
        >
          <img
            src={zoomImageUrl}
            alt="Expanded Diagram"
            style={{
              maxWidth: '95%',
              maxHeight: '90vh',
              borderRadius: '12px',
              boxShadow: '0 0 50px rgba(0,0,0,0.85)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          />
        </div>
      )}
    </div>
  );
}
