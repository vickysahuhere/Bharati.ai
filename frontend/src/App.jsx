import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import StudentChat from './components/StudentChat';
import AdminPanel from './components/AdminPanel';
import { LogOut, Shield, MessageSquare, GraduationCap, Menu, X } from 'lucide-react';

const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('camp_ai_token') || null);
  const [config, setConfig] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [view, setView] = useState('student'); // 'student' or 'admin'
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/public/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(console.error);
  }, []);

  // Update role and view whenever token changes
  useEffect(() => {
    if (token) {
      const decoded = parseJwt(token);
      if (decoded && decoded.role) {
        setUserRole(decoded.role);
        if (decoded.role === 'admin') {
          const savedView = localStorage.getItem('camp_ai_view');
          setView(savedView || 'admin');
        } else {
          // Force student view for non-admins
          setView('student');
          localStorage.removeItem('camp_ai_view');
        }
      } else {
        handleLogout(); // invalid token
      }
    }
  }, [token]);

  const handleLogin = (newToken, detectedRole) => {
    localStorage.setItem('camp_ai_token', newToken);
    const targetRole = detectedRole || 'student';
    setUserRole(targetRole);
    if (targetRole === 'admin') {
      localStorage.setItem('camp_ai_view', 'admin');
      setView('admin');
    } else {
      localStorage.removeItem('camp_ai_view');
      setView('student');
    }
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('camp_ai_token');
    localStorage.removeItem('camp_ai_view');
    setToken(null);
    setUserRole(null);
  };

  if (!token || !userRole) {
    return <Auth onLogin={handleLogin} config={config} />;
  }

  const toggleView = () => {
    if (userRole !== 'admin') return; // Security check
    
    const nextView = view === 'student' ? 'admin' : 'student';
    setView(nextView);
    localStorage.setItem('camp_ai_view', nextView);
    setMenuOpen(false);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#F4F1EA] overflow-hidden font-sans relative text-[#111111]">
      
      {/* Brutalist Top Navbar */}
      <header className="h-16 sm:h-20 fixed top-0 w-full bg-[#F4F1EA] border-b-[1.5px] border-[#111111] flex z-50 transition-all duration-300">
        
        {/* Logo & College Brand Block */}
        <div className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-6 border-r-[1.5px] border-[#111111] bg-white max-w-[75%] sm:max-w-none sm:min-w-[280px]">
          <div className="p-1 bg-white border-[1.5px] border-[#111111] brutal-shadow flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 overflow-hidden shrink-0">
            <img 
              src={config?.logo_url || "/logo.png"} 
              alt="Bharti.ai" 
              className="w-full h-full object-contain"
              onError={(e) => { e.currentTarget.src = '/logo.png'; }}
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading font-extrabold text-[#111111] text-sm sm:text-xl tracking-tight leading-none uppercase truncate">
              {config?.college_name || 'Bharti.ai'}
            </h1>
            <span className="text-[9px] sm:text-[10px] text-[#111111]/70 font-bold uppercase tracking-widest mt-0.5 sm:mt-1 block truncate">
              {view === 'admin' ? '🛡️ Admin Console' : '🎓 Student Portal'}
            </span>
          </div>
        </div>

        {/* Desktop Navigation Block */}
        <div className="hidden sm:flex flex-1 items-center justify-end px-6 bg-[#F4F1EA]">
          <div className="flex items-center gap-4">
            
            {/* ONLY Admins get the switch button */}
            {userRole === 'admin' && (
              <button
                onClick={toggleView}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest bg-white brutal-border brutal-shadow-hover text-[#111111] flex items-center gap-2 transition-transform duration-200 min-h-[44px]"
              >
                {view === 'student' ? (
                  <>
                    <Shield className="w-4 h-4 text-[#1D2330]" /> Switch to Admin
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 text-[#1D2330]" /> Switch to Student
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="px-4 py-2.5 bg-[#F4F1EA] brutal-border brutal-shadow-hover text-[#111111] flex items-center justify-center transition-transform duration-200 min-h-[44px]"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="flex-1 flex sm:hidden items-center justify-end px-3 bg-[#F4F1EA]">
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 min-h-[44px] min-w-[44px] flex justify-center items-center text-[#111111] bg-white brutal-border brutal-shadow-active transition-transform"
            aria-label="Toggle navigation menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Backdrop Overlay - Tap outside to dismiss menu */}
      {menuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 sm:hidden animate-in fade-in duration-150"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile Navigation Dropdown Sheet */}
      {menuOpen && (
        <div className="absolute top-16 left-0 w-full bg-[#F4F1EA] border-b-[2px] border-[#111111] z-50 sm:hidden flex flex-col p-5 gap-3.5 brutal-shadow animate-in slide-in-from-top-2 duration-150">
          
          {/* User info banner */}
          <div className="p-3 bg-white brutal-border text-xs flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#111111]/60">Logged in as:</span>
            <span className="font-bold text-[#111111] uppercase tracking-wider text-[11px] truncate max-w-[200px]">
              {parseJwt(token)?.sub || 'User'}
            </span>
          </div>

          {userRole === 'admin' && (
            <button
              onClick={toggleView}
              className="w-full px-4 py-3.5 text-xs font-bold uppercase tracking-widest bg-white brutal-border brutal-shadow-active text-[#111111] flex items-center justify-center gap-2 transition-transform min-h-[46px]"
            >
               {view === 'student' ? (
                <>
                  <Shield className="w-4 h-4 text-[#1D2330]" /> Switch to Admin Console
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 text-[#1D2330]" /> Switch to Student Portal
                </>
              )}
            </button>
          )}

          <button
            onClick={() => { setMenuOpen(false); handleLogout(); }}
            className="w-full px-4 py-3.5 text-xs font-bold uppercase tracking-widest bg-[#E25A3F] brutal-border brutal-shadow-active text-white flex items-center justify-center gap-2 transition-transform min-h-[46px]"
          >
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </div>
      )}

      {/* Main Panel Content */}
      <main className="flex-1 relative overflow-hidden mt-16 sm:mt-20 z-10 flex flex-col h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)]">
        {view === 'student' ? (
          <StudentChat token={token} config={config} />
        ) : (
          <AdminPanel token={token} />
        )}
      </main>
    </div>
  );
}
