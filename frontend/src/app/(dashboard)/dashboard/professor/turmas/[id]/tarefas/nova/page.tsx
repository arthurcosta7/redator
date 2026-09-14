"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  AlertCircle,
  CalendarClock,
  BookOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { api, getApiError } from "@/lib/api/client";
import type { TarefaResponse, MotivatingText } from "@/types/turma";
import { useUser } from "@/contexts/UserContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-slate-700 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function InputClass(extra = "") {
  return `w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none
          focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-colors ${extra}`;
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function NovaTarefaPage() {
  const { id: turmaId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const canGenerateWithAI = (user?.teacher_student_slots ?? 0) >= 30;

  const [title, setTitle] = useState("");
  const [essayType, setEssayType] = useState<"enem" | "vestibular">("enem");
  const [theme, setTheme] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [motivatingTexts, setMotivatingTexts] = useState<MotivatingText[]>([]);

  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post<{ theme: string; motivating_texts: MotivatingText[] }>(
        "/professor/tarefas/gerar-tema",
        { essay_type: essayType }
      );
      setTheme(res.data.theme);
      setMotivatingTexts(res.data.motivating_texts);
    } catch (err: unknown) {
      const msg = getApiError(err).detail;
      setError(typeof msg === "string" ? msg : "Erro ao gerar tema. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !theme.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post<TarefaResponse>(`/professor/turmas/${turmaId}/tarefas`, {
        title: title.trim(),
        essay_type: essayType,
        theme: theme.trim(),
        instructions: instructions.trim() || undefined,
        due_date: dueDate || undefined,
        motivating_texts: motivatingTexts.length > 0 ? motivatingTexts : undefined,
      });
      router.push(`/dashboard/professor/turmas/${turmaId}`);
    } catch (err: unknown) {
      const msg = getApiError(err).detail;
      setError(typeof msg === "string" ? msg : "Erro ao criar tarefa.");
    } finally {
      setSaving(false);
    }
  };

  const addMotivatingText = () => {
    setMotivatingTexts((prev) => [...prev, { title: "", content: "" }]);
  };

  const updateMotivatingText = (index: number, field: keyof MotivatingText, value: string) => {
    setMotivatingTexts((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  };

  const removeMotivatingText = (index: number) => {
    setMotivatingTexts((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900">Nova Tarefa</h2>
          <p className="text-sm text-slate-400 mt-0.5">Crie uma tarefa de redação para seus alunos</p>
        </div>
      </div>

      {error && (
        <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Título */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4">
          <div>
            <Label required>Título da Tarefa</Label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Ex: Redação 1 — Semana 3"
              className={InputClass()}
              required
            />
          </div>

          <div>
            <Label required>Modelo de Redação</Label>
            <div className="flex gap-3">
              {(["enem", "vestibular"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEssayType(type)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                    essayType === type
                      ? "border-brand-400 bg-brand-50 text-brand-800"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {type === "enem" ? "ENEM" : "Vestibular"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label required>Prazo de Entrega (opcional)</Label>
            <div className="relative">
              <CalendarClock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={InputClass("pl-10")}
              />
            </div>
          </div>
        </div>

        {/* Tema */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-slate-900">Tema da Redação</h3>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !canGenerateWithAI}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100
                         text-xs font-medium text-amber-800 transition-colors disabled:opacity-60"
            >
              {generating
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Sparkles className="w-3.5 h-3.5" />}
              {canGenerateWithAI ? "Gerar com IA" : "IA no Professor 30"}
            </button>
          </div>

          <div>
            <Label required>Tema</Label>
            <textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Descreva o tema da redação..."
              className={InputClass("resize-none")}
              required
            />
          </div>

          <div>
            <Label>Instruções Adicionais (opcional)</Label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Instruções específicas para os alunos..."
              className={InputClass("resize-none")}
            />
          </div>
        </div>

        {/* Textos motivadores */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-400" />
                Textos Motivadores
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Opcional — textos de apoio para os alunos</p>
            </div>
            {motivatingTexts.length < 4 && (
              <button
                type="button"
                onClick={addMotivatingText}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            )}
          </div>

          {motivatingTexts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-3">
              Nenhum texto adicionado. Use &quot;Gerar com IA&quot; ou adicione manualmente.
            </p>
          ) : (
            <div className="space-y-4">
              {motivatingTexts.map((mt, i) => (
                <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Texto {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMotivatingText(i)}
                      className="p-1 rounded text-slate-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <Label>Título do Texto</Label>
                    <input
                      type="text"
                      value={mt.title}
                      onChange={(e) => updateMotivatingText(i, "title", e.target.value)}
                      maxLength={200}
                      placeholder="Título"
                      className={InputClass()}
                    />
                  </div>
                  <div>
                    <Label>Conteúdo</Label>
                    <textarea
                      value={mt.content}
                      onChange={(e) => updateMotivatingText(i, "content", e.target.value)}
                      maxLength={2000}
                      rows={4}
                      placeholder="Trecho do texto..."
                      className={InputClass("resize-none")}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !theme.trim() || saving}
            className="flex-1 py-3 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar Tarefa
          </button>
        </div>
      </form>
    </div>
  );
}
