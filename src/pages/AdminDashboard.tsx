import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, DollarSign, Loader2, RefreshCw, ShieldAlert, Trash2, Users, Wrench, XCircle } from "lucide-react";

type DashboardData = {
  summary: {
    users: number;
    proUsers: number;
    proPlusUsers: number;
    maxUsers: number;
    freeUsers: number;
    generatedTools: number;
    pendingTools: number;
    openReports: number;
    totalAiActions: number;
    todayAiActions: number;
    estimatedTotalCost: number;
    estimatedTodayCost: number;
  };
  users: any[];
  usage: any[];
  generatedTools: any[];
  reports: any[];
  nclex: any[];
  costAssumptions: { estimatedCostPerAiAction: number; note: string };
};

const emptyData: DashboardData = {
  summary: {
    users: 0,
    proUsers: 0,
    proPlusUsers: 0,
    maxUsers: 0,
    freeUsers: 0,
    generatedTools: 0,
    pendingTools: 0,
    openReports: 0,
    totalAiActions: 0,
    todayAiActions: 0,
    estimatedTotalCost: 0,
    estimatedTodayCost: 0,
  },
  users: [],
  usage: [],
  generatedTools: [],
  reports: [],
  nclex: [],
  costAssumptions: { estimatedCostPerAiAction: 0.015, note: "Estimate" },
};

