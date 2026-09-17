import Link from "next/link";

export const metadata = { title: "Privacidade | Redator" };

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-paper px-5 py-12 text-ink sm:py-20">
      <article className="mx-auto max-w-2xl space-y-6">
        <Link href="/" className="text-sm text-accent-deep hover:underline">← Voltar ao Redator</Link>
        <h1 className="font-display text-4xl font-semibold">Privacidade</h1>
        <p>Esta página resume os dados usados para operar a plataforma. Antes de uma publicação comercial, a política completa deve ser revisada com orientação jurídica.</p>
        <section className="space-y-2">
          <h2 className="font-display text-2xl font-semibold">Indicações privadas</h2>
          <p>Quando você acessa um link de indicação, guardamos um código em cookie próprio por até 30 dias para atribuir um eventual cadastro. No cadastro, um identificador aleatório do navegador pode ser usado para detectar abuso. Ele não é um identificador de hardware e pode ser apagado nas configurações do navegador.</p>
          <p>O endereço de rede e esse identificador são transformados por uma função criptográfica antes da verificação temporária de duplicidade, mantida por até 90 dias. Redes compartilhadas não causam bloqueio automático da conta; atribuições suspeitas são revisadas pela equipe. A plataforma registra apenas os dados necessários para medir cadastros e assinaturas associados ao link.</p>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-2xl font-semibold">Controle</h2>
          <p>Você pode apagar cookies e armazenamento local pelo navegador. Isso impede a associação de novos cadastros ao link, mas não desfaz dados de conta e pagamentos já registrados. Para solicitações sobre seus dados, use os canais de suporte exibidos na plataforma.</p>
        </section>
      </article>
    </main>
  );
}
