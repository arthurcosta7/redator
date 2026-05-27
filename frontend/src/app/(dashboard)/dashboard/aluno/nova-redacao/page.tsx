"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  FileText,
  Camera,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";
import type { EssayType } from "@/types/essay";

// ─── Contador de palavras ────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// ─── Selector de tipo de redação ─────────────────────────────────────────────

function EssayTypeSelector({
  value,
  onChange,
}: {
  value: EssayType;
  onChange: (v: EssayType) => void;
}) {
  const options: { value: EssayType; label: string; sub: string }[] = [
    {
      value: "enem",
      label: "ENEM",
      sub: "5 competências • até 1000 pts",
    },
    {
      value: "vestibular",
      label: "Vestibular",
      sub: "4 critérios • até 100 pts",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            value === opt.value
              ? "border-brand-500 bg-brand-50"
              : "border-slate-200 hover:border-slate-300 bg-white"
          }`}
        >
          <p
            className={`font-display font-bold text-base ${
              value === opt.value ? "text-brand-700" : "text-slate-700"
            }`}
          >
            {opt.label}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{opt.sub}</p>
        </button>
      ))}
    </div>
  );
}

// ─── Dropzone para foto ───────────────────────────────────────────────────────

function PhotoUploadZone({
  file,
  onFile,
  onRemove,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onRemove: () => void;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  if (file) {
    const url = URL.createObjectURL(file);
    return (
      <div className="relative rounded-xl overflow-hidden border border-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Redação enviada"
          className="w-full max-h-80 object-contain bg-slate-50"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm text-slate-600 truncate">{file.name}</span>
          <span className="text-xs text-slate-400 ml-auto">
            {(file.size / 1024).toFixed(0)} KB
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
        isDragActive
          ? "border-brand-400 bg-brand-50"
          : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/30"
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
      <p className="text-sm font-medium text-slate-700">
        {isDragActive ? "Solte a imagem aqui" : "Arraste a foto ou clique para selecionar"}
      </p>
      <p className="text-xs text-slate-400 mt-1">
        JPEG, PNG ou WebP · Máximo 5 MB
      </p>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function NovaRedacaoPage() {
  const router = useRouter();
  const { user } = useUser();

  const [mode, setMode] = useState<"text" | "photo">("text");
  const [essayType, setEssayType] = useState<EssayType>("enem");
  const [theme, setTheme] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = wordCount(content);
  const MIN_WORDS = 100;
  const MAX_WORDS = 500;
  const tooShort = words < MIN_WORDS && content.trim() !== "";
  const tooLong = words > MAX_WORDS;

  const themeOk = theme.trim().length >= 5;

  const canSubmit = themeOk && (
    mode === "text"
      ? words >= MIN_WORDS && !tooLong
      : photo !== null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      let essayId: string;

      if (mode === "text") {
        const res = await api.post<{ id: string }>("/essays", {
          essay_type: essayType,
          theme: theme.trim(),
          content: content.trim(),
          ...(title.trim() ? { title: title.trim() } : {}),
        });
        essayId = res.data.id;
      } else {
        const formData = new FormData();
        formData.append("file", photo!);
        formData.append("essay_type", essayType);
        formData.append("theme", theme.trim());
        if (title.trim()) formData.append("title", title.trim());

        const res = await api.post<{ id: string }>("/essays/photo", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        essayId = res.data.id;
      }

      router.push(`/dashboard/aluno/correcao/${essayId}`);
    } catch (err: any) {
      const msg = err?.response?.data?.detail;
      setError(
        typeof msg === "string"
          ? msg
          : "Erro ao enviar redação. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="font-display font-bold text-2xl text-slate-900">
          Nova Redação
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Envie o texto ou uma foto da sua redação para receber correção com IA.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Modo de entrada */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">
            Modo de envio
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                mode === "text"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              <FileText className="w-4 h-4" />
              Digitar texto
            </button>
            <button
              type="button"
              onClick={() => setMode("photo")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                mode === "photo"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              <Camera className="w-4 h-4" />
              Foto da redação
            </button>
          </div>
        </div>

        {/* Tipo de redação */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">
            Modelo de correção
          </p>
          <EssayTypeSelector value={essayType} onChange={setEssayType} />
        </div>

        {/* Tema da redação (obrigatório) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Tema da redação
          </label>
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            maxLength={500}
            placeholder="Ex: Desafios da mobilidade urbana no Brasil"
            className={`w-full px-4 py-2.5 rounded-xl border text-sm
                        outline-none transition-colors bg-white placeholder:text-slate-300
                        focus:ring-2
                        ${
                          theme.trim().length > 0 && !themeOk
                            ? "border-amber-300 focus:border-amber-400 focus:ring-amber-100"
                            : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
                        }`}
          />
          {theme.trim().length > 0 && !themeOk && (
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Tema muito curto — descreva melhor o tema proposto
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1.5">
            A IA usará o tema para avaliar adequação, argumentação e proposta de intervenção.
          </p>
        </div>

        {/* Título (opcional) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Título{" "}
            <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            placeholder="Ex: A crise silenciosa das cidades brasileiras"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                       outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50
                       transition-colors bg-white placeholder:text-slate-300"
          />
        </div>

        {/* Conteúdo */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          {mode === "text" ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">
                  Texto da redação
                </label>
                <span
                  className={`text-xs font-medium ${
                    tooLong
                      ? "text-red-600"
                      : tooShort
                      ? "text-amber-600"
                      : "text-slate-400"
                  }`}
                >
                  {words} / {MAX_WORDS} palavras
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                placeholder={`Escreva sua redação aqui...\n\nMínimo de ${MIN_WORDS} palavras para uma análise completa.`}
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none
                            transition-colors bg-white placeholder:text-slate-300 resize-none
                            leading-relaxed font-sans
                            ${tooLong || tooShort
                              ? "border-amber-300 focus:border-amber-400 focus:ring-amber-100"
                              : "border-slate-200 focus:border-brand-400 focus:ring-brand-50"
                            } focus:ring-2`}
              />
              {tooShort && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Mínimo de {MIN_WORDS} palavras ({MIN_WORDS - words} restando)
                </p>
              )}
              {tooLong && (
                <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Máximo de {MAX_WORDS} palavras
                </p>
              )}
            </>
          ) : (
            <>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Foto da redação
              </label>
              <PhotoUploadZone
                file={photo}
                onFile={setPhoto}
                onRemove={() => setPhoto(null)}
              />
              <p className="text-xs text-slate-400 mt-2">
                Certifique-se que o texto está legível e com boa iluminação.
              </p>
            </>
          )}
        </div>

        {/* Erro global */}
        {error && (
          <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="w-full bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed
                     text-white font-semibold py-3.5 rounded-xl transition-colors
                     flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando para correção…
            </>
          ) : (
            "Enviar para correção →"
          )}
        </button>

        <p className="text-xs text-center text-slate-400">
          A correção leva alguns segundos. Você pode fechar e voltar depois.
        </p>
      </form>
    </div>
  );
}
