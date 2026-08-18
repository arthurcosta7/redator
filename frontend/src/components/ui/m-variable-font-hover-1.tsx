"use client";

import type { MouseEvent } from "react";

import { VariableFontHover } from "@/components/ui/variable-font-hover";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
}

interface VariableFontHoverNavProps {
  className?: string;
  links: NavLink[];
  onLinkClick?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}

export default function VariableFontHoverNav({
  className,
  links,
  onLinkClick,
}: VariableFontHoverNavProps) {
  return (
    <div className={cn("hidden items-center gap-10 lg:flex", className)}>
      {links.map((link) => (
        <a
          className="variable-font-hover-trigger link-underline text-[15px] text-ink-soft transition-colors hover:text-ink"
          href={link.href}
          key={link.label}
          onClick={(event) => onLinkClick?.(event, link.href)}
        >
          <VariableFontHover
            fromFontVariationSettings="'wght' 450"
            label={link.label}
            staggerDuration={0.014}
            staggerFrom="center"
            toFontVariationSettings="'wght' 650"
          />
        </a>
      ))}
    </div>
  );
}
