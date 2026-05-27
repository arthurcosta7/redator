"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
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
      "Uma correção por dia, para sempre, sem cartão. Você recebe nota por competência e feedback básico. Grifes no texto e insights avançados são exclusivos dos planos pagos.",
  },
  {
    question: "O OCR funciona bem com letra à mão?",
    answer:
      "Sim, na maioria dos casos. Para melhores resultados: boa iluminação, papel liso, foto sem sombra. Letras muito apertadas ou ilegíveis podem ter menos precisão — se isso acontecer, você pode digitar o texto manualmente.",
  },
  {
    question: "Funciona para vestibulares além do ENEM?",
    answer:
      "Sim. Há dois modelos: ENEM (5 competências, 0–200 cada) e Vestibular Tradicional, com os critérios de FUVEST, UNICAMP, UNESP e similares.",
  },
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim, pelo painel de configurações da conta. Sem multa, sem precisar falar com ninguém. Você continua com acesso até o fim do período pago.",
  },
  {
    question: "E a garantia?",
    answer:
      "7 dias a partir do primeiro pagamento. Se não ficou satisfeito, manda um email e devolvemos tudo — sem perguntas.",
  },
  {
    question: "Sou professor. Como funciona para mim?",
    answer:
      "Professores têm acesso gratuito à área de turmas: crie turmas, adicione alunos, atribua temas e veja o desempenho de cada aluno por competência. Os alunos gerenciam as próprias assinaturas.",
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left
                   hover:bg-slate-50/50 transition-colors"
        aria-expanded={open}
      >
        <span className="font-medium text-slate-900 text-sm leading-relaxed">
          {question}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      <div className={cn(
        "overflow-hidden transition-all duration-300",
        open ? "max-h-96" : "max-h-0"
      )}>
        <div className="px-6 pb-5">
          <div className="h-px bg-slate-100 mb-4" />
          <p className="text-slate-500 text-sm leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FAQ() {
  return (
    <section className="section-padding bg-white">
      <div className="container-site">

        <div className="grid lg:grid-cols-[1fr_2fr] gap-16 items-start">
          {/* Lado esquerdo */}
          <div className="lg:sticky lg:top-24">
            <h2 className="font-display font-bold text-4xl lg:text-5xl text-slate-900 mb-4">
              Perguntas
              <br />
              frequentes
            </h2>
            <p className="text-slate-500">
              Não achou o que precisava?{" "}
              <a href="mailto:contato@redator.com.br"
                 className="text-brand-600 hover:text-brand-700 font-medium">
                Manda um email
              </a>
              .
            </p>
          </div>

          {/* Lado direito — perguntas */}
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
