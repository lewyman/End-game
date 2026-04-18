import { Link } from "react-router-dom";
import { useState } from "react";
import { HeartPulse, ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";

const categories = [
  { name: "Cardiac", items: ["Post-MI care (0-24h, 24-72h, discharge)", "Heart failure exacerbation", "Cardiac surgery recovery (CABG, valve)", "Pacemaker/ICD management", "Pericarditis and myocarditis", "Peripheral arterial disease"] },
  { name: "Pulmonary", items: ["COPD exacerbation management", "Pneumonia care (lobar, aspiration)", "Thoracotomy and chest tube management", "Lung cancer post-op care", "Pulmonary hypertension", "Tuberculosis isolation and care"] },
  { name: "GI", items: ["Colorectal surgery recovery", "Cholecystectomy post-op care", "GI cancer nutrition support", "Acute pancreatitis severe pancreatitis", "Liver transplant recipient care", "IBD flare management (Crohn's, UC)"] },
  { name: "Ortho", items: ["Total hip/knee replacement recovery", "Spinal fusion post-op care", "Amputation phantom limb pain", "Fat embolism syndrome", "Compartment syndrome detection", "Osteomyelitis antibiotic therapy"] },
  { name: "Neuro", items: ["Craniotomy post-op care", "Stroke unit management (ischemic)", "Guillain-Barre syndrome", "Myasthenia gravis crisis", "Brain tumor symptomatic care", "Delirium tremens management"] },
  { name: "Oncology", items: ["Chemo-induced nausea and mucositis", "Neutropenic fever protocol", "Tumor lysis syndrome prevention", "Oncologic emergencies (SVC syndrome, spinal cord compression)", "Radiation skin care", "Hospice and end-of-life care"] },
];

export default function MedSurg() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = categories
    .map(cat => ({ ...cat, items: cat.items.filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()) || cat.name.toLowerCase().includes(searchTerm.toLowerCase())) }))
    .filter(cat => cat.items.length > 0);

  return (
    <div className="min-h-screen bg-white">
      {/* Logo - Upper Left (3 inches = 288px) */}
      <div className="absolute top-4 left-4 z-10">
        <img 
          src="/images/Bio_Logo_white-87f86ab6b807.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[288px] h-[288px] object-contain"
        />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link to="/nursing" className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to M.A.I.A.
        </Link>

        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 rounded-2xl bg-white">
            <HeartPulse className="w-10 h-10 text-orange-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">Medical-Surgical</h1>
            <p className="text-slate-400 mt-1">Surgical & disease-specific nursing care</p>
          </div>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-orange-500/50"
          />
        </div>

        <div className="grid gap-4">
          {filtered.map(cat => (
            <div key={cat.name} className="bg-white/40 rounded-xl border border-slate-700/50 overflow-hidden">
              <button
                onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/20 transition"
              >
                <span className="text-lg font-semibold text-orange-300">{cat.name}</span>
                {expandedCategory === cat.name
                  ? <ChevronDown className="w-5 h-5 text-slate-400" />
                  : <ChevronRight className="w-5 h-5 text-slate-400" />}
              </button>
              {expandedCategory === cat.name && (
                <div className="px-6 pb-4 grid gap-2">
                  {cat.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-slate-300 text-sm py-2 border-t border-slate-700/30">
                      <span className="w-2 h-2 rounded-full bg-white mt-1.5 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 bg-white">
          <p className="text-sm text-slate-300">
            <strong className="text-orange-300">Coming soon:</strong> AI case studies and NCLEX-style questions for each condition.
          </p>
        </div>
      </div>
    </div>
  );
}
