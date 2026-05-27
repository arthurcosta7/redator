import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Beatriz F.",
    role: "Aprovada em Medicina — FUVEST",
    initials: "BF",
    bg: "bg-brand-100 text-brand-800",
    rating: 5,
    text: "Eu ficava mandando redação pro cursinho e esperando semanas. Quando chegava o feedback era uma folha com três comentários genéricos. Aqui é diferente — você vê exatamente qual parágrafo tem problema e por quê.",
  },
  {
    name: "Lucas M.",
    role: "3º ano do Ensino Médio — SP",
    initials: "LM",
    bg: "bg-violet-100 text-violet-800",
    rating: 4,
    text: "Honestamente não esperava que ia ajudar tanto. Descobri que eu começava todo parágrafo de conclusão com 'Portanto' ou 'Sendo assim'. Parece besta, mas nunca ninguém tinha me apontado isso antes.",
  },
  {
    name: "Ana P.",
    role: "Aprovada em Direito — USP",
    initials: "AP",
    bg: "bg-emerald-100 text-emerald-800",
    rating: 5,
    text: "Fiz mais de 60 redações nos dois meses antes do ENEM. Não teria conseguido sem um retorno rápido. Não é substituto de professor, mas pra treino constante é exatamente o que precisava.",
  },
  {
    name: "Gabriel T.",
    role: "Professor de Redação — SP",
    initials: "GT",
    bg: "bg-amber-100 text-amber-800",
    rating: 5,
    text: "Uso para acompanhar minhas turmas. Consigo ver rapidamente quem está com dificuldade em qual competência, sem precisar ler cada texto do zero. Isso me sobrou tempo pra me dedicar às dúvidas que realmente precisam de mim.",
  },
  {
    name: "Camila S.",
    role: "Cursinho pré-vestibular — RJ",
    initials: "CS",
    bg: "bg-pink-100 text-pink-800",
    rating: 4,
    text: "Já testei dois outros serviços parecidos. Os feedbacks eram vagos demais. Aqui o comentário sobre a C5 foi tão específico que em três redações eu já tinha melhorado bastante nessa competência.",
  },
  {
    name: "Felipe N.",
    role: "Aprovado em Engenharia — UNICAMP",
    initials: "FN",
    bg: "bg-blue-100 text-blue-800",
    rating: 5,
    text: "Minha C5 sempre foi fraca. O problema era que eu propunha a solução mas não dizia quem ia executar. Parece óbvio depois que te falam, mas eu nunca tinha percebido sozinho. A nota nessa competência subiu bastante depois disso.",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i}
          className={`w-3 h-3 ${i < count ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-200"}`}
        />
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="section-padding bg-slate-50">
      <div className="container-site">

        <div className="mb-12">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-slate-900 mb-3">
            O que dizem quem usa
          </h2>
          <p className="text-slate-500 text-lg">
            Estudantes e professores que fazem parte da plataforma.
          </p>
        </div>

        {/* Grade */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          {testimonials.map((t) => (
            <div key={t.name}
                 className="break-inside-avoid bg-white rounded-2xl border border-slate-100
                            shadow-card p-6">

              {/* Autor */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-9 h-9 rounded-full ${t.bg} flex items-center justify-center
                                 text-xs font-bold shrink-0`}>
                  {t.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-400 truncate">{t.role}</p>
                </div>
                <Stars count={t.rating} />
              </div>

              {/* Texto */}
              <p className="text-slate-600 text-sm leading-relaxed">
                &ldquo;{t.text}&rdquo;
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
