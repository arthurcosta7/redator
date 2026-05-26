import { FileText, Cpu, BarChart3, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: FileText,
    title: "Envie sua redação",
    description:
      "Digite o texto ou tire uma foto da redação escrita à mão. Nossa IA extrai o texto automaticamente com tecnologia OCR.",
    detail: "Formatos suportados: texto digitado, foto (JPG/PNG)",
    color: "bg-brand-50 text-brand-600",
    borderColor: "border-brand-100",
  },
  {
    number: "02",
    icon: Cpu,
    title: "IA analisa cada competência",
    description:
      "Nosso modelo de linguagem avalia sua redação seguindo rigorosamente o edital do ENEM ou os critérios do vestibular escolhido.",
    detail: "Análise em segundos, com profundidade de um corretor humano",
    color: "bg-violet-50 text-violet-600",
    borderColor: "border-violet-100",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "Receba feedback detalhado",
    description:
      "Veja sua nota por competência, grifes nos trechos bons e ruins, e um plano claro do que melhorar na próxima redação.",
    detail: "Grifes, insights e comparativo com redações anteriores",
    color: "bg-emerald-50 text-emerald-600",
    borderColor: "border-emerald-100",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="section-padding bg-slate-50">
      <div className="container-site">

        {/* Header da seção */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-widest mb-3">
            Como funciona
          </p>
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-slate-900 mb-4">
            De zero ao feedback em{" "}
            <span className="text-gradient">menos de 1 minuto</span>
          </h2>
          <p className="text-lg text-slate-500">
            O processo é simples. Você escreve, a IA corrige — sem complicação.
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

        {/* CTA abaixo */}
        <div className="text-center mt-12">
          <a
            href="/auth/register"
            className="inline-flex items-center gap-2 text-brand-700 font-semibold
                       hover:gap-3 transition-all duration-200"
          >
            Experimentar grátis agora
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
