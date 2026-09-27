import React, { useState, useEffect } from 'react';
import { Users, FileText, Upload, CheckCircle, XCircle, RefreshCw, Shield, Cpu, Menu, Tag, Plus, X, Search, Hash, Zap, AlertCircle } from 'lucide-react';
import StudentChat from './StudentChat';
import { CAMPUS_KEYWORDS } from '../config/keywords';

export default function AdminPanel({ token }) {
  const [activeTab, setActiveTab] = useState('users');
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
    { id: 'users', label: 'Approvals', icon: Users, count: pendingUsers.length },
    { id: 'docs', label: 'Documents', icon: FileText },
    { id: 'ai', label: 'Try AI', icon: Cpu }
  ];

  return (
    <div className="flex flex-col sm:flex-row h-full bg-[#F4F1EA] text-[#111111] overflow-hidden relative font-sans">
      
      {/* Mobile Top Navigation */}
      <div className="sm:hidden bg-white border-b-[1.5px] border-[#111111] flex overflow-x-auto no-scrollbar px-3 py-3 gap-3">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`whitespace-nowrap px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all min-h-[44px] brutal-border ${
              activeTab === item.id
                ? 'bg-[#111111] text-white brutal-shadow'
                : 'bg-[#F4F1EA] text-[#111111] hover:bg-white'
            }`}
          >
            <item.icon className="w-4 h-4" /> {item.label}
            {item.count !== undefined && (
              <span className={`px-2 py-0.5 ml-1 brutal-border ${activeTab === item.id ? 'bg-white text-[#111111]' : 'bg-white'}`}>{item.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden sm:flex w-64 bg-white border-r-[1.5px] border-[#111111] flex-col shrink-0 p-5 z-10">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="p-2 bg-[#1D2330] border-[1.5px] border-[#111111] text-white brutal-shadow">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-heading font-extrabold text-[#111111] uppercase tracking-widest">ADMIN CONSOLE</h2>
            <span className="text-[10px] text-[#111111]/60 font-bold uppercase tracking-widest block mt-1">Single-Tenant Control</span>
          </div>
        </div>

        <nav className="space-y-3 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-between transition-all min-h-[44px] brutal-border ${
                activeTab === item.id
                  ? 'bg-[#111111] text-white brutal-shadow'
                  : 'bg-white text-[#111111] hover:bg-[#F4F1EA]'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4" /> {item.label}
              </div>
              {item.count !== undefined && (
                <span className={`px-2 py-0.5 text-[10px] brutal-border ${activeTab === item.id ? 'bg-white text-[#111111]' : 'bg-[#F4F1EA]'}`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 bg-[#F4F1EA] overflow-y-auto p-4 sm:p-8 no-scrollbar relative z-0">
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
          {activeTab === 'users' && (
            <div className="bg-white brutal-border p-6 sm:p-8 brutal-shadow">
              <h2 className="text-lg font-heading font-bold text-[#111111] mb-8 flex items-center gap-2 uppercase tracking-widest">
                <Users className="w-6 h-6 text-[#1D2330]" /> Student Access Requests
              </h2>
              {pendingUsers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-[#1D2330] border-[1.5px] border-[#111111] text-white flex items-center justify-center mx-auto mb-6 brutal-shadow">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-bold text-[#111111]/70 uppercase tracking-widest">No pending student registration requests.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap brutal-border">
                    <thead className="bg-[#111111] text-white uppercase text-[10px] tracking-widest font-bold">
                      <tr>
                        <th className="p-4 border-b-[1.5px] border-r-[1.5px] border-[#111111]">Student Name</th>
                        <th className="p-4 border-b-[1.5px] border-r-[1.5px] border-[#111111]">Email</th>
                        <th className="p-4 border-b-[1.5px] border-r-[1.5px] border-[#111111]">Role</th>
                        <th className="p-4 border-b-[1.5px] border-[#111111] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-[1.5px] divide-[#111111] bg-white text-[#111111]">
                      {pendingUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-[#F4F1EA] transition-colors">
                          <td className="p-4 font-bold border-r-[1.5px] border-[#111111]">{u.full_name}</td>
                          <td className="p-4 font-medium border-r-[1.5px] border-[#111111]">{u.email}</td>
                          <td className="p-4 uppercase font-bold text-[10px] border-r-[1.5px] border-[#111111]">{u.role}</td>
                          <td className="p-4 text-right space-x-3">
                            <button
                              onClick={() => handleApprove(u.id)}
                              className="px-4 py-2 bg-white text-[#111111] hover:bg-[#1D2330] hover:text-white font-bold brutal-border inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest transition-colors min-h-[40px] brutal-shadow-active"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => handleReject(u.id)}
                              className="px-4 py-2 bg-white text-[#111111] hover:bg-[#E25A3F] hover:text-white font-bold brutal-border inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest transition-colors min-h-[40px] brutal-shadow-active"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
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
              <div className="bg-white brutal-border p-6 sm:p-8 brutal-shadow">
                <h2 className="text-lg font-heading font-bold text-[#111111] mb-8 flex items-center gap-2 uppercase tracking-widest">
                  <Upload className="w-6 h-6 text-[#1D2330]" /> Upload Institutional Document
                </h2>

                {message && (
                  <div className="mb-8 p-4 bg-[#F4F1EA] text-[#111111] font-bold uppercase tracking-widest text-xs brutal-border brutal-shadow">
                    {message}
                  </div>
                )}

                <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest mb-2">Document Title / Naming *</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. CS201 Data Structures Syllabus"
                      className="w-full px-4 py-3 bg-[#F4F1EA] brutal-border text-[#111111] focus:ring-0 focus:border-[#E25A3F] focus:outline-none min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest mb-2">Knowledge Domain *</label>
                    <select
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F4F1EA] brutal-border text-[#111111] focus:ring-0 focus:border-[#E25A3F] focus:outline-none min-h-[44px] font-bold uppercase tracking-wider text-[11px]"
                    >
                      <option value="academic">Academic (Syllabus, Regulations)</option>
                      <option value="notices">Notices (Circulars, Examination)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest">
                        Subject / Keywords
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowKeywordsPicker(!showKeywordsPicker)}
                        className="text-[10px] font-bold uppercase tracking-wider text-[#E25A3F] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        {showKeywordsPicker ? 'Hide Keywords' : '100 Keywords (+)'}
                      </button>
                    </div>
                    <input
                      type="text"
                      id="subject-input"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Web Dev, BCA Sem 1, Syllabus 2026..."
                      className="w-full px-4 py-3 bg-[#F4F1EA] brutal-border text-[#111111] focus:ring-0 focus:border-[#E25A3F] focus:outline-none min-h-[44px]"
                    />
                    
                    {/* Quick popular keyword suggestion chips */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {["BCA", "Sem 1", "Syllabus 2026", "Web Development", "Internal Exam", "Notice", "Datesheet"].map(k => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            setSubject(prev => prev ? `${prev}, ${k}` : k);
                          }}
                          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-white hover:bg-[#111111] hover:text-white brutal-border transition"
                        >
                          +{k}
                        </button>
                      ))}
                    </div>

                    {/* Expandable 100 keywords modal / drawer */}
                    {showKeywordsPicker && (
                      <div className="mt-3 p-3 bg-white brutal-border brutal-shadow max-h-48 overflow-y-auto">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#111111]/20">
                          <Search className="w-3 h-3 text-[#111111]/50" />
                          <input 
                            type="text"
                            placeholder="Search 100 campus keywords..."
                            value={keywordFilter}
                            onChange={(e) => setKeywordFilter(e.target.value)}
                            className="text-[11px] font-bold w-full outline-none bg-transparent"
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
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#F4F1EA] hover:bg-[#E25A3F] hover:text-white brutal-border transition"
                            >
                              +{k}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest mb-2">Department</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Computer Science"
                      className="w-full px-4 py-3 bg-[#F4F1EA] brutal-border text-[#111111] focus:ring-0 focus:border-[#E25A3F] focus:outline-none min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest mb-2">Semester</label>
                    <input
                      type="number"
                      id="semester-input"
                      placeholder="e.g. 3"
                      className="w-full px-4 py-3 bg-[#F4F1EA] brutal-border text-[#111111] focus:ring-0 focus:border-[#E25A3F] focus:outline-none min-h-[44px]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest mb-2">Document Type</label>
                    <select
                      id="doc-type-input"
                      className="w-full px-4 py-3 bg-[#F4F1EA] brutal-border text-[#111111] focus:ring-0 focus:border-[#E25A3F] focus:outline-none min-h-[44px] font-bold uppercase tracking-wider text-[11px]"
                    >
                      <option value="">-- Select Type (Optional) --</option>
                      <option value="syllabus">Syllabus</option>
                      <option value="notes">Notes/Study Material</option>
                      <option value="question_paper">Question Paper</option>
                      <option value="circular">Notice/Circular</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest mb-2">Source Link / Drive Link (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://docs.google.com/..."
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F4F1EA] brutal-border text-[#111111] focus:ring-0 focus:border-[#E25A3F] focus:outline-none min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest mb-2">Notice / Effective Date (Optional)</label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F4F1EA] brutal-border text-[#111111] focus:ring-0 focus:border-[#E25A3F] focus:outline-none min-h-[44px]"
                    />
                    <span className="text-[10px] text-[#111111]/60 font-semibold mt-1 block">Leave empty to auto-extract from document text</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest mb-2">Valid Until / Expiration (Optional)</label>
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F4F1EA] brutal-border text-[#111111] focus:ring-0 focus:border-[#E25A3F] focus:outline-none min-h-[44px]"
                    />
                    <span className="text-[10px] text-[#111111]/60 font-semibold mt-1 block">e.g. End of exams or academic session</span>
                  </div>

                  <div className="md:col-span-2 mt-4">
                    <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest mb-2">Select File (PDF, DOCX, TXT, JPEG, PNG) *</label>
                    <div className="border-[1.5px] border-dashed border-[#111111] bg-[#F4F1EA] p-6 sm:p-8 text-center hover:bg-[#111111]/5 transition-colors">
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png"
                        required
                        onChange={(e) => setFile(e.target.files[0])}
                        className="w-full text-xs text-[#111111] font-bold file:mr-4 file:py-3 file:px-5 file:border-[1.5px] file:border-[#111111] file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-white file:text-[#111111] hover:file:bg-[#111111] hover:file:text-white cursor-pointer transition-colors"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 pt-6">
                    <button
                      type="submit"
                      disabled={uploading}
                      className="w-full sm:w-auto px-8 py-4 bg-[#111111] text-white font-bold uppercase tracking-widest brutal-border brutal-shadow-active transition-transform min-h-[48px]"
                    >
                      {uploading ? 'Processing File...' : 'Upload & Trigger Ingestion Worker'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Status List */}
              <div className="bg-white brutal-border p-6 sm:p-8 brutal-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-lg font-heading font-bold text-[#111111] uppercase tracking-widest">Ingested Knowledge Repository</h2>
                    <p className="text-xs text-[#111111]/60 font-medium mt-1">Institutional documents indexed into Supabase vector chunks for semantic RAG.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleProcessQueue}
                      disabled={processingQueue}
                      className="px-4 py-2 bg-white text-[#111111] hover:bg-[#1D2330] hover:text-white font-bold brutal-border inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest transition-colors min-h-[40px] brutal-shadow-active"
                      title="Run all pending queue jobs"
                    >
                      <Zap className="w-3.5 h-3.5 text-[#E25A3F]" />
                      {processingQueue ? 'Processing...' : 'Process Queue'}
                    </button>
                    <button
                      onClick={fetchDocuments}
                      className="text-[#111111] bg-white brutal-border p-2.5 brutal-shadow-active transition-transform"
                      title="Refresh"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap brutal-border">
                    <thead className="bg-[#111111] text-white uppercase text-[10px] tracking-widest font-bold">
                      <tr>
                        <th className="p-4 border-b-[1.5px] border-r-[1.5px] border-[#111111]">Title</th>
                        <th className="p-4 border-b-[1.5px] border-r-[1.5px] border-[#111111]">Version</th>
                        <th className="p-4 border-b-[1.5px] border-r-[1.5px] border-[#111111]">Chunks</th>
                        <th className="p-4 border-b-[1.5px] border-r-[1.5px] border-[#111111]">Validity / Dates</th>
                        <th className="p-4 border-b-[1.5px] border-r-[1.5px] border-[#111111]">Status</th>
                        <th className="p-4 border-b-[1.5px] border-[#111111] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-[1.5px] divide-[#111111] bg-white text-[#111111]">
                      {documents.map((d) => (
                        <tr key={d.document_id} className="hover:bg-[#F4F1EA] transition-colors">
                          <td className="p-4 font-bold border-r-[1.5px] border-[#111111]">
                            <div>{d.title}</div>
                            {d.error && (
                              <div className="text-[10px] text-[#E25A3F] font-normal flex items-center gap-1 mt-1 truncate max-w-xs" title={d.error}>
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                {d.error}
                              </div>
                            )}
                          </td>
                          <td className="p-4 font-medium border-r-[1.5px] border-[#111111]">v{d.version}</td>
                          <td className="p-4 font-bold border-r-[1.5px] border-[#111111]">
                            <span className="px-2 py-0.5 bg-[#F4F1EA] brutal-border text-[10px]">
                              {d.chunks_count || 0} chunks
                            </span>
                          </td>
                          <td className="p-4 text-[10px] font-bold border-r-[1.5px] border-[#111111]">
                            {d.effective_date ? (
                              <div>
                                <span className="text-[#111111]">{d.effective_date}</span>
                                {d.expiration_date && (
                                  <span className="text-[#111111]/60 block font-normal">to {d.expiration_date}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#111111]/40 uppercase tracking-wider text-[9px]">Auto-detecting</span>
                            )}
                          </td>
                          <td className="p-4 border-r-[1.5px] border-[#111111]">
                            <span
                              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest brutal-border ${
                                d.status === 'indexed'
                                  ? 'bg-[#F4F1EA] text-[#111111]'
                                  : d.status === 'processing'
                                  ? 'bg-[#1D2330] text-white'
                                  : 'bg-[#E25A3F] text-white'
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleReindex(d.document_id)}
                              disabled={reindexingId === d.document_id}
                              className="px-3 py-1.5 bg-white text-[#111111] hover:bg-[#1D2330] hover:text-white font-bold brutal-border inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest transition-colors min-h-[34px] brutal-shadow-active"
                            >
                              <Zap className="w-3 h-3 text-[#E25A3F]" />
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
            <div className="h-[80vh] bg-white brutal-border overflow-hidden brutal-shadow relative">
              <StudentChat token={token} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
