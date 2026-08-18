"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Loader2,
  X,
  AlertCircle,
  ScrollText,
  ChevronRight,
} from "lucide-react";
import { api, getApiError } from "@/lib/api/client";
import type { Turma } from "@/types/turma";

// ─── Modal criar turma ────────────────────────────────────────────────────────

function CreateTurmaModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (t: Turma) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<Turma>("/professor/turmas", {
        name: name.trim(),
        description: description.trim() || null,
      });
      onCreate(res.data);
    } catch (err: unknown) {
      const msg = getApiError(err).detail;
      setError(typeof msg === "string" ? msg : "Erro ao criar turma.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg text-slate-900">Nova Turma</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nome da turma *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="Ex: 3º Ano A — Redação"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none
                         focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-colors bg-white"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Descrição <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Descrição da turma, objetivos, observações…"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none
                         focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-colors bg-white resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Criar Turma
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function TurmasPage() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<Turma[]>("/professor/turmas");
        setTurmas(res.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCreate = (t: Turma) => {
    setTurmas((prev) => [t, ...prev]);
    setShowModal(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {showModal && (
        <CreateTurmaModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900">Turmas</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {loading ? "Carregando…" : `${turmas.length} turma${turmas.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold
                     px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Turma
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
        </div>
      ) : turmas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-12 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Users className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-slate-500 text-sm mb-4">
            Você ainda não criou nenhuma turma.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Criar primeira turma →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {turmas.map((turma) => (
            <Link
              key={turma.id}
              href={`/dashboard/professor/turmas/${turma.id}`}
              className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex items-center gap-4
                         hover:shadow-card-hover transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-purple-600" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-slate-900">{turma.name}</p>
                {turma.description && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{turma.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {turma.active_member_count} ativo{turma.active_member_count !== 1 ? "s" : ""}
                    {turma.member_count > turma.active_member_count && (
                      <span className="text-amber-500">
                        · {turma.member_count - turma.active_member_count} pendente{turma.member_count - turma.active_member_count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <ScrollText className="w-3 h-3" />
                    {turma.essay_count} redaç{turma.essay_count !== 1 ? "ões" : "ão"}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
