import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, MessageSquare, ThumbsUp, ThumbsDown, BookOpen, Bell, Bot, Sparkles, X, Edit2, Check, Menu, Tag, Search, Hash } from 'lucide-react';
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
        <div className="h-16 sm:h-[72px] border-b-[1.5px] border-[#111111] px-4 sm:px-6 flex items-center justify-between shrink-0 bg-[#F4F1EA] z-20">
          <div className="flex items-center gap-3">
            <button 
              className="sm:hidden p-2 -ml-2 text-[#111111] bg-white brutal-border mr-1"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shrink-0" />
              <div>
                <h3 className="font-heading font-extrabold text-[#111111] text-xs sm:text-sm tracking-wider uppercase leading-none">
                  Bharti.ai Knowledge Engine
                </h3>
                <span className="text-[10px] text-[#111111]/60 font-bold uppercase tracking-widest block mt-0.5">
                  Universal Cross-Domain Search (Academics & Notices)
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setNoticesOpen(!noticesOpen)}
            className="px-4 py-2 bg-white brutal-border hover:bg-[#111111] hover:text-white text-[#111111] text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition whitespace-nowrap min-h-[40px] brutal-shadow-active"
          >
            <Bell className="w-4 h-4 text-[#E25A3F]" />
            <span className="hidden sm:inline">Notice Board</span>
          </button>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 pb-36 no-scrollbar bg-white">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto px-4">
              <div className="w-20 h-20 bg-white brutal-border p-2 mb-6 brutal-shadow flex items-center justify-center overflow-hidden">
                <img 
                  src={config?.logo_url || "/logo.png"} 
                  alt="Bharti.ai" 
                  className="w-full h-full object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-[#111111] mb-3 uppercase">
                {config?.welcome_message || 'Ask Bharti.ai'}
              </h2>
              <p className="text-sm font-medium text-[#111111]/70 leading-relaxed max-w-sm">
                Ask about examination dates, syllabi, university notices, regulations, or course notes. All responses cite verified documents.
              </p>
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

                  {/* Sources Drawer Link */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t-[1.5px] border-inherit opacity-90 flex flex-wrap items-center justify-between gap-3">
                      <button
                         onClick={() => setSelectedSources(m.sources)}
                        className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 min-h-[32px] px-3 py-1.5 bg-inherit border-[1.5px] border-inherit hover:opacity-75 transition"
                      >
                        <BookOpen className="w-4 h-4" /> {m.sources.length} Source(s)
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFeedback(m.id, 1)}
                          className={`p-2 border-[1.5px] border-inherit hover:opacity-75 transition ${m.feedback === 1 ? 'bg-[#E25A3F] text-white border-[#E25A3F]' : 'bg-inherit'}`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleFeedback(m.id, -1)}
                          className={`p-2 border-[1.5px] border-inherit hover:opacity-75 transition ${m.feedback === -1 ? 'bg-[#1D2330] text-white border-[#1D2330]' : 'bg-inherit'}`}
                        >
                          <ThumbsDown className="w-4 h-4" />
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
        <div className="absolute bottom-0 w-full p-4 sm:p-6 bg-gradient-to-t from-white via-white to-transparent pt-10 z-30">
          
          {/* Keywords Popup Drawer (100 Campus Keywords) */}
          {keywordsOpen && (
            <div className="max-w-4xl mx-auto mb-3 bg-[#F4F1EA] brutal-border p-4 brutal-shadow max-h-64 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between pb-3 mb-3 border-b-[1.5px] border-[#111111]">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-[#E25A3F]" />
                  <span className="font-heading font-extrabold text-[#111111] text-xs uppercase tracking-wider">
                    Quick Keywords & Topics ({CAMPUS_KEYWORDS.length} Available)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#111111]/50" />
                    <input
                      type="text"
                      placeholder="Filter topics..."
                      value={keywordSearch}
                      onChange={(e) => setKeywordSearch(e.target.value)}
                      className="pl-8 pr-3 py-1 bg-white brutal-border text-[11px] font-bold text-[#111111] outline-none w-36 sm:w-48"
                    />
                  </div>
                  <button 
                    onClick={() => setKeywordsOpen(false)}
                    className="p-1 bg-white brutal-border hover:bg-[#111111] hover:text-white transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Keyword Pills */}
              <div className="flex flex-wrap gap-1.5">
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
                      className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 brutal-border transition-all flex items-center gap-1 ${
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
            </div>
          )}

          {/* Active Tags Bar */}
          {activeTags.length > 0 && (
            <div className="max-w-4xl mx-auto mb-2 flex flex-wrap items-center gap-1.5 px-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#111111]/60 mr-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-[#E25A3F]" /> Active Filters:
              </span>
              {activeTags.map((t) => (
                <span 
                  key={t}
                  className="bg-[#111111] text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 brutal-border flex items-center gap-1"
                >
                  {t}
                  <button onClick={() => setActiveTags(activeTags.filter(item => item !== t))}>
                    <X className="w-3 h-3 hover:text-[#E25A3F]" />
                  </button>
                </span>
              ))}
              <button 
                onClick={() => setActiveTags([])}
                className="text-[9px] font-bold uppercase text-[#E25A3F] underline ml-2"
              >
                Clear All
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-2 sm:gap-3 bg-white brutal-border p-2 brutal-shadow">
            {/* Clean Plus Button for Keywords */}
            <button
              type="button"
              onClick={() => setKeywordsOpen(!keywordsOpen)}
              className={`p-3 brutal-border transition-all flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] ${
                keywordsOpen || activeTags.length > 0
                  ? 'bg-[#111111] text-white'
                  : 'bg-[#F4F1EA] hover:bg-[#111111] hover:text-white text-[#111111]'
              }`}
              title="Add Subject / Topic Keywords"
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
              placeholder="ASK BHARTI.AI ANYTHING (EXAMS, SYLLABUS, NOTICES)..."
              className="flex-1 px-3 sm:px-4 py-3 bg-transparent border-none focus:ring-0 focus:outline-none font-bold text-xs sm:text-sm text-[#111111] placeholder:text-[#111111]/40"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 sm:px-6 py-3 bg-[#E25A3F] disabled:opacity-50 text-white font-bold uppercase tracking-widest brutal-border brutal-shadow-active transition-all flex items-center justify-center min-h-[48px] shrink-0"
            >
              <Send className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Sources Modal */}
      {selectedSources && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex justify-end">
          <div className="w-full sm:w-[400px] bg-[#F4F1EA] border-l-[1.5px] border-[#111111] h-full p-6 overflow-y-auto brutal-shadow flex flex-col animate-in slide-in-from-right-full duration-300">
            <div className="flex items-center justify-between mb-8 pb-4 border-b-[1.5px] border-[#111111]">
              <h3 className="font-heading font-bold text-[#111111] text-lg uppercase flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#E25A3F]" /> References
              </h3>
              <button 
                onClick={() => setSelectedSources(null)} 
                className="p-2 text-[#111111] bg-white brutal-border brutal-shadow-active transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-6 flex-1">
              {selectedSources.map((src, i) => (
                <div key={i} className="p-5 bg-white brutal-border brutal-shadow text-xs space-y-3">
                  <h4 className="font-bold text-[#1D2330] text-sm uppercase leading-snug">{src.title}</h4>
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t-[1.5px] border-[#111111]">
                    <p className="text-[#111111]/60 font-bold uppercase tracking-widest text-[10px]">Domain:<br/><span className="text-[#111111] text-xs">{src.domain}</span></p>
                    {src.page && <p className="text-[#111111]/60 font-bold uppercase tracking-widest text-[10px]">Page:<br/><span className="text-[#111111] text-xs">{src.page}</span></p>}
                    {src.section && <p className="text-[#111111]/60 font-bold uppercase tracking-widest text-[10px] col-span-2">Section:<br/><span className="text-[#111111] text-xs">{src.section}</span></p>}
                    {src.source_url && (
                      <div className="col-span-2 mt-2 pt-2 border-t-[1.5px] border-[#111111]/20">
                        <a 
                          href={src.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-block text-[11px] font-bold text-[#E25A3F] uppercase tracking-wider hover:underline"
                        >
                          View Original Document ↗
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
