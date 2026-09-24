import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, MessageSquare, ThumbsUp, ThumbsDown, BookOpen, Bell, Bot, Sparkles, X, Edit2, Check, Menu, Tag, Search, Hash, Copy, ExternalLink, ArrowRight } from 'lucide-react';
import FormattedMessage from './FormattedMessage';
import { CAMPUS_KEYWORDS } from '../config/keywords';

export default function StudentChat({ token, config }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [keywordsOpen, setKeywordsOpen] = useState(false);
  const [keywordSearch, setKeywordSearch] = useState('');
  const [activeTags, setActiveTags] = useState([]);
  
  const [selectedSources, setSelectedSources] = useState(null);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const messagesEndRef = useRef(null);

  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      fetchMessages(activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Global Escape key handler to close all modals/drawers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedSources(null);
        setNoticesOpen(false);
        setKeywordsOpen(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll when sources or notices drawers are open
  useEffect(() => {
    if (selectedSources || noticesOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedSources, noticesOpen]);

  const handleCopyMessage = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/chat/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !activeSessionId) {
          setActiveSessionId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createSession = async () => {
    try {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions([data, ...sessions]);
        setActiveSessionId(data.id);
        setMessages([]);
        setSidebarOpen(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (sessionId) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        targetSessionId = data.id;
        setActiveSessionId(targetSessionId);
        setSessions([data, ...sessions]);
      }
    }

    const userMsg = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    const currentQuery = input;
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`/api/chat/sessions/${targetSessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          query: currentQuery,
          knowledge_domain: null, // Auto-search across Academics, Notices & Regulations
          subject: activeTags.length > 0 ? activeTags.join(', ') : null
        })
      });

      if (res.ok) {
        const botMsg = await res.json();
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (msgId, rating) => {
    try {
      await fetch(`/api/chat/messages/${msgId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ feedback: rating })
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedback: rating } : m))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleRename = async (sessionId) => {
    if (!editTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      await fetch(`/api/chat/sessions/${sessionId}/title`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: editTitle.trim() })
      });
      setSessions((prev) => prev.map(s => s.id === sessionId ? { ...s, title: editTitle.trim() } : s));
      setEditingSessionId(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-full w-full bg-[#F4F1EA] text-[#111111] overflow-hidden relative">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: Chat Sessions */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#F4F1EA] border-r-[1.5px] border-[#111111] flex flex-col transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        sm:relative sm:translate-x-0
      `}>
        <div className="p-5 border-b-[1.5px] border-[#111111] flex items-center justify-between bg-white">
          <button
            onClick={createSession}
            className="flex-1 py-3 px-4 bg-[#111111] text-white font-bold flex items-center justify-center gap-2 shadow-none brutal-shadow-active text-xs uppercase tracking-widest transition min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> New Chat
          </button>
          <button 
            className="sm:hidden ml-3 p-2 text-[#111111] brutal-border bg-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#F4F1EA]">
          <span className="text-[10px] font-bold text-[#111111]/60 uppercase tracking-widest block px-2 mb-3 mt-2">
            Recent Threads
          </span>
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`w-full group p-3 flex items-center gap-2.5 text-xs transition cursor-pointer min-h-[44px] brutal-border ${
                activeSessionId === s.id
                  ? 'bg-white font-bold brutal-shadow'
                  : 'bg-[#F4F1EA] hover:bg-white text-[#111111]/80 hover:text-[#111111]'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-[#E25A3F] shrink-0" />
              {editingSessionId === s.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(s.id)}
                    className="flex-1 bg-white border border-[#111111] px-2 py-1.5 text-xs text-[#111111] focus:outline-none"
                    autoFocus
                  />
                  <button onClick={() => handleRename(s.id)} className="text-[#1D2330] p-1">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => { setActiveSessionId(s.id); setSidebarOpen(false); }} 
                    className="flex-1 text-left truncate"
                  >
                    {s.title || `Thread #${s.id.slice(0, 8)}`}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setEditingSessionId(s.id); setEditTitle(s.title || `Thread #${s.id.slice(0, 8)}`); }}
                    className="opacity-0 group-hover:opacity-100 text-[#111111]/50 hover:text-[#E25A3F] transition p-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full relative w-full min-w-0 bg-white">
        {/* Sub-header Bar */}
        <div className="h-14 sm:h-16 border-b-[1.5px] border-[#111111] px-3 sm:px-6 flex items-center justify-between shrink-0 bg-[#F4F1EA] z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button 
              className="sm:hidden p-2 text-[#111111] bg-white brutal-border shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open chat history"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shrink-0" />
              <div className="min-w-0">
                <h3 className="font-heading font-extrabold text-[#111111] text-xs sm:text-sm tracking-wider uppercase leading-none truncate">
                  Bharti.ai Knowledge Engine
                </h3>
                <span className="text-[9px] sm:text-[10px] text-[#111111]/60 font-bold uppercase tracking-widest block mt-0.5 truncate">
                  Universal Cross-Domain Search (Academics & Notices)
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setNoticesOpen(!noticesOpen)}
            className="px-3 sm:px-4 py-2 bg-white brutal-border hover:bg-[#111111] hover:text-white text-[#111111] text-[11px] sm:text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 sm:gap-2 transition whitespace-nowrap min-h-[38px] sm:min-h-[40px] brutal-shadow-active shrink-0 ml-2"
          >
            <Bell className="w-4 h-4 text-[#E25A3F]" />
            <span className="hidden sm:inline">Notice Board</span>
            <span className="sm:hidden text-[10px] font-black">Notices</span>
          </button>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-8 space-y-6 sm:space-y-8 pb-36 sm:pb-36 no-scrollbar bg-white">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto px-2 py-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white brutal-border p-2 mb-4 sm:mb-6 brutal-shadow flex items-center justify-center overflow-hidden shrink-0">
                <img 
                  src={config?.logo_url || "/logo.png"} 
                  alt="Bharti.ai" 
                  className="w-full h-full object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <h2 className="text-lg sm:text-2xl font-heading font-extrabold text-[#111111] mb-2 sm:mb-3 uppercase tracking-tight">
                {config?.welcome_message || 'Ask Bharti.ai'}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-[#111111]/70 leading-relaxed max-w-sm">
                Ask about examination dates, syllabi, university notices, regulations, or course notes. All responses cite verified documents.
              </p>

              {/* 1-Tap Quick Starter Prompts for Mobile & Desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5 sm:mt-6 w-full text-left">
                {[
                  { text: "Exam Datesheet & Timetable", query: "What are the latest examination schedules and datesheet notices?" },
                  { text: "Syllabus & Course Modules", query: "What is the syllabus structure and subjects for this semester?" },
                  { text: "Fee Deadlines & Scholarships", query: "What are the fee payment deadlines and scholarship notifications?" },
                  { text: "Attendance & Leave Ordinance", query: "What are the official attendance requirements and leave policies?" }
                ].map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setInput(item.query);
                    }}
                    className="p-2.5 sm:p-3 bg-[#F4F1EA] hover:bg-[#111111] hover:text-white brutal-border brutal-shadow-active transition-all text-left flex items-center justify-between group min-h-[44px]"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider line-clamp-1">{item.text}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#E25A3F] group-hover:translate-x-1 transition-transform shrink-0 ml-1.5" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, index) => (
              <div
                key={index}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[95%] sm:max-w-[80%] px-5 py-4 leading-relaxed brutal-border ${
                    m.role === 'user'
                      ? 'bg-[#111111] text-white shadow-[4px_4px_0px_0px_rgba(226,90,63,1)]'
                      : 'bg-white text-[#111111] brutal-shadow'
                  }`}
                >
                  <FormattedMessage content={m.content} isUser={m.role === 'user'} />

                  {/* Assistant Action Bar: Sources, Copy, Feedback */}
                  {m.role !== 'user' && (
                    <div className="mt-4 pt-3 border-t-[1.5px] border-[#111111]/15 opacity-95 flex flex-wrap items-center justify-between gap-2.5">
                      {m.sources && m.sources.length > 0 ? (
                        <button
                          onClick={() => setSelectedSources(m.sources)}
                          className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 min-h-[32px] px-3 py-1.5 bg-[#F4F1EA] hover:bg-[#111111] hover:text-white text-[#111111] border-[1.5px] border-[#111111] transition shadow-xs group"
                          title="View verified references from college documents"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-[#E25A3F]" />
                          <span>{m.sources.length} Verified Source{m.sources.length === 1 ? '' : 's'}</span>
                        </button>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyMessage(m.id || index, m.content)}
                          className="px-2.5 py-1.5 border-[1.5px] border-[#111111] bg-white hover:bg-[#F4F1EA] text-[#111111] transition text-[11px] font-bold uppercase tracking-wider flex items-center gap-1"
                          title="Copy Answer"
                        >
                          {copiedMessageId === (m.id || index) ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#111111]/70" />
                              <span className="hidden sm:inline">Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleFeedback(m.id, 1)}
                          className={`p-1.5 border-[1.5px] border-[#111111] transition ${m.feedback === 1 ? 'bg-[#E25A3F] text-white border-[#E25A3F]' : 'bg-white hover:bg-[#F4F1EA] text-[#111111]'}`}
                          title="Helpful Answer"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleFeedback(m.id, -1)}
                          className={`p-1.5 border-[1.5px] border-[#111111] transition ${m.feedback === -1 ? 'bg-[#1D2330] text-white border-[#1D2330]' : 'bg-white hover:bg-[#F4F1EA] text-[#111111]'}`}
                          title="Not Helpful"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center gap-3 text-[#111111] font-bold uppercase tracking-widest text-[10px] bg-white w-fit px-5 py-4 brutal-border brutal-shadow">
              <div className="w-2 h-2 bg-[#E25A3F] animate-ping" /> Searching university records...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating Input Dock */}
        <div className="absolute bottom-0 w-full p-2.5 sm:p-6 bg-gradient-to-t from-white via-white/95 to-transparent pt-6 sm:pt-10 z-30 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          
          {/* Backdrop to dismiss keywords on outside click */}
          {keywordsOpen && (
            <div 
              className="fixed inset-0 z-20 cursor-default"
              onClick={() => setKeywordsOpen(false)}
            />
          )}

          {/* Keywords Popup Drawer (100 Campus Keywords) */}
          {keywordsOpen && (
            <div className="relative z-30 max-w-4xl mx-auto mb-2 sm:mb-3 bg-[#F4F1EA] brutal-border p-3 sm:p-4 brutal-shadow max-h-56 sm:max-h-72 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b-[1.5px] border-[#111111] sticky top-0 bg-[#F4F1EA] z-10">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Hash className="w-4 h-4 text-[#E25A3F] shrink-0" />
                  <span className="font-heading font-extrabold text-[#111111] text-xs uppercase tracking-wider truncate">
                    Topics ({CAMPUS_KEYWORDS.length})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[#111111]/50" />
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={keywordSearch}
                      onChange={(e) => setKeywordSearch(e.target.value)}
                      className="pl-7 pr-2 py-1 bg-white brutal-border text-base sm:text-[11px] font-bold text-[#111111] outline-none w-28 sm:w-44 min-h-[34px]"
                    />
                  </div>
                  <button 
                    onClick={() => setKeywordsOpen(false)}
                    className="p-1.5 bg-white brutal-border hover:bg-[#111111] hover:text-white transition min-h-[34px] min-w-[34px] flex items-center justify-center"
                    title="Close (ESC)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Keyword Pills */}
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {CAMPUS_KEYWORDS.filter(k => k.toLowerCase().includes(keywordSearch.toLowerCase())).map((keyword) => {
                  const isSelected = activeTags.includes(keyword);
                  return (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setActiveTags(activeTags.filter(t => t !== keyword));
                        } else {
                          setActiveTags([...activeTags, keyword]);
                          setInput(prev => prev ? `${prev} ${keyword}` : keyword);
                        }
                      }}
                      className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 sm:px-2.5 py-1 brutal-border transition-all flex items-center gap-1 min-h-[32px] ${
                        isSelected 
                          ? 'bg-[#111111] text-white brutal-shadow-active' 
                          : 'bg-white hover:bg-[#E25A3F] hover:text-white text-[#111111]'
                      }`}
                    >
                      <span>{keyword}</span>
                      {isSelected && <Check className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>

              {/* Bottom Done bar for mobile users */}
              <div className="mt-3 pt-2.5 border-t border-[#111111]/20 flex items-center justify-between">
                <span className="text-[10px] text-[#111111]/60 font-bold uppercase">
                  {activeTags.length} tag{activeTags.length === 1 ? '' : 's'} selected
                </span>
                <button
                  type="button"
                  onClick={() => setKeywordsOpen(false)}
                  className="px-3.5 py-1.5 bg-[#111111] text-white text-[10px] font-bold uppercase tracking-wider brutal-border hover:bg-[#E25A3F] transition min-h-[34px]"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Active Tags Bar */}
          {activeTags.length > 0 && (
            <div className="max-w-4xl mx-auto mb-2 flex flex-wrap items-center gap-1 sm:gap-1.5 px-1">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#111111]/60 mr-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-[#E25A3F]" /> Active:
              </span>
              {activeTags.map((t) => (
                <span 
                  key={t}
                  className="bg-[#111111] text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 brutal-border flex items-center gap-1"
                >
                  {t}
                  <button onClick={() => setActiveTags(activeTags.filter(item => item !== t))}>
                    <X className="w-3 h-3 hover:text-[#E25A3F]" />
                  </button>
                </span>
              ))}
              <button 
                onClick={() => setActiveTags([])}
                className="text-[9px] font-bold uppercase text-[#E25A3F] underline ml-1.5"
              >
                Clear All
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-1.5 sm:gap-3 bg-white brutal-border p-1.5 sm:p-2 brutal-shadow">
            {/* Clean Plus Button for Keywords */}
            <button
              type="button"
              onClick={() => setKeywordsOpen(!keywordsOpen)}
              className={`p-2.5 sm:p-3 brutal-border transition-all flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] ${
                keywordsOpen || activeTags.length > 0
                  ? 'bg-[#111111] text-white'
                  : 'bg-[#F4F1EA] hover:bg-[#111111] hover:text-white text-[#111111]'
              }`}
              title="Add Subject / Topic Keywords"
              aria-label="Add topic keywords"
            >
              <Plus className={`w-5 h-5 transition-transform ${keywordsOpen ? 'rotate-45' : ''}`} />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="Ask anything (exams, syllabus, notices)..."
              className="flex-1 px-2.5 sm:px-4 py-2.5 sm:py-3 bg-transparent border-none focus:ring-0 focus:outline-none font-bold text-base sm:text-sm text-[#111111] placeholder:text-[#111111]/40 min-w-0"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-3.5 sm:px-6 py-2.5 sm:py-3 bg-[#E25A3F] disabled:opacity-40 text-white font-bold uppercase tracking-widest brutal-border brutal-shadow-active transition-all flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-[48px] shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline text-xs">Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Sources Drawer Modal */}
      {selectedSources && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[70] flex justify-end animate-in fade-in duration-200"
          onClick={() => setSelectedSources(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[460px] md:w-[500px] bg-[#F4F1EA] border-l-[1.5px] border-[#111111] h-full flex flex-col brutal-shadow animate-in slide-in-from-right duration-200 relative"
          >
            {/* Sticky Header - Always Visible */}
            <div className="p-3.5 sm:p-5 bg-white border-b-[1.5px] border-[#111111] flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-xs pt-[max(0.875rem,env(safe-area-inset-top))]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#E25A3F]/10 brutal-border flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-[#E25A3F]" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-[#111111] text-base uppercase tracking-tight">
                    Verified Sources
                  </h3>
                  <p className="text-[11px] text-[#111111]/60 font-bold uppercase tracking-wider">
                    {selectedSources.length} cited reference{selectedSources.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSources(null)} 
                className="px-3.5 py-2 bg-[#F4F1EA] hover:bg-[#111111] hover:text-white text-[#111111] text-xs font-bold uppercase tracking-wider brutal-border brutal-shadow-active transition flex items-center gap-1.5"
                title="Close (ESC)"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
                <span className="text-[9px] opacity-60 ml-0.5 sm:inline hidden">(ESC)</span>
              </button>
            </div>

            {/* Scrollable Sources List */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {selectedSources.map((src, i) => (
                <div key={i} className="p-4 bg-white brutal-border brutal-shadow text-xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-[#111111] text-white">
                      Source #{i + 1}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#E25A3F] bg-[#E25A3F]/10 px-2 py-0.5 border border-[#E25A3F]/30">
                      {src.domain || 'Academics'}
                    </span>
                  </div>
                  
                  <h4 className="font-bold text-[#111111] text-sm uppercase leading-snug">
                    {src.title}
                  </h4>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t-[1.5px] border-[#111111]/15 text-[11px]">
                    {src.page && (
                      <div className="bg-[#F4F1EA] p-2 border border-[#111111]/10">
                        <span className="text-[9px] font-bold text-[#111111]/50 uppercase tracking-widest block">Page</span>
                        <span className="font-bold text-[#111111]">{src.page}</span>
                      </div>
                    )}
                    {src.section && (
                      <div className="bg-[#F4F1EA] p-2 border border-[#111111]/10 col-span-2 sm:col-span-1">
                        <span className="text-[9px] font-bold text-[#111111]/50 uppercase tracking-widest block">Section</span>
                        <span className="font-bold text-[#111111] truncate block">{src.section}</span>
                      </div>
                    )}
                  </div>

                  {src.source_url ? (
                    <div className="pt-2 border-t border-[#111111]/10">
                      <a 
                        href={src.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#E25A3F] uppercase tracking-wider hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View Original Document ↗
                      </a>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-[#111111]/10 text-[10px] text-[#111111]/50 font-semibold uppercase tracking-wider">
                      Verified Internal College Record
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sticky Bottom Bar - Prominent Way Out */}
            <div className="p-3 sm:p-4 bg-white border-t-[1.5px] border-[#111111] shrink-0 shadow-lg sticky bottom-0 z-20 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => setSelectedSources(null)}
                className="w-full py-3 sm:py-3.5 bg-[#111111] hover:bg-[#E25A3F] text-white font-bold uppercase tracking-widest text-xs brutal-border brutal-shadow-active transition flex items-center justify-center gap-2 min-h-[44px] sm:min-h-[46px]"
              >
                <X className="w-4 h-4" /> Back to Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notice Board Drawer Modal */}
      {noticesOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[70] flex justify-end animate-in fade-in duration-200"
          onClick={() => setNoticesOpen(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[460px] md:w-[500px] bg-[#F4F1EA] border-l-[1.5px] border-[#111111] h-full flex flex-col brutal-shadow animate-in slide-in-from-right duration-200 relative"
          >
            {/* Sticky Header */}
            <div className="p-3.5 sm:p-5 bg-white border-b-[1.5px] border-[#111111] flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-xs pt-[max(0.875rem,env(safe-area-inset-top))]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#E25A3F]/10 brutal-border flex items-center justify-center">
                  <Bell className="w-5 h-5 text-[#E25A3F]" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-[#111111] text-base uppercase tracking-tight">
                    Campus Notice Board
                  </h3>
                  <p className="text-[11px] text-[#111111]/60 font-bold uppercase tracking-wider">
                    Official Announcements & Inquiries
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setNoticesOpen(false)} 
                className="px-3.5 py-2 bg-[#F4F1EA] hover:bg-[#111111] hover:text-white text-[#111111] text-xs font-bold uppercase tracking-wider brutal-border brutal-shadow-active transition flex items-center gap-1.5 min-h-[38px]"
                title="Close (ESC)"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>

            {/* Quick Inquiries List */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#111111]/70 mb-3">
                Click any topic to query verified university notices & circulars:
              </p>

              {[
                { title: "Examination Schedule & Timetable", desc: "Datesheets, exam timing & admit card notifications", query: "What are the latest examination schedules and datesheet notices?" },
                { title: "Results & Re-Evaluation Rules", desc: "Grade publication, scrutiny procedure & marksheet distribution", query: "What are the latest university results and re-evaluation rules?" },
                { title: "Semester Fee & Scholarship Deadlines", desc: "Tuition deadlines, fine waivers & state/central scholarship circulars", query: "What are the fee payment deadlines and scholarship notifications?" },
                { title: "Academic Calendar & Holidays", desc: "Semester commencement, vacations, exam windows & gazetted holidays", query: "Show me the university academic calendar and holiday list" },
                { title: "Attendance & Medical Leave Ordinance", desc: "75% attendance criteria, medical certificate submission & condonation rules", query: "What are the official attendance and medical leave regulations?" }
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInput(item.query);
                    setNoticesOpen(false);
                  }}
                  className="w-full text-left p-3.5 sm:p-4 bg-white hover:bg-[#F4F1EA] brutal-border brutal-shadow-active transition space-y-1.5 group min-h-[44px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-extrabold text-xs uppercase text-[#111111] group-hover:text-[#E25A3F] transition-colors">
                      {item.title}
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#111111]/40 group-hover:text-[#E25A3F] group-hover:translate-x-1 transition-all shrink-0" />
                  </div>
                  <p className="text-[11px] text-[#111111]/70 font-medium">
                    {item.desc}
                  </p>
                </button>
              ))}
            </div>

            {/* Sticky Bottom Bar */}
            <div className="p-3 sm:p-4 bg-white border-t-[1.5px] border-[#111111] shrink-0 sticky bottom-0 z-20 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => setNoticesOpen(false)}
                className="w-full py-3 sm:py-3.5 bg-[#111111] hover:bg-[#E25A3F] text-white font-bold uppercase tracking-widest text-xs brutal-border brutal-shadow-active transition flex items-center justify-center gap-2 min-h-[44px] sm:min-h-[46px]"
              >
                <X className="w-4 h-4" /> Back to Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
