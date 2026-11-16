import React from 'react';

// Badrinath (Badri) - The Scheming Mastermind
export function BadriAvatar({ size = 48, className = '', isTalking = false, isShocked = false }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full border-[3px] border-black bg-comic-yellow flex items-center justify-center overflow-hidden shadow-comic-sm ${className}`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Hair - Spiky black comic tufts */}
        <path d="M 20,40 Q 15,10 40,15 Q 50,5 65,15 Q 85,10 80,40 Z" fill="#111827" stroke="#000" strokeWidth="4" />
        <polygon points="35,15 45,2 50,15" fill="#111827" stroke="#000" strokeWidth="3" />
        <polygon points="55,15 65,4 70,18" fill="#111827" stroke="#000" strokeWidth="3" />

        {/* Face */}
        <circle cx="50" cy="55" r="32" fill="#FDE047" stroke="#000" strokeWidth="4" />

        {/* Eyes with mischievous slant */}
        <ellipse cx="40" cy="50" rx="6" ry="8" fill="#FFFFFF" stroke="#000" strokeWidth="3" />
        <ellipse cx="60" cy="50" rx="6" ry="8" fill="#FFFFFF" stroke="#000" strokeWidth="3" />
        <circle cx="42" cy="51" r="3" fill="#000000" />
        <circle cx="62" cy="51" r="3" fill="#000000" />

        {/* Eyebrows - cocked schemer angle */}
        <line x1="32" y1="40" x2="48" y2="44" stroke="#000" strokeWidth="4" strokeLinecap="round" />
        <line x1="52" y1="44" x2="68" y2="38" stroke="#000" strokeWidth="4" strokeLinecap="round" />

        {/* Mischievous Smirk / Mouth */}
        {isTalking ? (
          <path d="M 38,68 Q 50,82 62,68 Z" fill="#EF4444" stroke="#000" strokeWidth="3" className="animate-pulse" />
        ) : isShocked ? (
          <ellipse cx="50" cy="70" rx="8" ry="10" fill="#EF4444" stroke="#000" strokeWidth="3" />
        ) : (
          <path d="M 38,66 Q 52,78 64,64" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
}

// Budhdeb (Budh) - Samosa Lover & Innocent Goof
export function BudhAvatar({ size = 48, className = '', isTalking = false }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full border-[3px] border-black bg-comic-pink flex items-center justify-center overflow-hidden shadow-comic-sm ${className}`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Two silly hairs standing up */}
        <path d="M 45,22 Q 40,8 35,12" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" />
        <path d="M 55,22 Q 60,6 68,14" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" />

        {/* Round Chubby Face */}
        <circle cx="50" cy="56" r="34" fill="#FBCFE8" stroke="#000" strokeWidth="4" />

        {/* Big Wide Goofy Eyes */}
        <circle cx="38" cy="50" r="9" fill="#FFFFFF" stroke="#000" strokeWidth="3" />
        <circle cx="62" cy="50" r="9" fill="#FFFFFF" stroke="#000" strokeWidth="3" />
        <circle cx="40" cy="50" r="4" fill="#000000" />
        <circle cx="60" cy="50" r="4" fill="#000000" />

        {/* Rosy Cheeks */}
        <circle cx="28" cy="62" r="5" fill="#F43F5E" opacity="0.6" />
        <circle cx="72" cy="62" r="5" fill="#F43F5E" opacity="0.6" />

        {/* Happy Open Samosa Mouth */}
        {isTalking ? (
          <ellipse cx="50" cy="70" rx="9" ry="11" fill="#DC2626" stroke="#000" strokeWidth="3" />
        ) : (
          <path d="M 40,66 Q 50,78 60,66 Z" fill="#DC2626" stroke="#000" strokeWidth="3" />
        )}

        {/* Tiny Samosa in corner */}
        <polygon points="76,70 88,86 68,84" fill="#F59E0B" stroke="#000" strokeWidth="2.5" />
      </svg>
    </div>
  );
}

// Vicky Sahu - Creator & Super-Cool Mastermind
export function VickyAvatar({ size = 48, className = '' }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full border-[3px] border-black bg-comic-cyan flex items-center justify-center overflow-hidden shadow-comic-sm ${className}`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Stylish Hair */}
        <path d="M 22,38 Q 20,12 48,10 Q 78,12 78,38 Z" fill="#1E293B" stroke="#000" strokeWidth="4" />

        {/* Face */}
        <circle cx="50" cy="54" r="32" fill="#FEF08A" stroke="#000" strokeWidth="4" />

        {/* Iconic Cool Black Sunglasses */}
        <rect x="26" y="44" width="22" height="15" rx="3" fill="#0F172A" stroke="#000" strokeWidth="3" />
        <rect x="52" y="44" width="22" height="15" rx="3" fill="#0F172A" stroke="#000" strokeWidth="3" />
        <line x1="48" y1="50" x2="52" y2="50" stroke="#000" strokeWidth="4" />
        {/* Sunglasses shine glare */}
        <line x1="30" y1="46" x2="42" y2="56" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        <line x1="56" y1="46" x2="68" y2="56" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />

        {/* Confident Grin */}
        <path d="M 38,70 Q 50,80 62,68" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// BanterBug - Mischievous Interactive Mascot
export function BanterBugAvatar({ size = 48, className = '' }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full border-[3px] border-black bg-comic-green flex items-center justify-center overflow-hidden shadow-comic-sm ${className}`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Antennae */}
        <path d="M 40,30 Q 30,10 24,15" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" />
        <circle cx="24" cy="15" r="4" fill="#FFE600" stroke="#000" strokeWidth="2" />
        <path d="M 60,30 Q 70,10 76,15" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" />
        <circle cx="76" cy="15" r="4" fill="#FFE600" stroke="#000" strokeWidth="2" />

        {/* Bug Shell */}
        <ellipse cx="50" cy="58" rx="30" ry="26" fill="#10B981" stroke="#000" strokeWidth="4" />
        {/* Spots */}
        <circle cx="36" cy="62" r="5" fill="#047857" />
        <circle cx="64" cy="62" r="5" fill="#047857" />
        <circle cx="50" cy="74" r="4" fill="#047857" />

        {/* Big Googly Eyes */}
        <circle cx="42" cy="44" r="10" fill="#FFFFFF" stroke="#000" strokeWidth="3" />
        <circle cx="58" cy="44" r="10" fill="#FFFFFF" stroke="#000" strokeWidth="3" />
        <circle cx="44" cy="45" r="4.5" fill="#000000" />
        <circle cx="56" cy="45" r="4.5" fill="#000000" />

        {/* Cheeky Grin */}
        <path d="M 42,66 Q 50,74 58,66" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}
