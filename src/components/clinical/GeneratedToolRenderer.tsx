import React from "react";
import { useMemo, useState } from "react";
import { Calculator, Info, Sparkles } from "lucide-react";

export type GeneratedToolField = {
  id: string;
  label: string;
  type: "number" | "text" | "select";
  unit?: string;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
};

export type GeneratedToolFormula = {
  id: string;
  label: string;
  expression: string;
  unit?: string;
  precision?: number;
  normalRange?: string;
  explanation?: string;
};

export type GeneratedToolSection = {
  title: string;
  content?: string;
  bullets?: string[];
};

export type GeneratedClinicalTool = {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: "calculator" | "reference";
  createdAt?: string;
  sourceTier?: "free" | "pro";
  model?: string;
  status?: "pending" | "approved" | "rejected";
  ownerEmail?: string;
  fields?: GeneratedToolField[];
  formulas?: GeneratedToolFormula[];
  sections?: GeneratedToolSection[];
  disclaimer?: string;
};

function tokenize(expression: string): string[] {
  const tokens = expression.match(/[A-Za-z_][A-Za-z0-9_]*|\d*\.?\d+|[()+\-*/]/g) || [];
  const joined = tokens.join("");
  if (joined !== expression.replace(/\s+/g, "")) throw new Error("Unsupported expression");
  return tokens;
}

function precedence(op: string) {
  return op === "+" || op === "-" ? 1 : op === "*" || op === "/" ? 2 : 0;
}

function evaluateExpression(expression: string, values: Record<string, string>): number {
  const tokens = tokenize(expression);
  const missingIds = tokens.filter((token) => /^[A-Za-z_]/.test(token) && !values[token]);
  if (missingIds.length) throw new Error("Enter required values");

  const output: string[] = [];
  const ops: string[] = [];
  for (const token of tokens) {
    if (/^\d/.test(token)) output.push(token);
    else if (/^[A-Za-z_]/.test(token)) {
      const value = Number(values[token]);
      if (!Number.isFinite(value)) throw new Error(`Missing ${token}`);
      output.push(String(value));
    } else if (token === "(") ops.push(token);
    else if (token === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop()!);
      if (ops.pop() !== "(") throw new Error("Mismatched parentheses");
    } else {
      while (ops.length && precedence(ops[ops.length - 1]) >= precedence(token)) output.push(ops.pop()!);
      ops.push(token);
    }
  }
  while (ops.length) output.push(ops.pop()!);
  const stack: number[] = [];
  for (const token of output) {
    if (/^-?\d/.test(token)) stack.push(Number(token));
    else {
      const b = stack.pop();
      const a = stack.pop();
      if (a == null || b == null) throw new Error("Invalid formula");
      if (token === "+") stack.push(a + b);
      if (token === "-") stack.push(a - b);
      if (token === "*") stack.push(a * b);
      if (token === "/") stack.push(a / b);
    }
  }
  if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error("Invalid result");
  return stack[0];
}

export default function GeneratedToolRenderer({ tool, action }: { tool: GeneratedClinicalTool; action?: React.ReactNode }) {
  const initialValues = useMemo(() => Object.fromEntries((tool.fields || []).map((f) => [f.id, ""])), [tool.fields]);
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  const results = useMemo(() => {
    return (tool.formulas || []).map((formula) => {
      try {
        const value = evaluateExpression(formula.expression, values);
        const precision = Math.max(0, Math.min(6, formula.precision ?? 2));
        return { formula, value: value.toFixed(precision), error: "" };
      } catch (e: any) {
        return { formula, value: "—", error: e.message || "Enter values" };
      }
    });
  }, [tool.formulas, values]);

  return (
    <div className="mt-6 space-y-5 rounded-2xl border border-primary/30 bg-background/80 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary/80">
            <Sparkles className="h-4 w-4" /> AI-generated {tool.category || "clinical"} tool
          </div>
          <h2 className="mt-2 text-2xl font-bold text-white">{tool.name}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{tool.description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {tool.kind === "calculator" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 font-semibold text-white"><Calculator className="h-5 w-5 text-amber-300" /> Inputs</div>
            {(tool.fields || []).map((field) => (
              <label key={field.id} className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{field.label}{field.unit ? ` (${field.unit})` : ""}</span>
                {field.type === "select" ? (
                  <select value={values[field.id] || ""} onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))} className="w-full rounded-xl border border-border/80 bg-background p-3 text-sm text-white focus:border-primary focus:outline-none">
                    <option value="">Select…</option>
                    {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <input type={field.type} value={values[field.id] || ""} min={field.min} max={field.max} placeholder={field.placeholder} onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))} className="w-full rounded-xl border border-border/80 bg-background p-3 text-sm text-white placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                )}
              </label>
            ))}
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
            <div className="font-semibold text-white">Results</div>
            {results.map(({ formula, value, error }) => (
              <div key={formula.id} className="rounded-xl border border-border bg-background/80 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground/80">{formula.label}</div>
                <div className="mt-2 text-2xl font-bold text-white">{value} <span className="text-sm font-medium text-muted-foreground">{formula.unit}</span></div>
                {error && value === "—" ? <p className="mt-2 text-xs text-amber-300">{error}</p> : null}
                {formula.normalRange ? <p className="mt-2 text-xs text-emerald-300">Expected range: {formula.normalRange}</p> : null}
                {formula.explanation ? <p className="mt-2 text-sm text-muted-foreground">{formula.explanation}</p> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {!!tool.sections?.length && (
        <div className="grid gap-4 md:grid-cols-2">
          {tool.sections.map((section, index) => (
            <div key={`${section.title}-${index}`} className="rounded-2xl border border-border bg-card/60 p-4">
              <h3 className="font-semibold text-white">{section.title}</h3>
              {section.content ? <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{section.content}</p> : null}
              {!!section.bullets?.length && (
                <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                  {section.bullets.map((bullet, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{bullet}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200">
        <Info className="h-5 w-5 shrink-0" />
        <span>{tool.disclaimer || "Educational screening only — verify calculations and clinical decisions with program policy, facility policy, and clinical judgment."}</span>
      </div>
    </div>
  );
}
