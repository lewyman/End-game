import { useEffect, useRef, useState } from "react";

interface AnimatedAvatarProps {
  isSpeaking: boolean;
}

export default function AnimatedAvatar({ isSpeaking }: AnimatedAvatarProps) {
  const [mouthOpen, setMouthOpen] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    if (isSpeaking) {
      setIsAnimating(true);
      startAudioAnalysis();
    } else {
      setIsAnimating(false);
      stopAudioAnalysis();
    }

    return () => {
      stopAudioAnalysis();
    };
  }, [isSpeaking]);

  const startAudioAnalysis = () => {
    if (animationRef.current) return;
    
    const animate = () => {
      if (!isAnimating) return;
      
      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const avg = dataArrayRef.current.reduce((a, b) => a + b, 0) / dataArrayRef.current.length;
        const normalized = avg / 255;
        setMouthOpen(normalized * 15);
      } else {
        // Fallback animation when no audio data
        setMouthOpen(prev => prev > 2 ? prev * 0.85 : 2);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  };

  const stopAudioAnalysis = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsAnimating(false);
    setMouthOpen(0);
  };

  return (
    <div className="relative w-20 h-20">
      {/* Avatar Image */}
      <div className="relative w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-blue-200">
        <img 
          src="/images/maia-avatar.jpg" 
          alt="MAIA Avatar" 
          className="w-full h-full object-cover rounded-full"
        />
        
        {/* Mouth Overlay - positioned over the mouth area */}
        <div 
          className="absolute bottom-[30%] left-1/2 transform -translate-x-1/2"
          style={{
            width: '20%',
            height: mouthOpen > 1 ? `${mouthOpen}%` : '2%',
            maxHeight: '15%',
            backgroundColor: '#c97a7a',
            borderRadius: mouthOpen > 2 ? '50%' : '40%',
            transition: 'height 0.05s ease-out, border-radius 0.05s ease-out',
            opacity: isAnimating ? 1 : 0,
          }}
        />
      </div>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1">
          <div className="w-1 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-1 h-4 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-1 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      )}

      {/* Name tag */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">
        MAIA
      </div>
    </div>
  );
}
