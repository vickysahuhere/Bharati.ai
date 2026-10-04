import React, { useState, useEffect } from 'react';
import { 
  Users, FileText, Upload, CheckCircle, XCircle, RefreshCw, 
  Shield, Cpu, Menu, Tag, Plus, X, Search, Zap, AlertCircle, 
  Clock, Calendar, ArrowLeft, ExternalLink, Trash2, HelpCircle,
  Eye, Layers, Copy, Check, Edit3, Table, Filter
} from 'lucide-react';
import StudentChat from './StudentChat';
import { CAMPUS_KEYWORDS } from '../config/keywords';

export default function AdminPanel({ token, onSwitchToChat }) {
  // Navigation & Tabs with localStorage persistence
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('camp_ai_admin_tab') || 'docs');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [unresolvedQueries, setUnresolvedQueries] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [message, setMessage] = useState('');
  
  // Ingestion form with localStorage defaults memory
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState(() => localStorage.getItem('camp_ai_admin_domain') || 'academic');
  const [department, setDepartment] = useState(() => localStorage.getItem('camp_ai_admin_dept') || '');
  const [semester, setSemester] = useState('');
  const [subject, setSubject] = useState('');
  const [documentType, setDocumentType] = useState(() => localStorage.getItem('camp_ai_admin_doctype') || 'syllabus');
  const [sourceUrl, setSourceUrl] = useState('');
  const [showKeywordsPicker, setShowKeywordsPicker] = useState(false);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  // Admin Quick Notes / Scratchpad with localStorage
  const [adminNotes, setAdminNotes] = useState(() => localStorage.getItem('camp_ai_admin_notes') || '');

  // Document table search filter with localStorage
  const [docSearchFilter, setDocSearchFilter] = useState(() => localStorage.getItem('camp_ai_admin_doc_search') || '');

  // Chunk & Table Inspector Modal state
  const [inspectingDoc, setInspectingDoc] = useState(null);
  const [inspectingChunks, setInspectingChunks] = useState([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [chunkFilter, setChunkFilter] = useState('');
  const [copiedChunkId, setCopiedChunkId] = useState(null);

  const [reindexingId, setReindexingId] = useState(null);
  const [processingQueue, setProcessingQueue] = useState(false);

  // Initial fetch for badges and data
  useEffect(() => {
    fetchPendingUsers();
    fetchUnresolvedQueries();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchPendingUsers();
    if (activeTab === 'docs') fetchDocuments();
    if (activeTab === 'unresolved') fetchUnresolvedQueries();
  }, [activeTab]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('camp_ai_admin_tab', tabId);
  };

  const handleDomainChange = (val) => {
    setDomain(val);
    localStorage.setItem('camp_ai_admin_domain', val);
  };

  const handleDeptChange = (val) => {
    setDepartment(val);
    localStorage.setItem('camp_ai_admin_dept', val);
  };

  const handleDocTypeChange = (val) => {
    setDocumentType(val);
    localStorage.setItem('camp_ai_admin_doctype', val);
  };

  const handleNotesChange = (val) => {
    setAdminNotes(val);
    localStorage.setItem('camp_ai_admin_notes', val);
  };

  const handleDocSearchChange = (val) => {
    setDocSearchFilter(val);
    localStorage.setItem('camp_ai_admin_doc_search', val);
  };

  const fetchPendingUsers = async () => {
    try {
      const res = await fetch('/api/users/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingUsers(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUnresolvedQueries = async () => {
    try {
      const res = await fetch('/api/documents/admin/unresolved-queries', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnresolvedQueries(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismissQuery = async (queryId) => {
    try {
      const res = await fetch(`/api/documents/admin/unresolved-queries/${queryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUnresolvedQueries(prev => prev.filter(q => q.id !== queryId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAllQueries = async () => {
    if (!window.confirm("Clear all unresolved student queries from the dashboard?")) return;
    try {
      const res = await fetch('/api/documents/admin/unresolved-queries', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUnresolvedQueries([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveWithUpload = (queryText) => {
    handleTabChange('docs');
    setTitle(`Information on: ${queryText}`);
    setSubject(queryText);
    setMessage(`Prefilled upload form for student gap: "${queryText}". Attach the corresponding PDF/DOCX.`);
  };

  const handleOpenInspector = async (doc) => {
    setInspectingDoc(doc);
    setLoadingChunks(true);
    setInspectingChunks([]);
    setChunkFilter('');
    try {
      const res = await fetch(`/api/documents/${doc.document_id}/chunks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInspectingChunks(data);
      } else {
        setMessage('Failed to load chunks for this document');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleCloseInspector = () => {
    setInspectingDoc(null);
    setInspectingChunks([]);
    setChunkFilter('');
  };

  const handleCopyChunk = (chunkId, text) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(chunkId);
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  const handleApprove = async (userId) => {
    try {
      const res = await fetch(`/api/users/${userId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setPendingUsers(pendingUsers.filter((u) => u.id !== userId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (userId) => {
    try {
      const res = await fetch(`/api/users/${userId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setPendingUsers(pendingUsers.filter((u) => u.id !== userId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !title) return;

    setUploading(true);
    setMessage('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('knowledge_domain', domain);
    const subjectInput = document.getElementById('subject-input')?.value;
    const semesterInput = document.getElementById('semester-input')?.value;

    const finalSubject = subject || subjectInput;
    if (department) formData.append('department', department);
    if (finalSubject) formData.append('subject', finalSubject);
    if (semesterInput) formData.append('semester', semesterInput);
    if (documentType) formData.append('document_type', documentType);
    if (sourceUrl) formData.append('source_url', sourceUrl);
    if (effectiveDate) formData.append('effective_date', effectiveDate);
    if (expirationDate) formData.append('expiration_date', expirationDate);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        setMessage('Document uploaded & indexed successfully!');
        setTitle('');
        setSubject('');
        setSemester('');
        setSourceUrl('');
        setEffectiveDate('');
        setExpirationDate('');
        setFile(null);
        fetchDocuments();
      } else {
        const err = await res.json();
        setMessage(`Error: ${err.detail || 'Upload failed'}`);
      }
    } catch (e) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleReindex = async (docId) => {
    setReindexingId(docId);
    setMessage('');
    try {
      const res = await fetch(`/api/documents/${docId}/reindex`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage('Document successfully re-indexed!');
        fetchDocuments();
      } else {
        const err = await res.json();
        setMessage(`Re-indexing failed: ${err.detail || 'Unknown error'}`);
      }
    } catch (e) {
      setMessage(`Re-indexing error: ${e.message}`);
    } finally {
      setReindexingId(null);
    }
  };

  const handleProcessQueue = async () => {
    setProcessingQueue(true);
    setMessage('');
    try {
      const res = await fetch('/api/documents/process-queue', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Queue processed: ${data.processed} job(s) completed.`);
        fetchDocuments();
      } else {
        const err = await res.json();
        setMessage(`Failed to process queue: ${err.detail || 'Unknown error'}`);
      }
    } catch (e) {
      setMessage(`Error processing queue: ${e.message}`);
    } finally {
      setProcessingQueue(false);
    }
  };

  const handlePurgeAll = async () => {
    if (!window.confirm("Are you sure you want to permanently delete ALL documents, chunks, and vector embeddings? This will wipe the database to start completely fresh.")) {
      return;
    }
    setPurging(true);
    setMessage('');
    try {
      const res = await fetch('/api/documents/admin/purge-all', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage('All documents, chunks, and embeddings were successfully deleted.');
        fetchDocuments();
      } else {
        const err = await res.json();
        setMessage(`Purge failed: ${err.detail || 'Unknown error'}`);
      }
    } catch (e) {
      setMessage(`Error purging documents: ${e.message}`);
    } finally {
      setPurging(false);
    }
  };

  const filteredDocuments = documents.filter(d => {
    if (!docSearchFilter) return true;
    const q = docSearchFilter.toLowerCase();
    return (
      (d.title && d.title.toLowerCase().includes(q)) ||
      (d.department && d.department.toLowerCase().includes(q)) ||
      (d.subject && d.subject.toLowerCase().includes(q)) ||
      (d.document_type && d.document_type.toLowerCase().includes(q)) ||
      (d.status && d.status.toLowerCase().includes(q))
    );
  });

  const filteredChunks = inspectingChunks.filter(c => {
    if (!chunkFilter) return true;
    const q = chunkFilter.toLowerCase();
    return (
      (c.content && c.content.toLowerCase().includes(q)) ||
      (c.section && c.section.toLowerCase().includes(q)) ||
      (c.page && String(c.page).includes(q))
    );
  });

  const navItems = [
    { id: 'docs', label: 'Documents & RAG', icon: FileText },
    { id: 'unresolved', label: 'Knowledge Gaps', icon: HelpCircle, count: unresolvedQueries.length },
    { id: 'users', label: 'User Approvals', icon: Users, count: pendingUsers.length },
    { id: 'ai', label: 'Try Assistant', icon: Cpu }
  ];

  return (
    <div className="flex flex-col sm:flex-row h-full bg-[#fafafa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden relative font-sans">
      {/* Mobile Top Tab Bar */}
      <div className="sm:hidden bg-white dark:bg-zinc-900 border-b border-zinc-200/90 dark:border-zinc-800 flex overflow-x-auto no-scrollbar px-3 py-2.5 gap-2 shrink-0">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabChange(item.id)}
            className={`whitespace-nowrap px-3.5 py-2 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === item.id
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
            }`}
          >
            <item.icon className="w-3.5 h-3.5" />
            <span>{item.label}</span>
            {item.count > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                activeTab === item.id 
                  ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100' 
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
              }`}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden sm:flex w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200/90 dark:border-zinc-800 flex-col shrink-0 p-4 z-10">
        <div className="flex items-center gap-2.5 px-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Admin Console</h2>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium block">Knowledge & Ingestion</span>
          </div>
        </div>

        <nav className="space-y-1.5 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-medium rounded-xl flex items-center justify-between transition-all ${
                activeTab === item.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTab === item.id 
                    ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Local Storage Admin Scratchpad */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
              <Edit3 className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Admin Scratchpad</span>
            </div>
            <span className="text-[9px] text-zinc-400 uppercase tracking-wider">Local</span>
          </div>
          <textarea
            value={adminNotes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Quick admin notes, pending tasks, syllabus checklist (auto-saved locally)..."
            rows={4}
            className="w-full text-[11px] p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 resize-none font-sans"
          />
        </div>

        {onSwitchToChat && (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-3">
            <button
              onClick={onSwitchToChat}
              className="w-full px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Student Chat</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 bg-[#fafafa] dark:bg-zinc-950 overflow-y-auto p-4 sm:p-8 no-scrollbar relative z-0">
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
          
          {/* USER APPROVALS TAB */}
          {activeTab === 'users' && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-8 shadow-xs">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2 tracking-tight">
                <Users className="w-5 h-5 text-zinc-700 dark:text-zinc-300" /> Student Access Requests
              </h2>
              {pendingUsers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">No pending student registration requests.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                      <tr>
                        <th className="p-3.5">Student Name</th>
                        <th className="p-3.5">Email</th>
                        <th className="p-3.5">Role</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                      {pendingUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="p-3.5 font-semibold text-zinc-900 dark:text-zinc-100">{u.full_name}</td>
                          <td className="p-3.5 font-normal text-zinc-600 dark:text-zinc-400">{u.email}</td>
                          <td className="p-3.5 uppercase font-medium text-[11px] text-zinc-500 dark:text-zinc-400">{u.role}</td>
                          <td className="p-3.5 text-right space-x-2">
                            <button
                              onClick={() => handleApprove(u.id)}
                              className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg font-medium inline-flex items-center gap-1 text-[11px] transition-colors"
                            >
                              <CheckCircle className="w-3 h-3" /> Approve
                            </button>
                            <button
                              onClick={() => handleReject(u.id)}
                              className="px-3 py-1.5 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800 rounded-lg font-medium inline-flex items-center gap-1 text-[11px] transition-colors"
                            >
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* KNOWLEDGE GAPS / UNRESOLVED QUERIES TAB */}
          {activeTab === 'unresolved' && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 tracking-tight">
                    <HelpCircle className="w-5 h-5 text-zinc-700 dark:text-zinc-300" /> Student Knowledge Gaps
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Real questions asked by students where the AI found no corresponding document in the knowledge base.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {unresolvedQueries.length > 0 && (
                    <button
                      onClick={handleClearAllQueries}
                      className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950 text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors border border-zinc-200 dark:border-zinc-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={fetchUnresolvedQueries}
                    className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700"
                    title="Refresh list"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {unresolvedQueries.length === 0 ? (
                <div className="text-center py-14">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Zero Unresolved Queries</h3>
                  <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                    All recent student questions have matched indexed college documents with verified answers.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unresolvedQueries.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            "{item.query}"
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-3 pl-4">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-4 sm:pl-0">
                        <button
                          onClick={() => handleResolveWithUpload(item.query)}
                          className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-medium rounded-lg inline-flex items-center gap-1.5 shadow-xs hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                        >
                          <Upload className="w-3 h-3" />
                          Upload Doc for this
                        </button>
                        <button
                          onClick={() => handleDismissQuery(item.id)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                          title="Dismiss this gap"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DOCUMENTS & RAG TAB */}
          {activeTab === 'docs' && (
            <div className="space-y-6 sm:space-y-8">
              {/* Document Ingestion Form */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-8 shadow-xs">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2 tracking-tight">
                  <Upload className="w-5 h-5 text-zinc-700 dark:text-zinc-300" /> Upload & Index College Document
                </h2>

                {message && (
                  <div className="mb-6 p-3.5 bg-zinc-50 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                    <span>{message}</span>
                  </div>
                )}

                <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Document Title / Naming *</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. B.Tech Semester 1, 3, 5 Datesheet 2026"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Knowledge Domain *</label>
                    <select
                      value={domain}
                      onChange={(e) => handleDomainChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs font-medium"
                    >
                      <option value="academic">Academic (Syllabus, Regulations, Curriculum)</option>
                      <option value="notices">Notices (Datesheets, Circulars, Exam Timetables)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Subject / Keywords
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowKeywordsPicker(!showKeywordsPicker)}
                        className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        {showKeywordsPicker ? 'Hide Keywords' : 'Browse Keywords'}
                      </button>
                    </div>
                    <input
                      type="text"
                      id="subject-input"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. B.Tech, Sem 3, Datesheet, CSE..."
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                    
                    {/* Quick popular keyword suggestion chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {["B.Tech", "Sem 1", "Sem 3", "Sem 5", "Datesheet", "Syllabus 2026", "Notice"].map(k => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            setSubject(prev => prev ? `${prev}, ${k}` : k);
                          }}
                          className="text-[10px] font-medium px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md transition"
                        >
                          +{k}
                        </button>
                      ))}
                    </div>

                    {/* Expandable keywords drawer */}
                    {showKeywordsPicker && (
                      <div className="mt-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-md max-h-48 overflow-y-auto">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                          <Search className="w-3 h-3 text-zinc-400" />
                          <input 
                            type="text"
                            placeholder="Search campus keywords..."
                            value={keywordFilter}
                            onChange={(e) => setKeywordFilter(e.target.value)}
                            className="text-xs w-full outline-none bg-transparent text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {CAMPUS_KEYWORDS.filter(k => k.toLowerCase().includes(keywordFilter.toLowerCase())).map(k => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => {
                                setSubject(prev => prev ? `${prev}, ${k}` : k);
                              }}
                              className="text-[10px] font-medium px-2 py-0.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded transition"
                            >
                              +{k}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Department</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => handleDeptChange(e.target.value)}
                      placeholder="e.g. Computer Science & Engineering"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Semester</label>
                    <input
                      type="number"
                      id="semester-input"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      placeholder="e.g. 3"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Document Type</label>
                    <select
                      value={documentType}
                      onChange={(e) => handleDocTypeChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs font-medium"
                    >
                      <option value="">-- Select Type (Optional) --</option>
                      <option value="datesheet">Datesheet / Timetable</option>
                      <option value="syllabus">Syllabus</option>
                      <option value="fee_structure">Fee Structure</option>
                      <option value="circular">Notice / Circular</option>
                      <option value="regulations">Regulations & Rules</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Public Source Link / Drive Link (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://bharatividyapeeth.edu/datesheets/2026.pdf"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Effective / Valid Date</label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                    <span className="text-[10px] text-zinc-400 mt-1 block">Leave empty to auto-extract from document text</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Valid Until / Expiration</label>
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                    <span className="text-[10px] text-zinc-400 mt-1 block">e.g. End of exams or academic year</span>
                  </div>

                  <div className="md:col-span-2 mt-2">
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Select File (PDF, DOCX, TXT, JPEG, PNG) *</label>
                    <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 p-6 text-center hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors">
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png"
                        required
                        onChange={(e) => setFile(e.target.files[0])}
                        className="w-full text-xs text-zinc-700 dark:text-zinc-300 file:mr-4 file:py-2.5 file:px-4 file:border-0 file:rounded-lg file:text-xs file:font-medium file:bg-zinc-900 dark:file:bg-zinc-100 file:text-white dark:file:text-zinc-900 hover:file:bg-zinc-800 cursor-pointer transition-colors"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 pt-2">
                    <button
                      type="submit"
                      disabled={uploading}
                      className="w-full sm:w-auto px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-900 font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                    >
                      {uploading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900 rounded-full animate-spin" />
                          Processing & Indexing File...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload & Index Document
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Status List */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-8 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Indexed Knowledge Base</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Documents segmented into vector chunks for semantic RAG retrieval.</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handlePurgeAll}
                      disabled={purging}
                      className="px-3 py-1.5 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors border border-red-200 dark:border-red-800 shadow-xs"
                      title="Permanently wipe all documents and vector embeddings"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      {purging ? 'Purging...' : 'Purge All Data'}
                    </button>
                    <button
                      onClick={handleProcessQueue}
                      disabled={processingQueue}
                      className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors"
                      title="Run pending queue jobs"
                    >
                      <Zap className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                      {processingQueue ? 'Processing...' : 'Process Queue'}
                    </button>
                    <button
                      onClick={fetchDocuments}
                      className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700"
                      title="Refresh Document List"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Search / Filter Toolbar for Documents */}
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search indexed documents (title, dept, status)..."
                      value={docSearchFilter}
                      onChange={(e) => handleDocSearchChange(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
                    />
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                    Showing {filteredDocuments.length} of {documents.length} docs
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                      <tr>
                        <th className="p-3.5">Title</th>
                        <th className="p-3.5">Version</th>
                        <th className="p-3.5">Chunks</th>
                        <th className="p-3.5">Validity Dates</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                      {filteredDocuments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-zinc-400 text-xs">
                            {documents.length === 0 ? "No documents uploaded yet." : "No documents matched your search filter."}
                          </td>
                        </tr>
                      ) : (
                        filteredDocuments.map((d) => (
                          <tr key={d.document_id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                            <td className="p-3.5 font-medium text-zinc-900 dark:text-zinc-100">
                              <div>{d.title}</div>
                              {d.error && (
                                <div className="text-[10px] text-red-500 font-normal flex items-center gap-1 mt-1 truncate max-w-xs" title={d.error}>
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  {d.error}
                                </div>
                              )}
                            </td>
                            <td className="p-3.5 font-normal text-zinc-500 dark:text-zinc-400">v{d.version}</td>
                            <td className="p-3.5 font-medium">
                              <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md text-[11px]">
                                {d.chunks_count || 0} chunks
                              </span>
                            </td>
                            <td className="p-3.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                              {d.effective_date ? (
                                <div>
                                  <span className="text-zinc-800 dark:text-zinc-200 font-medium">{d.effective_date}</span>
                                  {d.expiration_date && (
                                    <span className="text-zinc-500 dark:text-zinc-400 block">to {d.expiration_date}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-zinc-400">Auto-detected</span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full ${
                                  d.status === 'indexed'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : d.status === 'processing'
                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                    : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                }`}
                              >
                                {d.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-right space-x-1.5">
                              {/* Visual Chunk Inspector Button */}
                              <button
                                onClick={() => handleOpenInspector(d)}
                                className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium rounded-lg inline-flex items-center gap-1 text-[11px] transition-colors border border-zinc-200 dark:border-zinc-700"
                                title="Inspect extracted text chunks and tables"
                              >
                                <Eye className="w-3 h-3 text-zinc-600 dark:text-zinc-400" />
                                Inspect
                              </button>
                              <button
                                onClick={() => handleReindex(d.document_id)}
                                disabled={reindexingId === d.document_id}
                                className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium rounded-lg inline-flex items-center gap-1 text-[11px] transition-colors"
                              >
                                <Zap className="w-3 h-3 text-zinc-600 dark:text-zinc-400" />
                                {reindexingId === d.document_id ? 'Indexing...' : (d.status === 'indexed' ? 'Re-index' : 'Index Now')}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TRY ASSISTANT TAB */}
          {activeTab === 'ai' && (
            <div className="h-[78vh] bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs relative">
              <StudentChat adminToken={token} />
            </div>
          )}
        </div>
      </main>

      {/* VISUAL CHUNK & TABLE INSPECTOR MODAL */}
      {inspectingDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    {inspectingDoc.title}
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      v{inspectingDoc.version}
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Chunk & Table Inspector • {inspectingChunks.length} vector chunks indexed
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseInspector}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter toolbar inside modal */}
            <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search chunk text, headings, or page numbers..."
                  value={chunkFilter}
                  onChange={(e) => setChunkFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
                />
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {filteredChunks.length} of {inspectingChunks.length} chunks
              </div>
            </div>

            {/* Chunks List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
              {loadingChunks ? (
                <div className="text-center py-16">
                  <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Retrieving chunks from vector database...</p>
                </div>
              ) : filteredChunks.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 text-xs">
                  {inspectingChunks.length === 0 
                    ? "No chunks found for this document. Re-index to generate chunks." 
                    : "No chunks match your search query."}
                </div>
              ) : (
                filteredChunks.map((chunk) => {
                  const isTable = chunk.metadata?.is_table || chunk.content.includes('|---|') || chunk.content.includes('|---');
                  return (
                    <div
                      key={chunk.id}
                      className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 p-4 transition-all shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700"
                    >
                      {/* Chunk Header */}
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] font-semibold">
                            Chunk #{chunk.chunk_index}
                          </span>
                          {chunk.page && (
                            <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
                              Page {chunk.page}
                            </span>
                          )}
                          {chunk.section && (
                            <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-xs">
                              {chunk.section}
                            </span>
                          )}
                          {isTable && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-medium flex items-center gap-1">
                              <Table className="w-3 h-3" /> Table Detected
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleCopyChunk(chunk.id, chunk.content)}
                          className="px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 font-medium"
                          title="Copy raw chunk content"
                        >
                          {copiedChunkId === chunk.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>

                      {/* Chunk Content */}
                      <pre className="font-mono text-[11px] bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80 rounded-lg p-3 text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap select-text overflow-x-auto">
                        {chunk.content}
                      </pre>

                      {/* Chunk Metadata Details */}
                      {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                          {chunk.metadata.token_count && (
                            <span>{chunk.metadata.token_count} tokens</span>
                          )}
                          {chunk.metadata.source && (
                            <span>• {chunk.metadata.source}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-right">
              <button
                onClick={handleCloseInspector}
                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
