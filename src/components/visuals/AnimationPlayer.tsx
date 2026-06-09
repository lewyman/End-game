import { useState } from "react";
import { motion } from "framer-motion";
import { Play, RotateCcw } from "lucide-react";
import FlowchartAnimation from "./FlowchartAnimation";
import ProcessAnimation from "./ProcessAnimation";
import CycleAnimation from "./CycleAnimation";
import PathwayAnimation from "./PathwayAnimation";

export type AnimationColor = "violet" | "blue" | "indigo" | "fuchsia" | "slate" | "rose" | "emerald";
export type AnimationType = "flowchart" | "process" | "cycle" | "pathway";

export interface AnimationStep {
  id: string;
  label: string;
  sublabel?: string;
  color?: AnimationColor;
  connects_to?: string[];
  annotation?: string;
}

export interface AnimationData {
  type: AnimationType;
  title: string;
  description?: string;
  steps: AnimationStep[];
}

export const colorMap: Record<AnimationColor, {
  bg: string;
  border: string;
  text: string;
  badge: string;
  svgFill: string;
  svgStroke: string;
  svgText: string;
}> = {
  violet: {
    bg: "bg-primary/50/60",
    border: "border-primary/60",
    text: "text-violet-200",
    badge: "bg-primary/90 text-white",
    svgFill: "#2d1f5e",
    svgStroke: "#c9a84c",
    svgText: "#ddd6fe",
  },
  blue: {
    bg: "bg-blue-950/60",
    border: "border-blue-700/60",
    text: "text-blue-200",
    badge: "bg-[#1a5fa8]/90 text-white",
    svgFill: "#1e3a5f",
    svgStroke: "#2563eb",
    svgText: "#bfdbfe",
  },
  indigo: {
    bg: "bg-indigo-950/60",
    border: "border-indigo-700/60",
    text: "text-indigo-200",
    badge: "bg-indigo-700 text-white",
    svgFill: "#1e1b4b",
    svgStroke: "#4338ca",
    svgText: "#c7d2fe",
  },
  fuchsia: {
    bg: "bg-fuchsia-950/60",
    border: "border-fuchsia-700/60",
    text: "text-fuchsia-200",
    badge: "bg-fuchsia-700 text-white",
    svgFill: "#2d1037",
    svgStroke: "#a21caf",
    svgText: "#f5d0fe",
  },
  slate: {
    bg: "bg-card/60/60",
    border: "border-border/60/60",
    text: "text-foreground/60",
    badge: "bg-muted/80 text-white",
    svgFill: "#1e293b",
    svgStroke: "#64748b",
    svgText: "#e2e8f0",
  },
  rose: {
    bg: "bg-rose-950/60",
    border: "border-rose-700/60",
    text: "text-rose-200",
    badge: "bg-rose-700 text-white",
    svgFill: "#3b0f17",
    svgStroke: "#e11d48",
    svgText: "#fecdd3",
  },
  emerald: {
    bg: "bg-emerald-950/60",
    border: "border-emerald-700/60",
    text: "text-emerald-200",
    badge: "bg-emerald-700 text-white",
    svgFill: "#052e16",
    svgStroke: "#059669",
    svgText: "#a7f3d0",
  },
};

const VALID_TYPES: AnimationType[] = ["flowchart", "process", "cycle", "pathway"];

interface AnimationPlayerProps {
  code: string;
}

export default function AnimationPlayer({ code }: AnimationPlayerProps) {
  const [playing, setPlaying] = useState(true);
  const [key, setKey] = useState(0);

  let data: AnimationData | null = null;
  let parseError: string | null = null;

  try {
    data = JSON.parse(code.trim()) as AnimationData;
    if (!VALID_TYPES.includes(data.type)) {
      parseError = `Unknown animation type: "${data.type}". Must be one of: ${VALID_TYPES.join(", ")}.`;
      data = null;
    } else if (!Array.isArray(data.steps) || data.steps.length === 0) {
      parseError = "Animation must have at least one step.";
      data = null;
    }
  } catch (err) {
    parseError = err instanceof Error ? err.message : "Invalid JSON";
  }

  if (parseError) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300 my-3">
        <span className="font-semibold">Animation error:</span> {parseError}
      </div>
    );
  }

  if (!data) return null;

  const handlePlay = () => {
    if (playing) {
      setKey((k) => k + 1);
      setPlaying(false);
      setTimeout(() => setPlaying(true), 30);
    } else {
      setPlaying(true);
    }
  };

  const handleReplay = () => {
    setKey((k) => k + 1);
    setPlaying(false);
    setTimeout(() => setPlaying(true), 30);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="my-4 rounded-xl border border-border/80 bg-card/60 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/80/60">
        <div>
          <p className="text-sm font-semibold text-white">{data.title}</p>
          {data.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{data.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {playing && (
            <button
              onClick={handleReplay}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white hover:bg-muted transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Replay
            </button>
          )}
          <button
            onClick={handlePlay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/90 hover:bg-primary text-white transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            {playing ? "Restart" : "Play"}
          </button>
        </div>
      </div>

      <div className="p-4" key={key}>
        {data.type === "flowchart" && (
          <FlowchartAnimation steps={data.steps} playing={playing} />
        )}
        {data.type === "process" && (
          <ProcessAnimation steps={data.steps} playing={playing} />
        )}
        {data.type === "cycle" && (
          <CycleAnimation steps={data.steps} playing={playing} />
        )}
        {data.type === "pathway" && (
          <PathwayAnimation steps={data.steps} playing={playing} />
        )}
      </div>
    </motion.div>
  );
}
