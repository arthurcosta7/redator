"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, PenLine } from "lucide-react";
import { api } from "@/lib/api/client";

type State = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Link inválido.");
      return;
    }

    api
      .get<{ message: string }>(`/auth/verify-email/${token}`)
      .then((res) => {
        setState("success");
        setMessage(res.data.message);
      })
      .catch((err) => {
        setState("error");
        const detail = err?.response?.data?.detail;
        setMessage(
          typeof detail === "string" ? detail : "Link inválido ou expirado."
        );
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <Link href="/" className="flex items-center gap-2.5 mb-8 group">
        <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center">
          <PenLine className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-display font-bold text-xl text-slate-900">Redator</span>
      </Link>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 w-full max-w-md text-center">
        {state === "loading" && (
          <>
            <Loader2 className="w-10 h-10 text-brand-600 animate-spin mx-auto mb-4" />
            <h1 className="font-display font-bold text-xl text-slate-900 mb-2">
              Verificando seu email…
            </h1>
            <p className="text-sm text-slate-400">Aguarde um momento.</p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="font-display font-bold text-xl text-slate-900 mb-2">
              Email verificado!
            </h1>
            <p className="text-sm text-slate-500 mb-6">{message}</p>
            <Link
              href="/auth/login"
              className="inline-block w-full bg-brand-700 hover:bg-brand-800
                         text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Fazer login →
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="font-display font-bold text-xl text-slate-900 mb-2">
              Link inválido ou expirado
            </h1>
            <p className="text-sm text-slate-500 mb-6">{message}</p>
            <Link
              href="/auth/resend-verification"
              className="inline-block w-full bg-brand-700 hover:bg-brand-800
                         text-white font-semibold py-3 rounded-xl transition-colors mb-3"
            >
              Receber novo link de verificação
            </Link>
            <Link
              href="/auth/login"
              className="block text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Voltar ao login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
