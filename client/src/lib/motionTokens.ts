// Central animation vocabulary for Archangels Club
// All durations/easings reference these tokens for consistency

export const motionTokens = {
  // Durations (ms → seconds for Framer)
  fast:     0.18,
  base:     0.32,
  slow:     0.55,
  cinematic: 0.85,

  // Easings
  ease: {
    out:      [0.16, 1, 0.3, 1] as const,      // snappy decelerate
    inOut:    [0.45, 0, 0.55, 1] as const,      // balanced
    luxury:   [0.22, 1, 0.36, 1] as const,      // slow start, rapid settle
    reveal:   [0.0, 0.0, 0.2, 1] as const,      // pure decelerate (material)
  },

  // Stagger
  stagger:  0.08,
  staggerFast: 0.05,
} as const;

// Shared variants — import and spread into motion components
export const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTokens.slow, ease: motionTokens.ease.luxury },
  },
};

export const fadeIn = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: motionTokens.base, ease: motionTokens.ease.out },
  },
};

export const scaleIn = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: motionTokens.base, ease: motionTokens.ease.luxury },
  },
};

export const staggerContainer = {
  hidden:  {},
  visible: {
    transition: { staggerChildren: motionTokens.stagger, delayChildren: 0.05 },
  },
};

export const staggerContainerFast = {
  hidden:  {},
  visible: {
    transition: { staggerChildren: motionTokens.staggerFast },
  },
};
