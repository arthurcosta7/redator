import { Check, X, Minus } from "lucide-react";
import Link from "next/link";

const rows = [
  {
    feature: "Tempo para receber feedback",
    redator: "~30 segundos",
    human: "2 a 7 dias",
    solo: "—",
    r: true, h: false, s: null,
  },
  {
    feature: "Custo por correção",
    redator: "< R$ 0,70",
    human: "R$ 30 a R$ 60",
    solo: "—",
    r: true, h: false, s: null,
  },
  {
    feature: "Nota por competência",
    redator: "Sim",
    human: "Sim",
    solo: "Não",
    r: true, h: true, s: false,
  },
  {
    feature: "Grifes no texto",
    redator: "Sim",
    human: "Às vezes",
    solo: "Não",
    r: true, h: null, s: false,
  },
  {
    feature: "Disponível a qualquer hora",
    redator: "Sim",
    human: "Não",
    solo: "Não",
    r: true, h: false, s: false,
  },
  {
    feature: "Histórico e evolução",
    redator: "Sim",
    human: "Não",
    solo: "Não",
    r: true, h: false, s: false,
  },
];

function Cell({ value, status, highlight }: { value: string; status: boolean | null; highlight?: boolean }) {
  const icon = status === true
    ? <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
    : status === false
    ? <X className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
    : <Minus className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />;

  const color = status === true
    ? highlight ? "text-brand-100" : "text-emerald-600"
    : status === false
    ? highlight ? "text-brand-500" : "text-slate-300"
    : "text-slate-300";

  return (
    <td className={`px-4 py-4 text-center ${highlight ? "bg-brand-700" : ""}`}>
      <div className={`flex items-center justify-center gap-1.5 ${color}`}>
        {icon}
        <span className="text-sm hidden sm:inline font-medium">
          {value}
        </span>
      </div>
    </td>
  );
}

export function Comparison() {
  return (
    <section className="section-padding bg-slate-50">
      <div className="container-site">

        <div className="mb-12">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-slate-900 mb-3">
            Compare
          </h2>
          <p className="text-slate-500 text-lg">
            Feedback sério sem pagar R$50 por redação nem esperar uma semana.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-4 text-left text-sm text-slate-400 font-normal w-2/5" />
                <th className="px-4 py-5 text-center bg-brand-700 relative">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-400 rounded-t" />
                  <span className="font-bold text-white text-sm">Redator</span>
                  <div className="text-xs text-brand-300 font-normal hidden sm:block mt-0.5">
                    desde R$ 19,90/mês
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <span className="font-semibold text-slate-700 text-sm">Correção Humana</span>
                  <div className="text-xs text-slate-400 font-normal hidden sm:block mt-0.5">
                    R$ 30–60 por texto
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <span className="font-semibold text-slate-700 text-sm">Sem feedback</span>
                  <div className="text-xs text-slate-400 font-normal hidden sm:block mt-0.5">
                    escrever sozinho
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row) => (
                <tr key={row.feature} className="hover:bg-white/60 transition-colors">
                  <td className="px-4 py-4 text-sm text-slate-600">{row.feature}</td>
                  <Cell value={row.redator} status={row.r} highlight />
                  <Cell value={row.human} status={row.h} />
                  <Cell value={row.solo} status={row.s} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 bg-brand-700 hover:bg-brand-800
                       text-white font-semibold px-7 py-3.5 rounded-xl shadow-brand
                       hover:shadow-brand-lg transition-all duration-200"
          >
            Começar grátis
          </Link>
        </div>

      </div>
    </section>
  );
}
