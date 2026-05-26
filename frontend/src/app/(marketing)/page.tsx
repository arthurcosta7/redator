import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Features } from "@/components/marketing/features";
import { Pricing } from "@/components/marketing/pricing";
import { Footer } from "@/components/marketing/footer";
import { Navbar } from "@/components/marketing/navbar";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// CTA Section final
function FinalCTA() {
  return (
    <section className="section-padding bg-brand-gradient">
      <div className="container-site text-center">
        <h2 className="font-display font-bold text-4xl lg:text-5xl text-white mb-4 text-balance">
          Pronto para melhorar sua redação?
        </h2>
        <p className="text-lg text-brand-200 mb-8 max-w-xl mx-auto">
          Comece gratuitamente hoje. Sem cartão de crédito, sem compromisso.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/auth/register"
            className="inline-flex items-center justify-center gap-2 bg-white text-brand-700
                       font-semibold px-8 py-3.5 rounded-xl hover:bg-brand-50
                       transition-colors shadow-lg group"
          >
            Criar conta grátis
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/auth/register?type=teacher"
            className="inline-flex items-center justify-center gap-2 bg-white/10 text-white
                       font-semibold px-8 py-3.5 rounded-xl hover:bg-white/20
                       transition-colors border border-white/20"
          >
            Sou professor
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
