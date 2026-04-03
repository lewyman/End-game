import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Check, X, ChevronRight, ChevronLeft, AlertCircle, Heart, Activity, Clock, Eye, Database } from "lucide-react";
import ImageViewer from "@/components/ImageViewer";

interface Block {
  id: number;
  type: "content" | "mc" | "sata";
  title: string;
  content?: string;
  keyPoints?: string;
  question?: string;
  options?: string[];
  correct?: number | number[];
  explanation?: string;
  rationale?: string;
  image?: string;
}

const STORAGE_KEY = "digoxin_content_v1";
const COMPLETED_KEY = "completed_drugs";
const API_URL = "/api";

export default function DrugDetail() {
  const { slug } = useParams();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    
    // Fetch drug content from API
    const fetchDrug = async () => {
      try {
        setLoading(true);
        
        // Get user session for premium check
        const currentUser = localStorage.getItem("pharma_current_user");
        const headers: Record<string, string> = {};
        
        if (currentUser) {
          const user = JSON.parse(currentUser);
          const sessionKey = localStorage.getItem("pharma_session_key") || "user-" + Date.now();
          headers["Authorization"] = `Bearer ${sessionKey}`;
          headers["X-User-Tier"] = user.tier || "free";
        }
        
        const res = await fetch(`${API_URL}/drugs/${slug}`, { headers });
        const data = await res.json();
        
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        
        const blocksFromApi = data.drug?.blocks || data.blocks;
        if (blocksFromApi && blocksFromApi.length > 0) {
          const mappedBlocks = blocksFromApi.map((b: any, idx: number) => ({
            id: idx + 1,
            type: b.type,
            title: b.title,
            content: b.content || "",
            keyPoints: b.key_points || "",
            question: b.question || "",
            options: b.options ? b.options.split("|") : undefined,
            correct: b.correct?.includes(",") 
              ? b.correct.split(",").map((n: string) => parseInt(n.trim()))
              : b.correct ? parseInt(b.correct) : undefined,
            explanation: b.explanation || "",
            rationale: b.rationale || "",
            image: b.image || ""
          }));
          setBlocks(mappedBlocks);
        } else {
          setError("No content blocks found for this drug");
        }
        
        // Check if this drug is already completed
        const completedDrugs = JSON.parse(localStorage.getItem(COMPLETED_KEY) || "[]");
        if (slug && completedDrugs.includes(slug)) {
          setIsCompleted(true);
        }
        
        setLoading(false);
      } catch (err) {
        setError("Failed to load drug content");
        setLoading(false);
      }
    };
    
    fetchDrug();
  }, [slug]);

  // Mark drug as completed when user finishes
  useEffect(() => {
    if (showSummary && slug && !isCompleted) {
      const completedDrugs = JSON.parse(localStorage.getItem(COMPLETED_KEY) || "[]");
      if (!completedDrugs.includes(slug)) {
        completedDrugs.push(slug);
        localStorage.setItem(COMPLETED_KEY, JSON.stringify(completedDrugs));
        setIsCompleted(true);
      }
    }
  }, [showSummary, slug, isCompleted]);

  const currentBlock = blocks[currentIndex];

  const handleAnswer = (index: number) => {
    if (currentBlock?.type === "mc") {
      setSelectedAnswer(index);
    } else if (currentBlock?.type === "sata") {
      if (selectedAnswers.includes(index)) {
        setSelectedAnswers(selectedAnswers.filter(a => a !== index));
      } else {
        setSelectedAnswers([...selectedAnswers, index]);
      }
    }
  };

  const checkAnswer = () => {
    if (!currentBlock) return;
    
    let correct = false;
    if (currentBlock.type === "mc" && selectedAnswer !== null) {
      correct = selectedAnswer === currentBlock.correct;
    } else if (currentBlock.type === "sata") {
      const correctArray = currentBlock.correct as number[];
      correct = selectedAnswers.length === correctArray.length && 
                selectedAnswers.every(a => correctArray.includes(a));
    }
    
    if (correct && !completed.includes(currentBlock.id)) {
      setScore(score + 1);
    }
    setCompleted([...completed, currentBlock.id]);
    setShowResult(true);
  };

  const nextBlock = () => {
    if (currentIndex < blocks.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setSelectedAnswers([]);
      setShowResult(false);
    } else {
      setShowSummary(true);
    }
  };

  const prevBlock = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelectedAnswer(null);
      setSelectedAnswers([]);
      setShowResult(false);
    }
  };

  const restart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setSelectedAnswers([]);
    setShowResult(false);
    setScore(0);
    setCompleted([]);
    setShowSummary(false);
  };

  if (blocks.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading content...</p>
        </div>
      </div>
    );
  }

  if (showSummary) {
    const totalQuestions = blocks.filter(b => b.type !== "content").length;
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Module Complete!</h1>
            {isCompleted && (
              <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full">
                <Check className="w-5 h-5" />
                <span className="font-semibold">Marked as Complete</span>
              </div>
            )}
            <p className="text-gray-600 mb-6">You've completed the Digoxin pharmacology module.</p>
            <div className="bg-gray-100 rounded-xl p-6 mb-6">
              <p className="text-4xl font-bold text-blue-600 mb-2">{score}/{totalQuestions}</p>
              <p className="text-gray-500">Correct Answers</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={restart}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                Restart Module
              </button>
              <Link
                to="/drugs"
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Back to Drugs
              </Link>
            </div>
            <div className="mt-6 pt-6 border-t">
              <Link 
                to="/admin/content" 
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600"
              >
                <Database className="w-4 h-4" />
                Edit Content
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/drugs" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Drug Cards</span>
          </Link>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Block {currentIndex + 1} of {blocks.length}</span>
            <Link to="/admin/content" className="text-blue-600 hover:underline flex items-center gap-1">
              <Database className="w-4 h-4" />
              Edit
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentBlock?.type === "content" ? (
                  <Activity className="w-6 h-6 text-white" />
                ) : currentBlock?.type === "mc" ? (
                  <AlertCircle className="w-6 h-6 text-white" />
                ) : (
                  <Eye className="w-6 h-6 text-white" />
                )}
                <h1 className="text-xl font-bold text-white">{currentBlock?.title}</h1>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                currentBlock?.type === "content" ? "bg-blue-500 text-white" :
                currentBlock?.type === "mc" ? "bg-purple-500 text-white" :
                "bg-orange-500 text-white"
              }`}>
                {currentBlock?.type === "content" ? "LEARN" : currentBlock?.type === "mc" ? "MC" : "SATA"}
              </span>
            </div>
          </div>

          <div className="p-6">
            {currentBlock?.type === "content" ? (
              <div className="space-y-6">
                {currentBlock.image && (
                  <ImageViewer src={currentBlock.image} alt="" className="w-full h-48 object-cover rounded-lg" />
                )}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                  <p className="text-gray-800 leading-relaxed">{currentBlock.content}</p>
                </div>
                
                {currentBlock.keyPoints && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      Key Points
                    </h3>
                    <ul className="space-y-2">
                      {currentBlock.keyPoints.split("|").map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                          <span className="text-gray-700">{point.trim()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button
                    onClick={nextBlock}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Continue
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {currentBlock?.image && (
                  <ImageViewer src={currentBlock.image} alt="" className="w-full h-48 object-cover rounded-lg" />
                )}
                <p className="text-lg text-gray-800 font-medium">{currentBlock?.question}</p>
                
                <div className="space-y-3">
                  {currentBlock?.options?.map((option, idx) => {
                    const isSelected = currentBlock.type === "mc" 
                      ? selectedAnswer === idx 
                      : selectedAnswers.includes(idx);
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => handleAnswer(idx)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                        } ${showResult ? "cursor-default" : "cursor-pointer"}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                            isSelected ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"
                          }`}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="text-gray-700">{option}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {!showResult ? (
                  <button
                    onClick={checkAnswer}
                    disabled={selectedAnswer === null && selectedAnswers.length === 0}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Check Answer
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl ${
                      (currentBlock?.type === "mc" && selectedAnswer === currentBlock?.correct) ||
                      (currentBlock?.type === "sata" && 
                       selectedAnswers.length === (currentBlock?.correct as number[])?.length &&
                       selectedAnswers.every(a => (currentBlock?.correct as number[]).includes(a)))
                        ? "bg-green-100 border border-green-300"
                        : "bg-red-100 border border-red-300"
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {(currentBlock?.type === "mc" && selectedAnswer === currentBlock?.correct) ||
                         (currentBlock?.type === "sata" && 
                          selectedAnswers.length === (currentBlock?.correct as number[])?.length &&
                          selectedAnswers.every(a => (currentBlock?.correct as number[]).includes(a)))
                          ? <Check className="w-5 h-5 text-green-600" />
                          : <X className="w-5 h-5 text-red-600" />
                        }
                        <span className={`font-semibold ${
                          (currentBlock?.type === "mc" && selectedAnswer === currentBlock?.correct) ||
                          (currentBlock?.type === "sata" && 
                           selectedAnswers.length === (currentBlock?.correct as number[])?.length &&
                           selectedAnswers.every(a => (currentBlock?.correct as number[]).includes(a)))
                            ? "text-green-800"
                            : "text-red-800"
                        }`}>
                          {(currentBlock?.type === "mc" && selectedAnswer === currentBlock?.correct) ||
                           (currentBlock?.type === "sata" && 
                            selectedAnswers.length === (currentBlock?.correct as number[])?.length &&
                            selectedAnswers.every(a => (currentBlock?.correct as number[]).includes(a)))
                            ? "Correct!"
                            : "Incorrect"
                          }
                        </span>
                      </div>
                      <p className="text-gray-700">{currentBlock?.explanation}</p>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl">
                      <p className="text-sm text-blue-800">
                        <strong>Nursing Rationale:</strong> {currentBlock?.rationale}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      {currentIndex > 0 && (
                        <button
                          onClick={prevBlock}
                          className="flex items-center gap-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5" />
                          Previous
                        </button>
                      )}
                      <button
                        onClick={nextBlock}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                      >
                        {currentIndex === blocks.length - 1 ? "Finish" : "Continue"}
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-100 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {blocks.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full ${
                      idx === currentIndex ? "bg-blue-500" :
                      idx < currentIndex ? "bg-green-500" :
                      "bg-gray-300"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Progress: {Math.round(((currentIndex + 1) / blocks.length) * 100)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
