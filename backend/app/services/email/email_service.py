"""
email_service.py — Serviço de envio de emails

Usa Resend (resend.com) para envio de emails transacionais.

Emails enviados:
- Verificação de email após cadastro
- Reset de senha
- Confirmação de plano/pagamento
"""
import resend

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Configura o SDK do Resend
resend.api_key = settings.RESEND_API_KEY


class EmailService:
    """Serviço de envio de emails transacionais."""

    async def send_verification_email(
        self,
        to_email: str,
        to_name: str,
        verification_token: str,
    ) -> None:
        """Envia email de verificação após cadastro."""
        verification_url = (
            f"{settings.FRONTEND_URL}/auth/verify-email/{verification_token}"
        )

        html_content = f"""
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #1D4ED8; font-size: 28px; margin: 0;">Redator</h1>
                <p style="color: #64748B; margin: 8px 0 0 0;">Plataforma de Correção de Redações</p>
            </div>

            <div style="background: #F8FAFC; border-radius: 12px; padding: 32px;">
                <h2 style="color: #0F172A; font-size: 20px; margin: 0 0 16px 0;">
                    Verifique seu email, {to_name.split()[0]}!
                </h2>
                <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                    Bem-vindo ao Redator! Para ativar sua conta e começar a corrigir suas redações,
                    clique no botão abaixo para verificar seu email.
                </p>

                <div style="text-align: center; margin: 32px 0;">
                    <a href="{verification_url}"
                       style="background: #1D4ED8; color: white; padding: 14px 32px;
                              border-radius: 8px; text-decoration: none; font-weight: 600;
                              font-size: 16px; display: inline-block;">
                        Verificar meu email →
                    </a>
                </div>

                <p style="color: #94A3B8; font-size: 14px; margin: 0; text-align: center;">
                    Este link expira em 24 horas. Se você não criou uma conta, ignore este email.
                </p>
            </div>

            <p style="color: #94A3B8; font-size: 12px; text-align: center; margin-top: 24px;">
                Redator — Corrija melhor, escreva melhor.
            </p>
        </div>
        """

        await self._send(
            to_email=to_email,
            subject="Verifique seu email — Redator",
            html_content=html_content,
        )

    async def send_password_reset_email(
        self,
        to_email: str,
        to_name: str,
        reset_token: str,
    ) -> None:
        """Envia email de reset de senha."""
        reset_url = f"{settings.FRONTEND_URL}/auth/reset-password/{reset_token}"

        html_content = f"""
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #1D4ED8; font-size: 28px; margin: 0;">Redator</h1>
            </div>

            <div style="background: #F8FAFC; border-radius: 12px; padding: 32px;">
                <h2 style="color: #0F172A; font-size: 20px; margin: 0 0 16px 0;">
                    Redefinição de senha
                </h2>
                <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                    Recebemos uma solicitação para redefinir a senha da sua conta ({to_email}).
                    Clique no botão abaixo para criar uma nova senha.
                </p>

                <div style="text-align: center; margin: 32px 0;">
                    <a href="{reset_url}"
                       style="background: #1D4ED8; color: white; padding: 14px 32px;
                              border-radius: 8px; text-decoration: none; font-weight: 600;
                              font-size: 16px; display: inline-block;">
                        Redefinir minha senha →
                    </a>
                </div>

                <p style="color: #94A3B8; font-size: 14px; margin: 0; text-align: center;">
                    Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este email.
                    Sua senha atual continua segura.
                </p>
            </div>
        </div>
        """

        await self._send(
            to_email=to_email,
            subject="Redefinição de senha — Redator",
            html_content=html_content,
        )

    async def _send(self, to_email: str, subject: str, html_content: str) -> None:
        """Método interno de envio."""
        try:
            params: resend.Emails.SendParams = {
                "from": f"{settings.FROM_NAME} <{settings.FROM_EMAIL}>",
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            }
            resend.Emails.send(params)
            logger.info("email_enviado", to=to_email[:3] + "***", subject=subject)
        except Exception as e:
            logger.error("erro_envio_email", error=str(e))
            raise
