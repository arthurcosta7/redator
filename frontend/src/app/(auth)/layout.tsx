// Layout para todas as páginas de autenticação
// Não inclui navbar/footer — foco total no formulário
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="conteudo-principal" className="auth-shell app-canvas min-h-dvh">
      {children}
    </main>
  );
}
