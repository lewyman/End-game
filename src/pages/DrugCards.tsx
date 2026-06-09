import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, BookOpen, ChevronDown, ChevronUp, FlaskConical, HeartPulse, Loader2, Pill, Search, ShieldAlert, Siren, Stethoscope, X } from "lucide-react";
import AuthGate from "../components/AuthGate";

interface DrugDirectoryItem {
  id: string;
  entryName?: string;
  genericName: string;
  canonicalGeneric?: string;
  brandName?: string;
  brandNames: string[];
  productNdc?: string;
  routes: string[];
  dosageForm?: string;
  dosageForms: string[];
  manufacturer?: string;
  productType?: string;
  marketingCategory?: string;
  substances: string[];
  productCount: number;
  pharmClasses: string[];
}

interface DrugCardData {
  query: string;
  displayName?: string;
  source: string;
  filter?: { route: string | null; form: string | null };
  totalLabelResults: number;
  filteredLabelResults?: number;
  label: Record<string, unknown>;
  summary?: {
    routes: string[];
    dosageForms: string[];
    genericNames: string[];
    brandNames: string[];
    manufacturers: string[];
    ndcTotal: number;
    filteredNdcTotal?: number;
  };
  adverseEventCount: number | null;
  recallCount: number | null;
  ndcProducts: Array<{ brandName?: string; genericName?: string; dosageForm?: string; route?: string[]; productNdc?: string }>;
}

const sections = [
  { key: "active_ingredient", title: "Active Ingredient", icon: FlaskConical, tone: "emerald" },
  { key: "purpose", title: "Purpose", icon: BadgeCheck, tone: "violet" },
  { key: "uses", title: "Uses", icon: BookOpen, tone: "blue" },
  { key: "warnings", title: "Warnings", icon: AlertTriangle, tone: "amber" },
  { key: "do_not_use", title: "Do Not Use", icon: ShieldAlert, tone: "red" },
  { key: "ask_doctor", title: "Ask a Doctor Before Use", icon: Stethoscope, tone: "fuchsia" },
  { key: "ask_doctor_or_pharmacist", title: "Ask Doctor or Pharmacist", icon: Stethoscope, tone: "fuchsia" },
  { key: "stop_use", title: "Stop Use & Ask Doctor", icon: Siren, tone: "rose" },
  { key: "directions", title: "Directions", icon: Pill, tone: "blue" },
  { key: "overdosage", title: "Overdosage", icon: Siren, tone: "orange" },
  { key: "inactive_ingredient", title: "Inactive Ingredients", icon: FlaskConical, tone: "emerald" },
  { key: "questions", title: "Questions / Contact Info", icon: BookOpen, tone: "violet" },
  { key: "indications_and_usage", title: "Indications & Usage", icon: BookOpen, tone: "violet" },
  { key: "boxed_warning", title: "Boxed Warning", icon: Siren, tone: "rose" },
  { key: "contraindications", title: "Contraindications", icon: ShieldAlert, tone: "red" },
  { key: "adverse_reactions", title: "Adverse Reactions", icon: AlertTriangle, tone: "amber" },
  { key: "drug_interactions", title: "Drug Interactions", icon: HeartPulse, tone: "fuchsia" },
  { key: "mechanism_of_action", title: "Mechanism of Action", icon: FlaskConical, tone: "blue" },
  { key: "pregnancy", title: "Pregnancy / Reproductive Risk", icon: Stethoscope, tone: "emerald" },
  { key: "drug_abuse_and_dependence", title: "Abuse & Dependence", icon: ShieldAlert, tone: "orange" },
];

function asText(value: unknown): string {
  if (Array.isArray(value)) return value.join("\n\n");
  return typeof value === "string" ? value : "";
}

function shortText(value: unknown, max = 900): string {
  const text = asText(value).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function toneClass(tone: string) {
  const map: Record<string, string> = {
    violet: "border-primary/30 bg-primary/50/20 text-primary/80",
    rose: "border-rose-500/40 bg-rose-950/30 text-rose-300",
    red: "border-red-500/40 bg-red-950/25 text-red-300",
    amber: "border-amber-500/35 bg-amber-950/20 text-amber-300",
    fuchsia: "border-[#0d7a47]/35 bg-fuchsia-950/20 text-fuchsia-300",
    blue: "border-[#1a5fa8]/35 bg-blue-950/20 text-blue-300",
    emerald: "border-emerald-500/35 bg-emerald-950/20 text-emerald-300",
    orange: "border-orange-500/35 bg-orange-950/20 text-orange-300",
  };
  return map[tone] || map.violet;
}

function hasFdaTableMarkup(value: unknown): boolean {
  return asText(value).includes("<table");
}

function nodeToText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") return "\n";
  if (tag === "item") return `• ${Array.from(el.childNodes).map(nodeToText).join("").trim()}`;
  if (tag === "list") return Array.from(el.childNodes).map(nodeToText).filter(Boolean).join("\n");
  return Array.from(el.childNodes).map(nodeToText).join("");
}

