import { motion, useAnimation } from "framer-motion";
import { useEffect, useId } from "react";
import { AnimationStep, colorMap } from "./AnimationPlayer";

interface Props {
  steps: AnimationStep[];
  playing: boolean;
}

const R = 110;
const NODE_W = 100;
const NODE_H = 52;
const SVG_SIZE = 320;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;

function nodePos(i: number, total: number) {
  const angle = (2 * Math.PI * i) / total - Math.PI / 2;
  return {
    x: CX + R * Math.cos(angle),
    y: CY + R * Math.sin(angle),
  };
}

function arcPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const curve = 20;
  const nx = -dy / len;
  const ny = dx / len;
  const qx = mx + nx * curve;
  const qy = my + ny * curve;
  return `M ${from.x} ${from.y} Q ${qx} ${qy} ${to.x} ${to.y}`;
}

export default function CycleAnimation({ steps, playing }: Props) {
  const uid = useId().replace(/:/g, "");
  const arcArrowId = `arc-arrow-${uid}`;
  const glowId = `glow-${uid}`;
  const particleControls = useAnimation();
  const n = steps.length;

  useEffect(() => {
    if (playing && n > 0) {
      const totalDelay = n * 0.25 + 0.4;
      const timer = setTimeout(() => {
        particleControls.start({
          offsetDistance: ["0%", "100%"],
          transition: { duration: 3, ease: "linear", repeat: Infinity },
        });
      }, totalDelay * 1000);
      return () => clearTimeout(timer);
    } else {
      particleControls.stop();
      return undefined;
    }
  }, [playing, n, particleControls]);

  const ringPath = (() => {
    if (n === 0) return "";
    const pts = steps.map((_, i) => nodePos(i, n));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i <= n; i++) {
      const p = pts[i % n];
      d += ` L ${p.x} ${p.y}`;
    }
    return d;
  })();

  return (
    <div className="flex justify-center">
      <svg width={SVG_SIZE} height={SVG_SIZE} style={{ overflow: "visible" }}>
        <defs>
          <marker id={arcArrowId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#c9a84c" />
          </marker>
        </defs>

        {steps.map((_, i) => {
          const from = nodePos(i, n);
          const to = nodePos((i + 1) % n, n);
          const path = arcPath(from, to);
          return (
            <motion.path
              key={`arc-${i}`}
              d={path}
              fill="none"
              stroke="#c9a84c"
              strokeWidth={2}
              strokeLinecap="round"
              markerEnd={`url(#${arcArrowId})`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={playing ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.4, delay: i * 0.25 + 0.35, ease: "easeInOut" }}
            />
          );
        })}

        {playing && (
          <motion.circle
            r={6}
            fill="#d4af5e"
            filter={`url(#${glowId})`}
            style={{ offsetPath: `path("${ringPath}")`, offsetDistance: "0%" }}
            animate={particleControls}
          />
        )}
        <defs>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {steps.map((step, i) => {
          const { x, y } = nodePos(i, n);
          const colors = colorMap[step.color ?? "violet"];
          return (
            <motion.g key={step.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={playing ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.35, delay: i * 0.25, ease: "easeOut" }}
              style={{ transformOrigin: `${x}px ${y}px` }}
            >
              <rect
                x={x - NODE_W / 2} y={y - NODE_H / 2}
                width={NODE_W} height={NODE_H}
                rx={10}
                fill={colors.svgFill}
                stroke={colors.svgStroke}
                strokeWidth={1.5}
              />
              <text
                x={x} y={y - 6}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fontWeight="600"
                fill={colors.svgText}
                className="pointer-events-none"
              >
                {step.label.length > 18 ? step.label.slice(0, 16) + "…" : step.label}
              </text>
              {step.sublabel && (
                <text
                  x={x} y={y + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill="#94a3b8"
                  className="pointer-events-none"
                >
                  {step.sublabel.length > 20 ? step.sublabel.slice(0, 18) + "…" : step.sublabel}
                </text>
              )}
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
