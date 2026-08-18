"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

type ScrollParallaxProps = {
  children: React.ReactNode;
  className?: string;
  from?: number;
  to?: number;
  rotateFrom?: number;
  rotateTo?: number;
};

export function ScrollParallax({
  children,
  className,
  from = 24,
  to = -24,
  rotateFrom = 0,
  rotateTo = 0,
}: ScrollParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const startTransform = reduceMotion
    ? "translate3d(0, 0, 0) rotate(0deg)"
    : `translate3d(0, ${from}px, 0) rotate(${rotateFrom}deg)`;
  const endTransform = reduceMotion
    ? "translate3d(0, 0, 0) rotate(0deg)"
    : `translate3d(0, ${to}px, 0) rotate(${rotateTo}deg)`;
  const transform = useTransform(
    scrollYProgress,
    [0, 1],
    [startTransform, endTransform]
  );

  return (
    <motion.div
      ref={ref}
      data-scroll-parallax
      style={{ transform, willChange: reduceMotion ? "auto" : "transform" }}
      className={cn("relative", className)}
    >
      {children}
    </motion.div>
  );
}
