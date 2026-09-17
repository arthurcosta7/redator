"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, Search } from "lucide-react";
import { api, getApiError } from "@/lib/api/client";
import type { AdminUserItem, AdminUsersResponse } from "@/types/admin";

type ReferralLink = {
  id: string;
  owner_id: string;
  owner_name: string;
  url: string;
  is_active: boolean;
  signups: number;
  valid_signups: number;
  pending_review: number;
  paid_conversions: number;
};

type Review = {
  id: string;
  link_id: string;
  user_name: string;
  status: string;
  risk_reason: string | null;
  converted_at: string | null;
  created_at: string;
};

const reasonLabels: Record<string, string> = {
  shared_network: "Rede compartilhada",
  shared_device: "Navegador compartilhado",
  signal_unavailable: "Sinal indisponível",
};

export default function ReferralAdminPage() {
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<AdminUserItem[]>([]);
  const [selected, setSelected] = useState<AdminUserItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const [linkResponse, reviewResponse] = await Promise.all([
        api.get<ReferralLink[]>("/admin/referrals"),
        api.get<Review[]>("/admin/referrals/reviews"),
      ]);
      setLinks(linkResponse.data);
      setReviews(reviewResponse.data);
    } catch {
      setError("Não foi possível carregar as indicações.");
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const searchUsers = async () => {
    if (search.trim().length < 3) return;
    setError("");
    try {
      const response = await api.get<AdminUsersResponse>("/admin/users", {
        params: { search: search.trim(), per_page: 10 },
      });
      setCandidates(response.data.items.filter((user) => user.is_active && !user.admin_role));
    } catch {
      setError("Não foi possível buscar usuários.");
    }
  };

  const create = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/admin/referrals", { owner_id: selected.id });
      setSelected(null);
      setCandidates([]);
      setSearch("");
      await reload();
    } catch (cause) {
      const detail = getApiError(cause).detail;
      setError(typeof detail === "string" ? detail : "Não foi possível criar o link.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (link: ReferralLink) => {
    setBusy(true);
    try {
      await api.patch(`/admin/referrals/${link.id}/active`, null, {
        params: { active: !link.is_active },
      });
      await reload();
    } catch {
      setError("Não foi possível alterar o link.");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (review: Review, status: "valid" | "rejected") => {
    setBusy(true);
    try {
      await api.patch(`/admin/referrals/reviews/${review.id}`, { status });
      await reload();
    } catch {
      setError("Não foi possível registrar a decisão.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Administração</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-slate-900">Indicações privadas</h1>
        <p className="mt-2 text-sm text-slate-600">Cadastros são atribuídos ao link; conversões exigem pagamento confirmado. Casos suspeitos aguardam revisão e não geram benefício automático.</p>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Criar link para usuário</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="referral-user-search">Buscar usuário por nome ou e-mail</label>
          <input id="referral-user-search" value={search} onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void searchUsers(); }}
            placeholder="Nome ou e-mail" className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button onClick={searchUsers} type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"><Search className="size-4" />Buscar</button>
        </div>
        {candidates.length > 0 && <div className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-slate-200">
          {candidates.map((user) => <button key={user.id} type="button" onClick={() => setSelected(user)}
            className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 ${selected?.id === user.id ? "bg-brand-50" : ""}`}>
            {user.full_name} <span className="text-slate-500">({user.email})</span>
          </button>)}
        </div>}
        <button disabled={!selected || busy} onClick={create} type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          {selected ? `Criar link para ${selected.full_name}` : "Selecione um usuário"}
        </button>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">Links e resultados</h2>
        <table className="w-full min-w-[750px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Cadastros</th>
            <th className="px-4 py-3">Válidos</th><th className="px-4 py-3">Em revisão</th>
            <th className="px-4 py-3">Pagantes válidos</th><th className="px-4 py-3">Ações</th>
          </tr></thead>
          <tbody>{links.map((link) => <tr key={link.id} className="border-t border-slate-100">
            <td className="px-4 py-3 font-medium">{link.owner_name}</td>
            <td className="px-4 py-3">{link.signups}</td><td className="px-4 py-3">{link.valid_signups}</td>
            <td className="px-4 py-3">{link.pending_review}</td><td className="px-4 py-3 font-semibold">{link.paid_conversions}</td>
            <td className="px-4 py-3"><div className="flex gap-3">
              <button type="button" onClick={() => navigator.clipboard.writeText(link.url)} className="text-brand-700 hover:underline">Copiar link</button>
              <button type="button" disabled={busy} onClick={() => toggle(link)} className="text-slate-600 hover:underline disabled:opacity-50">{link.is_active ? "Desativar" : "Ativar"}</button>
            </div></td>
          </tr>)}</tbody>
        </table>
        {links.length === 0 && <p className="p-5 text-sm text-slate-500">Nenhum link criado.</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">Revisão de suspeitas</h2>
        {reviews.length === 0 ? <p className="p-5 text-sm text-slate-500">Nenhuma indicação aguardando revisão.</p> :
          <ul className="divide-y divide-slate-100">{reviews.map((review) => <li key={review.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div><p className="font-medium text-slate-900">{review.user_name}</p><p className="text-slate-500">{reasonLabels[review.risk_reason ?? ""] ?? "Sinal suspeito"} · {new Date(review.created_at).toLocaleDateString("pt-BR")}{review.converted_at ? " · Pagamento detectado" : ""}</p></div>
            <div className="flex gap-2"><button disabled={busy} onClick={() => decide(review, "valid")} className="rounded-lg border border-green-300 px-3 py-2 font-semibold text-green-700 disabled:opacity-50">Aprovar</button><button disabled={busy} onClick={() => decide(review, "rejected")} className="rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-700 disabled:opacity-50">Rejeitar</button></div>
          </li>)}</ul>}
      </section>
    </div>
  );
}
