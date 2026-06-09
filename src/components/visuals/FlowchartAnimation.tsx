import { useId } from "react";
import { motion } from "framer-motion";
import { AnimationStep, colorMap } from "./AnimationPlayer";

interface Props {
  steps: AnimationStep[];
  playing: boolean;
}

function buildEdges(steps: AnimationStep[]) {
  const edges: { from: string; to: string }[] = [];
  for (const step of steps) {
    for (const target of (step.connects_to ?? [])) {
      edges.push({ from: step.id, to: target });
    }
  }
  return edges;
}

const COLS = 3;
const NODE_W = 140;
const NODE_H = 60;
const COL_GAP = 60;
const ROW_GAP = 60;

export default function FlowchartAnimation({ steps, playing }: Props) {
  const uid = useId().replace(/:/g, "");
  const arrowId = `fc-arrow-${uid}`;
  const edges = buildEdges(steps);
  const cols = Math.min(steps.length, COLS);
  const rows = Math.ceil(steps.length / cols);
  const svgW = cols * NODE_W + (cols - 1) * COL_GAP + 40;
  const svgH = rows * NODE_H + (rows - 1) * ROW_GAP + 40;

  const positions: Record<string, { cx: number; cy: number }> = {};
  steps.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[s.id] = {
      cx: 20 + col * (NODE_W + COL_GAP) + NODE_W / 2,
      cy: 20 + row * (NODE_H + ROW_GAP) + NODE_H / 2,
    };
  });

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.18 },
    },
  };
  const nodeVar = {
    hidden: { opacity: 0, scale: 0.85 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: "easeOut" as const } },
  };

  return (
    <div className="overflow-x-auto">
      <svg width={svgW} height={svgH} style={{ display: "block", margin: "0 auto" }}>
        <defs>
          <marker id={arrowId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#b89632" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const from = positions[e.from];
          const to = positions[e.to];
          if (!from || !to) return null;
          const d = `M ${from.cx} ${from.cy} L ${to.cx} ${to.cy}`;
          return (
            <motion.path
              key={i}
              d={d}
              fill="none"
              stroke="#b89632"
              strokeWidth={2}
              strokeLinecap="round"
              markerEnd={`url(#${arrowId})`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={playing ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.15, ease: "easeInOut" }}
            />
          );
        })}
      </svg>

      <motion.div
        variants={container}
        initial="hidden"
        animate={playing ? "show" : "hidden"}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${NODE_W}px)`,
          gap: `${ROW_GAP}px ${COL_GAP}px`,
          justifyContent: "center",
          marginTop: `-${svgH}px`,
          position: "relative",
        }}
      >
        {steps.map((step) => {
          const colors = colorMap[step.color ?? "violet"];
          return (
            <motion.div
              key={step.id}
              variants={nodeVar}
              className={`rounded-xl border px-3 py-2 flex flex-col items-center justify-center text-center ${colors.bg} ${colors.border}`}
              style={{ width: NODE_W, height: NODE_H }}
            >
              <span className={`text-xs font-semibold leading-tight ${colors.text}`}>{step.label}</span>
              {step.sublabel && (
                <span className="text-xs text-muted-foreground mt-0.5 leading-tight">{step.sublabel}</span>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
