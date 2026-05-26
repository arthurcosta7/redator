/**
 * utils.ts — Funções utilitárias
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn — Combina classes Tailwind de forma inteligente
 *
 * Resolve conflitos entre classes Tailwind automaticamente.
 * Uso: cn("px-4 py-2", isActive && "bg-blue-500", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
