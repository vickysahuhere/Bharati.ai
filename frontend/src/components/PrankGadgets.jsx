import React, { useState } from 'react';
import { sounds } from '../utils/soundEffects';
import { X, Sparkles, Volume2, ShieldAlert, Zap, Copy, Check, MessageSquare, Calculator } from 'lucide-react';

const CRAZY_EXCUSES = [
  "Sir, kal raat ko aliens aaye the aur unhone bola 'Homework de do varna Mars le jayenge', toh maine de diya! 🛸",
  "Mera kutta homework nahi khaya sir, mera homework hi kutte ko kaat liya! 🐕",
  "Sir, kal maine padhai shuru ki thi, par itna tez gyaan nikla ki notebook me aag lag gayi! 🔥",
  "Dubey sir ne sapne me aake bola tha 'Aaj aaram karo beta', toh maine aagya ka paalan kiya! 😴",
  "Mummy ne homework wale page pe samosa rakh ke serve kar diya, pura oil lag gaya sir! 🥟",
  "Sir gravity itni kamzor ho gayi thi ki mera pen hawa me udne laga, likh hi nahi paya! 🪐",
  "Vicky bhai ne bola tha 'Digital India me pen-paper chhoro, AI se masti karo', toh apun ne chhor diya! 💻"
];

