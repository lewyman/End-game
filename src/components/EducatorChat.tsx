import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, RotateCcw, Sparkles, MessageSquare, Plus, Trash2, PanelLeftClose, PanelLeftOpen, AlertTriangle, Paperclip, FileText, X as XIcon } from "lucide-react";
import MermaidDiagram from "./visuals/MermaidDiagram";
import AnimationPlayer from "./visuals/AnimationPlayer";
import { useZoAuth } from "../lib/auth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const API_URL = "/api";

const SUGGESTED_PROMPTS = [
  "Quiz me on beta-blockers",
  "Explain serotonin syndrome",
  "What are signs of digoxin toxicity?",
  "Walk me through ACE inhibitors",
  "Anticoagulants: heparin vs warfarin",
  "NCLEX tip for loop diuretics",
];

const WELCOME_MESSAGE = "👋 I'm MAIA, your nursing study partner! I can quiz you on pharmacology, walk through clinical scenarios, generate NCLEX questions, and explain nursing concepts. What are you studying for today?";

const QUICK_START_BUTTONS = [
  "Quiz me on pharmacology",
  "Help me with NCLEX prep",
  "Explain a drug class",
];

async function apiFetch(path: string, token: string | null, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { ...opts, headers });
}

/**
 * Parse the raw streaming buffer and return only content that is safe to display.
 *
 * Rules:
 * - Prose and non-special code blocks stream through immediately.
 * - ```mermaid and ```animation blocks are withheld until the closing ``` arrives
 *   on its own line, then released in full so they render cleanly.
 * - If a special block is still open (no closing fence yet), nothing inside it
 *   is shown — the caller may render a placeholder spinner instead.
 */
function parseStreamingContent(raw: string): { display: string; hasOpenSpecialBlock: boolean } {
  const lines = raw.split("\n");
  let display = "";
  let state: "prose" | "special" | "other" = "prose";
  let specialBuffer = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLast = i === lines.length - 1;
    const suffix = isLast ? "" : "\n";

    if (state === "prose") {
      if (/^```(mermaid|animation)(\s|$)/.test(line)) {
        state = "special";
        specialBuffer = line + suffix;
      } else if (/^```/.test(line)) {
        if (isLast) {
          // Hold back last partial fence line — we can't yet know if it
          // will be a special (mermaid/animation) or regular block.
          // It will be re-processed once the next token/newline arrives.
        } else {
          state = "other";
          display += line + suffix;
        }
      } else {
        display += line + suffix;
      }
    } else if (state === "special") {
      specialBuffer += line + suffix;
      if (line.trim() === "```") {
        display += specialBuffer;
        specialBuffer = "";
        state = "prose";
      }
    } else {
      display += line + suffix;
      if (line.trim() === "```") {
        state = "prose";
      }
    }
  }

  return { display, hasOpenSpecialBlock: state === "special" };
}

function markdownComponents() {
  return {
    code({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className ?? "");
      const lang = match?.[1] ?? "";
      const codeStr = String(children ?? "").replace(/\n$/, "");

      if (lang === "mermaid") {
        return <MermaidDiagram code={codeStr} />;
      }

      if (lang === "animation") {
        return <AnimationPlayer code={codeStr} />;
      }

      const isBlock = codeStr.includes("\n") || (className ?? "").includes("language-");
      if (isBlock) {
        return (
          <pre className="bg-background rounded-lg p-3 overflow-x-auto text-xs text-foreground/60 my-2">
            <code {...props}>{codeStr}</code>
          </pre>
        );
      }
      return (
        <code className="text-primary/80 bg-card px-1 py-0.5 rounded text-xs" {...props}>
          {children}
        </code>
      );
    },
    table({ children }: React.HTMLAttributes<HTMLTableElement>) {
      return (
        <div className="overflow-x-auto my-3">
          <table className="w-full text-xs border-collapse border border-border/80">{children}</table>
        </div>
      );
    },
    thead({ children }: React.HTMLAttributes<HTMLTableSectionElement>) {
      return <thead className="bg-card/60 text-foreground/60">{children}</thead>;
    },
    tbody({ children }: React.HTMLAttributes<HTMLTableSectionElement>) {
      return <tbody className="divide-y divide-border/80">{children}</tbody>;
    },
    tr({ children }: React.HTMLAttributes<HTMLTableRowElement>) {
      return <tr className="even:bg-card/60/40">{children}</tr>;
    },
    th({ children }: React.ThHTMLAttributes<HTMLTableCellElement>) {
      return <th className="px-3 py-2 text-left font-semibold text-foreground/60 border border-border/80">{children}</th>;
    },
    td({ children }: React.TdHTMLAttributes<HTMLTableCellElement>) {
      return <td className="px-3 py-2 text-foreground/80 border border-border/80">{children}</td>;
    },
  };
}

