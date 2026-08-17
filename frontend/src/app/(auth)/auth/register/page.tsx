import Link from "next/link";
import { GraduationCap, BookOpen, PenLine } from "lucide-react";

export default function RegisterTypePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-10 group">
        <div className="w-9 h-9 bg-brand-700 rounded-lg flex items-center justify-center">
          <PenLine className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-display font-bold text-2xl text-slate-900">Redator</span>
      </Link>

      {/* Card de seleção */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-2xl text-slate-900 mb-2">
            Criar conta
          </h1>
          <p className="text-slate-500">
            Escolha o tipo de conta que se encaixa para você
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">

          {/* Aluno */}
          <Link
            href="/auth/register/aluno"
            className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2
                       border-slate-200 hover:border-brand-500 hover:bg-brand-50/50
                       transition-[border-color,background-color,color,transform] duration-200 cursor-pointer"
          >
            <div className="w-14 h-14 bg-brand-50 group-hover:bg-brand-100
                            rounded-2xl flex items-center justify-center transition-colors">
              <GraduationCap className="w-7 h-7 text-brand-600" strokeWidth={1.75} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">
                Sou aluno
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Corrija suas redações
              </p>
            </div>
          </Link>

          {/* Professor */}
          <Link
            href="/auth/register/professor"
            className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2
                       border-slate-200 hover:border-violet-500 hover:bg-violet-50/50
                       transition-[border-color,background-color,color,transform] duration-200 cursor-pointer"
          >
            <div className="w-14 h-14 bg-violet-50 group-hover:bg-violet-100
                            rounded-2xl flex items-center justify-center transition-colors">
              <BookOpen className="w-7 h-7 text-violet-600" strokeWidth={1.75} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-900 group-hover:text-violet-700 transition-colors">
                Sou professor
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Acompanhe turmas
              </p>
            </div>
          </Link>
        </div>

        <p className="text-center text-sm text-slate-400 mt-6">
          Já tem conta?{" "}
          <Link href="/auth/login" className="text-brand-700 hover:text-brand-800 font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