function StatCard({ title, value, sub, icon: Icon }: { title: string; value: string | number; sub?: string; icon: any }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground/80">{sub}</p>}
        </div>
        <div className="rounded-xl bg-primary/80/15 p-3 text-primary/80"><Icon className="h-6 w-6" /></div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState<"overview" | "tools" | "users" | "usage" | "reports">("overview");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/dashboard", { headers: { Accept: "application/json" } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Admin dashboard unavailable");
      setData(json);
    } catch (err: any) {
      setError(err.message || "Admin dashboard unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const recentUsage = useMemo(() => data.usage.slice(0, 20), [data.usage]);

  async function postJson(url: string, body: any) {
    setBusy(url);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Action failed");
      await load();
    } catch (err: any) {
      alert(err.message || "Action failed");
    } finally {
      setBusy("");
    }
  }

  async function deleteTool(id: string) {
    if (!confirm("Delete this generated tool? It will be moved to the deleted-tools archive.")) return;
    setBusy(`delete-${id}`);
    try {
      const res = await fetch(`/api/admin/generated-tools/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Accept: "application/json" } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Delete failed");
      await load();
    } catch (err: any) {
      alert(err.message || "Delete failed");
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-foreground/80"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading admin dashboard...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-20 text-white">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/30 bg-red-950/30 p-6">
          <ShieldAlert className="h-8 w-8 text-red-300" />
          <h1 className="mt-4 text-2xl font-bold">Admin access required</h1>
          <p className="mt-2 text-foreground/80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">Bio-Sync Admin</p>
            <h1 className="mt-2 text-4xl font-bold">Operations Dashboard</h1>
            <p className="mt-2 text-muted-foreground">Manage tools, accounts, AI usage, safety reports, and pricing signals.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-border/80 px-4 py-2 text-sm font-semibold text-foreground/60 hover:bg-card">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Users" value={data.summary.users} sub={`${data.summary.proUsers} pro · ${data.summary.proPlusUsers || 0} pro+ · ${data.summary.maxUsers || 0} max · ${data.summary.freeUsers} free`} icon={Users} />
          <StatCard title="AI actions today" value={data.summary.todayAiActions} sub={`${data.summary.totalAiActions} total`} icon={RefreshCw} />
          <StatCard title="Estimated AI cost" value={`$${data.summary.estimatedTodayCost}`} sub={`$${data.summary.estimatedTotalCost} all time`} icon={DollarSign} />
          <StatCard title="Tools / reports" value={`${data.summary.generatedTools}/${data.summary.openReports}`} sub={`${data.summary.pendingTools} pending tools`} icon={Wrench} />
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          {[
            ["overview", "Overview"],
            ["tools", "Generated Tools"],
            ["users", "Accounts"],
            ["usage", "Usage & Cost"],
            ["reports", "Reports"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key as any)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === key ? "bg-primary text-white" : "bg-card text-muted-foreground hover:text-white"}`}>{label}</button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card/60 p-5">
              <h2 className="text-xl font-bold">Recent AI usage</h2>
              <div className="mt-4 space-y-2">
                {recentUsage.length === 0 && <p className="text-sm text-muted-foreground/80">No usage yet.</p>}
                {recentUsage.map((row) => <div key={row.file} className="flex items-center justify-between rounded-xl bg-background/70 p-3 text-sm"><span>{row.email || row.userId} · {row.date}</span><span className="text-primary/80">{row.messages} actions · ${row.estimatedCost}</span></div>)}
              </div>
            </section>
            <section className="rounded-2xl border border-border bg-card/60 p-5">
              <h2 className="text-xl font-bold">NCLEX progress</h2>
              <div className="mt-4 space-y-2">
                {data.nclex.length === 0 && <p className="text-sm text-muted-foreground/80">No NCLEX attempts yet.</p>}
                {data.nclex.slice(0, 10).map((row) => <div key={row.userId} className="flex items-center justify-between rounded-xl bg-background/70 p-3 text-sm"><span>{row.email || row.userId}</span><span className="text-emerald-300">{row.right}/{row.total} · {row.percent}%</span></div>)}
              </div>
            </section>
          </div>
        )}

        {tab === "tools" && (
          <section className="space-y-3">
            {data.generatedTools.map((tool) => (
              <div key={tool.id} className="rounded-2xl border border-border bg-card/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{tool.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tool.status === "approved" ? "bg-emerald-500/20 text-emerald-200" : tool.status === "rejected" ? "bg-red-500/20 text-red-200" : "bg-amber-500/20 text-amber-200"}`}>{tool.status || "approved"}</span>
                    </div>
                    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{tool.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground/80">{tool.id} · {tool.ownerEmail || "legacy/shared"} · updated {tool.updatedAt || tool.createdAt || "unknown"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={!!busy} onClick={() => postJson(`/api/admin/generated-tools/${encodeURIComponent(tool.id)}/review`, { status: "approved" })} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold hover:bg-emerald-500"><CheckCircle2 className="h-4 w-4" /> Approve</button>
                    <button disabled={!!busy} onClick={() => postJson(`/api/admin/generated-tools/${encodeURIComponent(tool.id)}/review`, { status: "rejected" })} className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold hover:bg-amber-500"><XCircle className="h-4 w-4" /> Reject</button>
                    <button disabled={!!busy} onClick={() => deleteTool(tool.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-950"><Trash2 className="h-4 w-4" /> Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {tab === "users" && (
          <section className="overflow-hidden rounded-2xl border border-border bg-card/70">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-background text-xs uppercase tracking-wider text-muted-foreground/80"><tr><th className="p-3">User</th><th className="p-3">Plan</th><th className="p-3">Subscription</th><th className="p-3">Created</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {data.users.map((u) => <tr key={u.id} className="border-t border-border"><td className="p-3"><div className="font-semibold text-white">{u.email}</div><div className="text-xs text-muted-foreground/80">{u.id}</div></td><td className="p-3">{u.plan}</td><td className="p-3">{u.subscriptionStatus || "—"}</td><td className="p-3 text-muted-foreground">{u.createdAt || "—"}</td><td className="p-3"><div className="flex gap-1 flex-wrap"><button onClick={() => postJson(`/api/admin/users/${encodeURIComponent(u.id)}`, { plan: "max" })} className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold">Max</button><button onClick={() => postJson(`/api/admin/users/${encodeURIComponent(u.id)}`, { plan: "pro_plus" })} className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold">Pro+</button><button onClick={() => postJson(`/api/admin/users/${encodeURIComponent(u.id)}`, { plan: "pro" })} className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold">Pro</button><button onClick={() => postJson(`/api/admin/users/${encodeURIComponent(u.id)}`, { plan: "free" })} className="rounded-lg border border-border/80 px-2 py-1 text-xs font-semibold text-foreground/80">Free</button></div></td></tr>)}
              </tbody>
            </table>
          </section>
        )}

        {tab === "usage" && (
          <section className="rounded-2xl border border-border bg-card/70 p-5">
            <h2 className="text-xl font-bold">Usage & cost estimate</h2>
            <p className="mt-1 text-sm text-muted-foreground/80">{data.costAssumptions.note}</p>
            <div className="mt-4 max-h-[620px] overflow-y-auto space-y-2">
              {data.usage.map((row) => <div key={row.file} className="grid gap-2 rounded-xl bg-background/70 p-3 text-sm md:grid-cols-4"><span>{row.date}</span><span>{row.email || row.userId}</span><span>{row.messages} AI actions</span><span className="text-primary/80">${row.estimatedCost}</span></div>)}
            </div>
          </section>
        )}

        {tab === "reports" && (
          <section className="space-y-3">
            {data.reports.length === 0 && <p className="text-muted-foreground/80">No reports yet.</p>}
            {data.reports.map((report) => (
              <div key={report.id} className="rounded-2xl border border-border bg-card/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-4xl">
                    <div className="flex items-center gap-2"><h3 className="font-bold">{report.context || "chat"}</h3><span className={`rounded-full px-2 py-0.5 text-xs ${report.status === "closed" ? "bg-muted text-foreground/80" : "bg-red-500/20 text-red-200"}`}>{report.status || "open"}</span></div>
                    <p className="mt-2 text-xs text-muted-foreground/80">{report.email || "anonymous"} · {report.createdAt}</p>
                    <p className="mt-3 whitespace-pre-wrap rounded-xl bg-background/70 p-3 text-sm text-foreground/80"><strong>Prompt:</strong> {report.prompt || "—"}</p>
                    <p className="mt-2 whitespace-pre-wrap rounded-xl bg-background/70 p-3 text-sm text-foreground/80"><strong>Answer:</strong> {String(report.answer || "—").slice(0, 1200)}</p>
                  </div>
                  <button onClick={() => postJson(`/api/admin/reports/${encodeURIComponent(report.id)}`, { status: report.status === "closed" ? "open" : "closed" })} className="rounded-lg border border-border/80 px-3 py-2 text-xs font-semibold text-foreground/60 hover:bg-card/60">{report.status === "closed" ? "Reopen" : "Close"}</button>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
