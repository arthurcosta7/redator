"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Star } from "lucide-react";

// Mockup visual da correção — mostra como o produto funciona sem screenshot real
function EssayCorrectionMockup() {
  return (
    <div className="relative">
      {/* Card principal — simulação do app */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)]
                      overflow-hidden">
        {/* Header do mockup */}
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

        {/* Texto da redação com grifes */}
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
                <div
                  className={`h-full ${comp.color} rounded-full transition-all`}
                  style={{ width: `${(comp.score / comp.max) * 100}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-700 w-14 text-right shrink-0">
                {comp.score}/200
              </span>
            </div>
          ))}
        </div>

        {/* Pontuação final */}
        <div className="mx-5 mb-5 p-4 bg-brand-50 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Nota Final</p>
            <p className="text-3xl font-display font-bold text-brand-700">680
              <span className="text-lg text-slate-400 font-normal">/1000</span>
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

      {/* Badge flutuante — insights */}
      <div className="absolute -bottom-4 -left-4 bg-white rounded-xl border border-slate-100
                      shadow-card-hover p-3 flex items-center gap-3 max-w-[200px]">
        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-base">💡</span>
        </div>
        <p className="text-xs text-slate-600 leading-tight">
          <span className="font-semibold text-slate-800">Melhore a C5</span>
          {" "}— Detalhe o agente e o modo da intervenção
        </p>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-20 pb-16
                        bg-hero-pattern overflow-hidden">

      {/* Background decorativo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-brand-50 rounded-full
                        blur-3xl opacity-60 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-50 rounded-full
                        blur-3xl opacity-40 -translate-x-1/4" />
      </div>

      <div className="container-site relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Coluna esquerda — texto */}
          <div className="space-y-8 animate-fade-in">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100
                            text-brand-700 text-sm font-medium px-4 py-2 rounded-full">
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
              Correção com IA para ENEM e Vestibular
            </div>

            {/* Headline principal */}
            <div className="space-y-4">
              <h1 className="font-display font-bold text-5xl lg:text-6xl xl:text-7xl
                             text-slate-900 leading-[1.08] tracking-tight text-balance">
                Sua melhor nota
                <br />
                começa com uma
                <br />
                <span className="text-gradient">boa redação.</span>
              </h1>

              <p className="text-lg lg:text-xl text-slate-500 leading-relaxed max-w-xl">
                Corrija suas redações com a precisão de um professor experiente.
                Feedback detalhado por competências, grifes no texto e insights
                para você evoluir de verdade.
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

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
              {[
                "Modelo ENEM completo",
                "Vestibular Tradicional",
                "Resultado em segundos",
              ].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                  <span className="text-sm text-slate-600">{item}</span>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex -space-x-2">
                {["🧑‍🎓", "👩‍🏫", "🧑‍💻", "👩‍🎓"].map((emoji, i) => (
                  <div key={i}
                       className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-100 to-brand-200
                                  border-2 border-white flex items-center justify-center text-sm">
                    {emoji}
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
                  <span className="font-semibold text-slate-700">+10.000</span> estudantes já melhoraram suas notas
                </p>
              </div>
            </div>
          </div>

          {/* Coluna direita — mockup */}
          <div className="relative animate-slide-up lg:pl-8">
            <EssayCorrectionMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
