import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  BookOpen, Upload as UploadIcon, Search as SearchIcon,
  MessageSquare, Zap, Brain, Sun, Moon
} from 'lucide-react';
import Search from './pages/Search';
import Upload from './pages/Upload';
import Chat from './pages/Chat';

// ── Theme Context ──────────────────────────────────────────────
type Theme = 'dark' | 'light';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {}
});

export function useTheme() {
  return useContext(ThemeContext);
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
function Dashboard() {
  return (
    <div className="flex flex-col items-center text-center py-16 px-4">
      <h1 className="hero-title mb-6">
        Discover, Analyze &amp;<br />
        <span className="gradient-text">Understand Research</span>
      </h1>
      <p className="hero-subtitle mb-12">
        Upload your research papers for a novelty check, or search the latest papers
        to get AI-powered summaries, insights, and interactive Q&amp;A.
      </p>

      {/* CTA buttons */}
      <div className="flex flex-wrap justify-center gap-4 mb-20">
        <Link to="/search" className="btn-primary">
          <SearchIcon size={17} />
          Search Papers
        </Link>
        <Link to="/upload" className="btn-secondary">
          <UploadIcon size={17} />
          Upload PDF
        </Link>
        <Link to="/chat" className="btn-green">
          <MessageSquare size={17} />
          Chat Assistant
        </Link>
      </div>

      {/* Feature cards */}
      <div className="feature-grid w-full max-w-4xl">
        <Link to="/search" className="feature-card">
          <div
            className="feature-card-icon"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.12))' }}
          >
            <SearchIcon size={20} style={{ color: '#818cf8' }} />
          </div>
          <div className="feature-card-title">Semantic Search</div>
          <div className="feature-card-desc">
            Search across arXiv, Semantic Scholar and the web to find cutting-edge papers on any topic.
          </div>
        </Link>

        <Link to="/upload" className="feature-card">
          <div
            className="feature-card-icon"
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(5,150,105,0.1))' }}
          >
            <Zap size={20} style={{ color: '#34d399' }} />
          </div>
          <div className="feature-card-title">Novelty Check</div>
          <div className="feature-card-desc">
            Upload your own unpublished research and get an instant AI-generated novelty report.
          </div>
        </Link>

        <Link to="/chat" className="feature-card">
          <div
            className="feature-card-icon"
            style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(236,72,153,0.08))' }}
          >
            <Brain size={20} style={{ color: '#c084fc' }} />
          </div>
          <div className="feature-card-title">AI Q&amp;A Assistant</div>
          <div className="feature-card-desc">
            Ask questions about any uploaded or selected paper and get context-aware answers.
          </div>
        </Link>
      </div>
    </div>
  );
}

// ── Nav Links ─────────────────────────────────────────────────
function NavLinks() {
  const location = useLocation();
  const links = [
    { to: '/search', label: 'Search',  icon: <SearchIcon  size={14} /> },
    { to: '/upload', label: 'Upload',  icon: <UploadIcon  size={14} /> },
    { to: '/chat',   label: 'Chat',    icon: <MessageSquare size={14} /> },
  ];
  return (
    <div className="hidden sm:flex items-center gap-1 ml-8">
      {links.map(({ to, label, icon }) => (
        <Link key={to} to={to} className={`nav-link ${location.pathname === to ? 'active' : ''}`}>
          {icon}
          {label}
        </Link>
      ))}
    </div>
  );
}

// ── Theme Toggle Button ────────────────────────────────────────
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
    >
      {theme === 'dark'
        ? <Sun  size={16} />
        : <Moon size={16} />
      }
    </button>
  );
}

// ── Layout ────────────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-bg min-h-screen">
      <nav className="navbar">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: brand + nav links */}
            <div className="flex items-center">
              <Link to="/" className="navbar-brand">
                <div className="navbar-logo">
                  <BookOpen size={17} color="white" />
                </div>
                <span className="navbar-title">ResearchAI</span>
              </Link>
              <NavLinks />
            </div>

            {/* Right: mobile nav icons + theme toggle */}
            <div className="flex items-center gap-2">
              <div className="flex sm:hidden items-center gap-1">
                <Link to="/search" className="nav-link"><SearchIcon   size={16} /></Link>
                <Link to="/upload" className="nav-link"><UploadIcon   size={16} /></Link>
                <Link to="/chat"   className="nav-link"><MessageSquare size={16} /></Link>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────
function App() {
  return (
    <ThemeProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/"       element={<Dashboard />} />
            <Route path="/search" element={<Search />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/chat"   element={<Chat />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
