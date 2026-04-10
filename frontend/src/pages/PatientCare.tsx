import { Link } from "react-router-dom";
import { useState } from "react";
import { Users, ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";

const categories = [
  { name: "ADLs & Mobility", items: ["ADL assessment (Barthel Index)", "ROM exercises and positioning", "Transfer techniques (pivot, mechanical lift)", "Immobility complications (DVT, skin, pneumonia)", "Ambulation with assistive devices", "Fall risk scales (Morse, Hendrich II)"] },
  { name: "Nutrition & Hydration", items: ["Nutrition screening (NRS-2002)", "Diet types (mechanical soft, cardiac, renal)", "NG/OG tube placement verification", "Enteral feeding pump programming", "Aspiration precautions", "TPN monitoring and complications"] },
  { name: "Elimination", items: ["Bowel elimination assessment", "Constipation management protocol", "Diarrhea: causes and nursing interventions", "Foley catheter care bundle", "Ostomy care basics (colostomy, ileostomy)", "Incontinence skin care (perineal care)"] },
  { name: "Pain Management", items: ["Pain scales (0-10, FLACC, PAINAD, CPOT)", "Opioid conversion calculations", "PCA pump monitoring", "Non-pharmacological pain interventions", "Substance use and pain assessment", "Equianalgesic dosing principles"] },
  { name: "Sleep & Rest", items: ["Sleep architecture and cycles", "Sleep assessment tools", "Sleep hygiene protocols", "Delirium prevention (ABCDEF bundle)", "ICU liberation bundle", "Restraints: indications and alternatives"] },
  { name: "Safety & Fall Prevention", items: ["Fall risk factors and prevention bundle", "Bed alarm protocols", "Sitter vs video monitoring", "Seizure precautions", "Suicide precautions (light room)", "Fire safety (RACE, PASS)"] },
];

export default function PatientCare() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = categories
    .map(cat => ({ ...cat, items: cat.items.filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()) || cat.name.toLowerCase().includes(searchTerm.toLowerCase())) }))
    .filter(cat => cat.items.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link to="/nursing" className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to M.A.I.A.
        </Link>

        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30">
            <Users className="w-10 h-10 text-blue-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">Patient Care</h1>
            <p className="text-slate-400 mt-1">Fundamentals & holistic nursing care</p>
          </div>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="grid gap-4">
          {filtered.map(cat => (
            <div key={cat.name} className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
              <button
                onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-700/20 transition"
              >
                <span className="text-lg font-semibold text-blue-300">{cat.name}</span>
                {expandedCategory === cat.name
                  ? <ChevronDown className="w-5 h-5 text-slate-400" />
                  : <ChevronRight className="w-5 h-5 text-slate-400" />}
              </button>
              {expandedCategory === cat.name && (
                <div className="px-6 pb-4 grid gap-2">
                  {cat.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-slate-300 text-sm py-2 border-t border-slate-700/30">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 bg-gradient-to-r from-blue-500/10 to-indigo-600/10 rounded-xl border border-blue-500/20">
          <p className="text-sm text-slate-300">
            <strong className="text-blue-300">Coming soon:</strong> AI care plan generator and patient education handouts.
          </p>
        </div>
      </div>
    </div>
  );
}
