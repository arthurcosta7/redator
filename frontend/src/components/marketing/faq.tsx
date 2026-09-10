"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "O feedback é tão bom quanto o de um professor humano?",
    answer:
      "Para análise objetiva de competências, é muito próximo. A vantagem é consistência: os mesmos critérios, sem dias ruins, sem subjetividade. Para mentoria personalizada e desenvolvimento de escrita no longo prazo, um professor ainda faz diferença. Mas para treino constante e identificar padrões de erro, a plataforma resolve bem.",
  },
  {
    question: "Posso confiar na nota que aparece?",
    answer:
      "A nota segue os critérios publicados pelo INEP para o ENEM e das bancas de vestibular. É uma estimativa estruturada — não é o gabarito oficial, mas é consistente e útil para saber onde você está. O mais importante é o diagnóstico por competência, não o número em si.",
  },
  {
    question: "Como funciona o plano Free?",
    answer:
      "Uma correção por dia, para sempre, sem cartão. Você recebe nota por competência e feedback básico. Grife no texto e insights avançados são exclusivos dos planos pagos.",
  },
  {
    question: "O OCR funciona bem com letra à mão?",
    answer:
      "Sim, na maioria dos casos. Para melhores resultados: boa iluminação, papel liso, foto sem sombra. Letras muito apertadas ou ilegíveis podem ter menos precisão — se isso acontecer, você pode digitar o texto manualmente.",
  },
  {
    question: "Funciona para vestibulares além do ENEM?",
    answer:
      "Sim. Há dois modelos: ENEM (cinco competências, 0–200 cada) e Vestibular Tradicional, com os critérios de FUVEST, UNICAMP, UNESP e similares.",
  },
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim, pelo painel de configurações da conta. Sem multa, sem precisar falar com ninguém. Você continua com acesso até o fim do período pago.",
  },
  {
    question: "E a garantia?",
    answer:
      "Sete dias a partir do primeiro pagamento. Se não ficou satisfeito, manda um email e devolvemos tudo — sem perguntas.",
  },
  {
    question: "Sou professor. Como funciona para mim?",
    answer:
      "Professores começam gratuitamente com até 3 alunos ativos por turma. Para ampliar, cada pacote de R$ 11,99/mês adiciona 10 vagas distribuídas livremente entre as turmas, além dos insights detalhados por tarefa. As assinaturas pessoais dos alunos continuam separadas.",
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
                href="mailto:contato@redator.com.br"
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
