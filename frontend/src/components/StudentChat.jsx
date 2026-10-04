import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, MessageSquare, ThumbsUp, ThumbsDown, BookOpen, 
  Bell, Sparkles, X, Edit2, Check, Menu, Tag, Search, Copy, 
  ExternalLink, Trash2, ArrowUp, ChevronRight, FileText, Calendar, 
  CreditCard, HelpCircle, Clock, ChevronDown, CheckCircle2 
} from 'lucide-react';
import FormattedMessage from './FormattedMessage';
import { CAMPUS_KEYWORDS } from '../config/keywords';

export default function StudentChat({ adminToken, config, noticesOpen, setNoticesOpen, onOpenSettings }) {
  // Load threads from localStorage
  const [threads, setThreads] = useState(() => {
    try {
      const saved = localStorage.getItem('camp_ai_threads');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Load active thread ID from localStorage
  const [activeThreadId, setActiveThreadId] = useState(() => {
    return localStorage.getItem('camp_ai_active_thread_id') || null;
  });

  // Current messages in active thread
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Mobile sidebar & UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [editingThreadId, setEditingThreadId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  // Source drawer & notices drawer
  const [selectedSource, setSelectedSource] = useState(null);
  const [notices, setNotices] = useState([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [noticeSearch, setNoticeSearch] = useState('');

  // Keyword tag filters
  const [tagsPickerOpen, setTagsPickerOpen] = useState(false);
  const [activeTags, setActiveTags] = useState([]);
  const [tagSearch, setTagSearch] = useState('');

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync messages whenever activeThreadId changes or threads change
  useEffect(() => {
    if (activeThreadId) {
      const current = threads.find((t) => t.id === activeThreadId);
      if (current) {
        setMessages(current.messages || []);
        localStorage.setItem('camp_ai_active_thread_id', activeThreadId);
      } else {
        // Thread deleted or not found
        setActiveThreadId(null);
        setMessages([]);
        localStorage.removeItem('camp_ai_active_thread_id');
      }
    } else {
      setMessages([]);
      localStorage.removeItem('camp_ai_active_thread_id');
    }
  }, [activeThreadId, threads]);

  // Persist threads to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('camp_ai_threads', JSON.stringify(threads));
    } catch (e) {
      console.error('Failed to save threads to localStorage', e);
    }
  }, [threads]);

  // Listen to clear history event from Settings modal
  useEffect(() => {
    const handleClear = () => {
      setThreads([]);
      setActiveThreadId(null);
      setMessages([]);
      localStorage.removeItem('camp_ai_threads');
      localStorage.removeItem('camp_ai_active_thread_id');
    };
    window.addEventListener('camp_ai_clear_history', handleClear);
    return () => window.removeEventListener('camp_ai_clear_history', handleClear);
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  // Fetch notices when notices drawer is opened
  useEffect(() => {
    if (noticesOpen) {
      setNoticesLoading(true);
      fetch('/api/documents/public/notices')
        .then((r) => r.json())
        .then((data) => {
          setNotices(Array.isArray(data) ? data : []);
        })
        .catch((e) => {
          console.error(e);
          setNotices([]);
        })
        .finally(() => setNoticesLoading(false));
    }
  }, [noticesOpen]);

  // Lock body scroll when modals are open
  useEffect(() => {
    if (selectedSource || noticesOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedSource, noticesOpen]);

  // + New Chat Handler: COMPLETELY resets thread state and prevents cross-chat hallucination
  const handleStartNewChat = () => {
    setActiveThreadId(null);
    setMessages([]);
    localStorage.removeItem('camp_ai_active_thread_id');
    setInput('');
    setActiveTags([]);
    setSidebarOpen(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Send message
  const handleSend = async (customPrompt) => {
    const queryText = (customPrompt || input).trim();
    if (!queryText || loading) return;

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);

    const userMsg = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: queryText,
      createdAt: new Date().toISOString(),
    };

    // Optimistically update message stream
    setMessages((prev) => [...prev, userMsg]);

    // Build chat history:
    // If starting a new thread (activeThreadId is null), chat_history is STRICTLY empty []!
    // This completely eliminates cross-chat hallucination!
    let chatHistory = [];
    let currentThreadId = activeThreadId;
    let isNewThread = false;

    if (!currentThreadId) {
      isNewThread = true;
      currentThreadId = `t_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      chatHistory = []; // STRICTLY EMPTY!
    } else {
      const currentThread = threads.find((t) => t.id === currentThreadId);
      const prevMsgs = currentThread?.messages || messages;
      chatHistory = prevMsgs.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;

      const res = await fetch('/api/chat/query', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: queryText,
          chat_history: chatHistory,
          knowledge_domain: null,
          subject: activeTags.length > 0 ? activeTags.join(', ') : null,
        }),
      });

      let botContent = "I'm sorry, but I couldn't find relevant information in the college database. Please contact the administration.";
      let botSources = [];

      if (res.ok) {
        const data = await res.json();
        botContent = data.content || '';
        botSources = data.sources || [];
      } else {
        const err = await res.json().catch(() => ({}));
        botContent = err.detail || "Server error while processing your request. Please try again.";
        botSources = [];
      }

      // Guarantee content is never empty or blank
      if (!botContent || !botContent.trim()) {
        botContent = "I'm sorry, but I couldn't find relevant information in the college database. Please contact the administration.";
        botSources = [];
      }

      const botMsg = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: botContent,
        sources: botSources,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, botMsg]);

      // Save to localStorage threads
      if (isNewThread) {
        const title = queryText.length > 38 ? queryText.slice(0, 38).trim() + '...' : queryText;
        const newThread = {
          id: currentThreadId,
          title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [userMsg, botMsg],
        };
        setThreads((prev) => [newThread, ...prev]);
        setActiveThreadId(currentThreadId);
      } else {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === currentThreadId
              ? {
                  ...t,
                  updatedAt: new Date().toISOString(),
                  messages: [...t.messages, userMsg, botMsg],
                }
              : t
          )
        );
      }
    } catch (e) {
      console.error(e);
      const errorMsg = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: "Network error contacting the college database. Please check your connection and try again.",
        sources: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteThread = (threadId, e) => {
    e.stopPropagation();
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
      setMessages([]);
      localStorage.removeItem('camp_ai_active_thread_id');
    }
  };

  const handleStartRename = (thread, e) => {
    e.stopPropagation();
    setEditingThreadId(thread.id);
    setEditTitle(thread.title);
  };

  const handleSaveRename = (threadId, e) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, title: editTitle.trim() } : t))
      );
    }
    setEditingThreadId(null);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleTagToggle = (tag) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const quickPrompts = [
    {
      icon: Calendar,
      title: "Examination Datesheets",
      desc: "Exam timetable for B.Tech Semester 1, 3, and 5",
      prompt: "Show me the examination schedule and datesheet for B.Tech Semester 1, 3, and 5.",
    },
    {
      icon: CreditCard,
      title: "Tuition & Hostel Fees",
      desc: "Annual course fee structure and payment deadlines",
      prompt: "What is the complete fee structure, tuition, and hostel charges?",
    },
    {
      icon: BookOpen,
      title: "Syllabus & Course Units",
      desc: "Curriculum, subjects, and credits for engineering/IT",
      prompt: "What is the detailed syllabus and course modules for B.Tech Computer Science?",
    },
    {
      icon: FileText,
      title: "Admissions & Regulations",
      desc: "Eligibility criteria, required documents, and guidelines",
      prompt: "What are the admission rules, eligibility criteria, and documents required?",
    },
  ];

  return (
    <div className="flex h-full w-full bg-[#fafafa] text-zinc-900 overflow-hidden relative">
      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-xs z-30 sm:hidden animate-in fade-in duration-150"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Minimalist Sidebar */}
      <aside
        className={`fixed sm:relative top-0 bottom-0 left-0 w-72 sm:w-64 bg-white border-r border-zinc-200/90 z-40 flex flex-col transition-transform duration-200 ease-in-out shrink-0 ${
          sidebarOpen ? 'translate-x-0 shadow-2xl sm:shadow-none' : '-translate-x-full sm:translate-x-0'
        }`}
      >
        {/* Sidebar Header: New Chat Button */}
        <div className="p-3 sm:p-3.5 border-b border-zinc-100 flex items-center gap-2">
          <button
            onClick={handleStartNewChat}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="sm:hidden p-2 text-zinc-500 hover:text-zinc-800 rounded-lg hover:bg-zinc-100 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Threads List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 no-scrollbar">
          <div className="px-2 pb-1.5 flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span>Conversations</span>
            <span className="text-zinc-400 font-normal">{threads.length}</span>
          </div>

          {threads.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-zinc-400">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-30 stroke-1" />
              <span>No conversations yet.</span>
            </div>
          ) : (
            threads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              const isEditing = editingThreadId === thread.id;

              return (
                <div
                  key={thread.id}
                  onClick={() => {
                    if (!isEditing) {
                      setActiveThreadId(thread.id);
                      setSidebarOpen(false);
                    }
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-900 font-medium'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(thread.id, e);
                          if (e.key === 'Escape') setEditingThreadId(null);
                        }}
                        className="flex-1 px-2 py-1 text-xs bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-zinc-500"
                      />
                      <button
                        onClick={(e) => handleSaveRename(thread.id, e)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingThreadId(null);
                        }}
                        className="p-1 text-zinc-400 hover:bg-zinc-100 rounded"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`} />
                        <span className="truncate">{thread.title || 'Untitled Chat'}</span>
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button
                          onClick={(e) => handleStartRename(thread, e)}
                          className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteThread(thread.id, e)}
                          className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="truncate">{config?.college_name || 'Bharti.ai'}</span>
          <button
            onClick={onOpenSettings}
            className="hover:text-zinc-800 underline transition-colors"
          >
            Settings
          </button>
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <section className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
        {/* Mobile Sub-Header: Thread Name & Hamburger */}
        <div className="sm:hidden h-11 px-3 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 -ml-1 text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 flex items-center gap-1.5 text-xs font-medium"
          >
            <Menu className="w-4 h-4" />
            <span>Chats</span>
          </button>

          <span className="text-xs font-medium text-zinc-800 truncate max-w-[180px]">
            {threads.find((t) => t.id === activeThreadId)?.title || 'New Chat'}
          </span>

          <button
            onClick={handleStartNewChat}
            className="p-1.5 text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100"
            title="Start new chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="max-w-3xl mx-auto w-full space-y-6">
            {messages.length === 0 ? (
              /* Minimalist Empty State */
              <div className="py-8 sm:py-14 flex flex-col items-center text-center animate-in fade-in duration-300">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-800 mb-4 shadow-xs">
                  <Sparkles className="w-6 h-6 text-zinc-700" />
                </div>

                <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 tracking-tight">
                  How can I help you today?
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1.5 max-w-md leading-relaxed">
                  Ask questions about Bharti Vidyapeeth — admissions, fee structures, examination datesheets, and course syllabus.
                </p>

                {/* 4 Minimalist Prompt Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full text-left">
                  {quickPrompts.map((card, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(card.prompt)}
                      className="p-3.5 rounded-xl border border-zinc-200/80 bg-white hover:border-zinc-300 hover:bg-zinc-50/70 hover:shadow-xs transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200/70 flex items-center justify-center text-zinc-700 mb-2.5 group-hover:bg-zinc-200/80 group-hover:text-zinc-900 transition-colors">
                          <card.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-zinc-900 group-hover:text-zinc-950 block">
                          {card.title}
                        </span>
                        <span className="text-[11px] text-zinc-500 mt-1 block leading-normal">
                          {card.desc}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-[11px] text-zinc-400 group-hover:text-zinc-700">
                        <span>Ask this</span>
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Chat Message Stream */
              messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
                  >
                    {/* Message Bubble */}
                    <div
                      className={`relative ${
                        isUser
                          ? 'bg-zinc-900 text-white rounded-2xl rounded-tr-xs px-4 py-3 max-w-[85%] sm:max-w-[75%] shadow-xs'
                          : 'bg-white border border-zinc-200/80 rounded-2xl rounded-tl-xs px-4 sm:px-5 py-4 max-w-[98%] sm:max-w-[88%] text-zinc-800 shadow-xs'
                      }`}
                    >
                      <FormattedMessage content={msg.content} isUser={isUser} />

                      {/* Source Citation Pills for Assistant */}
                      {!isUser && msg.content && msg.content.trim() && msg.sources && msg.sources.length > 0 && !msg.content.includes("I'm sorry, but I couldn't find") && (
                        <div className="mt-4 pt-3 border-t border-zinc-100 space-y-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
                            Retrieved Sources ({msg.sources.length})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src, sIdx) => {
                              const title = src.document_title || src.title || 'Official Document';
                              const pageStr = src.page ? ` (p. ${src.page})` : '';
                              return (
                                <button
                                  key={sIdx}
                                  onClick={() => setSelectedSource(src)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 hover:text-zinc-900 transition-colors shadow-2xs"
                                  title="View source citation and excerpt"
                                >
                                  <FileText className="w-3 h-3 text-zinc-500" />
                                  <span className="truncate max-w-[200px]">{title}{pageStr}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Bar for Assistant */}
                    {!isUser && (
                      <div className="flex items-center gap-1 mt-1.5 px-1 text-zinc-400">
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1 hover:text-zinc-700 rounded hover:bg-zinc-100 transition-colors flex items-center gap-1 text-[11px]"
                          title="Copy response"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-600 font-medium">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-start gap-3 animate-in fade-in duration-150">
                <div className="bg-white border border-zinc-200/80 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs flex items-center gap-2.5 text-xs text-zinc-500">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span>Searching verified college database...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Minimalist Floating Input Container */}
        <div className="p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t border-zinc-100 shrink-0">
          <div className="max-w-3xl mx-auto w-full">
            {/* Active Tag Filters */}
            {activeTags.length > 0 && (
              <div className="flex items-center gap-1.5 mb-2 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-[11px] text-zinc-400 shrink-0">Filtered by:</span>
                {activeTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-zinc-100 text-zinc-800 border border-zinc-200 shrink-0"
                  >
                    #{tag}
                    <button
                      onClick={() => handleTagToggle(tag)}
                      className="hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => setActiveTags([])}
                  className="text-[10px] text-zinc-400 hover:text-zinc-600 underline shrink-0"
                >
                  Clear tags
                </button>
              </div>
            )}

            {/* Prompt Box */}
            <div className="relative rounded-2xl border border-zinc-300 focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-100 bg-white shadow-xs p-1.5 transition-all flex flex-col">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder="Ask anything about Bharti Vidyapeeth (e.g. Sem 3 datesheet, tuition fees)..."
                className="w-full resize-none border-0 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-0 max-h-36 leading-relaxed"
              />

              <div className="flex items-center justify-between pt-1 px-1">
                {/* Left: Tag Picker Toggle */}
                <div className="relative">
                  <button
                    onClick={() => setTagsPickerOpen(!tagsPickerOpen)}
                    className="px-2.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg flex items-center gap-1 transition-colors"
                    title="Filter query by department, semester, or topic tag"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Add Topic Tag</span>
                  </button>

                  {/* Tag Selector Popover */}
                  {tagsPickerOpen && (
                    <div className="absolute bottom-8 left-0 w-72 bg-white rounded-xl border border-zinc-200 shadow-xl p-3 z-50 animate-in zoom-in-95 duration-100">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                        <span className="text-xs font-semibold text-zinc-800">Campus Keywords</span>
                        <button onClick={() => setTagsPickerOpen(false)}>
                          <X className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-600" />
                        </button>
                      </div>

                      <div className="my-2">
                        <input
                          type="text"
                          placeholder="Search tags (e.g. Sem 3, Datesheet)..."
                          value={tagSearch}
                          onChange={(e) => setTagSearch(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400"
                        />
                      </div>

                      <div className="max-h-40 overflow-y-auto space-y-1 no-scrollbar pt-1">
                        {CAMPUS_KEYWORDS.filter((k) =>
                          k.toLowerCase().includes(tagSearch.toLowerCase())
                        ).map((keyword) => {
                          const isSelected = activeTags.includes(keyword);
                          return (
                            <button
                              key={keyword}
                              onClick={() => handleTagToggle(keyword)}
                              className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between ${
                                isSelected
                                  ? 'bg-zinc-900 text-white font-medium'
                                  : 'hover:bg-zinc-100 text-zinc-700'
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
                </div>

                {/* Right: Send Button */}
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    input.trim() && !loading
                      ? 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-xs'
                      : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                  }`}
                  aria-label="Send query"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Disclaimer */}
            <p className="text-[11px] text-zinc-400 text-center mt-2">
              Institutional AI references verified college documents. Always confirm official notifications with the administration.
            </p>
          </div>
        </div>
      </section>

      {/* Source Citation Modal / Drawer */}
      {selectedSource && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedSource(null)}
        >
          <div
            className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-600" />
                <h3 className="font-semibold text-zinc-900 text-sm truncate max-w-sm">
                  {selectedSource.document_title || selectedSource.title || 'Source Reference'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSource(null)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto no-scrollbar text-xs">
              <div className="flex flex-wrap gap-2 text-[11px]">
                {selectedSource.page && (
                  <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-medium">
                    Page {selectedSource.page}
                  </span>
                )}
                {selectedSource.section && (
                  <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-medium">
                    Section: {selectedSource.section}
                  </span>
                )}
                {selectedSource.department && (
                  <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-medium">
                    Dept: {selectedSource.department}
                  </span>
                )}
                {selectedSource.semester && (
                  <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-medium">
                    Semester {selectedSource.semester}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Extracted Context Chunk
                </span>
                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-zinc-800 leading-relaxed font-mono text-[11.5px] whitespace-pre-wrap">
                  {selectedSource.content || selectedSource.snippet || 'No text snippet available.'}
                </div>
              </div>

              {selectedSource.source_url && (
                <div className="pt-2">
                  <a
                    href={selectedSource.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Official Document URL</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notice Board Drawer / Modal */}
      {noticesOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setNoticesOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-zinc-700" />
                <div>
                  <h3 className="font-semibold text-zinc-900 text-sm">Notice Board</h3>
                  <p className="text-[11px] text-zinc-500">Official circulars, schedules, and college notices</p>
                </div>
              </div>
              <button
                onClick={() => setNoticesOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Search */}
            <div className="p-4 border-b border-zinc-100 bg-white">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter notices (e.g. datesheet, fees, holiday)..."
                  value={noticeSearch}
                  onChange={(e) => setNoticeSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400"
                />
              </div>
            </div>

            {/* Notices List */}
            <div className="p-5 space-y-3 overflow-y-auto no-scrollbar flex-1">
              {noticesLoading ? (
                <div className="py-8 text-center text-xs text-zinc-400">Loading notices...</div>
              ) : notices.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400">
                  <FileText className="w-6 h-6 mx-auto mb-2 opacity-30 stroke-1" />
                  <span>No official notices currently uploaded.</span>
                </div>
              ) : (
                notices
                  .filter((n) =>
                    n.title.toLowerCase().includes(noticeSearch.toLowerCase()) ||
                    (n.subject && n.subject.toLowerCase().includes(noticeSearch.toLowerCase())) ||
                    (n.department && n.department.toLowerCase().includes(noticeSearch.toLowerCase()))
                  )
                  .map((notice) => (
                    <div
                      key={notice.id}
                      className="p-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-50 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-xs font-semibold text-zinc-900 leading-snug">{notice.title}</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-200 text-zinc-700 shrink-0">
                          {notice.document_type || notice.domain || 'Notice'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                        {notice.department && <span>Dept: {notice.department}</span>}
                        {notice.semester && <span>Sem: {notice.semester}</span>}
                        {notice.effective_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Valid from: {notice.effective_date}
                          </span>
                        )}
                      </div>

                      {notice.source_url && (
                        <div className="pt-1">
                          <a
                            href={notice.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-zinc-800 hover:text-zinc-950 font-medium underline"
                          >
                            <ExternalLink className="w-3 h-3" /> View Notice Document
                          </a>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
