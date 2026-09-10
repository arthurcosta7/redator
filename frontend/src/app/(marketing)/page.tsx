import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Features } from "@/components/marketing/features";
import { Testimonials } from "@/components/marketing/testimonials";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { Footer } from "@/components/marketing/footer";
import { Navbar } from "@/components/marketing/navbar";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { MarketingMotionProvider } from "@/components/marketing/motion-provider";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// CTA final
function FinalCTA() {
  return (
    <section className="bg-ink text-paper section-padding">
      <ScrollReveal className="container-site">
        <div className="grid lg:grid-cols-12 gap-12 items-end">

          <div className="lg:col-span-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper/50 mb-6">
              Próximo passo
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
              Corrigir minha redação grátis
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
        <HowItWorks />
        <Features />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </MarketingMotionProvider>
  );
}
