import { Link } from "react-router-dom";
import { useState } from "react";
import { Stethoscope, ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";

const categories = [
  { name: "Vital Signs & Monitoring", items: ["Manual BP (auscultatory method)", "Pulse ox interpretation (SpO2)", "Cardiac monitor rhythm analysis", "Temperature assessment (tympanic, temporal)", "Respiratory assessment (rate, depth, effort)", "MAP calculation and significance"] },
  { name: "IV Access & Therapy", items: ["Peripheral IV insertion (adult)", "Central line dressing change", "PICC line care and flushing", "Arterial line waveform interpretation", "IV pump programming (PCA, tube feeding)", "Blood transfusion verification (two-patient ID)"] },
  { name: "Wound Care", items: ["Wound assessment (depth, drainage, edges)", "Pressure injury staging (1-4 + DTI)", "Sterile dressing change technique", "Wound VAC therapy basics", "Surgical site infection signs", "Diabetic foot ulcer debridement"] },
  { name: "Airway & Breathing", items: ["O2 delivery devices (nasal cannula to vent)", "Suctioning (oral, ET, trach)", "Tracheostomy care (inner cannula cleaning)", "BiPAP/CPAP mask fitting", "Peak flow interpretation", "ABG interpretation (respiratory vs metabolic)"] },
  { name: "Foley & Urinary", items: ["Foley catheter insertion (female)", "Foley catheter insertion (male)", "Suprapubic catheter care", "Bladder scan interpretation", "Urine specimen collection (straight cath)", "Condom catheter application"] },
  { name: "NG & Enteral", items: ["NG tube placement verification (pH, X-ray)", "NG tube flushing protocol", "G-tube and J-tube care", "Bolus feeding technique", "Medication administration via NG (liquid vs crush)", "Jejunostomy tube management"] },
];

export default function ClinicalSkills() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = categories
    .map(cat => ({ ...cat, items: cat.items.filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()) || cat.name.toLowerCase().includes(searchTerm.toLowerCase())) }))
    .filter(cat => cat.items.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
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
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/30">
            <Stethoscope className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">Clinical Skills</h1>
            <p className="text-slate-400 mt-1">Procedures & competency checklists</p>
          </div>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search skills..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="grid gap-4">
          {filtered.map(cat => (
            <div key={cat.name} className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
              <button
                onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-700/20 transition"
              >
                <span className="text-lg font-semibold text-emerald-300">{cat.name}</span>
                {expandedCategory === cat.name
                  ? <ChevronDown className="w-5 h-5 text-slate-400" />
                  : <ChevronRight className="w-5 h-5 text-slate-400" />}
              </button>
              {expandedCategory === cat.name && (
                <div className="px-6 pb-4 grid gap-2">
                  {cat.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-slate-300 text-sm py-2 border-t border-slate-700/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 bg-gradient-to-r from-emerald-500/10 to-green-600/10 rounded-xl border border-emerald-500/20">
          <p className="text-sm text-slate-300">
            <strong className="text-emerald-300">Coming soon:</strong> Step-by-step procedural videos with AI narration for each skill.
          </p>
        </div>
      </div>
    </div>
  );
}
