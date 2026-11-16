import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BadriAvatar, BudhAvatar, BanterBugAvatar } from './Avatars';
import BanterBug from './BanterBug';
import PrankGadgets from './PrankGadgets';
import { sounds } from '../utils/soundEffects';
import { 
  Send, Sparkles, Volume2, VolumeX, Trash2, Copy, Check, 
  HelpCircle, Laugh, Flame, ExternalLink, ChevronDown, ChevronUp, AlertCircle,
  Lock, Shield
} from 'lucide-react';

export default function BudbakChat({ config, onOpenAdmin, adminToken, onSwitchToAdmin }) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('budbak_chat_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: `**Arrey Oye! Swagat hai Budbak.ai mein! 🎒💥**\n\nMain hoon **Badrinath (Badri)** — backbencher mastermind, aur yeh mera bhai **Budhdeb**! 🥟\n\nBolo boss, aaj kya scene hai? Koi crazy homework excuse chahiye, dhasu roast marna hai, tiffin chori ki report karni hai, ya BCA exam datesheet ka jugaad dekhna hai? Pucho jo puchna hai! *Ayee-yee!*`,
        sources: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(!sounds.isMuted());
  const [prankLabOpen, setPrankLabOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  // Sync chat history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('budbak_chat_history', JSON.stringify(messages));
    } catch (e) {}
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const toggleSound = () => {
    const isMuted = sounds.toggleMute();
    setSoundEnabled(!isMuted);
    if (!isMuted) sounds.playBoing();
  };

  const handleClearChat = () => {
    sounds.playFart();
    setMessages([
      {
        id: 'welcome_new',
        role: 'assistant',
        content: `**Naya Katta, Nayi Shuruwat! 🎒**\n\nBadri: *Chalo purana sab delete ho gaya re Budhdeb!*\nBudhdeb: *Ayee-yee! Ab fresh samosa party shuru karein?*`,
        sources: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleCopy = (id, text) => {
    sounds.playPop();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendMessage = async (overrideText) => {
    const textToSend = (overrideText || input).trim();
    if (!textToSend || loading) return;

    sounds.playPop();
    setInput('');

    const userMsg = {
      id: 'usr_' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build clean history for API
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          chat_history: historyPayload
        })
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      sounds.playTaDa();
      setMessages((prev) => [
        ...prev,
        {
          id: 'ast_' + Date.now(),
          role: 'assistant',
          content: data.content || data.answer || "Badri: *Arey Budhdeb, server se awaaz nahi aayi!*",
          sources: data.sources || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err) {
      sounds.playBoing();
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: `**Arey Baap Re! Dhamaka Ho Gaya! 💥**\n\nBudhdeb ne lagta hai network wire me samosa fasa diya: *${err.message}*`,
          sources: [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    { label: "🏃 Dog Ate Homework Excuse", query: "Badri, ek aisi dog-ate-homework excuse bata jo Dubey sir kabhi pakad na paayein!" },
    { label: "🔥 Roast My Friend", query: "Badri aur Budhdeb, mere dost pe ek mast aur spicy cartoon roast maro!" },
    { label: "🥟 ₹500 Samosa Math", query: "Budhdeb, agar mere paas ₹500 hain toh tu kitne samosa khayega?" },
    { label: "📅 BCA Datesheet Jugaad", query: "Show internal exam datesheet October 2026 for BCA semester 1" },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-comic-cream dark:bg-[#121217] relative overflow-hidden select-none sm:select-auto">
      {/* Halftone Texture Overlay */}
      <div className="absolute inset-0 comic-halftone pointer-events-none" />

      {/* Comic Header Bar */}
      <div className="relative z-10 px-4 py-3 bg-comic-yellow border-b-[3.5px] border-black flex items-center justify-between shadow-comic-sm">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <BadriAvatar size={42} isTalking={loading} className="z-10" />
            <BudhAvatar size={42} isTalking={loading} className="z-0" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl sm:text-2xl font-bangers text-black tracking-wide">
                BUDBAK.AI
              </h1>
              <span className="text-[10px] font-bangers bg-comic-pink text-white px-1.5 py-0.5 rounded border border-black uppercase tracking-wider rotate-[-2deg]">
                FUN ONLY
              </span>
            </div>
            <p className="text-[11px] font-bold text-zinc-800 -mt-1 hidden sm:block">
              {loading ? "Badri & Budh are scheming... 💭" : "Bandbudh aur Budbak Banter Bot"}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Prank Lab Button */}
          <button
            onClick={() => {
              sounds.playBoing();
              setPrankLabOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-comic-pink text-white font-bangers text-xs sm:text-sm rounded-xl border-[2.5px] border-black shadow-comic-sm hover:scale-105 active:scale-95 transition-all"
          >
            <span className="text-base">🎒</span> Prank Lab
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? "Mute Cartoon Sound Effects" : "Enable Cartoon Sound Effects"}
            className={`w-9 h-9 rounded-xl border-[2.5px] border-black flex items-center justify-center font-bold shadow-comic-sm hover:scale-105 active:scale-95 transition-all ${
              soundEnabled ? 'bg-comic-green text-black' : 'bg-zinc-300 text-zinc-600'
            }`}
          >
            {soundEnabled ? <Volume2 size={18} className="stroke-[2.5]" /> : <VolumeX size={18} className="stroke-[2.5]" />}
          </button>

          {/* Clear Chat */}
          <button
            onClick={handleClearChat}
            title="Clear Masti History"
            className="w-9 h-9 rounded-xl bg-comic-cyan border-[2.5px] border-black flex items-center justify-center text-black font-bold shadow-comic-sm hover:scale-105 active:scale-95 transition-all"
          >
            <Trash2 size={16} className="stroke-[2.5]" />
          </button>

          {/* Admin / Principal's Office */}
          {adminToken ? (
            <button
              onClick={onSwitchToAdmin}
              title="Open Principal's Office (Admin Panel)"
              className="px-2.5 py-1.5 bg-comic-green text-black font-bangers text-xs sm:text-sm rounded-xl border-[2.5px] border-black shadow-comic-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1"
            >
              <Shield size={16} /> Admin
            </button>
          ) : (
            <button
              onClick={onOpenAdmin}
              title="Principal's Office (Secret Admin Access)"
              className="px-2.5 py-1.5 bg-comic-orange text-black font-bangers text-xs sm:text-sm rounded-xl border-[2.5px] border-black shadow-comic-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1"
            >
              <Lock size={15} /> Staff Room
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 relative z-10">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-pop-in`}
          >
            {/* Sender Badge */}
            <div className="flex items-center gap-2 mb-1 px-1">
              {msg.role === 'assistant' ? (
                <>
                  <span className="text-xs font-bangers tracking-wider text-comic-orange flex items-center gap-1">
                    <Sparkles size={12} /> Badri & Budhdeb
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400">{msg.timestamp}</span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold text-zinc-400">{msg.timestamp}</span>
                  <span className="text-xs font-bangers tracking-wider text-comic-cyan">
                    You (The Boss)
                  </span>
                </>
              )}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[92%] sm:max-w-[80%] p-4 sm:p-5 rounded-2xl border-[3.5px] border-black text-sm font-comic leading-relaxed relative ${
                msg.role === 'user'
                  ? 'bg-comic-cyan text-black shadow-comic rounded-br-none'
                  : 'bg-white dark:bg-[#1e1e26] text-zinc-950 dark:text-zinc-50 shadow-comic-lg rounded-bl-none speech-tail-left'
              }`}
            >
              <div className="prose dark:prose-invert max-w-none text-sm font-comic font-medium">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>

              {/* Source Chips if documents cited */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t-[2px] border-dashed border-zinc-300 dark:border-zinc-700">
                  <div className="flex items-center gap-1 text-[11px] font-bangers text-comic-orange mb-1.5 uppercase tracking-wide">
                    📜 Verified College Evidence:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.map((s, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-yellow-100 dark:bg-yellow-950/60 text-yellow-900 dark:text-yellow-300 px-2 py-0.5 rounded-md border border-black font-bold flex items-center gap-1"
                      >
                        📄 {s.title} {s.page ? `(p. ${s.page})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Actions */}
              {msg.role === 'assistant' && (
                <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <button
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="flex items-center gap-1 text-[11px] font-bangers text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check size={12} className="text-green-600 stroke-[3]" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy Dialogue
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      sounds.playSqueak();
                      sendMessage("Arey Badri ispe ek aur dhasu roast maar!");
                    }}
                    className="text-[11px] font-bangers text-comic-pink hover:scale-105 flex items-center gap-1"
                  >
                    <Flame size={12} /> Roast More!
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Comic Indicator */}
        {loading && (
          <div className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border-[3px] border-black rounded-2xl shadow-comic max-w-xs animate-pop-in">
            <BadriAvatar size={36} isTalking={true} className="animate-jiggle" />
            <div>
              <p className="text-xs font-bangers text-comic-orange tracking-wide">
                Badri & Budhdeb are cooking...
              </p>
              <div className="flex gap-1.5 mt-1">
                <span className="w-2.5 h-2.5 bg-comic-yellow border border-black rounded-full animate-bounce" />
                <span className="w-2.5 h-2.5 bg-comic-pink border border-black rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-2.5 h-2.5 bg-comic-green border border-black rounded-full animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Carousel */}
      <div className="px-4 py-2 border-t-[2.5px] border-black bg-white dark:bg-zinc-900 relative z-10 overflow-x-auto no-scrollbar flex gap-2">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => sendMessage(p.query)}
            className="whitespace-nowrap px-3 py-1.5 rounded-xl border-[2.5px] border-black bg-comic-yellow hover:bg-yellow-400 text-black font-bangers text-xs shadow-comic-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Sparkles size={12} className="text-comic-pink" />
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-comic-cream dark:bg-[#121217] border-t-[3.5px] border-black relative z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex items-center gap-2 max-w-4xl mx-auto"
        >
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything... roasts, excuses, samosas, exam timetable!"
              className="w-full px-4 py-3.5 pr-10 rounded-2xl border-[3.5px] border-black bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 font-comic font-bold text-sm sm:text-base outline-none shadow-comic focus:bg-yellow-50 dark:focus:bg-zinc-700 transition-colors placeholder:text-zinc-400"
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-5 py-3.5 bg-comic-pink hover:bg-pink-600 disabled:opacity-50 text-white font-bangers text-base rounded-2xl border-[3.5px] border-black shadow-comic hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <span>SEND</span>
            <Send size={16} className="stroke-[3]" />
          </button>
        </form>

        <p className="text-[10px] text-center text-zinc-500 font-bold mt-2">
          Budbak.ai is built for pure fun & humor. Powered by Bandbudh & Budbak wit • Created by Vicky Sahu (Maithil Studios)
        </p>
      </div>

      {/* Interactive Mascot BanterBug */}
      <BanterBug onInjectPrompt={(q) => sendMessage(q)} />

      {/* Prank Lab Modal */}
      <PrankGadgets
        isOpen={prankLabOpen}
        onClose={() => setPrankLabOpen(false)}
        onSendToChat={(msg) => sendMessage(msg)}
      />
    </div>
  );
}
