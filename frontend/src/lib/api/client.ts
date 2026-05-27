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
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register");

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
        // Refresh falhou — redireciona para login
        if (typeof window !== "undefined") {
          window.location.href = "/auth/login";
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
