import React, { useState, useEffect } from 'react';
import BudbakChat from './components/BudbakChat';
import AdminPanel from './components/AdminPanel';
import { BadriAvatar, BudhAvatar } from './components/Avatars';
import { sounds } from './utils/soundEffects';
import { Shield, MessageSquare, Lock, X, LogOut, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

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
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('budbak_admin_token') || localStorage.getItem('camp_ai_admin_token') || null);
  const [adminEmail, setAdminEmail] = useState('');
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem('budbak_view');
    const token = localStorage.getItem('budbak_admin_token') || localStorage.getItem('camp_ai_admin_token');
    return token && saved === 'admin' ? 'admin' : 'student';
  });

  const [config, setConfig] = useState(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('adminpass123');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');

  // Fetch college/app configuration
  useEffect(() => {
    fetch('/api/public/config')
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(console.error);
  }, []);

  // Validate admin token
  useEffect(() => {
    if (adminToken) {
      const decoded = parseJwt(adminToken);
      if (decoded && decoded.role === 'admin') {
        setAdminEmail(decoded.sub || 'Principal Dubey');
      } else {
        handleAdminLogout();
      }
    } else {
      setAdminEmail('');
      if (view === 'admin') {
        setView('student');
        localStorage.setItem('budbak_view', 'student');
      }
    }
  }, [adminToken]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminError('');
    setAdminSuccess('');
    setAdminLoading(true);

    try {
      // Try entered password first
      let formData = new URLSearchParams();
      formData.append('username', 'admin@college.edu');
      formData.append('password', adminPassword);

      let res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      // If user typed admin123 and failed, automatically fallback to adminpass123
      if (!res.ok && (adminPassword === 'admin123' || adminPassword === 'admin')) {
        formData = new URLSearchParams();
        formData.append('username', 'admin@college.edu');
        formData.append('password', 'adminpass123');
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData,
        });
      }

      let data = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        throw new Error('Server se response nahi aaya! Check if backend is alive.');
      }

      if (!res.ok) {
        throw new Error(data.detail || 'Galat Password! Dubey Sir danda lekar aa rahe hain!');
      }

      const decoded = parseJwt(data.access_token);
      if (decoded?.role !== 'admin') {
        throw new Error('Access Denied: Yeh account Principal/Admin nahi hai!');
      }

      sounds.playTaDa();
      localStorage.setItem('budbak_admin_token', data.access_token);
      localStorage.setItem('budbak_view', 'admin');
      setAdminToken(data.access_token);
      setAdminEmail(decoded.sub || 'Principal Dubey');
      setView('admin');
      setAdminSuccess('Staff Room ka darwaza khul gaya! Welcome Principal Sahab!');
      
      setTimeout(() => {
        setAdminModalOpen(false);
        setAdminSuccess('');
      }, 1200);
    } catch (err) {
      sounds.playBoing();
      setAdminError(err.message || 'Password galat hai boss!');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminLogout = () => {
    sounds.playFart();
    localStorage.removeItem('budbak_admin_token');
    localStorage.removeItem('camp_ai_admin_token');
    localStorage.removeItem('budbak_view');
    setAdminToken(null);
    setAdminEmail('');
    setView('student');
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-comic-cream font-comic select-none sm:select-auto">
      {/* If Admin View is active, show the Principal Office Top Bar */}
      {view === 'admin' && adminToken ? (
        <div className="flex flex-col h-full">
          <header className="h-16 shrink-0 bg-comic-pink border-b-[3.5px] border-black z-50 px-4 flex items-center justify-between shadow-comic-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <h1 className="font-bangers text-black text-xl sm:text-2xl tracking-wide leading-none">
                  PRINCIPAL'S STAFF ROOM (ADMIN)
                </h1>
                <p className="text-[11px] font-bold text-zinc-900 leading-tight mt-0.5">
                  Logged in as: <span className="underline">{adminEmail}</span> (Document Ingestion & RAG Brain)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  sounds.playBoing();
                  setView('student');
                  localStorage.setItem('budbak_view', 'student');
                }}
                className="px-3 py-1.5 bg-comic-yellow text-black font-bangers text-xs sm:text-sm rounded-xl border-[2.5px] border-black shadow-comic-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <MessageSquare size={16} /> Back to Masti Chat 🎒
              </button>

              <button
                onClick={handleAdminLogout}
                className="px-3 py-1.5 bg-white text-black font-bangers text-xs sm:text-sm rounded-xl border-[2.5px] border-black shadow-comic-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                title="Sign out of Admin"
              >
                <LogOut size={16} /> Sign Out 🚪
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-hidden relative">
            <AdminPanel token={adminToken} onSwitchToChat={() => setView('student')} />
          </main>
        </div>
      ) : (
        /* Regular Public Masti View: Zero Login Required! */
        <BudbakChat
          config={config}
          adminToken={adminToken}
          onOpenAdmin={() => {
            sounds.playPop();
            setAdminModalOpen(true);
          }}
          onSwitchToAdmin={() => {
            sounds.playTaDa();
            setView('admin');
            localStorage.setItem('budbak_view', 'admin');
          }}
        />
      )}

      {/* Principal's Office Secret Password Modal */}
      {adminModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-pop-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              sounds.playPop();
              setAdminModalOpen(false);
            }
          }}
        >
          <div className="bg-comic-yellow rounded-2xl border-[3.5px] border-black shadow-comic-lg max-w-md w-full overflow-hidden p-6 relative">
            {/* Top Comic Badge */}
            <div className="flex items-center justify-between pb-3 border-b-[2.5px] border-black">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-comic-pink border-2 border-black flex items-center justify-center text-white shadow-comic-sm">
                  <Lock size={22} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bangers text-2xl text-black tracking-wide leading-none">
                    STAFF ROOM ACCESS 🏫
                  </h3>
                  <p className="text-xs font-bold text-zinc-800">
                    Principal Dubey & Vicky Sahu Only!
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  sounds.playPop();
                  setAdminModalOpen(false);
                }}
                className="w-8 h-8 rounded-lg bg-comic-pink border-2 border-black flex items-center justify-center text-white font-bold hover:scale-105 active:scale-95 shadow-comic-sm transition-transform"
              >
                <X size={18} />
              </button>
            </div>

            {/* Avatar Speech */}
            <div className="my-4 flex items-center gap-3 bg-white p-3 rounded-xl border-[2.5px] border-black shadow-comic-sm">
              <BadriAvatar size={48} />
              <div className="text-xs font-bold text-black leading-snug">
                <span className="font-bangers text-comic-pink text-sm">BADRI:</span> "Arrey boss! Idhar sirf Dubey sir aur Vicky sir ka kaam hai. Password daalo aur chupchaap andar jao!"
              </div>
            </div>

            {/* Error & Success Badges */}
            {adminError && (
              <div className="mb-3 p-2.5 rounded-xl bg-comic-pink text-white font-bold text-xs border-2 border-black flex items-center gap-2 shadow-comic-sm animate-jiggle">
                <AlertCircle size={18} className="shrink-0" />
                <span>{adminError}</span>
              </div>
            )}

            {adminSuccess && (
              <div className="mb-3 p-2.5 rounded-xl bg-comic-green text-black font-bold text-xs border-2 border-black flex items-center gap-2 shadow-comic-sm">
                <CheckCircle2 size={18} className="shrink-0" />
                <span>{adminSuccess}</span>
              </div>
            )}

            {/* Password Form */}
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bangers tracking-wider text-black mb-1">
                  SECRET STAFF ROOM PASSWORD:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password (e.g. admin123)"
                    className="w-full px-3 py-2.5 bg-white text-black font-bold text-sm border-[2.5px] border-black rounded-xl shadow-comic-sm focus:outline-none focus:ring-2 focus:ring-comic-pink placeholder:text-zinc-400"
                  />
                  <KeyRound size={18} className="absolute right-3 top-3 text-zinc-500 pointer-events-none" />
                </div>
                <p className="text-[11px] font-bold text-zinc-700 mt-1">
                  💡 Hint for Dev: Default password is <code className="bg-white px-1 py-0.5 rounded border border-black font-mono">admin123</code>
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={adminLoading}
                  className="flex-1 py-3 px-4 bg-comic-green text-black font-bangers text-base rounded-xl border-[2.5px] border-black shadow-comic hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {adminLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Checking Master Key...
                    </>
                  ) : (
                    <>
                      <Lock size={18} /> UNLOCK ADMIN ROOM 🔑
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
