import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: "transparent",
    primaryColor: "#c9a84c",
    primaryTextColor: "#e2e8f0",
    primaryBorderColor: "#b89632",
    lineColor: "#94a3b8",
    secondaryColor: "#1e293b",
    tertiaryColor: "#0f172a",
    edgeLabelBackground: "#1e293b",
    clusterBkg: "#1e293b",
    titleColor: "#e2e8f0",
    nodeTextColor: "#e2e8f0",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  },
  flowchart: { curve: "basis", htmlLabels: true },
});

let mermaidCounter = 0;

interface MermaidDiagramProps {
  code: string;
}

export default function MermaidDiagram({ code }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const idRef = useRef(`mermaid-${++mermaidCounter}`);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSvg(null);

    const render = async () => {
      try {
        const { svg: rendered } = await mermaid.render(idRef.current, code.trim());
        if (!cancelled) {
          setSvg(rendered);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
          setLoading(false);
        }
      }
    };

    render();
    return () => { cancelled = true; };
  }, [code]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Rendering diagram…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300 my-3">
        <span className="font-semibold">Diagram error:</span> {error}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="my-4 rounded-xl border border-border/80 bg-card/60 p-4 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg! }}
    />
  );
}
