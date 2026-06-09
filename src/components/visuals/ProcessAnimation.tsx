import { motion } from "framer-motion";
import { AnimationStep, colorMap } from "./AnimationPlayer";

interface Props {
  steps: AnimationStep[];
  playing: boolean;
}

export default function ProcessAnimation({ steps, playing }: Props) {
  return (
    <div className="flex flex-col items-center gap-0 w-full max-w-md mx-auto">
      {steps.map((step, i) => {
        const colors = colorMap[step.color ?? "violet"];
        return (
          <div key={step.id} className="flex flex-col items-center w-full">
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={playing ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
              transition={{ duration: 0.4, delay: i * 0.2, ease: "easeOut" }}
              className={`w-full rounded-xl border px-4 py-3 flex items-start gap-3 ${colors.bg} ${colors.border}`}
            >
              <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${colors.badge}`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${colors.text}`}>{step.label}</p>
                {step.sublabel && (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.sublabel}</p>
                )}
                {step.annotation && (
                  <p className="text-xs text-muted-foreground/80 mt-1 italic">{step.annotation}</p>
                )}
              </div>
            </motion.div>

            {i < steps.length - 1 && (
              <motion.svg
                width={24} height={28}
                initial={{ opacity: 0 }}
                animate={playing ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: i * 0.2 + 0.35 }}
              >
                <motion.line
                  x1={12} y1={0} x2={12} y2={22}
                  stroke="#b89632" strokeWidth={2} strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={playing ? { pathLength: 1 } : { pathLength: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.2 + 0.35 }}
                />
                <polygon points="6,18 18,18 12,26" fill="#b89632" />
              </motion.svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