function parseFdaTables(value: unknown) {
  const raw = asText(value);
  if (!raw.includes("<table")) return [];
  const doc = new DOMParser().parseFromString(`<root>${raw}</root>`, "text/html");
  return Array.from(doc.querySelectorAll("table")).map((table, tableIndex) => {
    const rows = Array.from(table.querySelectorAll("tr")).map((tr, rowIndex) =>
      Array.from(tr.children).filter((child) => ["td", "th"].includes(child.tagName.toLowerCase())).map((cell, cellIndex) => ({
        key: `${tableIndex}-${rowIndex}-${cellIndex}`,
        text: nodeToText(cell).replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").replace(/[ \t]{2,}/g, " ").trim(),
        colspan: Number(cell.getAttribute("colspan") || 1),
      })),
    ).filter((row) => row.length > 0);
    return { key: `table-${tableIndex}`, rows };
  }).filter((table) => table.rows.length > 0);
}

function FdaValueRenderer({ value }: { value: unknown }) {
  const tables = parseFdaTables(value);
  if (tables.length) {
    return (
      <div className="space-y-5">
        {tables.map((table) => (
          <div key={table.key} className="overflow-x-auto rounded-xl border border-border/80 bg-background/80">
            <table className="min-w-full border-collapse text-left text-sm">
              <tbody className="divide-y divide-border">
                {table.rows.map((row, rowIndex) => (
                  <tr key={`${table.key}-${rowIndex}`} className={rowIndex % 2 ? "bg-card/40" : "bg-background/20"}>
                    {row.map((cell) => (
                      <td key={cell.key} colSpan={cell.colspan} className="min-w-[220px] whitespace-pre-wrap border-r border-border px-4 py-3 align-top leading-6 text-foreground/80 last:border-r-0">
                        {cell.text || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }
  return <div className="whitespace-pre-wrap">{asText(value)}</div>;
}

function DataSection({ title, icon: Icon, tone, value }: { title: string; icon: any; tone: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  const full = asText(value).trim();
  const preview = hasFdaTableMarkup(value) ? "This FDA section contains structured table data. Expand to view it as a responsive table." : shortText(value, 360);
  if (!full) return null;
  return (
    <section className="rounded-2xl border border-border bg-card/70 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-card/60/60 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${toneClass(tone)}`}><Icon className="w-5 h-5" /></div>
          <div><h2 className="text-lg font-semibold text-white">{title}</h2><p className="text-xs text-muted-foreground/80">FDA label section</p></div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-muted-foreground/80" /> : <ChevronDown className="w-5 h-5 text-muted-foreground/80" />}
      </button>
      <div className="px-5 pb-5 text-sm leading-7 text-foreground/80">
        {open ? <FdaValueRenderer value={value} /> : <div className="whitespace-pre-wrap">{preview}</div>}
        {!open && full.length > preview.length && <div className="mt-3 text-xs font-semibold text-primary/80">Show full section ↓</div>}
        {open && <button type="button" onClick={() => setOpen(false)} className="mt-4 rounded-lg border border-border/80 px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-card/60">Collapse section ↑</button>}
      </div>
    </section>
  );
}

function ChipList({ items, activeType, activeFilter, onSelect, empty = "Not found in sampled records" }: { items: string[]; activeType?: "route" | "form"; activeFilter?: { type: "route" | "form"; value: string } | null; onSelect?: (item: string) => void; empty?: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground/80">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = activeType && activeFilter?.type === activeType && activeFilter.value === item;
        return onSelect ? (
          <button key={item} type="button" onClick={() => onSelect(item)} className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${active ? "border-violet-400 bg-primary text-white shadow-lg shadow-violet-950/40" : "border-border/80 bg-background text-foreground/80 hover:border-primary hover:text-white"}`}>
            {item}{active ? " ×" : ""}
          </button>
        ) : <span key={item} className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-foreground/80">{item}</span>;
      })}
    </div>
  );
}

function ProductGrid({ products }: { products: DrugCardData["ndcProducts"] }) {
  if (!products.length) return <div className="rounded-xl border border-border bg-background/70 p-4 text-sm text-muted-foreground/80">No matching NDC products found in openFDA.</div>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {products.map((product) => (
        <div key={product.productNdc || `${product.brandName}-${product.dosageForm}`} className="rounded-xl border border-border bg-background/70 p-4">
          <div className="font-medium text-foreground/40">{product.brandName || product.genericName || "Drug product"}</div>
          <div className="mt-1 text-xs text-muted-foreground/80">NDC: {product.productNdc || "—"}</div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {product.dosageForm && <span className="rounded-full bg-blue-950/50 px-2 py-1 text-blue-300">{product.dosageForm}</span>}
            {(product.route || []).map((route) => <span key={route} className="rounded-full bg-primary/50/50 px-2 py-1 text-primary/80">{route}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function DrugDirectory({ selectedDrug, onSelect }: { selectedDrug: string; onSelect: (drug: DrugDirectoryItem) => void }) {
  const [query, setQuery] = useState("");
  const [drugs, setDrugs] = useState<DrugDirectoryItem[]>([]);
  const [meta, setMeta] = useState({ totalIndexedDrugs: 0, totalIndexedEntries: 0, totalProducts: 0, totalMatches: 0, exportDate: "" });
  const [loading, setLoading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const pageSize = 200;
  const batchSize = 5000;

  const fetchDrugs = async (nextOffset = 0, replace = false, signal?: AbortSignal, customLimit = pageSize) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(customLimit), offset: String(nextOffset) });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/drugs?${params.toString()}`, { headers: { Accept: "application/json" }, signal });
      const json = await res.json();
      setDrugs((prev) => replace ? (json.drugs || []) : [...prev, ...(json.drugs || [])]);
      setMeta({ totalIndexedDrugs: json.totalIndexedDrugs || 0, totalIndexedEntries: json.totalIndexedEntries || json.totalProducts || 0, totalProducts: json.totalProducts || 0, totalMatches: json.totalMatches || 0, exportDate: json.exportDate || "" });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchDrugs(0, true, controller.signal), 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const hasMore = drugs.length < meta.totalMatches;
  const loadMore = () => { if (!loading && hasMore) fetchDrugs(drugs.length, false); };

  const loadAll = async () => {
    if (loadingAll || !hasMore) return;
    setLoadingAll(true);
    let offset = drugs.length;
    try {
      while (offset < meta.totalMatches) {
        const before = offset;
        await fetchDrugs(offset, false, undefined, batchSize);
        offset = Math.min(offset + batchSize, meta.totalMatches);
        if (offset === before) break;
      }
    } finally {
      setLoadingAll(false);
    }
  };

  return (
    <aside className="rounded-3xl border border-border bg-card/80 p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-hidden">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Drug Directory</h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
        <p className="mt-1 text-xs text-muted-foreground/80">{meta.totalIndexedEntries.toLocaleString()} FDA entries from {meta.totalProducts.toLocaleString()} FDA NDC products</p>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search morphine, insulin, lisinopril…" className="w-full rounded-2xl border border-border/80 bg-background py-3 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-primary focus:outline-none" />
      </div>
      <div className="mb-3 text-xs text-muted-foreground/80">Showing {drugs.length} of {meta.totalMatches.toLocaleString()} matches</div>
      <div className="space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-18rem)]">
        {drugs.map((drug) => {
          const active = drug.genericName.toLowerCase() === selectedDrug.toLowerCase();
          return (
            <button key={drug.id} type="button" onClick={() => onSelect(drug)} className={`w-full rounded-2xl border p-4 text-left transition-all ${active ? "border-primary bg-primary/50/40" : "border-border bg-background/60 hover:border-violet-700 hover:bg-card"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{drug.entryName || drug.genericName}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground/80">{drug.brandName || drug.brandNames.slice(0, 4).join(", ") || "No brand names listed"}</div>
                  {drug.productNdc && <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">NDC {drug.productNdc}</div>}
                  {drug.manufacturer && <div className="mt-1 truncate text-[10px] text-slate-600">{drug.manufacturer}</div>}
                </div>
                <div className="rounded-full bg-card/60 px-2 py-1 text-xs text-muted-foreground">{drug.dosageForm || drug.productCount}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {drug.routes.slice(0, 4).map((route) => <span key={route} className="rounded-full bg-primary/50/50 px-2 py-0.5 text-[10px] text-primary/80">{route}</span>)}
              </div>
            </button>
          );
        })}
        <div className="py-3">
          {hasMore ? (
            <div className="flex flex-col gap-2">
              <button type="button" onClick={loadMore} disabled={loading} className="w-full rounded-xl border border-primary/30 bg-primary/50/20 px-4 py-3 text-sm font-semibold text-violet-200 hover:bg-primary/60/30 disabled:opacity-50">
                {loading ? "Loading…" : "Load more FDA entries"}
              </button>
              <button type="button" onClick={loadAll} disabled={loadingAll || !hasMore} className="w-full rounded-xl border border-primary/30 bg-primary/50/20 px-4 py-3 text-sm font-semibold text-violet-200 hover:bg-primary/60/30 disabled:opacity-50">
                {loadingAll ? "Loading…" : "Load all FDA entries"}
              </button>
            </div>
          ) : meta.totalMatches > 0 ? (
            <div className="text-center text-xs text-muted-foreground/80">All matching FDA entries loaded</div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export default function DrugCards() {
  const [selectedDrug, setSelectedDrug] = useState("morphine");
  const [selectedDrugTitle, setSelectedDrugTitle] = useState("Morphine");
  const [data, setData] = useState<DrugCardData | null>(null);
  const [filterData, setFilterData] = useState<DrugCardData | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<{ type: "route" | "form"; value: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDrug(drugName: string, title = drugName) {
    setSelectedDrug(drugName);
    setSelectedDrugTitle(title);
    setFilterData(null);
    setActiveFilter(null);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/drug-cards/${encodeURIComponent(drugName)}`, { headers: { Accept: "application/json" } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to load ${title} card`);
      setData({ ...json, displayName: title });
      setTimeout(() => document.getElementById("drug-card-main")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${title} card`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDrug("morphine", "Morphine"); }, []);

  const loadFilter = async (type: "route" | "form", value: string) => {
    if (activeFilter?.type === type && activeFilter.value === value) {
      clearFilter();
      setTimeout(() => document.getElementById("routes-forms-card")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      return;
    }
    setActiveFilter({ type, value });
    setFilterLoading(true);
    setFilterData(null);
    try {
      const params = new URLSearchParams({ [type]: value });
      const res = await fetch(`/api/drug-cards/${encodeURIComponent(selectedDrug)}/filter?${params.toString()}`, { headers: { Accept: "application/json" } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load filtered FDA data");
      setFilterData(json);
      setTimeout(() => document.getElementById("route-form-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      console.error(err);
      setFilterData(null);
    } finally {
      setFilterLoading(false);
    }
  };

  const clearFilter = () => { setActiveFilter(null); setFilterData(null); };

  const highlights = useMemo(() => {
    if (!data) return [];
    return [
      { label: "FDA label results", value: data.totalLabelResults.toLocaleString() },
      { label: "Adverse event reports", value: data.adverseEventCount?.toLocaleString() || "—" },
      { label: "FDA recall records", value: data.recallCount?.toLocaleString() || "—" },
      { label: "NDC products sampled", value: data.ndcProducts.length.toString() },
    ];
  }, [data]);

  function formatFieldTitle(key: string): string {
    return key
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function OtherFdaDataSection({ data }: { data: unknown }) {
    const fields = data && typeof data === "object" && !Array.isArray(data) ? Object.entries(data as Record<string, unknown>) : [];
    if (!fields.length) return null;
    return (
      <section className="rounded-2xl border border-border bg-card/70 overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border flex items-center justify-center border-border/60 bg-background text-foreground/80"><BookOpen className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg font-semibold text-white">Other FDA Label Data</h2>
              <p className="text-xs text-muted-foreground/80">All additional openFDA fields not shown above</p>
            </div>
          </div>
        </div>
        <div className="divide-y divide-border">
          {fields.map(([key, value]) => <DataSection key={key} title={formatFieldTitle(key)} icon={BookOpen} tone="violet" value={value} />)}
        </div>
      </section>
    );
  }

  return (
    <AuthGate message="Sign in to access Drug Cards and the full Drug Directory.">
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[370px_1fr]">
          <DrugDirectory selectedDrug={selectedDrugTitle} onSelect={(drug) => loadDrug(drug.canonicalGeneric || drug.genericName, drug.entryName || drug.genericName)} />

          <main id="drug-card-main" className="min-w-0">
            <div className="mb-8 rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-slate-900 to-violet-950/40 p-8 shadow-2xl shadow-violet-950/20">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/50/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary/80"><Pill className="w-3.5 h-3.5" /> Drug Cards Beta</div>
                  <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{selectedDrugTitle}</h1>
                  <p className="mt-3 max-w-2xl text-muted-foreground">Search the cached FDA NDC directory, then open a nursing-focused drug card generated from openFDA label, event, recall, and NDC data.</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted-foreground"><div className="flex items-center gap-2 text-emerald-300 font-medium"><BadgeCheck className="w-4 h-4" /> Source: openFDA</div><div className="mt-1 text-xs">Educational use only — not medical advice.</div></div>
              </div>
            </div>

            {loading && <div className="flex items-center justify-center rounded-3xl border border-border bg-card p-16 text-muted-foreground"><Loader2 className="mr-3 h-5 w-5 animate-spin text-primary" /> Loading FDA drug data…</div>}
            {error && <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6 text-red-200">{error}</div>}

            {data && !loading && (
              <>
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {highlights.map((item) => <div key={item.label} className="rounded-2xl border border-border bg-card p-5"><div className="text-2xl font-bold text-white">{item.value}</div><div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground/80">{item.label}</div></div>)}
                </div>

                <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-3 font-semibold text-white">Names</h2><p className="text-xs uppercase tracking-wider text-muted-foreground/80 mb-2">Generic</p><ChipList items={data.summary?.genericNames?.slice(0, 8) || []} /><p className="text-xs uppercase tracking-wider text-muted-foreground/80 mt-4 mb-2">Brand</p><ChipList items={data.summary?.brandNames?.slice(0, 10) || []} /></div>
                  <div id="routes-forms-card" className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-3 font-semibold text-white">Routes / Forms</h2><p className="text-xs uppercase tracking-wider text-muted-foreground/80 mb-2">Click a route to filter this drug card</p><ChipList items={data.summary?.routes || []} activeType="route" activeFilter={activeFilter} onSelect={(route) => loadFilter("route", route)} /><p className="text-xs uppercase tracking-wider text-muted-foreground/80 mt-4 mb-2">Click a dosage form to filter</p><ChipList items={(data.summary?.dosageForms || []).slice(0, 12)} activeType="form" activeFilter={activeFilter} onSelect={(form) => loadFilter("form", form)} /></div>
                  <div className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-3 font-semibold text-white">Nursing Focus</h2><ul className="space-y-2 text-sm text-muted-foreground"><li>• Check route-specific administration instructions.</li><li>• Monitor high-alert effects and contraindications.</li><li>• Use FDA label data as a source, not a substitute for clinical judgment.</li></ul></div>
                </div>

                {(filterLoading || filterData) && (
                  <div id="route-form-detail" className="mb-8 rounded-2xl border border-primary/30 bg-primary/50/20 p-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold text-white">Route/Form Specific Data</h2><p className="text-sm text-violet-200">Filtered by {activeFilter?.type}: <span className="font-semibold">{activeFilter?.value}</span></p></div><button type="button" onClick={clearFilter} className="inline-flex items-center gap-2 rounded-lg border border-border/80 px-3 py-2 text-sm text-foreground/80 hover:bg-card/60"><X className="h-4 w-4" /> Clear filter</button></div>
                    {filterLoading ? <div className="flex items-center gap-2 text-foreground/80"><Loader2 className="h-4 w-4 animate-spin" /> Loading filtered FDA data…</div> : filterData && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-background/60 p-4"><div className="text-2xl font-bold text-white">{filterData.filteredLabelResults?.toLocaleString() || "0"}</div><div className="text-xs uppercase tracking-wider text-muted-foreground/80">Matching FDA labels</div></div><div className="rounded-xl bg-background/60 p-4"><div className="text-2xl font-bold text-white">{filterData.summary?.filteredNdcTotal?.toLocaleString() || "0"}</div><div className="text-xs uppercase tracking-wider text-muted-foreground/80">Matching NDC products</div></div></div><ProductGrid products={filterData.ndcProducts} /><DataSection title="Filtered Dosage & Administration" icon={Pill} tone="blue" value={filterData.label.dosage_and_administration} /><DataSection title="Filtered Indications & Usage" icon={BookOpen} tone="violet" value={filterData.label.indications_and_usage} /></div>}
                  </div>
                )}

                <div className="mb-8 rounded-2xl border border-border bg-card p-5"><h2 className="mb-4 font-semibold text-white">Sampled FDA NDC Products</h2><ProductGrid products={data.ndcProducts} /></div>
                <div className="space-y-4">
                  {sections.map((section) => <DataSection key={section.key} title={section.title} icon={section.icon} tone={section.tone} value={data.label[section.key]} />)}
                  <OtherFdaDataSection data={data.label.other_fda_label_data} />
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
