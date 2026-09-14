import { AlertTriangle, FileCheck2, ShieldCheck, UserCheck } from "lucide-react";

const items = [
  [FileCheck2, "Rubricas explícitas", "A análise segue as competências do ENEM ou critérios pedagógicos adequados ao gênero e à proposta de vestibular."],
  [ShieldCheck, "Evidências do próprio texto", "Notas e orientações devem apontar trechos, acertos e problemas observáveis na redação enviada."],
  [AlertTriangle, "Limites transparentes", "OCR depende da legibilidade da imagem. Textos incompletos ou sem proposta suficiente reduzem a confiabilidade do diagnóstico."],
  [UserCheck, "Professor no controle", "A nota é uma estimativa pedagógica, não oficial. O professor pode revisar o resultado e a contestação humana depende de disponibilidade operacional."],
] as const;

export function CorrectionTrust() {
  return (
    <section id="confianca" className="section-padding border-t border-ink-line bg-paper">
      <div className="container-site">
        <div className="grid gap-12 lg:grid-cols-12">
          <header className="lg:col-span-5">
            <p className="eyebrow">Confiança sem promessas absolutas</p>
            <h2 className="mt-5 font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              Uma correção explicável, feita para orientar decisões.
            </h2>
            <p className="mt-5 leading-relaxed text-ink-soft">
              No vestibular tradicional, a escala de 0 a 100 é uma normalização pedagógica do Redator — não uma nota oficial da FUVEST, Unicamp ou Unesp.
            </p>
          </header>
          <div className="grid gap-px border border-ink-line bg-ink-line sm:grid-cols-2 lg:col-span-7">
            {items.map(([Icon, title, text]) => (
              <article key={title} className="bg-paper p-6">
                <Icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-5 font-display text-xl font-semibold text-ink">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
