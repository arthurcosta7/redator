import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, BrainCircuit, Clock3, LockKeyhole, Users } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { TeacherWorkflow } from "@/components/marketing/teacher-workflow";
import { CorrectionTrust } from "@/components/marketing/correction-trust";
import { Pricing } from "@/components/marketing/pricing";
import { MarketingMotionProvider } from "@/components/marketing/motion-provider";

export const metadata: Metadata = {
  title: "Redator para professores",
  description: "Correção automática, diagnósticos por aluno, turma e competência — com o professor no controle.",
};

const panels = [
  { icon: Users, title: "Painel por aluno", text: "Acompanhe notas, competências prioritárias, histórico e o que precisa ser treinado na próxima produção." },
  { icon: BarChart3, title: "Painel da turma", text: "Compare entregas e enxergue a distribuição de desempenho por competência para planejar a intervenção coletiva." },
  { icon: BrainCircuit, title: "Tarefas com IA", text: "Gere uma proposta, revise tema e textos motivadores, ajuste instruções e defina o prazo antes de publicar." },
] as const;

export default function ProfessoresPage() {
  return (
    <MarketingMotionProvider>
      <Navbar teacherPage />
      <main id="conteudo-principal">
        <section id="visao-geral" className="bg-paper pb-20 pt-32 lg:pb-28 lg:pt-40">
          <div className="container-site grid gap-12 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <p className="eyebrow">Redator para professores</p>
              <h1 className="mt-6 max-w-5xl font-display text-5xl font-semibold leading-[1.03] text-ink sm:text-6xl lg:text-7xl">
                Menos pilhas para corrigir. Mais clareza para ensinar.
              </h1>
              <p className="mt-7 max-w-2xl text-xl leading-relaxed text-ink-soft">
                Receba a turma corrigida, identifique as competências prioritárias e transforme cada diagnóstico em uma intervenção pedagógica mais precisa.
              </p>
            </div>
            <div className="flex flex-col items-start gap-4 lg:col-span-4 lg:items-end">
              <Link href="/auth/register?type=teacher" className="inline-flex min-h-13 items-center gap-2 bg-accent px-6 font-semibold text-paper hover:bg-accent-deep">Criar minha primeira turma grátis <ArrowRight className="size-4" aria-hidden /></Link>
              <a href="#fluxo-professor" className="font-semibold text-ink-soft link-underline">Ver como funciona</a>
            </div>
          </div>
        </section>

        <section className="border-y border-ink-line bg-paper-deep py-10">
          <div className="container-site grid gap-6 md:grid-cols-3">
            <p className="flex gap-3 text-sm leading-relaxed text-ink-soft"><Clock3 className="size-5 shrink-0 text-accent" aria-hidden />Tarefas, prazos e entregas em um fluxo único.</p>
            <p className="flex gap-3 text-sm leading-relaxed text-ink-soft"><BarChart3 className="size-5 shrink-0 text-accent" aria-hidden />Visão individual e consolidada por competência.</p>
            <p className="flex gap-3 text-sm leading-relaxed text-ink-soft"><LockKeyhole className="size-5 shrink-0 text-accent" aria-hidden />Dados separados por tarefa, turma e professor autorizado.</p>
          </div>
        </section>

        <TeacherWorkflow />

        <section className="section-padding bg-paper">
          <div className="container-site">
            <header className="max-w-3xl"><p className="eyebrow">Demonstração da interface</p><h2 className="mt-5 font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">Do aluno à visão consolidada.</h2></header>
            <div className="mt-12 grid gap-px border border-ink-line bg-ink-line lg:grid-cols-3">
              {panels.map(({ icon: Icon, title, text }, index) => <article key={title} className="bg-paper p-7"><div className="flex items-center justify-between"><Icon className="size-5 text-accent" aria-hidden /><span className="font-mono text-xs text-ink-muted">0{index + 1}</span></div><h3 className="mt-14 font-display text-2xl font-semibold text-ink">{title}</h3><p className="mt-4 text-sm leading-relaxed text-ink-soft">{text}</p></article>)}
            </div>
            <p className="mt-4 font-mono text-xs uppercase tracking-wider text-ink-muted">Representação baseada nos recursos existentes do painel; os dados exibidos são demonstrativos.</p>
          </div>
        </section>

        <CorrectionTrust />
        <Pricing initialAudience="teacher" />

        <section className="section-padding bg-paper">
          <div className="container-site grid gap-10 lg:grid-cols-12"><h2 className="font-display text-4xl font-semibold text-ink lg:col-span-4">Perguntas frequentes</h2><div className="divide-y divide-ink-line border-y border-ink-line lg:col-span-8">{[
            ["O limite é por turma?", "Não. Ele considera alunos ativos únicos em todas as turmas da conta. O mesmo aluno em duas turmas conta uma vez."],
            ["As tarefas gastam créditos do aluno?", "Não. Redações enviadas por uma tarefa fazem parte da operação da conta do professor."],
            ["A IA substitui minha avaliação?", "Não. A nota é uma estimativa pedagógica, o diagnóstico é explicável e o professor continua no controle do processo."],
            ["Como uma vaga é liberada?", "Somente vínculos ativos ocupam vagas. Ao remover um vínculo, a vaga é liberada imediatamente; o histórico permanece protegido no escopo autorizado."],
          ].map(([q, a]) => <details key={q} className="py-5"><summary className="cursor-pointer font-display text-xl font-semibold text-ink">{q}</summary><p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">{a}</p></details>)}</div></div>
        </section>

        <section className="bg-ink py-20 text-paper"><div className="container-site flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><p className="eyebrow text-accent-light">Até três alunos ativos</p><h2 className="mt-5 max-w-3xl font-display text-4xl font-semibold sm:text-5xl">Crie sua primeira turma e valide o fluxo na prática.</h2></div><Link href="/auth/register?type=teacher" className="inline-flex min-h-13 items-center gap-2 bg-accent px-6 font-semibold hover:bg-accent-deep">Criar minha primeira turma grátis <ArrowRight className="size-4" aria-hidden /></Link></div></section>
      </main>
      <Footer />
    </MarketingMotionProvider>
  );
}
