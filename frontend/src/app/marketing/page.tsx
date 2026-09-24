"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, ClipboardCopy, Link2, LogOut, Menu, Plus, RefreshCw, Users, X } from "lucide-react";
import { api, getApiError } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";
import type { AdminUserItem, AdminUsersResponse } from "@/types/admin";

type Tab = "overview" | "referrals" | "leads" | "templates";
type Day = { date: string; clicks: number; signups: number; paid: number; leads: number };
type Dashboard = {
  clicks: number; signups: number; paid_conversions: number; first_payment_cents: number;
  lead_status: Record<string, number>; daily: Day[];
};
type ReferralLink = {
  id: string; owner_id: string; owner_name: string; url: string; is_active: boolean;
  clicks: number; signups: number; paid_conversions: number; first_payment_cents: number;
};
type Lead = {
  id: string; owner_id: string; owner_name: string; name: string; email: string | null;
  phone: string | null; notes: string | null; status: string; created_at: string; updated_at: string;
};
type Review = { id: string; user_name: string; risk_reason: string | null; created_at: string };

const statusLabels: Record<string, string> = {
  new: "Novo", contacted: "Contato inicial", negotiating: "Negociando",
  converted: "Convertido", lost: "Perdido",
};
const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Visão geral", icon: BarChart3 },
  { id: "referrals", label: "Indicações", icon: Link2 },
  { id: "leads", label: "Leads", icon: Users },
  { id: "templates", label: "Mensagens", icon: ClipboardCopy },
];
const templates = [
  { day: "Dia 1", title: "Apresentação", body: "Olá, {nome}! Sou da equipe do Redator. Posso mostrar como a plataforma ajuda alunos e professores a transformar cada redação em um plano de evolução? Se preferir, não volto a entrar em contato." },
  { day: "Dia 3", title: "Tirar dúvidas", body: "Olá, {nome}! Passando para saber se ficou alguma dúvida sobre as correções e os relatórios do Redator. Posso explicar como funciona, sem compromisso." },
  { day: "Dia 7", title: "Próximo passo", body: "Olá, {nome}! Se fizer sentido para você, posso enviar o link de cadastro e apresentar os planos disponíveis hoje. Caso não queira mais mensagens, é só me avisar." },
];

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="border-t border-slate-300 pt-4">
    <p className="text-sm text-slate-600">{label}</p>
    <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-slate-950">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{hint}</p>
  </div>;
}

function ActivityChart({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.map((day) => day.clicks));
  return <section className="rounded-2xl bg-white p-5 sm:p-6" aria-labelledby="activity-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 id="activity-title" className="font-display text-lg font-semibold text-slate-950">Atividade dos últimos 30 dias</h2>
        <p className="mt-1 text-sm text-slate-600">Cliques, cadastros e assinaturas pagas por dia (UTC). Escala: até {max} cliques/dia.</p></div>
      <div className="flex gap-4 text-xs text-slate-700"><span><i className="mr-1 inline-block size-2 rounded-full bg-brand-700" />Cliques</span><span><i className="mr-1 inline-block size-2 rounded-full bg-sky-400" />Cadastros</span><span><i className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />Pagantes</span></div>
    </div>
    <div className="mt-7 overflow-x-auto pb-2">
      <div className="flex h-48 min-w-[620px] items-end gap-1 border-b border-slate-200" role="img" aria-label="Gráfico de barras de cliques, cadastros e assinaturas pagas nos últimos 30 dias">
        {days.map((day) => <div key={day.date} className="flex h-full min-w-4 flex-1 items-end justify-center gap-px" title={`${day.date}: ${day.clicks} cliques, ${day.signups} cadastros, ${day.paid} pagantes`}>
          <span className="w-1/3 rounded-t-sm bg-brand-700" style={{ height: `${Math.max(day.clicks ? 4 : 0, day.clicks / max * 100)}%` }} />
          <span className="w-1/3 rounded-t-sm bg-sky-400" style={{ height: `${Math.max(day.signups ? 4 : 0, day.signups / max * 100)}%` }} />
          <span className="w-1/3 rounded-t-sm bg-emerald-500" style={{ height: `${Math.max(day.paid ? 4 : 0, day.paid / max * 100)}%` }} />
        </div>)}
      </div>
      <div className="mt-2 flex min-w-[620px] justify-between text-xs text-slate-500"><span>{days[0]?.date}</span><span>{days.at(-1)?.date}</span></div>
    </div>
    <p className="mt-1 text-xs text-ink-muted sm:hidden">Deslize o gráfico para ver todos os dias.</p>
    <details className="mt-4 text-sm text-slate-600"><summary className="cursor-pointer font-medium text-brand-700">Ver valores diários em tabela</summary>
      <div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr><th className="py-2">Dia</th><th>Cliques</th><th>Cadastros</th><th>Pagantes</th><th>Leads</th></tr></thead><tbody>{days.map((day) => <tr key={day.date} className="border-t border-slate-100"><td className="py-1.5">{day.date}</td><td>{day.clicks}</td><td>{day.signups}</td><td>{day.paid}</td><td>{day.leads}</td></tr>)}</tbody></table></div>
    </details>
  </section>;
}

