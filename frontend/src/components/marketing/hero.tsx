"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Star } from "lucide-react";

function EssayCorrectionMockup() {
  return (
    <div className="relative">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-slate-400 font-medium">Correção — Modelo ENEM</span>
          <div className="ml-auto flex items-center gap-1.5 bg-green-50 px-2 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-700 font-medium">Corrigida</span>
          </div>
        </div>

        {/* Texto com grifes */}
        <div className="px-5 py-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            <span className="bg-green-100 text-green-900 rounded px-0.5 cursor-help"
                  title="✓ Bom uso de argumento de autoridade">
              Segundo dados do IBGE (2023)
            </span>
            , o Brasil ocupa a 79ª posição no ranking mundial de educação.{" "}
            <span className="bg-red-100 text-red-900 rounded px-0.5 cursor-help"
                  title="⚠ Conectivo inadequado para iniciar conclusão">
              Então, é necessário
            </span>{" "}
            que o governo tome providências imediatas.{" "}
            <span className="bg-green-100 text-green-900 rounded px-0.5 cursor-help"
                  title="✓ Boa contextualização do tema">
              A violência e a desigualdade social são fatores que agravam esse cenário
            </span>
            , tornando urgente a reflexão sobre políticas públicas eficazes...
          </p>
        </div>

        {/* Competências */}
        <div className="px-5 pb-4 space-y-2.5">
          {[
            { label: "C1 — Linguagem formal", score: 160, max: 200, color: "bg-brand-600" },
            { label: "C2 — Desenvolvimento do tema", score: 160, max: 200, color: "bg-brand-600" },
            { label: "C3 — Argumentação", score: 120, max: 200, color: "bg-amber-500" },
            { label: "C4 — Coesão e coerência", score: 120, max: 200, color: "bg-amber-500" },
            { label: "C5 — Proposta de intervenção", score: 120, max: 200, color: "bg-amber-500" },
          ].map((comp) => (
            <div key={comp.label} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-44 shrink-0 truncate">{comp.label}</span>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${comp.color} rounded-full`}
                     style={{ width: `${(comp.score / comp.max) * 100}%` }} />
              </div>
              <span className="text-xs font-semibold text-slate-700 w-14 text-right shrink-0">
                {comp.score}/200
              </span>
            </div>
          ))}
        </div>

        {/* Nota */}
        <div className="mx-5 mb-5 p-4 bg-brand-50 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Nota Final</p>
            <p className="text-3xl font-display font-bold text-brand-700">
              680<span className="text-lg text-slate-400 font-normal">/1000</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Nível</p>
            <p className="text-sm font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
              Intermediário
            </p>
          </div>
        </div>
      </div>

      {/* Card flutuante — sugestão */}
      <div className="absolute -bottom-4 -left-4 bg-white rounded-xl border border-slate-100
                      shadow-card-hover p-3 flex items-center gap-3 max-w-[210px]">
        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0 text-base">
          💡
        </div>
        <p className="text-xs text-slate-600 leading-tight">
          <span className="font-semibold text-slate-800">C5 fraca:</span>{" "}
          faltou indicar quem executa a solução
        </p>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-20 pb-16
                        bg-hero-pattern overflow-hidden">

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-brand-50 rounded-full
                        blur-3xl opacity-60 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-50 rounded-full
                        blur-3xl opacity-40 -translate-x-1/4" />
      </div>

      <div className="container-site relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Texto */}
          <div className="space-y-7 animate-fade-in">

            {/* Headline */}
            <div className="space-y-5">
              <h1 className="font-display font-bold text-5xl lg:text-6xl xl:text-7xl
                             text-slate-900 leading-[1.08] tracking-tight text-balance">
                Saiba onde
                <br />
                você está
                <br />
                <span className="text-gradient">errando.</span>
              </h1>

              <p className="text-lg lg:text-xl text-slate-500 leading-relaxed max-w-lg">
                Corrija sua redação e receba um retorno completo —
                nota por competência, grifes no texto e o que exatamente mudar.
                Tudo em menos de um minuto.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center gap-2 bg-brand-700
                           hover:bg-brand-800 text-white font-semibold px-7 py-3.5
                           rounded-xl shadow-brand hover:shadow-brand-lg
                           transition-all duration-200 text-base group"
              >
                Começar grátis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center gap-2 bg-white
                           hover:bg-slate-50 text-slate-700 font-semibold px-7 py-3.5
                           rounded-xl border border-slate-200 hover:border-slate-300
                           transition-all duration-200 text-base"
              >
                Ver como funciona
              </a>
            </div>

            {/* Trust */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {["Grátis para começar", "ENEM e Vestibular", "Resultado na hora"].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                  <span className="text-sm text-slate-600">{item}</span>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3 pt-1">
              {/* Avatares com iniciais */}
              <div className="flex -space-x-2">
                {[
                  { initials: "BF", bg: "bg-brand-200 text-brand-800" },
                  { initials: "LM", bg: "bg-violet-200 text-violet-800" },
                  { initials: "AP", bg: "bg-emerald-200 text-emerald-800" },
                  { initials: "GT", bg: "bg-amber-200 text-amber-800" },
                ].map((a) => (
                  <div key={a.initials}
                       className={`w-9 h-9 rounded-full ${a.bg} border-2 border-white
                                  flex items-center justify-center text-xs font-bold`}>
                    {a.initials}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  Usado por <span className="font-semibold text-slate-700">diversos estudantes</span>
                </p>
              </div>
            </div>
          </div>

          {/* Mockup */}
          <div className="relative animate-slide-up lg:pl-8">
            <EssayCorrectionMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
