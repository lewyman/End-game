import { Link } from "react-router-dom";
import { useState } from "react";
import { Zap, ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";

const categories = [
  { name: "Ventilator Management", items: ["Vent modes (AC, SIMV, PSV, APRV)", "ARDSnet protocol", "Weaning parameters (RSBI, NIF, VT)", "Vent alarm troubleshooting", "Prone positioning for ARDS", "Neuromuscular blockade monitoring"] },
  { name: "Hemodynamic Monitoring", items: ["Arterial line setup and waveforms", "CVP interpretation", "Pulmonary artery catheter data", "Cardiac output/index calculations", "Swan-Ganz interpretation (wedge, PAP, CO)", "Stroke volume variation (SVV)"] },
  { name: "Shock & Resuscitation", items: ["Vasopressor titration (norepi, epi, vaso)", "Fluid resuscitation endpoints", "Targeted temperature management (TTM)", "VA-ECMO and VV-ECMO basics", "IABP counterpulsation", "Resuscitative thoracotomy (ED thoracotomy)"] },
  { name: "Neuro Critical Care", items: ["ICP monitoring (EVD, bolt, Camino)", "CPP calculation and management", "Bilateral non-invasive ICP", "Seizure status epilepticus (RSE)", "Brain death determination", "Stroke thrombolysis and thrombectomy"] },
  { name: "Toxicology & Overdose", items: ["Toxidromes (anticholinergic, cholinergic, opioid)", "NAC protocol for acetaminophen overdose", "Digoxin-specific Fab fragments", "Lipid emulsion therapy", "Hemodialysis for toxic alcohols", "ECMO for severe overdose"] },
  { name: "Pediatric Critical Care", items: ["Pediatric weight-based dosing", "PALS algorithms (PEA, asystole, bradycardia)", "Neonatal resuscitation (NRP 8th edition)", "Pediatric airway ( Broselow tape)", "Diabetic ketoacidosis in children", "Pediatric septic shock (PEWS)"] },
];

export default function CriticalCare() {
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
          <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-600/20 border border-yellow-500/30">
            <Zap className="w-10 h-10 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">Critical Care</h1>
            <p className="text-slate-400 mt-1">ICU skills & emergency interventions</p>
          </div>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500/50"
          />
        </div>

        <div className="grid gap-4">
          {filtered.map(cat => (
            <div key={cat.name} className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
              <button
                onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-700/20 transition"
              >
                <span className="text-lg font-semibold text-yellow-300">{cat.name}</span>
                {expandedCategory === cat.name
                  ? <ChevronDown className="w-5 h-5 text-slate-400" />
                  : <ChevronRight className="w-5 h-5 text-slate-400" />}
              </button>
              {expandedCategory === cat.name && (
                <div className="px-6 pb-4 grid gap-2">
                  {cat.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-slate-300 text-sm py-2 border-t border-slate-700/30">
                      <span className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 bg-gradient-to-r from-yellow-500/10 to-orange-600/10 rounded-xl border border-yellow-500/20">
          <p className="text-sm text-slate-300">
            <strong className="text-yellow-300">Coming soon:</strong> AI simulation scenarios and titration protocols.
          </p>
        </div>
      </div>
    </div>
  );
}
