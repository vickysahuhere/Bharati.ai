import React, { useState, useEffect } from 'react';
import { 
  Users, FileText, Upload, CheckCircle, XCircle, RefreshCw, 
  Shield, Cpu, Menu, Tag, Plus, X, Search, Zap, AlertCircle, 
  Clock, Calendar, ArrowLeft, ExternalLink 
} from 'lucide-react';
import StudentChat from './StudentChat';
import { CAMPUS_KEYWORDS } from '../config/keywords';

export default function AdminPanel({ token, onSwitchToChat }) {
  const [activeTab, setActiveTab] = useState('docs'); // default to docs management
  const [pendingUsers, setPendingUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('academic');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');
  const [subject, setSubject] = useState('');
  const [documentType, setDocumentType] = useState('syllabus');
  const [sourceUrl, setSourceUrl] = useState('');
  const [showKeywordsPicker, setShowKeywordsPicker] = useState(false);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  const [reindexingId, setReindexingId] = useState(null);
  const [processingQueue, setProcessingQueue] = useState(false);

  useEffect(() => {
    if (activeTab === 'users') fetchPendingUsers();
    if (activeTab === 'docs') fetchDocuments();
  }, [activeTab]);

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
    const docTypeInput = document.getElementById('doc-type-input')?.value;

    const finalSubject = subject || subjectInput;
    if (department) formData.append('department', department);
    if (finalSubject) formData.append('subject', finalSubject);
    if (semesterInput) formData.append('semester', semesterInput);
    if (docTypeInput) formData.append('document_type', docTypeInput);
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
        setDepartment('');
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

  const navItems = [
    { id: 'docs', label: 'Documents & RAG', icon: FileText },
    { id: 'users', label: 'User Approvals', icon: Users, count: pendingUsers.length },
    { id: 'ai', label: 'Try Assistant', icon: Cpu }
  ];

  return (
    <div className="flex flex-col sm:flex-row h-full bg-[#fafafa] text-zinc-900 overflow-hidden relative font-sans">
      {/* Mobile Top Tab Bar */}
      <div className="sm:hidden bg-white border-b border-zinc-200/90 flex overflow-x-auto no-scrollbar px-3 py-2.5 gap-2 shrink-0">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`whitespace-nowrap px-3.5 py-2 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === item.id
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70'
            }`}
          >
            <item.icon className="w-3.5 h-3.5" />
            <span>{item.label}</span>
            {item.count > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                activeTab === item.id ? 'bg-white text-zinc-900' : 'bg-zinc-200 text-zinc-800'
              }`}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden sm:flex w-64 bg-white border-r border-zinc-200/90 flex-col shrink-0 p-4 z-10">
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center shadow-xs">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Admin Console</h2>
            <span className="text-[10px] text-zinc-500 font-medium block">Knowledge & Ingestion</span>
          </div>
        </div>

        <nav className="space-y-1.5 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-medium rounded-xl flex items-center justify-between transition-all ${
                activeTab === item.id
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTab === item.id ? 'bg-white text-zinc-900' : 'bg-zinc-100 text-zinc-700'
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {onSwitchToChat && (
          <div className="pt-4 border-t border-zinc-100">
            <button
              onClick={onSwitchToChat}
              className="w-full px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Student Chat</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 bg-[#fafafa] overflow-y-auto p-4 sm:p-8 no-scrollbar relative z-0">
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
          {activeTab === 'users' && (
            <div className="bg-white rounded-2xl border border-zinc-200/90 p-6 sm:p-8 shadow-xs">
              <h2 className="text-base font-semibold text-zinc-900 mb-6 flex items-center gap-2 tracking-tight">
                <Users className="w-5 h-5 text-zinc-700" /> Student Access Requests
              </h2>
              {pendingUsers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-medium text-zinc-500">No pending student registration requests.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-200">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-semibold">
                      <tr>
                        <th className="p-3.5">Student Name</th>
                        <th className="p-3.5">Email</th>
                        <th className="p-3.5">Role</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-800">
                      {pendingUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-zinc-50/60 transition-colors">
                          <td className="p-3.5 font-semibold text-zinc-900">{u.full_name}</td>
                          <td className="p-3.5 font-normal text-zinc-600">{u.email}</td>
                          <td className="p-3.5 uppercase font-medium text-[11px] text-zinc-500">{u.role}</td>
                          <td className="p-3.5 text-right space-x-2">
                            <button
                              onClick={() => handleApprove(u.id)}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg font-medium inline-flex items-center gap-1 text-[11px] transition-colors"
                            >
                              <CheckCircle className="w-3 h-3" /> Approve
                            </button>
                            <button
                              onClick={() => handleReject(u.id)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg font-medium inline-flex items-center gap-1 text-[11px] transition-colors"
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

          {activeTab === 'docs' && (
            <div className="space-y-6 sm:space-y-8">
              {/* Document Ingestion Form */}
              <div className="bg-white rounded-2xl border border-zinc-200/90 p-6 sm:p-8 shadow-xs">
                <h2 className="text-base font-semibold text-zinc-900 mb-6 flex items-center gap-2 tracking-tight">
                  <Upload className="w-5 h-5 text-zinc-700" /> Upload & Index College Document
                </h2>

                {message && (
                  <div className="mb-6 p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 text-zinc-800 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-zinc-500 shrink-0" />
                    <span>{message}</span>
                  </div>
                )}

                <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Document Title / Naming *</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. B.Tech Semester 1, 3, 5 Datesheet 2026"
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Knowledge Domain *</label>
                    <select
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs font-medium"
                    >
                      <option value="academic">Academic (Syllabus, Regulations, Curriculum)</option>
                      <option value="notices">Notices (Datesheets, Circulars, Exam Timetables)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-zinc-700">
                        Subject / Keywords
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowKeywordsPicker(!showKeywordsPicker)}
                        className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800 flex items-center gap-1"
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
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
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
                          className="text-[10px] font-medium px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md transition"
                        >
                          +{k}
                        </button>
                      ))}
                    </div>

                    {/* Expandable 100 keywords drawer */}
                    {showKeywordsPicker && (
                      <div className="mt-3 p-3 bg-white rounded-xl border border-zinc-200 shadow-md max-h-48 overflow-y-auto">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100">
                          <Search className="w-3 h-3 text-zinc-400" />
                          <input 
                            type="text"
                            placeholder="Search campus keywords..."
                            value={keywordFilter}
                            onChange={(e) => setKeywordFilter(e.target.value)}
                            className="text-xs w-full outline-none bg-transparent"
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
                              className="text-[10px] font-medium px-2 py-0.5 bg-zinc-50 hover:bg-zinc-900 hover:text-white border border-zinc-200 rounded transition"
                            >
                              +{k}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Department</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Computer Science & Engineering"
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Semester</label>
                    <input
                      type="number"
                      id="semester-input"
                      placeholder="e.g. 3"
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Document Type</label>
                    <select
                      id="doc-type-input"
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs font-medium"
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
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Public Source Link / Drive Link (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://bharatividyapeeth.edu/datesheets/2026.pdf"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Effective / Valid Date</label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                    <span className="text-[10px] text-zinc-400 mt-1 block">Leave empty to auto-extract from document text</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Valid Until / Expiration</label>
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 text-xs"
                    />
                    <span className="text-[10px] text-zinc-400 mt-1 block">e.g. End of exams or academic year</span>
                  </div>

                  <div className="md:col-span-2 mt-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Select File (PDF, DOCX, TXT, JPEG, PNG) *</label>
                    <div className="border border-dashed border-zinc-300 rounded-xl bg-zinc-50/50 p-6 text-center hover:bg-zinc-50 transition-colors">
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png"
                        required
                        onChange={(e) => setFile(e.target.files[0])}
                        className="w-full text-xs text-zinc-700 file:mr-4 file:py-2.5 file:px-4 file:border-0 file:rounded-lg file:text-xs file:font-medium file:bg-zinc-900 file:text-white hover:file:bg-zinc-800 cursor-pointer transition-colors"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 pt-2">
                    <button
                      type="submit"
                      disabled={uploading}
                      className="w-full sm:w-auto px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                    >
                      {uploading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
              <div className="bg-white rounded-2xl border border-zinc-200/90 p-6 sm:p-8 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Indexed Knowledge Base</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Documents segmented into vector chunks for semantic RAG retrieval.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleProcessQueue}
                      disabled={processingQueue}
                      className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors"
                      title="Run pending queue jobs"
                    >
                      <Zap className="w-3.5 h-3.5 text-zinc-600" />
                      {processingQueue ? 'Processing...' : 'Process Queue'}
                    </button>
                    <button
                      onClick={fetchDocuments}
                      className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-200"
                      title="Refresh Document List"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-200">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-semibold">
                      <tr>
                        <th className="p-3.5">Title</th>
                        <th className="p-3.5">Version</th>
                        <th className="p-3.5">Chunks</th>
                        <th className="p-3.5">Validity Dates</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-800">
                      {documents.map((d) => (
                        <tr key={d.document_id} className="hover:bg-zinc-50/60 transition-colors">
                          <td className="p-3.5 font-medium text-zinc-900">
                            <div>{d.title}</div>
                            {d.error && (
                              <div className="text-[10px] text-red-500 font-normal flex items-center gap-1 mt-1 truncate max-w-xs" title={d.error}>
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                {d.error}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 font-normal text-zinc-500">v{d.version}</td>
                          <td className="p-3.5 font-medium">
                            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded-md text-[11px]">
                              {d.chunks_count || 0} chunks
                            </span>
                          </td>
                          <td className="p-3.5 text-[11px] text-zinc-600">
                            {d.effective_date ? (
                              <div>
                                <span className="text-zinc-800 font-medium">{d.effective_date}</span>
                                {d.expiration_date && (
                                  <span className="text-zinc-500 block">to {d.expiration_date}</span>
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
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : d.status === 'processing'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => handleReindex(d.document_id)}
                              disabled={reindexingId === d.document_id}
                              className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium rounded-lg inline-flex items-center gap-1 text-[11px] transition-colors"
                            >
                              <Zap className="w-3 h-3 text-zinc-600" />
                              {reindexingId === d.document_id ? 'Indexing...' : (d.status === 'indexed' ? 'Re-index' : 'Index Now')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="h-[78vh] bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs relative">
              <StudentChat adminToken={token} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
