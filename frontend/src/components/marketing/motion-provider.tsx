"use client";

import { MotionConfig } from "framer-motion";
import { useHydratedReducedMotion } from "@/hooks/use-hydrated-reduced-motion";

export function MarketingMotionProvider({ children }: { children: React.ReactNode }) {
  const reduceMotion = useHydratedReducedMotion();

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
      {children}
    </MotionConfig>
  );
}
