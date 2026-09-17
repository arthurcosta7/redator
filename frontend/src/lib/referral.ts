/** Sinais de indicação não são credenciais nem um identificador de hardware. */
export function getReferralRegistration(): { referral_code?: string; device_id?: string } {
  if (typeof document === "undefined") return {};
  const code = document.cookie.match(/(?:^|;\s*)redator_ref=([a-f0-9]{48})(?:;|$)/)?.[1];
  if (!code) return {};

  let deviceId: string | undefined;
  try {
    deviceId = localStorage.getItem("redator_device") ?? undefined;
    if (!deviceId || !/^[0-9a-f-]{36}$/.test(deviceId)) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("redator_device", deviceId);
    }
  } catch {
    // Navegadores podem bloquear storage; a indicação continua com sinal de rede.
  }
  return { referral_code: code, ...(deviceId ? { device_id: deviceId } : {}) };
}
