import { motion, useAnimation } from "framer-motion";
import { useEffect, useId, useRef } from "react";
import { AnimationStep, colorMap } from "./AnimationPlayer";

interface Props {
  steps: AnimationStep[];
  playing: boolean;
}

const NODE_W = 110;
const NODE_H = 60;
const GAP = 40;
const DOT_R = 8;
const SVG_H = 80;

export default function PathwayAnimation({ steps, playing }: Props) {
  const uid = useId().replace(/:/g, "");
  const pwArrowId = `pw-arrow-${uid}`;
  const dotGlowId = `dot-glow-${uid}`;
  const dotControls = useAnimation();
  const n = steps.length;
  const totalW = n * NODE_W + (n - 1) * GAP;
  const pathLength = totalW - NODE_W;

  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (playing && n > 0) {
      const delay = n * 0.18 + 0.3;
      const timer = setTimeout(() => {
        dotControls.start({
          offsetDistance: ["0%", "100%"],
          transition: {
            duration: 2.5,
            ease: "linear",
            repeat: Infinity,
            repeatDelay: 0.5,
          },
        });
      }, delay * 1000);
      return () => clearTimeout(timer);
    } else {
      dotControls.stop();
      return undefined;
    }
  }, [playing, n, dotControls]);

  const lineY = NODE_H / 2;
  const linePath = n > 1
    ? `M ${NODE_W / 2} ${lineY} L ${NODE_W / 2 + pathLength} ${lineY}`
    : "";

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: totalW + 20, padding: "0 10px" }}>
        <div className="relative" style={{ height: NODE_H + SVG_H }}>
          <svg
            width={totalW}
            height={SVG_H}
            style={{ position: "absolute", top: NODE_H / 2 - SVG_H / 2, left: 0 }}
          >
            <defs>
              <marker id={pwArrowId} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#c9a84c" />
              </marker>
              <filter id={dotGlowId}>
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {n > 1 && (
              <motion.path
                ref={pathRef}
                d={linePath}
                fill="none"
                stroke="#b89632"
                strokeWidth={3}
                strokeLinecap="round"
                markerEnd={`url(#${pwArrowId})`}
                initial={{ pathLength: 0 }}
                animate={playing ? { pathLength: 1 } : { pathLength: 0 }}
                transition={{ duration: 0.6, delay: n * 0.18, ease: "easeInOut" }}
              />
            )}

            {playing && n > 1 && (
              <motion.circle
                r={DOT_R}
                fill="#d4af5e"
                filter={`url(#${dotGlowId})`}
                style={{
                  offsetPath: `path("${linePath}")`,
                  offsetDistance: "0%",
                }}
                animate={dotControls}
              />
            )}
          </svg>

          <div
            className="absolute top-0 left-0 flex items-center"
            style={{ gap: GAP, height: NODE_H }}
          >
            {steps.map((step, i) => {
              const colors = colorMap[step.color ?? "violet"];
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={playing ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.35, delay: i * 0.18, ease: "easeOut" }}
                  className={`flex flex-col items-center justify-center rounded-xl border px-2 py-2 text-center ${colors.bg} ${colors.border}`}
                  style={{ width: NODE_W, height: NODE_H, flexShrink: 0 }}
                >
                  <p className={`text-xs font-semibold leading-tight ${colors.text}`}>{step.label}</p>
                  {step.sublabel && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{step.sublabel}</p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