function Modal({ titleId, onClose, children }: { titleId: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return <dialog ref={dialogRef} onClose={onClose} aria-labelledby={titleId} className="w-full max-w-lg rounded-2xl border border-ink-line bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/60">
    {children}
  </dialog>;
}

export default function MarketingPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [tab, setTab] = useState<Tab>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [leadDraft, setLeadDraft] = useState({ name: "", email: "", phone: "", notes: "", consent_confirmed: false });
  const [editing, setEditing] = useState<Lead | null>(null);
  const [adminSearch, setAdminSearch] = useState("");
  const [candidates, setCandidates] = useState<AdminUserItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const navRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const role = user?.admin_role;
  const allowed = role && ["sales", "marketing_manager", "admin", "superadmin"].includes(role);
  const manager = role && ["marketing_manager", "admin", "superadmin"].includes(role);
  const admin = role && ["admin", "superadmin"].includes(role);

  const fetchData = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    try {
      const common = ownerFilter ? { owner_id: ownerFilter } : {};
      const [stats, linkList, leadList, sellerList] = await Promise.all([
        api.get<Dashboard>("/marketing/dashboard", { params: common }),
        api.get<ReferralLink[]>("/marketing/referrals", { params: common }),
        api.get<{ items: Lead[]; total: number }>("/marketing/leads", {
          params: { ...common, status: statusFilter || undefined, from_date: fromDate || undefined,
            to_date: toDate || undefined, page, per_page: 25 },
        }),
        api.get<{ id: string; name: string }[]>("/marketing/sellers"),
      ]);
      setDashboard(stats.data); setLinks(linkList.data);
      setSellers(sellerList.data);
      setLeads(leadList.data.items); setLeadTotal(leadList.data.total);
      if (admin) {
        const reviewResponse = await api.get<Review[]>("/admin/referrals/reviews");
        setReviews(reviewResponse.data);
      }
    } catch (cause) {
      const detail = getApiError(cause);
      setError(detail.status === 401 ? "Sua sessão comercial expirou. Entre novamente." : "Não foi possível carregar os dados. Tente atualizar a página.");
    } finally { setLoading(false); }
  }, [allowed, admin, ownerFilter, statusFilter, fromDate, toDate, page]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!isLoading && !allowed) router.replace(user ? "/dashboard" : "/auth/login?redirect=%2Fmarketing");
  }, [allowed, isLoading, router, user]);
  useEffect(() => {
    if (!mobileNav) return;
    const main = mainRef.current;
    const menuButton = menuButtonRef.current;
    if (main) main.inert = true;
    navRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setMobileNav(false); return; }
      if (event.key !== "Tab") return;
      const focusables = navRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { if (main) main.inert = false; document.removeEventListener("keydown", onKeyDown); menuButton?.focus(); };
  }, [mobileNav]);

  const leaders = useMemo(() => {
    const byOwner = new Map<string, { name: string; clicks: number; signups: number; paid: number; revenue: number }>();
    links.forEach((link) => {
      const row = byOwner.get(link.owner_id) ?? { name: link.owner_name, clicks: 0, signups: 0, paid: 0, revenue: 0 };
      row.clicks += link.clicks; row.signups += link.signups; row.paid += link.paid_conversions;
      row.revenue += link.first_payment_cents; byOwner.set(link.owner_id, row);
    });
    return [...byOwner.values()].sort((a, b) => b.paid - a.paid || b.signups - a.signups);
  }, [links]);

  async function act(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(""); setSuccess("");
    try { await action(); setSuccess(message); await fetchData(); }
    catch (cause) { const detail = getApiError(cause).detail; setError(typeof detail === "string" ? detail : "A operação falhou. Tente novamente."); }
    finally { setBusy(false); }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setSuccess("Copiado para a área de transferência."); }
    catch { setError("Não foi possível copiar. Selecione e copie o texto manualmente."); }
  }

  async function logout() {
    try { await api.post("/auth/logout"); } finally { router.replace("/auth/login"); }
  }

  if (isLoading || !allowed) return <div className="flex min-h-dvh items-center justify-center bg-paper text-ink-soft">Carregando área de marketing…</div>;

  return <div className="min-h-dvh bg-paper text-ink">
    <div className="mx-auto flex min-h-dvh max-w-[1600px]">
      {mobileNav && <button type="button" onClick={() => setMobileNav(false)} className="fixed inset-0 z-20 bg-ink/50 lg:hidden" aria-label="Fechar menu de marketing" tabIndex={-1} />}
      <aside ref={navRef} id="marketing-nav" role={mobileNav ? "dialog" : undefined} aria-modal={mobileNav ? true : undefined} aria-label={mobileNav ? "Menu de marketing" : undefined} className={`${mobileNav ? "fixed inset-y-0 left-0 z-30 flex" : "hidden"} w-64 flex-col border-r border-ink-line bg-paper text-ink shadow-xl lg:sticky lg:top-0 lg:flex lg:h-dvh lg:shadow-none`}>
        <div className="flex items-center justify-between border-b border-ink-line px-6 py-6"><div><p className="font-display text-xl font-semibold">Redator</p><p className="mt-1 text-xs text-ink-muted">Marketing e vendas</p></div><button onClick={() => setMobileNav(false)} className="lg:hidden" aria-label="Fechar menu"><X size={20} /></button></div>
        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Navegação de marketing">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setTab(id); setMobileNav(false); }} aria-current={tab === id ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${tab === id ? "bg-brand-50 text-brand-800" : "text-ink-soft hover:bg-paper-deep hover:text-ink"}`}><Icon size={18} />{label}</button>)}</nav>
        <div className="border-t border-ink-line p-4"><p className="truncate px-2 text-sm font-medium">{user.full_name}</p><p className="px-2 text-xs text-ink-muted">{role === "sales" ? "Vendedor" : role === "marketing_manager" ? "Gestor de marketing" : "Administração"}</p>{admin && <Link href="/dashboard/admin" className="mt-3 block rounded-lg px-2 py-2 text-sm text-ink-soft hover:bg-paper-deep">Voltar ao painel admin</Link>}<button onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-soft hover:bg-paper-deep"><LogOut size={16} />Sair</button></div>
      </aside>
      <main ref={mainRef} className="min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-3"><button ref={menuButtonRef} onClick={() => setMobileNav(true)} className="rounded-lg p-2 text-ink lg:hidden" aria-label="Abrir menu" aria-expanded={mobileNav} aria-controls="marketing-nav"><Menu size={22} /></button><h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{tabs.find((item) => item.id === tab)?.label}</h1></div><p className="mt-2 max-w-2xl text-sm text-ink-muted">{tab === "overview" ? "Acompanhe a jornada do primeiro clique até a assinatura confirmada." : tab === "referrals" ? "Links privados e atribuição de cadastros sem expor dados dos usuários indicados." : tab === "leads" ? "Contatos internos, com acompanhamento individual e acesso controlado." : "Modelos para copiar, adaptar e enviar manualmente."}</p></div><button type="button" disabled={loading} onClick={() => void fetchData()} className="inline-flex items-center gap-2 rounded-lg border border-ink-line bg-paper px-3 py-2 text-sm font-medium hover:bg-paper-deep disabled:opacity-50"><RefreshCw size={16} />Atualizar</button></header>
          {manager && <div className="mt-6 flex flex-wrap items-center gap-3"><label htmlFor="seller-filter" className="text-sm font-medium text-slate-700">Vendedor</label><select id="seller-filter" value={ownerFilter} onChange={(event) => { setOwnerFilter(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Toda a equipe</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></div>}
          {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {success && <p role="status" className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}
          {loading && <p className="mt-8 text-sm text-slate-600">Atualizando dados…</p>}

          {tab === "overview" && dashboard && <div className="mt-7 space-y-6">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Totais acumulados desde a criação dos links</p>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Cliques registrados" value={String(dashboard.clicks)} hint="Visitas ao link, incluindo repetições" />
              <Stat label="Cadastros atribuídos" value={String(dashboard.signups)} hint="Contas criadas pelo link" />
              <Stat label="Assinaturas confirmadas" value={String(dashboard.paid_conversions)} hint="Pagantes com indicação válida" />
              <Stat label="Primeiras cobranças" value={formatMoney(dashboard.first_payment_cents)} hint="Valor bruto conhecido; não é receita recorrente" />
            </div>
            <ActivityChart days={dashboard.daily} />
            <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
              <section className="rounded-2xl bg-white p-5 sm:p-6"><h2 className="font-display text-lg font-semibold">Funil de indicação</h2><p className="mt-1 text-sm text-slate-600">Taxas estimadas; cliques não são visitantes únicos.</p>
                <div className="mt-5 space-y-4">{[
                  { label: "Cliques", count: dashboard.clicks, percent: 100 },
                  { label: "Cadastros", count: dashboard.signups, percent: dashboard.clicks ? dashboard.signups / dashboard.clicks * 100 : 0 },
                  { label: "Pagantes válidos", count: dashboard.paid_conversions, percent: dashboard.clicks ? dashboard.paid_conversions / dashboard.clicks * 100 : 0 },
                ].map((step) => <div key={step.label}><div className="flex justify-between text-sm"><span>{step.label}</span><strong className="tabular-nums">{step.count} <span className="font-normal text-slate-500">({step.percent.toFixed(1)}%)</span></strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-700" style={{ width: `${Math.min(step.percent, 100)}%` }} /></div></div>)}</div>
              </section>
              <section className="rounded-2xl bg-white p-5 sm:p-6"><h2 className="font-display text-lg font-semibold">Leads por etapa</h2><p className="mt-1 text-sm text-slate-600">Contatos adicionados manualmente.</p><div className="mt-4 divide-y divide-slate-100">{Object.entries(statusLabels).map(([key, label]) => <div key={key} className="flex justify-between py-2.5 text-sm"><span>{label}</span><strong className="tabular-nums">{dashboard.lead_status[key] ?? 0}</strong></div>)}</div></section>
            </div>
            {manager && <section className="rounded-2xl bg-white p-5 sm:p-6"><h2 className="font-display text-lg font-semibold">Desempenho por vendedor</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[550px] text-left text-sm"><thead className="border-b border-slate-200 text-slate-600"><tr><th className="py-3">Vendedor</th><th>Cliques</th><th>Cadastros</th><th>Pagantes</th><th>Primeiras cobranças</th></tr></thead><tbody>{leaders.map((row) => <tr key={row.name} className="border-b border-slate-100"><th className="py-3 font-medium">{row.name}</th><td>{row.clicks}</td><td>{row.signups}</td><td>{row.paid}</td><td>{formatMoney(row.revenue)}</td></tr>)}</tbody></table>{leaders.length === 0 && <p className="py-5 text-sm text-slate-500">Nenhum link comercial criado ainda.</p>}</div></section>}
          </div>}

          {tab === "referrals" && <div className="mt-7 space-y-6"><section className="rounded-2xl bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Seu link pessoal</h2><p className="mt-1 text-sm text-slate-600">O código é aleatório e não contém informações pessoais.</p></div><button disabled={busy} onClick={() => void act(() => api.post("/marketing/referrals"), "Link pessoal pronto para compartilhar.")} className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"><Plus size={16} />Gerar meu link</button></div></section>
            <section className="overflow-x-auto rounded-2xl bg-white"><h2 className="px-5 py-5 font-display text-lg font-semibold">Links e resultados</h2><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">Responsável</th><th>Cliques</th><th>Cadastros</th><th>Pagantes</th><th>Primeiras cobranças</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{links.map((link) => <tr key={link.id} className="border-t border-slate-100"><td className="px-5 py-3 font-medium">{link.owner_name}</td><td>{link.clicks}</td><td>{link.signups}</td><td>{link.paid_conversions}</td><td>{formatMoney(link.first_payment_cents)}</td><td>{link.is_active ? "Ativo" : "Pausado"}</td><td className="space-x-3"><button onClick={() => void copy(link.url)} className="font-medium text-brand-700 hover:underline">Copiar</button><button disabled={busy} onClick={() => void act(() => api.patch(`/marketing/referrals/${link.id}/active`, null, { params: { active: !link.is_active } }), "Estado do link atualizado.")} className="text-slate-700 hover:underline disabled:opacity-50">{link.is_active ? "Pausar" : "Ativar"}</button></td></tr>)}</tbody></table>{links.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">Nenhum link neste escopo. Gere o seu para começar.</p>}</section>
            {admin && <section className="rounded-2xl bg-white p-5 sm:p-6"><h2 className="font-display text-lg font-semibold">Links para parceiros existentes</h2><p className="mt-1 text-sm text-slate-600">A criação para usuários comuns continua restrita a admins.</p><div className="mt-4 flex flex-wrap gap-2"><input aria-label="Buscar usuário" value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} placeholder="Nome ou e-mail" className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button onClick={async () => { if (adminSearch.trim().length < 3) return; try { const response = await api.get<AdminUsersResponse>("/admin/users", { params: { search: adminSearch.trim(), per_page: 10 } }); setCandidates(response.data.items.filter((item) => item.is_active && !item.admin_role)); } catch { setError("Não foi possível buscar usuários."); } }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Buscar</button></div><div className="mt-3 max-h-48 overflow-auto">{candidates.map((candidate) => <button key={candidate.id} onClick={() => setSelectedUser(candidate)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${selectedUser?.id === candidate.id ? "bg-brand-50" : "hover:bg-slate-50"}`}>{candidate.full_name} <span className="text-slate-500">({candidate.email})</span></button>)}</div><button disabled={!selectedUser || busy} onClick={() => void act(() => api.post("/admin/referrals", { owner_id: selectedUser?.id }), "Link criado para o parceiro.")} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Criar link para {selectedUser?.full_name ?? "usuário selecionado"}</button></section>}
            {admin && <section className="rounded-2xl bg-white p-5 sm:p-6"><h2 className="font-display text-lg font-semibold">Revisão de indicações</h2><p className="mt-1 text-sm text-slate-600">Sinais de rede ou navegador compartilhados exigem decisão humana; não são fraude confirmada.</p>{reviews.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nenhuma indicação pendente.</p> : <ul className="mt-4 divide-y divide-slate-100">{reviews.map((review) => <li key={review.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong>{review.user_name}</strong><p className="text-slate-500">{review.risk_reason ?? "Revisão"} · {new Date(review.created_at).toLocaleDateString("pt-BR")}</p></div><div className="flex gap-2"><button disabled={busy} onClick={() => void act(() => api.patch(`/admin/referrals/reviews/${review.id}`, { status: "valid" }), "Indicação aprovada.")} className="rounded-lg border border-emerald-300 px-3 py-2 text-emerald-800">Aprovar</button><button disabled={busy} onClick={() => void act(() => api.patch(`/admin/referrals/reviews/${review.id}`, { status: "rejected" }), "Indicação rejeitada.")} className="rounded-lg border border-red-300 px-3 py-2 text-red-800">Rejeitar</button></div></li>)}</ul>}</section>}
          </div>}

          {tab === "leads" && <div className="mt-7 space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div className="flex flex-wrap gap-2"><label className="text-xs text-slate-600">Status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Todos</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-xs text-slate-600">De<input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label><label className="text-xs text-slate-600">Até<input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label></div><button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />Adicionar lead</button></div>
            <section className="overflow-x-auto rounded-2xl bg-white"><div className="flex justify-between px-5 py-5"><h2 className="font-display text-lg font-semibold">Contatos</h2><span className="text-sm tabular-nums text-slate-600">{leadTotal} no filtro</span></div><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">Nome / contato</th><th>Responsável</th><th>Status</th><th>Adicionado</th><th>Atualizado</th><th>Ação</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} className="border-t border-slate-100"><td className="px-5 py-3"><strong>{lead.name}</strong><p className="text-slate-600">{lead.email ?? lead.phone ?? "Sem contato informado"}</p></td><td>{lead.owner_name}</td><td>{statusLabels[lead.status] ?? lead.status}</td><td>{new Date(lead.created_at).toLocaleDateString("pt-BR")}</td><td>{new Date(lead.updated_at).toLocaleDateString("pt-BR")}</td><td><button onClick={() => setEditing(lead)} className="font-medium text-brand-700 hover:underline">Editar</button></td></tr>)}</tbody></table>{leads.length === 0 && <p className="px-5 py-8 text-sm text-slate-500">Nenhum lead neste filtro. Adicione um contato autorizado ou ajuste os filtros.</p>}</section><div className="flex items-center justify-end gap-3"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Anterior</button><span className="text-sm">Página {page}</span><button disabled={page * 25 >= leadTotal} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Próxima</button></div>
          </div>}

          {tab === "templates" && <div className="mt-7 grid gap-4 lg:grid-cols-3">{templates.map((template) => <section key={template.day} className="flex flex-col rounded-2xl bg-white p-5 sm:p-6"><p className="text-sm font-medium text-brand-700">{template.day}</p><h2 className="mt-2 font-display text-lg font-semibold">{template.title}</h2><p className="mt-4 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{template.body}</p><button onClick={() => void copy(template.body)} className="mt-6 inline-flex items-center gap-2 self-start rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"><ClipboardCopy size={16} />Copiar mensagem</button></section>)}<p className="lg:col-span-3 text-xs text-slate-600">Envio manual. Confirme a autorização do contato, adapte o nome e respeite pedidos para não receber novas mensagens.</p></div>}
        </div>
      </main>
    </div>

    {showAdd && <Modal titleId="marketing-add-lead-title" onClose={() => setShowAdd(false)}><form onSubmit={(event) => { event.preventDefault(); void act(async () => { await api.post("/marketing/leads", { name: leadDraft.name, email: leadDraft.email || null, phone: leadDraft.phone || null, notes: leadDraft.notes || null, consent_confirmed: leadDraft.consent_confirmed, owner_id: manager && ownerFilter ? ownerFilter : undefined }); setShowAdd(false); setLeadDraft({ name: "", email: "", phone: "", notes: "", consent_confirmed: false }); }, "Lead adicionado."); }} className="max-h-[calc(100dvh-2rem)] space-y-4 overflow-y-auto p-6"><div className="flex items-center justify-between"><h2 id="marketing-add-lead-title" className="font-display text-xl font-semibold">Adicionar lead</h2><button type="button" onClick={() => setShowAdd(false)} aria-label="Fechar"><X size={20} /></button></div><label className="block text-sm font-medium">Nome<input required minLength={2} maxLength={100} value={leadDraft.name} onChange={(event) => setLeadDraft({ ...leadDraft, name: event.target.value })} className="mt-1 w-full rounded-lg border border-ink-line px-3 py-2" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">E-mail (opcional)<input type="email" value={leadDraft.email} onChange={(event) => setLeadDraft({ ...leadDraft, email: event.target.value })} className="mt-1 w-full rounded-lg border border-ink-line px-3 py-2" /></label><label className="block text-sm font-medium">Telefone (opcional)<input value={leadDraft.phone} onChange={(event) => setLeadDraft({ ...leadDraft, phone: event.target.value })} className="mt-1 w-full rounded-lg border border-ink-line px-3 py-2" /></label></div><label className="block text-sm font-medium">Observações<textarea maxLength={2000} rows={3} value={leadDraft.notes} onChange={(event) => setLeadDraft({ ...leadDraft, notes: event.target.value })} className="mt-1 w-full rounded-lg border border-ink-line px-3 py-2" /></label><label className="flex gap-2 text-sm text-ink-soft"><input type="checkbox" required checked={leadDraft.consent_confirmed} onChange={(event) => setLeadDraft({ ...leadDraft, consent_confirmed: event.target.checked })} />Confirmo que tenho autorização para registrar e contatar esta pessoa.</label><button disabled={busy} className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">Salvar lead</button></form></Modal>}
    {editing && <Modal titleId="marketing-edit-lead-title" onClose={() => setEditing(null)}><form onSubmit={(event) => { event.preventDefault(); void act(async () => { await api.patch(`/marketing/leads/${editing.id}`, { status: editing.status, notes: editing.notes }); setEditing(null); }, "Lead atualizado."); }} className="max-h-[calc(100dvh-2rem)] space-y-4 overflow-y-auto p-6"><div className="flex items-center justify-between"><h2 id="marketing-edit-lead-title" className="font-display text-xl font-semibold">{editing.name}</h2><button type="button" onClick={() => setEditing(null)} aria-label="Fechar"><X size={20} /></button></div><p className="text-sm text-ink-muted">{editing.email ?? editing.phone ?? "Sem contato informado"}</p><label className="block text-sm font-medium">Status<select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value })} className="mt-1 w-full rounded-lg border border-ink-line px-3 py-2">{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="block text-sm font-medium">Observações<textarea rows={5} maxLength={2000} value={editing.notes ?? ""} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} className="mt-1 w-full rounded-lg border border-ink-line px-3 py-2" /></label><button disabled={busy} className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">Salvar alterações</button></form></Modal>}
  </div>;
}
