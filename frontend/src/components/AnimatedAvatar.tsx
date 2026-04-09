import { useState, useEffect, useRef } from "react";

interface AnimatedAvatarProps {
  isSpeaking: boolean;
}

export default function AnimatedAvatar({ isSpeaking }: AnimatedAvatarProps) {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Set up audio context for visualization
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Animate avatar when speaking
  useEffect(() => {
    if (isSpeaking) {
      // Create a pulsing/speaking animation effect
      let frame = 0;
      const animate = () => {
        frame += 1;
        // Simulate audio level for animation
        const level = Math.sin(frame * 0.3) * 0.5 + 0.5;
        setAudioLevel(level);
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      setAudioLevel(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSpeaking]);

  return (
    <div className="flex flex-col items-center">
      {/* Avatar Container */}
      <div className="relative">
        {/* Background glow when speaking */}
        <div 
          className={`absolute inset-0 rounded-full transition-opacity duration-300 ${
            isSpeaking ? "opacity-60" : "opacity-0"
          }`}
          style={{
            background: `radial-gradient(circle, rgba(59, 130, 246, ${audioLevel * 0.5}) 0%, transparent 70%)`,
            transform: `scale(${1 + audioLevel * 0.1})`,
          }}
        />
        
        {/* Avatar Circle */}
        <div 
          className={`relative w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg transition-transform duration-200 ${
            isSpeaking ? "scale-105" : "scale-100"
          }`}
          style={{
            transform: isSpeaking ? `scale(${1 + audioLevel * 0.05})` : "scale(1)",
          }}
        >
          {/* Medical Cross Symbol */}
          <div className="text-white text-center">
            <div className="flex items-center justify-center gap-1">
              {/* Stethoscope Icon */}
              <svg 
                className={`w-12 h-12 text-white transition-transform duration-150 ${
                  isSpeaking ? "animate-pulse" : ""
                }`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                style={{
                  transform: `scale(${1 + audioLevel * 0.2})`,
                }}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
                />
              </svg>
            </div>
            <div className="text-xs font-bold mt-1">M.A.I.A</div>
          </div>

          {/* Speaking waves */}
          {isSpeaking && (
            <>
              <div 
                className="absolute inset-0 border-4 border-white rounded-full opacity-30 animate-ping"
                style={{ animationDuration: "1s" }}
              />
              <div 
                className="absolute inset-0 border-2 border-blue-200 rounded-full opacity-20"
                style={{
                  transform: `scale(${1 + audioLevel * 0.3})`,
                  transition: "transform 0.1s ease-out",
                }}
              />
            </>
          )}
        </div>

        {/* Name tag */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-md">
          M.A.I.A
        </div>
      </div>

      {/* Status text */}
      <div className={`mt-6 text-sm font-medium ${isSpeaking ? "text-blue-600" : "text-gray-500"}`}>
        {isSpeaking ? "Speaking..." : "Ready to help"}
      </div>

      {/* Audio level bars (visual feedback) */}
      <div className="flex gap-1 mt-2 h-8 items-end">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-100 ${
              isSpeaking ? "bg-blue-500" : "bg-gray-300"
            }`}
            style={{
              height: isSpeaking 
                ? `${Math.random() * 24 + 8}px`
                : "8px",
              transitionDelay: `${i * 50}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
