"use client";

import { MotionConfig } from "motion/react";

/** Every Framer Motion animation follows the device's reduced-motion setting. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
