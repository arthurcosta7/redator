"use client";

import { motion } from "framer-motion";
import { BarChart3, BookOpenCheck, CalendarClock, Sparkles, UserPlus, Users } from "lucide-react";

const steps = [
  ["01", "Crie a tarefa", "Defina tema e instruções ou gere uma proposta com IA."],
  ["02", "Organize a turma", "Selecione alunos, envie convites e estabeleça o prazo."],
  ["03", "Centralize as entregas", "Cada redação da tarefa chega ao painel correto."],
  ["04", "Receba a correção", "A plataforma aplica a régua escolhida e organiza evidências."],
  ["05", "Leia o diagnóstico", "Veja cada aluno, a turma e o desempenho por competência."],
  ["06", "Planeje a intervenção", "Identifique a prioridade coletiva e o próximo treino individual."],
] as const;

const capabilities = [
  [Users, "Turmas e alunos"], [UserPlus, "Convites"],
  [CalendarClock, "Tarefas com prazo"], [Sparkles, "Geração com IA"],
  [BookOpenCheck, "Entregas e correções"], [BarChart3, "Evolução individual e coletiva"],
] as const;

export function TeacherWorkflow({ compact = false }: { compact?: boolean }) {
  return (
    <section id="fluxo-professor" className="section-padding scroll-mt-24 bg-ink text-paper">
      <div className="container-site">
        <motion.header initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-3xl">
          <p className="eyebrow text-accent-light">Do envio à próxima intervenção</p>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            A IA organiza a correção. O professor transforma o diagnóstico em evolução.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/70">
            Menos tempo no operacional e uma visão mais clara do que cada aluno — e a turma inteira — precisa trabalhar.
          </p>
        </motion.header>

        <ol className={`mt-12 grid border-l border-t border-paper/15 ${compact ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3"}`}>
          {steps.map(([number, title, description]) => (
            <li key={number} className="min-h-52 border-b border-r border-paper/15 p-6 lg:p-8">
              <span className="font-mono text-xs text-accent-light">{number}</span>
              <h3 className="mt-8 font-display text-2xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-paper/65">{description}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Recursos para professores">
          {capabilities.map(([Icon, label]) => (
            <div key={label} className="flex items-center gap-3 border border-paper/15 px-4 py-3 text-sm text-paper/80">
              <Icon className="size-4 text-accent-light" aria-hidden /> {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
