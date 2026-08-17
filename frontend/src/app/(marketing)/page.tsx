import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Features } from "@/components/marketing/features";
import { Testimonials } from "@/components/marketing/testimonials";
import { Comparison } from "@/components/marketing/comparison";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { Footer } from "@/components/marketing/footer";
import { Navbar } from "@/components/marketing/navbar";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { MarketingMotionProvider } from "@/components/marketing/motion-provider";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Manifesto — seção de "carta de abertura" entre Hero e Como funciona
function Manifesto() {
  return (
    <section className="section-padding bg-paper border-t border-ink-line">
      <ScrollReveal className="container-site">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16">

          {/* Lado esquerdo — título e metadados */}
          <header className="lg:col-span-4">
            <p className="eyebrow mb-5">§ I — Carta de abertura</p>
            <h2 className="font-display italic font-medium text-4xl lg:text-5xl text-ink leading-[1.05] tracking-[-0.01em] text-balance mb-6">
              Por que a gente construiu o Redator.
            </h2>
            <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-muted space-y-1.5">
              <p>Por — equipe editorial</p>
              <p>Em — Rio de Janeiro, 2026</p>
              <p>Sobre — correção de redação</p>
            </div>
          </header>

          {/* Lado direito — prosa corrida em 3 parágrafos */}
          <div className="lg:col-span-8 space-y-6 text-ink-soft text-[17px] lg:text-[18px] leading-[1.7] font-display">
            <p className="drop-cap">
              Toda semana aparecem redações escritas às pressas, devolvidas com um <em className="text-ink not-italic">&ldquo;pode melhorar&rdquo;</em> rabiscado no canto. A gente sempre achou isso um desperdício. Tem muita gente escrevendo sério e travada no mesmo problema há meses — geralmente por falta de retorno, não de talento.
            </p>
            <p>
              O Redator lê a sua redação com os mesmos critérios das bancas. Devolve nota por competência, grifa os trechos que funcionam e os que travam, e aponta o que mudar da próxima vez. Em menos de um minuto.
            </p>
            <p>
              Não é substituto de professor. É o que pega a maior parte do treino intenso — para que quando você levar a redação para alguém, ela já esteja cinco passos mais polida.
            </p>

            {/* Assinatura */}
            <div className="pt-6 flex items-center gap-4">
              <span className="h-px w-12 bg-ink" />
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                — fim da nota
              </p>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

function ConsistencyProof() {
  return (
    <section className="section-padding bg-paper border-t border-ink-line">
      <ScrollReveal className="container-site">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          <div className="lg:col-span-4">
            <p className="eyebrow mb-5">§ II — Consistência</p>
            <h2 className="font-display font-medium text-4xl lg:text-5xl text-ink leading-[1.05] tracking-[-0.01em] text-balance">
              Mesma redação, mesmo nível de nota.
            </h2>
          </div>

          <div className="lg:col-span-8">
            <div className="border border-ink-line bg-paper-deep p-8 lg:p-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted mb-4">
                Teste de consistência
              </p>
              <p className="font-display text-3xl lg:text-4xl text-ink leading-tight mb-4">
                Validação de consistência em andamento.
              </p>
              <p className="text-ink-soft text-lg leading-relaxed max-w-2xl">
                Rodamos a mesma redação múltiplas vezes para validar se a nota se mantém estável. O objetivo é mostrar a diferença real entre um corretor consistente e sistemas que variam muito de rodada para rodada.
              </p>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

// CTA final
function FinalCTA() {
  return (
    <section className="bg-ink text-paper section-padding">
      <ScrollReveal className="container-site">
        <div className="grid lg:grid-cols-12 gap-12 items-end">

          <div className="lg:col-span-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper/50 mb-6">
              § VIII — Próximo passo
            </p>
            <h2 className="font-display font-medium text-4xl sm:text-5xl lg:text-6xl text-paper leading-[1.05] tracking-[-0.01em] text-balance">
              Crie a sua conta e corrija a próxima redação agora.
            </h2>
            <p className="text-lg text-paper/70 leading-relaxed mt-5 max-w-xl">
              Sem cartão, sem compromisso. Você pratica, vê o feedback, decide se vale a pena continuar.
            </p>
          </div>

          <div className="lg:col-span-4 flex flex-col items-start lg:items-end gap-4">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2.5 bg-accent hover:bg-accent-deep
                         text-paper font-semibold px-7 py-4 rounded text-[17px]
                         transition-colors group interactive-lift"
            >
              Começar grátis
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.25} />
            </Link>
            <Link
              href="/auth/register?type=teacher"
              className="text-paper/70 hover:text-paper text-[14px] font-medium link-underline"
            >
              Sou professor →
            </Link>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

export default function LandingPage() {
  return (
    <MarketingMotionProvider>
      <Navbar />
      <main id="conteudo-principal">
        <Hero />
        <Manifesto />
        <ConsistencyProof />
        <HowItWorks />
        <Features />
        <Testimonials />
        <Comparison />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </MarketingMotionProvider>
  );
}
