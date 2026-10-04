import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';

const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export default function Auth({ onLogin, config }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isSignup) {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Signup failed');

        if (data.status === 'pending') {
          setMessage('Account created! Pending approval by university admin.');
        } else {
          setMessage('Account created & approved! Please log in.');
          setIsSignup(false);
        }
      } else {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Login failed');

        const decoded = parseJwt(data.access_token);
        const detectedRole = decoded?.role || 'student';
        onLogin(data.access_token, detectedRole);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const collegeName = config?.college_name || 'Bharti.ai';
  const logoUrl = config?.logo_url || '/logo.png';

  return (
    <div className="min-h-[100dvh] bg-[#F4F1EA] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-[#111111]">
      
      {/* Decorative Background Elements */}
      <svg className="absolute top-[12%] left-[8%] w-32 h-32 text-[#E25A3F]/20 sm:block hidden pointer-events-none" viewBox="0 0 100 100" fill="currentColor">
        <path d="M50 0 L55 40 L95 20 L65 50 L100 70 L60 65 L70 100 L45 70 L15 95 L35 60 L0 45 L40 45 Z" />
      </svg>
      <svg className="absolute bottom-[10%] right-[8%] w-48 h-48 text-[#1D2330]/10 sm:block hidden pointer-events-none" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 50 Q 30 20 50 50 T 90 50" />
        <path d="M20 70 Q 50 30 70 70 T 90 60" />
      </svg>

      {/* Brand Header */}
      <div className="text-center mb-8 relative z-10 flex flex-col items-center">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-white border-[1.5px] border-[#111111] p-2 mb-4 brutal-shadow overflow-hidden">
          <img 
            src={logoUrl} 
            alt="Bharati Vidyapeeth Logo" 
            className="w-full h-full object-contain"
            onError={(e) => { e.currentTarget.src = '/logo.png'; }}
          />
        </div>
        <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-[#111111] tracking-tight uppercase">
          {collegeName}
        </h1>
        <p className="text-xs sm:text-sm font-bold text-[#111111]/75 mt-2 uppercase tracking-widest max-w-sm text-center">
          Bharati Vidyapeeth AI Knowledge Portal
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white brutal-border p-6 sm:p-8 brutal-shadow w-full max-w-md relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 brutal-border bg-[#111111] text-white">
              Unified Campus Access
            </span>
            <h2 className="text-2xl font-heading font-bold text-[#111111] mt-3 uppercase">
              {isSignup ? 'Student Registration' : 'Account Sign In'}
            </h2>
            <p className="text-[11px] text-[#111111]/60 font-semibold mt-1">
              {isSignup ? 'Register your university credentials' : 'Your portal access is auto-detected from credentials'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 brutal-border text-red-600 font-bold text-xs uppercase tracking-wider">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-emerald-500/10 brutal-border text-emerald-700 font-bold text-xs uppercase tracking-wider">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div>
              <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-[#F4F1EA] brutal-border text-[#111111] focus:ring-0 focus:border-[#E25A3F] focus:outline-none text-base sm:text-sm min-h-[46px]"
                placeholder="Student Name"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest mb-1.5">
              University Email ID
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#F4F1EA] brutal-border text-[#111111] focus:ring-0 focus:border-[#E25A3F] focus:outline-none text-base sm:text-sm min-h-[46px]"
              placeholder="e.g. name@college.edu"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#111111]/80 uppercase tracking-widest mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#F4F1EA] brutal-border text-[#111111] focus:ring-0 focus:border-[#E25A3F] focus:outline-none text-base sm:text-sm min-h-[46px]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 sm:py-4 mt-2 text-white font-bold text-sm uppercase tracking-widest bg-[#111111] hover:bg-[#E25A3F] brutal-border brutal-shadow-active transition-colors flex items-center justify-center gap-2.5 min-h-[48px]"
          >
            {isSignup ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            {loading ? 'Authenticating...' : isSignup ? 'Submit Registration' : 'Log In to Bharti.ai'}
          </button>
        </form>

        {/* Quick Demo Credentials for Fast Testing */}
        {!isSignup && (
          <div className="mt-5 pt-3.5 border-t border-[#111111]/20">
            <span className="text-[10px] font-bold text-[#111111]/60 uppercase tracking-widest block mb-2 text-center">
              Quick Test Credentials:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('student1@college.edu');
                  setPassword('student123');
                }}
                className="py-2.5 px-2 bg-[#F4F1EA] hover:bg-[#111111] hover:text-white brutal-border text-[11px] font-bold uppercase tracking-wider transition text-center min-h-[44px] brutal-shadow-active flex items-center justify-center gap-1"
              >
                Fill Student
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@college.edu');
                  setPassword('admin123');
                }}
                className="py-2.5 px-2 bg-[#F4F1EA] hover:bg-[#111111] hover:text-white brutal-border text-[11px] font-bold uppercase tracking-wider transition text-center min-h-[44px] brutal-shadow-active flex items-center justify-center gap-1"
              >
                Fill Admin
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 text-center border-t-[1.5px] border-[#111111] pt-4">
          <button
            onClick={() => { setIsSignup(!isSignup); setError(''); setMessage(''); }}
            className="text-xs text-[#111111] hover:text-[#E25A3F] font-bold uppercase tracking-widest transition-colors min-h-[40px] flex items-center justify-center w-full"
          >
            {isSignup ? 'Already registered? Sign In' : 'New Student? Apply for Access'}
          </button>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-8 text-center text-[11px] font-bold text-[#111111]/60 uppercase tracking-widest relative z-10">
        Bharati Vidyapeeth University • Powered by Bharti.ai
      </div>
    </div>
  );
}
