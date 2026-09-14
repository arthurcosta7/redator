import Link from "next/link";
import { ArrowRight, BarChart3, Target, TrendingUp } from "lucide-react";

export function ProductProof() {
  return (
    <section className="section-padding border-t border-ink-line bg-paper">
      <div className="container-site grid gap-12 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <p className="eyebrow">Primeiros testes</p>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Ainda não publicamos depoimentos sem validação.
          </h2>
          <p className="mt-5 leading-relaxed text-ink-soft">
            Enquanto reunimos avaliações reais e autorizadas, você pode testar o fluxo gratuitamente e avaliar a utilidade do diagnóstico com a sua própria redação ou turma.
          </p>
          <Link href="/auth/register" className="mt-7 inline-flex items-center gap-2 font-semibold text-accent link-underline">
            Participar dos primeiros testes <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="grid gap-px border border-ink-line bg-ink-line sm:grid-cols-3 lg:col-span-7">
          {[
            [Target, "Prioridade", "A competência que mais limita a nota."],
            [TrendingUp, "Evolução", "Comparação com correções anteriores."],
            [BarChart3, "Próxima ação", "Um plano objetivo para o treino seguinte."],
          ].map(([Icon, title, text]) => {
            const ItemIcon = Icon as typeof Target;
            return <article key={String(title)} className="bg-paper p-6"><ItemIcon className="size-5 text-accent" aria-hidden /><h3 className="mt-6 font-display text-xl font-semibold text-ink">{String(title)}</h3><p className="mt-3 text-sm leading-relaxed text-ink-soft">{String(text)}</p></article>;
          })}
        </div>
      </div>
    </section>
  );
}
