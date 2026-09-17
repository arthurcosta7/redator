import { NextRequest, NextResponse } from "next/server";

// O código é público e só identifica a campanha; o servidor valida a atribuição.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL("/", request.url));
  if (/^[a-f0-9]{48}$/.test(code)) {
    response.cookies.set("redator_ref", code, {
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return response;
}
