/**
 * client.ts — Cliente HTTP para comunicação com o backend
 *
 * Configurações de segurança:
 * - withCredentials: true → envia cookies httpOnly automaticamente
 * - Interceptor de resposta: renova o access token automaticamente quando expira
 * - Não loga dados sensíveis
 */
import axios, { AxiosError, AxiosInstance } from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  withCredentials: true,   // Envia cookies httpOnly (access_token, refresh_token)
  timeout: 30000,          // 30 segundos de timeout
  headers: {
    "Content-Type": "application/json",
    // Nota: X-Requested-With removido — causa falha no preflight CORS
    // A proteção CSRF já é feita pelos cookies SameSite=strict + CORS
  },
});

export interface ApiFieldError {
  field: string;
  message: string;
}

export function getApiError(error: unknown): {
  detail?: unknown;
  status?: number;
  errors: ApiFieldError[];
} {
  if (!axios.isAxiosError<{ detail?: unknown; errors?: unknown }>(error)) {
    return { errors: [] };
  }

  const data = error.response?.data;
  const errors = Array.isArray(data?.errors)
    ? data.errors.filter(
        (item): item is ApiFieldError =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>).field === "string" &&
          typeof (item as Record<string, unknown>).message === "string"
      )
    : [];

  return {
    detail: data?.detail,
    status: error.response?.status,
    errors,
  };
}

// ─── Interceptor de resposta — renova token automaticamente ─────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: AxiosError | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(undefined);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    // Endpoints de auth resolvem seus próprios erros — não interceptar
    const url = originalRequest?.url ?? "";
    const isAuthEndpoint = url.startsWith("/auth/");

    // Se receber 401 e não estiver num retry, tenta renovar o token
    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Se já está renovando, fila a requisição
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest!))
          .catch((err) => Promise.reject(err));
      }

      originalRequest!._retry = true;
      isRefreshing = true;

      try {
        // Tenta renovar o access token usando o refresh token (cookie httpOnly)
        await api.post("/auth/refresh");
        processQueue(null);
        return api(originalRequest!);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError);
        // Refresh falhou — redireciona para login preservando a URL atual
        if (typeof window !== "undefined") {
          const returnUrl = window.location.pathname + window.location.search;
          const isAuthPage = returnUrl.startsWith("/auth/");
          window.location.href = isAuthPage
            ? "/auth/login"
            : `/auth/login?redirect=${encodeURIComponent(returnUrl)}`;
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
