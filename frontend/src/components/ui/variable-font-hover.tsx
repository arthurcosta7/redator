"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

type StaggerFrom = "first" | "center" | "last" | number;

interface VariableFontHoverProps {
  className?: string;
  fromFontVariationSettings?: string;
  label: string;
  staggerDuration?: number;
  staggerFrom?: StaggerFrom;
  toFontVariationSettings?: string;
}

type VariableFontStyle = CSSProperties & {
  "--variable-font-delay": string;
  "--variable-font-from": string;
  "--variable-font-to": string;
};

function getStaggerDistance(index: number, length: number, from: StaggerFrom) {
  if (typeof from === "number") {
    const origin = Math.min(Math.max(from, 0), Math.max(length - 1, 0));
    return Math.abs(index - origin);
  }

  if (from === "last") {
    return length - 1 - index;
  }

  if (from === "center") {
    return Math.abs(index - (length - 1) / 2);
  }

  return index;
}

export function VariableFontHover({
  className,
  fromFontVariationSettings = "'wght' 450",
  label,
  staggerDuration = 0.014,
  staggerFrom = "center",
  toFontVariationSettings = "'wght' 650",
}: VariableFontHoverProps) {
  const characters = Array.from(label);

  return (
    <span className={cn("variable-font-hover", className)}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="variable-font-hover__visual">
        {characters.map((character, index) => {
          const delay =
            getStaggerDistance(index, characters.length, staggerFrom) *
            staggerDuration;
          const style: VariableFontStyle = {
            "--variable-font-delay": `${delay}s`,
            "--variable-font-from": fromFontVariationSettings,
            "--variable-font-to": toFontVariationSettings,
          };

          return (
            <span
              className="variable-font-hover__glyph"
              key={`${character}-${index}`}
              style={style}
            >
              {character === " " ? "\u00A0" : character}
            </span>
          );
        })}
      </span>
    </span>
  );
}
