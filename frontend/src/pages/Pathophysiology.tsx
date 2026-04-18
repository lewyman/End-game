import { Link } from "react-router-dom";
import { useState } from "react";
import { Brain, ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";

const categories = [
  { name: "Cardiovascular", items: ["Heart failure (systolic vs diastolic)", "Acute coronary syndrome (STEMI/NSTEMI/USA)", "Arrhythmias (A-fib, V-tach, heart blocks)", "Hypertensive crisis", "Shock states (hypovolemic, cardiogenic, septic)", "Aortic aneurysm and dissection"] },
  { name: "Pulmonary", items: ["COPD exacerbation", "Asthma (mild, moderate, severe)", "Pneumonia (CAP, HAP, VAP)", "Pulmonary embolism", "ARDS and mechanical ventilation", "Pleural effusion and pneumothorax"] },
  { name: "Neurological", items: ["Stroke (ischemic vs hemorrhagic)", "Seizure disorders and status epilepticus", "Traumatic brain injury (GCS)", "Spinal cord injury (ASIA scale)", "Meningitis and encephalitis", "Alzheimer's and dementia progression"] },
  { name: "Renal", items: ["AKI (prerenal, intrinsic, postrenal)", "CKD progression stages", "Nephrotic vs nephritic syndrome", "Urinary tract infections (simple vs complicated)", "Kidney stones (types and management)", "Dialysis access and complications"] },
  { name: "GI", items: ["GI bleeding (upper vs lower)", "Pancreatitis (mild vs severe)", "Bowel obstruction (mechanical vs paralytic)", "Liver failure (acute vs chronic)", "Cholecystitis and biliary colic", "Diverticulitis and peritonitis"] },
  { name: "Endocrine", items: ["DKA and HHS", "Thyroid storm and myxedema coma", "Adrenal insufficiency (Addisonian crisis)", "SIADH and diabetes insipidus", "Pheochromocytoma", "Diabetic foot ulcers and Charcot joint"] },
];

export default function Pathophysiology() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = categories
    .map(cat => ({
      ...cat,
      items: cat.items.filter(item =>
        item.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }))
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
            <Brain className="w-10 h-10 text-rose-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">Pathophysiology</h1>
            <p className="text-slate-400 mt-1">Disease mechanisms & clinical reasoning</p>
          </div>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-rose-500/50"
          />
        </div>

        <div className="grid gap-4">
          {filtered.map(cat => (
            <div key={cat.name} className="bg-white/40 rounded-xl border border-slate-700/50 overflow-hidden">
              <button
                onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/20 transition"
              >
                <span className="text-lg font-semibold text-rose-300">{cat.name}</span>
                {expandedCategory === cat.name
                  ? <ChevronDown className="w-5 h-5 text-slate-400" />
                  : <ChevronRight className="w-5 h-5 text-slate-400" />}
              </button>
              {expandedCategory === cat.name && (
                <div className="px-6 pb-4 grid gap-2">
                  {cat.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-slate-300 text-sm py-2 border-t border-slate-700/30">
                      <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
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
            <strong className="text-rose-300">Coming soon:</strong> AI explanations for each condition — understand the "why" behind clinical manifestations.
          </p>
        </div>
      </div>
    </div>
  );
}