export default function PrankGadgets({ isOpen, onClose, onSendToChat }) {
  const [activeTab, setActiveTab] = useState('excuses');
  const [currentExcuse, setCurrentExcuse] = useState(CRAZY_EXCUSES[0]);
  const [roastTarget, setRoastTarget] = useState('');
  const [moneyAmount, setMoneyAmount] = useState(100);
  const [copied, setCopied] = useState(false);
  const [fakeStudyMode, setFakeStudyMode] = useState(false);

  if (!isOpen) return null;

  // Emergency Panic Disguise Screen
  if (fakeStudyMode) {
    return (
      <div className="fixed inset-0 z-50 bg-white text-zinc-800 p-8 font-serif select-none overflow-y-auto">
        <div className="max-w-2xl mx-auto border-b pb-4 mb-6">
          <div className="flex justify-between items-center text-xs text-zinc-500 uppercase">
            <span>Department of Mathematics</span>
            <span>Course Code: MATH-401</span>
          </div>
          <h1 className="text-2xl font-bold mt-2">Advanced Differential Equations & Linear Algebra</h1>
          <p className="text-sm text-zinc-600">Theorem 4.12: Integration by Parts in Multivariable Calculus</p>
        </div>
        <div className="space-y-4 max-w-2xl mx-auto text-sm leading-relaxed text-zinc-700">
          <p>
            Let f: U ⊆ ℝⁿ → ℝ be a continuously differentiable scalar field. 
            The divergence theorem establishes the relationship between the flux of a vector field through a closed surface 
            to the volume integral of the divergence over the region enclosed.
          </p>
          <div className="p-4 bg-zinc-100 rounded border font-mono text-center my-4">
            {"∬_∂V F · dS = ∭_V (∇ · F) dV"}
          </div>
          <p>
            Evaluating the boundary conditions where λ → ∞ yields uniform convergence across all eigenvalues.
          </p>
        </div>

        <div className="fixed bottom-6 right-6">
          <button
            onClick={() => setFakeStudyMode(false)}
            className="px-4 py-2 bg-comic-yellow border-2 border-black rounded-lg text-xs font-bold font-bangers tracking-wider shadow-comic hover:bg-yellow-400"
          >
            🚨 Safe! Return to Budbak.ai
          </button>
        </div>
      </div>
    );
  }

  const handleNextExcuse = () => {
    sounds.playBoing();
    const filtered = CRAZY_EXCUSES.filter((e) => e !== currentExcuse);
    const next = filtered[Math.floor(Math.random() * filtered.length)];
    setCurrentExcuse(next);
    setCopied(false);
  };

  const handleCopy = (text) => {
    sounds.playPop();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const samosaCount = Math.floor(moneyAmount / 15);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-pop-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border-[4px] border-black rounded-3xl shadow-comic-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-comic-yellow border-b-[3.5px] border-black flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-bounce-comic">🎒</span>
            <h2 className="text-xl font-bangers tracking-wider text-black">Backbencher Prank Lab</h2>
          </div>
          <button
            onClick={() => {
              sounds.playPop();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-comic-pink border-2 border-black flex items-center justify-center font-bold hover:scale-110 active:scale-95 shadow-comic-sm"
          >
            <X size={16} className="stroke-[3]" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b-[3px] border-black bg-comic-cream dark:bg-zinc-800 text-xs font-bangers tracking-wide overflow-x-auto">
          {[
            { id: 'excuses', label: '🏃 Excuse Gen', sound: () => sounds.playBoing() },
            { id: 'roasts', label: '🔥 Roast Club', sound: () => sounds.playWhistle() },
            { id: 'samosa', label: '🥟 Samosa Meter', sound: () => sounds.playPop() },
            { id: 'soundboard', label: '📢 SFX Box', sound: () => sounds.playTrumpet() },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                tab.sound();
                setActiveTab(tab.id);
              }}
              className={`flex-1 py-2.5 px-3 border-r-[2px] last:border-r-0 border-black whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-comic-pink text-white font-bold shadow-inner'
                  : 'hover:bg-yellow-200 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* TAB 1: CRAZY EXCUSES */}
          {activeTab === 'excuses' && (
            <div className="space-y-4">
              <div className="p-4 bg-comic-yellow/30 dark:bg-zinc-800 border-[3px] border-black rounded-2xl relative shadow-comic">
                <span className="text-[10px] font-bangers bg-comic-orange text-white px-2 py-0.5 rounded border border-black uppercase tracking-wider mb-2 inline-block">
                  Teacher Bunk Excuse #42
                </span>
                <p className="font-comic text-base font-bold text-zinc-900 dark:text-zinc-100 leading-relaxed">
                  "{currentExcuse}"
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleNextExcuse}
                  className="flex-1 py-2.5 bg-comic-green text-black font-bangers text-sm rounded-xl border-[3px] border-black shadow-comic-sm hover:scale-[1.02] active:scale-[0.98]"
                >
                  🎲 Another Excuse!
                </button>
                <button
                  onClick={() => handleCopy(currentExcuse)}
                  className="px-3 py-2.5 bg-comic-cyan border-[3px] border-black rounded-xl shadow-comic-sm hover:scale-105 active:scale-95 flex items-center justify-center text-black"
                  title="Copy Excuse"
                >
                  {copied ? <Check size={18} className="stroke-[3]" /> : <Copy size={18} className="stroke-[2.5]" />}
                </button>
                {onSendToChat && (
                  <button
                    onClick={() => {
                      sounds.playTrumpet();
                      onSendToChat(`Badri, yeh excuse check kar ke bata kaisa hai: "${currentExcuse}"`);
                      onClose();
                    }}
                    className="px-3 py-2.5 bg-comic-pink text-white border-[3px] border-black rounded-xl shadow-comic-sm hover:scale-105 active:scale-95 flex items-center justify-center"
                    title="Send to Badri & Budh"
                  >
                    <MessageSquare size={18} className="stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ROAST CLUB */}
          {activeTab === 'roasts' && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                Enter your friend's name, and Badri & Budhdeb will cook up a funny, non-toxic school roast!
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Friend's Name (e.g. Ramesh, Jeeva, Dubey sir)..."
                  value={roastTarget}
                  onChange={(e) => setRoastTarget(e.target.value)}
                  className="flex-1 px-3 py-2 border-[3px] border-black rounded-xl font-bold text-sm bg-white dark:bg-zinc-800 text-black dark:text-white outline-none focus:bg-yellow-50 shadow-comic-sm"
                />
              </div>
              <button
                disabled={!roastTarget.trim()}
                onClick={() => {
                  sounds.playFart();
                  if (onSendToChat && roastTarget.trim()) {
                    onSendToChat(`Badri aur Budhdeb, mere dost "${roastTarget.trim()}" pe ek ekdum dhasu aur funny cartoon roast maro!`);
                    onClose();
                  }
                }}
                className="w-full py-2.5 bg-comic-orange text-white font-bangers text-base rounded-xl border-[3px] border-black shadow-comic disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
              >
                🔥 Cook The Roast Now!
              </button>
            </div>
          )}

          {/* TAB 3: SAMOSA ECONOMICS */}
          {activeTab === 'samosa' && (
            <div className="space-y-4 text-center">
              <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                Budhdeb's Rule: Everything in the universe must be measured in hot ₹15 Samosas!
              </p>
              <div className="p-4 bg-comic-yellow border-[3.5px] border-black rounded-2xl shadow-comic flex items-center justify-around">
                <div>
                  <span className="text-xs font-bold text-zinc-700">Enter Cash:</span>
                  <div className="flex items-center justify-center gap-1 font-bangers text-2xl text-black">
                    <span>₹</span>
                    <input
                      type="number"
                      value={moneyAmount}
                      onChange={(e) => setMoneyAmount(Math.max(0, Number(e.target.value)))}
                      className="w-24 text-center bg-white border-2 border-black rounded-lg font-bold text-lg px-1"
                    />
                  </div>
                </div>
                <div className="text-3xl font-bangers text-comic-pink">=</div>
                <div>
                  <span className="text-xs font-bold text-zinc-700">Budhdeb Gets:</span>
                  <div className="font-bangers text-3xl text-comic-orange animate-bounce-comic">
                    {samosaCount} 🥟
                  </div>
                  <span className="text-[10px] font-bold text-black">Crispy Samosas!</span>
                </div>
              </div>
              <button
                onClick={() => {
                  sounds.playTrumpet();
                  if (onSendToChat) {
                    onSendToChat(`Budhdeb, agar mere paas ₹${moneyAmount} hain toh tu kitna samosa khayega aur kitna party dega?`);
                    onClose();
                  }
                }}
                className="w-full py-2 bg-comic-cyan text-black font-bangers text-sm rounded-xl border-[3px] border-black shadow-comic-sm hover:scale-[1.02]"
              >
                💬 Ask Budhdeb About This Deal!
              </button>
            </div>
          )}

          {/* TAB 4: SOUNDBOARD */}
          {activeTab === 'soundboard' && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Spring Boing', emoji: '🌀', action: () => sounds.playBoing(), bg: 'bg-comic-yellow' },
                { name: 'Rubber Squeak', emoji: '🦆', action: () => sounds.playSqueak(), bg: 'bg-comic-pink text-white' },
                { name: 'Slide Whistle', emoji: '🚀', action: () => sounds.playWhistle(), bg: 'bg-comic-cyan' },
                { name: 'Prank Fart', emoji: '💨', action: () => sounds.playFart(), bg: 'bg-comic-green' },
                { name: 'Recess Bell', emoji: '🔔', action: () => sounds.playSchoolBell(), bg: 'bg-comic-orange text-white' },
                { name: 'Victory Ta-Da', emoji: '🎺', action: () => sounds.playTaDa(), bg: 'bg-comic-purple text-white' },
              ].map((sfx, idx) => (
                <button
                  key={idx}
                  onClick={sfx.action}
                  className={`p-3 rounded-2xl border-[3px] border-black font-bangers text-sm flex items-center justify-center gap-2 shadow-comic-sm hover:scale-105 active:scale-95 transition-all ${sfx.bg}`}
                >
                  <span className="text-xl">{sfx.emoji}</span> {sfx.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Fake Study Emergency Button */}
        <div className="p-3 bg-comic-cream dark:bg-zinc-800 border-t-[3px] border-black flex justify-between items-center">
          <button
            onClick={() => {
              sounds.playWhistle();
              setFakeStudyMode(true);
            }}
            className="flex items-center gap-1.5 text-xs font-bangers bg-red-500 text-white px-3 py-1.5 rounded-xl border-2 border-black shadow-comic-sm hover:scale-105 active:scale-95"
            title="Fake Math Page if parents or teachers walk in!"
          >
            <ShieldAlert size={14} /> Teacher Alert Panic Button!
          </button>
          <span className="text-[10px] font-bold text-zinc-500">Budbak.ai Prank Lab v2.0</span>
        </div>
      </div>
    </div>
  );
}
