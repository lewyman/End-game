import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";

type ReviewData = { tools: any[]; reports: any[] };

export default function AdminReview() {
  const [data, setData] = useState<ReviewData>({ tools: [], reports: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/review", { headers: { Accept: "application/json" } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Admin review failed");
      setData(json);
    } catch (e: any) {
      setError(e.message || "Could not load review queue");
    } finally {
      setLoading(false);
    }
  }

  async function reviewTool(id: string, status: "approved" | "rejected") {
    const res = await fetch(`/api/admin/generated-tools/${encodeURIComponent(id)}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Admin Review</h1>
            <p className="mt-2 text-muted-foreground">Approve generated tools and review wrong-answer reports.</p>
          </div>
          <button onClick={load} className="rounded-xl border border-border/80 px-4 py-2 text-sm font-semibold text-foreground/60 hover:bg-card/60">Refresh</button>
        </div>

        {loading && <div className="rounded-2xl border border-border bg-card p-6 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>}
        {error && <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-red-200">{error}</div>}

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Generated tools</h2>
          {data.tools.length === 0 && !loading ? <p className="text-muted-foreground/80">No tools found.</p> : null}
          <div className="grid gap-4 md:grid-cols-2">
            {data.tools.map((tool) => (
              <div key={tool.id} className="rounded-2xl border border-border bg-card/70 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white">{tool.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground/80">Status: {tool.status || "approved"} · Owner: {tool.ownerEmail || "legacy"}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${(tool.status || "approved") === "approved" ? "bg-emerald-950 text-emerald-200" : tool.status === "rejected" ? "bg-red-950 text-red-200" : "bg-amber-950 text-amber-200"}`}>{tool.status || "approved"}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => reviewTool(tool.id, "approved")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold hover:bg-emerald-500"><CheckCircle2 className="h-4 w-4" />Approve</button>
                  <button onClick={() => reviewTool(tool.id, "rejected")} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold hover:bg-red-500"><XCircle className="h-4 w-4" />Reject</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Wrong-answer reports</h2>
          {data.reports.length === 0 && !loading ? <p className="text-muted-foreground/80">No reports yet.</p> : null}
          <div className="space-y-4">
            {data.reports.map((report) => (
              <div key={report.id} className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-5">
                <div className="flex items-center gap-2 text-amber-200"><ShieldAlert className="h-5 w-5" /><strong>{report.context}</strong><span className="text-xs text-muted-foreground/80">{report.email || "anonymous"} · {new Date(report.createdAt).toLocaleString()}</span></div>
                {report.note ? <p className="mt-3 text-sm text-amber-100">Note: {report.note}</p> : null}
                <details className="mt-3 text-sm text-foreground/80"><summary className="cursor-pointer text-muted-foreground">Prompt / answer</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-3 text-xs">Prompt:\n{report.prompt}\n\nAnswer:\n{report.answer}</pre></details>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
