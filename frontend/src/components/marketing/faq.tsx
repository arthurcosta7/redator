"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "A plataforma substitui o professor?",
    answer:
      "Não. A IA organiza a correção e evidencia padrões; o professor interpreta o contexto, acompanha o aluno e transforma o diagnóstico em evolução.",
  },
  {
    question: "Posso confiar na nota que aparece?",
    answer:
      "A nota é uma estimativa pedagógica baseada nas rubricas e em evidências do texto, nunca uma nota oficial. No vestibular tradicional, 0 a 100 é uma normalização do Redator e não equivale à escala oficial de uma banca específica.",
  },
  {
    question: "Como funciona o plano Free?",
    answer:
      "São 4 correções por mês. A primeira demonstra a experiência completa; as seguintes mantêm nota por competência, feedback essencial e grifes principais. Créditos gratuitos não acumulam.",
  },
  {
    question: "O OCR funciona bem com letra à mão?",
    answer:
      "A qualidade depende da legibilidade, iluminação, enquadramento e nitidez. Revise o texto reconhecido antes de enviar; se houver muitos erros, prefira digitar.",
  },
  {
    question: "Funciona para vestibulares além do ENEM?",
    answer:
      "Sim. Há o modelo ENEM, com cinco competências, e o Vestibular Tradicional, que considera tema, gênero, desenvolvimento, coesão e linguagem sem se apresentar como correção oficial de uma banca.",
  },
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim, pelo painel de configurações da conta. Sem multa, sem precisar falar com ninguém. Você continua com acesso até o fim do período pago.",
  },
  {
    question: "Sou professor. Como funciona para mim?",
    answer:
      "Professores começam com até 3 alunos ativos no total e turmas ilimitadas. Os planos Professor 30, 60 e 100 ampliam a capacidade da conta; o mesmo aluno em duas turmas conta uma vez.",
  },
];

function FaqItem({
  question,
  answer,
  number,
}: {
  question: string;
  answer: string;
  number: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li
      className={cn(
        "relative grid grid-cols-12 gap-6 lg:gap-8 py-8 lg:py-10 transition-colors",
        open && "pl-4 -ml-4 border-l-2 border-accent"
      )}
    >
      <span className="col-span-2 sm:col-span-1 font-mono text-xs text-ink-muted pt-1.5">
        {number}
      </span>
      <div className="col-span-10 sm:col-span-11">
        <button
          onClick={() => setOpen(!open)}
          className="w-full text-left group"
          aria-expanded={open}
        >
          <h3 className="font-display font-semibold text-xl lg:text-2xl text-ink leading-snug group-hover:text-accent transition-colors">
            {question}
          </h3>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
              className="overflow-hidden"
            >
              <p className="text-ink-soft text-[15px] leading-[1.65] max-w-2xl pt-5">
                {answer}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

export function FAQ() {
  return (
    <section className="section-padding bg-paper border-t border-ink-line">
      <div className="container-site">

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">

          {/* Lado esquerdo — sticky */}
          <motion.div
            initial={{ opacity: 0, transform: "translateY(12px)" }}
            whileInView={{ opacity: 1, transform: "translateY(0)" }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
            className="lg:col-span-4 lg:sticky lg:top-28"
          >
            <h2 className="font-display font-semibold text-4xl sm:text-5xl lg:text-6xl text-ink leading-[1.05] tracking-[-0.01em] mb-5 text-balance">
              Perguntas frequentes.
            </h2>
            <p className="text-ink-soft leading-relaxed">
              Não achou o que precisava?{" "}
              <a
                href="mailto:suporte@redator.online"
                className="text-accent hover:text-accent-deep font-medium link-underline"
              >
                Manda um email
              </a>
              .
            </p>
          </motion.div>

          {/* Lado direito — lista numerada, sem rounded, réguas horizontais */}
          <ol className="lg:col-span-8 divide-y divide-ink-line border-y border-ink-line">
            {faqs.map((faq, idx) => (
              <FaqItem
                key={faq.question}
                question={faq.question}
                answer={faq.answer}
                number={String(idx + 1).padStart(2, "0")}
              />
            ))}
          </ol>
        </div>

      </div>
    </section>
  );
}
