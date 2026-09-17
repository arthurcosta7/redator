"""
ocr_service.py — Serviço de OCR (extração de texto de imagens)

Usa Google Cloud Vision API para extrair texto de fotos de redações.

Segurança:
- A imagem é enviada diretamente para a API (não salva em disco)
- O texto extraído é sanitizado antes de usar
- Tamanho máximo validado antes de enviar para a API
"""
import asyncio
import re
import time

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)
_ocr_slots = asyncio.Semaphore(settings.OCR_MAX_CONCURRENCY)


class OCRUnavailableError(RuntimeError):
    """Google Cloud Vision não conseguiu processar a imagem."""


class OCRService:
    """
    Serviço de extração de texto de imagens usando Google Cloud Vision.

    Como funciona:
    1. Recebe os bytes da imagem
    2. Envia para a Google Cloud Vision API
    3. Recebe o texto extraído
    4. Sanitiza e normaliza o texto
    5. Retorna o texto limpo
    """

    async def extract_text(self, image_bytes: bytes) -> str:
        """
        Extrai texto de uma imagem.

        Args:
            image_bytes: Conteúdo da imagem em bytes

        Returns:
            Texto extraído e sanitizado

        Raises:
            Exception: Se a API falhar ou não conseguir extrair texto
        """
        started = time.perf_counter()
        try:
            async with _ocr_slots:
                async with asyncio.timeout(settings.OCR_TIMEOUT_SECONDS):
                    full_text = await asyncio.to_thread(
                        self._google_ocr_sync, image_bytes
                    )
        except Exception as google_error:
            logger.warning(
                "ocr_provider_failed",
                provider="google_vision",
                calls=1,
                success=False,
                duration_ms=round((time.perf_counter() - started) * 1000),
                extracted_characters=0,
                error_type=type(google_error).__name__,
            )
            raise OCRUnavailableError(
                "Google Cloud Vision está indisponível"
            ) from google_error

        sanitized = self._sanitize_extracted_text(full_text)
        logger.info(
            "ocr_usage",
            provider="google_vision",
            calls=1,
            success=True,
            duration_ms=round((time.perf_counter() - started) * 1000),
            extracted_characters=len(sanitized),
        )
        return sanitized

    @staticmethod
    def _google_ocr_sync(image_bytes: bytes) -> str:
        """Executa o SDK síncrono fora do event loop do FastAPI."""
        from google.cloud import vision
        from google.oauth2 import service_account

        credentials = None
        if settings.GOOGLE_APPLICATION_CREDENTIALS:
            # O Pydantic lê o .env, mas não exporta seus valores para o processo.
            # Entregamos a credencial diretamente ao SDK sem expor seu conteúdo.
            credentials = service_account.Credentials.from_service_account_file(
                settings.GOOGLE_APPLICATION_CREDENTIALS
            )

        client_kwargs = {
            "client_options": {"api_endpoint": settings.GOOGLE_VISION_API_ENDPOINT}
        }
        if credentials is not None:
            client_kwargs["credentials"] = credentials
        client = vision.ImageAnnotatorClient(**client_kwargs)
        try:
            response = client.document_text_detection(
                image=vision.Image(content=image_bytes),
                timeout=settings.OCR_TIMEOUT_SECONDS,
            )
        finally:
            close_client = getattr(client, "close", None)
            if callable(close_client):
                close_client()
            else:
                # Versões anteriores do SDK expõem o fechamento no transporte.
                close_transport = getattr(client.transport, "close", None)
                if callable(close_transport):
                    close_transport()
        if response.error.message:
            raise RuntimeError("Google Vision não conseguiu processar a imagem")
        return str(response.full_text_annotation.text)

    def _sanitize_extracted_text(self, text: str) -> str:
        """
        Limpa e normaliza o texto extraído pelo OCR.

        OCR pode extrair:
        - Caracteres de controle indesejados
        - Espaços duplicados
        - Quebras de linha extras
        """
        if not text:
            return ""

        # Remove caracteres de controle (exceto \n e \t)
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

        # Normaliza quebras de linha (remove linhas com apenas espaços)
        lines = text.splitlines()
        cleaned_lines = []

        for line in lines:
            stripped = line.strip()
            if stripped:
                cleaned_lines.append(stripped)

        # Reconstrói o texto com parágrafos (2 quebras de linha = novo parágrafo)
        result = "\n".join(cleaned_lines)

        # Remove espaços duplicados dentro de linhas
        result = re.sub(r" {2,}", " ", result)

        # Limita tamanho (segurança: não processa textos gigantes)
        max_chars = 15000  # ~3x o máximo de uma redação
        if len(result) > max_chars:
            original_length = len(result)
            result = result[:max_chars]
            logger.warning("texto_ocr_truncado", original_length=original_length)

        return result.strip()
