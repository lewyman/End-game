import { useState, useRef, useEffect } from "react";
import AnimatedAvatar from "./AnimatedAvatar";

interface Message {
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
}

interface EducatorChatProps {
  userId: string;
}

export default function EducatorChat({ userId }: EducatorChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversationId] = useState(() => `conv_${Date.now()}`);
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const playAudio = (audioUrl: string) => {
    if (audioRef.current && !isMuted) {
      setIsSpeaking(true);
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(console.error);
      audioRef.current.onended = () => setIsSpeaking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    setMessages(prev => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch("/api/educator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          userId: `${userId}_${conversationId}`,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      const aiResponse = data.response;
      const audioUrl = data.audioUrl;

      const newMessage: Message = { role: "assistant", content: aiResponse };
      if (audioUrl) newMessage.audioUrl = audioUrl;

      setMessages(prev => [...prev, newMessage]);

      if (audioUrl && !isMuted) {
        setTimeout(() => playAudio(audioUrl), 500);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I'm sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] max-w-2xl mx-auto border rounded-lg bg-white shadow-lg">
      {/* Header with Avatar */}
      <div className="p-4 border-b bg-blue-600 text-white rounded-t-lg flex items-center gap-4">
        <AnimatedAvatar isSpeaking={isSpeaking} />
        <div>
          <h3 className="font-semibold text-lg">MAIA</h3>
          <p className="text-sm text-blue-100">Your Medical Anatomy & Intelligence Assistant</p>
        </div>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="ml-auto p-2 hover:bg-blue-700 rounded-lg transition-colors"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <AnimatedAvatar isSpeaking={false} />
            <p className="text-lg mt-4 mb-2">Welcome!</p>
            <p className="text-sm">
              Ask me about medical concepts, pharmacology, or I'll quiz you on nursing topics.
            </p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] p-4 rounded-lg ${
              msg.role === "user" 
                ? "bg-blue-600 text-white" 
                : "bg-gray-100 text-gray-800"
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === "assistant" && msg.audioUrl && !isMuted && (
                <button
                  onClick={() => playAudio(msg.audioUrl!)}
                  className="mt-2 text-sm flex items-center gap-1 hover:underline"
                >
                  🔊 Play Audio
                </button>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Audio element */}
      <audio 
        ref={audioRef} 
        onEnded={() => setIsSpeaking(false)}
        onError={() => setIsSpeaking(false)}
      />

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question or say 'quiz me'..."
            disabled={isLoading}
            className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-black placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
