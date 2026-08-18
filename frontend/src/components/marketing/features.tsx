"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { EssayExample } from "./essay-example";
import { ScoreGallery } from "./score-gallery";
import { ManuscriptToDigital } from "./manuscript-to-digital";
import { FeatureOverview } from "./feature-overview";

const teacherFeatures = [
  {
    title: "Acompanhe suas turmas",
    description:
      "Crie turmas, adicione alunos e veja o progresso de cada um em tempo real. Sem pilha de redações na mesa para corrigir.",
  },
  {
    title: "Relatórios de desempenho",
    description:
      "Média da turma por competência, evolução temporal e os alunos que precisam de mais atenção — sem montar planilha à mão.",
  },
  {
    title: "Banco de temas",
    description:
      "Atribua temas para a turma com um clique. Os alunos recebem o tema e enviam a redação diretamente pela plataforma.",
  },
];

const fadeUp = {
  initial: { opacity: 0, transform: "translateY(16px)" },
  whileInView: { opacity: 1, transform: "translateY(0)" },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
};

export function Features() {
  return (
    <section id="funcionalidades" className="section-padding bg-paper-deep">
      <div className="container-site">

        {/* Cabeçalho */}
        <motion.header {...fadeUp} className="mb-16 lg:mb-20">
          <p className="eyebrow mb-5">§ III — Funcionalidades</p>
          <h2 className="font-display font-semibold text-4xl sm:text-5xl lg:text-6xl text-ink leading-[1.05] tracking-[-0.01em] max-w-3xl text-balance">
            O que você recebe, dependendo de quem você é.
          </h2>
        </motion.header>

        {/* Visão geral adaptada do bloco Features 10 (21st.dev) */}
        <motion.div {...fadeUp} className="mb-24 lg:mb-32">
          <FeatureOverview />
        </motion.div>

        {/* ─── Redação exemplo interativa ─── */}
        <motion.div {...fadeUp} className="mb-24 lg:mb-32">
          <div className="flex items-baseline justify-between mb-8 pb-3 border-b-2 border-ink">
            <h3 className="font-display italic font-semibold text-2xl lg:text-3xl text-ink">
              Como chega a correção
            </h3>
            <span className="eyebrow">passe o mouse nas grifes</span>
          </div>
          <EssayExample />
        </motion.div>

        {/* ─── Da folha para a tela ─── */}
        <motion.div {...fadeUp} className="mb-24 lg:mb-32">
          <ManuscriptToDigital />
        </motion.div>

        {/* ─── Galeria de níveis ─── */}
        <motion.div {...fadeUp} className="mb-24 lg:mb-32">
          <ScoreGallery />
        </motion.div>

        {/* ─── Para professores ─── */}
        <div id="professores" className="mb-24 lg:mb-32">
          <div className="flex items-baseline justify-between mb-8 pb-3 border-b-2 border-ink">
            <h3 className="font-display italic font-semibold text-2xl lg:text-3xl text-ink">
              Para professores
            </h3>
            <span className="eyebrow">a turma é sua</span>
          </div>

          <div className="grid md:grid-cols-3 gap-0 border-y border-ink-line">
            {teacherFeatures.map((feature, idx) => (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, transform: "translateY(12px)" }}
                whileInView={{ opacity: 1, transform: "translateY(0)" }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: idx * 0.07, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
                className={`p-8 lg:p-10 ${idx > 0 ? "border-t md:border-t-0 md:border-l border-ink-line" : ""}`}
              >
                <p className="eyebrow mb-3 text-accent">0{idx + 1}</p>
                <h5 className="font-display font-semibold text-xl text-ink mb-3">
                  {feature.title}
                </h5>
                <p className="text-ink-soft leading-[1.55] text-[15px]">
                  {feature.description}
                </p>
              </motion.article>
            ))}
          </div>
        </div>

        {/* ─── Modelos de avaliação ─── */}
        <motion.div {...fadeUp}>
          <div className="flex items-baseline justify-between mb-8 pb-3 border-b-2 border-ink">
            <h3 className="font-display italic font-semibold text-2xl lg:text-3xl text-ink">
              Modelos de avaliação
            </h3>
            <span className="eyebrow">o mesmo critério das bancas</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            <div>
              <p className="font-mono text-xs text-accent uppercase tracking-[0.18em] mb-3">
                Modelo ENEM
              </p>
              <h4 className="font-display font-semibold text-2xl lg:text-3xl text-ink mb-5 leading-tight">
                Cinco competências, nota de zero a duzentos.
              </h4>
              <p className="text-ink-soft leading-[1.6] mb-6">
                Avaliação fiel ao gabarito oficial do INEP — do domínio da língua portuguesa até a proposta de intervenção.
              </p>
              <ul className="space-y-3 text-[15px] text-ink-soft border-t border-ink-line pt-5">
                {[
                  "C1 — Domínio da língua portuguesa",
                  "C2 — Desenvolvimento do tema",
                  "C3 — Seleção de argumentos",
                  "C4 — Coesão e coerência",
                  "C5 — Proposta de intervenção",
                ].map((comp, i) => (
                  <li key={comp} className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-ink-muted w-6">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{comp}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-mono text-xs text-accent uppercase tracking-[0.18em] mb-3">
                Vestibular Tradicional
              </p>
              <h4 className="font-display font-semibold text-2xl lg:text-3xl text-ink mb-5 leading-tight">
                Critérios das bancas que você vai enfrentar.
              </h4>
              <p className="text-ink-soft leading-[1.6] mb-6">
                Avaliação nos moldes FUVEST, UNICAMP, UNESP e demais vestibulares — foco em argumentação, estrutura e domínio da linguagem.
              </p>
              <ul className="space-y-3 text-[15px] text-ink-soft border-t border-ink-line pt-5">
                {[
                  "Adequação ao tema e ao gênero",
                  "Desenvolvimento e argumentação",
                  "Coesão e coerência textual",
                  "Adequação da linguagem",
                ].map((crit, i) => (
                  <li key={crit} className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-ink-muted w-6">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{crit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

        <div className="mt-20 lg:mt-24 pt-8 border-t border-ink-line flex items-center gap-4">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 text-ink font-semibold text-[17px] link-underline"
          >
            Começar grátis
            <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
          </Link>
        </div>
      </div>
    </section>
  );
}
