"""Obtém IP real somente de cabeçalho sobrescrito por proxy confiável."""
import ipaddress

from fastapi import Request

from app.core.config import settings


def client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    if not settings.TRUST_PROXY_REAL_IP:
        return peer
    try:
        # O backend de produção só escuta na interface local do host; Nginx
        # sobrescreve X-Real-IP com $remote_addr em toda requisição.
        if not ipaddress.ip_address(peer).is_private:
            return peer
        forwarded = request.headers.get("x-real-ip", "")
        return str(ipaddress.ip_address(forwarded)) if forwarded else peer
    except ValueError:
        return peer
