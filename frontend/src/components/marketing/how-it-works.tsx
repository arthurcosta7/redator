import { FileText, Cpu, BarChart3, ArrowRight } from "lucide-react";
import Link from "next/link";

const steps = [
  {
    number: "01",
    icon: FileText,
    title: "Envie sua redação",
    description:
      "Digite o texto ou tire uma foto da redação escrita à mão. Nossa tecnologia OCR extrai o texto automaticamente, mesmo com letras cursivas difíceis.",
    detail: "Texto digitado ou foto (JPG/PNG) — até 5 MB",
    color: "bg-brand-50 text-brand-600",
    borderColor: "border-brand-100",
  },
  {
    number: "02",
    icon: Cpu,
    title: "A IA analisa cada competência",
    description:
      "A IA avalia sua redação seguindo os critérios do ENEM ou da banca de vestibular escolhida. Cada competência recebe nota e comentário individual.",
    detail: "Resultado em ~30 segundos",
    color: "bg-violet-50 text-violet-600",
    borderColor: "border-violet-100",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "Evolua de verdade",
    description:
      "Receba nota por competência, grifes nos trechos bons e ruins, e um plano de ação claro para a próxima redação. Você saberá exatamente o que melhorar.",
    detail: "Grifes, insights, histórico e comparativo de evolução",
    color: "bg-emerald-50 text-emerald-600",
    borderColor: "border-emerald-100",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="section-padding bg-slate-50">
      <div className="container-site">

        <div className="mb-14">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-slate-900 mb-3">
            Como funciona
          </h2>
          <p className="text-lg text-slate-500">
            Três passos, menos de um minuto.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">

          {/* Linha conectora (desktop) */}
          <div className="hidden lg:block absolute top-16 left-0 right-0 h-px
                          bg-gradient-to-r from-transparent via-slate-200 to-transparent
                          pointer-events-none mx-[16.5%]" />

          <div className="grid lg:grid-cols-3 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="relative">
                  <div className={`card p-8 border ${step.borderColor} h-full`}>

                    {/* Número do step */}
                    <div className="flex items-start justify-between mb-6">
                      <div className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center`}>
                        <Icon className="w-6 h-6" strokeWidth={1.75} />
                      </div>
                      <span className="font-display font-bold text-5xl text-slate-100 leading-none">
                        {step.number}
                      </span>
                    </div>

                    {/* Conteúdo */}
                    <h3 className="font-display font-semibold text-xl text-slate-900 mb-3">
                      {step.title}
                    </h3>
                    <p className="text-slate-500 leading-relaxed mb-4">
                      {step.description}
                    </p>
                    <p className="text-sm text-slate-400 font-medium">
                      {step.detail}
                    </p>
                  </div>

                  {/* Seta entre steps (mobile) */}
                  {index < steps.length - 1 && (
                    <div className="lg:hidden flex justify-center py-2">
                      <ArrowRight className="w-5 h-5 text-slate-300 rotate-90" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center mt-12">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 text-brand-700 font-semibold
                       hover:gap-3 transition-all duration-200"
          >
            Experimentar grátis
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
