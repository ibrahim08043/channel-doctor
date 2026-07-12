import type { Variants } from "framer-motion";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 90, damping: 18 } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4 } },
};

export const stagger = (delayChildren = 0.08): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delayChildren } },
});

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.93 },
  show: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 100, damping: 16 } },
};

export const slideRight: Variants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 90, damping: 18 } },
};
