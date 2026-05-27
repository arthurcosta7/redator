"use client";

import { useState } from "react";
import { Camera, Highlighter, BookOpen, TrendingUp, Users, BarChart2, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "student", label: "Para Alunos", icon: GraduationCap },
  { id: "teacher", label: "Para Professores", icon: Users },
];

const studentFeatures = [
  {
    icon: Camera,
    title: "Foto → Texto em segundos",
    description:
      "Tire uma foto da sua redação manuscrita. Nossa IA extrai o texto automaticamente com alta precisão, mesmo para letras difíceis de ler.",
    color: "bg-brand-50 text-brand-600",
  },
  {
    icon: Highlighter,
    title: "Grifes no texto",
    description:
      "Partes boas em verde, problemas em vermelho. Você vê exatamente onde a redação está forte e onde precisa melhorar — sem precisar adivinhar.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: BookOpen,
    title: "Análise por competências",
    description:
      "Cada uma das 5 competências do ENEM é avaliada separadamente com nota e feedback específico. Para vestibulares, os critérios próprios de cada banca.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: TrendingUp,
    title: "Evolução e histórico",
    description:
      "Veja como sua nota evoluiu ao longo do tempo. Identifique padrões: você melhora nas competências de linguagem mas tem dificuldade na C5? A IA te avisa.",
    color: "bg-amber-50 text-amber-600",
  },
];

const teacherFeatures = [
  {
    icon: Users,
    title: "Acompanhe suas turmas",
    description:
      "Crie turmas, adicione alunos e veja o progresso de cada um em tempo real. Sem pilha de redações na mesa para corrigir.",
    color: "bg-brand-50 text-brand-600",
  },
  {
    icon: BarChart2,
    title: "Relatórios de desempenho",
    description:
      "Dashboards com média da turma por competência, evolução temporal e identificação dos alunos que precisam de mais atenção.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: BookOpen,
    title: "Banco de temas",
    description:
      "Atribua temas para a turma com um clique. Os alunos recebem o tema e enviam as redações diretamente pela plataforma.",
    color: "bg-emerald-50 text-emerald-600",
  },
];

export function Features() {
  const [activeTab, setActiveTab] = useState("student");

  const features = activeTab === "student" ? studentFeatures : teacherFeatures;

  return (
    <section id="funcionalidades" className="section-padding bg-white">
      <div className="container-site">

        <div className="mb-12">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-slate-900 mb-3">
            O que você recebe
          </h2>
          <p className="text-lg text-slate-500">
            Funcionalidades para alunos e professores.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-10">
          <div className="bg-slate-100 p-1 rounded-xl inline-flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    activeTab === tab.id
                      ? "bg-white shadow-sm text-brand-700"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={cn(
                  "card p-8 group",
                  index === 0 && "md:col-span-2 lg:col-span-1"
                )}
              >
                <div className={`w-12 h-12 rounded-2xl ${feature.color} flex items-center justify-center mb-5
                                  group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <h3 className="font-display font-semibold text-xl text-slate-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Essay types */}
        <div id="professores" className="mt-16 grid md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-brand-700 to-brand-900 rounded-2xl p-8 text-white">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full mb-5">
              <span className="text-sm font-semibold">Modelo ENEM</span>
            </div>
            <h3 className="font-display font-bold text-2xl mb-3">
              5 Competências ENEM
            </h3>
            <p className="text-brand-200 mb-5 leading-relaxed">
              Análise fiel ao gabarito oficial, com notas de 0 a 200 por competência.
              Do domínio da língua portuguesa até a proposta de intervenção.
            </p>
            <ul className="space-y-2">
              {[
                "C1 — Domínio da língua portuguesa",
                "C2 — Desenvolvimento do tema",
                "C3 — Seleção de argumentos",
                "C4 — Coesão e coerência",
                "C5 — Proposta de intervenção",
              ].map((comp) => (
                <li key={comp} className="flex items-center gap-2 text-sm text-brand-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-300 shrink-0" />
                  {comp}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-900 rounded-2xl p-8 text-white">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full mb-5">
              <span className="text-sm font-semibold">Vestibular Tradicional</span>
            </div>
            <h3 className="font-display font-bold text-2xl mb-3">
              Critérios das Bancas
            </h3>
            <p className="text-slate-400 mb-5 leading-relaxed">
              Avaliação nos moldes FUVEST, UNICAMP, UNESP e demais vestibulares.
              Foco em argumentação, estrutura e domínio da linguagem.
            </p>
            <ul className="space-y-2">
              {[
                "Adequação ao tema e gênero",
                "Desenvolvimento e argumentação",
                "Coesão e coerência textual",
                "Adequação da linguagem",
              ].map((crit) => (
                <li key={crit} className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                  {crit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
