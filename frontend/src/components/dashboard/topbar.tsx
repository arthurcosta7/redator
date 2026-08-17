"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Bell, LogOut, ChevronDown, User } from "lucide-react";
import { api } from "@/lib/api/client";
import { useUser } from "@/contexts/UserContext";

interface TopbarProps {
  onMenuClick: () => void;
  title?: string;
}

export function Topbar({ onMenuClick, title }: TopbarProps) {
  const router = useRouter();
  const { user } = useUser();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignora erros — faz logout mesmo assim
    } finally {
      router.push("/auth/login");
    }
  };

  const initials = user?.full_name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <header className="h-16 border-b border-ink-line bg-paper/80 backdrop-blur-xl flex items-center px-4 sm:px-7 gap-4 sticky top-0 z-10">
      {/* Botão de menu mobile */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded text-ink-muted hover:bg-paper-deep hover:text-ink transition-colors"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Título da página */}
      {title && (
        <h1 className="font-display font-medium text-ink text-xl hidden sm:block">
          {title}
        </h1>
      )}

      <div className="flex-1" />

      {/* Notificações (placeholder) */}
      <button aria-label="Notificações" className="relative p-2 rounded text-ink-muted hover:bg-paper-deep hover:text-ink transition-colors">
        <Bell className="w-5 h-5" />
      </button>

      {/* Menu do usuário */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 p-1.5 rounded hover:bg-paper-deep transition-colors"
          aria-expanded={dropdownOpen}
          aria-haspopup="menu"
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded bg-accent-light flex items-center justify-center">
            <span className="font-mono text-[10px] font-semibold text-accent-deep">{initials}</span>
          </div>
          <span className="text-sm font-medium text-slate-700 hidden sm:block max-w-[120px] truncate">
            {user?.full_name.split(" ")[0]}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setDropdownOpen(false)}
              aria-hidden
            />
            <div role="menu" className="ui-popover product-surface absolute right-0 top-full mt-2 w-56 rounded border z-20 py-1.5 overflow-hidden">
              {/* Info do usuário */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user?.full_name}
                </p>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {user?.email}
                </p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    router.push("/dashboard/aluno/configuracoes");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  Meu perfil
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  <LogOut className="w-4 h-4" />
                  {isLoggingOut ? "Saindo..." : "Sair"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
