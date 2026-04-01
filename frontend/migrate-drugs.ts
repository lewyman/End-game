import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Drug data from old Zo API
const drugs = [
  { slug: "carbidopa", name: "Carbidopa", class: "Decarboxylase Inhibitor - Peripheral", description: "Peripheral dopa decarboxylase inhibitor that prevents levodopa from converting to dopamine outside the CNS. Always used in combination with levodopa. Does not cross the blood-brain barrier.", tier: "free" },
  { slug: "carbidopa-levodopa", name: "Carbidopa-Levodopa", class: "Antiparkinson Agent / Dopaminergic", description: "Combination therapy for Parkinson disease. Levodopa converts to dopamine in the brain. Carbidopa prevents peripheral conversion, allowing more levodopa to reach the brain and reducing peripheral side effects.", tier: "free" },
  { slug: "carvedilol", name: "Carvedilol", class: "Non-selective Beta-Blocker with Alpha-1 Activity", description: "Third-generation beta-blocker with non-selective beta-blocking and alpha-1 blocking properties, used for heart failure, hypertension, and post-MI management.", tier: "free" },
  { slug: "clopidogrel-bisulfate", name: "Clopidogrel (Plavix)", class: "Antiplatelet Agent - P2Y12 Inhibitor", description: "Thienopyridine antiplatelet agent that irreversibly inhibits P2Y12 ADP receptors on platelets. Prevents platelet aggregation. Used post-MI, post-stroke, with stents, and for peripheral artery disease.", tier: "free" },
  { slug: "digoxin", name: "Digoxin", class: "Cardiac Glycoside", description: "Positive inotrope for heart failure and atrial fibrillation. Narrow therapeutic index requires careful monitoring.", tier: "free", image: "" },
  { slug: "docusate-sodium", name: "Docusate Sodium (Colace)", class: "Stool Softener", description: "Anionic surfactant that softens stool by increasing water and fat penetration. Used for constipation prevention, straining reduction, and perineal care.", tier: "free" },
  { slug: "escitalopram", name: "Escitalopram (Lexapro)", class: "SSRI Antidepressant", description: "Selective serotonin reuptake inhibitor used for major depressive disorder and generalized anxiety disorder. Works by increasing serotonin levels in the brain.", tier: "free" },
  { slug: "ezetimibe", name: "Ezetimibe (Zetia)", class: "Cholesterol Absorption Inhibitor", description: "Inhibits cholesterol absorption in the small intestine, reducing LDL cholesterol. Used as adjunct therapy with statins or alone for hypercholesterolemia.", tier: "free" },
  { slug: "hydralazine-hcl", name: "Hydralazine HCl (Apresoline)", class: "Vasodilator - Arterial", description: "Direct-acting arterial vasodilator used for hypertensive emergencies and heart failure. Reduces afterload by relaxing vascular smooth muscle.", tier: "free" },
  { slug: "levodopa", name: "Levodopa (L-DOPA)", class: "Dopamine Precursor", description: "Metabolized to dopamine in the CNS to replenish depleted dopamine in Parkinson disease. Always given with carbidopa to reduce peripheral side effects.", tier: "free" },
  { slug: "mirtazapine", name: "Mirtazapine (Remeron)", class: "Tetracyclic Antidepressant", description: "Noradrenergic and specific serotonergic antidepressant. Increases serotonin and norepinephrine through different mechanism than SSRIs.", tier: "free" },
  { slug: "tranexamic-acid", name: "Tranexamic Acid (TXA)", class: "Antifibrinolytic Agent", description: "Inhibits plasminogen activation, reducing clot breakdown. Used for heavy menstrual bleeding, trauma, and surgery to reduce bleeding.", tier: "free" },
];

async function seed() {
  console.log("Seeding drugs...");
  
  for (const drug of drugs) {
    const { data, error } = await supabase
      .from("drugs")
      .upsert({
        slug: drug.slug,
        name: drug.name,
        class: drug.class,
        description: drug.description,
        tier: drug.tier,
        image: drug.image || "",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ ${drug.name}: ${error.message}`);
    } else {
      console.log(`✅ ${drug.name}`);
    }
  }

  // Verify
  const { data: all } = await supabase.from("drugs").select("name, tier");
  console.log(`\nTotal drugs: ${all?.length}`);
}

seed();
