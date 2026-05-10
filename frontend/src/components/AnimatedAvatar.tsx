import { useEffect, useRef, useState } from "react";

interface AnimatedAvatarProps {
  isSpeaking: boolean;
}

export default function AnimatedAvatar({ isSpeaking }: AnimatedAvatarProps) {
  const [mouthOpen, setMouthOpen] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (isSpeaking) {
      setIsAnimating(true);
      startFallbackAnimation();
    } else {
      setIsAnimating(false);
      stopFallbackAnimation();
    }
    return () => stopFallbackAnimation();
  }, [isSpeaking]);

  const startFallbackAnimation = () => {
    if (animationRef.current) return;
    let t = 0;
    const animate = () => {
      if (!isAnimating) return;
      t += 0.15;
      setMouthOpen(Math.abs(Math.sin(t)) * 12 + 2);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
  };

  const stopFallbackAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsAnimating(false);
    setMouthOpen(0);
  };

  return (
    <div className="relative w-20 h-20">
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-400 via-blue-500 to-blue-600 opacity-80 blur-sm animate-pulse" />

      {/* Gradient ring border */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-400 via-blue-500 to-blue-600" />

      {/* Inner circle with Bio-Sync dark background */}
      <div className="absolute inset-[3px] rounded-full bg-[#0a1628] flex items-center justify-center overflow-hidden">
        {/* Bio-Sync logo image */}
        <img
          src="/images/Bio_Logo_white-87f86ab6b807.png"
          alt="MAIA Avatar"
          className="w-full h-full object-contain rounded-full p-1"
        />

        {/* Mouth overlay */}
        <div
          className="absolute bottom-[28%] left-1/2 transform -translate-x-1/2"
          style={{
            width: "22%",
            height: mouthOpen > 1 ? `${mouthOpen}px` : "2px",
            maxHeight: "12%",
            backgroundColor: "#5ba67a",
            borderRadius: mouthOpen > 3 ? "50%" : "40%",
            transition: "height 0.05s ease-out, border-radius 0.05s ease-out",
            opacity: isAnimating ? 1 : 0,
          }}
        />
      </div>

      {/* Outer ring decoration */}
      <div className="absolute inset-0 rounded-full border-2 border-white/20" />

      {/* Speaking indicator — green bars */}
      {isSpeaking && (
        <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 flex gap-1">
          {[0, 100, 200].map((delay) => (
            <div
              key={delay}
              className="w-1 h-3 bg-green-400 rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      )}

      {/* Name tag */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-md">
        MAIA
      </div>
    </div>
  );
}
