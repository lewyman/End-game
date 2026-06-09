import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, Loader2, Shield, Stethoscope, Activity, Syringe, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import { useZoAuth } from "../lib/auth";
import AuthGate from "../components/AuthGate";

interface ProcedureSummary { id: string; title: string; category: string; icon: string; summary: string; }
interface Procedure extends ProcedureSummary { equipment?: string[]; steps?: string[]; nursing_considerations?: string[]; }

const CATEGORY_COLORS: Record<string, string> = {
  "Vascular Access": "bg-blue-900/30 text-blue-300 border-blue-800/50",
  "Wound Management": "bg-green-900/30 text-green-300 border-green-800/50",
  "Genitourinary": "bg-yellow-900/30 text-yellow-300 border-yellow-800/50",
  "GI Access": "bg-orange-900/30 text-orange-300 border-orange-800/50",
  "Specimen Collection": "bg-purple-900/30 text-purple-300 border-purple-800/50",
  "Medication Safety": "bg-primary/60/30 text-primary/80 border-violet-800/50",
  "Assessment": "bg-teal-900/30 text-teal-300 border-teal-800/50",
  "Respiratory": "bg-sky-900/30 text-sky-300 border-sky-800/50",
  "Cardiac Monitoring": "bg-red-900/30 text-red-300 border-red-800/50",
  "Airway Management": "bg-rose-900/30 text-rose-300 border-rose-800/50",
  "Infection Control": "bg-lime-900/30 text-lime-300 border-lime-800/50",
  "Patient Safety": "bg-muted/40 text-foreground/60 border-border/60/50",
};

function ProcedureIcon({ icon, className }: { icon: string; className?: string }) {
  if (icon === "syringe") return <Syringe className={className} />;
  if (icon === "shield") return <Shield className={className} />;
  return <Activity className={className} />;
}

function ProcedureListPage() {
  const { getToken } = useZoAuth();
  const [procedures, setProcedures] = useState<ProcedureSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await fetch("/api/procedures", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setProcedures(await res.json());
      setLoading(false);
    })();
  }, [getToken]);

  const grouped = procedures.reduce<Record<string, ProcedureSummary[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p); return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background text-white pb-16">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Nursing Procedures</h1>
          <p className="text-muted-foreground text-sm">Step-by-step reference guides for common clinical procedures.</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([category, procs]) => (
              <div key={category}>
                <h2 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider mb-3">{category}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {procs.map((p) => (
                    <Link key={p.id} to={`/procedures/${p.id}`} className="flex items-start gap-4 bg-card border border-border hover:border-violet-700/50 rounded-2xl p-4 transition-all group">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${CATEGORY_COLORS[p.category] || "bg-card/60 text-muted-foreground border-border/80"}`}>
                        <ProcedureIcon icon={p.icon} className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm group-hover:text-primary/80 transition-colors">{p.title}</p>
                        <p className="text-muted-foreground/80 text-xs mt-0.5 line-clamp-2">{p.summary}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-primary shrink-0 mt-1 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProcedureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useZoAuth();
  const [proc, setProc] = useState<Procedure | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await fetch(`/api/procedures/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setProc(await res.json());
      setLoading(false);
    })();
  }, [id, getToken]);

  if (loading) return <div className="min-h-screen bg-background flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  if (!proc) return <div className="min-h-screen bg-background text-center py-20 text-muted-foreground/80">Procedure not found.</div>;

  const catColor = CATEGORY_COLORS[proc.category] || "bg-card/60 text-muted-foreground border-border/80";

  return (
    <div className="min-h-screen bg-background text-white pb-16">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link to="/procedures" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> All Procedures
        </Link>
        <div className="flex items-start gap-4 mb-8">
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${catColor}`}>
            <ProcedureIcon icon={proc.icon} className="w-7 h-7" />
          </div>
          <div>
            <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full border mb-2 ${catColor}`}>{proc.category}</span>
            <h1 className="text-2xl font-bold text-white">{proc.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">{proc.summary}</p>
          </div>
        </div>

        {/* Equipment */}
        {(proc.equipment && proc.equipment.length > 0) && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5">
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><Stethoscope className="w-4 h-4 text-primary" /> Equipment Needed</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {(proc.equipment || []).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-foreground/80 text-sm">
                <span className="text-primary mt-0.5">·</span> {item}
              </li>
            ))}
          </ul>
        </div>
        )}

        {/* Steps */}
        {(proc.steps && proc.steps.length > 0) && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Procedure Steps</h2>
          <ol className="space-y-3">
            {(proc.steps || []).map((step, i) => {
              const isSubStep = step.startsWith("  ");
              return (
                <li key={i} className={`flex gap-3 text-sm ${isSubStep ? "ml-6" : ""}`}>
                  {!isSubStep && <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 border border-violet-700/50 text-primary/80 text-xs flex items-center justify-center font-semibold">{i + 1}</span>}
                  {isSubStep && <span className="text-slate-600 shrink-0">→</span>}
                  <span className="text-foreground/80 leading-relaxed">{step.trim()}</span>
                </li>
              );
            })}
          </ol>
        </div>
        )}

        {/* Nursing considerations */}
        {(proc.nursing_considerations && proc.nursing_considerations.length > 0) && (
        <div className="bg-amber-900/10 border border-amber-800/30 rounded-2xl p-5">
          <h2 className="text-amber-300 font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Nursing Considerations</h2>
          <ul className="space-y-2">
            {(proc.nursing_considerations || []).map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="text-amber-500 mt-0.5 shrink-0">!</span> {note}
              </li>
            ))}
          </ul>
        </div>
        )}
      </div>
    </div>
  );
}

export function ProceduresListPage() {
  return <AuthGate message="Sign in to access Nursing Procedure guides."><ProcedureListPage /></AuthGate>;
}

export function ProcedureDetailRoute() {
  return <AuthGate message="Sign in to access Nursing Procedure guides."><ProcedureDetailPage /></AuthGate>;
}
