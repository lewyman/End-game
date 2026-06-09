import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Send, Clock, User, Loader2 } from "lucide-react";
import AuthGate from "../components/AuthGate";
import { useZoAuth } from "../lib/auth";

interface Thread {
  id: string;
  title: string;
  category: string;
  author: string;
  created_at: string;
  reply_count: number;
  last_reply_at: string;
}

interface Post {
  id: string;
  thread_id: string;
  content: string;
  author: string;
  created_at: string;
}

const CATEGORIES = ["General", "Pharmacology", "NCLEX Prep", "Clinical", "Study Tips", "Pathophysiology"];

export default function Community() {
  const { user } = useZoAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [newContent, setNewContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const url = category === "all" ? "/api/community/threads" : `/api/community/threads?category=${encodeURIComponent(category)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();
      setThreads(data.threads || []);
    } catch {
      setError("Could not load threads.");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  async function fetchPosts(threadId: string) {
    try {
      const res = await fetch(`/api/community/threads/${threadId}`, { headers: { Accept: "application/json" } });
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {}
  }

  async function createThread() {
    if (!newTitle.trim() || !newContent.trim() || posting) return;
    setPosting(true);
    setError("");
    try {
      const res = await fetch("/api/community/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), category: newCategory, content: newContent.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create thread");
      setNewTitle("");
      setNewContent("");
      fetchThreads();
    } catch (e: any) {
      setError(e.message || "Failed to create thread");
    } finally {
      setPosting(false);
    }
  }

  async function postReply() {
    if (!replyText.trim() || replying || !selectedThread) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/community/threads/${selectedThread.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ content: replyText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to post reply");
      setReplyText("");
      fetchPosts(selectedThread.id);
    } catch {} finally {
      setReplying(false);
    }
  }

  function timeAgo(date: string): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  }

  return (
    <AuthGate message="Sign in to join the Bio-Sync community.">
      <div className="min-h-screen bg-[#080810] p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">

          {!selectedThread ? (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <MessageSquare className="h-7 w-7 text-primary" /> Community Hub
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">Connect with nursing students, share study tips, ask questions.</p>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-2">
                <button onClick={() => setCategory("all")} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${category === "all" ? "bg-primary text-white" : "bg-card/60 text-muted-foreground hover:bg-muted"}`}>
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setCategory(cat)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${category === cat ? "bg-primary text-white" : "bg-card/60 text-muted-foreground hover:bg-muted"}`}>
                    {cat}
                  </button>
                ))}
              </div>

              <div className="mb-6 rounded-2xl border border-border bg-card/60 p-5">
                <h2 className="text-lg font-bold text-white mb-3">Start a Discussion</h2>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Thread title, e.g. Best mnemonics for cardiac drugs?" className="w-full rounded-xl border border-border/80 bg-background p-3 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none mb-3" />
                <div className="flex flex-wrap gap-3 mb-3">
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-white outline-none">
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Write your post..." rows={3} className="w-full rounded-xl border border-border/80 bg-background p-3 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none mb-3 resize-none" />
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <button onClick={createThread} disabled={posting || !newTitle.trim() || !newContent.trim()} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/80 disabled:opacity-50">
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post Thread
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
              ) : threads.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-border bg-card/60">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No threads yet. Start the first discussion!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {threads.map((thread) => (
                    <button key={thread.id} onClick={() => { setSelectedThread(thread); fetchPosts(thread.id); }} className="w-full text-left rounded-2xl border border-border bg-card/60 p-5 hover:border-primary/40 hover:bg-card transition">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-bold text-white text-lg">{thread.title}</h3>
                        <span className="rounded-full border border-border/60 bg-background px-3 py-0.5 text-xs text-muted-foreground">{thread.category}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {thread.author}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {thread.reply_count} replies</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(thread.last_reply_at || thread.created_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setSelectedThread(null); setPosts([]); }} className="mb-4 text-sm text-primary hover:underline flex items-center gap-1">
                ← Back to Community
              </button>
              <div className="rounded-2xl border border-border bg-card/60 p-5 mb-4">
                <h2 className="text-xl font-bold text-white">{selectedThread.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{selectedThread.author}</span>
                  <span className="rounded-full border bg-background px-2 py-0.5">{selectedThread.category}</span>
                  <span>{timeAgo(selectedThread.created_at)}</span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {posts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No replies yet. Be the first!</p>
                ) : (
                  posts.map((post) => (
                    <div key={post.id} className="rounded-2xl border border-border bg-card/60 p-4">
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{post.content}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="w-3 h-3" /> {post.author} · {timeAgo(post.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card/60 p-5">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." rows={3} className="w-full rounded-xl border border-border/80 bg-background p-3 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none mb-3 resize-none" />
                <button onClick={postReply} disabled={replying || !replyText.trim()} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/80 disabled:opacity-50">
                  {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Reply
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </AuthGate>
  );
}
