import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";

// O código é público e só identifica a campanha; o servidor valida a atribuição.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL("/", request.url));
  if (/^[a-f0-9]{48}$/.test(code)) {
    const secret = process.env.REFERRAL_CLICK_SECRET;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (secret && apiUrl) {
      // A API recebe apenas um HMAC efêmero da origem, nunca IP ou user-agent.
      // Fora da Vercel não confiamos em X-Forwarded-For enviado pelo cliente.
      const ip = process.env.VERCEL === "1"
        ? (request.headers.get("x-vercel-forwarded-for")?.split(",")[0] ?? "unknown")
        : "unknown";
      const hour = Math.floor(Date.now() / 3_600_000);
      const visitor = createHmac("sha256", secret).update(`${hour}:${ip}`).digest("hex");
      try {
        await fetch(`${apiUrl.replace(/\/$/, "")}/api/v1/marketing/referrals/click`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Referral-Click-Secret": secret, "X-Referral-Visitor": visitor },
          body: JSON.stringify({ code }),
          cache: "no-store",
          signal: AbortSignal.timeout(1200),
        });
      } catch {
        // Métrica indisponível não impede o visitante de entrar no produto.
      }
    }
    response.cookies.set("redator_ref", code, {
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return response;
}
