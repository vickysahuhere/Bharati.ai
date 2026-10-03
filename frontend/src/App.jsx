import React, { useState, useEffect } from 'react';
import StudentChat from './components/StudentChat';
import AdminPanel from './components/AdminPanel';
import { Shield, MessageSquare, Settings as SettingsIcon, X, LogIn, LogOut, CheckCircle2, AlertCircle, Info, Trash2, Bell } from 'lucide-react';

const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export default function App() {
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('camp_ai_admin_token') || null);
  const [adminEmail, setAdminEmail] = useState('');
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem('camp_ai_view');
    const token = localStorage.getItem('camp_ai_admin_token');
    return token && saved === 'admin' ? 'admin' : 'student';
  });

  const [config, setConfig] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);

  // Admin login form inside Settings
  const [loginEmail, setLoginEmail] = useState('admin@college.edu');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [clearSuccess, setClearSuccess] = useState('');

  // Fetch college configuration
  useEffect(() => {
    fetch('/api/public/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(console.error);
  }, []);

  // Sync token state & parse admin email
  useEffect(() => {
    if (adminToken) {
      const decoded = parseJwt(adminToken);
      if (decoded && decoded.role === 'admin') {
        setAdminEmail(decoded.sub || 'Administrator');
      } else {
        // Token expired or invalid
        handleAdminLogout();
      }
    } else {
      setAdminEmail('');
      if (view === 'admin') {
        setView('student');
        localStorage.setItem('camp_ai_view', 'student');
      }
    }
  }, [adminToken]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');
    setLoginLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', loginEmail.trim());
      formData.append('password', loginPassword);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed. Please check your credentials.');
      }

      const decoded = parseJwt(data.access_token);
      if (decoded?.role !== 'admin') {
        throw new Error('Access denied: Your account is not authorized as an administrator.');
      }

      // Successful admin login
      localStorage.setItem('camp_ai_admin_token', data.access_token);
      localStorage.setItem('camp_ai_view', 'admin');
      setAdminToken(data.access_token);
      setAdminEmail(decoded.sub || 'Administrator');
      setView('admin');
      setLoginSuccess('Logged in successfully! Switched to Admin Dashboard.');
      setTimeout(() => {
        setSettingsOpen(false);
        setLoginSuccess('');
      }, 1000);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('camp_ai_admin_token');
    localStorage.removeItem('camp_ai_view');
    setAdminToken(null);
    setAdminEmail('');
    setView('student');
    setLoginSuccess('Signed out of admin account.');
    setTimeout(() => setLoginSuccess(''), 2000);
  };

  const toggleView = () => {
    if (!adminToken) return;
    const nextView = view === 'student' ? 'admin' : 'student';
    setView(nextView);
    localStorage.setItem('camp_ai_view', nextView);
  };

  const handleClearChatHistory = () => {
    localStorage.removeItem('camp_ai_threads');
    localStorage.removeItem('camp_ai_active_thread_id');
    window.dispatchEvent(new Event('camp_ai_clear_history'));
    setClearSuccess('Chat history cleared successfully.');
    setTimeout(() => setClearSuccess(''), 2500);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#fafafa] overflow-hidden font-sans text-zinc-900 select-none sm:select-auto">
      {/* Minimalist Top Navigation Header */}
      <header className="h-14 sm:h-16 shrink-0 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 z-40 px-3 sm:px-6 flex items-center justify-between transition-colors">
        {/* College Brand Block */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 border border-zinc-200/90 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-xs">
            <img
              src={config?.logo_url || '/logo.png'}
              alt="Bharti.ai"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = '/logo.png';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-zinc-900 text-sm sm:text-base tracking-tight leading-none">
                {config?.college_name || 'Bharti.ai'}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live RAG
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">
              {view === 'admin' ? '🛡️ Administrator Control Panel' : 'Official Student & Campus Assistant'}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notice Board Button */}
          <button
            onClick={() => setNoticesOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/60 flex items-center gap-1.5 transition-all shadow-xs min-h-[36px]"
            title="View College Notices & Circulars"
          >
            <Bell className="w-3.5 h-3.5 text-zinc-600" />
            <span className="hidden sm:inline">Notice Board</span>
          </button>

          {/* Admin Switch Toggle (Visible only if Admin is logged in) */}
          {adminToken && (
            <button
              onClick={toggleView}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs min-h-[36px] ${
                view === 'admin'
                  ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
              title={view === 'admin' ? 'Back to Student Chat' : 'Open Admin Panel'}
            >
              {view === 'admin' ? (
                <>
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Student Chat</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Admin Panel</span>
                </>
              )}
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="Settings & Admin Access"
            aria-label="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {view === 'admin' && adminToken ? (
          <AdminPanel token={adminToken} onSwitchToChat={() => setView('student')} />
        ) : (
          <StudentChat
            adminToken={adminToken}
            config={config}
            noticesOpen={noticesOpen}
            setNoticesOpen={setNoticesOpen}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </main>

      {/* Minimalist Settings & Admin Login Modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
                  <SettingsIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 text-sm">Settings & Access</h3>
                  <p className="text-[11px] text-zinc-500">System preferences and administration</p>
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors"
                aria-label="Close settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 space-y-6 overflow-y-auto no-scrollbar">
              {/* Section 1: System Information */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                  System Overview
                </span>
                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Institution:</span>
                    <span className="font-medium text-zinc-800">{config?.college_name || 'Bharti Vidyapeeth'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">RAG Vector Engine:</span>
                    <span className="font-medium text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Gemini 1.5 Flash + Supabase
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Visitor Mode:</span>
                    <span className="font-medium text-zinc-700">Open Public Access (No Login Required)</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Local Storage & Privacy */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                  Local Data & Privacy
                </span>
                <div className="p-3.5 rounded-xl border border-zinc-200/80 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-zinc-800">Clear Local Conversations</h4>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Deletes all saved chat threads and history from this device.
                    </p>
                  </div>
                  <button
                    onClick={handleClearChatHistory}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200/60 rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>
                {clearSuccess && (
                  <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {clearSuccess}
                  </p>
                )}
              </div>

              {/* Section 3: Administrator Access */}
              <div className="space-y-3 pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                    Institutional Administration
                  </span>
                  {adminToken && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Shield className="w-3 h-3 text-emerald-600" /> Active Admin
                    </span>
                  )}
                </div>

                {adminToken ? (
                  <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center font-semibold text-xs text-zinc-700">
                        {adminEmail.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-zinc-900 truncate">{adminEmail}</div>
                        <div className="text-[11px] text-zinc-500">Administrator Privileges Enabled</div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          setView('admin');
                          localStorage.setItem('camp_ai_view', 'admin');
                          setSettingsOpen(false);
                        }}
                        className="flex-1 py-2 px-3 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Shield className="w-3.5 h-3.5" /> Go to Admin Panel
                      </button>
                      <button
                        onClick={handleAdminLogout}
                        className="py-2 px-3 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAdminLogin} className="space-y-3">
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 text-[11px] text-zinc-600 flex items-start gap-2">
                      <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                      <span>
                        Students & parents do not need to sign in. Admin login is strictly for document ingestion and database management.
                      </span>
                    </div>

                    {loginError && (
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{loginError}</span>
                      </div>
                    )}

                    {loginSuccess && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{loginSuccess}</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-700">Admin Email</label>
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="admin@college.edu"
                        className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-700">Password</label>
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full py-2.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
                    >
                      {loginLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Authenticating...
                        </>
                      ) : (
                        <>
                          <LogIn className="w-3.5 h-3.5" /> Sign In as Admin
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
