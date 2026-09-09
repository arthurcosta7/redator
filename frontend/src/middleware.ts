/**
 * middleware.ts — Proteção de rotas no Next.js
 *
 * Executado em TODA requisição antes da página carregar.
 * Redireciona usuários não autenticados para o login.
 *
 * Como funciona:
 * - Lê o cookie "access_token" (httpOnly, definido pelo backend)
 * - Se ausente em rota protegida → redireciona para /auth/login
 * - Se presente em rota pública (login/register) → redireciona para dashboard
 *
 * NOTA sobre estrutura de pastas Next.js:
 * - Os grupos de rota (auth), (dashboard) NÃO adicionam segmento à URL.
 * - Os arquivos estão em (auth)/auth/login/page.tsx → URL: /auth/login
 * - Os arquivos estão em (dashboard)/dashboard/aluno/page.tsx → URL: /dashboard/aluno
 */
import { NextRequest, NextResponse } from "next/server";

// Rotas que exigem autenticação
const PROTECTED_PREFIXES = [
  "/dashboard",
];

// Rotas que usuários autenticados NÃO devem ver (login, register)
const AUTH_ONLY_PREFIXES = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
];

function createContentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const apiOrigin = isDev
    ? "http://localhost:8000"
    : process.env.NEXT_PUBLIC_API_URL || "";

  return [
    "default-src 'self'",
    // O nonce autoriza apenas os scripts gerados pelo Next nesta requisição.
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${apiOrigin} https://api.stripe.com`,
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    ...(!isDev ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function withCsp(response: NextResponse, policy: string) {
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("access_token")?.value;
  const isAuthenticated = Boolean(accessToken);

  // Verifica se é rota protegida
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // Verifica se é rota de autenticação (login/register)
  const isAuthRoute = AUTH_ONLY_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // Usuário não autenticado tentando acessar rota protegida
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/auth/login", request.url);
    // Salva a página de destino para redirecionar após login
    loginUrl.searchParams.set("redirect", pathname);
    return withCsp(NextResponse.redirect(loginUrl), contentSecurityPolicy);
  }

  // Usuário autenticado tentando acessar login/register
  // (evita que volte para login estando logado)
  if (isAuthRoute && isAuthenticated) {
    return withCsp(
      NextResponse.redirect(new URL("/dashboard/aluno", request.url)),
      contentSecurityPolicy
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  return withCsp(
    NextResponse.next({ request: { headers: requestHeaders } }),
    contentSecurityPolicy
  );
}

// Configura em quais caminhos o middleware é executado
// "matcher" evita rodar em arquivos estáticos e API routes
export const config = {
  matcher: [
    /*
     * Aplica em todos os caminhos EXCETO:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - api routes do Next.js
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
