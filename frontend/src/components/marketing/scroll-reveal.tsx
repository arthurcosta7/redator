"use client";

/** Revela o conteúdo uma vez ao entrar no viewport e libera o observer depois. */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ScrollRevealProps = {
  children: React.ReactNode;
  className?: string;
};

export function ScrollReveal({ children, className }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        // A animação não deve ser revertida ao rolar de volta; desconectar também
        // evita manter observadores ativos para conteúdo já apresentado.
        observer.disconnect();
      },
      { rootMargin: "0px 0px -100px", threshold: 0.08 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("scroll-reveal", className)}
      data-visible={visible}
    >
      {children}
    </div>
  );
}
