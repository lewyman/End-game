import { useEffect, useState } from "react";

interface AnimatedAvatarProps {
  isSpeaking: boolean;
}

export default function AnimatedAvatar({ isSpeaking }: AnimatedAvatarProps) {
  const [mouthOpen, setMouthOpen] = useState(false);

  useEffect(() => {
    if (isSpeaking) {
      const interval = setInterval(() => {
        setMouthOpen(prev => !prev);
      }, 150);
      return () => clearInterval(interval);
    } else {
      setMouthOpen(false);
    }
  }, [isSpeaking]);

  return (
    <div className="relative">
      {/* Medical Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full opacity-50" />
      
      {/* Anatomy hint overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-10">
        <circle cx="50%" cy="35%" r="25%" fill="none" stroke="#1e40af" strokeWidth="1" />
        <path d="M 30% 50% Q 50% 70% 70% 50%" fill="none" stroke="#1e40af" strokeWidth="1" />
      </svg>

      {/* Avatar Container */}
      <svg viewBox="0 0 200 200" className="w-full h-full relative z-10">
        {/* White Lab Coat */}
        <path 
          d="M 40 140 L 35 180 L 50 185 L 60 150 L 100 155 L 140 150 L 150 185 L 165 180 L 160 140 Q 140 130 100 128 Q 60 130 40 140" 
          fill="#ffffff" 
          stroke="#e5e7eb" 
          strokeWidth="1"
        />
        
        {/* Neck */}
        <rect x="88" y="100" width="24" height="30" fill="#d4a574" />
        
        {/* Navy Scrubs Body */}
        <path 
          d="M 50 130 Q 60 125 100 123 Q 140 125 150 130 L 145 145 Q 100 150 55 145 Z" 
          fill="#1e3a5f" 
        />
        
        {/* Scrubs Collar */}
        <path d="M 85 123 L 100 135 L 115 123" fill="#162d4a" />
        
        {/* Head/Face */}
        <ellipse cx="100" cy="70" rx="38" ry="45" fill="#e8c4a0" />
        
        {/* Hair - Dark, Medium-length, Low Ponytail */}
        <ellipse cx="100" cy="40" rx="42" ry="28" fill="#2d1f1a" />
        <path d="M 58 45 Q 60 70 65 90 L 70 85 Q 65 60 68 40 Q 80 25 100 23 Q 120 25 132 40 Q 135 60 130 85 L 135 90 Q 140 70 142 45 Q 130 20 100 18 Q 70 20 58 45" fill="#2d1f1a" />
        {/* Ponytail */}
        <ellipse cx="100" cy="115" rx="12" ry="15" fill="#2d1f1a" />
        <path d="M 95 125 Q 100 160 105 125" fill="#2d1f1a" />
        <circle cx="100" cy="115" r="8" fill="#1a1210" />
        
        {/* Hair Highlights */}
        <path d="M 65 35 Q 75 30 85 32" fill="none" stroke="#4a3530" strokeWidth="2" opacity="0.5" />
        <path d="M 115 32 Q 125 30 135 35" fill="none" stroke="#4a3530" strokeWidth="2" opacity="0.5" />

        {/* Ears */}
        <ellipse cx="62" cy="70" rx="5" ry="8" fill="#e8c4a0" />
        <ellipse cx="138" cy="70" rx="5" ry="8" fill="#e8c4a0" />
        
        {/* Earrings (small studs) */}
        <circle cx="62" cy="75" r="2" fill="#c0c0c0" />
        <circle cx="138" cy="75" r="2" fill="#c0c0c0" />

        {/* Eyebrows */}
        <path d="M 75 52 Q 82 48 90 52" fill="none" stroke="#2d1f1a" strokeWidth="2" strokeLinecap="round" />
        <path d="M 110 52 Q 118 48 125 52" fill="none" stroke="#2d1f1a" strokeWidth="2" strokeLinecap="round" />

        {/* Eyes */}
        <ellipse cx="82" cy="62" rx="8" ry="5" fill="#ffffff" />
        <ellipse cx="118" cy="62" rx="8" ry="5" fill="#ffffff" />
        <circle cx="82" cy="62" r="4" fill="#4a6741" /> {/* Warm brown-green eyes */}
        <circle cx="118" cy="62" r="4" fill="#4a6741" />
        <circle cx="83" cy="61" r="1.5" fill="#1a1a1a" />
        <circle cx="119" cy="61" r="1.5" fill="#1a1a1a" />
        {/* Eye sparkle */}
        <circle cx="84" cy="60" r="1" fill="#ffffff" />
        <circle cx="120" cy="60" r="1" fill="#ffffff" />
        
        {/* Eyelashes */}
        <path d="M 74 58 L 72 56" stroke="#2d1f1a" strokeWidth="1" />
        <path d="M 90 58 L 92 56" stroke="#2d1f1a" strokeWidth="1" />
        <path d="M 106 58 L 104 56" stroke="#2d1f1a" strokeWidth="1" />
        <path d="M 126 58 L 128 56" stroke="#2d1f1a" strokeWidth="1" />

        {/* Nose */}
        <path d="M 100 65 Q 103 75 100 82 Q 97 78 97 75" fill="none" stroke="#c9a07a" strokeWidth="1.5" />

        {/* Subtle blush */}
        <ellipse cx="72" cy="75" rx="8" ry="4" fill="#e8b4a0" opacity="0.4" />
        <ellipse cx="128" cy="75" rx="8" ry="4" fill="#e8b4a0" opacity="0.4" />

        {/* Mouth - speaking animation */}
        <path 
          d={mouthOpen ? "M 88 90 Q 100 100 112 90 Q 100 95 88 90" : "M 88 90 Q 100 92 112 90 Q 100 88 88 90"} 
          fill={mouthOpen ? "#c97a7a" : "#b86b6b"} 
          stroke="#a55a5a" 
          strokeWidth="1"
        />
        
        {/* Smile lines */}
        <path d="M 85 88 Q 88 90 91 89" fill="none" stroke="#c9a07a" strokeWidth="0.5" opacity="0.5" />
        <path d="M 109 89 Q 112 90 115 88" fill="none" stroke="#c9a07a" strokeWidth="0.5" opacity="0.5" />

        {/* Clear natural makeup - subtle eyeshadow */}
        <path d="M 74 60 Q 82 56 90 60" fill="#e8c4a0" opacity="0.3" stroke="#d4a574" strokeWidth="0.5" />
        <path d="M 110 60 Q 118 56 126 60" fill="#e8c4a0" opacity="0.3" stroke="#d4a574" strokeWidth="0.5" />

        {/* Lab Coat Name Badge */}
        <rect x="130" y="140" width="20" height="12" fill="#ffffff" stroke="#1e3a5f" strokeWidth="0.5" rx="1" />
        <text x="140" y="148" fontSize="5" fill="#1e3a5f" textAnchor="middle" fontFamily="Arial">M.A.I.A</text>

        {/* Stethoscope hint */}
        <path d="M 70 145 Q 65 160 75 175" fill="none" stroke="#374151" strokeWidth="2" />
        <circle cx="75" cy="177" r="4" fill="#374151" />
      </svg>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
          <div className="w-1 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-1 h-4 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-1 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      )}

      {/* Name tag */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap">
        M.A.I.A
      </div>
    </div>
  );
}