const PROSE_CLASSES = `prose prose-sm prose-invert max-w-none
  prose-headings:text-white prose-headings:font-semibold
  prose-p:text-foreground/60 prose-p:leading-relaxed
  prose-strong:text-white prose-strong:font-semibold
  prose-ul:text-foreground/60 prose-li:text-foreground/60
  prose-code:text-primary/80 prose-code:bg-card prose-code:px-1 prose-code:rounded
  prose-table:text-foreground/60 prose-th:text-foreground/40 prose-td:text-foreground/80
  [&_table]:border-collapse [&_table]:w-full`;

export default function EducatorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("maia-sidebar") : null;
    if (saved !== null) return saved === "true";
    return typeof window !== "undefined" ? window.innerWidth >= 768 : true;
  });
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tier, setTier] = useState<"free" | "pro">("free");
  const [reportingId, setReportingId] = useState<number | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<number>>(() => new Set());
  const [attachedFile, setAttachedFile] = useState<{ name: string; text: string } | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { getToken, isSignedIn, account, refresh } = useZoAuth();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const currentTier: "free" | "pro" = account?.plan === "pro" ? "pro" : "free";


  const fetchConversations = useCallback(async () => {
    if (!isSignedIn) return;
    setLoadingConversations(true);
    try {
      const token = await getToken();
      const res = await apiFetch("/api/conversations", token);
      if (res.ok) {
        const data = await res.json() as { conversations: Conversation[] };
        setConversations(data.conversations);
      }
    } finally {
      setLoadingConversations(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (isSignedIn) {
      fetchConversations();
    } else {
      setConversations([]);
      setActiveConversationId(null);
    }
  }, [isSignedIn, fetchConversations]);

  const loadConversation = useCallback(async (id: string) => {
    if (isStreaming) return;
    const token = await getToken();
    const res = await apiFetch(`/api/conversations/${id}`, token);
    if (!res.ok) return;
    const data = await res.json() as { conversation: Conversation; messages: Array<{ role: string; content: string }> };
    setMessages(data.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    setActiveConversationId(id);
    setStreamingContent("");
  }, [isStreaming, getToken]);

  const startNewConversation = useCallback(() => {
    if (isStreaming) { abortRef.current?.abort(); }
    setMessages([]);
    setStreamingContent("");
    setIsStreaming(false);
    setInput("");
    setActiveConversationId(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isStreaming]);

  const deleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const token = await getToken();
      const res = await apiFetch(`/api/conversations/${id}`, token, { method: "DELETE" });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          setMessages([]);
          setActiveConversationId(null);
        }
      }
    } finally {
      setDeletingId(null);
    }
  }, [getToken, activeConversationId]);

  const handleFileAttach = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploading(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/educator/attach-file", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json() as { text?: string; filename?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error || "Upload failed");
      setAttachedFile({ name: data.filename || file.name, text: data.text });
    } catch (err: any) {
      alert(err.message || "Failed to attach file");
    } finally {
      setFileUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [getToken]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    abortRef.current = new AbortController();

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/educator`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/plain", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: abortRef.current.signal,
        body: JSON.stringify({ message: trimmed, stream: true, tier: currentTier, messages: history.slice(-20).map(m => ({ role: m.role, content: m.content })), conversationId: activeConversationId, fileContext: attachedFile?.text }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({})) as { error?: string; upgradeRequired?: boolean; used?: number; limit?: number };
        if (data.upgradeRequired) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `**You've hit your daily limit!** 🔒\n\n${data.error || "Your free plan includes a limited number of messages per day."}\n\n[✨ Upgrade to Pro — $19.99/mo](/pricing) for 20 messages/day, NCLEX Tutor Mode, and unlimited study pathways.` },
          ]);
          throw new Error("UPGRADE_REQUIRED");
        }
        throw new Error(data.error || "API error");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      fullContent += decoder.decode();
      setStreamingContent(fullContent);
      const assistantMsg: Message = { role: "assistant", content: fullContent || "No response" };
      const completedMessages = [...history, assistantMsg];
      setMessages(completedMessages);
      if (isSignedIn) {
        const token = await getToken();
        const saveRes = await apiFetch("/api/conversations", token, {
          method: "POST",
          body: JSON.stringify({ conversationId: activeConversationId, messages: completedMessages }),
        });
        if (saveRes.ok) {
          const saved = await saveRes.json() as { conversation: Conversation };
          setActiveConversationId(saved.conversation.id);
          setConversations((prev) => [saved.conversation, ...prev.filter((c) => c.id !== saved.conversation.id)]);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError" && err.message !== "UPGRADE_REQUIRED") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `I ran into an error: ${err.message}. Please try again.` },
        ]);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, isStreaming, currentTier, isSignedIn, getToken, activeConversationId, attachedFile]);

  useEffect(() => {
    if (!isSignedIn || loadingConversations || hasSeenWelcome) return;
    if (messages.length === 0 && !activeConversationId) {
      setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
      setHasSeenWelcome(true);
    }
  }, [isSignedIn, loadingConversations, hasSeenWelcome, activeConversationId, messages]);

  async function reportAnswer(index: number, answer: string) {
    const prompt = [...messages].slice(0, index).reverse().find((msg) => msg.role === "user")?.content || "";
    setReportingId(index);
    try {
      const res = await fetch("/api/reports/wrong-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ context: "chat", prompt, answer }),
      });
      if (res.ok) setReportedIds((prev) => new Set(prev).add(index));
    } finally {
      setReportingId(null);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isEmpty = messages.length === 0 && !isStreaming;
  const showSidebar = isSignedIn && sidebarOpen;
  const isGuest = !isSignedIn;
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const toggleSidebar = () => {
    setSidebarOpen((v) => {
      const next = !v;
      localStorage.setItem("maia-sidebar", String(next));
      return next;
    });
  };

  const { display: streamingDisplay, hasOpenSpecialBlock } = parseStreamingContent(streamingContent);

  return (
    <div className="flex h-full relative">
      {/* Mobile overlay backdrop */}
      {showSidebar && isMobile && (
        <div className="fixed inset-0 bg-black/60 z-30" onClick={toggleSidebar} />
      )}

      {isSignedIn && (
        <div
          className={`flex-shrink-0 border-r border-border flex flex-col transition-all duration-200 ${
            isMobile
              ? `fixed left-0 top-0 h-full z-40 bg-background ${sidebarOpen ? "w-64" : "w-0 overflow-hidden"}`
              : sidebarOpen ? "w-60" : "w-0 overflow-hidden"
          }`}
        >
          <div className="flex items-center justify-between px-3 py-3 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</span>
            <button
              onClick={startNewConversation}
              title="New chat"
              className="p-1.5 rounded-lg hover:bg-card/60 text-muted-foreground hover:text-white transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {loadingConversations && (
              <div className="px-3 py-2 text-xs text-muted-foreground/80">Loading…</div>
            )}
            {!loadingConversations && conversations.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground/80 text-center">No saved conversations yet</div>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`group flex items-center gap-2 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-all ${
                  activeConversationId === conv.id
                    ? "bg-primary/60/40 text-white"
                    : "text-muted-foreground hover:bg-card/60 hover:text-white"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 text-xs truncate">{conv.title}</span>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  disabled={deletingId === conv.id}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-all flex-shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            {isSignedIn && (
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg hover:bg-card/60 text-muted-foreground hover:text-white transition-all mr-1"
                title={showSidebar ? "Hide sidebar" : "Show sidebar"}
              >
                {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>
            )}
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-white text-sm">M.A.I.A</span>
              <span className="hidden sm:inline text-muted-foreground/80 text-xs ml-2">Medical Anatomy & Intelligence Assistant</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-border bg-background/80 px-3 py-1 text-xs font-semibold text-foreground/80">
              {isGuest ? "Guest Mode" : `Using ${currentTier === "pro" ? "Pro" : "Free"} MAIA`}
            </div>
          {messages.length > 0 && (
            <button
              onClick={startNewConversation}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-white hover:bg-card/60 rounded-lg transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New chat
            </button>
          )}
          </div>
        </div>

        <div className="sm:hidden px-4 py-2 border-b border-border space-y-2">
          <div className="rounded-xl border border-border bg-background/80 px-3 py-2 text-xs font-semibold text-foreground/80">
            Using {currentTier === "pro" ? "Pro" : "Free"} MAIA
          </div>
        </div>

        {isGuest && (
          <div className="mx-4 mt-3 mb-1 flex items-center justify-between gap-3 rounded-xl border border-violet-800/50 bg-primary/50/30 px-4 py-2.5 text-xs text-primary/80">
            <span>✨ Sign in to save conversations & get more daily messages</span>
            <a href="/api/auth/google" className="flex-shrink-0 font-semibold text-primary hover:text-violet-200 underline underline-offset-2">Sign in</a>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center mb-5 shadow-lg shadow-violet-900/40">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Ask M.A.I.A anything</h2>
              <p className="text-muted-foreground text-sm mb-8 max-w-sm">
                Your AI study partner for nursing pharmacology, pathophysiology, and NCLEX prep.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="text-left px-4 py-3 rounded-xl border border-border/80 hover:border-primary hover:bg-primary/50/30 text-foreground/80 hover:text-white text-sm transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-tr-sm"
                    : "bg-card/60 text-foreground/40 rounded-tl-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                  <div className={PROSE_CLASSES}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents()}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  <button
                    type="button"
                    onClick={() => reportAnswer(idx, msg.content)}
                    disabled={reportingId === idx || reportedIds.has(idx)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border/80 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-amber-500/50 hover:text-amber-200 disabled:opacity-60"
                  >
                    <AlertTriangle className="h-3 w-3" /> {reportedIds.has(idx) ? "Reported" : reportingId === idx ? "Reporting..." : "Report wrong answer"}
                  </button>
                  </>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Quick-start buttons after welcome message */}
          {messages.length === 1 && messages[0].role === "assistant" && !isStreaming && (
            <div className="flex flex-wrap gap-2 px-4 pb-4">
              {QUICK_START_BUTTONS.map((btn) => (
                <button
                  key={btn}
                  onClick={() => {
                    setInput(btn);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 hover:border-primary/50 transition"
                >
                  {btn}
                </button>
              ))}
            </div>
          )}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="max-w-[82%] rounded-2xl rounded-tl-sm bg-card/60 text-foreground/40 px-4 py-3 text-sm leading-relaxed">
                {streamingContent ? (
                  <>
                    {streamingDisplay && (
                      <div className={PROSE_CLASSES}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents()}
                        >
                          {streamingDisplay}
                        </ReactMarkdown>
                      </div>
                    )}
                    {hasOpenSpecialBlock && (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground italic">
                        <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Generating visual…
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-border">
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.docx,.csv" className="hidden" onChange={handleFileAttach} />
          {attachedFile && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/50/50 border border-violet-800/50 rounded-xl mb-2 text-xs text-primary/80">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[200px]">{attachedFile.name}</span>
              <button onClick={() => setAttachedFile(null)} className="ml-auto text-primary hover:text-white shrink-0"><XIcon className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <div className="flex items-end gap-2 bg-card/60/60 border border-border/80/60 rounded-2xl px-3 py-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={fileUploading || isStreaming}
              title="Attach file (PDF, TXT, DOCX)"
              className="flex-shrink-0 w-8 h-8 rounded-xl hover:bg-muted disabled:opacity-40 flex items-center justify-center transition-all text-muted-foreground hover:text-white"
            >
              {fileUploading ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about a drug, concept, or say 'quiz me'…"
              disabled={isStreaming}
              rows={1}
              className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm resize-none focus:outline-none disabled:opacity-50 max-h-32 leading-relaxed"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isStreaming || !input.trim()}
              className="flex-shrink-0 w-8 h-8 rounded-xl bg-primary hover:bg-primary/80 disabled:bg-muted disabled:cursor-not-allowed flex items-center justify-center transition-all"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-center text-slate-600 text-xs mt-2">Educational use only — not a substitute for clinical judgment</p>
        </div>
      </div>
    </div>
  );
}
