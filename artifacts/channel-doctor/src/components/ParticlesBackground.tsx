import { motion } from "framer-motion";

const PARTICLES = [
  { x: 12, y: 8, s: 3, d: 0, dur: 9, color: "primary" },
  { x: 88, y: 15, s: 2, d: 1.2, dur: 11, color: "accent" },
  { x: 45, y: 5, s: 4, d: 0.6, dur: 8, color: "primary" },
  { x: 72, y: 30, s: 2, d: 2.1, dur: 12, color: "accent" },
  { x: 28, y: 45, s: 3, d: 0.3, dur: 10, color: "primary" },
  { x: 95, y: 55, s: 2, d: 1.8, dur: 9.5, color: "accent" },
  { x: 6, y: 68, s: 4, d: 0.9, dur: 13, color: "primary" },
  { x: 55, y: 72, s: 2, d: 3.0, dur: 8.5, color: "accent" },
  { x: 80, y: 80, s: 3, d: 1.5, dur: 11, color: "primary" },
  { x: 20, y: 88, s: 2, d: 2.7, dur: 9, color: "accent" },
  { x: 38, y: 22, s: 2, d: 0.4, dur: 14, color: "primary" },
  { x: 63, y: 48, s: 3, d: 1.1, dur: 10, color: "accent" },
  { x: 50, y: 90, s: 2, d: 2.3, dur: 12, color: "primary" },
  { x: 92, y: 38, s: 2, d: 0.7, dur: 8, color: "accent" },
  { x: 15, y: 60, s: 3, d: 3.5, dur: 11, color: "primary" },
  { x: 76, y: 65, s: 2, d: 1.9, dur: 9, color: "accent" },
  { x: 34, y: 78, s: 2, d: 0.2, dur: 13, color: "primary" },
  { x: 58, y: 12, s: 3, d: 2.8, dur: 10, color: "accent" },
  { x: 82, y: 92, s: 2, d: 1.4, dur: 8, color: "primary" },
  { x: 8, y: 35, s: 2, d: 0.8, dur: 15, color: "accent" },
];

export default function ParticlesBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.s,
            height: p.s,
            background:
              p.color === "primary"
                ? "hsl(258 90% 66%)"
                : "hsl(189 100% 52%)",
          }}
          animate={{
            y: [0, -24 - p.s * 4, 0],
            opacity: [0.15, 0.55, 0.15],
            scale: [1, 1.6, 1],
          }}
          transition={{
            duration: p.dur,
            delay: p.d,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      {/* Soft scanning line */}
      <motion.div
        className="absolute inset-x-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(258 90% 66% / 0.15) 40%, hsl(189 100% 52% / 0.15) 60%, transparent 100%)",
        }}
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
