import { useCallback, useRef, useState, useEffect } from "react";
import { FileText, Trash2, Upload, Loader2, AlertCircle, BookOpen, FileIcon } from "lucide-react";
import { useZoAuth } from "../lib/auth";
import AuthGate from "../components/AuthGate";
import { Link } from "react-router-dom";

interface UserFile { id: string; name: string; size: number; type: string; uploadedAt: string; textLength: number; }

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function FileLibrary() {
  const { getToken } = useZoAuth();
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/files", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json() as UserFile[];
      setFiles(data);
    } catch { setError("Failed to load files."); }
    finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const upload = useCallback(async (file: File) => {
    setUploading(true); setError(null);
    try {
      const token = await getToken();
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/files/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json() as any;
      if (!res.ok) { setError(data.error || "Upload failed."); return; }
      setFiles((prev) => [data.file, ...prev]);
    } catch { setError("Upload failed."); }
    finally { setUploading(false); }
  }, [getToken]);

  const deleteFile = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const token = await getToken();
      await fetch(`/api/files/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } finally { setDeletingId(null); }
  }, [getToken]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  return (
    <div className="min-h-screen bg-background text-white pb-16">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">File Library</h1>
            <p className="text-muted-foreground text-sm">Upload your textbooks, notes, and study materials. Build pathways from them.</p>
          </div>
          <Link to="/pathways" className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 rounded-xl text-sm font-semibold transition-all">
            <BookOpen className="w-4 h-4" /> My Pathways
          </Link>
        </div>

        {/* Upload area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all mb-8 ${
            dragOver ? "border-primary bg-primary/80/10" : "border-border/80 hover:border-primary/80 hover:bg-card"
          }`}
        >
          <input ref={inputRef} type="file" accept=".pdf,.txt,.csv,.docx,.doc,.md" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-foreground/80 text-sm">Uploading & extracting text…</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-muted-foreground/80 mx-auto mb-3" />
              <p className="text-foreground/80 font-medium mb-1">Drop a file here or click to upload</p>
              <p className="text-muted-foreground/80 text-xs">PDF, TXT, DOCX, CSV, MD — max 20MB</p>
            </>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 mb-6 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* File list */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : files.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground/80">
            <FileIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No files yet. Upload something to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{file.name}</p>
                  <p className="text-muted-foreground/80 text-xs">{formatSize(file.size)} · {file.textLength.toLocaleString()} chars extracted · {new Date(file.uploadedAt).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => deleteFile(file.id)}
                  disabled={deletingId === file.id}
                  className="p-2 rounded-lg text-muted-foreground/80 hover:text-red-400 hover:bg-red-900/20 transition-all disabled:opacity-40"
                >
                  {deletingId === file.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FilesPage() {
  return <AuthGate message="Sign in to access your file library and build study pathways."><FileLibrary /></AuthGate>;
}
