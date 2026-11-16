import React, { useState, useEffect } from 'react';
import { BanterBugAvatar } from './Avatars';
import { sounds } from '../utils/soundEffects';
import { Sparkles, MessageCircle, X } from 'lucide-react';

const BANTER_QUIPS = [
  "Arey boss! Itna serious kyun ho? Samosa khao, khush raho! 🥟",
  "Badri ne homework chori kiya, aur blame apun pe daal diya! 😭",
  "Dubey sir class ke bahar danda leke khade hain, bhaago re! 🏃💨",
  "Apun ka IQ test hua tha... Doctor ne bola 'Iska dimaag kidhar hai?' 😂",
  "Exam ke time pe jo dost bolte hain 'Maine kuch nahi padha', wahi top karte hain! 🐍",
  "Agar padhai karne se akal aati, toh Budhdeb scientist ban chuka hota! 🧪",
  "Bhai ne ek baar homework submit kiya tha... Teacher behosh ho gayi! 💥",
  "Zindagi me do cheezein kabhi miss mat karna: Mummy ka tiffin aur Budbak ki masti! ✨",
  "Vicky bhai ne bola tha: 'Shanti se baitho', lekin apun toh BanterBug hai! 🐛",
  "Ayee-yee! Tumhara mouse cursor bohot ghoom raha hai, thak gaya kya? 🐭"
];

export default function BanterBug({ onInjectPrompt }) {
  const [quip, setQuip] = useState(null);
  const [isWiggling, setIsWiggling] = useState(false);
  const [pokes, setPokes] = useState(0);

  const handlePoke = () => {
    sounds.playSqueak();
    setIsWiggling(true);
    setPokes((prev) => prev + 1);

    const randomQuip = BANTER_QUIPS[Math.floor(Math.random() * BANTER_QUIPS.length)];
    setQuip(randomQuip);

    setTimeout(() => setIsWiggling(false), 500);
  };

  return (
    <div className="fixed bottom-24 right-5 z-40 flex flex-col items-end pointer-events-auto select-none">
      {/* Speech Bubble from BanterBug */}
      {quip && (
        <div className="mb-2 max-w-[260px] p-3 bg-white dark:bg-zinc-900 border-[3.5px] border-black rounded-2xl shadow-comic text-xs font-bold animate-pop-in relative">
          <button
            onClick={() => setQuip(null)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-comic-pink border-2 border-black rounded-full flex items-center justify-center hover:scale-110 active:scale-95 shadow-comic-sm"
          >
            <X size={12} className="stroke-[3]" />
          </button>
          <div className="flex items-center gap-1.5 text-comic-orange font-bangers text-sm mb-1 tracking-wide">
            <Sparkles size={14} /> BanterBug Speaks:
          </div>
          <p className="text-zinc-900 dark:text-zinc-100 font-comic leading-relaxed">{quip}</p>
          {onInjectPrompt && (
            <button
              onClick={() => {
                onInjectPrompt(quip);
                setQuip(null);
              }}
              className="mt-2 text-[10px] bg-comic-yellow hover:bg-yellow-400 px-2 py-1 rounded-lg border-2 border-black font-bangers tracking-wider flex items-center gap-1"
            >
              <MessageCircle size={10} /> Send to Badri & Budh
            </button>
          )}
        </div>
      )}

      {/* The Bug Mascot Button */}
      <button
        onClick={handlePoke}
        title="Poke BanterBug for jokes!"
        className={`group relative p-1.5 rounded-full bg-comic-green border-[3.5px] border-black shadow-comic-md hover:scale-110 active:scale-90 transition-all ${
          isWiggling ? 'animate-bug-wiggle' : 'animate-float-slow'
        }`}
      >
        <BanterBugAvatar size={52} />

        {/* Floating badge */}
        <span className="absolute -top-2 -left-2 bg-comic-yellow text-[10px] font-bangers px-1.5 py-0.5 border-2 border-black rounded-md shadow-comic-sm rotate-[-8deg] uppercase tracking-wider">
          POKE ME!
        </span>

        {pokes > 0 && (
          <span className="absolute -bottom-1 -right-1 bg-comic-pink text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-black shadow-comic-sm">
            {pokes}
          </span>
        )}
      </button>
    </div>
  );
}
